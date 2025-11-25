'use client'

import Link from 'next/link'
import { CompanyLogo } from '@/components/company-logo'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DollarSign } from 'lucide-react'
import { DividendProjection } from '@/lib/dividend-radar-service'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HistoricalDividend {
  month: number
  year: number
  exDate: Date
  amount: number
}

interface GridCompany {
  ticker: string
  name: string
  sector: string | null
  logoUrl: string | null
  projections: DividendProjection[]
  historicalDividends?: HistoricalDividend[]
}

interface DividendRadarGridProps {
  companies: GridCompany[]
  loading?: boolean
  dateType?: 'exDate' | 'paymentDate'
  className?: string
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

export function DividendRadarGrid({
  companies,
  loading,
  dateType = 'exDate',
  className,
}: DividendRadarGridProps) {
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhuma empresa encontrada com projeções de dividendos.
          </p>
        </CardContent>
      </Card>
    )
  }

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

  return (
    <TooltipProvider>
      <div className={cn('w-full overflow-x-auto', className)}>
        {/* Legenda */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
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
        
        {/* Desktop: Tabela */}
        <div className="hidden md:block">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground sticky left-0 bg-background z-10">
                    Empresa
                  </th>
                  {monthsToShow.map(({ month, year, label, isCurrent }) => (
                    <th
                      key={`${year}-${month}`}
                      className={cn(
                        "text-center p-3 text-xs font-medium min-w-[80px]",
                        isCurrent 
                          ? "bg-primary/10 text-primary font-bold border-l-2 border-r-2 border-primary" 
                          : "text-muted-foreground"
                      )}
                    >
                      {label.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  // Criar mapa de projeções futuras por mês/ano
                  const projectionMap = new Map<string, DividendProjection>()
                  if (company.projections && Array.isArray(company.projections)) {
                    company.projections.forEach((p) => {
                      const key = `${p.year}-${p.month}`
                      projectionMap.set(key, p)
                    })
                  }
                  
                  // Criar mapa de dividendos históricos pagos por mês/ano
                  const historicalMap = new Map<string, HistoricalDividend>()
                  if (company.historicalDividends && Array.isArray(company.historicalDividends)) {
                    company.historicalDividends.forEach((h) => {
                      const key = `${h.year}-${h.month}`
                      historicalMap.set(key, h)
                    })
                  }

                  return (
                    <tr
                      key={company.ticker}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      {/* Coluna Empresa */}
                      <td className="p-3 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-3">
                          <CompanyLogo
                            logoUrl={company.logoUrl}
                            companyName={company.name}
                            ticker={company.ticker}
                            size={40}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/radar-dividendos/${company.ticker.toLowerCase()}`}
                                className="font-bold text-sm hover:text-primary transition-colors"
                              >
                                {company.ticker}
                              </Link>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {company.name}
                            </div>
                            <Link
                              href={`/acao/${company.ticker.toLowerCase()}`}
                              className="text-xs text-primary hover:underline mt-1 inline-block"
                            >
                              Ver análise completa
                            </Link>
                          </div>
                        </div>
                      </td>

                      {/* Colunas de meses */}
                      {monthsToShow.map(({ month, year, isCurrent }) => {
                        const key = `${year}-${month}`
                        const projection = projectionMap.get(key)
                        const historical = historicalMap.get(key)
                        const isPast = !isCurrent && (year < currentYear || (year === currentYear && month < currentMonth))
                        const isFuture = year > currentYear || (year === currentYear && month > currentMonth)

                        return (
                          <td
                            key={key}
                            className={cn(
                              "p-3 text-center",
                              isCurrent && "bg-primary/5 border-l-2 border-r-2 border-primary"
                            )}
                          >
                            {historical ? (
                              // Dividendo histórico pago (mês passado)
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-help">
                                      <DollarSign className="w-4 h-4" />
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">
                                      {MONTHS[month - 1]} {year} (Pago)
                                    </p>
                                    <p>
                                      Data Ex: {new Date(historical.exDate).toLocaleDateString('pt-BR')}
                                    </p>
                                    <p>
                                      Valor: R$ {historical.amount.toFixed(4)}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : projection ? (
                              // Projeção futura
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white cursor-help">
                                      <DollarSign className="w-4 h-4" />
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">
                                      {MONTHS[month - 1]} {year} (Projetado)
                                    </p>
                                    <p>
                                      Data: {new Date(projection.projectedExDate).toLocaleDateString('pt-BR')}
                                    </p>
                                    <p>
                                      Valor: R$ {projection.projectedAmount.toFixed(4)}
                                    </p>
                                    <p>
                                      Confiança: {projection.confidence}%
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div className="w-8 h-8 mx-auto" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-3">
          {companies.map((company) => {
            const projectionMap = new Map<string, DividendProjection>()
            if (company.projections && Array.isArray(company.projections)) {
              company.projections.forEach((p) => {
                const key = `${p.year}-${p.month}`
                projectionMap.set(key, p)
              })
            }
            
            const historicalMap = new Map<string, HistoricalDividend>()
            if (company.historicalDividends && Array.isArray(company.historicalDividends)) {
              company.historicalDividends.forEach((h) => {
                const key = `${h.year}-${h.month}`
                historicalMap.set(key, h)
              })
            }

            return (
              <Card key={company.ticker} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="mb-4">
                    <div className="flex items-start gap-3">
                      <CompanyLogo
                        logoUrl={company.logoUrl}
                        companyName={company.name}
                        ticker={company.ticker}
                        size={48}
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/radar-dividendos/${company.ticker.toLowerCase()}`}
                          className="block"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold hover:text-primary transition-colors">{company.ticker}</span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {company.name}
                          </div>
                        </Link>
                        <Link
                          href={`/acao/${company.ticker.toLowerCase()}`}
                          className="text-xs text-primary hover:underline mt-1 inline-block"
                        >
                          Ver análise completa
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Grid de meses mobile */}
                  <div className="grid grid-cols-3 gap-2">
                    {monthsToShow.map(({ month, year, isCurrent }) => {
                      const key = `${year}-${month}`
                      const projection = projectionMap.get(key)
                      const historical = historicalMap.get(key)

                      return (
                        <div
                          key={key}
                          className={cn(
                            'p-2 rounded border text-center',
                            isCurrent && 'bg-primary/10 border-primary border-2',
                            historical
                              ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                              : projection
                              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                              : 'bg-muted/50 border-muted'
                          )}
                        >
                          {historical ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-1 cursor-help">
                                  <div className="text-xs font-medium">
                                    {MONTHS[month - 1].substring(0, 3)}
                                  </div>
                                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white mx-auto">
                                    <DollarSign className="w-3 h-3" />
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    R$ {historical.amount.toFixed(2)}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-semibold">
                                    {MONTHS[month - 1]} {year} (Pago)
                                  </p>
                                  <p>
                                    Data Ex: {new Date(historical.exDate).toLocaleDateString('pt-BR')}
                                  </p>
                                  <p>
                                    Valor: R$ {historical.amount.toFixed(4)}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : projection ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-1 cursor-help">
                                  <div className="text-xs font-medium">
                                    {MONTHS[month - 1].substring(0, 3)}
                                  </div>
                                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white mx-auto">
                                    <DollarSign className="w-3 h-3" />
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    R$ {projection.projectedAmount.toFixed(2)}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-semibold">
                                    {MONTHS[month - 1]} {year} (Projetado)
                                  </p>
                                  <p>
                                    Data: {new Date(projection.projectedExDate).toLocaleDateString('pt-BR')}
                                  </p>
                                  <p>
                                    Valor: R$ {projection.projectedAmount.toFixed(4)}
                                  </p>
                                  <p>
                                    Confiança: {projection.confidence}%
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <div className="space-y-1">
                              <div className={cn(
                                "text-xs font-medium",
                                isCurrent ? "text-primary font-bold" : "text-muted-foreground"
                              )}>
                                {MONTHS[month - 1].substring(0, 3)}
                              </div>
                              <div className="w-6 h-6 mx-auto" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

