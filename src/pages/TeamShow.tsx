import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useNoIndex } from '../hooks/useNoIndex'
import { teamLogoUrl, leagueLogoUrl } from '../config'
import DataTable, { NumericCell, PlayerCell, TeamCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import { buildSportsTeam, buildBreadcrumbs } from '../lib/seo'
import styles from './EntityShow.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface TeamInfo {
  valveId: number
  name: string
  tag: string
  logoId: number
  display: boolean
}

interface RatingEntry {
  startPeriod: string
  rating: number
  mu: number
  phi: number
  sigma: number
}

interface PlayerPerf {
  steamId: number
  nickname: string
  wins: number
  losses: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  avgGPM: number
  avgXPM: number
}

interface TeamMatch {
  matchId: number
  startDate: string
  victory: boolean
  league: { leagueId: number; name: string; logoId: number }
  opponent: { valveId: number; name: string; tag: string; logoId: string }
}

interface GameCount {
  year: number
  month: number
  count: number
}

interface TeamData {
  team: TeamInfo
  ratings: Record<string, RatingEntry>
  perfs: PlayerPerf[]
  matches: TeamMatch[]
  proGameCounts: GameCount[]
}

/* ── Helpers ────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const RATING_LABELS: Record<string, string> = {
  ELO_32: 'Elo 32',
  ELO_64: 'Elo 64',
  GLICKO_1: 'Glicko-1',
  GLICKO_2: 'Glicko-2',
}

/* ── Player Performances columns ───────────────────────── */

