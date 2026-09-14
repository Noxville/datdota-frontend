import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageMeta from '../components/PageMeta'
import { usePlayerAutocomplete, useTeamAutocomplete, useLeagueAutocomplete } from '../api/autocomplete'
import { fetchPlayerNames, fetchTeamNames, fetchLeagueNames } from '../api/entityInfo'
import { heroImageUrl, itemImageUrl } from '../config'
import {
  UNSET, isUnset, type Leaf, type FieldDef, type MatchDraft,
  META_FIELDS, PLAYER_FIELDS,
  HERO_LIST, ITEM_LIST, heroName, itemName, heroPicture, itemShortName,
  blankMatch, blankPickBan, importMatch, importSkeleton, assembleExport,
  collectProblems, collectWarnings, fieldWarning, flipTeams, movePlayer, sidePlayers,
  generateCmDraft, deriveSlot, matchLabel,
  type Suggestion,
} from '../data/manualMatchSchema'

function heroIconSrc(id: number): string | undefined {
  const pic = heroPicture(id)
  return pic ? heroImageUrl(pic) : undefined
}
function itemIconSrc(id: number): string | undefined {
  const short = itemShortName(id)
  return short ? itemImageUrl(short) : undefined
}
import styles from './ManualMatchEntry.module.css'

const STORAGE_KEY = 'datdota:manual-match-entry:v1'
const MAX_TABS = 12

interface Tab {
  id: string
  match: MatchDraft
}

interface StoredState {
  tabs: Tab[]
  activeId: string
}

function newTab(match?: MatchDraft): Tab {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, match: match ?? blankMatch() }
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState
      if (parsed.tabs?.length) return parsed
    }
  } catch { /* ignore */ }
  const t = newTab()
  return { tabs: [t], activeId: t.id }
}

/* ── Click-outside helper ────────────────────────────────── */

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

/* ── Static picker (hero / item) ─────────────────────────── */

