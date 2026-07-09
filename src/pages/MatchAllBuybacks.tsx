import { useMemo } from 'react'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { teamLogoUrl } from '../config'
import DataTable, { TeamCell } from '../components/DataTable'
import TableSkeleton from '../components/TableSkeleton'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import { formatDate } from '../utils/format'
import { MatchLink, LeagueCell } from './notableCells'
import styles from './Notable.module.css'

interface BuybackPlayer {
  steam_id: string
  nickname: string
}

interface BuybackTeam {
  team_id: number
  team_name: string
  logo: string
  players: BuybackPlayer[]
}

interface BuybackRow {
  match_id: number
  league_id: number
  league_name: string
  start_date: string
  is_lan: boolean
  radiant: BuybackTeam
  dire: BuybackTeam
}

function PlayersCell({ players }: { players: BuybackPlayer[] }) {
  return (
    <span className={styles.playerList}>
      {players.map((p) => (
        <a key={p.steam_id} href={`/players/${p.steam_id}`} className={styles.playerLink}>
          {p.nickname}
        </a>
      ))}
    </span>
  )
}

function playersSearch(players: BuybackPlayer[]): string {
  return players.map((p) => p.nickname).join(' ')
}

const ch = createColumnHelper<BuybackRow>()

function buildColumns(): ColumnDef<BuybackRow, unknown>[] {
  return [
    ch.accessor('match_id', {
      id: 'match_id',
      header: 'Match',
      size: 130,
      cell: ({ getValue }) => <MatchLink matchId={getValue()} />,
    }) as ColumnDef<BuybackRow, unknown>,
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'League',
      size: 260,
      cell: ({ row }) => (
        <LeagueCell leagueId={row.original.league_id} leagueName={row.original.league_name} isLan={row.original.is_lan} />
      ),
    }) as ColumnDef<BuybackRow, unknown>,
    ch.accessor('start_date', {
      id: 'start_date',
      header: 'Date',
      size: 120,
      cell: ({ getValue }) => <span>{formatDate(getValue())}</span>,
    }) as ColumnDef<BuybackRow, unknown>,
    ch.display({
      id: 'radiant',
      header: 'Radiant',
      size: 190,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell
          valveId={row.original.radiant.team_id}
          name={row.original.radiant.team_name}
          logoUrl={teamLogoUrl(row.original.radiant.logo)}
        />
      ),
    }) as ColumnDef<BuybackRow, unknown>,
    ch.display({
      id: 'radiant_players',
      header: 'Radiant Five',
      size: 300,
      enableSorting: false,
      cell: ({ row }) => <PlayersCell players={row.original.radiant.players} />,
    }) as ColumnDef<BuybackRow, unknown>,
    ch.display({
      id: 'dire',
      header: 'Dire',
      size: 190,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamCell
          valveId={row.original.dire.team_id}
          name={row.original.dire.team_name}
          logoUrl={teamLogoUrl(row.original.dire.logo)}
        />
      ),
    }) as ColumnDef<BuybackRow, unknown>,
    ch.display({
      id: 'dire_players',
      header: 'Dire Five',
      size: 300,
      enableSorting: false,
      cell: ({ row }) => <PlayersCell players={row.original.dire.players} />,
    }) as ColumnDef<BuybackRow, unknown>,
  ]
}

export default function MatchAllBuybacks() {
  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: BuybackRow[] }>(
    '/api/matches/all-players-buyback',
  )

  const columns = useMemo(() => buildColumns(), [])
  const rows = raw?.data ?? []

  return (
    <div className={styles.page}>
      <PageMeta
        title="Dota 2 — All Ten Players Bought Back"
        description="Pro Dota 2 games where all ten players used at least two buybacks."
      />
      <div className={styles.header}>
        <h1>All-Buyback Games</h1>
        <p className={styles.subtitle}>Games where all ten players bought back at least twice</p>
        <p className={styles.description}>
          The rare high-stakes matches in which every single player on both teams spent at least two buybacks.
        </p>
      </div>

      {isLoading && <TableSkeleton columns={columns} rows={10} loaderText="Loading all-buyback games..." />}

      {error && (
        <ErrorState
          message="Failed to load all-buyback games"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'start_date', desc: true }]}
          rowHeight={44}
          searchValue={(r) =>
            [
              String(r.match_id),
              r.league_name,
              r.radiant.team_name,
              r.dire.team_name,
              playersSearch(r.radiant.players),
              playersSearch(r.dire.players),
            ].join(' ')
          }
        />
      )}
    </div>
  )
}
