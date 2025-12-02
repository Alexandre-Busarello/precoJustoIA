'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { PLBolsaChart } from '@/components/pl-bolsa-chart'
import {
  PLBolsaFilters,
  PLBolsaFiltersState,
} from '@/components/pl-bolsa-filters'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, ArrowRight, Check } from 'lucide-react'

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
  requiresLogin?: boolean
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
  const isLoggedIn = !!(session?.user?.id || session?.user?.email)

  const [filters, setFilters] = useState<PLBolsaFiltersState>({
    startDate: '2010-01-01',
    endDate: new Date().toISOString().split('T')[0],
    sector: undefined,
    minScore: undefined,
  })

  // Atualizar endDate quando usuário fizer login
  useEffect(() => {
    if (isLoggedIn) {
      const today = new Date().toISOString().split('T')[0]
      const currentYear = new Date().getFullYear()
      const lastYearEnd = new Date(currentYear - 1, 11, 31).toISOString().split('T')[0]
      
      // Se a data final está limitada ao ano anterior, atualizar para hoje
      setFilters(prev => {
        if (prev.endDate <= lastYearEnd) {
          return {
            ...prev,
            endDate: today
          }
        }
        return prev
      })
    }
  }, [isLoggedIn]) // Executar apenas quando isLoggedIn mudar

  // Usar React Query para cache e deduplicação
  const { data, isLoading, error } = useQuery({
    queryKey: ['pl-bolsa', filters, isLoggedIn],
    queryFn: () => fetchPLBolsaData(filters),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos (antes era cacheTime)
  })

  // Calcular data limite para não logados
  const currentYear = new Date().getFullYear()
  const lastYearEnd = new Date(currentYear - 1, 11, 31)

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <PLBolsaFilters
        sectors={data?.sectors || initialSectors}
        onFiltersChange={setFilters}
        initialFilters={filters}
      />

      {/* CTA de Login/Cadastro para não logados - ANTES do gráfico */}
      {!isLoggedIn && (
        <Card className="border-2 border-indigo-300 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full -translate-y-32 translate-x-32"></div>
          
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Lock className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    🔒 Desbloqueie dados completos de 2025
                  </h3>
                  <Badge variant="secondary" className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                    Grátis
                  </Badge>
                </div>
                <p className="text-slate-700 dark:text-slate-300 mb-4 text-base leading-relaxed">
                  Você está visualizando dados até <strong>dezembro de 2024</strong>. 
                  Faça login ou cadastre-se gratuitamente para acessar dados atualizados de <strong>2025</strong> e análises completas do P/L histórico da Bovespa.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-md">
                    <Link href={`/register?acquisition=P/L Histórico da Bovespa&callbackUrl=/pl-bolsa`}>
                      Criar conta gratuita
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild className="border-2">
                    <Link href={`/login?callbackUrl=/pl-bolsa`}>
                      Já tenho conta
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-indigo-600" />
                    Cadastro em 30 segundos
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-indigo-600" />
                    Sem cartão de crédito
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-indigo-600" />
                    Dados completos de 2025
                  </span>
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

      {/* Mensagem informativa para não logados - DEPOIS do gráfico */}
      {!isLoggedIn && (
        <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700">
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              📊 <strong>Dados exibidos até {lastYearEnd.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}.</strong> 
              {' '}Faça login ou cadastre-se gratuitamente para ver dados atualizados de 2025.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

