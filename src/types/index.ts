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

export interface HeroPerformanceLine {
  hero: number
  wins: number
  losses: number
  total: number
  gamesRadiant: number
  gamesDire: number
  winsRadiant: number
  winsDire: number
  winrate: number
  winrateRadiant: number
  winrateDire: number
  kills: number
  deaths: number
  assists: number
  avgKal: number | null
  kda: number
  gpm: number
  xpm: number
  lastHits: number
  denies: number
  level: number
  heroDamage: number
  towerDamage: number
  heroHealing: number
  goldSpent: number
}

export interface HeroTupleLine {
  heroes: number[]
  total: number
  win: number
  loss: number
  eloShift: number
  eloGames: number
}

export interface HeroEloByPhaseLine {
  hero: number
  phase: number
  shift: number
  games: number
}

export interface HeroEloByPhaseResponse {
  allPicks: HeroEloByPhaseLine[]
  firstPick: HeroEloByPhaseLine[]
}

export interface FrequentPlayerHero {
  hero: number
  games: number
  rank: number
  players: { steamId: number; nickname: string; wins: number }[]
}

export interface FacetSummaryLine {
  patchName: string
  hero: number
  facetName: string
  numGames: number
  numWins: number
  winPercent: number
}

export interface TeamPerformanceLine {
  team: { name: string; valveId: number; tag: string; logoId: number }
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
  duration: number
  durationWins: number
  durationLosses: number
  durationShift: number
}

export interface TeamUniqueHeroLine {
  name: string
  valveId: number
  heroes: number[]
  countUnique: number
  gameCount: number
}

export interface TeamTowerTiming {
  numGames: number
  firstTowerCount: number
  avgFirstTower: number
  avgSecondTower: number
  avgThirdTower: number
  avgFirstSafelane: number
  avgFirstMidlane: number
  avgFirstOfflane: number
}

export interface TeamTowerLine {
  valveId: number
  name: string
  numGames: number
  takingTowers: TeamTowerTiming
  losingTowers: TeamTowerTiming
}

export interface TeamThrowLine {
  team: { name: string; valveId: number }
  avgThrow: number
  numLosses: number
  throws5k: number
  throws10k: number
  throws15k: number
}

export interface TeamComebackLine {
  team: { name: string; valveId: number }
  avgComeback: number
  numWins: number
  comebacks5k: number
  comebacks10k: number
  comebacks15k: number
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

export interface PlayerHeroComboLine {
  steamId: number
  nickname: string
  hero: number
  wins: number
  losses: number
  total: number
  gamesRadiant: number
  gamesDire: number
  winrate: number
  kda: number
  kills: number
  deaths: number
  assists: number
  gpm: number
  xpm: number
  lastHits: number
  denies: number
  avgKal: number | null
  eloShift: number | null
}

export interface PlayerSinglePerformanceLine {
  steamId: number
  matchId: number
  nickname: string
  hero: number
  victory: boolean
  kills: number
  deaths: number
  assists: number
  gpm: number
  xpm: number
  lastHits: number
  denies: number
  kal: number | null
  kda: number
  level: number
  heroDamage: number
  towerDamage: number
  heroHealing: number
  goldSpent: number
  endItems: number[]
}

export interface UniqueHeroLine {
  steamId: number
  nickname: string
  heroes: number[]
  countUnique: number
  gameCount: number
}

export interface SquadPerformanceLine {
  steamIds: number[]
  players: { nickname: string; steamId: number }[]
  total: number
  win: number
  loss: number
}

export interface PlayerTeamComboLine {
  steamId: number
  nickname: string
  team: { name: string; valveId: number; logoId: string | null }
  wins: number
  losses: number
  total: number
  firstGame: string
  lastGame: string
  teamCareer: number
  winrate: number
}

export interface Rivalry {
  a_steam_id: string
  a_nickname: string
  b_steam_id: string
  b_nickname: string
  a_wins: number
  b_wins: number
  games: number
}

// Records API returns tuples: [steamId, nickname, value, heroKey, matchId]
// Aggregate tuples: [steamId, nickname, value, gameCount]
// Keys are snake_case: kills, gpm, last_hits, assists, xpm, deaths, denies, gold,
// hero_damage, tower_damage, hero_healing, ka_0_death, kda_1_death,
// kills_per_min, assists_per_min, deaths_per_min
export type PlayerRecordTuple = [string, string, number, string, number]
export type PlayerRecordAggregateTuple = [string, string, number, number]

export type PlayerRecordsResponse = Record<string, PlayerRecordTuple[] | PlayerRecordAggregateTuple[]>

// Team Map Control
export interface TeamMapControlTeam {
  valveId: number
  name: string
  numGames: number
  wins: number
  avgOneSidedness: number
  avgOneSidednessWins: number
  avgOneSidednessLosses: number
  avgNormControl: number
  avgNormNeutral: number
  avgNormNeutralWins: number
  avgNormNeutralLosses: number
}

export interface TeamMapControlMatch {
  matchId: number
  valveId: number
  teamName: string
  duration: number
  normControl: number
  oneSidedness: number
  normNeutral: number
}

export interface TeamMapControlResponse {
  teams: TeamMapControlTeam[]
  highest: TeamMapControlMatch[]
  lowest: TeamMapControlMatch[]
}

// Match List
export interface MatchListEntry {
  matchId: number
  seriesId: number | null
  league: { name: string; leagueId: number }
  radiant: { valveId: number; name: string; score: number }
  dire: { valveId: number; name: string; score: number }
  radiantPlayers: { steamId: number; nickname: string }[]
  direPlayers: { steamId: number; nickname: string }[]
  startDate: string
  duration: number
  radiantVictory: boolean
}

// Match Finder
export interface MatchFinderEntry {
  matchId: number
  radTeamId: number
  direTeamId: number
  radPicks: number[]
  direPicks: number[]
  radVictory: boolean
  date: string
  leagueId: number
  leagueName: string
  duration: number
  radName: string
  direName: string
  radIsA: boolean
}

export interface MatchFinderResponse {
  matches: MatchFinderEntry[]
  aWins: number
  bWins: number
}

// Match Durations
export interface DurationBucket {
  minute: number
  count: number
}

export interface DurationMatch {
  matchId: number
  duration: number
  teams: { valveId: number; name: string }[]
}

export interface DurationResponse {
  durations: DurationBucket[]
  longest: DurationMatch[]
  shortest: DurationMatch[]
  mean: number
  stdDev: number
  count: number
}

export interface FilterValues {
  players?: string
  teams?: string
  heroes?: string
  'team-a'?: string
  'team-b'?: string
  'heroes-a'?: string
  'heroes-b'?: string
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
  items?: string
  'item-1'?: string
  'item-2'?: string
  'item-3'?: string
  'item-4'?: string
  'item-5'?: string
  'item-6'?: string
  building_lane?: string
  building_type?: string
  building_tier?: string
  winner?: string
  'first-pick'?: string
  picked?: string
  banned?: string
  'picked-1p'?: string
  'picked-2p'?: string
  'picked-3p'?: string
  'banned-1p'?: string
  'banned-2p'?: string
  'banned-3p'?: string
  frame_field?: string
  time?: string
  aggregate?: string
  sort?: string
  'level-from'?: string
  'level-to'?: string
  default?: string
}
