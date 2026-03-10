export interface PlayerPerformanceLine {
  steamId: number
  nickname: string
  wins: number
  losses: number
  total: number
  gamesRadiant: number
  gamesDire: number
  winrate: number
  kills: number
  deaths: number
  assists: number
  gpm: number
  xpm: number
  lastHits: number
  denies: number
  avgKal: number | null
  kda: number
  level: number
  heroDamage: number
  towerDamage: number
  heroHealing: number
  goldSpent: number
}

export interface FilterValues {
  players?: string
  teams?: string
  heroes?: string
  roles?: string
  patch?: string
  'split-type'?: string
  after?: string
  before?: string
  durationGTE?: string
  durationLTE?: string
  leagues?: string
  splits?: string
  tier?: string
  'valve-event'?: string
  threshold?: string
  default?: string
}
