import { API_BASE_URL } from '../config'

export class ApiError extends Error {
  status: number
  statusText: string

  constructor(status: number, statusText: string, message?: string) {
    super(message ?? `API error: ${status} ${statusText}`)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
  }
}

/** True only for a definitive "does not exist" response (404/410). Transient
 * failures — network errors, 5xx, 429, Cloudflare challenges — return false, so
 * callers never treat a blocked/failed fetch as a missing entity. */
export function isNotFoundError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 410)
}

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | string[] | number | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(','))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url.toString(), {
    credentials: 'same-origin',
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new ApiError(response.status, response.statusText, body || undefined)
  }

  return response.json()
}
