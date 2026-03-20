import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { leagueLogoUrl } from '../config'
import DataTable, { NumericCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './EntityShow.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface LeagueInfo {
  leagueId: number
  name: string
  tier: number
  description: string
}

interface LeagueMatch {
  matchId: number
  startDate: string
  duration: number
  radiantVictory: boolean
}

interface LeagueTeam {
  valveId: number
  name: string
  tag: string
  wins: number
  losses: number
  uniqueOpponents: number
}

interface Matchup {
  first: { valveId: number; name: string }
  second: { valveId: number; name: string }
  firstWins: number
  secondWins: number
}

interface PatchCount {
  patchName: string
  count: number
}

interface LeagueData {
  league: LeagueInfo
  matches: {
    radiantWins: number
    direWins: number
    avgDuration: number
    total: number
    byPatch: PatchCount[]
    data: LeagueMatch[]
  }
  teams: LeagueTeam[]
  matchups: {
    unique: number
    data: Matchup[]
  }
}

/* ── Helpers ────────────────────────────────────────────── */

const TIER_LABELS: Record<number, string> = { 1: 'Premium', 2: 'Professional', 3: 'Semi-Pro' }

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── Team columns ──────────────────────────────────────── */

const teamColumns: ColumnDef<LeagueTeam, unknown>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Team',
    size: 180,
    cell: ({ row }) => (
      <Link
        to={`/teams/${row.original.valveId}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    id: 'tag',
    accessorKey: 'tag',
    header: 'Tag',
    size: 80,
    meta: { tooltip: 'Team Tag' },
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
      return (
        <span style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
          {(v * 100).toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: 'opponents',
    accessorKey: 'uniqueOpponents',
    header: 'Opp',
    size: 50,
    meta: { numeric: true, tooltip: 'Unique Opponents' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

/* ── Matchup columns ───────────────────────────────────── */

interface MatchupRow extends Matchup {
  totalGames: number
}

const matchupColumns: ColumnDef<MatchupRow, unknown>[] = [
  {
    id: 'first',
    accessorFn: (row) => row.first.name,
    header: 'Team A',
    size: 160,
    cell: ({ row }) => (
      <Link
        to={`/teams/${row.original.first.valveId}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {row.original.first.name}
      </Link>
    ),
  },
  {
    id: 'score',
    accessorFn: (row) => row.totalGames,
    header: 'Score',
    size: 80,
    meta: { tooltip: 'Head-to-Head Score' },
    cell: ({ row }) => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
        {row.original.firstWins} – {row.original.secondWins}
      </span>
    ),
  },
  {
    id: 'second',
    accessorFn: (row) => row.second.name,
    header: 'Team B',
    size: 160,
    cell: ({ row }) => (
      <Link
        to={`/teams/${row.original.second.valveId}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {row.original.second.name}
      </Link>
    ),
  },
  {
    id: 'total',
    accessorKey: 'totalGames',
    header: 'Games',
    size: 60,
    meta: { numeric: true, tooltip: 'Total Games Played' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

/* ── Match columns ─────────────────────────────────────── */

const matchColumns: ColumnDef<LeagueMatch, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 110,
    cell: ({ getValue }) => (
      <Link
        to={`/matches/${getValue()}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {getValue() as number}
      </Link>
    ),
  },
  {
    id: 'date',
    accessorFn: (row) => new Date(row.startDate).getTime(),
    header: 'Date',
    size: 150,
    cell: ({ row }) => (
      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
        {formatDateTime(row.original.startDate)}
      </span>
    ),
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Dur',
    size: 60,
    meta: { numeric: true, tooltip: 'Duration' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(getValue() as number)}
      </span>
    ),
  },
  {
    id: 'winner',
    accessorFn: (row) => row.radiantVictory,
    header: 'Winner',
    size: 80,
    cell: ({ row }) => (
      <span style={{
        color: row.original.radiantVictory ? 'var(--color-win)' : 'var(--color-loss)',
        fontWeight: 600,
        fontSize: '0.78rem',
      }}>
        {row.original.radiantVictory ? 'Radiant' : 'Dire'}
      </span>
    ),
  },
]

