import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { leagueLogoUrl } from '../config'
import DataTable, { NumericCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './PlayerPerformances.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface LeagueEntry {
  leagueId: number
  name: string
  description: string
  tier: { id: number; name: string }
  first: string
  last: string
  count: number
  tags: string[]
}

/* ── Helpers ────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TIER_COLORS: Record<string, string> = {
  PREMIUM: 'var(--color-primary)',
  PROFESSIONAL: 'var(--color-accent-bright)',
  'SEMI-PRO': 'var(--color-text-secondary)',
  AMATEUR: 'var(--color-text-muted)',
}

const TAG_LABELS: Record<string, string> = {
  THE_INTERNATIONAL: 'TI',
  MAJOR: 'Major',
  MINOR: 'Minor',
  DPC_REGIONAL_LEAGUE: 'DPC',
}

/* ── Columns ───────────────────────────────────────────── */

const columns: ColumnDef<LeagueEntry, unknown>[] = [
  {
    id: 'logo',
    accessorFn: () => '',
    header: '',
    size: 40,
    enableSorting: false,
    cell: ({ row }) => (
      <img
        src={leagueLogoUrl(row.original.leagueId)}
        alt=""
        style={{ height: 24, width: 'auto', borderRadius: 2 }}
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    ),
  },
  {
    id: 'tier',
    accessorFn: (row) => row.tier.name,
    header: 'Tier',
    size: 90,
    cell: ({ row }) => (
      <span style={{
        fontSize: '0.65rem',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: TIER_COLORS[row.original.tier.name] ?? 'var(--color-text-muted)',
      }}>
        {row.original.tier.name}
      </span>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'League',
    size: 300,
    cell: ({ row }) => (
      <a
        href={`/leagues/${row.original.leagueId}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {row.original.name}
      </a>
    ),
  },
  {
    id: 'tags',
    accessorFn: (row) => row.tags.map((t) => TAG_LABELS[t] ?? t).join(', '),
    header: 'Tags',
    size: 80,
    cell: ({ row }) => (
      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {row.original.tags.map((t) => (
          <span
            key={t}
            style={{
              fontSize: '0.55rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 3,
              background: t === 'THE_INTERNATIONAL' ? 'rgba(196,139,196,0.2)' : 'rgba(25,170,141,0.15)',
              color: t === 'THE_INTERNATIONAL' ? 'var(--color-primary)' : 'var(--color-accent-bright)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {TAG_LABELS[t] ?? t}
          </span>
        ))}
      </span>
    ),
  },
  {
    id: 'first',
    accessorFn: (row) => new Date(row.first).getTime(),
    header: 'First Game',
    size: 110,
    cell: ({ row }) => (
      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
        {formatDate(row.original.first)}
      </span>
    ),
  },
  {
    id: 'last',
    accessorFn: (row) => new Date(row.last).getTime(),
    header: 'Last Game',
    size: 110,
    cell: ({ row }) => (
      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
        {formatDate(row.original.last)}
      </span>
    ),
  },
  {
    id: 'count',
    accessorKey: 'count',
    header: 'Games',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
]

/* ── Page component ─────────────────────────────────────── */

export default function Leagues() {
  const { data, isLoading, error, refetch } = useApiQuery<{ data: LeagueEntry[] }>(
    '/api/leagues',
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Leagues</h1>
        <p className={styles.subtitle}>
          All tracked professional leagues and tournaments
        </p>
      </div>

      {isLoading && <EnigmaLoader text="Loading leagues..." />}

      {error && (
        <ErrorState
          message="Failed to load leagues"
          rawDetail={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'last', desc: true }]}
          searchableColumns={['name', 'tier', 'tags']}
        />
      )}
    </div>
  )
}
