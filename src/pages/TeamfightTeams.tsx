import { useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { teamLogoUrl } from '../config'
import DataTable, { NumericCell, DeltaCell, TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface TeamfightTeamBucket {
  teamfightType: string
  timeBucket: string
  fightsAttended: number
  avgKills: number | null
  avgDeaths: number | null
  avgAssists: number | null
  avgParticipants: number | null
  avgTeamNwShift: number | null
}

interface TeamfightOverviewTeam {
  teamId: number
  valveId: number
  teamName: string
  logoId: string | null
  totalTeamfightsAttended: number
  fights: TeamfightTeamBucket[]
}

/** Flattened row per team for the selected fight type. */
interface TeamRow {
  valveId: number
  teamName: string
  logoId: string | null
  totalTeamfightsAttended: number
  buckets: Map<string, TeamfightTeamBucket>
  totalAttended: number
  avgKills: number | null
  avgDeaths: number | null
  avgAssists: number | null
  avgParticipants: number | null
  avgTeamNwShift: number | null
}

/* ── Constants ──────────────────────────────────────────── */

const FIGHT_TYPES = [
  { id: 'BATTLE', label: 'Battle', tip: '4+ vs 4+' },
  { id: 'SKIRMISH', label: 'Skirmish', tip: 'XvY (not 4+ v 4+)' },
  { id: 'GANK', label: 'Gank', tip: '1vX' },
  { id: 'SOLO', label: 'Solo', tip: '1v1' },
] as const

const TIME_BUCKETS = ['< 10', '10-20', '20-30', '30-40', '40+'] as const

const FIGHT_TYPE_COLORS: Record<string, string> = {
  BATTLE: '#e8a838',
  SKIRMISH: '#60a5fa',
  GANK: '#f472b6',
  SOLO: '#a78bfa',
}

/* ── Hash-based fight type selector ────────────────────── */

function useFightTypeToggle() {
  const location = useLocation()
  const navigate = useNavigate()

  const selected = useMemo(() => {
    const hash = location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    const ft = params.get('type')
    return FIGHT_TYPES.some((f) => f.id === ft) ? ft! : 'BATTLE'
  }, [location.hash])

  const setType = useCallback((type: string) => {
    const hash = location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    params.set('type', type)
    navigate(
      `${location.pathname}${location.search}#${params.toString()}`,
      { replace: true },
    )
  }, [location, navigate])

  return { selected, setType }
}

/* ── Helpers ────────────────────────────────────────────── */

function weightedAvg(buckets: TeamfightTeamBucket[], field: 'avgKills' | 'avgDeaths' | 'avgAssists' | 'avgParticipants' | 'avgTeamNwShift'): number | null {
  let sum = 0
  let weight = 0
  for (const b of buckets) {
    const v = b[field]
    if (v != null && b.fightsAttended > 0) {
      sum += v * b.fightsAttended
      weight += b.fightsAttended
    }
  }
  return weight > 0 ? sum / weight : null
}

function buildRows(data: TeamfightOverviewTeam[], fightType: string): TeamRow[] {
  return data.map((t) => {
    const typeBuckets = t.fights.filter((f) => f.teamfightType === fightType)
    const bucketMap = new Map<string, TeamfightTeamBucket>()
    for (const b of typeBuckets) bucketMap.set(b.timeBucket, b)

    const totalAttended = typeBuckets.reduce((s, b) => s + b.fightsAttended, 0)

    return {
      valveId: t.valveId,
      teamName: t.teamName,
      logoId: t.logoId,
      totalTeamfightsAttended: t.totalTeamfightsAttended,
      buckets: bucketMap,
      totalAttended,
      avgKills: weightedAvg(typeBuckets, 'avgKills'),
      avgDeaths: weightedAvg(typeBuckets, 'avgDeaths'),
      avgAssists: weightedAvg(typeBuckets, 'avgAssists'),
      avgParticipants: weightedAvg(typeBuckets, 'avgParticipants'),
      avgTeamNwShift: weightedAvg(typeBuckets, 'avgTeamNwShift'),
    }
  }).filter((r) => r.totalAttended > 0)
}

/* ── Columns ────────────────────────────────────────────── */

function makeColumns(fightType: string): ColumnDef<TeamRow, unknown>[] {
  const fightLabel = FIGHT_TYPES.find((f) => f.id === fightType)?.label ?? fightType

  const cols: ColumnDef<TeamRow, unknown>[] = [
    {
      id: 'teamName',
      accessorKey: 'teamName',
      header: 'Team',
      size: 192,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell valveId={row.original.valveId} name={row.original.teamName} logoUrl={row.original.logoId ? teamLogoUrl(row.original.logoId) : undefined} />
      ),
    },
    {
      id: 'totalTeamfightsAttended',
      accessorKey: 'totalTeamfightsAttended',
      header: 'Total TFs',
      size: 97,
      meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total teamfights attended across all fight types' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    },
    {
      id: 'totalTypeAttended',
      accessorKey: 'totalAttended',
      header: `${fightLabel}s`,
      size: 92,
      meta: { numeric: true, heatmap: 'high-good', tooltip: `Total ${fightLabel.toLowerCase()}s this team was involved in` },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    },
    {
      id: 'typePct',
      accessorFn: (row) => row.totalTeamfightsAttended > 0 ? row.totalAttended / row.totalTeamfightsAttended : null,
      header: `${fightLabel} %`,
      size: 92,
      meta: { numeric: true, tooltip: `${fightLabel}s as a percentage of all teamfights` },
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        if (v == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        return <span>{(v * 100).toFixed(1)}%</span>
      },
    },
    {
      id: 'typeSummary',
      header: `${fightLabel} Summary`,
      meta: { tooltip: `Aggregated stats for ${fightLabel.toLowerCase()}s across all time periods` },
      columns: [
        {
          id: 'totalAttended',
          accessorKey: 'totalAttended',
          header: 'Att',
          size: 77,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Total ${fightLabel.toLowerCase()}s attended` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
        },
        {
          id: 'avgKills',
          accessorKey: 'avgKills',
          header: 'Avg K',
          size: 80,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Average team kills per ${fightLabel.toLowerCase()} (weighted)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: 'avgDeaths',
          accessorKey: 'avgDeaths',
          header: 'Avg D',
          size: 80,
          meta: { numeric: true, heatmap: 'high-bad', tooltip: `Average team deaths per ${fightLabel.toLowerCase()} (weighted)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: 'avgAssists',
          accessorKey: 'avgAssists',
          header: 'Avg A',
          size: 80,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Average team assists per ${fightLabel.toLowerCase()} (weighted)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: 'avgParticipants',
          accessorKey: 'avgParticipants',
          header: 'Avg Part',
          size: 87,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Average number of team members participating per ${fightLabel.toLowerCase()} (weighted)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: 'avgTeamNwShift',
          accessorKey: 'avgTeamNwShift',
          header: 'NW Δ',
          size: 92,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Average team net worth shift per ${fightLabel.toLowerCase()} (interpolated, weighted)` },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
        },
      ],
    },
  ]

  // Per time-bucket breakdown columns
  for (const tb of TIME_BUCKETS) {
    cols.push({
      id: `tb-${tb}`,
      header: tb,
      meta: { tooltip: `Stats for ${fightLabel.toLowerCase()}s in the ${tb} minute window` },
      columns: [
        {
          id: `att-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.fightsAttended ?? 0,
          header: 'Att',
          size: 64,
          meta: { numeric: true, tooltip: `${fightLabel}s attended (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
        },
        {
          id: `k-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgKills ?? null,
          header: 'K',
          size: 60,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg team kills (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: `d-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgDeaths ?? null,
          header: 'D',
          size: 60,
          meta: { numeric: true, heatmap: 'high-bad', tooltip: `Avg team deaths (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: `a-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgAssists ?? null,
          header: 'A',
          size: 60,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg team assists (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: `part-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgParticipants ?? null,
          header: 'Part',
          size: 64,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg participants (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: `nw-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgTeamNwShift ?? null,
          header: 'NW Δ',
          size: 80,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg team NW shift (${tb} min)` },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
        },
      ],
    })
  }

  return cols
}

/* ── Page ───────────────────────────────────────────────── */

export default function TeamfightTeams() {
  const {
    filters, setFilters, clearFilters, applyDefaults,
    apiParams, hasFilters, filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { selected: fightType, setType } = useFightTypeToggle()

  const { data, isLoading, error } = useApiQuery<{ data: TeamfightOverviewTeam[] }>(
    hasFilters ? '/api/teamfights/teams' : null,
    apiParams,
  )

  const rows = useMemo(() => buildRows(data?.data ?? [], fightType), [data, fightType])
  const columns = useMemo(() => makeColumns(fightType), [fightType])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team Teamfights</h1>
        <p className={styles.subtitle}>
          Per-team teamfight statistics broken down by fight type and game time
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction', 'threshold']}
      />

      {/* Fight type selector */}
      <div className={toggleStyles.toggleRow}>
        {FIGHT_TYPES.map((ft) => {
          const active = fightType === ft.id
          return (
            <button
              key={ft.id}
              onClick={() => setType(ft.id)}
              className={`${toggleStyles.toggleBtn} ${active ? toggleStyles.toggleActive : ''}`}
              title={ft.tip}
            >
              <span style={{ color: active ? FIGHT_TYPE_COLORS[ft.id] : undefined }}>{ft.label}</span>
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

      {isLoading && <EnigmaLoader text="Fetching team teamfight data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'totalTeamfightsAttended', desc: true }]}
          searchableColumns={['teamName']}
          stickyColumns={1}
        />
      )}
    </div>
  )
}
