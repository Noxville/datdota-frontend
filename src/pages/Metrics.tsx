import { useEffect, useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell } from '../components/DataTable'
import PageMeta from '../components/PageMeta'
import pageStyles from './PlayerPerformances.module.css'
import styles from './Metrics.module.css'

interface Profile {
  count: number
  avgMs: number
  p95Ms: number
  maxObservedMs: number
}

interface EndpointMetrics {
  hit: Profile
  miss: Profile
  nocache: Profile
}

interface MetricsResponse {
  data: {
    bucketMs: number
    bucketCount: number
    endpoints: Record<string, EndpointMetrics>
  }
}

type ProfileKey = 'hit' | 'miss' | 'nocache'

const POLL_OPTIONS: { label: string; ms: number | null }[] = [
  { label: 'Off', ms: null },
  { label: '15s', ms: 15000 },
  { label: '30s', ms: 30000 },
  { label: '60s', ms: 60000 },
]

interface Snapshot {
  ts: number
  endpoints: Record<string, EndpointMetrics>
}

interface ProfileCellData {
  count: number
  avgMs: number
  p95Ms: number
  maxObservedMs: number
  rps: number | null
  windowAvgMs: number | null
  changed: boolean
}

interface PivotRow {
  key: string
  total: number
  hitRate: number | null
  totalRps: number | null
  worstP95: number
  hit: ProfileCellData
  miss: ProfileCellData
  nocache: ProfileCellData
  // Bumps on every poll so per-cell flash animations restart on update.
  tick: number
}

function profileCellFrom(p: Profile, pp: Profile | undefined, dtSec: number): ProfileCellData {
  let rps: number | null = null
  let windowAvgMs: number | null = null
  let changed = false
  if (pp && dtSec > 0) {
    const deltaCount = p.count - pp.count
    if (deltaCount >= 0) {
      rps = deltaCount / dtSec
      if (deltaCount > 0) {
        const totalMsNew = p.avgMs * p.count
        const totalMsOld = pp.avgMs * pp.count
        windowAvgMs = (totalMsNew - totalMsOld) / deltaCount
      }
    }
    changed = p.count !== pp.count || p.avgMs !== pp.avgMs || p.p95Ms !== pp.p95Ms || p.maxObservedMs !== pp.maxObservedMs
  }
  return { count: p.count, avgMs: p.avgMs, p95Ms: p.p95Ms, maxObservedMs: p.maxObservedMs, rps, windowAvgMs, changed }
}

function buildRows(latest: Snapshot, prior: Snapshot | null): PivotRow[] {
  const dtSec = prior ? (latest.ts - prior.ts) / 1000 : 0
  const rows: PivotRow[] = []
  for (const [key, m] of Object.entries(latest.endpoints)) {
    const pp = prior?.endpoints[key]
    const hit = profileCellFrom(m.hit, pp?.hit, dtSec)
    const miss = profileCellFrom(m.miss, pp?.miss, dtSec)
    const nocache = profileCellFrom(m.nocache, pp?.nocache, dtSec)
    const total = hit.count + miss.count + nocache.count
    const cacheable = hit.count + miss.count
    const rpsParts = [hit.rps, miss.rps, nocache.rps].filter((r): r is number => r !== null)
    const totalRps = rpsParts.length > 0 ? rpsParts.reduce((s, r) => s + r, 0) : null
    rows.push({
      key,
      total,
      hitRate: cacheable > 0 ? hit.count / cacheable : null,
      totalRps,
      worstP95: Math.max(hit.p95Ms, miss.p95Ms, nocache.p95Ms),
      hit,
      miss,
      nocache,
      tick: latest.ts,
    })
  }
  return rows
}

function formatLatency(ms: number, capped: boolean): string {
  if (capped) return '≥10s'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}

function formatRps(v: number): string {
  if (v === 0) return '0'
  if (v < 0.01) return '<0.01'
  return v.toFixed(2)
}

const PROFILE_CLASS: Record<ProfileKey, string> = {
  hit: styles.profileCellHit,
  miss: styles.profileCellMiss,
  nocache: styles.profileCellNocache,
}

