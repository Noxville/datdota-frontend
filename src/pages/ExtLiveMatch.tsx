import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { useNoIndex } from '../hooks/useNoIndex'
import { heroImageUrl, itemImageUrl } from '../config'
import { formatDuration, heroByExtKey, steamIdToAccountId, phaseForIndex, type DraftStep } from '../lib/live'
import LiveMinimap, { type MinimapHero, type MinimapBuilding } from '../components/LiveMinimap'
import LiveDraftView from '../components/LiveDraft'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import shared from './MatchShow.module.css'
import styles from './LiveMatch.module.css'
import ext from './ExtLiveMatch.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface ExtSeriesScore {
  name: string
  score: number
  won: boolean
}

interface ExtPlayer {
  name: string
  hero: string
  heroId: string
  kills: number
  deaths: number
  assists: number
  netWorth: number
  money: number
  xp: number
  alive: boolean
  hp: number
  maxHp: number
  x: number
  y: number
  items: string[]
  steamId: string
}

interface ExtTeam {
  side: 'radiant' | 'dire'
  name: string
  won: boolean
  kills: number
  netWorth: number
  money: number
  xp: number
  structuresDestroyed: number
  players: ExtPlayer[]
}

interface ExtStructure {
  type: string
  side: 'radiant' | 'dire'
  destroyed: boolean
  hp: number
  maxHp: number
  x: number
  y: number
}

interface ExtDraftEntry {
  type: string
  seq: string
  teamId: string
  hero: string
}

interface ExtDetail {
  id: string
  format: string
  seriesScore: ExtSeriesScore[]
  seriesFinished: boolean
  updatedAt: string
  gameNumber: number
  started: boolean
  finished: boolean
  clock: number
  map: string
  teams: ExtTeam[]
  structures: ExtStructure[]
  roshanAlive?: boolean
  draft?: ExtDraftEntry[]
}

interface ExtResponse {
  data: ExtDetail
}

/* ── Helpers ────────────────────────────────────────────── */

const POLL_MS = 10000

function useExtLiveMatch(uuid: string | undefined) {
  return useQuery<ExtResponse>({
    queryKey: ['api', '/api/livegames/ext', uuid],
    queryFn: () => apiFetch<ExtResponse>(`/api/livegames/ext/${uuid}`),
    enabled: !!uuid,
    refetchInterval: POLL_MS,
    staleTime: 0,
  })
}

function formatSeriesType(format: string): string {
  const m = /(\d+)/.exec(format)
  return m ? `Bo${m[1]}` : format
}

/** Prior pro & premium single performances for this player on this hero. */
function priorGamesLink(accountId: number, heroId: number): string {
  const params = new URLSearchParams({ players: String(accountId), heroes: String(heroId), tier: '1,2' })
  return `/players/single-performances?${params.toString()}`
}

/* ── Draft ──────────────────────────────────────────────── */

/**
 * ext draft entries carry a `teamId` with no direct side mapping (team objects
 * have no id). Infer each teamId's side by matching its picked heroes to the
 * heroes actually on each team's roster.
 */
function buildDraftSteps(teams: ExtTeam[], draft: ExtDraftEntry[]): DraftStep[] {
  const heroIdToSide = new Map<number, 'radiant' | 'dire'>()
  for (const t of teams) {
    for (const p of t.players) {
      const h = heroByExtKey(p.heroId)
      if (h) heroIdToSide.set(h.id, t.side)
    }
  }

  const votes: Record<string, { radiant: number; dire: number }> = {}
  for (const e of draft) {
    if (e.type !== 'pick') continue
    const h = heroByExtKey(e.hero)
    const side = h ? heroIdToSide.get(h.id) : undefined
    if (!side) continue
    votes[e.teamId] ??= { radiant: 0, dire: 0 }
    votes[e.teamId][side]++
  }

  const teamSide: Record<string, 'radiant' | 'dire'> = {}
  for (const [teamId, v] of Object.entries(votes)) {
    teamSide[teamId] = v.radiant >= v.dire ? 'radiant' : 'dire'
  }
  // Fallback for teamIds not yet resolved by picks (early in a live draft).
  for (const e of draft) {
    if (teamSide[e.teamId]) continue
    const used = new Set(Object.values(teamSide))
    teamSide[e.teamId] = used.has('radiant') ? 'dire' : 'radiant'
  }

  return draft.map((e, i) => {
    const seq = Number(e.seq) || i + 1
    return {
      order: seq,
      side: teamSide[e.teamId] ?? 'radiant',
      action: e.type === 'ban' ? 'ban' : 'pick',
      heroId: heroByExtKey(e.hero)?.id ?? null,
      phase: phaseForIndex(seq - 1),
    }
  })
}

/* ── Map ────────────────────────────────────────────────── */

function structureType(t: string): MinimapBuilding['type'] {
  if (t.startsWith('barracks')) return 'rax'
  if (t === 'ancient') return 'ancient'
  if (t === 'outpost') return 'outpost'
  return 'tower'
}

