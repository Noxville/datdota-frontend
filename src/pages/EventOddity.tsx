import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell } from '../components/DataTable'
import TableSkeleton from '../components/TableSkeleton'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import { formatDate } from '../utils/format'
import { MatchLink, LeagueCell } from './notableCells'
import styles from './Notable.module.css'

interface OddityRow {
  match_id: number
  league_id: number
  league_name: string
  start_date: string
  is_lan: boolean
  count: number
}

type Kind = 'divine-rapiers' | 'rampages'

const META: Record<Kind, {
  endpoint: string
  title: string
  subtitle: string
  description: string
  countHeader: string
  metaDescription: string
}> = {
  'divine-rapiers': {
    endpoint: '/api/events/divine-rapiers',
    title: 'Divine Rapiers',
    subtitle: 'Most Divine Rapiers purchased in a single game',
    description: 'The top 100 pro games ranked by number of Divine Rapiers bought (minimum 4).',
    countHeader: 'Rapiers',
    metaDescription: 'Pro Dota 2 games with the most Divine Rapiers ever purchased in a single match.',
  },
  rampages: {
    endpoint: '/api/events/rampages',
    title: 'Rampages',
    subtitle: 'Most rampages (five-kill multi-kills) in a single game',
    description: 'The top 50 pro games ranked by number of rampages (minimum 3).',
    countHeader: 'Rampages',
    metaDescription: 'Pro Dota 2 games with the most rampages (five-kill multi-kills) in a single match.',
  },
}

function getKind(pathname: string): Kind {
  return pathname.includes('rampages') ? 'rampages' : 'divine-rapiers'
}

function buildColumns(countHeader: string): ColumnDef<OddityRow, unknown>[] {
  const ch = createColumnHelper<OddityRow>()
  return [
    ch.accessor('match_id', {
      id: 'match_id',
      header: 'Match',
      size: 130,
      cell: ({ getValue }) => <MatchLink matchId={getValue()} />,
    }) as ColumnDef<OddityRow, unknown>,
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'League',
      size: 300,
      cell: ({ row }) => (
        <LeagueCell leagueId={row.original.league_id} leagueName={row.original.league_name} isLan={row.original.is_lan} />
      ),
    }) as ColumnDef<OddityRow, unknown>,
    ch.accessor('start_date', {
      id: 'start_date',
      header: 'Date',
      size: 120,
      cell: ({ getValue }) => <span>{formatDate(getValue())}</span>,
    }) as ColumnDef<OddityRow, unknown>,
    ch.accessor('count', {
      id: 'count',
      header: countHeader,
      size: 110,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: `${countHeader} in the game` },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<OddityRow, unknown>,
  ]
}

export default function EventOddity() {
  const { pathname } = useLocation()
  const kind = getKind(pathname)
  const meta = META[kind]

  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: OddityRow[] }>(meta.endpoint)

  const columns = useMemo(() => buildColumns(meta.countHeader), [meta.countHeader])
  const rows = raw?.data ?? []

  return (
    <div className={styles.page}>
      <PageMeta title={`Dota 2 ${meta.title}`} description={meta.metaDescription} />
      <div className={styles.header}>
        <h1>{meta.title}</h1>
        <p className={styles.subtitle}>{meta.subtitle}</p>
        <p className={styles.description}>{meta.description}</p>
      </div>

      {isLoading && <TableSkeleton columns={columns} rows={10} loaderText={`Loading ${meta.title.toLowerCase()}...`} />}

      {error && (
        <ErrorState
          message={`Failed to load ${meta.title.toLowerCase()}`}
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'count', desc: true }]}
          searchValue={(r) => [String(r.match_id), r.league_name].join(' ')}
        />
      )}
    </div>
  )
}
