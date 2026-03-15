import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { DurationBucket, DurationMatch, DurationResponse } from '../types'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

const TABS = ['distribution', 'longest', 'shortest'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  distribution: 'Distribution',
  longest: 'Longest Games',
  shortest: 'Shortest Games',
}

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '') as Tab
  if (TABS.includes(hash)) return hash
  return 'distribution'
}

interface DistRow {
  minute: number
  count: number
  percentile: number
}

/* ── D3 Distribution Chart ────────────────────────────── */
function DistributionChart({ data, mean }: { data: DistRow[]; mean: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [cumulative, setCumulative] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; minute: number; count: number; pct: number } | null>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = 260
    const margin = { top: 16, right: 16, bottom: 36, left: 48 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand<number>()
      .domain(data.map((d) => d.minute))
      .range([0, innerW])
      .padding(cumulative ? 0 : 0.15)

    if (cumulative) {
      // Cumulative area chart
      const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0])

      const xLinear = d3.scaleLinear()
        .domain([data[0].minute, data[data.length - 1].minute])
        .range([0, innerW])

      const area = d3.area<DistRow>()
        .x((d) => xLinear(d.minute))
        .y0(innerH)
        .y1((d) => y(d.percentile))
        .curve(d3.curveMonotoneX)

      const line = d3.line<DistRow>()
        .x((d) => xLinear(d.minute))
        .y((d) => y(d.percentile))
        .curve(d3.curveMonotoneX)

      // Gradient fill
      const gradId = 'cumGrad'
      const defs = svg.append('defs')
      const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1')
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#c48bc4').attr('stop-opacity', 0.3)
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#c48bc4').attr('stop-opacity', 0.02)

      g.append('path').datum(data).attr('d', area).attr('fill', `url(#${gradId})`)
      g.append('path').datum(data).attr('d', line).attr('fill', 'none').attr('stroke', '#c48bc4').attr('stroke-width', 2)

      // Hover circles
      g.selectAll('circle.hover')
        .data(data)
        .join('circle')
        .attr('cx', (d) => xLinear(d.minute))
        .attr('cy', (d) => y(d.percentile))
        .attr('r', 3)
        .attr('fill', 'transparent')
        .attr('stroke', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
          d3.select(this).attr('fill', '#c48bc4').attr('stroke', '#c48bc4').attr('r', 5)
          const rect = container.getBoundingClientRect()
          setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, minute: d.minute, count: d.count, pct: d.percentile })
        })
        .on('mousemove', function (event, d) {
          const rect = container.getBoundingClientRect()
          setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, minute: d.minute, count: d.count, pct: d.percentile })
        })
        .on('mouseleave', function () {
          d3.select(this).attr('fill', 'transparent').attr('stroke', 'transparent').attr('r', 3)
          setTooltip(null)
        })

      // Y axis — percentages
      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(+d * 100).toFixed(0)}%`))
        .selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-mono)')

      // X axis
      const xAxisCum = d3.axisBottom(d3.scaleLinear().domain([data[0].minute, data[data.length - 1].minute]).range([0, innerW]))
        .ticks(10)
        .tickFormat((d) => `${d}`)

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxisCum)
        .selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-mono)')

    } else {
      // Bar chart (default)
      const maxCount = d3.max(data, (d) => d.count) ?? 1
      const y = d3.scaleLinear().domain([0, maxCount]).nice().range([innerH, 0])

      const color = d3.scaleSequential()
        .domain([0, maxCount])
        .interpolator(d3.interpolateRgb('#3a3560', '#c48bc4'))

      g.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', (d) => x(d.minute) ?? 0)
        .attr('y', (d) => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', (d) => innerH - y(d.count))
        .attr('fill', (d) => color(d.count))
        .attr('rx', 1)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
          d3.select(this).attr('fill', '#e9c0e9')
          const rect = container.getBoundingClientRect()
          setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, minute: d.minute, count: d.count, pct: d.percentile })
        })
        .on('mousemove', function (event, d) {
          const rect = container.getBoundingClientRect()
          setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, minute: d.minute, count: d.count, pct: d.percentile })
        })
        .on('mouseleave', function (_, d) {
          d3.select(this).attr('fill', color(d.count))
          setTooltip(null)
        })

      // Y axis
      g.append('g')
        .call(d3.axisLeft(y).ticks(5))
        .selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-mono)')

      // X axis
      const xAxis = d3.axisBottom(x)
        .tickValues(data.filter((d) => d.minute % 5 === 0).map((d) => d.minute))
        .tickFormat((d) => `${d}`)

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis)
        .selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-mono)')
    }

    g.selectAll('.domain, .tick line').attr('stroke', 'var(--color-border)')

    // Mean line (both modes)
    if (mean > 0) {
      const meanMinute = Math.round(mean / 60)
      const bandX = x(meanMinute)
      const meanX = bandX !== undefined ? bandX + x.bandwidth() / 2 : 0
      if (meanX > 0) {
        g.append('line')
          .attr('x1', meanX).attr('x2', meanX)
          .attr('y1', 0).attr('y2', innerH)
          .attr('stroke', '#19aa8d')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,3')
          .attr('opacity', 0.8)

        g.append('text')
          .attr('x', meanX + 4).attr('y', 10)
          .text(`avg ${fmtTime(mean)}`)
          .attr('fill', '#19aa8d')
          .attr('font-size', '0.65rem')
          .attr('font-family', 'var(--font-mono)')
      }
    }

    // X label
    svg.append('text')
      .attr('x', width / 2).attr('y', height - 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '0.7rem')
      .attr('font-family', 'var(--font-mono)')
      .text('Game Minute')

  }, [data, mean, cumulative])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6, gap: 4 }}>
        <button
          onClick={() => setCumulative(false)}
          style={{
            padding: '3px 10px',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            background: !cumulative ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
            color: !cumulative ? 'var(--color-bg)' : 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px 0 0 4px',
            cursor: 'pointer',
          }}
        >
          Count
        </button>
        <button
          onClick={() => setCumulative(true)}
          style={{
            padding: '3px 10px',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            background: cumulative ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
            color: cumulative ? 'var(--color-bg)' : 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer',
          }}
        >
          Cumulative
        </button>
      </div>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      {tooltip && (
        <div style={{
          position: 'absolute',
          top: tooltip.y,
          left: tooltip.x,
          transform: 'translate(-50%, -100%)',
          padding: '6px 10px',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-secondary)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <div>Minute <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{tooltip.minute}</span></div>
          <div>{tooltip.count} match{tooltip.count !== 1 ? 'es' : ''}</div>
          <div>{(tooltip.pct * 100).toFixed(1)}% cumulative</div>
        </div>
      )}
    </div>
  )
}

const distColumns: ColumnDef<DistRow, unknown>[] = [
  {
    id: 'minute',
    accessorKey: 'minute',
    header: 'Minute',
    size: 80,
    meta: { numeric: true },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'count',
    accessorKey: 'count',
    header: '# Ending',
    size: 100,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Matches ending at this minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'percentile',
    accessorKey: 'percentile',
    header: 'Percentile',
    size: 100,
    meta: { numeric: true, tooltip: 'Cumulative percentile' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

const matchColumns: ColumnDef<DurationMatch, unknown>[] = [
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
    id: 'teams',
    accessorFn: (row) => row.teams?.map((t) => t.name).join(' vs ') ?? '',
    header: 'Teams',
    size: 250,
    enableSorting: false,
    cell: ({ row }) => {
      const teams = row.original.teams
      if (!teams || teams.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return (
        <span style={{ fontSize: '0.8rem' }}>
          {teams.map((t, i) => (
            <span key={t.valveId}>
              {i > 0 && <span style={{ color: 'var(--color-text-muted)' }}> vs </span>}
              <a href={`/teams/${t.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none' }}>
                {t.name}
              </a>
            </span>
          ))}
        </span>
      )
    },
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration',
    size: 90,
    meta: { numeric: true, tooltip: 'Match Duration' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
]

