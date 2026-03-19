import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { patches as staticPatches } from '../data/patches'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

interface TimeDiffCount {
  time: number
  diff: number
  count: number
}

const FEATURES = [
  { id: 'networth', label: 'Net Worth' },
  { id: 'xp', label: 'Experience' },
  { id: 'kills', label: 'Kills' },
] as const

type Feature = typeof FEATURES[number]['id']
type SmoothMode = 'raw' | 'smoothed'

const TIME_MAX = 45
const CONTOUR_THRESHOLDS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0]

/** Read initial state from URL hash: #feature,mode (e.g. #networth,smoothed) */
function parseHash(): { feature: Feature; mode: SmoothMode } {
  const hash = window.location.hash.replace('#', '')
  const parts = hash.split(',')
  const feature = (['networth', 'xp', 'kills'] as Feature[]).includes(parts[0] as Feature)
    ? (parts[0] as Feature)
    : 'networth'
  const mode = parts[1] === 'smoothed' ? 'smoothed' : 'raw'
  return { feature, mode }
}

function updateHash(feature: Feature, mode: SmoothMode) {
  const frag = `${feature},${mode}`
  window.history.replaceState(null, '', `#${frag}`)
}

/**
 * Isotonic regression (pool adjacent violators).
 * Enforces monotonically non-decreasing values in-place.
 */
function isotonicRegression(arr: number[]): number[] {
  const n = arr.length
  const result = arr.slice()
  const weight = new Float64Array(n).fill(1)

  // Forward pass: merge adjacent blocks that violate monotonicity
  let i = 0
  while (i < n - 1) {
    if (result[i] > result[i + 1]) {
      // Pool: weighted average of this block
      let sumVal = result[i] * weight[i] + result[i + 1] * weight[i + 1]
      let sumW = weight[i] + weight[i + 1]
      let j = i + 1
      result[i] = sumVal / sumW
      weight[i] = sumW

      // Merge forward as needed
      while (j + 1 < n && result[i] > result[j + 1]) {
        j++
        sumVal = result[i] * weight[i] + result[j] * weight[j]
        sumW = weight[i] + weight[j]
        result[i] = sumVal / sumW
        weight[i] = sumW
      }

      // Also check backward
      while (i > 0 && result[i - 1] > result[i]) {
        i--
        sumVal = result[i] * weight[i] + result[i + 1] * weight[i + 1]
        sumW = weight[i] + weight[i + 1]
        result[i] = sumVal / sumW
        weight[i] = sumW
      }

      // Fill pooled value forward
      for (let k = i + 1; k <= j; k++) {
        result[k] = result[i]
        weight[k] = 0 // consumed into block at i
      }
    }
    i++
  }

  // Propagate pooled values
  let lastVal = result[0]
  for (let k = 1; k < n; k++) {
    if (weight[k] === 0) result[k] = lastVal
    else lastVal = result[k]
  }

  return result
}

/**
 * Antitonic regression: enforce monotonically non-increasing values.
 * (Reverse the array, run isotonic, reverse back.)
 */
function antitonicRegression(arr: number[]): number[] {
  const reversed = [...arr].reverse()
  const mono = isotonicRegression(reversed)
  return mono.reverse()
}

/**
 * Gaussian blur a grid (3x3 kernel) while respecting boundaries.
 */
function blurGrid(src: Float64Array, nx: number, ny: number): Float64Array {
  const out = new Float64Array(src)
  for (let yi = 1; yi < ny - 1; yi++) {
    for (let xi = 1; xi < nx - 1; xi++) {
      const center = src[yi * nx + xi] * 4
      const adjacent =
        (src[(yi - 1) * nx + xi] + src[(yi + 1) * nx + xi] +
         src[yi * nx + (xi - 1)] + src[yi * nx + (xi + 1)]) * 2
      const diagonal =
        src[(yi - 1) * nx + (xi - 1)] + src[(yi - 1) * nx + (xi + 1)] +
        src[(yi + 1) * nx + (xi - 1)] + src[(yi + 1) * nx + (xi + 1)]
      out[yi * nx + xi] = (center + adjacent + diagonal) / 16
    }
  }
  return out
}

/**
 * Enforce both monotonicity constraints on the grid:
 *  - Along advantage axis (column): non-decreasing (more gold = better)
 *  - Along time axis (row): non-increasing (same lead earlier = better)
 */
