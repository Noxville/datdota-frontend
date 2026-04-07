import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { teamLogoUrl } from '../config'
import DataTable, { NumericCell, PercentCell, DeltaCell, TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface LaningTeamAgg {
  valveId: number
  name: string
  logoId: string | null
  gameCount: number
  avgLanesWon: number
  avgNwAdvantage10: number
  avgLevelAdvantage10: number
  midPctExcellent: number
  midPctWon: number
  midPctDrawn: number
  midPctLost: number
  midPctTerrible: number
  safePctExcellent: number
  safePctWon: number
  safePctDrawn: number
  safePctLost: number
  safePctTerrible: number
  offPctExcellent: number
  offPctWon: number
  offPctDrawn: number
  offPctLost: number
  offPctTerrible: number
  firstBloodRate: number
  avgTowersLost: number
  avgTowersDestroyed: number
}

/* ── Helpers ────────────────────────────────────────────── */

function pctCell({ getValue }: { getValue: () => unknown }) {
  return <PercentCell value={(getValue() as number) / 100} decimals={1} />
}

function lanePctCol(
  id: string,
  accessorKey: string,
  header: string,
  heatmap: 'high-good' | 'high-bad' | undefined,
  tooltip: string,
): ColumnDef<LaningTeamAgg, unknown> {
  return {
    id,
    accessorKey,
    header,
    size: 70,
    meta: { numeric: true, ...(heatmap ? { heatmap } : {}), tooltip },
    cell: pctCell,
  }
}

/* ── Columns ────────────────────────────────────────────── */

const columns: ColumnDef<LaningTeamAgg, unknown>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Team',
    size: 190,
    enableSorting: false,
    cell: ({ row }) => (
      <TeamCell
        valveId={row.original.valveId}
        name={row.original.name}
        logoUrl={teamLogoUrl(row.original.logoId)}
      />
    ),
  },
  {
    id: 'gameCount',
    accessorKey: 'gameCount',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'avgLanesWon',
    accessorKey: 'avgLanesWon',
    header: 'Lanes Won',
    size: 100,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average number of lanes won (out of 3) per game' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgNwAdvantage10',
    accessorKey: 'avgNwAdvantage10',
    header: 'NW Adv',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average total NW advantage across all 3 lanes at 10 min' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
  },
  {
    id: 'avgLevelAdvantage10',
    accessorKey: 'avgLevelAdvantage10',
    header: 'LVL Adv',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average total level advantage across all 3 lanes at 10 min' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={1} />,
  },
  // Mid lane outcomes
  {
    id: 'mid',
    header: 'Mid Lane',
    meta: { tooltip: 'Lane outcome distribution for mid lane' },
    columns: [
      lanePctCol('midPctExcellent', 'midPctExcellent', 'Exc%', 'high-good', 'Mid lane: % EXCELLENT outcomes (NW diff >= +1200)'),
      lanePctCol('midPctWon', 'midPctWon', 'Won%', 'high-good', 'Mid lane: % WON outcomes (+500 to +1200 NW)'),
      lanePctCol('midPctDrawn', 'midPctDrawn', 'Draw%', undefined, 'Mid lane: % DRAWN outcomes (-500 to +500 NW)'),
      lanePctCol('midPctLost', 'midPctLost', 'Lost%', 'high-bad', 'Mid lane: % LOST outcomes (-1200 to -500 NW)'),
      lanePctCol('midPctTerrible', 'midPctTerrible', 'Terr%', 'high-bad', 'Mid lane: % TERRIBLE outcomes (NW diff <= -1200)'),
    ],
  },
  // Safe lane outcomes
  {
    id: 'safe',
    header: 'Safe Lane',
    meta: { tooltip: 'Lane outcome distribution for safe lane (carry vs offlaner)' },
    columns: [
      lanePctCol('safePctExcellent', 'safePctExcellent', 'Exc%', 'high-good', 'Safe lane: % EXCELLENT outcomes (NW diff >= +1800)'),
      lanePctCol('safePctWon', 'safePctWon', 'Won%', 'high-good', 'Safe lane: % WON outcomes (+700 to +1800 NW)'),
      lanePctCol('safePctDrawn', 'safePctDrawn', 'Draw%', undefined, 'Safe lane: % DRAWN outcomes (-700 to +700 NW)'),
      lanePctCol('safePctLost', 'safePctLost', 'Lost%', 'high-bad', 'Safe lane: % LOST outcomes (-1800 to -700 NW)'),
      lanePctCol('safePctTerrible', 'safePctTerrible', 'Terr%', 'high-bad', 'Safe lane: % TERRIBLE outcomes (NW diff <= -1800)'),
    ],
  },
  // Offlane outcomes
  {
    id: 'off',
    header: 'Off Lane',
    meta: { tooltip: 'Lane outcome distribution for offlane (offlaner vs carry)' },
    columns: [
      lanePctCol('offPctExcellent', 'offPctExcellent', 'Exc%', 'high-good', 'Off lane: % EXCELLENT outcomes (NW diff >= +1800)'),
      lanePctCol('offPctWon', 'offPctWon', 'Won%', 'high-good', 'Off lane: % WON outcomes (+700 to +1800 NW)'),
      lanePctCol('offPctDrawn', 'offPctDrawn', 'Draw%', undefined, 'Off lane: % DRAWN outcomes (-700 to +700 NW)'),
      lanePctCol('offPctLost', 'offPctLost', 'Lost%', 'high-bad', 'Off lane: % LOST outcomes (-1800 to -700 NW)'),
      lanePctCol('offPctTerrible', 'offPctTerrible', 'Terr%', 'high-bad', 'Off lane: % TERRIBLE outcomes (NW diff <= -1800)'),
    ],
  },
  // Extra team metrics
  {
    id: 'firstBloodRate',
    accessorKey: 'firstBloodRate',
    header: 'FB%',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Percentage of games where this team drew first blood' },
    cell: pctCell,
  },
  {
    id: 'avgTowersDestroyed',
    accessorKey: 'avgTowersDestroyed',
    header: 'Twr Dest',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Average enemy towers destroyed before 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'avgTowersLost',
    accessorKey: 'avgTowersLost',
    header: 'Twr Lost',
    size: 85,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Average own towers lost before 10 minutes' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
  },
  {
    id: 'towerDelta',
    accessorFn: (row) => row.avgTowersDestroyed - row.avgTowersLost,
    header: 'Twr \u0394',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Tower delta: average towers destroyed minus towers lost before 10 min' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={2} />,
  },
]

/* ── Page ───────────────────────────────────────────────── */

export default function LaningTeams() {
  const {
    filters, setFilters, clearFilters, applyDefaults,
    apiParams, hasFilters, filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { data, isLoading, error } = useApiQuery<{ data: LaningTeamAgg[] }>(
    hasFilters ? '/api/lanes/laning/teams' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team Laning</h1>
        <p className={styles.subtitle}>
          Aggregate laning performance per team: lanes won, NW advantage, lane outcome distributions, first bloods, and early towers
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'heroes', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching team laning data..." />}

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
          searchableColumns={['name']}
        />
      )}
    </div>
  )
}