function ProfileCell({ data, profile, tick }: { data: ProfileCellData; profile: ProfileKey; tick: number }) {
  if (data.count === 0) {
    return <div className={styles.profileEmpty}>—</div>
  }
  const maxCapped = data.maxObservedMs >= 10000
  // Key forces remount so the flash keyframe restarts whenever a poll arrives that changed this cell.
  const flashKey = data.changed ? `${tick}` : 'stable'
  return (
    <div
      key={flashKey}
      className={`${styles.profileCell} ${PROFILE_CLASS[profile]} ${data.changed ? styles.profileCellChanged : ''}`}
    >
      <div className={styles.profileLeft}>
        <span className={styles.profileCount} title={`${data.count.toLocaleString()} cumulative requests`}>
          {data.count.toLocaleString()}
        </span>
        <span className={styles.profileRps}>
          {data.rps === null ? '—' : `${formatRps(data.rps)} rps`}
        </span>
      </div>
      <div className={styles.profileMetrics}>
        <div className={styles.profileMetric}>
          <span className={styles.profileMetricLabel}>avg</span>
          <span
            className={styles.profileMetricValue}
            title={data.windowAvgMs !== null ? `window avg: ${data.windowAvgMs.toFixed(1)} ms` : `cumulative avg: ${data.avgMs.toFixed(2)} ms`}
          >
            {formatLatency(data.windowAvgMs ?? data.avgMs, false)}
          </span>
        </div>
        <div className={styles.profileMetric}>
          <span className={styles.profileMetricLabel}>p95</span>
          <span className={styles.profileMetricValue} title={`cumulative p95: ${data.p95Ms.toFixed(0)} ms`}>
            {formatLatency(data.p95Ms, false)}
          </span>
        </div>
        <div className={styles.profileMetric}>
          <span className={styles.profileMetricLabel}>max</span>
          <span
            className={styles.profileMetricValue}
            title={`max observed: ${data.maxObservedMs.toFixed(0)} ms${maxCapped ? ' (overflow bucket)' : ''}`}
          >
            {formatLatency(data.maxObservedMs, maxCapped)}
          </span>
        </div>
      </div>
    </div>
  )
}

const columns: ColumnDef<PivotRow, unknown>[] = [
  {
    id: 'key',
    accessorKey: 'key',
    header: 'Endpoint',
    size: 170,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
        {String(getValue())}
      </span>
    ),
  },
  {
    id: 'total',
    accessorKey: 'total',
    header: 'Total',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Cumulative requests across all three profiles' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
  },
  {
    id: 'hitRate',
    accessorKey: 'hitRate',
    header: 'Hit %',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'hit / (hit + miss)' },
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return (
        <span style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
          {(v * 100).toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: 'totalRps',
    accessorKey: 'totalRps',
    header: 'RPS',
    size: 60,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Requests per second across all profiles, over last window' },
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (v === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return (
        <span style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
          {formatRps(v)}
        </span>
      )
    },
  },
  {
    id: 'worstP95',
    accessorKey: 'worstP95',
    header: 'Worst p95',
    size: 75,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Largest p95 across the three profiles' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      if (v === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return (
        <span style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
          {formatLatency(v, false)}
        </span>
      )
    },
  },
  {
    id: 'nocache',
    header: 'Nocache',
    accessorFn: (row) => row.nocache.count,
    size: 290,
    meta: { grow: true, numeric: true, tooltip: 'Nocache request count' },
    cell: ({ row }) => <ProfileCell data={row.original.nocache} profile="nocache" tick={row.original.tick} />,
  },
  {
    id: 'miss',
    header: 'Miss',
    accessorFn: (row) => row.miss.count,
    size: 290,
    meta: { grow: true, numeric: true, tooltip: 'Miss request count' },
    cell: ({ row }) => <ProfileCell data={row.original.miss} profile="miss" tick={row.original.tick} />,
  },
  {
    id: 'hit',
    header: 'Hit',
    accessorFn: (row) => row.hit.count,
    size: 290,
    meta: { grow: true, numeric: true, tooltip: 'Hit request count' },
    cell: ({ row }) => <ProfileCell data={row.original.hit} profile="hit" tick={row.original.tick} />,
  },
]

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 140,
        padding: '12px 16px',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

