import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { miniHeroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell } from '../components/DataTable'
import TableSkeleton from '../components/TableSkeleton'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import toggleStyles from './PlayerSquads.module.css'
import styles from './TriviaCaps.module.css'

/* ── Shared data shapes ─────────────────────────────────── */

interface CapPlayer {
  steam_id: string
  nickname: string
  hero: number
  player_cap: number
  player_hero_cap: number
}

interface CapTeam {
  team_id: number
  team_name: string
  faction: string
  won: boolean
  caps: number
  players: CapPlayer[]
}

interface MatchCtx {
  match_id: number
  start_date: string
  league_id: number
  league_name: string
  is_lan: boolean
}

/** count-gap / hero-gap */
interface GapRow extends MatchCtx {
  team_a: CapTeam
  team_b: CapTeam
  gap: number
  combined: number
}

/** combined-match */
interface CombinedMatchRow extends MatchCtx {
  team_1: CapTeam
  team_2: CapTeam
  combined: number
}

/** combined-team / hero-team */
interface TeamRow extends MatchCtx {
  team_id: number
  team_name: string
  faction: string
  won: boolean
  caps: number
  players: CapPlayer[]
  opponent_id: number
  opponent_name: string
}

type Metric = 'count' | 'hero'

/* ── Helpers ────────────────────────────────────────────── */

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

function MatchCell({ matchId }: { matchId: number }) {
  return <a href={`/matches/${matchId}`} className={styles.link}>{matchId}</a>
}

function LeagueCell({ leagueId, leagueName, isLan }: { leagueId: number; leagueName: string; isLan: boolean }) {
  return (
    <span className={styles.leagueCell}>
      <a href={`/leagues/${leagueId}`} className={styles.leagueLink} title={leagueName}>{leagueName}</a>
      {isLan && <span className={styles.lanBadge}>LAN</span>}
    </span>
  )
}

function TeamNameCell({ teamId, name, won }: { teamId: number; name: string; won?: boolean }) {
  const cls = won === true ? styles.win : won === false ? styles.loss : ''
  return (
    <a href={`/teams/${teamId}`} className={`${styles.teamLink} ${cls}`} title={won === undefined ? undefined : won ? 'Won' : 'Lost'}>
      {name}
    </a>
  )
}

function RosterCell({ players, metric }: { players: CapPlayer[]; metric: Metric }) {
  // count → player name + total caps in brackets (hero is irrelevant)
  // hero  → hero icon + player-hero caps in brackets (hero is the point)
  return (
    <span className={styles.roster}>
      {players.map((p) => {
        if (metric === 'hero') {
          const pic = heroesById[String(p.hero)]?.picture
          return (
            <span
              key={p.steam_id}
              className={styles.rosterItem}
              title={`${p.nickname} — ${p.player_hero_cap.toLocaleString()} player-hero caps on ${heroName(p.hero)} (${p.player_cap.toLocaleString()} player caps total)`}
            >
              {pic && <img src={miniHeroImageUrl(pic)} alt="" className={styles.rosterHero} loading="lazy" />}
              <span className={styles.rosterName}>{p.nickname}</span>
              <span className={styles.rosterCap}>({p.player_hero_cap.toLocaleString()})</span>
            </span>
          )
        }
        return (
          <span
            key={p.steam_id}
            className={styles.rosterItem}
            title={`${p.nickname} — ${p.player_cap.toLocaleString()} player caps`}
          >
            <span className={styles.rosterName}>{p.nickname}</span>
            <span className={styles.rosterCap}>({p.player_cap.toLocaleString()})</span>
          </span>
        )
      })}
    </span>
  )
}

function rosterSearch(players: CapPlayer[]): string {
  return players.map((p) => `${p.nickname} ${heroName(p.hero)}`).join(' ')
}

const capLabel = (metric: Metric) => (metric === 'hero' ? 'Player-Hero Caps' : 'Player Caps')
const capLabelLower = (metric: Metric) => (metric === 'hero' ? 'player-hero caps' : 'player caps')
const capW = (metric: Metric) => (metric === 'hero' ? 155 : 120)

/* League truncates with an ellipsis — the full name is shown on hover
   (title attribute). */
const LEAGUE_W = 300

