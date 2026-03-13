import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './TriviaAward.module.css'

/* ── Award definitions ──────────────────────────────────── */

interface AkkeEntry {
  matchId: number
  steamId: number
  nickname: string
  leagueName: string
  leagueId: number
  hero: number
  lastHits: number
}

interface CtyEntry {
  matchId: number
  steamId: number
  nickname: string
  leagueName: string
  leagueId: number
  hero: number
  win: boolean
}

interface MaelkEntry {
  matchId: number
  steamId: number
  nickname: string
  leagueName: string
  leagueId: number
  hero: number
  deaths: number
  assists: number
}

type AwardEntry = AkkeEntry | CtyEntry | MaelkEntry
type AwardType = 'akke' | 'cty' | 'maelk'

const AWARD_META: Record<AwardType, {
  title: string
  subtitle: string
  description: string
}> = {
  akke: {
    title: 'The Akke Award',
    subtitle: 'Win a tier 1 match with minimal last hits',
    description: 'Named after Akke, who won a match at TI6 with 0 last hits. Shows all tier 1 matches won with ≤2 last hits.',
  },
  cty: {
    title: 'The Cty Award',
    subtitle: 'Finish a match with a perfect 0/0/0 KDA',
    description: 'Named after Cty\'s 0/0/0 game at Perfect World Masters. Shows all tier 1–2 matches with exactly 0 kills, 0 deaths, and 0 assists.',
  },
  maelk: {
    title: 'The Maelk Award',
    subtitle: 'Win with the most deaths and 0 kills',
    description: 'Named after Maelk\'s legendary 0/20/21 Venomancer win. Shows tier 1–2 matches won with 0 kills, sorted by most deaths.',
  },
}

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPicture(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

function HeroCell({ heroId }: { heroId: number }) {
  const pic = heroPicture(heroId)
  return (
    <span className={styles.heroCell}>
      {pic && (
        <img
          src={heroImageUrl(pic)}
          alt=""
          className={styles.heroImg}
          loading="lazy"
        />
      )}
      <span>{heroName(heroId)}</span>
    </span>
  )
}

/* ── Column builders ────────────────────────────────────── */

function buildAkkeColumns() {
  const ch = createColumnHelper<AkkeEntry>()
  return [
    ch.accessor('matchId', {
      id: 'matchId',
      header: 'Match',
      size: 140,
      cell: ({ getValue }) => (
        <a href={`/matches/${getValue()}`} className={styles.link}>{getValue()}</a>
      ),
    }) as ColumnDef<AkkeEntry, unknown>,
    ch.accessor('nickname', {
      id: 'nickname',
      header: 'Player',
      size: 200,
      cell: ({ row }) => (
        <a href={`/players/${row.original.steamId}`} className={styles.link}>
          {row.original.nickname}
        </a>
      ),
    }) as ColumnDef<AkkeEntry, unknown>,
    ch.accessor('hero', {
      id: 'hero',
      header: 'Hero',
      size: 220,
      cell: ({ getValue }) => <HeroCell heroId={getValue()} />,
    }) as ColumnDef<AkkeEntry, unknown>,
    ch.accessor('leagueName', {
      id: 'leagueName',
      header: 'League',
      size: 320,
      cell: ({ row }) => (
        <a href={`/leagues/${row.original.leagueId}`} className={styles.leagueLink}>
          {row.original.leagueName}
        </a>
      ),
    }) as ColumnDef<AkkeEntry, unknown>,
    ch.accessor('lastHits', {
      id: 'lastHits',
      header: 'Last Hits',
      size: 110,
      meta: { numeric: true, heatmap: 'high-bad' as const, tooltip: 'Last hits in the match' },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<AkkeEntry, unknown>,
  ]
}

function buildCtyColumns() {
  const ch = createColumnHelper<CtyEntry>()
  return [
    ch.accessor('matchId', {
      id: 'matchId',
      header: 'Match',
      size: 140,
      cell: ({ getValue }) => (
        <a href={`/matches/${getValue()}`} className={styles.link}>{getValue()}</a>
      ),
    }) as ColumnDef<CtyEntry, unknown>,
    ch.accessor('nickname', {
      id: 'nickname',
      header: 'Player',
      size: 200,
      cell: ({ row }) => (
        <a href={`/players/${row.original.steamId}`} className={styles.link}>
          {row.original.nickname}
        </a>
      ),
    }) as ColumnDef<CtyEntry, unknown>,
    ch.accessor('hero', {
      id: 'hero',
      header: 'Hero',
      size: 220,
      cell: ({ getValue }) => <HeroCell heroId={getValue()} />,
    }) as ColumnDef<CtyEntry, unknown>,
    ch.accessor('leagueName', {
      id: 'leagueName',
      header: 'League',
      size: 320,
      cell: ({ row }) => (
        <a href={`/leagues/${row.original.leagueId}`} className={styles.leagueLink}>
          {row.original.leagueName}
        </a>
      ),
    }) as ColumnDef<CtyEntry, unknown>,
    ch.accessor('win', {
      id: 'win',
      header: 'Result',
      size: 100,
      cell: ({ getValue }) => (
        <span className={getValue() ? styles.win : styles.loss}>
          {getValue() ? 'Win' : 'Loss'}
        </span>
      ),
    }) as ColumnDef<CtyEntry, unknown>,
  ]
}

function buildMaelkColumns() {
  const ch = createColumnHelper<MaelkEntry>()
  return [
    ch.accessor('matchId', {
      id: 'matchId',
      header: 'Match',
      size: 140,
      cell: ({ getValue }) => (
        <a href={`/matches/${getValue()}`} className={styles.link}>{getValue()}</a>
      ),
    }) as ColumnDef<MaelkEntry, unknown>,
    ch.accessor('nickname', {
      id: 'nickname',
      header: 'Player',
      size: 200,
      cell: ({ row }) => (
        <a href={`/players/${row.original.steamId}`} className={styles.link}>
          {row.original.nickname}
        </a>
      ),
    }) as ColumnDef<MaelkEntry, unknown>,
    ch.accessor('hero', {
      id: 'hero',
      header: 'Hero',
      size: 220,
      cell: ({ getValue }) => <HeroCell heroId={getValue()} />,
    }) as ColumnDef<MaelkEntry, unknown>,
    ch.accessor('leagueName', {
      id: 'leagueName',
      header: 'League',
      size: 320,
      cell: ({ row }) => (
        <a href={`/leagues/${row.original.leagueId}`} className={styles.leagueLink}>
          {row.original.leagueName}
        </a>
      ),
    }) as ColumnDef<MaelkEntry, unknown>,
    ch.accessor('deaths', {
      id: 'deaths',
      header: 'Deaths',
      size: 110,
      meta: { numeric: true, heatmap: 'high-bad' as const, tooltip: 'Deaths (0 kills)' },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<MaelkEntry, unknown>,
    ch.accessor('assists', {
      id: 'assists',
      header: 'Assists',
      size: 110,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Assists' },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<MaelkEntry, unknown>,
  ]
}

/* ── Page component ─────────────────────────────────────── */

function getAwardType(pathname: string): AwardType {
  if (pathname.includes('/akke')) return 'akke'
  if (pathname.includes('/cty')) return 'cty'
  return 'maelk'
}

function getColumns(type: AwardType): ColumnDef<AwardEntry, unknown>[] {
  switch (type) {
    case 'akke': return buildAkkeColumns() as ColumnDef<AwardEntry, unknown>[]
    case 'cty': return buildCtyColumns() as ColumnDef<AwardEntry, unknown>[]
    case 'maelk': return buildMaelkColumns() as ColumnDef<AwardEntry, unknown>[]
  }
}

function getDefaultSort(type: AwardType) {
  switch (type) {
    case 'akke': return [{ id: 'lastHits', desc: false }]
    case 'cty': return [{ id: 'matchId', desc: true }]
    case 'maelk': return [{ id: 'deaths', desc: true }]
  }
}

export default function TriviaAward() {
  const { pathname } = useLocation()
  const type = getAwardType(pathname)
  const meta = AWARD_META[type]

  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: AwardEntry[] }>(
    `/api/trivia/${type}`,
  )

  const columns = useMemo(() => getColumns(type), [type])
  const rows = raw?.data ?? []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{meta.title}</h1>
        <p className={styles.subtitle}>{meta.subtitle}</p>
        <p className={styles.description}>{meta.description}</p>
      </div>

      {isLoading && <EnigmaLoader text="Loading award data..." />}

      {error && (
        <ErrorState
          message="Failed to load award data"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={getDefaultSort(type)}
          searchableColumns={['nickname', 'leagueName']}
        />
      )}
    </div>
  )
}
