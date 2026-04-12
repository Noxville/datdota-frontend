import { useState, useEffect, useRef, useCallback } from 'react'
import type { FilterValues } from '../types'
import {
  usePlayerAutocomplete,
  useTeamAutocomplete,
  useLeagueAutocomplete,
  useSplitAutocomplete,
  useItemAutocomplete,
} from '../api/autocomplete'
import { heroesById } from '../data/heroes'
import { items as itemsData } from '../data/items'
import { patches as staticPatches } from '../data/patches'
import { itemImageUrl } from '../config'
import HeroImage from './HeroImage'
import {
  fetchPlayerNames,
  fetchTeamNames,
  fetchLeagueNames,
  fetchSplitNames,
} from '../api/entityInfo'
import styles from './FilterPanel.module.css'

/** Date input that displays dd/MM/yyyy but stores yyyy-MM-dd internally. */
function DateInput({
  value,
  onChange,
  className,
}: {
  value: string  // yyyy-MM-dd or ''
  onChange: (isoValue: string) => void
  className?: string
}) {
  // Convert yyyy-MM-dd → dd/MM/yyyy for display
  const toDisplay = (iso: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return y && m && d ? `${d}/${m}/${y}` : iso
  }

  // Convert dd/MM/yyyy → yyyy-MM-dd for storage
  const toIso = (display: string) => {
    const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!match) return ''
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  }

  const [text, setText] = useState(toDisplay(value))

  // Sync from external value changes
  useEffect(() => {
    setText(toDisplay(value))
  }, [value])

  const commit = useCallback(() => {
    const iso = toIso(text)
    if (iso) {
      onChange(iso)
    } else if (text === '') {
      onChange('')
    }
  }, [text, onChange])

  return (
    <input
      className={className}
      type="text"
      placeholder="dd/mm/yyyy"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
    />
  )
}

interface FilterPanelProps {
  filters: FilterValues
  onApply: (filters: FilterValues) => void
  onClear: () => void
  showFilters?: (keyof typeof FILTER_CONFIG)[]
  collapsed?: boolean
  onToggleCollapsed?: () => void
  /** Extra controls rendered inside the expanded panel (before actions) */
  renderExtra?: () => React.ReactNode
  /** Extra summary chips shown in collapsed view */
  extraChips?: { label: string; value: string }[]
}

const FILTER_CONFIG = {
  players: true,
  teams: true,
  heroes: true,
  roles: true,
  patch: true,
  'split-type': true,
  after: true,
  before: true,
  duration: true,
  leagues: true,
  splits: true,
  tier: true,
  'result-faction': true,
  threshold: true,
  items: true,
  'item-slots': true,
  'building-filters': true,
  'draft-filters': true,
} as const

