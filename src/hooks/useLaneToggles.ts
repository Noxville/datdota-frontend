import { useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const LANE_KEYS = ['MID', 'SAFE', 'OFFLANE'] as const

export { LANE_KEYS }

export function useLaneToggles() {
  const location = useLocation()
  const navigate = useNavigate()

  const visible = useMemo(() => {
    const hash = location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    const lanes = params.get('lanes')
    if (!lanes) return new Set(LANE_KEYS as readonly string[])
    return new Set(lanes.split(',').filter(Boolean))
  }, [location.hash])

  const toggle = useCallback((key: string) => {
    const hash = location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    const current = new Set(visible)
    if (current.has(key)) {
      current.delete(key)
      if (current.size === 0) return
    } else {
      current.add(key)
    }
    if (current.size === LANE_KEYS.length) {
      params.delete('lanes')
    } else {
      params.set('lanes', Array.from(current).join(','))
    }
    const newHash = params.toString()
    navigate(
      `${location.pathname}${location.search}${newHash ? `#${newHash}` : ''}`,
      { replace: true },
    )
  }, [location.pathname, location.hash, location.search, navigate, visible])

  return { visible, toggle }
}
