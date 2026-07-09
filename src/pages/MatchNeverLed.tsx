import { useMemo } from 'react'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell } from '../components/DataTable'
import TableSkeleton from '../components/TableSkeleton'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import { fmtTime, formatDate } from '../utils/format'
import { MatchLink, LeagueCell } from './notableCells'
import styles from './Notable.module.css'

interface NeverLedRow {
  match_id: number
  league_id: number
  league_name: string
  start_date: string
  duration: number
  is_lan: boolean
  winner_team_id: number
  winner_team_name: string
  loser_team_id: number
  loser_team_name: string
  max_winner_deficit: number
  winner_lead_series: number[]
}

function TeamNameLink({ teamId, name, kind }: { teamId: number; name: string; kind: 'win' | 'loss' }) {
  return (
    <a href={`/teams/${teamId}`} className={`${styles.teamLink} ${kind === 'win' ? styles.win : styles.loss}`}>
      {name}
    </a>
  )
}

function LeadSparkline({ series, maxDeficit }: { series: number[]; maxDeficit: number }) {
  if (!series || series.length === 0) return <span className={styles.muted}>—</span>
  const w = 150
  const h = 30
  const pad = 3
  const min = Math.min(...series, 0)
  const max = Math.max(...series, 0)
  const range = max - min || 1
  const stepX = (w - pad * 2) / Math.max(series.length - 1, 1)
  const x = (i: number) => pad + i * stepX
  const y = (v: number) => pad + ((max - v) / range) * (h - pad * 2)
  const zeroY = y(0)
  const linePath = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const areaPath = `M${x(0).toFixed(1)},${zeroY.toFixed(1)} ${series
    .map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')} L${x(series.length - 1).toFixed(1)},${zeroY.toFixed(1)} Z`
  return (
    <svg
      width={w}
      height={h}
      className={styles.spark}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Net worth lead over time; overcame a deficit of ${maxDeficit.toLocaleString()} gold`}
    >
      <title>{`Overcame a ${maxDeficit.toLocaleString()} gold deficit (line = winner net-worth lead, below the dashed zero line = behind)`}</title>
      <path d={areaPath} className={styles.sparkArea} />
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} className={styles.sparkZero} />
      <path d={linePath} className={styles.sparkLine} />
    </svg>
  )
}

const ch = createColumnHelper<NeverLedRow>()

function buildColumns(): ColumnDef<NeverLedRow, unknown>[] {
  return [
    ch.accessor('match_id', {
      id: 'match_id',
      header: 'Match',
      size: 130,
      cell: ({ getValue }) => <MatchLink matchId={getValue()} />,
    }) as ColumnDef<NeverLedRow, unknown>,
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'League',
      size: 240,
      cell: ({ row }) => (
        <LeagueCell leagueId={row.original.league_id} leagueName={row.original.league_name} isLan={row.original.is_lan} />
      ),
    }) as ColumnDef<NeverLedRow, unknown>,
    ch.accessor('start_date', {
      id: 'start_date',
      header: 'Date',
      size: 115,
      cell: ({ getValue }) => <span>{formatDate(getValue())}</span>,
    }) as ColumnDef<NeverLedRow, unknown>,
    ch.accessor('winner_team_name', {
      id: 'winner_team_name',
      header: 'Winner',
      size: 175,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamNameLink teamId={row.original.winner_team_id} name={row.original.winner_team_name} kind="win" />
      ),
    }) as ColumnDef<NeverLedRow, unknown>,
    ch.accessor('loser_team_name', {
      id: 'loser_team_name',
      header: 'Loser',
      size: 175,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamNameLink teamId={row.original.loser_team_id} name={row.original.loser_team_name} kind="loss" />
      ),
    }) as ColumnDef<NeverLedRow, unknown>,
    ch.accessor('max_winner_deficit', {
      id: 'max_winner_deficit',
      header: 'Deficit Overcome',
      size: 140,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Largest net-worth deficit the winner overcame' },
      cell: ({ getValue }) => <NumericCell value={getValue()} compact />,
    }) as ColumnDef<NeverLedRow, unknown>,
    ch.accessor('duration', {
      id: 'duration',
      header: 'Duration',
      size: 100,
      meta: { numeric: true },
      cell: ({ getValue }) => <span>{fmtTime(getValue())}</span>,
    }) as ColumnDef<NeverLedRow, unknown>,
    ch.display({
      id: 'lead',
      header: 'Net Worth Lead',
      size: 170,
      enableSorting: false,
      cell: ({ row }) => (
        <LeadSparkline series={row.original.winner_lead_series} maxDeficit={row.original.max_winner_deficit} />
      ),
    }) as ColumnDef<NeverLedRow, unknown>,
  ]
}

export default function MatchNeverLed() {
  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: NeverLedRow[] }>('/api/matches/never-led')

  const columns = useMemo(() => buildColumns(), [])
  const rows = raw?.data ?? []

  return (
    <div className={styles.page}>
      <PageMeta
        title="Dota 2 — Wins Without Ever Leading"
        description="Pro Dota 2 games won by a team that never held a net-worth lead, ranked by the biggest gold deficit overcome."
      />
      <div className={styles.header}>
        <h1>Never-Led Wins</h1>
        <p className={styles.subtitle}>Games won by a team that never held a net-worth lead</p>
        <p className={styles.description}>
          The ultimate grinds — matches won without the winner ever being ahead on net worth, ranked by the biggest gold
          deficit they clawed back from. The sparkline traces the winner's net-worth lead per minute (below the dashed
          line = behind).
        </p>
      </div>

      {isLoading && <TableSkeleton columns={columns} rows={10} loaderText="Loading never-led wins..." />}

      {error && (
        <ErrorState
          message="Failed to load never-led wins"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'max_winner_deficit', desc: true }]}
          rowHeight={44}
          searchValue={(r) =>
            [String(r.match_id), r.league_name, r.winner_team_name, r.loser_team_name].join(' ')
          }
        />
      )}
    </div>
  )
}
