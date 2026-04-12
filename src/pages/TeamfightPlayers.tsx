import { useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, DeltaCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface TeamfightBucket {
  teamfightType: string
  timeBucket: string
  fightsAttended: number
  fightsDodged: number
  avgKills: number | null
  avgDeaths: number | null
  avgAssists: number | null
  avgInterpNwAttended: number | null
  avgInterpNwDodged: number | null
}

interface TeamfightOverviewPlayer {
  playerId: number
  steamId: number
  nickname: string
  totalTeamfightsAttended: number
  fights: TeamfightBucket[]
}

/** Flattened row: one row per player with stats aggregated for the selected fight type. */
interface PlayerRow {
  steamId: number
  nickname: string
  totalTeamfightsAttended: number
  // Per time-bucket columns
  buckets: Map<string, TeamfightBucket>
  // Totals across all time buckets for selected type
  totalAttended: number
  totalDodged: number
  avgKills: number | null
  avgDeaths: number | null
  avgAssists: number | null
  avgNwAttended: number | null
  avgNwDodged: number | null
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

function weightedAvg(buckets: TeamfightBucket[], field: 'avgKills' | 'avgDeaths' | 'avgAssists' | 'avgInterpNwAttended' | 'avgInterpNwDodged'): number | null {
  let sum = 0
  let weight = 0
  for (const b of buckets) {
    const v = b[field]
    const w = field === 'avgInterpNwDodged' ? b.fightsDodged : b.fightsAttended
    if (v != null && w > 0) {
      sum += v * w
      weight += w
    }
  }
  return weight > 0 ? sum / weight : null
}

function buildRows(data: TeamfightOverviewPlayer[], fightType: string): PlayerRow[] {
  return data.map((p) => {
    const typeBuckets = p.fights.filter((f) => f.teamfightType === fightType)
    const bucketMap = new Map<string, TeamfightBucket>()
    for (const b of typeBuckets) bucketMap.set(b.timeBucket, b)

    const totalAttended = typeBuckets.reduce((s, b) => s + b.fightsAttended, 0)
    const totalDodged = typeBuckets.reduce((s, b) => s + b.fightsDodged, 0)

    return {
      steamId: p.steamId,
      nickname: p.nickname,
      totalTeamfightsAttended: p.totalTeamfightsAttended,
      buckets: bucketMap,
      totalAttended,
      totalDodged,
      avgKills: weightedAvg(typeBuckets, 'avgKills'),
      avgDeaths: weightedAvg(typeBuckets, 'avgDeaths'),
      avgAssists: weightedAvg(typeBuckets, 'avgAssists'),
      avgNwAttended: weightedAvg(typeBuckets, 'avgInterpNwAttended'),
      avgNwDodged: weightedAvg(typeBuckets, 'avgInterpNwDodged'),
    }
  }).filter((r) => r.totalAttended + r.totalDodged > 0)
}

/* ── Columns ────────────────────────────────────────────── */

function makeColumns(fightType: string): ColumnDef<PlayerRow, unknown>[] {
  const fightLabel = FIGHT_TYPES.find((f) => f.id === fightType)?.label ?? fightType

  const cols: ColumnDef<PlayerRow, unknown>[] = [
    {
      id: 'nickname',
      accessorKey: 'nickname',
      header: 'Player',
      size: 160,
      enableSorting: false,
      cell: ({ row }) => <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />,
    },
    {
      id: 'totalTeamfightsAttended',
      accessorKey: 'totalTeamfightsAttended',
      header: 'Total TFs',
      size: 95,
      meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total teamfights attended across all fight types' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
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
          size: 75,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Total ${fightLabel.toLowerCase()}s attended` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
        },
        {
          id: 'attPct',
          accessorFn: (row) => {
            const total = row.totalAttended + row.totalDodged
            return total > 0 ? row.totalAttended / total : null
          },
          header: 'Att %',
          size: 78,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Attendance rate: attended / (attended + dodged) for ${fightLabel.toLowerCase()}s` },
          cell: ({ getValue }) => {
            const v = getValue() as number | null
            if (v == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            return <span>{(v * 100).toFixed(1)}%</span>
          },
        },
        {
          id: 'avgKills',
          accessorKey: 'avgKills',
          header: 'Avg K',
          size: 78,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Average kills per ${fightLabel.toLowerCase()} attended (weighted across all time buckets)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: 'avgDeaths',
          accessorKey: 'avgDeaths',
          header: 'Avg D',
          size: 78,
          meta: { numeric: true, heatmap: 'high-bad', tooltip: `Average deaths per ${fightLabel.toLowerCase()} attended (weighted across all time buckets)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: 'avgAssists',
          accessorKey: 'avgAssists',
          header: 'Avg A',
          size: 78,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Average assists per ${fightLabel.toLowerCase()} attended (weighted across all time buckets)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: 'avgNwAttended',
          accessorKey: 'avgNwAttended',
          header: 'NW Δ Att',
          size: 100,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Average interpolated net worth change when attending a ${fightLabel.toLowerCase()} (weighted)` },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
        },
        {
          id: 'avgNwDodged',
          accessorKey: 'avgNwDodged',
          header: 'NW Δ Dodge',
          size: 105,
          meta: { numeric: true, tooltip: `Average interpolated net worth change when dodging a ${fightLabel.toLowerCase()} (weighted)` },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
        },
        {
          id: 'avgAttDiff',
          accessorFn: (row) => {
            if (row.avgNwAttended == null || row.avgNwDodged == null) return null
            return row.avgNwAttended - row.avgNwDodged
          },
          header: 'Att Diff',
          size: 85,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `NW advantage of attending vs dodging: (NW Δ attend) − (NW Δ dodge), weighted across all time buckets` },
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
          size: 62,
          meta: { numeric: true, tooltip: `${fightLabel}s attended (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
        },
        {
          id: `k-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgKills ?? null,
          header: 'K',
          size: 58,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg kills (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: `d-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgDeaths ?? null,
          header: 'D',
          size: 58,
          meta: { numeric: true, heatmap: 'high-bad', tooltip: `Avg deaths (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: `a-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgAssists ?? null,
          header: 'A',
          size: 58,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg assists (${tb} min)` },
          cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={2} />,
        },
        {
          id: `nw-att-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgInterpNwAttended ?? null,
          header: 'NW Att',
          size: 78,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg NW change when attending (${tb} min)` },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
        },
        {
          id: `nw-dodge-${tb}`,
          accessorFn: (row) => row.buckets.get(tb)?.avgInterpNwDodged ?? null,
          header: 'NW Dodge',
          size: 85,
          meta: { numeric: true, tooltip: `Avg NW change when dodging (${tb} min)` },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
        },
        {
          id: `nw-diff-${tb}`,
          accessorFn: (row) => {
            const b = row.buckets.get(tb)
            if (!b || b.avgInterpNwAttended == null || b.avgInterpNwDodged == null) return null
            return b.avgInterpNwAttended - b.avgInterpNwDodged
          },
          header: 'Att Diff',
          size: 80,
          meta: { numeric: true, heatmap: 'high-good', tooltip: `NW advantage of attending vs dodging: (NW Δ attend) − (NW Δ dodge) (${tb} min)` },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={0} />,
        },
      ],
    })
  }

  return cols
}

/* ── Page ───────────────────────────────────────────────── */

export default function TeamfightPlayers() {
  const {
    filters, setFilters, clearFilters, applyDefaults,
    apiParams, hasFilters, filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { selected: fightType, setType } = useFightTypeToggle()

  const { data, isLoading, error } = useApiQuery<{ data: TeamfightOverviewPlayer[] }>(
    hasFilters ? '/api/teamfights/players' : null,
    apiParams,
  )

  const rows = useMemo(() => buildRows(data?.data ?? [], fightType), [data, fightType])
  const columns = useMemo(() => makeColumns(fightType), [fightType])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Player Teamfights</h1>
        <p className={styles.subtitle}>
          Per-player teamfight statistics broken down by fight type and game time
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'roles', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction', 'threshold']}
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

      {isLoading && <EnigmaLoader text="Fetching teamfight data..." />}

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
          searchableColumns={['nickname']}
          stickyColumns={1}
        />
      )}
    </div>
  )
}
