import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

interface DraftPositionLine {
  steamId: number
  nickname: string
  firstPick: number
  secondPick: number
  thirdPick: number
  fourthPick: number
  fifthPick: number
  totalPicks: number
  firstPickPercent: number
  secondPickPercent: number
  thirdPickPercent: number
  fourthPickPercent: number
  fifthPickPercent: number
  avgDraftPosition: number
}

const columns: ColumnDef<DraftPositionLine, unknown>[] = [
  {
    id: 'player',
    accessorKey: 'nickname',
    header: 'Player',
    size: 160,
    cell: ({ row }) => <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />,
  },
  {
    id: 'pos1',
    header: '1st Pick',
    columns: [
      {
        id: 'pos1Count',
        accessorKey: 'firstPick',
        header: '#',
        size: 55,
        meta: { numeric: true, tooltip: 'Times picked 1st' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'pos1Pct',
        accessorKey: 'firstPickPercent',
        header: '%',
        size: 55,
        meta: { numeric: true, tooltip: '% picked 1st' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'pos2',
    header: '2nd Pick',
    columns: [
      {
        id: 'pos2Count',
        accessorKey: 'secondPick',
        header: '#',
        size: 55,
        meta: { numeric: true, tooltip: 'Times picked 2nd' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'pos2Pct',
        accessorKey: 'secondPickPercent',
        header: '%',
        size: 55,
        meta: { numeric: true, tooltip: '% picked 2nd' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'pos3',
    header: '3rd Pick',
    columns: [
      {
        id: 'pos3Count',
        accessorKey: 'thirdPick',
        header: '#',
        size: 55,
        meta: { numeric: true, tooltip: 'Times picked 3rd' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'pos3Pct',
        accessorKey: 'thirdPickPercent',
        header: '%',
        size: 55,
        meta: { numeric: true, tooltip: '% picked 3rd' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'pos4',
    header: '4th Pick',
    columns: [
      {
        id: 'pos4Count',
        accessorKey: 'fourthPick',
        header: '#',
        size: 55,
        meta: { numeric: true, tooltip: 'Times picked 4th' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'pos4Pct',
        accessorKey: 'fourthPickPercent',
        header: '%',
        size: 55,
        meta: { numeric: true, tooltip: '% picked 4th' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'pos5',
    header: '5th Pick',
    columns: [
      {
        id: 'pos5Count',
        accessorKey: 'fifthPick',
        header: '#',
        size: 55,
        meta: { numeric: true, tooltip: 'Times picked 5th' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'pos5Pct',
        accessorKey: 'fifthPickPercent',
        header: '%',
        size: 55,
        meta: { numeric: true, tooltip: '% picked 5th' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'avgPos',
    accessorKey: 'avgDraftPosition',
    header: 'Avg Pos',
    size: 70,
    meta: { numeric: true, tooltip: 'Weighted average draft position' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {(getValue() as number).toFixed(2)}
      </span>
    ),
  },
  {
    id: 'totalGames',
    accessorKey: 'totalPicks',
    header: 'Games',
    size: 65,
    meta: { numeric: true, tooltip: 'Total games played' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function DraftPositions() {
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

  const { data, isLoading, error } = useApiQuery<{ data: DraftPositionLine[] }>(
    hasFilters ? '/api/drafts/positions' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Draft Positions</h1>
        <p className={styles.subtitle}>
          Player draft order distribution in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching draft positions..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'totalGames', desc: true }]}
          searchableColumns={['player']}
        />
      )}
    </div>
  )
}
