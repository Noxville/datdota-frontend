import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PlayerCell } from '../components/DataTable'
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

function BoolCell({ value }: { value: boolean }) {
  return value
    ? <span style={{ color: '#2dd4bf', fontWeight: 600 }}>✓</span>
    : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
}

interface KillEvent {
  killer: { nickname: string; steamId: number; hero: number }
  dyer: { nickname: string; steamId: number; hero: number }
  matchId: number
  time: number
  killerStreak: number
  diedToTower: boolean
  diedToNeutrals: boolean
  diedToLaneCreep: boolean
}

const columns: ColumnDef<KillEvent, unknown>[] = [
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
    id: 'killerHero',
    accessorFn: (row) => row.killer.hero,
    header: 'K Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.killer.hero} />,
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
    id: 'victimHero',
    accessorFn: (row) => row.dyer.hero,
    header: 'V Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.dyer.hero} />,
  },
  {
    id: 'victimName',
    accessorFn: (row) => row.dyer.nickname,
    header: 'Victim',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.dyer.steamId} nickname={row.original.dyer.nickname} />
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
    id: 'killerStreak',
    accessorKey: 'killerStreak',
    header: 'Streak',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Killer Streak' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'diedToTower',
    accessorKey: 'diedToTower',
    header: 'Tower',
    size: 65,
    cell: ({ getValue }) => <BoolCell value={getValue() as boolean} />,
  },
  {
    id: 'diedToNeutrals',
    accessorKey: 'diedToNeutrals',
    header: 'Neutral',
    size: 70,
    cell: ({ getValue }) => <BoolCell value={getValue() as boolean} />,
  },
  {
    id: 'diedToLaneCreep',
    accessorKey: 'diedToLaneCreep',
    header: 'Creep',
    size: 65,
    cell: ({ getValue }) => <BoolCell value={getValue() as boolean} />,
  },
]

export default function EventDeaths() {
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

  const { data, isLoading, error } = useApiQuery<{ data: KillEvent[] }>(
    hasFilters ? '/api/events/hero-deaths' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const times = useMemo(() => rows.map((r) => r.time), [rows])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Hero Deaths</h1>
        <p className={styles.subtitle}>
          Individual hero death events in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
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

      {isLoading && hasFilters && <EnigmaLoader text="Fetching death events..." />}

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
            searchableColumns={['killerName', 'victimName']}
          />
        </>
      )}
    </div>
  )
}
