'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface RadarConfig {
  tickers: string[]
  createdAt: string | null
  updatedAt: string | null
}

interface RadarDataResponse {
  data: any[]
  count: number
}

/**
 * Hook para gerenciar estado do radar do usuário
 */
export function useRadar() {
  const queryClient = useQueryClient()

  // Buscar radar salvo
  const {
    data: radarConfig,
    isLoading: loadingConfig,
    error: configError,
  } = useQuery<RadarConfig>({
    queryKey: ['radar-config'],
    queryFn: async () => {
      const response = await fetch('/api/radar')
      if (!response.ok) {
        throw new Error('Erro ao buscar radar')
      }
      return response.json()
    },
  })

  // Salvar radar
  const saveMutation = useMutation({
    mutationFn: async (tickers: string[]) => {
      const response = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar radar')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-config'] })
      queryClient.invalidateQueries({ queryKey: ['radar-data'] })
    },
  })

  // Buscar dados dos tickers
  const {
    data: radarData,
    isLoading: loadingData,
    error: dataError,
  } = useQuery<RadarDataResponse>({
    queryKey: ['radar-data', radarConfig?.tickers],
    queryFn: async () => {
      if (!radarConfig?.tickers || radarConfig.tickers.length === 0) {
        return { data: [], count: 0 }
      }

      const response = await fetch('/api/radar/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: radarConfig.tickers }),
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar dados do radar')
      }

      return response.json()
    },
    enabled: !!radarConfig && radarConfig.tickers.length > 0,
  })

  return {
    radarConfig,
    radarData: radarData?.data || [],
    loadingConfig,
    loadingData,
    configError,
    dataError,
    saveRadar: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  }
}

