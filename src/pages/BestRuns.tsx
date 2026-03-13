import { useCallback, useEffect, useMemo, useState } from 'react'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { teamLogoUrl } from '../config'
import DataTable, { NumericCell, TeamCell, PercentCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './BestRuns.module.css'

interface TeamRun {
  teamId: number
  teamName: string
  teamLogoId: string | null
  wins: number
  firstDate: string
  lastDate: string
}

interface RunRow extends TeamRun {
  rank: number
  losses: number
  winPct: number
  windowSize: number
}

type ApiResponse = {
  data: Record<string, { teamRuns: TeamRun[] }>
}

const RUN_LENGTHS = [50, 75, 100, 150]

function getInitialWindow(): number {
  const hash = window.location.hash.replace('#', '')
  const parsed = parseInt(hash, 10)
  if (RUN_LENGTHS.includes(parsed)) return parsed
  return RUN_LENGTHS[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format date as dd/MM/yyyy HH:mm:ss for datdota matchfinder params */
function toMatchfinderDate(iso: string, offsetSeconds: number): string {
  const d = new Date(iso)
  d.setSeconds(d.getSeconds() + offsetSeconds)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const HH = String(d.getUTCHours()).padStart(2, '0')
  const MM = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${ss}`
}

function matchfinderUrl(teamId: number, firstDate: string, lastDate: string): string {
  const after = toMatchfinderDate(firstDate, 7199)
  const before = toMatchfinderDate(lastDate, 7201)
  return `https://datdota.com/matchfinder/classic?team-a=${teamId}&after=${after}&before=${before}&tier=1,2`
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
    ch.accessor('teamName', {
      id: 'teamName',
      header: 'Team',
      size: 220,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell
          valveId={row.original.teamId}
          name={row.original.teamName}
          logoUrl={row.original.teamLogoId ? teamLogoUrl(row.original.teamLogoId) : undefined}
        />
      ),
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
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: `Wins in ${windowSize} game window` },
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
      header: 'Matches',
      size: 100,
      cell: ({ row }) => (
        <a
          href={matchfinderUrl(row.original.teamId, row.original.firstDate, row.original.lastDate)}
          target="_blank"
          rel="noreferrer"
          className={styles.matchesLink}
        >
          View &#8599;
        </a>
      ),
    }) as ColumnDef<RunRow, unknown>,
  ]
}

export default function BestRuns() {
  const [activeWindow, setActiveWindow] = useState(getInitialWindow)

  const selectWindow = useCallback((len: number) => {
    setActiveWindow(len)
    window.location.hash = `#${len}`
  }, [])

  // Listen for back/forward hash changes
  useEffect(() => {
    function onHashChange() {
      const parsed = parseInt(window.location.hash.replace('#', ''), 10)
      if (RUN_LENGTHS.includes(parsed)) setActiveWindow(parsed)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const { data: raw, isLoading, error, refetch } = useApiQuery<ApiResponse>(
    '/api/trivia/best-runs',
  )

  const columns = useMemo(() => buildColumns(activeWindow), [activeWindow])

  const rows: RunRow[] = useMemo(() => {
    if (!raw?.data) return []
    const teamRuns = raw.data[String(activeWindow)]?.teamRuns ?? []
    return teamRuns.map((tr, i) => ({
      ...tr,
      rank: i + 1,
      losses: activeWindow - tr.wins,
      winPct: tr.wins / activeWindow,
      windowSize: activeWindow,
    }))
  }, [raw, activeWindow])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Best Runs</h1>
        <p className={styles.subtitle}>
          Most games won within a fixed number of consecutive matches in tier 1–2 events
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

      {isLoading && <EnigmaLoader text="Loading best runs..." />}

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
          searchableColumns={['teamName']}
        />
      )}
    </div>
  )
}
