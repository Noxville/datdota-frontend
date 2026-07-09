import { useMemo } from 'react'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell } from '../components/DataTable'
import TableSkeleton from '../components/TableSkeleton'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import { formatDate } from '../utils/format'
import { heroesById } from '../data/heroes'
import { LeagueCell, HeroIcons } from './notableCells'
import styles from './Notable.module.css'

function heroNames(heroIds: number[]): string {
  return heroIds.map((id) => heroesById[String(id)]?.name ?? `Hero ${id}`).join(' ')
}

interface ContestedRow {
  split_id: number
  league_name: string
  total_matches: number
  earliest: string
  latest: string
  contested_90: number[]
  contested_95: number[]
}

const HERO_ICON_STEP = 29 // 24px icon + 5px gap
const HERO_COL_PAD = 24

function heroColWidth(rows: ContestedRow[], key: 'contested_90' | 'contested_95'): number {
  let maxHeroes = 1
  for (const r of rows) maxHeroes = Math.max(maxHeroes, r[key].length)
  return Math.max(150, maxHeroes * HERO_ICON_STEP + HERO_COL_PAD)
}

function buildColumns(w90: number, w95: number): ColumnDef<ContestedRow, unknown>[] {
  const ch = createColumnHelper<ContestedRow>()
  return [
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'Event / Split',
      size: 280,
      cell: ({ getValue }) => <LeagueCell leagueName={getValue()} isLan={false} />,
    }) as ColumnDef<ContestedRow, unknown>,
    ch.accessor('total_matches', {
      id: 'total_matches',
      header: 'Games',
      size: 90,
      meta: { numeric: true, tooltip: 'Games in the split' },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<ContestedRow, unknown>,
    ch.accessor('latest', {
      id: 'latest',
      header: 'Dates',
      size: 210,
      cell: ({ row }) => (
        <span className={styles.dateRange}>
          {formatDate(row.original.earliest)} – {formatDate(row.original.latest)}
        </span>
      ),
    }) as ColumnDef<ContestedRow, unknown>,
    ch.display({
      id: 'contested_90',
      header: 'Contested 90–95%',
      size: w90,
      enableSorting: false,
      cell: ({ row }) => <HeroIcons heroIds={row.original.contested_90} />,
    }) as ColumnDef<ContestedRow, unknown>,
    ch.display({
      id: 'contested_95',
      header: 'Contested 95–100%',
      size: w95,
      enableSorting: false,
      cell: ({ row }) => <HeroIcons heroIds={row.original.contested_95} />,
    }) as ColumnDef<ContestedRow, unknown>,
  ]
}

export default function LeagueContestedHeroes() {
  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: ContestedRow[] }>(
    '/api/lan/contested-heroes',
  )

  const rows = useMemo(() => raw?.data ?? [], [raw])
  const columns = useMemo(
    () => buildColumns(heroColWidth(rows, 'contested_90'), heroColWidth(rows, 'contested_95')),
    [rows],
  )

  return (
    <div className={styles.page}>
      <PageMeta
        title="Dota 2 — Most Contested Heroes by Event"
        description="Heroes picked or banned in 90%+ of a pro event's games — the most contested heroes per LAN/split."
      />
      <div className={styles.header}>
        <h1>Contested Heroes by Event</h1>
        <p className={styles.subtitle}>Heroes picked or banned in almost every game of an event</p>
        <p className={styles.description}>
          For each event/split with 25 or more drafted games, the heroes that were picked or banned in 90–95% and
          95–100% of that split's games — the near-mandatory heroes of the moment.
        </p>
      </div>

      {isLoading && <TableSkeleton columns={columns} rows={10} loaderText="Loading contested heroes..." />}

      {error && (
        <ErrorState
          message="Failed to load contested heroes"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'latest', desc: true }]}
          rowHeight={40}
          searchValue={(r) =>
            [r.league_name, heroNames(r.contested_90), heroNames(r.contested_95)].join(' ')
          }
        />
      )}
    </div>
  )
}
