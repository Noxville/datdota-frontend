import { useMemo, useState, useEffect, useCallback } from 'react'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import { getHeroById } from '../data/heroes'
import { heroImageUrl } from '../config'
import type {
  MidlaneMatchRow,
  MidlaneMatchupPlayer,
  MidlaneMatchupResponse,
  MidlaneMatchupVsField,
  MidlaneMatchupVsPlayer,
} from '../types'
import pageStyles from './PlayerPerformances.module.css'
import styles from './MidlaneMatchup.module.css'

const TIMES = [8, 10, 12] as const
type Time = (typeof TIMES)[number]

type Base =
  | 'lh' | 'denies' | 'nw' | 'level'
  | 'kills' | 'deaths' | 'assists' | 'heroDamage'
type DiffBase = 'lhDiff' | 'nwDiff' | 'levelDiff'
type Direction = 'higher' | 'lower'

interface MetricDef {
  base: Base | 'wins'
  label: string
  direction: Direction
  format: (v: number) => string
  deltaFormat?: (v: number) => string
  /** Diff thresholds for the arrow indicator under the stat label. */
  diff?: {
    /** When set, source diffs from the API per-match field (e.g. lhDiff). Otherwise computed as A.avg − B.avg. */
    apiBase?: DiffBase | 'wins'
    format: (v: number) => string
    small: number
    big: number
  }
}

function fmtThousands(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v.toFixed(0)
}

function fmtSigned(decimals: number) {
  return (v: number) => {
    const s = v.toFixed(decimals)
    return v > 0 ? `+${s}` : s
  }
}

const fmt0 = (v: number) => v.toFixed(0)
const fmt1 = (v: number) => v.toFixed(1)
const fmt2 = (v: number) => v.toFixed(2)

