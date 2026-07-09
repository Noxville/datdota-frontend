import { Fragment, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { useNoIndex } from '../hooks/useNoIndex'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import { heroImageUrl, itemImageUrl, teamLogoUrl, leagueLogoUrl } from '../config'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import exampleLiveMatch from '../data/exampleLiveMatch.json'
import shared from './MatchShow.module.css'
import styles from './LiveMatch.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface LivePlayerInfo {
  account_id: number
  name: string
  hero_id: number
  team: number
}

interface LiveTeam {
  team_name: string
  team_id: number
  team_logo: number | string
  complete: boolean
}

interface LivePickBan {
  hero_id: number
}

interface LiveScoreboardPlayer {
  player_slot: number
  account_id: number
  hero_id: number
  kills: number
  death: number
  assists: number
  last_hits: number
  denies: number
  gold: number
  level: number
  gold_per_min: number
  xp_per_min: number
  ultimate_state: number
  ultimate_cooldown: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  respawn_timer: number
  position_x: number
  position_y: number
  net_worth: number
}

interface LiveScoreboardSide {
  score: number
  tower_state: number
  barracks_state: number
  picks: LivePickBan[]
  bans: LivePickBan[]
  players: LiveScoreboardPlayer[]
}

interface LiveScoreboard {
  duration: number
  roshan_respawn_timer: number
  radiant: LiveScoreboardSide
  dire: LiveScoreboardSide
}

interface LiveLeagueInfo {
  tier: number
  name: string
}

interface LiveMatchData {
  players: LivePlayerInfo[]
  radiant_team?: LiveTeam
  dire_team?: LiveTeam
  match_id: number
  lobby_id: number
  spectators: number
  league_id: number
  stream_delay_s: number
  radiant_series_wins: number
  dire_series_wins: number
  series_type: number
  scoreboard: LiveScoreboard
  league_info?: LiveLeagueInfo
}

interface LiveMatchResponse {
  data: LiveMatchData
}

