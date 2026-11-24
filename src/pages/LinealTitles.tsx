import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import PageMeta from '../components/PageMeta'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import styles from './LinealTitles.module.css'

interface Reign {
  valveId: number
  team: string
  wonInMatchId: number
  wonInLeague: string
  startDate: string
  endDate: string | null
  gamesHeld: number
  lostToValveId: number | null
  lostInMatchId: number | null
  inactive: boolean
}

interface Aegis {
  aegis: string
  seedMatchId: number
  seedDate: string
  currentHolderValveId: number
  currentHolder: string
  reigns: Reign[]
}

function parseDate(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function useMeasure() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function getInitialView(): string {
  const hash = window.location.hash.replace('#', '')
  return hash || 'overall'
}

export default function LinealTitles() {
  const { data, isLoading, error } = useApiQuery<{ data: Aegis[] }>('/api/records/lineal-titles')
  const [view, setView] = useState<string>(getInitialView)

  useEffect(() => {
    function onHash() {
      setView(window.location.hash.replace('#', '') || 'overall')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function selectView(v: string) {
    setView(v)
    window.location.hash = v === 'overall' ? '' : `#${v}`
  }

  return (
    <div className={styles.page}>
      <PageMeta
        title="Lineal Aegis Titles — Pro Dota 2"
        description="Boxing-style lineal championship for each Aegis of the Immortals: every TI winner is seeded a title that passes to whoever next beats the holder in a tier 1/2 series."
      />
      <div className={styles.header}>
        <h1>Lineal Aegis Titles</h1>
        <p className={styles.subtitle}>
          A boxing-style &ldquo;the team that beat the team&rdquo; championship for each Aegis of the Immortals.
          Every TI winner is seeded a title; it then passes to whoever next beats the current holder in a series.
        </p>
        <div className={styles.note}>
          Only tier 1/2 series count. A title changes hands on the last game of each series, following the team&rsquo;s
          valve id. A reign is flagged <em>inactive</em> when the holder has an idle gap of six months or more (for
          example a disbanded team that was never beaten still &ldquo;holds&rdquo; its title).
        </div>
      </div>

      {isLoading && <EnigmaLoader text="Loading lineal titles..." />}
      {error && <ErrorState message="Failed to load lineal titles." />}

      {data && <Body aegises={data.data} view={view} onSelect={selectView} />}
    </div>
  )
}

function Body({ aegises, view, onSelect }: { aegises: Aegis[]; view: string; onSelect: (v: string) => void }) {
  const [now] = useState(() => new Date())

  const sorted = [...aegises].sort((a, b) => parseDate(a.seedDate).getTime() - parseDate(b.seedDate).getTime())

  const teamIds = [...new Set(sorted.flatMap((a) => a.reigns.map((r) => r.valveId)))]
  const teamName = new Map<number, string>()
  for (const a of sorted) for (const r of a.reigns) teamName.set(r.valveId, r.team)

  const palette = d3.quantize((t) => d3.interpolateSinebow(t * 0.96), Math.max(3, teamIds.length))
  const color = d3.scaleOrdinal<number, string>().domain(teamIds).range(palette)

  const selected = view !== 'overall' ? sorted.find((a) => a.aegis === view) : undefined

  return (
    <>
      <div className={styles.selector}>
        <button
          className={`${styles.selBtn} ${view === 'overall' ? styles.selActive : ''}`}
          onClick={() => onSelect('overall')}
        >
          Overall
        </button>
        {sorted.map((a) => (
          <button
            key={a.aegis}
            className={`${styles.selBtn} ${view === a.aegis ? styles.selActive : ''}`}
            onClick={() => onSelect(a.aegis)}
          >
            {a.aegis}
          </button>
        ))}
      </div>

      {selected ? (
        <AegisView aegis={selected} color={color} now={now} />
      ) : (
        <OverallView aegises={sorted} color={color} teamName={teamName} now={now} />
      )}
    </>
  )
}

function LeaderBoard({
  title,
  sub,
  rows,
  color,
  teamName,
}: {
  title: string
  sub: string
  rows: { valveId: number; days: number }[]
  color: d3.ScaleOrdinal<number, string>
  teamName: Map<number, string>
}) {
  const max = rows[0]?.days ?? 1
  return (
    <div className={styles.board}>
      <div className={styles.boardTitle}>{title}</div>
      <div className={styles.boardSub}>{sub}</div>
      {rows.map((r, i) => (
        <div key={r.valveId} className={styles.boardRow}>
          <span className={styles.boardBar} style={{ background: color(r.valveId), width: `${(r.days / max) * 100}%` }} />
          <span className={styles.boardRank}>{i + 1}</span>
          <span className={styles.boardName}>
            <a href={`/teams/${r.valveId}`}>{teamName.get(r.valveId) ?? r.valveId}</a>
          </span>
          <span className={styles.boardVal}>{Math.round(r.days).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Overall: aggregate holdings over time ─────────────────────────────── */

interface Interval {
  valveId: number
  start: Date
  end: Date
}

function OverallView({
  aegises,
  color,
  teamName,
  now,
}: {
  aegises: Aegis[]
  color: d3.ScaleOrdinal<number, string>
  teamName: Map<number, string>
  now: Date
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<{ x: number; date: Date; rows: { valveId: number; count: number }[] } | null>(null)

  const intervals: Interval[] = []
  for (const a of aegises) {
    for (const r of a.reigns) {
      intervals.push({
        valveId: r.valveId,
        start: parseDate(r.startDate),
        end: r.endDate ? parseDate(r.endDate) : now,
      })
    }
  }

  const teamIds = [...new Set(intervals.map((i) => i.valveId))]
  const boundaries = [...new Set(intervals.flatMap((i) => [i.start.getTime(), i.end.getTime()]))].sort((a, b) => a - b)

  const activeAt = (t: number) => {
    const counts = new Map<number, number>()
    for (const iv of intervals) {
      if (iv.start.getTime() <= t && iv.end.getTime() > t) counts.set(iv.valveId, (counts.get(iv.valveId) ?? 0) + 1)
    }
    return counts
  }

  const rows = boundaries.map((t) => {
    const counts = activeAt(t)
    const row: Record<string, number> & { date: number } = { date: t }
    for (const id of teamIds) row[String(id)] = counts.get(id) ?? 0
    return row
  })

  // Order teams by total held-time so the biggest bands sit at the bottom.
  const heldTime = new Map<number, number>()
  for (const iv of intervals) heldTime.set(iv.valveId, (heldTime.get(iv.valveId) ?? 0) + (iv.end.getTime() - iv.start.getTime()))
  const keys = [...teamIds].sort((a, b) => (heldTime.get(a) ?? 0) - (heldTime.get(b) ?? 0)).map(String)

  // Records
  let peak = { valveId: -1, count: 0, date: now }
  for (const t of boundaries) {
    const counts = activeAt(t)
    for (const [id, c] of counts) if (c > peak.count) peak = { valveId: id, count: c, date: new Date(t) }
  }
  const currentCounts = new Map<number, number>()
  for (const a of aegises) currentCounts.set(a.currentHolderValveId, (currentCounts.get(a.currentHolderValveId) ?? 0) + 1)
  const currentLeader = [...currentCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  let longest = { team: '', aegis: '', games: 0 }
  for (const a of aegises) for (const r of a.reigns) if (r.gamesHeld > longest.games) longest = { team: r.team, aegis: a.aegis, games: r.gamesHeld }

  // Leaderboards: per-team days-with-an-Aegis (interval union) and Aegis-days (sum of reign spans).
  const DAY = 86_400_000
  const perTeamIvs = new Map<number, [number, number][]>()
  for (const iv of intervals) {
    const arr = perTeamIvs.get(iv.valveId)
    const pair: [number, number] = [iv.start.getTime(), iv.end.getTime()]
    if (arr) arr.push(pair)
    else perTeamIvs.set(iv.valveId, [pair])
  }
  const unionDays = (ivs: [number, number][]) => {
    const s = [...ivs].sort((a, b) => a[0] - b[0])
    let total = 0
    let cs = -1
    let ce = -1
    for (const [a, b] of s) {
      if (a > ce) {
        if (ce >= 0) total += ce - cs
        cs = a
        ce = b
      } else if (b > ce) {
        ce = b
      }
    }
    if (ce >= 0) total += ce - cs
    return total / DAY
  }
  const daysWith = [...perTeamIvs.entries()]
    .map(([valveId, ivs]) => ({ valveId, days: unionDays(ivs) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 10)
  const aegisDays = [...perTeamIvs.entries()]
    .map(([valveId, ivs]) => ({ valveId, days: ivs.reduce((s, [a, b]) => s + (b - a), 0) / DAY }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 10)

  const H = 320
  const M = { top: 12, right: 16, bottom: 26, left: 34 }
  const innerW = Math.max(10, width - M.left - M.right)
  const innerH = H - M.top - M.bottom
  const x = d3.scaleTime([new Date(boundaries[0]), now], [0, innerW])
  const maxTotal = d3.max(rows, (r) => keys.reduce((s, k) => s + r[k], 0)) ?? 1
  const y = d3.scaleLinear([0, maxTotal], [innerH, 0])
  const stack = d3.stack<Record<string, number> & { date: number }>().keys(keys)(rows)
  const area = d3
    .area<d3.SeriesPoint<Record<string, number> & { date: number }>>()
    .x((d) => x(new Date(d.data.date)))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveStepAfter)

  // Teams that ever held >= 2 at once — the legend-worthy ones.
  const notable = keys
    .filter((k) => rows.some((r) => r[k] >= 2))
    .map(Number)
    .sort((a, b) => (heldTime.get(b) ?? 0) - (heldTime.get(a) ?? 0))

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const t = x.invert(mx).getTime()
    const counts = activeAt(t)
    const list = [...counts.entries()]
      .filter(([, c]) => c > 0)
      .map(([valveId, count]) => ({ valveId, count }))
      .sort((a, b) => b.count - a.count)
    setHover({ x: mx + M.left, date: new Date(t), rows: list })
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.recordStrip}>
          <div className={styles.recordCard}>
            <div className={styles.recordLabel}>Current lineal leader</div>
            <div className={styles.recordValue}>{currentLeader ? teamName.get(currentLeader[0]) : '—'}</div>
            <div className={styles.recordMeta}>{currentLeader ? `holds ${currentLeader[1]} of ${aegises.length} Aegises` : ''}</div>
          </div>
          <div className={styles.recordCard}>
            <div className={styles.recordLabel}>Most held at once</div>
            <div className={styles.recordValue}>{peak.count > 0 ? `${peak.count} Aegises` : '—'}</div>
            <div className={styles.recordMeta}>{peak.valveId >= 0 ? `${teamName.get(peak.valveId)} · ${fmtDate(peak.date)}` : ''}</div>
          </div>
          <div className={styles.recordCard}>
            <div className={styles.recordLabel}>Longest single reign</div>
            <div className={styles.recordValue}>{longest.games} games</div>
            <div className={styles.recordMeta}>{longest.team ? `${longest.team} · ${longest.aegis} Aegis` : ''}</div>
          </div>
        </div>

        <div className={styles.sectionTitle}>Aegises held over time</div>
        <div className={styles.sectionSub}>
          Each band is a team; its thickness is how many Aegis titles they held at that moment. Hover for the standings on any date.
        </div>

        <div className={styles.card}>
          <div className={styles.chartWrap} ref={ref}>
            {width > 0 && (
              <svg width={width} height={H} className={styles.ganttSvg}>
                <g transform={`translate(${M.left},${M.top})`}>
                  {y.ticks(Math.min(maxTotal, 6)).map((t) => (
                    <g key={t} transform={`translate(0,${y(t)})`}>
                      <line x1={0} x2={innerW} className={styles.axisLine} strokeDasharray="2,3" />
                      <text x={-8} dy="0.32em" textAnchor="end" fontSize={10}>{t}</text>
                    </g>
                  ))}
                  {x.ticks(Math.min(10, Math.floor(innerW / 80))).map((t) => (
                    <text key={+t} x={x(t)} y={innerH + 16} textAnchor="middle" fontSize={10}>
                      {t.getFullYear()}
                    </text>
                  ))}
                  {stack.map((series) => (
                    <path key={series.key} d={area(series) ?? ''} fill={color(Number(series.key))} opacity={0.9} />
                  ))}
                  {hover && (
                    <line x1={hover.x - M.left} x2={hover.x - M.left} y1={0} y2={innerH} stroke="var(--color-text)" strokeWidth={1} opacity={0.4} />
                  )}
                  <rect
                    width={innerW}
                    height={innerH}
                    fill="transparent"
                    onMouseMove={onMove}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              </svg>
            )}
            {hover && hover.rows.length > 0 && (
              <div className={styles.tooltip} style={{ left: hover.x, top: 90 }}>
                <div className={styles.tooltipTeam}>{fmtDate(hover.date)}</div>
                {hover.rows.slice(0, 8).map((r) => (
                  <div key={r.valveId} className={styles.tooltipRow}>
                    <span className={styles.dot} style={{ background: color(r.valveId), display: 'inline-block', marginRight: 6 }} />
                    {teamName.get(r.valveId)} — {r.count}
                  </div>
                ))}
              </div>
            )}
          </div>

          {notable.length > 0 && (
            <div className={styles.legend}>
              {notable.map((id) => (
                <span key={id} className={styles.legendItem}>
                  <span className={styles.swatch} style={{ background: color(id) }} />
                  {teamName.get(id)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Leaderboards</div>
        <div className={styles.sectionSub}>All-time cumulative title holding across every Aegis.</div>
        <div className={styles.boards}>
          <LeaderBoard
            title="Total days as a Lineal Champion"
            sub="Calendar days holding at least one title"
            rows={daysWith}
            color={color}
            teamName={teamName}
          />
          <LeaderBoard
            title="Total Combined Lineal Champion Days"
            sub="Σ (titles held × days) across all reigns"
            rows={aegisDays}
            color={color}
            teamName={teamName}
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Current holders</div>
        <div className={styles.sectionSub}>Who holds each Aegis right now. Select a TI above for its full lineage.</div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.chrono}>
            <thead>
              <tr>
                <th>Aegis</th>
                <th>Holder</th>
                <th>Since</th>
                <th style={{ textAlign: 'right' }}>Games</th>
              </tr>
            </thead>
            <tbody>
              {aegises.map((a) => {
                const cur = a.reigns[a.reigns.length - 1]
                return (
                  <tr key={a.aegis}>
                    <td style={{ borderLeft: `3px solid ${color(a.currentHolderValveId)}`, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      {a.aegis}
                    </td>
                    <td>
                      <span className={styles.chronoTeam}>
                        <a href={`/teams/${a.currentHolderValveId}`} target="_blank" rel="noreferrer">{a.currentHolder}</a>
                      </span>
                      {cur.inactive && <span className={styles.inactiveBadge} style={{ marginLeft: 8 }}>inactive</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(parseDate(cur.startDate))}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cur.gamesHeld}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ── Per-Aegis: single timeline + reign chronology ─────────────────────── */

/** Wikipedia-style lineage: each team that held the title is a row, and the
 * title line hops between rows at every hand-off. */
function LineageChart({ aegis, color, now }: { aegis: Aegis; color: d3.ScaleOrdinal<number, string>; now: Date }) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<{ x: number; y: number; reign: Reign } | null>(null)

  const reigns = aegis.reigns
  const order: number[] = []
  for (const r of reigns) if (!order.includes(r.valveId)) order.push(r.valveId)
  const rowOf = new Map(order.map((id, i) => [id, i] as const))
  const nameOf = new Map<number, string>()
  for (const r of reigns) nameOf.set(r.valveId, r.team)
  const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

  const ROW_H = 30
  const M = { top: 14, right: 16, bottom: 30, left: 160 }
  const innerW = Math.max(10, width - M.left - M.right)
  const chartH = order.length * ROW_H
  const H = chartH + M.top + M.bottom
  const x = d3.scaleTime([parseDate(aegis.seedDate), now], [0, innerW])
  const yOf = (id: number) => (rowOf.get(id) ?? 0) * ROW_H + ROW_H / 2

  return (
    <div className={styles.chartWrap} ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} className={styles.ganttSvg}>
          <g transform={`translate(${M.left},${M.top})`}>
            {order.map((id, i) => (
              <g key={id}>
                <rect x={-M.left} y={i * ROW_H} width={M.left + innerW} height={ROW_H} fill="var(--color-bg-elevated)" opacity={i % 2 ? 0.3 : 0} />
                <line x1={0} x2={innerW} y1={yOf(id)} y2={yOf(id)} className={styles.axisLine} opacity={0.35} />
                <rect x={-M.left + 6} y={yOf(id) - 5} width={10} height={10} rx={2} fill={color(id)} />
                <text
                  x={-M.left + 22}
                  y={yOf(id)}
                  dy="0.32em"
                  fontSize={11}
                  className={styles.rowLabel}
                  onClick={() => window.open(`/teams/${id}`, '_blank')}
                >
                  {trunc(nameOf.get(id) ?? String(id), 20)}
                </text>
              </g>
            ))}
            {x.ticks(Math.min(10, Math.floor(innerW / 80))).map((t) => (
              <g key={+t}>
                <line x1={x(t)} x2={x(t)} y1={0} y2={chartH} className={styles.axisLine} strokeDasharray="2,3" opacity={0.5} />
                <text x={x(t)} y={chartH + 16} textAnchor="middle" fontSize={10}>{t.getFullYear()}</text>
              </g>
            ))}
            {reigns.map((r, i) => {
              if (i === 0) return null
              const prev = reigns[i - 1]
              const cx = x(parseDate(r.startDate))
              return <line key={`c${i}`} x1={cx} x2={cx} y1={yOf(prev.valveId)} y2={yOf(r.valveId)} stroke="var(--color-text-muted)" strokeWidth={1.5} opacity={0.7} />
            })}
            {reigns.map((r, i) => {
              const x0 = x(parseDate(r.startDate))
              const x1 = x(r.endDate ? parseDate(r.endDate) : now)
              const w = Math.max(2, x1 - x0)
              const yc = yOf(r.valveId)
              return (
                <g key={i}>
                  <rect
                    className={styles.segment}
                    x={x0}
                    y={yc - 5}
                    width={w}
                    height={10}
                    rx={3}
                    fill={color(r.valveId)}
                    opacity={r.inactive ? 0.45 : 1}
                    onMouseMove={(e) => {
                      const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                      setHover({ x: e.clientX - rect.left, y: M.top + yc, reign: r })
                    }}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => window.open(`/teams/${r.valveId}`, '_blank')}
                  />
                  <circle cx={x0} cy={yc} r={3.5} fill="var(--color-bg-deep)" stroke={color(r.valveId)} strokeWidth={2} pointerEvents="none" />
                </g>
              )
            })}
          </g>
        </svg>
      )}
      {hover && (
        <div className={styles.tooltip} style={{ left: hover.x, top: hover.y }}>
          <div className={styles.tooltipTeam}>{hover.reign.team}</div>
          <div className={styles.tooltipRow}>
            {fmtDate(parseDate(hover.reign.startDate))} – {hover.reign.endDate ? fmtDate(parseDate(hover.reign.endDate)) : 'now'}
          </div>
          <div className={styles.tooltipRow}>{hover.reign.gamesHeld} games held</div>
          <div className={styles.tooltipMuted}>won in {hover.reign.wonInLeague}</div>
          {hover.reign.inactive && <div className={styles.tooltipMuted}>inactive (idle ≥ 6 months)</div>}
        </div>
      )}
    </div>
  )
}

function AegisView({ aegis, color, now }: { aegis: Aegis; color: d3.ScaleOrdinal<number, string>; now: Date }) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState<{ x: number; reign: Reign } | null>(null)

  const ROW_H = 46
  const M = { top: 10, right: 12, bottom: 26, left: 12 }
  const innerW = Math.max(10, width - M.left - M.right)
  const H = ROW_H + M.top + M.bottom
  const x = d3.scaleTime([parseDate(aegis.seedDate), now], [0, innerW])

  return (
    <div className={styles.section}>
      <div className={styles.aegisHead}>
        <span className={styles.aegisTitle}>{aegis.aegis} Aegis</span>
        <span className={styles.aegisMeta}>
          seeded {fmtDate(parseDate(aegis.seedDate))} · {aegis.reigns.length} reigns · currently held by {aegis.currentHolder}
        </span>
      </div>

      <div className={styles.sectionTitle}>Timeline</div>
      <div className={styles.sectionSub}>Reigns in sequence — hover a segment for detail.</div>
      <div className={styles.card}>
        <div className={styles.chartWrap} ref={ref}>
          {width > 0 && (
            <svg width={width} height={H} className={styles.ganttSvg}>
              <g transform={`translate(${M.left},${M.top})`}>
                {aegis.reigns.map((r, i) => {
                  const x0 = x(parseDate(r.startDate))
                  const x1 = x(r.endDate ? parseDate(r.endDate) : now)
                  const w = Math.max(1, x1 - x0)
                  return (
                    <g key={i}>
                      <rect
                        className={styles.segment}
                        x={x0}
                        y={0}
                        width={w}
                        height={ROW_H}
                        rx={2}
                        fill={color(r.valveId)}
                        opacity={r.inactive ? 0.5 : 0.95}
                        onMouseMove={(e) => {
                          const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                          setHover({ x: e.clientX - rect.left, reign: r })
                        }}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => window.open(`/teams/${r.valveId}`, '_blank')}
                      />
                      {w > 46 && (
                        <text x={x0 + 5} y={ROW_H / 2} dy="0.32em" fontSize={10} fill="var(--color-bg-deep)" pointerEvents="none">
                          {r.team.length > w / 7 ? r.team.slice(0, Math.max(0, Math.floor(w / 7))) : r.team}
                        </text>
                      )}
                    </g>
                  )
                })}
                {x.ticks(Math.min(10, Math.floor(innerW / 80))).map((t) => (
                  <text key={+t} x={x(t)} y={ROW_H + 16} textAnchor="middle" fontSize={10}>
                    {t.getFullYear()}
                  </text>
                ))}
              </g>
            </svg>
          )}
          {hover && (
            <div className={styles.tooltip} style={{ left: hover.x, top: M.top + ROW_H }}>
              <div className={styles.tooltipTeam}>{hover.reign.team}</div>
              <div className={styles.tooltipRow}>
                {fmtDate(parseDate(hover.reign.startDate))} – {hover.reign.endDate ? fmtDate(parseDate(hover.reign.endDate)) : 'now'}
              </div>
              <div className={styles.tooltipRow}>{hover.reign.gamesHeld} games held</div>
              <div className={styles.tooltipMuted}>won in {hover.reign.wonInLeague}</div>
              {hover.reign.inactive && <div className={styles.tooltipMuted}>inactive (idle ≥ 6 months)</div>}
            </div>
          )}
        </div>
      </div>

      <div className={styles.section} style={{ marginTop: 'var(--space-lg)' }}>
        <div className={styles.sectionTitle}>Lineage</div>
        <div className={styles.sectionSub}>Each row is a team that has held this Aegis; the title line hops rows at every hand-off.</div>
        <div className={styles.card}>
          <LineageChart aegis={aegis} color={color} now={now} />
        </div>
      </div>

      <div className={styles.section} style={{ marginTop: 'var(--space-lg)' }}>
        <table className={styles.chrono}>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Won in</th>
              <th>Reign</th>
              <th style={{ textAlign: 'right' }}>Games</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {aegis.reigns.map((r, i) => {
              const current = r.endDate === null
              return (
                <tr key={i} className={current ? styles.currentRow : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <span className={styles.chronoTeam}>
                      <span className={styles.dot} style={{ background: color(r.valveId) }} />
                      <a href={`/teams/${r.valveId}`} target="_blank" rel="noreferrer">{r.team}</a>
                    </span>
                    {r.inactive && <span className={styles.inactiveBadge} style={{ marginLeft: 8 }}>inactive</span>}
                  </td>
                  <td>
                    {r.wonInLeague}
                    {' · '}
                    <a className="link" href={`/matches/${r.wonInMatchId}`} target="_blank" rel="noreferrer">match</a>
                  </td>
                  <td>
                    {fmtDate(parseDate(r.startDate))} – {r.endDate ? fmtDate(parseDate(r.endDate)) : 'now'}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.gamesHeld}</td>
                  <td>
                    {current ? (
                      <span className={styles.tooltipMuted}>current holder</span>
                    ) : (
                      <a className="link" href={`/matches/${r.lostInMatchId}`} target="_blank" rel="noreferrer">lost series</a>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
