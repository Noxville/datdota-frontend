import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl, miniHeroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PercentCell, DeltaCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface H2HEntry {
  hero: number
  againstHero: number
  shift: number
  wins: number
  losses: number
  games: number
}

/* ── Helpers ────────────────────────────────────────────── */

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPic(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

/* ── Hash state management ─────────────────────────────── */

type ViewMode = 'crosstable' | 'table'
type MetricMode = 'elo' | 'winrate'

function parseHash(): { view: ViewMode; metric: MetricMode; minGames: number; minInteractions: number } {
  const hash = window.location.hash.replace('#', '')
  const params = new URLSearchParams(hash)
  const view = params.get('view') === 'table' ? 'table' : 'crosstable'
  const metric = params.get('metric') === 'winrate' ? 'winrate' : 'elo'
  const minGames = parseInt(params.get('min') ?? '1', 10) || 1
  const minInteractions = parseInt(params.get('interactions') ?? '1', 10) || 1
  return { view, metric, minGames, minInteractions }
}

function setHash(view: ViewMode, metric: MetricMode, minGames: number, minInteractions: number) {
  const params = new URLSearchParams()
  params.set('view', view)
  params.set('metric', metric)
  params.set('min', String(minGames))
  params.set('interactions', String(minInteractions))
  window.location.hash = params.toString()
}

/* ── Simple Table columns ──────────────────────────────── */

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroPic(heroId)
  const name = heroName(heroId)
  return pic ? (
    <img src={heroImageUrl(pic)} alt={name} title={name} style={{ height: 22, width: 'auto' }} loading="lazy" />
  ) : (
    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

const tableColumns: ColumnDef<H2HEntry, unknown>[] = [
  {
    id: 'hero',
    accessorFn: (row) => heroName(row.hero),
    header: 'Hero',
    size: 50,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'against',
    accessorFn: (row) => heroName(row.againstHero),
    header: 'Vs',
    size: 50,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.againstHero} />,
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'W',
    size: 55,
    meta: { numeric: true, tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'losses',
    accessorKey: 'losses',
    header: 'L',
    size: 55,
    meta: { numeric: true, tooltip: 'Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorFn: (row) => (row.games > 0 ? row.wins / row.games : 0),
    header: 'Win %',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'shift',
    accessorKey: 'shift',
    header: 'Elo Shift',
    size: 85,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Average Elo Shift' },
    cell: ({ getValue }) => <DeltaCell value={getValue() as number} decimals={2} />,
  },
]

/* ── D3 CrossTable ─────────────────────────────────────── */

interface CrossTableProps {
  data: H2HEntry[]
  metric: MetricMode
  minGames: number
  minInteractions: number
  apiParams: Record<string, string>
}

function CrossTable({ data, metric, minGames, minInteractions, apiParams }: CrossTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<{
    x: number; y: number
    heroA: number; heroB: number
    shift: number; wins: number; losses: number; games: number
  } | null>(null)

  // Build hero order sorted by total picks descending, filtering empty rows/cols
  const { heroOrder, lookupMap } = useMemo(() => {
    const pickCounts = new Map<number, number>()
    const map = new Map<string, H2HEntry>()
    for (const e of data) {
      pickCounts.set(e.hero, (pickCounts.get(e.hero) ?? 0) + e.games)
      map.set(`${e.hero}-${e.againstHero}`, e)
    }
    // Count distinct opponents per hero that meet minGames
    const heroOpponents = new Map<number, Set<number>>()
    for (const e of data) {
      if (e.games >= minGames) {
        if (!heroOpponents.has(e.hero)) heroOpponents.set(e.hero, new Set())
        heroOpponents.get(e.hero)!.add(e.againstHero)
      }
    }
    const order = [...pickCounts.entries()]
      .filter(([id]) => (heroOpponents.get(id)?.size ?? 0) >= minInteractions)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
    return { heroOrder: order, lookupMap: map }
  }, [data, minGames, minInteractions])

  useEffect(() => {
    if (!svgRef.current || heroOrder.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const n = heroOrder.length
    const cellSize = Math.max(32, Math.min(55, Math.floor(1300 / n)))
    const headerSize = 58
    const width = headerSize + n * cellSize
    const height = headerSize + n * cellSize

    svg
      .attr('width', width)
      .attr('height', height)
      .style('font-family', 'var(--font-mono)')

    // Compute color scale
    let colorScale: (val: number) => string
    if (metric === 'elo') {
      const maxAbs = d3.max(data, (d) => Math.abs(d.shift)) ?? 1
      colorScale = (val: number) => {
        if (val > 0) return d3.interpolateRgb('#1e1e38', '#2dd4bf')(Math.min(val / maxAbs, 1))
        if (val < 0) return d3.interpolateRgb('#1e1e38', '#f87171')(Math.min(Math.abs(val) / maxAbs, 1))
        return '#1e1e38'
      }
    } else {
      colorScale = (val: number) => {
        if (val > 0.5) return d3.interpolateRgb('#1e1e38', '#2dd4bf')((val - 0.5) * 2)
        if (val < 0.5) return d3.interpolateRgb('#1e1e38', '#f87171')((0.5 - val) * 2)
        return '#1e1e38'
      }
    }

    // Column headers (hero icons as images)
    for (let j = 0; j < n; j++) {
      const hId = heroOrder[j]
      const pic = heroPic(hId)
      if (pic) {
        svg.append('image')
          .attr('x', headerSize + j * cellSize)
          .attr('y', 2)
          .attr('width', cellSize - 2)
          .attr('height', headerSize - 4)
          .attr('href', miniHeroImageUrl(pic))
          .attr('preserveAspectRatio', 'xMidYMid meet')
      }
    }

    // Row headers
    for (let i = 0; i < n; i++) {
      const hId = heroOrder[i]
      const pic = heroPic(hId)
      if (pic) {
        svg.append('image')
          .attr('x', 2)
          .attr('y', headerSize + i * cellSize)
          .attr('width', headerSize - 4)
          .attr('height', cellSize - 2)
          .attr('href', miniHeroImageUrl(pic))
          .attr('preserveAspectRatio', 'xMidYMid meet')
      }
    }

    // Grid cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const heroA = heroOrder[i]
        const heroB = heroOrder[j]
        if (heroA === heroB) {
          // Diagonal — dark
          svg.append('rect')
            .attr('x', headerSize + j * cellSize)
            .attr('y', headerSize + i * cellSize)
            .attr('width', cellSize - 1)
            .attr('height', cellSize - 1)
            .attr('fill', '#0d0d1a')
            .attr('rx', 1)
          continue
        }

        const entry = lookupMap.get(`${heroA}-${heroB}`)
        if (!entry || entry.games < minGames) {
          svg.append('rect')
            .attr('x', headerSize + j * cellSize)
            .attr('y', headerSize + i * cellSize)
            .attr('width', cellSize - 1)
            .attr('height', cellSize - 1)
            .attr('fill', '#1e1e38')
            .attr('opacity', 0.3)
            .attr('rx', 1)
          continue
        }

        const val = metric === 'elo' ? (entry.shift ?? 0) : (entry.games > 0 ? entry.wins / entry.games : 0.5)
        const fill = colorScale(val)

        const cx = headerSize + j * cellSize
        const cy = headerSize + i * cellSize

        svg.append('rect')
          .attr('x', cx)
          .attr('y', cy)
          .attr('width', cellSize - 1)
          .attr('height', cellSize - 1)
          .attr('fill', fill)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function (event) {
            d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5)
            setTip({
              x: event.clientX,
              y: event.clientY,
              heroA, heroB,
              shift: entry.shift,
              wins: entry.wins,
              losses: entry.losses,
              games: entry.games,
            })
          })
          .on('mousemove', function (event) {
            setTip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
          })
          .on('mouseleave', function () {
            d3.select(this).attr('stroke', 'none')
            setTip(null)
          })
          .on('click', function () {
            const params = new URLSearchParams(apiParams)
            params.set('heroes-a', String(heroA))
            params.set('heroes-b', String(heroB))
            window.open(`/matches/finder?${params.toString()}`, '_blank')
          })

        // Cell text label
        if (cellSize >= 26) {
          let label: string
          if (metric === 'winrate') {
            const wr = entry.games > 0 ? (entry.wins / entry.games * 100) : 50
            const delta = wr - 50
            label = (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%'
          } else {
            label = ((entry.shift ?? 0) >= 0 ? '+' : '') + (entry.shift ?? 0).toFixed(1)
          }
          svg.append('text')
            .attr('x', cx + (cellSize - 1) / 2)
            .attr('y', cy + (cellSize - 1) / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#fff')
            .attr('font-size', Math.max(7, cellSize * 0.28) + 'px')
            .attr('opacity', 0.85)
            .attr('pointer-events', 'none')
            .text(label)
        }
      }
    }
  }, [heroOrder, lookupMap, data, metric, minGames])

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', position: 'relative' }}>
      <svg ref={svgRef} />
      {tip && (
        <div style={{
          position: 'fixed',
          left: tip.x + 12,
          top: tip.y - 10,
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: '8px 12px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: 'var(--color-primary)' }}>{heroName(tip.heroA)}</strong>
            <span style={{ color: 'var(--color-text-muted)' }}>vs</span>
            <strong style={{ color: 'var(--color-accent-bright)' }}>{heroName(tip.heroB)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-win)' }}>{tip.wins}W</span>
            {' / '}
            <span style={{ color: 'var(--color-loss)' }}>{tip.losses}L</span>
            <span style={{ color: 'var(--color-text-muted)' }}> ({tip.games} games)</span>
          </div>
          <div>
            Win rate: <span style={{ fontWeight: 600 }}>{(tip.games > 0 ? (tip.wins / tip.games * 100).toFixed(1) : '0')}%</span>
          </div>
          <div>
            Elo shift: <span style={{ color: (tip.shift ?? 0) >= 0 ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 600 }}>
              {(tip.shift ?? 0) >= 0 ? '+' : ''}{(tip.shift ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Page component ─────────────────────────────────────── */

export default function HeroHeadToHead() {
  const {
    filters, setFilters, clearFilters, applyDefaults, apiParams, hasFilters,
    filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { data, isLoading, error } = useApiQuery<{ data: H2HEntry[] }>(
    hasFilters ? '/api/heroes/head-to-head-elo' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data?.data])

  const maxGamesInData = useMemo(
    () => rows.reduce((mx, r) => Math.max(mx, r.games), 1),
    [rows],
  )

  // Hash-based state
  const [view, setView] = useState<ViewMode>(() => parseHash().view)
  const [metric, setMetric] = useState<MetricMode>(() => parseHash().metric)
  const [minGames, setMinGames] = useState(() => parseHash().minGames)
  const [minInteractions, setMinInteractions] = useState(() => parseHash().minInteractions)

  const updateHash = useCallback((v: ViewMode, m: MetricMode, mg: number, mi: number) => {
    setHash(v, m, mg, mi)
  }, [])

  // Hydrate from hash on mount
  useEffect(() => {
    const onHashChange = () => {
      const h = parseHash()
      setView(h.view)
      setMetric(h.metric)
      setMinGames(h.minGames)
      setMinInteractions(h.minInteractions)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const filteredRows = useMemo(
    () => rows.filter((r) => r.games >= minGames),
    [rows, minGames],
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Hero Head-to-Head</h1>
        <p className={styles.subtitle}>
          Elo shifts and win rates for hero matchups
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'patch', 'after', 'before', 'leagues', 'splits', 'tier', 'split-type', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Select filters to query hero head-to-head data.</p>
          <Link to="/heroes/head-to-head?default=true" className={styles.defaultLink} onClick={(e) => { e.preventDefault(); applyDefaults() }}>
            Load defaults
          </Link>
        </div>
      )}

      {hasFilters && isLoading && <EnigmaLoader text="Computing elo matchups..." />}

      {hasFilters && error && (
        <div className={styles.error}>
          Failed to load hero head-to-head data. {error instanceof Error ? error.message : ''}
        </div>
      )}

      {hasFilters && !isLoading && !error && rows.length === 0 && (
        <div className={styles.empty}>
          <p>No head-to-head data found for these filters.</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Controls bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
            {/* View toggle */}
            <div className={toggleStyles.toggleRow} style={{ marginBottom: 0 }}>
              <button
                className={`${toggleStyles.toggleBtn} ${view === 'crosstable' ? toggleStyles.toggleActive : ''}`}
                onClick={() => { setView('crosstable'); updateHash('crosstable', metric, minGames, minInteractions) }}
              >
                Cross-table
              </button>
              <button
                className={`${toggleStyles.toggleBtn} ${view === 'table' ? toggleStyles.toggleActive : ''}`}
                onClick={() => { setView('table'); updateHash('table', metric, minGames, minInteractions) }}
              >
                Simple Table
              </button>
            </div>

            {/* Metric toggle (cross-table only) */}
            {view === 'crosstable' && (
              <div className={toggleStyles.toggleRow} style={{ marginBottom: 0 }}>
                <button
                  className={`${toggleStyles.toggleBtn} ${metric === 'elo' ? toggleStyles.toggleActive : ''}`}
                  onClick={() => { setMetric('elo'); updateHash(view, 'elo', minGames, minInteractions) }}
                >
                  Elo Shift
                </button>
                <button
                  className={`${toggleStyles.toggleBtn} ${metric === 'winrate' ? toggleStyles.toggleActive : ''}`}
                  onClick={() => { setMetric('winrate'); updateHash(view, 'winrate', minGames, minInteractions) }}
                >
                  Win Rate
                </button>
              </div>
            )}

            {/* Min games filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '0.6rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
              }}>
                Min Games
              </label>
              <input
                type="range"
                min={1}
                max={Math.max(maxGamesInData, 2)}
                value={minGames}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setMinGames(v)
                  updateHash(view, metric, v, minInteractions)
                }}
                style={{ width: 120, accentColor: 'var(--color-primary)' }}
              />
              <input
                type="number"
                min={1}
                max={maxGamesInData}
                value={minGames}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(maxGamesInData, parseInt(e.target.value, 10) || 1))
                  setMinGames(v)
                  updateHash(view, metric, v, minInteractions)
                }}
                style={{
                  width: 60,
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-bg-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text)',
                }}
              />
            </div>

            {/* Min interactions filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '0.6rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
              }}>
                Min Matchups
              </label>
              <input
                type="range"
                min={1}
                max={50}
                value={minInteractions}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setMinInteractions(v)
                  updateHash(view, metric, minGames, v)
                }}
                style={{ width: 120, accentColor: 'var(--color-primary)' }}
              />
              <input
                type="number"
                min={1}
                max={200}
                value={minInteractions}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value, 10) || 1)
                  setMinInteractions(v)
                  updateHash(view, metric, minGames, v)
                }}
                style={{
                  width: 60,
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-bg-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          {/* Content */}
          {view === 'crosstable' ? (
            <CrossTable data={rows} metric={metric} minGames={minGames} minInteractions={minInteractions} apiParams={apiParams} />
          ) : (
            <DataTable
              data={filteredRows}
              columns={tableColumns}
              defaultSorting={[{ id: 'games', desc: true }]}
              searchableColumns={['hero', 'against']}
            />
          )}
        </>
      )}
    </div>
  )
}
