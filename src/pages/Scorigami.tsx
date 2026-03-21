import { useCallback, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './Scorigami.module.css'

interface ScorigamiEntry {
  radiantScore: number
  direScore: number
  count: number
}

interface TooltipState {
  x: number
  y: number
  radiant: number
  dire: number
  count: number
  flipped: boolean
}

const GRID_SIZE = 60
const CELL_SIZE = 12
const CELL_GAP = 1
const MARGIN = { top: 30, right: 20, bottom: 50, left: 50 }

const SHOW_FILTERS: (
  | 'leagues'
  | 'splits'
  | 'teams'
  | 'patch'
  | 'after'
  | 'before'
  | 'tier'
  | 'split-type'
  | 'duration'
)[] = ['leagues', 'splits', 'teams', 'patch', 'after', 'before', 'tier', 'split-type', 'duration']

function ScorigamiGrid({ entries }: { entries: ScorigamiEntry[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const countMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      map.set(`${e.radiantScore}-${e.direScore}`, e.count)
    }
    return map
  }, [entries])

  const maxCount = useMemo(() => {
    let max = 0
    for (const e of entries) {
      if (e.count > max) max = e.count
    }
    return max
  }, [entries])

  const step = CELL_SIZE + CELL_GAP
  const gridW = GRID_SIZE * step - CELL_GAP
  const gridH = GRID_SIZE * step - CELL_GAP
  const svgW = MARGIN.left + gridW + MARGIN.right
  const svgH = MARGIN.top + gridH + MARGIN.bottom

  const colorScale = useMemo(
    () =>
      d3
        .scaleSequentialLog<string>()
        .domain([1, Math.max(maxCount, 1)])
        .interpolator(d3.interpolateRgb('#2a1a2e', '#c48bc4')),
    [maxCount],
  )

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, radiant: number, dire: number, count: number) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      const offsetX = containerRect ? rect.left - containerRect.left : 0
      const offsetY = containerRect ? rect.top - containerRect.top : 0
      const tooltipY = e.clientY - rect.top + offsetY
      setTooltip({
        x: e.clientX - rect.left + offsetX,
        y: tooltipY,
        radiant,
        dire,
        count,
        flipped: tooltipY < 50,
      })
    },
    [],
  )

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  return (
    <div className={styles.gridContainer} ref={containerRef}>
      <svg ref={svgRef} width={svgW} height={svgH}>
        <defs>
          <filter id="glow322" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="#2dd4bf" floodOpacity="0.9" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
            <feMerge>
              <feMergeNode in="colorBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* X axis label */}
        <text
          x={MARGIN.left + gridW / 2}
          y={svgH - 6}
          textAnchor="middle"
          fill="var(--color-text-muted)"
          fontFamily="var(--font-display)"
          fontWeight="800"
          fontSize="11"
        >
          Radiant Score
        </text>
        {/* Y axis label */}
        <text
          x={12}
          y={MARGIN.top + gridH / 2}
          textAnchor="middle"
          fill="var(--color-text-muted)"
          fontFamily="var(--font-display)"
          fontWeight="800"
          fontSize="11"
          transform={`rotate(-90, 12, ${MARGIN.top + gridH / 2})`}
        >
          Dire Score
        </text>
        {/* X axis tick labels */}
        {Array.from({ length: GRID_SIZE }, (_, i) => {
          const x = MARGIN.left + i * step + CELL_SIZE / 2
          const label = i + 1
          return (
            <text
              key={`x-${i}`}
              x={x}
              y={MARGIN.top + gridH + 16}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontFamily="var(--font-body)"
              fontSize="8"
            >
              {label % 5 === 0 || label === 1 ? label : ''}
            </text>
          )
        })}
        {/* Y axis tick labels */}
        {Array.from({ length: GRID_SIZE }, (_, i) => {
          const y = MARGIN.top + i * step + CELL_SIZE / 2
          const label = i + 1
          return (
            <text
              key={`y-${i}`}
              x={MARGIN.left - 6}
              y={y}
              textAnchor="end"
              dominantBaseline="central"
              fill="var(--color-text-muted)"
              fontFamily="var(--font-body)"
              fontSize="8"
            >
              {label % 5 === 0 || label === 1 ? label : ''}
            </text>
          )
        })}
        {/* Grid cells */}
        {Array.from({ length: GRID_SIZE }, (_, radiantIdx) =>
          Array.from({ length: GRID_SIZE }, (_, direIdx) => {
            const radiant = radiantIdx + 1
            const dire = direIdx + 1
            const count = countMap.get(`${radiant}-${dire}`) ?? 0
            const x = MARGIN.left + radiantIdx * step
            const y = MARGIN.top + direIdx * step
            const fill = count > 0 ? colorScale(count) : '#1e1e38'
            const isSpecial = (radiant === 3 && dire === 22) || (radiant === 22 && dire === 3)
            return (
              <rect
                key={`${radiant}-${dire}`}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                ry={2}
                fill={fill}
                stroke={count > 0 ? 'rgba(196,139,196,0.15)' : 'rgba(255,255,255,0.03)'}
                strokeWidth={0.5}
                filter={isSpecial ? 'url(#glow322)' : undefined}
                style={{ cursor: count > 0 ? 'pointer' : 'default' }}
                onMouseEnter={(e) => handleMouseEnter(e, radiant, dire, count)}
                onMouseLeave={handleMouseLeave}
              />
            )
          }),
        )}
      </svg>
      {tooltip && (
        <div
          className={`${styles.tooltip} ${tooltip.flipped ? styles.tooltipFlipped : ''}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className={styles.tooltipScores}>
            <span className={styles.tooltipRadiant}>{tooltip.radiant}</span>
            {' – '}
            <span className={styles.tooltipDire}>{tooltip.dire}</span>
          </div>
          <div className={styles.tooltipCount}>
            {tooltip.count === 0
              ? 'No matches'
              : `${tooltip.count.toLocaleString()} match${tooltip.count !== 1 ? 'es' : ''}`}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Scorigami() {
  const {
    filters,
    setFilters,
    clearFilters,
    applyDefaults,
    apiParams,
    hasFilters,
    filtersCollapsed,
    setFiltersCollapsed,
  } = useFilters(['threshold'])

  const { data, isLoading, error } = useApiQuery<{ data: ScorigamiEntry[] }>(
    hasFilters ? '/api/matches/scorigami' : null,
    apiParams,
  )

  const entries = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Scorigami</h1>
        <p className={styles.subtitle}>
          Frequency of final score combinations across professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={SHOW_FILTERS}
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

      {isLoading && <EnigmaLoader text="Loading scorigami data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {entries.length > 0 && <ScorigamiGrid entries={entries} />}
    </div>
  )
}
