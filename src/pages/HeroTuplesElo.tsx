import { useState, useCallback, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PercentCell, DeltaCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { HeroTupleLine } from '../types'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

const TUPLE_SIZES = [1, 2, 3, 4, 5]

function getInitialTuple(): number {
  const hash = window.location.hash.replace('#', '')
  const parsed = parseInt(hash, 10)
  if (TUPLE_SIZES.includes(parsed)) return parsed
  return 1
}

function HeroTupleCell({ heroIds }: { heroIds: number[] }) {
  return (
    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {heroIds.map((id) => {
        const hero = heroesById[String(id)]
        const pic = hero?.picture
        const name = hero?.name ?? `Hero ${id}`
        const src = pic ? heroImageUrl(pic) : undefined
        return src ? (
          <img
            key={id}
            src={src}
            alt={name}
            title={name}
            style={{ height: 22, width: 'auto' }}
            loading="lazy"
          />
        ) : (
          <span key={id} style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }} title={name}>
            {name}
          </span>
        )
      })}
    </span>
  )
}

function heroTupleNames(ids: number[]): string {
  return ids.map((id) => heroesById[String(id)]?.name ?? '').filter(Boolean).join(' ')
}

const columns: ColumnDef<HeroTupleLine, unknown>[] = [
  {
    id: 'heroes',
    accessorFn: (row) => heroTupleNames(row.heroes),
    header: 'Heroes',
    size: 80,
    enableSorting: false,
    cell: ({ row }) => <HeroTupleCell heroIds={row.original.heroes} />,
  },
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'win',
    accessorKey: 'win',
    header: 'W',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'loss',
    accessorKey: 'loss',
    header: 'L',
    size: 65,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorFn: (row) => (row.total > 0 ? row.win / row.total : 0),
    header: 'Win %',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'eloShift',
    accessorKey: 'eloShift',
    header: 'Elo Shift',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average Elo Shift' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'eloGames',
    accessorKey: 'eloGames',
    header: 'Elo Games',
    size: 90,
    meta: { numeric: true, tooltip: 'Games with Elo Data' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function HeroTuplesElo() {
  const [tupleSize, setTupleSize] = useState(getInitialTuple)

  const selectTuple = useCallback((size: number) => {
    setTupleSize(size)
    window.location.hash = `#${size}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const parsed = parseInt(window.location.hash.replace('#', ''), 10)
      if (TUPLE_SIZES.includes(parsed)) setTupleSize(parsed)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  const { data, isLoading, error } = useApiQuery<{ data: HeroTupleLine[] }>(
    hasFilters ? '/api/heroes/elo' : null,
    apiParams,
  )

  const rows = useMemo(() => {
    if (!data?.data) return []
    return data.data.filter((t) => t.heroes.length === tupleSize)
  }, [data, tupleSize])

  // Set hash if not already set after data loads
  useEffect(() => {
    if (data?.data && !window.location.hash) {
      window.location.hash = `#${tupleSize}`
    }
  }, [data, tupleSize])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Hero Tuples & Elo</h1>
        <p className={styles.subtitle}>
          Hero combination performance and elo shift across filtered matches
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

      {hasFilters && (
        <div className={toggleStyles.toggleRow}>
          {TUPLE_SIZES.map((size) => (
            <button
              key={size}
              className={`${toggleStyles.toggleBtn} ${tupleSize === size ? toggleStyles.toggleActive : ''}`}
              onClick={() => selectTuple(size)}
            >
              {size}-tuple
            </button>
          ))}
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching hero tuples..." />}

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
          searchableColumns={['heroes']}
        />
      )}
    </div>
  )
}
