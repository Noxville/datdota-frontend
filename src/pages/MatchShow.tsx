import { Fragment, useMemo, useCallback, useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useApiQuery } from '../api/queries'
import { heroImageUrl, itemImageUrl, abilityImageUrl, teamLogoUrl, leagueLogoUrl } from '../config'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import { abilities as abilitiesData } from '../data/abilities'
import { PlayerCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import GlossaryTooltip from '../components/GlossaryTooltip'
import styles from './MatchShow.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface MatchTeam {
  name: string
  valve_id: number
  tag: string
  logo: string
  display: boolean
}

interface MatchPlayer {
  nickname: string
  steam32: number
}

interface HeroRef {
  valve_id: number
  short_name: string
}

interface ItemEvent {
  item_id: number
  time: number
  name: string
}

interface AbilityEvent {
  ability_id: number
  time: number
  name: string
}

interface LaneInfo {
  lane: string
  switchTo: string | null
  metaLane: string | null
}

interface Performance {
  hero: HeroRef
  level: number
  kills: number
  deaths: number
  assists: number
  gpm: number
  xpm: number
  building_damage: number
  hero_damage: number
  hero_healing: number
  end_game_gold: number
  gold_spent: number
  hero_variant: number
  items: ItemEvent[]
  abilities: AbilityEvent[]
  laneInfo: LaneInfo | null
}

interface PlayerPerformance {
  player: MatchPlayer
  laneInfo: LaneInfo | null
  performance: Performance
}

interface SideData {
  team: MatchTeam
  player_performances: PlayerPerformance[]
}

interface Channel {
  channel_number: number
  name: string
  country: string
  casters: { nickname: string; steam32: number }[]
}

interface FramesData {
  times: number[]
  radiant_networth_advantage: number[]
}

interface MapControlSide {
  control_value: number
  one_sidedness: number
  neutral_control_value: number
  raw_control_values: number[]
  raw_neutral_control_values: number[]
}

interface MatchData {
  match_id: number
  duration: number
  radiant_victory: boolean
  has_error: boolean
  patch: string
  start_date: number
  league: { league_id: number; name: string }
  radiant: SideData
  dire: SideData
  channels: Channel[]
  derived_series: unknown
  frames?: FramesData
  map_control?: { radiant: MapControlSide; dire: MapControlSide }
}

