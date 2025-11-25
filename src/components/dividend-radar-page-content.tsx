'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, Info, DollarSign, TrendingUp, Target, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DividendRadarGrid } from '@/components/dividend-radar-grid'
import { DividendRadarControls } from '@/components/dividend-radar-controls'
import { useDividendRadarGrid } from '@/hooks/use-dividend-radar'

interface DividendRadarPageContentProps {
  isLoggedIn?: boolean
}

export function DividendRadarPageContent({ isLoggedIn: initialIsLoggedIn = false }: DividendRadarPageContentProps) {
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('')
  const [period, setPeriod] = useState('12')
  const [myAssets, setMyAssets] = useState(false)
  // Sempre usar exDate pois paymentDate não está disponível (sempre NULL no banco)
  const [dateType] = useState<'exDate' | 'paymentDate'>('exDate')
  const [oneTickerPerStock, setOneTickerPerStock] = useState(false)
  const [sectors, setSectors] = useState<string[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn)

  // Buscar setores disponíveis
  useEffect(() => {
    async function fetchSectors() {
      try {
        const response = await fetch('/api/sectors-industries')
        if (response.ok) {
          const data = await response.json()
          // Filtrar valores vazios, nulos ou undefined
          const validSectors = (data.sectors || []).filter(
            (s: string) => s && s.trim() !== ''
          )
          setSectors(validSectors)
        }
      } catch (error) {
        console.error('Erro ao buscar setores:', error)
      }
    }
    fetchSectors()
  }, [])

  // Verificar se está logado (verificar se há sessão)
  useEffect(() => {
    async function checkAuth() {
      try {
        // Tentar buscar dados do usuário
        const response = await fetch('/api/user/me')
        setIsLoggedIn(response.ok)
      } catch {
        setIsLoggedIn(false)
      }
    }
    checkAuth()
  }, [])

  // Buscar dados do grid com infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDividendRadarGrid({
    search,
    sector,
    period,
    myAssets: isLoggedIn && myAssets,
    dateType,
    oneTickerPerStock,
    limit: 20,
  })

  // Combinar todas as páginas
  const allCompanies = data?.pages.flatMap((page) => page.companies) || []

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 bg-primary/10 dark:bg-primary/20 rounded-xl shrink-0">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                Radar de Dividendos Inteligente
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                O Radar de Dividendos Inteligente (RDI) utiliza inteligência artificial preditiva para analisar o histórico de proventos das empresas e projetar futuros anúncios ou datas de pagamento de dividendos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SEO Content Section - Apenas para usuários não logados, discreto */}
      {!isLoggedIn && (
        <div className="mb-6">
          {/* Texto SEO discreto abaixo do header */}
          <div className="text-sm text-muted-foreground leading-relaxed mb-4 space-y-2">
            <p>
              Encontre <strong>empresas pagando altos dividendos</strong> na B3 e descubra <strong>como ganhar dinheiro com dividendos</strong> de forma consistente. 
              Nossa ferramenta gratuita utiliza inteligência artificial para projetar dividendos dos próximos meses, ajudando você a identificar as <strong>melhores ações para dividendos</strong> e construir uma carteira focada em <strong>renda passiva</strong>.
            </p>
            <p className="text-xs">
              Use os filtros abaixo para encontrar ações com <strong>maior dividend yield</strong> ou explore empresas por setor. 
              Todas as projeções são baseadas em análise de padrões históricos e podem variar.
            </p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <Alert className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          As projeções são baseadas em análise de padrões históricos usando inteligência artificial. 
          Os valores e datas são estimativas e podem variar. Sempre consulte informações oficiais das empresas.
        </AlertDescription>
      </Alert>

      {/* Controles */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <DividendRadarControls
            search={search}
            onSearchChange={setSearch}
            sector={sector}
            onSectorChange={setSector}
            period={period}
            onPeriodChange={setPeriod}
            myAssets={myAssets}
            onMyAssetsChange={setMyAssets}
            dateType={dateType}
            oneTickerPerStock={oneTickerPerStock}
            onOneTickerPerStockChange={setOneTickerPerStock}
            sectors={sectors}
            isLoggedIn={isLoggedIn}
          />
        </CardContent>
      </Card>

      {/* Grid */}
      <div id="grid">
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando projeções de dividendos...</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar dados. Tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      ) : allCompanies.length > 0 ? (
        <>
          <DividendRadarGrid
            companies={allCompanies}
            dateType={dateType}
            loading={isLoading}
          />
          {hasNextPage && (
            <div className="mt-6 text-center">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="outline"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  'Carregar Mais Empresas'
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Nenhuma empresa encontrada com projeções de dividendos para os filtros selecionados.
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  )
}

