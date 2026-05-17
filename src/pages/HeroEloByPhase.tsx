import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, DeltaCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import TableSkeleton from '../components/TableSkeleton'
import PageMeta from '../components/PageMeta'
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

interface PhaseStats {
  shift: number | null
  games: number
  wins: number
  losses: number
}

interface PivotedRow {
  hero: number
  phase1: PhaseStats
  phase2: PhaseStats
  phase3: PhaseStats
  totalGames: number
  totalWins: number
  totalLosses: number
  totalAvgShift: number | null
}

function emptyPhase(): PhaseStats {
  return { shift: null, games: 0, wins: 0, losses: 0 }
}

function pivotData(allPicks: HeroEloByPhaseLine[]): PivotedRow[] {
  const byHero = new Map<number, PivotedRow>()

  for (const entry of allPicks) {
    let row = byHero.get(entry.hero)
    if (!row) {
      row = {
        hero: entry.hero,
        phase1: emptyPhase(),
        phase2: emptyPhase(),
        phase3: emptyPhase(),
        totalGames: 0, totalWins: 0, totalLosses: 0, totalAvgShift: null,
      }
      byHero.set(entry.hero, row)
    }
    const stats: PhaseStats = { shift: entry.shift, games: entry.games, wins: entry.wins, losses: entry.losses }
    if (entry.phase === 1) row.phase1 = stats
    if (entry.phase === 2) row.phase2 = stats
    if (entry.phase === 3) row.phase3 = stats
  }

  for (const row of byHero.values()) {
    let totalWeighted = 0
    let totalGames = 0
    for (const p of [row.phase1, row.phase2, row.phase3]) {
      row.totalWins += p.wins
      row.totalLosses += p.losses
      if (p.shift !== null) { totalWeighted += p.shift * p.games; totalGames += p.games }
    }
    row.totalGames = totalGames
    row.totalAvgShift = totalGames > 0 ? totalWeighted / totalGames : null
  }

  return Array.from(byHero.values())
}

function WinLossCell({ wins, losses }: { wins: number; losses: number }) {
  if (wins + losses === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return (
    <span style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
      {wins}-{losses}
    </span>
  )
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
    accessorFn: (row) => row.phase1.shift,
    header: 'P1 Shift',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'First Phase Elo Shift' },
    cell: ({ row }) => {
      const v = row.original.phase1.shift
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <DeltaCell value={v} decimals={2} />
    },
  },
  {
    id: 'phase1WL',
    accessorFn: (row) => row.phase1.games,
    header: 'P1 W-L',
    size: 75,
    meta: { numeric: true, tooltip: 'First Phase Wins-Losses' },
    cell: ({ row }) => <WinLossCell wins={row.original.phase1.wins} losses={row.original.phase1.losses} />,
  },
  {
    id: 'phase2Shift',
    accessorFn: (row) => row.phase2.shift,
    header: 'P2 Shift',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Second Phase Elo Shift' },
    cell: ({ row }) => {
      const v = row.original.phase2.shift
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <DeltaCell value={v} decimals={2} />
    },
  },
  {
    id: 'phase2WL',
    accessorFn: (row) => row.phase2.games,
    header: 'P2 W-L',
    size: 75,
    meta: { numeric: true, tooltip: 'Second Phase Wins-Losses' },
    cell: ({ row }) => <WinLossCell wins={row.original.phase2.wins} losses={row.original.phase2.losses} />,
  },
  {
    id: 'phase3Shift',
    accessorFn: (row) => row.phase3.shift,
    header: 'P3 Shift',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Third Phase Elo Shift' },
    cell: ({ row }) => {
      const v = row.original.phase3.shift
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <DeltaCell value={v} decimals={2} />
    },
  },
  {
    id: 'phase3WL',
    accessorFn: (row) => row.phase3.games,
    header: 'P3 W-L',
    size: 75,
    meta: { numeric: true, tooltip: 'Third Phase Wins-Losses' },
    cell: ({ row }) => <WinLossCell wins={row.original.phase3.wins} losses={row.original.phase3.losses} />,
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
      <PageMeta title="Hero Elo by Phase — Pro Dota 2" description="Dota 2 hero Elo ratings broken down by laning, mid-game and late-game phases." />
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

      {isLoading && <TableSkeleton columns={columns} rows={10} loaderText="Fetching elo by phase..." />}

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
