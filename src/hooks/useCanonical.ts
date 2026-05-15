import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const CANONICAL_HOST = 'https://datdota.com'

/**
 * Mounts a <link rel="canonical"> in <head> pointing at the apex host + a
 * normalised path (query string and hash stripped by default). One instance
 * per route — replaces any existing canonical link on mount.
 *
 * Pass `path` to override (e.g. routes where a query param is the canonical
 * variant). Pass `null` to disable entirely on a specific page.
 */
export function useCanonical(path?: string | null) {
  const location = useLocation()
  const resolvedPath = path === undefined ? location.pathname : path

  useEffect(() => {
    if (resolvedPath === null) return

    const href = `${CANONICAL_HOST}${resolvedPath}`
    const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const link = existing ?? document.createElement('link')
    link.rel = 'canonical'
    link.href = href
    if (!existing) document.head.appendChild(link)

    return () => {
      // Only remove if we created it; leave any pre-existing tag alone.
      if (!existing) link.parentNode?.removeChild(link)
    }
  }, [resolvedPath])
}
