import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { TeamTowerLine } from '../types'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

function TimeCell({ value }: { value: number }) {
  if (!value) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return (
    <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
      {fmtTime(value)}
    </span>
  )
}

const columns: ColumnDef<TeamTowerLine, unknown>[] = [
  {
    id: 'team',
    accessorKey: 'name',
    header: 'Team',
    size: 140,
    enableSorting: false,
    cell: ({ row }) => (
      <a href={`/teams/${row.original.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {row.original.name || 'Unknown'}
      </a>
    ),
  },
  {
    id: 'numGames',
    accessorFn: (row) => Math.max(row.takingTowers?.numGames ?? 0, row.losingTowers?.numGames ?? 0),
    header: 'Games',
    size: 65,
    meta: { numeric: true, tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'taking',
    header: 'Taking Towers',
    columns: [
      {
        id: 'takingFirst',
        accessorFn: (row) => row.takingTowers?.avgFirstTower ?? 0,
        header: '1st',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg Time to Take 1st Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'takingSecond',
        accessorFn: (row) => row.takingTowers?.avgSecondTower ?? 0,
        header: '2nd',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg Time to Take 2nd Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'takingThird',
        accessorFn: (row) => row.takingTowers?.avgThirdTower ?? 0,
        header: '3rd',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg Time to Take 3rd Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'takingSafe',
        accessorFn: (row) => row.takingTowers?.avgFirstSafelane ?? 0,
        header: 'Safe',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg 1st Safelane Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'takingMid',
        accessorFn: (row) => row.takingTowers?.avgFirstMidlane ?? 0,
        header: 'Mid',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg 1st Midlane Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'takingOff',
        accessorFn: (row) => row.takingTowers?.avgFirstOfflane ?? 0,
        header: 'Off',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg 1st Offlane Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'losing',
    header: 'Losing Towers',
    columns: [
      {
        id: 'losingFirst',
        accessorFn: (row) => row.losingTowers?.avgFirstTower ?? 0,
        header: '1st',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg Time to Lose 1st Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'losingSecond',
        accessorFn: (row) => row.losingTowers?.avgSecondTower ?? 0,
        header: '2nd',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg Time to Lose 2nd Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'losingThird',
        accessorFn: (row) => row.losingTowers?.avgThirdTower ?? 0,
        header: '3rd',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg Time to Lose 3rd Tower' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'losingSafe',
        accessorFn: (row) => row.losingTowers?.avgFirstSafelane ?? 0,
        header: 'Safe',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg 1st Safelane Tower Lost' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'losingMid',
        accessorFn: (row) => row.losingTowers?.avgFirstMidlane ?? 0,
        header: 'Mid',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg 1st Midlane Tower Lost' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
      {
        id: 'losingOff',
        accessorFn: (row) => row.losingTowers?.avgFirstOfflane ?? 0,
        header: 'Off',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg 1st Offlane Tower Lost' },
        cell: ({ getValue }) => <TimeCell value={getValue() as number} />,
      },
    ],
  },
]

export default function TeamTowers() {
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

  const { data, isLoading, error } = useApiQuery<{ data: { timings: TeamTowerLine[] } }>(
    hasFilters ? '/api/teams/towers' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data?.timings ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team Tower Timings</h1>
        <p className={styles.subtitle}>
          Average tower take and loss timings per team
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

      {isLoading && <EnigmaLoader text="Fetching tower timings..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'numGames', desc: true }]}
          searchableColumns={['team']}
        />
      )}
    </div>
  )
}
