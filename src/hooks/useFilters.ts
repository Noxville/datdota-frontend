import { useSearchParams } from 'react-router-dom'
import { useCallback, useMemo, useEffect, useRef } from 'react'
import type { FilterValues } from '../types'
import { patches as staticPatches } from '../data/patches'

const FILTER_KEYS: (keyof FilterValues)[] = [
  'players',
  'teams',
  'heroes',
  'roles',
  'patch',
  'split-type',
  'after',
  'before',
  'durationGTE',
  'durationLTE',
  'leagues',
  'splits',
  'tier',
  'in-wins',
  'in-losses',
  'on-radiant',
  'on-dire',
  'threshold',
  'default',
]

/**
 * Build default filters client-side, matching FilterService.groovy.
 * `exclude` lets pages skip irrelevant defaults (e.g. frames-only fields).
 */
function buildDefaults(
  latestPatch: string | undefined,
  exclude?: (keyof FilterValues)[],
): FilterValues {
  const today = new Date().toISOString().slice(0, 10) // yyyy-MM-dd
  const defaults: FilterValues = {
    tier: '1,2',
    threshold: '1',
    after: '2010-01-01',
    before: today,
  }
  if (latestPatch) {
    defaults.patch = latestPatch
  }
  if (exclude) {
    for (const key of exclude) {
      delete defaults[key]
    }
  }
  return defaults
}

export function useFilters(excludeDefaults?: (keyof FilterValues)[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const latestPatch = staticPatches[0]?.name
  const didApplyDefaults = useRef(false)

  // When ?default=true is in the URL, replace it with the actual default values
  useEffect(() => {
    if (searchParams.get('default') === 'true' && !didApplyDefaults.current) {
      didApplyDefaults.current = true
      const defaults = buildDefaults(latestPatch, excludeDefaults)
      const next = new URLSearchParams()
      // Keep any explicit params that were alongside default=true (including fc)
      for (const [key, value] of searchParams.entries()) {
        if (key !== 'default') {
          next.set(key, value)
        }
      }
      // Fill in defaults for keys not already set
      for (const [key, value] of Object.entries(defaults)) {
        if (!next.has(key) && value) {
          next.set(key, value)
        }
      }
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, latestPatch, excludeDefaults, setSearchParams])

  const filters = useMemo(() => {
    const result: FilterValues = {}
    for (const key of FILTER_KEYS) {
      if (key === 'default') continue // never expose default=true to consumers
      const value = searchParams.get(key)
      if (value !== null) {
        result[key] = value
      }
    }
    return result
  }, [searchParams])

  const setFilters = useCallback(
    (next: FilterValues) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(next)) {
        if (key === 'default') continue
        if (value !== undefined && value !== '') {
          params.set(key, value)
        }
      }
      // Preserve fc (filter-collapsed) state across filter changes
      if (searchParams.get('fc')) {
        params.set('fc', searchParams.get('fc')!)
      }
      setSearchParams(params, { replace: true })
    },
    [setSearchParams, searchParams],
  )

  const updateFilter = useCallback(
    (key: keyof FilterValues, value: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('default')
          if (value === undefined || value === '') {
            next.delete(key)
          } else {
            next.set(key, value)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const applyDefaults = useCallback(() => {
    const defaults = buildDefaults(latestPatch, excludeDefaults)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(defaults)) {
      if (value) params.set(key, value)
    }
    if (searchParams.get('fc')) {
      params.set('fc', searchParams.get('fc')!)
    }
    setSearchParams(params, { replace: true })
  }, [latestPatch, excludeDefaults, setSearchParams, searchParams])

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams()
    // Preserve fc state when clearing filters
    if (searchParams.get('fc')) {
      params.set('fc', searchParams.get('fc')!)
    }
    setSearchParams(params, { replace: true })
  }, [setSearchParams, searchParams])

  // Filter-collapsed state: stored in URL as `fc=1` but never sent to API
  const filtersCollapsed = searchParams.get('fc') === '1'

  const setFiltersCollapsed = useCallback(
    (collapsed: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (collapsed) {
            next.set('fc', '1')
          } else {
            next.delete('fc')
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const apiParams = useMemo(() => {
    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') {
        params[key] = value
      }
    }
    return params
  }, [filters])

  const hasFilters = Object.keys(apiParams).length > 0

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    applyDefaults,
    apiParams,
    hasFilters,
    filtersCollapsed,
    setFiltersCollapsed,
  }
}
