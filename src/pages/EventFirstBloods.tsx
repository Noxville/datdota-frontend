import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { NumericCell, PercentCell, PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import TimeDistributionChart from '../components/TimeDistributionChart'
import { heroesById } from '../data/heroes'
import { heroImageUrl } from '../config'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'
import entityStyles from './EntityShow.module.css'

function HeroIconCell({ heroId }: { heroId: number }) {
  const pic = heroesById[String(heroId)]?.picture
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img src={src} alt="" style={{ width: 28, height: 16, objectFit: 'cover', borderRadius: 2 }} loading="lazy" />
  ) : null
}

interface FirstBlood {
  matchId: number
  time: number
  killer: { steamId: number; nickname: string; hero: number }
  victim: { steamId: number; nickname: string; hero: number }
}

const TABS = ['fastest', 'slowest'] as const
type Tab = (typeof TABS)[number]
type View = 'table' | 'summary'

const TAB_LABELS: Record<Tab, string> = {
  fastest: 'Fastest',
  slowest: 'Slowest',
}

function parseHash(): { tab: Tab; view: View } {
  const hash = window.location.hash.replace('#', '')
  const params = new URLSearchParams(hash)
  const tab = (params.get('tab') as Tab) || 'fastest'
  const view = (params.get('view') as View) || 'table'
  return {
    tab: TABS.includes(tab) ? tab : 'fastest',
    view: view === 'summary' ? 'summary' : 'table',
  }
}

function writeHash(tab: Tab, view: View) {
  const params = new URLSearchParams()
  if (tab !== 'fastest') params.set('tab', tab)
  if (view !== 'table') params.set('view', view)
  const hash = params.toString()
  const url = window.location.pathname + window.location.search + (hash ? '#' + hash : '')
  window.history.replaceState(null, '', url)
}

const columns: ColumnDef<FirstBlood, unknown>[] = [
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
    id: 'time',
    accessorKey: 'time',
    header: 'Time',
    size: 80,
    meta: { numeric: true, tooltip: 'Time of First Blood' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'killerHero',
    accessorFn: (row) => row.killer.hero,
    header: 'K Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.killer.hero} />,
  },
  {
    id: 'killerName',
    accessorFn: (row) => row.killer.nickname,
    header: 'Killer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.killer.steamId} nickname={row.original.killer.nickname} />
    ),
  },
  {
    id: 'victimHero',
    accessorFn: (row) => row.victim.hero,
    header: 'V Hero',
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.victim.hero} />,
  },
  {
    id: 'victimName',
    accessorFn: (row) => row.victim.nickname,
    header: 'Victim',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.victim.steamId} nickname={row.original.victim.nickname} />
    ),
  },
]

/* ── Summary aggregation ──────────────────────────────── */

interface PlayerSummary {
  steamId: number
  nickname: string
  count: number
  total: number
  pct: number
}

function aggregatePlayers(
  allRows: FirstBlood[],
  side: 'killer' | 'victim',
): PlayerSummary[] {
  const map = new Map<number, { steamId: number; nickname: string; count: number }>()
  for (const row of allRows) {
    const p = row[side]
    const entry = map.get(p.steamId)
    if (entry) {
      entry.count++
      // Keep latest nickname
      entry.nickname = p.nickname
    } else {
      map.set(p.steamId, { steamId: p.steamId, nickname: p.nickname, count: 1 })
    }
  }
  const total = allRows.length
  return [...map.values()].map((e) => ({
    ...e,
    total,
    pct: total > 0 ? e.count / total : 0,
  }))
}

