import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import LeagueLogo from '../components/LeagueLogo'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

interface MegacreepComeback {
  matchId: number
  radiantVictory: boolean
  duration: number
  radiant: { name: string; valveId: number; megacreepTime: number | null }
  dire: { name: string; valveId: number; megacreepTime: number | null }
  league: { name: string; leagueId: number }
}

function teamLink(name: string, valveId: number) {
  return (
    <a href={`/teams/${valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
      {name}
    </a>
  )
}

const columns: ColumnDef<MegacreepComeback, unknown>[] = [
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
    id: 'league',
    accessorFn: (row) => row.league.name,
    header: 'League',
    size: 200,
    enableSorting: false,
    cell: ({ row }) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
        <LeagueLogo leagueId={row.original.league.leagueId} size={28} />
        {row.original.league.name}
      </span>
    ),
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Match Duration' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'winnerName',
    accessorFn: (row) => (row.radiantVictory ? row.radiant.name : row.dire.name),
    header: 'Winner',
    size: 140,
    enableSorting: false,
    cell: ({ row }) => {
      const w = row.original.radiantVictory ? row.original.radiant : row.original.dire
      return teamLink(w.name, w.valveId)
    },
  },
  {
    id: 'winnerMegaTime',
    accessorFn: (row) => {
      const w = row.radiantVictory ? row.radiant : row.dire
      return w.megacreepTime
    },
    header: "Winner Got Mega'd",
    size: 110,
    meta: { numeric: true, tooltip: 'Time when the winner got megacreeped' },
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
          {val != null ? fmtTime(val) : '—'}
        </span>
      )
    },
  },
  {
    id: 'loserName',
    accessorFn: (row) => (row.radiantVictory ? row.dire.name : row.radiant.name),
    header: 'Loser',
    size: 140,
    enableSorting: false,
    cell: ({ row }) => {
      const l = row.original.radiantVictory ? row.original.dire : row.original.radiant
      return teamLink(l.name, l.valveId)
    },
  },
  {
    id: 'loserMegaTime',
    accessorFn: (row) => {
      const l = row.radiantVictory ? row.dire : row.radiant
      return l.megacreepTime
    },
    header: "Loser Got Mega'd?",
    size: 110,
    meta: { numeric: true, tooltip: 'Time when the loser got megacreeped (if at all)' },
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
          {val != null ? fmtTime(val) : '—'}
        </span>
      )
    },
  },
  {
    id: 'tookBackMegas',
    accessorFn: (row) => {
      const l = row.radiantVictory ? row.dire : row.radiant
      return l.megacreepTime != null
    },
    header: 'Took Back Megas?',
    size: 100,
    cell: ({ getValue }) => (
      (getValue() as boolean)
        ? <span style={{ color: '#2dd4bf', fontWeight: 600, fontSize: '0.8rem' }}>Yes</span>
        : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>No</span>
    ),
  },
  {
    id: 'heldOutFor',
    accessorFn: (row) => {
      const w = row.radiantVictory ? row.radiant : row.dire
      if (w.megacreepTime == null) return null
      return row.duration - w.megacreepTime
    },
    header: 'Held Out For',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'How long the winner survived after being megacreeped' },
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
          {val != null ? fmtTime(val) : '—'}
        </span>
      )
    },
  },
]

export default function ScenarioMegacreepComebacks() {
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

  const { data, isLoading, error } = useApiQuery<{ data: MegacreepComeback[] }>(
    hasFilters ? '/api/scenarios/megacreep-comebacks' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Megacreep Comebacks</h1>
        <p className={styles.subtitle}>
          Matches won after the opponent achieved megacreeps
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={['patch', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
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

      {isLoading && hasFilters && <EnigmaLoader text="Fetching megacreep comebacks..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'matchId', desc: true }]}
          searchableColumns={['winnerName', 'loserName', 'league']}
        />
      )}
    </div>
  )
}
