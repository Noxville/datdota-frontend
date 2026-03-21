import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { type ColumnDef, type ColumnHelper, createColumnHelper } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { teamLogoUrl } from '../config'
import DataTable, { NumericCell, DeltaCell, TeamCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import type { RatingEntry } from '../types'
import styles from './Ratings.module.css'

/** Glicko lower bound: μ − 2.5φ */
function glickoLB(mu: number | null, phi: number | null): number | null {
  if (mu === null || phi === null) return null
  return mu - 2.5 * phi
}

/** Format date as dd-MM-yyyy for the API */
function formatDateParam(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}-${m}-${y}`
}

interface RatingsRow extends RatingEntry {
  rank: number
  glicko2LowerBound: number | null
  glicko2Delta7d: number | null
  glicko1LowerBound: number | null
  glicko1Delta7d: number | null
}

function prepareRows(data: RatingEntry[]): RatingsRow[] {
  return data
    .map((entry) => ({
      ...entry,
      rank: 0,
      glicko2LowerBound: glickoLB(entry.glicko2.mu, entry.glicko2.phi),
      glicko2Delta7d:
        entry.glicko2.rating !== null && entry.glicko2.ratingSevenDaysAgo !== null
          ? entry.glicko2.rating - entry.glicko2.ratingSevenDaysAgo
          : null,
      glicko1LowerBound: glickoLB(entry.glicko.mu, entry.glicko.sigma),
      glicko1Delta7d:
        entry.glicko.rating !== null && entry.glicko.ratingSevenDaysAgo !== null
          ? entry.glicko.rating - entry.glicko.ratingSevenDaysAgo
          : null,
    }))
    .filter((r) => r.glicko2.phi !== null && r.glicko2.phi < 100)
    .sort((a, b) => (b.glicko2LowerBound ?? 0) - (a.glicko2LowerBound ?? 0))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

const ch: ColumnHelper<RatingsRow> = createColumnHelper<RatingsRow>()

const columns: ColumnDef<RatingsRow, unknown>[] = [
  ch.accessor('rank', {
    id: 'rank',
    header: '#',
    size: 50,
    meta: { numeric: true },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
    enableSorting: false,
  }) as ColumnDef<RatingsRow, unknown>,
  ch.accessor('teamName', {
    id: 'teamName',
    header: 'Team',
    size: 200,
    enableSorting: false,
    cell: ({ row }) => (
      <TeamCell
        valveId={row.original.valveId}
        name={row.original.teamName}
        logoUrl={teamLogoUrl(row.original.logoId)}
      />
    ),
  }) as ColumnDef<RatingsRow, unknown>,
  ch.group({
    id: 'glicko2Group',
    header: 'Glicko 2',
    columns: [
      ch.accessor('glicko2LowerBound', {
        id: 'glicko2LowerBound',
        header: 'Rating',
        size: 85,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Lower Bound (μ − 2.5φ)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor((row) => row.glicko2.mu, {
        id: 'g2mu',
        header: 'Mu',
        size: 75,
        meta: { numeric: true, tooltip: 'Glicko 2 mean rating (μ)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor((row) => row.glicko2.phi, {
        id: 'g2phi',
        header: 'Phi',
        size: 65,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Uncertainty (lower = more certain)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
      }),
      ch.accessor('glicko2Delta7d', {
        id: 'g2delta',
        header: 'Δ 7d',
        size: 75,
        meta: { numeric: true, tooltip: 'Rating change over 7 days' },
        cell: ({ getValue }) => <DeltaCell value={getValue() as number} />,
      }),
    ],
  }) as ColumnDef<RatingsRow, unknown>,
  ch.group({
    id: 'elo32Group',
    header: 'Elo (k=32)',
    columns: [
      ch.accessor((row) => row.elo32.current, {
        id: 'elo32current',
        header: 'Rating',
        size: 80,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Current Elo (k=32)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor((row) => row.elo32.thirtyDayAvg, {
        id: 'elo32avg30',
        header: 'Avg 30d',
        size: 80,
        meta: { numeric: true, tooltip: 'Elo (k=32) 30-day average' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor(
        (row) => {
          const { current, thirtyDayAgo } = row.elo32
          if (current === null || thirtyDayAgo === null) return null
          return current - thirtyDayAgo
        },
        {
          id: 'elo32delta30',
          header: 'Δ 30d',
          size: 75,
          meta: { numeric: true, tooltip: 'Elo (k=32) change over 30 days' },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} />,
        },
      ),
    ],
  }) as ColumnDef<RatingsRow, unknown>,
  ch.group({
    id: 'glicko1Group',
    header: 'Glicko 1',
    columns: [
      ch.accessor('glicko1LowerBound', {
        id: 'g1rating',
        header: 'Rating',
        size: 85,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Glicko 1 Lower Bound (μ − 2.5·RD)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor((row) => row.glicko.mu, {
        id: 'g1mu',
        header: 'Mu',
        size: 75,
        meta: { numeric: true, tooltip: 'Glicko 1 mean rating (μ)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor((row) => row.glicko.sigma, {
        id: 'g1rd',
        header: 'RD',
        size: 65,
        meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Rating Deviation (lower = more certain)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} decimals={1} />,
      }),
      ch.accessor('glicko1Delta7d', {
        id: 'g1delta',
        header: 'Δ 7d',
        size: 75,
        meta: { numeric: true, tooltip: 'Glicko 1 rating change over 7 days' },
        cell: ({ getValue }) => <DeltaCell value={getValue() as number} />,
      }),
    ],
  }) as ColumnDef<RatingsRow, unknown>,
  ch.group({
    id: 'elo64Group',
    header: 'Elo (k=64)',
    columns: [
      ch.accessor((row) => row.elo64.current, {
        id: 'elo64current',
        header: 'Rating',
        size: 80,
        meta: { numeric: true, heatmap: 'high-good', tooltip: 'Current Elo (k=64)' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor((row) => row.elo64.thirtyDayAvg, {
        id: 'elo64avg30',
        header: 'Avg 30d',
        size: 80,
        meta: { numeric: true, tooltip: 'Elo (k=64) 30-day average' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      }),
      ch.accessor(
        (row) => {
          const { current, thirtyDayAgo } = row.elo64
          if (current === null || thirtyDayAgo === null) return null
          return current - thirtyDayAgo
        },
        {
          id: 'elo64delta30',
          header: 'Δ 30d',
          size: 75,
          meta: { numeric: true, tooltip: 'Elo (k=64) change over 30 days' },
          cell: ({ getValue }) => <DeltaCell value={getValue() as number} />,
        },
      ),
    ],
  }) as ColumnDef<RatingsRow, unknown>,
]

export default function Ratings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const date = searchParams.get('date') ?? ''

  const setDate = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set('date', value)
        } else {
          next.delete('date')
        }
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const params = useMemo(() => {
    if (!date) return {}
    return { date: formatDateParam(date) }
  }, [date])

  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: RatingEntry[] }>(
    '/api/ratings',
    params,
  )

  const rows = useMemo(() => prepareRows(raw?.data ?? []), [raw])

  const ratingDate = raw?.data?.[0]?.glickoRatingDate
    ? new Date(raw.data[0].glickoRatingDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Team Ratings</h1>
          <p className={styles.subtitle}>
            Various ratings (Glicko / Elo based) for teams active in tier 1–2 events
            {ratingDate && <span className={styles.date}> — as of {ratingDate}</span>}
          </p>
        </div>
        <div className={styles.datePicker}>
          <label className={styles.dateLabel}>Historical date</label>
          <input
            type="date"
            className={styles.dateInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {date && (
            <button className={styles.clearDate} onClick={() => setDate('')}>
              Current
            </button>
          )}
        </div>
      </div>

      {isLoading && <EnigmaLoader text="Loading ratings..." />}

      {error && (
        <ErrorState
          message="Failed to load ratings"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'glicko2LowerBound', desc: true }]}
          searchableColumns={['teamName']}
        />
      )}
    </div>
  )
}
