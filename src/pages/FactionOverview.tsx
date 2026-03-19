import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

interface PatchTeamFA {
  teamName: string | null
  teamId: number | null
  patchName: string | null
  radFirstPick: boolean | null
  faction: string | null
  shift: number
  percent: number
  games: number
  wins: number | null
  radiantWins: number
}

interface FactionData {
  patchAdvantage: PatchTeamFA[]
  patchPickAdvantage: PatchTeamFA[]
  patchTeamAdvantage: PatchTeamFA[]
}

// Faction-Priority table: faction + first pick cross
interface FactionPickRow {
  faction: string
  firstPick: boolean
  shift: number
  percent: number
  games: number
  record: string
}

const factionPickColumns: ColumnDef<FactionPickRow, unknown>[] = [
  {
    id: 'faction',
    accessorKey: 'faction',
    header: 'Faction',
    size: 100,
    meta: { tooltip: 'Radiant or Dire' },
    cell: ({ getValue }) => (
      <span style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: (getValue() as string) === 'Radiant' ? 'var(--color-win)' : 'var(--color-loss)',
      }}>
        {getValue() as string}
      </span>
    ),
  },
  {
    id: 'firstPick',
    accessorFn: (row) => row.firstPick ? 'Yes' : 'No',
    header: 'First Pick?',
    size: 90,
    meta: { tooltip: 'Does this faction have first pick?' },
  },
  {
    id: 'eloShift',
    accessorKey: 'shift',
    header: 'Elo Shift',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Average Elo shift towards this faction' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
        }}>
          {v > 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      )
    },
  },
  {
    id: 'winDelta',
    accessorKey: 'percent',
    header: 'Win% Delta',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Normalized win percentage shift' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
        }}>
          {v > 0 ? '+' : ''}{(v * 100).toFixed(2)}%
        </span>
      )
    },
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'record',
    accessorKey: 'record',
    header: 'Record',
    size: 80,
    meta: { tooltip: 'Win-Loss record for this faction' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
        {getValue() as string}
      </span>
    ),
  },
]

// Patch shifts table
interface PatchShiftRow {
  patch: string
  shift: number
  percent: number
  games: number
}

const patchShiftColumns: ColumnDef<PatchShiftRow, unknown>[] = [
  {
    id: 'patch',
    accessorKey: 'patch',
    header: 'Patch',
    size: 80,
    meta: { tooltip: 'Game patch version' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
        {getValue() as string}
      </span>
    ),
  },
  {
    id: 'eloShift',
    accessorKey: 'shift',
    header: 'Elo Shift',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Average Elo shift towards Radiant (positive = Radiant favored)' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
        }}>
          {v > 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      )
    },
  },
  {
    id: 'winDelta',
    accessorKey: 'percent',
    header: 'Win% Delta',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Normalized win percentage shift towards Radiant' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
        }}>
          {v > 0 ? '+' : ''}{(v * 100).toFixed(2)}%
        </span>
      )
    },
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Number of games in this patch' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

// Team-patch table
interface TeamPatchRow {
  teamName: string
  teamId: number
  patch: string
  shift: number
  percent: number
  games: number
  wins: number
  rawWinPct: number
  droop: number
}

const teamPatchColumns: ColumnDef<TeamPatchRow, unknown>[] = [
  {
    id: 'team',
    accessorKey: 'teamName',
    header: 'Team',
    size: 160,
    meta: { tooltip: 'Team name' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        {getValue() as string}
      </span>
    ),
  },
  {
    id: 'patch',
    accessorKey: 'patch',
    header: 'Patch',
    size: 70,
    meta: { tooltip: 'Game patch version' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
        {getValue() as string}
      </span>
    ),
  },
  {
    id: 'eloShift',
    accessorKey: 'shift',
    header: 'Elo Shift',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Average Elo shift towards Radiant for this team' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
        }}>
          {v > 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      )
    },
  },
  {
    id: 'winDelta',
    accessorKey: 'percent',
    header: 'Win% Delta',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Normalized win percentage shift' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          color: v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
        }}>
          {v > 0 ? '+' : ''}{(v * 100).toFixed(2)}%
        </span>
      )
    },
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'Wins',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Games won on Radiant' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'rawWinPct',
    accessorKey: 'rawWinPct',
    header: 'Raw Win%',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Raw win percentage on Radiant' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'droop',
    accessorKey: 'droop',
    header: 'Droop',
    size: 75,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Raw win% minus expected normalized win%. Higher = opponents were weaker on average' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return (
        <span style={{
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
          color: v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)',
        }}>
          {v > 0 ? '+' : ''}{(v * 100).toFixed(2)}%
        </span>
      )
    },
  },
]

