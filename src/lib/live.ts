import { heroesById } from '../data/heroes'

/** m:ss game clock. Negative = pre-game. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  if (seconds < 0) return 'Pre-game'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ── World → SVG projection (shared by both live map views) ── */

export const WORLD_MIN = -7500
export const WORLD_MAX = 7500

export function worldToSvg(x: number, y: number, size: number): { x: number; y: number } {
  const span = WORLD_MAX - WORLD_MIN
  const nx = (x - WORLD_MIN) / span
  const ny = (y - WORLD_MIN) / span
  return {
    x: Math.max(0, Math.min(1, nx)) * size,
    y: Math.max(0, Math.min(1, 1 - ny)) * size,
  }
}

/* ── Hero lookup by ext string key ────────────────────────── */

export interface ExtHero {
  id: number
  name: string
  picture: string
}

const normalize = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_')

const extHeroMap: Map<string, ExtHero> = (() => {
  const m = new Map<string, ExtHero>()
  for (const [id, h] of Object.entries(heroesById)) {
    const hero: ExtHero = { id: Number(id), name: h.name, picture: h.picture }
    m.set(normalize(h.picture), hero)
    m.set(normalize(h.name), hero)
  }
  return m
})()

/** Resolve an ext hero key ("shadow shaman", "kez") to hero data, or null. */
export function heroByExtKey(key: string | null | undefined): ExtHero | null {
  if (!key) return null
  return extHeroMap.get(normalize(key)) ?? null
}

/* ── Draft ────────────────────────────────────────────────── */

export interface DraftStep {
  order: number
  side: 'radiant' | 'dire'
  action: 'ban' | 'pick'
  heroId: number | null
  phase: number
}

// Captain's Mode sub-phase boundaries: 7 bans, 2 picks, 3 bans, 6 picks, 4 bans, 2 picks.
export const PHASE_BOUNDARIES = [7, 9, 12, 18, 22, 24]

export function phaseForIndex(i: number): number {
  for (let p = 0; p < PHASE_BOUNDARIES.length; p++) {
    if (i < PHASE_BOUNDARIES[p]) return p
  }
  return PHASE_BOUNDARIES.length - 1
}

/**
 * Captain's Mode draft order (24 actions = 14 bans + 10 picks).
 * 'first' = team with first pick, 'second' = the other.
 */
export const CM_SEQUENCE: { team: 'first' | 'second'; action: 'ban' | 'pick' }[] = [
  { team: 'first', action: 'ban' }, { team: 'first', action: 'ban' },
  { team: 'second', action: 'ban' }, { team: 'second', action: 'ban' },
  { team: 'first', action: 'ban' }, { team: 'second', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'first', action: 'pick' }, { team: 'second', action: 'pick' },
  { team: 'first', action: 'ban' }, { team: 'first', action: 'ban' },
  { team: 'second', action: 'ban' },
  { team: 'second', action: 'pick' }, { team: 'first', action: 'pick' },
  { team: 'first', action: 'pick' }, { team: 'second', action: 'pick' },
  { team: 'second', action: 'pick' }, { team: 'first', action: 'pick' },
  { team: 'first', action: 'ban' }, { team: 'second', action: 'ban' },
  { team: 'first', action: 'ban' }, { team: 'second', action: 'ban' },
  { team: 'first', action: 'pick' }, { team: 'second', action: 'pick' },
]

/** Reconstruct the CM draft sequence from per-side ordered pick/ban hero-id lists. */
export function buildDraftSequence(
  radiant: { picks: number[]; bans: number[] },
  dire: { picks: number[]; bans: number[] },
  firstPick: 'radiant' | 'dire',
): DraftStep[] {
  const cursors = { radiant: { ban: 0, pick: 0 }, dire: { ban: 0, pick: 0 } }
  const result: DraftStep[] = []
  for (let i = 0; i < CM_SEQUENCE.length; i++) {
    const step = CM_SEQUENCE[i]
    const side: 'radiant' | 'dire' =
      step.team === 'first' ? firstPick : firstPick === 'radiant' ? 'dire' : 'radiant'
    const teamData = side === 'radiant' ? radiant : dire
    const arr = (step.action === 'ban' ? teamData.bans : teamData.picks) ?? []
    const cursor = cursors[side][step.action]
    const heroId = arr[cursor] ?? null
    cursors[side][step.action]++
    result.push({ order: i + 1, side, action: step.action, heroId, phase: phaseForIndex(i) })
  }
  return result
}

/* ── Steam id conversion ──────────────────────────────────── */

const STEAM64_BASE = 76561197960265728n

/** Convert a 64-bit steamId to a 32-bit account id (datdota player id), or null. */
export function steamIdToAccountId(steamId: string | number | null | undefined): number | null {
  if (steamId === null || steamId === undefined || steamId === '') return null
  try {
    const acct = BigInt(steamId) - STEAM64_BASE
    if (acct <= 0n) return null
    return Number(acct)
  } catch {
    return null
  }
}
