import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useTeamAutocomplete } from '../api/autocomplete'
import { fetchTeamNames } from '../api/entityInfo'
import { teamLogoUrl, heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PercentCell, PlayerCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './EntityShow.module.css'
import filterStyles from '../components/FilterPanel.module.css'
import h2hStyles from './TeamHeadToHead.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface H2HTeamInfo {
  name: string
  valveId: number
  logoId: string | null
}

interface H2HRating {
  rating: number
  prob: number
  rd?: number
  volatility?: number
}

interface H2HTeamData {
  team: H2HTeamInfo
  ratings: Record<string, H2HRating>
  players: {
    steamId: number
    nickname: string
    totalGamesPlayed: number
    totalGamesWon: number
    gamesForTeam: number
    gamesWonForTeam: number
  }[]
}

interface H2HMatchSide {
  heroes: number[]
  isRadiant: boolean
  won: boolean
}

interface H2HMatch {
  matchId: number
  startDate: string
  league: { leagueId: number; name: string }
  patch: string
  left: H2HMatchSide
  right: H2HMatchSide
}

interface H2HResponse {
  data: {
    patch: string
    recentMatches: H2HMatch[]
    leftTeam: H2HTeamData | null
    rightTeam: H2HTeamData | null
  }
}

/* ── Helpers ────────────────────────────────────────────── */

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function HeroIcons({ heroIds }: { heroIds: number[] }) {
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {heroIds.map((id) => {
        const hero = heroesById[String(id)]
        const pic = hero?.picture
        const name = hero?.name ?? `Hero ${id}`
        const src = pic ? heroImageUrl(pic) : undefined
        return src ? (
          <img key={id} src={src} alt={name} title={name} style={{ height: 22, width: 'auto' }} loading="lazy" />
        ) : (
          <span key={id} style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }} title={name}>{name}</span>
        )
      })}
    </span>
  )
}

/* ── Team autocomplete input ───────────────────────────── */

function TeamInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const { data: results } = useTeamAutocomplete(query)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (value && !displayName) {
      fetchTeamNames([value]).then((names) => {
        if (names[value]) setDisplayName(names[value])
      })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function select(id: string, name: string) {
    onChange(id)
    setDisplayName(name)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange('')
    setDisplayName('')
    setQuery('')
  }

  return (
    <div className={filterStyles.filterGroup} ref={ref}>
      <label className={filterStyles.label}>{label}</label>
      <div className={filterStyles.autocompleteWrap}>
        {value && (
          <div className={filterStyles.tags}>
            <span className={filterStyles.tag}>
              {displayName || value}
              <button className={filterStyles.tagRemove} onClick={clear}>&times;</button>
            </span>
          </div>
        )}
        {!value && (
          <input
            className={filterStyles.input}
            placeholder="Search teams..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => query.length >= 2 && setOpen(true)}
          />
        )}
        {open && results && results.length > 0 && (
          <div className={filterStyles.dropdown}>
            {results.map((r) => (
              <button
                key={r.team_id}
                className={filterStyles.dropdownItem}
                onClick={() => select(String(r.team_id), r.name)}
              >
                {r.name}
                {r.tag && <span style={{ color: 'var(--color-text-muted)' }}> — {r.tag}</span>}
                <span style={{ color: 'var(--color-text-muted)' }}> ({r.team_id})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Match columns ─────────────────────────────────────── */

function makeMatchColumns(leftName: string, rightName: string): ColumnDef<H2HMatch, unknown>[] {
  return [
    {
      id: 'date',
      accessorFn: (row) => row.startDate,
      header: 'Date',
      size: 100,
      cell: ({ row }) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {fmtDate(row.original.startDate)}
        </span>
      ),
    },
    {
      id: 'matchId',
      accessorKey: 'matchId',
      header: 'Match',
      size: 100,
      cell: ({ getValue }) => (
        <Link to={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
          {getValue() as number}
        </Link>
      ),
    },
    {
      id: 'league',
      accessorFn: (row) => row.league.name,
      header: 'League',
      size: 180,
      cell: ({ row }) => (
        <Link to={`/leagues/${row.original.league.leagueId}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }}>
          {row.original.league.name}
        </Link>
      ),
    },
    {
      id: 'patch',
      accessorKey: 'patch',
      header: 'Patch',
      size: 65,
      cell: ({ getValue }) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{getValue() as string}</span>
      ),
    },
    {
      id: 'leftHeroes',
      accessorFn: () => '',
      header: leftName,
      size: 140,
      enableSorting: false,
      cell: ({ row }) => <HeroIcons heroIds={row.original.left.heroes} />,
    },
    {
      id: 'result',
      accessorFn: (row) => row.left.won ? 'W' : 'L',
      header: '',
      size: 40,
      enableSorting: false,
      cell: ({ row }) => {
        const leftWon = row.original.left.won
        return (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '0.9rem',
            color: 'var(--color-text-muted)',
          }}>
            {leftWon ? '\u276F' : '\u276E'}
          </span>
        )
      },
    },
    {
      id: 'rightHeroes',
      accessorFn: () => '',
      header: rightName,
      size: 140,
      enableSorting: false,
      cell: ({ row }) => <HeroIcons heroIds={row.original.right.heroes} />,
    },
  ]
}

/* ── Player columns ────────────────────────────────────── */

interface PlayerRow {
  steamId: number
  nickname: string
  totalGamesPlayed: number
  totalGamesWon: number
  gamesForTeam: number
  gamesWonForTeam: number
}

const playerColumns: ColumnDef<PlayerRow, unknown>[] = [
  {
    id: 'player',
    accessorKey: 'nickname',
    header: 'Player',
    size: 150,
    enableSorting: false,
    cell: ({ row }) => <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />,
  },
  {
    id: 'teamGames',
    accessorKey: 'gamesForTeam',
    header: 'Team Games',
    size: 90,
    meta: { numeric: true, tooltip: 'Games played for this team' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'teamWR',
    accessorFn: (row) => row.gamesForTeam > 0 ? row.gamesWonForTeam / row.gamesForTeam : 0,
    header: 'Team WR',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win rate with this team' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
  {
    id: 'totalGames',
    accessorKey: 'totalGamesPlayed',
    header: 'Career',
    size: 80,
    meta: { numeric: true, tooltip: 'Total career games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'totalWR',
    accessorFn: (row) => row.totalGamesPlayed > 0 ? row.totalGamesWon / row.totalGamesPlayed : 0,
    header: 'Career WR',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Overall career win rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

/* ── Symmetric ratings table ───────────────────────────── */

const RATING_ORDER = ['GLICKO_2', 'GLICKO_1', 'ELO_32', 'ELO_64'] as const
const RATING_LABELS: Record<string, string> = {
  GLICKO_2: 'Glicko 2',
  GLICKO_1: 'Glicko 1',
  ELO_32: 'Elo (k=32)',
  ELO_64: 'Elo (k=64)',
}

function RatingsComparisonTable({
  leftTeam,
  rightTeam,
  leftWins,
  rightWins,
  totalMatches,
}: {
  leftTeam: H2HTeamData
  rightTeam: H2HTeamData
  leftWins: number
  rightWins: number
  totalMatches: number
}) {
  return (
    <table className={h2hStyles.ratingsTable}>
      <thead>
        <tr>
          <th className={h2hStyles.rtTeamName}>
            <div className={h2hStyles.rtTeamHeader}>
              <img
                src={teamLogoUrl(leftTeam.team.logoId)}
                alt={leftTeam.team.name}
                className={h2hStyles.rtTeamLogo}
                loading="lazy"
              />
              <div>
                <Link to={`/teams/${leftTeam.team.valveId}`} className={h2hStyles.rtTeamLink}>
                  {leftTeam.team.name}
                </Link>
                <div className={h2hStyles.rtTeamRecord}>
                  {leftWins}W – {totalMatches - leftWins}L
                  {totalMatches > 0 && <> ({(leftWins / totalMatches * 100).toFixed(1)}%)</>}
                </div>
              </div>
            </div>
          </th>
          <th className={h2hStyles.rtMethod}></th>
          <th className={h2hStyles.rtTeamName}>
            <div className={`${h2hStyles.rtTeamHeader} ${h2hStyles.rtTeamHeaderRight}`}>
              <div>
                <Link to={`/teams/${rightTeam.team.valveId}`} className={h2hStyles.rtTeamLink}>
                  {rightTeam.team.name}
                </Link>
                <div className={h2hStyles.rtTeamRecord}>
                  {rightWins}W – {totalMatches - rightWins}L
                  {totalMatches > 0 && <> ({(rightWins / totalMatches * 100).toFixed(1)}%)</>}
                </div>
              </div>
              <img
                src={teamLogoUrl(rightTeam.team.logoId)}
                alt={rightTeam.team.name}
                className={h2hStyles.rtTeamLogo}
                loading="lazy"
              />
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        {RATING_ORDER.map((key) => {
          const left = leftTeam.ratings[key]
          const right = rightTeam.ratings[key]
          if (!left || !right) return null
          const leftHigher = left.rating >= right.rating
          return (
            <tr key={key}>
              <td className={h2hStyles.rtValueRow}>
                <span className={h2hStyles.rtProb}>{(left.prob * 100).toFixed(1)}%</span>
                <span className={leftHigher ? h2hStyles.rtHighlight : ''}>{Math.round(left.rating)}</span>
              </td>
              <td className={h2hStyles.rtLabel}>{RATING_LABELS[key]}</td>
              <td className={h2hStyles.rtValueRow}>
                <span className={!leftHigher ? h2hStyles.rtHighlight : ''}>{Math.round(right.rating)}</span>
                <span className={h2hStyles.rtProb}>{(right.prob * 100).toFixed(1)}%</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ── Page ───────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: '0.6rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--color-text-muted)',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: '0.82rem',
  fontFamily: 'var(--font-mono)',
  background: 'var(--color-bg-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}

export default function TeamHeadToHead() {
  const [searchParams, setSearchParams] = useSearchParams()

  const teamA = searchParams.get('team-a') ?? ''
  const teamB = searchParams.get('team-b') ?? ''
  const today = new Date().toISOString().slice(0, 10)
  const before = searchParams.get('before') || today

  // Ensure 'before' is always in the URL
  useEffect(() => {
    if (!searchParams.has('before')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('before', today)
        return next
      }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setParam = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const apiParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (teamA) p['team-a'] = teamA
    if (teamB) p['team-b'] = teamB
    if (before) p['before'] = before
    return p
  }, [teamA, teamB, before])

  const hasQuery = !!(teamA && teamB)

  const { data, isLoading, error, refetch } = useApiQuery<H2HResponse>(
    hasQuery ? '/api/head-to-head/complex' : null,
    apiParams,
  )

  const h2h = data?.data ?? null
  const leftTeam = h2h?.leftTeam
  const rightTeam = h2h?.rightTeam
  const matches = useMemo(
    () => (h2h?.recentMatches ?? []).filter((m) => m.left?.heroes && m.right?.heroes),
    [h2h?.recentMatches],
  )

  const leftWins = matches.filter((m) => m.left.won).length
  const rightWins = matches.filter((m) => m.right.won).length

  // Find the latest patch in the data for row accenting
  const latestPatch = useMemo(() => {
    if (matches.length === 0) return null
    // matches are sorted by date desc, so first match has the latest patch
    return matches[0]?.patch ?? null
  }, [matches])

  const matchColumns = useMemo(
    () => makeMatchColumns(leftTeam?.team.name ?? 'Team A', rightTeam?.team.name ?? 'Team B'),
    [leftTeam?.team.name, rightTeam?.team.name],
  )

  const matchRowClassName = useCallback(
    (row: H2HMatch) => row.patch === latestPatch ? h2hStyles.currentPatchRow : undefined,
    [latestPatch],
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.entityName} style={{ fontSize: '1.8rem' }}>Team Head-to-Head</h1>
          <p className={styles.entityMeta}>Compare two teams: ratings, rosters, and match history</p>
        </div>
      </div>

      {/* Filters: team A, team B, date */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr auto',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-lg)',
        alignItems: 'end',
      }}>
        <TeamInput label="Team A" value={teamA} onChange={(v) => setParam('team-a', v)} />
        <TeamInput label="Team B" value={teamB} onChange={(v) => setParam('team-b', v)} />
        <div>
          <label style={labelStyle}>As of date</label>
          <input
            type="date"
            value={before}
            onChange={(e) => setParam('before', e.target.value || today)}
            style={inputStyle}
          />
        </div>
      </div>

      {!hasQuery && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-xl)',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
        }}>
          Select two teams to compare.
        </div>
      )}

      {isLoading && <EnigmaLoader text="Loading head-to-head..." />}

      {error && (
        <ErrorState
          message="Failed to load head-to-head data"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {leftTeam && rightTeam && (
        <>
          {/* Symmetric ratings table (with team headers above each side) */}
          <RatingsComparisonTable
            leftTeam={leftTeam}
            rightTeam={rightTeam}
            leftWins={leftWins}
            rightWins={rightWins}
            totalMatches={matches.length}
          />

          {/* Player rosters side by side */}
          <div className={styles.columns} style={{ marginTop: 'var(--space-lg)' }}>
            <DataTable
              data={leftTeam.players}
              columns={playerColumns}
              defaultSorting={[{ id: 'teamGames', desc: true }]}
              hideToolbar
            />
            <DataTable
              data={rightTeam.players}
              columns={playerColumns}
              defaultSorting={[{ id: 'teamGames', desc: true }]}
              hideToolbar
            />
          </div>

          {/* Match history */}
          {matches.length > 0 && (
            <div style={{ marginTop: 'var(--space-xl)' }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-md)',
              }}>
                Recent Matches ({matches.length})
                {latestPatch && (
                  <span style={{ fontWeight: 400, fontSize: '0.7rem', marginLeft: 8 }}>
                    — current patch: {latestPatch}
                  </span>
                )}
              </h2>
              <DataTable
                data={matches}
                columns={matchColumns}
                defaultSorting={[{ id: 'date', desc: true }]}
                rowClassName={matchRowClassName}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
