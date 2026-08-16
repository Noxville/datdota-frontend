#!/usr/bin/env node

/**
 * Generates dist/sitemap.xml and dist/search-index.json after `vite build`.
 *
 * A single fetch of the entity lists feeds both outputs, so they never diverge:
 *   - Players with >=500 games in tier 1-2 from /api/players/performances
 *   - Currently-rated teams from /api/ratings
 *   - All leagues from /api/leagues
 *
 * sitemap.xml additionally includes hardcoded static routes (mirrored from
 * src/router.tsx), excluding routes that are noindex, disallowed in robots.txt,
 * or filter-dependent (e.g. /matches/:id, /casters/*, /styleguide).
 *
 * search-index.json powers the in-app global search (Ctrl-K). It holds only the
 * dynamic entities (id + display name); static app pages live in the bundled
 * src/data/searchPages.ts.
 *
 * Usage: node scripts/build-sitemap.cjs
 */

const fs = require('fs')
const path = require('path')

const SITE_URL = 'https://datdota.com'
const API_BASE = 'https://api.datdota.com'
const SITEMAP_PATH = path.join(__dirname, '../dist/sitemap.xml')
const SEARCH_INDEX_PATH = path.join(__dirname, '../dist/search-index.json')
// Also written to public/ so the vite dev server serves it at /search-index.json
const SEARCH_INDEX_PUBLIC_PATH = path.join(__dirname, '../public/search-index.json')

