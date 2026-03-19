import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

interface CasterLine {
  nickname: string
  steam32: number
  steam64: number
  matchId: number
  date: string
  count: number
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const columns: ColumnDef<CasterLine, unknown>[] = [
  {
    id: 'caster',
    accessorKey: 'nickname',
    header: 'Caster',
    size: 200,
    cell: ({ row }) => (
      <a
        href={`/casters/${row.original.steam32}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 500 }}
      >
        {row.original.nickname}
      </a>
    ),
  },
  {
    id: 'recentMatch',
    accessorKey: 'matchId',
    header: 'Most Recent Match',
    size: 120,
    cell: ({ getValue }) => (
      <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {String(getValue())}
      </a>
    ),
  },
  {
    id: 'date',
    accessorKey: 'date',
    header: 'Date',
    size: 120,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
        {fmtDate(getValue() as string)}
      </span>
    ),
  },
  {
    id: 'count',
    accessorKey: 'count',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total games casted' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function Casters() {
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

  const { data, isLoading, error } = useApiQuery<{ data: CasterLine[] }>(
    hasFilters ? '/api/casters' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Caster Aggregates</h1>
        <p className={styles.subtitle}>
          Caster statistics across professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'leagues', 'patch', 'after', 'before', 'splits', 'split-type', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching caster data..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'count', desc: true }]}
          searchableColumns={['caster']}
        />
      )}
    </div>
  )
}
