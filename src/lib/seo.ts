/**
 * JSON-LD builders for structured data.
 *
 * Usage: pass the result(s) into <PageMeta jsonLd={...} />.
 * Multiple objects can be passed as an array.
 *
 * Schema reference: https://schema.org/
 */

import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '../components/PageMeta'

const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`

/* ── Site-wide ─────────────────────────────────────────── */

export function buildOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE,
    sameAs: [
      'https://x.com/datdota',
      'https://ko-fi.com/datdota',
    ],
  }
}

export function buildWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description:
      'Professional Dota 2 statistics — pro player, team, hero, league and tournament data.',
    publisher: { '@id': ORG_ID },
  }
}

/* ── Entity pages ──────────────────────────────────────── */

interface PersonInput {
  steamId: string | number
  nickname: string
  currentTeam?: { name: string } | null
  image?: string
}

export function buildPerson({ steamId, nickname, currentTeam, image }: PersonInput) {
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/players/${steamId}#person`,
    name: nickname,
    alternateName: nickname,
    url: `${SITE_URL}/players/${steamId}`,
    jobTitle: 'Professional Dota 2 Player',
  }
  if (image) obj.image = image
  if (currentTeam) {
    obj.memberOf = {
      '@type': 'SportsTeam',
      name: currentTeam.name,
      sport: 'Dota 2',
    }
  }
  return obj
}

interface SportsTeamInput {
  valveId: number
  name: string
  tag?: string
  logo?: string
}

export function buildSportsTeam({ valveId, name, tag, logo }: SportsTeamInput) {
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    '@id': `${SITE_URL}/teams/${valveId}#team`,
    name,
    url: `${SITE_URL}/teams/${valveId}`,
    sport: 'Dota 2',
  }
  if (tag) obj.alternateName = tag
  if (logo) obj.logo = logo
  return obj
}

interface SportsEventInput {
  leagueId: number
  name: string
  description?: string
  startDate?: string | null
  endDate?: string | null
  logo?: string
}

export function buildSportsEvent({
  leagueId,
  name,
  description,
  startDate,
  endDate,
  logo,
}: SportsEventInput) {
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': `${SITE_URL}/leagues/${leagueId}#event`,
    name,
    url: `${SITE_URL}/leagues/${leagueId}`,
    sport: 'Dota 2',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
  }
  if (description) obj.description = description
  if (startDate) obj.startDate = startDate.slice(0, 10)
  if (endDate) obj.endDate = endDate.slice(0, 10)
  if (logo) obj.image = logo
  return obj
}

/* ── Breadcrumbs ───────────────────────────────────────── */

export interface BreadcrumbItem {
  name: string
  /** Path relative to site root, e.g. "/players/123". Omit for the current page. */
  path?: string
}

export function buildBreadcrumbs(items: BreadcrumbItem[]) {
  const valid = items.filter((it) => typeof it.name === 'string' && it.name.trim() !== '')
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: valid.map((item, i) => {
      const el: Record<string, unknown> = {
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
      }
      if (item.path) el.item = `${SITE_URL}${item.path}`
      return el
    }),
  }
}