function enforceMonotonicity(grid: Float64Array, nx: number, ny: number) {
  // Advantage axis: isotonic (non-decreasing) per time column
  for (let xi = 0; xi < nx; xi++) {
    const col: number[] = []
    for (let yi = 0; yi < ny; yi++) col.push(grid[yi * nx + xi])
    const mono = isotonicRegression(col)
    for (let yi = 0; yi < ny; yi++) grid[yi * nx + xi] = mono[yi]
  }

  // Time axis: antitonic (non-increasing) per advantage row
  // At a fixed advantage, earlier time should have >= win prob
  for (let yi = 0; yi < ny; yi++) {
    const row: number[] = []
    for (let xi = 0; xi < nx; xi++) row.push(grid[yi * nx + xi])
    const mono = antitonicRegression(row)
    for (let xi = 0; xi < nx; xi++) grid[yi * nx + xi] = mono[xi]
  }
}

/**
 * Smooth the probability grid:
 *  1. Enforce bimonotonic constraints (advantage & time axes)
 *  2. Gaussian blur to soften contours (including the 100% boundary)
 *  3. Re-enforce monotonicity after each blur pass
 *  4. Multiple iterations for convergence
 */
function smoothGrid(values: Float64Array, nx: number, ny: number): Float64Array {
  let smoothed = new Float64Array(values)

  // Pin adv=0 row to 0.5
  for (let xi = 0; xi < nx; xi++) smoothed[xi] = 0.5

  // Initial monotonicity pass
  enforceMonotonicity(smoothed, nx, ny)

  // Iterative blur + re-enforce (2 passes of 3x3 — enough to smooth contours
  // without dragging down the 100% boundary excessively)
  for (let pass = 0; pass < 2; pass++) {
    smoothed = blurGrid(smoothed, nx, ny) as Float64Array<ArrayBuffer>

    // Re-pin adv=0 row
    for (let xi = 0; xi < nx; xi++) smoothed[xi] = 0.5

    // Re-enforce both monotonicity constraints
    enforceMonotonicity(smoothed, nx, ny)
  }

  // Clamp to [0, 1]
  for (let i = 0; i < smoothed.length; i++) {
    smoothed[i] = Math.max(0, Math.min(1, smoothed[i]))
  }

  return smoothed
}

