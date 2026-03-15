import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { teamLogoUrl } from '../config'
import DataTable, { NumericCell, PercentCell, PlayerCell, TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { PlayerTeamComboLine } from '../types'
import styles from './PlayerPerformances.module.css'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const columns: ColumnDef<PlayerTeamComboLine, unknown>[] = [
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
    id: 'team',
    accessorKey: 'team',
    header: 'Team',
    size: 200,
    enableSorting: false,
    cell: ({ row }) => {
      const t = row.original.team
      return (
        <TeamCell
          valveId={t.valveId}
          name={t.name}
          logoUrl={t.logoId ? teamLogoUrl(t.logoId) : undefined}
        />
      )
    },
  },
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Games',
    size: 75,
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
    id: 'losses',
    accessorKey: 'losses',
    header: 'L',
    size: 60,
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
    id: 'firstGame',
    accessorKey: 'firstGame',
    header: 'First Game',
    size: 130,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        {formatDate(getValue() as string)}
      </span>
    ),
  },
  {
    id: 'lastGame',
    accessorKey: 'lastGame',
    header: 'Last Game',
    size: 130,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        {formatDate(getValue() as string)}
      </span>
    ),
  },
  {
    id: 'teamCareer',
    accessorKey: 'teamCareer',
    header: 'Stretch',
    size: 85,
    meta: { numeric: true, tooltip: 'Days between first and last game' },
    cell: ({ getValue }) => {
      const days = getValue() as number
      return (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}>
          {days}d
        </span>
      )
    },
  },
]

export default function PlayerTeamCombos() {
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

  const { data, isLoading, error } = useApiQuery<{ data: PlayerTeamComboLine[] }>(
    hasFilters ? '/api/players/teams' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Player Team Combos</h1>
        <p className={styles.subtitle}>
          Player career stints with each team across filtered matches
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

      {isLoading && <EnigmaLoader text="Fetching team combo data..." />}

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
          searchableColumns={['nickname']}
        />
      )}
    </div>
  )
}
