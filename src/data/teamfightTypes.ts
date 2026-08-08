// Shared teamfight-type palette + classifier (source of truth for the timeline,
// the teamfight overview pages, and the glossary). Colours match the
// players/teams teamfight pages.

export const TEAMFIGHT_TYPES = ['BATTLE', 'SKIRMISH', 'GANK', 'SOLO'] as const
export type TeamfightType = typeof TEAMFIGHT_TYPES[number]

export const TEAMFIGHT_TYPE_COLORS: Record<TeamfightType, string> = {
  BATTLE: '#e8a838',
  SKIRMISH: '#60a5fa',
  GANK: '#f472b6',
  SOLO: '#a78bfa',
}

export const TEAMFIGHT_TYPE_LABELS: Record<TeamfightType, string> = {
  BATTLE: 'Battle',
  SKIRMISH: 'Skirmish',
  GANK: 'Gank',
  SOLO: 'Solo',
}

/** Classify a fight by the two side hero counts. Mirrors backend TeamfightTypeEnum.findByNums. */
export function classifyTeamfight(a: number, b: number): TeamfightType {
  const mn = Math.min(a, b)
  const mx = Math.max(a, b)
  if (mn === 1) return mx === 1 ? 'SOLO' : 'GANK'
  if (mn >= 4 && mx >= 4) return 'BATTLE'
  return 'SKIRMISH'
}
