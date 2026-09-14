import { heroesById } from './heroes'
import { items } from './items'

/** Sentinel for a field the user has not addressed yet. Invalid to export. */
export const UNSET = '__UNSET__' as const

export type Leaf = number | string | boolean | null | typeof UNSET

export function isUnset(v: Leaf): v is typeof UNSET {
  return v === UNSET
}

export type FieldType =
  | 'int'
  | 'bool'
  | 'string'
  | 'timestamp'
  | 'hero'
  | 'item'
  | 'player'
  | 'team'
  | 'league'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** May be set to null ("unknown") and still export. */
  nullable?: boolean
  /** Soft upper bound — a value at/above this raises a non-blocking warning. */
  warnMax?: number
  /** Computed from the player's position/side — not user-edited or validated. */
  derived?: boolean
}

/* ── Field definitions (order = export order, matches template) ── */

export const PLAYER_FIELDS: FieldDef[] = [
  { key: 'account_id', label: 'Player', type: 'player', nullable: true },
  { key: 'player_slot', label: 'Player slot', type: 'int', derived: true },
  { key: 'team_number', label: 'Team #', type: 'int', derived: true },
  { key: 'team_slot', label: 'Team slot', type: 'int', derived: true },
  { key: 'hero_id', label: 'Hero', type: 'hero' },
  { key: 'item_0', label: 'Item 0', type: 'item', nullable: true },
  { key: 'item_1', label: 'Item 1', type: 'item', nullable: true },
  { key: 'item_2', label: 'Item 2', type: 'item', nullable: true },
  { key: 'item_3', label: 'Item 3', type: 'item', nullable: true },
  { key: 'item_4', label: 'Item 4', type: 'item', nullable: true },
  { key: 'item_5', label: 'Item 5', type: 'item', nullable: true },
  { key: 'backpack_0', label: 'Backpack 0', type: 'item', nullable: true },
  { key: 'backpack_1', label: 'Backpack 1', type: 'item', nullable: true },
  { key: 'backpack_2', label: 'Backpack 2', type: 'item', nullable: true },
  { key: 'item_neutral', label: 'Neutral item', type: 'item', nullable: true },
  { key: 'kills', label: 'Kills', type: 'int', warnMax: 50 },
  { key: 'deaths', label: 'Deaths', type: 'int', warnMax: 50 },
  { key: 'assists', label: 'Assists', type: 'int', warnMax: 50 },
  { key: 'leaver_status', label: 'Leaver status', type: 'int', nullable: true },
  { key: 'last_hits', label: 'Last hits', type: 'int' },
  { key: 'denies', label: 'Denies', type: 'int' },
  { key: 'gold_per_min', label: 'GPM', type: 'int', warnMax: 1500 },
  { key: 'xp_per_min', label: 'XPM', type: 'int', warnMax: 2000 },
  { key: 'level', label: 'Level', type: 'int' },
  { key: 'net_worth', label: 'Net worth', type: 'int' },
  { key: 'aghanims_scepter', label: 'Aghs scepter', type: 'int' },
  { key: 'aghanims_shard', label: 'Aghs shard', type: 'int' },
  { key: 'moonshard', label: 'Moonshard', type: 'int' },
]

export const PICKBAN_FIELDS: FieldDef[] = [
  { key: 'is_pick', label: 'Pick?', type: 'bool' },
  { key: 'hero_id', label: 'Hero', type: 'hero' },
  { key: 'team', label: 'Team', type: 'int' },
  { key: 'order', label: 'Order', type: 'int' },
]

