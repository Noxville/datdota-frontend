import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { useNoIndex } from '../hooks/useNoIndex'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import { heroImageUrl, itemImageUrl, teamLogoUrl, leagueLogoUrl } from '../config'
import { formatDuration, type DraftStep, phaseForIndex } from '../lib/live'
import LiveMinimap, { type MinimapHero, type MinimapBuilding } from '../components/LiveMinimap'
import LiveDraftView from '../components/LiveDraft'
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

/** Prior pro & premium single performances for this player on this hero (all time, all patches). */
function priorGamesLink(steamId: number, heroId: number): string {
  const params = new URLSearchParams({ players: String(steamId), heroes: String(heroId), tier: '1,2' })
  return `/players/single-performances?${params.toString()}`
}

function itemShortName(id: number): string | null {
  if (id <= 0) return null
  const item = itemsData[String(id)]
  return item?.shortName ?? null
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

/* ── Building coordinates (Dota world coords, for the minimap) ─── */

// tower_state bit → world position, per side.
// Bits: 0 T1top,1 T1mid,2 T1bot, 3 T2top,4 T2mid,5 T2bot, 6 T3top,7 T3mid,8 T3bot, 9 T4a,10 T4b
const RADIANT_TOWER_XY: [number, number][] = [
  [-5696, 1985], [-904, -1279], [5543.5, -6069.28],
  [-5824, -743], [-2550.34, -2797.25], [280, -6127],
  [-5952, -3279], [-4000, -4015], [-3312, -5983],
  [-5072, -4735], [-4752, -5063],
]
const DIRE_TOWER_XY: [number, number][] = [
  [-4635.06, 6057.44], [1164, 781], [6909.34, -2111],
  [512, 6145], [3136, 2241], [7040, 513],
  [4192, 5905], [4912, 3888], [6976, 3161],
  [4976, 4312], [5920, 4561],
]

// barracks_state bit → world position, per side.
// Bits: 0 top melee,1 top ranged,2 mid melee,3 mid ranged,4 bot melee,5 bot ranged
const RADIANT_RAX_XY: [number, number][] = [
  [-6204, -3630], [-5696, -3629], [-4032, -4423], [-4420, -4070], [-3640, -6231], [-3639, -5724],
]
const DIRE_RAX_XY: [number, number][] = [
  [7232, 3521], [6704, 3505], [5342, 3953], [4976, 4312], [4534, 6154], [4538, 5625],
]

const RADIANT_FORT: [number, number] = [-5280, -5223]
const DIRE_FORT: [number, number] = [6168, 5129]

/* ── Hooks ──────────────────────────────────────────────── */

const POLL_MS = 5000

function useLiveMatch(id: string | undefined) {
  return useQuery<LiveMatchResponse>({
    queryKey: ['api', '/api/livegames/webapi', id],
    queryFn: async () => {
      if (id === 'test') return exampleLiveMatch as LiveMatchResponse
      return apiFetch<LiveMatchResponse>(`/api/livegames/webapi/${id}`)
    },
    enabled: !!id,
    refetchInterval: id === 'test' ? false : POLL_MS,
    staleTime: 0,
  })
}

/* ── Map view ───────────────────────────────────────────── */

function buildWebapiBuildings(sb: LiveScoreboard): MinimapBuilding[] {
  const out: MinimapBuilding[] = []
  const add = (
    coords: [number, number][],
    bits: number,
    side: 'radiant' | 'dire',
    type: 'tower' | 'rax',
  ) => {
    coords.forEach(([x, y], bit) => {
      out.push({ key: `${side}-${type}-${bit}`, x, y, type, side, destroyed: (bits & (1 << bit)) === 0 })
    })
  }
  add(RADIANT_TOWER_XY, sb.radiant.tower_state, 'radiant', 'tower')
  add(DIRE_TOWER_XY, sb.dire.tower_state, 'dire', 'tower')
  add(RADIANT_RAX_XY, sb.radiant.barracks_state, 'radiant', 'rax')
  add(DIRE_RAX_XY, sb.dire.barracks_state, 'dire', 'rax')
  // Ancients are always present while the game is live.
  out.push({ key: 'radiant-ancient', x: RADIANT_FORT[0], y: RADIANT_FORT[1], type: 'ancient', side: 'radiant' })
  out.push({ key: 'dire-ancient', x: DIRE_FORT[0], y: DIRE_FORT[1], type: 'ancient', side: 'dire' })
  return out
}

function MapView({ data }: { data: LiveMatchData }) {
  const sb = data.scoreboard
  const buildings = buildWebapiBuildings(sb)

  const toHero = (p: LiveScoreboardPlayer, side: 'radiant' | 'dire'): MinimapHero => ({
    key: `${side}-${p.account_id || p.player_slot}`,
    x: p.position_x,
    y: p.position_y,
    picture: heroPic(p.hero_id),
    side,
    dead: p.respawn_timer > 0,
    respawn: p.respawn_timer,
    level: p.level,
    label: `${heroName(p.hero_id)} · ${p.kills}/${p.death}/${p.assists}${p.respawn_timer > 0 ? ` · dead ${p.respawn_timer}s` : ''}`,
  })

  const heroes: MinimapHero[] = [
    ...sb.radiant.players.map((p) => toHero(p, 'radiant')),
    ...sb.dire.players.map((p) => toHero(p, 'dire')),
  ]

  return <LiveMinimap heroes={heroes} buildings={buildings} />
}

function RoshanStrip({ respawn }: { respawn: number }) {
  const alive = respawn <= 0
  return (
    <div className={styles.roshanStrip}>
      <span className={styles.roshanDot} style={{ background: alive ? 'var(--color-win)' : 'var(--color-loss)' }} />
      <span className={styles.roshanStripLabel}>Roshan</span>
      <span>{alive ? 'Alive' : `Respawn in ${formatDuration(respawn)}`}</span>
    </div>
  )
}

/* ── Scoreboard table ───────────────────────────────────── */

function LiveScoreboardTable({
  side,
  label,
  team,
  nameMap,
  advantage,
}: {
  side: LiveScoreboardSide
  label: string
  team?: LiveTeam
  nameMap: Map<number, string>
  advantage: number
}) {
  const labelClass = label === 'Radiant' ? shared.radiantLabel : shared.direLabel
  const netWorth = side.players.reduce((s, p) => s + p.net_worth, 0)

  return (
    <div className={shared.section}>
      <div className={`${shared.sectionTitle} ${labelClass}`}>
        {label} {team?.team_name ? `· ${team.team_name}` : ''}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          {side.score} kills · {netWorth.toLocaleString()} net worth{' '}
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
            <col style={{ width: 48 }} />
            <col style={{ width: 116 }} />
            <col style={{ width: 34 }} />
            <col style={{ width: 34 }} />
            <col style={{ width: 34 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 44 }} />
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
              <th className={shared.thNum}>Prior</th>
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
          <tfoot>
            <LiveTotalsRow players={side.players} />
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function LiveTotalsRow({ players }: { players: LiveScoreboardPlayer[] }) {
  const sum = (fn: (p: LiveScoreboardPlayer) => number) => players.reduce((s, p) => s + fn(p), 0)
  return (
    <tr className={shared.totalsRow}>
      <td className={shared.tdHero} />
      <td className={shared.totalsLabel}>Total</td>
      <td className={shared.tdNum}>{sum((p) => p.kills)}</td>
      <td className={shared.tdNum}>{sum((p) => p.death)}</td>
      <td className={shared.tdNum}>{sum((p) => p.assists)}</td>
      <td className={shared.tdNum}>{sum((p) => p.last_hits)}</td>
      <td className={shared.tdNum}>{sum((p) => p.denies)}</td>
      <td className={shared.tdNum}>{sum((p) => p.net_worth).toLocaleString()}</td>
      <td className={shared.tdNum}>{sum((p) => p.gold_per_min)}</td>
      <td className={shared.tdNum}>{sum((p) => p.xp_per_min)}</td>
      <td />
      <td />
    </tr>
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
      <td className={shared.tdPlayer}>
        {p.account_id ? (
          <a href={`/players/${p.account_id}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none' }}>
            {playerName}
          </a>
        ) : (
          playerName
        )}
      </td>
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
      <td className={shared.tdNum}>
        {p.account_id ? (
          <a
            href={priorGamesLink(p.account_id, p.hero_id)}
            title={`Prior pro & premium games on ${heroName(p.hero_id)}`}
            style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '1.15rem', lineHeight: 1, display: 'inline-block' }}
          >
            ↗
          </a>
        ) : null}
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
    const arr = (step.action === 'ban' ? teamData.bans : teamData.picks) ?? []
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
      <LiveDraftView steps={sequence} />
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

  if (!data.scoreboard) {
    return (
      <>
        <ErrorState
          message="No live scoreboard available"
          detail="This match has finished or is not currently broadcasting live data."
          onRetry={() => refetch()}
        />
        <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
          <a href={`/matches/${id}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none' }}>
            View end-game stats →
          </a>
        </div>
      </>
    )
  }

  const sb = data.scoreboard
  const radiantAdvantage =
    sb.radiant.players.reduce((s, p) => s + p.net_worth, 0) -
    sb.dire.players.reduce((s, p) => s + p.net_worth, 0)
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
      <div className={`${shared.matchHeader} ${styles.header}`}>
        <div className={`${shared.teamSide} ${shared.radiantSide}`}>
          {radiantLogo && (
            <img
              src={radiantLogo}
              alt={radiantName}
              className={`${shared.teamLogo} ${styles.headerLogo}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className={shared.teamInfo}>
            {data.radiant_team?.team_id ? (
              <a href={`/teams/${data.radiant_team.team_id}`} className={`${shared.teamName} ${styles.headerName}`}>
                {radiantName}
              </a>
            ) : (
              <span className={`${shared.teamName} ${styles.headerName}`}>{radiantName}</span>
            )}
          </div>
        </div>

        <div className={`${shared.scoreBlock} ${styles.headerBlock}`}>
          <div className={styles.seriesScore}>
            <span className={styles.seriesWin}>{data.radiant_series_wins}</span>
            <span>{seriesTypeLabel(data.series_type)}</span>
            <span className={styles.seriesWin}>{data.dire_series_wins}</span>
          </div>
          <div className={shared.scoreLine}>
            <span className={`${shared.score} ${styles.headerScore}`} style={{ color: 'var(--color-win)' }}>{sb.radiant.score}</span>
            <span className={`${shared.scoreDivider} ${styles.headerDivider}`}>–</span>
            <span className={`${shared.score} ${styles.headerScore}`} style={{ color: 'var(--color-loss)' }}>{sb.dire.score}</span>
          </div>
          {/* Mirrors the series-score row so the block is vertically symmetric,
              centring the team names on the score. */}
          <div className={styles.seriesScore} aria-hidden style={{ visibility: 'hidden' }}>&nbsp;</div>
        </div>

        <div className={`${shared.teamSide} ${shared.direSide}`}>
          <div className={`${shared.teamInfo} ${shared.teamInfoRight}`}>
            {data.dire_team?.team_id ? (
              <a href={`/teams/${data.dire_team.team_id}`} className={`${shared.teamName} ${styles.headerName}`}>
                {direName}
              </a>
            ) : (
              <span className={`${shared.teamName} ${styles.headerName}`}>{direName}</span>
            )}
          </div>
          {direLogo && (
            <img
              src={direLogo}
              alt={direName}
              className={`${shared.teamLogo} ${styles.headerLogo}`}
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

      {/* 2-column: map (40%) · teams (60%) */}
      <div className={styles.liveGrid}>
        <div className={styles.mapCol}>
          <div className={shared.section}>
            <div className={shared.sectionTitle}>Map</div>
            <div className={styles.mapSize}>
              <MapView data={data} />
            </div>
            <RoshanStrip respawn={sb.roshan_respawn_timer} />
          </div>
        </div>
        <div className={styles.teamsCol}>
          <LiveScoreboardTable side={sb.radiant} label="Radiant" team={data.radiant_team} nameMap={nameMap} advantage={radiantAdvantage} />
          <LiveScoreboardTable side={sb.dire} label="Dire" team={data.dire_team} nameMap={nameMap} advantage={-radiantAdvantage} />
        </div>
      </div>

      {/* Draft */}
      <DraftStrip data={data} />
    </div>
  )
}
