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

interface SplitStat {
  label: string
  wins: number
  losses: number
  total: number
}

export default function ScenarioBountyBazinga() {
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
    hasFilters ? '/api/scenarios/bounty-bazinga' : null,
    apiParams,
  )

  const stats = useMemo(() => {
    const raw = data?.data
    if (!raw || raw.length === 0) return null
    const total = raw.reduce((s, r) => s + r.count, 0)
    if (total === 0) return null

    // Build lookup: (w, l) -> count
    const lookup = new Map<string, number>()
    for (const r of raw) {
      lookup.set(`${r.byWinner ?? 0}-${r.byLoser ?? 0}`, r.count)
    }
    const get = (w: number, l: number) => lookup.get(`${w}-${l}`) ?? 0

    // Even split: 2-2
    const even = get(2, 2)

    // Splits where one team gets more
    const splits: SplitStat[] = []
    // 3-1 vs 1-3
    const w31 = get(3, 1)
    const w13 = get(1, 3)
    if (w31 + w13 > 0) splits.push({ label: '3–1', wins: w31, losses: w13, total: w31 + w13 })
    // 4-0 vs 0-4
    const w40 = get(4, 0)
    const w04 = get(0, 4)
    if (w40 + w04 > 0) splits.push({ label: '4–0', wins: w40, losses: w04, total: w40 + w04 })

    const uneven = total - even

    return { total, even, uneven, splits }
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
        <h1>Bounty Bazinga</h1>
        <p className={styles.subtitle}>
          Distribution of initial bounty rune pickups (before 1:00) between winning and losing teams
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={['patch', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
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

      {isLoading && hasFilters && <EnigmaLoader text="Fetching bounty rune data..." />}

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
            In <span style={hl('var(--color-primary)')}>{(stats.even / stats.total * 100).toFixed(1)}%</span> of games, the teams share the bounty runes 2–2.
          </div>
          <div style={statLine}>
            In <span style={hl('var(--color-primary)')}>{(stats.uneven / stats.total * 100).toFixed(1)}%</span> of games, one team secures more bounty runes:
          </div>
          {stats.splits.map((sp) => (
            <div key={sp.label} style={{ ...statLine, paddingLeft: 24 }}>
              {sp.label} split: the team with more has
              gone <span style={hl('#2dd4bf')}>{sp.wins.toLocaleString()}</span>–<span style={hl('#c48bc4')}>{sp.losses.toLocaleString()}</span>
              {' '}(<span style={hl('#2dd4bf')}>{sp.total > 0 ? (sp.wins / sp.total * 100).toFixed(1) : '—'}%</span>).
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
