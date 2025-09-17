import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { StrategyFactory } from '@/lib/strategies/strategy-factory'
import { calculateOverallScore } from '@/lib/strategies/overall-score'
import Link from 'next/link'

// Shadcn UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ComparisonTable } from '@/components/comparison-table'

// Lucide Icons
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Percent,
  DollarSign,
  Target,
  BarChart3,
  Activity,
  PieChart,
  Eye,
  User,
  LineChart,
  ArrowRight,
  Lock,
  Crown,
  Trophy,
  Medal,
  Award
} from 'lucide-react'

interface PageProps {
  params: {
    tickers: string[]
  }
}

// Tipo para valores do Prisma que podem ser Decimal
type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

// Função para converter Decimal para number
function toNumber(value: PrismaDecimal | Date | string | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }
  return parseFloat(String(value))
}

// Funções de formatação
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatPercent(value: PrismaDecimal | Date | string | null): string {
  const numValue = toNumber(value)
  if (numValue === null || numValue === undefined) return 'N/A'
  return `${(numValue * 100).toFixed(2)}%`
}

function formatLargeNumber(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  
  if (value >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(2)}K`
  }
  return formatCurrency(value)
}

// Sistema de pontuação ponderada para determinar a melhor empresa
function calculateWeightedScore(companies: Record<string, unknown>[]): { scores: number[], bestIndex: number, tiedIndices: number[] } {
  // Definir pesos para cada indicador (total = 100%)
  const weights = {
    // Indicadores Básicos (40%)
    pl: 0.10,           // 10% - Valuation fundamental
    pvp: 0.10,          // 10% - Valor patrimonial
    roe: 0.10,          // 10% - Rentabilidade principal
    dy: 0.10,           // 10% - Dividendos
    
    // Indicadores Avançados (25%)
    margemLiquida: 0.10, // 10% - Eficiência operacional
    roic: 0.10,         // 10% - Retorno sobre capital
    dividaLiquidaEbitda: 0.05, // 5% - Endividamento
    
    // Score Geral (20%)
    overallScore: 0.20,  // 20% - Análise consolidada
    
    // Estratégias de Investimento (15%)
    graham: 0.025,        // 2.5% - Análise Graham
    dividendYield: 0.025, // 2.5% - Estratégia dividendos
    lowPE: 0.025,         // 2.5% - Value investing
    magicFormula: 0.025,  // 2.5% - Greenblatt
    fcd: 0.025,           // 2.5% - Fluxo de caixa
    gordon: 0.025         // 2.5% - Modelo Gordon
  }
  
  const scores = companies.map((company, companyIndex) => {
    let totalScore = 0
    let totalWeight = 0
    let penaltyFactor = 1.0 // Fator de penalização (1.0 = sem penalidade)
    
    // Executar estratégias para obter dados completos
    const dailyQuotes = company.dailyQuotes as any[]
    const financialData = company.financialData as any[]
    const currentPrice = toNumber(dailyQuotes?.[0]?.price) || toNumber(financialData?.[0]?.lpa) || 0
    const { strategies, overallScore } = executeStrategiesForCompany(company, currentPrice)
    
    // PENALIZAÇÃO 1: Empresas com valor de mercado menor que 2B
    const companyFinancialData = financialData?.[0] as any
    if (companyFinancialData) {
      const marketCap = toNumber(companyFinancialData.valorMercado) || 0
      if (marketCap > 0 && marketCap < 2000000000) { // 2 bilhões
        penaltyFactor *= 0.8 // Penalidade de 20%
        console.log(`Penalidade valor de mercado aplicada para ${company.ticker}: R$ ${(marketCap / 1000000).toFixed(0)}M`)
      }
    }
    
    // PENALIZAÇÃO 2: Score Geral menor que 50
    if (overallScore?.score && overallScore.score < 50) {
      penaltyFactor *= 0.7 // Penalidade de 30%
      console.log(`Penalidade score geral aplicada para ${company.ticker}: ${overallScore.score.toFixed(1)}`)
    }
    
    // PENALIZAÇÃO 3: Indicadores ausentes (N/A) ou super inflados
    let missingIndicators = 0
    let inflatedIndicators = 0
    
    if (companyFinancialData) {
      // Verificar indicadores críticos
      const criticalIndicators = [
        { key: 'pl', value: toNumber(companyFinancialData.pl), maxInflated: 100 },
        { key: 'pvp', value: toNumber(companyFinancialData.pvp), maxInflated: 10 },
        { key: 'roe', value: toNumber(companyFinancialData.roe), maxInflated: 1 }, // 100%
        { key: 'dy', value: toNumber(companyFinancialData.dy), maxInflated: 0.3 }, // 30%
        { key: 'margemLiquida', value: toNumber(companyFinancialData.margemLiquida), maxInflated: 1 }, // 100%
        { key: 'roic', value: toNumber(companyFinancialData.roic), maxInflated: 1 }, // 100%
      ]
      
      criticalIndicators.forEach(indicator => {
        if (indicator.value === null || indicator.value === undefined) {
          missingIndicators++
        } else if (indicator.value > indicator.maxInflated) {
          inflatedIndicators++
          console.log(`Indicador inflado detectado para ${company.ticker}: ${indicator.key} = ${indicator.value}`)
        }
      })
      
      // Aplicar penalidades por indicadores problemáticos
      if (missingIndicators > 0) {
        const missingPenalty = Math.min(0.5, missingIndicators * 0.1) // Máximo 50% de penalidade
        penaltyFactor *= (1 - missingPenalty)
        console.log(`Penalidade indicadores ausentes aplicada para ${company.ticker}: ${missingIndicators} indicadores, penalidade ${(missingPenalty * 100).toFixed(0)}%`)
      }
      
      if (inflatedIndicators > 0) {
        const inflatedPenalty = Math.min(0.4, inflatedIndicators * 0.15) // Máximo 40% de penalidade
        penaltyFactor *= (1 - inflatedPenalty)
        console.log(`Penalidade indicadores inflados aplicada para ${company.ticker}: ${inflatedIndicators} indicadores, penalidade ${(inflatedPenalty * 100).toFixed(0)}%`)
      }
    }
    
    // Função para normalizar e pontuar um indicador com valores de referência absolutos
    const scoreIndicator = (values: (number | null)[], companyValue: number | null, weight: number, higherIsBetter: boolean, indicatorKey: string) => {
      if (companyValue === null) return 0
      
      const validValues = values.filter(v => v !== null) as number[]
      if (validValues.length === 0) return 0
      
      // Valores de referência absolutos baseados no mercado brasileiro
      const referenceRanges: Record<string, { min: number, max: number }> = {
        // Indicadores básicos
        pl: { min: 3, max: 25 },           // P/L típico: 3-25
        pvp: { min: 0.5, max: 3 },         // P/VP típico: 0.5-3
        roe: { min: 0.05, max: 0.35 },     // ROE típico: 5%-35%
        dy: { min: 0, max: 0.15 },         // DY típico: 0%-15%
        
        // Indicadores avançados
        margemLiquida: { min: 0, max: 0.5 }, // Margem típica: 0%-50%
        roic: { min: 0.05, max: 0.4 },     // ROIC típico: 5%-40%
        dividaLiquidaEbitda: { min: -2, max: 8 }, // Dívida típica: -2x a 8x
        
        // Scores (0-100)
        overallScore: { min: 0, max: 100 },
        graham: { min: 0, max: 100 },
        dividendYield: { min: 0, max: 100 },
        lowPE: { min: 0, max: 100 },
        magicFormula: { min: 0, max: 100 },
        fcd: { min: 0, max: 100 },
        gordon: { min: 0, max: 100 }
      }
      
      const range = referenceRanges[indicatorKey]
      if (!range) {
        // Fallback para normalização relativa se não houver referência
        const min = Math.min(...validValues)
        const max = Math.max(...validValues)
        if (min === max) return weight
        
        let normalizedScore: number
        if (higherIsBetter) {
          normalizedScore = (companyValue - min) / (max - min)
        } else {
          normalizedScore = (max - companyValue) / (max - min)
        }
        return Math.max(0, Math.min(1, normalizedScore)) * weight
      }
      
      // Normalização absoluta usando valores de referência
      let normalizedScore: number
      if (higherIsBetter) {
        normalizedScore = (companyValue - range.min) / (range.max - range.min)
      } else {
        normalizedScore = (range.max - companyValue) / (range.max - range.min)
      }
      
      // Garantir que o score fique entre 0 e 1
      normalizedScore = Math.max(0, Math.min(1, normalizedScore))
      
      return normalizedScore * weight
    }
    
    // Coletar todos os valores para normalização
    const allPL = companies.map(c => toNumber((c.financialData as any[])?.[0]?.pl))
    const allPVP = companies.map(c => toNumber((c.financialData as any[])?.[0]?.pvp))
    const allROE = companies.map(c => toNumber((c.financialData as any[])?.[0]?.roe))
    const allDY = companies.map(c => toNumber((c.financialData as any[])?.[0]?.dy))
    const allMargemLiquida = companies.map(c => toNumber((c.financialData as any[])?.[0]?.margemLiquida))
    const allROIC = companies.map(c => toNumber((c.financialData as any[])?.[0]?.roic))
    const allDividaEbitda = companies.map(c => toNumber((c.financialData as any[])?.[0]?.dividaLiquidaEbitda))
    
    // Calcular scores dos indicadores básicos
    if (companyFinancialData) {
      totalScore += scoreIndicator(allPL, toNumber(companyFinancialData.pl), weights.pl, false, 'pl') // Menor P/L é melhor
      totalScore += scoreIndicator(allPVP, toNumber(companyFinancialData.pvp), weights.pvp, false, 'pvp') // Menor P/VP é melhor
      totalScore += scoreIndicator(allROE, toNumber(companyFinancialData.roe), weights.roe, true, 'roe') // Maior ROE é melhor
      totalScore += scoreIndicator(allDY, toNumber(companyFinancialData.dy), weights.dy, true, 'dy') // Maior DY é melhor
      totalScore += scoreIndicator(allMargemLiquida, toNumber(companyFinancialData.margemLiquida), weights.margemLiquida, true, 'margemLiquida')
      totalScore += scoreIndicator(allROIC, toNumber(companyFinancialData.roic), weights.roic, true, 'roic')
      totalScore += scoreIndicator(allDividaEbitda, toNumber(companyFinancialData.dividaLiquidaEbitda), weights.dividaLiquidaEbitda, false, 'dividaLiquidaEbitda')
      
      totalWeight += weights.pl + weights.pvp + weights.roe + weights.dy + weights.margemLiquida + weights.roic + weights.dividaLiquidaEbitda
    }
    
    // Score geral
    if (overallScore?.score) {
      const allOverallScores = companies.map(c => {
        const cDailyQuotes = c.dailyQuotes as any[]
        const cFinancialData = c.financialData as any[]
        const price = toNumber(cDailyQuotes?.[0]?.price) || toNumber(cFinancialData?.[0]?.lpa) || 0
        const { overallScore: os } = executeStrategiesForCompany(c, price)
        return os?.score || null
      })
      totalScore += scoreIndicator(allOverallScores, overallScore.score, weights.overallScore, true, 'overallScore')
      totalWeight += weights.overallScore
    }
    
    // Estratégias
    if (strategies) {
      const strategyKeys = ['graham', 'dividendYield', 'lowPE', 'magicFormula', 'fcd', 'gordon'] as const
      
      strategyKeys.forEach(key => {
        const strategyScore = strategies[key]?.score
        if (strategyScore !== undefined) {
          const allStrategyScores = companies.map(c => {
            const cDailyQuotes = c.dailyQuotes as any[]
            const cFinancialData = c.financialData as any[]
            const price = toNumber(cDailyQuotes?.[0]?.price) || toNumber(cFinancialData?.[0]?.lpa) || 0
            const { strategies: s } = executeStrategiesForCompany(c, price)
            return s?.[key]?.score || null
          })
          totalScore += scoreIndicator(allStrategyScores, strategyScore, weights[key], true, key)
          totalWeight += weights[key]
        }
      })
    }
    
    // Normalizar pela soma dos pesos utilizados e aplicar penalidades
    const baseScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0
    const finalScore = baseScore * penaltyFactor
    
    // Log do score final com penalidades
    if (penaltyFactor < 1.0) {
      console.log(`Score final para ${company.ticker}: ${baseScore.toFixed(2)} -> ${finalScore.toFixed(2)} (penalidade: ${((1 - penaltyFactor) * 100).toFixed(0)}%)`)
    }
    
    return finalScore
  })
  
  // Encontrar o melhor score
  const maxScore = Math.max(...scores)
  const tolerance = 0.1 // Tolerância de 0.1 pontos para empates
  const tiedIndices = scores
    .map((score, index) => ({ score, index }))
    .filter(item => Math.abs(item.score - maxScore) <= tolerance)
    .map(item => item.index)
  
  const bestIndex = tiedIndices.length === 1 ? tiedIndices[0] : -1
  
  // Debug temporário para investigar mudanças de ranking
  if (companies.length <= 6) { // Só para comparações pequenas
    console.log('=== WEIGHTED SCORING DEBUG ===')
    console.log('Companies:', companies.map(c => c.ticker))
    console.log('Scores:', companies.map((c, i) => ({ 
      ticker: c.ticker, 
      score: scores[i].toFixed(2),
      marketCap: `R$ ${((toNumber((c.financialData as any[])?.[0]?.valorMercado) || 0) / 1000000).toFixed(0)}M`
    })))
    console.log('Best score:', maxScore.toFixed(2))
    console.log('Winner:', bestIndex !== -1 ? companies[bestIndex].ticker : 'Tie')
    console.log('Tied companies:', tiedIndices.length > 1 ? tiedIndices.map(i => companies[i].ticker) : 'None')
    console.log('=== END DEBUG ===')
  }
  
  return { scores, bestIndex, tiedIndices }
}

// Função para executar estratégias e calcular score geral
function executeStrategiesForCompany(company: Record<string, unknown>, currentPrice: number) {
  try {
    // Preparar dados da empresa no formato esperado pelas estratégias
    const companyData = {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currentPrice,
      financials: company.financialData[0],
      financialData: company.financialData[0]
    }

    // Executar todas as estratégias
    const strategies = {
      graham: StrategyFactory.runGrahamAnalysis(companyData, { marginOfSafety: 0.20 }),
      dividendYield: StrategyFactory.runDividendYieldAnalysis(companyData, { minYield: 0.04 }),
      lowPE: StrategyFactory.runLowPEAnalysis(companyData, { maxPE: 15, minROE: 0.12 }),
      magicFormula: StrategyFactory.runMagicFormulaAnalysis(companyData, { limit: 10 }),
      fcd: StrategyFactory.runFCDAnalysis(companyData, {
        growthRate: 0.025,
        discountRate: 0.10,
        yearsProjection: 5,
        minMarginOfSafety: 0.20
      }),
      gordon: StrategyFactory.runGordonAnalysis(companyData, {
        discountRate: 0.12,
        dividendGrowthRate: 0.05
      })
    }

    // Calcular score geral
    const overallScore = calculateOverallScore(strategies, companyData.financialData, currentPrice)

    return { strategies, overallScore }
  } catch (error) {
    console.error(`Erro ao executar estratégias para ${company.ticker}:`, error)
    return { strategies: null, overallScore: null }
  }
}

// Componente para indicador com blur premium
function ComparisonIndicatorCard({ 
  title, 
  values, 
  tickers,
  icon: Icon, 
  description,
  isPremium = false,
  userIsPremium = false
}: {
  title: string
  values: (string | number)[]
  tickers: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  description?: string
  isPremium?: boolean
  userIsPremium?: boolean
}) {
  const shouldBlur = isPremium && !userIsPremium

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Icon className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {isPremium && (
            <Crown className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className={`space-y-3 ${shouldBlur ? 'blur-sm' : ''}`}>
        {tickers.map((ticker, index) => (
          <div key={ticker} className="flex justify-between items-center">
            <span className="text-sm font-medium">{ticker}</span>
            <span className="text-sm">{values[index] || 'N/A'}</span>
          </div>
        ))}
      </CardContent>
      {shouldBlur && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">Recurso Premium</p>
            <Button size="sm" asChild>
              <Link href="/dashboard">
                <Crown className="w-4 h-4 mr-2" />
                Fazer Upgrade
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickers = resolvedParams.tickers.map(t => t.toUpperCase())
  
  if (tickers.length < 2) {
    return {
      title: 'Comparação de Ações - Preço Justo AI',
      description: 'Compare ações da B3 com análise fundamentalista completa.'
    }
  }

  try {
    const companies = await prisma.company.findMany({
      where: { 
        ticker: { in: tickers }
      },
      select: {
        ticker: true,
        name: true,
        sector: true
      }
    })

    const foundTickers = companies.map(c => c.ticker).join(' vs ')
    const companyNames = companies.map(c => c.name).join(', ')
    
    const title = `Comparação ${foundTickers} | Análise Comparativa de Ações - Preço Justo AI`
    const description = `Compare as ações ${foundTickers} (${companyNames}) com análise fundamentalista completa. Indicadores financeiros, valuation, estratégias de investimento e scores lado a lado.`

    return {
      title,
      description,
      keywords: `${foundTickers}, comparação de ações, análise comparativa, ${companyNames}, B3, bovespa, investimentos, análise fundamentalista, valuation`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `/compara-acoes/${tickers.join('/')}`,
        siteName: 'Preço Justo AI',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        creator: '@PrecoJustoAI',
        site: '@PrecoJustoAI'
      },
      alternates: {
        canonical: `/compara-acoes/${tickers.join('/')}`,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
    }
  } catch {
    return {
      title: `Comparação ${tickers.join(' vs ')} | Análise Comparativa de Ações - Preço Justo AI`,
      description: `Compare as ações ${tickers.join(', ')} com análise fundamentalista completa, indicadores financeiros e estratégias de investimento.`,
      alternates: {
        canonical: `/compara-acoes/${tickers.join('/')}`,
      }
    }
  }
}

export default async function CompareStocksPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickers = resolvedParams.tickers.map(t => t.toUpperCase())

  // Validar se há pelo menos 2 tickers
  if (tickers.length < 2) {
    notFound()
  }

  // Verificar sessão do usuário para recursos premium
  const session = await getServerSession(authOptions)
  let userIsPremium = false

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        subscriptionTier: true, 
        premiumExpiresAt: true 
      }
    })

    userIsPremium = user?.subscriptionTier === 'PREMIUM' && 
                   (!user.premiumExpiresAt || user.premiumExpiresAt > new Date())
  }

  // Buscar dados das empresas
  const companiesData = await prisma.company.findMany({
    where: { 
      ticker: { in: tickers }
    },
    include: {
      financialData: {
        orderBy: { year: 'desc' },
        take: 1
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1
      }
    }
  })

  // Verificar se todas as empresas foram encontradas
  const foundTickers = companiesData.map(c => c.ticker)
  const missingTickers = tickers.filter(t => !foundTickers.includes(t))
  
  if (missingTickers.length > 0) {
    notFound()
  }

  // Organizar dados na ordem dos tickers solicitados
  const orderedCompanies = tickers.map(ticker => 
    companiesData.find(c => c.ticker === ticker)!
  )

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header da Comparação */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <BarChart3 className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Comparação de Ações</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {tickers.map((ticker, index) => (
            <div key={ticker} className="flex items-center">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {ticker}
              </Badge>
              {index < tickers.length - 1 && (
                <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <p className="text-muted-foreground">
          Análise comparativa detalhada entre {tickers.length} ações da B3
        </p>
      </div>

      {/* Cards das Empresas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {(() => {
          // Calcular pontuação ponderada uma única vez
          const { bestIndex, tiedIndices } = calculateWeightedScore(orderedCompanies)
          
          return orderedCompanies.map((company, companyIndex) => {
            const latestFinancials = company.financialData[0]
            const latestQuote = company.dailyQuotes[0]
            const currentPrice = toNumber(latestQuote?.price) || toNumber(latestFinancials?.lpa) || 0

            // Determinar se é a empresa campeã baseado na pontuação ponderada
            const isBestCompany = userIsPremium && (
              bestIndex === companyIndex || // Campeã única
              (bestIndex === -1 && tiedIndices.includes(companyIndex)) // Empate
            )

          return (
            <Card key={company.ticker} className={`relative ${isBestCompany ? 'ring-2 ring-yellow-400 shadow-lg' : ''}`}>
              {isBestCompany && (
                <div className="absolute -top-2 -right-2 z-10">
                  <div className="bg-yellow-500 rounded-full p-2 shadow-lg">
                    <Trophy className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-start space-x-4 mb-4">
                  <CompanyLogo
                    logoUrl={company.logoUrl}
                    companyName={company.name}
                    ticker={company.ticker}
                    size={60}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-bold">{company.ticker}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {company.sector || 'N/A'}
                      </Badge>
                      {isBestCompany && (
                        <Badge className="bg-yellow-500 text-white text-xs">
                          <Medal className="w-3 h-3 mr-1" />
                          Destaque
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {company.name}
                    </p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(currentPrice)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  {company.industry && (
                    <div className="flex items-center space-x-2">
                      <PieChart className="w-4 h-4 text-muted-foreground" />
                      <span>{company.industry}</span>
                    </div>
                  )}
                  
                  {(company.city || company.state) && (
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {[company.city, company.state].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  {company.fullTimeEmployees && (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{company.fullTimeEmployees.toLocaleString()} funcionários</span>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/acao/${company.ticker}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Análise Completa
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })
        })()}
      </div>

      {/* Indicadores Comparativos */}
      <div className="space-y-8">
        {/* Indicadores Básicos */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Target className="w-6 h-6 mr-2" />
            Indicadores Fundamentalistas
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ComparisonIndicatorCard
              title="P/L (Preço/Lucro)"
              values={orderedCompanies.map(c => {
                const pl = toNumber(c.financialData[0]?.pl)
                return pl ? pl.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={DollarSign}
              description="Quanto o mercado paga por cada R$ 1 de lucro"
            />

            <ComparisonIndicatorCard
              title="P/VP (Preço/Valor Patrimonial)"
              values={orderedCompanies.map(c => {
                const pvp = toNumber(c.financialData[0]?.pvp)
                return pvp ? pvp.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={Building2}
              description="Relação entre preço da ação e valor patrimonial"
            />

            <ComparisonIndicatorCard
              title="ROE (Retorno sobre Patrimônio)"
              values={orderedCompanies.map(c => {
                const roe = toNumber(c.financialData[0]?.roe)
                return roe ? formatPercent(roe) : 'N/A'
              })}
              tickers={tickers}
              icon={TrendingUp}
              description="Capacidade de gerar lucro com o patrimônio"
            />

            <ComparisonIndicatorCard
              title="Dividend Yield"
              values={orderedCompanies.map(c => {
                const dy = toNumber(c.financialData[0]?.dy)
                return dy ? formatPercent(dy) : 'N/A'
              })}
              tickers={tickers}
              icon={Percent}
              description="Rendimento anual em dividendos"
            />

            <ComparisonIndicatorCard
              title="Margem Líquida"
              values={orderedCompanies.map(c => {
                const ml = toNumber(c.financialData[0]?.margemLiquida)
                return ml ? formatPercent(ml) : 'N/A'
              })}
              tickers={tickers}
              icon={Activity}
              description="Percentual de lucro sobre a receita"
              isPremium={true}
              userIsPremium={userIsPremium}
            />

            <ComparisonIndicatorCard
              title="ROIC (Retorno sobre Capital Investido)"
              values={orderedCompanies.map(c => {
                const roic = toNumber(c.financialData[0]?.roic)
                return roic ? formatPercent(roic) : 'N/A'
              })}
              tickers={tickers}
              icon={Target}
              description="Eficiência no uso do capital investido"
              isPremium={true}
              userIsPremium={userIsPremium}
            />
          </div>
        </div>

        {/* Indicadores de Tamanho */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2" />
            Tamanho e Escala
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ComparisonIndicatorCard
              title="Valor de Mercado"
              values={orderedCompanies.map(c => {
                const marketCap = toNumber(c.financialData[0]?.marketCap)
                return marketCap ? formatLargeNumber(marketCap) : 'N/A'
              })}
              tickers={tickers}
              icon={DollarSign}
              description="Valor total da empresa no mercado"
            />

            <ComparisonIndicatorCard
              title="Receita Total"
              values={orderedCompanies.map(c => {
                const receita = toNumber(c.financialData[0]?.receitaTotal)
                return receita ? formatLargeNumber(receita) : 'N/A'
              })}
              tickers={tickers}
              icon={TrendingUp}
              description="Faturamento anual da empresa"
            />

            <ComparisonIndicatorCard
              title="Lucro Líquido"
              values={orderedCompanies.map(c => {
                const lucro = toNumber(c.financialData[0]?.lucroLiquido)
                return lucro ? formatLargeNumber(lucro) : 'N/A'
              })}
              tickers={tickers}
              icon={Activity}
              description="Lucro após todos os custos e impostos"
              isPremium={true}
              userIsPremium={userIsPremium}
            />
          </div>
        </div>

        {/* Indicadores de Endividamento - Premium */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <TrendingDown className="w-6 h-6 mr-2" />
            Endividamento e Solidez
            <Crown className="w-5 h-5 ml-2 text-yellow-500" />
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ComparisonIndicatorCard
              title="Dívida Líquida/EBITDA"
              values={orderedCompanies.map(c => {
                const divEbitda = toNumber(c.financialData[0]?.dividaLiquidaEbitda)
                return divEbitda ? divEbitda.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={TrendingDown}
              description="Capacidade de pagamento da dívida"
              isPremium={true}
              userIsPremium={userIsPremium}
            />

            <ComparisonIndicatorCard
              title="Dívida Líquida/Patrimônio"
              values={orderedCompanies.map(c => {
                const divPat = toNumber(c.financialData[0]?.dividaLiquidaPl)
                return divPat ? divPat.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={Building2}
              description="Endividamento em relação ao patrimônio"
              isPremium={true}
              userIsPremium={userIsPremium}
            />

            <ComparisonIndicatorCard
              title="Liquidez Corrente"
              values={orderedCompanies.map(c => {
                const lc = toNumber(c.financialData[0]?.liquidezCorrente)
                return lc ? lc.toFixed(2) : 'N/A'
              })}
              tickers={tickers}
              icon={Activity}
              description="Capacidade de honrar compromissos de curto prazo"
              isPremium={true}
              userIsPremium={userIsPremium}
            />
          </div>
        </div>
      </div>

      {/* Tabela de Comparação Detalhada */}
      <div className="mb-8">
        <ComparisonTable 
          companies={orderedCompanies.map(company => {
            const currentPrice = toNumber(company.dailyQuotes[0]?.price) || toNumber(company.financialData[0]?.lpa) || 0
            const { strategies, overallScore } = executeStrategiesForCompany(company, currentPrice)
            
            return {
              ticker: company.ticker,
              name: company.name,
              sector: company.sector,
              currentPrice,
              financialData: company.financialData[0] ? {
                pl: toNumber(company.financialData[0].pl),
                pvp: toNumber(company.financialData[0].pvp),
                roe: toNumber(company.financialData[0].roe),
                dy: toNumber(company.financialData[0].dy),
                margemLiquida: toNumber(company.financialData[0].margemLiquida),
                roic: toNumber(company.financialData[0].roic),
                marketCap: toNumber(company.financialData[0].marketCap),
                receitaTotal: toNumber(company.financialData[0].receitaTotal),
                lucroLiquido: toNumber(company.financialData[0].lucroLiquido),
                dividaLiquidaEbitda: toNumber(company.financialData[0].dividaLiquidaEbitda),
                dividaLiquidaPatrimonio: toNumber(company.financialData[0].dividaLiquidaPl),
                liquidezCorrente: toNumber(company.financialData[0].liquidezCorrente),
              } : null,
              strategies,
              overallScore
            }
          })}
          userIsPremium={userIsPremium}
        />
      </div>

      {/* Links para análises individuais */}
      <div className="mt-12">
        <Separator className="mb-6" />
        <h3 className="text-lg font-semibold mb-4">Análises Individuais Detalhadas</h3>
        <div className="flex flex-wrap gap-3">
          {orderedCompanies.map((company) => (
            <Button key={company.ticker} asChild variant="outline">
              <Link href={`/acao/${company.ticker}`}>
                <LineChart className="w-4 h-4 mr-2" />
                Análise Completa {company.ticker}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Schema Structured Data para SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": `Comparação ${tickers.join(' vs ')} - Análise Comparativa de Ações`,
            "description": `Análise comparativa detalhada entre as ações ${tickers.join(', ')} com indicadores financeiros, valuation e métricas fundamentalistas.`,
            "url": `https://preço-justo.ai/compara-acoes/${tickers.join('/')}`,
            "author": {
              "@type": "Organization",
              "name": "Preço Justo AI"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Preço Justo AI"
            },
            "datePublished": new Date().toISOString(),
            "dateModified": new Date().toISOString(),
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://preço-justo.ai/compara-acoes/${tickers.join('/')}`
            },
            "about": tickers.map(ticker => ({
              "@type": "Corporation",
              "tickerSymbol": ticker,
              "exchange": "B3"
            }))
          })
        }}
      />
    </div>
  )
}
