'use client'

import { IndexCard } from '@/components/indices/index-card'
import { useQuery } from '@tanstack/react-query'

interface IndexData {
  id: string
  ticker: string
  name: string
  description: string
  color: string
  currentPoints: number
  accumulatedReturn: number
  dailyChange: number | null
  currentYield: number | null
  assetCount: number
  lastUpdate: string | null
  sparklineData?: Array<{ date: string; points: number }>
}

async function fetchIndices(): Promise<IndexData[]> {
  const response = await fetch('/api/indices')
  if (!response.ok) {
    throw new Error('Erro ao buscar índices')
  }
  const data = await response.json()
  return data.indices || []
}

interface IndicesClientProps {
  initialIndices: IndexData[]
}

export function IndicesClient({ initialIndices }: IndicesClientProps) {
  const { data: indices = initialIndices } = useQuery<IndexData[]>({
    queryKey: ['indices'],
    queryFn: fetchIndices,
    refetchOnWindowFocus: false, // Não refetch quando a janela recebe foco
    refetchOnMount: false, // Não refetch quando o componente monta - usar dados iniciais
    staleTime: Infinity, // Dados nunca ficam stale - requer reload da página para atualizar
    initialData: initialIndices,
  })

  // Ordenar por retorno acumulado (maior primeiro) - garantir ordenação mesmo se vier da API
  const sortedIndices = [...(indices || [])].sort(
    (a, b) => b.accumulatedReturn - a.accumulatedReturn
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sortedIndices.map((index) => (
        <IndexCard
          key={index.id}
          ticker={index.ticker}
          name={index.name}
          color={index.color}
          currentPoints={index.currentPoints}
          accumulatedReturn={index.accumulatedReturn}
          dailyChange={index.dailyChange}
          currentYield={index.currentYield}
          assetCount={index.assetCount}
          sparklineData={index.sparklineData || []}
        />
      ))}
    </div>
  )
}

