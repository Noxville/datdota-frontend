import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { useLaneToggles, LANE_KEYS } from '../hooks/useLaneToggles'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { LANES, laneLabel, laneColor } from '../data/lanes'
import DataTable, { NumericCell, PercentCell, DeltaCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface LaningHeroAgg {
  hero: number
  metaLane: string
  gameCount: number
  avgNetworth: number
  avgLastHits: number
  avgDenies: number
  avgLevel: number
  avgKills: number
  avgDeaths: number
  avgHeroDamage: number
  avgHeroDamageTaken: number
  avgBuildingDamage: number
  avgNwDiff: number
  avgLevelDiff: number
  avgLhDiff: number
  pctExcellent: number
  pctWon: number
  pctDrawn: number
  pctLost: number
  pctTerrible: number
}

/* ── Helpers ────────────────────────────────────────────── */

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function HeroIconCell({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  const name = hero?.name ?? `Hero ${heroId}`
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img src={src} alt={name} title={name} style={{ height: 24, width: 'auto' }} loading="lazy" />
  ) : (
    <span title={name} style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

/* ── Columns ────────────────────────────────────────────── */

const columns: ColumnDef<LaningHeroAgg, unknown>[] = [
  {
    id: 'heroIcon',
    accessorKey: 'hero',
    header: '',
    size: 46,
    enableSorting: false,
    cell: ({ getValue }) => <HeroIconCell heroId={getValue() as number} />,
  },
  {
    id: 'heroName',
    accessorFn: (row) => heroName(row.hero),
    header: 'Hero',
    size: 150,
    cell: ({ getValue }) => getValue() as string,
  },
  {
    id: 'metaLane',
    accessorFn: (row) => laneLabel(row.metaLane),
    header: 'Lane',
    size: 70,
    meta: { tooltip: 'Lane assignment (MID / SAFE / OFF)' },
    cell: ({ row }) => {
      const key = row.original.metaLane
      return <span style={{ color: laneColor(key) }}>{laneLabel(key)}</span>
    },
  },
  {
    id: 'gameCount',
    accessorKey: 'gameCount',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total games as core in this lane' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'avgNetworth',
    accessorKey: 'avgNetworth',
    header: 'NW@10',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average net worth at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={0} />,
  },
  {
    id: 'avgLastHits',
    accessorKey: 'avgLastHits',
    header: 'LH@10',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average last hits at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'avgDenies',
    accessorKey: 'avgDenies',
    header: 'DN@10',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average denies at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'avgLevel',
    accessorKey: 'avgLevel',
    header: 'LVL@10',
    size: 78,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average hero level at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'avgKills',
    accessorKey: 'avgKills',
    header: 'K@10',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average kills at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgDeaths',
    accessorKey: 'avgDeaths',
    header: 'D@10',
    size: 70,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Average deaths at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgHeroDamage',
    accessorKey: 'avgHeroDamage',
    header: 'HD@10',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average hero damage dealt at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={0} />,
  },
  {
    id: 'avgHeroDamageTaken',
    accessorKey: 'avgHeroDamageTaken',
    header: 'HDT@10',
    size: 80,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Average hero damage taken at 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={0} />,
  },
  {
    id: 'avgNwDiff',
    accessorKey: 'avgNwDiff',
    header: 'NW Diff',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average NW difference vs lane opponent at 10 minutes' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
  },
  {
    id: 'avgLhDiff',
    accessorKey: 'avgLhDiff',
    header: 'LH Diff',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average last hit difference vs lane opponent at 10 minutes' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'avgLevelDiff',
    accessorKey: 'avgLevelDiff',
    header: 'LVL Diff',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average level difference vs lane opponent at 10 minutes' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'pctExcellent',
    accessorKey: 'pctExcellent',
    header: 'Exc%',
    size: 72,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Percentage of games with EXCELLENT lane outcome' },
    cell: ({ getValue }) => <PercentCell value={(getValue() as number) / 100} />,
  },
  {
    id: 'pctWon',
    accessorKey: 'pctWon',
    header: 'Won%',
    size: 72,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Percentage of games with WON lane outcome' },
    cell: ({ getValue }) => <PercentCell value={(getValue() as number) / 100} />,
  },
  {
    id: 'pctDrawn',
    accessorKey: 'pctDrawn',
    header: 'Draw%',
    size: 72,
    meta: { numeric: true, tooltip: 'Percentage of games with DRAWN lane outcome' },
    cell: ({ getValue }) => <PercentCell value={(getValue() as number) / 100} />,
  },
  {
    id: 'pctLost',
    accessorKey: 'pctLost',
    header: 'Lost%',
    size: 72,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Percentage of games with LOST lane outcome' },
    cell: ({ getValue }) => <PercentCell value={(getValue() as number) / 100} />,
  },
  {
    id: 'pctTerrible',
    accessorKey: 'pctTerrible',
    header: 'Terr%',
    size: 72,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Percentage of games with TERRIBLE lane outcome' },
    cell: ({ getValue }) => <PercentCell value={(getValue() as number) / 100} />,
  },
]

/* ── Page ───────────────────────────────────────────────── */

export default function LaningHeroes() {
  const {
    filters, setFilters, clearFilters, applyDefaults,
    apiParams, hasFilters, filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { visible, toggle } = useLaneToggles()

  const { data, isLoading, error } = useApiQuery<{ data: LaningHeroAgg[] }>(
    hasFilters ? '/api/lanes/laning/heroes' : null,
    apiParams,
  )

  const rows = useMemo(() => {
    const all = data?.data ?? []
    return all.filter((r) => visible.has(r.metaLane))
  }, [data, visible])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Hero Laning</h1>
        <p className={styles.subtitle}>
          Average 10-minute laning stats per hero, with lane outcome breakdowns by lane assignment
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['heroes', 'players', 'teams', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction', 'threshold']}
      />

      {/* Lane toggle buttons */}
      <div className={toggleStyles.toggleRow}>
        {LANE_KEYS.map((key) => {
          const cfg = LANES[key]
          const active = visible.has(key)
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`${toggleStyles.toggleBtn} ${active ? toggleStyles.toggleActive : ''}`}
            >
              <span style={{ color: active ? cfg.color : undefined }}>{cfg.label}</span>
            </button>
          )
        })}
      </div>

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching hero laning data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'gameCount', desc: true }]}
          searchableColumns={['heroName', 'metaLane']}
        />
      )}
    </div>
  )
}
