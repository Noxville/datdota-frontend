import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './TeamStreaks.module.css'

interface Streak {
  steamId: number
  playerName: string
  heroId: number
  startDate: string
  endDate: string | null
  lostToTeamId: number | null
  lostToTeamName: string | null
  matches: number[]
  stillRunning: boolean
}

interface StreakRow extends Streak {
  rank: number
  streakLength: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPicture(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

const ch = createColumnHelper<StreakRow>()

function buildColumns(type: 'best' | 'worst'): ColumnDef<StreakRow, unknown>[] {
  return [
    ch.accessor('rank', {
      id: 'rank',
      header: '#',
      size: 50,
      meta: { numeric: true },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      enableSorting: false,
    }) as ColumnDef<StreakRow, unknown>,
    ch.accessor('playerName', {
      id: 'playerName',
      header: 'Player',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <a href={`/players/${row.original.steamId}`} className={styles.matchLink}>
          {row.original.playerName}
        </a>
      ),
    }) as ColumnDef<StreakRow, unknown>,
    ch.accessor('heroId', {
      id: 'heroId',
      header: 'Hero',
      size: 200,
      enableSorting: false,
      cell: ({ getValue }) => {
        const id = getValue() as number
        const pic = heroPicture(id)
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {pic && (
              <img
                src={heroImageUrl(pic)}
                alt=""
                style={{ height: 20, width: 'auto', flexShrink: 0 }}
                loading="lazy"
              />
            )}
            <span>{heroName(id)}</span>
          </span>
        )
      },
    }) as ColumnDef<StreakRow, unknown>,
    ch.accessor('streakLength', {
      id: 'streakLength',
      header: 'Streak',
      size: 75,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Consecutive wins/losses' },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    }) as ColumnDef<StreakRow, unknown>,
    ch.accessor('startDate', {
      id: 'startDate',
      header: 'Start',
      size: 130,
      cell: ({ getValue }) => (
        <span className={styles.dateCell}>{formatDate(getValue() as string)}</span>
      ),
    }) as ColumnDef<StreakRow, unknown>,
    ch.accessor('endDate', {
      id: 'endDate',
      header: 'End',
      size: 130,
      cell: ({ row }) => (
        <span className={styles.dateCell}>
          {row.original.stillRunning ? (
            <span className={styles.ongoing}>Ongoing</span>
          ) : (
            formatDate(row.original.endDate)
          )}
        </span>
      ),
    }) as ColumnDef<StreakRow, unknown>,
    ch.accessor('lostToTeamName', {
      id: 'lostTo',
      header: type === 'best' ? 'Lost To' : 'Won Against',
      size: 180,
      cell: ({ row }) => {
        const { lostToTeamId, lostToTeamName, stillRunning } = row.original
        if (stillRunning || !lostToTeamId || !lostToTeamName) {
          return <span className={styles.muted}>—</span>
        }
        return (
          <a href={`/teams/${lostToTeamId}`} className={styles.matchLink}>
            {lostToTeamName}
          </a>
        )
      },
    }) as ColumnDef<StreakRow, unknown>,
    ch.accessor('matches', {
      id: 'matches',
      header: 'Matches',
      size: 200,
      meta: { grow: true },
      enableSorting: false,
      cell: ({ getValue }) => {
        const matches = getValue() as number[]
        return (
          <span className={styles.matchList}>
            {matches.map((matchId, i) => (
              <span key={matchId}>
                {i > 0 && <span className={styles.matchSep}>, </span>}
                <a href={`/matches/${matchId}`} className={styles.matchLink}>
                  #{i + 1}
                </a>
              </span>
            ))}
          </span>
        )
      },
    }) as ColumnDef<StreakRow, unknown>,
  ]
}

interface ApiResponse {
  data: {
    streaks: Streak[]
    maxStreaks: number
  }
}

export default function PlayerHeroStreaks() {
  const { type = 'best' } = useParams<{ type: string }>()
  const isBest = type === 'best'

  const { data: raw, isLoading, error, refetch } = useApiQuery<ApiResponse>(
    `/api/trivia/player-hero-streaks/${type}`,
  )

  const columns = useMemo(() => buildColumns(isBest ? 'best' : 'worst'), [isBest])

  const rows: StreakRow[] = useMemo(() => {
    if (!raw?.data?.streaks) return []
    return raw.data.streaks.map((s, i) => ({
      ...s,
      rank: i + 1,
      streakLength: s.matches.length,
    }))
  }, [raw])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{isBest ? 'Best' : 'Worst'} Player-Hero Streaks</h1>
        <p className={styles.subtitle}>
          {isBest
            ? 'Most consecutive wins on a single hero in tier 1–2 matches'
            : 'Most consecutive losses on a single hero in tier 1–2 matches'}
        </p>
      </div>

      <div className={styles.toggleRow}>
        <a
          href="/trivia/player-hero-streaks/best"
          className={`${styles.toggleBtn} ${isBest ? styles.toggleActive : ''}`}
        >
          Best
        </a>
        <a
          href="/trivia/player-hero-streaks/worst"
          className={`${styles.toggleBtn} ${!isBest ? styles.toggleActive : ''}`}
        >
          Worst
        </a>
      </div>

      {isLoading && <EnigmaLoader text="Loading streaks..." />}

      {error && (
        <ErrorState
          message="Failed to load streaks"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'streakLength', desc: true }]}
          searchableColumns={['playerName']}
          rowHeight={60}
        />
      )}
    </div>
  )
}
