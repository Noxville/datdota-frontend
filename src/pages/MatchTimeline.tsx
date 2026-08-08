import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { miniHeroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { TEAMFIGHT_TYPES as TF_TYPES, TEAMFIGHT_TYPE_COLORS as TF_COLOR, TEAMFIGHT_TYPE_LABELS as TF_LABEL, classifyTeamfight, type TeamfightType } from '../data/teamfightTypes'
import { fmtTime } from '../utils/format'
import shared from './MatchShow.module.css'
import styles from './MatchTimeline.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface TimelineFrame {
  t: number
  min: number
  nwLead: number
  xpLead: number
  towerDiff: number
  raxDiff: number
  radiantWinProb: number | null
}

interface TimelineDeath {
  hero: number
  side: 'radiant' | 'dire'
  time: number
}

interface TimelineEvent {
  type: 'teamfight' | 'tower' | 'rax' | 'roshan' | 'aegis' | 'tormentor' | 'buyback'
  time: number
  endTime?: number
  side?: 'radiant' | 'dire' | null
  lostBy?: string | null
  tier?: number | null
  hero?: number
  radiantHeroes?: number[]
  direHeroes?: number[]
  deaths?: TimelineDeath[]
  deathCount?: number
  nwLead: number
  radiantWinProb: number | null
}

interface TimelineSegment {
  type: 'laning' | 'farming' | 'teamfight'
  start: number
  end: number
  nwLeadStart: number
  nwLeadEnd: number
  nwSwing: number
  winProbStart: number | null
  winProbEnd: number | null
  winProbSwing: number | null
}

interface TimelineData {
  matchId: number
  patch: string
  radiantWin: boolean
  durationSecs: number
  modelFamily: string
  hasModel: boolean
  series: TimelineFrame[]
  events: TimelineEvent[]
  segments: TimelineSegment[]
}

type Metric = 'winprob' | 'networth'

const RADIANT = '#4ade80'
const DIRE = '#f87171'

// Plot horizontal margins — shared so the segment bar lines up with the chart's x-axis.
const M_LEFT = 46
const M_RIGHT = 12

const EVENT_LABEL: Record<string, string> = { tower: 'Tower', rax: 'Barracks', roshan: 'Roshan', aegis: 'Aegis', tormentor: 'Tormentor', buyback: 'Buyback', teamfight: 'Teamfight' }

type TfType = TeamfightType

function classifyTf(e: TimelineEvent): TfType {
  return classifyTeamfight(e.radiantHeroes?.length ?? 0, e.direHeroes?.length ?? 0)
}

