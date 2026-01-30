'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Calendar, DollarSign, TrendingUp, Info } from 'lucide-react'
import { CompanyLogo } from '@/components/company-logo'
import { useDividendRadarProjections } from '@/hooks/use-dividend-radar'
import { DividendProjection } from '@/lib/dividend-radar-service'
import { cn } from '@/lib/utils'
import { BenChatFAB } from '@/components/ben-chat-fab'

interface Company {
  id: number
  ticker: string
  name: string
  sector: string | null
  logoUrl: string | null
  dividendRadarProjections: any
}

interface DividendRadarTickerPageContentProps {
  company: Company
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function DividendRadarTickerPageContent({
  company,
}: DividendRadarTickerPageContentProps) {
  const { data, isLoading, error } = useDividendRadarProjections(company.ticker)

  const projections = data?.projections || [] // Todas as projeções completas
  const historicalDividends = data?.historicalDividends || [] // Últimos 4 meses para visualização resumida
  const allHistoricalDividends = data?.allHistoricalDividends || [] // Histórico completo

  // Calcular meses a mostrar: 4 meses passados + mês atual + 6 meses futuros (total 11 meses)
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()

  const monthsToShow: Array<{ month: number; year: number; label: string; isCurrent: boolean }> = []
  
  // Adicionar 4 meses passados
  for (let i = 4; i >= 1; i--) {
    const date = new Date(currentYear, currentMonth - 1 - i, 1)
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    monthsToShow.push({
      month,
      year,
      label: `${MONTHS[month - 1]} ${year}`,
      isCurrent: false,
    })
  }
  
  // Adicionar mês atual (destacado)
  monthsToShow.push({
    month: currentMonth,
    year: currentYear,
    label: `${MONTHS[currentMonth - 1]} ${currentYear}`,
    isCurrent: true,
  })
  
  // Adicionar 6 meses futuros
  for (let i = 1; i <= 6; i++) {
    const date = new Date(currentYear, currentMonth - 1 + i, 1)
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    monthsToShow.push({
      month,
      year,
      label: `${MONTHS[month - 1]} ${year}`,
      isCurrent: false,
    })
  }

  // Criar mapas para acesso rápido
  const projectionsByMonth = new Map<string, DividendProjection[]>()
  projections.forEach((p) => {
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`
    if (!projectionsByMonth.has(key)) {
      projectionsByMonth.set(key, [])
    }
    projectionsByMonth.get(key)!.push(p)
  })

  const historicalByMonth = new Map<string, typeof historicalDividends>()
  historicalDividends.forEach((h) => {
    const key = `${h.year}-${String(h.month).padStart(2, '0')}`
    if (!historicalByMonth.has(key)) {
      historicalByMonth.set(key, [])
    }
    historicalByMonth.get(key)!.push(h)
  })

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/radar-dividendos">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Radar
          </Button>
        </Link>

        <div className="flex items-start gap-4">
          <CompanyLogo
            logoUrl={company.logoUrl}
            companyName={company.name}
            ticker={company.ticker}
            size={64}
          />
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">
              Radar de Dividendos - {company.ticker}
            </h1>
            <p className="text-lg text-muted-foreground mb-2">{company.name}</p>
            {company.sector && (
              <span className="inline-block px-3 py-1 bg-muted rounded-md text-sm">
                {company.sector}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          As projeções são baseadas em análise de padrões históricos usando inteligência artificial.
          Os valores e datas são estimativas e podem variar. Sempre consulte informações oficiais da empresa.
        </AlertDescription>
      </Alert>

      {/* Legenda */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <DollarSign className="w-3 h-3" />
              </div>
              <span className="text-muted-foreground">Confirmado (dividendo pago)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                <DollarSign className="w-3 h-3" />
              </div>
              <span className="text-muted-foreground">Projetado (estimativa)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Gerando projeções de dividendos...</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar projeções. Tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      )}

      {/* Projeções e Histórico */}
      {!isLoading && !error && (projections.length > 0 || historicalDividends.length > 0) && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Radar de Dividendos (4 meses passados + 6 meses futuros)
              </CardTitle>
              <CardDescription>
                Histórico de dividendos pagos e projeções baseadas em análise de padrões históricos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthsToShow.map(({ month, year, label, isCurrent }) => {
                  const monthKey = `${year}-${String(month).padStart(2, '0')}`
                  const monthProjections = projectionsByMonth.get(monthKey) || []
                  const monthHistorical = historicalByMonth.get(monthKey) || []
                  const isPast = !isCurrent && (year < currentYear || (year === currentYear && month < currentMonth))
                  const isFuture = year > currentYear || (year === currentYear && month > currentMonth)

                  // Se não tem histórico nem projeções, não mostrar
                  if (monthHistorical.length === 0 && monthProjections.length === 0) {
                    return null
                  }

                  return (
                    <div
                      key={monthKey}
                      className={cn(
                        "border rounded-lg p-4 hover:bg-muted/50 transition-colors",
                        isCurrent && "bg-primary/5 border-primary border-2"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {label}
                          </h3>
                          {isCurrent && (
                            <span className="px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded">
                              MÊS ATUAL
                            </span>
                          )}
                          {isPast && (
                            <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded">
                              HISTÓRICO
                            </span>
                          )}
                          {isFuture && (
                            <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded">
                              PROJEÇÃO
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {monthHistorical.length > 0 && `${monthHistorical.length} pago${monthHistorical.length > 1 ? 's' : ''}`}
                          {monthHistorical.length > 0 && monthProjections.length > 0 && ' • '}
                          {monthProjections.length > 0 && `${monthProjections.length} projetado${monthProjections.length > 1 ? 's' : ''}`}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {/* Histórico de dividendos pagos */}
                        {monthHistorical.map((h, idx) => (
                          <div
                            key={`hist-${idx}`}
                            className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                <DollarSign className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  Data Ex-Dividendo: {new Date(h.exDate).toLocaleDateString('pt-BR')}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Valor pago: R$ {h.amount.toFixed(4)} por ação
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                PAGO
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Projeções futuras */}
                        {monthProjections.map((p, idx) => (
                          <div
                            key={`proj-${idx}`}
                            className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                                <DollarSign className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  Data Ex-Dividendo: {new Date(p.projectedExDate).toLocaleDateString('pt-BR')}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Valor projetado: R$ {p.projectedAmount.toFixed(4)} por ação
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {p.confidence}% confiança
                                </span>
                              </div>
                              <div
                                className={cn(
                                  "mt-1 h-2 w-24 rounded-full",
                                  p.confidence >= 70
                                    ? 'bg-green-500'
                                    : p.confidence >= 40
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                )}
                                style={{ width: `${p.confidence}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Histórico Completo de Dividendos */}
          {allHistoricalDividends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Histórico Completo de Dividendos Pagos
                </CardTitle>
                <CardDescription>
                  Todos os dividendos pagos pela empresa ({allHistoricalDividends.length} pagamentos)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {allHistoricalDividends.map((h, idx) => (
                    <div
                      key={`all-hist-${idx}`}
                      className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {new Date(h.exDate).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Valor pago: R$ {h.amount.toFixed(4)} por ação
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          PAGO
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Todas as Projeções Completas */}
          {projections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Todas as Projeções de Dividendos
                </CardTitle>
                <CardDescription>
                  Projeções completas para os próximos meses baseadas em análise de padrões históricos ({projections.length} projeções)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {projections
                    .sort((a, b) => {
                      const dateA = new Date(a.projectedExDate)
                      const dateB = new Date(b.projectedExDate)
                      return dateA.getTime() - dateB.getTime()
                    })
                    .map((p, idx) => (
                      <div
                        key={`all-proj-${idx}`}
                        className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {MONTHS[p.month - 1]} {p.year} - {new Date(p.projectedExDate).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Valor projetado: R$ {p.projectedAmount.toFixed(4)} por ação
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {p.confidence}% confiança
                            </span>
                          </div>
                          <div
                            className={cn(
                              "mt-1 h-2 w-24 rounded-full",
                              p.confidence >= 70
                                ? 'bg-green-500'
                                : p.confidence >= 40
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            )}
                            style={{ width: `${p.confidence}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Link para página da ação */}
          <Card>
            <CardContent className="p-4">
              <Link href={`/acao/${company.ticker.toLowerCase()}`}>
                <Button variant="outline" className="w-full">
                  Ver Análise Completa de {company.ticker}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sem projeções nem histórico */}
      {!isLoading && !error && projections.length === 0 && historicalDividends.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Não há histórico de dividendos nem projeções disponíveis para {company.ticker} no momento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ben Chat FAB */}
      <BenChatFAB />
    </div>
  )
}

