import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import TimeDistributionChart from '../components/TimeDistributionChart'
import { heroesById } from '../data/heroes'
import { heroImageUrl } from '../config'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroesById[String(heroId)]?.picture
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img src={src} alt="" style={{ width: 28, height: 16, objectFit: 'cover', borderRadius: 2 }} loading="lazy" />
  ) : null
}

interface BuildingDeath {
  matchId: number
  hero: number
  killer: { nickname: string; steamId: number }
  denier: { nickname: string; steamId: number } | null
  time: number
  isJungleShrine: boolean
  lane: string
  type: string
  tier: number
  team: { name: string; valveId: number }
  opponent: { name: string; valveId: number }
}

const columns: ColumnDef<BuildingDeath, unknown>[] = [
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
    id: 'time',
    accessorKey: 'time',
    header: 'Time',
    size: 80,
    meta: { numeric: true, tooltip: 'Game Time' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'killerHero',
    accessorKey: 'hero',
    header: 'K Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'killerName',
    accessorFn: (row) => row.killer.nickname,
    header: 'Killer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.killer.steamId} nickname={row.original.killer.nickname} />
    ),
  },
  {
    id: 'teamName',
    accessorFn: (row) => row.team.name,
    header: 'Owner',
    size: 150,
    enableSorting: false,
    cell: ({ row }) => (
      <a href={`/teams/${row.original.team.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {row.original.team.name}
      </a>
    ),
  },
  {
    id: 'opponentName',
    accessorFn: (row) => row.opponent.name,
    header: 'Opponent',
    size: 150,
    enableSorting: false,
    cell: ({ row }) => (
      <a href={`/teams/${row.original.opponent.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {row.original.opponent.name}
      </a>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'Type',
    size: 100,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem' }}>{String(getValue())}</span>
    ),
  },
  {
    id: 'tier',
    accessorKey: 'tier',
    header: 'Tier',
    size: 60,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{String(getValue())}</span>
    ),
  },
  {
    id: 'lane',
    accessorKey: 'lane',
    header: 'Lane',
    size: 80,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem' }}>{String(getValue())}</span>
    ),
  },
  {
    id: 'denied',
    accessorFn: (row) => row.denier != null,
    header: 'Denied',
    size: 70,
    cell: ({ getValue }) => (getValue() as boolean)
      ? <span style={{ color: '#2dd4bf', fontWeight: 600 }}>✓</span>
      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
  },
]

export default function EventBuildings() {
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

  const { data, isLoading, error } = useApiQuery<{ data: BuildingDeath[] }>(
    hasFilters ? '/api/building/deaths' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const times = useMemo(() => rows.map((r) => r.time), [rows])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Building Deaths</h1>
        <p className={styles.subtitle}>
          Building destruction events in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
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

      {isLoading && hasFilters && <EnigmaLoader text="Fetching building deaths..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <TimeDistributionChart times={times} />
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'matchId', desc: true }]}
            searchableColumns={['killerName', 'teamName']}
          />
        </>
      )}
    </div>
  )
}