/* ── Helpers ────────────────────────────────────────────── */

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPic(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtTime(seconds: number): string {
  if (seconds < 0) return 'pre'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function compactNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function itemDisplayName(item: ItemEvent): string {
  const staticItem = itemsData[String(item.item_id)]
  if (staticItem?.longName) return staticItem.longName
  if (item.name) return item.name.replace('item_', '').replace(/_/g, ' ')
  return `Item ${item.item_id}`
}

function abilityDisplayName(a: AbilityEvent): string {
  const staticAbility = abilitiesData[String(a.ability_id)]
  if (staticAbility?.longName) return staticAbility.longName
  if (a.name) return a.name.replace(/_/g, ' ')
  return `Ability ${a.ability_id}`
}

const LANE_SHORT: Record<string, string> = {
  SAFE: 'Safe',
  OFFLANE: 'Off',
  MIDDLE: 'Mid',
  JUNGLE: 'Jng',
  ROAM: 'Roam',
  INVADE: 'Inv',
}

function laneLabel(info: LaneInfo | null): string {
  if (!info) return ''
  const meta = info.metaLane ? LANE_SHORT[info.metaLane] ?? info.metaLane : null
  const lane = LANE_SHORT[info.lane] ?? info.lane
  if (meta && meta !== lane) return `${meta}`
  return meta ?? lane
}

function laneTooltip(info: LaneInfo | null): string {
  if (!info) return ''
  const parts = [`Lane: ${info.lane}`]
  if (info.metaLane) parts.push(`Meta: ${info.metaLane}`)
  if (info.switchTo) parts.push(`→ ${info.switchTo}`)
  return parts.join(' · ')
}



/** Default placeholder for missing item/ability images */
const FALLBACK_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" rx="2" fill="%231e1e38" stroke="%23444" stroke-width="1"/><text x="12" y="14" text-anchor="middle" fill="%23888" font-size="8" font-family="monospace">?</text></svg>'
)

/* ── Hash-based toggle state ────────────────────────────── */

function useHashToggles() {
  const location = useLocation()
  const navigate = useNavigate()

  const state = useMemo(() => {
    const hash = location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    return {
      items: params.get('items') === '1',
      abilities: params.get('abilities') === '1',
    }
  }, [location.hash])

  const toggle = useCallback((key: 'items' | 'abilities') => {
    const hash = location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    const current = params.get(key) === '1'
    if (current) params.delete(key)
    else params.set(key, '1')
    const newHash = params.toString()
    navigate({ hash: newHash ? `#${newHash}` : '' }, { replace: true })
  }, [location.hash, navigate])

  return { ...state, toggle }
}

/* ── Scoreboard Table ───────────────────────────────────── */

function Scoreboard({
  side,
  isWinner,
  label,
  showItems,
  showAbilities,
}: {
  side: SideData
  isWinner: boolean
  label: 'Radiant' | 'Dire'
  showItems: boolean
  showAbilities: boolean
}) {
  const players = side.player_performances
  const totals = useMemo(() => ({
    kills: players.reduce((s, p) => s + p.performance.kills, 0),
    deaths: players.reduce((s, p) => s + p.performance.deaths, 0),
    assists: players.reduce((s, p) => s + p.performance.assists, 0),
    gpm: players.reduce((s, p) => s + p.performance.gpm, 0),
    xpm: players.reduce((s, p) => s + p.performance.xpm, 0),
    heroDamage: players.reduce((s, p) => s + p.performance.hero_damage, 0),
    buildingDamage: players.reduce((s, p) => s + p.performance.building_damage, 0),
    heroHealing: players.reduce((s, p) => s + p.performance.hero_healing, 0),
  }), [players])

  const labelClass = label === 'Radiant' ? styles.radiantLabel : styles.direLabel

  return (
    <div className={styles.section}>
      <div className={`${styles.sectionTitle} ${labelClass}`}>
        {label} {isWinner && <span className={styles.winBadge}>Winner</span>}
      </div>
      <div className={styles.scoreboardWrap}>
        <table className={styles.scoreboard}>
          <thead>
            <tr>
              <th className={styles.thHero}>Hero</th>
              <th>Player</th>
              <th className={styles.thLane}>Lane</th>
              <th className={styles.thNum}>Lvl</th>
              <th className={styles.thNum}>K</th>
              <th className={styles.thNum}>D</th>
              <th className={styles.thNum}>A</th>
              <th className={styles.thNum}>GPM</th>
              <th className={styles.thNum}>XPM</th>
              <th className={styles.thNum}>HD</th>
              <th className={styles.thNum}>BD</th>
              <th className={styles.thNum}>HH</th>
            </tr>
          </thead>
          <tbody>
            {players.map((pp) => {
              const perf = pp.performance
              const pic = heroPic(perf.hero.valve_id)
              const li = pp.laneInfo
              return (
                <Fragment key={pp.player.steam32}>
                  <tr>
                    <td className={styles.tdHero}>
                      {pic ? (
                        <img
                          src={heroImageUrl(pic)}
                          alt={heroName(perf.hero.valve_id)}
                          title={heroName(perf.hero.valve_id)}
                          className={styles.heroImg}
                          loading="lazy"
                        />
                      ) : (
                        <span className={styles.heroFallback}>{heroName(perf.hero.valve_id)}</span>
                      )}
                    </td>
                    <td className={styles.tdPlayer}>
                      <PlayerCell steamId={pp.player.steam32} nickname={pp.player.nickname} />
                    </td>
                    <td className={styles.tdLane} title={laneTooltip(li)}>
                      {laneLabel(li)}
                    </td>
                    <td className={styles.tdNum}>{perf.level}</td>
                    <td className={styles.tdNum}>{perf.kills}</td>
                    <td className={styles.tdNum}>{perf.deaths}</td>
                    <td className={styles.tdNum}>{perf.assists}</td>
                    <td className={styles.tdNum}>{perf.gpm}</td>
                    <td className={styles.tdNum}>{perf.xpm}</td>
                    <td className={styles.tdNum}>{compactNum(perf.hero_damage)}</td>
                    <td className={styles.tdNum}>{compactNum(perf.building_damage)}</td>
                    <td className={styles.tdNum}>{compactNum(perf.hero_healing)}</td>
                  </tr>
                  {showAbilities && (
                    <tr className={styles.expandRow}>
                      <td colSpan={12}>
                        <div className={styles.expandLabel}>Abilities</div>
                        <div className={styles.expandList}>
                          {perf.abilities.map((a, i) => {
                            const name = abilityDisplayName(a)
                            const imgSrc = a.name ? abilityImageUrl(a.name) : FALLBACK_IMG
                            return (
                              <div key={`${a.ability_id}-${i}`} className={styles.expandItem}>
                                <img
                                  src={imgSrc}
                                  alt={name}
                                  title={name}
                                  className={styles.expandImg}
                                  loading="lazy"
                                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG }}
                                />
                                <span className={styles.expandTime}>{i + 1}</span>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  {showItems && (
                    <tr className={styles.expandRow}>
                      <td colSpan={12}>
                        <div className={styles.expandLabel}>Items</div>
                        <div className={styles.expandList}>
                          {perf.items.map((item, i) => {
                            const name = itemDisplayName(item)
                            const isRecipe = item.name?.includes('recipe') ?? false
                            const imgSrc = item.name ? itemImageUrl(item.name) : FALLBACK_IMG
                            return (
                              <div key={`${item.item_id}-${i}`} className={styles.expandItem}>
                                <img
                                  src={imgSrc}
                                  alt={name}
                                  title={name + (isRecipe ? ' (Recipe)' : '')}
                                  className={styles.expandImg}
                                  style={isRecipe ? { filter: 'grayscale(1) opacity(0.5)' } : undefined}
                                  loading="lazy"
                                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG }}
                                />
                                <span className={styles.expandTime}>{fmtTime(item.time)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={styles.totalsRow}>
              <td colSpan={3} className={styles.totalsLabel}>Total</td>
              <td className={styles.tdNum}></td>
              <td className={styles.tdNum}>{totals.kills}</td>
              <td className={styles.tdNum}>{totals.deaths}</td>
              <td className={styles.tdNum}>{totals.assists}</td>
              <td className={styles.tdNum}>{totals.gpm}</td>
              <td className={styles.tdNum}>{totals.xpm}</td>
              <td className={styles.tdNum}>{compactNum(totals.heroDamage)}</td>
              <td className={styles.tdNum}>{compactNum(totals.buildingDamage)}</td>
              <td className={styles.tdNum}>{compactNum(totals.heroHealing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

/* ── Map Control + Networth Chart ──────────────────────── */

const CHART_MARGIN = { top: 20, right: 60, bottom: 36, left: 60 }
const CHART_HEIGHT = 380

function MapControlChart({
  frames,
  mapControl,
}: {
  frames?: FramesData
  mapControl?: { radiant: MapControlSide; dire: MapControlSide }
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; time: number
    nw: number | null; control: number | null; neutral: number | null; cumNeutral: number | null
  } | null>(null)
  const [showNw, setShowNw] = useState(true)
  const [showControl, setShowControl] = useState(true)
  const [showNeutral, setShowNeutral] = useState(true)
  const [showCumNeutral, setShowCumNeutral] = useState(true)

  const hasFrames = !!(frames && frames.times.length > 0)
  const hasControl = !!(mapControl?.radiant?.raw_control_values?.length)

  // Build unified time-series data
  const chartData = useMemo(() => {
    // Networth advantage: use frames.times directly
    const nwPoints: { time: number; value: number }[] = []
    if (hasFrames) {
      for (let i = 0; i < frames!.times.length; i++) {
        nwPoints.push({ time: frames!.times[i], value: frames!.radiant_networth_advantage[i] })
      }
    }

    // Map control: implicit 5s intervals starting at 0, use radiant perspective
    const controlPoints: { time: number; value: number }[] = []
    const neutralPoints: { time: number; value: number }[] = []
    if (hasControl) {
      const rcv = mapControl!.radiant.raw_control_values
      const rncv = mapControl!.radiant.raw_neutral_control_values
      for (let i = 0; i < rcv.length; i++) {
        const t = i * 5
        controlPoints.push({ time: t, value: rcv[i] })
        if (i < rncv.length) {
          neutralPoints.push({ time: t, value: rncv[i] })
        }
      }
    }

    // Cumulative neutral: running sum divided by 12 (snapshots are every 5s, camps spawn once per minute)
    const cumNeutralPoints: { time: number; value: number }[] = []
    let cumSum = 0
    for (const p of neutralPoints) {
      cumSum += p.value
      cumNeutralPoints.push({ time: p.time, value: cumSum / 12 })
    }

    return { nwPoints, controlPoints, neutralPoints, cumNeutralPoints }
  }, [frames, mapControl, hasFrames, hasControl])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return
    if (!hasFrames && !hasControl) return

    const width = containerRef.current.clientWidth
    const { nwPoints, controlPoints, neutralPoints, cumNeutralPoints } = chartData
    const visNw = showNw ? nwPoints : []
    const visControl = showControl ? controlPoints : []
    const visNeutral = showNeutral ? neutralPoints : []
    const visCumNeutral = showCumNeutral ? cumNeutralPoints : []

    // Time domain: union of all visible series
    const allTimes = [
      ...visNw.map((d) => d.time),
      ...visControl.map((d) => d.time),
      ...visNeutral.map((d) => d.time),
      ...visCumNeutral.map((d) => d.time),
    ]
    if (allTimes.length === 0) {
      // Nothing visible — still use full range for axes
      allTimes.push(...nwPoints.map((d) => d.time), ...controlPoints.map((d) => d.time))
    }
    const tMin = d3.min(allTimes) ?? 0
    const tMax = d3.max(allTimes) ?? 0

    const x = d3.scaleLinear()
      .domain([tMin, tMax])
      .range([CHART_MARGIN.left, width - CHART_MARGIN.right])

    // Left y-axis: networth advantage + neutral control (shared scale)
    const nwExtent = d3.extent(nwPoints, (d) => d.value) as [number, number]
    const neutralExtentAll = d3.extent(neutralPoints, (d) => d.value) as [number, number]
    const cumNeutralExtent = d3.extent(cumNeutralPoints, (d) => d.value) as [number, number]
    const leftMax = Math.max(
      Math.abs(nwExtent[0] || 0), Math.abs(nwExtent[1] || 0),
      Math.abs(neutralExtentAll[0] || 0), Math.abs(neutralExtentAll[1] || 0),
      Math.abs(cumNeutralExtent[0] || 0), Math.abs(cumNeutralExtent[1] || 0),
      1000,
    )
    const yNw = d3.scaleLinear()
      .domain([-leftMax, leftMax])
      .range([CHART_HEIGHT - CHART_MARGIN.bottom, CHART_MARGIN.top])
      .nice()

    // Right y-axis: map control [-1, 1] range
    const yControl = d3.scaleLinear()
      .domain([-1, 1])
      .range([CHART_HEIGHT - CHART_MARGIN.bottom, CHART_MARGIN.top])

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', CHART_HEIGHT)

    // Zero line
    svg.append('line')
      .attr('x1', CHART_MARGIN.left).attr('x2', width - CHART_MARGIN.right)
      .attr('y1', yNw(0)).attr('y2', yNw(0))
      .attr('stroke', 'var(--color-border)').attr('stroke-dasharray', '4,3')

    // Gridlines
    const nwTicks = yNw.ticks(5)
    svg.selectAll('.grid-nw').data(nwTicks).enter().append('line')
      .attr('x1', CHART_MARGIN.left).attr('x2', width - CHART_MARGIN.right)
      .attr('y1', (d) => yNw(d)).attr('y2', (d) => yNw(d))
      .attr('stroke', 'var(--color-border-subtle)').attr('stroke-dasharray', '2,4')
      .attr('opacity', 0.5)

    // Networth area (filled to zero)
    if (visNw.length > 0) {
      const areaAbove = d3.area<{ time: number; value: number }>()
        .x((d) => x(d.time))
        .y0(yNw(0))
        .y1((d) => d.value >= 0 ? yNw(d.value) : yNw(0))
        .curve(d3.curveMonotoneX)

      const areaBelow = d3.area<{ time: number; value: number }>()
        .x((d) => x(d.time))
        .y0(yNw(0))
        .y1((d) => d.value < 0 ? yNw(d.value) : yNw(0))
        .curve(d3.curveMonotoneX)

      svg.append('path')
        .datum(visNw)
        .attr('d', areaAbove)
        .attr('fill', 'rgba(46, 204, 113, 0.12)')

      svg.append('path')
        .datum(visNw)
        .attr('d', areaBelow)
        .attr('fill', 'rgba(231, 76, 60, 0.12)')

      const nwLine = d3.line<{ time: number; value: number }>()
        .x((d) => x(d.time))
        .y((d) => yNw(d.value))
        .curve(d3.curveMonotoneX)

      svg.append('path')
        .datum(visNw)
        .attr('d', nwLine)
        .attr('fill', 'none')
        .attr('stroke', 'var(--color-text-secondary)')
        .attr('stroke-width', 2)
    }

    // Map control line
    if (visControl.length > 0) {
      const controlLine = d3.line<{ time: number; value: number }>()
        .x((d) => x(d.time))
        .y((d) => yControl(d.value))
        .curve(d3.curveMonotoneX)

      svg.append('path')
        .datum(visControl)
        .attr('d', controlLine)
        .attr('fill', 'none')
        .attr('stroke', 'var(--color-primary)')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
    }

    // Neutral control bars (on left y-axis)
    if (visNeutral.length > 0) {
      const barWidth = Math.max(1, Math.min(4, (width - CHART_MARGIN.left - CHART_MARGIN.right) / visNeutral.length * 0.7))
      svg.selectAll('.neutral-bar').data(visNeutral).enter().append('rect')
        .attr('x', (d) => x(d.time) - barWidth / 2)
        .attr('y', (d) => d.value >= 0 ? yNw(d.value) : yNw(0))
        .attr('width', barWidth)
        .attr('height', (d) => Math.abs(yNw(d.value) - yNw(0)))
        .attr('fill', 'var(--color-accent)')
        .attr('opacity', 0.45)
    }

    // Cumulative neutral control line (on left y-axis, divided by 12)
    if (visCumNeutral.length > 0) {
      const cumNeutralLine = d3.line<{ time: number; value: number }>()
        .x((d) => x(d.time))
        .y((d) => yNw(d.value))
        .curve(d3.curveMonotoneX)

      svg.append('path')
        .datum(visCumNeutral)
        .attr('d', cumNeutralLine)
        .attr('fill', 'none')
        .attr('stroke', '#e8a838')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.85)
    }

    // Left axis (networth)
    const yNwAxis = d3.axisLeft(yNw)
      .ticks(5)
      .tickFormat((d) => {
        const v = d as number
        if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`
        return String(v)
      })
    svg.append('g')
      .attr('transform', `translate(${CHART_MARGIN.left},0)`)
      .call(yNwAxis)
      .call((g) => g.selectAll('text').attr('fill', 'var(--color-text-muted)').style('font-size', '0.65rem'))
      .call((g) => g.selectAll('line').attr('stroke', 'var(--color-border-subtle)'))
      .call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))

    // Right axis (map control)
    const yControlAxis = d3.axisRight(yControl)
      .ticks(5)
      .tickFormat((d) => `${((d as number) * 100).toFixed(0)}%`)
    svg.append('g')
      .attr('transform', `translate(${width - CHART_MARGIN.right},0)`)
      .call(yControlAxis)
      .call((g) => g.selectAll('text').attr('fill', 'var(--color-text-muted)').style('font-size', '0.65rem'))
      .call((g) => g.selectAll('line').attr('stroke', 'var(--color-border-subtle)'))
      .call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))

    // Bottom axis (time in mm:ss)
    const xAxis = d3.axisBottom(x)
      .ticks(Math.min(10, Math.floor(width / 80)))
      .tickFormat((d) => {
        const s = d as number
        if (s < 0) return `-${Math.floor(-s / 60)}:${String(-s % 60).padStart(2, '0')}`
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
      })
    svg.append('g')
      .attr('transform', `translate(0,${CHART_HEIGHT - CHART_MARGIN.bottom})`)
      .call(xAxis)
      .call((g) => g.selectAll('text').attr('fill', 'var(--color-text-muted)').style('font-size', '0.65rem'))
      .call((g) => g.selectAll('line').attr('stroke', 'var(--color-border-subtle)'))
      .call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))

    // Invisible overlay for tooltip
    svg.append('rect')
      .attr('x', CHART_MARGIN.left)
      .attr('y', CHART_MARGIN.top)
      .attr('width', width - CHART_MARGIN.left - CHART_MARGIN.right)
      .attr('height', CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom)
      .attr('fill', 'transparent')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event)
        const time = x.invert(mx)

        // Find nearest networth point
        let nwVal: number | null = null
        if (showNw && nwPoints.length > 0) {
          const bisect = d3.bisector((d: { time: number }) => d.time).left
          const idx = bisect(nwPoints, time, 1)
          const a = nwPoints[idx - 1]
          const b = nwPoints[idx]
          if (a && b) {
            nwVal = (time - a.time > b.time - time) ? b.value : a.value
          } else {
            nwVal = (a ?? b)?.value ?? null
          }
        }

        // Find nearest control point
        let controlVal: number | null = null
        if (showControl && controlPoints.length > 0) {
          const idx = Math.round(Math.max(0, time) / 5)
          controlVal = controlPoints[Math.min(idx, controlPoints.length - 1)]?.value ?? null
        }

        // Find nearest neutral point
        let neutralVal: number | null = null
        if (showNeutral && neutralPoints.length > 0) {
          const idx = Math.round(Math.max(0, time) / 5)
          neutralVal = neutralPoints[Math.min(idx, neutralPoints.length - 1)]?.value ?? null
        }

        // Find nearest cumulative neutral point
        let cumNeutralVal: number | null = null
        if (showCumNeutral && cumNeutralPoints.length > 0) {
          const idx = Math.round(Math.max(0, time) / 5)
          cumNeutralVal = cumNeutralPoints[Math.min(idx, cumNeutralPoints.length - 1)]?.value ?? null
        }

        setTooltip({
          x: event.offsetX,
          y: event.offsetY,
          time: Math.round(time),
          nw: nwVal,
          control: controlVal,
          neutral: neutralVal,
          cumNeutral: cumNeutralVal,
        })
      })
      .on('mouseleave', () => setTooltip(null))

  }, [chartData, hasFrames, hasControl, showNw, showControl, showNeutral, showCumNeutral])

  if (!hasFrames && !hasControl) return null

  const fmtSec = (s: number) => {
    if (s < 0) return `-${Math.floor(-s / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Map Control &amp; Networth</div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'nw' as const, label: 'Networth Advantage', color: 'var(--color-text-secondary)', active: showNw, toggle: () => setShowNw((v) => !v), swatch: 'line' as const },
          { key: 'control' as const, label: 'Map Control', color: 'var(--color-primary)', active: showControl, toggle: () => setShowControl((v) => !v), swatch: 'line' as const },
          { key: 'neutral' as const, label: 'Neutral Control', color: 'var(--color-accent)', active: showNeutral, toggle: () => setShowNeutral((v) => !v), swatch: 'bar' as const },
          { key: 'cumNeutral' as const, label: 'Cumulative Neutral', color: '#e8a838', active: showCumNeutral, toggle: () => setShowCumNeutral((v) => !v), swatch: 'line' as const },
        ].map((s) => (
          <button
            key={s.key}
            onClick={s.toggle}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: s.active ? s.color : 'var(--color-border)',
              color: s.active ? 'var(--color-text)' : 'var(--color-text-muted)',
              opacity: s.active ? 1 : 0.45,
              transition: 'all 150ms ease',
            }}
          >
            {s.swatch === 'bar' ? (
              <span style={{
                width: 10,
                height: 10,
                background: s.color,
                display: 'inline-block',
                borderRadius: 1,
                opacity: 0.6,
              }} />
            ) : (
              <span style={{
                width: 18,
                height: 2,
                background: s.color,
                display: 'inline-block',
              }} />
            )}
            {s.label}
          </button>
        ))}
        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          Radiant ↑ · Dire ↓
        </span>
      </div>
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        <svg ref={svgRef} />
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text)',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>{fmtSec(tooltip.time)}</div>
            {tooltip.nw !== null && (
              <div style={{ color: 'var(--color-text-secondary)' }}>
                NW: {tooltip.nw >= 0 ? '+' : ''}{tooltip.nw.toLocaleString()}
              </div>
            )}
            {tooltip.control !== null && (
              <div style={{ color: 'var(--color-primary)' }}>
                Control: {(tooltip.control * 100).toFixed(1)}%
              </div>
            )}
            {tooltip.neutral !== null && (
              <div style={{ color: 'var(--color-accent)' }}>
                Neutral: {tooltip.neutral.toFixed(0)}
              </div>
            )}
            {tooltip.cumNeutral !== null && (
              <div style={{ color: '#e8a838' }}>
                Cum. Neutral: {tooltip.cumNeutral.toFixed(0)}
              </div>
            )}
          </div>
        )}
      </div>
      {hasControl && mapControl && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-lg)',
          marginTop: 'var(--space-md)',
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Control Value', glossaryId: 'control-value', value: mapControl.radiant.control_value, fmt: (v: number) => v.toFixed(1) },
            { label: 'One-sidedness', glossaryId: 'one-sidedness', value: mapControl.radiant.one_sidedness, fmt: (v: number) => v.toFixed(3) }
          ].map((stat) => (
            <div key={stat.label} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}>
              <GlossaryTooltip id={stat.glossaryId}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                }}>
                  {stat.label}
                </span>
              </GlossaryTooltip>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--color-text)',
              }}>
                {stat.fmt(stat.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Page component ─────────────────────────────────────── */

export default function MatchShow() {
  const { id } = useParams<{ id: string }>()
  const { items, abilities, toggle } = useHashToggles()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: MatchData }>(
    id ? `/api/matches/${id}` : null,
  )

  const match = data?.data

  if (isLoading) return <div className={styles.page}><EnigmaLoader text="Loading match..." /></div>

  if (error || !match) {
    return (
      <div className={styles.page}>
        <ErrorState
          message="Failed to load match"
          detail="Could not fetch match data."
          rawDetail={error instanceof Error ? error.message : String(error ?? 'No data')}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const radiantScore = match.radiant.player_performances.reduce((s, p) => s + p.performance.kills, 0)
  const direScore = match.dire.player_performances.reduce((s, p) => s + p.performance.kills, 0)

  return (
    <div className={styles.page}>
      {/* Match header */}
      <div className={styles.matchHeader}>
        {/* Radiant side */}
        <div className={`${styles.teamSide} ${styles.radiantSide}`}>
          <div className={match.radiant_victory ? styles.winGlow : undefined}>
            <img
              src={teamLogoUrl(match.radiant.team.logo)}
              alt={match.radiant.team.name}
              className={styles.teamLogo}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <div className={styles.teamInfo}>
            <a
              href={`/teams/${match.radiant.team.valve_id}`}
              className={`${styles.teamName} ${match.radiant_victory ? styles.teamNameWin : ''}`}
            >
              {match.radiant.team.name}
            </a>
            <span className={styles.teamTag}>{match.radiant.team.tag}</span>
          </div>
        </div>

        {/* Score block */}
        <div className={styles.scoreBlock}>
          <div className={styles.scoreLine}>
            <span className={`${styles.score} ${match.radiant_victory ? styles.scoreWin : styles.scoreLoss}`}>
              {radiantScore}
            </span>
            <span className={styles.scoreDivider}>–</span>
            <span className={`${styles.score} ${!match.radiant_victory ? styles.scoreWin : styles.scoreLoss}`}>
              {direScore}
            </span>
          </div>
          <div className={styles.matchMeta}>
            <span>{formatDuration(match.duration)}</span>
          </div>
          <div className={styles.matchMeta}>
            <span>{formatDate(match.start_date)} {formatTime(match.start_date)}</span>
          </div>
        </div>

        {/* Dire side */}
        <div className={`${styles.teamSide} ${styles.direSide}`}>
          <div className={`${styles.teamInfo} ${styles.teamInfoRight}`}>
            <a
              href={`/teams/${match.dire.team.valve_id}`}
              className={`${styles.teamName} ${!match.radiant_victory ? styles.teamNameWin : ''}`}
            >
              {match.dire.team.name}
            </a>
            <span className={styles.teamTag}>{match.dire.team.tag}</span>
          </div>
          <div className={!match.radiant_victory ? styles.winGlow : undefined}>
            <img
              src={teamLogoUrl(match.dire.team.logo)}
              alt={match.dire.team.name}
              className={styles.teamLogo}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        </div>
      </div>

      {/* League info */}
      <div className={styles.leagueBar}>
        <img
          src={leagueLogoUrl(match.league.league_id)}
          alt=""
          className={styles.leagueLogo}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <a href={`/leagues/${match.league.league_id}`} className={styles.leagueName}>
          {match.league.name}
        </a>
        <span className={styles.matchId}>Match {match.match_id} · Patch {match.patch}</span>
      </div>

      {/* Toggle controls */}
      <div className={styles.toggleBar}>
        <button
          className={`${styles.toggleBtn} ${abilities ? styles.toggleActive : ''}`}
          onClick={() => toggle('abilities')}
        >
          Abilities
        </button>
        <button
          className={`${styles.toggleBtn} ${items ? styles.toggleActive : ''}`}
          onClick={() => toggle('items')}
        >
          Items
        </button>
      </div>

      {/* Radiant scoreboard */}
      <Scoreboard
        side={match.radiant}
        isWinner={match.radiant_victory}
        label="Radiant"
        showItems={items}
        showAbilities={abilities}
      />

      {/* Dire scoreboard */}
      <Scoreboard
        side={match.dire}
        isWinner={!match.radiant_victory}
        label="Dire"
        showItems={items}
        showAbilities={abilities}
      />

      {/* Map Control & Networth chart */}
      <MapControlChart frames={match.frames} mapControl={match.map_control} />

      {/* Casters */}
      {match.channels.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Broadcast</div>
          <div className={styles.castersGrid}>
            {match.channels.map((ch) => (
              <div key={ch.channel_number} className={styles.channelCard}>
                <div className={styles.channelName}>{ch.name}</div>
                <div className={styles.castersList}>
                  {ch.casters.map((c) => (
                    <a key={c.steam32} href={`/casters/${c.steam32}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.82rem' }}>
                      {c.nickname}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
