import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { heroesById } from '../data/heroes'
import { heroImageUrl, itemImageUrl } from '../config'
import { items as itemsData } from '../data/items'
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
  if (!item) return null
  const isRecipe = (item.shortName as string).includes('recipe')
  return (
    <img
      src={itemImageUrl(item.shortName)}
      alt={item.longName}
      title={item.longName + (isRecipe ? ' (Recipe)' : '')}
      style={{
        width: 28, height: 20, objectFit: 'contain', borderRadius: 2,
        ...(isRecipe ? { filter: 'grayscale(1) opacity(0.5)' } : {}),
      }}
      loading="lazy"
    />
  )
}

interface ItemProgressionEntry {
  matchId: number
  hero: number
  steamId: number
  nickname: string
  itemIds: number[]
  victory: boolean
}

const columns: ColumnDef<ItemProgressionEntry, unknown>[] = [
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
    id: 'hero',
    accessorFn: (row) => row.hero,
    header: 'Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'player',
    accessorFn: (row) => row.nickname,
    header: 'Player',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />
    ),
  },
  {
    id: 'items',
    accessorFn: () => '',
    header: 'Items',
    size: 300,
    enableSorting: false,
    meta: { grow: true },
    cell: ({ row }) => (
      <span style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        {row.original.itemIds.map((id, i) => (
          <ItemIcon key={`${id}-${i}`} itemId={id} />
        ))}
      </span>
    ),
  },
  {
    id: 'result',
    accessorFn: (row) => (row.victory ? 'Win' : 'Loss'),
    header: 'Result',
    size: 70,
    cell: ({ row }) => (
      <span style={{ color: row.original.victory ? '#2dd4bf' : '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>
        {row.original.victory ? 'Win' : 'Loss'}
      </span>
    ),
  },
]

export default function ItemProgression() {
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

  const { data, isLoading, error } = useApiQuery<{ data: ItemProgressionEntry[] }>(
    hasFilters ? '/api/items/progression' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const wins = useMemo(() => rows.filter((r) => r.victory).length, [rows])
  const total = rows.length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Item Progression</h1>
        <p className={styles.subtitle}>
          Common item build paths and their win rates
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'item-slots', 'roles', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching item progression data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{
            display: 'flex',
            gap: 32,
            justifyContent: 'center',
            padding: '10px 0 14px',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Progressions:</span>{' '}
              {total.toLocaleString()}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>
              <span style={{ color: '#2dd4bf', fontWeight: 600 }}>Wins:</span>{' '}
              {wins.toLocaleString()}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Win%:</span>{' '}
              {(wins / total * 100).toFixed(1)}%
            </span>
          </div>
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'matchId', desc: true }]}
            searchableColumns={['player']}
          />
        </>
      )}
    </div>
  )
}
