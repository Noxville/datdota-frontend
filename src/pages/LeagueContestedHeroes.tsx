import { useEffect, useMemo, useState } from 'react'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell } from '../components/DataTable'
import TableSkeleton from '../components/TableSkeleton'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import HelpLabel from '../components/HelpLabel'
import { formatDate } from '../utils/format'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import styles from './Notable.module.css'

interface ContestedHero {
  hero_id: number
  contest_rate: number
}

interface ContestedRow {
  split_id: number
  league_name: string
  total_matches: number
  earliest: string
  latest: string
  contest_balance: number
  contested: ContestedHero[]
}

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function contestedNames(contested: ContestedHero[]): string {
  return contested.map((c) => heroName(c.hero_id)).join(' ')
}

/** Heroes with rate in [lo, hi), sorted by contest rate ascending. */
function bucket(contested: ContestedHero[], lo: number, hi: number): ContestedHero[] {
  return (contested ?? [])
    .filter((c) => c.contest_rate >= lo && c.contest_rate < hi)
    .sort((a, b) => a.contest_rate - b.contest_rate)
}

function ContestedHeroIcons({ contested }: { contested: ContestedHero[] }) {
  if (!contested || contested.length === 0) return <span className={styles.muted}>—</span>
  return (
    <span className={styles.heroRow}>
      {contested.map((c) => {
        const hero = heroesById[String(c.hero_id)]
        const name = heroName(c.hero_id)
        const label = `${name} — ${(c.contest_rate * 100).toFixed(1)}%`
        const isMax = c.contest_rate >= 1
        return hero?.picture ? (
          <img
            key={c.hero_id}
            src={heroImageUrl(hero.picture)}
            alt={name}
            title={label}
            className={`${styles.heroIcon} ${isMax ? styles.heroIconMax : ''}`}
            loading="lazy"
          />
        ) : (
          <span key={c.hero_id} className={styles.muted} title={label}>{name}</span>
        )
      })}
    </span>
  )
}

const HERO_ICON_STEP = 29 // 24px icon + 5px gap
const HERO_COL_PAD = 24

function heroColWidth(rows: ContestedRow[], lo: number, hi: number): number {
  let maxHeroes = 1
  for (const r of rows) maxHeroes = Math.max(maxHeroes, bucket(r.contested, lo, hi).length)
  return Math.max(150, maxHeroes * HERO_ICON_STEP + HERO_COL_PAD)
}

function buildColumns(w90: number, w95: number): ColumnDef<ContestedRow, unknown>[] {
  const ch = createColumnHelper<ContestedRow>()
  return [
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'Event / Split',
      size: 280,
      cell: ({ row }) => (
        <a
          href={`/drafts?splits=${row.original.split_id}`}
          className={styles.draftLink}
          title={`View drafts for ${row.original.league_name}`}
        >
          {row.original.league_name}
        </a>
      ),
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
    ch.accessor('contest_balance', {
      id: 'contest_balance',
      header: () => (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          Balance
          <a
            href="/glossary#contest-balance"
            target="_blank"
            rel="noreferrer"
            className={styles.headerHelp}
            title="What is Contest Balance? — opens the glossary"
            aria-label="What is Contest Balance? — opens the glossary"
            onClick={(e) => e.stopPropagation()}
          >
            ?
          </a>
        </span>
      ),
      size: 110,
      meta: {
        numeric: true,
        heatmap: 'high-good' as const,
        tooltip: 'Contest Balance — how evenly pick+ban attention was spread across the roster (1 = perfectly even, near 0 = a few heroes dominated)',
      },
      cell: ({ getValue }) => <NumericCell value={getValue()} decimals={3} />,
    }) as ColumnDef<ContestedRow, unknown>,
    ch.display({
      id: 'contested_90',
      header: 'Contested 90–95%',
      size: w90,
      enableSorting: false,
      cell: ({ row }) => <ContestedHeroIcons contested={bucket(row.original.contested, 0.9, 0.95)} />,
    }) as ColumnDef<ContestedRow, unknown>,
    ch.display({
      id: 'contested_95',
      header: 'Contested 95–100%',
      size: w95,
      enableSorting: false,
      cell: ({ row }) => <ContestedHeroIcons contested={bucket(row.original.contested, 0.95, Infinity)} />,
    }) as ColumnDef<ContestedRow, unknown>,
  ]
}

const MIN_GAMES_FLOOR = 25

function minGamesFromHash(): number {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const parsed = parseInt(params.get('min') ?? '', 10)
  return Number.isFinite(parsed) && parsed >= MIN_GAMES_FLOOR ? parsed : MIN_GAMES_FLOOR
}

export default function LeagueContestedHeroes() {
  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: ContestedRow[] }>(
    '/api/lan/contested-heroes',
  )

  const allRows = useMemo(() => raw?.data ?? [], [raw])
  const maxGames = useMemo(
    () => allRows.reduce((mx, r) => Math.max(mx, r.total_matches), 25),
    [allRows],
  )

  const [minGames, setMinGames] = useState(minGamesFromHash)

  useEffect(() => {
    const onHashChange = () => setMinGames(minGamesFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const updateMinGames = (value: number) => {
    setMinGames(value)
    const hash = value > MIN_GAMES_FLOOR ? `#min=${value}` : ''
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }

  const rows = useMemo(
    () => allRows.filter((r) => r.total_matches >= minGames),
    [allRows, minGames],
  )
  const columns = useMemo(
    () => buildColumns(heroColWidth(rows, 0.9, 0.95), heroColWidth(rows, 0.95, Infinity)),
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
        <p className={styles.subtitle}>Heroes picked or banned in almost every game of an event — LAN splits only</p>
        <p className={styles.description}>
          For each event/split with 25 or more drafted games, the heroes that were picked or banned in 90–95% and
          95–100% of that split's games — the near-mandatory heroes of the moment. Hover a hero for its exact
          contest rate; heroes contested in every game (100%) have a glowing aura.
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

      {!isLoading && !error && allRows.length > 0 && (
        <>
          <div className={styles.controlRow}>
            <HelpLabel text="Min games" tip="Only show events/splits with at least this many drafted games." />
            <input
              type="range"
              min={25}
              max={maxGames}
              value={Math.min(minGames, maxGames)}
              onChange={(e) => updateMinGames(Number(e.target.value))}
              className={styles.slider}
            />
            <span className={styles.controlValue}>{minGames}+</span>
            <span className={styles.controlCount}>{rows.length} events</span>
          </div>

          {rows.length > 0 ? (
            <DataTable
              data={rows}
              columns={columns}
              defaultSorting={[{ id: 'latest', desc: true }]}
              rowHeight={40}
              searchValue={(r) => [r.league_name, contestedNames(r.contested)].join(' ')}
            />
          ) : (
            <p className={styles.muted}>No events with {minGames}+ games.</p>
          )}
        </>
      )}
    </div>
  )
}
