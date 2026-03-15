import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, DeltaCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { HeroEloByPhaseResponse, HeroEloByPhaseLine } from '../types'
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

// Pivoted row: one per hero, with shift/games for each phase
interface PivotedRow {
  hero: number
  phase1Shift: number | null
  phase1Games: number
  phase2Shift: number | null
  phase2Games: number
  phase3Shift: number | null
  phase3Games: number
  totalGames: number
  totalAvgShift: number | null
}

function pivotData(allPicks: HeroEloByPhaseLine[]): PivotedRow[] {
  const byHero = new Map<number, PivotedRow>()

  for (const entry of allPicks) {
    let row = byHero.get(entry.hero)
    if (!row) {
      row = {
        hero: entry.hero,
        phase1Shift: null, phase1Games: 0,
        phase2Shift: null, phase2Games: 0,
        phase3Shift: null, phase3Games: 0,
        totalGames: 0, totalAvgShift: null,
      }
      byHero.set(entry.hero, row)
    }
    if (entry.phase === 1) { row.phase1Shift = entry.shift; row.phase1Games = entry.games }
    if (entry.phase === 2) { row.phase2Shift = entry.shift; row.phase2Games = entry.games }
    if (entry.phase === 3) { row.phase3Shift = entry.shift; row.phase3Games = entry.games }
  }

  // Compute totals
  for (const row of byHero.values()) {
    let totalWeighted = 0
    let totalGames = 0
    if (row.phase1Shift !== null) { totalWeighted += row.phase1Shift * row.phase1Games; totalGames += row.phase1Games }
    if (row.phase2Shift !== null) { totalWeighted += row.phase2Shift * row.phase2Games; totalGames += row.phase2Games }
    if (row.phase3Shift !== null) { totalWeighted += row.phase3Shift * row.phase3Games; totalGames += row.phase3Games }
    row.totalGames = totalGames
    row.totalAvgShift = totalGames > 0 ? totalWeighted / totalGames : null
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
    id: 'phase1Shift',
    accessorKey: 'phase1Shift',
    header: 'Phase 1',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'First Phase Elo Shift' },
    cell: ({ row }) => {
      const v = row.original.phase1Shift
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <span title={`${row.original.phase1Games} games`}><DeltaCell value={v} decimals={2} /></span>
    },
  },
  {
    id: 'phase2Shift',
    accessorKey: 'phase2Shift',
    header: 'Phase 2',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Second Phase Elo Shift' },
    cell: ({ row }) => {
      const v = row.original.phase2Shift
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <span title={`${row.original.phase2Games} games`}><DeltaCell value={v} decimals={2} /></span>
    },
  },
  {
    id: 'phase3Shift',
    accessorKey: 'phase3Shift',
    header: 'Phase 3',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Third Phase Elo Shift' },
    cell: ({ row }) => {
      const v = row.original.phase3Shift
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <span title={`${row.original.phase3Games} games`}><DeltaCell value={v} decimals={2} /></span>
    },
  },
  {
    id: 'totalGames',
    accessorKey: 'totalGames',
    header: 'Games',
    size: 75,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'totalAvgShift',
    accessorKey: 'totalAvgShift',
    header: 'Avg Shift',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Average Elo Shift' },
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <DeltaCell value={v} decimals={2} />
    },
  },
]

export default function HeroEloByPhase() {
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

  const { data, isLoading, error } = useApiQuery<{ data: HeroEloByPhaseResponse }>(
    hasFilters ? '/api/heroes/elo-by-phase' : null,
    apiParams,
  )

  const rows = useMemo(() => {
    if (!data?.data?.allPicks) return []
    return pivotData(data.data.allPicks)
  }, [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Elo by Phase</h1>
        <p className={styles.subtitle}>
          Hero elo shift broken down by draft phase
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

      {isLoading && <EnigmaLoader text="Fetching elo by phase..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'totalAvgShift', desc: true }]}
          searchableColumns={['hero']}
        />
      )}
    </div>
  )
}
