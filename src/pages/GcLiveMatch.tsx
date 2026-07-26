import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useNoIndex } from '../hooks/useNoIndex'
import { API_BASE_URL, heroImageUrl, itemImageUrl, leagueLogoUrl } from '../config'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import { formatDuration, buildDraftSequence } from '../lib/live'
import LiveMinimap, { type MinimapHero, type MinimapBuilding } from '../components/LiveMinimap'
import LiveDraftView from '../components/LiveDraft'
import EnigmaLoader from '../components/EnigmaLoader'
import PageMeta from '../components/PageMeta'
import shared from './MatchShow.module.css'
import styles from './LiveMatch.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface GcSummary {
  matchId: number
  serverSteamId: string
  leagueId: number
  tier: number
  leagueName: string
  radiant: string
  dire: string
  radiantTeamId: number
  direTeamId: number
  gameTime: number
  spectators: number
  seriesId: number
}

interface GcRawPlayer {
  accountid: number
  name: string
  heroid: number
  team: number
  level: number
  kill_count: number
  death_count: number
  assists_count: number
  lh_count: number
  denies_count: number
  gold: number
  net_worth: number
  x: number
  y: number
  items: number[]
}

interface GcRawTeam {
  team_number: number
  team_id: number
  team_name: string
  score: number
  net_worth: number
  players: GcRawPlayer[]
}

interface GcBuilding {
  team: number
  type: number
  lane: number
  tier: number
  x: number
  y: number
  destroyed: boolean
}

interface GcRaw {
  match: { game_state: number; picks: { hero: number; team: number }[]; bans: { hero: number; team: number }[] }
  teams: GcRawTeam[]
  buildings: GcBuilding[]
  graph_data: { graph_gold: number[] }
}

interface GcStats {
  gameTime: number
  gameState: number
  radiantScore: number
  direScore: number
  radiantNetWorth: number
  direNetWorth: number
  radiantLead: number
}

interface GcUpdate {
  matchId: number
  summary: GcSummary
  stats: GcStats
  raw: GcRaw
}

/* ── Helpers ────────────────────────────────────────────── */

// gc x/y are normalized (~±0.33); this factor maps them into LiveMinimap world space
// (±8288). Tuned so the ancients land in the correct corners; nudge if structures drift.
const GC_COORD_FACTOR = 21000

const GAME_STATE_LABEL: Record<number, string> = {
  1: 'Loading', 2: 'Draft', 3: 'Strategy', 4: 'Pre-game', 5: 'In progress', 6: 'Post-game', 7: 'Ended',
}

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}
function heroPic(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}
function itemShortName(id: number): string | null {
  if (id <= 0) return null
  return itemsData[String(id)]?.shortName ?? null
}
function sideOf(team: number): 'radiant' | 'dire' {
  return team === 2 ? 'radiant' : 'dire'
}

/** Prior pro & premium single performances for this player on this hero. */
function priorGamesLink(accountId: number, heroId: number): string {
  const params = new URLSearchParams({ players: String(accountId), heroes: String(heroId), tier: '1,2' })
  return `/players/single-performances?${params.toString()}`
}

function buildingType(t: number): MinimapBuilding['type'] {
  if (t === 1) return 'rax'
  if (t === 2) return 'ancient'
  return 'tower'
}

/* ── SSE hook ───────────────────────────────────────────── */

type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'ended'

function useGcStream(matchId: string | undefined): { data: GcUpdate | null; status: StreamStatus } {
  const [data, setData] = useState<GcUpdate | null>(null)
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    if (!matchId) return
    let gotData = false
    const es = new EventSource(`${API_BASE_URL}/api/livegames/gc/${matchId}/stream`)
    es.addEventListener('update', (e) => {
      try {
        setData(JSON.parse((e as MessageEvent).data))
        gotData = true
        setStatus('live')
      } catch { /* ignore malformed frame */ }
    })
    es.addEventListener('end', () => {
      setStatus('ended')
      es.close()
    })
    es.onerror = () => setStatus((s) => (s === 'ended' ? s : gotData ? 'reconnecting' : 'connecting'))
    return () => es.close()
  }, [matchId])

  return { data, status }
}

