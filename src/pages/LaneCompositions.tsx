import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

interface LaneCompositionLine {
  key: string
  middle: number
  offlane: number
  roam: number
  safelane: number
  jungle: number
  wins: number
  losses: number
  games: number
}

const columns: ColumnDef<LaneCompositionLine, unknown>[] = [
  {
    id: 'lanes',
    header: 'Lanes',
    columns: [
      {
        id: 'composition',
        accessorKey: 'key',
        header: 'Composition',
        size: 240,
        enableSorting: false,
        meta: { tooltip: 'Lane assignment string (sorted alphabetically)' },
        cell: ({ getValue }) => (
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
            {getValue() as string}
          </span>
        ),
      },
      {
        id: 'safe',
        accessorKey: 'safelane',
        header: 'Safe',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Players in safelane' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'off',
        accessorKey: 'offlane',
        header: 'Off',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Players in offlane' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'mid',
        accessorKey: 'middle',
        header: 'Mid',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Players in midlane' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'roam',
        accessorKey: 'roam',
        header: 'Roam',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Roaming players' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'jungle',
        accessorKey: 'jungle',
        header: 'Jung',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Players in jungle' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'results',
    header: 'Results',
    columns: [
      {
        id: 'games',
        accessorKey: 'games',
        header: 'Games',
        size: 70,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total games with this composition' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'wins',
        accessorKey: 'wins',
        header: 'W',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Wins' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'losses',
        accessorKey: 'losses',
        header: 'L',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad' as const, tooltip: 'Losses' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'winrate',
        accessorFn: (row) => row.games > 0 ? row.wins / row.games : 0,
        header: 'Win%',
        size: 65,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Win rate' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
]

export default function LaneCompositions() {
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

  const { data, isLoading, error } = useApiQuery<{ data: LaneCompositionLine[] }>(
    hasFilters ? '/api/lanes/compositions' : null,
    apiParams,
  )

  const rows = useMemo(() => (data?.data ?? []).filter((r) => r.key.length > 0), [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Lane Compositions</h1>
        <p className={styles.subtitle}>
          Distribution of player lane assignments in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching lane compositions..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'games', desc: true }]}
        />
      )}
    </div>
  )
}
