import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { heroImageUrl, teamLogoUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, TeamCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './EntityShow.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface RecentGame {
  matchId: number
  startDate: string
  hero: number
  kills: number
  deaths: number
  assists: number
  gpm: number
  xpm: number
  win: boolean
}

interface TeamResult {
  valveId: number
  name: string
  logoId: string
  wins: number
  losses: number
}

interface TeamStint {
  valveId: number
  name: string
  logoId: string
  wins: number
  losses: number
  start: string
  end: string
}

interface GameCount {
  year: number
  month: number
  count: number
}

interface PlayerData {
  nickname: string
  steamId: string
  numGames: { premium: number; pro: number; semipro: number }
  totalGames: number
  uniqueHeroes: number
  currentTeam: { valveId: number; name: string; logoId?: number } | null
  recentGames: RecentGame[]
  resultsByTeam: TeamResult[]
  stints: TeamStint[]
  proGameCounts?: GameCount[]
}

/* ── Helpers ────────────────────────────────────────────── */

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPicture(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatStintDuration(start: string, end: string): { days: number; label: string } {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const totalDays = Math.max(1, Math.round(ms / 86400000))
  const years = Math.floor(totalDays / 365)
  const months = Math.floor((totalDays % 365) / 30)
  const days = totalDays % 30
  const parts: string[] = []
  if (years > 0) parts.push(`${years}y`)
  if (months > 0) parts.push(`${months}m`)
  if (days > 0 || parts.length === 0) parts.push(`${days}d`)
  return { days: totalDays, label: parts.join(' ') }
}

/* ── Recent Games columns ──────────────────────────────── */

const recentGameColumns: ColumnDef<RecentGame, unknown>[] = [
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
    id: 'hero',
    accessorFn: (row) => heroName(row.hero),
    header: 'Hero',
    size: 46,
    enableSorting: false,
    cell: ({ row }) => {
      const pic = heroPicture(row.original.hero)
      return pic ? (
        <img
          src={heroImageUrl(pic)}
          alt={heroName(row.original.hero)}
          title={heroName(row.original.hero)}
          style={{ height: 22, width: 'auto' }}
          loading="lazy"
        />
      ) : (
        <span style={{ fontSize: '0.65rem' }}>{heroName(row.original.hero)}</span>
      )
    },
  },
  {
    id: 'kills',
    accessorKey: 'kills',
    header: 'K',
    size: 45,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Kills' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'deaths',
    accessorKey: 'deaths',
    header: 'D',
    size: 45,
    meta: { numeric: true, heatmap: 'high-bad' as const, tooltip: 'Deaths' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'assists',
    accessorKey: 'assists',
    header: 'A',
    size: 45,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Assists' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'gpm',
    accessorKey: 'gpm',
    header: 'GPM',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Gold Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'xpm',
    accessorKey: 'xpm',
    header: 'XPM',
    size: 55,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'XP Per Minute' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'result',
    accessorFn: (row) => row.win,
    header: 'R',
    size: 40,
    meta: { tooltip: 'Result' },
    cell: ({ row }) => {
      const win = row.original.win
      return (
        <span style={{ color: win ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 600, fontSize: '0.8rem' }}>
          {win ? 'W' : 'L'}
        </span>
      )
    },
  },
]

/* ── Results by Team columns ───────────────────────────── */

const teamResultColumns: ColumnDef<TeamResult, unknown>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Team',
    size: 160,
    cell: ({ row }) => (
      <TeamCell
        valveId={row.original.valveId}
        name={row.original.name}
        logoUrl={teamLogoUrl(row.original.logoId)}
      />
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
]

/* ── Stint Period Cell with tooltip ─────────────────────── */

function StintPeriodCell({ start, end }: { start: string; end: string }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const { days, label } = formatStintDuration(start, end)

  return (
    <span
      ref={ref}
      style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', position: 'relative', cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {formatDate(start)} — {formatDate(end)}
      {show && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translate(-50%, -6px)',
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: '6px 10px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
            {days.toLocaleString()} days
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {label}
          </span>
        </span>
      )}
    </span>
  )
}

/* ── Team Stints columns ───────────────────────────────── */

const stintColumns: ColumnDef<TeamStint, unknown>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Team',
    size: 160,
    cell: ({ row }) => (
      <TeamCell
        valveId={row.original.valveId}
        name={row.original.name}
        logoUrl={teamLogoUrl(row.original.logoId)}
      />
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
    id: 'period',
    accessorFn: (row) => new Date(row.start).getTime(),
    header: 'Period',
    size: 180,
    cell: ({ row }) => <StintPeriodCell start={row.original.start} end={row.original.end} />,
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

export default function PlayerShow() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: PlayerData }>(
    id ? `/api/players/${id}` : null,
  )

  const player = data?.data

  const recentRows = useMemo(() => player?.recentGames ?? [], [player?.recentGames])

  const sortedTeamResults = useMemo(() => {
    if (!player?.resultsByTeam) return []
    return [...player.resultsByTeam].sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
  }, [player?.resultsByTeam])

  const sortedStints = useMemo(() => {
    if (!player?.stints) return []
    return [...player.stints].sort(
      (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
    )
  }, [player?.stints])

  if (isLoading) return <div className={styles.page}><EnigmaLoader text="Loading player..." /></div>

  if (error || !player) {
    return (
      <div className={styles.page}>
        <ErrorState
          message="Failed to load player"
          detail="Could not fetch player data."
          rawDetail={error instanceof Error ? error.message : String(error ?? 'No data')}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <h1>{player.nickname}</h1>
          <div className={styles.headerMeta}>
            {player.currentTeam && (
              <a href={`/teams/${player.currentTeam.valveId}`}>
                {player.currentTeam.name}
              </a>
            )}
            <span>Steam ID: {player.steamId}</span>
            <span>{player.totalGames.toLocaleString()} games tracked</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.section}>
        <div className={styles.ratingsGrid}>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Total Games</div>
            <div className={styles.ratingValue}>{player.totalGames.toLocaleString()}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Premium</div>
            <div className={styles.ratingValue}>{player.numGames.premium.toLocaleString()}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Pro</div>
            <div className={styles.ratingValue}>{player.numGames.pro.toLocaleString()}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Unique Heroes</div>
            <div className={styles.ratingValue}>{player.uniqueHeroes}</div>
          </div>
        </div>
      </div>

      {/* Activity chart */}
      {player.proGameCounts && player.proGameCounts.length > 0 && (
        <div className={styles.chartSection}>
          <div className={styles.chartTitle}>Pro Game Activity</div>
          <div className={styles.chartContainer}>
            <ActivityChart data={player.proGameCounts} />
          </div>
        </div>
      )}

      {/* Recent Games (left) + Team tables stacked (right) */}
      <div className={styles.columns}>
        {recentRows.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Recent Games</div>
            <DataTable
              data={recentRows}
              columns={recentGameColumns}
              defaultSorting={[{ id: 'date', desc: true }]}
              searchableColumns={['hero']}
            />
          </div>
        )}

        <div>
          {sortedTeamResults.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Results by Team</div>
              <DataTable
                data={sortedTeamResults}
                columns={teamResultColumns}
                defaultSorting={[{ id: 'total', desc: true }]}
                searchableColumns={['name']}
              />
            </div>
          )}

          {sortedStints.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Team Stints</div>
              <DataTable
                data={sortedStints}
                columns={stintColumns}
                defaultSorting={[{ id: 'period', desc: true }]}
                searchableColumns={['name']}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
