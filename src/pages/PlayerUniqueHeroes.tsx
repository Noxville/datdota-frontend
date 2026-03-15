import { useState, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { UniqueHeroLine } from '../types'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

const allHeroIds = Object.keys(heroesById).map(Number).sort((a, b) => a - b)

function heroNames(ids: number[]): string {
  return ids.map((id) => heroesById[String(id)]?.name ?? '').filter(Boolean).join(' ')
}

function HeroGrid({ heroIds }: { heroIds: number[] }) {
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
      {heroIds.map((id) => {
        const hero = heroesById[String(id)]
        const pic = hero?.picture
        const src = pic ? heroImageUrl(pic) : undefined
        return src ? (
          <img
            key={id}
            src={src}
            alt={hero?.name ?? ''}
            title={hero?.name ?? `Hero ${id}`}
            style={{ height: 25, width: 'auto', borderRadius: 2 }}
            loading="lazy"
          />
        ) : (
          <span
            key={id}
            style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}
            title={`Hero ${id}`}
          >
            {id}
          </span>
        )
      })}
    </span>
  )
}

type HeroMode = 'played' | 'unplayed'

function makeColumns(mode: HeroMode): ColumnDef<UniqueHeroLine, unknown>[] {
  return [
    {
      id: 'nickname',
      accessorKey: 'nickname',
      header: 'Player',
      size: 40,
      enableSorting: false,
      cell: ({ row }) => (
        <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />
      ),
    },
    {
      id: 'countUnique',
      accessorKey: 'countUnique',
      header: 'Unique',
      size: 60,
      meta: { numeric: true, heatmap: 'high-good', tooltip: 'Distinct heroes played' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    },
    {
      id: 'gameCount',
      accessorKey: 'gameCount',
      header: 'Games',
      size: 60,
      meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total games played' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    },
    {
      id: 'heroes',
      accessorFn: (row) => {
        const ids = mode === 'played'
          ? row.heroes
          : allHeroIds.filter((id) => !row.heroes.includes(id))
        return heroNames(ids)
      },
      header: mode === 'played' ? 'Played Heroes' : 'Unplayed Heroes',
      size: 900,
      enableSorting: false,
      meta: { grow: true },
      cell: ({ row }) => {
        const ids = mode === 'played'
          ? row.original.heroes
          : allHeroIds.filter((id) => !row.original.heroes.includes(id))
        return <HeroGrid heroIds={ids} />
      },
    },
  ]
}

export default function PlayerUniqueHeroes() {
  const {
    filters,
    setFilters,
    clearFilters,
    applyDefaults,
    apiParams,
    hasFilters,
    filtersCollapsed,
    setFiltersCollapsed,
  } = useFilters(['threshold'])

  const [heroMode, setHeroMode] = useState<HeroMode>('played')

  const { data, isLoading, error } = useApiQuery<{ data: UniqueHeroLine[] }>(
    hasFilters ? '/api/players/unique-heroes' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const columns = useMemo(() => makeColumns(heroMode), [heroMode])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Unique Heroes</h1>
        <p className={styles.subtitle}>
          Distinct heroes played per player across filtered matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'roles', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching unique heroes data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className={toggleStyles.toggleRow}>
            <button
              className={`${toggleStyles.toggleBtn} ${heroMode === 'played' ? toggleStyles.toggleActive : ''}`}
              onClick={() => setHeroMode('played')}
            >
              Played
            </button>
            <button
              className={`${toggleStyles.toggleBtn} ${heroMode === 'unplayed' ? toggleStyles.toggleActive : ''}`}
              onClick={() => setHeroMode('unplayed')}
            >
              Unplayed
            </button>
          </div>
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'countUnique', desc: true }]}
            searchableColumns={['nickname', 'heroes']}
            rowHeight={60}
          />
        </>
      )}
    </div>
  )
}
