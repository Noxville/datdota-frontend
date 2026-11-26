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

const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

const SITE_URL = 'https://datdota.com'
const API_BASE = 'https://api.datdota.com'
const USER_AGENT = process.env.DATDOTA_USER_AGENT || 'datdota-sitemap-builder/1.0'
const CDN_BASE = 'https://cdn.datdota.com'
const OG_IMAGE = `${SITE_URL}/og-default.png`
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
  '/trivia/player-hero-runs',
  '/trivia/caps',
  '/trivia/lineal-titles',
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
      'User-Agent': USER_AGENT,
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

/* ── Prerender (bake per-entity head tags into static HTML) ──────────────
 * These builders mirror src/lib/seo.ts and the entity <PageMeta> usage in
 * PlayerShow / TeamShow / LeagueShow. Keep them in sync until a shared module
 * is extracted (SEO phase 3). */

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function personLd(id, name) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/players/${id}#person`,
    name,
    alternateName: name,
    url: `${SITE_URL}/players/${id}`,
    jobTitle: 'Professional Dota 2 Player',
  }
}

function teamLd(id, name, logo) {
  const o = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    '@id': `${SITE_URL}/teams/${id}#team`,
    name,
    url: `${SITE_URL}/teams/${id}`,
    sport: 'Dota 2',
  }
  if (logo) o.logo = logo
  return o
}

// NOTE: we intentionally do NOT emit SportsEvent in the prerender. A valid
// Event needs a startDate, which the sitemap entity feed doesn't include, so a
// prerendered Event would always be invalid. LeagueShow (React) emits the valid
// Event with dates + VirtualLocation at render time; prerender ships breadcrumbs.

function breadcrumbsLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => {
      const el = { '@type': 'ListItem', position: i + 1, name: it.name }
      if (it.path) el.item = `${SITE_URL}${it.path}`
      return el
    }),
  }
}

// Minimal unique content baked into the prerendered <body> so crawlers see a
// real page (name + summary + internal links) without executing JS — this is
// what prevents the SPA "empty body → Soft 404". React (createRoot) replaces
// it on mount.
function bodyShell(name, lead, crumbHtml) {
  return (
    '<div style="max-width:900px;margin:0 auto;padding:40px 20px;font-family:system-ui,-apple-system,sans-serif;color:#e8e6f0">' +
    `<nav style="font-size:0.85rem;color:#8e8c9c;margin-bottom:16px">${crumbHtml}</nav>` +
    `<h1 style="font-size:2rem;font-weight:800;margin:0 0 12px">${escAttr(name)}</h1>` +
    `<p style="line-height:1.6;color:#c9c6d8;max-width:65ch">${escAttr(lead)}</p>` +
    '</div>'
  )
}

