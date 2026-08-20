import { useCallback, useEffect, useMemo, useState } from 'react'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import TableSkeleton from '../components/TableSkeleton'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import styles from './BestRuns.module.css'

interface PlayerHeroRun {
  steamId: number
  nickname: string
  heroId: number
  wins: number
  games: number
  firstMatch: number
  lastMatch: number
  firstDate: string
  lastDate: string
}

interface RunRow extends PlayerHeroRun {
  rank: number
  losses: number
  winPct: number
}

type ApiResponse = {
  data: Record<string, { playerHeroRuns: PlayerHeroRun[] }>
}

const RUN_LENGTHS = [25, 50, 75, 100, 150]

function getInitialWindow(): number {
  const parsed = parseInt(window.location.hash.replace('#', ''), 10)
  return RUN_LENGTHS.includes(parsed) ? parsed : RUN_LENGTHS[0]
}

function formatDate(iso: string): string {
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

function buildColumns(windowSize: number) {
  const ch = createColumnHelper<RunRow>()
  return [
    ch.accessor('rank', {
      id: 'rank',
      header: '#',
      size: 50,
      meta: { numeric: true },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
      enableSorting: false,
    }) as ColumnDef<RunRow, unknown>,
    ch.accessor('nickname', {
      id: 'nickname',
      header: 'Player',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <a href={`/players/${row.original.steamId}`} className={styles.matchesLink}>
          {row.original.nickname}
        </a>
      ),
    }) as ColumnDef<RunRow, unknown>,
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
    }) as ColumnDef<RunRow, unknown>,
    ch.accessor('firstDate', {
      id: 'firstDate',
      header: 'Start',
      size: 130,
      cell: ({ getValue }) => (
        <span className={styles.dateCell}>{formatDate(getValue())}</span>
      ),
    }) as ColumnDef<RunRow, unknown>,
    ch.accessor('lastDate', {
      id: 'lastDate',
      header: 'End',
      size: 130,
      cell: ({ getValue }) => (
        <span className={styles.dateCell}>{formatDate(getValue())}</span>
      ),
    }) as ColumnDef<RunRow, unknown>,
    ch.accessor('wins', {
      id: 'wins',
      header: 'Wins',
      size: 80,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: `Wins in a ${windowSize}-game window on this hero` },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<RunRow, unknown>,
    ch.accessor('losses', {
      id: 'losses',
      header: 'Losses',
      size: 80,
      meta: { numeric: true, heatmap: 'high-bad' as const },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<RunRow, unknown>,
    ch.accessor('winPct', {
      id: 'winPct',
      header: 'Win %',
      size: 120,
      meta: { numeric: true },
      cell: ({ getValue }) => <PercentCell value={getValue()} />,
    }) as ColumnDef<RunRow, unknown>,
    ch.display({
      id: 'matches',
      header: 'Run',
      size: 120,
      cell: ({ row }) => (
        <span>
          <a href={`/matches/${row.original.firstMatch}`} className={styles.matchesLink}>First</a>
          <span className={styles.dateCell}> · </span>
          <a href={`/matches/${row.original.lastMatch}`} className={styles.matchesLink}>Last</a>
        </span>
      ),
    }) as ColumnDef<RunRow, unknown>,
  ]
}

export default function PlayerHeroRuns() {
  const [activeWindow, setActiveWindow] = useState(getInitialWindow)

  const selectWindow = useCallback((len: number) => {
    setActiveWindow(len)
    window.location.hash = `#${len}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const parsed = parseInt(window.location.hash.replace('#', ''), 10)
      if (RUN_LENGTHS.includes(parsed)) setActiveWindow(parsed)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const { data: raw, isLoading, error, refetch } = useApiQuery<ApiResponse>(
    '/api/trivia/player-hero-runs/best',
  )

  const columns = useMemo(() => buildColumns(activeWindow), [activeWindow])

  const rows: RunRow[] = useMemo(() => {
    if (!raw?.data) return []
    const runs = raw.data[String(activeWindow)]?.playerHeroRuns ?? []
    return runs.map((r, i) => ({
      ...r,
      rank: i + 1,
      losses: r.games - r.wins,
      winPct: r.games > 0 ? r.wins / r.games : 0,
    }))
  }, [raw, activeWindow])

  return (
    <div className={styles.page}>
      <PageMeta title="Best Player-Hero Win Runs — Pro Dota 2" description="Most wins a pro Dota 2 player has racked up within a fixed window of consecutive games on a single hero." />
      <div className={styles.header}>
        <h1>Best Player-Hero Runs</h1>
        <p className={styles.subtitle}>
          Most games won within a fixed number of consecutive matches on a single hero, in tier 1–2 events
        </p>
      </div>

      <div className={styles.toggleRow}>
        {RUN_LENGTHS.map((len) => (
          <button
            key={len}
            className={`${styles.toggleBtn} ${activeWindow === len ? styles.toggleActive : ''}`}
            onClick={() => selectWindow(len)}
          >
            {len} games
          </button>
        ))}
      </div>

      {isLoading && <TableSkeleton columns={columns} rows={10} loaderText="Loading best runs..." />}

      {error && (
        <ErrorState
          message="Failed to load best runs"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'wins', desc: true }]}
          searchValue={(r) => [
            r.nickname,
            String(r.steamId),
            heroName(r.heroId),
            String(r.heroId),
          ].join(' ')}
          rowHeight={44}
        />
      )}
    </div>
  )
}
