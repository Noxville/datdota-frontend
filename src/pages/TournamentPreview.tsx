import { useMemo, useRef, useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApiQuery } from '../api/queries'
import { useNoIndex } from '../hooks/useNoIndex'
import { miniHeroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import { buildBreadcrumbs } from '../lib/seo'
import styles from './TournamentPreview.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface ContextDescriptor {
  key: string
  label: string
}

interface Glicko2Stat {
  type: 'GLICKO2'
  label: string
  context: string
  value: number | null
  mu?: number
  phi?: number
}

interface RecordStat {
  type: 'RECORD'
  label: string
  context: string
  games: number
  wins: number
  losses: number
  winrate: number
}

type TeamStat = Glicko2Stat | RecordStat

interface ValueStat {
  type: 'CAREER_GAMES' | 'SEASON_GAMES'
  label: string
  context: string
  value: number
}

interface Highlight {
  type: string
  label: string
  context: string
  text: string
  score: number
  /* type-specific meta (all optional) */
  hero?: string
  heroes?: { hero: string; count: number }[] | number
  streak?: number
  wins?: number
  of?: number
  opponent?: string
  losses?: number
  milestone?: number
  distance?: number
}

interface Player {
  steamId: number
  nickname: string
  commonStats: ValueStat[]
  highlights: Highlight[]
}

interface Team {
  valveId: number
  name: string
  aka: string | null
  logo: string | null
  commonStats: TeamStat[]
  highlights: Highlight[]
  players: Player[]
}

interface H2HTeamRef {
  valveId: number
  name: string
}

interface H2HRecord {
  games: number
  wins: number
  losses: number
}

interface HeadToHead {
  teams: H2HTeamRef[]
  matrix: Record<string, Record<string, Record<string, H2HRecord>>>
}

interface PreviewData {
  slug: string
  name: string
  generatedAt: string
  updateUntil: string
  contexts: ContextDescriptor[]
  headToHead?: HeadToHead
  teams: Team[]
}

/* ── Helpers ────────────────────────────────────────────── */

const CONTEXT_ORDER = ['LIFETIME', 'SEASON', 'PATCH', 'LAST_3_MONTHS']

/** Short caption per context, e.g. LAST_3_MONTHS → "Last 3 months". */
const CONTEXT_SHORT: Record<string, string> = {
  LIFETIME: 'Lifetime',
  SEASON: 'Season',
  PATCH: 'Patch',
  LAST_3_MONTHS: 'Last 3mo',
}

/** Hero display name → mini-icon URL, built once from static hero data. */
const heroPictureByName: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const hero of Object.values(heroesById)) map[hero.name] = hero.picture
  return map
})()

function isGlicko(s: TeamStat): s is Glicko2Stat {
  return s.type === 'GLICKO2'
}

function isRecord(s: TeamStat): s is RecordStat {
  return s.type === 'RECORD'
}

/** Alpha for a highlight's accent bar, scaled by its 0–100 score. */
function scoreAlpha(score: number): number {
  return 0.25 + Math.max(0, Math.min(100, score)) / 100 * 0.75
}

/** Dev-only, deduped warning when the API sends a stat type we don't render. */
const warnedTypes = new Set<string>()
function warnUnknownStat(kind: 'team' | 'player', type: string) {
  if (!import.meta.env.DEV) return
  const key = `${kind}:${type}`
  if (warnedTypes.has(key)) return
  warnedTypes.add(key)
  console.warn(
    `[TournamentPreview] Unrecognised ${kind} stat type "${type}" — not rendered. The API may have added a new type.`,
  )
}

/** Split a context label into a compact form + the full text for a tooltip,
 *  dropping any trailing parenthetical (e.g. the season start date). */
function splitLabel(label: string): { short: string; full: string } {
  const short = label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  return { short: short || label, full: label }
}

/* ── H2H cross-section ───────────────────────────────────── */