function headBlock({ title, description, canonical, ogType, jsonLd }) {
  const full = title.includes('datdota') ? title : `${title} | datdota`
  const lines = [
    `<title>${escAttr(full)}</title>`,
    `<meta name="description" content="${escAttr(description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:site_name" content="datdota" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:title" content="${escAttr(full)}" />`,
    `<meta property="og:description" content="${escAttr(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(full)}" />`,
    `<meta name="twitter:description" content="${escAttr(description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  ]
  for (const ld of jsonLd) {
    lines.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
  }
  return lines.join('\n    ')
}

function buildPrerender({ players, teams, leagues }) {
  const tplPath = path.join(__dirname, '../dist/index.html')
  if (!fs.existsSync(tplPath)) {
    console.warn('dist/index.html not found — skipping prerender (run `vite build` first).')
    return
  }
  const tpl = fs.readFileSync(tplPath, 'utf8')
  const START = '<!-- SEO:START -->'
  const END = '<!-- SEO:END -->'
  const i = tpl.indexOf(START)
  const j = tpl.indexOf(END)
  if (i < 0 || j < 0) {
    console.warn('SEO markers not found in dist/index.html — skipping prerender.')
    return
  }
  const pre = tpl.slice(0, i + START.length)
  const post = tpl.slice(j)
  const ROOT = '<div id="root"></div>'

  let count = 0
  const write = (routePath, block, body) => {
    let html = `${pre}\n    ${block}\n    ${post}`
    if (body) html = html.replace(ROOT, `<div id="root">${body}</div>`)
    const file = path.join(__dirname, '../dist', `${routePath}.html`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, html, 'utf8')
    count++
  }

  const crumb = (label, path) =>
    `<a href="/" style="color:#8e8c9c">datdota</a> › <a href="${path}" style="color:#8e8c9c">${label}</a>`

  for (const p of players) {
    const games = p.w ? p.w.toLocaleString() : ''
    write(`players/${p.id}`, headBlock({
      title: `${p.n} — Pro Dota 2 Player Stats`,
      description: `Match history, hero pool, signature heroes and team stints for pro Dota 2 player ${p.n}.${p.w ? ` ${p.w.toLocaleString()} tracked games.` : ''}`,
      canonical: `${SITE_URL}/players/${p.id}`,
      ogType: 'profile',
      jsonLd: [
        personLd(p.id, p.n),
        breadcrumbsLd([{ name: 'Home', path: '/' }, { name: 'Players', path: '/players/performances' }, { name: p.n }]),
      ],
    }), bodyShell(
      p.n,
      `${p.n} is a professional Dota 2 player tracked on datdota${games ? `, with ${games} recorded competitive games` : ''}. Explore their match history, hero pool, signature heroes, ratings and the teams they have played for.`,
      crumb('Players', '/players/performances'),
    ))
  }
  for (const t of teams) {
    write(`teams/${t.id}`, headBlock({
      title: `${t.n} — Pro Dota 2 Team Stats`,
      description: `Match history, roster, ratings and tournament results for pro Dota 2 team ${t.n}.`,
      canonical: `${SITE_URL}/teams/${t.id}`,
      ogType: 'website',
      jsonLd: [
        teamLd(t.id, t.n, t.logo ? `${CDN_BASE}/images/${t.logo}.png` : undefined),
        breadcrumbsLd([{ name: 'Home', path: '/' }, { name: 'Teams', path: '/teams/performances' }, { name: t.n }]),
      ],
    }), bodyShell(
      t.n,
      `${t.n} is a professional Dota 2 team tracked on datdota. See their current roster, match history, head-to-head records, tournament results and Elo/Glicko ratings.`,
      crumb('Teams', '/teams/performances'),
    ))
  }
  for (const l of leagues) {
    const matches = l.w ? l.w.toLocaleString() : ''
    write(`leagues/${l.id}`, headBlock({
      title: `${l.n} — Pro Dota 2 Tournament Stats`,
      description: `Match results, hero pick & ban data, and team performance for the ${l.n} Dota 2 tournament.${l.w ? ` ${l.w.toLocaleString()} matches.` : ''}`,
      canonical: `${SITE_URL}/leagues/${l.id}`,
      ogType: 'website',
      jsonLd: [
        breadcrumbsLd([{ name: 'Home', path: '/' }, { name: 'Leagues', path: '/leagues' }, { name: l.n }]),
      ],
    }), bodyShell(
      l.n,
      `${l.n} is a professional Dota 2 tournament tracked on datdota. Browse full match results, hero pick and ban statistics, and team performance${matches ? ` across ${matches} matches` : ''}.`,
      crumb('Tournaments', '/leagues'),
    ))
  }
  console.log(`Prerendered ${count} entity pages into dist/ (with body content)`)
}

async function main() {
  const entities = await fetchEntities()
  buildSitemap(entities)
  buildSearchIndex(entities)
  buildPrerender(entities)
}

main().catch((err) => {
  console.error('Sitemap build failed:', err.message)
  process.exit(1)
})
