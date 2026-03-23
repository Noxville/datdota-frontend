export interface GlossaryEntry {
  /** URL-friendly slug used as anchor and for lookups */
  id: string
  /** Display name */
  term: string
  /** One-line summary shown in tooltips */
  summary: string
  /** Optional longer explanation shown on the glossary page */
  detail?: string
}

const glossary: GlossaryEntry[] = [
  {
    id: 'control-value',
    term: 'Control Value',
    summary: 'Net map control over the game, measured in control-minutes. Positive = Radiant advantage.',
    detail:
      'Computed by integrating each team\'s territorial control score over time. Positive means this team held more of the map on average; negative means the opponent did. Scales with game length — a 60-minute game will naturally have larger absolute values than a 20-minute one. Calculated per-team but symmetrical: in the context of a match, a positive value means Radiant had more control; a negative value means Dire had more control.',
  },
  {
    id: 'one-sidedness',
    term: 'One-sidedness',
    summary: 'How lopsided map control was throughout the match, from 0.0 (even) to 1.0 (total domination).',
    detail:
      'Ranges from 0.0 (perfectly even — control constantly trading back and forth) to 1.0 (one team dominated the map the entire game). Calculated as the mean of the absolute control scores across all snapshots. This metric is team-agnostic — it measures how unbalanced the game was, not which side was winning.',
  },
  {
    id: 'neutral-control-value',
    term: 'Neutral Control Value',
    summary: 'Cumulative jungle access advantage, weighted by camp gold value with time decay.',
    detail:
      'Weighted by neutral camp gold value with exponential time decay (recent camps matter more). Positive means this team had better access to jungle farm. Captures which team was able to control and farm the neutral camps more effectively, which often reflects map pressure that Control Value alone doesn\'t fully capture. Like Control Value, this is symmetrical in a match context: positive = Radiant advantage, negative = Dire advantage.',
  },
]

export default glossary

/** Lookup a glossary entry by id */
export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return glossary.find((e) => e.id === id)
}
