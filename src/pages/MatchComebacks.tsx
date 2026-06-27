import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { teamLogoUrl } from '../config'
import DataTable, { TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import TableSkeleton from '../components/TableSkeleton'
import PageMeta from '../components/PageMeta'
import type { NetworthComebackLine } from '../types'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

function GoldCell({ value }: { value: number }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const display = Math.abs(value) >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toFixed(0)
  return (
    <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }} title={value.toLocaleString()}>
      {display}
    </span>
  )
}

const columns: ColumnDef<NetworthComebackLine, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 110,
    enableSorting: false,
    cell: ({ getValue }) => (
      <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {String(getValue())}
      </a>
    ),
  },
  {
    id: 'winner',
    accessorFn: (row) => row.winner.teamName,
    header: 'Winner',
    size: 180,
    enableSorting: false,
    cell: ({ row }) => (
      <TeamCell
        valveId={row.original.winner.valveId}
        name={row.original.winner.teamName}
        logoUrl={teamLogoUrl(row.original.winner.logoId)}
      />
    ),
  },
  {
    id: 'loser',
    accessorFn: (row) => row.loser.teamName,
    header: 'Loser',
    size: 180,
    enableSorting: false,
    cell: ({ row }) => (
      <TeamCell
        valveId={row.original.loser.valveId}
        name={row.original.loser.teamName}
        logoUrl={teamLogoUrl(row.original.loser.logoId)}
      />
    ),
  },
  {
    id: 'comeback',
    accessorKey: 'comeback',
    header: 'Deficit',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Networth deficit overcome' },
    cell: ({ getValue }) => <GoldCell value={getValue() as number} />,
  },
  {
    id: 'winnerNetworth',
    accessorKey: 'winnerNetworth',
    header: 'Winner NW',
    size: 100,
    meta: { numeric: true, tooltip: 'Winner networth at deficit point' },
    cell: ({ getValue }) => <GoldCell value={getValue() as number} />,
  },
  {
    id: 'loserNetworth',
    accessorKey: 'loserNetworth',
    header: 'Loser NW',
    size: 100,
    meta: { numeric: true, tooltip: 'Loser networth at deficit point' },
    cell: ({ getValue }) => <GoldCell value={getValue() as number} />,
  },
  {
    id: 'time',
    accessorKey: 'time',
    header: 'At',
    size: 80,
    meta: { numeric: true, tooltip: 'Game time of peak deficit' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration',
    size: 90,
    meta: { numeric: true, tooltip: 'Total match duration' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'deficitPct',
    accessorFn: (row) => {
      const total = row.winnerNetworth + row.loserNetworth
      return total > 0 ? row.comeback / total : 0
    },
    header: 'Deficit %',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Deficit as % of combined networth at that point' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
          {(v * 100).toFixed(1)}%
        </span>
      )
    },
  },
]

export default function MatchComebacks() {
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

  const { data, isLoading, error } = useApiQuery<{ data: NetworthComebackLine[] }>(
    hasFilters ? '/api/matches/networth-comebacks' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <PageMeta title="Networth Comebacks — Pro Dota 2" description="Biggest networth deficits ever overcome in pro Dota 2 matches." />
      <div className={styles.header}>
        <h1>Networth Comebacks</h1>
        <p className={styles.subtitle}>
          Largest networth deficits ever overcome at any point during a pro match
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <TableSkeleton columns={columns} rows={15} loaderText="Fetching comebacks..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'comeback', desc: true }]}
          searchValue={(r) => [
            String(r.matchId),
            r.winner.teamName,
            String(r.winner.valveId),
            r.loser.teamName,
            String(r.loser.valveId),
          ].join(' ')}
        />
      )}
    </div>
  )
}
