import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { teamLogoUrl } from '../config'
import { patches } from '../data/patches'
import DataTable, { NumericCell, PercentCell, TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import type { TeamRecordsResponse, TeamRecordSingleMatch, TeamRecordAggregate } from '../types'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Record definitions ────────────────────────────────── */

interface RecordSection {
  key: string
  title: string
  /** Paired single-match per-minute variant (best per-min in any one match) */
  perMinKey?: string
  /** Paired multi-match average aggregate (career) */
  avgKey?: string
  /** Single-match record where opponent is part of the metric (diffs/margins) */
  diff?: boolean
  /** Aggregate-only sections (no single-match equivalent) */
  aggregateOnly?: 'winrate' | 'average'
  /** How to format the primary value */
  decimals?: number
}

const RECORD_SECTIONS: RecordSection[] = [
  { key: 'team_kills', title: 'Kills', perMinKey: 'team_kills_per_min' },
  { key: 'team_assists', title: 'Assists', perMinKey: 'team_assists_per_min' },
  { key: 'team_deaths', title: 'Deaths', perMinKey: 'team_deaths_per_min' },
  { key: 'team_last_hits', title: 'Last Hits', perMinKey: 'team_last_hits_per_min' },
  { key: 'team_hero_damage', title: 'Hero Damage', perMinKey: 'team_hero_damage_per_min' },
  { key: 'team_tower_damage', title: 'Tower Damage', perMinKey: 'team_tower_damage_per_min' },
  { key: 'team_hero_healing', title: 'Hero Healing', perMinKey: 'team_hero_healing_per_min' },
  { key: 'team_networth', title: 'Net Worth', avgKey: 'avg_team_networth' },
  { key: 'team_gpm', title: 'GPM' },
  { key: 'team_xpm', title: 'XPM' },
  { key: 'team_denies', title: 'Denies' },
  { key: 'team_gold', title: 'Gold' },
  { key: 'team_gold_spent', title: 'Gold Spent' },
  { key: 'hero_damage_gap', title: 'Hero Damage Gap', diff: true },
  { key: 'tower_damage_gap', title: 'Tower Damage Gap', diff: true },
  { key: 'kill_margin', title: 'Kill Margin', diff: true },
  { key: 'best_winrate', title: 'Best Winrate', aggregateOnly: 'winrate' },
]

/* ── Helpers ────────────────────────────────────────────── */

function patchFromMatchId(matchId: number): string {
  for (const p of patches) {
    const pd = p as unknown as { name: string; lowerBound: number; upperBound: number }
    if (matchId >= pd.lowerBound && matchId <= pd.upperBound) return pd.name
  }
  return '—'
}

function logoUrlOrUndefined(logoId: string | null): string | undefined {
  return logoId ? teamLogoUrl(logoId) : undefined
}

/* ── Columns ────────────────────────────────────────────── */

function singleMatchColumns(opts: { decimals: number; showOpponent: boolean }): ColumnDef<TeamRecordSingleMatch, unknown>[] {
  const cols: ColumnDef<TeamRecordSingleMatch, unknown>[] = [
    {
      id: 'team',
      accessorFn: (row) => row.teamName,
      header: 'Team',
      size: 170,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell valveId={row.original.valveId} name={row.original.teamName} logoUrl={logoUrlOrUndefined(row.original.logoId)} />
      ),
    },
    {
      id: 'value',
      accessorKey: 'value',
      header: 'Value',
      size: 90,
      meta: { numeric: true, heatmap: 'high-good', tooltip: 'Record Value' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={opts.decimals} />,
    },
  ]

  if (opts.showOpponent) {
    cols.push({
      id: 'opponent',
      accessorFn: (row) => row.opponentTeamName ?? '',
      header: 'Opponent',
      size: 150,
      enableSorting: false,
      cell: ({ row }) => {
        const oid = row.original.opponentValveId
        const oname = row.original.opponentTeamName
        if (!oid || !oname) return <span className={styles.muted}>—</span>
        return <TeamCell valveId={oid} name={oname} logoUrl={logoUrlOrUndefined(row.original.opponentLogoId)} />
      },
    })
  }

  cols.push(
    {
      id: 'patch',
      accessorFn: (row) => patchFromMatchId(row.matchId),
      header: 'Patch',
      size: 70,
      cell: ({ getValue }) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{getValue() as string}</span>
      ),
    },
    {
      id: 'matchId',
      accessorKey: 'matchId',
      header: 'Match',
      size: 110,
      cell: ({ getValue }) => (
        <a
          href={`/matches/${getValue()}`}
          style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
        >
          {getValue() as number}
        </a>
      ),
    },
  )

  return cols
}

function aggregateColumns(kind: 'winrate' | 'average'): ColumnDef<TeamRecordAggregate, unknown>[] {
  const valueHeader = kind === 'winrate' ? 'Winrate' : 'Average'
  const valueCell = kind === 'winrate'
    ? ({ getValue }: { getValue: () => unknown }) => <PercentCell value={getValue() as number} decimals={1} />
    : ({ getValue }: { getValue: () => unknown }) => <NumericCell value={getValue() as number} decimals={0} />

  return [
    {
      id: 'team',
      accessorFn: (row) => row.teamName,
      header: 'Team',
      size: 170,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell valveId={row.original.valveId} name={row.original.teamName} logoUrl={logoUrlOrUndefined(row.original.logoId)} />
      ),
    },
    {
      id: 'value',
      accessorKey: 'value',
      header: valueHeader,
      size: 90,
      meta: { numeric: true, heatmap: 'high-good', tooltip: valueHeader },
      cell: valueCell,
    },
    {
      id: 'gameCount',
      accessorKey: 'numGames',
      header: 'Games',
      size: 80,
      meta: { numeric: true },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    },
  ]
}

