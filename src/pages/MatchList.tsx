import { useState, useCallback, useEffect, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { PlayerCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import LeagueLogo from '../components/LeagueLogo'
import type { MatchListEntry } from '../types'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

const TIERS = [
  { id: 'all', label: 'All' },
  { id: 'premium', label: 'Premium' },
  { id: 'pro', label: 'Professional' },
  { id: 'semipro', label: 'Semi-Pro' },
]

function getInitialTier(): string {
  const hash = window.location.hash.replace('#', '')
  if (TIERS.some((t) => t.id === hash)) return hash
  return 'all'
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function PlayersCell({ players }: { players: { steamId: number; nickname: string }[] }) {
  if (!players || players.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  return (
    <span style={{ display: 'flex', flexWrap: 'nowrap', gap: '1px 4px', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {players.map((p, i) => (
        <span key={p.steamId}>
          {i > 0 && <span style={{ color: 'var(--color-text-muted)', marginRight: 1 }}>,</span>}
          <PlayerCell steamId={p.steamId} nickname={p.nickname} />
        </span>
      ))}
    </span>
  )
}

const columns: ColumnDef<MatchListEntry, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 100,
    cell: ({ getValue }) => (
      <a href={`/matches/${getValue()}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
        {String(getValue())}
      </a>
    ),
  },
  {
    id: 'league',
    accessorFn: (row) => row.league?.name ?? '',
    header: 'League',
    size: 200,
    enableSorting: false,
    cell: ({ row }) => {
      const league = row.original.league
      if (!league) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LeagueLogo leagueId={league.leagueId} size={32} />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{league.name}</span>
        </span>
      )
    },
  },
  {
    id: 'startDate',
    accessorKey: 'startDate',
    header: 'Date',
    size: 95,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(getValue() as string)}</span>
    ),
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Match Duration' },
    cell: ({ getValue }) => {
      const secs = getValue() as number
      return (
        <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
          {fmtTime(secs)}
        </span>
      )
    },
  },
  {
    id: 'radiantTeam',
    accessorFn: (row) => row.radiant?.name ?? '',
    header: 'Radiant',
    size: 130,
    enableSorting: false,
    cell: ({ row }) => {
      const r = row.original.radiant
      const won = row.original.radiantVictory
      return (
        <span style={{ fontSize: '0.8rem', fontWeight: won ? 600 : 400, color: won ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
          {r?.name || 'Unknown'}
        </span>
      )
    },
  },
  {
    id: 'radiantPlayers',
    accessorFn: (row) => row.radiantPlayers?.map((p) => p.nickname).join(', ') ?? '',
    header: 'Radiant Players',
    size: 360,
    enableSorting: false,
    cell: ({ row }) => <PlayersCell players={row.original.radiantPlayers} />,
  },
  {
    id: 'score',
    accessorFn: (row) => `${row.radiant?.score ?? 0}-${row.dire?.score ?? 0}`,
    header: 'Score',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', textAlign: 'center', display: 'block' }}>
        {row.original.radiant?.score ?? 0} – {row.original.dire?.score ?? 0}
      </span>
    ),
  },
  {
    id: 'direTeam',
    accessorFn: (row) => row.dire?.name ?? '',
    header: 'Dire',
    size: 130,
    enableSorting: false,
    cell: ({ row }) => {
      const d = row.original.dire
      const won = !row.original.radiantVictory
      return (
        <span style={{ fontSize: '0.8rem', fontWeight: won ? 600 : 400, color: won ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
          {d?.name || 'Unknown'}
        </span>
      )
    },
  },
  {
    id: 'direPlayers',
    accessorFn: (row) => row.direPlayers?.map((p) => p.nickname).join(', ') ?? '',
    header: 'Dire Players',
    size: 360,
    enableSorting: false,
    cell: ({ row }) => <PlayersCell players={row.original.direPlayers} />,
  },
]

export default function MatchList() {
  const [tier, setTier] = useState(getInitialTier)

  const selectTier = useCallback((t: string) => {
    setTier(t)
    window.location.hash = `#${t}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '')
      if (TIERS.some((t) => t.id === hash)) setTier(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const params = useMemo(() => (tier !== 'all' ? { tier } : {}), [tier])

  const { data, isLoading, error } = useApiQuery<{ data: MatchListEntry[] }>(
    '/api/matches',
    params,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Recent Matches</h1>
        <p className={styles.subtitle}>
          Latest professional Dota 2 matches
        </p>
      </div>

      <div className={toggleStyles.toggleRow}>
        {TIERS.map((t) => (
          <button
            key={t.id}
            className={`${toggleStyles.toggleBtn} ${tier === t.id ? toggleStyles.toggleActive : ''}`}
            onClick={() => selectTier(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <EnigmaLoader text="Fetching matches..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'matchId', desc: true }]}
          searchableColumns={['radiantTeam', 'direTeam', 'league', 'radiantPlayers', 'direPlayers']}
          rowHeight={40}
        />
      )}
    </div>
  )
}
