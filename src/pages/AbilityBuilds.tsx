import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { abilityImageUrl } from '../config'
import { abilities } from '../data/abilities'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface AbilityBuildLine {
  abilities: number[]
  games: number
  wins: number
}

/* ── Helpers ────────────────────────────────────────────── */

function abilityName(id: number): string {
  const a = abilities[String(id)]
  return a?.longName || a?.shortName || `Ability ${id}`
}

function abilityIcon(id: number): string | null {
  const a = abilities[String(id)]
  return a?.shortName ? abilityImageUrl(a.shortName) : null
}

function AbilitySequenceCell({ ids }: { ids: number[] }) {
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {ids.map((id, i) => {
        const src = abilityIcon(id)
        const name = abilityName(id)
        return (
          <span key={i} title={`Lv ${i + 1}: ${name}`}>
            {src ? (
              <img
                src={src}
                alt={name}
                style={{ height: 22, width: 22, borderRadius: 2 }}
                loading="lazy"
              />
            ) : (
              <span style={{
                display: 'inline-block',
                width: 22,
                height: 22,
                lineHeight: '22px',
                textAlign: 'center',
                fontSize: '0.5rem',
                background: 'var(--color-bg-elevated)',
                borderRadius: 2,
                color: 'var(--color-text-muted)',
              }}>
                {id}
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

function abilitySequenceText(ids: number[]): string {
  return ids.map((id) => abilityName(id)).join(' > ')
}

/* ── Columns ───────────────────────────────────────────── */

const columns: ColumnDef<AbilityBuildLine, unknown>[] = [
  {
    id: 'build',
    accessorFn: (row) => abilitySequenceText(row.abilities),
    header: 'Build Order',
    size: 300,
    enableSorting: false,
    cell: ({ row }) => <AbilitySequenceCell ids={row.original.abilities} />,
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'wins',
    header: 'Wins',
    size: 70,
    meta: { numeric: true, tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'losses',
    accessorFn: (row) => row.games - row.wins,
    header: 'Losses',
    size: 70,
    meta: { numeric: true, tooltip: 'Losses' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorFn: (row) => (row.games > 0 ? row.wins / row.games : 0),
    header: 'Win %',
    size: 75,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

/* ── Label/input styles (matching Frames) ──────────────── */

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

/* ── Page component ─────────────────────────────────────── */

export default function AbilityBuilds() {
  const {
    filters, setFilters, clearFilters, applyDefaults, apiParams, hasFilters,
    updateFilter, filtersCollapsed, setFiltersCollapsed,
  } = useFilters(['level-from', 'level-to'])

  const levelFrom = filters['level-from'] ?? '1'
  const levelTo = filters['level-to'] ?? '7'

  const { data, isLoading, error } = useApiQuery<{ data: AbilityBuildLine[] }>(
    hasFilters ? '/api/ability/builds' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data?.data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Ability Builds</h1>
        <p className={styles.subtitle}>
          Most common ability skill orders across levels {levelFrom}–{levelTo}
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['heroes', 'players', 'teams', 'patch', 'after', 'before', 'leagues', 'splits', 'tier', 'split-type', 'threshold']}
        extraChips={[
          { label: 'Levels', value: `${levelFrom}–${levelTo}` },
        ]}
        renderExtra={() => (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-sm)',
            maxWidth: 240,
          }}>
            <div>
              <label style={labelStyle}>Level From</label>
              <input
                type="number"
                min={1}
                max={30}
                value={levelFrom}
                onChange={(e) => updateFilter('level-from', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Level To</label>
              <input
                type="number"
                min={1}
                max={30}
                value={levelTo}
                onChange={(e) => updateFilter('level-to', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Select filters to query ability builds.</p>
          <Link to="/abilities/builds?default=true" className={styles.defaultLink} onClick={(e) => { e.preventDefault(); applyDefaults(); updateFilter('level-from', '1'); updateFilter('level-to', '7') }}>
            Load defaults
          </Link>
        </div>
      )}

      {hasFilters && isLoading && <EnigmaLoader text="Crunching ability builds..." />}

      {hasFilters && error && (
        <div className={styles.error}>
          Failed to load ability builds. {error instanceof Error ? error.message : ''}
        </div>
      )}

      {hasFilters && !isLoading && !error && rows.length === 0 && (
        <div className={styles.empty}>
          <p>No ability builds found for these filters.</p>
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'games', desc: true }]}
          searchableColumns={['build']}
        />
      )}
    </div>
  )
}