export const META_FIELDS: FieldDef[] = [
  { key: 'radiant_win', label: 'Radiant win', type: 'bool' },
  { key: 'duration', label: 'Duration (s)', type: 'int' },
  { key: 'pre_game_duration', label: 'Pre-game (s)', type: 'int' },
  { key: 'start_time', label: 'Start time', type: 'timestamp' },
  { key: 'match_id', label: 'Match ID', type: 'int' },
  { key: 'match_seq_num', label: 'Match seq num', type: 'int', nullable: true },
  { key: 'tower_status_radiant', label: 'Tower status radiant', type: 'int', nullable: true },
  { key: 'tower_status_dire', label: 'Tower status dire', type: 'int', nullable: true },
  { key: 'barracks_status_radiant', label: 'Barracks status radiant', type: 'int', nullable: true },
  { key: 'barracks_status_dire', label: 'Barracks status dire', type: 'int', nullable: true },
  { key: 'cluster', label: 'Cluster', type: 'int', nullable: true },
  { key: 'first_blood_time', label: 'First blood time (s)', type: 'int', nullable: true },
  { key: 'lobby_type', label: 'Lobby type', type: 'int', nullable: true },
  { key: 'human_players', label: 'Human players', type: 'int', nullable: true },
  { key: 'league_id', label: 'League', type: 'league', nullable: true },
  { key: 'game_mode', label: 'Game mode', type: 'int', nullable: true },
  { key: 'flags', label: 'Flags', type: 'int', nullable: true },
  { key: 'engine', label: 'Engine', type: 'int', nullable: true },
  { key: 'radiant_score', label: 'Radiant score', type: 'int' },
  { key: 'dire_score', label: 'Dire score', type: 'int' },
  { key: 'radiant_team_id', label: 'Radiant team', type: 'team', nullable: true },
  { key: 'radiant_name', label: 'Radiant name', type: 'string', nullable: true },
  { key: 'radiant_logo', label: 'Radiant logo ID', type: 'int', nullable: true },
  { key: 'radiant_team_complete', label: 'Radiant team complete', type: 'int', nullable: true },
  { key: 'dire_team_id', label: 'Dire team', type: 'team', nullable: true },
  { key: 'dire_name', label: 'Dire name', type: 'string', nullable: true },
  { key: 'dire_logo', label: 'Dire logo ID', type: 'int', nullable: true },
  { key: 'dire_team_complete', label: 'Dire team complete', type: 'int', nullable: true },
  { key: 'radiant_captain', label: 'Radiant captain', type: 'player', nullable: true },
  { key: 'dire_captain', label: 'Dire captain', type: 'player', nullable: true },
]

export const PLAYER_COUNT = 10

/* ── Draft shape ─────────────────────────────────────────── */

export type FieldMap = Record<string, Leaf>

export interface MatchDraft {
  meta: FieldMap
  players: FieldMap[]
  picks_bans: FieldMap[]
}

function blankFields(defs: FieldDef[]): FieldMap {
  const out: FieldMap = {}
  for (const d of defs) out[d.key] = UNSET
  return out
}

/** Sensible defaults for config fields that are almost always the same. */
export const META_DEFAULTS: Record<string, Leaf> = {
  match_seq_num: 0,
  tower_status_radiant: 0,
  tower_status_dire: 0,
  barracks_status_radiant: 0,
  barracks_status_dire: 0,
  cluster: 273,
  lobby_type: 1,
  human_players: 10,
  game_mode: 2,
  flags: 4,
  engine: 1,
}

function blankPlayer(): FieldMap {
  const p = blankFields(PLAYER_FIELDS)
  p.leaver_status = 0
  return p
}

export function blankMatch(): MatchDraft {
  const meta = blankFields(META_FIELDS)
  for (const [k, v] of Object.entries(META_DEFAULTS)) meta[k] = v
  return {
    meta,
    players: Array.from({ length: PLAYER_COUNT }, () => blankPlayer()),
    picks_bans: [],
  }
}

export function blankPickBan(): FieldMap {
  return blankFields(PICKBAN_FIELDS)
}

/** Derived slot fields for a player at array index i (0-4 Radiant, 5-9 Dire). */
export function deriveSlot(i: number): { player_slot: number; team_number: number; team_slot: number } {
  const radiant = i < 5
  return {
    player_slot: radiant ? i : 128 + (i - 5),
    team_number: radiant ? 0 : 1,
    team_slot: radiant ? i : i - 5,
  }
}