const killerSummaryColumns: ColumnDef<PlayerSummary, unknown>[] = [
  {
    id: 'player',
    accessorKey: 'nickname',
    header: 'Player',
    size: 160,
    cell: ({ row }) => <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />,
  },
  {
    id: 'kills',
    accessorKey: 'count',
    header: 'FB Kills',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'First blood kills' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'pct',
    accessorKey: 'pct',
    header: '%',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Percentage of all first bloods' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

const victimSummaryColumns: ColumnDef<PlayerSummary, unknown>[] = [
  {
    id: 'player',
    accessorKey: 'nickname',
    header: 'Player',
    size: 160,
    cell: ({ row }) => <PlayerCell steamId={row.original.steamId} nickname={row.original.nickname} />,
  },
  {
    id: 'deaths',
    accessorKey: 'count',
    header: 'FB Deaths',
    size: 80,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'First blood deaths' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'pct',
    accessorKey: 'pct',
    header: '%',
    size: 70,
    meta: { numeric: true, heatmap: 'high-bad', tooltip: 'Percentage of all first bloods' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

/* ── Page ──────────────────────────────────────────────── */

export default function EventFirstBloods() {
  const [tab, setTab] = useState<Tab>(() => parseHash().tab)
  const [view, setView] = useState<View>(() => parseHash().view)

  const selectTab = useCallback((t: Tab) => {
    setTab(t)
    writeHash(t, view)
  }, [view])

  const selectView = useCallback((v: View) => {
    setView(v)
    writeHash(tab, v)
  }, [tab])

  useEffect(() => {
    function onHashChange() {
      const parsed = parseHash()
      setTab(parsed.tab)
      setView(parsed.view)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  const { data, isLoading, error } = useApiQuery<{ data: { fastest: FirstBlood[]; slowest: FirstBlood[] } }>(
    hasFilters ? '/api/events/first-bloods' : null,
    apiParams,
  )

  const fastestRows = useMemo(() => data?.data?.fastest ?? [], [data])
  const slowestRows = useMemo(() => data?.data?.slowest ?? [], [data])
  const allRows = useMemo(() => [...fastestRows, ...slowestRows], [fastestRows, slowestRows])
  const hasData = fastestRows.length > 0 || slowestRows.length > 0
  const times = useMemo(() => allRows.map((r) => r.time), [allRows])

  const killerSummary = useMemo(() => aggregatePlayers(allRows, 'killer'), [allRows])
  const victimSummary = useMemo(() => aggregatePlayers(allRows, 'victim'), [allRows])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>First Bloods</h1>
        <p className={styles.subtitle}>
          First blood events in professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
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

      {isLoading && hasFilters && <EnigmaLoader text="Fetching first blood data..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {hasData && (
        <>
          <TimeDistributionChart times={times} />

          {/* View toggle: Table | Summary */}
          <div className={toggleStyles.toggleRow}>
            <button
              className={`${toggleStyles.toggleBtn} ${view === 'table' ? toggleStyles.toggleActive : ''}`}
              onClick={() => selectView('table')}
            >
              Table
            </button>
            <button
              className={`${toggleStyles.toggleBtn} ${view === 'summary' ? toggleStyles.toggleActive : ''}`}
              onClick={() => selectView('summary')}
            >
              Summary
            </button>
          </div>

          {view === 'table' && (
            <>
              {/* Sub-tab: Fastest | Slowest */}
              <div className={toggleStyles.toggleRow}>
                {TABS.map((t) => (
                  <button
                    key={t}
                    className={`${toggleStyles.toggleBtn} ${tab === t ? toggleStyles.toggleActive : ''}`}
                    onClick={() => selectTab(t)}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>

              {tab === 'fastest' && fastestRows.length > 0 && (
                <DataTable
                  data={fastestRows}
                  columns={columns}
                  defaultSorting={[{ id: 'time', desc: false }]}
                  searchableColumns={['killerName', 'victimName']}
                />
              )}
              {tab === 'slowest' && slowestRows.length > 0 && (
                <DataTable
                  data={slowestRows}
                  columns={columns}
                  defaultSorting={[{ id: 'time', desc: true }]}
                  searchableColumns={['killerName', 'victimName']}
                />
              )}
            </>
          )}

          {view === 'summary' && (
            <div className={entityStyles.columns}>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  marginBottom: 'var(--space-sm)',
                }}>
                  First Blood Killers
                </h3>
                <DataTable
                  data={killerSummary}
                  columns={killerSummaryColumns}
                  defaultSorting={[{ id: 'kills', desc: true }]}
                  searchableColumns={['player']}
                />
              </div>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  marginBottom: 'var(--space-sm)',
                }}>
                  First Blood Victims
                </h3>
                <DataTable
                  data={victimSummary}
                  columns={victimSummaryColumns}
                  defaultSorting={[{ id: 'deaths', desc: true }]}
                  searchableColumns={['player']}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
