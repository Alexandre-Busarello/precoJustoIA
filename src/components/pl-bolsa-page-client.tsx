'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PLBolsaChart } from '@/components/pl-bolsa-chart'
import {
  PLBolsaFilters,
  PLBolsaFiltersState,
} from '@/components/pl-bolsa-filters'

interface PLBolsaPageClientProps {
  initialSectors: string[]
}

interface PLBolsaAPIResponse {
  data: Array<{
    date: string
    pl: number
    averagePl: number
    companyCount: number
  }>
  statistics: {
    currentPL: number
    averagePL: number
    minPL: number
    maxPL: number
    lastUpdate: string
  }
  sectors: string[]
  filters: {
    startDate?: string
    endDate?: string
    sector?: string
    minScore?: number
    excludeUnprofitable?: boolean
  }
}

async function fetchPLBolsaData(
  filters: PLBolsaFiltersState
): Promise<PLBolsaAPIResponse> {
  const params = new URLSearchParams()

  if (filters.startDate) {
    params.append('startDate', filters.startDate)
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate)
  }
  if (filters.sector) {
    params.append('sector', filters.sector)
  }
  if (filters.minScore !== undefined) {
    params.append('minScore', filters.minScore.toString())
  }
  if (filters.excludeUnprofitable) {
    params.append('excludeUnprofitable', 'true')
  }

  const response = await fetch(`/api/pl-bolsa?${params.toString()}`)

  if (!response.ok) {
    throw new Error('Erro ao buscar dados do P/L histórico')
  }

  return response.json()
}

export function PLBolsaPageClient({
  initialSectors,
}: PLBolsaPageClientProps) {
  const [filters, setFilters] = useState<PLBolsaFiltersState>({
    startDate: '2001-01-01',
    endDate: new Date().toISOString().split('T')[0],
    sector: undefined,
    minScore: undefined,
    excludeUnprofitable: false,
  })

  // Usar React Query para cache e deduplicação
  const { data, isLoading, error } = useQuery({
    queryKey: ['pl-bolsa', filters],
    queryFn: () => fetchPLBolsaData(filters),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos (antes era cacheTime)
  })

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <PLBolsaFilters
        sectors={data?.sectors || initialSectors}
        onFiltersChange={setFilters}
        initialFilters={filters}
      />

      {/* Gráfico */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          Erro ao carregar dados: {error instanceof Error ? error.message : 'Erro desconhecido'}
        </div>
      )}

      <PLBolsaChart
        data={data?.data || []}
        statistics={data?.statistics}
        loading={isLoading}
      />
    </div>
  )
}

