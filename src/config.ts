export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? '' : 'https://api.datdota.com')

export const CDN_BASE = 'https://cdn.datdota.com'

export function heroImageUrl(heroKey: string, variant: 'full' | 'gray' = 'full'): string {
  return `${CDN_BASE}/images/heroes/${heroKey}_${variant}.png`
}

export function miniHeroImageUrl(heroKey: string): string {
  return `${CDN_BASE}/images/miniheroes/${heroKey}.png`
}

export function abilityImageUrl(abilityShortName: string): string {
  return `${CDN_BASE}/images/ability/${abilityShortName}.png`
}

export function itemImageUrl(itemShortName: string): string {
  // Strip "item_" prefix — CDN expects just the base name (e.g. "blink" not "item_blink")
  const name = itemShortName.replace(/^item_/, '')
  return `${CDN_BASE}/images/items/${name}.png`
}

export function leagueLogoUrl(leagueId: number, size: string = 'big'): string {
  return `${CDN_BASE}/images/leagues/${leagueId}_${size}.png`
}

export function teamLogoUrl(logoId: string | null): string {
  if (!logoId) return `${CDN_BASE}/images/unknown.png`
  return `${CDN_BASE}/images/${logoId}.png`
}

export function facetIconUrl(facetIcon: string): string {
  return `${CDN_BASE}/images/facets/${facetIcon}.png`
}

/** Bump this whenever the Terms of Service change materially — forces re-consent. */
export const TOS_VERSION = 1
