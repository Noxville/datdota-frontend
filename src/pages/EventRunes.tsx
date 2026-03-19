import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'

interface RuneEvent {
  player: { nickname: string; steamId: number; hero: number }
  matchId: number
  time: number
  type: string
}

const RUNE_COLORS: Record<string, string> = {
  BOUNTY: '#f5a623',
  DOUBLE_DAMAGE: '#6fa3ef',
  HASTE: '#e44d4d',
  ILLUSION: '#d4a6e8',
  INVIS: '#8b8da3',
  REGEN: '#4cce5b',
  ARCANE: '#5e8cd4',
  WATER: '#5ec4d4',
  SHIELD: '#d4a24e',
  WISDOM: '#c48bc4',
}

const RUNE_LABELS: Record<string, string> = {
  BOUNTY: 'Bounty',
  DOUBLE_DAMAGE: 'DD',
  HASTE: 'Haste',
  ILLUSION: 'Illusion',
  INVIS: 'Invis',
  REGEN: 'Regen',
  ARCANE: 'Arcane',
  WATER: 'Water',
  SHIELD: 'Shield',
  WISDOM: 'Wisdom',
}

function HeroIconCell({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  const name = hero?.name ?? `Hero ${heroId}`
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img
      src={src}
      alt={name}
      title={name}
      style={{ height: 22, width: 'auto' }}
      loading="lazy"
    />
  ) : (
    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function RuneSummary({ rows, hidden, onToggle }: { rows: RuneEvent[]; hidden: Set<string>; onToggle: (type: string) => void }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.type, (m.get(r.type) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
      padding: '10px 14px',
      background: 'var(--color-bg-elevated)',
      borderRadius: 8,
      border: '1px solid var(--color-border)',
    }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'center', marginRight: 4 }}>
        {rows.length.toLocaleString()} total
      </span>
      {counts.map(([type, count]) => {
        const isHidden = hidden.has(type)
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              background: isHidden ? 'var(--color-bg)' : 'var(--color-bg)',
              borderRadius: 4,
              border: `1px solid ${isHidden ? 'var(--color-border)' : RUNE_COLORS[type] ?? 'var(--color-border)'}`,
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              opacity: isHidden ? 0.4 : 1,
              transition: 'opacity 150ms, border-color 150ms',
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: RUNE_COLORS[type] ?? '#888',
              flexShrink: 0,
            }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>{RUNE_LABELS[type] ?? type}</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{count.toLocaleString()}</span>
          </button>
        )
      })}
    </div>
  )
}

