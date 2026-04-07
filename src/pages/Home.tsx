import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as d3 from 'd3'
import { apiFetch } from '../api/client'
import { heroesById } from '../data/heroes'
import { heroImageUrl, teamLogoUrl, leagueLogoUrl } from '../config'
import { TeamLogo } from '../components/DataTable'
import styles from './Home.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface RecentGame {
  matchId: number
  leagueId: number
  splitId: number | null
  splitDerivedName: string | null
  leagueName: string
  state: string
  radiantVictory: boolean
  winnerName: string
  loserName: string
  winnerId: number
  loserId: number
  winnerLogoId: string
  loserLogoId: string
  duration: number
}

interface LiveGame {
  matchId: number
  leagueId: number
  tier: number
  leagueName: string
  radiant: { name: string; valveId: number | null; score: number }
  dire: { name: string; valveId: number | null; score: number }
  duration: number
  hide: boolean
}

interface HeroCount {
  hero: number
  count: number
}

interface TopTeam {
  name: string
  tag: string
  logoId: string
  valveId: number
  rating: number
}

interface ActiveLeague {
  leagueId: number
  name: string
  tier: { id: number; name: string }
  first: string
  last: string
  count: number
}

interface WeekStats {
  year: number
  week: number
  totalGames: number
  lanGames: number
  parsedGames: number
}

interface HomeCounts {
  total_matches: number
  premium_matches: number
  pro_matches: number
  semipro_matches: number
  rating_points: number
  data_frames: number
  teams: number
  leagues: number
}

interface HomeData {
  recentGames: RecentGame[]
  liveGames: Record<string, LiveGame>
  heroCount: HeroCount[]
  topTeams: TopTeam[]
  activeLeagues: ActiveLeague[]
  matchStatsBreakdown: WeekStats[]
  counts: HomeCounts
}

/* ── Helpers ────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  if (seconds < 0) return 'Pre-game'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPicture(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function weekToDate(year: number, week: number): Date {
  const d = new Date(year, 0, 1)
  d.setDate(d.getDate() + (week - 1) * 7)
  return d
}

const POLL_INTERVAL = 60_000

/* ── Page ───────────────────────────────────────────────── */

export default function Home() {
  const { data } = useQuery<HomeData>({
    queryKey: ['api', '/api/home'],
    queryFn: () => apiFetch<HomeData>('/api/home'),
    staleTime: 30_000,
    refetchInterval: POLL_INTERVAL,
  })

  if (!data) return null

  return (
    <div className={styles.page}>
      <div className={styles.mainGrid}>
        {/* Left column: live games + recent matches + active leagues */}
        <div>
          <LiveBanner games={data.liveGames} />
          <RecentGames games={data.recentGames} />
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <ActiveLeagues leagues={data.activeLeagues} />
          </div>
        </div>

        {/* Right column: teams + heroes */}
        <div>
          <TopTeams teams={data.topTeams} />
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <HeroPopularity heroes={data.heroCount} />
          </div>
        </div>
      </div>

      <ActivityChart data={data.matchStatsBreakdown} />
      <CountsBar counts={data.counts} />
    </div>
  )
}

/* ── Counts bar (bottom) ────────────────────────────────── */

function CountsBar({ counts }: { counts: HomeCounts }) {
  return (
    <div className={styles.countsBar}>
      <span className={styles.countItem}>
        <span className={styles.countValue}>{formatNumber(counts.total_matches)}</span> matches
      </span>
      <span className={styles.countItem}>
        <span className={styles.countValue}>{formatNumber(counts.teams)}</span> teams
      </span>
      <span className={styles.countItem}>
        <span className={styles.countValue}>{formatNumber(counts.leagues)}</span> leagues
      </span>
      <span className={styles.countItem}>
        <span className={styles.countValue}>{formatNumber(counts.data_frames)}</span> data frames
      </span>
      <span className={styles.countItem}>
        <span className={styles.countValue}>{formatNumber(counts.rating_points)}</span> rating points
      </span>
    </div>
  )
}

/* ── Live games (paginated, 2 at a time) ────────────────── */

const LIVE_PAGE_SIZE = 2

