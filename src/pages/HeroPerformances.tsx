import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { HeroPerformanceLine } from '../types'
import styles from './PlayerPerformances.module.css'

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
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

const columns: ColumnDef<HeroPerformanceLine, unknown>[] = [
  {
    id: 'hero',
    accessorFn: (row) => heroName(row.hero),
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'overall',
    header: 'Overall',
    columns: [
      {
        id: 'total',
        accessorKey: 'total',
        header: 'Games',
        size: 65,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'wins',
        accessorKey: 'wins',
        header: 'W',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'losses',
        accessorKey: 'losses',
        header: 'L',
        size: 55,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Losses' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'winrate',
        accessorKey: 'winrate',
        header: 'Win %',
        size: 71,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'radiant',
    header: 'Radiant',
    columns: [
      {
        id: 'gamesRadiant',
        accessorKey: 'gamesRadiant',
        header: '#',
        size: 50,
        meta: { numeric: true, tooltip: 'Games as Radiant' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'winrateRadiant',
        accessorKey: 'winrateRadiant',
        header: 'Win %',
        size: 60,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate as Radiant' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'dire',
    header: 'Dire',
    columns: [
      {
        id: 'gamesDire',
        accessorKey: 'gamesDire',
        header: '#',
        size: 50,
        meta: { numeric: true, tooltip: 'Games as Dire' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'winrateDire',
        accessorKey: 'winrateDire',
        header: 'Win %',
        size: 60,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate as Dire' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'averages',
    header: 'Average Stats',
    columns: [
      {
        id: 'kills',
        accessorKey: 'kills',
        header: 'K',
        size: 50,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Kills' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
      },
      {
        id: 'deaths',
        accessorKey: 'deaths',
        header: 'D',
        size: 50,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Deaths' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
      },
      {
        id: 'assists',
        accessorKey: 'assists',
        header: 'A',
        size: 50,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Assists' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
      },
      {
        id: 'kda',
        accessorKey: 'kda',
        header: 'KDA',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'KDA Ratio' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
      },
      {
        id: 'avgKal',
        accessorKey: 'avgKal',
        header: 'KAL',
        size: 55,
        meta: { numeric: true, tooltip: 'Average Kills + Assists per Life' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
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
        meta: { numeric: true, tooltip: 'Average Level' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'heroDamage',
        accessorKey: 'heroDamage',
        header: 'HD',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Hero Damage' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
      },
      {
        id: 'towerDamage',
        accessorKey: 'towerDamage',
        header: 'TD',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Tower Damage' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
      },
      {
        id: 'heroHealing',
        accessorKey: 'heroHealing',
        header: 'HH',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Hero Healing' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
      },
      {
        id: 'goldSpent',
        accessorKey: 'goldSpent',
        header: 'GS',
        size: 55,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Gold Spent' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
      },
    ],
  },
]

export default function HeroPerformances() {
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

  const { data, isLoading, error } = useApiQuery<{ data: HeroPerformanceLine[] }>(
    hasFilters ? '/api/heroes/performances' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Hero Performances</h1>
        <p className={styles.subtitle}>
          Average statistics per hero across filtered matches
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

      {isLoading && <EnigmaLoader text="Fetching hero data..." />}

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
          searchableColumns={['hero']}
        />
      )}
    </div>
  )
}
