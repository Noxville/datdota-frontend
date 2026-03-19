import { Fragment, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useApiQuery } from '../api/queries'
import { heroImageUrl, itemImageUrl, abilityImageUrl, teamLogoUrl, leagueLogoUrl } from '../config'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import { abilities as abilitiesData } from '../data/abilities'
import { PlayerCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
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
                    <PlayerCell key={c.steam32} steamId={c.steam32} nickname={c.nickname} />
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
