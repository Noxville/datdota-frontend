import { useState, useEffect, useMemo, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import DataTable, { PlayerCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import TimeDistributionChart from '../components/TimeDistributionChart'
import PageMeta from '../components/PageMeta'
import WardMap, { type WardEvent, type MapView } from '../components/WardMap'
import LocalMultiSelect from '../components/LocalMultiSelect'
import FacetToggleList from '../components/FacetToggleList'
import { MAP_VERSIONS, defaultMapVersion } from '../data/wardMaps'
import { fmtTime } from '../utils/format'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

function HeroIconCell({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  const name = hero?.name ?? `Hero ${heroId}`
  const src = pic ? heroImageUrl(pic) : undefined
  return src ? (
    <img
      src={src}
      alt={name}
      title={name}
      style={{ height: 22, width: 'auto' }}
      loading="lazy"
    />
  ) : (
    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{name}</span>
  )
}

const columns: ColumnDef<WardEvent, unknown>[] = [
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
    id: 'placerHero',
    accessorFn: (row) => heroesById[String(row.placer.hero)]?.name ?? `Hero ${row.placer.hero}`,
    header: 'Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) => <HeroIconCell heroId={row.original.placer.hero} />,
  },
  {
    id: 'placer',
    accessorFn: (row) => row.placer.nickname,
    header: 'Placer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.placer.steamId} nickname={row.original.placer.nickname} />
    ),
  },
  {
    id: 'placerTeam',
    accessorFn: (row) => row.placerTeam?.name ?? '',
    header: 'Team',
    size: 150,
    cell: ({ row }) => {
      const t = row.original.placerTeam
      if (!t) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      return (
        <a href={`/teams/${t.valveId}`} style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}>
          {t.name}
        </a>
      )
    },
  },
  {
    id: 'countererHero',
    accessorFn: (row) => row.counterer ? (heroesById[String(row.counterer.hero)]?.name ?? `Hero ${row.counterer.hero}`) : '',
    header: 'C. Hero',
    size: 65,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.counterer ? (
        <HeroIconCell heroId={row.original.counterer.hero} />
      ) : (
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      ),
  },
  {
    id: 'counterer',
    accessorFn: (row) => row.counterer?.nickname ?? '',
    header: 'Counterer',
    size: 160,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.counterer ? (
        <PlayerCell steamId={row.original.counterer.steamId} nickname={row.original.counterer.nickname} />
      ) : (
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      ),
  },
  {
    id: 'timePlaced',
    accessorKey: 'timePlaced',
    header: 'Placed',
    size: 80,
    meta: { numeric: true, tooltip: 'Time Placed' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'timeDestroyed',
    accessorKey: 'timeDestroyed',
    header: 'Destroyed',
    size: 80,
    meta: { numeric: true, tooltip: 'Time Destroyed' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(getValue() as number)}</span>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'Type',
    size: 90,
    cell: ({ getValue }) => <span style={{ fontSize: '0.8rem' }}>{getValue() as string}</span>,
  },
  {
    id: 'faction',
    accessorKey: 'faction',
    header: 'Faction',
    size: 80,
    cell: ({ getValue }) => {
      const val = getValue() as string
      const isRadiant = val.toLowerCase().includes('radiant')
      const isDire = val.toLowerCase().includes('dire')
      return (
        <span style={{ fontSize: '0.8rem', color: isRadiant ? '#2dd4bf' : isDire ? '#f87171' : undefined }}>
          {isRadiant ? 'Radiant' : isDire ? 'Dire' : val}
        </span>
      )
    },
  },
  {
    id: 'x',
    accessorKey: 'x',
    header: 'X',
    size: 60,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
        {(getValue() as number).toFixed(0)}
      </span>
    ),
  },
  {
    id: 'y',
    accessorKey: 'y',
    header: 'Y',
    size: 60,
    meta: { numeric: true },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
        {(getValue() as number).toFixed(0)}
      </span>
    ),
  },
  {
    id: 'campBlocked',
    accessorKey: 'campBlocked',
    header: 'Camp',
    size: 60,
    meta: { tooltip: 'Camp Blocked' },
    cell: ({ getValue }) => (
      <span style={{ fontSize: '0.8rem', color: (getValue() as boolean) ? 'var(--color-accent-bright)' : 'var(--color-text-muted)' }}>
        {(getValue() as boolean) ? '✓' : '—'}
      </span>
    ),
  },
]

type ViewMode = 'table' | 'ward-map'

