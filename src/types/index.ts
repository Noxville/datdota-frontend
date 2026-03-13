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

export interface RatingEntry {
  teamName: string
  valveId: number
  glickoRatingDate: string
  eloRatingDate: string
  elo32: {
    current: number | null
    sevenDayAvg: number | null
    thirtyDayAvg: number | null
    sevenDayAgo: number | null
    thirtyDayAgo: number | null
  }
  elo64: {
    current: number | null
    sevenDayAvg: number | null
    thirtyDayAvg: number | null
    sevenDayAgo: number | null
    thirtyDayAgo: number | null
  }
  glicko: {
    mu: number | null
    phi: number | null
    sigma: number | null
    rating: number | null
    ratingSevenDaysAgo: number | null
  }
  glicko2: {
    mu: number | null
    phi: number | null
    sigma: number | null
    rating: number | null
    ratingSevenDaysAgo: number | null
  }
  winsLastMonth: number | null
  lossesLastMonth: number | null
  logoId: string | null
  region: string | null
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
  'in-wins'?: string
  'in-losses'?: string
  'on-radiant'?: string
  'on-dire'?: string
  threshold?: string
  default?: string
}