export default function MatchDurations() {
  const [tab, setTab] = useState<Tab>(getInitialTab)

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

  const { data, isLoading, error } = useApiQuery<{ data: DurationResponse }>(
    hasFilters ? '/api/match-durations' : null,
    apiParams,
  )

  const distRows: DistRow[] = useMemo(() => {
    if (!data?.data?.durations) return []
    const totalCount = data.data.count || data.data.durations.reduce((s, d) => s + d.count, 0)
    let cumulative = 0
    return data.data.durations.map((d) => {
      cumulative += d.count
      return { minute: d.minute, count: d.count, percentile: totalCount > 0 ? cumulative / totalCount : 0 }
    })
  }, [data])

  const longestRows = useMemo(() => data?.data?.longest ?? [], [data])
  const shortestRows = useMemo(() => data?.data?.shortest ?? [], [data])
  const mean = data?.data?.mean ?? 0
  const stdDev = data?.data?.stdDev ?? 0
  const totalCount = data?.data?.count ?? 0

  const hasData = distRows.length > 0 || longestRows.length > 0 || shortestRows.length > 0

  // Set hash if not already set after data loads
  useEffect(() => {
    if (hasData && !window.location.hash) {
      window.location.hash = `#${tab}`
    }
  }, [hasData, tab])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Match Durations</h1>
        <p className={styles.subtitle}>
          Distribution of match lengths across filtered matches
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

      {isLoading && <EnigmaLoader text="Fetching duration data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {hasData && (
        <>
          {/* Summary stats */}
          <div style={{
            display: 'flex',
            gap: 32,
            justifyContent: 'center',
            padding: '10px 0 14px',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Matches:</span>{' '}
              {totalCount.toLocaleString()}
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

          {tab === 'distribution' && distRows.length > 0 && (
            <>
              <DistributionChart data={distRows} mean={mean} />
              <DataTable
                data={distRows}
                columns={distColumns}
                defaultSorting={[{ id: 'minute', desc: false }]}
              />
            </>
          )}
          {tab === 'longest' && longestRows.length > 0 && (
            <DataTable
              data={longestRows}
              columns={matchColumns}
              defaultSorting={[{ id: 'duration', desc: true }]}
              searchableColumns={['teams']}
            />
          )}
          {tab === 'shortest' && shortestRows.length > 0 && (
            <DataTable
              data={shortestRows}
              columns={matchColumns}
              defaultSorting={[{ id: 'duration', desc: false }]}
              searchableColumns={['teams']}
            />
          )}
        </>
      )}
    </div>
  )
}
