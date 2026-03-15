import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PercentCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { PlayerHeroComboLine } from '../types'
import styles from './PlayerPerformances.module.css'

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPicture(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function HeroCell({ heroId }: { heroId: number }) {
  const pic = heroPicture(heroId)
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {pic && (
        <img
          src={heroImageUrl(pic)}
          alt=""
          style={{ height: 20, width: 'auto', flexShrink: 0 }}
          loading="lazy"
        />
      )}
      <span>{heroName(heroId)}</span>
    </span>
  )
}

const columns: ColumnDef<PlayerHeroComboLine, unknown>[] = [
  {
    id: 'hero',
    accessorKey: 'hero',
    header: 'Hero',
    size: 180,
    enableSorting: false,
    cell: ({ getValue }) => <HeroCell heroId={getValue() as number} />,
  },
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
    id: 'eloShift',
    accessorKey: 'eloShift',
    header: 'Elo',
    size: 70,
    meta: { numeric: true, tooltip: 'Average Elo Shift' },
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (v == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <NumericCell value={v} decimals={1} />
    },
  },
  {
    id: 'gamesRadiant',
    accessorKey: 'gamesRadiant',
    header: 'Rad',
    size: 60,
    meta: { numeric: true, tooltip: 'Games as Radiant' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'gamesDire',
    accessorKey: 'gamesDire',
    header: 'Dire',
    size: 60,
    meta: { numeric: true, tooltip: 'Games as Dire' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'kills',
    accessorKey: 'kills',
    header: 'K',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Kills' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'deaths',
    accessorKey: 'deaths',
    header: 'D',
    size: 60,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Deaths' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'assists',
    accessorKey: 'assists',
    header: 'A',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Assists' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'kda',
    accessorKey: 'kda',
    header: 'KDA',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'KDA Ratio' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'gpm',
    accessorKey: 'gpm',
    header: 'GPM',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Gold Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'xpm',
    accessorKey: 'xpm',
    header: 'XPM',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'XP Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'lastHits',
    accessorKey: 'lastHits',
    header: 'LH',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Last Hits' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'denies',
    accessorKey: 'denies',
    header: 'DN',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Denies' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function PlayerHeroCombos() {
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

  const { data, isLoading, error } = useApiQuery<{ data: PlayerHeroComboLine[] }>(
    hasFilters ? '/api/players/hero-combos' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Player Hero Combos</h1>
        <p className={styles.subtitle}>
          Performance statistics per player-hero combination across filtered matches
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

      {isLoading && <EnigmaLoader text="Fetching hero combo data..." />}

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