/* ── Page component ─────────────────────────────────────── */

export default function LeagueShow() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: LeagueData }>(
    id ? `/api/leagues/${id}` : null,
  )

  const league = data?.data

  const matchupRows = useMemo<MatchupRow[]>(() => {
    if (!league?.matchups?.data) return []
    return league.matchups.data
      .map((m) => ({ ...m, totalGames: m.firstWins + m.secondWins }))
      .sort((a, b) => b.totalGames - a.totalGames)
  }, [league?.matchups?.data])

  const sortedMatches = useMemo(() => {
    if (!league?.matches?.data) return []
    return [...league.matches.data].sort((a, b) => b.matchId - a.matchId)
  }, [league?.matches?.data])

  const dateRange = useMemo(() => {
    if (!sortedMatches.length) return null
    const first = sortedMatches[sortedMatches.length - 1]
    const last = sortedMatches[0]
    return { first: first.startDate, last: last.startDate }
  }, [sortedMatches])

  if (isLoading) return <div className={styles.page}><EnigmaLoader text="Loading league..." /></div>

  if (error || !league) {
    return (
      <div className={styles.page}>
        <ErrorState
          message="Failed to load league"
          detail="Could not fetch league data."
          rawDetail={error instanceof Error ? error.message : String(error ?? 'No data')}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const info = league.league
  const m = league.matches
  const radiantPct = m.total > 0 ? ((m.radiantWins / m.total) * 100).toFixed(1) : '0'
  const direPct = m.total > 0 ? ((m.direWins / m.total) * 100).toFixed(1) : '0'

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <img
          src={leagueLogoUrl(info.leagueId)}
          alt={info.name}
          className={styles.headerLogoWide}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className={styles.headerInfo}>
          <h1>{info.name}</h1>
          <div className={styles.headerMeta}>
            <span>{TIER_LABELS[info.tier] ?? `Tier ${info.tier}`}</span>
            {m.byPatch.length > 0 && (
              <span>Patch {m.byPatch.map((p) => p.patchName).join(', ')}</span>
            )}
            {dateRange && (
              <span>{formatDate(dateRange.first)} — {formatDate(dateRange.last)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.section}>
        <div className={styles.ratingsGrid}>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Total Matches</div>
            <div className={styles.ratingValue}>{m.total}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Radiant Wins</div>
            <div className={styles.ratingValue}>{m.radiantWins}</div>
            <div className={styles.ratingPeriod}>{radiantPct}%</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Dire Wins</div>
            <div className={styles.ratingValue}>{m.direWins}</div>
            <div className={styles.ratingPeriod}>{direPct}%</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Avg Duration</div>
            <div className={styles.ratingValue}>{formatDuration(m.avgDuration)}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Teams</div>
            <div className={styles.ratingValue}>{league.teams.length}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Matchups</div>
            <div className={styles.ratingValue}>{league.matchups.unique}</div>
          </div>
        </div>
      </div>

      {/* Teams + Matchups in two columns */}
      <div className={styles.columns}>
        {league.teams.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Team Records</div>
            <DataTable
              data={league.teams}
              columns={teamColumns}
              defaultSorting={[{ id: 'winrate', desc: true }]}
              searchableColumns={['name', 'tag']}
            />
          </div>
        )}

        {matchupRows.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Head-to-Head Matchups</div>
            <DataTable
              data={matchupRows}
              columns={matchupColumns}
              defaultSorting={[{ id: 'total', desc: true }]}
              searchableColumns={['first', 'second']}
              maxHeight="calc(70vh - 108px)"
            />
          </div>
        )}
      </div>

      {/* All matches */}
      {sortedMatches.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>All Matches</div>
          <DataTable
            data={sortedMatches}
            columns={matchColumns}
            defaultSorting={[{ id: 'date', desc: true }]}
          />
        </div>
      )}
    </div>
  )
}