const METRICS: MetricDef[] = [
  {
    base: 'wins',
    label: 'Wins',
    direction: 'higher',
    format: fmt0,
    deltaFormat: (v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}% wr`,
    diff: { apiBase: 'wins', format: fmt0, small: 1, big: 5 },
  },
  {
    base: 'nw',
    label: 'Net Worth',
    direction: 'higher',
    format: fmtThousands,
    deltaFormat: fmtSigned(0),
    diff: { apiBase: 'nwDiff', format: fmtThousands, small: 20, big: 200 },
  },
  {
    base: 'lh',
    label: 'Last Hits',
    direction: 'higher',
    format: fmt1,
    deltaFormat: fmtSigned(1),
    diff: { apiBase: 'lhDiff', format: fmt1, small: 1.5, big: 4 },
  },
  {
    base: 'denies',
    label: 'Denies',
    direction: 'higher',
    format: fmt1,
    deltaFormat: fmtSigned(1),
    diff: { format: fmt1, small: 0.5, big: 1.5 },
  },
  {
    base: 'level',
    label: 'Level',
    direction: 'higher',
    format: fmt1,
    deltaFormat: fmtSigned(2),
    diff: { apiBase: 'levelDiff', format: (v) => v.toFixed(2), small: 0.02, big: 0.15 },
  },
  {
    base: 'kills',
    label: 'Kills',
    direction: 'higher',
    format: fmt2,
    deltaFormat: fmtSigned(2),
    diff: { format: fmt2, small: 0.25, big: 0.75 },
  },
  {
    base: 'deaths',
    label: 'Deaths',
    direction: 'lower',
    format: fmt2,
    deltaFormat: fmtSigned(2),
    diff: { format: fmt2, small: 0.2, big: 0.6 },
  },
  {
    base: 'assists',
    label: 'Assists',
    direction: 'higher',
    format: fmt2,
    deltaFormat: fmtSigned(2),
    diff: { format: fmt2, small: 0.3, big: 0.9 },
  },
  {
    base: 'heroDamage',
    label: 'Hero Damage',
    direction: 'higher',
    format: fmtThousands,
    deltaFormat: fmtSigned(0),
    diff: { format: fmtThousands, small: 75, big: 350 },
  },
]

function metricKey(base: Base | DiffBase, t: Time): string {
  return `${base}At${t}`
}

function avgFromRows(rows: MidlaneMatchRow[], key: string): number | null {
  let sum = 0
  let n = 0
  for (const r of rows) {
    const v = r.metrics?.[key]
    if (v != null) {
      sum += v
      n += 1
    }
  }
  return n === 0 ? null : sum / n
}

function pairHash(a: number, b: number): string {
  const [x, y] = a < b ? [a, b] : [b, a]
  return `${x}-${y}`
}

function computeValues(
  m: MetricDef,
  time: Time,
  player: MidlaneMatchupPlayer,
  vs: MidlaneMatchupVsPlayer | null,
): { matchup: number | null; field: number | null } {
  if (m.base === 'wins') {
    return { matchup: vs?.wins ?? null, field: player.vsField?.wins ?? null }
  }
  const key = metricKey(m.base, time)
  const matchup = vs ? avgFromRows(vs.rows, key) : null
  const field = player.vsField?.metrics?.[key]?.avg ?? null
  return { matchup, field }
}

function computeDelta(
  m: MetricDef,
  player: MidlaneMatchupPlayer,
  vs: MidlaneMatchupVsPlayer | null,
  matchup: number | null,
  field: number | null,
): number | null {
  if (m.base === 'wins') {
    if (!vs || vs.games === 0 || !player.vsField || player.vsField.games === 0) return null
    return vs.wins / vs.games - player.vsField.wins / player.vsField.games
  }
  if (matchup == null || field == null) return null
  return matchup - field
}

/**
 * Diff used by the under-label arrow. Positive ⇒ player A ahead.
 * Sources the API per-match diff when available, otherwise falls back to A.avg − B.avg.
 */
function computeMatchupDiff(
  m: MetricDef,
  time: Time,
  aVs: MidlaneMatchupVsPlayer | null,
  bVs: MidlaneMatchupVsPlayer | null,
  aMatchup: number | null,
  bMatchup: number | null,
): number | null {
  if (!m.diff) return null
  if (m.diff.apiBase === 'wins') {
    if (!aVs || !bVs) return null
    return aVs.wins - bVs.wins
  }
  if (m.diff.apiBase && aVs && aVs.rows.length > 0) {
    return avgFromRows(aVs.rows, metricKey(m.diff.apiBase, time))
  }
  if (aMatchup != null && bMatchup != null) return aMatchup - bMatchup
  return null
}

interface DiffIndicator {
  arrows: string
  magnitude: string
  toward: 'left' | 'right' | 'even'
}

function diffIndicator(m: MetricDef, diff: number | null): DiffIndicator | null {
  if (!m.diff || diff == null) return null
  const abs = Math.abs(diff)
  if (abs < m.diff.small) {
    return { arrows: '≈', magnitude: m.diff.format(abs), toward: 'even' }
  }
  // For 'lower-is-better' metrics, positive diff means A is worse. Flip semantics.
  const aBetter = m.direction === 'higher' ? diff > 0 : diff < 0
  const toward: 'left' | 'right' = aBetter ? 'left' : 'right'
  const big = abs >= m.diff.big
  const arrows = big ? (toward === 'left' ? '«' : '»') : (toward === 'left' ? '‹' : '›')
  return { arrows, magnitude: m.diff.format(abs), toward }
}

type PopupState =
  | {
      kind: 'matchup'
      metricDef: MetricDef
      time: Time
      player: { steamId: number; nickname: string }
      opponent: { steamId: number; nickname: string }
      playerRows: MidlaneMatchRow[]
      opponentRows: MidlaneMatchRow[]
    }
  | {
      kind: 'field'
      metricDef: MetricDef
      time: Time
      player: MidlaneMatchupPlayer
    }

function HeroIcon({ heroId, size = 20 }: { heroId: number | null | undefined; size?: number }) {
  if (!heroId) return null
  const h = getHeroById(heroId)
  if (!h) return null
  return <img className={styles.heroIcon} src={heroImageUrl(h.picture)} alt={h.name} title={h.name} style={{ width: size + 8, height: size }} />
}

function MatchupPopup({ state, onClose }: { state: PopupState; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.popupOverlay} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        {state.kind === 'matchup' ? <MatchupPopupBody s={state} onClose={onClose} /> : <FieldPopupBody s={state} onClose={onClose} />}
      </div>
    </div>
  )
}

function MatchupPopupBody({ s, onClose }: { s: Extract<PopupState, { kind: 'matchup' }>; onClose: () => void }) {
  const { metricDef, time, playerRows, opponentRows, player, opponent } = s
  const isWins = metricDef.base === 'wins'
  const key = isWins ? null : metricKey(metricDef.base as Base, time)

  const joined = useMemo(() => {
    const oppMap = new Map(opponentRows.map((r) => [r.matchId, r]))
    return playerRows.map((p) => ({ p, o: oppMap.get(p.matchId) ?? null }))
  }, [playerRows, opponentRows])

  const sorted = useMemo(() => {
    if (!key) return joined
    return [...joined]
      .filter(({ p }) => p.metrics?.[key] != null)
      .sort((x, y) => (y.p.metrics[key] as number) - (x.p.metrics[key] as number))
  }, [joined, key])

  const playerAvg = useMemo(() => {
    if (!key) return null
    return avgFromRows(playerRows, key)
  }, [playerRows, key])

  const opponentAvg = useMemo(() => {
    if (!key) return null
    return avgFromRows(opponentRows, key)
  }, [opponentRows, key])

  const playerWins = playerRows.filter((r) => r.win).length
  const playerLosses = playerRows.length - playerWins

  return (
    <>
      <div className={styles.popupHeader}>
        <div>
          <h3 className={styles.popupTitle}>{metricDef.label} {isWins ? '' : `@${time}`}</h3>
          <div className={styles.popupSubtitle}>
            {player.nickname} vs {opponent.nickname} · {playerRows.length} game{playerRows.length === 1 ? '' : 's'}
            {isWins && <> · <strong>{playerWins}W – {playerLosses}L</strong></>}
          </div>
        </div>
        <button className={styles.popupClose} onClick={onClose} aria-label="Close">×</button>
      </div>

      {!isWins && playerAvg != null && opponentAvg != null && (
        <div className={styles.popupAvgRow}>
          <div className={styles.popupAvgSide}>
            <span className={styles.popupAvgLabel}>{player.nickname} avg</span>
            <span className={styles.popupAvgValue}>{metricDef.format(playerAvg)}</span>
          </div>
          <div className={styles.popupAvgDelta}>
            Δ {fmtSigned(metricDef.base === 'level' ? 2 : 1)(playerAvg - opponentAvg)}
          </div>
          <div className={styles.popupAvgSide}>
            <span className={styles.popupAvgLabel}>{opponent.nickname} avg</span>
            <span className={styles.popupAvgValue}>{metricDef.format(opponentAvg)}</span>
          </div>
        </div>
      )}

      <div className={styles.popupTableWrap}>
        <table className={styles.popupTable}>
          <thead>
            <tr>
              <th className={styles.popupThLeft}>{player.nickname}</th>
              {!isWins && <th className={styles.popupThRight}>@{time}</th>}
              {!isWins && <th className={styles.popupThCenter}>Δ</th>}
              {!isWins && <th className={styles.popupThLeft}>@{time}</th>}
              <th className={styles.popupThRight}>{opponent.nickname}</th>
              <th className={styles.popupThCenter}>Match</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ p, o }) => {
              const pVal = key ? p.metrics?.[key] : null
              const oVal = key && o ? o.metrics?.[key] : null
              const delta = (pVal != null && oVal != null) ? (pVal - oVal) : null
              const deltaSide = delta == null
                ? null
                : metricDef.direction === 'higher' ? (delta > 0 ? 'good' : delta < 0 ? 'bad' : null)
                                                  : (delta < 0 ? 'good' : delta > 0 ? 'bad' : null)
              return (
                <tr key={p.matchId}>
                  <td className={styles.popupTdLeft}>
                    <HeroIcon heroId={p.viewerHero} />
                    <span className={`${styles.popupResult} ${p.win ? styles.popupWin : styles.popupLoss}`}>
                      {p.win ? 'W' : 'L'}
                    </span>
                  </td>
                  {!isWins && (
                    <td className={styles.popupTdRight}>
                      <span className={styles.popupValue}>{pVal == null ? '—' : metricDef.format(pVal)}</span>
                    </td>
                  )}
                  {!isWins && (
                    <td className={styles.popupTdCenter}>
                      {delta != null && (
                        <span className={`${styles.popupDelta} ${deltaSide === 'good' ? styles.deltaGood : deltaSide === 'bad' ? styles.deltaBad : styles.deltaNeutral}`}>
                          {fmtSigned(metricDef.base === 'level' ? 2 : metricDef.base === 'heroDamage' || metricDef.base === 'nw' ? 0 : 1)(delta)}
                        </span>
                      )}
                    </td>
                  )}
                  {!isWins && (
                    <td className={styles.popupTdLeft}>
                      <span className={styles.popupValue}>{oVal == null ? '—' : metricDef.format(oVal)}</span>
                    </td>
                  )}
                  <td className={styles.popupTdRight}>
                    <HeroIcon heroId={p.opponentHero} />
                  </td>
                  <td className={styles.popupTdCenter}>
                    <a href={`/matches/${p.matchId}`} className={styles.popupMatchLink}>{p.matchId}</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function FieldPopupBody({ s, onClose }: { s: Extract<PopupState, { kind: 'field' }>; onClose: () => void }) {
  const { metricDef, time, player } = s
  const isWins = metricDef.base === 'wins'
  const vsField = player.vsField

  if (!vsField) {
    return (
      <>
        <div className={styles.popupHeader}>
          <div>
            <h3 className={styles.popupTitle}>{metricDef.label} {isWins ? '' : `@${time}`}</h3>
            <div className={styles.popupSubtitle}>{player.player.nickname} vs field · no data</div>
          </div>
          <button className={styles.popupClose} onClick={onClose} aria-label="Close">×</button>
        </div>
      </>
    )
  }

  const summary = isWins ? null : vsField.metrics?.[metricKey(metricDef.base as Base, time)]
  const winrate = vsField.games > 0 ? vsField.wins / vsField.games : null

  return (
    <>
      <div className={styles.popupHeader}>
        <div>
          <h3 className={styles.popupTitle}>{metricDef.label} {isWins ? '' : `@${time}`} · vs field</h3>
          <div className={styles.popupSubtitle}>
            {player.player.nickname} · {vsField.games} games · {vsField.wins}W / {vsField.losses}L
            {summary?.avg != null && <> · avg <strong>{metricDef.format(summary.avg)}</strong></>}
            {isWins && winrate != null && <> · <strong>{(winrate * 100).toFixed(1)}%</strong> winrate</>}
          </div>
        </div>
        <button className={styles.popupClose} onClick={onClose} aria-label="Close">×</button>
      </div>

      {isWins && (
        <div className={styles.popupSection}>
          <div className={styles.popupSectionTitle}>Record</div>
          <div className={styles.popupList}>
            <div className={styles.popupRow}>
              <span />
              <span style={{ color: 'var(--color-accent-bright)', fontWeight: 700 }}>{vsField.wins} W</span>
              <span style={{ color: 'var(--color-loss)', fontWeight: 700 }}>{vsField.losses} L</span>
            </div>
          </div>
        </div>
      )}

      {summary && summary.top5.length > 0 && (
        <div className={styles.popupSection}>
          <div className={styles.popupSectionTitle}>{metricDef.direction === 'higher' ? 'Best' : 'Highest'}</div>
          <ExtremumRows extrema={summary.top5} format={metricDef.format} />
        </div>
      )}
      {summary && summary.bottom5.length > 0 && (
        <div className={styles.popupSection}>
          <div className={styles.popupSectionTitle}>{metricDef.direction === 'higher' ? 'Worst' : 'Lowest'}</div>
          <ExtremumRows extrema={summary.bottom5} format={metricDef.format} />
        </div>
      )}
    </>
  )
}

function ExtremumRows({ extrema, format }: { extrema: { matchId: number; value: number }[]; format: (v: number) => string }) {
  return (
    <div className={styles.popupList}>
      {extrema.map((e, i) => (
        <div key={`${e.matchId}-${i}`} className={styles.popupRow}>
          <span />
          <a href={`/matches/${e.matchId}`}>{e.matchId}</a>
          <span className={styles.popupValue}>{format(e.value)}</span>
        </div>
      ))}
    </div>
  )
}

function formatWithRate(wins: number, games: number) {
  if (games <= 0) return <>{wins}</>
  const pct = (wins / games) * 100
  return (
    <>
      {wins} <span className={styles.winsRate}>({pct.toFixed(0)}%)</span>
    </>
  )
}

function deltaTooltip(m: MetricDef, playerName: string, oppName: string, matchup: number | null, field: number | null, delta: number | null): string {
  if (delta == null) return `${playerName}'s matchup average minus their average vs the field`
  if (m.base === 'wins') {
    return `Winrate change vs ${oppName} compared to ${playerName}'s overall winrate`
  }
  const matchupS = matchup != null ? m.format(matchup) : '—'
  const fieldS = field != null ? m.format(field) : '—'
  return `${playerName} vs ${oppName}: ${matchupS}\nvs field: ${fieldS}\nΔ ${m.deltaFormat ? m.deltaFormat(delta) : delta.toFixed(2)}`
}

function fieldTooltip(m: MetricDef, p: MidlaneMatchupPlayer): string {
  if (!p.vsField) return `${p.player.nickname}: no vs-field data`
  if (m.base === 'wins') {
    const wr = p.vsField.games > 0 ? (p.vsField.wins / p.vsField.games) * 100 : 0
    return `${p.player.nickname} vs the field: ${p.vsField.wins}W / ${p.vsField.losses}L over ${p.vsField.games} games (${wr.toFixed(1)}% winrate). Click for the W/L breakdown.`
  }
  const summary = p.vsField.metrics?.[metricKey(m.base, 10)]
  const avg10 = summary?.avg != null ? m.format(summary.avg) : '—'
  return `${p.player.nickname}'s ${m.label.toLowerCase()} vs every other midlaner (${p.vsField.games} games). @10 avg: ${avg10}. Click for top / bottom matches.`
}

function deltaClass(m: MetricDef, delta: number | null): string {
  if (delta == null || delta === 0) return styles.deltaNeutral
  const better = m.direction === 'higher' ? delta > 0 : delta < 0
  return better ? styles.deltaGood : styles.deltaBad
}

interface MatchupBoardProps {
  a: MidlaneMatchupPlayer
  b: MidlaneMatchupPlayer
  aVs: MidlaneMatchupVsPlayer | null
  bVs: MidlaneMatchupVsPlayer | null
  time: Time
  onOpenPopup: (state: PopupState) => void
}

function MatchupBoard({ a, b, aVs, bVs, time, onOpenPopup }: MatchupBoardProps) {
  const games = aVs?.games ?? bVs?.games ?? 0

  return (
    <div className={styles.card} key={`${a.player.steamId}-${b.player.steamId}`}>
      <div className={styles.cardHeader}>
        <div className={styles.playerHeader}>
          <a href={`/players/${a.player.steamId}`} className={styles.playerName}>{a.player.nickname}</a>
          <FieldMeta vsField={a.vsField} />
        </div>
        <div className={styles.versus}>VS</div>
        <div className={`${styles.playerHeader} ${styles.playerHeaderRight}`}>
          <a href={`/players/${b.player.steamId}`} className={styles.playerName}>{b.player.nickname}</a>
          <FieldMeta vsField={b.vsField} />
        </div>
      </div>

      {games === 0 && (
        <div className={styles.matchupSummary}>
          <span className={styles.muted}>No head-to-head games found</span>
        </div>
      )}

      {games > 0 && (
        <div className={styles.matrixWrap}>
          <div className={styles.matrixHead}>
            <div className={styles.headCol}>vs field</div>
            <div className={styles.headCol}>Δ</div>
            <div className={styles.headColMain}>vs {b.player.nickname}</div>
            <div className={styles.headColStat}>@{time}</div>
            <div className={styles.headColMain}>vs {a.player.nickname}</div>
            <div className={styles.headCol}>Δ</div>
            <div className={styles.headCol}>vs field</div>
          </div>

          <div className={styles.matrix}>
            {METRICS.map((m, mi) => {
              const aVals = computeValues(m, time, a, aVs)
              const bVals = computeValues(m, time, b, bVs)
              const aDelta = computeDelta(m, a, aVs, aVals.matchup, aVals.field)
              const bDelta = computeDelta(m, b, bVs, bVals.matchup, bVals.field)

              let winner: 'a' | 'b' | 'tie' = 'tie'
              if (aVals.matchup != null && bVals.matchup != null && aVals.matchup !== bVals.matchup) {
                const aBetter = m.direction === 'higher' ? aVals.matchup > bVals.matchup : aVals.matchup < bVals.matchup
                winner = aBetter ? 'a' : 'b'
              }

              const matchupDiff = computeMatchupDiff(m, time, aVs, bVs, aVals.matchup, bVals.matchup)
              const indicator = diffIndicator(m, matchupDiff)

              const aRows = aVs?.rows ?? []
              const bRows = bVs?.rows ?? []

              const rowStyle: React.CSSProperties = {
                animationDelay: `${mi * 35 + 60}ms`,
              }

              const onClickA = aRows.length > 0
                ? () => onOpenPopup({ kind: 'matchup', metricDef: m, time, player: a.player, opponent: b.player, playerRows: aRows, opponentRows: bRows })
                : undefined
              const onClickB = bRows.length > 0
                ? () => onOpenPopup({ kind: 'matchup', metricDef: m, time, player: b.player, opponent: a.player, playerRows: bRows, opponentRows: aRows })
                : undefined
              const onClickAField = a.vsField
                ? () => onOpenPopup({ kind: 'field', metricDef: m, time, player: a })
                : undefined
              const onClickBField = b.vsField
                ? () => onOpenPopup({ kind: 'field', metricDef: m, time, player: b })
                : undefined

              return (
                <div key={m.base} className={styles.row} style={rowStyle}>
                  {/* A field */}
                  <div
                    className={`${styles.fieldCell} ${onClickAField ? styles.clickable : ''}`}
                    onClick={onClickAField}
                    title={fieldTooltip(m, a)}
                  >
                    {aVals.field == null
                      ? <span className={styles.muted}>—</span>
                      : <span className={styles.fieldValue}>
                          {m.base === 'wins' && a.vsField ? formatWithRate(aVals.field, a.vsField.games) : m.format(aVals.field)}
                        </span>}
                  </div>

                  {/* A delta */}
                  <div className={styles.deltaCell}>
                    {aDelta != null && m.deltaFormat ? (
                      <span
                        className={`${styles.deltaBadge} ${deltaClass(m, aDelta)}`}
                        title={deltaTooltip(m, a.player.nickname, b.player.nickname, aVals.matchup, aVals.field, aDelta)}
                      >
                        {m.deltaFormat(aDelta)}
                      </span>
                    ) : <span className={styles.muted}>—</span>}
                  </div>

                  {/* A main */}
                  <div
                    className={`${styles.mainCell} ${winner === 'a' ? styles.win : winner === 'b' ? styles.lose : ''} ${onClickA ? styles.clickable : ''}`}
                    onClick={onClickA}
                    title={onClickA ? `Click for the per-match breakdown of ${m.label} between ${a.player.nickname} and ${b.player.nickname}` : undefined}
                  >
                    <div className={styles.mainInner}>
                      {winner === 'a' && <span className={styles.winnerArrow}>▲</span>}
                      <span className={styles.mainValue}>
                        {aVals.matchup == null
                          ? <span className={styles.muted}>—</span>
                          : m.base === 'wins' && aVs
                            ? formatWithRate(aVals.matchup, aVs.games)
                            : m.format(aVals.matchup)}
                      </span>
                    </div>
                  </div>

                  {/* Stat label + matchup diff arrow */}
                  <div className={styles.statCol}>
                    <div className={styles.statLabel}>{m.label}</div>
                    {indicator && (
                      <div className={`${styles.statArrow} ${indicator.toward === 'even' ? styles.statArrowEven : ''}`}>
                        {indicator.toward === 'right' ? (
                          <>
                            <span className={styles.arrowMag}>{indicator.magnitude}</span>
                            <span className={styles.arrowHead}>{indicator.arrows}</span>
                          </>
                        ) : (
                          <>
                            <span className={styles.arrowHead}>{indicator.arrows}</span>
                            <span className={styles.arrowMag}>{indicator.magnitude}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* B main */}
                  <div
                    className={`${styles.mainCell} ${winner === 'b' ? styles.win : winner === 'a' ? styles.lose : ''} ${onClickB ? styles.clickable : ''}`}
                    onClick={onClickB}
                    title={onClickB ? `Click for the per-match breakdown of ${m.label} between ${b.player.nickname} and ${a.player.nickname}` : undefined}
                  >
                    <div className={styles.mainInner}>
                      {winner === 'b' && <span className={styles.winnerArrow}>▲</span>}
                      <span className={styles.mainValue}>
                        {bVals.matchup == null
                          ? <span className={styles.muted}>—</span>
                          : m.base === 'wins' && bVs
                            ? formatWithRate(bVals.matchup, bVs.games)
                            : m.format(bVals.matchup)}
                      </span>
                    </div>
                  </div>

                  {/* B delta */}
                  <div className={styles.deltaCell}>
                    {bDelta != null && m.deltaFormat ? (
                      <span
                        className={`${styles.deltaBadge} ${deltaClass(m, bDelta)}`}
                        title={deltaTooltip(m, b.player.nickname, a.player.nickname, bVals.matchup, bVals.field, bDelta)}
                      >
                        {m.deltaFormat(bDelta)}
                      </span>
                    ) : <span className={styles.muted}>—</span>}
                  </div>

                  {/* B field */}
                  <div
                    className={`${styles.fieldCell} ${onClickBField ? styles.clickable : ''}`}
                    onClick={onClickBField}
                    title={fieldTooltip(m, b)}
                  >
                    {bVals.field == null
                      ? <span className={styles.muted}>—</span>
                      : <span className={styles.fieldValue}>
                          {m.base === 'wins' && b.vsField ? formatWithRate(bVals.field, b.vsField.games) : m.format(bVals.field)}
                        </span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function FieldMeta({ vsField }: { vsField: MidlaneMatchupVsField | null }) {
  if (!vsField) return <span className={styles.playerMeta}>no vs-field data</span>
  return (
    <span className={styles.playerMeta}>
      vs field: {vsField.games} games · {vsField.wins}W / {vsField.losses}L
    </span>
  )
}

export default function MidlaneMatchup() {
  const {
    filters,
    setFilters,
    clearFilters,
    applyDefaults,
    apiParams,
    hasFilters,
    filtersCollapsed,
    setFiltersCollapsed,
  } = useFilters()

  const hasPlayers = !!filters.players && filters.players.length > 0
  const playerCount = filters.players ? filters.players.split(',').filter(Boolean).length : 0

  const { data, isLoading, error } = useApiQuery<{ data: MidlaneMatchupResponse }>(
    hasFilters && hasPlayers ? '/api/laning/midlane-matchup' : null,
    apiParams,
  )

  const players = useMemo(() => data?.data?.players ?? [], [data])

  const pairs = useMemo(() => {
    const result: { a: MidlaneMatchupPlayer; b: MidlaneMatchupPlayer; hash: string }[] = []
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        result.push({
          a: players[i],
          b: players[j],
          hash: pairHash(players[i].player.steamId, players[j].player.steamId),
        })
      }
    }
    return result
  }, [players])

  const [selectedHash, setSelectedHash] = useState<string | null>(() =>
    typeof window !== 'undefined' && window.location.hash
      ? window.location.hash.replace(/^#/, '')
      : null,
  )

  useEffect(() => {
    const onHash = () => setSelectedHash(window.location.hash.replace(/^#/, '') || null)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const selected = useMemo(
    () => pairs.find((p) => p.hash === selectedHash) ?? pairs[0] ?? null,
    [pairs, selectedHash],
  )

  useEffect(() => {
    if (!selected) return
    if (window.location.hash.replace(/^#/, '') === selected.hash) return
    const url = `${window.location.pathname}${window.location.search}#${selected.hash}`
    window.history.replaceState(null, '', url)
  }, [selected])

  const selectPair = useCallback((hash: string) => {
    setSelectedHash(hash)
  }, [])

  const [time, setTime] = useState<Time>(10)

  const findVs = (p: MidlaneMatchupPlayer, oppId: number): MidlaneMatchupVsPlayer | null =>
    p.vsPlayers.find((v) => v.opponent.steamId === oppId) ?? null

  const [popup, setPopup] = useState<PopupState | null>(null)

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.header}>
        <h1>Midlane Matchups</h1>
        <p className={pageStyles.subtitle}>
          Head-to-head laning stats between midlane cores. Pick two or more players to see every matchup.
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['players', 'heroes', 'patch', 'split-type', 'after', 'before', 'duration', 'leagues', 'splits', 'tier', 'result-faction', 'threshold']}
      />

      {!hasFilters && (
        <div className={pageStyles.empty}>
          <p>Add at least two midlane players to compare, or use</p>
          <button className={pageStyles.defaultLink} onClick={applyDefaults}>
            default filters
          </button>
        </div>
      )}

      {hasFilters && !hasPlayers && (
        <div className={pageStyles.empty}>
          <p>Pick at least two players in the filter panel above.</p>
        </div>
      )}

      {hasFilters && hasPlayers && playerCount < 2 && (
        <div className={pageStyles.empty}>
          <p>Add another player — matchups need at least two midlaners.</p>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Loading midlane matchups..." />}

      {error && (
        <div className={pageStyles.error}>
          Failed to load data. {error instanceof Error ? error.message : 'Unknown error.'}
        </div>
      )}

      {(pairs.length > 0) && (
        <div className={styles.controlsBar}>
          {pairs.length > 1 && (
            <div className={styles.pairPicker} role="tablist" aria-label="Matchup">
              {pairs.map((p) => (
                <button
                  key={p.hash}
                  role="tab"
                  aria-selected={p.hash === selected?.hash}
                  className={`${styles.pairChip} ${p.hash === selected?.hash ? styles.pairChipActive : ''}`}
                  onClick={() => selectPair(p.hash)}
                >
                  <span>{p.a.player.nickname}</span>
                  <span className={styles.pairChipDot}>·</span>
                  <span>{p.b.player.nickname}</span>
                </button>
              ))}
            </div>
          )}
          <div className={styles.timePicker} role="tablist" aria-label="Snapshot time">
            <span className={styles.timeLabel}>Snapshot</span>
            {TIMES.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={t === time}
                className={`${styles.timeChip} ${t === time ? styles.timeChipActive : ''}`}
                onClick={() => setTime(t)}
              >
                @{t}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className={styles.cards}>
          <MatchupBoard
            key={`${selected.hash}-${time}`}
            a={selected.a}
            b={selected.b}
            aVs={findVs(selected.a, selected.b.player.steamId)}
            bVs={findVs(selected.b, selected.a.player.steamId)}
            time={time}
            onOpenPopup={setPopup}
          />
        </div>
      )}

      {popup && <MatchupPopup state={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}
