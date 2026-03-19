import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './PlayerPerformances.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface GameloopEntry {
  matchId: number
  teamName: string
  teamId: number
  teamLogoId: string | null
  victory: boolean
  duration: number
  events: { type: string; time: number; value?: number }[]
}

/* ── Event definitions ──────────────────────────────────── */

interface EventDef {
  id: string
  label: string
  color: string
  positiveType: string
  positiveLabel: string
  negativeType: string
  negativeLabel: string
}

const EVENT_DEFS: EventDef[] = [
  { id: 'tormentor1', label: 'Tormentor 1', color: '#6fa3ef', positiveType: 'tormentor_taken_1', positiveLabel: 'Torm Taken', negativeType: 'tormentor_lost_1', negativeLabel: 'Torm Lost' },
  { id: 'towers3', label: 'First 3 Towers', color: '#2dd4bf', positiveType: 'first_3_towers_taken', positiveLabel: '3T Taken', negativeType: 'first_3_towers_lost', negativeLabel: '3T Lost' },
  { id: 'roshan1', label: 'Roshan 1', color: '#4cce5b', positiveType: 'roshan_taken_1', positiveLabel: 'Rosh Taken', negativeType: 'roshan_lost_1', negativeLabel: 'Rosh Lost' },
  { id: 'tormentor2', label: 'Tormentor 2', color: '#8b9def', positiveType: 'tormentor_taken_2', positiveLabel: 'Torm 2', negativeType: 'tormentor_lost_2', negativeLabel: 'Torm 2 Lost' },
  { id: 'roshan2', label: 'Roshan 2', color: '#8bc48b', positiveType: 'roshan_taken_2', positiveLabel: 'Rosh 2', negativeType: 'roshan_lost_2', negativeLabel: 'Rosh 2 Lost' },
  { id: 't3tower', label: 'First T3 Tower', color: '#5ec4d4', positiveType: 'first_t3_taken', positiveLabel: 'T3 Taken', negativeType: 'first_t3_lost', negativeLabel: 'T3 Lost' },
  { id: 'barracks', label: 'First Barracks', color: '#d4a6e8', positiveType: 'first_barracks_taken', positiveLabel: 'Rax Taken', negativeType: 'first_barracks_lost', negativeLabel: 'Rax Lost' },
  { id: 'roshan3', label: 'Roshan 3', color: '#a3ce4c', positiveType: 'roshan_taken_3', positiveLabel: 'Rosh 3', negativeType: 'roshan_lost_3', negativeLabel: 'Rosh 3 Lost' },
]

const LANING_BUCKETS = [
  { id: 'won', label: 'Won Lane', test: (v: number) => v > 2000, color: '#19aa8d' },
  { id: 'drew', label: 'Drew Lane', test: (v: number) => v >= -2000 && v <= 2000, color: '#8b8da3' },
  { id: 'lost', label: 'Lost Lane', test: (v: number) => v < -2000, color: '#e44d4d' },
]

/** Max extra event nodes beyond the 5 fixed (start + 3 laning + end) */
const NODE_QUOTA = 15

/* ── Lookup: event type string → label & color ──────────── */

const EVENT_TYPE_INFO: Record<string, { label: string; color: string }> = {}
for (const ev of EVENT_DEFS) {
  EVENT_TYPE_INFO[ev.positiveType] = { label: ev.positiveLabel, color: '#2dd4bf' }
  EVENT_TYPE_INFO[ev.negativeType] = { label: ev.negativeLabel, color: '#e44d4d' }
}

/* ── DAG types ──────────────────────────────────────────── */

interface DagNode {
  id: string
  label: string
  color: string
  count: number       // games passing through this node
  medianTime: number  // for x-positioning
}

interface DagLink {
  sourceId: string
  targetId: string
  count: number
}

/* ── Build DAG ──────────────────────────────────────────── */

