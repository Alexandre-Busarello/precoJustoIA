'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { PLBolsaChart, formatMonth } from '@/components/pl-bolsa-chart'
import { PLBolsaFilters, PL_BOLSA_START_DATE, type PLBolsaFiltersState } from '@/components/pl-bolsa-filters'
import { Button } from '@/components/ui/button'
import { Stat } from '@/components/ui/stat'
import { formatMultiple } from '@/lib/format'

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
  requiresLogin?: boolean
}

async function fetchPLBolsaData(filters: PLBolsaFiltersState): Promise<PLBolsaAPIResponse> {
  const params = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate })
  if (filters.sector) params.append('sector', filters.sector)
  if (filters.minScore !== undefined) params.append('minScore', filters.minScore.toString())

  const response = await fetch(`/api/pl-bolsa?${params.toString()}`)
  if (!response.ok) throw new Error('Não foi possível carregar o P/L histórico.')
  return response.json()
}

const today = () => new Date().toISOString().split('T')[0]

export function PLBolsaPageClient({ initialSectors }: PLBolsaPageClientProps) {
  const { data: session, status } = useSession()
  const isLoggedIn = !!(session?.user?.id || session?.user?.email)

  // Sem login, os dados vão só até o fim do ano anterior.
  const lastYear = new Date().getFullYear() - 1
  const maxEndDate = isLoggedIn ? today() : `${lastYear}-12-31`

  const [filters, setFilters] = useState<PLBolsaFiltersState>(() => ({
    startDate: PL_BOLSA_START_DATE,
    endDate: today(),
    sector: undefined,
    minScore: undefined,
  }))
  const effective: PLBolsaFiltersState = {
    ...filters,
    endDate: filters.endDate > maxEndDate ? maxEndDate : filters.endDate,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pl-bolsa', effective, isLoggedIn],
    queryFn: () => fetchPLBolsaData(effective),
    enabled: status !== 'loading',
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const stats = data?.statistics
  const hasData = !!data && data.data.length > 0

  return (
    <div className="space-y-6">
      <section aria-label="P/L histórico" className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-5">
        <PLBolsaFilters
          sectors={data?.sectors || initialSectors}
          maxEndDate={maxEndDate}
          value={effective}
          onChange={setFilters}
        />

        {stats && hasData && (
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            <Stat
              label="P/L atual"
              value={formatMultiple(stats.currentPL)}
              caption={stats.lastUpdate ? `Dado de ${formatMonth(stats.lastUpdate)}` : undefined}
            />
            <Stat label="Média do período" value={formatMultiple(stats.averagePL)} />
            <Stat label="Mínimo" value={formatMultiple(stats.minPL)} />
            <Stat label="Máximo" value={formatMultiple(stats.maxPL)} />
          </div>
        )}

        {error ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg bg-surface px-4 text-center sm:h-96">
            <p className="text-sm text-foreground">
              {error instanceof Error ? error.message : 'Não foi possível carregar o P/L histórico.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <PLBolsaChart data={data?.data || []} averagePL={hasData ? stats?.averagePL : undefined} loading={isLoading} />
        )}
      </section>

      {status !== 'loading' && !isLoggedIn && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Sem login, o gráfico vai até dezembro de {lastYear}. Crie uma conta gratuita para ver os meses de{' '}
            {lastYear + 1}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/register?acquisition=P/L Histórico da Bovespa&callbackUrl=/pl-bolsa">Criar conta grátis</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/login?callbackUrl=/pl-bolsa">Entrar</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