function LiveBanner({ games }: { games: Record<string, LiveGame> }) {
  const [page, setPage] = useState(0)

  const liveList = useMemo(
    () => Object.values(games)
      .filter((g) => !g.hide && g.radiant && g.dire)
      .sort((a, b) => a.tier - b.tier || b.duration - a.duration),
    [games],
  )

  if (liveList.length === 0) return null

  const maxPage = Math.max(0, Math.ceil(liveList.length / LIVE_PAGE_SIZE) - 1)
  const safePage = Math.min(page, maxPage)
  const visible = liveList.slice(safePage * LIVE_PAGE_SIZE, (safePage + 1) * LIVE_PAGE_SIZE)

  return (
    <div className={styles.liveBanner}>
      <div className={styles.liveBannerTitle}>
        <span className={styles.liveDot} />
        {liveList.length} Live Game{liveList.length !== 1 ? 's' : ''}
        {liveList.length > LIVE_PAGE_SIZE && (
          <span className={styles.livePager}>
            <button className={styles.pagerBtn} disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>&lsaquo;</button>
            <span className={styles.pagerLabel}>{safePage + 1}/{maxPage + 1}</span>
            <button className={styles.pagerBtn} disabled={safePage >= maxPage} onClick={() => setPage(safePage + 1)}>&rsaquo;</button>
          </span>
        )}
      </div>
      <div className={styles.liveCards}>
        {visible.map((g) => (
          <Link key={g.matchId} to={`/matches/${g.matchId}`} className={styles.liveCard}>
            <div className={styles.liveTeams}>
              <span>{g.radiant.name}</span>
              <span className={styles.liveScore}>{g.radiant.score}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>-</span>
              <span className={styles.liveScore}>{g.dire.score}</span>
              <span>{g.dire.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span className={styles.liveLeague}>{g.leagueName}</span>
              <span className={styles.liveDuration}>{formatDuration(g.duration)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ── Recent games (grouped by league/split) ─────────────── */

const PAGE_SIZE = 10

function RecentGames({ games }: { games: RecentGame[] }) {
  const sorted = useMemo(() => [...games].sort((a, b) => b.matchId - a.matchId), [games])
  const [page, setPage] = useState(0)
  const maxPage = Math.max(0, Math.ceil(sorted.length / PAGE_SIZE) - 1)
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Group visible games by split (if present) or league
  const grouped = useMemo(() => {
    const groups: { label: string; linkTo: string; games: RecentGame[] }[] = []
    const map = new Map<string, typeof groups[0]>()
    for (const g of visible) {
      const key = g.splitId ? `split-${g.splitId}` : `league-${g.leagueId}`
      let group = map.get(key)
      if (!group) {
        const label = g.splitDerivedName ?? g.leagueName
        const linkTo = `/leagues/${g.leagueId}`
        group = { label, linkTo, games: [] }
        map.set(key, group)
        groups.push(group)
      }
      group.games.push(g)
    }
    return groups
  }, [visible])

  return (
    <div>
      <div className={styles.sectionTitle}>
        Recent Matches
        <Link to="/matches" className={styles.sectionLink}>view all</Link>
      </div>
      <div className={styles.recentGames}>
        {grouped.map((group) => (
          <div key={group.linkTo}>
            <Link to={group.linkTo} className={styles.leagueGroupHeader}>{group.label}</Link>
            {group.games.map((g) => {
              const radName = g.radiantVictory ? g.winnerName : g.loserName
              const direName = g.radiantVictory ? g.loserName : g.winnerName
              const radLogo = g.radiantVictory ? g.winnerLogoId : g.loserLogoId
              const direLogo = g.radiantVictory ? g.loserLogoId : g.winnerLogoId
              const radWon = g.radiantVictory
              const isParsed = g.state === 'parsed'
              return (
                <Link key={g.matchId} to={`/matches/${g.matchId}`} className={styles.recentCard}>
                  <div className={styles.recentTeam}>
                    <TeamLogo logoUrl={teamLogoUrl(radLogo)} name={radName} className={styles.recentLogo} />
                    <span className={`${styles.recentName} ${radWon ? styles.recentNameWin : ''}`}>{radName}</span>
                  </div>
                  <span className={radWon ? styles.recentArrowLeft : styles.recentArrowRight}>
                    {radWon ? '\u276E' : '\u276F'}
                  </span>
                  <div className={`${styles.recentTeam} ${styles.recentTeamRight}`}>
                    <span className={`${styles.recentName} ${!radWon ? styles.recentNameWin : ''}`}>{direName}</span>
                    <TeamLogo logoUrl={teamLogoUrl(direLogo)} name={direName} className={styles.recentLogo} />
                  </div>
                  <span className={styles.recentDuration}>{formatDuration(g.duration)}</span>
                  <span
                    className={`${styles.recentParsed} ${isParsed ? styles.recentParsedYes : ''}`}
                    title={isParsed ? 'Replay parsed' : 'Not yet parsed'}
                  >
                    {isParsed ? '\u2713' : '\u2026'}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>
      {sorted.length > PAGE_SIZE && (
        <div className={styles.recentPager}>
          <button className={styles.pagerBtn} disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span className={styles.pagerLabel}>{page + 1} / {maxPage + 1}</span>
          <button className={styles.pagerBtn} disabled={page >= maxPage} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}

/* ── Top teams ──────────────────────────────────────────── */

function TopTeams({ teams }: { teams: TopTeam[] }) {
  const top16 = teams.slice(0, 16)
  return (
    <div>
      <div className={styles.sectionTitle}>
        Top Teams — Glicko-2
        <Link to="/ratings" className={styles.sectionLink}>full ratings</Link>
      </div>
      <div className={styles.teamsList}>
        {top16.map((t, i) => (
          <Link key={t.valveId} to={`/teams/${t.valveId}`} className={styles.teamRow}>
            <span className={styles.teamRank}>{i + 1}</span>
            <TeamLogo logoUrl={teamLogoUrl(t.logoId)} name={t.name} className={styles.teamLogo} />
            <span className={styles.teamName}>{t.name}</span>
            <span className={styles.teamRating}>{Math.round(t.rating)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ── Hero popularity (tiered sizing) ────────────────────── */

function HeroPopularity({ heroes }: { heroes: HeroCount[] }) {
  const sorted = useMemo(() => [...heroes].sort((a, b) => b.count - a.count), [heroes])
  const maxCount = sorted[0]?.count ?? 1

  // Row tiers: 12, 16, 20, 20 = 68 heroes total
  const tiers = [
    { count: 12, heroes: sorted.slice(0, 12) },
    { count: 16, heroes: sorted.slice(12, 28) },
    { count: 20, heroes: sorted.slice(28, 48) },
    { count: 20, heroes: sorted.slice(48, 68) },
  ]

  return (
    <div>
      <div className={styles.sectionTitle}>
        Most Contested Heroes (Last Fortnight)
        <Link to="/drafts?default=true" className={styles.sectionLink}>drafts</Link>
      </div>
      <div className={styles.heroTiers}>
        {tiers.map((tier, ti) =>
          tier.heroes.length > 0 && (
            <div key={ti} className={styles.heroRow}>
              {tier.heroes.map((h) => {
                const pic = heroPicture(h.hero)
                const name = heroName(h.hero)
                const opacity = 0.35 + 0.65 * (h.count / maxCount)
                return (
                  <div
                    key={h.hero}
                    className={styles.heroCell}
                    title={`${name}: ${h.count} games`}
                    style={{ opacity }}
                  >
                    {pic ? (
                      <img src={heroImageUrl(pic)} alt={name} className={styles.heroCellImg} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'var(--color-bg-elevated)' }} />
                    )}
                    <div className={styles.heroCellOverlay}>
                      <span className={styles.heroCellCount}>{h.count}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ),
        )}
      </div>
    </div>
  )
}

/* ── Active leagues (paginated, 6 at a time, 2-col) ─────── */

const LEAGUE_PAGE_SIZE = 6

function ActiveLeagues({ leagues }: { leagues: ActiveLeague[] }) {
  const [page, setPage] = useState(0)
  const maxPage = Math.max(0, Math.ceil(leagues.length / LEAGUE_PAGE_SIZE) - 1)
  const safePage = Math.min(page, maxPage)
  const visible = leagues.slice(safePage * LEAGUE_PAGE_SIZE, (safePage + 1) * LEAGUE_PAGE_SIZE)

  return (
    <div>
      <div className={styles.sectionTitle}>
        Active Leagues
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {leagues.length > LEAGUE_PAGE_SIZE && (
            <span className={styles.livePager}>
              <button className={styles.pagerBtn} disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>&lsaquo;</button>
              <span className={styles.pagerLabel}>{safePage + 1}/{maxPage + 1}</span>
              <button className={styles.pagerBtn} disabled={safePage >= maxPage} onClick={() => setPage(safePage + 1)}>&rsaquo;</button>
            </span>
          )}
          <Link to="/leagues" className={styles.sectionLink}>all leagues</Link>
        </span>
      </div>
      <div className={styles.leaguesGrid}>
        {visible.map((l) => (
          <Link key={l.leagueId} to={`/leagues/${l.leagueId}`} className={styles.leagueCard} title={l.name}>
            <img src={leagueLogoUrl(l.leagueId)} alt="" className={styles.leagueLogo} loading="lazy" />
            <div className={styles.leagueInfo}>
              <div className={styles.leagueName}>{l.name}</div>
              <div className={styles.leagueMeta}>{l.count} matches</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ── Activity chart (stacked bar) ──────────────────────── */

const CHART_H = 180
const CHART_MARGIN = { top: 10, right: 16, bottom: 30, left: 45 }

function ActivityChart({ data }: { data: WeekStats[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number; y: number
    year: number; week: number
    total: number; lan: number; parsed: number
  } | null>(null)
  const [width, setWidth] = useState(800)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 800
      setWidth(Math.max(400, w - 32))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const w = width
    const innerW = w - CHART_MARGIN.left - CHART_MARGIN.right
    const innerH = CHART_H - CHART_MARGIN.top - CHART_MARGIN.bottom

    const points = data.map((d) => ({
      date: weekToDate(d.year, d.week),
      total: d.totalGames,
      lan: d.lanGames,
      online: d.totalGames - d.lanGames,
      parsed: d.parsedGames,
      year: d.year,
      week: d.week,
    }))

    const x = d3.scaleBand<number>()
      .domain(points.map((_, i) => i))
      .range([0, innerW])
      .padding(0.15)

    const y = d3.scaleLinear()
      .domain([0, d3.max(points, (p) => p.total) ?? 100])
      .nice()
      .range([innerH, 0])

    const xTime = d3.scaleTime()
      .domain(d3.extent(points, (p) => p.date) as [Date, Date])
      .range([0, innerW])

    const g = svg.append('g')
      .attr('transform', `translate(${CHART_MARGIN.left},${CHART_MARGIN.top})`)

    const barW = x.bandwidth()

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const bx = x(i)!

      if (p.lan > 0) {
        g.append('rect')
          .attr('x', bx)
          .attr('y', y(p.lan))
          .attr('width', barW)
          .attr('height', innerH - y(p.lan))
          .attr('fill', '#2dd4bf')
          .attr('rx', Math.min(1, barW / 4))
      }

      if (p.online > 0) {
        g.append('rect')
          .attr('x', bx)
          .attr('y', y(p.total))
          .attr('width', barW)
          .attr('height', y(p.lan) - y(p.total))
          .attr('fill', '#9a6a9a')
          .attr('rx', Math.min(1, barW / 4))
      }
    }

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(xTime)
          .ticks(Math.min(8, innerW / 80))
          .tickFormat(d3.timeFormat('%b %Y') as unknown as (d: d3.NumberValue, i: number) => string),
      )
      .call((sel) => sel.select('.domain').attr('stroke', '#2a2a44'))
      .call((sel) => sel.selectAll('.tick line').attr('stroke', '#2a2a44'))
      .call((sel) => sel.selectAll('.tick text').attr('fill', '#6e6b80').attr('font-size', '0.55rem').attr('font-family', 'Fira Code'))

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => String(d)))
      .call((sel) => sel.select('.domain').attr('stroke', '#2a2a44'))
      .call((sel) => sel.selectAll('.tick line').attr('stroke', '#2a2a44'))
      .call((sel) => sel.selectAll('.tick text').attr('fill', '#6e6b80').attr('font-size', '0.55rem').attr('font-family', 'Fira Code'))

    const overlay = g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')

    overlay
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event)
        const idx = Math.round((mx / innerW) * (points.length - 1))
        const p = points[Math.max(0, Math.min(idx, points.length - 1))]
        if (!p) return
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          year: p.year,
          week: p.week,
          total: p.total,
          lan: p.lan,
          parsed: p.parsed,
        })
      })
      .on('mouseleave', () => setTooltip(null))
  }, [data, width])

  return (
    <div className={styles.chartSection}>
      <div className={styles.sectionTitle}>
        Match Activity
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--color-text-muted)', fontWeight: 400, letterSpacing: 0, textTransform: 'none', marginLeft: 8 }}>
          <span style={{ color: '#2dd4bf' }}>LAN</span>
          {' + '}
          <span style={{ color: '#9a6a9a' }}>online</span>
        </span>
      </div>
      <div ref={containerRef} className={styles.chartContainer}>
        <svg ref={svgRef} width={width} height={CHART_H} />
      </div>
      {tooltip && (
        <div className={styles.chartTooltip} style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <strong>{tooltip.year} W{tooltip.week}</strong>
          <br />
          {tooltip.total} games &middot; {tooltip.lan} LAN ({tooltip.total > 0 ? Math.round(100 * tooltip.lan / tooltip.total) : 0}%)
          <br />
          {tooltip.parsed} parsed / {tooltip.total - tooltip.parsed} unparsed ({tooltip.total > 0 ? Math.round(100 * tooltip.parsed / tooltip.total) : 0}%)
        </div>
      )}
    </div>
  )
}