interface WardHashState {
  view: ViewMode
  obs: boolean
  sentry: boolean
  facR: boolean
  facD: boolean
  dewarded: boolean
  tmin: number | null
  tmax: number | null
  teams: number[]
  players: number[]
  heroes: number[]
  match: number | null
  sel: string | null
  mapId: string | null
  z: number | null
  cu: number | null
  cv: number | null
}

function parseHash(): WardHashState {
  const h = window.location.hash.replace(/^#/, '')
  const p = new URLSearchParams(h)
  const num = (k: string) => (p.has(k) ? Number(p.get(k)) : null)
  const bool = (k: string, def: boolean) => (p.has(k) ? p.get(k) === '1' : def)
  const list = (k: string) =>
    p.has(k) ? p.get(k)!.split(',').map(Number).filter((n) => Number.isFinite(n)) : []
  return {
    view: p.get('view') === 'ward-map' || h === 'ward-map' ? 'ward-map' : 'table',
    obs: bool('obs', true),
    sentry: bool('sentry', true),
    facR: bool('facR', true),
    facD: bool('facD', true),
    dewarded: bool('dw', false),
    tmin: num('tmin'),
    tmax: num('tmax'),
    teams: list('team'),
    players: list('player'),
    heroes: list('hero'),
    match: num('match'),
    sel: p.get('sel'),
    mapId: p.get('map'),
    z: num('z'),
    cu: num('cu'),
    cv: num('cv'),
  }
}

function serializeHash(s: WardHashState): string {
  const p = new URLSearchParams()
  if (s.view === 'ward-map') p.set('view', 'ward-map')
  if (!s.obs) p.set('obs', '0')
  if (!s.sentry) p.set('sentry', '0')
  if (!s.facR) p.set('facR', '0')
  if (!s.facD) p.set('facD', '0')
  if (s.dewarded) p.set('dw', '1')
  if (s.tmin != null) p.set('tmin', String(s.tmin))
  if (s.tmax != null) p.set('tmax', String(s.tmax))
  if (s.teams.length) p.set('team', s.teams.join(','))
  if (s.players.length) p.set('player', s.players.join(','))
  if (s.heroes.length) p.set('hero', s.heroes.join(','))
  if (s.match != null) p.set('match', String(s.match))
  if (s.view === 'ward-map' && s.sel) p.set('sel', s.sel)
  if (s.mapId) p.set('map', s.mapId)
  if (s.z != null) p.set('z', s.z.toFixed(3))
  if (s.cu != null) p.set('cu', s.cu.toFixed(4))
  if (s.cv != null) p.set('cv', s.cv.toFixed(4))
  return p.toString()
}

function Check({ checked, onChange, label, color }: { checked: boolean; onChange: () => void; label: string; color?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: color ?? 'var(--color-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: 'var(--color-primary)' }} />
      {label}
    </label>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'var(--color-bg-deep)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.72rem',
  padding: '3px 6px',
  maxWidth: 150,
}

export default function EventWards() {
  const [initial] = useState(parseHash)
  const [view, setView] = useState<ViewMode>(initial.view)
  const [showObs, setShowObs] = useState(initial.obs)
  const [showSentry, setShowSentry] = useState(initial.sentry)
  const [facR, setFacR] = useState(initial.facR)
  const [facD, setFacD] = useState(initial.facD)
  const [dewardedOnly, setDewardedOnly] = useState(initial.dewarded)
  const [tmin, setTmin] = useState<number | null>(initial.tmin)
  const [tmax, setTmax] = useState<number | null>(initial.tmax)
  const [teams, setTeams] = useState<number[]>(initial.teams)
  const [players, setPlayers] = useState<number[]>(initial.players)
  const [heroes, setHeroes] = useState<number[]>(initial.heroes)
  const [matchId, setMatchId] = useState<number | null>(initial.match)
  const [selectedWard, setSelectedWard] = useState<string | null>(initial.sel)
  const [mapId] = useState<string | null>(initial.mapId)
  const [initialMapView] = useState<MapView | null>(() =>
    initial.z != null && initial.cu != null && initial.cv != null
      ? { k: initial.z, cu: initial.cu, cv: initial.cv }
      : null,
  )
  const [mapView, setMapView] = useState<MapView | null>(initialMapView)

  const map = useMemo(() => MAP_VERSIONS.find((m) => m.id === mapId) ?? defaultMapVersion(), [mapId])

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

  const { data, isLoading, error } = useApiQuery<{ data: WardEvent[] }>(
    hasFilters ? '/api/events/wards' : null,
    apiParams,
  )

  const allRows = useMemo(() => data?.data ?? [], [data])

  const timeExtent = useMemo<[number, number]>(() => {
    if (allRows.length === 0) return [0, 60]
    let lo = Infinity
    let hi = -Infinity
    for (const r of allRows) {
      if (r.timePlaced < lo) lo = r.timePlaced
      if (r.timePlaced > hi) hi = r.timePlaced
    }
    return [Math.floor(lo), Math.ceil(hi)]
  }, [allRows])

  // Shared predicate. skipPlayers / skipHeroes let each facet count rows that
  // pass every filter except its own, so its counts reflect the other filters.
  const passes = useCallback(
    (r: WardEvent, opts?: { skipTeams?: boolean; skipPlayers?: boolean; skipHeroes?: boolean }) => {
      const isObs = r.type.toLowerCase().includes('obs')
      const isSentry = r.type.toLowerCase().includes('sentry')
      if (isObs && !showObs) return false
      if (isSentry && !showSentry) return false
      if (!isObs && !isSentry && !(showObs || showSentry)) return false
      const isDire = r.faction.toLowerCase().includes('dire')
      const isRad = r.faction.toLowerCase().includes('radiant')
      if (isDire && !facD) return false
      if (isRad && !facR) return false
      if (dewardedOnly && !r.counterer) return false
      if (tmin != null && r.timePlaced < tmin) return false
      if (tmax != null && r.timePlaced > tmax) return false
      if (!opts?.skipTeams && teams.length && !(r.placerTeam && teams.includes(r.placerTeam.valveId))) return false
      if (!opts?.skipPlayers && players.length && !players.includes(r.placer.steamId)) return false
      if (!opts?.skipHeroes && heroes.length && !heroes.includes(r.placer.hero)) return false
      if (matchId != null && r.matchId !== matchId) return false
      return true
    },
    [showObs, showSentry, facR, facD, dewardedOnly, tmin, tmax, teams, players, heroes, matchId],
  )

  const rows = useMemo(() => allRows.filter((r) => passes(r)), [allRows, passes])

  const teamFacet = useMemo(() => {
    const counts = new Map<number, { label: string; count: number }>()
    for (const r of allRows) {
      if (!r.placerTeam || !passes(r, { skipTeams: true })) continue
      const e = counts.get(r.placerTeam.valveId)
      if (e) e.count++
      else counts.set(r.placerTeam.valveId, { label: r.placerTeam.name, count: 1 })
    }
    return [...counts.entries()]
      .map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => b.count - a.count)
  }, [allRows, passes])

  const playerFacet = useMemo(() => {
    const counts = new Map<number, { label: string; count: number }>()
    for (const r of allRows) {
      if (!passes(r, { skipPlayers: true })) continue
      const e = counts.get(r.placer.steamId)
      if (e) e.count++
      else counts.set(r.placer.steamId, { label: r.placer.nickname, count: 1 })
    }
    return [...counts.entries()]
      .map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => b.count - a.count)
  }, [allRows, passes])

  const heroFacet = useMemo(() => {
    const counts = new Map<number, number>()
    for (const r of allRows) {
      if (!passes(r, { skipHeroes: true })) continue
      counts.set(r.placer.hero, (counts.get(r.placer.hero) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, label: heroesById[String(value)]?.name ?? `Hero ${value}`, count }))
      .sort((a, b) => b.count - a.count)
  }, [allRows, passes])

  const times = useMemo(() => rows.map((r) => r.timePlaced), [rows])

  useEffect(() => {
    const state: WardHashState = {
      view,
      obs: showObs,
      sentry: showSentry,
      facR,
      facD,
      dewarded: dewardedOnly,
      tmin,
      tmax,
      teams,
      players,
      heroes,
      match: matchId,
      sel: view === 'ward-map' ? selectedWard : null,
      mapId,
      z: view === 'ward-map' && mapView ? mapView.k : null,
      cu: view === 'ward-map' && mapView ? mapView.cu : null,
      cv: view === 'ward-map' && mapView ? mapView.cv : null,
    }
    const str = serializeHash(state)
    const current = window.location.hash.replace(/^#/, '')
    if (str !== current) {
      const url = str ? `#${str}` : window.location.pathname + window.location.search
      window.history.replaceState(null, '', url)
    }
  }, [view, showObs, showSentry, facR, facD, dewardedOnly, tmin, tmax, teams, players, heroes, matchId, selectedWard, mapId, mapView])

  const isolated = teams.length > 0 || players.length > 0 || heroes.length > 0 || matchId != null || tmin != null || tmax != null

  const teamSelectOptions = useMemo(
    () => teamFacet.map(({ value, label }) => ({ value, label })),
    [teamFacet],
  )
  const playerSelectOptions = useMemo(
    () => playerFacet.map(({ value, label }) => ({ value, label })),
    [playerFacet],
  )
  const heroSelectOptions = useMemo(
    () => heroFacet.map(({ value, label }) => ({ value, label })),
    [heroFacet],
  )

  const heroIcon = (id: number) => {
    const pic = heroesById[String(id)]?.picture
    return pic ? <img src={heroImageUrl(pic)} alt="" style={{ height: 15, borderRadius: 2 }} /> : null
  }

  // Renders the in-memory filter set either as a horizontal row (table view)
  // or a stacked column with section labels (ward-map sidebar).
  function renderFilters(layout: 'row' | 'column') {
    const col = layout === 'column'
    const rowWrap: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }
    const sep = <span style={{ color: 'var(--color-border)' }}>|</span>
    const label = (t: string) =>
      col ? (
        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 6 }}>{t}</div>
      ) : null

    const viewToggle = (
      <div className={toggleStyles.toggleRow} style={{ marginBottom: 0 }}>
        <button className={`${toggleStyles.toggleBtn} ${view === 'table' ? toggleStyles.toggleActive : ''}`} onClick={() => setView('table')}>Table</button>
        <button className={`${toggleStyles.toggleBtn} ${view === 'ward-map' ? toggleStyles.toggleActive : ''}`} onClick={() => setView('ward-map')}>Ward Map</button>
      </div>
    )

    const minInput = (
      <input
        type="range"
        min={timeExtent[0]}
        max={timeExtent[1]}
        value={tmin ?? timeExtent[0]}
        onChange={(e) => {
          const v = Math.min(Number(e.target.value), tmax ?? timeExtent[1])
          setTmin(v <= timeExtent[0] ? null : v)
        }}
        style={{ flex: col ? 1 : undefined, width: col ? undefined : 90, accentColor: 'var(--color-primary)' }}
      />
    )
    const maxInput = (
      <input
        type="range"
        min={timeExtent[0]}
        max={timeExtent[1]}
        value={tmax ?? timeExtent[1]}
        onChange={(e) => {
          const v = Math.max(Number(e.target.value), tmin ?? timeExtent[0])
          setTmax(v >= timeExtent[1] ? null : v)
        }}
        style={{ flex: col ? 1 : undefined, width: col ? undefined : 90, accentColor: 'var(--color-primary)' }}
      />
    )
    const timeSlider = col ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 92, flexShrink: 0 }}>From {fmtTime(tmin ?? timeExtent[0])}</span>
          {minInput}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 92, flexShrink: 0 }}>To {fmtTime(tmax ?? timeExtent[1])}</span>
          {maxInput}
        </div>
      </div>
    ) : (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{fmtTime(tmin ?? timeExtent[0])}</span>
        {minInput}
        {maxInput}
        <span style={{ color: 'var(--color-text-secondary)' }}>{fmtTime(tmax ?? timeExtent[1])}</span>
      </div>
    )

    const teamSel = col ? (
      <FacetToggleList items={teamFacet} selected={teams} onChange={setTeams} placeholder="Search teams…" />
    ) : (
      <LocalMultiSelect options={teamSelectOptions} selected={teams} onChange={setTeams} placeholder="Filter teams…" />
    )
    const playerSel = col ? (
      <FacetToggleList items={playerFacet} selected={players} onChange={setPlayers} placeholder="Search players…" />
    ) : (
      <LocalMultiSelect options={playerSelectOptions} selected={players} onChange={setPlayers} placeholder="Filter players…" />
    )
    const heroSel = col ? (
      <FacetToggleList items={heroFacet} selected={heroes} onChange={setHeroes} placeholder="Search heroes…" renderIcon={heroIcon} />
    ) : (
      <LocalMultiSelect options={heroSelectOptions} selected={heroes} onChange={setHeroes} placeholder="Filter heroes…" renderIcon={heroIcon} />
    )

    const matchChip = matchId != null ? (
      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
        Match {matchId}
        <button onClick={() => setMatchId(null)} style={{ marginLeft: 4, background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>×</button>
      </span>
    ) : null

    const clearBtn = isolated ? (
      <button
        onClick={() => { setTeams([]); setPlayers([]); setHeroes([]); setMatchId(null); setTmin(null); setTmax(null) }}
        style={{ ...selectStyle, cursor: 'pointer', color: 'var(--color-primary)', borderColor: 'var(--color-primary-dim)', marginLeft: col ? 0 : 'auto' }}
      >
        Clear filters
      </button>
    ) : null

    const typeChecks = (
      <>
        <Check checked={showObs} onChange={() => setShowObs(!showObs)} label="Observers" />
        <Check checked={showSentry} onChange={() => setShowSentry(!showSentry)} label="Sentries" />
      </>
    )
    const factionChecks = (
      <>
        <Check checked={facR} onChange={() => setFacR(!facR)} label="Radiant" color="#6ee7b7" />
        <Check checked={facD} onChange={() => setFacD(!facD)} label="Dire" color="#fca5a5" />
      </>
    )
    const flagChecks = (
      <>
        <Check checked={dewardedOnly} onChange={() => setDewardedOnly(!dewardedOnly)} label="Dewarded only" />
      </>
    )

    if (col) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {viewToggle}
          <div>{label('Ward type')}<div style={rowWrap}>{typeChecks}</div></div>
          <div>{label('Faction')}<div style={rowWrap}>{factionChecks}</div></div>
          <div>{label('Show only')}<div style={rowWrap}>{flagChecks}</div></div>
          <div>{label('Time placed')}{timeSlider}</div>
          <div>{label('Teams')}{teamSel}</div>
          <div>{label('Players')}{playerSel}</div>
          <div>{label('Heroes')}{heroSel}</div>
          {matchChip}
          {clearBtn}
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 8 }}>
        {viewToggle}
        <div style={{ ...rowWrap, alignItems: 'center' }}>
          {typeChecks}{sep}{factionChecks}{sep}{flagChecks}
        </div>
        {timeSlider}
        <div style={{ minWidth: 160, flex: '0 1 200px' }}>{teamSel}</div>
        <div style={{ minWidth: 160, flex: '0 1 200px' }}>{playerSel}</div>
        <div style={{ minWidth: 160, flex: '0 1 200px' }}>{heroSel}</div>
        {matchChip}
        {clearBtn}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageMeta title="Ward Placement — Pro Dota 2 Stats" description="Observer and sentry ward placement heat maps in pro Dota 2." />
      <div className={styles.header}>
        <h1>Wards Placed</h1>
        <p className={styles.subtitle}>
          Observer and sentry ward placement events
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'teams', 'heroes', 'patch', 'after', 'before', 'duration', 'leagues', 'splits', 'split-type', 'tier']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Apply filters to load data, or use</p>
          <button className={styles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {isLoading && hasFilters && <EnigmaLoader text="Fetching ward data..." />}

      {error && hasFilters && (
        <div className={styles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {view === 'table' && allRows.length > 0 && (
        <>
          <div style={{ marginBottom: 'var(--space-lg)' }}>{renderFilters('row')}</div>
          <TimeDistributionChart times={times} />
          <DataTable
            data={rows}
            columns={columns}
            defaultSorting={[{ id: 'matchId', desc: true }]}
            searchValue={(r) => [
              String(r.matchId),
              r.placer.nickname,
              String(r.placer.steamId),
              r.placerTeam?.name ?? '',
              r.placerTeam?.valveId != null ? String(r.placerTeam.valveId) : '',
              heroesById[String(r.placer.hero)]?.name ?? '',
              String(r.placer.hero),
              r.counterer?.nickname ?? '',
              r.counterer?.steamId != null ? String(r.counterer.steamId) : '',
              r.counterer?.hero != null ? (heroesById[String(r.counterer.hero)]?.name ?? '') : '',
              r.counterer?.hero != null ? String(r.counterer.hero) : '',
              r.type,
              r.faction,
            ].join(' ')}
          />
        </>
      )}

      {view === 'ward-map' && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--nav-height)',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-bg-deep)',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, padding: 8 }}>
            <WardMap
              map={map}
              wards={rows}
              calibrate={false}
              initialView={initialMapView}
              onViewChange={setMapView}
              selectedKey={selectedWard}
              onSelectKey={setSelectedWard}
            />
          </div>
          <div
            style={{
              width: 'clamp(240px, 26vw, 320px)',
              flexShrink: 0,
              borderLeft: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              overflowY: 'auto',
              padding: '14px 14px 40px',
            }}
          >
            {renderFilters('column')}
          </div>
        </div>
      )}
    </div>
  )
}