/* ── Map ────────────────────────────────────────────────── */

function GcMapView({ raw }: { raw: GcRaw }) {
  const buildings: MinimapBuilding[] = (raw.buildings ?? [])
    .filter((b) => b.team === 2 || b.team === 3)
    .map((b, i) => ({
      key: `${b.type}-${b.team}-${i}`,
      x: b.x * GC_COORD_FACTOR,
      y: b.y * GC_COORD_FACTOR,
      type: buildingType(b.type),
      side: sideOf(b.team),
      destroyed: b.destroyed,
      label: `${sideOf(b.team)} ${buildingType(b.type)}`,
    }))

  const heroes: MinimapHero[] = (raw.teams ?? []).flatMap((t) =>
    t.players.map((p) => ({
      key: `${p.team}-${p.accountid}`,
      x: p.x * GC_COORD_FACTOR,
      y: p.y * GC_COORD_FACTOR,
      picture: heroPic(p.heroid),
      side: sideOf(p.team),
      label: `${heroName(p.heroid)} · ${p.kill_count}/${p.death_count}/${p.assists_count}`,
    })),
  )

  return <LiveMinimap heroes={heroes} buildings={buildings} />
}

/* ── Gold graph ─────────────────────────────────────────── */

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setW(Math.max(0, entries[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

function fmtK(v: number): string {
  if (v === 0) return '0'
  return `${v > 0 ? '+' : '−'}${Math.abs(v) / 1000}k`
}

function GoldGraph({ series, gameTime }: { series: number[]; gameTime: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(ref)
  const [hover, setHover] = useState<{ clientX: number; clientY: number; idx: number } | null>(null)
  if (!series || series.length < 2) return null

  const n = series.length
  const h = 156
  const m = { top: 8, right: 10, bottom: 18, left: 40 }
  // Symmetric domain: at least ±10k, widen to ±|max lead| when it exceeds 10k.
  const bound = Math.max(10000, ...series.map((v) => Math.abs(v)))
  const interval = gameTime > 0 ? gameTime / (n - 1) : 0
  const innerW = Math.max(1, width - m.left - m.right)
  const xIdx = (i: number) => m.left + (i / (n - 1)) * innerW
  const xTime = (t: number) => m.left + (gameTime > 0 ? (t / gameTime) * innerW : 0)
  const yFor = (v: number) => (h - m.bottom) - ((v + bound) / (2 * bound)) * ((h - m.bottom) - m.top)

  const line = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${xIdx(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ')
  const area = `M${xIdx(0).toFixed(1)},${yFor(0).toFixed(1)} ${series.map((v, i) => `L${xIdx(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ')} L${xIdx(n - 1).toFixed(1)},${yFor(0).toFixed(1)} Z`

  const yTicks: number[] = []
  for (let v = 10000; v <= bound; v += 10000) { yTicks.push(v); yTicks.push(-v) }
  yTicks.push(0)
  const xTicks: number[] = []
  for (let t = 0; t <= gameTime; t += 300) xTicks.push(t)

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left - m.left) / innerW))
    setHover({ clientX: e.clientX, clientY: e.clientY, idx: Math.round(fx * (n - 1)) })
  }

  const hv = hover ? series[hover.idx] : 0

  return (
    <div className={styles.roshanStrip} style={{ display: 'block', padding: '8px 10px' }}>
      <div className={styles.roshanStripLabel} style={{ marginBottom: 4 }}>Radiant gold lead</div>
      <div ref={ref} style={{ position: 'relative', width: '100%', height: h }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={h} style={{ display: 'block' }} role="img" aria-label="Radiant net-worth lead over time">
            {/* y gridlines + labels */}
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={m.left} x2={width - m.right} y1={yFor(v)} y2={yFor(v)} stroke="var(--color-border)" strokeWidth={v === 0 ? 1 : 0.5} strokeDasharray={v === 0 ? undefined : '2 2'} opacity={v === 0 ? 0.9 : 0.5} />
                <text x={m.left - 6} y={yFor(v)} textAnchor="end" dominantBaseline="central" fill="var(--color-text-muted)" fontFamily="var(--font-mono)" fontSize={9}>{fmtK(v)}</text>
              </g>
            ))}
            {/* x gridlines + labels (every 5 min) */}
            {xTicks.map((t) => (
              <g key={`x${t}`}>
                <line x1={xTime(t)} x2={xTime(t)} y1={m.top} y2={h - m.bottom} stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.4} />
                <text x={xTime(t)} y={h - 5} textAnchor="middle" fill="var(--color-text-muted)" fontFamily="var(--font-mono)" fontSize={9}>{t / 60}m</text>
              </g>
            ))}
            <path d={area} fill="rgba(45, 212, 191, 0.15)" />
            <path d={line} fill="none" stroke="var(--color-accent-bright)" strokeWidth={1.5} />
            {hover && (
              <>
                <line x1={xIdx(hover.idx)} x2={xIdx(hover.idx)} y1={m.top} y2={h - m.bottom} stroke="var(--color-text-muted)" strokeWidth={1} />
                <circle cx={xIdx(hover.idx)} cy={yFor(hv)} r={3.5} fill="var(--color-accent-bright)" stroke="#0d0d1a" strokeWidth={1} />
              </>
            )}
          </svg>
        )}
        {hover && (
          <div style={{
            position: 'fixed', left: hover.clientX + 12, top: hover.clientY - 10, zIndex: 100, pointerEvents: 'none',
            background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '5px 9px',
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-text)', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            {formatDuration(Math.round(hover.idx * interval))} ·{' '}
            <span style={{ color: hv >= 0 ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 600 }}>
              {hv >= 0 ? '+' : ''}{hv.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Scoreboard ─────────────────────────────────────────── */

function GcScoreboardTable({ team, label, advantage }: { team: GcRawTeam; label: string; advantage: number }) {
  const labelClass = label === 'Radiant' ? shared.radiantLabel : shared.direLabel
  return (
    <div className={shared.section}>
      <div className={`${shared.sectionTitle} ${labelClass}`}>
        {label}{' '}
        {team.team_name && (
          team.team_id
            ? <a href={`/teams/${team.team_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>· {team.team_name}</a>
            : `· ${team.team_name}`
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          {team.score} kills · {team.net_worth.toLocaleString()} net worth{' '}
          {advantage !== 0 && (
            <span style={{ color: advantage > 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
              ({advantage > 0 ? '+' : ''}{advantage.toLocaleString()})
            </span>
          )}
        </span>
      </div>
      <div className={shared.scoreboardWrap}>
        <table className={`${shared.scoreboard} ${styles.fixedTable}`}>
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: 118 }} />
            <col style={{ width: 36 }} />
            <col style={{ width: 36 }} />
            <col style={{ width: 36 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 168 }} />
            <col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr>
              <th className={shared.thHero}>Hero</th>
              <th>Player</th>
              <th className={shared.thNum}>K</th>
              <th className={shared.thNum}>D</th>
              <th className={shared.thNum}>A</th>
              <th className={shared.thNum}>LH</th>
              <th className={shared.thNum}>DN</th>
              <th className={shared.thNum}>NW</th>
              <th>Items</th>
              <th className={shared.thNum}>Prior</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p) => <GcPlayerRow key={p.accountid} p={p} />)}
          </tbody>
          <tfoot>
            <GcTotalsRow players={team.players} />
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function GcTotalsRow({ players }: { players: GcRawPlayer[] }) {
  const sum = (fn: (p: GcRawPlayer) => number) => players.reduce((s, p) => s + fn(p), 0)
  return (
    <tr className={shared.totalsRow}>
      <td className={shared.tdHero} />
      <td className={shared.totalsLabel}>Total</td>
      <td className={shared.tdNum}>{sum((p) => p.kill_count)}</td>
      <td className={shared.tdNum}>{sum((p) => p.death_count)}</td>
      <td className={shared.tdNum}>{sum((p) => p.assists_count)}</td>
      <td className={shared.tdNum}>{sum((p) => p.lh_count)}</td>
      <td className={shared.tdNum}>{sum((p) => p.denies_count)}</td>
      <td className={shared.tdNum}>{sum((p) => p.net_worth).toLocaleString()}</td>
      <td />
      <td />
    </tr>
  )
}

function GcPlayerRow({ p }: { p: GcRawPlayer }) {
  const pic = heroPic(p.heroid)
  return (
    <tr>
      <td className={shared.tdHero}>
        <div className={styles.heroSlot}>
          {pic ? (
            <img src={heroImageUrl(pic)} alt={heroName(p.heroid)} className={shared.heroImg} title={heroName(p.heroid)} />
          ) : (
            <span className={shared.heroFallback}>{heroName(p.heroid)}</span>
          )}
          <span className={styles.heroLevel}>{p.level}</span>
        </div>
      </td>
      <td className={shared.tdPlayer}>
        {p.accountid ? (
          <a href={`/players/${p.accountid}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none' }}>{p.name}</a>
        ) : p.name}
      </td>
      <td className={shared.tdNum}>{p.kill_count}</td>
      <td className={shared.tdNum}>{p.death_count}</td>
      <td className={shared.tdNum}>{p.assists_count}</td>
      <td className={shared.tdNum}>{p.lh_count}</td>
      <td className={shared.tdNum}>{p.denies_count}</td>
      <td className={shared.tdNum}>{p.net_worth.toLocaleString()}</td>
      <td>
        <div className={styles.itemRow}>
          {Array.from({ length: 6 }).map((_, i) => {
            const sn = itemShortName(p.items?.[i] ?? -1)
            if (!sn) return <span key={i} className={styles.itemSlot} />
            return <img key={i} src={itemImageUrl(sn)} alt={sn} title={sn} className={styles.itemImg} />
          })}
        </div>
      </td>
      <td className={shared.tdNum}>
        {p.accountid ? (
          <a href={priorGamesLink(p.accountid, p.heroid)} title={`Prior pro & premium games on ${heroName(p.heroid)}`}
            style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '1.15rem', lineHeight: 1, display: 'inline-block' }}>↗</a>
        ) : null}
      </td>
    </tr>
  )
}

/* ── Page ───────────────────────────────────────────────── */

export default function GcLiveMatch() {
  useNoIndex()
  const { matchId } = useParams<{ matchId: string }>()
  const { data, status } = useGcStream(matchId)

  const draftSteps = useMemo(() => {
    if (!data) return []
    const picks = data.raw.match?.picks ?? []
    const bans = data.raw.match?.bans ?? []
    if (picks.length === 0 && bans.length === 0) return []
    const bySide = (side: 'radiant' | 'dire') => ({
      picks: picks.filter((x) => sideOf(x.team) === side).map((x) => x.hero),
      bans: bans.filter((x) => sideOf(x.team) === side).map((x) => x.hero),
    })
    // First action is a ban by the first-pick team.
    const firstPick: 'radiant' | 'dire' = bans[0] ? sideOf(bans[0].team) : picks[0] ? sideOf(picks[0].team) : 'radiant'
    return buildDraftSequence(bySide('radiant'), bySide('dire'), firstPick)
  }, [data])

  if (!data) {
    return <EnigmaLoader text={status === 'ended' ? 'Match has ended.' : 'Connecting to live stream...'} />
  }

  const { summary, stats, raw } = data
  const radiant = raw.teams?.find((t) => t.team_number === 2)
  const dire = raw.teams?.find((t) => t.team_number === 3)
  const radiantName = radiant?.team_name || summary.radiant || 'Radiant'
  const direName = dire?.team_name || summary.dire || 'Dire'
  const radiantAdvantage = stats.radiantLead ?? ((radiant?.net_worth ?? 0) - (dire?.net_worth ?? 0))

  return (
    <div className={shared.page}>
      <PageMeta
        title={`${radiantName} vs ${direName} — LIVE (${stats.radiantScore}-${stats.direScore})`}
        description={`Live Dota 2 match: ${radiantName} vs ${direName} at ${summary.leagueName}.`}
        noindex
      />

      {/* Status strip */}
      <div className={styles.statusStrip}>
        {status === 'ended' ? (
          <span className={styles.delay}>Ended</span>
        ) : (
          <span className={styles.liveBadge}><span className={styles.liveDot} /> Live</span>
        )}
        <span className={styles.clock}>{formatDuration(stats.gameTime)}</span>
        <span className={styles.statusSep}>·</span>
        <span>{GAME_STATE_LABEL[stats.gameState] ?? 'Live'}</span>
        <span className={styles.statusSep}>·</span>
        <span>{(summary.spectators ?? 0).toLocaleString()} watching</span>
        <span className={styles.statusRight}>
          {status === 'reconnecting' && <span className={styles.delay}>Reconnecting…</span>}
          {status !== 'reconnecting' && <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GC source</span>}
        </span>
      </div>

      {/* Match header */}
      <div className={`${shared.matchHeader} ${styles.header}`}>
        <div className={`${shared.teamSide} ${shared.radiantSide}`}>
          <div className={shared.teamInfo}>
            {summary.radiantTeamId
              ? <a href={`/teams/${summary.radiantTeamId}`} className={`${shared.teamName} ${styles.headerName}`}>{radiantName}</a>
              : <span className={`${shared.teamName} ${styles.headerName}`}>{radiantName}</span>}
          </div>
        </div>
        <div className={`${shared.scoreBlock} ${styles.headerBlock}`}>
          <div className={shared.scoreLine}>
            <span className={`${shared.score} ${styles.headerScore}`} style={{ color: 'var(--color-win)' }}>{stats.radiantScore}</span>
            <span className={`${shared.scoreDivider} ${styles.headerDivider}`}>–</span>
            <span className={`${shared.score} ${styles.headerScore}`} style={{ color: 'var(--color-loss)' }}>{stats.direScore}</span>
          </div>
          <div className={shared.matchMeta}><span>{formatDuration(stats.gameTime)}</span></div>
        </div>
        <div className={`${shared.teamSide} ${shared.direSide}`}>
          <div className={`${shared.teamInfo} ${shared.teamInfoRight}`}>
            {summary.direTeamId
              ? <a href={`/teams/${summary.direTeamId}`} className={`${shared.teamName} ${styles.headerName}`}>{direName}</a>
              : <span className={`${shared.teamName} ${styles.headerName}`}>{direName}</span>}
          </div>
        </div>
      </div>

      {/* League bar */}
      <div className={shared.leagueBar}>
        <img src={leagueLogoUrl(summary.leagueId)} alt="" className={shared.leagueLogo}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <a href={`/leagues/${summary.leagueId}`} className={shared.leagueName}>{summary.leagueName}</a>
        <span className={shared.matchId}>Match {summary.matchId}</span>
      </div>

      {/* 2-column: map (40%) · teams (60%) */}
      <div className={styles.liveGrid}>
        <div className={styles.mapCol}>
          <div className={shared.section}>
            <div className={shared.sectionTitle}>Map</div>
            <div className={styles.mapSize}>
              <GcMapView raw={raw} />
            </div>
            <GoldGraph series={raw.graph_data?.graph_gold ?? []} gameTime={stats.gameTime} />
          </div>
        </div>
        <div className={styles.teamsCol}>
          {radiant && <GcScoreboardTable team={radiant} label="Radiant" advantage={radiantAdvantage} />}
          {dire && <GcScoreboardTable team={dire} label="Dire" advantage={-radiantAdvantage} />}
        </div>
      </div>

      {/* Draft */}
      {draftSteps.length > 0 && (
        <div className={shared.section}>
          <div className={shared.sectionTitle}>Draft</div>
          <LiveDraftView steps={draftSteps} />
        </div>
      )}
    </div>
  )
}
