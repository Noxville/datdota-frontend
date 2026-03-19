import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { heroesById } from '../data/heroes'
import { heroImageUrl } from '../config'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

function HeroCell({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  const src = pic ? heroImageUrl(pic) : undefined
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {src && (
        <img src={src} alt="" style={{ width: 28, height: 16, objectFit: 'cover', borderRadius: 2 }} loading="lazy" />
      )}
      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
        {hero?.name ?? `Hero ${heroId}`}
      </span>
    </span>
  )
}

interface ItemTiming {
  time: number
  matchId: number
  player: { hero: number; steamId: number; nickname: string }
  matchVictory: boolean
}

interface DistBucket {
  minute: number
  count: number
  wins: number
}

interface ItemDistributionResponse {
  fastest: ItemTiming[]
  slowest: ItemTiming[]
  mean: number
  stdDev: number
  count: number
  distribution: Record<string, DistBucket>
}

const TABS = ['fastest', 'slowest'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  fastest: 'Fastest',
  slowest: 'Slowest',
}

type ChartMode = 'graph' | 'cumulative' | 'none'

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '') as Tab
  if (TABS.includes(hash)) return hash
  return 'fastest'
}

const makeColumns = (): ColumnDef<ItemTiming, unknown>[] => [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {String(getValue())}
      </a>
    ),
  },
  {
    id: 'hero',
    accessorFn: (row) => heroesById[String(row.player.hero)]?.name ?? '',
    header: 'Hero',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => <HeroCell heroId={row.original.player.hero} />,
  },
  {
    id: 'player',
    accessorFn: (row) => row.player.nickname,
    header: 'Player',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.player.steamId} nickname={row.original.player.nickname} />
    ),
  },
  {
    id: 'time',
    accessorKey: 'time',
    header: 'Time',
    size: 90,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'result',
    accessorFn: (row) => (row.matchVictory ? 'Win' : 'Loss'),
    header: 'Result',
    size: 70,
    cell: ({ row }) => (
      <span style={{ color: row.original.matchVictory ? '#2dd4bf' : '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>
        {row.original.matchVictory ? 'Win' : 'Loss'}
      </span>
    ),
  },
]

function DistributionChart({ distribution, mode }: { distribution: Record<string, DistBucket>; mode: 'graph' | 'cumulative' }) {
  const svgRef = useRef<SVGSVGElement>(null)

  const buckets = useMemo(() => {
    const raw = Object.values(distribution).sort((a, b) => a.minute - b.minute)
    if (raw.length === 0) return []
    // Fill gaps
    const mn = raw[0].minute
    const mx = raw[raw.length - 1].minute
    const lookup = new Map(raw.map((b) => [b.minute, b]))
    const filled: DistBucket[] = []
    for (let m = mn; m <= mx; m++) {
      filled.push(lookup.get(m) ?? { minute: m, count: 0, wins: 0 })
    }
    return filled
  }, [distribution])

  const chartData = useMemo(() => {
    if (mode === 'cumulative') {
      let cumCount = 0
      let cumWins = 0
      return buckets.map((b) => {
        cumCount += b.count
        cumWins += b.wins
        return { minute: b.minute, count: cumCount, wins: cumWins, winrate: cumCount > 0 ? cumWins / cumCount : 0 }
      })
    }
    return buckets.map((b) => ({
      minute: b.minute,
      count: b.count,
      wins: b.wins,
      winrate: b.count > 0 ? b.wins / b.count : 0,
    }))
  }, [buckets, mode])

  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return

    const margin = { top: 16, right: 52, bottom: 36, left: 52 }
    const width = 980 - margin.left - margin.right
    const height = 300 - margin.top - margin.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand()
      .domain(chartData.map((d) => String(d.minute)))
      .range([0, width])
      .padding(0.15)

    const maxCount = d3.max(chartData, (d) => d.count) ?? 1
    const yCount = d3.scaleLinear().domain([0, maxCount]).nice().range([height, 0])
    const yWinrate = d3.scaleLinear().domain([0, 1]).range([height, 0])

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yCount).ticks(5).tickSize(-width).tickFormat(() => ''))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', 'var(--color-border-subtle)').attr('stroke-dasharray', '2,3'))

    // Bars
    g.selectAll('.bar')
      .data(chartData)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(String(d.minute))!)
      .attr('y', (d) => yCount(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - yCount(d.count))
      .attr('fill', 'var(--color-primary)')
      .attr('opacity', 0.5)
      .attr('rx', 1)

    // Winrate line
    const line = d3.line<(typeof chartData)[0]>()
      .x((d) => x(String(d.minute))! + x.bandwidth() / 2)
      .y((d) => yWinrate(d.winrate))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#2dd4bf')
      .attr('stroke-width', 2)
      .attr('d', line)

    // Winrate dots
    g.selectAll('.wr-dot')
      .data(chartData.filter((d) => d.count > 0))
      .join('circle')
      .attr('cx', (d) => x(String(d.minute))! + x.bandwidth() / 2)
      .attr('cy', (d) => yWinrate(d.winrate))
      .attr('r', 2.5)
      .attr('fill', '#2dd4bf')

    // 50% reference line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yWinrate(0.5))
      .attr('y2', yWinrate(0.5))
      .attr('stroke', 'var(--color-text-muted)')
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.4)

    // X axis — show every Nth label to avoid crowding
    const step = Math.max(1, Math.ceil(chartData.length / 20))
    const xAxis = d3.axisBottom(x).tickValues(
      chartData.filter((_, i) => i % step === 0).map((d) => String(d.minute))
    )
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))
      .call((g) => g.selectAll('.tick text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '0.6rem')
        .attr('font-family', 'var(--font-mono)'))
      .call((g) => g.selectAll('.tick line').attr('stroke', 'var(--color-border-subtle)'))

    // X label
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '0.6rem')
      .attr('font-family', 'var(--font-mono)')
      .text('Minute')

    // Left Y axis (count)
    g.append('g')
      .call(d3.axisLeft(yCount).ticks(5))
      .call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))
      .call((g) => g.selectAll('.tick text')
        .attr('fill', 'var(--color-primary)')
        .attr('font-size', '0.6rem')
        .attr('font-family', 'var(--font-mono)'))
      .call((g) => g.selectAll('.tick line').attr('stroke', 'var(--color-border-subtle)'))

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-primary)')
      .attr('font-size', '0.6rem')
      .attr('font-family', 'var(--font-mono)')
      .text(mode === 'cumulative' ? 'Cumulative Pickups' : 'Pickups')

    // Right Y axis (winrate)
    g.append('g')
      .attr('transform', `translate(${width},0)`)
      .call(d3.axisRight(yWinrate).ticks(5).tickFormat((d) => `${(Number(d) * 100).toFixed(0)}%`))
      .call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))
      .call((g) => g.selectAll('.tick text')
        .attr('fill', '#2dd4bf')
        .attr('font-size', '0.6rem')
        .attr('font-family', 'var(--font-mono)'))
      .call((g) => g.selectAll('.tick line').attr('stroke', 'var(--color-border-subtle)'))

    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('x', height / 2)
      .attr('y', -width - 40)
      .attr('text-anchor', 'middle')
      .attr('fill', '#2dd4bf')
      .attr('font-size', '0.6rem')
      .attr('font-family', 'var(--font-mono)')
      .text('Win %')

    // Tooltip overlay
    const tooltip = d3.select(svgRef.current.parentNode as HTMLElement)
      .selectAll('.dist-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'dist-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'var(--color-bg-elevated)')
      .style('border', '1px solid var(--color-border)')
      .style('border-radius', '4px')
      .style('padding', '6px 10px')
      .style('font-size', '0.72rem')
      .style('font-family', 'var(--font-mono)')
      .style('color', 'var(--color-text)')
      .style('box-shadow', 'var(--shadow-md)')
      .style('opacity', 0)

    g.selectAll('.bar-overlay')
      .data(chartData)
      .join('rect')
      .attr('x', (d) => x(String(d.minute))!)
      .attr('y', 0)
      .attr('width', x.bandwidth())
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mouseenter', (event, d) => {
        const wr = d.count > 0 ? `${(d.winrate * 100).toFixed(1)}%` : '—'
        tooltip
          .html(`<strong>Min ${d.minute}</strong><br/>Pickups: ${d.count.toLocaleString()}<br/>Wins: ${d.wins.toLocaleString()}<br/>Win%: ${wr}`)
          .style('opacity', 1)
        const rect = (svgRef.current!.parentNode as HTMLElement).getBoundingClientRect()
        const ex = event.clientX - rect.left
        const ey = event.clientY - rect.top
        tooltip.style('left', `${ex + 12}px`).style('top', `${ey - 10}px`)
      })
      .on('mousemove', (event) => {
        const rect = (svgRef.current!.parentNode as HTMLElement).getBoundingClientRect()
        const ex = event.clientX - rect.left
        const ey = event.clientY - rect.top
        tooltip.style('left', `${ex + 12}px`).style('top', `${ey - 10}px`)
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0)
      })
  }, [chartData, mode])

  if (chartData.length === 0) return null

  return (
    <div style={{ position: 'relative', maxWidth: 980, margin: '0 auto 16px' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto' }} />
    </div>
  )
}

export default function ItemDistribution() {
  const [tab, setTab] = useState<Tab>(getInitialTab)
  const [chartMode, setChartMode] = useState<ChartMode>('graph')
  const columns = useMemo(() => makeColumns(), [])

  const selectTab = useCallback((t: Tab) => {
    setTab(t)
    window.location.hash = `#${t}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '') as Tab
      if (TABS.includes(hash)) setTab(hash)
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

  const { data, isLoading, error } = useApiQuery<{ data: ItemDistributionResponse }>(
    hasFilters ? '/api/items/distribution' : null,
    apiParams,
  )

  const fastestRows = useMemo(() => data?.data?.fastest ?? [], [data])
  const slowestRows = useMemo(() => data?.data?.slowest ?? [], [data])
  const distribution = data?.data?.distribution ?? {}
  const mean = data?.data?.mean ?? 0
  const stdDev = data?.data?.stdDev ?? 0
  const count = data?.data?.count ?? 0

  const hasData = fastestRows.length > 0 || slowestRows.length > 0

  useEffect(() => {
    if (hasData && !window.location.hash) {
      window.location.hash = `#${tab}`
    }
  }, [hasData, tab])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Item Timings</h1>
        <p className={styles.subtitle}>
          Fastest and slowest item purchase timings
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'items', 'roles', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'result-faction']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Fetching item timing data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {hasData && (
        <>
          <div style={{
            display: 'flex',
            gap: 32,
            justifyContent: 'center',
            padding: '10px 0 14px',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Purchases:</span>{' '}
              {count.toLocaleString()}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Average:</span>{' '}
              {fmtTime(mean)}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Std Dev:</span>{' '}
              {fmtTime(stdDev)}
            </span>
          </div>

          {/* Distribution chart selector */}
          <div className={toggleStyles.toggleRow} style={{ justifyContent: 'center' }}>
            {(['graph', 'cumulative', 'none'] as const).map((m) => (
              <button
                key={m}
                className={`${toggleStyles.toggleBtn} ${chartMode === m ? toggleStyles.toggleActive : ''}`}
                onClick={() => setChartMode(m)}
              >
                {m === 'graph' ? 'Graph' : m === 'cumulative' ? 'Graph Cumulative' : 'None'}
              </button>
            ))}
          </div>

          {chartMode !== 'none' && Object.keys(distribution).length > 0 && (
            <DistributionChart distribution={distribution} mode={chartMode} />
          )}

          {/* Fastest / Slowest table selector */}
          <div className={toggleStyles.toggleRow}>
            {TABS.map((t) => (
              <button
                key={t}
                className={`${toggleStyles.toggleBtn} ${tab === t ? toggleStyles.toggleActive : ''}`}
                onClick={() => selectTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === 'fastest' && fastestRows.length > 0 && (
            <DataTable
              data={fastestRows}
              columns={columns}
              defaultSorting={[{ id: 'time', desc: false }]}
              searchableColumns={['player', 'hero']}
            />
          )}
          {tab === 'slowest' && slowestRows.length > 0 && (
            <DataTable
              data={slowestRows}
              columns={columns}
              defaultSorting={[{ id: 'time', desc: true }]}
              searchableColumns={['player', 'hero']}
            />
          )}
        </>
      )}
    </div>
  )
}
