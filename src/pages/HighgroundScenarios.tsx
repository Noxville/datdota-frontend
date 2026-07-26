import { useMemo, useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import PageMeta from '../components/PageMeta'
import HelpLabel from '../components/HelpLabel'
import { MatchLink } from './notableCells'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import nb from './Notable.module.css'
import toggleStyles from './PlayerSquads.module.css'
import hg from './HighgroundScenarios.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface HGTeam { name: string; valveId: number }

interface HGSideSample {
  networth: number | null
  kills: number | null
  xp: number | null
  buybackReady: number | null
  hasAegis: boolean | null
  towers: number | null
  barracks: number | null
}

interface HGSample {
  secsBeforeBreak: number
  clock: number
  taker: HGSideSample
  defender: HGSideSample
  networthLead: number | null
  killLead: number | null
  xpLead: number | null
}

interface HGConvSide {
  secsAfter: number | null
  within1min: boolean
  within2min: boolean
  within3min: boolean
}

interface HGRaxConversion {
  lane: string
  ranged: HGConvSide | null
  melee: HGConvSide | null
}

interface HGRow {
  matchId: number
  taker: HGTeam
  defender: HGTeam
  breakTime: number
  breakMinute: number
  takerWonGame: boolean
  fightsInWindow: number
  fightsTakerWon: number
  takerAegisPickups: number
  defenderAegisPickups: number
  raxConversion: HGRaxConversion | null
  samples: HGSample[]
}

/* ── Helpers ────────────────────────────────────────────── */

function breakSample(row: HGRow): HGSample | undefined {
  return row.samples.find((s) => s.secsBeforeBreak === 0) ?? row.samples[0]
}

const SECS_BUCKETS = [300, 240, 180, 120, 60, 0]

function sampleAt(row: HGRow, secs: number): HGSample | undefined {
  return row.samples.find((s) => s.secsBeforeBreak === secs)
}

function winColor(wr: number): string {
  return d3.interpolateRgb('#f87171', '#2dd4bf')(Math.max(0, Math.min(1, (wr - 0.3) / 0.4)))
}

/* Overlay-team support (Overall view) */
const TEAM_PALETTE = ['#c48bc4', '#60a5fa', '#f59e0b', '#a78bfa', '#22d3ee']

interface SelectedTeam {
  valveId: number
  name: string
  color: string
  games: HGRow[]
}

function overallStats(rows: HGRow[]) {
  const n = rows.length
  const winRate = n ? rows.filter((r) => r.takerWonGame).length / n : 0
  const medBreak = d3.median(rows, (r) => r.breakMinute) ?? 0
  const nwLeads = rows.map((r) => breakSample(r)?.networthLead).filter((v): v is number => v != null)
  const avgNw = nwLeads.length ? nwLeads.reduce((a, b) => a + b, 0) / nwLeads.length : 0
  return { n, winRate, medBreak, avgNw }
}

function convStats(rows: HGRow[]) {
  const n = rows.length || 1
  const share = (pred: (r: HGRow) => boolean) => rows.filter(pred).length / n
  const rateWhen = (pred: (r: HGRow) => boolean) => {
    const sub = rows.filter(pred)
    return sub.length ? sub.filter((r) => r.takerWonGame).length / sub.length : 0
  }
  const hasAegis = (r: HGRow) => !!breakSample(r)?.taker.hasAegis
  return {
    rgd1: share((r) => !!r.raxConversion?.ranged?.within1min),
    rgd2: share((r) => !!r.raxConversion?.ranged?.within2min),
    rgd3: share((r) => !!r.raxConversion?.ranged?.within3min),
    mel1: share((r) => !!r.raxConversion?.melee?.within1min),
    mel2: share((r) => !!r.raxConversion?.melee?.within2min),
    mel3: share((r) => !!r.raxConversion?.melee?.within3min),
    aegisYes: rateWhen(hasAegis),
    aegisNo: rateWhen((r) => !hasAegis(r)),
  }
}

/** Distribution of the taker's buyback-ready hero count at the break (0–5). */
function bbDist(rows: HGRow[]): { count: number; share: number; n: number; winRate: number }[] {
  const total = rows.length || 1
  const buckets = [0, 1, 2, 3, 4, 5].map((k) => ({ count: k, n: 0, won: 0 }))
  for (const r of rows) {
    const n = Math.min(5, Math.max(0, breakSample(r)?.taker.buybackReady ?? 0))
    buckets[n].n++
    if (r.takerWonGame) buckets[n].won++
  }
  return buckets.map((b) => ({ count: b.count, share: b.n / total, n: b.n, winRate: b.n ? b.won / b.n : 0 }))
}

type ConvKey = keyof ReturnType<typeof convStats>

/** Mean NW-lead trajectory across a subset, one point per T-minus bucket. */
function trajectoryOf(subset: HGRow[]): { secs: number; mean: number | null }[] {
  return SECS_BUCKETS.map((secs) => {
    const vals = subset.map((r) => sampleAt(r, secs)?.networthLead).filter((v): v is number => v != null)
    return { secs, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null }
  })
}

function TeamLink({ team, kind }: { team: HGTeam; kind?: 'win' | 'loss' }) {
  return (
    <a href={`/teams/${team.valveId}`} className={`${nb.teamLink} ${kind === 'win' ? nb.win : kind === 'loss' ? nb.loss : ''}`}>
      {team.name}
    </a>
  )
}

/** Net-worth lead over the T−300 → break window, taker perspective. */
function LeadSparkline({ samples }: { samples: HGSample[] }) {
  const series = useMemo(
    () =>
      [...samples]
        .sort((a, b) => b.secsBeforeBreak - a.secsBeforeBreak)
        .map((s) => s.networthLead)
        .filter((v): v is number => v !== null),
    [samples],
  )
  if (series.length < 2) return <span className={nb.muted}>—</span>
  const w = 150
  const h = 30
  const pad = 3
  const max = Math.max(...series, 0)
  const min = Math.min(...series, 0)
  const range = max - min || 1
  const stepX = (w - pad * 2) / Math.max(series.length - 1, 1)
  const x = (i: number) => pad + i * stepX
  const y = (v: number) => pad + ((max - v) / range) * (h - pad * 2)
  const zeroY = y(0)
  const linePath = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const areaPath = `M${x(0).toFixed(1)},${zeroY.toFixed(1)} ${series
    .map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')} L${x(series.length - 1).toFixed(1)},${zeroY.toFixed(1)} Z`
  return (
    <svg width={w} height={h} className={nb.spark} preserveAspectRatio="none" role="img" aria-label="Net-worth lead into the highground break">
      <title>Taker net-worth lead from 5 minutes before the break (left) to the break (right); below the dashed line = taker behind</title>
      <path d={areaPath} className={nb.sparkArea} />
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} className={nb.sparkZero} />
      <path d={linePath} className={nb.sparkLine} />
    </svg>
  )
}

