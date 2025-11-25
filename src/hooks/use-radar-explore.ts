'use client'

import { useQuery } from '@tanstack/react-query'

interface ExploreDataResponse {
  data: any[]
  count: number
  cached?: boolean
  timestamp?: string
}

/**
 * Hook para buscar lista "Explorar" de oportunidades
 * Cache de 24 horas no frontend
 */
export function useRadarExplore() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<ExploreDataResponse>({
    queryKey: ['radar-explore'],
    queryFn: async () => {
      const response = await fetch('/api/radar/explore')
      if (!response.ok) {
        throw new Error('Erro ao buscar oportunidades')
      }
      return response.json()
    },
    staleTime: 24 * 60 * 60 * 1000, // Cache de 24 horas
    gcTime: 24 * 60 * 60 * 1000, // Manter no cache por 24 horas
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  return {
    data: data?.data || [],
    count: data?.count || 0,
    isLoading,
    error,
    refetch,
    cached: data?.cached || false,
    timestamp: data?.timestamp,
  }
}

