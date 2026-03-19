import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroesById[String(heroId)]?.picture
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img src={src} alt="" style={{ width: 28, height: 16, objectFit: 'cover', borderRadius: 2 }} loading="lazy" />
  ) : null
}

interface BuildingDeath {
  matchId: number
  hero: number
  killer: { nickname: string; steamId: number }
  denier: { nickname: string; steamId: number } | null
  time: number
  isJungleShrine: boolean
  lane: string
  type: string
  tier: number | null
  isMelee: boolean | null
  team: { name: string; valveId: number }
  opponent: { name: string; valveId: number }
}

function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function buildingKey(row: BuildingDeath): string {
  const t = (row.type ?? 'Unknown').toUpperCase()
  const lane = row.lane ?? ''
  const tier = row.tier

  if (t === 'RAX') {
    const kind = row.isMelee === true ? 'Melee' : row.isMelee === false ? 'Ranged' : ''
    const laneName = lane ? capitalize(lane.toLowerCase()) : ''
    const parts = [kind || 'Rax', 'Rax']
    if (kind) parts.splice(1, 0) // already have "Melee Rax" or "Ranged Rax"
    const label = kind ? `${kind} Rax` : 'Rax'
    return laneName ? `${label} ${laneName}` : label
  }
  if (t === 'SHRINE') {
    return 'Shrine'
  }

  // TOWER
  const parts = ['Tower']
  if (tier != null) parts.push(`T${tier}`)
  if (lane) parts.push(capitalize(lane.toLowerCase()))
  return parts.join(' ')
}

const BUILDING_COLORS: Record<string, string> = {
  'Tower T1 Top': '#5ec4d4',
  'Tower T1 Middle': '#6fa3ef',
  'Tower T1 Bottom': '#8b6fe0',
  'Tower T2 Top': '#2dd4bf',
  'Tower T2 Middle': '#4a9eff',
  'Tower T2 Bottom': '#a07ae8',
  'Tower T3 Top': '#19aa8d',
  'Tower T3 Middle': '#3578cc',
  'Tower T3 Bottom': '#7c5cbf',
  'Tower T4 Top': '#0d8872',
  'Tower T4 Middle': '#2a5da6',
  'Tower T4 Bottom': '#6344a0',
  'Melee Rax Top': '#f5a623',
  'Melee Rax Middle': '#e8853a',
  'Melee Rax Bottom': '#d4654e',
  'Ranged Rax Top': '#d4c24e',
  'Ranged Rax Middle': '#c4a63a',
  'Ranged Rax Bottom': '#b4884e',
  'Rax Top': '#f5a623',
  'Rax Middle': '#e8853a',
  'Rax Bottom': '#d4654e',
  'Shrine': '#c48bc4',
}

function getColor(key: string): string {
  return BUILDING_COLORS[key] ?? '#888'
}

const columns: ColumnDef<BuildingDeath, unknown>[] = [
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
    id: 'time',
    accessorKey: 'time',
    header: 'Time',
    size: 80,
    meta: { numeric: true, tooltip: 'Game Time' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'killerHero',
    accessorKey: 'hero',
    header: 'K Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => row.original.killer?.steamId ? <HeroIconCell heroId={row.original.hero} /> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
  },
  {
    id: 'killerName',
    accessorFn: (row) => row.killer?.nickname ?? '',
    header: 'Killer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => {
      const k = row.original.killer
      if (!k?.steamId) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return <PlayerCell steamId={k.steamId} nickname={k.nickname} />
    },
  },
  {
    id: 'teamName',
    accessorFn: (row) => row.team.name,
    header: 'Owner',
    size: 150,
    enableSorting: false,
    cell: ({ row }) => (
      <a href={`/teams/${row.original.team.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {row.original.team.name}
      </a>
    ),
  },
  {
    id: 'opponentName',
    accessorFn: (row) => row.opponent.name,
    header: 'Opponent',
    size: 150,
    enableSorting: false,
    cell: ({ row }) => (
      <a href={`/teams/${row.original.opponent.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {row.original.opponent.name}
      </a>
    ),
  },
  {
    id: 'type',
    accessorFn: (row) => {
      const t = (row.type ?? '').toUpperCase()
      if (t === 'RAX') return row.isMelee === true ? 'Melee Rax' : row.isMelee === false ? 'Ranged Rax' : 'Rax'
      return capitalize(row.type ?? '')
    },
    header: 'Type',
    size: 100,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem' }}>{String(getValue())}</span>
    ),
  },
  {
    id: 'tier',
    accessorKey: 'tier',
    header: 'Tier',
    size: 60,
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const v = getValue()
      return (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
          {v != null ? String(v) : '—'}
        </span>
      )
    },
  },
  {
    id: 'lane',
    accessorKey: 'lane',
    header: 'Lane',
    size: 80,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem' }}>{capitalize(String(getValue()))}</span>
    ),
  },
  {
    id: 'denied',
    accessorFn: (row) => row.denier?.steamId != null,
    header: 'Denied',
    size: 70,
    cell: ({ getValue }) => (getValue() as boolean)
      ? <span style={{ color: '#2dd4bf', fontWeight: 600 }}>✓</span>
      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
  },
]

