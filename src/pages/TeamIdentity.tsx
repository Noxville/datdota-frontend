import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell, TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { itemImageUrl, teamLogoUrl } from '../config'
import type { TeamIdentityLine } from '../types'
import styles from './PlayerPerformances.module.css'

const ITEMS: { key: string; label: string; shortName: string }[] = [
  { key: 'blink', label: 'Blink', shortName: 'item_blink' },
  { key: 'bkb', label: 'BKB', shortName: 'item_black_king_bar' },
  { key: 'pipe', label: 'Pipe', shortName: 'item_pipe' },
  { key: 'crimson', label: 'Crimson', shortName: 'item_crimson_guard' },
  { key: 'lotus', label: 'Lotus', shortName: 'item_lotus_orb' },
  { key: 'travels', label: 'Travels', shortName: 'item_travel_boots' },
]

function ItemHeader({ label, shortName }: { label: string; shortName: string }) {
  return (
    <span
      title={label}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <img
        src={itemImageUrl(shortName)}
        alt={label}
        width={28}
        height={20}
        style={{ borderRadius: 2, verticalAlign: 'middle' }}
      />
    </span>
  )
}

function BigNumberCell({ value, decimals = 0 }: { value: number | null; decimals?: number }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const display = Math.abs(value) >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toFixed(decimals)
  return (
    <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }} title={value.toLocaleString(undefined, { maximumFractionDigits: 2 })}>
      {display}
    </span>
  )
}

function SignedCell({ value, decimals = 0 }: { value: number | null; decimals?: number }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const positive = value >= 0
  const color = positive ? 'var(--color-accent-bright)' : '#ff6b8a'
  const sign = positive ? '+' : ''
  return (
    <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color }}>
      {sign}{value.toFixed(decimals)}
    </span>
  )
}

const columns: ColumnDef<TeamIdentityLine, unknown>[] = [
  {
    id: 'team',
    accessorFn: (row) => row.team.name,
    header: 'Team',
    size: 163,
    enableSorting: false,
    cell: ({ row }) => {
      const t = row.original.team
      return <TeamCell valveId={t.valveId} name={t.name} logoUrl={t.logoId ? teamLogoUrl(String(t.logoId)) : undefined} />
    },
  },
  {
    id: 'numGames',
    accessorKey: 'numGames',
    header: 'Games',
    size: 68,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'tempo',
    header: 'Tempo',
    columns: [
      {
        id: 'firstBloodRate',
        accessorKey: 'firstBloodRate',
        header: 'FB %',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'First Blood Rate' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number | null} decimals={0} />,
      },
      {
        id: 'nwDiffAt10',
        accessorKey: 'nwDiffAt10',
        header: 'NW@10',
        size: 78,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Net Worth Differential at 10 min' },
        cell: ({ getValue }) => <SignedCell value={getValue() as number | null} />,
      },
      {
        id: 'roshBy30Rate',
        accessorKey: 'roshBy30Rate',
        header: 'Rosh<30',
        size: 78,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Games with a Roshan kill before 30 min' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number | null} decimals={0} />,
      },
      {
        id: 'playersPerKill',
        accessorKey: 'playersPerKill',
        header: 'PPK',
        size: 68,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Players per Kill — (kills + assists) / kills. Lower = more solo kills.' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={2} />,
      },
    ],
  },
  {
    id: 'kills',
    header: 'Kills',
    columns: [
      {
        id: 'kills0to10',
        accessorKey: 'kills0to10',
        header: '0–10',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Team kills in first 10 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
      {
        id: 'kills10to20',
        accessorKey: 'kills10to20',
        header: '10–20',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Team kills from 10–20 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
      {
        id: 'kills20to30',
        accessorKey: 'kills20to30',
        header: '20–30',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Team kills from 20–30 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
    ],
  },
  {
    id: 'pushing',
    header: 'Pushing',
    columns: [
      {
        id: 'buildingDamageAt10',
        accessorKey: 'buildingDamageAt10',
        header: 'B@10',
        size: 78,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg building damage by 10 min' },
        cell: ({ getValue }) => <BigNumberCell value={getValue() as number | null} />,
      },
      {
        id: 'buildingDamageAt20',
        accessorKey: 'buildingDamageAt20',
        header: 'B@20',
        size: 78,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg building damage by 20 min' },
        cell: ({ getValue }) => <BigNumberCell value={getValue() as number | null} />,
      },
    ],
  },
  {
    id: 'vision',
    header: 'Vision',
    columns: [
      {
        id: 'obsAt20',
        accessorKey: 'obsAt20',
        header: 'Obs@20',
        size: 78,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg observer wards placed by 20 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
      {
        id: 'sentriesAt20',
        accessorKey: 'sentriesAt20',
        header: 'Sen@20',
        size: 78,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Avg sentry wards placed by 20 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
    ],
  },
  {
    id: 'smokes',
    header: 'Smokes',
    columns: [
      {
        id: 'smokes0to10',
        accessorKey: 'smokes0to10',
        header: '0–10',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Smokes used 0–10 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={2} />,
      },
      {
        id: 'smokes10to20',
        accessorKey: 'smokes10to20',
        header: '10–20',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Smokes used 10–20 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={2} />,
      },
      {
        id: 'smokes20to30',
        accessorKey: 'smokes20to30',
        header: '20–30',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Smokes used 20–30 min' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={2} />,
      },
    ],
  },
  {
    id: 'neutrals',
    header: 'Map',
    columns: [
      {
        id: 'campsStackedPerGame',
        accessorKey: 'campsStackedPerGame',
        header: 'Stacks',
        size: 73,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Camps stacked per game' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
      {
        id: 'jungleLhShare',
        accessorKey: 'jungleLhShare',
        header: 'Jungle',
        size: 73,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Share of last hits from jungle creeps' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number | null} decimals={0} />,
      },
      {
        id: 'tormentorsPerGame',
        accessorKey: 'tormentorsPerGame',
        header: 'Torm',
        size: 63,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Tormentors killed per game' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
      {
        id: 'watchersPerGame',
        accessorKey: 'watchersPerGame',
        header: 'Watch',
        size: 68,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Watchers taken per game' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
      },
      {
        id: 'stunsPerGame',
        accessorKey: 'stunsPerGame',
        header: 'Stuns',
        size: 73,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Seconds of stun inflicted per game' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={0} />,
      },
    ],
  },
  {
    id: 'items',
    header: 'Avg Items / Game',
    columns: ITEMS.map((item) => ({
      id: `item_${item.key}`,
      accessorFn: (row: TeamIdentityLine) => row.itemAvg?.[item.key] ?? null,
      header: () => <ItemHeader label={item.label} shortName={item.shortName} />,
      size: 55,
      meta: { numeric: true, heatmap: 'high-good', tooltip: `Avg ${item.label} purchases per game` },
      cell: ({ getValue }: { getValue: () => unknown }) => (
        <NumericCell value={getValue() as number | null} decimals={2} />
      ),
    })),
  },
]

export default function TeamIdentity() {
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

  const { data, isLoading, error } = useApiQuery<{ data: TeamIdentityLine[] }>(
    hasFilters ? '/api/teams/identity' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team Identity</h1>
        <p className={styles.subtitle}>
          Signature stats per team — tempo, vision, pushing, farm patterns and key item buys
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

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching team identity..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'numGames', desc: true }]}
          searchableColumns={['team']}
          stickyColumns={1}
        />
      )}
    </div>
  )
}