export default function WinExpectancy() {
  const initial = parseHash()
  const [patch, setPatch] = useState(() => staticPatches[0]?.name ?? '')
  const [feature, setFeature] = useState<Feature>(initial.feature)
  const [mode, setMode] = useState<SmoothMode>(initial.mode)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Sync to hash on change
  useEffect(() => { updateHash(feature, mode) }, [feature, mode])

  const scale = feature === 'kills' ? 1 : 1000
  const advMax = feature === 'kills' ? 20 : 20000
  const advStepCount = feature === 'kills' ? 21 : 21

  const { data, isLoading, error } = useApiQuery<{ data: TimeDiffCount[] }>(
    patch ? `/api/win-expectancy/${feature}` : null,
    { patch },
  )

  // Compute raw grid of win probabilities
  const rawGrid = useMemo(() => {
    if (!data?.data) return null

    const raw = data.data
    const lookup = new Map<number, Map<number, number>>()
    for (const d of raw) {
      if (!lookup.has(d.time)) lookup.set(d.time, new Map())
      lookup.get(d.time)!.set(d.diff, d.count)
    }

    const nx = TIME_MAX
    const ny = advStepCount
    const values = new Float64Array(nx * ny)

    for (let yi = 0; yi < ny; yi++) {
      const adv = (yi / (ny - 1)) * advMax
      for (let xi = 0; xi < nx; xi++) {
        const time = xi + 1

        if (adv === 0) {
          values[yi * nx + xi] = 0.5
          continue
        }

        const timeData = lookup.get(time)
        let greater = 0
        let less = 0

        if (timeData) {
          const advRounded = Math.round(adv / scale) * scale
          for (const [diff, count] of timeData) {
            if (diff >= advRounded) greater += count
            if (diff <= -advRounded) less += count
          }
        }

        let prob: number
        if (greater + less > 0) {
          prob = greater / (greater + less)
        } else {
          if (time < 15) {
            prob = (time * scale * 0.3) < adv ? 1 : 0.5
          } else {
            prob = (time * scale * 0.65) < adv ? 1 : 0.5
          }
        }

        values[yi * nx + xi] = prob
      }
    }

    return { values, nx, ny }
  }, [data, scale, advMax, advStepCount])

  // Apply smoothing if requested
  const gridData = useMemo(() => {
    if (!rawGrid) return null
    if (mode === 'raw') return rawGrid
    return {
      ...rawGrid,
      values: smoothGrid(rawGrid.values, rawGrid.nx, rawGrid.ny),
    }
  }, [rawGrid, mode])

  const renderChart = useCallback(() => {
    if (!gridData || !svgRef.current || !containerRef.current) return

    const { values, nx, ny } = gridData
    const containerWidth = containerRef.current.clientWidth
    const margin = { top: 24, right: 80, bottom: 56, left: 72 }
    const width = containerWidth - margin.left - margin.right
    const height = Math.min(width * 0.65, 550)
    const totalW = width + margin.left + margin.right
    const totalH = height + margin.top + margin.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', totalW).attr('height', totalH).attr('viewBox', `0 0 ${totalW} ${totalH}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const xScale = d3.scaleLinear().domain([1, TIME_MAX]).range([0, width])
    const yScale = d3.scaleLinear().domain([0, advMax]).range([height, 0])
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 1])

    const contourGenerator = d3.contours()
      .size([nx, ny])
      .thresholds(CONTOUR_THRESHOLDS)
      .smooth(true)

    const contours = contourGenerator(Array.from(values))

    const transformX = d3.scaleLinear().domain([0, nx - 1]).range([0, width])
    const transformY = d3.scaleLinear().domain([0, ny - 1]).range([height, 0])

    const pathGenerator = d3.geoPath().projection(
      d3.geoTransform({
        point(x, y) {
          this.stream.point(transformX(x), transformY(y))
        },
      }),
    )

    // Filled contour bands
    g.selectAll('path.contour-fill')
      .data(contours)
      .join('path')
      .attr('class', 'contour-fill')
      .attr('d', pathGenerator as unknown as string)
      .attr('fill', (d) => colorScale(d.value))
      .attr('fill-opacity', 0.7)
      .attr('stroke', 'none')

    // Contour lines
    g.selectAll('path.contour-line')
      .data(contours)
      .join('path')
      .attr('class', 'contour-line')
      .attr('d', pathGenerator as unknown as string)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.35)')
      .attr('stroke-width', 0.8)

    // Contour labels
    for (const contour of contours) {
      if (contour.value === 0.5) continue
      const pctLabel = `${(contour.value * 100).toFixed(0)}%`

      for (const polygon of contour.coordinates) {
        for (const ring of polygon) {
          if (ring.length < 4) continue
          const midIdx = Math.floor(ring.length / 3)
          const pt = ring[midIdx]
          const px = transformX(pt[0])
          const py = transformY(pt[1])

          if (px > 30 && px < width - 30 && py > 15 && py < height - 15) {
            g.append('text')
              .attr('x', px)
              .attr('y', py)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .style('font-size', '0.6rem')
              .style('font-family', 'var(--font-mono)')
              .style('font-weight', '600')
              .style('fill', contour.value >= 0.75 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)')
              .style('paint-order', 'stroke')
              .style('stroke', contour.value >= 0.75 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)')
              .style('stroke-width', '2px')
              .text(pctLabel)
            break
          }
        }
        break
      }
    }

    // Tooltip overlay
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', (event: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip) return
        const [mx, my] = d3.pointer(event)
        const time = Math.round(xScale.invert(mx))
        const adv = yScale.invert(my)

        if (time < 1 || time > TIME_MAX || adv < 0 || adv > advMax) {
          tooltip.style.display = 'none'
          return
        }

        const xi = Math.max(0, Math.min(nx - 1, time - 1))
        const yi = Math.max(0, Math.min(ny - 1, Math.round((adv / advMax) * (ny - 1))))
        const prob = values[yi * nx + xi]

        const rect = svgRef.current!.getBoundingClientRect()
        tooltip.style.display = 'block'
        tooltip.style.left = `${event.clientX - rect.left + 14}px`
        tooltip.style.top = `${event.clientY - rect.top - 10}px`

        const advLabel = feature === 'kills'
          ? `${Math.round(adv)} kills`
          : `${(adv / 1000).toFixed(1)}k gold`
        tooltip.innerHTML = `
          <div style="font-weight:600;margin-bottom:3px">Minute ${time}</div>
          <div>Advantage: ${advLabel}</div>
          <div>Win probability: <span style="font-weight:700;color:${colorScale(prob)}">${(prob * 100).toFixed(1)}%</span></div>
        `
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(9).tickFormat((d) => `${d}`))
      .call((sel) => sel.selectAll('text')
        .style('fill', 'var(--color-text-muted)')
        .style('font-size', '0.72rem')
        .style('font-family', 'var(--font-mono)'))
      .call((sel) => sel.selectAll('line,path').style('stroke', 'var(--color-border)'))

    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 44)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--color-text-muted)')
      .style('font-size', '0.78rem')
      .style('font-family', 'var(--font-mono)')
      .text('Game Time (minutes)')

    // Y axis
    g.append('g')
      .call(
        d3.axisLeft(yScale)
          .ticks(feature === 'kills' ? 10 : 5)
          .tickFormat((d) => feature === 'kills' ? `${d}` : `${(d as number) / 1000}k`),
      )
      .call((sel) => sel.selectAll('text')
        .style('fill', 'var(--color-text-muted)')
        .style('font-size', '0.72rem')
        .style('font-family', 'var(--font-mono)'))
      .call((sel) => sel.selectAll('line,path').style('stroke', 'var(--color-border)'))

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -56)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--color-text-muted)')
      .style('font-size', '0.78rem')
      .style('font-family', 'var(--font-mono)')
      .text(`${FEATURES.find((f) => f.id === feature)?.label ?? feature} Advantage`)

    // Color legend
    const legendWidth = 14
    const legendHeight = height
    const legendG = svg.append('g').attr('transform', `translate(${margin.left + width + 20},${margin.top})`)

    const defs = svg.append('defs')
    const gradientId = 'win-exp-gradient'
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0').attr('y1', '1')
      .attr('x2', '0').attr('y2', '0')
    const nStops = 20
    for (let i = 0; i <= nStops; i++) {
      const t = i / nStops
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(t))
    }

    legendG.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('rx', 2)
      .attr('fill', `url(#${gradientId})`)

    const legendScale = d3.scaleLinear().domain([1, 0]).range([0, legendHeight])
    legendG.append('g')
      .attr('transform', `translate(${legendWidth},0)`)
      .call(d3.axisRight(legendScale).ticks(5).tickFormat((d) => `${((d as number) * 100).toFixed(0)}%`))
      .call((sel) => sel.selectAll('text')
        .style('fill', 'var(--color-text-muted)')
        .style('font-size', '0.65rem')
        .style('font-family', 'var(--font-mono)'))
      .call((sel) => sel.selectAll('line,path').style('stroke', 'var(--color-border)'))
  }, [gridData, feature, advMax])

  useEffect(() => {
    renderChart()
  }, [renderChart])

  // Re-render on container resize
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => renderChart())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [renderChart])

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-mono)',
    borderRadius: 4,
    border: '1px solid',
    borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
    background: active ? 'rgba(196, 139, 196, 0.15)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
    cursor: 'pointer',
    transition: 'all 150ms',
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Win Expectancy</h1>
        <p className={styles.subtitle}>
          Probability of winning given an advantage at each game minute
        </p>
      </div>

      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        padding: '12px 16px',
        background: 'var(--color-bg-elevated)',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            Patch
          </label>
          <select
            value={patch}
            onChange={(e) => setPatch(e.target.value)}
            style={{
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {staticPatches.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            Feature
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {FEATURES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFeature(f.id)}
                style={btnStyle(feature === f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            Mode
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setMode('raw')} style={btnStyle(mode === 'raw')}>
              Raw
            </button>
            <button onClick={() => setMode('smoothed')} style={btnStyle(mode === 'smoothed')}>
              Smoothed
            </button>
          </div>
        </div>
      </div>

      {isLoading && <EnigmaLoader text="Computing win expectancy..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {gridData && (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
          <svg ref={svgRef} />
          <div
            ref={tooltipRef}
            style={{
              display: 'none',
              position: 'absolute',
              pointerEvents: 'none',
              background: 'var(--color-bg-deep)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          />
        </div>
      )}
    </div>
  )
}