/* Roster columns size dynamically to their content. The body font is monospace
   (Fira Code), so a per-character estimate is accurate. These tables are
   intentionally wide (five-player rosters); the table scrolls horizontally when
   needed. Cells are `padding: 0 12px`; roster text is ~0.7rem. */
const CELL_PAD = 24
const ROSTER_CHAR_W = 7.1
const HERO_ICON_W = 25 // 22px icon + 3px gap
const ITEM_GAP = 8 // gap between roster entries
const NAME_CAP_GAP = 3 // gap between name and (caps)

const FALLBACK_ROSTER = (metric: Metric) => (metric === 'hero' ? 560 : 520)

function rosterWidth(playerLists: CapPlayer[][], metric: Metric): number {
  let max = 160
  for (const players of playerLists) {
    let w = CELL_PAD
    players.forEach((p, i) => {
      const cap = metric === 'hero' ? p.player_hero_cap : p.player_cap
      const chars = p.nickname.length + `(${cap.toLocaleString()})`.length
      let item = chars * ROSTER_CHAR_W + NAME_CAP_GAP
      if (metric === 'hero') item += HERO_ICON_W
      w += item + (i > 0 ? ITEM_GAP : 0)
    })
    if (w > max) max = w
  }
  return Math.ceil(max)
}

/* ── Column builders ────────────────────────────────────── */

function buildGapColumns(metric: Metric, rosterSize: number): ColumnDef<GapRow, unknown>[] {
  const ch = createColumnHelper<GapRow>()
  const capHeader = capLabel(metric)
  const capSize = capW(metric)
  return [
    ch.accessor('match_id', {
      id: 'match_id',
      header: 'Match',
      size: 120,
      cell: ({ getValue }) => <MatchCell matchId={getValue()} />,
    }) as ColumnDef<GapRow, unknown>,
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'League',
      size: LEAGUE_W,
      cell: ({ row }) => (
        <LeagueCell leagueId={row.original.league_id} leagueName={row.original.league_name} isLan={row.original.is_lan} />
      ),
    }) as ColumnDef<GapRow, unknown>,
    ch.display({
      id: 'team_a',
      header: 'More Experienced',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamNameCell teamId={row.original.team_a.team_id} name={row.original.team_a.team_name} won={row.original.team_a.won} />
      ),
    }) as ColumnDef<GapRow, unknown>,
    ch.accessor((r) => r.team_a.caps, {
      id: 'team_a_caps',
      header: capHeader,
      size: capSize,
      meta: { numeric: true },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    }) as ColumnDef<GapRow, unknown>,
    ch.display({
      id: 'team_a_roster',
      header: 'Roster',
      size: rosterSize,
      enableSorting: false,
      cell: ({ row }) => <RosterCell players={row.original.team_a.players} metric={metric} />,
    }) as ColumnDef<GapRow, unknown>,
    ch.accessor('gap', {
      id: 'gap',
      header: 'Gap',
      size: 100,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: `Difference in summed ${capLabelLower(metric)} between the two teams` },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<GapRow, unknown>,
    ch.display({
      id: 'team_b',
      header: 'Less Experienced',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamNameCell teamId={row.original.team_b.team_id} name={row.original.team_b.team_name} won={row.original.team_b.won} />
      ),
    }) as ColumnDef<GapRow, unknown>,
    ch.accessor((r) => r.team_b.caps, {
      id: 'team_b_caps',
      header: capHeader,
      size: capSize,
      meta: { numeric: true },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    }) as ColumnDef<GapRow, unknown>,
    ch.display({
      id: 'team_b_roster',
      header: 'Roster',
      size: rosterSize,
      enableSorting: false,
      cell: ({ row }) => <RosterCell players={row.original.team_b.players} metric={metric} />,
    }) as ColumnDef<GapRow, unknown>,
    ch.accessor('combined', {
      id: 'combined',
      header: 'Combined',
      size: 110,
      meta: { numeric: true, tooltip: `Total summed ${capLabelLower(metric)} across both teams` },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<GapRow, unknown>,
  ]
}

