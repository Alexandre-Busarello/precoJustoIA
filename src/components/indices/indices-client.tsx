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
  currentYield: number | null
  assetCount: number
  lastUpdate: string | null
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
    refetchOnWindowFocus: true, // Refetch quando a janela recebe foco
    refetchOnMount: true, // Refetch quando o componente monta
    staleTime: 30 * 1000, // 30 segundos (reduzido para atualizar mais rápido)
    initialData: initialIndices,
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {indices.map((index) => (
        <IndexCard
          key={index.id}
          ticker={index.ticker}
          name={index.name}
          color={index.color}
          currentPoints={index.currentPoints}
          accumulatedReturn={index.accumulatedReturn}
          currentYield={index.currentYield}
          assetCount={index.assetCount}
          sparklineData={[]} // Será preenchido quando tivermos histórico
        />
      ))}
    </div>
  )
}