const STATIC_ROUTES = [
  '/',
  // Heroes
  '/heroes/performances',
  '/heroes/elo',
  '/heroes/elo-by-phase',
  '/heroes/frequent-players',
  '/heroes/head-to-head',
  '/facets/summary',
  '/abilities/builds',
  // Players
  '/players/performances',
  '/players/single-performances',
  '/players/unique-heroes',
  '/players/squads',
  '/players/hero-combos',
  '/players/teams',
  '/players/rivalries',
  '/players/records',
  // Teams
  '/teams/performances',
  '/teams/head-to-head',
  '/teams/h2h-cross-section',
  '/teams/unique-heroes',
  '/teams/towers',
  '/teams/throws',
  '/teams/comebacks',
  '/teams/map-control',
  '/teams/identity',
  '/teams/series-outcomes',
  '/teams/highground-scenarios',
  // Matches (excluding /matches and /matches/:id — disallowed)
  '/matches/finder',
  '/matches/durations',
  '/matches/scorigami',
  '/matches/all-players-buyback',
  '/matches/never-led',
  // Events
  '/events/hero-kills',
  '/events/hero-deaths',
  '/events/first-bloods',
  '/events/wards',
  '/events/crits',
  '/events/roshan',
  '/events/aegis',
  '/events/tormentor',
  '/events/couriers',
  '/events/buildings',
  '/events/runes',
  '/events/divine-rapiers',
  '/events/rampages',
  // Scenarios
  '/scenarios/megacreep-comebacks',
  '/scenarios/first-wisdoms',
  '/scenarios/bounty-bazinga',
  '/scenarios/gameloop',
  // Items
  '/items/distribution',
  '/items/averages',
  '/items/progression',
  '/items/neutrals',
  // Drafts
  '/drafts',
  '/drafts/positions',
  // Teamfights
  '/teamfights/players',
  '/teamfights/teams',
  // Laning
  '/lanes/laning/players',
  '/lanes/laning/teams',
  '/lanes/laning/heroes',
  // Meta
  '/lanes/compositions',
  '/factions/overview',
  '/win-expectancy',
  '/frames',
  // Ratings
  '/ratings',
  '/ratings/regions',
  // Trivia
  '/trivia/team-streaks/best',
  '/trivia/team-streaks/worst',
  '/trivia/player-hero-streaks/best',
  '/trivia/player-hero-streaks/worst',
  '/trivia/hero-streaks/best',
  '/trivia/hero-streaks/worst',
  '/trivia/best-runs',
  '/trivia/caps',
  '/trivia/akke',
  '/trivia/maelk',
  '/trivia/cty',
  // Leagues
  '/leagues',
  '/leagues/pedigrees',
  '/leagues/contested-heroes',
  // About & Legal
  '/about',
  '/glossary',
  '/terms',
  '/privacy',
  '/data-policy',
]

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'datdota-sitemap-builder/1.0',
    },
  })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function urlEntry(loc, lastmod, priority) {
  const parts = [`    <loc>${escapeXml(SITE_URL + loc)}</loc>`]
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`)
  if (priority != null) parts.push(`    <priority>${priority}</priority>`)
  return `  <url>\n${parts.join('\n')}\n  </url>`
}

async function fetchEntities() {
  console.log('Fetching entity lists from', API_BASE, '...')

  const [leaguesRes, ratingsRes, playersRes] = await Promise.all([
    fetchJson(`${API_BASE}/api/leagues`),
    fetchJson(`${API_BASE}/api/ratings`),
    fetchJson(`${API_BASE}/api/players/performances?tier=1,2&threshold=500`),
  ])

  // `w` is a per-type popularity weight used only as a ranking tie-breaker in
  // the in-app search (higher = more prominent): games played for players,
  // current Elo for teams, match count for leagues.
  const players = (playersRes.data ?? [])
    .filter((p) => Number.isFinite(p.steamId) && p.nickname)
    .map((p) => ({ t: 'player', id: p.steamId, n: String(p.nickname), w: Math.round(p.total) || 0 }))

  const teams = (ratingsRes.data ?? [])
    .filter((t) => Number.isFinite(t.valveId) && t.teamName)
    .map((t) => ({
      t: 'team',
      id: t.valveId,
      n: String(t.teamName),
      logo: t.logoId != null ? String(t.logoId) : undefined,
      r: t.region || undefined,
      w: Math.round(t.elo64?.current ?? t.elo32?.current ?? 0),
    }))

  const leagues = (leaguesRes.data ?? [])
    .filter((l) => Number.isFinite(l.leagueId) && l.name)
    .map((l) => ({
      t: 'league',
      id: l.leagueId,
      n: String(l.name),
      tier: l.tier?.name || undefined,
      ti: l.tier?.id ?? undefined, // 1 PREMIUM · 2 PROFESSIONAL · 3 SEMI_PRO · 4 AMATEUR
      w: Math.round(l.count) || 0,
    }))

  console.log(`  ${leagues.length} leagues`)
  console.log(`  ${teams.length} teams (rated)`)
  console.log(`  ${players.length} players (tier 1-2, ≥500 games)`)

  return { players, teams, leagues }
}

function buildSitemap({ players, teams, leagues }) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = []

  for (const route of STATIC_ROUTES) {
    const priority = route === '/' ? 1.0 : 0.7
    urls.push(urlEntry(route, today, priority))
  }
  for (const l of leagues) {
    urls.push(urlEntry(`/leagues/${l.id}`, null, 0.6))
  }
  for (const t of teams) {
    urls.push(urlEntry(`/teams/${t.id}`, null, 0.6))
  }
  for (const p of players) {
    urls.push(urlEntry(`/players/${p.id}`, null, 0.6))
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>\n'

  if (!fs.existsSync(path.dirname(SITEMAP_PATH))) {
    console.warn('dist/ not found — skipping sitemap.xml (run `npm run build` first).')
    return
  }
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8')
  const sizeKb = (fs.statSync(SITEMAP_PATH).size / 1024).toFixed(1)
  console.log(`Wrote ${urls.length} URLs to ${SITEMAP_PATH} (${sizeKb} KB)`)
}

function buildSearchIndex({ players, teams, leagues }) {
  // Amateur leagues (tier 4) are noise in search — exclude them (they remain in
  // the sitemap). Semi-pro leagues are kept but deprioritised at search time.
  const searchableLeagues = leagues.filter((l) => l.ti !== 4)
  const index = {
    generated: new Date().toISOString().slice(0, 10),
    entities: [...teams, ...players, ...searchableLeagues],
  }
  const json = JSON.stringify(index)
  const sizeKb = (Buffer.byteLength(json) / 1024).toFixed(1)

  // public/ copy: served by vite dev and copied into dist on the next build
  fs.writeFileSync(SEARCH_INDEX_PUBLIC_PATH, json, 'utf8')
  // dist/ copy: covers the current post-build deploy, since this script runs
  // after `vite build` has already emitted dist/
  if (fs.existsSync(path.dirname(SEARCH_INDEX_PATH))) {
    fs.writeFileSync(SEARCH_INDEX_PATH, json, 'utf8')
  }
  console.log(`Wrote ${index.entities.length} entities (${sizeKb} KB) to public/ and dist/`)
}

async function main() {
  const entities = await fetchEntities()
  buildSitemap(entities)
  buildSearchIndex(entities)
}

main().catch((err) => {
  console.error('Sitemap build failed:', err.message)
  process.exit(1)
})
