import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { heroesById } from '../data/heroes'
import { heroImageUrl } from '../config'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroesById[String(heroId)]?.picture
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img src={src} alt="" style={{ width: 28, height: 16, objectFit: 'cover', borderRadius: 2 }} loading="lazy" />
  ) : null
}

interface ItemTiming {
  time: number
  matchId: number
  player: { hero: number; steamId: number; nickname: string }
  matchVictory: boolean
}

interface ItemDistributionResponse {
  fastest: ItemTiming[]
  slowest: ItemTiming[]
  mean: number
  stdDev: number
  count: number
  distribution: Record<string, { minute: number; count: number; wins: number }>
}

const TABS = ['fastest', 'slowest'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  fastest: 'Fastest',
  slowest: 'Slowest',
}

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '') as Tab
  if (TABS.includes(hash)) return hash
  return 'fastest'
}

const fastestColumns: ColumnDef<ItemTiming, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {String(getValue())}
      </a>
    ),
  },
  {
    id: 'hero',
    accessorFn: (row) => row.player.hero,
    header: 'Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.player.hero} />,
  },
  {
    id: 'player',
    accessorFn: (row) => row.player.nickname,
    header: 'Player',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.player.steamId} nickname={row.original.player.nickname} />
    ),
  },
  {
    id: 'time',
    accessorKey: 'time',
    header: 'Time',
    size: 90,
    meta: { numeric: true, heatmap: 'high-bad' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'result',
    accessorFn: (row) => (row.matchVictory ? 'Win' : 'Loss'),
    header: 'Result',
    size: 70,
    cell: ({ row }) => (
      <span style={{ color: row.original.matchVictory ? '#2dd4bf' : '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>
        {row.original.matchVictory ? 'Win' : 'Loss'}
      </span>
    ),
  },
]

const slowestColumns: ColumnDef<ItemTiming, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {String(getValue())}
      </a>
    ),
  },
  {
    id: 'hero',
    accessorFn: (row) => row.player.hero,
    header: 'Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.player.hero} />,
  },
  {
    id: 'player',
    accessorFn: (row) => row.player.nickname,
    header: 'Player',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.player.steamId} nickname={row.original.player.nickname} />
    ),
  },
  {
    id: 'time',
    accessorKey: 'time',
    header: 'Time',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'result',
    accessorFn: (row) => (row.matchVictory ? 'Win' : 'Loss'),
    header: 'Result',
    size: 70,
    cell: ({ row }) => (
      <span style={{ color: row.original.matchVictory ? '#2dd4bf' : '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>
        {row.original.matchVictory ? 'Win' : 'Loss'}
      </span>
    ),
  },
]

export default function ItemDistribution() {
  const [tab, setTab] = useState<Tab>(getInitialTab)

  const selectTab = useCallback((t: Tab) => {
    setTab(t)
    window.location.hash = `#${t}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '') as Tab
      if (TABS.includes(hash)) setTab(hash)
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

  const { data, isLoading, error } = useApiQuery<{ data: ItemDistributionResponse }>(
    hasFilters ? '/api/items/distribution' : null,
    apiParams,
  )

  const fastestRows = useMemo(() => data?.data?.fastest ?? [], [data])
  const slowestRows = useMemo(() => data?.data?.slowest ?? [], [data])
  const mean = data?.data?.mean ?? 0
  const stdDev = data?.data?.stdDev ?? 0
  const count = data?.data?.count ?? 0

  const hasData = fastestRows.length > 0 || slowestRows.length > 0

  useEffect(() => {
    if (hasData && !window.location.hash) {
      window.location.hash = `#${tab}`
    }
  }, [hasData, tab])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Item Timings</h1>
        <p className={styles.subtitle}>
          Fastest and slowest item purchase timings
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching item timing data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {hasData && (
        <>
          <div style={{
            display: 'flex',
            gap: 32,
            justifyContent: 'center',
            padding: '10px 0 14px',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Purchases:</span>{' '}
              {count.toLocaleString()}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Average:</span>{' '}
              {fmtTime(mean)}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Std Dev:</span>{' '}
              {fmtTime(stdDev)}
            </span>
          </div>

          <div className={toggleStyles.toggleRow}>
            {TABS.map((t) => (
              <button
                key={t}
                className={`${toggleStyles.toggleBtn} ${tab === t ? toggleStyles.toggleActive : ''}`}
                onClick={() => selectTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === 'fastest' && fastestRows.length > 0 && (
            <DataTable
              data={fastestRows}
              columns={fastestColumns}
              defaultSorting={[{ id: 'time', desc: false }]}
              searchableColumns={['player']}
            />
          )}
          {tab === 'slowest' && slowestRows.length > 0 && (
            <DataTable
              data={slowestRows}
              columns={slowestColumns}
              defaultSorting={[{ id: 'time', desc: true }]}
              searchableColumns={['player']}
            />
          )}
        </>
      )}
    </div>
  )
}