export function playerSide(i: number): 0 | 1 {
  return i < 5 ? 0 : 1
}

/* ── Static lookups ──────────────────────────────────────── */

export interface Suggestion {
  id: number
  name: string
}

export const HERO_LIST: Suggestion[] = Object.entries(heroesById)
  .map(([id, h]) => ({ id: Number(id), name: h.name }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const ITEM_LIST: Suggestion[] = Object.entries(items as Record<string, { longName?: string; shortName?: string }>)
  .map(([id, it]) => ({ id: Number(id), name: it.longName || it.shortName || `Item ${id}` }))
  .filter((s) => Number.isFinite(s.id))
  .sort((a, b) => a.name.localeCompare(b.name))

export function heroName(id: number): string | undefined {
  return heroesById[String(id)]?.name
}

export function itemName(id: number): string | undefined {
  const it = (items as Record<string, { longName?: string; shortName?: string }>)[String(id)]
  return it?.longName || it?.shortName
}

export function itemShortName(id: number): string | undefined {
  return (items as Record<string, { shortName?: string }>)[String(id)]?.shortName
}

export function heroPicture(id: number): string | undefined {
  return heroesById[String(id)]?.picture
}

/* ── Validation ──────────────────────────────────────────── */

export interface Problem {
  path: string
  message: string
}

function checkField(def: FieldDef, value: Leaf, path: string): Problem | null {
  if (isUnset(value)) return { path, message: `${def.label} is unset` }
  if (value === null) {
    return def.nullable ? null : { path, message: `${def.label} may not be null` }
  }
  if (def.type === 'bool') {
    return typeof value === 'boolean' ? null : { path, message: `${def.label} must be true/false` }
  }
  if (def.type === 'string') {
    return typeof value === 'string' && value.trim() !== '' ? null : { path, message: `${def.label} is empty` }
  }
  // numeric-backed types
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { path, message: `${def.label} must be a number` }
  }
  return null
}

export function collectProblems(match: MatchDraft): Problem[] {
  const problems: Problem[] = []
  for (const def of META_FIELDS) {
    const p = checkField(def, match.meta[def.key], def.label)
    if (p) problems.push(p)
  }
  match.players.forEach((pl, i) => {
    for (const def of PLAYER_FIELDS) {
      if (def.derived) continue
      const p = checkField(def, pl[def.key], `Player ${i + 1} · ${def.label}`)
      if (p) problems.push(p)
    }
  })
  match.picks_bans.forEach((pb, i) => {
    for (const def of PICKBAN_FIELDS) {
      const p = checkField(def, pb[def.key], `Pick/Ban ${i + 1} · ${def.label}`)
      if (p) problems.push(p)
    }
  })
  return problems
}

/** Non-blocking sanity warning for a single value (e.g. implausibly high). */
export function fieldWarning(def: FieldDef, value: Leaf): string | null {
  if (typeof value !== 'number') return null
  if (def.warnMax != null && value >= def.warnMax) return `${def.label} ≥ ${def.warnMax} — check value`
  if (def.type === 'int' && value < 0) return `${def.label} is negative`
  return null
}

export function collectWarnings(match: MatchDraft): Problem[] {
  const warnings: Problem[] = []
  match.players.forEach((pl, i) => {
    for (const def of PLAYER_FIELDS) {
      const w = fieldWarning(def, pl[def.key])
      if (w) warnings.push({ path: `Player ${i + 1} · ${def.label}`, message: w })
    }
  })
  for (const def of META_FIELDS) {
    const w = fieldWarning(def, match.meta[def.key])
    if (w) warnings.push({ path: def.label, message: w })
  }

  // Captains must be one of that side's players.
  const radiantAccts = numericIds(sidePlayers(match, 0), 'account_id')
  const direAccts = numericIds(sidePlayers(match, 1), 'account_id')
  const rc = match.meta.radiant_captain
  const dc = match.meta.dire_captain
  if (typeof rc === 'number' && radiantAccts.length > 0 && !radiantAccts.includes(rc)) {
    warnings.push({ path: 'Radiant captain', message: 'Captain is not one of the Radiant players' })
  }
  if (typeof dc === 'number' && direAccts.length > 0 && !direAccts.includes(dc)) {
    warnings.push({ path: 'Dire captain', message: 'Captain is not one of the Dire players' })
  }

  // Picked heroes for each side should match that side's 5 players' heroes.
  const sidematch = (side: 0 | 1, label: string) => {
    const picked = match.picks_bans
      .filter((pb) => pb.is_pick === true && pb.team === side)
      .map((pb) => pb.hero_id)
      .filter((v): v is number => typeof v === 'number')
    const heroes = numericIds(sidePlayers(match, side), 'hero_id')
    if (picked.length === 0 || heroes.length === 0) return
    const set = new Set(heroes)
    const unallocated = picked.filter((h) => !set.has(h))
    if (unallocated.length > 0) {
      const names = unallocated.map((h) => heroName(h) ?? `#${h}`).join(', ')
      warnings.push({ path: `${label} picks`, message: `Picked but not on any ${label} player: ${names}` })
    }
  }
  sidematch(0, 'Radiant')
  sidematch(1, 'Dire')

  return warnings
}

/* ── Flip Radiant / Dire ─────────────────────────────────── */

const SIDE_SWAP_PAIRS: [string, string][] = [
  ['radiant_team_id', 'dire_team_id'],
  ['radiant_name', 'dire_name'],
  ['radiant_logo', 'dire_logo'],
  ['radiant_team_complete', 'dire_team_complete'],
  ['radiant_score', 'dire_score'],
  ['radiant_captain', 'dire_captain'],
  ['tower_status_radiant', 'tower_status_dire'],
  ['barracks_status_radiant', 'barracks_status_dire'],
]

/** Swap Radiant and Dire: meta pairs, win flag, and the two roster halves.
 *  Slot fields are derived from position, so swapping halves is enough. */
export function flipTeams(match: MatchDraft): MatchDraft {
  const meta = { ...match.meta }
  for (const [a, b] of SIDE_SWAP_PAIRS) {
    const tmp = meta[a]
    meta[a] = meta[b]
    meta[b] = tmp
  }
  if (typeof meta.radiant_win === 'boolean') meta.radiant_win = !meta.radiant_win
  const players = [...match.players.slice(5), ...match.players.slice(0, 5)]
  return { ...match, meta, players }
}

/* ── Captains Mode draft order ───────────────────────────── */

/** Fixed 24-step CM order (from match 8959362208). first = the first-pick team acts. */
const CM_ORDER: { pick: boolean; first: boolean }[] = [
  { pick: false, first: true }, { pick: false, first: true },
  { pick: false, first: false }, { pick: false, first: false },
  { pick: false, first: true }, { pick: false, first: false },
  { pick: false, first: false }, { pick: true, first: true },
  { pick: true, first: false }, { pick: false, first: true },
  { pick: false, first: true }, { pick: false, first: false },
  { pick: true, first: false }, { pick: true, first: true },
  { pick: true, first: true }, { pick: true, first: false },
  { pick: true, first: false }, { pick: true, first: true },
  { pick: false, first: true }, { pick: false, first: false },
  { pick: false, first: true }, { pick: false, first: false },
  { pick: true, first: true }, { pick: true, first: false },
]

/** Generate 24 CM rows with is_pick/team/order fixed; hero left unset. */
export function generateCmDraft(firstPickTeam: 0 | 1): FieldMap[] {
  const other = firstPickTeam === 0 ? 1 : 0
  return CM_ORDER.map((step, i) => ({
    is_pick: step.pick,
    hero_id: UNSET,
    team: step.first ? firstPickTeam : other,
    order: i,
  }))
}

/** Move a player from one index to another (drag reorder). */
export function movePlayer(players: FieldMap[], from: number, to: number): FieldMap[] {
  if (from === to || from < 0 || to < 0 || from >= players.length || to >= players.length) return players
  const next = [...players]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Players on a side by position (0-4 Radiant, 5-9 Dire). */
export function sidePlayers(match: MatchDraft, side: 0 | 1): FieldMap[] {
  return side === 0 ? match.players.slice(0, 5) : match.players.slice(5, 10)
}

function numericIds(players: FieldMap[], key: string): number[] {
  return players.map((p) => p[key]).filter((v): v is number => typeof v === 'number')
}

/* ── Skeleton import (roster + teams from another game) ──── */

const SKELETON_META = [
  'radiant_team_id', 'radiant_name', 'radiant_logo', 'radiant_team_complete',
  'dire_team_id', 'dire_name', 'dire_logo', 'dire_team_complete',
  'league_id', 'radiant_captain', 'dire_captain',
]
const SKELETON_PLAYER = ['account_id', 'player_slot', 'team_number', 'team_slot']

function copyKeys(dst: FieldMap, src: Record<string, unknown> | undefined, keys: string[]): FieldMap {
  const out = { ...dst }
  if (!src) return out
  for (const k of keys) {
    if (!(k in src)) continue
    const v = src[k]
    if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out[k] = v
  }
  return out
}

/** Merge team + roster identity from another parsed match into the current draft. */
export function importSkeleton(current: MatchDraft, src: Record<string, unknown>): MatchDraft {
  const srcPlayers = Array.isArray(src.players) ? (src.players as Record<string, unknown>[]) : []
  const players = current.players.map((p, i) => copyKeys(p, srcPlayers[i], SKELETON_PLAYER))
  const meta = copyKeys(current.meta, src, SKELETON_META)
  return { ...current, meta, players }
}

/* ── Export (template key order) ─────────────────────────── */

function exportFields(defs: FieldDef[], values: FieldMap): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const def of defs) {
    const v = values[def.key]
    // Keep the UNSET marker in the output so a partial export re-imports intact.
    out[def.key] = v
  }
  return out
}