/* ── Helpers ────────────────────────────────────────────── */

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPic(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function itemShortName(id: number): string | null {
  if (id <= 0) return null
  const item = itemsData[String(id)]
  return item?.shortName ?? null
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function teamLogo(id: number | string | undefined): string | null {
  if (id === undefined || id === null) return null
  const asStr = String(id)
  if (asStr === '0') return null
  return teamLogoUrl(asStr)
}

function seriesTypeLabel(t: number): string {
  if (t === 1) return 'Bo3'
  if (t === 2) return 'Bo5'
  return 'Bo1'
}

/* ── Tower / barracks model ─────────────────────────────── */

// Bit order (Valve dota_gc DOTA_TOWER_STATE):
// 0: T1 top, 1: T1 mid, 2: T1 bot,
// 3: T2 top, 4: T2 mid, 5: T2 bot,
// 6: T3 top, 7: T3 mid, 8: T3 bot,
// 9: T4 (ancient north), 10: T4 (ancient south)

interface Tower {
  bit: number
  // normalized [0..1] in SVG viewBox space
  cx: number
  cy: number
  tier: number
}

interface Rax {
  bit: number
  cx: number
  cy: number
  lane: 'top' | 'mid' | 'bot'
  kind: 'melee' | 'ranged'
}

const RADIANT_TOWERS: Tower[] = [
  { bit: 0, cx: 0.10, cy: 0.20, tier: 1 }, // T1 top
  { bit: 1, cx: 0.46, cy: 0.50, tier: 1 }, // T1 mid
  { bit: 2, cx: 0.72, cy: 0.90, tier: 1 }, // T1 bot
  { bit: 3, cx: 0.10, cy: 0.40, tier: 2 }, // T2 top
  { bit: 4, cx: 0.32, cy: 0.64, tier: 2 }, // T2 mid
  { bit: 5, cx: 0.50, cy: 0.90, tier: 2 }, // T2 bot
  { bit: 6, cx: 0.10, cy: 0.62, tier: 3 }, // T3 top
  { bit: 7, cx: 0.22, cy: 0.78, tier: 3 }, // T3 mid
  { bit: 8, cx: 0.30, cy: 0.90, tier: 3 }, // T3 bot
  { bit: 9, cx: 0.10, cy: 0.83, tier: 4 }, // T4 north
  { bit: 10, cx: 0.16, cy: 0.90, tier: 4 }, // T4 south
]

const DIRE_TOWERS: Tower[] = [
  { bit: 0, cx: 0.30, cy: 0.10, tier: 1 }, // T1 top
  { bit: 1, cx: 0.54, cy: 0.46, tier: 1 }, // T1 mid
  { bit: 2, cx: 0.90, cy: 0.70, tier: 1 }, // T1 bot
  { bit: 3, cx: 0.50, cy: 0.10, tier: 2 }, // T2 top
  { bit: 4, cx: 0.68, cy: 0.34, tier: 2 }, // T2 mid
  { bit: 5, cx: 0.90, cy: 0.50, tier: 2 }, // T2 bot
  { bit: 6, cx: 0.70, cy: 0.10, tier: 3 }, // T3 top
  { bit: 7, cx: 0.80, cy: 0.20, tier: 3 }, // T3 mid
  { bit: 8, cx: 0.90, cy: 0.30, tier: 3 }, // T3 bot
  { bit: 9, cx: 0.90, cy: 0.10, tier: 4 }, // T4 north
  { bit: 10, cx: 0.84, cy: 0.16, tier: 4 }, // T4 south
]

const RADIANT_RAX: Rax[] = [
  { bit: 0, cx: 0.10, cy: 0.65, lane: 'top', kind: 'melee' },
  { bit: 1, cx: 0.12, cy: 0.69, lane: 'top', kind: 'ranged' },
  { bit: 2, cx: 0.17, cy: 0.82, lane: 'mid', kind: 'melee' },
  { bit: 3, cx: 0.20, cy: 0.85, lane: 'mid', kind: 'ranged' },
  { bit: 4, cx: 0.24, cy: 0.90, lane: 'bot', kind: 'melee' },
  { bit: 5, cx: 0.28, cy: 0.90, lane: 'bot', kind: 'ranged' },
]

const DIRE_RAX: Rax[] = [
  { bit: 0, cx: 0.74, cy: 0.10, lane: 'top', kind: 'melee' },
  { bit: 1, cx: 0.78, cy: 0.10, lane: 'top', kind: 'ranged' },
  { bit: 2, cx: 0.83, cy: 0.15, lane: 'mid', kind: 'melee' },
  { bit: 3, cx: 0.85, cy: 0.18, lane: 'mid', kind: 'ranged' },
  { bit: 4, cx: 0.90, cy: 0.30, lane: 'bot', kind: 'melee' },
  { bit: 5, cx: 0.90, cy: 0.34, lane: 'bot', kind: 'ranged' },
]

// Roshan pit (approx) - slightly above & left of center
const ROSHAN_POS = { cx: 0.40, cy: 0.32 }

// World coords approx span; map fountain-to-fountain across about ±7500
const WORLD_MIN = -7500
const WORLD_MAX = 7500

function worldToSvg(x: number, y: number, size: number): { x: number; y: number } {
  const span = WORLD_MAX - WORLD_MIN
  const nx = (x - WORLD_MIN) / span
  const ny = (y - WORLD_MIN) / span
  return {
    x: Math.max(0, Math.min(1, nx)) * size,
    y: Math.max(0, Math.min(1, 1 - ny)) * size,
  }
}

/* ── Hooks ──────────────────────────────────────────────── */

const POLL_MS = 5000

function useLiveMatch(id: string | undefined) {
  return useQuery<LiveMatchResponse>({
    queryKey: ['api', '/api/livegames', id],
    queryFn: async () => {
      if (id === 'test') return exampleLiveMatch as LiveMatchResponse
      return apiFetch<LiveMatchResponse>(`/api/livegames/${id}`)
    },
    enabled: !!id,
    refetchInterval: id === 'test' ? false : POLL_MS,
    staleTime: 0,
  })
}

/* ── Map view ───────────────────────────────────────────── */

const MAP_SIZE = 600

function MapView({ data }: { data: LiveMatchData }) {
  const sb = data.scoreboard
  const radiantTowerBits = sb.radiant.tower_state
  const direTowerBits = sb.dire.tower_state
  const radiantRaxBits = sb.radiant.barracks_state
  const direRaxBits = sb.dire.barracks_state

  const ros = sb.roshan_respawn_timer

  return (
    <div className={styles.mapWrap}>
      <div className={styles.mapSvgWrap}>
        <svg
          className={styles.mapSvg}
          viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Live map"
        >
          {/* Background quadrants — Radiant (green) bottom-left, Dire (red) top-right */}
          <rect x="0" y="0" width={MAP_SIZE} height={MAP_SIZE} fill="#1a1f1c" />
          <polygon
            points={`0,${MAP_SIZE} ${MAP_SIZE},${MAP_SIZE} 0,0`}
            fill="rgba(74, 222, 128, 0.06)"
          />
          <polygon
            points={`${MAP_SIZE},0 ${MAP_SIZE},${MAP_SIZE} 0,0`}
            fill="rgba(248, 113, 113, 0.06)"
          />
          {/* River diagonal */}
          <line
            x1="0"
            y1={MAP_SIZE}
            x2={MAP_SIZE}
            y2="0"
            stroke="rgba(96, 165, 250, 0.25)"
            strokeWidth="14"
          />

          {/* Lanes (rough L shapes) */}
          {/* Top lane: left edge + top edge */}
          <polyline
            points={`60,${MAP_SIZE - 60} 60,60 ${MAP_SIZE - 60},60`}
            fill="none"
            stroke="rgba(196, 139, 196, 0.18)"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bot lane: bottom edge + right edge */}
          <polyline
            points={`60,${MAP_SIZE - 60} ${MAP_SIZE - 60},${MAP_SIZE - 60} ${MAP_SIZE - 60},60`}
            fill="none"
            stroke="rgba(196, 139, 196, 0.18)"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Mid lane */}
          <line
            x1="80"
            y1={MAP_SIZE - 80}
            x2={MAP_SIZE - 80}
            y2="80"
            stroke="rgba(196, 139, 196, 0.18)"
            strokeWidth="22"
            strokeLinecap="round"
          />

          {/* Ancients */}
          <circle cx={0.12 * MAP_SIZE} cy={0.88 * MAP_SIZE} r="12" fill="#4ade80" opacity="0.85" />
          <circle cx={0.88 * MAP_SIZE} cy={0.12 * MAP_SIZE} r="12" fill="#f87171" opacity="0.85" />

          {/* Towers */}
          {RADIANT_TOWERS.map((t) => (
            <TowerMarker
              key={`r-t-${t.bit}`}
              tower={t}
              alive={(radiantTowerBits & (1 << t.bit)) !== 0}
              side="radiant"
              size={MAP_SIZE}
            />
          ))}
          {DIRE_TOWERS.map((t) => (
            <TowerMarker
              key={`d-t-${t.bit}`}
              tower={t}
              alive={(direTowerBits & (1 << t.bit)) !== 0}
              side="dire"
              size={MAP_SIZE}
            />
          ))}

          {/* Barracks */}
          {RADIANT_RAX.map((r) => (
            <RaxMarker
              key={`r-rx-${r.bit}`}
              rax={r}
              alive={(radiantRaxBits & (1 << r.bit)) !== 0}
              side="radiant"
              size={MAP_SIZE}
            />
          ))}
          {DIRE_RAX.map((r) => (
            <RaxMarker
              key={`d-rx-${r.bit}`}
              rax={r}
              alive={(direRaxBits & (1 << r.bit)) !== 0}
              side="dire"
              size={MAP_SIZE}
            />
          ))}

          {/* Roshan */}
          <g transform={`translate(${ROSHAN_POS.cx * MAP_SIZE}, ${ROSHAN_POS.cy * MAP_SIZE})`}>
            <circle r="10" fill={ros > 0 ? '#555' : '#facc15'} opacity={ros > 0 ? 0.55 : 0.9} />
            <text
              y="3"
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-mono)"
              fontWeight="700"
              fill="#0e1410"
            >
              R
            </text>
          </g>

          {/* Heroes */}
          {sb.radiant.players.map((p) => (
            <HeroDot key={`r-${p.account_id}`} p={p} side="radiant" size={MAP_SIZE} />
          ))}
          {sb.dire.players.map((p) => (
            <HeroDot key={`d-${p.account_id}`} p={p} side="dire" size={MAP_SIZE} />
          ))}
        </svg>
      </div>

      <div className={styles.mapLegend}>
        <div className={styles.roshanCard}>
          <div className={styles.roshanLabel}>Roshan</div>
          <div className={styles.roshanTimer}>
            {ros > 0 ? `Respawn in ${formatDuration(ros)}` : 'Alive'}
          </div>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendSwatch} style={{ background: '#4ade80' }} />
          Radiant
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendSwatch} style={{ background: '#f87171' }} />
          Dire
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendSwatch} style={{ background: '#facc15' }} />
          Roshan
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
          Hero positions delayed ~{Math.floor(data.stream_delay_s / 60)} min per broadcast.
        </div>
      </div>
    </div>
  )
}

