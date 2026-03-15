import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import TimeDistributionChart from '../components/TimeDistributionChart'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

interface WardEvent {
  placer: { nickname: string; steamId: number; hero: number }
  counterer: { nickname: string; steamId: number; hero: number } | null
  matchId: number
  timePlaced: number
  timeDestroyed: number
  type: string
  x: number
  y: number
  campBlocked: boolean
  faction: string
}

function HeroIconCell({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  const name = hero?.name ?? `Hero ${heroId}`
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img
      src={src}
      alt={name}
      title={name}
      style={{ height: 22, width: 'auto' }}
      loading="lazy"
    />
  ) : (
    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

const columns: ColumnDef<WardEvent, unknown>[] = [
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
    id: 'placerHero',
    accessorFn: (row) => heroesById[String(row.placer.hero)]?.name ?? `Hero ${row.placer.hero}`,
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.placer.hero} />,
  },
  {
    id: 'placer',
    accessorFn: (row) => row.placer.nickname,
    header: 'Placer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.placer.steamId} nickname={row.original.placer.nickname} />
    ),
  },
  {
    id: 'countererHero',
    accessorFn: (row) => row.counterer ? (heroesById[String(row.counterer.hero)]?.name ?? `Hero ${row.counterer.hero}`) : '',
    header: 'C. Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.counterer ? (
        <HeroIconCell heroId={row.original.counterer.hero} />
      ) : (
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      ),
  },
  {
    id: 'counterer',
    accessorFn: (row) => row.counterer?.nickname ?? '',
    header: 'Counterer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.counterer ? (
        <PlayerCell steamId={row.original.counterer.steamId} nickname={row.original.counterer.nickname} />
      ) : (
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      ),
  },
  {
    id: 'timePlaced',
    accessorKey: 'timePlaced',
    header: 'Placed',
    size: 80,
    meta: { numeric: true, tooltip: 'Time Placed' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'timeDestroyed',
    accessorKey: 'timeDestroyed',
    header: 'Destroyed',
    size: 80,
    meta: { numeric: true, tooltip: 'Time Destroyed' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'Type',
    size: 90,
    cell: ({ getValue }) => <span style={{ fontSize: '0.8rem' }}>{getValue() as string}</span>,
  },
  {
    id: 'faction',
    accessorKey: 'faction',
    header: 'Faction',
    size: 80,
    cell: ({ getValue }) => <span style={{ fontSize: '0.8rem' }}>{getValue() as string}</span>,
  },
  {
    id: 'campBlocked',
    accessorKey: 'campBlocked',
    header: 'Camp',
    size: 60,
    meta: { tooltip: 'Camp Blocked' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: (getValue() as boolean) ? 'var(--color-accent-bright)' : 'var(--color-text-muted)' }}>
        {(getValue() as boolean) ? '✓' : '—'}
      </span>
    ),
  },
]

export default function EventWards() {
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

  const { data, isLoading, error } = useApiQuery<{ data: WardEvent[] }>(
    hasFilters ? '/api/events/wards' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const times = useMemo(() => rows.map((r) => r.timePlaced), [rows])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Wards Placed</h1>
        <p className={styles.subtitle}>
          Observer and sentry ward placement events
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching ward data..." />}

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
            searchableColumns={['placer']}
          />
        </>
      )}
    </div>
  )
}
