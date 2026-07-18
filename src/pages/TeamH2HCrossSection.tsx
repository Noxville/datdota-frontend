import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import * as d3 from 'd3'
import { useApiQuery } from '../api/queries'
import { useFilters } from '../hooks/useFilters'
import { teamLogoUrl } from '../config'
import DataTable, { NumericCell, PercentCell, TeamCell } from '../components/DataTable'
import FilterPanel from '../components/FilterPanel'
import EnigmaLoader from '../components/EnigmaLoader'
import PageMeta from '../components/PageMeta'
import HelpLabel from '../components/HelpLabel'
import styles from './PlayerPerformances.module.css'
import toggleStyles from './PlayerSquads.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface H2HTeamRef {
  valveId: number
  name: string
  logoId: string | null
}

interface H2HEntry {
  teamA: H2HTeamRef
  teamB: H2HTeamRef
  teamAWins: number
  teamBWins: number
  games: number
}

const MIN_MATCHUPS_TIP =
  'Minimum number of distinct opponents a team must have played (each meeting the Min Games threshold) to appear as a row/column.'

/* ── Hash state ─────────────────────────────────────────── */

type ViewMode = 'crosstable' | 'table'

function parseHash(): { view: ViewMode; minGames: number; minMatchups: number } {
  const params = new URLSearchParams(window.location.hash.replace('#', ''))
  const view = params.get('view') === 'table' ? 'table' : 'crosstable'
  const minGames = parseInt(params.get('min') ?? '1', 10) || 1
  const minMatchups = parseInt(params.get('matchups') ?? '1', 10) || 1
  return { view, minGames, minMatchups }
}

function setHash(view: ViewMode, minGames: number, minMatchups: number) {
  const params = new URLSearchParams()
  params.set('view', view)
  params.set('min', String(minGames))
  params.set('matchups', String(minMatchups))
  window.location.hash = params.toString()
}

/* ── Simple table columns ───────────────────────────────── */

