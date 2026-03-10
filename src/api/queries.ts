import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { apiFetch } from './client'

type QueryParams = Record<string, string | string[] | number | undefined>

export function useApiQuery<T>(
  path: string | null,
  params?: QueryParams,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>,
) {
  const paramString = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
        .join('&')
    : ''

  return useQuery<T>({
    queryKey: ['api', path, paramString],
    queryFn: () => apiFetch<T>(path!, params),
    enabled: path !== null,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}