const CONV_COLORS: Record<string, string> = {
  '≤1m': 'var(--color-win)',
  '≤2m': '#facc15',
  '≤3m': '#fb923c',
  '>3m': 'var(--color-text-muted)',
}

function convLabel(side: HGConvSide | null | undefined): string {
  if (!side) return '—'
  if (side.within1min) return '≤1m'
  if (side.within2min) return '≤2m'
  if (side.within3min) return '≤3m'
  return '>3m'
}

function RaxConvertCell({ conv }: { conv: HGRaxConversion | null }) {
  if (!conv) return <span className={nb.muted}>—</span>
  const rgd = convLabel(conv.ranged)
  const mel = convLabel(conv.melee)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: '0.68rem', fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
      <span title={`Ranged barracks converted ${conv.ranged?.secsAfter != null ? `${conv.ranged.secsAfter.toFixed(0)}s after break` : 'not within window'}`}>
        <span style={{ color: 'var(--color-text-muted)' }}>Rgd </span>
        <span style={{ color: CONV_COLORS[rgd] }}>{rgd}</span>
      </span>
      <span title={`Melee barracks converted ${conv.melee?.secsAfter != null ? `${conv.melee.secsAfter.toFixed(0)}s after break` : 'not within window'}`}>
        <span style={{ color: 'var(--color-text-muted)' }}>Mel </span>
        <span style={{ color: CONV_COLORS[mel] }}>{mel}</span>
      </span>
    </div>
  )
}

/* ── Per-game table columns ─────────────────────────────── */

const ch = createColumnHelper<HGRow>()

function buildColumns(): ColumnDef<HGRow, unknown>[] {
  return [
    ch.accessor('matchId', {
      id: 'matchId', header: 'Match', size: 110,
      cell: ({ getValue }) => <MatchLink matchId={getValue()} />,
    }),
    ch.accessor('breakTime', {
      id: 'breakTime', header: 'Break', size: 75,
      meta: { numeric: true, tooltip: 'Game time of the first Tier-3 tower (highground) break' },
      cell: ({ getValue }) => <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtTime(getValue())}</span>,
    }),
    ch.accessor((r) => r.taker.name, {
      id: 'taker', header: 'Taker', size: 165,
      cell: ({ row }) => <TeamLink team={row.original.taker} kind={row.original.takerWonGame ? 'win' : 'loss'} />,
    }),
    ch.accessor((r) => r.defender.name, {
      id: 'defender', header: 'Defender', size: 165,
      cell: ({ row }) => <TeamLink team={row.original.defender} />,
    }),
    ch.accessor('takerWonGame', {
      id: 'takerWonGame', header: 'Taker Won', size: 90,
      meta: { numeric: true, tooltip: 'Did the team that broke highground first go on to win the game?' },
      cell: ({ getValue }) => (
        <span style={{ color: getValue() ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 700 }}>{getValue() ? '✓' : '✗'}</span>
      ),
    }),
    ch.accessor((r) => breakSample(r)?.networthLead ?? 0, {
      id: 'nwLead', header: 'NW Lead', size: 95,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: "Taker's net-worth lead at the break" },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
    }),
    ch.accessor((r) => breakSample(r)?.killLead ?? 0, {
      id: 'killLead', header: 'Kill Lead', size: 80,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: "Taker's kill lead at the break" },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    }),
    ch.accessor((r) => breakSample(r)?.taker.buybackReady ?? 0, {
      id: 'buybacks', header: 'BBs (T/D)', size: 80,
      meta: { numeric: true, tooltip: 'Buyback-ready heroes at the break — taker / defender (sorts by taker)' },
      cell: ({ row }) => {
        const s = breakSample(row.original)
        return (
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--color-text)' }}>{s?.taker.buybackReady ?? '—'}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> / {s?.defender.buybackReady ?? '—'}</span>
          </span>
        )
      },
    }),
    ch.accessor((r) => {
      const s = breakSample(r)
      return s?.taker.hasAegis ? 2 : s?.defender.hasAegis ? 1 : 0
    }, {
      id: 'aegis', header: 'Aegis', size: 70,
      meta: { numeric: true, tooltip: 'Who held the Aegis at the break' },
      cell: ({ row }) => {
        const s = breakSample(row.original)
        if (s?.taker.hasAegis) return <span style={{ color: 'var(--color-win)', fontWeight: 700 }}>Taker</span>
        if (s?.defender.hasAegis) return <span style={{ color: 'var(--color-loss)', fontWeight: 700 }}>Def</span>
        return <span className={nb.muted}>—</span>
      },
    }),
    ch.accessor('fightsTakerWon', {
      id: 'fights', header: 'TF W/T', size: 78,
      meta: { numeric: true, tooltip: 'Teamfights won by the taker / total teamfights in the 5-minute window' },
      cell: ({ row }) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--color-text)' }}>{row.original.fightsTakerWon}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> / {row.original.fightsInWindow}</span>
        </span>
      ),
    }),
    ch.accessor('takerAegisPickups', {
      id: 'aegisPickups', header: 'Aegis (T/D)', size: 90,
      meta: { numeric: true, tooltip: 'Aegis pickups in the window — taker / defender (sorts by taker)' },
      cell: ({ row }) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--color-text)' }}>{row.original.takerAegisPickups}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> / {row.original.defenderAegisPickups}</span>
        </span>
      ),
    }),
    ch.accessor((r) => r.raxConversion?.lane ?? '', {
      id: 'lane', header: 'Lane', size: 80,
      cell: ({ getValue }) => {
        const lane = getValue() as string
        return lane ? <span style={{ fontSize: '0.72rem' }}>{lane.charAt(0) + lane.slice(1).toLowerCase()}</span> : <span className={nb.muted}>—</span>
      },
    }),
    ch.display({
      id: 'raxConvert', header: 'Rax Convert', size: 100,
      cell: ({ row }) => <RaxConvertCell conv={row.original.raxConversion} />,
    }),
    ch.display({
      id: 'timeline', header: 'NW Lead → Break', size: 170,
      cell: ({ row }) => <LeadSparkline samples={row.original.samples} />,
    }),
  ] as ColumnDef<HGRow, unknown>[]
}