function BuildingSummary({ rows, hidden, onToggle }: { rows: BuildingDeath[]; hidden: Set<string>; onToggle: (key: string) => void }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const key = buildingKey(r)
      m.set(key, (m.get(key) ?? 0) + 1)
    }
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
      {counts.map(([key, count]) => {
        const isHidden = hidden.has(key)
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              background: 'var(--color-bg)',
              borderRadius: 4,
              border: `1px solid ${isHidden ? 'var(--color-border)' : getColor(key)}`,
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
              background: getColor(key),
              flexShrink: 0,
            }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>{key}</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{count.toLocaleString()}</span>
          </button>
        )
      })}
    </div>
  )
}

function BuildingStackedChart({ rows, hidden }: { rows: BuildingDeath[]; hidden: Set<string> }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; minute: number; breakdown: [string, number][]; total: number
  } | null>(null)

  const filtered = useMemo(() => rows.filter((r) => !hidden.has(buildingKey(r))), [rows, hidden])

  const { buckets, buildingTypes, maxMinute, minMinute } = useMemo(() => {
    if (filtered.length === 0) return { buckets: new Map<number, Map<string, number>>(), buildingTypes: [] as string[], maxMinute: 0, minMinute: 0 }
    const bk = new Map<number, Map<string, number>>()
    const typeSet = new Set<string>()
    for (const r of filtered) {
      const m = Math.floor(r.time / 60)
      if (!bk.has(m)) bk.set(m, new Map())
      const mb = bk.get(m)!
      const key = buildingKey(r)
      mb.set(key, (mb.get(key) ?? 0) + 1)
      typeSet.add(key)
    }
    const mins = [...bk.keys()]
    return {
      buckets: bk,
      buildingTypes: [...typeSet].sort(),
      minMinute: Math.min(...mins),
      maxMinute: Math.max(...mins),
    }
  }, [filtered])

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    if (buildingTypes.length === 0) {
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
      for (const t of buildingTypes) row[t] = mb?.get(t) ?? 0
      return row
    })

    const stack = d3.stack<Record<string, number>>().keys(buildingTypes).order(d3.stackOrderNone)
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
      .attr('fill', (d) => getColor(d.key))
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
        for (const t of buildingTypes) {
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
        for (const t of buildingTypes) {
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
  }, [buckets, buildingTypes, minMinute, maxMinute])

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
          Building Deaths by Type
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {buildingTypes.sort().map((t) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: getColor(t) }} />
              {t}
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
              <span style={{ width: 6, height: 6, borderRadius: 1, background: getColor(type) }} />
              <span>{type}</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 8 }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EventBuildings() {
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

  const { data, isLoading, error } = useApiQuery<{ data: BuildingDeath[] }>(
    hasFilters ? '/api/building/deaths' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())

  const toggleType = useCallback((key: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Building Deaths</h1>
        <p className={styles.subtitle}>
          Building destruction events in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'building-filters']}
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

      {isLoading && hasFilters && <EnigmaLoader text="Fetching building deaths..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <BuildingSummary rows={rows} hidden={hiddenTypes} onToggle={toggleType} />
          <BuildingStackedChart rows={rows} hidden={hiddenTypes} />
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'matchId', desc: true }]}
            searchableColumns={['killerName', 'teamName']}
          />
        </>
      )}
    </div>
  )
}