function median(arr: number[]): number {
  if (arr.length === 0) return Infinity
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function buildDag(
  rows: GameloopEntry[],
  hiddenEventIds: Set<string>,
  quota: number,
): { nodes: DagNode[]; links: DagLink[] } {
  const totalGames = rows.length
  if (totalGames === 0) return { nodes: [], links: [] }

  // Enabled event types (filter by hidden EventDef ids)
  const enabledTypes = new Set<string>()
  for (const ev of EVENT_DEFS) {
    if (hiddenEventIds.has(ev.id)) continue
    enabledTypes.add(ev.positiveType)
    enabledTypes.add(ev.negativeType)
  }

  // For each game, build its laning bucket + ordered event path
  type GamePath = {
    laningId: string
    orderedEvents: { type: string; time: number }[]
  }

  const gamePaths: GamePath[] = rows.map((r) => {
    const laningEv = r.events.find((e) => e.type === 'laning_outcome')
    const nw = laningEv?.value ?? 0
    const bucket = LANING_BUCKETS.find((b) => b.test(nw)) ?? LANING_BUCKETS[1]
    const orderedEvents = r.events
      .filter((e) => enabledTypes.has(e.type))
      .sort((a, b) => a.time - b.time)
    return { laningId: `laning:${bucket.id}`, orderedEvents }
  })

  // Count event type frequencies & collect timestamps
  const eventCounts = new Map<string, number>()
  const eventTimes = new Map<string, number[]>()
  for (const gp of gamePaths) {
    for (const ev of gp.orderedEvents) {
      eventCounts.set(ev.type, (eventCounts.get(ev.type) ?? 0) + 1)
      let times = eventTimes.get(ev.type)
      if (!times) { times = []; eventTimes.set(ev.type, times) }
      times.push(ev.time)
    }
  }

  // Pick top `quota` event types by frequency
  const selectedTypes = new Set(
    [...eventCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, quota)
      .map(([type]) => type),
  )

  // Build nodes
  const nodes: DagNode[] = []
  const nodeMap = new Map<string, DagNode>()

  function addNode(id: string, label: string, color: string, count: number, mTime: number) {
    const n: DagNode = { id, label, color, count, medianTime: mTime }
    nodes.push(n)
    nodeMap.set(id, n)
  }

  // Start
  addNode('start', 'Start', '#c48bc4', totalGames, -Infinity)

  // Laning nodes
  for (const bucket of LANING_BUCKETS) {
    const count = gamePaths.filter((gp) => gp.laningId === `laning:${bucket.id}`).length
    if (count > 0) addNode(`laning:${bucket.id}`, bucket.label, bucket.color, count, 0)
  }

  // Event nodes (top N by frequency)
  for (const type of selectedTypes) {
    const info = EVENT_TYPE_INFO[type]
    if (!info) continue
    const times = eventTimes.get(type) ?? []
    addNode(`ev:${type}`, info.label, info.color, eventCounts.get(type) ?? 0, median(times))
  }

  // End
  addNode('end', 'End', '#c48bc4', totalGames, Infinity)

  // Build links by tracing each game's path through selected nodes
  const linkCounts = new Map<string, number>()

  for (const gp of gamePaths) {
    const path: string[] = ['start', gp.laningId]
    for (const ev of gp.orderedEvents) {
      if (selectedTypes.has(ev.type)) path.push(`ev:${ev.type}`)
    }
    path.push('end')

    for (let i = 0; i < path.length - 1; i++) {
      // Skip if node was pruned (e.g. laning bucket with 0 games shouldn't happen but guard)
      if (!nodeMap.has(path[i]) || !nodeMap.has(path[i + 1])) continue
      const key = `${path[i]}|${path[i + 1]}`
      linkCounts.set(key, (linkCounts.get(key) ?? 0) + 1)
    }
  }

  const links: DagLink[] = [...linkCounts.entries()].map(([key, count]) => {
    const [sourceId, targetId] = key.split('|')
    return { sourceId, targetId, count }
  })

  return { nodes, links }
}

/* ── Event toggles ─────────────────────────────────────── */

function EventSummary({
  rows,
  hidden,
  onToggle,
}: {
  rows: GameloopEntry[]
  hidden: Set<string>
  onToggle: (id: string) => void
}) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const ev of EVENT_DEFS) {
      let count = 0
      for (const row of rows) {
        if (row.events.some((e) => e.type === ev.positiveType || e.type === ev.negativeType)) count++
      }
      map[ev.id] = count
    }
    return map
  }, [rows])

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 16,
      padding: '10px 14px',
      background: 'var(--color-bg-elevated)',
      borderRadius: 8,
      border: '1px solid var(--color-border)',
    }}>
      <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', alignSelf: 'center', marginRight: 4 }}>
        Events:
      </span>
      {EVENT_DEFS.map((ev) => {
        const isHidden = hidden.has(ev.id)
        return (
          <button
            key={ev.id}
            onClick={() => onToggle(ev.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              borderRadius: 4,
              border: '1px solid',
              borderColor: isHidden ? 'var(--color-border)' : ev.color,
              background: isHidden ? 'transparent' : `${ev.color}18`,
              color: isHidden ? 'var(--color-text-muted)' : 'var(--color-text)',
              opacity: isHidden ? 0.4 : 1,
              cursor: 'pointer',
              transition: 'all 200ms',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
            {ev.label}
            <span style={{ fontWeight: 600 }}>{counts[ev.id]}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── DAG chart ─────────────────────────────────────────── */

interface SimNode extends d3.SimulationNodeDatum {
  nodeId: string
  label: string
  color: string
  count: number
  fx: number  // fixed x
}

function GameloopChart({
  rows,
  hidden,
  outcome,
}: {
  rows: GameloopEntry[]
  hidden: Set<string>
  outcome: 'wins' | 'losses'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const filteredRows = useMemo(
    () => rows.filter((r) => (outcome === 'wins' ? r.victory : !r.victory)),
    [rows, outcome],
  )

  const dag = useMemo(
    () => buildDag(filteredRows, hidden, NODE_QUOTA),
    [filteredRows, hidden],
  )

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || dag.nodes.length === 0) return

    const containerWidth = containerRef.current.clientWidth
    const margin = { top: 50, right: 100, bottom: 50, left: 100 }
    const width = containerWidth - margin.left - margin.right
    const totalGames = filteredRows.length

    // Compute x positions from medianTime
    const eventNodes = dag.nodes.filter((n) => n.medianTime > -Infinity && n.medianTime < Infinity && n.medianTime !== 0)
    const eventTimes = eventNodes.map((n) => n.medianTime)
    const minT = eventTimes.length > 0 ? Math.min(...eventTimes) : 0
    const maxT = eventTimes.length > 0 ? Math.max(...eventTimes) : 1

    function xFor(n: DagNode): number {
      if (n.medianTime === -Infinity) return 0                    // start
      if (n.medianTime === Infinity) return width                  // end
      if (n.medianTime === 0) return width * 0.10                  // laning
      if (maxT === minT) return width * 0.5
      return width * (0.18 + 0.72 * (n.medianTime - minT) / (maxT - minT))
    }

    // Group nodes into vertical columns by approximate x position
    const xBuckets = new Map<number, DagNode[]>()
    for (const n of dag.nodes) {
      const bx = Math.round(xFor(n) / 50) * 50
      let list = xBuckets.get(bx)
      if (!list) { list = []; xBuckets.set(bx, list) }
      list.push(n)
    }

    // Find the tallest column to determine height
    let maxColSize = 1
    for (const [, group] of xBuckets) {
      maxColSize = Math.max(maxColSize, group.length)
    }
    // At least 80px per node in the tallest column, minimum 600px
    const height = Math.max(600, maxColSize * 80)

    const totalW = containerWidth
    const totalH = height + margin.top + margin.bottom

    // Seed y positions: evenly distribute within each column
    const seedY = new Map<string, number>()
    for (const [, group] of xBuckets) {
      const spacing = height / (group.length + 1)
      group.forEach((n, i) => seedY.set(n.id, spacing * (i + 1)))
    }

    // Build simulation nodes with fixed x
    const simNodes: SimNode[] = dag.nodes.map((n) => ({
      nodeId: n.id,
      label: n.label,
      color: n.color,
      count: n.count,
      fx: xFor(n),
      x: xFor(n),
      y: seedY.get(n.id) ?? height / 2,
    }))

    const simNodeMap = new Map(simNodes.map((sn) => [sn.nodeId, sn]))

    // Simulation links
    type SimLink = d3.SimulationLinkDatum<SimNode> & { count: number }
    const simLinks: SimLink[] = dag.links
      .filter((l) => simNodeMap.has(l.sourceId) && simNodeMap.has(l.targetId))
      .map((l) => ({
        source: simNodeMap.get(l.sourceId)!,
        target: simNodeMap.get(l.targetId)!,
        count: l.count,
      }))

    // Run force simulation (x fixed, y free)
    // No centering force — rely on seeded positions + collision to keep spread
    const sim = d3.forceSimulation(simNodes)
      .force('collide', d3.forceCollide<SimNode>(58))
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).strength(0.08).distance(60))
      .stop()

    for (let i = 0; i < 400; i++) sim.tick()

    // Clamp y within bounds
    for (const sn of simNodes) {
      sn.y = Math.max(40, Math.min(height - 40, sn.y!))
    }

    // Render
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', totalW).attr('height', totalH)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Build adjacency index for quick lookup on hover
    const inLinks = new Map<string, SimLink[]>()   // nodeId → links arriving at it
    const outLinks = new Map<string, SimLink[]>()  // nodeId → links leaving it

    // Links
    const linkPaths = g.selectAll('path.dag-link')
      .data(simLinks)
      .join('path')
      .attr('class', 'dag-link')
      .attr('d', (d) => {
        const s = d.source as SimNode
        const t = d.target as SimNode
        const sx = s.x!, sy = s.y!, tx = t.x!, ty = t.y!
        const mx = (sx + tx) / 2
        return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`
      })
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-text-muted)')
      .attr('stroke-width', (d) => Math.max(1.5, (d.count / totalGames) * 40))
      .attr('stroke-opacity', (d) => 0.08 + 0.25 * (d.count / totalGames))

    // Populate adjacency after links are built
    for (const sl of simLinks) {
      const sId = (sl.source as SimNode).nodeId
      const tId = (sl.target as SimNode).nodeId
      if (!outLinks.has(sId)) outLinks.set(sId, [])
      outLinks.get(sId)!.push(sl)
      if (!inLinks.has(tId)) inLinks.set(tId, [])
      inLinks.get(tId)!.push(sl)
    }

    // Nodes
    const nodeGroups = g.selectAll('g.node')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')

    nodeGroups.each(function (d) {
      const el = d3.select(this)
      const isTerminal = d.nodeId === 'start' || d.nodeId === 'end'

      if (isTerminal) {
        el.append('circle')
          .attr('r', 26)
          .attr('fill', d.color)
          .attr('fill-opacity', 0.25)
          .attr('stroke', d.color)
          .attr('stroke-width', 2)
      } else {
        const pillW = Math.max(90, Math.min(140, d.label.length * 8.5 + 28))
        const pillH = 30
        el.append('rect')
          .attr('x', -pillW / 2)
          .attr('y', -pillH / 2)
          .attr('width', pillW)
          .attr('height', pillH)
          .attr('rx', pillH / 2)
          .attr('fill', d.color)
          .attr('fill-opacity', 0.2)
          .attr('stroke', d.color)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', 1)
      }

      const pct = totalGames > 0 ? ((d.count / totalGames) * 100).toFixed(0) : '0'

      el.append('text')
        .attr('dy', isTerminal ? '-0.1em' : '-0.2em')
        .attr('text-anchor', 'middle')
        .style('font-size', isTerminal ? '0.85rem' : '0.74rem')
        .style('font-family', 'var(--font-mono)')
        .style('font-weight', '600')
        .style('fill', 'var(--color-text)')
        .text(d.nodeId === 'end' ? (outcome === 'wins' ? 'Victory' : 'Defeat') : d.label)

      if (!isTerminal) {
        el.append('text')
          .attr('dy', '1.1em')
          .attr('text-anchor', 'middle')
          .style('font-size', '0.58rem')
          .style('font-family', 'var(--font-mono)')
          .style('fill', 'var(--color-text-muted)')
          .text(`${d.count} (${pct}%)`)
      }
    })

    // Node hover: highlight connected links, dim others, show breakdown tooltip
    nodeGroups
      .on('mouseenter', function (event: MouseEvent, d) {
        const nodeId = d.nodeId
        const connectedIds = new Set<string>([nodeId])
        const ins = inLinks.get(nodeId) ?? []
        const outs = outLinks.get(nodeId) ?? []
        for (const l of ins) connectedIds.add((l.source as SimNode).nodeId)
        for (const l of outs) connectedIds.add((l.target as SimNode).nodeId)

        // Dim all links, brighten connected ones
        linkPaths
          .attr('stroke-opacity', (l) => {
            const sId = (l.source as SimNode).nodeId
            const tId = (l.target as SimNode).nodeId
            if (sId === nodeId || tId === nodeId) return 0.7
            return 0.03
          })
          .attr('stroke', (l) => {
            const sId = (l.source as SimNode).nodeId
            const tId = (l.target as SimNode).nodeId
            if (sId === nodeId) return '#c48bc4'     // outgoing
            if (tId === nodeId) return '#6fa3ef'     // incoming
            return 'var(--color-text-muted)'
          })

        // Dim unconnected nodes
        nodeGroups.style('opacity', (nd) => connectedIds.has(nd.nodeId) ? 1 : 0.2)

        // Build tooltip with in/out breakdown
        showNodeTooltip(event, d, ins, outs, totalGames)
      })
      .on('mousemove', function (event: MouseEvent) {
        const tooltip = tooltipRef.current
        if (!tooltip || !svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        tooltip.style.left = `${event.clientX - rect.left + 14}px`
        tooltip.style.top = `${event.clientY - rect.top - 10}px`
      })
      .on('mouseleave', function () {
        // Restore all links
        linkPaths
          .attr('stroke-opacity', (l) => 0.08 + 0.25 * (l.count / totalGames))
          .attr('stroke', 'var(--color-text-muted)')
        nodeGroups.style('opacity', 1)
        hideTooltip()
      })

    function labelFor(sn: SimNode): string {
      if (sn.nodeId === 'end') return outcome === 'wins' ? 'Victory' : 'Defeat'
      return sn.label
    }

    function showNodeTooltip(
      event: MouseEvent,
      d: SimNode,
      ins: SimLink[],
      outs: SimLink[],
      total: number,
    ) {
      const tooltip = tooltipRef.current
      if (!tooltip || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      tooltip.style.display = 'block'
      tooltip.style.left = `${event.clientX - rect.left + 14}px`
      tooltip.style.top = `${event.clientY - rect.top - 10}px`

      const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0'
      const displayLabel = labelFor(d)

      let html = `<div style="font-weight:700;margin-bottom:5px;font-size:0.78rem">${displayLabel}</div>`
      html += `<div style="margin-bottom:6px"><strong>${d.count}</strong> games (${pct}%)</div>`

      // Inbound
      if (ins.length > 0) {
        const totalIn = ins.reduce((s, l) => s + l.count, 0)
        html += `<div style="font-weight:600;color:#6fa3ef;margin-bottom:2px;font-size:0.68rem">Inbound (${totalIn})</div>`
        const sorted = [...ins].sort((a, b) => b.count - a.count)
        for (const l of sorted) {
          const src = l.source as SimNode
          const p = totalIn > 0 ? ((l.count / totalIn) * 100).toFixed(0) : '0'
          html += `<div style="padding-left:8px;font-size:0.65rem;color:var(--color-text-secondary)">${labelFor(src)} → <strong>${l.count}</strong> (${p}%)</div>`
        }
      }

      // Outbound
      if (outs.length > 0) {
        const totalOut = outs.reduce((s, l) => s + l.count, 0)
        html += `<div style="font-weight:600;color:#c48bc4;margin-top:5px;margin-bottom:2px;font-size:0.68rem">Outbound (${totalOut})</div>`
        const sorted = [...outs].sort((a, b) => b.count - a.count)
        for (const l of sorted) {
          const tgt = l.target as SimNode
          const p = totalOut > 0 ? ((l.count / totalOut) * 100).toFixed(0) : '0'
          html += `<div style="padding-left:8px;font-size:0.65rem;color:var(--color-text-secondary)">→ ${labelFor(tgt)} <strong>${l.count}</strong> (${p}%)</div>`
        }
      }

      tooltip.innerHTML = html
    }

    function hideTooltip() {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none'
    }
  }, [dag, filteredRows.length, outcome])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [draw])

  if (filteredRows.length === 0) return null

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
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
  )
}

/* ── Page component ─────────────────────────────────────── */

const DEFAULT_HIDDEN = new Set(['tormentor2', 'roshan2', 'roshan3'])

const ALL_EVENT_IDS = EVENT_DEFS.map((e) => e.id)

/**
 * Hash format: #outcome,event1,event2,...
 * where event list = enabled event ids.
 * e.g. #wins,tormentor1,towers3,roshan1,t3tower,barracks
 * If no hash or no events portion, use defaults.
 */
function parseHash(): { outcome: 'wins' | 'losses'; hidden: Set<string> } {
  const raw = window.location.hash.replace('#', '')
  if (!raw) return { outcome: 'wins', hidden: new Set(DEFAULT_HIDDEN) }

  const parts = raw.split(',')
  const outcome: 'wins' | 'losses' = parts[0] === 'losses' ? 'losses' : 'wins'

  // If only outcome in hash (no event ids listed), use defaults
  if (parts.length <= 1) return { outcome, hidden: new Set(DEFAULT_HIDDEN) }

  // Events portion: listed ids are the ENABLED ones
  const enabled = new Set(parts.slice(1))
  const hidden = new Set(ALL_EVENT_IDS.filter((id) => !enabled.has(id)))
  return { outcome, hidden }
}

function writeHash(outcome: 'wins' | 'losses', hidden: Set<string>) {
  const enabled = ALL_EVENT_IDS.filter((id) => !hidden.has(id))
  window.history.replaceState(null, '', `#${outcome},${enabled.join(',')}`)
}

export default function ScenarioGameloop() {
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

  const { data, isLoading, error, refetch } = useApiQuery<{ data: GameloopEntry[] }>(
    hasFilters ? '/api/scenarios/gameloop' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  const [outcome, setOutcome] = useState<'wins' | 'losses'>(() => parseHash().outcome)
  const [hiddenEvents, setHiddenEvents] = useState<Set<string>>(() => parseHash().hidden)

  const changeOutcome = useCallback((o: 'wins' | 'losses') => {
    setOutcome(o)
    setHiddenEvents((prev) => { writeHash(o, prev); return prev })
  }, [])

  const toggleEvent = useCallback((id: string) => {
    setHiddenEvents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setOutcome((curOutcome) => { writeHash(curOutcome, next); return curOutcome })
      return next
    })
  }, [])

  const winCount = useMemo(() => rows.filter((r) => r.victory).length, [rows])
  const lossCount = useMemo(() => rows.length - winCount, [rows, winCount])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Game Loop</h1>
        <p className={styles.subtitle}>
          How games flow through key events — laning, objectives, and outcomes
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching game loop data..." />}

      {error && hasFilters && (
        <ErrorState
          message="Failed to load data"
          detail="Something went wrong fetching game loop data. This can happen if your IP is blocked."
          rawDetail={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
            padding: '10px 14px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ color: 'var(--color-text-muted)' }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{rows.length.toLocaleString()}</span> team appearances
            </span>

            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button
                onClick={() => changeOutcome('wins')}
                style={{
                  padding: '4px 14px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: outcome === 'wins' ? 'var(--color-win)' : 'var(--color-border)',
                  background: outcome === 'wins' ? 'rgba(25,170,141,0.15)' : 'transparent',
                  color: outcome === 'wins' ? 'var(--color-win)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
              >
                Wins ({winCount})
              </button>
              <button
                onClick={() => changeOutcome('losses')}
                style={{
                  padding: '4px 14px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: outcome === 'losses' ? 'var(--color-loss)' : 'var(--color-border)',
                  background: outcome === 'losses' ? 'rgba(228,77,77,0.15)' : 'transparent',
                  color: outcome === 'losses' ? 'var(--color-loss)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
              >
                Losses ({lossCount})
              </button>
            </div>
          </div>

          <EventSummary rows={rows} hidden={hiddenEvents} onToggle={toggleEvent} />
          <GameloopChart rows={rows} hidden={hiddenEvents} outcome={outcome} />
        </>
      )}
    </div>
  )
}