function ExtMapView({ detail, radiant, dire }: { detail: ExtDetail; radiant?: ExtTeam; dire?: ExtTeam }) {
  const buildings: MinimapBuilding[] = (detail.structures ?? []).map((s, i) => ({
    key: `${s.type}-${s.side}-${i}`,
    x: s.x,
    y: s.y,
    type: structureType(s.type),
    side: s.side,
    destroyed: s.destroyed,
    hpFrac: s.maxHp > 0 ? s.hp / s.maxHp : undefined,
    label: `${s.side} ${s.type}`,
  }))

  const toHero = (p: ExtPlayer, side: 'radiant' | 'dire'): MinimapHero => {
    const hero = heroByExtKey(p.heroId)
    return {
      key: `${side}-${p.steamId}`,
      x: p.x,
      y: p.y,
      picture: hero?.picture ?? null,
      side,
      dead: !p.alive,
      label: `${hero?.name ?? p.hero} · ${p.kills}/${p.deaths}/${p.assists}${!p.alive ? ' · dead' : ''}`,
    }
  }

  const heroes: MinimapHero[] = [
    ...(radiant?.players ?? []).map((p) => toHero(p, 'radiant')),
    ...(dire?.players ?? []).map((p) => toHero(p, 'dire')),
  ]

  return <LiveMinimap heroes={heroes} buildings={buildings} />
}

/* ── Scoreboard ─────────────────────────────────────────── */

function ExtScoreboardTable({ team, label, advantage }: { team: ExtTeam; label: string; advantage: number }) {
  const labelClass = label === 'Radiant' ? shared.radiantLabel : shared.direLabel
  return (
    <div className={shared.section}>
      <div className={`${shared.sectionTitle} ${labelClass}`}>
        {label} {team.name ? `· ${team.name}` : ''}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          {team.kills} kills · {team.netWorth.toLocaleString()} net worth{' '}
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
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 72 }} />
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
              <th className={shared.thNum}>NW</th>
              <th className={shared.thNum}>HP</th>
              <th>Items</th>
              <th className={shared.thNum}>Prior</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p) => (
              <ExtPlayerRow key={p.steamId} p={p} />
            ))}
          </tbody>
          <tfoot>
            <ExtTotalsRow players={team.players} />
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function ExtTotalsRow({ players }: { players: ExtPlayer[] }) {
  const sum = (fn: (p: ExtPlayer) => number) => players.reduce((s, p) => s + fn(p), 0)
  return (
    <tr className={shared.totalsRow}>
      <td className={shared.tdHero} />
      <td className={shared.totalsLabel}>Total</td>
      <td className={shared.tdNum}>{sum((p) => p.kills)}</td>
      <td className={shared.tdNum}>{sum((p) => p.deaths)}</td>
      <td className={shared.tdNum}>{sum((p) => p.assists)}</td>
      <td className={shared.tdNum}>{sum((p) => p.netWorth).toLocaleString()}</td>
      <td />
      <td />
      <td />
    </tr>
  )
}