function AutocompleteInput({
  label,
  value,
  onChange,
  useHook,
  displayKey,
  valueKey,
  secondaryKey,
  nameMap,
  onNameResolved,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useHook: (q: string) => { data?: any[]; isLoading: boolean }
  displayKey: string
  valueKey: string
  secondaryKey?: string
  nameMap: Record<string, string>
  onNameResolved: (id: string, name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { data: results, isLoading } = useHook(query)
  const ref = useRef<HTMLDivElement>(null)
  const selectedIds = value ? value.split(',').filter(Boolean) : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function addItem(id: string, name: string) {
    const next = selectedIds.includes(id) ? selectedIds : [...selectedIds, id]
    onNameResolved(id, name)
    onChange(next.join(','))
    setQuery('')
    setOpen(false)
  }

  function removeItem(id: string) {
    onChange(selectedIds.filter((i) => i !== id).join(','))
  }

  return (
    <div className={styles.filterGroup} ref={ref}>
      <label className={styles.label}>{label}</label>
      <div className={styles.autocompleteWrap}>
        {selectedIds.length > 0 && (
          <div className={styles.tags}>
            {selectedIds.map((id) => (
              <span key={id} className={styles.tag}>
                {nameMap[id] ? `${nameMap[id]} (${id})` : id}
                <button className={styles.tagRemove} onClick={() => removeItem(id)}>
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          className={styles.input}
          placeholder={`Search ${label.toLowerCase()}...`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
        />
        {open && results && results.length > 0 && (
          <div className={styles.dropdown}>
            {isLoading && <div className={styles.dropdownItem}>Loading...</div>}
            {results.map((r) => {
              const id = String((r as Record<string, unknown>)[valueKey])
              const name = String((r as Record<string, unknown>)[displayKey])
              const secondary = secondaryKey
                ? String((r as Record<string, unknown>)[secondaryKey] ?? '')
                : ''
              return (
                <button
                  key={id}
                  className={styles.dropdownItem}
                  onClick={() => addItem(id, name)}
                >
                  {name}
                  {secondary && (
                    <span className={styles.dropdownSecondary}> — {secondary}</span>
                  )}
                  <span style={{ color: 'var(--color-text-muted)' }}> ({id})</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PatchSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const selected = value ? value.split(',').filter(Boolean) : []
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allNames = staticPatches.map((p) => p.name)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(patchName: string) {
    const next = selected.includes(patchName)
      ? selected.filter((p) => p !== patchName)
      : [...selected, patchName]
    onChange(next.join(','))
  }

  function selectAll() {
    onChange(allNames.join(','))
  }

  function deselectAll() {
    onChange('')
  }

  const displayText = selected.length > 0
    ? compressPatches(value, allNames)
    : 'All patches'

  return (
    <div className={styles.filterGroup} ref={ref}>
      <label className={styles.label}>Patch</label>
      <button className={styles.selectBtn} onClick={() => setOpen(!open)}>
        <span>{displayText}</span>
        <span className={styles.caret}>&#9662;</span>
      </button>
      {open && staticPatches && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownActions}>
            <button className={styles.dropdownActionBtn} onClick={selectAll}>
              Select all
            </button>
            <button className={styles.dropdownActionBtn} onClick={deselectAll}>
              Deselect all
            </button>
          </div>
          {staticPatches.map((p) => (
            <button
              key={p.name}
              className={`${styles.dropdownItem} ${selected.includes(p.name) ? styles.dropdownItemActive : ''}`}
              onClick={() => toggle(p.name)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function HeroSelect({
  value,
  onChange,
  label = 'Heroes',
}: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
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

  const heroList = Object.entries(heroesById)
    .map(([id, h]) => ({ id, name: h.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = search
    ? heroList.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()))
    : heroList

  function toggle(heroId: string) {
    const next = selected.includes(heroId)
      ? selected.filter((h) => h !== heroId)
      : [...selected, heroId]
    onChange(next.join(','))
  }

  const displayText =
    selected.length === 0
      ? 'All heroes'
      : selected.length <= 3
        ? selected.map((id) => heroesById[id]?.name ?? id).join(', ')
        : `${selected.length} heroes selected`

  function remove(heroId: string) {
    onChange(selected.filter((h) => h !== heroId).join(','))
  }

  return (
    <div className={styles.filterGroup} ref={ref}>
      <label className={styles.label}>{label}</label>
      {selected.length > 0 && (
        <div className={styles.tags}>
          {selected.map((id) => (
            <span key={id} className={styles.tag}>
              {heroesById[id]?.name ?? id}
              <button className={styles.tagRemove} onClick={() => remove(id)}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <button className={styles.selectBtn} onClick={() => setOpen(!open)}>
        <span className={styles.selectBtnText}>{displayText}</span>
        <span className={styles.caret}>&#9662;</span>
      </button>
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownSearch}>
            <input
              className={styles.dropdownSearchInput}
              placeholder="Filter heroes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.dropdownActions}>
            <button className={styles.dropdownActionBtn} onClick={() => onChange(heroList.map((h) => h.id).join(','))}>
              Select all
            </button>
            <button className={styles.dropdownActionBtn} onClick={() => onChange('')}>
              Deselect all
            </button>
          </div>
          {filtered.map((h) => (
            <button
              key={h.id}
              className={`${styles.dropdownItem} ${selected.includes(h.id) ? styles.dropdownItemActive : ''}`}
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

function ItemSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { data: results } = useItemAutocomplete(query)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedItem = value ? itemsData[value] : null
  const selectedName = selectedItem?.longName ?? (value || null)

  function selectItem(id: string) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange('')
    setQuery('')
  }

  return (
    <div className={styles.filterGroup} ref={ref}>
      <label className={styles.label}>{label}</label>
      <div className={styles.autocompleteWrap}>
        {value && selectedName && (
          <div className={styles.tags}>
            <span className={styles.tag}>
              {selectedItem && (
                <img
                  src={itemImageUrl(selectedItem.shortName)}
                  alt=""
                  style={{ width: 22, height: 16, objectFit: 'contain', borderRadius: 2 }}
                />
              )}
              {selectedName}
              <button className={styles.tagRemove} onClick={clear}>
                &times;
              </button>
            </span>
          </div>
        )}
        <input
          className={styles.input}
          placeholder={`Search ${label.toLowerCase()}...`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
        />
        {open && results && results.length > 0 && (
          <div className={styles.dropdown}>
            {results.map((r) => (
              <button
                key={r.item_id}
                className={styles.dropdownItem}
                onClick={() => selectItem(String(r.item_id))}
              >
                {r.name}
                <span style={{ color: 'var(--color-text-muted)' }}> ({r.item_id})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const TIER_LABELS: Record<string, string> = {
  '1': 'Premium',
  '2': 'Pro',
  '3': 'Semi-pro',
}

const TIER_AND_TYPE_OPTIONS = [
  { id: '1', label: 'Premium', group: 'tier' as const },
  { id: '2', label: 'Pro', group: 'tier' as const },
  { id: '3', label: 'Semi-pro', group: 'tier' as const },
  { id: 'online', label: 'Online', group: 'split-type' as const },
  { id: 'lan', label: 'LAN', group: 'split-type' as const },
  { id: 'post-event', label: 'Post-event', group: 'split-type' as const },
]

/**
 * Compress a list of patch names into ranges where consecutive.
 * Uses the canonical patch order list so that cross-major boundaries
 * (e.g. 6.88 → 7.00) are treated as adjacent.
 * e.g. ["7.02","7.01","7.00","6.88","6.87","6.85"] → "6.85, 6.87–7.02"
 */
function compressPatches(patchStr: string, allPatches?: string[]): string {
  const selected = patchStr.split(',').filter(Boolean)
  if (selected.length <= 3) return selected.join(', ')

  // If we have the canonical ordered list, use index-based adjacency
  if (allPatches && allPatches.length > 0) {
    // allPatches is newest-first from API; build a name→index map (ascending order)
    const ascending = [...allPatches].reverse()
    const indexMap = new Map<string, number>()
    ascending.forEach((name, i) => indexMap.set(name, i))

    // Sort selected patches in ascending canonical order
    const sorted = selected
      .filter((p) => indexMap.has(p))
      .sort((a, b) => indexMap.get(a)! - indexMap.get(b)!)

    if (sorted.length === 0) return selected.join(', ')

    const ranges: { start: string; end: string }[] = []
    let runStart = sorted[0]
    let prevIdx = indexMap.get(sorted[0])!

    for (let i = 1; i < sorted.length; i++) {
      const curIdx = indexMap.get(sorted[i])!
      if (curIdx !== prevIdx + 1) {
        ranges.push({ start: runStart, end: sorted[i - 1] })
        runStart = sorted[i]
      }
      prevIdx = curIdx
    }
    ranges.push({ start: runStart, end: sorted[sorted.length - 1] })

    return ranges
      .map((r) => (r.start === r.end ? r.start : `${r.start}\u2013${r.end}`))
      .join(', ')
  }

  // Fallback: just join
  return selected.join(', ')
}

function resolveIds(csv: string, nameMap: Record<string, string>): string {
  return csv
    .split(',')
    .filter(Boolean)
    .map((id) => nameMap[id] ?? id)
    .join(', ')
}

function buildSummaryChips(
  filters: FilterValues,
  allPatchNames?: string[],
  entityNames?: Record<string, string>,
): { label: string; value: string }[] {
  const chips: { label: string; value: string }[] = []
  const names = entityNames ?? {}

  if (filters.players) chips.push({ label: 'Players', value: resolveIds(filters.players, names) })
  if (filters.teams) chips.push({ label: 'Teams', value: resolveIds(filters.teams, names) })
  if (filters.leagues) chips.push({ label: 'Leagues', value: resolveIds(filters.leagues, names) })
  if (filters.splits) chips.push({ label: 'Splits', value: resolveIds(filters.splits, names) })
  if (filters.patch) chips.push({ label: 'Patch', value: compressPatches(filters.patch, allPatchNames) })

  if (filters.tier) {
    const tierNames = filters.tier
      .split(',')
      .map((t) => TIER_LABELS[t] ?? t)
      .join('/')
    chips.push({ label: 'Tier', value: tierNames })
  }

  if (filters['split-type']) {
    chips.push({ label: 'Type', value: filters['split-type'].split(',').join('/') })
  }

  if (filters.after || filters.before) {
    const parts = []
    if (filters.after) parts.push(filters.after)
    if (filters.before) parts.push(filters.before)
    chips.push({ label: 'Date', value: parts.join(' \u2013 ') })
  }

  if (filters.durationGTE || filters.durationLTE) {
    const parts = []
    if (filters.durationGTE) parts.push(`${filters.durationGTE}m`)
    if (filters.durationLTE) parts.push(`${filters.durationLTE}m`)
    chips.push({ label: 'Duration', value: parts.join('\u2013') })
  }

  if (filters['in-wins'] === 'true' || filters['in-losses'] === 'true') {
    const parts = []
    if (filters['in-wins'] === 'true') parts.push('Wins')
    if (filters['in-losses'] === 'true') parts.push('Losses')
    chips.push({ label: 'Result', value: parts.join('/') })
  }

  if (filters['on-radiant'] === 'true' || filters['on-dire'] === 'true') {
    const parts = []
    if (filters['on-radiant'] === 'true') parts.push('Radiant')
    if (filters['on-dire'] === 'true') parts.push('Dire')
    chips.push({ label: 'Faction', value: parts.join('/') })
  }

  if (filters.roles) {
    chips.push({ label: 'Role', value: filters.roles })
  }

  if (filters.threshold && filters.threshold !== '1') {
    chips.push({ label: 'Min games', value: filters.threshold })
  }

  if (filters.heroes) {
    // Store raw IDs so the renderer can show minihero icons
    chips.push({ label: 'Heroes', value: filters.heroes })
  }

  if (filters.items) {
    const item = itemsData[filters.items]
    chips.push({ label: 'Item', value: item?.longName ?? filters.items })
  }

  // Item slots for progression
  const slotItems: string[] = []
  for (let n = 1; n <= 6; n++) {
    const key = `item-${n}` as keyof FilterValues
    const val = filters[key]
    if (val) {
      const item = itemsData[val]
      slotItems.push(item?.longName ?? val)
    }
  }
  if (slotItems.length > 0) {
    chips.push({ label: 'Items', value: `__item-slots__` })
  }

  if (filters.building_type) chips.push({ label: 'Bldg Type', value: filters.building_type.split(',').join('/') })
  if (filters.building_lane) chips.push({ label: 'Lane', value: filters.building_lane.split(',').join('/') })
  if (filters.building_tier) chips.push({ label: 'Bldg Tier', value: filters.building_tier.split(',').join('/') })

  if (filters.winner) chips.push({ label: 'Winner', value: filters.winner })
  if (filters['first-pick']) chips.push({ label: '1st Pick', value: filters['first-pick'] })
  if (filters.picked) chips.push({ label: 'Picked', value: `${filters.picked.split(',').length} heroes` })
  if (filters.banned) chips.push({ label: 'Banned', value: `${filters.banned.split(',').length} heroes` })
  const phaseKeys = ['picked-1p', 'picked-2p', 'picked-3p', 'banned-1p', 'banned-2p', 'banned-3p'] as const
  for (const pk of phaseKeys) {
    if (filters[pk]) chips.push({ label: pk, value: `${filters[pk]!.split(',').length} heroes` })
  }

  return chips
}

export default function FilterPanel({
  filters,
  onApply,
  onClear,
  showFilters,
  collapsed,
  onToggleCollapsed,
  renderExtra,
  extraChips,
}: FilterPanelProps) {
  const [draft, setDraft] = useState<FilterValues>({ ...filters })
  const allPatchNames = staticPatches.map((p) => p.name)
  // Shared name map survives collapse/expand cycles
  const [entityNames, setEntityNames] = useState<Record<string, string>>({})
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const prevCollapsed = useRef(collapsed)

  function handleNameResolved(id: string, name: string) {
    setEntityNames((prev) => ({ ...prev, [id]: name }))
  }

  // Sync draft when the *applied* filters change (i.e. user clicks Apply or uses defaults).
  // We serialise to compare so that unrelated URL changes (like fc=) don't clobber the draft.
  const filtersJson = JSON.stringify(filters)
  const prevFiltersJson = useRef(filtersJson)
  useEffect(() => {
    if (filtersJson !== prevFiltersJson.current) {
      prevFiltersJson.current = filtersJson
      setDraft({ ...filters })
    }
  }, [filtersJson, filters])

  // Rehydrate entity names from info endpoints when loading from URL
  const didRehydrate = useRef(false)
  useEffect(() => {
    if (didRehydrate.current) return
    didRehydrate.current = true

    const entityFields: {
      key: keyof FilterValues
      fetcher: (ids: string[]) => Promise<Record<string, string>>
    }[] = [
      { key: 'players', fetcher: fetchPlayerNames },
      { key: 'teams', fetcher: fetchTeamNames },
      { key: 'leagues', fetcher: fetchLeagueNames },
      { key: 'splits', fetcher: fetchSplitNames },
    ]

    for (const { key, fetcher } of entityFields) {
      const csv = filters[key]
      if (!csv) continue
      const ids = csv.split(',').filter(Boolean)
      const unresolvedIds = ids.filter((id) => !entityNames[id])
      if (unresolvedIds.length === 0) continue

      fetcher(unresolvedIds).then((names) => {
        setEntityNames((prev) => ({ ...prev, ...names }))
      }).catch(() => {
        // Silently ignore — IDs will just display as raw values
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animate height on collapse toggle (skip on mount)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    // Skip animation on mount — just let it be auto
    if (prevCollapsed.current === collapsed) return
    prevCollapsed.current = collapsed

    // Snapshot current rendered height, lock it
    const startHeight = el.scrollHeight
    setHeight(startHeight)

    // Force layout so the browser registers the start height
    void el.offsetHeight

    // On next frame, set height to the new content's scrollHeight
    requestAnimationFrame(() => {
      if (!contentRef.current) return
      const endHeight = contentRef.current.scrollHeight
      setHeight(endHeight)

      const onEnd = () => {
        setHeight('auto')
        el.removeEventListener('transitionend', onEnd)
      }
      el.addEventListener('transitionend', onEnd)

      // Safety: if heights match (no transition fires), reset to auto
      if (startHeight === endHeight) {
        setHeight('auto')
      }
    })
  }, [collapsed])

  function update(key: keyof FilterValues, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleApply() {
    const cleaned: FilterValues = {}
    for (const [k, v] of Object.entries(draft)) {
      if (v !== undefined && v !== '') {
        cleaned[k as keyof FilterValues] = v
      }
    }
    onApply(cleaned)
  }

  // Items/item-slots are opt-in only (never shown by default)
  const OPT_IN_ONLY: (keyof typeof FILTER_CONFIG)[] = ['items', 'item-slots', 'building-filters', 'draft-filters']
  const show = (key: keyof typeof FILTER_CONFIG) =>
    showFilters ? showFilters.includes(key) : !OPT_IN_ONLY.includes(key)

  const hasRow1 =
    show('players') || show('teams') || show('heroes') || show('leagues') || show('splits') || show('patch') || show('items') || show('item-slots')
  const hasRow2 =
    show('after') || show('before') || show('tier') || show('split-type') || show('duration') || show('result-faction') || show('threshold')

  const chips = [
    ...buildSummaryChips(filters, allPatchNames, entityNames),
    ...(extraChips ?? []),
  ]

  // Tier + split-type merged toggle helpers
  const tiers = draft.tier ? draft.tier.split(',').filter(Boolean) : []
  const splitTypes = draft['split-type'] ? draft['split-type'].split(',').filter(Boolean) : []

  function toggleTierOrType(option: (typeof TIER_AND_TYPE_OPTIONS)[number]) {
    if (option.group === 'tier') {
      const checked = tiers.includes(option.id)
      const next = checked ? tiers.filter((x) => x !== option.id) : [...tiers, option.id]
      update('tier', next.join(','))
    } else {
      const checked = splitTypes.includes(option.id)
      const next = checked
        ? splitTypes.filter((x) => x !== option.id)
        : [...splitTypes, option.id]
      update('split-type', next.join(','))
    }
  }

  function isChecked(option: (typeof TIER_AND_TYPE_OPTIONS)[number]) {
    return option.group === 'tier'
      ? tiers.includes(option.id)
      : splitTypes.includes(option.id)
  }

  // Threshold helpers
  const thresholdValue = draft.threshold ?? '1'

  return (
    <div className={styles.outer}>
      <div
        ref={contentRef}
        className={styles.animWrap}
        style={{ height: height === 'auto' ? 'auto' : `${height}px` }}
      >
        {collapsed ? (
          <div className={styles.summary} key="summary">
            <div className={styles.summaryChips}>
              {chips.length > 0 ? (
                chips.map((c) => (
                  <span key={c.label} className={styles.summaryChip}>
                    <span className={styles.summaryChipLabel}>{c.label}:</span>
                    {c.label === 'Heroes' ? (
                      <span className={styles.heroChipIcons}>
                        {c.value.split(',').filter(Boolean).map((id) => (
                          <HeroImage key={id} heroId={id} variant="mini" size={24} />
                        ))}
                      </span>
                    ) : c.value === '__item-slots__' ? (
                      <span className={styles.heroChipIcons}>
                        {([1, 2, 3, 4, 5, 6] as const).map((n) => {
                          const val = filters[`item-${n}` as keyof FilterValues]
                          if (!val) return null
                          const item = itemsData[val]
                          if (!item) return null
                          return (
                            <img
                              key={n}
                              src={itemImageUrl(item.shortName)}
                              alt={item.longName}
                              title={`#${n}: ${item.longName}`}
                              style={{ width: 28, height: 20, objectFit: 'contain', borderRadius: 2 }}
                            />
                          )
                        })}
                      </span>
                    ) : (
                      <> {c.value}</>
                    )}
                  </span>
                ))
              ) : (
                <span className={styles.summaryEmpty}>No filters applied</span>
              )}
            </div>
            <div className={styles.summaryActions}>
              <button className={styles.expandBtn} onClick={onToggleCollapsed}>
                Edit
              </button>
              <button className={styles.clearBtn} onClick={onClear}>
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.panel} key="panel">
            {/* Row 1: Entity filters (3-col) + Patch below */}
            {hasRow1 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Filter by</div>
                <div className={styles.grid}>
                  {show('players') && (
                    <AutocompleteInput
                      label="Players"
                      value={draft.players ?? ''}
                      onChange={(v) => update('players', v)}
                      useHook={usePlayerAutocomplete}
                      displayKey="name"
                      valueKey="steam_id"
                      secondaryKey="team"
                      nameMap={entityNames}
                      onNameResolved={handleNameResolved}
                    />
                  )}
                  {show('teams') && (
                    <AutocompleteInput
                      label="Teams"
                      value={draft.teams ?? ''}
                      onChange={(v) => update('teams', v)}
                      useHook={useTeamAutocomplete}
                      displayKey="name"
                      valueKey="team_id"
                      nameMap={entityNames}
                      onNameResolved={handleNameResolved}
                    />
                  )}
                  {show('leagues') && (
                    <AutocompleteInput
                      label="Leagues"
                      value={draft.leagues ?? ''}
                      onChange={(v) => update('leagues', v)}
                      useHook={useLeagueAutocomplete}
                      displayKey="name"
                      valueKey="league_id"
                      nameMap={entityNames}
                      onNameResolved={handleNameResolved}
                    />
                  )}
                  {show('splits') && (
                    <AutocompleteInput
                      label="Splits"
                      value={draft.splits ?? ''}
                      onChange={(v) => update('splits', v)}
                      useHook={useSplitAutocomplete}
                      displayKey="name"
                      valueKey="split_id"
                      nameMap={entityNames}
                      onNameResolved={handleNameResolved}
                    />
                  )}
                  {show('heroes') && (
                    <HeroSelect
                      value={draft.heroes ?? ''}
                      onChange={(v) => update('heroes', v)}
                    />
                  )}
                  {show('patch') && (
                    <PatchSelect
                      value={draft.patch ?? ''}
                      onChange={(v) => update('patch', v)}
                    />
                  )}
                  {show('items') && (
                    <ItemSelect
                      label="Item"
                      value={draft.items ?? ''}
                      onChange={(v) => update('items', v)}
                    />
                  )}
                  {show('item-slots') && (
                    <>
                      {([1, 2, 3, 4, 5, 6] as const).map((n) => (
                        <ItemSelect
                          key={n}
                          label={`Item #${n}`}
                          value={draft[`item-${n}` as keyof FilterValues] ?? ''}
                          onChange={(v) => update(`item-${n}` as keyof FilterValues, v)}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Row 2: Dates + Tier/Event Type + Duration + Min Games */}
            {hasRow2 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Match context</div>
                <div className={styles.grid}>
                  {(show('after') || show('before')) && (
                    <div className={styles.filterGroup}>
                      <label className={styles.label}>Date Range</label>
                      <div className={styles.dateRow}>
                        <DateInput
                          className={styles.input}
                          value={draft.after ?? ''}
                          onChange={(v) => update('after', v)}
                        />
                        <span className={styles.dateSep}>to</span>
                        <DateInput
                          className={styles.input}
                          value={draft.before ?? ''}
                          onChange={(v) => update('before', v)}
                        />
                      </div>
                    </div>
                  )}

                  {(show('tier') || show('split-type')) && (
                    <div className={styles.filterGroup}>
                      <label className={styles.label}>Tier / Event Type</label>
                      <div className={styles.checkboxStack}>
                        {show('tier') && (
                          <div className={styles.checkboxLine}>
                            <span className={styles.checkboxLineLabel}>Tier</span>
                            {TIER_AND_TYPE_OPTIONS.filter((o) => o.group === 'tier').map((opt) => (
                              <label key={opt.id} className={styles.checkbox}>
                                <input
                                  type="checkbox"
                                  checked={isChecked(opt)}
                                  onChange={() => toggleTierOrType(opt)}
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {show('split-type') && (
                          <div className={styles.checkboxLine}>
                            <span className={styles.checkboxLineLabel}>Type</span>
                            {TIER_AND_TYPE_OPTIONS.filter((o) => o.group === 'split-type').map((opt) => (
                              <label key={opt.id} className={styles.checkbox}>
                                <input
                                  type="checkbox"
                                  checked={isChecked(opt)}
                                  onChange={() => toggleTierOrType(opt)}
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {show('result-faction') && (
                    <div className={styles.filterGroup}>
                      <label className={styles.label}>Result / Faction</label>
                      <div className={styles.checkboxStack}>
                        <div className={styles.checkboxLine}>
                          <span className={styles.checkboxLineLabel}>Result</span>
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              checked={draft['in-wins'] === 'true'}
                              onChange={() =>
                                update('in-wins', draft['in-wins'] === 'true' ? '' : 'true')
                              }
                            />
                            <span>Wins</span>
                          </label>
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              checked={draft['in-losses'] === 'true'}
                              onChange={() =>
                                update('in-losses', draft['in-losses'] === 'true' ? '' : 'true')
                              }
                            />
                            <span>Losses</span>
                          </label>
                        </div>
                        <div className={styles.checkboxLine}>
                          <span className={styles.checkboxLineLabel}>Faction</span>
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              checked={draft['on-radiant'] === 'true'}
                              onChange={() =>
                                update('on-radiant', draft['on-radiant'] === 'true' ? '' : 'true')
                              }
                            />
                            <span>Radiant</span>
                          </label>
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              checked={draft['on-dire'] === 'true'}
                              onChange={() =>
                                update('on-dire', draft['on-dire'] === 'true' ? '' : 'true')
                              }
                            />
                            <span>Dire</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {show('duration') && (
                    <div className={styles.filterGroup}>
                      <label className={styles.label}>Duration (minutes)</label>
                      <div className={styles.dualRangeRow}>
                        <input
                          className={styles.rangeInput}
                          type="number"
                          min="0"
                          max="200"
                          value={draft.durationGTE ?? '0'}
                          onChange={(e) => {
                            const v = Math.min(Number(e.target.value) || 0, Number(draft.durationLTE ?? 200))
                            update('durationGTE', String(v))
                          }}
                        />
                        <div className={styles.dualRangeWrap}>
                          <div className={styles.dualRangeTrack} />
                          <div
                            className={styles.dualRangeFill}
                            style={{
                              left: `${(Number(draft.durationGTE ?? 0) / 200) * 100}%`,
                              right: `${100 - (Number(draft.durationLTE ?? 200) / 200) * 100}%`,
                            }}
                          />
                          <input
                            className={styles.dualRangeThumb}
                            type="range"
                            min="0"
                            max="200"
                            value={draft.durationGTE ?? '0'}
                            onChange={(e) => {
                              const v = Math.min(Number(e.target.value), Number(draft.durationLTE ?? 200))
                              update('durationGTE', String(v))
                            }}
                          />
                          <input
                            className={styles.dualRangeThumb}
                            type="range"
                            min="0"
                            max="200"
                            value={draft.durationLTE ?? '200'}
                            onChange={(e) => {
                              const v = Math.max(Number(e.target.value), Number(draft.durationGTE ?? 0))
                              update('durationLTE', String(v))
                            }}
                          />
                        </div>
                        <input
                          className={styles.rangeInput}
                          type="number"
                          min="0"
                          max="200"
                          value={draft.durationLTE ?? '200'}
                          onChange={(e) => {
                            const v = Math.max(Number(e.target.value) || 0, Number(draft.durationGTE ?? 0))
                            update('durationLTE', String(v))
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {show('threshold') && (
                    <div className={styles.filterGroup}>
                      <label className={styles.label}>Min. Games</label>
                      <div className={styles.rangeRow}>
                        <input
                          className={styles.range}
                          type="range"
                          min="1"
                          max="500"
                          value={thresholdValue}
                          onChange={(e) => update('threshold', e.target.value)}
                        />
                        <input
                          className={styles.rangeInput}
                          type="number"
                          min="1"
                          max="9999"
                          value={thresholdValue}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === '' || Number(v) >= 1) {
                              update('threshold', v || '1')
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {show('draft-filters') && (() => {
              const winnerVal = draft.winner ?? ''
              const firstPickVal = draft['first-pick'] ?? ''
              return (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Draft filters</div>
                  <div className={styles.filterGroup}>
                    <div className={styles.checkboxStack}>
                      <div className={styles.checkboxLine}>
                        <span className={styles.checkboxLineLabel}>Winner</span>
                        {[{ id: '', label: 'Either' }, { id: 'radiant', label: 'Radiant' }, { id: 'dire', label: 'Dire' }].map((o) => (
                          <label key={o.id} className={styles.checkbox}>
                            <input type="radio" name="draft-winner" checked={winnerVal === o.id} onChange={() => update('winner', o.id)} />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className={styles.checkboxLine}>
                        <span className={styles.checkboxLineLabel}>1st Pick</span>
                        {[{ id: '', label: 'Either' }, { id: 'radiant', label: 'Radiant' }, { id: 'dire', label: 'Dire' }].map((o) => (
                          <label key={o.id} className={styles.checkbox}>
                            <input type="radio" name="draft-first-pick" checked={firstPickVal === o.id} onChange={() => update('first-pick', o.id)} />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[
                      { key: 'picked' as const, label: 'Picked (any)' },
                      { key: 'picked-1p' as const, label: 'Picked P1' },
                      { key: 'picked-2p' as const, label: 'Picked P2' },
                      { key: 'picked-3p' as const, label: 'Picked P3' },
                    ].map(({ key, label }) => (
                      <HeroSelect
                        key={key}
                        label={label}
                        value={draft[key] ?? ''}
                        onChange={(v) => update(key, v)}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[
                      { key: 'banned' as const, label: 'Banned (any)' },
                      { key: 'banned-1p' as const, label: 'Banned P1' },
                      { key: 'banned-2p' as const, label: 'Banned P2' },
                      { key: 'banned-3p' as const, label: 'Banned P3' },
                    ].map(({ key, label }) => (
                      <HeroSelect
                        key={key}
                        label={label}
                        value={draft[key] ?? ''}
                        onChange={(v) => update(key, v)}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            {show('building-filters') && (() => {
              const bTypes = draft.building_type ? draft.building_type.split(',').filter(Boolean) : []
              const bLanes = draft.building_lane ? draft.building_lane.split(',').filter(Boolean) : []
              const bTiers = draft.building_tier ? draft.building_tier.split(',').filter(Boolean) : []
              function toggleList(current: string[], id: string, key: keyof FilterValues) {
                const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
                update(key, next.join(','))
              }
              return (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Building filters</div>
                  <div className={styles.filterGroup}>
                    <div className={styles.checkboxStack}>
                      <div className={styles.checkboxLine}>
                        <span className={styles.checkboxLineLabel}>Type</span>
                        {[{ id: 'TOWER', label: 'Tower' }, { id: 'RAX', label: 'Barracks' }, { id: 'SHRINE', label: 'Shrine' }].map((o) => (
                          <label key={o.id} className={styles.checkbox}>
                            <input type="checkbox" checked={bTypes.includes(o.id)} onChange={() => toggleList(bTypes, o.id, 'building_type')} />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className={styles.checkboxLine}>
                        <span className={styles.checkboxLineLabel}>Lane</span>
                        {[{ id: 'TOP', label: 'Top' }, { id: 'MIDDLE', label: 'Mid' }, { id: 'BOTTOM', label: 'Bot' }, { id: 'OTHER', label: 'Other' }].map((o) => (
                          <label key={o.id} className={styles.checkbox}>
                            <input type="checkbox" checked={bLanes.includes(o.id)} onChange={() => toggleList(bLanes, o.id, 'building_lane')} />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className={styles.checkboxLine}>
                        <span className={styles.checkboxLineLabel}>Tier</span>
                        {[{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }, { id: '-1', label: 'Other' }].map((o) => (
                          <label key={o.id} className={styles.checkbox}>
                            <input type="checkbox" checked={bTiers.includes(o.id)} onChange={() => toggleList(bTiers, o.id, 'building_tier')} />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {renderExtra?.()}

            <div className={styles.actions}>
              <button className={styles.applyBtn} onClick={handleApply}>
                Apply Filters
              </button>
              <button className={styles.clearBtn} onClick={onClear}>
                Clear
              </button>
              {onToggleCollapsed && (
                <button className={styles.collapseBtn} onClick={onToggleCollapsed}>
                  Collapse
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