/** Mix two #rrggbb colours; t in [0,1]. */
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/** Cell colour by row-team win rate: teal above .5, red below (matches the main cross-table). */
function cellColor(wr: number): string {
  if (wr > 0.5) return mixHex('#1e1e38', '#2dd4bf', (wr - 0.5) * 2)
  if (wr < 0.5) return mixHex('#1e1e38', '#f87171', (0.5 - wr) * 2)
  return '#1e1e38'
}

const H2H_ROW_HEAD_W = 168
const H2H_TOTAL_W = 68

function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function H2HCrossSection({
  headToHead,
  teams,
  contextLabel,
}: {
  headToHead: HeadToHead
  teams: Team[]
  contextLabel: (k: string) => string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(wrapRef)

  const logoById = useMemo(() => {
    const m = new Map<number, string | null>()
    for (const t of teams) m.set(t.valveId, t.logo)
    return m
  }, [teams])

  const glickoById = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of teams) {
      const g = t.commonStats.find(isGlicko)
      if (g && g.value != null) m.set(t.valveId, g.value)
    }
    return m
  }, [teams])

  const order = useMemo(
    () => [...headToHead.teams].sort(
      (a, b) => (glickoById.get(b.valveId) ?? -Infinity) - (glickoById.get(a.valveId) ?? -Infinity),
    ),
    [headToHead.teams, glickoById],
  )

  const availCtx = useMemo(
    () => CONTEXT_ORDER.filter((k) => headToHead.matrix[k]),
    [headToHead.matrix],
  )
  const [ctx, setCtx] = useState('PATCH')
  const activeCtx = availCtx.includes(ctx) ? ctx : availCtx[0] ?? 'LIFETIME'

  const n = order.length
  if (n < 2) return null

  const matrix = headToHead.matrix[activeCtx] ?? {}
  const cell = Math.max(44, Math.min(72, Math.floor(((width || 900) - H2H_ROW_HEAD_W - H2H_TOTAL_W) / n)))
  const today = new Date().toISOString().slice(0, 10)

  const cellData = (rowId: number, colId: number): H2HRecord | null => {
    const direct = matrix[rowId]?.[colId]
    if (direct) return direct
    const mirror = matrix[colId]?.[rowId]
    if (mirror) return { games: mirror.games, wins: mirror.losses, losses: mirror.wins }
    return null
  }

  const rowTotal = (rowId: number): H2HRecord => {
    let wins = 0
    let losses = 0
    for (const colT of order) {
      if (colT.valveId === rowId) continue
      const d = cellData(rowId, colT.valveId)
      if (d) { wins += d.wins; losses += d.losses }
    }
    return { games: wins + losses, wins, losses }
  }

  const h2hHref = (rowId: number, colId: number): string => {
    const params = new URLSearchParams({
      'team-a': String(rowId),
      'team-b': String(colId),
      before: today,
    })
    return `/teams/head-to-head?${params.toString()}`
  }

  const scrollToTeam = (valveId: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(`team-${valveId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.crossSection}>
      <div className={styles.crossTop}>
        <div className={styles.sectionTitle}>Head-to-head cross-section</div>
        {availCtx.length > 1 && (
          <div className={toggleStyles.toggleRow} style={{ marginBottom: 0, flexWrap: 'wrap' }}>
            {availCtx.map((k) => (
              <button
                key={k}
                className={`${toggleStyles.toggleBtn} ${activeCtx === k ? toggleStyles.toggleActive : ''}`}
                onClick={() => setCtx(k)}
              >
                {splitLabel(contextLabel(k)).short}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.crossWrap} ref={wrapRef}>
        <table
          className={styles.cross}
          style={{
            '--cell': `${cell}px`,
            '--rowhead': `${H2H_ROW_HEAD_W}px`,
            '--total': `${H2H_TOTAL_W}px`,
          } as React.CSSProperties}
        >
          <thead>
            <tr>
              <th className={styles.crossCorner} />
              {order.map((t) => (
                <th key={t.valveId} className={styles.crossColHead}>
                  <a
                    href={`#team-${t.valveId}`}
                    onClick={scrollToTeam(t.valveId)}
                    className={styles.colHeadLink}
                    title={`Jump to ${t.name}`}
                  >
                    {logoById.get(t.valveId) && (
                      <img
                        src={logoById.get(t.valveId)!}
                        alt={t.name}
                        className={styles.crossLogo}
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                      />
                    )}
                  </a>
                </th>
              ))}
              <th className={styles.crossTotalHead}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.map((rowT) => (
              <tr key={rowT.valveId}>
                <th className={styles.crossRowHead}>
                  <a
                    href={`#team-${rowT.valveId}`}
                    onClick={scrollToTeam(rowT.valveId)}
                    className={styles.crossRowHeadInner}
                    title={`Jump to ${rowT.name}`}
                  >
                    {logoById.get(rowT.valveId) && (
                      <img
                        src={logoById.get(rowT.valveId)!}
                        alt=""
                        className={styles.crossLogo}
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                      />
                    )}
                    <span className={styles.crossTeamLink}>{rowT.name}</span>
                  </a>
                </th>
                {order.map((colT) => {
                  if (rowT.valveId === colT.valveId) {
                    return <td key={colT.valveId} className={styles.crossDiag} />
                  }
                  const d = cellData(rowT.valveId, colT.valveId)
                  if (!d || d.games === 0) {
                    return <td key={colT.valveId} className={styles.crossEmpty} />
                  }
                  const wr = d.games > 0 ? d.wins / d.games : 0.5
                  return (
                    <td key={colT.valveId} className={styles.crossTd}>
                      <a
                        className={styles.crossCell}
                        href={h2hHref(rowT.valveId, colT.valveId)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ background: cellColor(wr) }}
                        title={`${rowT.name} vs ${colT.name}: ${d.wins}–${d.losses} (${(wr * 100).toFixed(0)}%)`}
                      >
                        <span className={styles.cellWl}>{d.wins}–{d.losses}</span>
                        <span className={styles.cellPct}>{(wr * 100).toFixed(0)}%</span>
                      </a>
                    </td>
                  )
                })}
                {(() => {
                  const t = rowTotal(rowT.valveId)
                  if (t.games === 0) return <td className={styles.crossTotalTd} />
                  const wr = t.wins / t.games
                  return (
                    <td className={styles.crossTotalTd}>
                      <div
                        className={styles.crossCell}
                        style={{ background: cellColor(wr) }}
                        title={`${rowT.name} vs the field: ${t.wins}–${t.losses} (${(wr * 100).toFixed(0)}%)`}
                      >
                        <span className={styles.cellWl}>{t.wins}–{t.losses}</span>
                        <span className={styles.cellPct}>{(wr * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                  )
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Highlight rendering ─────────────────────────────────── */

function MilestoneBar({ milestone, distance }: { milestone: number; distance: number }) {
  if (!milestone || distance == null) return null
  const current = milestone - distance
  const pct = Math.max(0, Math.min(100, (current / milestone) * 100))
  return (
    <div className={styles.milestoneBar} title={`${current.toLocaleString()} / ${milestone.toLocaleString()}`}>
      <span className={styles.milestoneFill} style={{ width: `${pct}%` }} />
    </div>
  )
}

function HeroIcons({ heroes }: { heroes: { hero: string; count?: number }[] }) {
  const withPics = heroes.filter((h) => heroPictureByName[h.hero])
  if (withPics.length === 0) return null
  return (
    <div className={styles.heroIcons}>
      {withPics.map((h) => (
        <img
          key={h.hero}
          src={miniHeroImageUrl(heroPictureByName[h.hero])}
          alt={h.hero}
          title={h.count ? `${h.hero} (${h.count})` : h.hero}
          className={styles.heroIcon}
          loading="lazy"
        />
      ))}
    </div>
  )
}

function HighlightRow({ h, contextLabel }: { h: Highlight; contextLabel: (k: string) => string }) {
  const showBar = h.milestone != null && h.distance != null
  const ctx = splitLabel(contextLabel(h.context))
  const heroList = Array.isArray(h.heroes)
    ? h.heroes
    : typeof h.hero === 'string'
      ? [{ hero: h.hero }]
      : null
  return (
    <li className={styles.highlight} style={{ '--accent-a': scoreAlpha(h.score) } as React.CSSProperties}>
      <div className={styles.highlightHead}>
        <span className={styles.highlightLabel}>{h.label}</span>
        <span className={styles.highlightContext} title={ctx.full}>{ctx.short}</span>
      </div>
      <p className={styles.highlightText}>{h.text}</p>
      {heroList && <HeroIcons heroes={heroList} />}
      {showBar && <MilestoneBar milestone={h.milestone!} distance={h.distance!} />}
    </li>
  )
}

/* ── Team card ──────────────────────────────────────────── */

function TeamCard({
  team,
  contextKeys,
  contextLabel,
}: {
  team: Team
  contextKeys: string[]
  contextLabel: (k: string) => string
}) {
  const glicko = team.commonStats.find(isGlicko)
  const recordByCtx = useMemo(() => {
    const m = new Map<string, RecordStat>()
    for (const s of team.commonStats) if (isRecord(s)) m.set(s.context, s)
    return m
  }, [team.commonStats])

  for (const s of team.commonStats) {
    const t = (s as { type: string }).type
    if (t !== 'GLICKO2' && t !== 'RECORD') warnUnknownStat('team', t)
  }

  return (
    <article id={`team-${team.valveId}`} className={styles.card}>
      <header className={styles.cardHeader}>
        <div className={styles.cardIdentity}>
          {team.logo && (
            <img
              src={team.logo}
              alt=""
              className={styles.cardLogo}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
            />
          )}
          <div className={styles.cardTitle}>
            <a
              href={`/teams/${team.valveId}`}
              target="_blank"
              rel="noreferrer"
              className={styles.teamName}
            >
              {team.name}
            </a>
            {team.aka && <span className={styles.aka}>aka {team.aka}</span>}
          </div>
        </div>
        {glicko && glicko.value != null && (
          <div className={styles.glicko} title="Glicko-2 rating">
            <span className={styles.glickoValue}>{Math.round(glicko.value)}</span>
            <span className={styles.glickoLabel}>Glicko-2</span>
          </div>
        )}
      </header>

      {contextKeys.length > 0 && (
        <div className={styles.records}>
          {contextKeys.map((ctxKey) => {
            const r = recordByCtx.get(ctxKey)
            const wins = r?.wins ?? 0
            const losses = r?.losses ?? 0
            const games = r?.games ?? 0
            const wr = games > 0 ? (wins / games) * 100 : null
            const ctx = splitLabel(contextLabel(ctxKey))
            return (
              <div key={ctxKey} className={styles.recordChip}>
                <span className={styles.recordContext} title={ctx.full}>{ctx.short}</span>
                <span className={styles.recordWl}>
                  <span className={styles.win}>{wins}</span>
                  <span className={styles.recordSep}>–</span>
                  <span className={styles.loss}>{losses}</span>
                </span>
                <span className={styles.recordWr}>{wr != null ? `${wr.toFixed(1)}%` : ' '}</span>
              </div>
            )
          })}
        </div>
      )}

      {team.highlights.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Storylines</div>
          <ul className={styles.highlights}>
            {team.highlights.map((h, i) => (
              <HighlightRow key={i} h={h} contextLabel={contextLabel} />
            ))}
          </ul>
        </div>
      )}

      {team.players.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Roster</div>
          <div className={styles.players}>
            {team.players.map((p) => (
              <PlayerRow key={p.steamId} player={p} contextLabel={contextLabel} />
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function PlayerRow({ player, contextLabel }: { player: Player; contextLabel: (k: string) => string }) {
  const career = player.commonStats.find((s) => s.type === 'CAREER_GAMES')
  const season = player.commonStats.find((s) => s.type === 'SEASON_GAMES')

  for (const s of player.commonStats) {
    const t = (s as { type: string }).type
    if (t !== 'CAREER_GAMES' && t !== 'SEASON_GAMES') warnUnknownStat('player', t)
  }

  return (
    <div className={styles.player}>
      <div className={styles.playerHead}>
        <Link to={`/players/${player.steamId}`} className={styles.playerName}>
          {player.nickname}
        </Link>
        <div className={styles.playerStats}>
          {career && (
            <span className={styles.playerStat} title="Career games">
              {career.value.toLocaleString()}<span className={styles.playerStatUnit}>career</span>
            </span>
          )}
          {season && (
            <span className={styles.playerStat} title="Games this season">
              {season.value.toLocaleString()}<span className={styles.playerStatUnit}>season</span>
            </span>
          )}
        </div>
      </div>
      {player.highlights.length > 0 && (
        <ul className={styles.playerHighlights}>
          {player.highlights.map((h, i) => (
            <HighlightRow key={i} h={h} contextLabel={contextLabel} />
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────── */

export default function TournamentPreview() {
  const { slug } = useParams<{ slug: string }>()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: PreviewData }>(
    slug ? `/api/tournament-previews/${slug}` : null,
  )

  const preview = data?.data
  const previewContexts = preview?.contexts
  const previewTeams = preview?.teams

  const contextLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of previewContexts ?? []) map.set(c.key, c.label)
    return (key: string) => map.get(key) ?? CONTEXT_SHORT[key] ?? key
  }, [previewContexts])

  const contextKeys = useMemo(
    () => CONTEXT_ORDER.filter((k) => (previewContexts ?? []).some((c) => c.key === k)),
    [previewContexts],
  )

  const teams = useMemo(() => {
    if (!previewTeams) return []
    return [...previewTeams].sort((a, b) => {
      const av = (a.commonStats.find(isGlicko) as Glicko2Stat | undefined)?.value ?? -Infinity
      const bv = (b.commonStats.find(isGlicko) as Glicko2Stat | undefined)?.value ?? -Infinity
      return bv - av
    })
  }, [previewTeams])

  const notFound = !isLoading && (!!error || !preview)
  useNoIndex(notFound)

  if (isLoading) {
    return <div className={styles.page}><EnigmaLoader text="Loading tournament preview..." /></div>
  }

  if (error || !preview) {
    return (
      <div className={styles.page}>
        <ErrorState
          message="Failed to load tournament preview"
          detail="Could not fetch preview data. It may not exist yet for this tournament."
          rawDetail={error instanceof Error ? error.message : String(error ?? 'No data')}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageMeta
        title={`${preview.name} — Preview by the Numbers`}
        description={`Team-by-team statistical preview of ${preview.name}: Glicko ratings, records, storylines and rosters for all ${teams.length} teams.`}
        jsonLd={[
          buildBreadcrumbs([
            { name: 'Home', path: '/' },
            { name: 'Leagues', path: '/leagues' },
            { name: `${preview.name} Preview` },
          ]),
        ]}
      />

      <header className={styles.header}>
        <h1>{preview.name}</h1>
        <p className={styles.subtitle}>Tournament preview by the numbers</p>
      </header>

      {teams.length === 0 ? (
        <div className={styles.empty}>No teams in this preview yet.</div>
      ) : (
        <>
          {preview.headToHead && (
            <H2HCrossSection headToHead={preview.headToHead} teams={teams} contextLabel={contextLabel} />
          )}
          <div className={styles.grid}>
            {teams.map((team) => (
              <TeamCard key={team.valveId} team={team} contextKeys={contextKeys} contextLabel={contextLabel} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
