import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { useTeamAutocomplete } from '../api/autocomplete'
import { fetchTeamNames } from '../api/entityInfo'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { patches } from '../data/patches'
import DataTable from '../components/DataTable'
import LeagueLogo from '../components/LeagueLogo'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import type { MatchFinderEntry, MatchFinderResponse } from '../types'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import filterStyles from '../components/FilterPanel.module.css'

function patchFromMatchId(matchId: number): string {
  for (const p of patches) {
    const pd = p as unknown as { name: string; lowerBound: number; upperBound: number }
    if (matchId >= pd.lowerBound && matchId <= pd.upperBound) return pd.name
  }
  return '—'
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function HeroIcons({ heroIds }: { heroIds: number[] }) {
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {heroIds.map((id) => {
        const hero = heroesById[String(id)]
        const pic = hero?.picture
        const name = hero?.name ?? `Hero ${id}`
        const src = pic ? heroImageUrl(pic) : undefined
        return src ? (
          <img key={id} src={src} alt={name} title={name} style={{ height: 20, width: 'auto' }} loading="lazy" />
        ) : (
          <span key={id} style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }} title={name}>{name}</span>
        )
      })}
    </span>
  )
}

/* ── Inline team autocomplete ─────────────────────────── */
function TeamInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const { data: results } = useTeamAutocomplete(query)
  const ref = useRef<HTMLDivElement>(null)
  const selectedIds = value ? value.split(',').filter(Boolean) : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const unknown = selectedIds.filter((id) => !nameMap[id])
    if (unknown.length > 0) {
      fetchTeamNames(unknown).then((names) => setNameMap((prev) => ({ ...prev, ...names })))
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function addItem(id: string, name: string) {
    const next = selectedIds.includes(id) ? selectedIds : [...selectedIds, id]
    setNameMap((prev) => ({ ...prev, [id]: name }))
    onChange(next.join(','))
    setQuery('')
    setOpen(false)
  }

  function removeItem(id: string) {
    onChange(selectedIds.filter((i) => i !== id).join(','))
  }

  return (
    <div className={filterStyles.filterGroup} ref={ref}>
      <label className={filterStyles.label}>{label}</label>
      <div className={filterStyles.autocompleteWrap}>
        {selectedIds.length > 0 && (
          <div className={filterStyles.tags}>
            {selectedIds.map((id) => (
              <span key={id} className={filterStyles.tag}>
                {nameMap[id] ? `${nameMap[id]} (${id})` : id}
                <button className={filterStyles.tagRemove} onClick={() => removeItem(id)}>&times;</button>
              </span>
            ))}
          </div>
        )}
        <input
          className={filterStyles.input}
          placeholder={`Search teams...`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
        />
        {open && results && results.length > 0 && (
          <div className={filterStyles.dropdown}>
            {results.map((r) => (
              <button
                key={r.team_id}
                className={filterStyles.dropdownItem}
                onClick={() => addItem(String(r.team_id), r.name)}
              >
                {r.name}
                {r.tag && <span style={{ color: 'var(--color-text-muted)' }}> — {r.tag}</span>}
                <span style={{ color: 'var(--color-text-muted)' }}> ({r.team_id})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Inline hero multi-select ─────────────────────────── */
function HeroInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const selected = value ? value.split(',').filter(Boolean) : []
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const heroList = useMemo(() =>
    Object.entries(heroesById)
      .map(([id, h]) => ({ id, name: h.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )

  const filtered = search
    ? heroList.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()))
    : heroList

  function toggle(heroId: string) {
    const next = selected.includes(heroId) ? selected.filter((h) => h !== heroId) : [...selected, heroId]
    onChange(next.join(','))
  }

  const displayText = selected.length > 0
    ? selected.map((id) => heroesById[id]?.name ?? id).join(', ')
    : 'All heroes'

  function remove(heroId: string) {
    onChange(selected.filter((h) => h !== heroId).join(','))
  }

  return (
    <div className={filterStyles.filterGroup} ref={ref}>
      <label className={filterStyles.label}>{label}</label>
      {selected.length > 0 && (
        <div className={filterStyles.tags}>
          {selected.map((id) => (
            <span key={id} className={filterStyles.tag}>
              {heroesById[id]?.name ?? id}
              <button className={filterStyles.tagRemove} onClick={() => remove(id)}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <button className={filterStyles.selectBtn} onClick={() => setOpen(!open)}>
        <span className={filterStyles.selectBtnText}>{displayText}</span>
        <span className={filterStyles.caret}>&#9662;</span>
      </button>
      {open && (
        <div className={filterStyles.dropdown}>
          <div className={filterStyles.dropdownSearch}>
            <input
              className={filterStyles.dropdownSearchInput}
              placeholder="Filter heroes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {filtered.map((h) => (
            <button
              key={h.id}
              className={`${filterStyles.dropdownItem} ${selected.includes(h.id) ? filterStyles.dropdownItemActive : ''}`}
              onClick={() => toggle(h.id)}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const columns: ColumnDef<MatchFinderEntry, unknown>[] = [
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
    id: 'leagueName',
    accessorKey: 'leagueName',
    header: 'League',
    size: 180,
    enableSorting: false,
    cell: ({ row }) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LeagueLogo leagueId={row.original.leagueId} size={28} />
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{row.original.leagueName}</span>
      </span>
    ),
  },
  {
    id: 'patch',
    accessorFn: (row) => patchFromMatchId(row.matchId),
    header: 'Patch',
    size: 65,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{getValue() as string}</span>
    ),
  },
  {
    id: 'date',
    accessorKey: 'date',
    header: 'Date',
    size: 95,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(getValue() as string)}</span>
    ),
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Duration',
    size: 75,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Match Duration' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'radName',
    accessorKey: 'radName',
    header: 'Radiant',
    size: 130,
    enableSorting: false,
    cell: ({ row }) => {
      const won = row.original.radVictory
      return (
        <a
          href={`/teams/${row.original.radTeamId}`}
          style={{ fontSize: '0.8rem', fontWeight: won ? 600 : 400, color: won ? 'var(--color-success)' : 'var(--color-accent-bright)', textDecoration: 'none' }}
        >
          {row.original.radName || 'Unknown'}
        </a>
      )
    },
  },
  {
    id: 'radPicks',
    accessorFn: (row) => row.radPicks.map((id) => heroesById[String(id)]?.name ?? '').join(' '),
    header: 'Radiant Heroes',
    size: 210,
    enableSorting: false,
    cell: ({ row }) => <HeroIcons heroIds={row.original.radPicks} />,
  },
  {
    id: 'direName',
    accessorKey: 'direName',
    header: 'Dire',
    size: 130,
    enableSorting: false,
    cell: ({ row }) => {
      const won = !row.original.radVictory
      return (
        <a
          href={`/teams/${row.original.direTeamId}`}
          style={{ fontSize: '0.8rem', fontWeight: won ? 600 : 400, color: won ? 'var(--color-success)' : 'var(--color-accent-bright)', textDecoration: 'none' }}
        >
          {row.original.direName || 'Unknown'}
        </a>
      )
    },
  },
  {
    id: 'direPicks',
    accessorFn: (row) => row.direPicks.map((id) => heroesById[String(id)]?.name ?? '').join(' '),
    header: 'Dire Heroes',
    size: 210,
    enableSorting: false,
    cell: ({ row }) => <HeroIcons heroIds={row.original.direPicks} />,
  },
  {
    id: 'winner',
    accessorFn: (row) => (row.radVictory ? 'Radiant' : 'Dire'),
    header: 'Winner',
    size: 75,
    enableSorting: false,
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 600 }}>{getValue() as string}</span>
    ),
  },
]

export default function MatchFinder() {
  const [abCollapsed, setAbCollapsed] = useState(false)

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

  // Draft state for A/B inputs — initialized from URL, applied on "Apply Filters"
  const [draftTeamA, setDraftTeamA] = useState(filters['team-a'] ?? '')
  const [draftTeamB, setDraftTeamB] = useState(filters['team-b'] ?? '')
  const [draftHeroesA, setDraftHeroesA] = useState(filters['heroes-a'] ?? '')
  const [draftHeroesB, setDraftHeroesB] = useState(filters['heroes-b'] ?? '')

  // Applied values come from URL-backed filters
  const teamA = filters['team-a'] ?? ''
  const teamB = filters['team-b'] ?? ''
  const heroesA = filters['heroes-a'] ?? ''
  const heroesB = filters['heroes-b'] ?? ''

  // When FilterPanel apply is clicked, merge A/B draft into filters
  const handleApply = useCallback((f: typeof filters) => {
    const merged = { ...f }
    if (draftTeamA) merged['team-a'] = draftTeamA; else delete merged['team-a']
    if (draftTeamB) merged['team-b'] = draftTeamB; else delete merged['team-b']
    if (draftHeroesA) merged['heroes-a'] = draftHeroesA; else delete merged['heroes-a']
    if (draftHeroesB) merged['heroes-b'] = draftHeroesB; else delete merged['heroes-b']
    setFilters(merged)
  }, [draftTeamA, draftTeamB, draftHeroesA, draftHeroesB, setFilters])

  const hasQuery = hasFilters && (teamA || teamB || heroesA || heroesB)

  const { data, isLoading, error } = useApiQuery<{ data: MatchFinderResponse }>(
    hasQuery ? '/api/matchfinder/classic' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data?.matches ?? [], [data])
  const aWins = data?.data?.aWins ?? 0
  const bWins = data?.data?.bWins ?? 0
  const totalMatches = aWins + bWins

  const handleClear = useCallback(() => {
    setDraftTeamA('')
    setDraftTeamB('')
    setDraftHeroesA('')
    setDraftHeroesB('')
    clearFilters()
  }, [clearFilters])

  const handleDefaults = useCallback(() => {
    // Apply defaults and merge current A/B drafts
    const merged: typeof filters = {}
    if (draftTeamA) merged['team-a'] = draftTeamA
    if (draftTeamB) merged['team-b'] = draftTeamB
    if (draftHeroesA) merged['heroes-a'] = draftHeroesA
    if (draftHeroesB) merged['heroes-b'] = draftHeroesB
    applyDefaults()
    // After applyDefaults sets the URL, we need to also set the A/B values
    // Use a microtask to merge them after defaults are applied
    setTimeout(() => {
      if (draftTeamA || draftTeamB || draftHeroesA || draftHeroesB) {
        setFilters({ ...filters, ...merged, tier: '1,2', threshold: '1' })
      }
    }, 0)
  }, [draftTeamA, draftTeamB, draftHeroesA, draftHeroesB, applyDefaults, setFilters, filters])

  // Summary for Side A/B chips when collapsed
  const abSummary = useMemo(() => {
    const parts: string[] = []
    if (teamA) parts.push(`Team A: ${teamA}`)
    if (heroesA) parts.push(`Heroes A: ${heroesA.split(',').length}`)
    if (teamB) parts.push(`Team B: ${teamB}`)
    if (heroesB) parts.push(`Heroes B: ${heroesB.split(',').length}`)
    return parts
  }, [teamA, heroesA, teamB, heroesB])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Match Finder</h1>
        <p className={styles.subtitle}>
          Find matches by team and hero combinations
        </p>
      </div>

      {/* Collapsible A/B filter section */}
      <div style={{
        background: 'var(--color-bg-elevated)',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        marginBottom: 12,
        overflow: abCollapsed ? 'hidden' : 'visible',
      }}>
        <button
          onClick={() => setAbCollapsed(!abCollapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          <span style={{
            display: 'inline-block',
            transition: 'transform 150ms',
            transform: abCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            fontSize: '0.7rem',
          }}>
            &#9660;
          </span>
          <span style={{ color: 'var(--color-primary)' }}>Team & Hero Filters</span>
          {abCollapsed && abSummary.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, fontFamily: 'var(--font-mono)' }}>
              {abSummary.join(' · ')}
            </span>
          )}
        </button>

        {!abCollapsed && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            padding: '0 16px 12px',
          }}>
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>Side A</h3>
              <TeamInput label="Team A" value={draftTeamA} onChange={setDraftTeamA} />
              <HeroInput label="Heroes A" value={draftHeroesA} onChange={setDraftHeroesA} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>Side B</h3>
              <TeamInput label="Team B" value={draftTeamB} onChange={setDraftTeamB} />
              <HeroInput label="Heroes B" value={draftHeroesB} onChange={setDraftHeroesB} />
            </div>
          </div>
        )}
      </div>

      <FilterPanel
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={handleDefaults}>
            default filters
          </button>
        </div>
      )}

      {hasFilters && !hasQuery && (
        <div className={styles.empty}>
          <p>Select at least one team or hero on each side, then press Apply Filters.</p>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Searching matches..." />}

      {error && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{
            display: 'flex',
            gap: 24,
            justifyContent: 'center',
            padding: '10px 0',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Side A:</span>{' '}
              {aWins} wins ({totalMatches > 0 ? (aWins / totalMatches * 100).toFixed(1) : 0}%)
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Side B:</span>{' '}
              {bWins} wins ({totalMatches > 0 ? (bWins / totalMatches * 100).toFixed(1) : 0}%)
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span>{totalMatches} matches</span>
          </div>
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'matchId', desc: true }]}
            searchableColumns={['radName', 'direName', 'leagueName']}
          />
        </>
      )}

      {!isLoading && !error && hasQuery && rows.length === 0 && data && (
        <div className={styles.empty}>
          <p>No matches found for the given criteria.</p>
        </div>
      )}
    </div>
  )
}
