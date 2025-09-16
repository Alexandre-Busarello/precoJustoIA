'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Crown, 
  Lock, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Eye,
  ArrowUpDown
} from 'lucide-react'

// Tipo para dados da empresa
interface CompanyData {
  ticker: string
  name: string
  sector?: string | null
  currentPrice: number
  financialData: {
    pl?: number | null
    pvp?: number | null
    roe?: number | null
    dy?: number | null
    margemLiquida?: number | null
    roic?: number | null
    marketCap?: number | null
    receitaTotal?: number | null
    lucroLiquido?: number | null
    dividaLiquidaEbitda?: number | null
    dividaLiquidaPatrimonio?: number | null
    liquidezCorrente?: number | null
  } | null
}

interface ComparisonTableProps {
  companies: CompanyData[]
  userIsPremium: boolean
}

// Definir quais indicadores são premium
const premiumIndicators = [
  'margemLiquida',
  'roic', 
  'lucroLiquido',
  'dividaLiquidaEbitda',
  'dividaLiquidaPatrimonio',
  'liquidezCorrente'
]

// Configuração dos indicadores
const indicators = [
  {
    key: 'pl',
    label: 'P/L',
    description: 'Preço/Lucro',
    format: (value: number | null) => value ? value.toFixed(2) : 'N/A',
    getBestType: (values: (number | null)[]) => 'lowest', // menor é melhor
    isPremium: false
  },
  {
    key: 'pvp',
    label: 'P/VP',
    description: 'Preço/Valor Patrimonial',
    format: (value: number | null) => value ? value.toFixed(2) : 'N/A',
    getBestType: (values: (number | null)[]) => 'lowest',
    isPremium: false
  },
  {
    key: 'roe',
    label: 'ROE',
    description: 'Retorno sobre Patrimônio',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: (values: (number | null)[]) => 'highest', // maior é melhor
    isPremium: false
  },
  {
    key: 'dy',
    label: 'Dividend Yield',
    description: 'Rendimento de Dividendos',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: (values: (number | null)[]) => 'highest',
    isPremium: false
  },
  {
    key: 'margemLiquida',
    label: 'Margem Líquida',
    description: 'Margem de Lucro Líquido',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: (values: (number | null)[]) => 'highest',
    isPremium: true
  },
  {
    key: 'roic',
    label: 'ROIC',
    description: 'Retorno sobre Capital Investido',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: (values: (number | null)[]) => 'highest',
    isPremium: true
  },
  {
    key: 'marketCap',
    label: 'Valor de Mercado',
    description: 'Capitalização de Mercado',
    format: (value: number | null) => {
      if (!value) return 'N/A'
      if (value >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(2)}B`
      if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)}M`
      return `R$ ${(value / 1_000).toFixed(2)}K`
    },
    getBestType: (values: (number | null)[]) => 'neutral',
    isPremium: false
  },
  {
    key: 'dividaLiquidaEbitda',
    label: 'Dív. Líq./EBITDA',
    description: 'Dívida Líquida sobre EBITDA',
    format: (value: number | null) => value ? value.toFixed(2) : 'N/A',
    getBestType: (values: (number | null)[]) => 'lowest',
    isPremium: true
  }
]

export function ComparisonTable({ companies, userIsPremium }: ComparisonTableProps) {
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Função para determinar o melhor valor
  const getBestValueIndex = (values: (number | null)[], type: 'highest' | 'lowest' | 'neutral') => {
    if (type === 'neutral') return -1
    
    const validValues = values.map((v, i) => ({ value: v, index: i })).filter(v => v.value !== null)
    if (validValues.length === 0) return -1
    
    if (type === 'highest') {
      return validValues.reduce((best, current) => 
        current.value! > best.value! ? current : best
      ).index
    } else {
      return validValues.reduce((best, current) => 
        current.value! < best.value! ? current : best
      ).index
    }
  }

  // Função para renderizar célula com indicador de melhor valor
  const renderCell = (value: number | null, companyIndex: number, bestIndex: number, isPremium: boolean) => {
    const shouldBlur = isPremium && !userIsPremium
    const isBest = bestIndex === companyIndex && bestIndex !== -1
    
    return (
      <TableCell key={companyIndex} className={`text-center relative ${shouldBlur ? 'blur-sm' : ''}`}>
        <div className="flex items-center justify-center space-x-1">
          <span className={isBest ? 'font-bold text-green-600' : ''}>
            {indicators.find(i => i.key === 'pl')?.format(value) || 'N/A'}
          </span>
          {isBest && <TrendingUp className="w-4 h-4 text-green-600" />}
        </div>
        {shouldBlur && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </TableCell>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ArrowUpDown className="w-5 h-5" />
          <span>Comparação Detalhada</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Indicador</TableHead>
                {companies.map((company) => (
                  <TableHead key={company.ticker} className="text-center min-w-32">
                    <div className="space-y-1">
                      <div className="font-bold">{company.ticker}</div>
                      <Badge variant="outline" className="text-xs">
                        {company.sector || 'N/A'}
                      </Badge>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {indicators.map((indicator) => {
                const values = companies.map(c => 
                  c.financialData ? (c.financialData as Record<string, number | null>)[indicator.key] : null
                )
                const bestIndex = getBestValueIndex(values, indicator.getBestType(values))
                const shouldBlur = indicator.isPremium && !userIsPremium

                return (
                  <TableRow key={indicator.key}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{indicator.label}</span>
                        {indicator.isPremium && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {indicator.description}
                      </div>
                    </TableCell>
                    {values.map((value, companyIndex) => {
                      const isBest = bestIndex === companyIndex && bestIndex !== -1
                      
                      return (
                        <TableCell key={companyIndex} className={`text-center relative ${shouldBlur ? 'blur-sm' : ''}`}>
                          <div className="flex items-center justify-center space-x-1">
                            <span className={isBest ? 'font-bold text-green-600' : ''}>
                              {indicator.format(value)}
                            </span>
                            {isBest && indicator.getBestType(values) === 'highest' && (
                              <TrendingUp className="w-4 h-4 text-green-600" />
                            )}
                            {isBest && indicator.getBestType(values) === 'lowest' && (
                              <TrendingDown className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          {shouldBlur && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {!userIsPremium && (
          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center space-x-3">
              <Crown className="w-6 h-6 text-yellow-600" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Desbloqueie Análises Avançadas
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Acesse indicadores premium como Margem Líquida, ROIC, análise de endividamento e muito mais.
                </p>
              </div>
              <Button asChild size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                <Link href="/dashboard">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade Premium
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Links para análises individuais */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="font-semibold mb-3">Análises Individuais</h4>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => (
              <Button key={company.ticker} asChild variant="outline" size="sm">
                <Link href={`/acao/${company.ticker}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  {company.ticker}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
