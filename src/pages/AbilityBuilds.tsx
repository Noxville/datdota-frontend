import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import TableSkeleton from '../components/TableSkeleton'
import PageMeta from '../components/PageMeta'
import AbilityIcon, { AbilitySequenceCell, abilityName } from '../components/AbilityIcon'
import styles from './PlayerPerformances.module.css'
import abStyles from './AbilityBuilds.module.css'

/** Hide the spell filter when the result set spans more spells than this
 *  (e.g. no hero selected). It stays usable once narrowed to a hero or two. */
const SPELL_CAP = 80

type SpellMode = 'filter' | 'highlight'
type Constraint = 'in' | 'out'

/* ── Types ──────────────────────────────────────────────── */

interface AbilityBuildLine {
  abilities: number[]
  games: number
  wins: number
}

/* ── Helpers ────────────────────────────────────────────── */

function abilitySequenceText(ids: number[]): string {
  return ids.map((id) => abilityName(id)).join(' > ')
}

/* ── Columns ───────────────────────────────────────────── */

function buildColumns(apiParams: Record<string, string>): ColumnDef<AbilityBuildLine, unknown>[] {
  /** Build a link to the matches drilldown, forwarding current filters */
  function matchesHref(abilities: number[]): string {
    const params = new URLSearchParams(apiParams)
    params.set('abilities', abilities.join(','))
    return `/abilities/builds/matches?${params.toString()}`
  }

  return [
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
    {
      id: 'matches',
      accessorFn: () => '',
      header: 'Matches',
      size: 70,
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to={matchesHref(row.original.abilities)}
          style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.78rem' }}
        >
          View
        </Link>
      ),
    },
  ]
}

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
  const columns = useMemo(() => buildColumns(apiParams), [apiParams])

  /* ── Spell filter (client-side, synced to URL for deep linking) ── */
  const [searchParams, setSearchParams] = useSearchParams()

  const spellMode: SpellMode = searchParams.get('spell-mode') === 'highlight' ? 'highlight' : 'filter'

  const constraints = useMemo(() => {
    const c: Record<number, Constraint> = {}
    for (const key of ['spell-in', 'spell-out'] as const) {
      const mode: Constraint = key === 'spell-in' ? 'in' : 'out'
      for (const part of (searchParams.get(key) ?? '').split(',')) {
        const id = Number(part)
        if (part && Number.isInteger(id)) c[id] = mode
      }
    }
    return c
  }, [searchParams])

  // Distinct spells in the current rows, most common first.
  const spellOptions = useMemo(() => {
    const freq = new Map<number, number>()
    for (const row of rows) {
      const seen = new Set<number>()
      for (const id of row.abilities) {
        if (seen.has(id)) continue
        seen.add(id)
        freq.set(id, (freq.get(id) ?? 0) + 1)
      }
    }
    return [...freq.entries()]
      .map(([id, count]) => ({ id, count, name: abilityName(id) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [rows])

  const presentIds = useMemo(() => new Set(spellOptions.map((o) => o.id)), [spellOptions])

  // Only apply constraints for spells still present, so switching hero never
  // leaves a stale rule that empties the table.
  const activeConstraints = useMemo(
    () => Object.entries(constraints)
      .map(([id, mode]) => [Number(id), mode] as const)
      .filter(([id]) => presentIds.has(id)),
    [constraints, presentIds],
  )

  const matches = useCallback(
    (row: AbilityBuildLine) => {
      for (const [id, mode] of activeConstraints) {
        const has = row.abilities.includes(id)
        if (mode === 'in' && !has) return false
        if (mode === 'out' && has) return false
      }
      return true
    },
    [activeConstraints],
  )

  const writeConstraints = useCallback((next: Record<number, Constraint>) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      const ids = (mode: Constraint) =>
        Object.entries(next).filter(([, m]) => m === mode).map(([id]) => id)
      const ins = ids('in')
      const outs = ids('out')
      if (ins.length) p.set('spell-in', ins.join(',')); else p.delete('spell-in')
      if (outs.length) p.set('spell-out', outs.join(',')); else p.delete('spell-out')
      p.delete('default')
      return p
    }, { replace: true })
  }, [setSearchParams])

  const toggleConstraint = useCallback((id: number, mode: Constraint) => {
    const next = { ...constraints }
    if (next[id] === mode) delete next[id]
    else next[id] = mode
    writeConstraints(next)
  }, [constraints, writeConstraints])

  const setSpellMode = useCallback((mode: SpellMode) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (mode === 'highlight') p.set('spell-mode', 'highlight'); else p.delete('spell-mode')
      return p
    }, { replace: true })
  }, [setSearchParams])

  const displayedRows = useMemo(() => {
    if (spellMode === 'filter' && activeConstraints.length > 0) return rows.filter(matches)
    return rows
  }, [rows, spellMode, activeConstraints, matches])

  const rowClassName = useMemo(() => {
    if (spellMode !== 'highlight' || activeConstraints.length === 0) return undefined
    return (row: AbilityBuildLine) => (matches(row) ? abStyles.highlightRow : undefined)
  }, [spellMode, activeConstraints, matches])

  const tooManySpells = spellOptions.length > SPELL_CAP

  return (
    <div className={styles.page}>
      <PageMeta title="Ability Builds — Pro Dota 2 Skill Orders" description="Skill build paths and talent choices for every Dota 2 hero in pro matches." />
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

      {hasFilters && isLoading && <TableSkeleton columns={columns} rows={10} loaderText="Crunching ability builds..." />}

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
        <div className={abStyles.spellPanel}>
          <div className={abStyles.spellHead}>
            <div className={abStyles.spellTitle}>
              Spell filter
              <span className={abStyles.spellMeta}>
                {activeConstraints.length > 0
                  ? spellMode === 'filter'
                    ? `${displayedRows.length} / ${rows.length} builds`
                    : `${rows.filter(matches).length} highlighted`
                  : 'require or exclude a spell'}
              </span>
            </div>
            <div className={abStyles.headRight}>
              <div className={abStyles.seg} role="group" aria-label="Spell filter mode">
                <button
                  type="button"
                  className={abStyles.segBtn}
                  aria-pressed={spellMode === 'filter'}
                  onClick={() => setSpellMode('filter')}
                >
                  Filter
                </button>
                <button
                  type="button"
                  className={abStyles.segBtn}
                  aria-pressed={spellMode === 'highlight'}
                  onClick={() => setSpellMode('highlight')}
                >
                  Highlight
                </button>
              </div>
              {activeConstraints.length > 0 && (
                <button type="button" className={abStyles.clearBtn} onClick={() => writeConstraints({})}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {tooManySpells ? (
            <div className={abStyles.note}>
              {spellOptions.length} spells in these results — narrow by hero to use the spell filter.
            </div>
          ) : (
            <div className={abStyles.spellGrid}>
              {spellOptions.map((opt) => {
                const state = constraints[opt.id]
                return (
                  <div key={opt.id} className={abStyles.spellItem}>
                    <AbilityIcon id={opt.id} />
                    <span className={abStyles.spellName} title={opt.name}>{opt.name}</span>
                    <div className={abStyles.tri}>
                      <button
                        type="button"
                        className={`${abStyles.triBtn} ${abStyles.inOn}`}
                        aria-pressed={state === 'in'}
                        title="Must be in build"
                        onClick={() => toggleConstraint(opt.id, 'in')}
                      >
                        in
                      </button>
                      <button
                        type="button"
                        className={`${abStyles.triBtn} ${abStyles.outOn}`}
                        aria-pressed={state === 'out'}
                        title="Must NOT be in build"
                        onClick={() => toggleConstraint(opt.id, 'out')}
                      >
                        out
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={displayedRows}
          columns={columns}
          defaultSorting={[{ id: 'games', desc: true }]}
          searchValue={(r) => abilitySequenceText(r.abilities)}
          rowClassName={rowClassName}
        />
      )}
    </div>
  )
}
