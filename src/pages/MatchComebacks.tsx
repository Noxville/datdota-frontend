import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { teamLogoUrl } from '../config'
import DataTable, { TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import TableSkeleton from '../components/TableSkeleton'
import PageMeta from '../components/PageMeta'
import type { ComebackLine, ComebacksResponse } from '../types'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Metric (tab) definitions ───────────────────────────── */

interface Metric {
  key: string // URL hash fragment
  dataKey: keyof ComebacksResponse
  tabLabel: string
  unit: string // value-column header suffix
  gold: boolean // k-format large values
  deficitTip: string
  subtitle: string
}

const METRICS: Metric[] = [
  {
    key: 'networth',
    dataKey: 'networth',
    tabLabel: 'Net Worth',
    unit: 'NW',
    gold: true,
    deficitTip: 'Net worth deficit overcome',
    subtitle: 'Largest net worth deficits ever overcome at any point during a pro match',
  },
  {
    key: 'kills',
    dataKey: 'killDeficit',
    tabLabel: 'Kill Deficit',
    unit: 'Kills',
    gold: false,
    deficitTip: 'Kill deficit overcome',
    subtitle: 'Largest kill deficits ever overcome at any point during a pro match',
  },
  {
    key: 'xp',
    dataKey: 'experience',
    tabLabel: 'Experience',
    unit: 'XP',
    gold: true,
    deficitTip: 'Experience deficit overcome',
    subtitle: 'Largest experience deficits ever overcome at any point during a pro match',
  },
]

/* ── Cells ──────────────────────────────────────────────── */

function ValueCell({ value, gold }: { value: number; gold: boolean }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const display = gold && Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString()
  return (
    <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }} title={value.toLocaleString()}>
      {display}
    </span>
  )
}

/* ── Columns ────────────────────────────────────────────── */

function buildColumns(metric: Metric): ColumnDef<ComebackLine, unknown>[] {
  return [
    {
      id: 'matchId',
      accessorKey: 'matchId',
      header: 'Match',
      size: 110,
      enableSorting: false,
      cell: ({ getValue }) => (
        <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
          {String(getValue())}
        </a>
      ),
    },
    {
      id: 'winner',
      accessorFn: (row) => row.winner.teamName,
      header: 'Winner',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell
          valveId={row.original.winner.valveId ?? 0}
          name={row.original.winner.teamName ?? 'Unknown'}
          logoUrl={teamLogoUrl(row.original.winner.logoId)}
        />
      ),
    },
    {
      id: 'loser',
      accessorFn: (row) => row.loser.teamName,
      header: 'Loser',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell
          valveId={row.original.loser.valveId ?? 0}
          name={row.original.loser.teamName ?? 'Unknown'}
          logoUrl={teamLogoUrl(row.original.loser.logoId)}
        />
      ),
    },
    {
      id: 'advantage',
      accessorKey: 'advantage',
      header: 'Deficit',
      size: 90,
      meta: { numeric: true, heatmap: 'high-good', tooltip: metric.deficitTip },
      cell: ({ getValue }) => <ValueCell value={getValue() as number} gold={metric.gold} />,
    },
    {
      id: 'winnerValue',
      accessorKey: 'winnerValue',
      header: `Winner ${metric.unit}`,
      size: 100,
      meta: { numeric: true, tooltip: `Winner's ${metric.unit} at the deepest point` },
      cell: ({ getValue }) => <ValueCell value={getValue() as number} gold={metric.gold} />,
    },
    {
      id: 'loserValue',
      accessorKey: 'loserValue',
      header: `Loser ${metric.unit}`,
      size: 100,
      meta: { numeric: true, tooltip: `Loser's ${metric.unit} at the deepest point` },
      cell: ({ getValue }) => <ValueCell value={getValue() as number} gold={metric.gold} />,
    },
    {
      id: 'time',
      accessorKey: 'time',
      header: 'At',
      size: 80,
      meta: { numeric: true, tooltip: 'Game time of peak deficit' },
      cell: ({ getValue }) => (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
      ),
    },
    {
      id: 'duration',
      accessorKey: 'duration',
      header: 'Duration',
      size: 90,
      meta: { numeric: true, tooltip: 'Total match duration' },
      cell: ({ getValue }) => (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
      ),
    },
    {
      id: 'deficitPct',
      accessorFn: (row) => {
        const total = row.winnerValue + row.loserValue
        return total > 0 ? row.advantage / total : 0
      },
      header: 'Deficit %',
      size: 90,
      meta: { numeric: true, heatmap: 'high-good', tooltip: `Deficit as % of combined ${metric.unit} at that point` },
      cell: ({ getValue }) => {
        const v = getValue() as number
        return (
          <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
            {(v * 100).toFixed(1)}%
          </span>
        )
      },
    },
  ]
}

/* ── Hash state ─────────────────────────────────────────── */

function getInitialKey(): string {
  const hash = window.location.hash.replace('#', '')
  if (METRICS.some((m) => m.key === hash)) return hash
  return METRICS[0].key
}

/* ── Page ───────────────────────────────────────────────── */

export default function MatchComebacks() {
  const [selectedKey, setSelectedKey] = useState(getInitialKey)
  const metric = METRICS.find((m) => m.key === selectedKey) ?? METRICS[0]

  const selectKey = useCallback((key: string) => {
    setSelectedKey(key)
    window.location.hash = `#${key}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '')
      if (METRICS.some((m) => m.key === hash)) setSelectedKey(hash)
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

  const { data, isLoading, error } = useApiQuery<{ data: ComebacksResponse }>(
    hasFilters ? '/api/matches/comebacks' : null,
    apiParams,
  )

  const columns = useMemo(() => buildColumns(metric), [metric])
  const rows = useMemo<ComebackLine[]>(() => data?.data?.[metric.dataKey] ?? [], [data, metric])

  return (
    <div className={styles.page}>
      <PageMeta
        title="Comebacks — Pro Dota 2"
        description="Biggest net worth, kill and experience deficits ever overcome in pro Dota 2 matches."
      />
      <div className={styles.header}>
        <h1>Comebacks</h1>
        <p className={styles.subtitle}>{metric.subtitle}</p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
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
        <div className={toggleStyles.toggleRow} style={{ flexWrap: 'wrap' }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              className={`${toggleStyles.toggleBtn} ${selectedKey === m.key ? toggleStyles.toggleActive : ''}`}
              onClick={() => selectKey(m.key)}
            >
              {m.tabLabel}
            </button>
          ))}
        </div>
      )}

      {isLoading && <TableSkeleton columns={columns} rows={15} loaderText="Fetching comebacks..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'advantage', desc: true }]}
          searchValue={(r) => [
            String(r.matchId),
            r.winner.teamName ?? '',
            String(r.winner.valveId ?? ''),
            r.loser.teamName ?? '',
            String(r.loser.valveId ?? ''),
          ].join(' ')}
        />
      )}

      {hasFilters && !isLoading && !error && data && rows.length === 0 && (
        <div className={styles.empty}>
          <p>No {metric.tabLabel.toLowerCase()} comebacks in the current filter set.</p>
        </div>
      )}
    </div>
  )
}
