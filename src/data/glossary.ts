export interface GlossaryEntry {
  /** URL-friendly slug used as anchor and for lookups */
  id: string
  /** Display name */
  term: string
  /** Section grouping for the glossary page */
  section?: string
  /** One-line summary shown in tooltips */
  summary: string
  /** Optional longer explanation shown on the glossary page */
  detail?: string
  /** Optional bullet list rendered after the detail */
  bullets?: string[]
}

const glossary: GlossaryEntry[] = [
  // ── Map Control ──
  {
    id: 'control-value',
    term: 'Control Value',
    section: 'Map Control',
    summary: 'Net map control over the game, measured in control-minutes. Positive = Radiant advantage.',
    detail:
      'Computed by integrating each team\'s territorial control score over time. Positive means this team held more of the map on average; negative means the opponent did. Scales with game length — a 60-minute game will naturally have larger absolute values than a 20-minute one. Calculated per-team but symmetrical: in the context of a match, a positive value means Radiant had more control; a negative value means Dire had more control.',
  },
  {
    id: 'one-sidedness',
    term: 'One-sidedness',
    section: 'Map Control',
    summary: 'How lopsided map control was throughout the match, from 0.0 (even) to 1.0 (total domination).',
    detail:
      'Ranges from 0.0 (perfectly even — control constantly trading back and forth) to 1.0 (one team dominated the map the entire game). Calculated as the mean of the absolute control scores across all snapshots. This metric is team-agnostic — it measures how unbalanced the game was, not which side was winning.',
  },
  {
    id: 'neutral-control-value',
    term: 'Neutral Control Value',
    section: 'Map Control',
    summary: 'Cumulative jungle access advantage, weighted by camp gold value with time decay.',
    detail:
      'Weighted by neutral camp gold value with exponential time decay (recent camps matter more). Positive means this team had better access to jungle farm. Captures which team was able to control and farm the neutral camps more effectively, which often reflects map pressure that Control Value alone doesn\'t fully capture. Like Control Value, this is symmetrical in a match context: positive = Radiant advantage, negative = Dire advantage.',
  },

  // ── Laning ──
  {
    id: 'lane-matchup',
    term: 'Lane Matchup',
    section: 'Laning',
    summary: 'A core-vs-core laning matchup: Mid (mid vs mid), Safe (carry vs offlaner), or Offlane (offlaner vs carry).',
    detail:
      'Each pro match has three core-vs-core lane matchups. For each, we compute the net worth difference at 10 minutes and classify the outcome. Mid lane has tighter thresholds than the side lanes because mid is a 1v1 with more equal farm access.',
  },
  {
    id: 'lane-outcome',
    term: 'Lane Outcome',
    section: 'Laning',
    summary: 'Classification of how a core-vs-core lane went, based on 10-minute net worth difference.',
    detail:
      'Each pro match has three core-vs-core lane matchups: MID (mid vs mid), SAFE (carry vs offlaner), and OFFLANE (offlaner vs carry). For each, we compute the net worth difference at 10 minutes and classify the outcome. Mid lane thresholds: EXCELLENT (nwDiff >= 1200), WON (500 <= nwDiff < 1200), DRAWN (-500 < nwDiff < 500), LOST (-1200 < nwDiff <= -500), TERRIBLE (nwDiff <= -1200). Side lane thresholds: EXCELLENT (nwDiff >= 1800), WON (700 <= nwDiff < 1800), DRAWN (-700 < nwDiff < 700), LOST (-1800 < nwDiff <= -700), TERRIBLE (nwDiff <= -1800). These thresholds were calibrated so that ~40% of lanes are DRAWN across all three lane types. Supports get their own raw metrics (NW, XP, kills, deaths, damage) but no lane outcome — only core-vs-core matchups are classified.',
  },
  {
    id: 'nw-at-5',
    term: 'NW@5',
    section: 'Laning',
    summary: 'Player net worth at the 5-minute mark.',
  },
  {
    id: 'nw-at-10',
    term: 'NW@10',
    section: 'Laning',
    summary: 'Player net worth at the 10-minute mark.',
  },
  {
    id: 'lh-at-10',
    term: 'LH@10',
    section: 'Laning',
    summary: 'Total last hits at 10 minutes.',
  },
  {
    id: 'dn-at-10',
    term: 'DN@10',
    section: 'Laning',
    summary: 'Denies at 10 minutes.',
  },
  {
    id: 'k-at-10',
    term: 'K@10',
    section: 'Laning',
    summary: 'Kills at 10 minutes.',
  },
  {
    id: 'd-at-10',
    term: 'D@10',
    section: 'Laning',
    summary: 'Deaths at 10 minutes.',
  },
  {
    id: 'hd-at-10',
    term: 'HD@10',
    section: 'Laning',
    summary: 'Hero damage dealt by 10 minutes.',
  },
  {
    id: 'hdt-at-10',
    term: 'HDT@10',
    section: 'Laning',
    summary: 'Hero damage taken by 10 minutes.',
  },
  {
    id: 'regen-gold',
    term: 'Regen Gold (Regen$)',
    section: 'Laning',
    summary: 'Gold spent on consumable regen items before 10 minutes.',
    detail:
      'Tracks gold spent on tangos, healing salves, clarities, enchanted mangoes, faerie fires, bottles, and blood grenades purchased before the 10-minute mark. A high value often indicates a contested lane where the player needed to sustain through harass.',
  },
  {
    id: 'nw-vs-avg',
    term: 'NW vs Avg',
    section: 'Laning',
    summary: 'Net worth at 10 min compared to this hero\'s patch benchmark average. Cores only.',
    detail:
      'The difference between the player\'s actual 10-minute net worth and the expected net worth for this hero in this role and lane, based on patch-level benchmarks. Benchmarks are smoothed using James-Stein shrinkage: heroes with few games are pulled toward the global average to avoid noisy estimates. Positive means the player farmed better than typical; negative means worse.',
  },
  {
    id: 'lh-vs-avg',
    term: 'LH vs Avg',
    section: 'Laning',
    summary: 'Last hits at 10 min compared to this hero\'s patch benchmark average. Cores only.',
    detail:
      'Same methodology as NW vs Avg, but for last hits. Helps distinguish whether a net worth lead came from efficient farming or from kills and other gold sources.',
  },
  {
    id: 'hd-vs-avg',
    term: 'HD vs Avg',
    section: 'Laning',
    summary: 'Hero damage at 10 min compared to this hero\'s patch benchmark average. Cores only.',
    detail:
      'Same methodology as NW vs Avg, but for hero damage. Indicates how aggressively the player traded in lane relative to what\'s typical for their hero.',
  },
  {
    id: 'lanes-won',
    term: 'Lanes Won',
    section: 'Laning',
    summary: 'Average number of the 3 core-vs-core lane matchups where the team had the NW advantage at 10 minutes.',
    detail:
      'Counted per game across Mid, Safe, and Offlane. A team that wins all three lanes in every game would average 3.0. The metric only counts core-vs-core matchups and uses the raw NW difference (any positive diff counts as a win, not the outcome classification thresholds).',
  },
  {
    id: 'time-in-lane-pct',
    term: 'Time in Lane %',
    section: 'Laning',
    summary: 'Percentage of the first 10 minutes the player spent in their assigned lane.',
    detail:
      'Calculated from laning state data — each 5-second snapshot records where the player is on the map. A high percentage means the player stayed in their lane; a low percentage may indicate roaming, jungling early, or being forced out.',
  },
  {
    id: 'first-blood-rate',
    term: 'First Blood Rate',
    section: 'Laning',
    summary: 'Percentage of games where this team drew first blood.',
  },

  // ── Leagues ──
  {
    id: 'splits',
    term: 'What are splits?',
    section: 'Leagues',
    summary: 'Sub-segments of a league (online qualifiers, LAN main event, post-event qualifiers) — datdota uses these in place of a flat LAN/online flag.',
    detail:
      'Leagues on datdota don\'t have a single LAN/online flag — instead each league is broken into one or more "splits". Three split types are configured (all optional): online, LAN, and post-event. Available via /api/splits and the standard splits filter.',
    bullets: [
      '(online) — typical regular online events.',
      '(online, LAN) — online qualifiers feeding a LAN main event; extremely common.',
      '(online, LAN, post-event) — rarer, usually historical qualifier formats or a misconfiguration that gets fixed.',
      '(LAN) — very rare; only when qualifiers are on a separate ticket or for invitationals.',
      '(LAN, post-event) — very rare; e.g. WESG and a few events that didn\'t apply for a follow-up qualifier ticket.',
      '(post-event) alone — should never happen.',
    ],
  },

  // ── Benchmarks ──
  {
    id: 'lane-benchmarks',
    term: 'Lane Benchmarks',
    section: 'Benchmarks',
    summary: 'Average 10-minute stats for each (hero, role, lane, patch) combination, used as the baseline for "vs expected" comparisons.',
    detail:
      'Lane Benchmarks store the average 10-minute stats (networth, last hits, level, kills, deaths, hero damage, building damage) for each (hero, role, lane, patch) combination, computed from tier 1+2 pro matches with a minimum of 5 games. When comparing a player\'s performance against these benchmarks, we use a James-Stein / empirical Bayes shrinkage estimator: for heroes with many games the benchmark is essentially the raw hero average, but for heroes with few games the benchmark is pulled toward the global (lane, role) mean for that patch. The shrinkage factor B = \u03C3\u00B2_between / (\u03C3\u00B2_between + \u03C3\u00B2_within / n) controls this blend \u2014 a hero with 5 games gets heavily shrunk toward the global, while a hero with 200 games is barely affected. This prevents low-sample heroes from producing misleading "above/below expected" comparisons driven by noise from just a handful of games.',
  },
  {
    id: 'james-stein-shrinkage',
    term: 'James-Stein Shrinkage',
    section: 'Benchmarks',
    summary: 'Statistical method used to blend hero-specific benchmarks with global averages to reduce noise from small samples.',
    detail:
      'An empirical Bayes shrinkage estimator. The shrinkage factor B = \u03C3\u00B2_between / (\u03C3\u00B2_between + \u03C3\u00B2_within / n) controls the blend between the hero-specific average and the global (lane, role) average. When a hero has been played many times (large n), B \u2248 1 and the benchmark is mostly hero-specific. When sample size is small, B is closer to 0 and the benchmark is pulled toward the global average for all heroes in that role and lane. This prevents misleading benchmarks for rarely-picked heroes.',
  },

  // \u2500\u2500 Players \u2500\u2500
  {
    id: 'signature-heroes',
    term: 'Signature Heroes',
    section: 'Players',
    summary: 'A player\u2019s most defining heroes, ranked by a weighted blend of how much, how distinctively, and how successfully they play each one.',
    detail:
      'Each hero gets a signature score \u2014 the sum of six weighted signals (below). A dominant signature hero lands around 1.5\u20132.5; there is no fixed maximum, so scores are shown relative to the player\u2019s own #1 hero rather than as a percentage. On the player page each hero\u2019s bar length is its signature score, and the coloured segments show which signals drive it. Segment sizes are weighted by percentile within each signal \u2014 how the value ranks against every pro \u2014 so a genuinely exceptional signal stands out instead of being swamped by raw volume, which is near-maximal for almost everyone\u2019s most-played hero. Distinctiveness and off-meta are volume-gated: a hero needs roughly 50 games to earn full rarity credit, so a 20-game novelty pick can\u2019t masquerade as a signature.',
    bullets: [
      'Volume \u2014 how much of their career this hero is, relative to their own most-played hero. The biggest signal.',
      'Distinctiveness \u2014 how much they \u201Cown\u201D the hero across the whole pro scene. Absolute, so it\u2019s comparable between players.',
      'Off-meta \u2014 how contrarian the pick is: playing it heavily in patches when few others do.',
      'Big-stage \u2014 how much they bring it to LANs, especially Valve events (TIs and Majors), rather than online.',
      'Win rate \u2014 whether they actually win on it, centred at 50% and smoothed for small samples. The only signal that can go negative and drag the score down.',
      'Recency \u2014 whether they still play it (share of games in the last 18 months). Zero for a retired player\u2019s old heroes is expected, not missing data.',
    ],
  },

  // \u2500\u2500 Matches \u2500\u2500
  {
    id: 'teamfight-types',
    term: 'Teamfight Types',
    section: 'Matches',
    summary: 'Teamfights are classified by how many heroes each side committed: Solo, Gank, Skirmish or Battle.',
    detail:
      'Every teamfight is bucketed by the number of heroes each team had involved \u2014 taking the smaller and larger of the two side counts. This captures the character of the fight, from a lane 1v1 up to a full five-man clash. On the match timeline each type is drawn in its own colour and can be toggled on/off.',
    bullets: [
      'Solo \u2014 1v1 (both sides had a single hero involved).',
      'Gank \u2014 1 vs many (one side caught with a lone hero).',
      'Skirmish \u2014 a multi-hero fight that isn\u2019t a full clash (fewer than 4-vs-4).',
      'Battle \u2014 a large fight, at least 4 heroes on each side.',
    ],
  },

  // \u2500\u2500 Teams \u2500\u2500
  {
    id: 'highground-scenarios',
    term: 'Highground Scenarios',
    section: 'Teams',
    summary: 'The build-up to the first Tier-3 (highground) break of each game \u2014 leads, buybacks, aegis, fights and barracks conversion.',
    detail:
      'For every game we find the first Tier-3 tower break (the first highground break), identify the team that took it (the \u201ctaker\u201d), and sample the game state at the break and each minute back to five minutes prior (T\u22120 \u2026 T\u2212300). Each sample records interpolated net-worth / kill / XP leads, how many heroes on each side are buyback-ready, who holds the Aegis, and the tower / barracks state. We also count teamfights won and aegis pickups inside that five-minute window, flag whether breaking the T3 converted into that lane\u2019s ranged and melee barracks within 1, 2 or 3 minutes, and record whether the taker went on to win the game. Filter by the usual patch / tier / league / time scope, or by teams to see only games where a given team broke highground first.',
    bullets: [
      'Taker / Defender \u2014 the team that broke the first T3, and the team defending it.',
      'Break time \u2014 game clock of the first highground break.',
      'NW / Kill lead \u2014 the taker\u2019s net-worth and kill lead at the break (and each minute back to T\u2212300).',
      'Buyback-ready & Aegis \u2014 buyback-ready hero counts and aegis possession at the break.',
      'Fights won \u2014 teamfights the taker won of those in the 5-minute window, plus aegis pickups.',
      'Rax conversion \u2014 whether the break turned into the lane\u2019s ranged / melee barracks within 1, 2 or 3 minutes.',
      'Taker won \u2014 whether the team that broke highground first went on to win the game.',
    ],
  },
]

export default glossary

/** Lookup a glossary entry by id */
export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return glossary.find((e) => e.id === id)
}