export default function Metrics() {
  const [pollMs, setPollMs] = useState<number | null>(30000)
  const [snapshots, setSnapshots] = useState<{ latest: Snapshot | null; prior: Snapshot | null }>({
    latest: null,
    prior: null,
  })

  const { data, isLoading, error, refetch, isFetching } = useApiQuery<MetricsResponse>(
    '/api/internal/metrics',
    undefined,
    {
      staleTime: 0,
      refetchInterval: pollMs ?? false,
      refetchIntervalInBackground: false,
    },
  )

  const endpoints = data?.data.endpoints
  const bucketMs = data?.data.bucketMs
  const bucketCount = data?.data.bucketCount

  useEffect(() => {
    if (!endpoints) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshots((s) => {
      if (s.latest?.endpoints === endpoints) return s
      return { prior: s.latest, latest: { ts: Date.now(), endpoints } }
    })
  }, [endpoints])

  const latest = snapshots.latest
  const prior = snapshots.prior

  const rows = useMemo(() => {
    if (!latest) return []
    return buildRows(latest, prior)
  }, [latest, prior])

  const summary = useMemo(() => {
    if (rows.length === 0) return null
    let hit = 0, miss = 0, nocache = 0
    let rpsTotal = 0
    let hasRps = false
    for (const r of rows) {
      hit += r.hit.count
      miss += r.miss.count
      nocache += r.nocache.count
      if (r.totalRps !== null) { rpsTotal += r.totalRps; hasRps = true }
    }
    const total = hit + miss + nocache
    const cacheable = hit + miss
    return {
      total,
      hit,
      miss,
      nocache,
      hitRate: cacheable > 0 ? hit / cacheable : null,
      rps: hasRps ? rpsTotal : null,
      endpointCount: rows.length,
    }
  }, [rows])

  const snapshotTs = latest?.ts ?? null

  return (
    <div className={pageStyles.page}>
      <PageMeta title="Internal Metrics" description="Internal API latency metrics." noindex />
      <div className={pageStyles.header}>
        <h1>API Metrics</h1>
        <p className={pageStyles.subtitle}>
          Cumulative latency profiles per endpoint since process start. Rates and windowed averages are computed by diffing successive polls.
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Refresh
        </span>
        <div style={{ display: 'inline-flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {POLL_OPTIONS.map((opt) => {
            const active = pollMs === opt.ms
            return (
              <button
                key={opt.label}
                onClick={() => setPollMs(opt.ms)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  background: active ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                  color: active ? 'var(--color-bg-deep)' : 'var(--color-text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            padding: '5px 12px',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            cursor: isFetching ? 'wait' : 'pointer',
            opacity: isFetching ? 0.6 : 1,
          }}
        >
          {isFetching ? 'Refreshing…' : 'Refresh now'}
        </button>
        {snapshotTs && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            last: {new Date(snapshotTs).toLocaleTimeString()}
          </span>
        )}
        {bucketMs && bucketCount && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            histogram: {bucketMs}ms × {bucketCount} buckets ({(bucketMs * bucketCount) / 1000}s cap)
          </span>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <SummaryCard label="Endpoints" value={summary.endpointCount.toString()} />
          <SummaryCard label="Total Requests" value={summary.total.toLocaleString()} hint="cumulative since start" />
          <SummaryCard
            label="Hit / Miss / Nocache"
            value={`${summary.hit.toLocaleString()} / ${summary.miss.toLocaleString()} / ${summary.nocache.toLocaleString()}`}
          />
          <SummaryCard
            label="Cache Hit Rate"
            value={summary.hitRate === null ? '—' : `${(summary.hitRate * 100).toFixed(1)}%`}
            hint="hit / (hit + miss)"
          />
          <SummaryCard
            label="Total RPS"
            value={summary.rps === null ? '—' : summary.rps.toFixed(2)}
            hint="across last poll window"
          />
        </div>
      )}

      {isLoading && (
        <div style={{ padding: 24, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading metrics…</div>
      )}

      {error && (
        <div className={pageStyles.error}>
          Failed to load metrics. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <div className={styles.fullBleed}>
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'total', desc: true }]}
            searchableColumns={['key']}
            rowHeight={48}
          />
        </div>
      )}
    </div>
  )
}
