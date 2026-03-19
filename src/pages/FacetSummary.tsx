import { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { tooltipsAndFacets } from '../data/tooltips-and-facets'
import DataTable, { NumericCell, PercentCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { FacetSummaryLine } from '../types'
import styles from './PlayerPerformances.module.css'

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function HeroIconCell({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  const name = hero?.name ?? `Hero ${heroId}`
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img src={src} alt={name} title={name} style={{ height: 22, width: 'auto' }} loading="lazy" />
  ) : (
    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

/** Strip HTML tags and convert %template% vars to styled spans */
function formatTooltipText(raw: string): (string | React.ReactElement)[] {
  // Strip HTML tags
  const stripped = raw.replace(/<[^>]+>/g, '')
  // Split on %...% template vars
  const parts = stripped.split(/(%[^%]+%)/)
  return parts.map((part, i) => {
    if (part.startsWith('%') && part.endsWith('%')) {
      return (
        <span key={i} style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          {part}
        </span>
      )
    }
    return part
  })
}

function FacetCell({ facetKey }: { facetKey: string }) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const entry = tooltipsAndFacets[facetKey]
  const displayName = entry?.longName ?? facetKey

  const handleEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltipPos({ x: rect.left, y: rect.top })
  }, [])
  const handleLeave = useCallback(() => setTooltipPos(null), [])

  return (
    <span
      style={{ fontSize: '0.8rem', cursor: entry?.tooltip ? 'help' : 'default' }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {displayName}
      {tooltipPos && entry?.tooltip && createPortal(
        <span
          style={{
            position: 'fixed',
            top: tooltipPos.y - 8,
            left: tooltipPos.x,
            transform: 'translateY(-100%)',
            padding: '8px 12px',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            maxWidth: 320,
            width: 'max-content',
            zIndex: 10000,
            whiteSpace: 'normal',
            pointerEvents: 'none',
          }}
        >
          {formatTooltipText(entry.tooltip)}
        </span>,
        document.body,
      )}
    </span>
  )
}

const columns: ColumnDef<FacetSummaryLine, unknown>[] = [
  {
    id: 'hero',
    accessorFn: (row) => heroName(row.hero),
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.hero} />,
  },
  {
    id: 'facetName',
    accessorFn: (row) => {
      const entry = tooltipsAndFacets[row.facetName]
      return entry?.longName ?? row.facetName
    },
    header: 'Facet',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => <FacetCell facetKey={row.original.facetName} />,
  },
  {
    id: 'patchName',
    accessorKey: 'patchName',
    header: 'Patch',
    size: 80,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{getValue() as string}</span>
    ),
  },
  {
    id: 'numGames',
    accessorKey: 'numGames',
    header: 'Games',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Total Games' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'numWins',
    accessorKey: 'numWins',
    header: 'W',
    size: 65,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Wins' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winPercent',
    accessorKey: 'winPercent',
    header: 'Win %',
    size: 80,
    meta: { numeric: true, heatmap: 'high-good', tooltip: 'Win Rate' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

export default function FacetSummary() {
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

  const { data, isLoading, error } = useApiQuery<{ data: { facets: FacetSummaryLine[] } }>(
    hasFilters ? '/api/facets/summary' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data?.facets ?? [], [data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Facet Summary</h1>
        <p className={styles.subtitle}>
          Hero facet pick rates and win rates across filtered matches
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
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

      {isLoading && <EnigmaLoader text="Fetching facet data..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'numGames', desc: true }]}
          searchableColumns={['hero', 'facetName']}
        />
      )}
    </div>
  )
}
