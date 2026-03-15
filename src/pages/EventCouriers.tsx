import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import TimeDistributionChart from '../components/TimeDistributionChart'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import { heroImageUrl, itemImageUrl } from '../config'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroesById[String(heroId)]?.picture
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img src={src} alt="" style={{ width: 28, height: 16, objectFit: 'cover', borderRadius: 2 }} loading="lazy" />
  ) : null
}

function ItemIcon({ itemId }: { itemId: number }) {
  const item = itemsData[String(itemId)]
  const name = item?.longName ?? `Item ${itemId}`
  const [failed, setFailed] = useState(false)

  if (!item || failed) {
    return (
      <span
        title={name}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 18, borderRadius: 2,
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
          fontSize: '0.5rem', color: 'var(--color-text-muted)', overflow: 'hidden',
        }}
      >
        ?
      </span>
    )
  }

  return (
    <img
      src={itemImageUrl(item.shortName)}
      alt={name}
      title={name}
      style={{ width: 24, height: 18, objectFit: 'contain', borderRadius: 2 }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function ItemIcons({ itemIds }: { itemIds: number[] }) {
  if (!itemIds || itemIds.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return (
    <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {itemIds.map((id, i) => <ItemIcon key={i} itemId={id} />)}
    </span>
  )
}

function itemNames(itemIds: number[]): string {
  if (!itemIds) return ''
  return itemIds.map((id) => itemsData[String(id)]?.longName ?? '').filter(Boolean).join(', ')
}

interface CourierDeath {
  killer: { nickname: string | null; steamId: number | null; hero: number | null }
  matchId: number
  time: number
  x: number
  y: number
  items: number[]
  faction: string
}

const columns: ColumnDef<CourierDeath, unknown>[] = [
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
    accessorFn: (row) => row.killer?.hero ?? 0,
    header: 'K Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => {
      const hero = row.original.killer?.hero
      return hero ? <HeroIconCell heroId={hero} /> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    },
  },
  {
    id: 'killerName',
    accessorFn: (row) => row.killer?.nickname ?? '',
    header: 'Killer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => {
      const k = row.original.killer
      if (!k?.steamId || !k?.nickname) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <PlayerCell steamId={k.steamId} nickname={k.nickname} />
    },
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
    id: 'faction',
    accessorKey: 'faction',
    header: 'Faction',
    size: 90,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem' }}>{String(getValue())}</span>
    ),
  },
  {
    id: 'items',
    accessorFn: (row) => itemNames(row.items),
    header: 'Items',
    size: 200,
    enableSorting: false,
    cell: ({ row }) => <ItemIcons itemIds={row.original.items} />,
  },
]

export default function EventCouriers() {
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

  const { data, isLoading, error } = useApiQuery<{ data: CourierDeath[] }>(
    hasFilters ? '/api/events/courier-deaths' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const times = useMemo(() => rows.map((r) => r.time), [rows])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Courier Kills</h1>
        <p className={styles.subtitle}>
          Courier death events in professional matches
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

      {isLoading && hasFilters && <EnigmaLoader text="Fetching courier deaths..." />}

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
            searchableColumns={['killerName', 'items']}
          />
        </>
      )}
    </div>
  )
}
