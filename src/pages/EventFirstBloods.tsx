import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import TimeDistributionChart from '../components/TimeDistributionChart'
import { heroesById } from '../data/heroes'
import { heroImageUrl } from '../config'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

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

const TAB_LABELS: Record<Tab, string> = {
  fastest: 'Fastest',
  slowest: 'Slowest',
}

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '') as Tab
  if (TABS.includes(hash)) return hash
  return 'fastest'
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

export default function EventFirstBloods() {
  const [tab, setTab] = useState<Tab>(getInitialTab)

  const selectTab = useCallback((t: Tab) => {
    setTab(t)
    window.location.hash = `#${t}`
  }, [])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '') as Tab
      if (TABS.includes(hash)) setTab(hash)
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
  const hasData = fastestRows.length > 0 || slowestRows.length > 0
  const times = useMemo(() => [...fastestRows, ...slowestRows].map((r) => r.time), [fastestRows, slowestRows])

  useEffect(() => {
    if (hasData && !window.location.hash) {
      window.location.hash = `#${tab}`
    }
  }, [hasData, tab])

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
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
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
    </div>
  )
}
