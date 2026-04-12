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

/* ── Record definitions ────────────────────────────────── */

interface RecordSection {
  key: string
  title: string
  /** If set, this record has a paired per-minute variant shown side-by-side */
  perMinKey?: string
  /** Standalone aggregate-only record (no single-match variant) */
  aggregate?: boolean
}

const RECORD_SECTIONS: RecordSection[] = [
  { key: 'kills', title: 'Kills', perMinKey: 'kills_per_min' },
  { key: 'assists', title: 'Assists', perMinKey: 'assists_per_min' },
  { key: 'deaths', title: 'Deaths', perMinKey: 'deaths_per_min' },
  { key: 'last_hits', title: 'Last Hits', perMinKey: 'last_hits_per_min' },
  { key: 'hero_damage', title: 'Hero Damage', perMinKey: 'hero_damage_per_min' },
  { key: 'tower_damage', title: 'Tower Damage', perMinKey: 'tower_damage_per_min' },
  { key: 'hero_healing', title: 'Hero Healing', perMinKey: 'hero_healing_per_min' },
  { key: 'gpm', title: 'GPM' },
  { key: 'xpm', title: 'XPM' },
  { key: 'denies', title: 'Denies' },
  { key: 'gold', title: 'Gold' },
  { key: 'networth', title: 'Net Worth' },
  { key: 'ka_0_death', title: 'K+A (0 Deaths)' },
  { key: 'kda_1_death', title: 'KDA (1+ Deaths)' },
]

/* ── Row types ──────────────────────────────────────────── */

interface RecordRow {
  steamId: string
  nickname: string
  value: number
  heroKey: string
  heroName: string
  matchId: number
}

interface AggregateRow {
  steamId: string
  nickname: string
  value: number
  gameCount: number
}

/* ── Helpers ────────────────────────────────────────────── */

function resolveHero(heroKey: string) {
  const entry = heroesById[heroKey] ?? Object.values(heroesById).find((h) => h.name === heroKey)
  return { name: entry?.name ?? heroKey, picture: entry?.picture }
}

function patchFromMatchId(matchId: number): string {
  for (const p of patches) {
    const pd = p as unknown as { name: string; lowerBound: number; upperBound: number }
    if (matchId >= pd.lowerBound && matchId <= pd.upperBound) return pd.name
  }
  return '—'
}

/* ── Columns ────────────────────────────────────────────── */

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
    accessorFn: (row) => row.heroName,
    header: 'Hero',
    size: 36,
    enableSorting: false,
    cell: ({ row }) => {
      const { name, picture } = resolveHero(row.original.heroKey)
      const src = picture ? heroImageUrl(picture) : undefined
      return src ? (
        <img src={src} alt={name} title={name} style={{ height: 22, width: 'auto' }} loading="lazy" />
      ) : (
        <span title={name} style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{name}</span>
      )
    },
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
    header: 'Per Min',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average per minute' },
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

/* ── Hash state ─────────────────────────────────────────── */

function getInitialKey(): string {
  const hash = window.location.hash.replace('#', '')
  if (RECORD_SECTIONS.some((s) => s.key === hash)) return hash
  return RECORD_SECTIONS[0].key
}

/* ── Page ───────────────────────────────────────────────── */

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
    filters, setFilters, clearFilters, applyDefaults,
    apiParams, hasFilters, filtersCollapsed, setFiltersCollapsed,
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
      heroName: resolveHero(heroKey).name,
    }))
  }, [records, section])

  const perMinRows: AggregateRow[] = useMemo(() => {
    if (!records || !section.perMinKey) return []
    const tuples = (records[section.perMinKey] ?? []) as PlayerRecordAggregateTuple[]
    return tuples.map(([steamId, nickname, value, gameCount]) => ({
      steamId, nickname, value, gameCount,
    }))
  }, [records, section])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Player Records</h1>
        <p className={styles.subtitle}>
          All-time single-match records and career per-minute averages in tier 1–2 matches
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

          {section.perMinKey ? (
            /* Paired: single-match table + per-minute table side by side */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', alignItems: 'start' }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'var(--font-weight-bold)' as unknown as number,
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--color-primary-dim)',
                  marginBottom: 'var(--space-sm)',
                  paddingBottom: 4,
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  Most in a Match
                </div>
                {recordRows.length > 0 && (
                  <DataTable
                    data={recordRows}
                    columns={recordColumns}
                    defaultSorting={[{ id: 'value', desc: true }]}
                    searchableColumns={['nickname', 'hero']}
                  />
                )}
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 'var(--font-weight-bold)' as unknown as number,
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--color-primary-dim)',
                  marginBottom: 'var(--space-sm)',
                  paddingBottom: 4,
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  Highest Per Minute
                </div>
                {perMinRows.length > 0 && (
                  <DataTable
                    data={perMinRows}
                    columns={aggregateColumns}
                    defaultSorting={[{ id: 'value', desc: true }]}
                    searchableColumns={['nickname']}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Single table only */
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
