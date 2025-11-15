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
  const { data: session } = useSession()
  const router = useRouter()
  const isLoggedIn = !!session

  const [filters, setFilters] = useState<PLBolsaFiltersState>({
    startDate: '2001-01-01',
    endDate: new Date().toISOString().split('T')[0],
    sector: undefined,
    minScore: undefined,
    excludeUnprofitable: false,
  })

  // Usar React Query para cache e deduplicação
  const { data, isLoading, error } = useQuery({
    queryKey: ['pl-bolsa', filters, isLoggedIn],
    queryFn: () => fetchPLBolsaData(filters),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos (antes era cacheTime)
  })

  // Se não está logado e requer login, limitar data final ao ano anterior
  const currentYear = new Date().getFullYear()
  const lastYearEnd = new Date(currentYear - 1, 11, 31)
  const requiresLogin = data?.requiresLogin || (!isLoggedIn && filters.endDate && new Date(filters.endDate) > lastYearEnd)

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <PLBolsaFilters
        sectors={data?.sectors || initialSectors}
        onFiltersChange={setFilters}
        initialFilters={filters}
      />

      {/* CTA de Login/Cadastro para não logados */}
      {requiresLogin && !isLoggedIn && (
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Lock className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">
                  Acesse dados completos do ano atual
                </h3>
                <p className="text-muted-foreground mb-4">
                  Faça login ou cadastre-se gratuitamente para ver o P/L histórico completo da Bovespa,
                  incluindo dados do ano atual e análises avançadas.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link href={`/register?acquisition=P/L Histórico da Bovespa&callbackUrl=/pl-bolsa`}>
                      Criar conta gratuita
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/login?callbackUrl=/pl-bolsa`}>
                      Já tenho conta
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Mensagem informativa para não logados */}
      {requiresLogin && !isLoggedIn && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              📊 Dados exibidos até {lastYearEnd.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}. 
              {' '}Faça login para ver dados atualizados do ano atual.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

