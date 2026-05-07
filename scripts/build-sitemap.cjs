#!/usr/bin/env node

/**
 * Generates dist/sitemap.xml after `vite build`.
 *
 * Combines:
 *   - Hardcoded static routes (mirrored from src/router.tsx)
 *   - Players with >=500 games in tier 1-2 from /api/players/performances
 *   - Currently-rated teams from /api/ratings
 *   - All leagues from /api/leagues
 *
 * Excludes routes that are noindex, disallowed in robots.txt, or filter-dependent
 * (e.g. /matches/:id, /casters/*, /styleguide, /abilities/builds/matches).
 *
 * Usage: node scripts/build-sitemap.cjs
 */

const fs = require('fs')
const path = require('path')

const SITE_URL = 'https://datdota.com'
const API_BASE = 'https://api.datdota.com'
const OUTPUT_PATH = path.join(__dirname, '../dist/sitemap.xml')

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
  '/teams/unique-heroes',
  '/teams/towers',
  '/teams/throws',
  '/teams/comebacks',
  '/teams/map-control',
  '/teams/identity',
  // Matches (excluding /matches and /matches/:id — disallowed)
  '/matches/finder',
  '/matches/durations',
  '/matches/scorigami',
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
  '/trivia/best-runs',
  '/trivia/akke',
  '/trivia/maelk',
  '/trivia/cty',
  // Leagues
  '/leagues',
  '/leagues/pedigrees',
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

async function main() {
  console.log('Fetching entity lists from', API_BASE, '...')

  const [leaguesRes, ratingsRes, playersRes] = await Promise.all([
    fetchJson(`${API_BASE}/api/leagues`),
    fetchJson(`${API_BASE}/api/ratings`),
    fetchJson(`${API_BASE}/api/players/performances?tier=1,2&threshold=500`),
  ])

  const leagueIds = (leaguesRes.data ?? [])
    .map((l) => l.leagueId)
    .filter((id) => Number.isFinite(id))
  const teamIds = (ratingsRes.data ?? [])
    .map((t) => t.valveId)
    .filter((id) => Number.isFinite(id))
  const playerIds = (playersRes.data ?? [])
    .map((p) => p.steamId)
    .filter((id) => Number.isFinite(id))

  console.log(`  ${leagueIds.length} leagues`)
  console.log(`  ${teamIds.length} teams (rated)`)
  console.log(`  ${playerIds.length} players (tier 1-2, ≥500 games)`)

  const today = new Date().toISOString().slice(0, 10)

  const urls = []

  for (const route of STATIC_ROUTES) {
    const priority = route === '/' ? 1.0 : 0.7
    urls.push(urlEntry(route, today, priority))
  }
  for (const id of leagueIds) {
    urls.push(urlEntry(`/leagues/${id}`, null, 0.6))
  }
  for (const id of teamIds) {
    urls.push(urlEntry(`/teams/${id}`, null, 0.6))
  }
  for (const id of playerIds) {
    urls.push(urlEntry(`/players/${id}`, null, 0.6))
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>\n'

  const distDir = path.dirname(OUTPUT_PATH)
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist/ does not exist — run \`npm run build\` first.`)
  }

  fs.writeFileSync(OUTPUT_PATH, xml, 'utf8')
  const sizeKb = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)
  console.log(`Wrote ${urls.length} URLs to ${OUTPUT_PATH} (${sizeKb} KB)`)
}

main().catch((err) => {
  console.error('Sitemap build failed:', err.message)
  process.exit(1)
})
