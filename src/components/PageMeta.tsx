import { useLocation } from 'react-router-dom'

export const SITE_URL = 'https://datdota.com'
export const SITE_NAME = 'datdota'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`
export const DEFAULT_DESCRIPTION =
  'Professional Dota 2 statistics — pro player, team, hero, league and tournament data, draft analysis, win expectancy and more.'

interface Props {
  title: string
  description?: string
  /** Override canonical path. Defaults to the current pathname (no query string). */
  canonicalPath?: string
  /** Absolute URL for og:image. Defaults to DEFAULT_OG_IMAGE. */
  image?: string
  /** Type of structured content; influences og:type. */
  type?: 'website' | 'article' | 'profile'
  /** When true, sets robots noindex,nofollow. Use for 404, search results, internal pages. */
  noindex?: boolean
  /** Optional JSON-LD object(s) — rendered as <script type="application/ld+json">. */
  jsonLd?: object | object[]
}

export default function PageMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  noindex = false,
  jsonLd,
}: Props) {
  const location = useLocation()
  const path = canonicalPath ?? location.pathname
  const canonical = `${SITE_URL}${path}`
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`

  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {ldArray.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
    </>
  )
}
