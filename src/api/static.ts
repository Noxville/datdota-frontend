import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export interface HeroData {
  [id: string]: {
    name: string
    picture: string
  }
}

export interface PatchData {
  name: string
  id: number
}

export function useStaticHeroes() {
  return useQuery<HeroData>({
    queryKey: ['static', 'heroes'],
    queryFn: async () => {
      const res = await apiFetch<{ data: HeroData }>('/api/static/heroes')
      return res.data
    },
    staleTime: Infinity,
  })
}

export function useStaticPatches() {
  return useQuery<PatchData[]>({
    queryKey: ['static', 'patches'],
    queryFn: async () => {
      const res = await apiFetch<{ data: PatchData[] }>('/api/static/patches')
      return res.data
    },
    staleTime: Infinity,
  })
}

export function useStaticAbilities() {
  return useQuery({
    queryKey: ['static', 'abilities'],
    queryFn: () => apiFetch('/api/static/abilities'),
    staleTime: Infinity,
  })
}

export function useStaticItems() {
  return useQuery({
    queryKey: ['static', 'items'],
    queryFn: () => apiFetch('/api/static/items'),
    staleTime: Infinity,
  })
}
