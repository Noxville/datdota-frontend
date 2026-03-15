import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { TeamThrowLine } from '../types'
import styles from './PlayerPerformances.module.css'

function GoldCell({ value }: { value: number }) {
  if (!value) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const display = Math.abs(value) >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toFixed(0)
  return (
    <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }} title={value.toLocaleString()}>
      {display}
    </span>
  )
}

const columns: ColumnDef<TeamThrowLine, unknown>[] = [
  {
    id: 'team',
    accessorFn: (row) => row.team.name,
    header: 'Team',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <a href={`/teams/${row.original.team.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {row.original.team.name || 'Unknown'}
      </a>
    ),
  },
  {
    id: 'numLosses',
    accessorKey: 'numLosses',
    header: 'Losses',
    size: 80,
    meta: { numeric: true, tooltip: 'Total Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'avgThrow',
    accessorKey: 'avgThrow',
    header: 'Avg Throw',
    size: 100,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Average Gold Thrown' },
    cell: ({ getValue }) => <GoldCell value={getValue() as number} />,
  },
  {
    id: 'throws5k',
    accessorKey: 'throws5k',
    header: '>5k',
    size: 70,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Throws > 5,000 gold' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'throws10k',
    accessorKey: 'throws10k',
    header: '>10k',
    size: 70,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Throws > 10,000 gold' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'throws15k',
    accessorKey: 'throws15k',
    header: '>15k',
    size: 70,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Throws > 15,000 gold' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function TeamThrows() {
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

  const { data, isLoading, error } = useApiQuery<{ data: TeamThrowLine[] }>(
    hasFilters ? '/api/teams/average-throws' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team Throws</h1>
        <p className={styles.subtitle}>
          Average networth leads squandered in losses
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

      {isLoading && <EnigmaLoader text="Fetching throw data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'avgThrow', desc: true }]}
          searchableColumns={['team']}
        />
      )}
    </div>
  )
}