function TowerMarker({
  tower,
  alive,
  side,
  size,
}: {
  tower: Tower
  alive: boolean
  side: 'radiant' | 'dire'
  size: number
}) {
  const color = side === 'radiant' ? '#4ade80' : '#f87171'
  return (
    <g className={styles.tower}>
      <rect
        x={tower.cx * size - 4}
        y={tower.cy * size - 4}
        width="8"
        height="8"
        fill={alive ? color : '#3a3a3a'}
        stroke={alive ? '#000' : '#222'}
        strokeWidth="1"
        opacity={alive ? 0.95 : 0.5}
      />
    </g>
  )
}

function RaxMarker({
  rax,
  alive,
  side,
  size,
}: {
  rax: Rax
  alive: boolean
  side: 'radiant' | 'dire'
  size: number
}) {
  const color = side === 'radiant' ? '#4ade80' : '#f87171'
  return (
    <g className={styles.tower}>
      <rect
        x={rax.cx * size - 3}
        y={rax.cy * size - 3}
        width="6"
        height="6"
        fill={alive ? color : '#3a3a3a'}
        stroke={alive ? '#000' : '#222'}
        strokeWidth="1"
        opacity={alive ? 0.85 : 0.4}
        transform={`rotate(45 ${rax.cx * size} ${rax.cy * size})`}
      />
    </g>
  )
}

