import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './EntityShow.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface RecentMatch {
  matchId: number
  startDate: string
  channel: number
  leagueId: number
  leagueName: string
}

interface Cocaster {
  steam32: number
  nickname: string
  sharedGames: number
}

interface CasterData {
  steam32: number
  steam64: number
  nickname: string
  studio: { id: number; name: string }
  totalGames: number
  recentMatches: RecentMatch[]
  cocasters: Cocaster[]
}

/* ── Helpers ────────────────────────────────────────────── */

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── Recent Match columns ──────────────────────────────── */

const matchColumns: ColumnDef<RecentMatch, unknown>[] = [
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
    id: 'league',
    accessorKey: 'leagueName',
    header: 'League',
    size: 240,
    cell: ({ row }) => (
      <Link
        to={`/leagues/${row.original.leagueId}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.78rem' }}
      >
        {row.original.leagueName}
      </Link>
    ),
  },
  {
    id: 'date',
    accessorFn: (row) => new Date(row.startDate).getTime(),
    header: 'Date',
    size: 160,
    cell: ({ row }) => (
      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
        {formatDateTime(row.original.startDate)}
      </span>
    ),
  },
  {
    id: 'channel',
    accessorKey: 'channel',
    header: 'Ch',
    size: 45,
    meta: { numeric: true, tooltip: 'Broadcast Channel' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

/* ── Cocaster columns ──────────────────────────────────── */

const cocasterColumns: ColumnDef<Cocaster, unknown>[] = [
  {
    id: 'nickname',
    accessorKey: 'nickname',
    header: 'Caster',
    size: 200,
    cell: ({ row }) => (
      <Link
        to={`/casters/${row.original.steam32}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {row.original.nickname}
      </Link>
    ),
  },
  {
    id: 'sharedGames',
    accessorKey: 'sharedGames',
    header: 'Shared Games',
    size: 110,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Games cast together' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

/* ── Page component ─────────────────────────────────────── */

export default function CasterShow() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error, refetch } = useApiQuery<{ data: CasterData }>(
    id ? `/api/casters/${id}` : null,
  )

  const caster = data?.data

  const sortedMatches = useMemo(() => {
    if (!caster?.recentMatches) return []
    return [...caster.recentMatches].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    )
  }, [caster?.recentMatches])

  const sortedCocasters = useMemo(() => {
    if (!caster?.cocasters) return []
    return [...caster.cocasters].sort((a, b) => b.sharedGames - a.sharedGames)
  }, [caster?.cocasters])

  const leagueCount = useMemo(() => {
    if (!caster?.recentMatches) return 0
    return new Set(caster.recentMatches.map((m) => m.leagueId)).size
  }, [caster?.recentMatches])

  if (isLoading) return <div className={styles.page}><EnigmaLoader text="Loading caster..." /></div>

  if (error || !caster) {
    return (
      <div className={styles.page}>
        <ErrorState
          message="Failed to load caster"
          detail="Could not fetch caster data."
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
        <div className={styles.headerLogoPlaceholder}>
          {caster.nickname.charAt(0).toUpperCase()}
        </div>
        <div className={styles.headerInfo}>
          <h1>{caster.nickname}</h1>
          <div className={styles.headerMeta}>
            <span>{caster.studio.name}</span>
            <a
              href={`https://steamcommunity.com/profiles/${caster.steam64}`}
              target="_blank"
              rel="noreferrer"
            >
              Steam Profile
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.section}>
        <div className={styles.ratingsGrid}>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Games Cast</div>
            <div className={styles.ratingValue}>{caster.totalGames.toLocaleString()}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Co-casters</div>
            <div className={styles.ratingValue}>{caster.cocasters.length}</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingType}>Leagues</div>
            <div className={styles.ratingValue}>{leagueCount}</div>
          </div>
        </div>
      </div>

      {/* Recent Games (left) + Cocasters (right) */}
      <div className={styles.columns}>
        {sortedMatches.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Recent Games</div>
            <DataTable
              data={sortedMatches}
              columns={matchColumns}
              defaultSorting={[{ id: 'date', desc: true }]}
              searchableColumns={['league']}
            />
          </div>
        )}

        {sortedCocasters.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Frequent Co-casters</div>
            <DataTable
              data={sortedCocasters}
              columns={cocasterColumns}
              defaultSorting={[{ id: 'sharedGames', desc: true }]}
              searchableColumns={['nickname']}
            />
          </div>
        )}
      </div>
    </div>
  )
}
