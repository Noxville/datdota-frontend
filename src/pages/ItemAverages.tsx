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

interface ItemAverage {
  valveId: number
  name: string
  localizedName: string
  purchases: number
  fastest: number
  slowest: number
  mean: number
  stdDev: number
  wins: number
  winrate: number
}

const columns: ColumnDef<ItemAverage, unknown>[] = [
  {
    id: 'item',
    accessorFn: (row) => row.localizedName,
    header: 'Item',
    size: 200,
    cell: ({ row }) => {
      const item = itemsData[String(row.original.valveId)]
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
          <span style={{ fontSize: '0.8rem' }}>{row.original.localizedName}</span>
        </span>
      )
    },
  },
  {
    id: 'purchases',
    accessorKey: 'purchases',
    header: 'Purchases',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Purchases' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'fastest',
    accessorKey: 'fastest',
    header: 'Fastest',
    size: 80,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'slowest',
    accessorKey: 'slowest',
    header: 'Slowest',
    size: 80,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'mean',
    accessorKey: 'mean',
    header: 'Mean',
    size: 80,
    meta: { numeric: true, heatmap: 'high-bad' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'stdDev',
    accessorKey: 'stdDev',
    header: 'Std Dev',
    size: 80,
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
    accessorKey: 'winrate',
    header: 'Win %',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

export default function ItemAverages() {
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

  const { data, isLoading, error } = useApiQuery<{ data: ItemAverage[] }>(
    hasFilters ? '/api/items/averages' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Item Averages</h1>
        <p className={styles.subtitle}>
          Average purchase timings and win rates per item
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'threshold', 'result-faction']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching item averages..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'purchases', desc: true }]}
          searchableColumns={['item']}
        />
      )}
    </div>
  )
}