/** Objective marker label — towers carry their tier (T1..T4). */
function eventGlyph(e: TimelineEvent): string {
  if (e.type === 'tower') return e.tier ? `T${e.tier}` : 'T'
  if (e.type === 'rax') return 'B'
  if (e.type === 'roshan') return 'R'
  if (e.type === 'aegis') return 'A'
  if (e.type === 'tormentor') return 'M'
  return '•'
}

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPic(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

const TF_TIPS: Record<TfType, string> = {
  BATTLE: 'Battle — a large fight, at least 4 heroes on each side.',
  SKIRMISH: 'Skirmish — a multi-hero fight that isn’t a full clash (fewer than 4v4).',
  GANK: 'Gank — one side caught with a lone hero (1 vs many).',
  SOLO: 'Solo — a 1v1 between two heroes.',
}

function fmtNw(v: number): string {
  return `${v >= 0 ? '+' : '−'}${d3.format('.3~s')(Math.abs(v))}`
}

/* ── Chart ──────────────────────────────────────────────── */

interface TipLine { text: string; color?: string; heroId?: number; header?: boolean; suffix?: string }
interface Tip { x: number; y: number; lines: TipLine[] }

function makeFightTip(event: MouseEvent, e: TimelineEvent, heroPlayers?: Map<number, string>): Tip {
  const type = classifyTf(e)
  const r = e.radiantHeroes?.length ?? 0
  const d = e.direHeroes?.length ?? 0
  const lines: TipLine[] = [
    { text: `${fmtTime(e.time)}–${fmtTime(e.endTime ?? e.time)} · ${TF_LABEL[type]}`, color: TF_COLOR[type] },
    { text: `${r} Radiant v ${d} Dire` },
  ]
  if (e.radiantWinProb != null) lines.push({ text: `Radiant ${Math.round(e.radiantWinProb * 100)}%`, color: RADIANT })
  const deaths = [...(e.deaths ?? [])].sort((a, b) => a.time - b.time)
  if (deaths.length) {
    const t0 = deaths[0].time
    lines.push({ text: 'Deaths', header: true })
    deaths.forEach((dth, i) => {
      lines.push({
        text: heroPlayers?.get(dth.hero) ?? heroName(dth.hero),
        color: dth.side === 'radiant' ? RADIANT : DIRE,
        heroId: dth.hero,
        suffix: i === 0 ? fmtTime(dth.time) : `+${Math.round(dth.time - t0)}s`,
      })
    })
  } else {
    lines.push({ text: 'No deaths' })
  }
  return { x: event.clientX, y: event.clientY, lines }
}

function makeEventTip(event: MouseEvent, e: TimelineEvent): Tip {
  const lines: TipLine[] = [
    { text: `${fmtTime(e.time)} · ${EVENT_LABEL[e.type] ?? e.type}${e.tier ? ` T${e.tier}` : ''}`, color: e.side === 'radiant' ? RADIANT : e.side === 'dire' ? DIRE : undefined },
  ]
  if (e.side) lines.push({ text: `${e.side}${e.lostBy ? ` (from ${e.lostBy})` : ''}` })
  if (e.radiantWinProb != null) lines.push({ text: `Radiant ${Math.round(e.radiantWinProb * 100)}%`, color: RADIANT })
  lines.push({ text: `NW ${fmtNw(e.nwLead)}`, color: e.nwLead >= 0 ? RADIANT : DIRE })
  return { x: event.clientX, y: event.clientY, lines }
}

function TimelineChart({ data, metric, visibleTypes, heroPlayers, xDomain, setXDomain }: {
  data: TimelineData
  metric: Metric
  visibleTypes: Set<TfType>
  heroPlayers?: Map<number, string>
  xDomain: [number, number] | null
  setXDomain: (d: [number, number] | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(0)
  const [tip, setTip] = useState<Tip | null>(null)
  const draggingRef = useRef(false)
  const dragStartRef = useRef<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((e) => setWidth(Math.max(0, e[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const series = data.series
  const objectives = useMemo(() => data.events.filter((e) => e.type !== 'teamfight' && e.type !== 'buyback'), [data.events])
  const fights = useMemo(() => data.events.filter((e) => e.type === 'teamfight'), [data.events])
  const buybacks = useMemo(() => data.events.filter((e) => e.type === 'buyback'), [data.events])

  useEffect(() => {
    if (!svgRef.current || width === 0 || series.length < 2) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const val = (f: TimelineFrame) => (metric === 'winprob' ? (f.radiantWinProb ?? 0.5) : f.nwLead)
    const base = metric === 'winprob' ? 0.5 : 0

    // Zoomed x-domain (seconds). null = whole game.
    const dom: [number, number] = xDomain ?? [0, data.durationSecs]
    const inX = (t: number) => t >= dom[0] && t <= dom[1]
    const fightInView = (f: TimelineEvent) => (f.endTime ?? f.time) >= dom[0] && f.time <= dom[1]

    // Death lanes: dire deaths above the plot (top), radiant deaths below the axis
    // (bottom) — a hero dying shifts the advantage toward the other side.
    const ICON = 13
    const STEP = ICON + 1
    const MAX_ICONS = 8
    const visibleFights = fights.filter((f) => visibleTypes.has(classifyTf(f)) && fightInView(f))
    const deathsOf = (f: TimelineEvent, side: 'radiant' | 'dire') => (f.deaths ?? []).filter((d) => d.side === side).slice(0, MAX_ICONS)
    const direMax = Math.min(MAX_ICONS, d3.max(visibleFights, (f) => deathsOf(f, 'dire').length) ?? 0)
    const radMax = Math.min(MAX_ICONS, d3.max(visibleFights, (f) => deathsOf(f, 'radiant').length) ?? 0)
    const direLaneH = direMax > 0 ? direMax * STEP + 2 : 0
    const radLaneH = radMax > 0 ? radMax * STEP + 2 : 0

    // Objectives split by who benefits: radiant-favouring (radiant took a building /
    // roshan / tormentor / holds aegis) go up top, dire-favouring at the bottom.
    const topObjs = objectives.filter((e) => e.side !== 'dire' && inX(e.time))
    const botObjs = objectives.filter((e) => e.side === 'dire' && inX(e.time))
    const pillLaneH = 18
    const objTopH = topObjs.length ? pillLaneH : 0
    const objBotH = botObjs.length ? pillLaneH : 0

    const m = { right: M_RIGHT, left: M_LEFT, bottom: 18 }
    const plotTop = direLaneH + objTopH
    const plotH = 270
    const plotBottom = plotTop + plotH
    const radDeathTop = plotBottom + m.bottom + objBotH + 2
    const h = plotBottom + m.bottom + objBotH + radLaneH
    svg.attr('width', width).attr('height', h)

    const x = d3.scaleLinear().domain(dom).range([m.left, width - m.right])
    let y: d3.ScaleLinear<number, number>
    if (metric === 'winprob') {
      y = d3.scaleLinear().domain([0, 1]).range([plotBottom, plotTop])
    } else {
      const maxAbs = d3.max(series, (f) => Math.abs(f.nwLead)) ?? 1
      y = d3.scaleLinear().domain([-maxAbs, maxAbs]).nice().range([plotBottom, plotTop])
    }

    // Clip plot content (line/area/bands) to the plot rect when zoomed.
    const clipId = `tl-clip-${metric}`
    svg.append('clipPath').attr('id', clipId).append('rect')
      .attr('x', m.left).attr('y', plotTop).attr('width', width - m.left - m.right).attr('height', plotH)

    // Highlight a fight (band + its death icons) on hover.
    const setFightHi = (fi: number, on: boolean) => {
      svg.selectAll<SVGElement, unknown>(`[data-fight="${fi}"]`).each(function () {
        const el = d3.select(this)
        if (el.attr('data-role') === 'band') {
          el.attr('opacity', on ? 0.34 : 0.16).attr('stroke', on ? el.attr('data-color') : 'none').attr('stroke-width', on ? 1.5 : 0)
        } else {
          el.attr('stroke-width', on ? 2.5 : 1)
        }
      })
    }

    // Selection rectangle (drag-to-zoom) — hidden until a drag starts.
    const selRect = svg.append('rect').attr('y', plotTop).attr('height', plotH)
      .attr('fill', 'var(--color-primary)').attr('opacity', 0.18).attr('pointer-events', 'none').attr('display', 'none')

    // Hover crosshair + drag-to-zoom capture rect — drawn below the bands so
    // teamfight bands sit above it and receive their own hover.
    const node = svgRef.current
    const bisect = d3.bisector<TimelineFrame, number>((f) => f.t).center
    const clampX = (px: number) => Math.max(m.left, Math.min(width - m.right, px))
    // SVG x from a viewport clientX (svg is rendered 1:1 with its attr width).
    const svgX = (clientX: number) => clampX(clientX - (node?.getBoundingClientRect().left ?? 0))
    svg.append('rect').attr('x', m.left).attr('y', plotTop).attr('width', width - m.left - m.right).attr('height', plotH)
      .attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('pointerdown', (event: PointerEvent) => {
        if (event.button !== 0) return
        event.preventDefault()
        node?.setPointerCapture(event.pointerId) // guarantees move/up reach us off-edge
        dragStartRef.current = svgX(event.clientX)
        draggingRef.current = true
        setTip(null)
      })
      .on('mousemove', (event: MouseEvent) => {
        if (draggingRef.current) return
        const f = series[bisect(series, x.invert(d3.pointer(event, node)[0]))]
        if (!f) return
        setTip({
          x: event.clientX, y: event.clientY,
          lines: [
            { text: fmtTime(f.t) },
            ...(f.radiantWinProb != null ? [{ text: `Radiant ${Math.round(f.radiantWinProb * 100)}%`, color: RADIANT }] : []),
            { text: `NW ${fmtNw(f.nwLead)}`, color: f.nwLead >= 0 ? RADIANT : DIRE },
          ],
        })
      })
      .on('mouseleave', () => { if (!draggingRef.current) setTip(null) })
    // With the pointer captured on the svg, these fire even off the chart edge.
    svg.on('pointermove', (event: PointerEvent) => {
      if (!draggingRef.current || dragStartRef.current == null) return
      const mx = svgX(event.clientX)
      selRect.attr('x', Math.min(dragStartRef.current, mx)).attr('width', Math.abs(mx - dragStartRef.current)).attr('display', null)
    })
    svg.on('pointerup', (event: PointerEvent) => {
      if (!draggingRef.current || dragStartRef.current == null) return
      const start = dragStartRef.current
      draggingRef.current = false
      dragStartRef.current = null
      selRect.attr('display', 'none')
      const mx = svgX(event.clientX)
      const a = Math.min(start, mx)
      const b = Math.max(start, mx)
      if (b - a > 6) {
        const t0 = Math.max(0, x.invert(a))
        const t1 = Math.min(data.durationSecs, x.invert(b))
        if (t1 - t0 > 5) setXDomain([t0, t1])
      }
    })

    // Teamfight bands, coloured by type, filtered by the visible-type set
    visibleFights.forEach((f, fi) => {
      const tfType = classifyTf(f)
      const x0 = Math.max(m.left, x(f.time))
      const x1 = Math.min(width - m.right, x(f.endTime ?? f.time + 20))
      svg.append('rect').attr('x', x0).attr('y', plotTop).attr('width', Math.max(2, x1 - x0)).attr('height', plotH)
        .attr('fill', TF_COLOR[tfType]).attr('opacity', 0.16).style('cursor', 'pointer')
        .attr('data-fight', fi).attr('data-role', 'band').attr('data-color', TF_COLOR[tfType])
        .on('mouseenter', (event: MouseEvent) => { if (draggingRef.current) return; setTip(makeFightTip(event, f, heroPlayers)); setFightHi(fi, true) })
        .on('mousemove', (event: MouseEvent) => setTip((t) => (t ? { ...t, x: event.clientX, y: event.clientY } : null)))
        .on('mouseleave', () => { setTip(null); setFightHi(fi, false) })
    })

    // Axes — tick step adapts to the zoomed span.
    const span = dom[1] - dom[0]
    const xStep = span <= 600 ? 60 : span <= 2400 ? 300 : 600
    const xTicks = d3.range(Math.ceil(dom[0] / xStep) * xStep, dom[1] + 1, xStep)
    svg.append('g').attr('transform', `translate(0,${plotBottom})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat((d) => `${Math.round((d as number) / 60)}m`) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)
    const yAxis = metric === 'winprob'
      ? d3.axisLeft(y).tickValues([0, 0.25, 0.5, 0.75, 1]).tickFormat((d) => `${Math.round((d as number) * 100)}%`)
      : d3.axisLeft(y).ticks(5).tickFormat((d) => fmtNw(d as number))
    svg.append('g').attr('transform', `translate(${m.left},0)`).call(yAxis as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)

    // Baseline (50% / 0). Visual layers set pointer-events:none so the crosshair
    // capture rect / teamfight bands underneath still receive hover.
    svg.append('line').attr('x1', m.left).attr('x2', width - m.right).attr('y1', y(base)).attr('y2', y(base))
      .attr('stroke', 'var(--color-border)').attr('stroke-dasharray', '3 3').attr('pointer-events', 'none')

    // Split area: radiant-favoured above baseline, dire below.
    const radiantArea = d3.area<TimelineFrame>().x((f) => x(f.t)).y0(y(base)).y1((f) => y(Math.max(val(f), base)))
    const direArea = d3.area<TimelineFrame>().x((f) => x(f.t)).y0(y(base)).y1((f) => y(Math.min(val(f), base)))
    svg.append('path').datum(series).attr('d', radiantArea).attr('fill', RADIANT).attr('opacity', 0.22).attr('pointer-events', 'none').attr('clip-path', `url(#${clipId})`)
    svg.append('path').datum(series).attr('d', direArea).attr('fill', DIRE).attr('opacity', 0.22).attr('pointer-events', 'none').attr('clip-path', `url(#${clipId})`)
    const line = d3.line<TimelineFrame>().x((f) => x(f.t)).y((f) => y(val(f)))
    svg.append('path').datum(series).attr('d', line).attr('fill', 'none').attr('stroke', 'var(--color-text)').attr('stroke-width', 1.5).attr('pointer-events', 'none').attr('clip-path', `url(#${clipId})`)

    // Hover crosshair over the plot — handled by the capture rect appended earlier.

    // Objective markers (pills; towers show their tier T1..T4). Radiant-favouring
    // objectives sit in the top lane, dire-favouring in the bottom lane.
    const pillH = 14
    const topMarkerY = direLaneH + objTopH / 2
    const botMarkerY = plotBottom + m.bottom + objBotH / 2
    const drawObjective = (e: TimelineEvent, markerY: number) => {
      const cx = x(e.time)
      const label = eventGlyph(e)
      const pillW = label.length > 1 ? 18 : 14
      const color = e.side === 'radiant' ? RADIANT : e.side === 'dire' ? DIRE : 'var(--color-text-muted)'
      // faint full-plot time line
      svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', plotTop).attr('y2', plotBottom)
        .attr('stroke', color).attr('stroke-width', 0.6).attr('opacity', 0.3).attr('pointer-events', 'none')
      const g = svg.append('g').style('cursor', 'pointer')
        .on('mouseenter', (event: MouseEvent) => { if (draggingRef.current) return; setTip(makeEventTip(event, e)) })
        .on('mousemove', (event: MouseEvent) => setTip((t) => (t ? { ...t, x: event.clientX, y: event.clientY } : null)))
        .on('mouseleave', () => setTip(null))
      g.append('rect').attr('x', cx - pillW / 2).attr('y', markerY - pillH / 2).attr('width', pillW).attr('height', pillH)
        .attr('rx', pillH / 2).attr('fill', color)
      g.append('text').attr('x', cx).attr('y', markerY).attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('fill', '#0d0d1a').attr('font-family', 'var(--font-display)').attr('font-weight', 800).attr('font-size', 8)
        .text(label)
    }
    for (const e of topObjs) drawObjective(e, topMarkerY)
    for (const e of botObjs) drawObjective(e, botMarkerY)

    // Buybacks: taller yellow vertical lines. Dire buybacks at the top, radiant at
    // the bottom — buying back costs gold, nudging that side's advantage down.
    const BB_H = 20
    for (const b of buybacks) {
      if (!inX(b.time)) continue
      const cx = x(b.time)
      const atTop = b.side === 'dire'
      const y1 = atTop ? plotTop : plotBottom - BB_H
      const y2 = atTop ? plotTop + BB_H : plotBottom
      const sideColor = b.side === 'radiant' ? RADIANT : DIRE
      const bbLines: TipLine[] = [{ text: `${fmtTime(b.time)} · Buyback`, color: '#facc15' }]
      if (b.hero != null) {
        bbLines.push({ text: heroPlayers?.get(b.hero) ?? heroName(b.hero), color: sideColor, heroId: b.hero })
      } else if (b.side) {
        bbLines.push({ text: b.side, color: sideColor })
      }
      const g = svg.append('g').style('cursor', 'pointer')
        .on('mouseenter', (event: MouseEvent) => { if (draggingRef.current) return; setTip({ x: event.clientX, y: event.clientY, lines: bbLines }) })
        .on('mousemove', (event: MouseEvent) => setTip((t) => (t ? { ...t, x: event.clientX, y: event.clientY } : null)))
        .on('mouseleave', () => setTip(null))
      g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', y1).attr('y2', y2).attr('stroke', '#facc15').attr('stroke-width', 2.5)
    }

    // Death mini-hero icons. `anchorY` is the first icon's y; `dir` is the stacking
    // direction — dire stacks upward from just above the plot (dir -1) so a single
    // death sits closest to the graph; radiant stacks downward below the axis.
    const drawDeaths = (side: 'radiant' | 'dire', anchorY: number, dir: 1 | -1) => {
      visibleFights.forEach((f, fi) => {
        const cx = (x(f.time) + x(f.endTime ?? f.time)) / 2
        deathsOf(f, side).forEach((d, i) => {
          const pic = heroPic(d.hero)
          const iy = anchorY + dir * i * STEP
          const ix = cx - ICON / 2
          if (pic) {
            svg.append('image').attr('href', miniHeroImageUrl(pic)).attr('x', ix).attr('y', iy).attr('width', ICON).attr('height', ICON)
              .attr('preserveAspectRatio', 'xMidYMid slice').attr('pointer-events', 'none')
              .append('title').text(`${heroName(d.hero)} died ${fmtTime(d.time)} (${d.side})`)
          }
          svg.append('rect').attr('x', ix).attr('y', iy).attr('width', ICON).attr('height', ICON)
            .attr('fill', 'none').attr('stroke', side === 'radiant' ? RADIANT : DIRE).attr('stroke-width', 1).attr('pointer-events', 'none')
            .attr('data-fight', fi)
        })
      })
    }
    if (direMax > 0) drawDeaths('dire', direLaneH - ICON - 1, -1)
    if (radMax > 0) drawDeaths('radiant', radDeathTop, 1)
  }, [series, objectives, fights, buybacks, metric, visibleTypes, width, data.durationSecs, heroPlayers, xDomain, setXDomain])

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      {xDomain && (
        <button
          type="button"
          onClick={() => setXDomain(null)}
          style={{
            position: 'absolute', top: 0, right: 0, zIndex: 5, cursor: 'pointer',
            padding: '3px 9px', fontSize: '0.7rem', fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary-dim)',
            background: 'var(--color-bg-elevated)', color: 'var(--color-text)',
          }}
        >
          Reset zoom
        </button>
      )}
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      {tip && (
        <div
          className={styles.tip}
          style={
            tip.x > window.innerWidth - 260
              ? { right: window.innerWidth - tip.x + 12, top: tip.y - 10 }
              : { left: tip.x + 12, top: tip.y - 10 }
          }
        >
          {tip.lines.map((l, i) => {
            if (l.header) {
              return (
                <div key={i} style={{ marginTop: 5, marginBottom: 1, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
                  {l.text}
                </div>
              )
            }
            const pic = l.heroId != null ? heroPic(l.heroId) : null
            return (
              <div key={i} style={{ color: l.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                {pic && <img src={miniHeroImageUrl(pic)} alt="" width={20} height={20} style={{ borderRadius: 2, display: 'block' }} />}
                <span>{l.text}</span>
                {l.suffix && <span style={{ marginLeft: 'auto', paddingLeft: 10, color: 'var(--color-text-muted)' }}>{l.suffix}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Segment breakdown ──────────────────────────────────── */

function SegmentBar({ data, metric, xDomain }: { data: TimelineData; metric: Metric; xDomain: [number, number] | null }) {
  const dom = useMemo<[number, number]>(() => xDomain ?? [0, data.durationSecs], [xDomain, data.durationSecs])
  const span = dom[1] - dom[0] || 1
  const segs = useMemo(() => data.segments.filter((s) => s.end >= dom[0] && s.start <= dom[1]), [data.segments, dom])
  const maxMag = useMemo(() => {
    const mags = segs.map((s) => Math.abs((metric === 'winprob' ? s.winProbSwing : s.nwSwing) ?? 0))
    return Math.max(...mags, metric === 'winprob' ? 0.05 : 1)
  }, [segs, metric])

  return (
    <div className={styles.segWrap}>
      <div className={styles.segLabel}>
        How each phase shifted the advantage
        <span className={styles.segLegend}>
          <span className={styles.segSwatch} style={{ background: RADIANT }} /> Radiant
          <span className={styles.segSwatch} style={{ background: DIRE }} /> Dire
        </span>
      </div>
      {/* padded to match the chart's plot area so it lines up with the x-axis */}
      <div style={{ paddingLeft: M_LEFT, paddingRight: M_RIGHT }}>
        <div className={styles.segBar}>
          {segs.map((s, i) => {
            const swing = (metric === 'winprob' ? s.winProbSwing : s.nwSwing) ?? 0
            const a = Math.max(s.start, dom[0])
            const b = Math.min(s.end, dom[1])
            const leftPct = ((a - dom[0]) / span) * 100
            const wPct = ((b - a) / span) * 100
            const intensity = 0.15 + 0.85 * Math.min(1, Math.abs(swing) / maxMag)
            const color = swing >= 0 ? RADIANT : DIRE
            const swingText = metric === 'winprob' ? `${swing >= 0 ? '+' : ''}${Math.round(swing * 100)}%` : fmtNw(swing)
            return (
              <div
                key={i}
                className={styles.segCell}
                style={{ left: `${leftPct}%`, width: `${wPct}%`, background: color, opacity: intensity }}
                title={`${s.type} · ${fmtTime(s.start)}–${fmtTime(s.end)} · ${metric === 'winprob' ? 'win prob' : 'net worth'} swing ${swingText}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Widget ─────────────────────────────────────────────── */

function ControlButton({
  active, color, swatch, onClick, children, title,
}: {
  active: boolean
  color: string
  swatch: 'line' | 'square' | 'none'
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', fontSize: '0.78rem', fontFamily: 'var(--font-body)', borderRadius: 'var(--radius-sm)',
        border: '1px solid', borderColor: active ? color : 'var(--color-border)',
        color: active ? 'var(--color-text)' : 'var(--color-text-muted)', opacity: active ? 1 : 0.45, transition: 'all 150ms ease',
      }}
    >
      {swatch === 'square' && <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: 'inline-block' }} />}
      {swatch === 'line' && <span style={{ width: 18, height: 2, background: color, display: 'inline-block' }} />}
      {children}
    </button>
  )
}

export default function MatchTimeline({ matchId, heroPlayers }: { matchId: string; heroPlayers?: Map<number, string> }) {
  const { data, error } = useApiQuery<{ data: TimelineData }>(`/api/matches/${matchId}/timeline`)
  const timeline = data?.data
  const [metric, setMetric] = useState<Metric>('winprob')
  const [hiddenTypes, setHiddenTypes] = useState<Set<TfType>>(() => new Set())
  const [xDomain, setXDomain] = useState<[number, number] | null>(null)

  const visibleTypes = useMemo(() => new Set(TF_TYPES.filter((t) => !hiddenTypes.has(t))), [hiddenTypes])
  const typeCounts = useMemo(() => {
    const c: Record<TfType, number> = { BATTLE: 0, SKIRMISH: 0, GANK: 0, SOLO: 0 }
    for (const e of timeline?.events ?? []) if (e.type === 'teamfight') c[classifyTf(e)]++
    return c
  }, [timeline])

  // Unparsed matches 404 — just don't render the widget.
  if (error || !timeline || timeline.series.length < 2) return null

  const showWinProb = timeline.hasModel
  const activeMetric: Metric = showWinProb ? metric : 'networth'

  const toggleType = (t: TfType) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  return (
    <div className={shared.section}>
      <div className={shared.sectionTitle}>Timeline</div>
      <div className={styles.controls}>
        {showWinProb && (
          <>
            <ControlButton active={activeMetric === 'winprob'} color="var(--color-primary)" swatch="line" onClick={() => setMetric('winprob')}>Win probability</ControlButton>
            <ControlButton active={activeMetric === 'networth'} color="var(--color-text-secondary)" swatch="line" onClick={() => setMetric('networth')}>Net worth</ControlButton>
          </>
        )}
        <span className={styles.controlsDivider} />
        {TF_TYPES.map((t) => (
          <ControlButton key={t} active={visibleTypes.has(t)} color={TF_COLOR[t]} swatch="square" onClick={() => toggleType(t)} title={TF_TIPS[t]}>{TF_LABEL[t]} ({typeCounts[t]})</ControlButton>
        ))}
        <a href="/glossary#teamfight-types" className={styles.help} title="What are teamfight types?" aria-label="Teamfight types — open the glossary">?</a>
      </div>
      <TimelineChart data={timeline} metric={activeMetric} visibleTypes={visibleTypes} heroPlayers={heroPlayers} xDomain={xDomain} setXDomain={setXDomain} />
      <SegmentBar data={timeline} metric={activeMetric} xDomain={xDomain} />
    </div>
  )
}