function buildCombinedMatchColumns(rosterSize: number): ColumnDef<CombinedMatchRow, unknown>[] {
  const ch = createColumnHelper<CombinedMatchRow>()
  return [
    ch.accessor('match_id', {
      id: 'match_id',
      header: 'Match',
      size: 120,
      cell: ({ getValue }) => <MatchCell matchId={getValue()} />,
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.accessor('start_date', {
      id: 'start_date',
      header: 'Date',
      size: 110,
      cell: ({ getValue }) => <span>{formatDate(getValue())}</span>,
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'League',
      size: LEAGUE_W,
      cell: ({ row }) => (
        <LeagueCell leagueId={row.original.league_id} leagueName={row.original.league_name} isLan={row.original.is_lan} />
      ),
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.display({
      id: 'team_1',
      header: 'Team',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamNameCell teamId={row.original.team_1.team_id} name={row.original.team_1.team_name} won={row.original.team_1.won} />
      ),
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.accessor((r) => r.team_1.caps, {
      id: 'team_1_caps',
      header: 'Player Caps',
      size: 120,
      meta: { numeric: true },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.display({
      id: 'team_1_roster',
      header: 'Roster',
      size: rosterSize,
      enableSorting: false,
      cell: ({ row }) => <RosterCell players={row.original.team_1.players} metric="count" />,
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.display({
      id: 'team_2',
      header: 'Team',
      size: 180,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamNameCell teamId={row.original.team_2.team_id} name={row.original.team_2.team_name} won={row.original.team_2.won} />
      ),
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.accessor((r) => r.team_2.caps, {
      id: 'team_2_caps',
      header: 'Player Caps',
      size: 120,
      meta: { numeric: true },
      cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.display({
      id: 'team_2_roster',
      header: 'Roster',
      size: rosterSize,
      enableSorting: false,
      cell: ({ row }) => <RosterCell players={row.original.team_2.players} metric="count" />,
    }) as ColumnDef<CombinedMatchRow, unknown>,
    ch.accessor('combined', {
      id: 'combined',
      header: 'Combined',
      size: 120,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total summed player caps across both teams' },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<CombinedMatchRow, unknown>,
  ]
}

function buildTeamColumns(metric: Metric, rosterSize: number): ColumnDef<TeamRow, unknown>[] {
  const ch = createColumnHelper<TeamRow>()
  const capHeader = capLabel(metric)
  const capSize = capW(metric)
  return [
    ch.accessor('match_id', {
      id: 'match_id',
      header: 'Match',
      size: 120,
      cell: ({ getValue }) => <MatchCell matchId={getValue()} />,
    }) as ColumnDef<TeamRow, unknown>,
    ch.accessor('league_name', {
      id: 'league_name',
      header: 'League',
      size: LEAGUE_W,
      cell: ({ row }) => (
        <LeagueCell leagueId={row.original.league_id} leagueName={row.original.league_name} isLan={row.original.is_lan} />
      ),
    }) as ColumnDef<TeamRow, unknown>,
    ch.accessor('team_name', {
      id: 'team_name',
      header: 'Team',
      size: 200,
      cell: ({ row }) => (
        <TeamNameCell teamId={row.original.team_id} name={row.original.team_name} won={row.original.won} />
      ),
    }) as ColumnDef<TeamRow, unknown>,
    ch.accessor('caps', {
      id: 'caps',
      header: capHeader,
      size: capSize,
      meta: { numeric: true, heatmap: 'high-good' as const, tooltip: `Summed ${capLabelLower(metric)} across the five players` },
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
    }) as ColumnDef<TeamRow, unknown>,
    ch.display({
      id: 'roster',
      header: 'Roster',
      size: rosterSize,
      enableSorting: false,
      cell: ({ row }) => <RosterCell players={row.original.players} metric={metric} />,
    }) as ColumnDef<TeamRow, unknown>,
    ch.accessor('opponent_name', {
      id: 'opponent_name',
      header: 'Opponent',
      size: 200,
      enableSorting: false,
      cell: ({ row }) => (
        <TeamNameCell teamId={row.original.opponent_id} name={row.original.opponent_name} />
      ),
    }) as ColumnDef<TeamRow, unknown>,
  ]
}

/* ── Typed table renderers ──────────────────────────────── */

function GapTable({ rows, metric }: { rows: GapRow[]; metric: Metric }) {
  const columns = useMemo(
    () => buildGapColumns(metric, rosterWidth(rows.flatMap((r) => [r.team_a.players, r.team_b.players]), metric)),
    [rows, metric],
  )
  return (
    <DataTable
      data={rows}
      columns={columns}
      defaultSorting={[{ id: 'gap', desc: true }]}
      rowHeight={44}
      searchValue={(r) =>
        [
          String(r.match_id),
          r.league_name,
          r.team_a.team_name,
          r.team_b.team_name,
          rosterSearch(r.team_a.players),
          rosterSearch(r.team_b.players),
        ].join(' ')
      }
    />
  )
}

function CombinedMatchTable({ rows }: { rows: CombinedMatchRow[] }) {
  const columns = useMemo(
    () => buildCombinedMatchColumns(rosterWidth(rows.flatMap((r) => [r.team_1.players, r.team_2.players]), 'count')),
    [rows],
  )
  return (
    <DataTable
      data={rows}
      columns={columns}
      defaultSorting={[{ id: 'combined', desc: true }]}
      rowHeight={44}
      searchValue={(r) =>
        [
          String(r.match_id),
          r.league_name,
          r.team_1.team_name,
          r.team_2.team_name,
          rosterSearch(r.team_1.players),
          rosterSearch(r.team_2.players),
        ].join(' ')
      }
    />
  )
}

interface TeamOption {
  id: number
  name: string
  count: number
}

function TeamTable({ rows, metric }: { rows: TeamRow[]; metric: Metric }) {
  const columns = useMemo(
    () => buildTeamColumns(metric, rosterWidth(rows.map((r) => r.players), metric)),
    [rows, metric],
  )

  const teams = useMemo<TeamOption[]>(() => {
    const m = new Map<number, TeamOption>()
    for (const r of rows) {
      const e = m.get(r.team_id)
      if (e) e.count++
      else m.set(r.team_id, { id: r.team_id, name: r.team_name, count: 1 })
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [rows])

  // A team is shown when it is NOT in `hidden` — default shows everything.
  const [hidden, setHidden] = useState<Set<number>>(() => new Set())

  const toggle = (id: number) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const filtered = useMemo(
    () => (hidden.size === 0 ? rows : rows.filter((r) => !hidden.has(r.team_id))),
    [rows, hidden],
  )

  return (
    <>
      <div className={styles.teamFilter}>
        <span className={styles.teamFilterLabel}>Teams</span>
        <div className={styles.teamChips}>
          {teams.map((t) => (
            <button
              key={t.id}
              className={`${styles.teamChip} ${hidden.has(t.id) ? '' : styles.teamChipActive}`}
              onClick={() => toggle(t.id)}
              title={hidden.has(t.id) ? `Show ${t.name}` : `Hide ${t.name}`}
            >
              {t.name} <span className={styles.teamChipCount}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        defaultSorting={[{ id: 'caps', desc: true }]}
        rowHeight={44}
        searchValue={(r) =>
          [String(r.match_id), r.league_name, r.team_name, r.opponent_name, rosterSearch(r.players)].join(' ')
        }
      />
    </>
  )
}

/* ── Tab configuration ──────────────────────────────────── */

interface TabConfig {
  label: string
  endpoint: string
  subtitle: string
  description: string
}

const TAB_CONFIG: Record<string, TabConfig> = {
  'count-gap': {
    label: 'Gap (Player Caps)',
    endpoint: '/api/caps/count-gap',
    subtitle: 'The most lopsided team-vs-team experience mismatches at match start',
    description:
      'Sums each team\'s player caps (games its five players had played before this match) and finds the biggest gap between the two sides. Top 500.',
  },
  'hero-gap': {
    label: 'Gap (Player-Hero Caps)',
    endpoint: '/api/caps/hero-gap',
    subtitle: 'The most lopsided mismatches in experience on the drafted heroes',
    description:
      'Like the player-caps gap, but sums each player\'s player-hero caps on the specific hero they drafted — the biggest hero-experience mismatches. Top 500.',
  },
  'combined-match': {
    label: 'Match (Player Caps)',
    endpoint: '/api/caps/combined-match',
    subtitle: 'Highest combined player caps across both teams in a single game',
    description:
      'Sums the player caps of all ten players in a match to find the most veteran-heavy games ever played. Top 500.',
  },
  'combined-team': {
    label: 'Team (Player Caps)',
    endpoint: '/api/caps/combined-team',
    subtitle: 'Highest combined player caps on a single team in one game',
    description:
      'Sums the player caps of one team\'s five players — the most experienced line-ups ever fielded, with their opponent for context. Top 500.',
  },
  'hero-team': {
    label: 'Team (Player-Hero Caps)',
    endpoint: '/api/caps/hero-team',
    subtitle: 'Highest combined player-hero caps on the drafted heroes for a single team',
    description:
      'Like the team player-caps ranking, but sums each player\'s player-hero caps on the hero they drafted — the most hero-experienced line-ups. Top 500.',
  },
}

const TABS = Object.keys(TAB_CONFIG)
const DEFAULT_TAB = 'count-gap'

/* ── Page component ─────────────────────────────────────── */

export default function TriviaCaps() {
  const { hash } = useLocation()
  const navigate = useNavigate()

  const hashTab = hash.replace('#', '')
  const tab = TABS.includes(hashTab) ? hashTab : DEFAULT_TAB
  const cfg = TAB_CONFIG[tab]

  const selectTab = (t: string) => navigate(`#${t}`)

  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: unknown[] }>(cfg.endpoint)

  const rows = raw?.data ?? []

  const skeletonColumns = useMemo<ColumnDef<unknown, unknown>[]>(() => {
    switch (tab) {
      case 'hero-gap': return buildGapColumns('hero', FALLBACK_ROSTER('hero')) as unknown as ColumnDef<unknown, unknown>[]
      case 'combined-match': return buildCombinedMatchColumns(FALLBACK_ROSTER('count')) as unknown as ColumnDef<unknown, unknown>[]
      case 'combined-team': return buildTeamColumns('count', FALLBACK_ROSTER('count')) as unknown as ColumnDef<unknown, unknown>[]
      case 'hero-team': return buildTeamColumns('hero', FALLBACK_ROSTER('hero')) as unknown as ColumnDef<unknown, unknown>[]
      default: return buildGapColumns('count', FALLBACK_ROSTER('count')) as unknown as ColumnDef<unknown, unknown>[]
    }
  }, [tab])

  return (
    <div className={styles.page}>
      <PageMeta
        title="Dota 2 Caps — Experience Records"
        description="Pro Dota 2 caps: biggest experience gaps and the most veteran-heavy teams and matches. A cap is a player's number of prior tier 1–2 games."
      />
      <div className={styles.header}>
        <h1>Caps</h1>
        <p className={styles.intro}>
          A <strong>player cap</strong> is a player's number of prior tier 1–2 professional games before a match (a debut is 0).
          A <strong>player-hero cap</strong> counts only games on that specific hero.
        </p>
      </div>

      <div className={`${toggleStyles.toggleRow} ${styles.tabRow}`}>
        {TABS.map((t) => (
          <button
            key={t}
            className={`${toggleStyles.toggleBtn} ${tab === t ? toggleStyles.toggleActive : ''}`}
            onClick={() => selectTab(t)}
          >
            {TAB_CONFIG[t].label}
          </button>
        ))}
      </div>

      <div className={styles.header}>
        <p className={styles.subtitle}>{cfg.subtitle}</p>
        <p className={styles.description}>{cfg.description}</p>
      </div>

      {isLoading && <TableSkeleton columns={skeletonColumns} rows={10} rowHeight={44} loaderText="Loading caps data..." />}

      {error && (
        <ErrorState
          message="Failed to load caps data"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        tab === 'count-gap' ? <GapTable rows={rows as GapRow[]} metric="count" />
          : tab === 'hero-gap' ? <GapTable rows={rows as GapRow[]} metric="hero" />
          : tab === 'combined-match' ? <CombinedMatchTable rows={rows as CombinedMatchRow[]} />
          : tab === 'combined-team' ? <TeamTable key="combined-team" rows={rows as TeamRow[]} metric="count" />
          : <TeamTable key="hero-team" rows={rows as TeamRow[]} metric="hero" />
      )}
    </div>
  )
}