const perfColumns: ColumnDef<PlayerPerf, unknown>[] = [
  {
    id: 'nickname',
    accessorKey: 'nickname',
    header: 'Player',
    size: 140,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />
    ),
  },
  {
    id: 'total',
    accessorFn: (row) => row.wins + row.losses,
    header: 'G',
    size: 50,
    meta: { numeric: true, tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'W',
    size: 50,
    meta: { numeric: true, tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'losses',
    accessorKey: 'losses',
    header: 'L',
    size: 50,
    meta: { numeric: true, tooltip: 'Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorFn: (row) => {
      const t = row.wins + row.losses
      return t > 0 ? row.wins / t : 0
    },
    header: 'WR',
    size: 58,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Win Rate' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      return <span style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{(v * 100).toFixed(1)}%</span>
    },
  },
  {
    id: 'avgKills',
    accessorKey: 'avgKills',
    header: 'K',
    size: 50,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Avg Kills' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'avgDeaths',
    accessorKey: 'avgDeaths',
    header: 'D',
    size: 50,
    meta: { numeric: true, heatmap: 'high-bad' as const, tooltip: 'Avg Deaths' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'avgAssists',
    accessorKey: 'avgAssists',
    header: 'A',
    size: 50,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Avg Assists' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
  },
  {
    id: 'avgGPM',
    accessorKey: 'avgGPM',
    header: 'GPM',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Avg Gold Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'avgXPM',
    accessorKey: 'avgXPM',
    header: 'XPM',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Avg XP Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

/* ── Recent Matches columns ────────────────────────────── */

const matchColumns: ColumnDef<TeamMatch, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a
        href={`/matches/${getValue()}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {getValue() as number}
      </a>
    ),
  },
  {
    id: 'date',
    accessorFn: (row) => new Date(row.startDate).getTime(),
    header: 'Date',
    size: 100,
    cell: ({ row }) => (
      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
        {formatDate(row.original.startDate)}
      </span>
    ),
  },
  {
    id: 'league',
    accessorFn: (row) => row.league.name,
    header: 'League',
    size: 46,
    enableSorting: false,
    cell: ({ row }) => (
      <img
        src={leagueLogoUrl(row.original.league.leagueId)}
        alt={row.original.league.name}
        title={row.original.league.name}
        style={{ height: 22, width: 'auto' }}
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    ),
  },
  {
    id: 'opponent',
    accessorFn: (row) => row.opponent.name,
    header: 'Opponent',
    size: 160,
    cell: ({ row }) => (
      <TeamCell
        valveId={row.original.opponent.valveId}
        name={row.original.opponent.name}
        logoUrl={teamLogoUrl(row.original.opponent.logoId)}
      />
    ),
  },
  {
    id: 'result',
    accessorFn: (row) => row.victory,
    header: 'R',
    size: 40,
    meta: { tooltip: 'Result' },
    cell: ({ row }) => {
      const win = row.original.victory
      return (
        <span style={{ color: win ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 600, fontSize: '0.8rem' }}>
          {win ? 'W' : 'L'}
        </span>
      )
    },
  },
]

/* ── Activity Chart ─────────────────────────────────────── */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ActivityChart({ data }: { data: GameCount[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; label: string; count: number } | null>(null)
  const [width, setWidth] = useState(720)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 720
      setWidth(Math.max(320, w - 32))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 8, right: 8, bottom: 24, left: 30 }
    const height = 100
    const drawableW = Math.max(1, width - margin.left - margin.right)

    // Merge consecutive months into buckets so the bars fill the width without scrolling.
    const MIN_SLOT = 18
    const maxBars = Math.max(1, Math.floor(drawableW / MIN_SLOT))
    const groupSize = Math.max(1, Math.ceil(data.length / maxBars))
    const buckets: { key: string; startYear: number; startMonth: number; endYear: number; endMonth: number; count: number }[] = []
    for (let i = 0; i < data.length; i += groupSize) {
      const grp = data.slice(i, i + groupSize)
      const first = grp[0]
      const last = grp[grp.length - 1]
      buckets.push({
        key: `${first.year}-${first.month}-${i}`,
        startYear: first.year,
        startMonth: first.month,
        endYear: last.year,
        endMonth: last.month,
        count: grp.reduce((s, d) => s + d.count, 0),
      })
    }

    const x = d3.scaleBand()
      .domain(buckets.map((b) => b.key))
      .range([margin.left, width - margin.right])
      .padding(0.3)

    const y = d3.scaleLinear()
      .domain([0, d3.max(buckets, (b) => b.count) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top])

    svg.attr('viewBox', `0 0 ${width} ${height}`)
      .style('width', `${width}px`)
      .style('height', '100px')

    svg.selectAll('rect.bar')
      .data(buckets)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (b) => x(b.key) ?? 0)
      .attr('y', (b) => y(b.count))
      .attr('width', x.bandwidth())
      .attr('height', (b) => y(0) - y(b.count))
      .attr('fill', 'var(--color-primary)')
      .attr('opacity', 0.6)
      .attr('rx', 1)
      .style('cursor', 'default')
      .on('mouseenter', function (_event, b) {
        d3.select(this).attr('opacity', 1)
        const barRect = (this as SVGRectElement).getBoundingClientRect()
        const label = groupSize === 1
          ? `${MONTH_NAMES[b.startMonth - 1]} ${b.startYear}`
          : `${MONTH_NAMES[b.startMonth - 1]} ${b.startYear} – ${MONTH_NAMES[b.endMonth - 1]} ${b.endYear}`
        setTip({
          x: barRect.left + barRect.width / 2,
          y: barRect.top - 6,
          label,
          count: b.count,
        })
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.6)
        setTip(null)
      })

    const yearTicks: string[] = []
    const yearOf = new Map<string, number>()
    let lastYear: number | null = null
    for (const b of buckets) {
      yearOf.set(b.key, b.startYear)
      if (b.startYear !== lastYear) {
        yearTicks.push(b.key)
        lastYear = b.startYear
      }
    }

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .tickValues(yearTicks)
          .tickFormat((d) => String(yearOf.get(String(d)) ?? '')),
      )
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '8px')
        .attr('font-family', 'var(--font-mono)'))
      .call((g) => g.selectAll('line').attr('stroke', 'var(--color-border)'))

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(3).tickSize(-width + margin.left + margin.right))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('text')
        .attr('fill', 'var(--color-text-muted)')
        .attr('font-size', '8px')
        .attr('font-family', 'var(--font-mono)'))
      .call((g) => g.selectAll('line')
        .attr('stroke', 'var(--color-border)')
        .attr('stroke-opacity', 0.3))
  }, [data, width])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg ref={svgRef} />
      {tip && (
        <div style={{
          position: 'fixed',
          left: tip.x,
          top: tip.y,
          transform: 'translate(-50%, -100%)',
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: '4px 8px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontSize: '0.7rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 10,
        }}>
          <span style={{ color: 'var(--color-text-muted)' }}>{tip.label}</span>
          {' — '}
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{tip.count}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> games</span>
        </div>
      )}
    </div>
  )
}

/* ── Page component ─────────────────────────────────────── */

export default function TeamShow() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: TeamData }>(
    id ? `/api/teams/${id}` : null,
  )

  const team = data?.data

  const perfRows = useMemo(() => {
    if (!team?.perfs) return []
    return [...team.perfs].sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
  }, [team?.perfs])

  const matchRows = useMemo(() => team?.matches ?? [], [team?.matches])

  const notFound = !isLoading && (!!error || !team)
  useNoIndex(notFound)

  if (isLoading) return <div className={styles.page}><EnigmaLoader text="Loading team..." /></div>

  if (error || !team) {
    return (
      <div className={styles.page}>
        <ErrorState
          message="Failed to load team"
          detail="Could not fetch team data."
          rawDetail={error instanceof Error ? error.message : String(error ?? 'No data')}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const totalGames = team.proGameCounts.reduce((s, c) => s + c.count, 0)
  const logoUrl = teamLogoUrl(String(team.team.logoId))

  return (
    <div className={styles.page}>
      <PageMeta
        title={`${team.team.name} — Pro Dota 2 Team Stats`}
        description={`Match history, roster, ratings and tournament results for pro Dota 2 team ${team.team.name} (${team.team.tag}). ${totalGames.toLocaleString()} tracked games.`}
        jsonLd={[
          buildSportsTeam({
            valveId: team.team.valveId,
            name: team.team.name,
            tag: team.team.tag,
            logo: logoUrl,
          }),
          buildBreadcrumbs([
            { name: 'Home', path: '/' },
            { name: 'Teams', path: '/teams/performances' },
            { name: team.team.name },
          ]),
        ]}
      />
      {/* Header */}
      <div className={styles.headerRow}>
        <img
          src={logoUrl}
          alt={team.team.name}
          className={styles.headerLogo}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className={styles.headerInfo}>
          <h1>{team.team.name}</h1>
          <div className={styles.headerMeta}>
            <span>Tag: {team.team.tag}</span>
            <span>Valve ID: {team.team.valveId}</span>
            <span>{totalGames.toLocaleString()} games tracked</span>
          </div>
        </div>
      </div>

      {/* Ratings */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Current Ratings</div>
        <div className={styles.ratingsGrid}>
          {Object.entries(team.ratings).map(([key, r]) => (
            <div key={key} className={styles.ratingCard}>
              <div className={styles.ratingType}>{RATING_LABELS[key] ?? key}</div>
              <div className={styles.ratingValue}>{r.rating.toFixed(1)}</div>
              <div className={styles.ratingPeriod}>as of {r.startPeriod}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity chart */}
      {team.proGameCounts.length > 0 && (
        <div className={styles.chartSection}>
          <div className={styles.chartTitle}>Pro Game Activity</div>
          <div className={styles.chartContainer}>
            <ActivityChart data={team.proGameCounts} />
          </div>
        </div>
      )}

      {/* Player Performances + Recent Matches side-by-side */}
      <div className={styles.columns}>
        {perfRows.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Player Performances</div>
            <DataTable
              data={perfRows}
              columns={perfColumns}
              defaultSorting={[{ id: 'total', desc: true }]}
              searchValue={(r) => [r.nickname, String(r.steamId)].join(' ')}
            />
          </div>
        )}

        {matchRows.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Recent Games</div>
            <DataTable
              data={matchRows}
              columns={matchColumns}
              defaultSorting={[{ id: 'date', desc: true }]}
              searchValue={(r) => [
                String(r.matchId),
                r.opponent.name,
                r.opponent.tag ?? '',
                String(r.opponent.valveId),
                r.league.name,
                String(r.league.leagueId),
              ].join(' ')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
