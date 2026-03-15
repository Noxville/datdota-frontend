import { useState, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { TeamMapControlTeam, TeamMapControlMatch, TeamMapControlResponse } from '../types'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

const TABS = ['teams', 'highest', 'lowest'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  teams: 'Team Averages',
  highest: 'Highest Control',
  lowest: 'Lowest Control',
}

const teamColumns: ColumnDef<TeamMapControlTeam, unknown>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Team',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <a href={`/teams/${row.original.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {row.original.name || 'Unknown'}
      </a>
    ),
  },
  {
    id: 'numGames',
    accessorKey: 'numGames',
    header: 'Games',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'W',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorFn: (row) => (row.numGames > 0 ? row.wins / row.numGames : 0),
    header: 'Win %',
    size: 71,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'avgNormControl',
    accessorKey: 'avgNormControl',
    header: 'Control',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg Normalized Map Control' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgOneSidedness',
    accessorKey: 'avgOneSidedness',
    header: 'One-Sided',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg One-Sidedness' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgOneSidednessWins',
    accessorKey: 'avgOneSidednessWins',
    header: 'OS Wins',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg One-Sidedness in Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgOneSidednessLosses',
    accessorKey: 'avgOneSidednessLosses',
    header: 'OS Losses',
    size: 80,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Avg One-Sidedness in Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgNormNeutral',
    accessorKey: 'avgNormNeutral',
    header: 'Neutral',
    size: 80,
    meta: { numeric: true, tooltip: 'Avg Normalized Neutral Control' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
]

const matchColumns: ColumnDef<TeamMapControlMatch, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {String(getValue())}
      </a>
    ),
  },
  {
    id: 'teamName',
    accessorKey: 'teamName',
    header: 'Team',
    size: 150,
    enableSorting: false,
    cell: ({ getValue }) => <span style={{ fontSize: '0.8rem' }}>{getValue() as string}</span>,
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration',
    size: 80,
    meta: { numeric: true, tooltip: 'Match Duration' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'normControl',
    accessorKey: 'normControl',
    header: 'Control',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Normalized Map Control' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'oneSidedness',
    accessorKey: 'oneSidedness',
    header: 'One-Sided',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'One-Sidedness' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'normNeutral',
    accessorKey: 'normNeutral',
    header: 'Neutral',
    size: 80,
    meta: { numeric: true, tooltip: 'Normalized Neutral Control' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
]

export default function TeamMapControl() {
  const [tab, setTab] = useState<Tab>('teams')

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

  const { data, isLoading, error } = useApiQuery<{ data: TeamMapControlResponse }>(
    hasFilters ? '/api/teams/map-control' : null,
    apiParams,
  )

  const teamRows = useMemo(() => data?.data?.teams ?? [], [data])
  const highestRows = useMemo(() => data?.data?.highest ?? [], [data])
  const lowestRows = useMemo(() => data?.data?.lowest ?? [], [data])

  const hasData = teamRows.length > 0 || highestRows.length > 0 || lowestRows.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Map Control</h1>
        <p className={styles.subtitle}>
          Team map control averages and extreme matches
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

      {isLoading && <EnigmaLoader text="Fetching map control data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {hasData && (
        <>
          <div className={toggleStyles.toggleRow}>
            {TABS.map((t) => (
              <button
                key={t}
                className={`${toggleStyles.toggleBtn} ${tab === t ? toggleStyles.toggleActive : ''}`}
                onClick={() => setTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === 'teams' && teamRows.length > 0 && (
            <DataTable
              data={teamRows}
              columns={teamColumns}
              defaultSorting={[{ id: 'avgNormControl', desc: true }]}
              searchableColumns={['name']}
            />
          )}
          {tab === 'highest' && highestRows.length > 0 && (
            <DataTable
              data={highestRows}
              columns={matchColumns}
              defaultSorting={[{ id: 'normControl', desc: true }]}
              searchableColumns={['teamName']}
            />
          )}
          {tab === 'lowest' && lowestRows.length > 0 && (
            <DataTable
              data={lowestRows}
              columns={matchColumns}
              defaultSorting={[{ id: 'normControl', desc: false }]}
              searchableColumns={['teamName']}
            />
          )}
        </>
      )}
    </div>
  )
}
