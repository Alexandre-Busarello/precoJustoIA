'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, DollarSign, Calendar, ArrowRight, Info } from 'lucide-react'
import { useDividendRadarProjections } from '@/hooks/use-dividend-radar'
import { DividendProjection } from '@/lib/dividend-radar-service'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DividendRadarCompactProps {
  ticker: string
  companyName: string
}

const MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export function DividendRadarCompact({ ticker, companyName }: DividendRadarCompactProps) {
  const { data, isLoading, error } = useDividendRadarProjections(ticker)

  const projections = data?.projections || []
  const historicalDividends = data?.historicalDividends || []

  // Calcular meses a mostrar: 4 meses passados + mês atual + 6 meses futuros
  const now = new Date()
  const currentMonth = now.getMonth() + 1
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
  
  // Adicionar mês atual
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

  // Criar mapas
  const projectionMap = new Map<string, DividendProjection[]>()
  projections.forEach((p) => {
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`
    if (!projectionMap.has(key)) {
      projectionMap.set(key, [])
    }
    projectionMap.get(key)!.push(p)
  })

  const historicalMap = new Map<string, typeof historicalDividends>()
  historicalDividends.forEach((h) => {
    const key = `${h.year}-${String(h.month).padStart(2, '0')}`
    if (!historicalMap.has(key)) {
      historicalMap.set(key, [])
    }
    historicalMap.get(key)!.push(h)
  })

  const hasData = projections.length > 0 || historicalDividends.length > 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Radar de Dividendos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !hasData) {
    return null // Não mostrar se não houver dados
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Radar de Dividendos
          </CardTitle>
          <Link href={`/radar-dividendos/${ticker.toLowerCase()}`}>
            <Button variant="ghost" size="sm" className="text-xs">
              Ver completo
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="space-y-4">
            {/* Legenda */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Confirmado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Projetado</span>
              </div>
            </div>

            {/* Grid de meses */}
            <div className="grid grid-cols-6 md:grid-cols-11 gap-2">
              {monthsToShow.map(({ month, year, label, isCurrent }) => {
                const key = `${year}-${String(month).padStart(2, '0')}`
                const monthProjections = projectionMap.get(key) || []
                const monthHistorical = historicalMap.get(key) || []
                const hasProjection = monthProjections.length > 0
                const hasHistorical = monthHistorical.length > 0

                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "p-2 rounded border text-center cursor-help transition-colors",
                          isCurrent && "bg-primary/10 border-primary border-2",
                          hasHistorical && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                          hasProjection && !hasHistorical && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                          !hasProjection && !hasHistorical && "bg-muted/50 border-muted"
                        )}
                      >
                        <div className={cn(
                          "text-xs font-medium mb-1",
                          isCurrent ? "text-primary font-bold" : "text-muted-foreground"
                        )}>
                          {label.split(' ')[0]}
                        </div>
                        {hasHistorical ? (
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white mx-auto">
                            <DollarSign className="w-3 h-3" />
                          </div>
                        ) : hasProjection ? (
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white mx-auto">
                            <DollarSign className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 mx-auto" />
                        )}
                        {(hasHistorical || hasProjection) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {hasHistorical && monthHistorical[0] && (
                              <div>R$ {monthHistorical[0].amount.toFixed(2)}</div>
                            )}
                            {hasProjection && monthProjections[0] && (
                              <div>R$ {monthProjections[0].projectedAmount.toFixed(2)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-semibold">{MONTHS[month - 1]} {year}</p>
                        {hasHistorical && monthHistorical.map((h, idx) => (
                          <div key={idx} className="text-sm">
                            <p>Pago: R$ {h.amount.toFixed(4)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(h.exDate).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        ))}
                        {hasProjection && monthProjections.map((p, idx) => (
                          <div key={idx} className="text-sm">
                            <p>Projetado: R$ {p.projectedAmount.toFixed(4)}</p>
                            <p className="text-xs text-muted-foreground">
                              Confiança: {p.confidence}%
                            </p>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>

            {/* Link para ver completo */}
            <div className="pt-2 border-t">
              <Link href={`/radar-dividendos/${ticker.toLowerCase()}`}>
                <Button variant="outline" className="w-full" size="sm">
                  Ver análise completa do Radar de Dividendos
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}