/* ── Hash state ─────────────────────────────────────────── */

function getInitialKey(): string {
  const hash = window.location.hash.replace('#', '')
  if (RECORD_SECTIONS.some((s) => s.key === hash)) return hash
  return RECORD_SECTIONS[0].key
}

/* ── Page ───────────────────────────────────────────────── */

export default function TeamRecords() {
  const [selectedKey, setSelectedKey] = useState(getInitialKey)
  const section = RECORD_SECTIONS.find((s) => s.key === selectedKey) ?? RECORD_SECTIONS[0]

  const selectKey = useCallback((key: string) => {
    setSelectedKey(key)
    window.location.hash = `#${key}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '')
      if (RECORD_SECTIONS.some((s) => s.key === hash)) setSelectedKey(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const {
    filters, setFilters, clearFilters, applyDefaults,
    apiParams, hasFilters, filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: TeamRecordsResponse }>(
    hasFilters ? '/api/teams/records' : null,
    apiParams,
  )

  const records = data?.data ?? null

  const primaryRows: TeamRecordSingleMatch[] = useMemo(() => {
    if (!records || section.aggregateOnly) return []
    return (records[section.key] ?? []) as TeamRecordSingleMatch[]
  }, [records, section])

  const perMinRows: TeamRecordSingleMatch[] = useMemo(() => {
    if (!records || !section.perMinKey) return []
    return (records[section.perMinKey] ?? []) as TeamRecordSingleMatch[]
  }, [records, section])

  const avgRows: TeamRecordAggregate[] = useMemo(() => {
    if (!records || !section.avgKey) return []
    return (records[section.avgKey] ?? []) as TeamRecordAggregate[]
  }, [records, section])

  const aggregateOnlyRows: TeamRecordAggregate[] = useMemo(() => {
    if (!records || !section.aggregateOnly) return []
    return (records[section.key] ?? []) as TeamRecordAggregate[]
  }, [records, section])

  const primaryCols = useMemo(
    () => singleMatchColumns({ decimals: 0, showOpponent: !!section.diff }),
    [section],
  )
  const perMinCols = useMemo(
    () => singleMatchColumns({ decimals: 2, showOpponent: false }),
    [],
  )
  const avgCols = useMemo(() => aggregateColumns('average'), [])
  const aggregateOnlyCols = useMemo(
    () => aggregateColumns(section.aggregateOnly ?? 'average'),
    [section],
  )

  return (
    <div className={styles.page}>
      <PageMeta title="Team Records — Pro Dota 2 All-Time" description="All-time pro Dota 2 team records — most team kills, biggest hero damage gap, highest team GPM and more." />
      <div className={styles.header}>
        <h1>Team Records</h1>
        <p className={styles.subtitle}>
          All-time single-match records and per-team career aggregates in tier 1–2 matches
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

      {isLoading && <EnigmaLoader text="Fetching records..." />}

      {error && (
        <ErrorState
          message="Failed to load records"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {records && (
        <>
          <div className={toggleStyles.toggleRow} style={{ flexWrap: 'wrap' }}>
            {RECORD_SECTIONS.map((s) => (
              <button
                key={s.key}
                className={`${toggleStyles.toggleBtn} ${selectedKey === s.key ? toggleStyles.toggleActive : ''}`}
                onClick={() => selectKey(s.key)}
              >
                {s.title}
              </button>
            ))}
          </div>

          {section.aggregateOnly ? (
            aggregateOnlyRows.length > 0 && (
              <DataTable
                data={aggregateOnlyRows}
                columns={aggregateOnlyCols}
                defaultSorting={[{ id: 'value', desc: true }]}
                searchableColumns={['team']}
              />
            )
          ) : section.perMinKey ? (
            <PairedTables
              left={{ title: 'Most in a Match', rows: primaryRows, cols: primaryCols }}
              right={{ title: 'Highest Per Minute (Single Match)', rows: perMinRows, cols: perMinCols }}
            />
          ) : section.avgKey ? (
            <PairedTables
              left={{ title: 'Most in a Match', rows: primaryRows, cols: primaryCols }}
              right={{ title: 'Highest Career Average', rows: avgRows, cols: avgCols }}
            />
          ) : (
            primaryRows.length > 0 && (
              <DataTable
                data={primaryRows}
                columns={primaryCols}
                defaultSorting={[{ id: 'value', desc: true }]}
                searchableColumns={['team']}
              />
            )
          )}
        </>
      )}
    </div>
  )
}

/* ── Paired tables side-by-side ─────────────────────────── */

interface PairedTableSide<T> {
  title: string
  rows: T[]
  cols: ColumnDef<T, unknown>[]
}

function PairedTables<L extends object, R extends object>({
  left, right,
}: {
  left: PairedTableSide<L>
  right: PairedTableSide<R>
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', alignItems: 'start' }}>
      <div>
        <SectionHeading text={left.title} />
        {left.rows.length > 0 && (
          <DataTable
            data={left.rows}
            columns={left.cols}
            defaultSorting={[{ id: 'value', desc: true }]}
            searchableColumns={['team']}
          />
        )}
      </div>
      <div>
        <SectionHeading text={right.title} />
        {right.rows.length > 0 && (
          <DataTable
            data={right.rows}
            columns={right.cols}
            defaultSorting={[{ id: 'value', desc: true }]}
            searchableColumns={['team']}
          />
        )}
      </div>
    </div>
  )
}

function SectionHeading({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--font-weight-bold)' as unknown as number,
      fontSize: '0.65rem',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      color: 'var(--color-primary-dim)',
      marginBottom: 'var(--space-sm)',
      paddingBottom: 4,
      borderBottom: '1px solid var(--color-border)',
    }}>
      {text}
    </div>
  )
}
