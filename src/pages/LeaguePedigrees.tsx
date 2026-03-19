import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { NumericCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './PlayerPerformances.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface PedigreeTeam {
  name: string
  valveId: number
  glicko2: number
}

interface PedigreeEntry {
  league: { leagueId: number; name: string; isValve: boolean }
  teams: PedigreeTeam[]
  numTeams: number
  top4Avg: number | null
  top8Avg: number | null
  top16Avg: number | null
}

/* ── Columns ───────────────────────────────────────────── */

const columns: ColumnDef<PedigreeEntry, unknown>[] = [
  {
    id: 'name',
    accessorFn: (row) => row.league.name,
    header: 'Tournament',
    size: 280,
    cell: ({ row }) => (
      <a
        href={`/leagues/${row.original.league.leagueId}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {row.original.league.name}
      </a>
    ),
  },
  {
    id: 'valve',
    accessorFn: (row) => row.league.isValve,
    header: 'DPC',
    size: 50,
    cell: ({ row }) =>
      row.original.league.isValve ? (
        <span style={{
          fontSize: '0.55rem',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          padding: '2px 6px',
          borderRadius: 3,
          background: 'rgba(196,139,196,0.2)',
          color: 'var(--color-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Yes
        </span>
      ) : null,
  },
  {
    id: 'numTeams',
    accessorKey: 'numTeams',
    header: 'Teams',
    size: 60,
    meta: { numeric: true, tooltip: 'Number of Teams' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'top4Avg',
    accessorKey: 'top4Avg',
    header: 'Top 4',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Avg Glicko-2 (Top 4)' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
  },
  {
    id: 'top8Avg',
    accessorKey: 'top8Avg',
    header: 'Top 8',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Avg Glicko-2 (Top 8)' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
  },
  {
    id: 'top16Avg',
    accessorKey: 'top16Avg',
    header: 'Top 16',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Avg Glicko-2 (Top 16)' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number | null} decimals={1} />,
  },
  {
    id: 'topTeams',
    accessorFn: (row) => row.teams.slice(0, 8).map((t) => t.name).join(', '),
    header: 'Top Teams',
    size: 350,
    meta: { grow: true },
    enableSorting: false,
    cell: ({ row }) => (
      <span style={{ display: 'flex', gap: '4px 8px', flexWrap: 'wrap', lineHeight: 1.6 }}>
        {row.original.teams.slice(0, 8).map((t, i) => (
          <a
            key={i}
            href={`/teams/${t.valveId}`}
            title={`${t.name} — Glicko-2: ${t.glicko2.toFixed(1)}`}
            style={{
              color: 'var(--color-accent-bright)',
              textDecoration: 'none',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
            }}
          >
            {t.name}{i < Math.min(row.original.teams.length, 8) - 1 ? ',' : ''}
          </a>
        ))}
      </span>
    ),
  },
]

/* ── Page component ─────────────────────────────────────── */

export default function LeaguePedigrees() {
  const { data, isLoading, error, refetch } = useApiQuery<{ data: PedigreeEntry[] }>(
    '/api/leagues/pedigrees',
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>LAN Event Pedigrees</h1>
        <p className={styles.subtitle}>
          Pre-event Glicko-2 rating strength of LAN tournament fields
        </p>
      </div>

      {isLoading && <EnigmaLoader text="Loading pedigrees..." />}

      {error && (
        <ErrorState
          message="Failed to load pedigrees"
          rawDetail={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'top8Avg', desc: true }]}
          searchableColumns={['name', 'topTeams']}
        />
      )}
    </div>
  )
}
