'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DividendRadarGrid } from '@/components/dividend-radar-grid'
import { DividendRadarControls } from '@/components/dividend-radar-controls'
import { useDividendRadarGrid } from '@/hooks/use-dividend-radar'
import { monthsAheadForPeriod } from '@/app/radar-dividendos/dividend-months'

interface DividendRadarPageContentProps {
  /** Estado de login conhecido no servidor (evita piscar o filtro "Só meus ativos" enquanto a sessão carrega). */
  isLoggedIn?: boolean
}

/** Ferramenta do radar de dividendos: filtros, calendário de proventos e aviso sobre as estimativas. */
export function DividendRadarPageContent({ isLoggedIn: initialIsLoggedIn = false }: DividendRadarPageContentProps) {
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('')
  const [period, setPeriod] = useState('12')
  const [myAssets, setMyAssets] = useState(false)
  const [oneTickerPerStock, setOneTickerPerStock] = useState(false)
  const [sectors, setSectors] = useState<string[]>([])
  const { status } = useSession()
  const isLoggedIn = status === 'loading' ? initialIsLoggedIn : status === 'authenticated'

  useEffect(() => {
    async function fetchSectors() {
      try {
        const response = await fetch('/api/sectors-industries')
        if (response.ok) {
          const data = await response.json()
          const validSectors = (data.sectors || []).filter((s: string) => s && s.trim() !== '')
          setSectors(validSectors)
        }
      } catch (error) {
        console.error('Erro ao buscar setores:', error)
      }
    }
    fetchSectors()
  }, [])

  // As datas do radar são sempre a data ex (a data de pagamento não está disponível na base)
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useDividendRadarGrid({
    search,
    sector,
    period,
    myAssets: isLoggedIn && myAssets,
    dateType: 'exDate',
    oneTickerPerStock,
    limit: 20,
  })

  const allCompanies = data?.pages.flatMap((page) => page.companies) || []

  return (
    <div className="space-y-6">
      <DividendRadarControls
        search={search}
        onSearchChange={setSearch}
        sector={sector}
        onSectorChange={setSector}
        period={period}
        onPeriodChange={setPeriod}
        myAssets={myAssets}
        onMyAssetsChange={setMyAssets}
        oneTickerPerStock={oneTickerPerStock}
        onOneTickerPerStockChange={setOneTickerPerStock}
        sectors={sectors}
        isLoggedIn={isLoggedIn}
      />

      <div id="grid">
        {error ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Não foi possível carregar o radar de dividendos.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !isLoading && allCompanies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">Nenhuma empresa encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {myAssets && isLoggedIn ? 'Nenhum dos seus ativos tem proventos no período.' : 'Ajuste a busca ou os filtros.'}
            </p>
          </div>
        ) : (
          <>
            <DividendRadarGrid companies={allCompanies} loading={isLoading} monthsAhead={monthsAheadForPeriod(period)} />
            {hasNextPage && (
              <div className="mt-4 text-center">
                <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} variant="outline">
                  {isFetchingNextPage && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                  {isFetchingNextPage ? 'Carregando…' : 'Carregar mais empresas'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          As projeções são estimativas geradas por IA a partir do histórico de proventos; valores e datas podem mudar ou não se
          confirmar. Confira sempre os comunicados oficiais das empresas. Não é recomendação de investimento.
        </span>
      </p>
    </div>
  )
}