export default function FactionOverview() {
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

  const { data, isLoading, error } = useApiQuery<{ data: FactionData }>(
    hasFilters ? '/api/factions/overviews' : null,
    apiParams,
  )

  // Transform patchPickAdvantage into displayable rows
  const factionPickRows = useMemo<FactionPickRow[]>(() => {
    if (!data?.data?.patchPickAdvantage) return []
    return data.data.patchPickAdvantage.map((ppa) => {
      const isRadiant = ppa.faction === 'radiant'
      const sign = isRadiant ? 1 : -1
      const direWins = ppa.games - ppa.radiantWins
      const factionWins = isRadiant ? ppa.radiantWins : direWins
      const factionLosses = ppa.games - factionWins
      const hasFirstPick = isRadiant === ppa.radFirstPick
      return {
        faction: isRadiant ? 'Radiant' : 'Dire',
        firstPick: hasFirstPick,
        shift: sign * ppa.shift,
        percent: sign * ppa.percent,
        games: ppa.games,
        record: `${factionWins}-${factionLosses}`,
      }
    })
  }, [data])

  // Patch shifts
  const patchShiftRows = useMemo<PatchShiftRow[]>(() => {
    if (!data?.data?.patchAdvantage) return []
    return data.data.patchAdvantage.map((pa) => ({
      patch: pa.patchName ?? '?',
      shift: pa.shift,
      percent: pa.percent,
      games: pa.games,
    }))
  }, [data])

  // Team-patch shifts
  const teamPatchRows = useMemo<TeamPatchRow[]>(() => {
    if (!data?.data?.patchTeamAdvantage) return []
    return data.data.patchTeamAdvantage.map((pta) => {
      const rawWinPct = pta.games > 0 ? (pta.wins ?? 0) / pta.games : 0
      return {
        teamName: pta.teamName ?? 'Unknown',
        teamId: pta.teamId ?? 0,
        patch: pta.patchName ?? '?',
        shift: pta.shift,
        percent: pta.percent,
        games: pta.games,
        wins: pta.wins ?? 0,
        rawWinPct,
        droop: rawWinPct - 0.5 - pta.percent,
      }
    })
  }, [data])

  const hasData = factionPickRows.length > 0 || patchShiftRows.length > 0 || teamPatchRows.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Faction Summary</h1>
        <p className={styles.subtitle}>
          Radiant vs Dire advantage analysis across patches and teams
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching faction data..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {hasData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {factionPickRows.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: 12, color: 'var(--color-text-secondary)' }}>
                  Faction-Priority Shifts
                </h3>
                <DataTable
                  data={factionPickRows}
                  columns={factionPickColumns}
                  defaultSorting={[{ id: 'eloShift', desc: true }]}
                />
              </div>
            )}

            {patchShiftRows.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: 12, color: 'var(--color-text-secondary)' }}>
                  Patch Shifts
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                  Positive values = Radiant favored
                </p>
                <DataTable
                  data={patchShiftRows}
                  columns={patchShiftColumns}
                  defaultSorting={[{ id: 'eloShift', desc: true }]}
                />
              </div>
            )}
          </div>

          {teamPatchRows.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: 4, color: 'var(--color-text-secondary)' }}>
                Team-Patch Shifts
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
                Threshold filter only applies to this table
              </p>
              <DataTable
                data={teamPatchRows}
                columns={teamPatchColumns}
                defaultSorting={[{ id: 'eloShift', desc: true }]}
                searchableColumns={['team']}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
