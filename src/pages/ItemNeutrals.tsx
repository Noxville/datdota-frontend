import { useState, useEffect, useMemo, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { itemImageUrl } from '../config'
import { items as itemsData } from '../data/items'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

interface NeutralItem {
  minTime: number
  avgTime: number
  maxTime: number
  tier: number
  name: string
  itemId: number
  wins: number
  games: number
}

const ALL_TIERS = [1, 2, 3, 4, 5] as const

function parseHash(): { tiers: Set<number>; minGames: number } {
  const hash = window.location.hash.replace('#', '')
  const params = new URLSearchParams(hash)
  const tiersStr = params.get('tiers')
  const tiers = tiersStr
    ? new Set(tiersStr.split(',').map(Number).filter((n) => ALL_TIERS.includes(n as typeof ALL_TIERS[number])))
    : new Set<number>(ALL_TIERS)
  const minGames = Math.max(0, parseInt(params.get('minGames') ?? '0', 10) || 0)
  return { tiers, minGames }
}

function writeHash(tiers: Set<number>, minGames: number) {
  const params = new URLSearchParams()
  // Only write tiers if not all selected
  if (tiers.size !== ALL_TIERS.length || !ALL_TIERS.every((t) => tiers.has(t))) {
    params.set('tiers', [...tiers].sort().join(','))
  }
  if (minGames > 0) params.set('minGames', String(minGames))
  const hash = params.toString()
  const url = window.location.pathname + window.location.search + (hash ? '#' + hash : '')
  window.history.replaceState(null, '', url)
}

const columns: ColumnDef<NeutralItem, unknown>[] = [
  {
    id: 'item',
    accessorFn: (row) => row.name,
    header: 'Item',
    size: 200,
    cell: ({ row }) => {
      const item = itemsData[String(row.original.itemId)]
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {item && (
            <img
              src={itemImageUrl(item.shortName)}
              alt={item.longName}
              title={item.longName}
              style={{ width: 28, height: 20, objectFit: 'contain', borderRadius: 2 }}
              loading="lazy"
            />
          )}
          <span style={{ fontSize: '0.8rem' }}>{row.original.name}</span>
        </span>
      )
    },
  },
  {
    id: 'tier',
    accessorKey: 'tier',
    header: 'Tier',
    size: 60,
    meta: { numeric: true },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'minTime',
    accessorKey: 'minTime',
    header: 'Min Time',
    size: 85,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'avgTime',
    accessorKey: 'avgTime',
    header: 'Avg Time',
    size: 85,
    meta: { numeric: true, heatmap: 'high-bad' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'maxTime',
    accessorKey: 'maxTime',
    header: 'Max Time',
    size: 85,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'Wins',
    size: 70,
    meta: { numeric: true },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorFn: (row) => (row.games > 0 ? row.wins / row.games : 0),
    header: 'Win %',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

const tierBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: '0.78rem',
  fontFamily: 'var(--font-mono)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  background: 'transparent',
  color: 'var(--color-text-muted)',
}

const tierBtnActiveStyle: React.CSSProperties = {
  ...tierBtnStyle,
  background: 'var(--color-primary-dim)',
  borderColor: 'var(--color-primary)',
  color: 'var(--color-text)',
}

export default function ItemNeutrals() {
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

  const [activeTiers, setActiveTiers] = useState<Set<number>>(() => parseHash().tiers)
  const [minGames, setMinGames] = useState<number>(() => parseHash().minGames)

  // Sync to hash fragment
  useEffect(() => {
    writeHash(activeTiers, minGames)
  }, [activeTiers, minGames])

  const toggleTier = useCallback((tier: number) => {
    setActiveTiers((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }, [])

  const { data, isLoading, error } = useApiQuery<{ data: NeutralItem[] }>(
    hasFilters ? '/api/items/neutrals' : null,
    apiParams,
  )

  const maxGamesInData = useMemo(() => {
    const all = data?.data ?? []
    if (all.length === 0) return 100
    return Math.max(...all.map((r) => r.games))
  }, [data])

  const rows = useMemo(() => {
    const all = data?.data ?? []
    return all.filter((r) => {
      if (!activeTiers.has(r.tier)) return false
      if (minGames > 0 && r.games < minGames) return false
      return true
    })
  }, [data, activeTiers, minGames])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Neutral Items</h1>
        <p className={styles.subtitle}>
          Neutral item drop statistics
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching neutral item data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {(data?.data ?? []).length > 0 && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
                marginRight: 4,
              }}>
                Tiers
              </span>
              {ALL_TIERS.map((t) => (
                <button
                  key={t}
                  style={activeTiers.has(t) ? tierBtnActiveStyle : tierBtnStyle}
                  onClick={() => toggleTier(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
              }}>
                Min Games
              </label>
              <input
                type="range"
                min={0}
                max={maxGamesInData}
                value={Math.min(minGames, maxGamesInData)}
                onChange={(e) => setMinGames(parseInt(e.target.value, 10))}
                style={{ width: 120, accentColor: 'var(--color-primary)' }}
              />
              <input
                type="number"
                min={0}
                value={minGames}
                onChange={(e) => setMinGames(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{
                  width: 65,
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-bg-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'games', desc: true }]}
            searchableColumns={['item']}
          />
        </>
      )}
    </div>
  )
}