function RuneStackedChart({ rows, hidden }: { rows: RuneEvent[]; hidden: Set<string> }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; minute: number; breakdown: [string, number][]; total: number
  } | null>(null)

  const filtered = useMemo(() => rows.filter((r) => !hidden.has(r.type)), [rows, hidden])

  const { buckets, runeTypes, maxMinute, minMinute } = useMemo(() => {
    if (filtered.length === 0) return { buckets: new Map(), runeTypes: [] as string[], maxMinute: 0, minMinute: 0 }
    const bk = new Map<number, Map<string, number>>()
    const typeSet = new Set<string>()
    for (const r of filtered) {
      const m = Math.floor(r.time / 60)
      if (!bk.has(m)) bk.set(m, new Map())
      const mb = bk.get(m)!
      mb.set(r.type, (mb.get(r.type) ?? 0) + 1)
      typeSet.add(r.type)
    }
    const mins = [...bk.keys()]
    return {
      buckets: bk,
      runeTypes: [...typeSet].sort(),
      minMinute: Math.min(...mins),
      maxMinute: Math.max(...mins),
    }
  }, [filtered])

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    if (runeTypes.length === 0) {
      svg.attr('width', 0).attr('height', 0)
      return
    }

    const container = containerRef.current
    const width = container.clientWidth
    const height = 280
    const margin = { top: 16, right: 16, bottom: 36, left: 48 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const minutes: number[] = []
    for (let m = minMinute; m <= maxMinute; m++) minutes.push(m)

    const stackData = minutes.map((m) => {
      const mb = buckets.get(m)
      const row: Record<string, number> = { minute: m }
      for (const t of runeTypes) row[t] = mb?.get(t) ?? 0
      return row
    })

    const stack = d3.stack<Record<string, number>>().keys(runeTypes).order(d3.stackOrderNone)
    const series = stack(stackData)

    const maxY = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 1

    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand<number>().domain(minutes).range([0, innerW]).padding(0.15)
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0])

    g.selectAll('g.layer')
      .data(series)
      .join('g')
      .attr('class', 'layer')
      .attr('fill', (d) => RUNE_COLORS[d.key] ?? '#888')
      .selectAll('rect')
      .data((d) => d)
      .join('rect')
      .attr('x', (d) => x(d.data.minute as number) ?? 0)
      .attr('y', (d) => y(d[1]))
      .attr('height', (d) => y(d[0]) - y(d[1]))
      .attr('width', x.bandwidth())
      .attr('rx', 1)

    g.selectAll('rect.overlay')
      .data(minutes)
      .join('rect')
      .attr('class', 'overlay')
      .attr('x', (m) => x(m) ?? 0)
      .attr('y', 0)
      .attr('width', x.bandwidth())
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, m) {
        const mb = buckets.get(m)
        const breakdown: [string, number][] = []
        let total = 0
        for (const t of runeTypes) {
          const c = mb?.get(t) ?? 0
          if (c > 0) { breakdown.push([t, c]); total += c }
        }
        breakdown.sort((a, b) => b[1] - a[1])
        const rect = container.getBoundingClientRect()
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, minute: m, breakdown, total })
      })
      .on('mousemove', function (event, m) {
        const mb = buckets.get(m)
        const breakdown: [string, number][] = []
        let total = 0
        for (const t of runeTypes) {
          const c = mb?.get(t) ?? 0
          if (c > 0) { breakdown.push([t, c]); total += c }
        }
        breakdown.sort((a, b) => b[1] - a[1])
        const rect = container.getBoundingClientRect()
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, minute: m, breakdown, total })
      })
      .on('mouseleave', () => setTooltip(null))

    const xAxis = d3.axisBottom(x)
      .tickValues(minutes.filter((m) => m % 5 === 0))
      .tickFormat((d) => `${d}`)

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '0.65rem')
      .attr('font-family', 'var(--font-mono)')

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '0.65rem')
      .attr('font-family', 'var(--font-mono)')

    g.selectAll('.domain, .tick line').attr('stroke', 'var(--color-border)')

    svg.append('text')
      .attr('x', width / 2).attr('y', height - 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text-muted)')
      .attr('font-size', '0.7rem')
      .attr('font-family', 'var(--font-mono)')
      .text('Game Minute')
  }, [buckets, runeTypes, minMinute, maxMinute])

  useEffect(() => {
    draw()
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  if (rows.length === 0) return null

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          Rune Pickups by Type
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {runeTypes.sort().map((t) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: RUNE_COLORS[t] ?? '#888' }} />
              {RUNE_LABELS[t] ?? t}
            </span>
          ))}
        </div>
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
          <div style={{ marginBottom: 3 }}>
            Minute <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{tooltip.minute}</span>
            <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>{tooltip.total} total</span>
          </div>
          {tooltip.breakdown.map(([type, count]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: RUNE_COLORS[type] ?? '#888' }} />
              <span>{RUNE_LABELS[type] ?? type}</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 8 }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const columns: ColumnDef<RuneEvent, unknown>[] = [
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
    accessorFn: (row) => heroesById[String(row.player.hero)]?.name ?? `Hero ${row.player.hero}`,
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.player.hero} />,
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
    size: 80,
    meta: { numeric: true, tooltip: 'Pickup Time' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'Type',
    size: 120,
    cell: ({ getValue }) => <span style={{ fontSize: '0.8rem' }}>{capitalize(getValue() as string)}</span>,
  },
]

export default function EventRunes() {
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

  const { data, isLoading, error } = useApiQuery<{ data: RuneEvent[] }>(
    hasFilters ? '/api/events/runes' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Rune Pickups</h1>
        <p className={styles.subtitle}>
          Rune pickup events in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching rune data..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <RuneSummary rows={rows} hidden={hiddenTypes} onToggle={toggleType} />
          <RuneStackedChart rows={rows} hidden={hiddenTypes} />
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'matchId', desc: true }]}
            searchableColumns={['player', 'type']}
          />
        </>
      )}
    </div>
  )
}
