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

interface TormentorKill {
  matchId: number
  time: number
  player: { hero: number; steamId: number; nickname: string }
  xPosition: number
  yPosition: number
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

const columns: ColumnDef<TormentorKill, unknown>[] = [
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
    meta: { numeric: true, tooltip: 'Kill Time' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'hero',
    accessorFn: (row) => heroesById[String(row.player.hero)]?.name ?? `Hero ${row.player.hero}`,
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.player.hero} />,
  },
  {
    id: 'player',
    accessorFn: (row) => row.player.nickname,
    header: 'Player',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.player.steamId} nickname={row.original.player.nickname} />
    ),
  },
]

export default function EventTormentor() {
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

  const { data, isLoading, error } = useApiQuery<{ data: { kills: TormentorKill[] } }>(
    hasFilters ? '/api/events/tormentor-kills' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data?.kills ?? [], [data])
  const times = useMemo(() => rows.map((r) => r.time), [rows])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Tormentor Kills</h1>
        <p className={styles.subtitle}>
          Tormentor kill events in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching Tormentor data..." />}

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
            defaultSorting={[{ id: 'time', desc: false }]}
            searchableColumns={['player']}
          />
        </>
      )}
    </div>
  )
}
