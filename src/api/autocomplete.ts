import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

interface AutocompletePlayer {
  name: string
  steam_id: number
  team: string
}

interface AutocompleteTeam {
  name: string
  team_id: number
  tag: string
}

interface AutocompleteLeague {
  name: string
  league_id: number
  tier: number
}

interface AutocompleteItem {
  name: string
  item_id: number
}

interface AutocompleteSplit {
  split_id: number
  name: string
}

function useAutocomplete<T>(endpoint: string, query: string, key: string) {
  return useQuery<T[]>({
    queryKey: ['autocomplete', endpoint, query],
    queryFn: async () => {
      const result = await apiFetch<{ data: Record<string, T[]> }>(
        `/api/autocomplete/${endpoint}`,
        { q: query },
      )
      return result.data[key] ?? []
    },
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  })
}

export function usePlayerAutocomplete(query: string) {
  return useAutocomplete<AutocompletePlayer>('players', query, 'players')
}

export function useTeamAutocomplete(query: string) {
  return useAutocomplete<AutocompleteTeam>('teams', query, 'teams')
}

export function useLeagueAutocomplete(query: string) {
  return useAutocomplete<AutocompleteLeague>('leagues', query, 'leagues')
}

export function useItemAutocomplete(query: string) {
  return useAutocomplete<AutocompleteItem>('items', query, 'items')
}

export function useSplitAutocomplete(query: string) {
  return useAutocomplete<AutocompleteSplit>('splits', query, 'splits')
}

export type {
  AutocompletePlayer,
  AutocompleteTeam,
  AutocompleteLeague,
  AutocompleteItem,
  AutocompleteSplit,
}
