import { useMemo, useState, useEffect, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import TableSkeleton from '../components/TableSkeleton'
import PageMeta from '../components/PageMeta'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

interface SeriesOutcomeRow {
  pattern: string
  count: number
}

/* ── Series-format inference ─────────────────────────────

   The API only gives the win/loss sequence, not the format. We narrow it:
   - Bo1: a single game.
   - Bo2: two games always played (a 1–1 split can ONLY be a Bo2).
   - First-to-K formats (Bo3 = first-to-2, Bo5 = first-to-3, Bo7 = first-to-4):
     valid when the leader reaches exactly K wins on the final game.
   - A 2–0 / 0–2 could be a completed Bo2 OR a Bo3 sweep → "Bo2/Bo3".
   - Bo4 (and other even "always-play-N") formats are excluded — they're
     vanishingly rare, so e.g. WLLL is reported as Bo5 rather than Bo4.
*/
function inferFormat(pattern: string, wins: number, losses: number): string {
  const g = pattern.length
  const hi = Math.max(wins, losses)
  const lo = Math.min(wins, losses)
  const leaderChar = wins >= losses ? 'W' : 'L'
  const lastIsLeaderWin = pattern[g - 1] === leaderChar

  const cands: string[] = []
  if (g === 2) cands.push('Bo2')
  for (const k of [1, 2, 3, 4]) {
    if (hi === k && lo < k && lastIsLeaderWin) cands.push(`Bo${2 * k - 1}`)
  }

  const order = ['Bo1', 'Bo2', 'Bo3', 'Bo5', 'Bo7']
  const uniq = order.filter((o) => cands.includes(o))
  return uniq.length > 0 ? uniq.join('/') : '?'
}

interface ParsedRow extends SeriesOutcomeRow {
  wins: number
  losses: number
  result: 'Win' | 'Loss' | 'Draw'
  score: string
  format: string
}

function parseRow(row: SeriesOutcomeRow): ParsedRow {
  const wins = (row.pattern.match(/W/g) ?? []).length
  const losses = row.pattern.length - wins
  const result = wins > losses ? 'Win' : wins < losses ? 'Loss' : 'Draw'
  return {
    ...row,
    wins,
    losses,
    result,
    score: `${wins}–${losses}`,
    format: inferFormat(row.pattern, wins, losses),
  }
}

/* ── Format filter (URL-hash backed) ────────────────────── */

const FORMAT_ORDER = ['Bo1', 'Bo2', 'Bo2/Bo3', 'Bo3', 'Bo5', 'Bo7', '?']
const FORMAT_SLUG: Record<string, string> = {
  'Bo1': 'bo1',
  'Bo2': 'bo2',
  'Bo2/Bo3': 'bo23',
  'Bo3': 'bo3',
  'Bo5': 'bo5',
  'Bo7': 'bo7',
  '?': 'unknown',
}
const SLUG_FORMAT: Record<string, string> = Object.fromEntries(
  Object.entries(FORMAT_SLUG).map(([label, slug]) => [slug, label]),
)

/** Hidden formats are stored in the URL hash as `#hide=bo2,bo5` (empty = all shown). */
function readHiddenFromHash(): Set<string> {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const hide = params.get('hide')
  if (!hide) return new Set()
  const set = new Set<string>()
  for (const slug of hide.split(',')) {
    const label = SLUG_FORMAT[slug]
    if (label) set.add(label)
  }
  return set
}

function writeHiddenToHash(hidden: Set<string>) {
  const slugs = FORMAT_ORDER.filter((f) => hidden.has(f)).map((f) => FORMAT_SLUG[f])
  const base = window.location.pathname + window.location.search
  window.history.replaceState(null, '', slugs.length > 0 ? `${base}#hide=${slugs.join(',')}` : base)
}

/* ── Cells ──────────────────────────────────────────────── */

function PatternCell({ pattern }: { pattern: string }) {
  return (
    <span style={{ display: 'flex', gap: 3 }}>
      {pattern.split('').map((c, i) => {
        const win = c === 'W'
        const color = win ? 'var(--color-win)' : 'var(--color-loss)'
        return (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 3,
              fontSize: '0.68rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color,
              border: `1px solid ${color}`,
            }}
          >
            {c}
          </span>
        )
      })}
    </span>
  )
}

