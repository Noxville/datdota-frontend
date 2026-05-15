import { useEffect } from 'react'

/**
 * Imperatively adds <meta name="robots" content="noindex, nofollow"> to <head>
 * while `enabled` is true. Used on entity-show pages when the underlying entity
 * doesn't exist (e.g. /players/{nonexistent-id}) so Google drops the URL from
 * its index instead of treating the SPA's 200 response as a soft 404.
 */
export function useNoIndex(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      meta.parentNode?.removeChild(meta)
    }
  }, [enabled])
}
