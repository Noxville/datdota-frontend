export interface SearchPage {
  label: string
  path: string
  keywords?: string[]
}

/**
 * Curated catalog of stats/list pages, used by the global search "t:query" type.
 * Mirrors the navigation in src/components/Navigation.tsx — keep in sync when
 * routes are added or removed.
 */
export const SEARCH_PAGES: SearchPage[] = [
  // Heroes
  { label: 'Hero Average Performances', path: '/heroes/performances?default=true', keywords: ['hero', 'winrate', 'kda'] },
  { label: 'Hero Tuples & Elo Ratings', path: '/heroes/elo?default=true', keywords: ['hero', 'elo', 'rating', 'tuples'] },
  { label: 'Hero Head-to-Head', path: '/heroes/head-to-head?default=true', keywords: ['hero', 'matchup', 'h2h'] },
  { label: 'Hero Elo by Phase', path: '/heroes/elo-by-phase?default=true', keywords: ['hero', 'elo', 'phase'] },
  { label: 'Hero Frequent Players', path: '/heroes/frequent-players?default=true', keywords: ['hero', 'players', 'spammer'] },
  { label: 'Facets', path: '/facets/summary?default=true', keywords: ['facet', 'hero'] },
  { label: 'Ability Builds', path: '/abilities/builds?default=true', keywords: ['ability', 'skill', 'build', 'leveling'] },

  // Players
  { label: 'Player Average Performances', path: '/players/performances?default=true', keywords: ['player', 'pro', 'stats'] },
  { label: 'Player Single Performances', path: '/players/single-performances?default=true', keywords: ['player', 'best', 'game'] },
  { label: 'Player Unique Heroes', path: '/players/unique-heroes?default=true', keywords: ['player', 'hero', 'pool'] },
  { label: 'Player Squads', path: '/players/squads?default=true', keywords: ['player', 'squad', 'roster'] },
  { label: 'Player Hero Combos', path: '/players/hero-combos?default=true', keywords: ['player', 'hero', 'combo'] },
  { label: 'Player Team Combos', path: '/players/teams?default=true', keywords: ['player', 'team', 'combo'] },
  { label: 'Player Rivalries', path: '/players/rivalries?default=true', keywords: ['player', 'rivalry', 'h2h'] },
  { label: 'Player Records', path: '/players/records?default=true', keywords: ['player', 'record', 'best'] },

  // Teams
  { label: 'Team Average Performances', path: '/teams/performances?default=true', keywords: ['team', 'stats'] },
  { label: 'Team Head-to-Head', path: '/teams/head-to-head', keywords: ['team', 'matchup', 'h2h'] },
  { label: 'Team Unique Heroes', path: '/teams/unique-heroes?default=true', keywords: ['team', 'hero', 'pool'] },
  { label: 'Team Towers', path: '/teams/towers?default=true', keywords: ['team', 'tower', 'building'] },
  { label: 'Team Map Control', path: '/teams/map-control?default=true', keywords: ['team', 'map', 'control', 'vision'] },
  { label: 'Team Identity', path: '/teams/identity?default=true', keywords: ['team', 'identity', 'style'] },
  { label: 'Team Records', path: '/teams/records?default=true', keywords: ['team', 'record', 'best'] },
  { label: 'Team Throws', path: '/teams/throws?default=true', keywords: ['team', 'throw', 'choke'] },
  { label: 'Team Comebacks', path: '/teams/comebacks?default=true', keywords: ['team', 'comeback'] },

  // Matches
  { label: 'Recent Matches', path: '/matches', keywords: ['match', 'recent', 'games'] },
  { label: 'Match Finder', path: '/matches/finder?default=true', keywords: ['match', 'finder', 'search'] },
  { label: 'Match Durations', path: '/matches/durations?default=true', keywords: ['match', 'duration', 'length', 'time'] },
  { label: 'Scorigami', path: '/matches/scorigami?default=true', keywords: ['match', 'score', 'scorigami', 'kills'] },
  { label: 'Match Comebacks', path: '/matches/comebacks?default=true', keywords: ['match', 'comeback'] },
  { label: 'All-Buyback Games', path: '/matches/all-players-buyback', keywords: ['match', 'buyback', 'notable', 'all ten'] },
  { label: 'Never-Led Wins', path: '/matches/never-led', keywords: ['match', 'comeback', 'never led', 'deficit', 'notable'] },

  // Events
  { label: 'Hero Kills', path: '/events/hero-kills?default=true', keywords: ['event', 'kill', 'combat'] },
  { label: 'Hero Deaths', path: '/events/hero-deaths?default=true', keywords: ['event', 'death', 'combat'] },
  { label: 'First Bloods', path: '/events/first-bloods?default=true', keywords: ['event', 'first blood', 'fb'] },
  { label: 'Big Crits', path: '/events/crits?default=true', keywords: ['event', 'crit', 'damage'] },
  { label: 'Wards Placed', path: '/events/wards?default=true', keywords: ['event', 'ward', 'vision'] },
  { label: 'Roshan', path: '/events/roshan?default=true', keywords: ['event', 'roshan', 'objective'] },
  { label: 'Aegis', path: '/events/aegis?default=true', keywords: ['event', 'aegis', 'objective'] },
  { label: 'Tormentor', path: '/events/tormentor?default=true', keywords: ['event', 'tormentor', 'shard'] },
  { label: 'Couriers', path: '/events/couriers?default=true', keywords: ['event', 'courier'] },
  { label: 'Buildings', path: '/events/buildings?default=true', keywords: ['event', 'building', 'tower', 'rax'] },
  { label: 'Runes', path: '/events/runes?default=true', keywords: ['event', 'rune', 'bounty'] },
  { label: 'Divine Rapiers', path: '/events/divine-rapiers', keywords: ['event', 'rapier', 'divine', 'notable'] },
  { label: 'Rampages', path: '/events/rampages', keywords: ['event', 'rampage', 'multikill', 'notable'] },

  // Scenarios
  { label: 'Megacreep Comebacks', path: '/scenarios/megacreep-comebacks?default=true', keywords: ['scenario', 'megacreep', 'comeback'] },
  { label: 'First Wisdoms', path: '/scenarios/first-wisdoms?default=true', keywords: ['scenario', 'wisdom', 'rune'] },
  { label: 'Bounty Bazinga', path: '/scenarios/bounty-bazinga?default=true', keywords: ['scenario', 'bounty'] },
  { label: 'Game Loop', path: '/scenarios/gameloop?default=true', keywords: ['scenario', 'loop'] },

  // Items
  { label: 'Items Fastest / Slowest', path: '/items/distribution?default=true', keywords: ['item', 'timing', 'fastest', 'slowest'] },
  { label: 'Item Builds / Progression', path: '/items/progression?default=true', keywords: ['item', 'build', 'progression'] },
  { label: 'Neutral Items', path: '/items/neutrals?default=true', keywords: ['item', 'neutral'] },
  { label: 'Item Averages', path: '/items/averages?default=true', keywords: ['item', 'average'] },

  // Meta
  { label: 'Drafts', path: '/drafts?default=true', keywords: ['draft', 'pick', 'ban'] },
  { label: 'Draft Positions', path: '/drafts/positions?default=true', keywords: ['draft', 'position', 'role'] },
  { label: 'Lane Compositions', path: '/lanes/compositions?default=true', keywords: ['lane', 'composition', 'lineup'] },
  { label: 'Factions', path: '/factions/overview?default=true', keywords: ['faction', 'radiant', 'dire'] },
  { label: 'Teamfights by Player', path: '/teamfights/players?default=true', keywords: ['teamfight', 'player'] },
  { label: 'Teamfights by Team', path: '/teamfights/teams?default=true', keywords: ['teamfight', 'team'] },
  { label: 'Player Laning', path: '/lanes/laning/players?default=true', keywords: ['lane', 'laning', 'player'] },
  { label: 'Team Laning', path: '/lanes/laning/teams?default=true', keywords: ['lane', 'laning', 'team'] },
  { label: 'Hero Laning', path: '/lanes/laning/heroes?default=true', keywords: ['lane', 'laning', 'hero'] },
  { label: 'Midlane Matchup', path: '/lanes/laning/midlane-matchup?default=true', keywords: ['lane', 'mid', 'matchup'] },
  { label: 'Win Expectancy', path: '/win-expectancy', keywords: ['win', 'expectancy', 'gold', 'advantage'] },
  { label: 'Frames', path: '/frames?default=true', keywords: ['frame', 'timeline'] },
  { label: 'Casters', path: '/casters?default=true', keywords: ['caster', 'talent', 'commentator'] },

  // Ratings
  { label: 'Overall Ratings', path: '/ratings', keywords: ['rating', 'elo', 'glicko', 'ranking'] },
  { label: 'Regional Ratings', path: '/ratings/regions', keywords: ['rating', 'region', 'ranking'] },

  // Leagues
  { label: 'All Leagues', path: '/leagues', keywords: ['league', 'tournament', 'event'] },
  { label: 'LAN Event Pedigrees', path: '/leagues/pedigrees', keywords: ['league', 'lan', 'pedigree'] },
  { label: 'Contested Heroes by Event', path: '/leagues/contested-heroes', keywords: ['league', 'contested', 'hero', 'pick', 'ban', 'meta'] },

  // Trivia
  { label: 'Best Runs', path: '/trivia/best-runs', keywords: ['trivia', 'run', 'best'] },
  { label: 'Caps', path: '/trivia/caps', keywords: ['trivia', 'caps', 'experience', 'games', 'veteran'] },
  { label: 'Caps — Biggest Experience Gaps', path: '/trivia/caps#count-gap', keywords: ['trivia', 'caps', 'gap', 'mismatch', 'experience'] },
  { label: 'Caps — Biggest Hero-Experience Gaps', path: '/trivia/caps#hero-gap', keywords: ['trivia', 'caps', 'gap', 'hero', 'mismatch'] },
  { label: 'Caps — Most Veteran-Heavy Matches', path: '/trivia/caps#combined-match', keywords: ['trivia', 'caps', 'combined', 'match', 'veteran'] },
  { label: 'Caps — Most Experienced Five-Stacks', path: '/trivia/caps#combined-team', keywords: ['trivia', 'caps', 'combined', 'team', 'veteran'] },
  { label: 'Caps — Most Hero-Experienced Five-Stacks', path: '/trivia/caps#hero-team', keywords: ['trivia', 'caps', 'hero', 'team', 'veteran'] },
  { label: 'Best Team Streaks', path: '/trivia/team-streaks/best', keywords: ['trivia', 'team', 'streak', 'win'] },
  { label: 'Worst Team Streaks', path: '/trivia/team-streaks/worst', keywords: ['trivia', 'team', 'streak', 'lose'] },
  { label: 'Best Player-Hero Streaks', path: '/trivia/player-hero-streaks/best', keywords: ['trivia', 'player', 'hero', 'streak'] },
  { label: 'Worst Player-Hero Streaks', path: '/trivia/player-hero-streaks/worst', keywords: ['trivia', 'player', 'hero', 'streak'] },
  { label: 'Akke Award', path: '/trivia/akke', keywords: ['trivia', 'akke', 'award'] },
  { label: 'Maelk Award', path: '/trivia/maelk', keywords: ['trivia', 'maelk', 'award'] },
  { label: 'Cty Award', path: '/trivia/cty', keywords: ['trivia', 'cty', 'award'] },

  // About & Legal
  { label: 'About Us', path: '/about', keywords: ['about', 'info'] },
  { label: 'Glossary', path: '/glossary', keywords: ['glossary', 'definition', 'terms'] },
  { label: 'Terms of Service', path: '/terms', keywords: ['terms', 'tos', 'legal'] },
  { label: 'Privacy Policy', path: '/privacy', keywords: ['privacy', 'legal'] },
  { label: 'Data Policy', path: '/data-policy', keywords: ['data', 'policy', 'legal'] },
]