/* ── Per-team aggregation ───────────────────────────────── */

interface PerTeamRow {
  valveId: number
  name: string
  breaks: number
  winRate: number
  avgBreakMin: number
  avgNwLead: number
  avgKillLead: number
  fightWinRate: number
  aegisAtBreakPct: number
  convRangedPct: number
  convMeleePct: number
}

function buildPerTeam(rows: HGRow[]): PerTeamRow[] {
  const byTeam = new Map<number, HGRow[]>()
  for (const r of rows) {
    if (!byTeam.has(r.taker.valveId)) byTeam.set(r.taker.valveId, [])
    byTeam.get(r.taker.valveId)!.push(r)
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const out: PerTeamRow[] = []
  for (const [valveId, games] of byTeam) {
    const nwLeads = games.map((g) => breakSample(g)?.networthLead).filter((v): v is number => v != null)
    const killLeads = games.map((g) => breakSample(g)?.killLead).filter((v): v is number => v != null)
    const totalFights = games.reduce((a, g) => a + g.fightsInWindow, 0)
    const wonFights = games.reduce((a, g) => a + g.fightsTakerWon, 0)
    out.push({
      valveId,
      name: games[0].taker.name,
      breaks: games.length,
      winRate: mean(games.map((g) => (g.takerWonGame ? 1 : 0))),
      avgBreakMin: mean(games.map((g) => g.breakMinute)),
      avgNwLead: mean(nwLeads),
      avgKillLead: mean(killLeads),
      fightWinRate: totalFights > 0 ? wonFights / totalFights : 0,
      aegisAtBreakPct: mean(games.map((g) => (breakSample(g)?.taker.hasAegis ? 1 : 0))),
      convRangedPct: mean(games.map((g) => (g.raxConversion?.ranged?.within1min ? 1 : 0))),
      convMeleePct: mean(games.map((g) => (g.raxConversion?.melee?.within1min ? 1 : 0))),
    })
  }
  return out
}

const pch = createColumnHelper<PerTeamRow>()

function buildPerTeamColumns(): ColumnDef<PerTeamRow, unknown>[] {
  return [
    pch.accessor('name', {
      id: 'name', header: 'Team', size: 190,
      cell: ({ row }) => <TeamLink team={{ name: row.original.name, valveId: row.original.valveId }} />,
    }),
    pch.accessor('breaks', {
      id: 'breaks', header: 'Breaks', size: 80,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Games where this team broke highground first' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    }),
    pch.accessor('winRate', {
      id: 'winRate', header: 'Win %', size: 80,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Win rate after breaking highground first' },
      cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
    }),
    pch.accessor('avgBreakMin', {
      id: 'avgBreakMin', header: 'Avg Break', size: 90,
      meta: { numeric: true, tooltip: 'Average game minute of the break' },
      cell: ({ getValue }) => <span style={{ fontFamily: 'var(--font-mono)' }}>{(getValue() as number).toFixed(1)}</span>,
    }),
    pch.accessor('avgNwLead', {
      id: 'avgNwLead', header: 'Avg NW Lead', size: 110,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Average net-worth lead at the break' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} compact />,
    }),
    pch.accessor('avgKillLead', {
      id: 'avgKillLead', header: 'Avg Kill Lead', size: 105,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Average kill lead at the break' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
    }),
    pch.accessor('fightWinRate', {
      id: 'fightWinRate', header: 'TF Won %', size: 90,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Teamfights won of those in the 5-min windows' },
      cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
    }),
    pch.accessor('aegisAtBreakPct', {
      id: 'aegisAtBreakPct', header: 'Aegis@Break %', size: 110,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Share of breaks where the taker held the aegis' },
      cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
    }),
    pch.accessor('convRangedPct', {
      id: 'convRangedPct', header: 'Rgd ≤1m %', size: 100,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Share of breaks converting the ranged barracks within 1 minute' },
      cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
    }),
    pch.accessor('convMeleePct', {
      id: 'convMeleePct', header: 'Mel ≤1m %', size: 100,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Share of breaks converting the melee barracks within 1 minute' },
      cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
    }),
  ] as ColumnDef<PerTeamRow, unknown>[]
}

/* ── Overall view: responsive chart hook ────────────────── */

function useResizeSize(ref: React.RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ width: Math.max(0, r.width), height: Math.max(0, r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/* Shared hover tooltip for the D3 charts. */
interface Tip { x: number; y: number; label: string }

function HoverTip({ tip }: { tip: Tip | null }) {
  if (!tip) return null
  return <div className={hg.tip} style={{ left: tip.x + 12, top: tip.y - 10 }}>{tip.label}</div>
}

type TipSetter = React.Dispatch<React.SetStateAction<Tip | null>>

/** Attach hover-tooltip handlers to a d3 selection of marks. */
function attachTip<E extends d3.BaseType, T>(
  sel: d3.Selection<E, T, d3.BaseType, unknown>,
  setTip: TipSetter,
  label: (d: T) => string,
) {
  sel.style('cursor', 'pointer')
    .on('mouseenter', (event: MouseEvent, d: T) => setTip({ x: event.clientX, y: event.clientY, label: label(d) }))
    .on('mousemove', (event: MouseEvent) => setTip((t) => (t ? { ...t, x: event.clientX, y: event.clientY } : null)))
    .on('mouseleave', () => setTip(null))
}

/* Lead-trajectory line chart: avg NW lead per T-minus, split by won/lost. */
function LeadTrajectoryChart({ rows, selected }: { rows: HGRow[]; selected: SelectedTeam[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useResizeSize(ref)

  const [tip, setTip] = useState<Tip | null>(null)
  const { won, lost } = useMemo(
    () => ({ won: trajectoryOf(rows.filter((r) => r.takerWonGame)), lost: trajectoryOf(rows.filter((r) => !r.takerWonGame)) }),
    [rows],
  )
  const teamLines = useMemo(() => selected.map((t) => ({ color: t.color, name: t.name, series: trajectoryOf(t.games) })), [selected])

  useEffect(() => {
    if (!svgRef.current || width === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const h = Math.max(220, Math.floor(height) || 220)
    const m = { top: 10, right: 14, bottom: 28, left: 48 }
    svg.attr('width', width).attr('height', h)

    const x = d3.scaleLinear().domain([-5, 0]).range([m.left, width - m.right])
    const all = [...won, ...lost, ...teamLines.flatMap((t) => t.series)].map((d) => d.mean).filter((v): v is number => v != null)
    const y = d3.scaleLinear().domain([Math.min(0, d3.min(all) ?? 0), d3.max(all) ?? 1]).nice().range([h - m.bottom, m.top])

    svg.append('line').attr('x1', m.left).attr('x2', width - m.right).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', 'var(--color-border)').attr('stroke-dasharray', '3 3')

    svg.append('g').attr('transform', `translate(0,${h - m.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d}m`) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)
    svg.append('g').attr('transform', `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format('.2s')(d as number)) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)

    const line = d3.line<{ secs: number; mean: number | null }>()
      .defined((d) => d.mean != null)
      .x((d) => x(-d.secs / 60))
      .y((d) => y(d.mean as number))

    const dim = selected.length > 0
    const draw = (series: { secs: number; mean: number | null }[], color: string, name: string, opacity = 1, dots = true) => {
      svg.append('path').datum(series).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2)
        .attr('opacity', opacity).attr('d', line)
      if (dots) {
        const c = svg.selectAll(null).data(series.filter((d) => d.mean != null)).join('circle')
          .attr('cx', (d) => x(-d.secs / 60)).attr('cy', (d) => y(d.mean as number)).attr('r', 3.5).attr('fill', color).attr('opacity', opacity)
        attachTip(c, setTip, (d) => `${name} · ${d.secs === 0 ? 'at break' : `${d.secs}s before`}: ${d3.format('+,')(Math.round(d.mean as number))}`)
      }
    }
    draw(lost, '#f87171', 'Lost', dim ? 0.28 : 1, !dim)
    draw(won, '#2dd4bf', 'Won', dim ? 0.28 : 1, !dim)
    for (const t of teamLines) draw(t.series, t.color, t.name)
  }, [won, lost, teamLines, selected.length, width, height])

  return (
    <div className={hg.chartCard}>
      <div className={hg.chartTitle}>Net-worth lead into the break</div>
      <div className={hg.chartSub}>
        Avg taker NW lead, 5 min before → break · <span style={{ color: '#2dd4bf' }}>won</span> vs <span style={{ color: '#f87171' }}>lost</span>
        {selected.length > 0 && <> · teams = their avg</>}
      </div>
      <div className={hg.chartBody} ref={ref}><svg ref={svgRef} /><HoverTip tip={tip} /></div>
    </div>
  )
}

/* Win-rate vs NW lead at break (bucketed bar chart). */
const LEAD_BUCKETS: { label: string; test: (v: number) => boolean }[] = [
  { label: '<0', test: (v) => v < 0 },
  { label: '0–5k', test: (v) => v >= 0 && v < 5000 },
  { label: '5–10k', test: (v) => v >= 5000 && v < 10000 },
  { label: '10–15k', test: (v) => v >= 10000 && v < 15000 },
  { label: '15k+', test: (v) => v >= 15000 },
]

function bucketWinRates(rows: HGRow[]): { label: string; n: number; winRate: number }[] {
  const withLead = rows
    .map((r) => ({ lead: breakSample(r)?.networthLead, won: r.takerWonGame }))
    .filter((d): d is { lead: number; won: boolean } => d.lead != null)
  return LEAD_BUCKETS.map((b) => {
    const games = withLead.filter((d) => b.test(d.lead))
    return { label: b.label, n: games.length, winRate: games.length ? games.filter((g) => g.won).length / games.length : 0 }
  })
}

function WinRateVsLeadChart({ rows, selected }: { rows: HGRow[]; selected: SelectedTeam[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useResizeSize(ref)

  const [tip, setTip] = useState<Tip | null>(null)
  const buckets = useMemo(() => bucketWinRates(rows), [rows])
  const teamBuckets = useMemo(() => selected.map((t) => ({ color: t.color, name: t.name, buckets: bucketWinRates(t.games) })), [selected])

  useEffect(() => {
    if (!svgRef.current || width === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const h = Math.max(220, Math.floor(height) || 220)
    const m = { top: 16, right: 10, bottom: 28, left: 40 }
    svg.attr('width', width).attr('height', h)

    const x = d3.scaleBand().domain(buckets.map((b) => b.label)).range([m.left, width - m.right]).padding(0.25)
    const y = d3.scaleLinear().domain([0, 1]).range([h - m.bottom, m.top])

    svg.append('g').attr('transform', `translate(0,${h - m.bottom})`).call(d3.axisBottom(x) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)
    svg.append('g').attr('transform', `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${Math.round((d as number) * 100)}%`) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)
    svg.append('line').attr('x1', m.left).attr('x2', width - m.right).attr('y1', y(0.5)).attr('y2', y(0.5))
      .attr('stroke', 'var(--color-border)').attr('stroke-dasharray', '3 3')

    const dim = selected.length > 0
    const bars = svg.selectAll('.bar').data(buckets).join('rect')
      .attr('x', (d) => x(d.label)!).attr('width', x.bandwidth())
      .attr('y', (d) => y(d.winRate)).attr('height', (d) => y(0) - y(d.winRate))
      .attr('rx', 2).attr('fill', (d) => winColor(d.winRate)).attr('opacity', dim ? 0.4 : 1)
    attachTip(bars, setTip, (d) => (d.n > 0 ? `All · ${d.label}: ${Math.round(d.winRate * 100)}% (${d.n})` : `${d.label}: no games`))
    if (!dim) {
      svg.selectAll('.lbl').data(buckets).join('text')
        .attr('x', (d) => x(d.label)! + x.bandwidth() / 2).attr('y', (d) => y(d.winRate) - 4)
        .attr('text-anchor', 'middle').attr('fill', 'var(--color-text-secondary)')
        .attr('font-family', 'var(--font-mono)').attr('font-size', 9)
        .text((d) => (d.n > 0 ? `${Math.round(d.winRate * 100)}% (${d.n})` : '—'))
    }

    // Per-team dots per bucket, dodged horizontally so they don't overlap.
    const nt = teamBuckets.length
    const gap = nt > 1 ? Math.min(12, x.bandwidth() / (nt + 1)) : 0
    teamBuckets.forEach((t, ti) => {
      const offset = (ti - (nt - 1) / 2) * gap
      const pts = t.buckets.filter((b) => b.n > 0)
      const dots = svg.selectAll(null).data(pts).join('circle')
        .attr('cx', (d) => x(d.label)! + x.bandwidth() / 2 + offset).attr('cy', (d) => y(d.winRate))
        .attr('r', 4).attr('fill', t.color).attr('stroke', '#0d0d1a').attr('stroke-width', 1)
      attachTip(dots, setTip, (d) => `${t.name} · ${d.label}: ${Math.round(d.winRate * 100)}% (${d.n})`)
    })
  }, [buckets, teamBuckets, selected.length, width, height])

  return (
    <div className={hg.chartCard}>
      <div className={hg.chartTitle}>Win rate vs NW lead at break</div>
      <div className={hg.chartSub}>Taker win rate bucketed by net-worth lead{selected.length > 0 ? ' · dots = selected teams' : ' (n games)'}</div>
      <div className={hg.chartBody} ref={ref}><svg ref={svgRef} /><HoverTip tip={tip} /></div>
    </div>
  )
}

/* Break-time histogram (2-min bins), bars coloured by win rate. */
function BreakTimeHistogram({ rows, selected }: { rows: HGRow[]; selected: SelectedTeam[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useResizeSize(ref)
  const [tip, setTip] = useState<Tip | null>(null)

  const bins = useMemo(() => {
    const binSize = 2
    const maxMin = Math.max(20, Math.ceil((d3.max(rows, (r) => r.breakMinute) ?? 20) / binSize) * binSize)
    const map = new Map<number, { n: number; won: number }>()
    for (let b = 0; b < maxMin; b += binSize) map.set(b, { n: 0, won: 0 })
    for (const r of rows) {
      const b = Math.min(Math.floor(r.breakMinute / binSize) * binSize, maxMin - binSize)
      const e = map.get(b)!
      e.n++
      if (r.takerWonGame) e.won++
    }
    return [...map.entries()].map(([start, v]) => ({ start, binSize, n: v.n, winRate: v.n ? v.won / v.n : 0 }))
  }, [rows])

  useEffect(() => {
    if (!svgRef.current || width === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const h = Math.max(220, Math.floor(height) || 220)
    const m = { top: 10, right: 10, bottom: 28, left: 36 }
    svg.attr('width', width).attr('height', h)

    const x = d3.scaleLinear().domain([0, bins[bins.length - 1].start + bins[bins.length - 1].binSize]).range([m.left, width - m.right])
    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.n) ?? 1]).nice().range([h - m.bottom, m.top])

    svg.append('g').attr('transform', `translate(0,${h - m.bottom})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat((d) => `${d}m`) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)
    svg.append('g').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)

    const dim = selected.length > 0
    const bars = svg.selectAll('.bar').data(bins).join('rect')
      .attr('x', (d) => x(d.start) + 1).attr('width', (d) => Math.max(1, x(d.start + d.binSize) - x(d.start) - 2))
      .attr('y', (d) => y(d.n)).attr('height', (d) => y(0) - y(d.n))
      .attr('rx', 1).attr('fill', (d) => (d.n > 0 ? winColor(d.winRate) : 'var(--color-border)')).attr('opacity', dim ? 0.45 : 1)
    attachTip(bars, setTip, (d) => `${d.start}–${d.start + d.binSize} min · ${d.n} games · ${Math.round(d.winRate * 100)}% taker win`)

    // Per-team: individual break-minute ticks + a median line
    for (const t of selected) {
      const mins = t.games.map((g) => g.breakMinute)
      const med = d3.median(mins) ?? 0
      svg.selectAll(null).data(mins).join('line')
        .attr('x1', (d) => x(d as number)).attr('x2', (d) => x(d as number))
        .attr('y1', h - m.bottom).attr('y2', h - m.bottom - 6)
        .attr('stroke', t.color).attr('stroke-width', 1).attr('opacity', 0.7)
      svg.append('line')
        .attr('x1', x(med)).attr('x2', x(med)).attr('y1', m.top).attr('y2', h - m.bottom)
        .attr('stroke', t.color).attr('stroke-width', 2)
        .append('title').text(`${t.name} · median break ${med.toFixed(1)}m`)
    }
  }, [bins, selected, width, height])

  return (
    <div className={hg.chartCard}>
      <div className={hg.chartTitle}>When the break happens</div>
      <div className={hg.chartSub}>Games by break minute · bar colour = taker win rate{selected.length > 0 ? ' · lines = team medians' : ''}</div>
      <div className={hg.chartBody} ref={ref}><svg ref={svgRef} /><HoverTip tip={tip} /></div>
    </div>
  )
}

/* First-highground lane distribution (share of games per lane). */
const LANES = ['TOP', 'MIDDLE', 'BOTTOM'] as const
const LANE_LABEL: Record<string, string> = { TOP: 'Top', MIDDLE: 'Mid', BOTTOM: 'Bottom' }

function laneStats(rows: HGRow[]): { lane: string; label: string; n: number; share: number; winRate: number }[] {
  const withLane = rows.filter((r) => r.raxConversion?.lane)
  const total = withLane.length || 1
  return LANES.map((l) => {
    const games = withLane.filter((r) => r.raxConversion!.lane === l)
    return {
      lane: l,
      label: LANE_LABEL[l],
      n: games.length,
      share: games.length / total,
      winRate: games.length ? games.filter((g) => g.takerWonGame).length / games.length : 0,
    }
  })
}

function LaneChart({ rows, selected }: { rows: HGRow[]; selected: SelectedTeam[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useResizeSize(ref)
  const [tip, setTip] = useState<Tip | null>(null)

  const bars = useMemo(() => laneStats(rows), [rows])
  const teamBars = useMemo(() => selected.map((t) => ({ color: t.color, name: t.name, bars: laneStats(t.games) })), [selected])

  useEffect(() => {
    if (!svgRef.current || width === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const h = Math.max(220, Math.floor(height) || 220)
    const m = { top: 16, right: 10, bottom: 28, left: 40 }
    svg.attr('width', width).attr('height', h)

    const x = d3.scaleBand().domain(bars.map((b) => b.label)).range([m.left, width - m.right]).padding(0.4)
    const maxShare = d3.max([...bars, ...teamBars.flatMap((t) => t.bars)], (b) => b.share) ?? 1
    const y = d3.scaleLinear().domain([0, maxShare]).nice().range([h - m.bottom, m.top])

    svg.append('g').attr('transform', `translate(0,${h - m.bottom})`).call(d3.axisBottom(x) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)
    svg.append('g').attr('transform', `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${Math.round((d as number) * 100)}%`) as never)
      .attr('color', 'var(--color-text-muted)').attr('font-family', 'var(--font-mono)').attr('font-size', 9)

    const dim = selected.length > 0
    const rects = svg.selectAll('.bar').data(bars).join('rect')
      .attr('x', (d) => x(d.label)!).attr('width', x.bandwidth())
      .attr('y', (d) => y(d.share)).attr('height', (d) => y(0) - y(d.share))
      .attr('rx', 2).attr('fill', (d) => winColor(d.winRate)).attr('opacity', dim ? 0.4 : 1)
    attachTip(rects, setTip, (d) => `${d.label}: ${Math.round(d.share * 100)}% of breaks · ${d.n} games · ${Math.round(d.winRate * 100)}% taker win`)
    if (!dim) {
      svg.selectAll('.lbl').data(bars).join('text')
        .attr('x', (d) => x(d.label)! + x.bandwidth() / 2).attr('y', (d) => y(d.share) - 4)
        .attr('text-anchor', 'middle').attr('fill', 'var(--color-text-secondary)')
        .attr('font-family', 'var(--font-mono)').attr('font-size', 9)
        .text((d) => `${Math.round(d.share * 100)}% (${d.n})`)
    }

    const nt = teamBars.length
    const gap = nt > 1 ? Math.min(12, x.bandwidth() / (nt + 1)) : 0
    teamBars.forEach((t, ti) => {
      const offset = (ti - (nt - 1) / 2) * gap
      const pts = t.bars.filter((b) => b.n > 0)
      const dots = svg.selectAll(null).data(pts).join('circle')
        .attr('cx', (d) => x(d.label)! + x.bandwidth() / 2 + offset).attr('cy', (d) => y(d.share))
        .attr('r', 4).attr('fill', t.color).attr('stroke', '#0d0d1a').attr('stroke-width', 1)
      attachTip(dots, setTip, (d) => `${t.name} · ${d.label}: ${Math.round(d.share * 100)}% of their breaks (${d.n})`)
    })
  }, [bars, teamBars, selected.length, width, height])

  return (
    <div className={`${hg.chartCard} ${hg.chartWide}`}>
      <div className={hg.chartTitle}>Which lane breaks first</div>
      <div className={hg.chartSub}>Share of games by the lane whose T3 fell first · bar colour = taker win rate{selected.length > 0 ? ' · dots = selected teams' : ''}</div>
      <div className={hg.chartBody} ref={ref}><svg ref={svgRef} /><HoverTip tip={tip} /></div>
    </div>
  )
}

/* Conversion & advantage splits (HTML percentage bars). */
function PctBar({ label, value, color, markers, title }: { label: string; value: number; color: string; markers?: { color: string; value: number; name: string }[]; title?: string }) {
  return (
    <div className={hg.pctRow} title={title}>
      <span className={hg.pctLabel}>{label}</span>
      <span className={hg.pctTrack}>
        <span className={hg.pctFill} style={{ width: `${Math.round(value * 100)}%`, background: color }} />
        {markers?.map((mk, i) => (
          <span key={i} className={hg.pctMarker} style={{ left: `${Math.round(mk.value * 100)}%`, background: mk.color }} title={`${mk.name}: ${Math.round(mk.value * 100)}%`} />
        ))}
      </span>
      <span className={hg.pctVal}>{Math.round(value * 100)}%</span>
    </div>
  )
}

const CONV_BARS: { group: string; key: ConvKey; label: string; color: string }[] = [
  { group: 'Ranged rax converted within', key: 'rgd1', label: '≤ 1 min', color: 'var(--color-win)' },
  { group: 'Ranged rax converted within', key: 'rgd2', label: '≤ 2 min', color: '#facc15' },
  { group: 'Ranged rax converted within', key: 'rgd3', label: '≤ 3 min', color: '#fb923c' },
  { group: 'Melee rax converted within', key: 'mel1', label: '≤ 1 min', color: 'var(--color-win)' },
  { group: 'Melee rax converted within', key: 'mel2', label: '≤ 2 min', color: '#facc15' },
  { group: 'Melee rax converted within', key: 'mel3', label: '≤ 3 min', color: '#fb923c' },
  { group: 'Taker win rate when…', key: 'aegisYes', label: 'Has aegis', color: '#2dd4bf' },
  { group: 'Taker win rate when…', key: 'aegisNo', label: 'No aegis', color: '#2dd4bf' },
]

function ConversionPanel({ rows, selected }: { rows: HGRow[]; selected: SelectedTeam[] }) {
  const d = useMemo(() => convStats(rows), [rows])
  const bb = useMemo(() => bbDist(rows), [rows])
  const teamStats = useMemo(() => selected.map((t) => ({ color: t.color, name: t.name, stats: convStats(t.games) })), [selected])
  const teamBb = useMemo(() => selected.map((t) => bbDist(t.games)), [selected])

  return (
    <div className={hg.chartCard}>
      <div className={hg.chartTitle}>Conversion &amp; advantage</div>
      <div className={hg.chartSub}>Barracks conversion rate, aegis win-rate split, and buyback availability at the break{selected.length > 0 ? ' · ticks = selected teams' : ''}</div>
      {CONV_BARS.map((b, i) => (
        <div key={b.key}>
          {(i === 0 || CONV_BARS[i - 1].group !== b.group) && <div className={hg.pctGroupLabel}>{b.group}</div>}
          <PctBar
            label={b.label}
            value={d[b.key]}
            color={b.color}
            markers={teamStats.map((t) => ({ color: t.color, name: t.name, value: t.stats[b.key] }))}
          />
        </div>
      ))}
      <div className={hg.pctGroupLabel}>Taker buybacks ready at break (share of games)</div>
      {bb.map((b, i) => (
        <PctBar
          key={b.count}
          label={`${b.count} ready`}
          value={b.share}
          color="var(--color-primary)"
          markers={teamBb.map((tb, ti) => ({ color: selected[ti].color, name: selected[ti].name, value: tb[i].share }))}
          title={`${b.n.toLocaleString()} games · ${Math.round(b.winRate * 100)}% taker win`}
        />
      ))}
    </div>
  )
}

function TeamMultiSelect({
  options, selected, onToggle, full,
}: {
  options: { valveId: number; name: string; breaks: number }[]
  selected: SelectedTeam[]
  onToggle: (id: number) => void
  full: boolean
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  const chosen = new Set(selected.map((s) => s.valveId))
  const filtered = options.filter((o) => !chosen.has(o.valveId) && o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12)

  return (
    <div className={hg.teamSelect} ref={ref}>
      <div className={hg.chips}>
        {selected.map((s) => (
          <span key={s.valveId} className={hg.chip}>
            <span className={hg.chipSwatch} style={{ background: s.color }} />
            {s.name}
            <button className={hg.chipRemove} onClick={() => onToggle(s.valveId)} aria-label={`Remove ${s.name}`}>×</button>
          </span>
        ))}
        {!full && (
          <input
            className={hg.teamSelectInput}
            placeholder={selected.length ? 'Add team…' : 'Highlight teams…'}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
        )}
      </div>
      {open && !full && filtered.length > 0 && (
        <div className={hg.teamDropdown}>
          {filtered.map((o) => (
            <button key={o.valveId} className={hg.teamDropdownItem} onClick={() => { onToggle(o.valveId); setQ(''); setOpen(false) }}>
              {o.name} <span style={{ color: 'var(--color-text-muted)' }}>({o.breaks})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OverallView({ rows, teamIds, onToggle }: { rows: HGRow[]; teamIds: number[]; onToggle: (id: number) => void }) {
  const gamesByTeam = useMemo(() => {
    const m = new Map<number, HGRow[]>()
    for (const r of rows) {
      const arr = m.get(r.taker.valveId)
      if (arr) arr.push(r)
      else m.set(r.taker.valveId, [r])
    }
    return m
  }, [rows])

  const teamOptions = useMemo(
    () => [...gamesByTeam.entries()].map(([valveId, g]) => ({ valveId, name: g[0].taker.name, breaks: g.length })).sort((a, b) => b.breaks - a.breaks),
    [gamesByTeam],
  )

  const selected: SelectedTeam[] = useMemo(
    () =>
      teamIds
        .map((id, i) => ({ valveId: id, name: gamesByTeam.get(id)?.[0]?.taker.name ?? String(id), color: TEAM_PALETTE[i % TEAM_PALETTE.length], games: gamesByTeam.get(id) ?? [] }))
        .filter((s) => s.games.length > 0),
    [teamIds, gamesByTeam],
  )

  const stats = useMemo(() => overallStats(rows), [rows])
  const teamStatList = useMemo(() => selected.map((t) => ({ ...t, s: overallStats(t.games) })), [selected])

  const cardTeamLines = (fmt: (s: ReturnType<typeof overallStats>) => string) =>
    teamStatList.map((t) => (
      <div key={t.valveId} className={hg.statTeam} style={{ color: t.color }}>
        <span className={hg.statTeamName}>{t.name}</span> {fmt(t.s)}
      </div>
    ))

  return (
    <>
      <TeamMultiSelect options={teamOptions} selected={selected} onToggle={onToggle} full={teamIds.length >= TEAM_PALETTE.length} />
      <div className={hg.statCards}>
        <div className={hg.statCard}>
          <div className={hg.statValue}>{stats.n.toLocaleString()}</div><div className={hg.statLabel}>Games</div>
          {cardTeamLines((s) => s.n.toLocaleString())}
        </div>
        <div className={hg.statCard}>
          <div className={hg.statValue}>{Math.round(stats.winRate * 100)}%</div><div className={hg.statLabel}>Taker win rate</div>
          {cardTeamLines((s) => `${Math.round(s.winRate * 100)}%`)}
        </div>
        <div className={hg.statCard}>
          <div className={hg.statValue}>{stats.medBreak.toFixed(1)}</div><div className={hg.statLabel}>Median break min</div>
          {cardTeamLines((s) => s.medBreak.toFixed(1))}
        </div>
        <div className={hg.statCard}>
          <div className={hg.statValue}>{d3.format('+.2s')(stats.avgNw)}</div><div className={hg.statLabel}>Avg NW lead @ break</div>
          {cardTeamLines((s) => d3.format('+.2s')(s.avgNw))}
        </div>
      </div>
      <div className={hg.chartGrid}>
        <LeadTrajectoryChart rows={rows} selected={selected} />
        <WinRateVsLeadChart rows={rows} selected={selected} />
        <BreakTimeHistogram rows={rows} selected={selected} />
        <ConversionPanel rows={rows} selected={selected} />
        <LaneChart rows={rows} selected={selected} />
      </div>
    </>
  )
}

/* ── Hash state ─────────────────────────────────────────── */

type ViewMode = 'table' | 'per-team' | 'overall'

function parseHash(): { view: ViewMode; minBreaks: number; teamIds: number[] } {
  const params = new URLSearchParams(window.location.hash.replace('#', ''))
  const v = params.get('view')
  const view: ViewMode = v === 'per-team' || v === 'overall' ? v : 'table'
  const minBreaks = parseInt(params.get('min') ?? '1', 10) || 1
  const teamIds = (params.get('teams') ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n))
    .slice(0, TEAM_PALETTE.length)
  return { view, minBreaks, teamIds }
}

function setHash(view: ViewMode, minBreaks: number, teamIds: number[]) {
  const params = new URLSearchParams()
  params.set('view', view)
  params.set('min', String(minBreaks))
  if (teamIds.length) params.set('teams', teamIds.join(','))
  window.location.hash = params.toString()
}

/* ── Page ───────────────────────────────────────────────── */

export default function HighgroundScenarios() {
  const {
    filters, setFilters, clearFilters, applyDefaults, apiParams, hasFilters,
    filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { data, isLoading, error } = useApiQuery<{ data: HGRow[] }>(
    hasFilters ? '/api/events/highground-scenarios' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data?.data])
  const columns = useMemo(() => buildColumns(), [])
  const perTeamColumns = useMemo(() => buildPerTeamColumns(), [])

  const [view, setView] = useState<ViewMode>(() => parseHash().view)
  const [minBreaks, setMinBreaks] = useState(() => parseHash().minBreaks)
  const [teamIds, setTeamIds] = useState<number[]>(() => parseHash().teamIds)

  useEffect(() => {
    const onHashChange = () => {
      const h = parseHash()
      setView(h.view)
      setMinBreaks(h.minBreaks)
      setTeamIds(h.teamIds)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const toggleTeam = (id: number) => {
    const next = teamIds.includes(id)
      ? teamIds.filter((x) => x !== id)
      : teamIds.length >= TEAM_PALETTE.length
        ? teamIds
        : [...teamIds, id]
    setTeamIds(next)
    setHash(view, minBreaks, next)
  }

  const perTeamRows = useMemo(
    () => buildPerTeam(rows).filter((t) => t.breaks >= minBreaks),
    [rows, minBreaks],
  )

  return (
    <div className={styles.page}>
      <PageMeta
        title="Highground Scenarios — Pro Dota 2"
        description="The build-up to the first highground (Tier-3) break of each pro Dota 2 game: leads, buybacks, aegis, teamfights and barracks conversion."
      />
      <div className={styles.header}>
        <h1>
          Highground Scenarios
          <a href="/glossary#highground-scenarios" className={hg.help} title="What are highground scenarios?" aria-label="What are highground scenarios? — opens the glossary">?</a>
        </h1>
        <p className={styles.subtitle}>How the first Tier-3 (highground) break of each game came together</p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'after', 'before', 'leagues', 'splits', 'tier', 'split-type']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Select filters to query highground scenarios.</p>
          <Link to="/teams/highground-scenarios?default=true" className={styles.defaultLink} onClick={(e) => { e.preventDefault(); applyDefaults() }}>
            Load defaults
          </Link>
        </div>
      )}

      {hasFilters && isLoading && <EnigmaLoader text="Loading highground scenarios..." />}

      {hasFilters && error && (
        <div className={styles.error}>
          Failed to load highground scenarios. {error instanceof Error ? error.message : ''}
        </div>
      )}

      {hasFilters && !isLoading && !error && rows.length === 0 && (
        <div className={styles.empty}><p>No highground scenarios found for these filters.</p></div>
      )}

      {rows.length > 0 && (
        <>
          <div className={hg.controls}>
            <div className={toggleStyles.toggleRow} style={{ marginBottom: 0 }}>
              <button className={`${toggleStyles.toggleBtn} ${view === 'table' ? toggleStyles.toggleActive : ''}`} onClick={() => { setView('table'); setHash('table', minBreaks, teamIds) }}>Table</button>
              <button className={`${toggleStyles.toggleBtn} ${view === 'per-team' ? toggleStyles.toggleActive : ''}`} onClick={() => { setView('per-team'); setHash('per-team', minBreaks, teamIds) }}>Per-team</button>
              <button className={`${toggleStyles.toggleBtn} ${view === 'overall' ? toggleStyles.toggleActive : ''}`} onClick={() => { setView('overall'); setHash('overall', minBreaks, teamIds) }}>Overall</button>
            </div>
            {view === 'per-team' && (
              <div className={hg.minControl}>
                <HelpLabel text="Min Breaks" tip="Minimum number of highground breaks for a team to appear in the per-team table." />
                <input
                  type="number" min={1} className={hg.minInput} value={minBreaks}
                  onChange={(e) => { const v = Math.max(1, parseInt(e.target.value, 10) || 1); setMinBreaks(v); setHash(view, v, teamIds) }}
                />
              </div>
            )}
          </div>

          {view === 'table' && (
            <DataTable
              data={rows}
              columns={columns}
              defaultSorting={[{ id: 'breakTime', desc: false }]}
              rowHeight={44}
              searchValue={(r) => [String(r.matchId), r.taker.name, r.defender.name, r.raxConversion?.lane ?? ''].join(' ')}
            />
          )}

          {view === 'per-team' && (
            <DataTable
              data={perTeamRows}
              columns={perTeamColumns}
              defaultSorting={[{ id: 'breaks', desc: true }]}
              searchValue={(r) => r.name}
            />
          )}

          {view === 'overall' && <OverallView rows={rows} teamIds={teamIds} onToggle={toggleTeam} />}
        </>
      )}
    </div>
  )
}
