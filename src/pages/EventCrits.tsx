import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
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

interface CritEvent {
  matchId: number
  critter: { steamId: number; nickname: string; hero: number }
  target: { steamId: number; nickname: string; hero: number } | null
  nonHeroTarget: string | null
  time: number
  amount: number
  rank: number
}

const columns: ColumnDef<CritEvent, unknown>[] = [
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
    id: 'critterHero',
    accessorFn: (row) => heroesById[String(row.critter.hero)]?.name ?? '',
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.critter.hero} />,
  },
  {
    id: 'critter',
    accessorFn: (row) => row.critter.nickname,
    header: 'Player',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.critter.steamId} nickname={row.original.critter.nickname} />
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
    id: 'target',
    accessorFn: (row) => {
      if (row.target) return row.target.nickname
      return row.nonHeroTarget ?? ''
    },
    header: 'Target',
    size: 200,
    enableSorting: false,
    cell: ({ row }) => {
      const t = row.original.target
      if (t) {
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HeroIconCell heroId={t.hero} />
            <PlayerCell steamId={t.steamId} nickname={t.nickname} />
          </span>
        )
      }
      const unit = row.original.nonHeroTarget
      return (
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
          {unit || '—'}
        </span>
      )
    },
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Damage',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Critical hit damage' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    id: 'rank',
    accessorKey: 'rank',
    header: 'Rank',
    size: 60,
    meta: { numeric: true, tooltip: 'Rank within game' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
        {String(getValue())}
      </span>
    ),
  },
]

export default function EventCrits() {
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

  const { data, isLoading, error } = useApiQuery<{ data: CritEvent[] }>(
    hasFilters ? '/api/crits' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Big Crits</h1>
        <p className={styles.subtitle}>
          Largest critical hits in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'roles', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching big crits..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'amount', desc: true }]}
          searchableColumns={['critter', 'target']}
        />
      )}
    </div>
  )
}