function StaticPicker({
  list, value, resolve, onChange, allowRawId, iconSrc,
}: {
  list: Suggestion[]
  value: Leaf
  resolve: (id: number) => string | undefined
  onChange: (v: Leaf) => void
  allowRawId?: boolean
  iconSrc?: (id: number) => string | undefined
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const num = typeof value === 'number' ? value : null

  const matches = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return list.slice(0, 12)
    return list.filter((s) => s.name.toLowerCase().includes(ql)).slice(0, 12)
  }, [q, list])
  const digits = /^\d+$/.test(q.trim())

  const select = (id: number) => { onChange(id); setQ(''); setOpen(false) }

  if (num != null && !open) {
    const src = iconSrc?.(num)
    return (
      <div className={styles.picker} ref={ref}>
        <div className={styles.pickerValueWrap}>
          <button type="button" className={styles.pickerValue} onClick={() => { setQ(resolve(num) ?? ''); setOpen(true) }} title="Click to change">
            <span className={styles.pickerValueMain}>
              {src && <img src={src} alt="" className={styles.pickerIcon} loading="lazy" />}
              {resolve(num) ?? `#${num}`}
            </span>
            <span className={styles.pickerId}>#{num}</span>
          </button>
          <button type="button" className={styles.pickerClear} onClick={() => onChange(UNSET)} title="Clear selection">×</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.picker} ref={ref}>
      <input
        className={styles.pickerInput}
        placeholder="search or ID…"
        value={q}
        autoFocus={num != null}
        onFocus={(e) => { setOpen(true); e.target.select() }}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
      />
      {open && (matches.length > 0 || (allowRawId && digits)) && (
        <div className={styles.pickerMenu}>
          {allowRawId && digits && (
            <button type="button" className={styles.pickerOption} onClick={() => select(Number(q.trim()))}>
              Use ID {q.trim()}
            </button>
          )}
          {matches.map((m) => {
            const src = iconSrc?.(m.id)
            return (
              <button type="button" key={m.id} className={styles.pickerOption} onClick={() => select(m.id)}>
                <span className={styles.pickerValueMain}>
                  {src && <img src={src} alt="" className={styles.pickerIcon} loading="lazy" />}
                  {m.name}
                </span>
                <span className={styles.pickerId}>#{m.id}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── API picker (player / team / league) ─────────────────── */

const NAME_CACHE_KEY = 'datdota:mme:names'

function loadNameCache(): Record<string, Record<number, string>> {
  try {
    const raw = localStorage.getItem(NAME_CACHE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { player: p.player ?? {}, team: p.team ?? {}, league: p.league ?? {} }
    }
  } catch { /* ignore */ }
  return { player: {}, team: {}, league: {} }
}

const apiNameCache: Record<string, Record<number, string>> = loadNameCache()

function cacheName(key: string, id: number, name: string) {
  if (apiNameCache[key][id] === name) return
  apiNameCache[key][id] = name
  try { localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(apiNameCache)) } catch { /* quota */ }
}

function ApiPicker({
  cacheKey, useHook, mapResult, value, onChange, onPick,
}: {
  cacheKey: 'player' | 'team' | 'league'
  useHook: (q: string) => { data?: unknown[] }
  mapResult: (r: unknown) => Suggestion
  value: Leaf
  onChange: (v: Leaf) => void
  onPick?: (s: Suggestion) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const { data } = useHook(q)
  const num = typeof value === 'number' ? value : null

  const matches = useMemo(() => {
    const list = (data ?? []).map(mapResult)
    for (const s of list) cacheName(cacheKey, s.id, s.name)
    return list.slice(0, 12)
  }, [data, mapResult, cacheKey])
  const digits = /^\d+$/.test(q.trim())

  const select = (s: Suggestion) => {
    cacheName(cacheKey, s.id, s.name)
    onChange(s.id)
    onPick?.(s)
    setQ('')
    setOpen(false)
  }
  const selectRaw = (id: number) => { onChange(id); setQ(''); setOpen(false) }

  if (num != null && !open) {
    return (
      <div className={styles.picker} ref={ref}>
        <div className={styles.pickerValueWrap}>
          <button type="button" className={styles.pickerValue} onClick={() => { setQ(apiNameCache[cacheKey][num] ?? ''); setOpen(true) }} title="Click to change">
            <span className={styles.pickerValueMain}>{apiNameCache[cacheKey][num] ?? `#${num}`}</span>
            <span className={styles.pickerId}>#{num}</span>
          </button>
          <button type="button" className={styles.pickerClear} onClick={() => onChange(UNSET)} title="Clear selection">×</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.picker} ref={ref}>
      <input
        className={styles.pickerInput}
        placeholder="search name or ID…"
        value={q}
        autoFocus={num != null}
        onFocus={(e) => { setOpen(true); e.target.select() }}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
      />
      {open && (matches.length > 0 || digits) && (
        <div className={styles.pickerMenu}>
          {digits && (
            <button type="button" className={styles.pickerOption} onClick={() => selectRaw(Number(q.trim()))}>
              Use ID {q.trim()}
            </button>
          )}
          {matches.map((m) => (
            <button type="button" key={m.id} className={styles.pickerOption} onClick={() => select(m)}>
              {m.name} <span className={styles.pickerId}>#{m.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Timestamp control ───────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Unix seconds → "dd/MM/yyyy HH:mm:ss" (UTC). */
function formatUtc(unix: number): string {
  const d = new Date(unix * 1000)
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`
}

/** "dd/MM/yyyy HH:mm:ss" (UTC, seconds optional) → unix seconds, or null. */
function parseUtc(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const dd = +m[1], mm = +m[2], yyyy = +m[3], hh = +m[4], mi = +m[5], ss = m[6] ? +m[6] : 0
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || mi > 59 || ss > 59) return null
  return Math.floor(Date.UTC(yyyy, mm - 1, dd, hh, mi, ss) / 1000)
}

function TimestampControl({ value, onChange }: { value: Leaf; onChange: (v: Leaf) => void }) {
  const num = typeof value === 'number' ? value : null
  const [text, setText] = useState(() => (num != null ? formatUtc(num) : ''))
  const [err, setErr] = useState(false)
  const [syncedNum, setSyncedNum] = useState(num)

  // Resync the text when the value changes externally (import, flip, etc.), but
  // not when the current text already represents it (i.e. the user just typed it).
  if (num !== syncedNum) {
    setSyncedNum(num)
    if (parseUtc(text) !== num) {
      setText(num != null ? formatUtc(num) : '')
      setErr(false)
    }
  }

  const commit = (t: string) => {
    setText(t)
    if (t.trim() === '') { setErr(false); onChange(UNSET); return }
    const parsed = parseUtc(t)
    if (parsed == null) { setErr(true); return }
    setErr(false)
    onChange(parsed)
  }

  return (
    <div className={styles.tsControl}>
      <input
        type="text"
        className={`${styles.tsInput} ${err ? styles.tsErr : ''}`}
        placeholder="dd/MM/yyyy HH:mm:ss"
        value={text}
        onChange={(e) => commit(e.target.value)}
      />
      {num != null && <span className={styles.tsUnix}>{num} · UTC</span>}
    </div>
  )
}

/* ── Generic field ───────────────────────────────────────── */

function mapPlayer(r: unknown): Suggestion { const p = r as { name: string; steam_id: number }; return { id: p.steam_id, name: p.name } }
function mapTeam(r: unknown): Suggestion { const t = r as { name: string; team_id: number }; return { id: t.team_id, name: t.name } }
function mapLeague(r: unknown): Suggestion { const l = r as { name: string; league_id: number }; return { id: l.league_id, name: l.name } }

function Control({ def, value, onChange, onPickEntity }: {
  def: FieldDef
  value: Leaf
  onChange: (v: Leaf) => void
  onPickEntity?: (s: Suggestion) => void
}) {
  switch (def.type) {
    case 'int':
      return (
        <input
          type="number"
          className={styles.numInput}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? UNSET : Number(e.target.value))}
        />
      )
    case 'string':
      return (
        <input
          type="text"
          className={styles.textInput}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? UNSET : e.target.value)}
        />
      )
    case 'bool':
      return (
        <select
          className={styles.select}
          value={typeof value === 'boolean' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? UNSET : e.target.value === 'true')}
        >
          <option value="">— unset —</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      )
    case 'timestamp':
      return <TimestampControl value={value} onChange={onChange} />
    case 'hero':
      return <StaticPicker list={HERO_LIST} value={value} resolve={heroName} onChange={onChange} iconSrc={heroIconSrc} allowRawId />
    case 'item':
      return <StaticPicker list={ITEM_LIST} value={value} resolve={itemName} onChange={onChange} iconSrc={itemIconSrc} allowRawId />
    case 'player':
      return <ApiPicker cacheKey="player" useHook={usePlayerAutocomplete} mapResult={mapPlayer} value={value} onChange={onChange} onPick={onPickEntity} />
    case 'team':
      return <ApiPicker cacheKey="team" useHook={useTeamAutocomplete} mapResult={mapTeam} value={value} onChange={onChange} onPick={onPickEntity} />
    case 'league':
      return <ApiPicker cacheKey="league" useHook={useLeagueAutocomplete} mapResult={mapLeague} value={value} onChange={onChange} onPick={onPickEntity} />
  }
}

function Field({ def, value, onChange, onPickEntity }: {
  def: FieldDef
  value: Leaf
  onChange: (v: Leaf) => void
  onPickEntity?: (s: Suggestion) => void
}) {
  const unset = isUnset(value)
  const isNull = value === null
  const warn = fieldWarning(def, value)
  return (
    <div className={`${styles.field} ${unset ? styles.fieldUnset : ''} ${warn ? styles.fieldWarn : ''}`}>
      <span className={styles.fieldLabel}>
        {def.label}
        {unset && <span className={styles.unsetDot} title="Unset — must be filled or marked unknown" />}
        {warn && <span className={styles.warnDot} title={warn}>⚠</span>}
      </span>
      <div className={styles.fieldControl}>
        {isNull ? (
          <button type="button" className={styles.nullChip} onClick={() => onChange(UNSET)} title="Clear (back to unset)">
            unknown (null) ✕
          </button>
        ) : (
          <Control def={def} value={value} onChange={onChange} onPickEntity={onPickEntity} />
        )}
        {def.nullable && !isNull && (
          <button type="button" className={styles.nullBtn} onClick={() => onChange(null)} title="Mark unknown (null)">∅</button>
        )}
      </div>
    </div>
  )
}

/* ── Captain select (limited to that side's players) ─────── */

function CaptainField({ def, value, options, onChange }: {
  def: FieldDef
  value: Leaf
  options: number[]
  onChange: (v: Leaf) => void
}) {
  const unset = isUnset(value)
  const isNull = value === null
  const num = typeof value === 'number' ? value : null
  const opts = num != null && !options.includes(num) ? [...options, num] : options
  return (
    <div className={`${styles.field} ${unset ? styles.fieldUnset : ''}`}>
      <span className={styles.fieldLabel}>
        {def.label}
        {unset && <span className={styles.unsetDot} title="Unset — must be filled or marked unknown" />}
      </span>
      <div className={styles.fieldControl}>
        {isNull ? (
          <button type="button" className={styles.nullChip} onClick={() => onChange(UNSET)}>unknown (null) ✕</button>
        ) : (
          <select
            className={styles.select}
            value={num != null ? String(num) : ''}
            onChange={(e) => onChange(e.target.value === '' ? UNSET : Number(e.target.value))}
          >
            <option value="">— select player —</option>
            {opts.map((id) => (
              <option key={id} value={id}>
                {apiNameCache.player[id] ?? `#${id}`}{options.includes(id) ? '' : ' (not in team)'}
              </option>
            ))}
          </select>
        )}
        {def.nullable && !isNull && (
          <button type="button" className={styles.nullBtn} onClick={() => onChange(null)} title="Mark unknown (null)">∅</button>
        )}
      </div>
    </div>
  )
}

/* ── Pick / ban row ──────────────────────────────────────── */

function PickBanRow({ row, radiantName, direName, onField, onRemove }: {
  row: Record<string, Leaf>
  radiantName: string
  direName: string
  onField: (key: string, v: Leaf) => void
  onRemove: () => void
}) {
  const isPick = row.is_pick
  const team = row.team
  return (
    <div className={styles.pbRow}>
      <div className={styles.pbOrder}>
        <span className={styles.fieldLabel}>Order</span>
        <input
          type="number"
          className={styles.numInput}
          value={typeof row.order === 'number' ? row.order : ''}
          onChange={(e) => onField('order', e.target.value === '' ? UNSET : Number(e.target.value))}
        />
      </div>
      <div className={styles.pbType}>
        <span className={styles.fieldLabel}>Type</span>
        <div className={styles.toggle}>
          <button type="button" className={`${styles.toggleBtn} ${isPick === true ? styles.togglePick : ''}`} onClick={() => onField('is_pick', true)}>Pick</button>
          <button type="button" className={`${styles.toggleBtn} ${isPick === false ? styles.toggleBan : ''}`} onClick={() => onField('is_pick', false)}>Ban</button>
        </div>
      </div>
      <div className={styles.pbTeam}>
        <span className={styles.fieldLabel}>Team</span>
        <select
          className={styles.select}
          value={typeof team === 'number' ? String(team) : ''}
          onChange={(e) => onField('team', e.target.value === '' ? UNSET : Number(e.target.value))}
        >
          <option value="">— team —</option>
          <option value="0">{radiantName || 'Radiant'}</option>
          <option value="1">{direName || 'Dire'}</option>
        </select>
      </div>
      <div className={styles.pbHero}>
        <span className={styles.fieldLabel}>Hero</span>
        <StaticPicker list={HERO_LIST} value={row.hero_id} resolve={heroName} onChange={(v) => onField('hero_id', v)} iconSrc={heroIconSrc} allowRawId />
      </div>
      <button type="button" className={styles.pbRemove} onClick={onRemove} aria-label="Remove row">×</button>
    </div>
  )
}

/* ── Collapsible section ─────────────────────────────────── */

function Section({ title, children, defaultOpen = true, right }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  right?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <button type="button" className={styles.sectionToggle} onClick={() => setOpen(!open)}>
          <span className={styles.caret}>{open ? '▾' : '▸'}</span> {title}
        </button>
        {right}
      </div>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────── */

export default function ManualMatchEntry() {
  const [state, setState] = useState<StoredState>(loadState)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota */ }
  }, [state])

  const active = state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0]

  const updateMatch = useCallback((fn: (m: MatchDraft) => MatchDraft) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === s.activeId ? { ...t, match: fn(t.match) } : t)),
    }))
  }, [])

  const setMeta = (key: string, v: Leaf) => updateMatch((m) => ({ ...m, meta: { ...m.meta, [key]: v } }))
  const setPlayer = (i: number, key: string, v: Leaf) =>
    updateMatch((m) => ({ ...m, players: m.players.map((p, idx) => (idx === i ? { ...p, [key]: v } : p)) }))
  const setPickBan = (i: number, key: string, v: Leaf) =>
    updateMatch((m) => ({ ...m, picks_bans: m.picks_bans.map((pb, idx) => (idx === i ? { ...pb, [key]: v } : pb)) }))

  const addTab = () => {
    if (state.tabs.length >= MAX_TABS) return
    const t = newTab()
    setState((s) => ({ tabs: [...s.tabs, t], activeId: t.id }))
  }

  const closeTab = (id: string) => {
    setState((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      if (tabs.length === 0) { const t = newTab(); return { tabs: [t], activeId: t.id } }
      const activeId = s.activeId === id ? tabs[tabs.length - 1].id : s.activeId
      return { tabs, activeId }
    })
  }

  const parseImport = (): Record<string, unknown> | null => {
    setImportError('')
    let parsed: unknown
    try { parsed = JSON.parse(importText) } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON')
      return null
    }
    if (!parsed || typeof parsed !== 'object') { setImportError('Expected a JSON object'); return null }
    return parsed as Record<string, unknown>
  }

  const doImport = () => {
    const parsed = parseImport()
    if (!parsed) return
    const t = newTab(importMatch(parsed))
    setState((s) => ({ tabs: s.tabs.length >= MAX_TABS ? s.tabs : [...s.tabs, t], activeId: t.id }))
    setImportOpen(false)
    setImportText('')
    resolveNames(parsed)
  }

  const doImportSkeleton = () => {
    const parsed = parseImport()
    if (!parsed) return
    updateMatch((m) => importSkeleton(m, parsed))
    setImportOpen(false)
    setImportText('')
    resolveNames(parsed)
  }

  const onImportFile = (file: File) => {
    file.text().then((txt) => { setImportText(txt); setImportOpen(true) })
  }

  const problems = useMemo(() => (active ? collectProblems(active.match) : []), [active])
  const warnings = useMemo(() => (active ? collectWarnings(active.match) : []), [active])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [firstPick, setFirstPick] = useState<0 | 1>(0)
  const [, bumpNames] = useState(0)

  // Which team currently owns the first draft step (from the rows if any, else the toggle).
  const effectiveFirstPick = useMemo<0 | 1>(() => {
    const rows = active?.match.picks_bans ?? []
    if (rows.length) {
      const first = [...rows].sort((a, b) => (typeof a.order === 'number' ? a.order : 0) - (typeof b.order === 'number' ? b.order : 0))[0]
      if (typeof first.team === 'number') return first.team === 1 ? 1 : 0
    }
    return firstPick
  }, [active, firstPick])

  const chooseFirstPick = (team: 0 | 1) => {
    setFirstPick(team)
    if (team !== effectiveFirstPick) {
      updateMatch((m) => ({
        ...m,
        picks_bans: m.picks_bans.map((pb) => ({
          ...pb,
          team: typeof pb.team === 'number' ? (pb.team === 0 ? 1 : 0) : pb.team,
        })),
      }))
    }
  }

  const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  const resolveNames = useCallback(async (raw: Record<string, unknown>) => {
    // Seed team names straight from the file (radiant_name / dire_name).
    const seed = (idKey: string, nameKey: string) => {
      const id = asNum(raw[idKey])
      const name = raw[nameKey]
      if (id != null && typeof name === 'string' && name) cacheName('team', id, name)
    }
    seed('radiant_team_id', 'radiant_name')
    seed('dire_team_id', 'dire_name')
    bumpNames((v) => v + 1)

    const players = Array.isArray(raw.players) ? (raw.players as Record<string, unknown>[]) : []
    const playerIds = [
      ...players.map((p) => asNum(p.account_id)),
      asNum(raw.radiant_captain),
      asNum(raw.dire_captain),
    ].filter((v): v is number => v != null && !apiNameCache.player[v])
    const teamIds = [asNum(raw.radiant_team_id), asNum(raw.dire_team_id)]
      .filter((v): v is number => v != null && !apiNameCache.team[v])
    const leagueIds = [asNum(raw.league_id)].filter((v): v is number => v != null && !apiNameCache.league[v])

    try {
      const empty: Record<string, string> = {}
      const [pl, tm, lg] = await Promise.all([
        playerIds.length ? fetchPlayerNames([...new Set(playerIds)].map(String)) : Promise.resolve(empty),
        teamIds.length ? fetchTeamNames([...new Set(teamIds)].map(String)) : Promise.resolve(empty),
        leagueIds.length ? fetchLeagueNames([...new Set(leagueIds)].map(String)) : Promise.resolve(empty),
      ])
      for (const [id, name] of Object.entries(pl)) cacheName('player', Number(id), name)
      for (const [id, name] of Object.entries(tm)) cacheName('team', Number(id), name)
      for (const [id, name] of Object.entries(lg)) cacheName('league', Number(id), name)
    } catch { /* names are best-effort */ }
    bumpNames((v) => v + 1)
  }, [])

  const doExport = () => {
    if (!active) return
    const obj = assembleExport(active.match)
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${matchLabel(active.match)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (!active) return null

  return (
    <div className={styles.page}>
      <PageMeta title="Manual Match Entry" description="Manually enter data for a missing Dota 2 match and export it as JSON." noindex />

      <div className={styles.header}>
        <h1>Manual Match Entry</h1>
        <p className={styles.subtitle}>
          Enter a missing match by hand, then export the JSON. Drafts are saved in your browser (this device only).
          Every field starts <strong>unset</strong> — fill it, or mark it <em>unknown</em> (null) where allowed.
        </p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {state.tabs.map((t) => (
          <div key={t.id} className={`${styles.tab} ${t.id === state.activeId ? styles.tabActive : ''}`}>
            <button type="button" className={styles.tabLabel} onClick={() => setState((s) => ({ ...s, activeId: t.id }))}>
              {matchLabel(t.match)}
            </button>
            <button type="button" className={styles.tabClose} onClick={() => closeTab(t.id)} aria-label="Close tab">×</button>
          </div>
        ))}
        {state.tabs.length < MAX_TABS && (
          <button type="button" className={styles.tabAdd} onClick={addTab}>+ New</button>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={() => setImportOpen((v) => !v)}>Import JSON</button>
        <label className={styles.btn}>
          Import file
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = '' }}
          />
        </label>
        <button type="button" className={styles.btn} onClick={() => resolveNames(assembleExport(active.match))} title="Look up player / team / league names for the current IDs">
          Resolve names
        </button>
        <div className={styles.spacer} />
        <span className={problems.length === 0 ? styles.validOk : styles.validBad}>
          {problems.length === 0 ? '✓ Valid — all fields set' : `${problems.length} field(s) unset — exported as "${UNSET}"`}
        </span>
        <button type="button" className={styles.btnPrimary} onClick={doExport}>
          Export {matchLabel(active.match)}.json
        </button>
      </div>

      {importOpen && (
        <div className={styles.importPanel}>
          <textarea
            className={styles.importTextarea}
            placeholder="Paste match JSON here (partial is fine)…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
          />
          {importError && <div className={styles.importError}>{importError}</div>}
          <div className={styles.importActions}>
            <button type="button" className={styles.btnPrimary} onClick={doImport}>Import full → new tab</button>
            <button type="button" className={styles.btn} onClick={doImportSkeleton}>Import skeleton → this tab</button>
            <button type="button" className={styles.btn} onClick={() => { setImportOpen(false); setImportError('') }}>Cancel</button>
          </div>
          <div className={styles.importHint}>
            Skeleton copies only the teams, league and roster (player IDs &amp; slots) from another game between the same teams — heroes and stats stay untouched.
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <div className={styles.problems}>
          <div className={styles.problemsHead}>
            <span>{problems.length} field(s) still unset — kept as "{UNSET}" in the export so you can re-import and finish later</span>
          </div>
          <div className={styles.problemsList}>
            {problems.slice(0, 40).map((p, i) => <span key={i} className={styles.problemItem}>{p.path}</span>)}
            {problems.length > 40 && <span className={styles.problemItem}>+{problems.length - 40} more…</span>}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className={styles.warnings}>
          <div className={styles.warningsHead}>⚠ {warnings.length} value warning(s) — not blocking export</div>
          <div className={styles.problemsList}>
            {warnings.slice(0, 40).map((w, i) => <span key={i} className={styles.warnItem} title={w.message}>{w.path}</span>)}
            {warnings.length > 40 && <span className={styles.warnItem}>+{warnings.length - 40} more…</span>}
          </div>
        </div>
      )}

      {/* Match meta */}
      <Section title="Match">
        <div className={styles.grid}>
          {META_FIELDS.map((def) => {
            if (def.key === 'radiant_captain' || def.key === 'dire_captain') {
              const side = def.key === 'radiant_captain' ? 0 : 1
              const options = sidePlayers(active.match, side)
                .map((p) => p.account_id)
                .filter((v): v is number => typeof v === 'number')
              return (
                <CaptainField
                  key={def.key}
                  def={def}
                  value={active.match.meta[def.key]}
                  options={options}
                  onChange={(v) => setMeta(def.key, v)}
                />
              )
            }
            return (
              <Field
                key={def.key}
                def={def}
                value={active.match.meta[def.key]}
                onChange={(v) => setMeta(def.key, v)}
                onPickEntity={(s) => {
                  if (def.key === 'radiant_team_id') setMeta('radiant_name', s.name)
                  if (def.key === 'dire_team_id') setMeta('dire_name', s.name)
                }}
              />
            )
          })}
        </div>
      </Section>

      {/* Players */}
      <Section
        title="Players (10)"
        right={
          <button type="button" className={styles.btnSmall} onClick={() => updateMatch(flipTeams)}>
            ⇄ Flip Radiant/Dire
          </button>
        }
      >
        <div className={styles.playerGroups}>
          {([0, 1] as const).map((side) => (
            <div key={side} className={styles.playerGroup}>
              <div className={`${styles.groupHead} ${side === 0 ? styles.groupRadiant : styles.groupDire}`}>
                {side === 0 ? 'Radiant' : 'Dire'}
              </div>
              {active.match.players.slice(side * 5, side * 5 + 5).map((pl, j) => {
                const i = side * 5 + j
                const d = deriveSlot(i)
                return (
                  <div
                    key={i}
                    className={`${styles.playerCard} ${dragIndex === i ? styles.playerDragging : ''}`}
                    onDragOver={(e) => { e.preventDefault() }}
                    onDrop={() => {
                      if (dragIndex != null) updateMatch((m) => ({ ...m, players: movePlayer(m.players, dragIndex, i) }))
                      setDragIndex(null)
                    }}
                  >
                    <div className={styles.playerHead}>
                      <span
                        className={styles.dragHandle}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragEnd={() => setDragIndex(null)}
                        title="Drag to reorder (across teams too)"
                      >
                        ⠿
                      </span>
                      Player {i + 1}
                      <span className={styles.slotTag}>slot {d.player_slot}</span>
                    </div>
                    <div className={styles.grid}>
                      {PLAYER_FIELDS.filter((def) => !def.derived).map((def) => (
                        <Field key={def.key} def={def} value={pl[def.key]} onChange={(v) => setPlayer(i, def.key, v)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Section>

      {/* Picks / Bans */}
      <Section
        title={`Picks / Bans (${active.match.picks_bans.length})`}
        right={
          <span className={styles.pbActions}>
            <span className={styles.firstPick}>
              First pick:
              <button type="button" className={`${styles.fpBtn} ${effectiveFirstPick === 0 ? styles.fpActive : ''}`} onClick={() => chooseFirstPick(0)}>
                {typeof active.match.meta.radiant_name === 'string' && active.match.meta.radiant_name ? active.match.meta.radiant_name : 'Radiant'}
              </button>
              <button type="button" className={`${styles.fpBtn} ${effectiveFirstPick === 1 ? styles.fpActive : ''}`} onClick={() => chooseFirstPick(1)}>
                {typeof active.match.meta.dire_name === 'string' && active.match.meta.dire_name ? active.match.meta.dire_name : 'Dire'}
              </button>
            </span>
            <button type="button" className={styles.btnSmall} onClick={() => updateMatch((m) => ({ ...m, picks_bans: generateCmDraft(effectiveFirstPick) }))}>
              Generate CM draft (24)
            </button>
            <button type="button" className={styles.btnSmall} onClick={() => updateMatch((m) => ({ ...m, picks_bans: [...m.picks_bans, { ...blankPickBan(), order: m.picks_bans.length }] }))}>
              + Row
            </button>
          </span>
        }
      >
        <div className={styles.pickbans}>
          {active.match.picks_bans.length === 0 && <div className={styles.muted}>No pick/ban rows. Add some above.</div>}
          {active.match.picks_bans.map((pb, i) => (
            <PickBanRow
              key={i}
              row={pb}
              radiantName={typeof active.match.meta.radiant_name === 'string' ? active.match.meta.radiant_name : ''}
              direName={typeof active.match.meta.dire_name === 'string' ? active.match.meta.dire_name : ''}
              onField={(key, v) => setPickBan(i, key, v)}
              onRemove={() => updateMatch((m) => ({ ...m, picks_bans: m.picks_bans.filter((_, idx) => idx !== i) }))}
            />
          ))}
        </div>
      </Section>
    </div>
  )
}
