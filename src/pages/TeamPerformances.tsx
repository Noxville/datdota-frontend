import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell, TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { teamLogoUrl } from '../config'
import type { TeamPerformanceLine } from '../types'
import styles from './PlayerPerformances.module.css'

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const columns: ColumnDef<TeamPerformanceLine, unknown>[] = [
  {
    id: 'team',
    accessorFn: (row) => row.team.name,
    header: 'Team',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => {
      const t = row.original.team
      return <TeamCell valveId={t.valveId} name={t.name} logoUrl={t.logoId ? teamLogoUrl(String(t.logoId)) : undefined} />
    },
  },
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Games',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'W',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'losses',
    accessorKey: 'losses',
    header: 'L',
    size: 55,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorKey: 'winrate',
    header: 'Win %',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'kills',
    accessorKey: 'kills',
    header: 'K',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg Kills' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'deaths',
    accessorKey: 'deaths',
    header: 'D',
    size: 55,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg Deaths' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'assists',
    accessorKey: 'assists',
    header: 'A',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg Assists' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'gpm',
    accessorKey: 'gpm',
    header: 'GPM',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Gold Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'xpm',
    accessorKey: 'xpm',
    header: 'XPM',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'XP Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'lastHits',
    accessorKey: 'lastHits',
    header: 'LH',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Last Hits' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'denies',
    accessorKey: 'denies',
    header: 'DN',
    size: 50,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Denies' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Dur',
    size: 60,
    meta: { numeric: true, tooltip: 'Average Duration' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
        {fmtDuration(getValue() as number)}
      </span>
    ),
  },
  {
    id: 'durationWins',
    accessorKey: 'durationWins',
    header: 'Dur W',
    size: 60,
    meta: { numeric: true, tooltip: 'Average Duration (Wins)' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
        {fmtDuration(getValue() as number)}
      </span>
    ),
  },
  {
    id: 'durationLosses',
    accessorKey: 'durationLosses',
    header: 'Dur L',
    size: 60,
    meta: { numeric: true, tooltip: 'Average Duration (Losses)' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
        {fmtDuration(getValue() as number)}
      </span>
    ),
  },
]

export default function TeamPerformances() {
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

  const { data, isLoading, error } = useApiQuery<{ data: TeamPerformanceLine[] }>(
    hasFilters ? '/api/teams/performances' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team Performances</h1>
        <p className={styles.subtitle}>
          Average statistics per team across filtered matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching team data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'total', desc: true }]}
          searchableColumns={['team']}
        />
      )}
    </div>
  )
}
