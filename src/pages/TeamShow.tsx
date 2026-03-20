import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { teamLogoUrl, leagueLogoUrl } from '../config'
import DataTable, { NumericCell, PlayerCell, TeamCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
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

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 8, right: 8, bottom: 24, left: 30 }
    const width = Math.max(data.length * 8, 400)
    const height = 100

    const x = d3.scaleBand()
      .domain(data.map((d) => `${d.year}-${d.month}`))
      .range([margin.left, width - margin.right])
      .padding(0.2)

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top])

    svg.attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'none')
      .style('width', '100%')
      .style('height', '100px')

    svg.selectAll('rect.bar')
      .data(data)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(`${d.year}-${d.month}`) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => y(0) - y(d.count))
      .attr('fill', 'var(--color-primary)')
      .attr('opacity', 0.6)
      .attr('rx', 1)
      .style('cursor', 'default')
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('opacity', 1)
        const container = containerRef.current
        if (!container) return
        const barRect = (this as SVGRectElement).getBoundingClientRect()
        setTip({
          x: barRect.left + barRect.width / 2,
          y: barRect.top - 6,
          label: `${MONTH_NAMES[d.month - 1]} ${d.year}`,
          count: d.count,
        })
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.6)
        setTip(null)
      })

    const yearLabels = new Map<number, string>()
    data.forEach((d) => {
      if (!yearLabels.has(d.year)) yearLabels.set(d.year, `${d.year}-${d.month}`)
    })
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .tickValues([...yearLabels.values()])
          .tickFormat((d) => String(d).split('-')[0]),
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
  }, [data])

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
              searchableColumns={['nickname']}
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
              searchableColumns={['opponent', 'league']}
            />
          </div>
        )}
      </div>
    </div>
  )
}