function HeroDot({
  p,
  side,
  size,
}: {
  p: LiveScoreboardPlayer
  side: 'radiant' | 'dire'
  size: number
}) {
  const { x, y } = worldToSvg(p.position_x, p.position_y, size)
  const isDead = p.respawn_timer > 0
  const ring = side === 'radiant' ? '#4ade80' : '#f87171'
  const pic = heroPic(p.hero_id)
  const r = 16

  return (
    <g
      className={`${styles.heroDot} ${isDead ? styles.deadHero : ''}`}
      transform={`translate(${x}, ${y})`}
    >
      <title>{`${heroName(p.hero_id)} · ${p.kills}/${p.death}/${p.assists}${
        isDead ? ` · dead ${p.respawn_timer}s` : ''
      }`}</title>
      <circle r={r} fill="#14181d" stroke={ring} strokeWidth="2.5" />
      {pic && (
        <image
          href={heroImageUrl(pic)}
          x={-r + 2}
          y={-r + 2}
          width={(r - 2) * 2}
          height={(r - 2) * 2}
          clipPath="circle()"
          preserveAspectRatio="xMidYMid slice"
        />
      )}
    </g>
  )
}

/* ── Scoreboard table ───────────────────────────────────── */

function LiveScoreboardTable({
  side,
  label,
  team,
  nameMap,
}: {
  side: LiveScoreboardSide
  label: string
  team?: LiveTeam
  nameMap: Map<number, string>
}) {
  const labelClass = label === 'Radiant' ? shared.radiantLabel : shared.direLabel

  return (
    <div className={shared.section}>
      <div className={`${shared.sectionTitle} ${labelClass}`}>
        {label} {team?.team_name ? `· ${team.team_name}` : ''}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          {side.score} kills · {side.players.reduce((s, p) => s + p.net_worth, 0).toLocaleString()} net worth
        </span>
      </div>
      <div className={shared.scoreboardWrap}>
        <table className={`${shared.scoreboard} ${styles.fixedTable}`}>
          <colgroup>
            <col style={{ width: 56 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 200 }} />
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
              <th className={shared.thNum}>GPM</th>
              <th className={shared.thNum}>XPM</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {side.players.map((p) => (
              <LivePlayerRow
                key={p.account_id || p.player_slot}
                p={p}
                playerName={nameMap.get(p.account_id) ?? `Player ${p.account_id}`}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LivePlayerRow({ p, playerName }: { p: LiveScoreboardPlayer; playerName: string }) {
  const pic = heroPic(p.hero_id)
  const isDead = p.respawn_timer > 0
  const itemIds = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5]

  return (
    <tr>
      <td className={shared.tdHero}>
        <div className={styles.heroSlot}>
          {pic ? (
            <img
              src={heroImageUrl(pic)}
              alt={heroName(p.hero_id)}
              className={shared.heroImg}
              title={heroName(p.hero_id)}
            />
          ) : (
            <span className={shared.heroFallback}>{heroName(p.hero_id)}</span>
          )}
          <span className={styles.heroLevel}>{p.level}</span>
          {isDead && <div className={styles.respawnOverlay}>{p.respawn_timer}</div>}
        </div>
      </td>
      <td className={shared.tdPlayer}>{playerName}</td>
      <td className={shared.tdNum}>{p.kills}</td>
      <td className={shared.tdNum}>{p.death}</td>
      <td className={shared.tdNum}>{p.assists}</td>
      <td className={shared.tdNum}>{p.last_hits}</td>
      <td className={shared.tdNum}>{p.denies}</td>
      <td className={shared.tdNum}>{p.net_worth.toLocaleString()}</td>
      <td className={shared.tdNum}>{p.gold_per_min}</td>
      <td className={shared.tdNum}>{p.xp_per_min}</td>
      <td>
        <div className={styles.itemRow}>
          {itemIds.map((id, i) => {
            const sn = itemShortName(id)
            if (!sn) return <span key={i} className={styles.itemSlot} />
            return (
              <img
                key={i}
                src={itemImageUrl(sn)}
                alt={sn}
                title={sn}
                className={styles.itemImg}
              />
            )
          })}
        </div>
      </td>
    </tr>
  )
}

/* ── Draft strip ────────────────────────────────────────── */

/**
 * Captain's Mode draft order (24 actions = 14 bans + 10 picks).
 * 'first' = team with first pick, 'second' = the other.
 *
 * 1st ban phase  (7): A A B B A B B
 * 1st pick phase (2): A B
 * 2nd ban phase  (3): A A B
 * 2nd pick phase (6): B A A B B A
 * 3rd ban phase  (4): A B A B
 * 3rd pick phase (2): A B
 */
const CM_SEQUENCE: { team: 'first' | 'second'; action: 'ban' | 'pick' }[] = [
  { team: 'first', action: 'ban' },
  { team: 'first', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'first', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'first', action: 'pick' },
  { team: 'second', action: 'pick' },
  { team: 'first', action: 'ban' },
  { team: 'first', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'second', action: 'pick' },
  { team: 'first', action: 'pick' },
  { team: 'first', action: 'pick' },
  { team: 'second', action: 'pick' },
  { team: 'second', action: 'pick' },
  { team: 'first', action: 'pick' },
  { team: 'first', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'first', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'first', action: 'pick' },
  { team: 'second', action: 'pick' },
]

interface DraftStep {
  order: number
  side: 'radiant' | 'dire'
  action: 'ban' | 'pick'
  heroId: number | null
  phase: number
}

// Cumulative end-index (exclusive) for each sub-phase in CM_SEQUENCE.
// 7 bans, 2 picks, 3 bans, 6 picks, 4 bans, 2 picks.
const PHASE_BOUNDARIES = [7, 9, 12, 18, 22, 24]

function phaseForIndex(i: number): number {
  for (let p = 0; p < PHASE_BOUNDARIES.length; p++) {
    if (i < PHASE_BOUNDARIES[p]) return p
  }
  return PHASE_BOUNDARIES.length - 1
}

function buildDraftSequence(
  radiant: { picks: LivePickBan[]; bans: LivePickBan[] },
  dire: { picks: LivePickBan[]; bans: LivePickBan[] },
  firstPick: 'radiant' | 'dire',
): DraftStep[] {
  const cursors = {
    radiant: { ban: 0, pick: 0 },
    dire: { ban: 0, pick: 0 },
  }
  const result: DraftStep[] = []
  for (let i = 0; i < CM_SEQUENCE.length; i++) {
    const step = CM_SEQUENCE[i]
    const side: 'radiant' | 'dire' =
      step.team === 'first' ? firstPick : firstPick === 'radiant' ? 'dire' : 'radiant'
    const teamData = side === 'radiant' ? radiant : dire
    const arr = step.action === 'ban' ? teamData.bans : teamData.picks
    const cursor = cursors[side][step.action]
    const heroId = arr[cursor]?.hero_id ?? null
    cursors[side][step.action]++
    result.push({ order: i + 1, side, action: step.action, heroId, phase: phaseForIndex(i) })
  }
  return result
}

function DraftStrip({ data }: { data: LiveMatchData }) {
  const [firstPick, setFirstPick] = useState<'radiant' | 'dire'>('radiant')
  const r = data.scoreboard.radiant
  const d = data.scoreboard.dire
  const sequence = useMemo(
    () => buildDraftSequence(r, d, firstPick),
    [r, d, firstPick],
  )
  // Group steps by phase per side, then pad each phase to the wider side's count
  // so columns line up across the two rows.
  const phaseCount = PHASE_BOUNDARIES.length
  const radiantByPhase: DraftStep[][] = Array.from({ length: phaseCount }, () => [])
  const direByPhase: DraftStep[][] = Array.from({ length: phaseCount }, () => [])
  for (const s of sequence) {
    if (s.side === 'radiant') radiantByPhase[s.phase].push(s)
    else direByPhase[s.phase].push(s)
  }
  const phaseWidths = radiantByPhase.map((r, i) => Math.max(r.length, direByPhase[i].length))

  return (
    <div className={shared.section}>
      <div className={shared.sectionTitle}>
        Draft
        <span className={styles.fpToggleWrap}>
          <span className={styles.fpToggleLabel}>First pick</span>
          <button
            type="button"
            className={`${styles.fpToggleBtn} ${firstPick === 'radiant' ? styles.fpToggleActive : ''}`}
            onClick={() => setFirstPick('radiant')}
          >
            Rad
          </button>
          <button
            type="button"
            className={`${styles.fpToggleBtn} ${firstPick === 'dire' ? styles.fpToggleActive : ''}`}
            onClick={() => setFirstPick('dire')}
          >
            Dire
          </button>
        </span>
      </div>
      <div className={styles.draftScroll}>
        <DraftSideRow label="Radiant" side="radiant" phases={radiantByPhase} widths={phaseWidths} />
        <DraftSideRow label="Dire" side="dire" phases={direByPhase} widths={phaseWidths} />
      </div>
    </div>
  )
}

function DraftSideRow({
  label,
  side,
  phases,
  widths,
}: {
  label: string
  side: 'radiant' | 'dire'
  phases: DraftStep[][]
  widths: number[]
}) {
  const sideClass = side === 'radiant' ? styles.draftSideRadiant : styles.draftSideDire
  return (
    <div className={styles.draftSideRow}>
      <div className={`${styles.draftSideLabel} ${sideClass}`}>{label}</div>
      <div className={styles.draftSideCells}>
        {phases.map((phaseSteps, phaseIdx) => {
          const pad = widths[phaseIdx] - phaseSteps.length
          return (
            <Fragment key={`${side}-phase-${phaseIdx}`}>
              {phaseIdx > 0 && <span className={styles.draftPhaseGap} aria-hidden />}
              {phaseSteps.map((s) => (
                <DraftCell key={`${side}-${s.order}`} step={s} />
              ))}
              {Array.from({ length: pad }).map((_, j) => (
                <span key={`${side}-pad-${phaseIdx}-${j}`} className={styles.draftPadCell} aria-hidden />
              ))}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function DraftCell({ step }: { step: DraftStep }) {
  const banned = step.action === 'ban'
  const pic = step.heroId ? heroPic(step.heroId) : null
  const className = `${styles.draftCell} ${banned ? styles.draftCellBan : ''}`
  return (
    <div className={styles.draftCellWrap}>
      <div
        className={className}
        title={
          step.heroId
            ? `${banned ? 'Ban' : 'Pick'} #${step.order}: ${heroName(step.heroId)}`
            : `${banned ? 'Ban' : 'Pick'} #${step.order} (pending)`
        }
      >
        {pic ? (
          <img
            src={heroImageUrl(pic)}
            alt={heroName(step.heroId ?? 0)}
            className={styles.draftCellImg}
          />
        ) : (
          <div className={styles.draftCellPending} />
        )}
        {banned && <span className={styles.draftBanX}>×</span>}
      </div>
      <span className={styles.draftOrderCell}>{step.order}</span>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────── */

export default function LiveMatch() {
  useNoIndex()
  const { id } = useParams<{ id: string }>()
  const { data: resp, isLoading, error, refetch } = useLiveMatch(id)

  const data = resp?.data

  const nameMap = useMemo(() => {
    const m = new Map<number, string>()
    if (Array.isArray(data?.players)) {
      for (const p of data.players) m.set(p.account_id, p.name)
    }
    return m
  }, [data])

  if (isLoading) return <EnigmaLoader text="Loading live match..." />
  if (error || !data) {
    return (
      <ErrorState
        message="Failed to load live match"
        detail={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const sb = data.scoreboard
  const radiantName = data.radiant_team?.team_name ?? 'Radiant'
  const direName = data.dire_team?.team_name ?? 'Dire'
  const radiantLogo = teamLogo(data.radiant_team?.team_logo)
  const direLogo = teamLogo(data.dire_team?.team_logo)
  const leagueName = data.league_info?.name ?? `League ${data.league_id}`

  return (
    <div className={shared.page}>
      <PageMeta
        title={`${radiantName} vs ${direName} — LIVE (${sb.radiant.score}-${sb.dire.score})`}
        description={`Live Dota 2 match: ${radiantName} vs ${direName} at ${leagueName}.`}
        noindex
      />

      {/* Live status strip */}
      <div className={styles.statusStrip}>
        <span className={styles.liveBadge}>
          <span className={styles.liveDot} /> Live
        </span>
        <span className={styles.clock}>{formatDuration(sb.duration)}</span>
        <span className={styles.statusSep}>·</span>
        <span>{data.spectators.toLocaleString()} watching</span>
        <span className={styles.statusSep}>·</span>
        <span>{seriesTypeLabel(data.series_type)}</span>
        <span className={styles.statusRight}>
          {data.stream_delay_s > 0 && (
            <span className={styles.delay}>Stream delayed {formatDuration(data.stream_delay_s)}</span>
          )}
        </span>
      </div>

      {/* Match header */}
      <div className={shared.matchHeader}>
        <div className={`${shared.teamSide} ${shared.radiantSide}`}>
          {radiantLogo && (
            <img
              src={radiantLogo}
              alt={radiantName}
              className={shared.teamLogo}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className={shared.teamInfo}>
            {data.radiant_team?.team_id ? (
              <a href={`/teams/${data.radiant_team.team_id}`} className={shared.teamName}>
                {radiantName}
              </a>
            ) : (
              <span className={shared.teamName}>{radiantName}</span>
            )}
          </div>
        </div>

        <div className={shared.scoreBlock}>
          <div className={styles.seriesScore}>
            <span className={styles.seriesWin}>{data.radiant_series_wins}</span>
            <span>{seriesTypeLabel(data.series_type)}</span>
            <span className={styles.seriesWin}>{data.dire_series_wins}</span>
          </div>
          <div className={shared.scoreLine}>
            <span className={shared.score} style={{ color: 'var(--color-win)' }}>{sb.radiant.score}</span>
            <span className={shared.scoreDivider}>–</span>
            <span className={shared.score} style={{ color: 'var(--color-loss)' }}>{sb.dire.score}</span>
          </div>
          <div className={shared.matchMeta}>
            <span>{formatDuration(sb.duration)}</span>
          </div>
        </div>

        <div className={`${shared.teamSide} ${shared.direSide}`}>
          <div className={`${shared.teamInfo} ${shared.teamInfoRight}`}>
            {data.dire_team?.team_id ? (
              <a href={`/teams/${data.dire_team.team_id}`} className={shared.teamName}>
                {direName}
              </a>
            ) : (
              <span className={shared.teamName}>{direName}</span>
            )}
          </div>
          {direLogo && (
            <img
              src={direLogo}
              alt={direName}
              className={shared.teamLogo}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
      </div>

      {/* League bar */}
      <div className={shared.leagueBar}>
        <img
          src={leagueLogoUrl(data.league_id)}
          alt=""
          className={shared.leagueLogo}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <a href={`/leagues/${data.league_id}`} className={shared.leagueName}>
          {leagueName}
        </a>
        <span className={shared.matchId}>Match {data.match_id}</span>
      </div>

      {/* Map view */}
      <div className={shared.section}>
        <div className={shared.sectionTitle}>Map</div>
        <MapView data={data} />
      </div>

      {/* Scoreboards */}
      <LiveScoreboardTable side={sb.radiant} label="Radiant" team={data.radiant_team} nameMap={nameMap} />
      <LiveScoreboardTable side={sb.dire} label="Dire" team={data.dire_team} nameMap={nameMap} />

      {/* Draft */}
      <DraftStrip data={data} />
    </div>
  )
}
