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
]

export default glossary

/** Lookup a glossary entry by id */
export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return glossary.find((e) => e.id === id)
}
