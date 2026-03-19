import { useMemo } from 'react'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

interface RuneDistRow {
  byWinner: number | null
  byLoser: number | null
  count: number
}

export default function ScenarioFirstWisdoms() {
  const {
    filters,
    setFilters,
    clearFilters,
    applyDefaults,
    apiParams,
    hasFilters,
    filtersCollapsed,
    setFiltersCollapsed,
  } = useFilters()

  const { data, isLoading, error } = useApiQuery<{ data: RuneDistRow[] }>(
    hasFilters ? '/api/scenarios/first-wisdoms' : null,
    apiParams,
  )

  const stats = useMemo(() => {
    const raw = data?.data
    if (!raw || raw.length === 0) return null
    const total = raw.reduce((s, r) => s + r.count, 0)
    if (total === 0) return null

    // Shared = both teams got 1
    const shared = raw.find((r) => (r.byWinner ?? 0) === 1 && (r.byLoser ?? 0) === 1)?.count ?? 0
    // One team got both: winner got 2 (W) vs loser got 2 (L from winner's perspective)
    const winnerGotBoth = raw.find((r) => (r.byWinner ?? 0) === 2 && (r.byLoser ?? 0) === 0)?.count ?? 0
    const loserGotBoth = raw.find((r) => (r.byWinner ?? 0) === 0 && (r.byLoser ?? 0) === 2)?.count ?? 0
    const oneSided = winnerGotBoth + loserGotBoth

    return { total, shared, oneSided, winnerGotBoth, loserGotBoth }
  }, [data])

  const statLine = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.95rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 2.2,
  }
  const hl = (color: string) => ({ color, fontWeight: 700 } as const)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>First Wisdom Runes</h1>
        <p className={styles.subtitle}>
          Distribution of the first 2 wisdom rune pickups (before 14:00) between winning and losing teams
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={['teams', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching wisdom rune data..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {stats && (
        <div style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '28px 36px',
          maxWidth: 720,
          margin: '24px auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 20, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Across <span style={hl('var(--color-primary)')}>{stats.total.toLocaleString()}</span> matches
          </div>
          <div style={statLine}>
            In <span style={hl('var(--color-primary)')}>{(stats.shared / stats.total * 100).toFixed(1)}%</span> of games, the teams share the runes 1–1.
          </div>
          <div style={statLine}>
            In <span style={hl('var(--color-primary)')}>{(stats.oneSided / stats.total * 100).toFixed(1)}%</span> of
            games, one team gets both starting wisdom runes — that team has
            gone <span style={hl('#2dd4bf')}>{stats.winnerGotBoth.toLocaleString()}</span>–<span style={hl('#c48bc4')}>{stats.loserGotBoth.toLocaleString()}</span>
            {' '}(<span style={hl('#2dd4bf')}>{stats.oneSided > 0 ? (stats.winnerGotBoth / stats.oneSided * 100).toFixed(1) : '—'}%</span>).
          </div>
        </div>
      )}
    </div>
  )
}
