import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell, PercentCell, PlayerCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import type { Rivalry } from '../types'
import styles from './PlayerPerformances.module.css'

interface RivalryRow extends Rivalry {
  aWinPct: number
  bWinPct: number
  winShift: number
}

const columns: ColumnDef<RivalryRow, unknown>[] = [
  {
    id: 'playerA',
    accessorFn: (row) => row.a_nickname,
    header: 'Player A',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={Number(row.original.a_steam_id)} nickname={row.original.a_nickname} />
    ),
  },
  {
    id: 'aWins',
    accessorKey: 'a_wins',
    header: 'W(A)',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins for Player A' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'aWinPct',
    accessorKey: 'aWinPct',
    header: 'A %',
    size: 75,
    meta: { numeric: true, tooltip: 'Win rate for Player A' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'winShift',
    accessorKey: 'winShift',
    header: 'Shift',
    size: 75,
    meta: { numeric: true, tooltip: 'Win % difference (A − B)' },
    cell: ({ getValue }) => {
      const v = getValue() as number
      const pct = (v * 100).toFixed(1)
      const color = v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-muted)'
      return (
        <span style={{ color, fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}>
          {v > 0 ? '+' : ''}{pct}%
        </span>
      )
    },
  },
  {
    id: 'bWinPct',
    accessorKey: 'bWinPct',
    header: 'B %',
    size: 75,
    meta: { numeric: true, tooltip: 'Win rate for Player B' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'bWins',
    accessorKey: 'b_wins',
    header: 'W(B)',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins for Player B' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'playerB',
    accessorFn: (row) => row.b_nickname,
    header: 'Player B',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={Number(row.original.b_steam_id)} nickname={row.original.b_nickname} />
    ),
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total games between pair' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

export default function PlayerRivalries() {
  const { data, isLoading, error, refetch } = useApiQuery<{ data: Rivalry[] }>(
    '/api/players/rivalries',
  )

  const rows: RivalryRow[] = useMemo(() => {
    if (!data?.data) return []
    return data.data.map((r) => ({
      ...r,
      aWinPct: r.games > 0 ? r.a_wins / r.games : 0,
      bWinPct: r.games > 0 ? r.b_wins / r.games : 0,
      winShift: r.games > 0 ? (r.a_wins - r.b_wins) / r.games : 0,
    }))
  }, [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Player Rivalries</h1>
        <p className={styles.subtitle}>
          Head-to-head records between players with 50+ games against each other in tier 1–2 matches
        </p>
      </div>

      {isLoading && <EnigmaLoader text="Fetching rivalry data..." />}

      {error && (
        <ErrorState
          message="Failed to load rivalries"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'games', desc: true }]}
          searchableColumns={['playerA', 'playerB']}
        />
      )}
    </div>
  )
}
