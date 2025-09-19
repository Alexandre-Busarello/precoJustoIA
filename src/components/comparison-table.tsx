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
  ArrowUpDown,
  Trophy
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
  strategies?: {
    graham?: { score: number; isEligible: boolean; fairValue?: number | null } | null
    dividendYield?: { score: number; isEligible: boolean } | null
    lowPE?: { score: number; isEligible: boolean } | null
    magicFormula?: { score: number; isEligible: boolean } | null
    fcd?: { score: number; isEligible: boolean; fairValue?: number | null } | null
    gordon?: { score: number; isEligible: boolean; fairValue?: number | null } | null
    fundamentalist?: { score: number; isEligible: boolean } | null
  } | null
  overallScore?: {
    score: number
    grade: string
    classification: string
    recommendation: string
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
  // Indicadores Básicos (Gratuitos)
  {
    key: 'pl',
    label: 'P/L',
    description: 'Preço/Lucro',
    format: (value: number | null) => value ? value.toFixed(2) : 'N/A',
    getBestType: () => 'lowest' as const,
    isPremium: false
  },
  {
    key: 'pvp',
    label: 'P/VP',
    description: 'Preço/Valor Patrimonial',
    format: (value: number | null) => value ? value.toFixed(2) : 'N/A',
    getBestType: () => 'lowest' as const,
    isPremium: false
  },
  {
    key: 'roe',
    label: 'ROE',
    description: 'Retorno sobre Patrimônio',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: false
  },
  {
    key: 'dy',
    label: 'Dividend Yield',
    description: 'Rendimento de Dividendos',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: false
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
    getBestType: () => 'neutral' as const,
    isPremium: false
  },
  
  // Indicadores Avançados (Premium)
  {
    key: 'margemLiquida',
    label: 'Margem Líquida',
    description: 'Margem de Lucro Líquido',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true
  },
  {
    key: 'roic',
    label: 'ROIC',
    description: 'Retorno sobre Capital Investido',
    format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true
  },
  {
    key: 'dividaLiquidaEbitda',
    label: 'Dív. Líq./EBITDA',
    description: 'Dívida Líquida sobre EBITDA',
    format: (value: number | null) => value ? value.toFixed(2) : 'N/A',
    getBestType: () => 'lowest' as const,
    isPremium: true
  },
  
  // Score Geral (Premium) - Separador visual
  {
    key: 'overallScore',
    label: 'Score Geral',
    description: 'Pontuação Geral da Empresa',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  },
  
  // Estratégias de Investimento (Premium) - No final da tabela
  {
    key: 'graham',
    label: 'Graham',
    description: 'Análise Benjamin Graham',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  },
  {
    key: 'dividendYieldStrategy',
    label: 'Dividend Yield',
    description: 'Estratégia de Dividendos',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  },
  {
    key: 'lowPE',
    label: 'Low P/E',
    description: 'Estratégia P/L Baixo',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  },
  {
    key: 'magicFormula',
    label: 'Magic Formula',
    description: 'Fórmula Mágica de Greenblatt',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  },
  {
    key: 'fcd',
    label: 'FCD',
    description: 'Fluxo de Caixa Descontado',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  },
  {
    key: 'gordon',
    label: 'Gordon',
    description: 'Modelo de Gordon',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  },
  {
    key: 'fundamentalist',
    label: 'Fundamentalista 3+1',
    description: 'Análise Fundamentalista Simplificada',
    format: (value: number | null) => value ? `${value.toFixed(1)}/100` : 'N/A',
    getBestType: () => 'highest' as const,
    isPremium: true,
    isStrategy: true
  }
]

