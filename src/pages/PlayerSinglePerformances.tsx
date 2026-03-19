import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl, itemImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import DataTable, { NumericCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { PlayerSinglePerformanceLine } from '../types'
import styles from './PlayerPerformances.module.css'

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPicture(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroPicture(heroId)
  const name = heroName(heroId)
  return pic ? (
    <img
      src={heroImageUrl(pic)}
      alt={name}
      title={name}
      style={{ height: 22, width: 'auto' }}
      loading="lazy"
    />
  ) : (
    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

function ItemsCell({ items }: { items: number[] }) {
  if (!items || items.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {items.filter((id) => id > 0).map((id, i) => {
        const item = itemsData[String(id)]
        const rawName = item?.shortName as string | undefined
        const shortName = rawName?.replace(/^item_/, '')
        const src = shortName ? itemImageUrl(shortName) : undefined
        const name = (item?.longName as string) ?? `Item ${id}`
        return src ? (
          <img
            key={i}
            src={src}
            alt={name}
            title={name}
            style={{ height: 22, width: 'auto', borderRadius: 2 }}
            loading="lazy"
          />
        ) : null
      })}
    </span>
  )
}

const columns: ColumnDef<PlayerSinglePerformanceLine, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a
        href={`/matches/${getValue()}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {getValue() as number}
      </a>
    ),
  },
  {
    id: 'hero',
    accessorFn: (row) => heroName(row.hero),
    header: 'Hero',
    size: 46,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'nickname',
    accessorKey: 'nickname',
    header: 'Player',
    size: 140,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />
    ),
  },
  {
    id: 'victory',
    accessorKey: 'victory',
    header: 'R',
    size: 40,
    meta: { tooltip: 'Result' },
    cell: ({ getValue }) => {
      const win = getValue() as boolean
      return (
        <span style={{ color: win ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 600, fontSize: '0.8rem' }}>
          {win ? 'W' : 'L'}
        </span>
      )
    },
  },
  {
    id: 'kills',
    accessorKey: 'kills',
    header: 'K',
    size: 50,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Kills' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'deaths',
    accessorKey: 'deaths',
    header: 'D',
    size: 50,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Deaths' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'assists',
    accessorKey: 'assists',
    header: 'A',
    size: 50,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Assists' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'kda',
    accessorKey: 'kda',
    header: 'KDA',
    size: 58,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'KDA Ratio' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'gpm',
    accessorKey: 'gpm',
    header: 'GPM',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Gold Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'xpm',
    accessorKey: 'xpm',
    header: 'XPM',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'XP Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'lastHits',
    accessorKey: 'lastHits',
    header: 'LH',
    size: 50,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Last Hits' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'denies',
    accessorKey: 'denies',
    header: 'DN',
    size: 45,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Denies' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'level',
    accessorKey: 'level',
    header: 'LVL',
    size: 45,
    meta: { numeric: true, tooltip: 'Level' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'heroDamage',
    accessorKey: 'heroDamage',
    header: 'HD',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Hero Damage' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
  },
  {
    id: 'towerDamage',
    accessorKey: 'towerDamage',
    header: 'TD',
    size: 58,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Tower Damage' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
  },
  {
    id: 'heroHealing',
    accessorKey: 'heroHealing',
    header: 'HH',
    size: 58,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Hero Healing' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
  },
  {
    id: 'goldSpent',
    accessorKey: 'goldSpent',
    header: 'GS',
    size: 58,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Gold Spent' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
  },
  {
    id: 'endItems',
    accessorFn: (row) =>
      (row.endItems ?? [])
        .filter((id) => id > 0)
        .map((id) => (itemsData[String(id)]?.longName as string) ?? `Item ${id}`)
        .join(', '),
    header: 'Items',
    size: 280,
    enableSorting: false,
    cell: ({ row }) => <ItemsCell items={row.original.endItems} />,
  },
]

export default function PlayerSinglePerformances() {
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

  const { data, isLoading, error } = useApiQuery<{ data: PlayerSinglePerformanceLine[] }>(
    hasFilters ? '/api/players/single-performance' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Single Performances</h1>
        <p className={styles.subtitle}>
          Individual match-level player statistics
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

      {isLoading && <EnigmaLoader text="Fetching match data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'matchId', desc: true }]}
          searchableColumns={['nickname', 'hero']}
        />
      )}
    </div>
  )
}
