import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { FrequentPlayerHero } from '../types'
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
    <img src={src} alt={name} title={name} style={{ height: 22, width: 'auto' }} loading="lazy" />
  ) : (
    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

function PlayersListCell({ players }: { players: { steamId: number; nickname: string }[] }) {
  if (!players || players.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', alignItems: 'center' }}>
      {players.map((p, i) => (
        <span key={p.steamId}>
          {i > 0 && <span style={{ color: 'var(--color-text-muted)', marginRight: 2 }}>,</span>}
          <PlayerCell steamId={p.steamId} nickname={p.nickname} />
        </span>
      ))}
    </span>
  )
}

// Pivoted row: one per hero with rank 1/2/3 data
interface PivotedRow {
  hero: number
  rank1Games: number | null
  rank1Players: { steamId: number; nickname: string }[]
  rank2Games: number | null
  rank2Players: { steamId: number; nickname: string }[]
  rank3Games: number | null
  rank3Players: { steamId: number; nickname: string }[]
}

function pivotData(entries: FrequentPlayerHero[]): PivotedRow[] {
  const byHero = new Map<number, PivotedRow>()

  for (const entry of entries) {
    let row = byHero.get(entry.hero)
    if (!row) {
      row = {
        hero: entry.hero,
        rank1Games: null, rank1Players: [],
        rank2Games: null, rank2Players: [],
        rank3Games: null, rank3Players: [],
      }
      byHero.set(entry.hero, row)
    }
    if (entry.rank === 1) { row.rank1Games = entry.games; row.rank1Players = entry.players }
    if (entry.rank === 2) { row.rank2Games = entry.games; row.rank2Players = entry.players }
    if (entry.rank === 3) { row.rank3Games = entry.games; row.rank3Players = entry.players }
  }

  return Array.from(byHero.values())
}

const columns: ColumnDef<PivotedRow, unknown>[] = [
  {
    id: 'hero',
    accessorFn: (row) => heroName(row.hero),
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'rank1',
    header: '1st Most Played',
    columns: [
      {
        id: 'rank1Games',
        accessorKey: 'rank1Games',
        header: 'Games',
        size: 65,
        meta: { numeric: true, heatmap: 'high-good', tooltip: '1st Most Played – Games' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'rank1Players',
        accessorFn: (row) => row.rank1Players.map((p) => p.nickname).join(', '),
        header: 'Player(s)',
        size: 150,
        enableSorting: false,
        cell: ({ row }) => <PlayersListCell players={row.original.rank1Players} />,
      },
    ],
  },
  {
    id: 'rank2',
    header: '2nd Most Played',
    columns: [
      {
        id: 'rank2Games',
        accessorKey: 'rank2Games',
        header: 'Games',
        size: 65,
        meta: { numeric: true, heatmap: 'high-good', tooltip: '2nd Most Played – Games' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'rank2Players',
        accessorFn: (row) => row.rank2Players.map((p) => p.nickname).join(', '),
        header: 'Player(s)',
        size: 150,
        enableSorting: false,
        cell: ({ row }) => <PlayersListCell players={row.original.rank2Players} />,
      },
    ],
  },
  {
    id: 'rank3',
    header: '3rd Most Played',
    columns: [
      {
        id: 'rank3Games',
        accessorKey: 'rank3Games',
        header: 'Games',
        size: 65,
        meta: { numeric: true, heatmap: 'high-good', tooltip: '3rd Most Played – Games' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'rank3Players',
        accessorFn: (row) => row.rank3Players.map((p) => p.nickname).join(', '),
        header: 'Player(s)',
        size: 150,
        enableSorting: false,
        cell: ({ row }) => <PlayersListCell players={row.original.rank3Players} />,
      },
    ],
  },
]

export default function HeroFrequentPlayers() {
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

  const { data, isLoading, error } = useApiQuery<{ data: FrequentPlayerHero[] }>(
    hasFilters ? '/api/heroes/frequent-players' : null,
    apiParams,
  )

  const rows = useMemo(() => {
    if (!data?.data) return []
    return pivotData(data.data)
  }, [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Frequent Players</h1>
        <p className={styles.subtitle}>
          Most common players per hero across filtered matches
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

      {isLoading && <EnigmaLoader text="Fetching frequent players..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'rank1Games', desc: true }]}
          searchableColumns={['hero', 'rank1Players', 'rank2Players', 'rank3Players']}
        />
      )}
    </div>
  )
}