/* ── Columns ────────────────────────────────────────────── */

const columns: ColumnDef<ParsedRow, unknown>[] = [
  {
    id: 'pattern',
    accessorKey: 'pattern',
    header: 'Sequence',
    size: 150,
    enableSorting: false,
    cell: ({ row }) => <PatternCell pattern={row.original.pattern} />,
  },
  {
    id: 'score',
    accessorFn: (row) => row.wins - row.losses,
    header: 'Score',
    size: 80,
    meta: { tooltip: 'Series score from the team’s perspective (wins–losses)' },
    cell: ({ row }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{row.original.score}</span>
    ),
  },
  {
    id: 'result',
    accessorKey: 'result',
    header: 'Result',
    size: 90,
    enableSorting: false,
    cell: ({ getValue }) => {
      const r = getValue() as ParsedRow['result']
      const color = r === 'Win' ? 'var(--color-win)' : r === 'Loss' ? 'var(--color-loss)' : 'var(--color-text-muted)'
      return <span style={{ fontSize: '0.8rem', fontWeight: 600, color }}>{r}</span>
    },
  },
  {
    id: 'format',
    accessorKey: 'format',
    header: 'Format',
    size: 110,
    enableSorting: false,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{getValue() as string}</span>
    ),
  },
  {
    id: 'count',
    accessorKey: 'count',
    header: 'Count',
    size: 90,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Number of series with this outcome' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function TeamSeriesOutcomes() {
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

  const { data, isLoading, error } = useApiQuery<{ data: SeriesOutcomeRow[] }>(
    hasFilters ? '/api/teams/series-outcome' : null,
    apiParams,
  )

  const [hidden, setHidden] = useState<Set<string>>(readHiddenFromHash)

  // Keep the URL hash in sync with the toggle state (shareable links).
  useEffect(() => {
    writeHiddenToHash(hidden)
  }, [hidden])

  // Hydrate from the hash on back/forward or manual edits.
  useEffect(() => {
    function onHash() {
      setHidden(readHiddenFromHash())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const toggleFormat = useCallback((fmt: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(fmt)) next.delete(fmt)
      else next.add(fmt)
      return next
    })
  }, [])

  const allRows = useMemo(() => (data?.data ?? []).map(parseRow), [data])

  const formatOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of allRows) counts.set(r.format, (counts.get(r.format) ?? 0) + r.count)
    return FORMAT_ORDER.filter((f) => counts.has(f)).map((f) => ({ format: f, count: counts.get(f) ?? 0 }))
  }, [allRows])

  const rows = useMemo(() => allRows.filter((r) => !hidden.has(r.format)), [allRows, hidden])

  return (
    <div className={styles.page}>
      <PageMeta
        title="Team Series Outcomes — Pro Dota 2"
        description="Win/loss sequence distribution across a pro team's series — how often they go 2-0, get reverse-swept, and more."
      />
      <div className={styles.header}>
        <h1>Series Outcomes</h1>
        <p className={styles.subtitle}>
          How a team's series play out, game by game — pick a team to see their win/loss sequences
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <TableSkeleton columns={columns} rows={10} loaderText="Fetching series outcomes..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {allRows.length > 0 && (
        <div className={toggleStyles.toggleRow} style={{ flexWrap: 'wrap' }}>
          {formatOptions.map(({ format, count }) => (
            <button
              key={format}
              className={`${toggleStyles.toggleBtn} ${hidden.has(format) ? '' : toggleStyles.toggleActive}`}
              onClick={() => toggleFormat(format)}
              title={hidden.has(format) ? `Show ${format} series` : `Hide ${format} series`}
            >
              {format} <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'count', desc: true }]}
          searchValue={(r) => [r.pattern, r.result, r.format, r.score].join(' ')}
        />
      )}

      {allRows.length > 0 && rows.length === 0 && (
        <div className={styles.empty}>
          <p>All series types are hidden — re-enable one above to see results.</p>
        </div>
      )}
    </div>
  )
}
