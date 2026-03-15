import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { fmtTime } from '../utils/format'

interface DistBucket {
  minute: number
  count: number
  percentile: number
}

interface TimeDistributionChartProps {
  /** Raw event times in seconds */
  times: number[]
  /** X-axis label */
  xLabel?: string
}

/**
 * Reusable bar / cumulative distribution chart for event times.
 * Buckets events by game minute, renders a D3 bar chart (count mode)
 * or area chart (cumulative mode) with tooltips.
 */
export default function TimeDistributionChart({ times, xLabel = 'Game Minute' }: TimeDistributionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [cumulative, setCumulative] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; minute: number; count: number; pct: number } | null>(null)

  const data: DistBucket[] = useMemo(() => {
    if (times.length === 0) return []
    const buckets = new Map<number, number>()
    for (const t of times) {
      const m = Math.floor(t / 60)
      buckets.set(m, (buckets.get(m) ?? 0) + 1)
    }
    const minMin = Math.min(...buckets.keys())
    const maxMin = Math.max(...buckets.keys())
    const total = times.length
    let cum = 0
    const result: DistBucket[] = []
    for (let m = minMin; m <= maxMin; m++) {
      const count = buckets.get(m) ?? 0
      cum += count
      result.push({ minute: m, count, percentile: total > 0 ? cum / total : 0 })
    }
    return result
  }, [times])

  const mean = useMemo(() => {
    if (times.length === 0) return 0
    return times.reduce((a, b) => a + b, 0) / times.length
  }, [times])

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
      const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0])
      const xLinear = d3.scaleLinear()
        .domain([data[0].minute, data[data.length - 1].minute])
        .range([0, innerW])

      const area = d3.area<DistBucket>()
        .x((d) => xLinear(d.minute))
        .y0(innerH)
        .y1((d) => y(d.percentile))
        .curve(d3.curveMonotoneX)

      const line = d3.line<DistBucket>()
        .x((d) => xLinear(d.minute))
        .y((d) => y(d.percentile))
        .curve(d3.curveMonotoneX)

      const gradId = 'cumGrad'
      const defs = svg.append('defs')
      const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1')
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#c48bc4').attr('stop-opacity', 0.3)
      grad.append('stop').attr('offset', '100%').attr('stop-color', '#c48bc4').attr('stop-opacity', 0.02)

      g.append('path').datum(data).attr('d', area).attr('fill', `url(#${gradId})`)
      g.append('path').datum(data).attr('d', line).attr('fill', 'none').attr('stroke', '#c48bc4').attr('stroke-width', 2)

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

      g.append('g')
        .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(+d * 100).toFixed(0)}%`))
        .selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-mono)')

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

      g.append('g')
        .call(d3.axisLeft(y).ticks(5))
        .selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '0.65rem')
        .attr('font-family', 'var(--font-mono)')

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

    // Mean line
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

    svg.append('text')
      .attr('x', width / 2).attr('y', height - 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '0.7rem')
      .attr('font-family', 'var(--font-mono)')
      .text(xLabel)

  }, [data, mean, cumulative, xLabel])

  if (data.length === 0) return null

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
          <div>{tooltip.count} event{tooltip.count !== 1 ? 's' : ''}</div>
          <div>{(tooltip.pct * 100).toFixed(1)}% cumulative</div>
        </div>
      )}
    </div>
  )
}
