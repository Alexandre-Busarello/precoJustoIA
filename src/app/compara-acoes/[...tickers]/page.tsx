import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import React from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { analyzeFinancialStatements, FinancialStatementsData } from '@/lib/strategies/overall-score'
import { executeMultipleCompanyAnalysis } from '@/lib/company-analysis-service'
import Link from 'next/link'

// Shadcn UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ComparisonTable } from '@/components/comparison-table'

// Lucide Icons
import {
  Building2,
  PieChart,
  Eye,
  User,
  LineChart,
  ArrowRight,
  Lock,
  Crown,
  Trophy,
  Medal,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  Target,
  Activity
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
async function calculateWeightedScore(companies: Record<string, unknown>[]): Promise<{ scores: number[], bestIndex: number, tiedIndices: number[] }> {
  // Definir pesos para cada indicador (total = 100%)
  // NOTA: Estratégias individuais foram removidas pois já estão incluídas no overallScore
  const weights = {
    // Indicadores Básicos (30%)
    pl: 0.1,           // 10% - Valuation fundamental
    pvp: 0.05,          // 5% - Valor patrimonial
    roe: 0.1,          // 10% - Rentabilidade principal
    dy: 0.05,           // 5% - Dividendos
    
    // Indicadores Avançados (20%)
    margemLiquida: 0.08, // 8% - Eficiência operacional
    roic: 0.08,         // 8% - Retorno sobre capital
    dividaLiquidaEbitda: 0.04, // 4% - Endividamento
    
    // Score Geral (50%) - Peso principal pois inclui análise completa
    overallScore: 0.50,  // 50% - Análise consolidada (inclui Graham, DY, LowPE, Magic Formula, FCD, Gordon + Demonstrações)
  }
  
  const scores = await Promise.all(companies.map(async (company) => {
    let totalScore = 0
    let totalWeight = 0
    let penaltyFactor = 1.0 // Fator de penalização (1.0 = sem penalidade)
    
    // Executar estratégias para obter overallScore
    const dailyQuotes = company.dailyQuotes as Record<string, unknown>[]
    const financialData = company.financialData as Record<string, unknown>[]
    const currentPrice = toNumber(dailyQuotes?.[0]?.price as PrismaDecimal) || toNumber(financialData?.[0]?.lpa as PrismaDecimal) || 0
    const { overallScore } = await executeStrategiesForCompany(company, currentPrice, true)
    
    // PENALIZAÇÃO 1: Empresas com valor de mercado menor que 2B
    const companyFinancialData = financialData?.[0] as Record<string, unknown>
    if (companyFinancialData) {
      const marketCap = toNumber(companyFinancialData.valorMercado as PrismaDecimal) || 0
      if (marketCap > 0 && marketCap < 2000000000) { // 2 bilhões
        penaltyFactor *= 0.8 // Penalidade de 20%
        console.log(`Penalidade valor de mercado aplicada para ${company.ticker}: R$ ${(marketCap / 1000000).toFixed(0)}M`)
      }
    }
    
    // PENALIZAÇÃO 2: Score Geral menor que 50,70 e 80
    if (overallScore?.score && overallScore.score < 50) {
      penaltyFactor *= 0.6 // Penalidade de 40%
      console.log(`Penalidade de 40% para score geral aplicada para ${company.ticker}: ${overallScore.score.toFixed(1)}`)
    }
    if (overallScore?.score && overallScore.score < 70) {
      penaltyFactor *= 0.7 // Penalidade de 30%
      console.log(`Penalidade de 30% para score geral aplicada para ${company.ticker}: ${overallScore.score.toFixed(1)}`)
    }
    if (overallScore?.score && overallScore.score < 80) {
      penaltyFactor *= 0.8 // Penalidade de 20%
      console.log(`Penalidade de 10% para score geral aplicada para ${company.ticker}: ${overallScore.score.toFixed(1)}`)
    }
    
    // PENALIZAÇÃO 3: Indicadores ausentes (N/A) ou super inflados
    let missingIndicators = 0
    let inflatedIndicators = 0
    
    if (companyFinancialData) {
      // Verificar indicadores críticos
      const criticalIndicators = [
        { key: 'pl', value: toNumber(companyFinancialData.pl as PrismaDecimal), maxInflated: 100 },
        { key: 'pvp', value: toNumber(companyFinancialData.pvp as PrismaDecimal), maxInflated: 10 },
        { key: 'roe', value: toNumber(companyFinancialData.roe as PrismaDecimal), maxInflated: 1 }, // 100%
        { key: 'dy', value: toNumber(companyFinancialData.dy as PrismaDecimal), maxInflated: 0.3 }, // 30%
        { key: 'margemLiquida', value: toNumber(companyFinancialData.margemLiquida as PrismaDecimal), maxInflated: 1 }, // 100%
        { key: 'roic', value: toNumber(companyFinancialData.roic as PrismaDecimal), maxInflated: 1 }, // 100%
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
    
    // PENALIZAÇÃO 4: Risco nas demonstrações financeiras
    try {
      const statementsAnalysis = await getStatementsAnalysisForCompany(company.ticker as string)
      if (statementsAnalysis) {
        switch (statementsAnalysis.riskLevel) {
          case 'CRITICAL':
            penaltyFactor *= 0.5 // Penalidade de 50%
            console.log(`Penalidade CRÍTICA por demonstrações aplicada para ${company.ticker}: risco ${statementsAnalysis.riskLevel}, score ${statementsAnalysis.score}`)
            break
          case 'HIGH':
            penaltyFactor *= 0.9 // Penalidade de 10%
            console.log(`Penalidade ALTA por demonstrações aplicada para ${company.ticker}: risco ${statementsAnalysis.riskLevel}, score ${statementsAnalysis.score}`)
            break
          case 'MEDIUM':
            penaltyFactor *= 0.95 // Penalidade de 5%
            console.log(`Penalidade MODERADA por demonstrações aplicada para ${company.ticker}: risco ${statementsAnalysis.riskLevel}, score ${statementsAnalysis.score}`)
            break
          // LOW não recebe penalidade
        }
      }
    } catch (error) {
      console.error(`Erro ao analisar demonstrações para penalização de ${company.ticker}:`, error)
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
    const allPL = companies.map(c => toNumber((c.financialData as Record<string, unknown>[])?.[0]?.pl as PrismaDecimal))
    const allPVP = companies.map(c => toNumber((c.financialData as Record<string, unknown>[])?.[0]?.pvp as PrismaDecimal))
    const allROE = companies.map(c => toNumber((c.financialData as Record<string, unknown>[])?.[0]?.roe as PrismaDecimal))
    const allDY = companies.map(c => toNumber((c.financialData as Record<string, unknown>[])?.[0]?.dy as PrismaDecimal))
    const allMargemLiquida = companies.map(c => toNumber((c.financialData as Record<string, unknown>[])?.[0]?.margemLiquida as PrismaDecimal))
    const allROIC = companies.map(c => toNumber((c.financialData as Record<string, unknown>[])?.[0]?.roic as PrismaDecimal))
    const allDividaEbitda = companies.map(c => toNumber((c.financialData as Record<string, unknown>[])?.[0]?.dividaLiquidaEbitda as PrismaDecimal))
    
    // Calcular scores dos indicadores básicos
    if (companyFinancialData) {
      totalScore += scoreIndicator(allPL, toNumber(companyFinancialData.pl as PrismaDecimal), weights.pl, false, 'pl') // Menor P/L é melhor
      totalScore += scoreIndicator(allPVP, toNumber(companyFinancialData.pvp as PrismaDecimal), weights.pvp, false, 'pvp') // Menor P/VP é melhor
      totalScore += scoreIndicator(allROE, toNumber(companyFinancialData.roe as PrismaDecimal), weights.roe, true, 'roe') // Maior ROE é melhor
      totalScore += scoreIndicator(allDY, toNumber(companyFinancialData.dy as PrismaDecimal), weights.dy, true, 'dy') // Maior DY é melhor
      totalScore += scoreIndicator(allMargemLiquida, toNumber(companyFinancialData.margemLiquida as PrismaDecimal), weights.margemLiquida, true, 'margemLiquida')
      totalScore += scoreIndicator(allROIC, toNumber(companyFinancialData.roic as PrismaDecimal), weights.roic, true, 'roic')
      totalScore += scoreIndicator(allDividaEbitda, toNumber(companyFinancialData.dividaLiquidaEbitda as PrismaDecimal), weights.dividaLiquidaEbitda, false, 'dividaLiquidaEbitda')
      
      totalWeight += weights.pl + weights.pvp + weights.roe + weights.dy + weights.margemLiquida + weights.roic + weights.dividaLiquidaEbitda
    }
    
    // Score geral
    if (overallScore?.score) {
      const allOverallScores = await Promise.all(companies.map(async c => {
        const cDailyQuotes = c.dailyQuotes as Record<string, unknown>[]
        const cFinancialData = c.financialData as Record<string, unknown>[]
        const price = toNumber(cDailyQuotes?.[0]?.price as PrismaDecimal) || toNumber(cFinancialData?.[0]?.lpa as PrismaDecimal) || 0
        const { overallScore: os } = await executeStrategiesForCompany(c, price, true)
        return os?.score || null
      }))
      totalScore += scoreIndicator(allOverallScores, overallScore.score, weights.overallScore, true, 'overallScore')
      totalWeight += weights.overallScore
    }
    
    // Estratégias individuais removidas - já incluídas no overallScore
    // (Graham, DividendYield, LowPE, MagicFormula, FCD, Gordon já estão no overallScore)
    
    // Normalizar pela soma dos pesos utilizados e aplicar penalidades
    const baseScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0
    const finalScore = baseScore * penaltyFactor
    
    // Log do score final com penalidades
    if (penaltyFactor < 1.0) {
      console.log(`Score final para ${company.ticker}: ${baseScore.toFixed(2)} -> ${finalScore.toFixed(2)} (penalidade: ${((1 - penaltyFactor) * 100).toFixed(0)}%)`)
    }
    
    return finalScore
  }))
  
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
    console.log('Scores:', companies.map((c, i) => {
      const financialData = (c.financialData as Record<string, unknown>[])?.[0];
      const marketCapValue = toNumber(financialData?.valorMercado as PrismaDecimal) || 0;
      return {
        ticker: c.ticker, 
        score: scores[i].toFixed(2),
        marketCap: `R$ ${(marketCapValue / 1000000).toFixed(0)}M`
      };
    }))
    console.log('Best score:', maxScore.toFixed(2))
    console.log('Winner:', bestIndex !== -1 ? companies[bestIndex].ticker : 'Tie')
    console.log('Tied companies:', tiedIndices.length > 1 ? tiedIndices.map(i => companies[i].ticker) : 'None')
    console.log('=== END DEBUG ===')
  }
  
  return { scores, bestIndex, tiedIndices }
}

// Função para obter análise das demonstrações financeiras
async function getStatementsAnalysisForCompany(ticker: string) {
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 2; // Últimos 2 anos

    // Buscar dados da empresa primeiro
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        sector: true,
        industry: true
      }
    });

    const [incomeStatements, balanceSheets, cashflowStatements] = await Promise.all([
      prisma.incomeStatement.findMany({
        where: {
          company: { ticker },
          period: 'QUARTERLY',
          endDate: {
            gte: new Date(`${startYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        orderBy: { endDate: 'desc' },
        take: 8
      }),
      prisma.balanceSheet.findMany({
        where: {
          company: { ticker },
          period: 'QUARTERLY',
          endDate: {
            gte: new Date(`${startYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        orderBy: { endDate: 'desc' },
        take: 8
      }),
      prisma.cashflowStatement.findMany({
        where: {
          company: { ticker },
          period: 'QUARTERLY',
          endDate: {
            gte: new Date(`${startYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        orderBy: { endDate: 'desc' },
        take: 8
      })
    ]);

    if (incomeStatements.length === 0 && balanceSheets.length === 0 && cashflowStatements.length === 0) {
      return null;
    }

    // Serializar dados para análise
    const statementsData: FinancialStatementsData = {
      incomeStatements: incomeStatements.map(stmt => ({
        endDate: stmt.endDate.toISOString(),
        totalRevenue: stmt.totalRevenue?.toNumber() || null,
        operatingIncome: stmt.operatingIncome?.toNumber() || null,
        netIncome: stmt.netIncome?.toNumber() || null,
        grossProfit: stmt.grossProfit?.toNumber() || null,
      })),
      balanceSheets: balanceSheets.map(stmt => ({
        endDate: stmt.endDate.toISOString(),
        totalAssets: stmt.totalAssets?.toNumber() || null,
        totalLiab: stmt.totalLiab?.toNumber() || null,
        totalStockholderEquity: stmt.totalStockholderEquity?.toNumber() || null,
        cash: stmt.cash?.toNumber() || null,
        totalCurrentAssets: stmt.totalCurrentAssets?.toNumber() || null,
        totalCurrentLiabilities: stmt.totalCurrentLiabilities?.toNumber() || null,
      })),
      cashflowStatements: cashflowStatements.map(stmt => ({
        endDate: stmt.endDate.toISOString(),
        operatingCashFlow: stmt.operatingCashFlow?.toNumber() || null,
        investmentCashFlow: stmt.investmentCashFlow?.toNumber() || null,
        financingCashFlow: stmt.financingCashFlow?.toNumber() || null,
        increaseOrDecreaseInCash: stmt.increaseOrDecreaseInCash?.toNumber() || null,
      })),
      company: company ? {
        sector: company.sector,
        industry: company.industry,
        marketCap: null // MarketCap será obtido de outra fonte se necessário
      } : undefined
    };

    return analyzeFinancialStatements(statementsData);
  } catch (error) {
    console.error(`Erro ao analisar demonstrações para ${ticker}:`, error);
    return null;
  }
}

// Função para executar estratégias e calcular score geral usando serviço centralizado
async function executeStrategiesForCompany(company: Record<string, unknown>, currentPrice: number, userIsPremium: boolean) {
  try {
    const companyForAnalysis = {
      ticker: company.ticker as string,
      name: company.name as string,
      sector: company.sector as string | null,
      industry: company.industry as string | null,
      id: company.id as string,
      financialData: company.financialData as Record<string, unknown>[],
      dailyQuotes: company.dailyQuotes as Record<string, unknown>[]
    };

    // Usar o serviço centralizado para análise
    const results = await executeMultipleCompanyAnalysis([companyForAnalysis], {
      isLoggedIn: true, // Assumir logado para comparação
      isPremium: userIsPremium,
      includeStatements: true // Sempre incluir demonstrações para consistência
    });

    const result = results[0];
    return { 
      strategies: result.strategies, 
      overallScore: result.overallScore 
    };
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
  icon: React.ComponentType<{ className?: string }>
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

  // Buscar dados das empresas com consulta otimizada
  const companiesData = await prisma.company.findMany({
    where: { 
      ticker: { in: tickers }
    },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
      industry: true,
      logoUrl: true,
      city: true,
      state: true,
      website: true,
      fullTimeEmployees: true,
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

  // Organizar dados na ordem dos tickers solicitados (inicialmente)
  const initialOrderedCompanies = tickers.map(ticker => 
    companiesData.find(c => c.ticker === ticker)!
  )

  // Calcular scores e ordenar por ranking
  const { scores } = await calculateWeightedScore(initialOrderedCompanies)
  
  // Criar array com empresas e seus scores para ordenação
  const companiesWithScores = initialOrderedCompanies.map((company, index) => ({
    company,
    score: scores[index],
    originalIndex: index
  }))
  
  // Ordenar por score (maior para menor)
  companiesWithScores.sort((a, b) => b.score - a.score)
  
  // Extrair empresas ordenadas por score
  const orderedCompanies = companiesWithScores.map(item => item.company)
  
  // Calcular empates com tolerância de 0.1 pontos
  const tolerance = 0.1
  const maxScore = companiesWithScores[0]?.score || 0
  const tiedCompaniesIndices = companiesWithScores
    .map((item, index) => ({ score: item.score, index }))
    .filter(item => Math.abs(item.score - maxScore) <= tolerance)
    .map(item => item.index)

  // Debug melhorado para mostrar ranking com empates
  if (companiesWithScores.length <= 6) {
    console.log('=== RANKING COM EMPATES DEBUG ===')
    console.log('Empresas ordenadas por score:')
    companiesWithScores.forEach((item, index) => {
      const isTied = tiedCompaniesIndices.includes(index)
      const position = isTied ? `#1 (empate)` : `#${index + 1}`
      console.log(`${position} ${item.company.ticker}: ${item.score.toFixed(2)} pontos${isTied ? ' 🏆' : ''}`)
    })
    console.log(`Tolerância para empates: ${tolerance} pontos`)
    console.log(`Empresas empatadas na liderança: ${tiedCompaniesIndices.length > 1 ? tiedCompaniesIndices.map(i => companiesWithScores[i].company.ticker).join(', ') : 'Nenhuma'}`)
    console.log('=== END RANKING DEBUG ===')
  }

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
        {orderedCompanies.map((company, companyIndex) => {
            const latestFinancials = company.financialData[0]
            const latestQuote = company.dailyQuotes[0]
            const currentPrice = toNumber(latestQuote?.price) || toNumber(latestFinancials?.lpa) || 0
            
            // Determinar medalha baseada na posição e empates - APENAS para usuários premium
            const getMedal = (index: number) => {
              // Medalhas são um recurso exclusivo premium
              if (!userIsPremium) {
                return null
              }

              // Verificar se está empatado na primeira posição (Ouro)
              if (tiedCompaniesIndices.includes(index)) {
                return { 
                  icon: Trophy, 
                  color: 'text-yellow-600', 
                  bg: 'bg-gradient-to-br from-yellow-50 to-yellow-100', 
                  border: 'border-yellow-300', 
                  label: tiedCompaniesIndices.length > 1 ? 'Empate Ouro' : 'Ouro', 
                  rank: 1,
                  medalBg: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
                  badgeStyle: 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg',
                  ringStyle: 'ring-yellow-300 shadow-yellow-200/50'
                }
              } else if (index === tiedCompaniesIndices.length) { // Primeira posição após empates (Prata)
                return { 
                  icon: Medal, 
                  color: 'text-slate-600', 
                  bg: 'bg-gradient-to-br from-slate-50 to-slate-100', 
                  border: 'border-slate-300', 
                  label: 'Prata', 
                  rank: tiedCompaniesIndices.length + 1,
                  medalBg: 'bg-gradient-to-br from-slate-300 to-slate-500',
                  badgeStyle: 'bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-lg',
                  ringStyle: 'ring-slate-300 shadow-slate-200/50'
                }
              } else if (index === tiedCompaniesIndices.length + 1) { // Segunda posição após empates (Bronze)
                return { 
                  icon: Medal, 
                  color: 'text-orange-600', 
                  bg: 'bg-gradient-to-br from-orange-50 to-orange-100', 
                  border: 'border-orange-300', 
                  label: 'Bronze', 
                  rank: tiedCompaniesIndices.length + 2,
                  medalBg: 'bg-gradient-to-br from-orange-400 to-orange-600',
                  badgeStyle: 'bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-lg',
                  ringStyle: 'ring-orange-300 shadow-orange-200/50'
                }
              }
              
              return null
            }
            
            const medal = getMedal(companyIndex)

            // Determinar se é a empresa campeã (empatadas na primeira posição ou primeira única)
            const isBestCompany = userIsPremium && tiedCompaniesIndices.includes(companyIndex)

          return (
            <Card key={company.ticker} className={`relative transition-all duration-300 hover:scale-105 ${medal ? `ring-2 ${medal.border} shadow-xl ${medal.bg} ${medal.ringStyle}` : 'hover:shadow-lg'}`}>
              {medal && (
                <div className="absolute -top-3 -right-3 z-10">
                  <div className={`${medal.medalBg} rounded-full p-3 shadow-xl border-2 border-white transform rotate-12 hover:rotate-0 transition-transform duration-300`}>
                    <medal.icon className="w-5 h-5 text-white drop-shadow-sm" />
                  </div>
                </div>
              )}
              {medal && (
                <div className="absolute -top-2 -left-2 z-10">
                  <Badge className={`${medal.badgeStyle} border-0 text-xs font-bold px-3 py-1 transform -rotate-3 hover:rotate-0 transition-transform duration-300`}>
                    #{medal.rank} {medal.label}
                  </Badge>
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
                        <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs shadow-md border-0 animate-pulse">
                          <Crown className="w-3 h-3 mr-1" />
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
        })}
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
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={DollarSign}
              description="Quanto o mercado paga por cada R$ 1 de lucro"
            />

            <ComparisonIndicatorCard
              title="P/VP (Preço/Valor Patrimonial)"
              values={orderedCompanies.map(c => {
                const pvp = toNumber(c.financialData[0]?.pvp)
                return pvp ? pvp.toFixed(2) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={Building2}
              description="Relação entre preço da ação e valor patrimonial"
            />

            <ComparisonIndicatorCard
              title="ROE (Retorno sobre Patrimônio)"
              values={orderedCompanies.map(c => {
                const roe = toNumber(c.financialData[0]?.roe)
                return roe ? formatPercent(roe) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={TrendingUp}
              description="Capacidade de gerar lucro com o patrimônio"
            />

            <ComparisonIndicatorCard
              title="Dividend Yield"
              values={orderedCompanies.map(c => {
                const dy = toNumber(c.financialData[0]?.dy)
                return dy ? formatPercent(dy) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={Percent}
              description="Rendimento anual em dividendos"
            />

            <ComparisonIndicatorCard
              title="Margem Líquida"
              values={orderedCompanies.map(c => {
                const ml = toNumber(c.financialData[0]?.margemLiquida)
                return ml ? formatPercent(ml) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
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
              tickers={orderedCompanies.map(c => c.ticker)}
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
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={DollarSign}
              description="Valor total da empresa no mercado"
            />

            <ComparisonIndicatorCard
              title="Receita Total"
              values={orderedCompanies.map(c => {
                const receita = toNumber(c.financialData[0]?.receitaTotal)
                return receita ? formatLargeNumber(receita) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={TrendingUp}
              description="Faturamento anual da empresa"
            />

            <ComparisonIndicatorCard
              title="Lucro Líquido"
              values={orderedCompanies.map(c => {
                const lucro = toNumber(c.financialData[0]?.lucroLiquido)
                return lucro ? formatLargeNumber(lucro) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
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
              tickers={orderedCompanies.map(c => c.ticker)}
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
              tickers={orderedCompanies.map(c => c.ticker)}
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
              tickers={orderedCompanies.map(c => c.ticker)}
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
          companies={await Promise.all(orderedCompanies.map(async company => {
            const currentPrice = toNumber(company.dailyQuotes[0]?.price) || toNumber(company.financialData[0]?.lpa) || 0
            const { strategies, overallScore } = await executeStrategiesForCompany(company, currentPrice, userIsPremium)
            
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
          }))}
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
