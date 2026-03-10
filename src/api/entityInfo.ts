import { apiFetch } from './client'

interface PlayerInfo {
  steamId: string
  nickname: string
}

interface TeamInfo {
  valveId: number
  name: string
}

interface LeagueInfo {
  leagueId: number
  name: string
}

interface SplitInfo {
  id: number
  type: string
  startSplit: string
  endSplit: string
}

/**
 * Fetch display names for entity IDs from the /api/{entity}/$ids/info endpoints.
 * Returns a Record<id, displayName> map.
 */
export async function fetchPlayerNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const res = await apiFetch<{ data: PlayerInfo[] }>(`/api/players/${ids.join(',')}/info`)
  const map: Record<string, string> = {}
  for (const p of res.data) {
    map[String(p.steamId)] = p.nickname
  }
  return map
}

export async function fetchTeamNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const res = await apiFetch<{ data: TeamInfo[] }>(`/api/teams/${ids.join(',')}/info`)
  const map: Record<string, string> = {}
  for (const t of res.data) {
    map[String(t.valveId)] = t.name
  }
  return map
}

export async function fetchLeagueNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const res = await apiFetch<{ data: LeagueInfo[] }>(`/api/leagues/${ids.join(',')}/info`)
  const map: Record<string, string> = {}
  for (const l of res.data) {
    map[String(l.leagueId)] = l.name
  }
  return map
}

export async function fetchSplitNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const res = await apiFetch<{ data: SplitInfo[] }>(`/api/splits/${ids.join(',')}/info`)
  const map: Record<string, string> = {}
  for (const s of res.data) {
    map[String(s.id)] = s.type
  }
  return map
}