const tableColumns: ColumnDef<H2HEntry, unknown>[] = [
  {
    id: 'teamA',
    accessorFn: (row) => row.teamA.name,
    header: 'Team',
    size: 180,
    enableSorting: false,
    cell: ({ row }) => <TeamCell valveId={row.original.teamA.valveId} name={row.original.teamA.name} logoUrl={teamLogoUrl(row.original.teamA.logoId)} />,
  },
  {
    id: 'teamB',
    accessorFn: (row) => row.teamB.name,
    header: 'Vs',
    size: 180,
    enableSorting: false,
    cell: ({ row }) => <TeamCell valveId={row.original.teamB.valveId} name={row.original.teamB.name} logoUrl={teamLogoUrl(row.original.teamB.logoId)} />,
  },
  {
    id: 'games',
    accessorKey: 'games',
    header: 'Games',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Total games between the two teams' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'wins',
    accessorKey: 'teamAWins',
    header: 'W',
    size: 55,
    meta: { numeric: true, tooltip: 'Wins for the Team column' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'losses',
    accessorKey: 'teamBWins',
    header: 'L',
    size: 55,
    meta: { numeric: true, tooltip: 'Losses for the Team column (wins for Vs)' },
    cell: ({ getValue }) => <NumericCell value={getValue() as number} />,
  },
  {
    id: 'winrate',
    accessorFn: (row) => (row.games > 0 ? row.teamAWins / row.games : 0),
    header: 'Win %',
    size: 70,
    meta: { numeric: true, heatmap: 'high-good' as const, tooltip: 'Win rate for the Team column' },
    cell: ({ getValue }) => <PercentCell value={getValue() as number} />,
  },
]

/* ── D3 cross-table ─────────────────────────────────────── */

function CrossTable({
  data,
  minGames,
  minMatchups,
}: {
  data: H2HEntry[]
  minGames: number
  minMatchups: number
}) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tip, setTip] = useState<{
    x: number; y: number
    rowTeam: H2HTeamRef; colTeam: H2HTeamRef
    wins: number; losses: number; games: number
  } | null>(null)

  const { teamOrder, teams, lookup } = useMemo(() => {
    const gamesByTeam = new Map<number, number>()
    const teamById = new Map<number, H2HTeamRef>()
    // keyed by unordered pair "min-max"
    const map = new Map<string, H2HEntry>()
    for (const e of data) {
      gamesByTeam.set(e.teamA.valveId, (gamesByTeam.get(e.teamA.valveId) ?? 0) + e.games)
      gamesByTeam.set(e.teamB.valveId, (gamesByTeam.get(e.teamB.valveId) ?? 0) + e.games)
      teamById.set(e.teamA.valveId, e.teamA)
      teamById.set(e.teamB.valveId, e.teamB)
      const [a, b] = [e.teamA.valveId, e.teamB.valveId].sort((x, y) => x - y)
      map.set(`${a}-${b}`, e)
    }
    // distinct opponents per team that meet minGames
    const opponents = new Map<number, Set<number>>()
    for (const e of data) {
      if (e.games >= minGames) {
        if (!opponents.has(e.teamA.valveId)) opponents.set(e.teamA.valveId, new Set())
        if (!opponents.has(e.teamB.valveId)) opponents.set(e.teamB.valveId, new Set())
        opponents.get(e.teamA.valveId)!.add(e.teamB.valveId)
        opponents.get(e.teamB.valveId)!.add(e.teamA.valveId)
      }
    }
    const order = [...gamesByTeam.entries()]
      .filter(([id]) => (opponents.get(id)?.size ?? 0) >= minMatchups)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
    return { teamOrder: order, teams: teamById, lookup: map }
  }, [data, minGames, minMatchups])

  useEffect(() => {
    if (!svgRef.current || teamOrder.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const n = teamOrder.length
    const cellSize = Math.max(34, Math.min(56, Math.floor(1300 / n)))
    const logoSize = 32
    const headerSize = 44
    const width = headerSize + n * cellSize
    const height = headerSize + n * cellSize

    svg.attr('width', width).attr('height', height).style('font-family', 'var(--font-mono)')

    const colorScale = (winrate: number) => {
      if (winrate > 0.5) return d3.interpolateRgb('#1e1e38', '#2dd4bf')((winrate - 0.5) * 2)
      if (winrate < 0.5) return d3.interpolateRgb('#1e1e38', '#f87171')((0.5 - winrate) * 2)
      return '#1e1e38'
    }

    // Draw a team logo as a real link (so right-click / ctrl-click / middle-click
    // open the team page in a new tab), with SPA navigation on plain left-click.
    // Falls back to a lettered placeholder if the image fails.
    const drawLogo = (x: number, y: number, size: number, team: H2HTeamRef | undefined) => {
      const name = team?.name ?? ''
      const href = team ? `/teams/${team.valveId}` : null
      const a = svg.append('a')
      if (href) {
        a.attr('href', href).attr('xlink:href', href).style('cursor', 'pointer')
          .on('click', (event: MouseEvent) => {
            // Let modified / non-primary clicks fall through to the browser (new tab, etc.)
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            navigate(href)
          })
      }
      const img = a.append('image')
        .attr('x', x).attr('y', y).attr('width', size).attr('height', size)
        .attr('href', teamLogoUrl(team?.logoId ?? null))
        .on('error', function () {
          d3.select(this).remove()
          const g = a.append('g')
          g.append('rect')
            .attr('x', x).attr('y', y).attr('width', size).attr('height', size)
            .attr('rx', 4).attr('fill', '#2a2a45')
          g.append('text')
            .attr('x', x + size / 2).attr('y', y + size / 2)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
            .attr('fill', '#c9c9e0').attr('font-size', size * 0.5 + 'px').attr('font-weight', 700)
            .text((name || '?').charAt(0).toUpperCase())
          g.append('title').text(name)
        })
      img.append('title').text(name)
    }

    // Column + row header logos
    const off = (cellSize - logoSize) / 2
    const hOff = (headerSize - logoSize) / 2
    for (let k = 0; k < n; k++) {
      const team = teams.get(teamOrder[k])
      drawLogo(headerSize + k * cellSize + off, hOff, logoSize, team)
      drawLogo(hOff, headerSize + k * cellSize + off, logoSize, team)
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const rowId = teamOrder[i]
        const colId = teamOrder[j]
        const cx = headerSize + j * cellSize
        const cy = headerSize + i * cellSize

        if (rowId === colId) {
          svg.append('rect')
            .attr('x', cx).attr('y', cy)
            .attr('width', cellSize - 1).attr('height', cellSize - 1)
            .attr('fill', '#0d0d1a').attr('rx', 1)
          continue
        }

        const [a, b] = [rowId, colId].sort((x, y) => x - y)
        const entry = lookup.get(`${a}-${b}`)
        if (!entry || entry.games < minGames) {
          svg.append('rect')
            .attr('x', cx).attr('y', cy)
            .attr('width', cellSize - 1).attr('height', cellSize - 1)
            .attr('fill', '#1e1e38').attr('opacity', 0.3).attr('rx', 1)
          continue
        }

        // wins/losses from the row team's perspective
        const rowWins = entry.teamA.valveId === rowId ? entry.teamAWins : entry.teamBWins
        const rowLosses = entry.games - rowWins
        const winrate = entry.games > 0 ? rowWins / entry.games : 0.5
        const rowTeam = teams.get(rowId)!
        const colTeam = teams.get(colId)!

        svg.append('rect')
          .attr('x', cx).attr('y', cy)
          .attr('width', cellSize - 1).attr('height', cellSize - 1)
          .attr('fill', colorScale(winrate)).attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function (event) {
            d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5)
            setTip({ x: event.clientX, y: event.clientY, rowTeam, colTeam, wins: rowWins, losses: rowLosses, games: entry.games })
          })
          .on('mousemove', function (event) {
            setTip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
          })
          .on('mouseleave', function () {
            d3.select(this).attr('stroke', 'none')
            setTip(null)
          })
          .on('click', function () {
            window.open(`/teams/head-to-head?team-a=${rowId}&team-b=${colId}`, '_blank')
          })

        if (cellSize >= 28) {
          const cxMid = cx + (cellSize - 1) / 2
          const recordText = `${rowWins}-${rowLosses}`
          const pctText = `${(winrate * 100).toFixed(0)}%`
          // Size each line to fill the cell width without overflowing (approx 0.6em/char).
          const fit = (text: string, base: number) =>
            Math.min(base, (cellSize - 4) / (text.length * 0.6))
          // Top line: W-L record
          svg.append('text')
            .attr('x', cxMid)
            .attr('y', cy + (cellSize - 1) * 0.38)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#fff')
            .attr('font-size', fit(recordText, cellSize * 0.34) + 'px')
            .attr('opacity', 0.95)
            .attr('pointer-events', 'none')
            .text(recordText)
          // Lower line: win %
          svg.append('text')
            .attr('x', cxMid)
            .attr('y', cy + (cellSize - 1) * 0.7)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#fff')
            .attr('font-size', fit(pctText, cellSize * 0.3) + 'px')
            .attr('opacity', 0.78)
            .attr('pointer-events', 'none')
            .text(pctText)
        }
      }
    }
  }, [teamOrder, teams, lookup, minGames, navigate])

  if (teamOrder.length === 0) {
    return <div className={styles.empty}><p>No teams meet the current Min Games / Min Matchups thresholds.</p></div>
  }

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', position: 'relative' }}>
      <svg ref={svgRef} />
      {tip && (
        <div style={{
          position: 'fixed', left: tip.x + 12, top: tip.y - 10,
          background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)',
          borderRadius: 4, padding: '8px 12px', pointerEvents: 'none', whiteSpace: 'nowrap',
          fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: 'var(--color-primary)' }}>{tip.rowTeam.name}</strong>
            <span style={{ color: 'var(--color-text-muted)' }}>vs</span>
            <strong style={{ color: 'var(--color-accent-bright)' }}>{tip.colTeam.name}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-win)' }}>{tip.wins}W</span>
            {' / '}
            <span style={{ color: 'var(--color-loss)' }}>{tip.losses}L</span>
            <span style={{ color: 'var(--color-text-muted)' }}> ({tip.games} games)</span>
          </div>
          <div>
            Win rate: <span style={{ fontWeight: 600 }}>{(tip.games > 0 ? (tip.wins / tip.games * 100).toFixed(1) : '0')}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Min-value control ──────────────────────────────────── */