/** Assemble the export object with keys in template order (slots derived by position). */
export function assembleExport(match: MatchDraft): Record<string, unknown> {
  const players = match.players.map((p, i) => {
    const out = exportFields(PLAYER_FIELDS, p)
    const d = deriveSlot(i)
    out.player_slot = d.player_slot
    out.team_number = d.team_number
    out.team_slot = d.team_slot
    return out
  })
  const picks_bans = match.picks_bans.map((pb) => exportFields(PICKBAN_FIELDS, pb))
  const meta = exportFields(META_FIELDS, match.meta)
  return { players, picks_bans, ...meta }
}

/* ── Import ──────────────────────────────────────────────── */

function importFields(defs: FieldDef[], src: Record<string, unknown> | undefined): FieldMap {
  const out = blankFields(defs)
  if (!src) return out
  for (const def of defs) {
    if (!(def.key in src)) continue
    const v = src[def.key]
    if (v === UNSET) continue // keep as unset
    if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
      out[def.key] = v
    }
  }
  return out
}

/** Map an arbitrary (partial) parsed match object into a draft. */
export function importMatch(src: Record<string, unknown>): MatchDraft {
  const srcPlayers = Array.isArray(src.players) ? (src.players as Record<string, unknown>[]) : []
  const players: FieldMap[] = Array.from({ length: PLAYER_COUNT }, (_, i) =>
    importFields(PLAYER_FIELDS, srcPlayers[i]),
  )
  const srcPB = Array.isArray(src.picks_bans) ? (src.picks_bans as Record<string, unknown>[]) : []
  const picks_bans = srcPB.map((pb) => importFields(PICKBAN_FIELDS, pb))
  return { meta: importFields(META_FIELDS, src), players, picks_bans }
}

export function matchLabel(match: MatchDraft): string {
  const id = match.meta.match_id
  return typeof id === 'number' ? String(id) : 'Untitled'
}
