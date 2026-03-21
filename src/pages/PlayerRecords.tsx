import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { patches } from '../data/patches'
import DataTable, { NumericCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import type { PlayerRecordsResponse, PlayerRecordTuple, PlayerRecordAggregateTuple } from '../types'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

const RECORD_SECTIONS: { key: string; title: string; aggregate?: boolean }[] = [
  { key: 'kills', title: 'Most Kills' },
  { key: 'gpm', title: 'Highest GPM' },
  { key: 'last_hits', title: 'Most Last Hits' },
  { key: 'assists', title: 'Most Assists' },
  { key: 'xpm', title: 'Highest XPM' },
  { key: 'deaths', title: 'Most Deaths' },
  { key: 'denies', title: 'Most Denies' },
  { key: 'gold', title: 'Most Gold' },
  { key: 'hero_damage', title: 'Most Hero Damage' },
  { key: 'tower_damage', title: 'Most Tower Damage' },
  { key: 'hero_healing', title: 'Most Hero Healing' },
  { key: 'ka_0_death', title: 'K+A (0 Deaths)' },
  { key: 'kda_1_death', title: 'KDA (1+ Deaths)' },
  { key: 'kills_per_min', title: 'Kills Per Minute', aggregate: true },
  { key: 'assists_per_min', title: 'Assists Per Minute', aggregate: true },
  { key: 'deaths_per_min', title: 'Deaths Per Minute', aggregate: true },
]

interface RecordRow {
  steamId: string
  nickname: string
  value: number
  heroKey: string
  matchId: number
}

interface AggregateRow {
  steamId: string
  nickname: string
  value: number
  gameCount: number
}

function patchFromMatchId(matchId: number): string {
  for (const p of patches) {
    const pd = p as unknown as { name: string; lowerBound: number; upperBound: number }
    if (matchId >= pd.lowerBound && matchId <= pd.upperBound) return pd.name
  }
  return '—'
}

function HeroIconCell({ heroKey }: { heroKey: string }) {
  // heroKey may be a numeric ID (e.g. "1") or a name (e.g. "Anti-Mage")
  const entry = heroesById[heroKey] ?? Object.values(heroesById).find((h) => h.name === heroKey)
  const name = entry?.name ?? heroKey
  const src = entry?.picture ? heroImageUrl(entry.picture) : undefined
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {src && (
        <img src={src} alt={name} style={{ height: 22, width: 'auto' }} loading="lazy" />
      )}
      <span style={{ fontSize: '0.75rem' }}>{name}</span>
    </span>
  )
}

const recordColumns: ColumnDef<RecordRow, unknown>[] = [
  {
    id: 'nickname',
    accessorKey: 'nickname',
    header: 'Player',
    size: 140,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={Number(row.original.steamId)} nickname={row.original.nickname} />
    ),
  },
  {
    id: 'hero',
    accessorKey: 'heroKey',
    header: 'Hero',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroKey={row.original.heroKey} />,
  },
  {
    id: 'value',
    accessorKey: 'value',
    header: 'Value',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Record Value' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'patch',
    accessorFn: (row) => patchFromMatchId(row.matchId),
    header: 'Patch',
    size: 70,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{getValue() as string}</span>
    ),
  },
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a
        href={`/matches/${getValue()}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {getValue() as number}
      </a>
    ),
  },
]

const aggregateColumns: ColumnDef<AggregateRow, unknown>[] = [
  {
    id: 'nickname',
    accessorKey: 'nickname',
    header: 'Player',
    size: 140,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={Number(row.original.steamId)} nickname={row.original.nickname} />
    ),
  },
  {
    id: 'value',
    accessorKey: 'value',
    header: 'Average',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average per game' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'gameCount',
    accessorKey: 'gameCount',
    header: 'Games',
    size: 80,
    meta: { numeric: true },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

function getInitialKey(): string {
  const hash = window.location.hash.replace('#', '')
  if (RECORD_SECTIONS.some((s) => s.key === hash)) return hash
  return RECORD_SECTIONS[0].key
}

export default function PlayerRecords() {
  const [selectedKey, setSelectedKey] = useState(getInitialKey)
  const section = RECORD_SECTIONS.find((s) => s.key === selectedKey) ?? RECORD_SECTIONS[0]

  const selectKey = useCallback((key: string) => {
    setSelectedKey(key)
    window.location.hash = `#${key}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '')
      if (RECORD_SECTIONS.some((s) => s.key === hash)) setSelectedKey(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const {
    filters,
    setFilters,
    clearFilters,
    applyDefaults,
    apiParams,
    hasFilters,
    filtersCollapsed,
    setFiltersCollapsed,
  } = useFilters()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: PlayerRecordsResponse }>(
    hasFilters ? '/api/players/records' : null,
    apiParams,
  )

  const records = data?.data ?? null

  const recordRows: RecordRow[] = useMemo(() => {
    if (!records || section.aggregate) return []
    const tuples = (records[section.key] ?? []) as PlayerRecordTuple[]
    return tuples.map(([steamId, nickname, value, heroKey, matchId]) => ({
      steamId, nickname, value, heroKey, matchId,
    }))
  }, [records, section])

  const aggregateRows: AggregateRow[] = useMemo(() => {
    if (!records || !section.aggregate) return []
    const tuples = (records[section.key] ?? []) as PlayerRecordAggregateTuple[]
    return tuples.map(([steamId, nickname, value, gameCount]) => ({
      steamId, nickname, value, gameCount,
    }))
  }, [records, section])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Player Records</h1>
        <p className={styles.subtitle}>
          All-time single-match records and career averages in tier 1–2 matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching records..." />}

      {error && (
        <ErrorState
          message="Failed to load records"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {records && (
        <>
          <div className={toggleStyles.toggleRow} style={{ flexWrap: 'wrap' }}>
            {RECORD_SECTIONS.map((s) => (
              <button
                key={s.key}
                className={`${toggleStyles.toggleBtn} ${selectedKey === s.key ? toggleStyles.toggleActive : ''}`}
                onClick={() => selectKey(s.key)}
              >
                {s.title}
              </button>
            ))}
          </div>

          {section.aggregate ? (
            aggregateRows.length > 0 && (
              <DataTable
                data={aggregateRows}
                columns={aggregateColumns}
                defaultSorting={[{ id: 'value', desc: true }]}
                searchableColumns={['nickname']}
              />
            )
          ) : (
            recordRows.length > 0 && (
              <DataTable
                data={recordRows}
                columns={recordColumns}
                defaultSorting={[{ id: 'value', desc: true }]}
                searchableColumns={['nickname', 'hero']}
              />
            )
          )}
        </>
      )}
    </div>
  )
}
