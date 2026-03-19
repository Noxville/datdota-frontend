import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { frames as framesStatic } from '../data/frames'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './PlayerPerformances.module.css'

/* ── Static lookups ─────────────────────────────────────── */

const FRAME_FIELDS: Record<string, string> = framesStatic.fields
const AGGREGATES: Record<string, string> = framesStatic.aggregates
const SORTS: Record<string, string> = framesStatic.sorts

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPicture(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroPicture(heroId)
  const name = heroName(heroId)
  return pic ? (
    <img
      src={heroImageUrl(pic)}
      alt={name}
      title={name}
      style={{ height: 22, width: 'auto' }}
      loading="lazy"
    />
  ) : (
    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

/* ── Types ──────────────────────────────────────────────── */

interface FrameLine {
  nickname?: string
  steamId?: number
  hero?: number
  matchId?: number
  teamName?: string
  valveId?: number
  timeVals: Record<string, number>
  timeCounts: Record<string, number>
  timeStddev: Record<string, number>
}

/* ── Frame field search dropdown ────────────────────────── */

function FrameFieldSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return Object.entries(FRAME_FIELDS).filter(([, label]) =>
      label.toLowerCase().includes(q),
    )
  }, [search])

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={open ? search : FRAME_FIELDS[value] ?? value}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => { setOpen(true); setSearch('') }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search statistic..."
        style={{
          width: '100%',
          padding: '6px 10px',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          background: 'var(--color-bg-deep)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          color: 'var(--color-text)',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: 240,
          overflowY: 'auto',
          background: 'var(--color-bg-deep)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          zIndex: 20,
        }}>
          {filtered.map(([key, label]) => (
            <div
              key={key}
              onMouseDown={() => { onChange(key); setSearch(''); setOpen(false) }}
              style={{
                padding: '5px 10px',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                background: key === value ? 'rgba(196,139,196,0.15)' : 'transparent',
                color: key === value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => { (e.target as HTMLDivElement).style.background = 'rgba(196,139,196,0.1)' }}
              onMouseLeave={(e) => { (e.target as HTMLDivElement).style.background = key === value ? 'rgba(196,139,196,0.15)' : 'transparent' }}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Row sparkline (time-series for a single row) ────────── */

const SPARK_W = 140
const SPARK_H = 36
const END_GAME_SENTINEL = 12000

function RowSparkline({ row, colId }: { row: FrameLine; colId: string }) {
  // Collect this row's time-series points (exclude end-game sentinel)
  const points: { sec: number; val: number }[] = []
  for (const [key, val] of Object.entries(row.timeVals)) {
    const sec = Number(key)
    if (sec !== END_GAME_SENTINEL) points.push({ sec, val })
  }
  points.sort((a, b) => a.sec - b.sec)

  if (points.length < 2) return null

  const minSec = points[0].sec
  const maxSec = points[points.length - 1].sec
  const secRange = maxSec - minSec || 1
  const vals = points.map((p) => p.val)
  const minVal = Math.min(...vals)
  const maxVal = Math.max(...vals)
  const valRange = maxVal - minVal || 1

  // Figure out which second this column represents
  let markerSec: number | null = null
  if (colId === 't_end') {
    // End-game — no marker on this sparkline
  } else {
    const match = colId.match(/^t_(\d+)$/)
    if (match) markerSec = Number(match[1])
  }

  const polyPoints = points
    .map((p) => {
      const x = ((p.sec - minSec) / secRange) * SPARK_W
      const y = SPARK_H - 2 - ((p.val - minVal) / valRange) * (SPARK_H - 4)
      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `0,${SPARK_H} ${polyPoints} ${SPARK_W},${SPARK_H}`

  // Find marker position
  let markerX: number | null = null
  let markerY: number | null = null
  if (markerSec != null) {
    markerX = ((markerSec - minSec) / secRange) * SPARK_W
    // Find the value at this second (or interpolate)
    const entry = points.find((p) => p.sec === markerSec)
    if (entry) {
      markerY = SPARK_H - 2 - ((entry.val - minVal) / valRange) * (SPARK_H - 4)
    }
  }

  return (
    <>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '0.6rem',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: 'var(--color-accent-bright)',
        marginTop: 6,
        marginBottom: 2,
        opacity: 0.7,
      }}>
        Row timeline
      </div>
      <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 36, marginBottom: 4 }}>
        <polygon points={areaPoints} fill="rgba(25,170,141,0.10)" />
        <polyline
          points={polyPoints}
          fill="none"
          stroke="rgba(25,170,141,0.5)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {markerX != null && (
          <line
            x1={markerX}
            y1={0}
            x2={markerX}
            y2={SPARK_H}
            stroke="#19aa8d"
            strokeWidth="1.5"
            opacity="0.8"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {markerX != null && markerY != null && (
          <circle
            cx={markerX}
            cy={markerY}
            r="3"
            fill="#19aa8d"
            stroke="var(--color-bg-elevated)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontFamily: 'var(--font-body)',
        fontSize: '0.65rem',
        color: 'var(--color-text-muted)',
      }}>
        <span>min {Math.round(minSec / 60)}</span>
        <span>min {Math.round(maxSec / 60)}</span>
      </div>
    </>
  )
}

/* ── Build table columns dynamically ────────────────────── */

function buildColumns(
  rows: FrameLine[],
  queryTime: number,
): ColumnDef<FrameLine, unknown>[] {
  if (rows.length === 0) return []

  const cols: ColumnDef<FrameLine, unknown>[] = []

  // Check which identity fields are present (non-null) in any row
  const has = (key: keyof FrameLine) => rows.some((r) => r[key] != null)

  // Identity columns
  if (has('matchId')) {
    cols.push({
      id: 'matchId',
      accessorKey: 'matchId',
      header: 'Match',
      size: 100,
      meta: { frozen: true },
      cell: ({ getValue }) => (
        <a
          href={`/matches/${getValue()}`}
          style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.78rem' }}
        >
          {getValue() as number}
        </a>
      ),
    })
  }

  if (has('steamId')) {
    cols.push({
      id: 'player',
      accessorFn: (row) => row.nickname ?? `Player ${row.steamId}`,
      header: 'Player',
      size: 130,
      meta: { frozen: true },
      cell: ({ row }) => (
        <PlayerCell steamId={row.original.steamId!} nickname={row.original.nickname ?? 'Unknown'} />
      ),
    })
  }

  if (has('hero')) {
    cols.push({
      id: 'hero',
      accessorFn: (row) => heroName(row.hero!),
      header: 'Hero',
      size: 46,
      meta: { frozen: true },
      enableSorting: false,
      cell: ({ row }) => <HeroIconCell heroId={row.original.hero!} />,
    })
  }

  if (has('valveId')) {
    cols.push({
      id: 'team',
      accessorFn: (row) => row.teamName ?? `Team ${row.valveId}`,
      header: 'Team',
      size: 130,
      meta: { frozen: true },
      cell: ({ row }) => (
        <a
          href={row.original.valveId ? `/teams/${row.original.valveId}` : '#'}
          style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.78rem' }}
        >
          {row.original.teamName ?? 'Unknown'}
        </a>
      ),
    })
  }

  // Collect all time keys across all rows
  const timeKeysSet = new Set<number>()
  for (const row of rows) {
    for (const key of Object.keys(row.timeVals)) {
      timeKeysSet.add(Number(key))
    }
  }

  // 12000 (= 200 * 60) is the sentinel key for "end of game snapshot".
  // All other keys are regular per-minute snapshots.
  const END_GAME_KEY = 12000
  const allKeys = [...timeKeysSet].sort((a, b) => a - b)
  const regularTimes = allKeys.filter((k) => k !== END_GAME_KEY)
  const hasEndGame = timeKeysSet.has(END_GAME_KEY)

  const queryTimeSeconds = queryTime * 60

  // Time-series columns (one per minute)
  for (const timeKey of regularTimes) {
    const minute = timeKey / 60
    const isHighlighted = timeKey === queryTimeSeconds

    cols.push({
      id: `t_${timeKey}`,
      accessorFn: (row) => row.timeVals[String(timeKey)] ?? null,
      header: String(minute),
      size: 72,
      meta: {
        numeric: true,
        heatmap: 'high-good' as const,
        tooltip: `Minute ${minute}`,
        ...(isHighlighted ? { highlighted: true } : {}),
      },
      cell: ({ getValue }) => {
        const val = getValue() as number | null
        if (val == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        return (
          <span style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
            {val.toFixed(2)}
          </span>
        )
      },
    })
  }

  // End-of-game column (sentinel key 12000)
  if (hasEndGame) {
    cols.push({
      id: 't_end',
      accessorFn: (row) => row.timeVals[String(END_GAME_KEY)] ?? null,
      header: 'End',
      size: 72,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'End of game' },
      cell: ({ getValue }) => {
        const val = getValue() as number | null
        if (val == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        return (
          <span style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {val.toFixed(2)}
          </span>
        )
      },
    })
  }

  return cols
}

/* ── Inline styles for frame filter controls ──────────────── */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: '0.6rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--color-text-muted)',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-mono)',
  background: 'var(--color-bg-deep)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  color: 'var(--color-text)',
}

/* ── Page component ─────────────────────────────────────── */

export default function Frames() {
  const {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    applyDefaults,
    apiParams,
    hasFilters,
    filtersCollapsed,
    setFiltersCollapsed,
  } = useFilters()

  // Frame-specific filter values with defaults
  const frameField = filters.frame_field ?? 'kills'
  const time = filters.time ?? '35'
  const aggregate = filters.aggregate ?? 'none'
  const sort = filters.sort ?? 'desc'

  // Ensure frame-specific params are always sent to the API, using defaults
  // if not explicitly set in the URL filters
  const frameApiParams = useMemo(() => ({
    ...apiParams,
    frame_field: apiParams.frame_field ?? 'kills',
    time: apiParams.time ?? '35',
    aggregate: apiParams.aggregate ?? 'none',
    sort: apiParams.sort ?? 'desc',
  }), [apiParams])

  const { data, isLoading, error, refetch } = useApiQuery<{ data: FrameLine[] }>(
    hasFilters ? '/api/frames' : null,
    frameApiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  const queryTime = parseInt(time, 10) || 35

  const columns = useMemo(
    () => buildColumns(rows, queryTime),
    [rows, queryTime],
  )

  // Count identity (frozen) columns for sticky pinning
  const stickyCount = useMemo(
    () => columns.filter((c) => (c.meta as { frozen?: boolean } | undefined)?.frozen).length,
    [columns],
  )

  // Track which column should be highlighted (the queried time)
  const highlightedColId = `t_${queryTime * 60}`

  // Ref for horizontal scroll container
  const tableWrapRef = useRef<HTMLDivElement>(null)

  const renderRowSparkline = useCallback(
    (row: FrameLine, colId: string) => <RowSparkline row={row} colId={colId} />,
    [],
  )

  // Scroll to highlighted column after data loads
  useEffect(() => {
    if (rows.length === 0 || !tableWrapRef.current) return
    const timer = setTimeout(() => {
      const el = tableWrapRef.current?.querySelector(`[data-col-id="${highlightedColId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, 100)
    return () => clearTimeout(timer)
  }, [rows.length, highlightedColId])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Frames</h1>
        <p className={styles.subtitle}>
          Time-series statistics for any metric across game minutes
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'roles', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'threshold']}
        extraChips={[
          { label: 'Statistic', value: FRAME_FIELDS[frameField] ?? frameField },
          { label: 'Time', value: `min ${time}` },
          { label: 'Aggregate', value: AGGREGATES[aggregate] ?? aggregate },
          { label: 'Sort', value: SORTS[sort] ?? sort },
        ]}
        renderExtra={() => (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '3fr 1fr 2fr 2fr',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-sm)',
          }}>
            <div>
              <label style={labelStyle}>Statistic</label>
              <FrameFieldSelect
                value={frameField}
                onChange={(v) => updateFilter('frame_field', v)}
              />
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <input
                type="number"
                min={1}
                max={200}
                value={time}
                onChange={(e) => updateFilter('time', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Aggregate</label>
              <select
                value={aggregate}
                onChange={(e) => updateFilter('aggregate', e.target.value)}
                style={inputStyle}
              >
                {Object.entries(AGGREGATES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Sort</label>
              <select
                value={sort}
                onChange={(e) => updateFilter('sort', e.target.value)}
                style={inputStyle}
              >
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching frame data..." />}

      {error && hasFilters && (
        <ErrorState
          message="Failed to load data"
          detail="Something went wrong fetching frame data."
          rawDetail={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <div ref={tableWrapRef}>
          <div style={{
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-muted)',
            marginBottom: 8,
          }}>
            {rows.length} results &middot; {FRAME_FIELDS[frameField] ?? frameField} &middot; queried at minute {queryTime}{queryTime === 200 ? ' (end of game)' : ''} &middot; {AGGREGATES[aggregate] ?? aggregate}
          </div>
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[]}
            stickyColumns={stickyCount}
            highlightColumnId={highlightedColId}
            searchableColumns={['player', 'hero', 'team']}
            renderTooltipExtra={renderRowSparkline}
          />
        </div>
      )}
    </div>
  )
}
