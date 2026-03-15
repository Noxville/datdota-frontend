import { useCallback, useEffect, useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { SquadPerformanceLine } from '../types'
import styles from './PlayerPerformances.module.css'
import squadStyles from './PlayerSquads.module.css'

const TUPLE_SIZES = [1, 2, 3, 4, 5]

function getInitialTuple(): number {
  const hash = window.location.hash.replace('#', '')
  const parsed = parseInt(hash, 10)
  if (TUPLE_SIZES.includes(parsed)) return parsed
  return 5
}

function SquadPlayersCell({ players }: { players: { nickname: string; steamId: number }[] }) {
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'center' }}>
      {players.map((p, i) => (
        <span key={p.steamId}>
          {i > 0 && <span style={{ color: 'var(--color-text-muted)', marginRight: 4 }}>·</span>}
          <PlayerCell steamId={p.steamId} nickname={p.nickname} />
        </span>
      ))}
    </span>
  )
}

function buildColumns(tupleSize: number): ColumnDef<SquadPerformanceLine, unknown>[] {
  return [
    {
      id: 'players',
      accessorFn: (row) => row.players.map((p) => p.nickname).join(', '),
      header: tupleSize === 1 ? 'Player' : `${tupleSize}-Player Squad`,
      size: tupleSize === 1 ? 200 : Math.min(tupleSize * 140, 600),
      enableSorting: false,
      meta: tupleSize > 2 ? { grow: true } : undefined,
      cell: ({ row }) => <SquadPlayersCell players={row.original.players} />,
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
      size: 85,
      meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
      cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
    },
  ]
}

export default function PlayerSquads() {
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

  const { data, isLoading, error } = useApiQuery<{ data: SquadPerformanceLine[] }>(
    hasFilters ? '/api/players/squads' : null,
    apiParams,
  )

  const columns = useMemo(() => buildColumns(tupleSize), [tupleSize])

  const rows = useMemo(() => {
    if (!data?.data) return []
    return data.data.filter((s) => s.players.length === tupleSize)
  }, [data, tupleSize])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Squads</h1>
        <p className={styles.subtitle}>
          Player combinations that have played together across filtered matches
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
        <div className={squadStyles.toggleRow}>
          {TUPLE_SIZES.map((size) => (
            <button
              key={size}
              className={`${squadStyles.toggleBtn} ${tupleSize === size ? squadStyles.toggleActive : ''}`}
              onClick={() => selectTuple(size)}
            >
              {size}-tuple
            </button>
          ))}
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching squad data..." />}

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
          searchableColumns={['players']}
          rowHeight={tupleSize > 2 ? 50 : undefined}
        />
      )}
    </div>
  )
}
