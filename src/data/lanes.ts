/** Canonical lane metadata — labels, short names, and colors. */

export interface LaneConfig {
  /** Uppercase short label (e.g. "MID") */
  label: string
  /** Full lane name (e.g. "Mid Lane") */
  full: string
  /** CSS color for this lane */
  color: string
}

export const LANES: Record<string, LaneConfig> = {
  MID:       { label: 'MID',  full: 'Mid Lane',  color: '#e8a838' },
  SAFE:      { label: 'SAFE', full: 'Safe Lane', color: '#4ade80' },
  OFFLANE:   { label: 'OFF',  full: 'Off Lane',  color: '#60a5fa' },
  MIDDLE:    { label: 'MID',  full: 'Mid Lane',  color: '#e8a838' },
  JUNGLE:    { label: 'JNG',  full: 'Jungle',    color: '#a78bfa' },
  ROAM:      { label: 'ROAM', full: 'Roam',      color: '#f472b6' },
  INVADE:    { label: 'INV',  full: 'Invade',    color: '#fb923c' },
  DEFENSIVE: { label: 'DEF',  full: 'Defensive', color: '#94a3b8' },
}

/** Get the short uppercase label for a lane key, or the raw key if unknown. */
export function laneLabel(key: string | null | undefined): string {
  if (!key) return ''
  return LANES[key]?.label ?? key
}

/** Get the CSS color for a lane key. */
export function laneColor(key: string | null | undefined): string | undefined {
  if (!key) return undefined
  return LANES[key]?.color
}