export function ComparisonTable({ companies, userIsPremium }: ComparisonTableProps) {
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Função para determinar o melhor valor e empates
  const getBestValueInfo = (values: (number | null)[], type: 'highest' | 'lowest' | 'neutral') => {
    if (type === 'neutral') return { bestIndex: -1, tiedIndices: [] }
    
    const validValues = values.map((v, i) => ({ value: v, index: i })).filter(v => v.value !== null)
    if (validValues.length === 0) return { bestIndex: -1, tiedIndices: [] }
    
    // Encontrar o melhor valor
    let bestValue: number
    if (type === 'highest') {
      bestValue = Math.max(...validValues.map(v => v.value!))
    } else {
      bestValue = Math.min(...validValues.map(v => v.value!))
    }
    
    // Encontrar todos os índices com o melhor valor (empates)
    const tiedIndices = validValues
      .filter(v => Math.abs(v.value! - bestValue) < 0.01) // Tolerância para números decimais
      .map(v => v.index)
    
    // Se há empate (mais de um valor igual ao melhor), não destacar um único campeão
    const bestIndex = tiedIndices.length > 1 ? -1 : tiedIndices[0]
    
    return { bestIndex, tiedIndices }
  }

  // Função para determinar o melhor valor (compatibilidade)
  const getBestValueIndex = (values: (number | null)[], type: 'highest' | 'lowest' | 'neutral') => {
    return getBestValueInfo(values, type).bestIndex
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
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
          <ArrowUpDown className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span className="truncate">Comparação Detalhada</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[800px] px-4 sm:px-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 sm:w-48 text-xs sm:text-sm">Indicador</TableHead>
                {companies.map((company) => (
                  <TableHead key={company.ticker} className="text-center min-w-28 sm:min-w-36">
                    <div className="space-y-1">
                      <div className="font-bold text-xs sm:text-sm">{company.ticker}</div>
                      <Badge 
                        variant="outline" 
                        className="text-xs block mx-auto"
                        style={{
                          maxWidth: '100%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={company.sector || 'N/A'}
                      >
                        {company.sector || 'N/A'}
                      </Badge>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {indicators.map((indicator) => {
                const values = companies.map(c => {
                  // Score Geral
                  if (indicator.key === 'overallScore') {
                    return c.overallScore?.score || null
                  }
                  
                  // Estratégias de Investimento
                  if (indicator.isStrategy && c.strategies) {
                    // Mapear chave da estratégia corretamente
                    let strategyKey = indicator.key
                    if (indicator.key === 'dividendYieldStrategy') {
                      strategyKey = 'dividendYield'
                    }
                    
                    const strategy = (c.strategies as Record<string, { score: number; isEligible: boolean }>)[strategyKey]
                    return strategy?.score || null
                  }
                  
                  // Indicadores Financeiros
                  return c.financialData ? (c.financialData as Record<string, number | null>)[indicator.key] : null
                })
                const { bestIndex, tiedIndices } = getBestValueInfo(values, indicator.getBestType())
                const shouldBlur = indicator.isPremium && !userIsPremium

                return (
                  <TableRow key={indicator.key}>
                    <TableCell className="font-medium p-2 sm:p-4">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="text-xs sm:text-sm truncate">{indicator.label}</span>
                        {indicator.isPremium && (
                          <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {indicator.description}
                      </div>
                    </TableCell>
                    {values.map((value, companyIndex) => {
                      const isBest = bestIndex === companyIndex && bestIndex !== -1
                      const isTied = tiedIndices.includes(companyIndex) && tiedIndices.length > 1
                      
                      return (
                        <TableCell key={companyIndex} className={`text-center relative p-2 sm:p-4 ${shouldBlur ? 'blur-sm' : ''}`}>
                          <div className="flex items-center justify-center space-x-1">
                            <span className={`text-xs sm:text-sm ${isBest ? 'font-bold text-green-600' : isTied ? 'font-semibold text-blue-600' : ''}`}>
                              {indicator.format(value)}
                            </span>
                            {isBest && userIsPremium && (
                              <div className="flex items-center">
                                {indicator.getBestType() === 'highest' && (
                                  <>
                                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 mr-1" />
                                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />
                                  </>
                                )}
                                {indicator.getBestType() === 'lowest' && (
                                  <>
                                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 mr-1" />
                                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />
                                  </>
                                )}
                              </div>
                            )}
                            {isBest && !userIsPremium && (
                              <div className="flex items-center">
                                {indicator.getBestType() === 'highest' && (
                                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                                )}
                                {indicator.getBestType() === 'lowest' && (
                                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                                )}
                              </div>
                            )}
                            {isTied && !isBest && (
                              <div className="flex items-center" title="Empate">
                                <Minus className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                              </div>
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
        </div>

        {/* Legenda dos símbolos */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border">
          <h4 className="font-semibold mb-3 text-xs sm:text-sm">Legenda dos Símbolos</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs">
            <div className="flex items-center space-x-2 min-w-0">
              <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
              <span className="truncate">Melhor valor único (Premium)</span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
              <span className="truncate">Melhor valor (maior é melhor)</span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
              <span className="truncate">Melhor valor (menor é melhor)</span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <Minus className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
              <span className="truncate">Empate no melhor valor</span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
              <span className="truncate">Recurso Premium</span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">Bloqueado (Premium)</span>
            </div>
          </div>
        </div>

        {!userIsPremium && (
          <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 self-center sm:self-start" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 text-sm sm:text-base">
                  Desbloqueie Análises Avançadas
                </h4>
                <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Acesse indicadores premium como Margem Líquida, ROIC, análise de endividamento e muito mais.
                </p>
              </div>
              <Button asChild size="sm" className="bg-yellow-600 hover:bg-yellow-700 w-full sm:w-auto">
                <Link href="/dashboard">
                  <Crown className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  <span className="text-xs sm:text-sm">Upgrade Premium</span>
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Links para análises individuais */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
          <h4 className="font-semibold mb-3 text-sm sm:text-base">Análises Individuais</h4>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => (
              <Button key={company.ticker} asChild variant="outline" size="sm" className="text-xs sm:text-sm">
                <Link href={`/acao/${company.ticker}`}>
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
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