function MinControl({
  label, tip, value, max, onChange,
}: {
  label: string; tip: string; value: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <HelpLabel text={label} tip={tip} />
      <input
        type="range" min={1} max={Math.max(max, 2)} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
        style={{ width: 120, accentColor: 'var(--color-primary)' }}
      />
      <input
        type="number" min={1} max={max} value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(max, parseInt(e.target.value, 10) || 1)))}
        style={{
          width: 60, padding: '4px 8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
          background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
        }}
      />
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────── */

export default function TeamH2HCrossSection() {
  const {
    filters, setFilters, clearFilters, applyDefaults, apiParams, hasFilters,
    filtersCollapsed, setFiltersCollapsed,
  } = useFilters()

  const { data, isLoading, error } = useApiQuery<{ data: H2HEntry[] }>(
    hasFilters ? '/api/teams/head-to-head' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data?.data])
  const maxGamesInData = useMemo(() => rows.reduce((mx, r) => Math.max(mx, r.games), 1), [rows])
  const teamCount = useMemo(() => {
    const s = new Set<number>()
    for (const r of rows) { s.add(r.teamA.valveId); s.add(r.teamB.valveId) }
    return s.size
  }, [rows])

  const [view, setView] = useState<ViewMode>(() => parseHash().view)
  const [minGames, setMinGames] = useState(() => parseHash().minGames)
  const [minMatchups, setMinMatchups] = useState(() => parseHash().minMatchups)

  useEffect(() => {
    const onHashChange = () => {
      const h = parseHash()
      setView(h.view)
      setMinGames(h.minGames)
      setMinMatchups(h.minMatchups)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const filteredRows = useMemo(() => rows.filter((r) => r.games >= minGames), [rows, minGames])

  return (
    <div className={styles.page}>
      <PageMeta title="Team H2H Cross-section — Pro Dota 2" description="Cross-section of head-to-head win rates between many pro Dota 2 teams." />
      <div className={styles.header}>
        <h1>Team H2H Cross-section</h1>
        <p className={styles.subtitle}>Head-to-head win rates across the selected teams</p>
      </div>

      <FilterPanel
        filters={filters}
        onApply={setFilters}
        onClear={clearFilters}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
        showFilters={['teams', 'patch', 'after', 'before', 'leagues', 'splits', 'tier', 'split-type', 'threshold']}
      />

      {!hasFilters && (
        <div className={styles.empty}>
          <p>Select teams (and filters) to compare head-to-head.</p>
          <Link to="/teams/h2h-cross-section?default=true" className={styles.defaultLink} onClick={(e) => { e.preventDefault(); applyDefaults() }}>
            Load defaults
          </Link>
        </div>
      )}

      {hasFilters && isLoading && <EnigmaLoader text="Computing matchups..." />}

      {hasFilters && error && (
        <div className={styles.error}>
          Failed to load team head-to-head data. {error instanceof Error ? error.message : ''}
        </div>
      )}

      {hasFilters && !isLoading && !error && rows.length === 0 && (
        <div className={styles.empty}><p>No head-to-head data found for these filters.</p></div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
            <div className={toggleStyles.toggleRow} style={{ marginBottom: 0 }}>
              <button
                className={`${toggleStyles.toggleBtn} ${view === 'crosstable' ? toggleStyles.toggleActive : ''}`}
                onClick={() => { setView('crosstable'); setHash('crosstable', minGames, minMatchups) }}
              >
                Cross-table
              </button>
              <button
                className={`${toggleStyles.toggleBtn} ${view === 'table' ? toggleStyles.toggleActive : ''}`}
                onClick={() => { setView('table'); setHash('table', minGames, minMatchups) }}
              >
                Simple Table
              </button>
            </div>

            <MinControl
              label="Min Games"
              tip="Minimum games between two teams for their matchup to be shown."
              value={minGames}
              max={maxGamesInData}
              onChange={(v) => { setMinGames(v); setHash(view, v, minMatchups) }}
            />
            <MinControl
              label="Min Matchups"
              tip={MIN_MATCHUPS_TIP}
              value={minMatchups}
              max={Math.max(teamCount - 1, 2)}
              onChange={(v) => { setMinMatchups(v); setHash(view, minGames, v) }}
            />
          </div>

          {view === 'crosstable' ? (
            <CrossTable data={rows} minGames={minGames} minMatchups={minMatchups} />
          ) : (
            <DataTable
              data={filteredRows}
              columns={tableColumns}
              defaultSorting={[{ id: 'games', desc: true }]}
              searchValue={(r) => [r.teamA.name, r.teamB.name].join(' ')}
            />
          )}
        </>
      )}
    </div>
  )
}
