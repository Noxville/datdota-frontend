import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './PlayerPerformances.module.css'

interface DraftLine {
  hero: number
  heroName: string
  heroImageName: string
  picks: number
  firstPhasePicks: number
  secondPhasePicks: number
  thirdPhasePicks: number
  bans: number
  firstPhaseBans: number
  secondPhaseBans: number
  thirdPhaseBans: number
  wins: number
  losses: number
  winPercent: number
  pickPercent: number
  banPercent: number
}

function HeroIconCell({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  const name = hero?.name ?? `Hero ${heroId}`
  const src = pic ? heroImageUrl(pic) : undefined
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {src && <img src={src} alt={name} title={name} style={{ height: 22, width: 'auto' }} loading="lazy" />}
      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{name}</span>
    </span>
  )
}

function HeroIconGrid({ heroIds, label }: { heroIds: number[]; label: string }) {
  if (heroIds.length === 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: '0.78rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-text-muted)',
        marginBottom: 6,
      }}>
        {label} <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>({heroIds.length})</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {heroIds.map((id) => {
          const hero = heroesById[String(id)]
          const pic = hero?.picture
          const name = hero?.name ?? `Hero ${id}`
          const src = pic ? heroImageUrl(pic) : undefined
          return src ? (
            <img
              key={id}
              src={src}
              alt={name}
              title={name}
              style={{ height: 20, width: 'auto', borderRadius: 2, opacity: 0.85 }}
              loading="lazy"
            />
          ) : (
            <span
              key={id}
              title={name}
              style={{
                fontSize: '0.6rem',
                padding: '2px 4px',
                background: 'var(--color-bg)',
                borderRadius: 2,
                color: 'var(--color-text-muted)',
              }}
            >
              {name}
            </span>
          )
        })}
      </div>
    </div>
  )
}

const columns: ColumnDef<DraftLine, unknown>[] = [
  {
    id: 'hero',
    accessorFn: (row) => heroesById[String(row.hero)]?.name ?? row.heroName,
    header: 'Hero',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'picks',
    header: 'Picks',
    columns: [
      {
        id: 'pickCount',
        accessorKey: 'picks',
        header: 'Count',
        size: 70,
        meta: { numeric: true, tooltip: 'Total times picked' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'pickPct',
        accessorKey: 'pickPercent',
        header: '%',
        size: 65,
        meta: { numeric: true, tooltip: 'Pick rate (% of games)', heatmap: 'high-good' as const },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
      {
        id: 'p1Picks',
        accessorKey: 'firstPhasePicks',
        header: 'P1',
        size: 55,
        meta: { numeric: true, tooltip: '1st phase picks' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'p2Picks',
        accessorKey: 'secondPhasePicks',
        header: 'P2',
        size: 55,
        meta: { numeric: true, tooltip: '2nd phase picks' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'p3Picks',
        accessorKey: 'thirdPhasePicks',
        header: 'P3',
        size: 55,
        meta: { numeric: true, tooltip: '3rd phase picks' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'winPct',
        accessorKey: 'winPercent',
        header: 'Win%',
        size: 65,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Win rate when picked' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'bans',
    header: 'Bans',
    columns: [
      {
        id: 'banCount',
        accessorKey: 'bans',
        header: 'Count',
        size: 70,
        meta: { numeric: true, tooltip: 'Total times banned' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'banPct',
        accessorKey: 'banPercent',
        header: '%',
        size: 65,
        meta: { numeric: true, tooltip: 'Ban rate (% of games)', heatmap: 'high-good' as const },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
      {
        id: 'p1Bans',
        accessorKey: 'firstPhaseBans',
        header: 'P1',
        size: 55,
        meta: { numeric: true, tooltip: '1st phase bans' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'p2Bans',
        accessorKey: 'secondPhaseBans',
        header: 'P2',
        size: 55,
        meta: { numeric: true, tooltip: '2nd phase bans' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'p3Bans',
        accessorKey: 'thirdPhaseBans',
        header: 'P3',
        size: 55,
        meta: { numeric: true, tooltip: '3rd phase bans' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
    ],
  },
  {
    id: 'contestation',
    header: 'P+B',
    columns: [
      {
        id: 'totalPB',
        accessorFn: (row) => row.picks + row.bans,
        header: 'Total',
        size: 70,
        meta: { numeric: true, tooltip: 'Total picks + bans' },
        cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
      },
      {
        id: 'totalPBPct',
        accessorFn: (row) => (row.pickPercent ?? 0) + (row.banPercent ?? 0),
        header: '%',
        size: 65,
        meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Contestation rate (pick% + ban%)' },
        cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
      },
    ],
  },
]

export default function Drafts() {
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

  const { data, isLoading, error } = useApiQuery<{ data: DraftLine[] }>(
    hasFilters ? '/api/drafts' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data])

  const totalGames = useMemo(() => {
    if (rows.length === 0) return 0
    return Math.round(rows.reduce((sum, r) => sum + r.picks, 0) / 10)
  }, [rows])

  const sortByName = (a: number, b: number) => {
    const na = heroesById[String(a)]?.name ?? ''
    const nb = heroesById[String(b)]?.name ?? ''
    return na.localeCompare(nb)
  }

  // Heroes in constants but completely absent from API response
  const uncontested = useMemo(() => {
    if (rows.length === 0) return []
    const presentIds = new Set(rows.map((r) => r.hero))
    return Object.keys(heroesById)
      .map(Number)
      .filter((id) => !presentIds.has(id))
      .sort(sortByName)
  }, [rows])

  const unpicked = useMemo(
    () => [
      ...rows.filter((r) => r.picks === 0).map((r) => r.hero),
      ...uncontested,
    ].sort(sortByName),
    [rows, uncontested],
  )
  const unbanned = useMemo(
    () => [
      ...rows.filter((r) => r.bans === 0).map((r) => r.hero),
      ...uncontested,
    ].sort(sortByName),
    [rows, uncontested],
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Drafts Summary</h1>
        <p className={styles.subtitle}>
          Hero pick and ban rates across professional matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier', 'draft-filters']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching draft data..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 16,
            padding: '10px 14px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ color: 'var(--color-text-muted)' }}>
              ~<span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{totalGames.toLocaleString()}</span> games
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Unpicked: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{unpicked.length}</span>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Unbanned: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{unbanned.length}</span>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Uncontested: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{uncontested.length}</span>
            </span>
          </div>

          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'totalPB', desc: true }]}
            searchableColumns={['hero']}
          />

          <div style={{
            marginTop: 24,
            padding: '16px',
            background: 'var(--color-bg-elevated)',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
          }}>
            <HeroIconGrid heroIds={uncontested} label="Uncontested Heroes (not picked or banned)" />
            <HeroIconGrid heroIds={unpicked} label="Unpicked Heroes" />
            <HeroIconGrid heroIds={unbanned} label="Unbanned Heroes" />
          </div>
        </>
      )}
    </div>
  )
}
