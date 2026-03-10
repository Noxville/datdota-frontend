import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { PlayerPerformanceLine } from '../types'
import styles from './PlayerPerformances.module.css'

const columns: ColumnDef<PlayerPerformanceLine, unknown>[] = [
  {
    id: 'nickname',
    accessorKey: 'nickname',
    header: 'Player',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />
    ),
  },
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'W',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'losses',
    accessorKey: 'losses',
    header: 'L',
    size: 65,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorKey: 'winrate',
    header: 'Win %',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'kills',
    accessorKey: 'kills',
    header: 'K',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Kills' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'deaths',
    accessorKey: 'deaths',
    header: 'D',
    size: 65,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Deaths' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'assists',
    accessorKey: 'assists',
    header: 'A',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Assists' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'kda',
    accessorKey: 'kda',
    header: 'KDA',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'KDA Ratio' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'gpm',
    accessorKey: 'gpm',
    header: 'GPM',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Gold Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'xpm',
    accessorKey: 'xpm',
    header: 'XPM',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'XP Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'lastHits',
    accessorKey: 'lastHits',
    header: 'LH',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Last Hits' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'denies',
    accessorKey: 'denies',
    header: 'DN',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Denies' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'level',
    accessorKey: 'level',
    header: 'LVL',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average Level' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'heroDamage',
    accessorKey: 'heroDamage',
    header: 'HD',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Hero Damage' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'towerDamage',
    accessorKey: 'towerDamage',
    header: 'TD',
    size: 75,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Tower Damage' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'heroHealing',
    accessorKey: 'heroHealing',
    header: 'HH',
    size: 75,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Hero Healing' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'goldSpent',
    accessorKey: 'goldSpent',
    header: 'GS',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Gold Spent' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function PlayerPerformances() {
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
  const { data, isLoading, error } = useApiQuery<{ data: PlayerPerformanceLine[] }>(
    hasFilters ? '/api/players/performances' : null,
    apiParams,
  )

  const performances = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Player Performances</h1>
        <p className={styles.subtitle}>
          Average statistics per player across filtered matches
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

      {isLoading && <EnigmaLoader text="Fetching player data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {performances.length > 0 && (
        <DataTable
          data={performances}
          columns={columns}
          defaultSorting={[{ id: 'total', desc: true }]}
          searchableColumns={['nickname']}
        />
      )}
    </div>
  )
}