function ExtPlayerRow({ p }: { p: ExtPlayer }) {
  const hero = heroByExtKey(p.heroId)
  const accountId = steamIdToAccountId(p.steamId)
  const hpPct = p.maxHp > 0 ? Math.max(0, Math.min(1, p.hp / p.maxHp)) : 0

  return (
    <tr>
      <td className={shared.tdHero}>
        <div className={styles.heroSlot}>
          {hero ? (
            <img src={heroImageUrl(hero.picture)} alt={hero.name} className={shared.heroImg} title={hero.name} />
          ) : (
            <span className={shared.heroFallback}>{p.hero}</span>
          )}
          {!p.alive && <div className={styles.respawnOverlay}>✕</div>}
        </div>
      </td>
      <td className={shared.tdPlayer}>
        {accountId ? (
          <a href={`/players/${accountId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none' }}>
            {p.name}
          </a>
        ) : (
          p.name
        )}
      </td>
      <td className={shared.tdNum}>{p.kills}</td>
      <td className={shared.tdNum}>{p.deaths}</td>
      <td className={shared.tdNum}>{p.assists}</td>
      <td className={shared.tdNum}>{p.netWorth.toLocaleString()}</td>
      <td className={shared.tdNum}>
        <div className={ext.hpCell}>
          <div className={ext.hpBar}>
            <span
              className={ext.hpFill}
              style={{ width: `${hpPct * 100}%`, background: p.alive ? 'var(--color-win)' : 'var(--color-loss)' }}
            />
          </div>
          <span className={ext.hpText}>{p.alive ? p.hp.toLocaleString() : 'dead'}</span>
        </div>
      </td>
      <td>
        <div className={styles.itemRow}>
          {Array.from({ length: 6 }).map((_, i) => {
            const sn = p.items[i]
            if (!sn) return <span key={i} className={styles.itemSlot} />
            return <img key={i} src={itemImageUrl(sn)} alt={sn} title={sn} className={styles.itemImg} />
          })}
        </div>
      </td>
      <td className={shared.tdNum}>
        {accountId && hero ? (
          <a
            href={priorGamesLink(accountId, hero.id)}
            title={`Prior pro & premium games on ${hero.name}`}
            style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '1.15rem', lineHeight: 1, display: 'inline-block' }}
          >
            ↗
          </a>
        ) : null}
      </td>
    </tr>
  )
}

/* ── Page ───────────────────────────────────────────────── */

export default function ExtLiveMatch() {
  useNoIndex()
  const { uuid } = useParams<{ uuid: string }>()
  const { data: resp, isLoading, error, refetch } = useExtLiveMatch(uuid)

  const detail = resp?.data

  if (isLoading) return <EnigmaLoader text="Loading live match..." />
  if (error || !detail) {
    return (
      <ErrorState
        message="Failed to load live match"
        detail={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const radiant = detail.teams?.find((t) => t.side === 'radiant')
  const dire = detail.teams?.find((t) => t.side === 'dire')
  const radiantName = radiant?.name ?? 'Radiant'
  const direName = dire?.name ?? 'Dire'
  const [rSeries, dSeries] = detail.seriesScore ?? []
  const finished = detail.finished || detail.seriesFinished
  const radiantAdvantage = (radiant?.netWorth ?? 0) - (dire?.netWorth ?? 0)
  const draftSteps = buildDraftSteps(detail.teams ?? [], detail.draft ?? [])

  return (
    <div className={shared.page}>
      <PageMeta
        title={`${radiantName} vs ${direName} — LIVE (${radiant?.kills ?? 0}-${dire?.kills ?? 0})`}
        description={`Live Dota 2 match: ${radiantName} vs ${direName}.`}
        noindex
      />

      {/* Status strip */}
      <div className={styles.statusStrip}>
        {finished ? (
          <span className={styles.delay}>Finished</span>
        ) : (
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} /> Live
          </span>
        )}
        <span className={styles.clock}>{formatDuration(detail.clock)}</span>
        <span className={styles.statusSep}>·</span>
        <span>Game {detail.gameNumber} · {formatSeriesType(detail.format)}</span>
        <span className={styles.statusRight}>
          <span className={ext.source}>External source</span>
        </span>
      </div>

      {/* Match header */}
      <div className={`${shared.matchHeader} ${styles.header}`}>
        <div className={`${shared.teamSide} ${shared.radiantSide}`}>
          <div className={shared.teamInfo}>
            <span className={`${shared.teamName} ${styles.headerName}`}>{radiantName}</span>
          </div>
        </div>

        <div className={`${shared.scoreBlock} ${styles.headerBlock}`}>
          <div className={styles.seriesScore}>
            <span className={styles.seriesWin}>{rSeries?.score ?? 0}</span>
            <span>{formatSeriesType(detail.format)}</span>
            <span className={styles.seriesWin}>{dSeries?.score ?? 0}</span>
          </div>
          <div className={shared.scoreLine}>
            <span className={`${shared.score} ${styles.headerScore}`} style={{ color: 'var(--color-win)' }}>{radiant?.kills ?? 0}</span>
            <span className={`${shared.scoreDivider} ${styles.headerDivider}`}>–</span>
            <span className={`${shared.score} ${styles.headerScore}`} style={{ color: 'var(--color-loss)' }}>{dire?.kills ?? 0}</span>
          </div>
          {/* Mirrors the series-score row so the block is vertically symmetric,
              centring the team names on the score. */}
          <div className={styles.seriesScore} aria-hidden style={{ visibility: 'hidden' }}>&nbsp;</div>
        </div>

        <div className={`${shared.teamSide} ${shared.direSide}`}>
          <div className={`${shared.teamInfo} ${shared.teamInfoRight}`}>
            <span className={`${shared.teamName} ${styles.headerName}`}>{direName}</span>
          </div>
        </div>
      </div>

      {/* 2-column: map (40%) · teams (60%) */}
      <div className={styles.liveGrid}>
        <div className={styles.mapCol}>
          <div className={shared.section}>
            <div className={shared.sectionTitle}>Map</div>
            <div className={styles.mapSize}>
              <ExtMapView detail={detail} radiant={radiant} dire={dire} />
            </div>
            {detail.roshanAlive != null && (
              <div className={styles.roshanStrip}>
                <span
                  className={styles.roshanDot}
                  style={{ background: detail.roshanAlive ? 'var(--color-win)' : 'var(--color-loss)' }}
                />
                <span className={styles.roshanStripLabel}>Roshan</span>
                <span>{detail.roshanAlive ? 'Alive' : 'Dead'}</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.teamsCol}>
          {radiant && <ExtScoreboardTable team={radiant} label="Radiant" advantage={radiantAdvantage} />}
          {dire && <ExtScoreboardTable team={dire} label="Dire" advantage={-radiantAdvantage} />}
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
