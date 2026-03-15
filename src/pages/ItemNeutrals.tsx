import { useMemo } from 'react'
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

  const { data, isLoading, error } = useApiQuery<{ data: NeutralItem[] }>(
    hasFilters ? '/api/items/neutrals' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

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
        showFilters={['teams', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
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

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'games', desc: true }]}
          searchableColumns={['item']}
        />
      )}
    </div>
  )
}
