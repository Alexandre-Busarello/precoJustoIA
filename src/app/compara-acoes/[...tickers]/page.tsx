import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import React from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { CompanySizeBadge } from '@/components/company-size-badge'
import { analyzeFinancialStatements } from '@/lib/strategies/overall-score'
import { executeMultipleCompanyAnalysis, getStatementsData } from '@/lib/company-analysis-service'
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

// Função para calcular média histórica de um indicador
function calculateHistoricalAverage(financialDataArray: Record<string, unknown>[], fieldName: string): number | null {
  if (!financialDataArray || financialDataArray.length === 0) return null
  
  // Pegar até 7 anos de dados históricos (excluindo o primeiro que é atual)
  const historicalData = financialDataArray.slice(1, 8)
  const validValues = historicalData
    .map(data => toNumber(data[fieldName] as PrismaDecimal))
    .filter(val => val !== null && !isNaN(val as number)) as number[]
  
  if (validValues.length === 0) return null
  
  const sum = validValues.reduce((acc, val) => acc + val, 0)
  return sum / validValues.length
}

// Cache para estratégias calculadas (válido por 10 minutos)
const strategiesCache = new Map<string, { data: any; timestamp: number }>();
const STRATEGIES_CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

// Cache para análise de demonstrações (válido por 15 minutos)
const statementsAnalysisCache = new Map<string, { data: any; timestamp: number }>();
const STATEMENTS_ANALYSIS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

// Sistema de pontuação ponderada para determinar a melhor empresa (OTIMIZADO)
async function calculateWeightedScore(companies: Record<string, unknown>[]): Promise<{ scores: number[], bestIndex: number, tiedIndices: number[] }> {
  // Definir pesos para cada indicador (total = 100%)
  // NOTA: Estratégias individuais foram removidas pois já estão incluídas no overallScore
  const weights = {
    // Indicadores Básicos (25%)
    pl: 0.05,           // 5% - Valuation fundamental
    pvp: 0.015,          // 1.5% - Valor patrimonial
    roe: 0.05,          // 5% - Rentabilidade principal
    dy: 0.015,           // 1.5% - Dividendos
    
    // Indicadores Avançados (18%)
    margemLiquida: 0.015, // 1.5% - Eficiência operacional
    roic: 0.015,         // 1.5% - Retorno sobre capital
    dividaLiquidaEbitda: 0.015, // 1.5% - Endividamento
    
    // Indicadores de Crescimento (7%) - Influência leve conforme solicitado
    cagrLucros5a: 0.015,     // 1.5% - Crescimento histórico de lucros
    cagrReceitas5a: 0.015,   // 1.5% - Crescimento histórico de receitas
    crescimentoLucros: 0.015, // 1.5% - Crescimento recente de lucros
    crescimentoReceitas: 0.015, // 1.5% - Crescimento recente de receitas
    
    // Score Geral (50%) - Peso principal pois inclui análise completa
    overallScore: 0.765,  // 65% - Análise consolidada (inclui Graham, DY, LowPE, Magic Formula, FCD, Gordon + Demonstrações)
  }
  
  // OTIMIZAÇÃO 1: Executar todas as estratégias em paralelo primeiro
  console.time('Estratégias em paralelo');
  const companiesWithStrategies = await Promise.all(companies.map(async (company) => {
    const dailyQuotes = company.dailyQuotes as Record<string, unknown>[]
    const financialData = company.financialData as Record<string, unknown>[]
    const currentPrice = toNumber(dailyQuotes?.[0]?.price as PrismaDecimal) || toNumber(financialData?.[0]?.lpa as PrismaDecimal) || 0
    
    // Verificar cache primeiro
    const cacheKey = `strategies-${company.ticker}-${currentPrice}`;
    const cached = strategiesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STRATEGIES_CACHE_DURATION) {
      return { company, strategies: cached.data, currentPrice };
    }
    
    const strategies = await executeStrategiesForCompany(company, currentPrice, true);
    
    // Armazenar no cache
    strategiesCache.set(cacheKey, {
      data: strategies,
      timestamp: Date.now()
    });
    
    return { company, strategies, currentPrice };
  }));
  console.timeEnd('Estratégias em paralelo');

  // OTIMIZAÇÃO 2: Executar análise de demonstrações em paralelo
  console.time('Análise demonstrações em paralelo');
  const statementsAnalyses = await Promise.all(companies.map(async (company) => {
    const ticker = company.ticker as string;
    
    // Verificar cache primeiro
    const cached = statementsAnalysisCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < STATEMENTS_ANALYSIS_CACHE_DURATION) {
      return { ticker, analysis: cached.data };
    }
    
    const analysis = await getStatementsAnalysisForCompany(ticker);
    
    // Armazenar no cache
    statementsAnalysisCache.set(ticker, {
      data: analysis,
      timestamp: Date.now()
    });
    
    return { ticker, analysis };
  }));
  console.timeEnd('Análise demonstrações em paralelo');

  // Criar mapa para acesso rápido
  const statementsMap = new Map(statementsAnalyses.map(s => [s.ticker, s.analysis]));

  // OTIMIZAÇÃO 3: Calcular scores usando dados já carregados
  console.time('Cálculo de scores');
  const scores = companiesWithStrategies.map((companyData) => {
    const { company, strategies } = companyData;
    const { overallScore } = strategies;
    
    let totalScore = 0
    let totalWeight = 0
    let penaltyFactor = 1.0 // Fator de penalização (1.0 = sem penalidade)
    
    // PENALIZAÇÃO 1: Empresas com valor de mercado menor que 2B
    const financialData = company.financialData as Record<string, unknown>[]
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
      // Verificar indicadores críticos (com fallbacks)
      const keyStats = (company as any).keyStatistics?.[0];
      const criticalIndicators = [
        { 
          key: 'pl', 
          value: toNumber(companyFinancialData.pl as PrismaDecimal) ?? (keyStats?.forwardPE ? toNumber(keyStats.forwardPE) : null), 
          maxInflated: 100 
        },
        { 
          key: 'pvp', 
          value: toNumber(companyFinancialData.pvp as PrismaDecimal) ?? (keyStats?.priceToBook ? toNumber(keyStats.priceToBook) : null), 
          maxInflated: 10 
        },
        { 
          key: 'roe', 
          value: toNumber(companyFinancialData.roe as PrismaDecimal), 
          maxInflated: 1 
        }, // 100%
        { 
          key: 'dy', 
          value: toNumber(companyFinancialData.dy as PrismaDecimal) ?? (keyStats?.dividendYield ? toNumber(keyStats.dividendYield)! / 100 : null), 
          maxInflated: 0.3 
        }, // 30%
        { 
          key: 'margemLiquida', 
          value: toNumber(companyFinancialData.margemLiquida as PrismaDecimal), 
          maxInflated: 1 
        }, // 100%
        { 
          key: 'roic', 
          value: toNumber(companyFinancialData.roic as PrismaDecimal), 
          maxInflated: 1 
        }, // 100%
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
    
    // PENALIZAÇÃO 4: Risco nas demonstrações financeiras (usando dados já carregados)
    try {
      const statementsAnalysis = statementsMap.get(company.ticker as string)
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
    
    // Coletar todos os valores para normalização (usando dados já carregados)
    const allPL = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.pl as PrismaDecimal))
    const allPVP = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.pvp as PrismaDecimal))
    const allROE = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.roe as PrismaDecimal))
    const allDY = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.dy as PrismaDecimal))
    const allMargemLiquida = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.margemLiquida as PrismaDecimal))
    const allROIC = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.roic as PrismaDecimal))
    const allDividaEbitda = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.dividaLiquidaEbitda as PrismaDecimal))
    
    // Arrays para indicadores de crescimento
    const allCAGRLucros5a = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.cagrLucros5a as PrismaDecimal))
    const allCAGRReceitas5a = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.cagrReceitas5a as PrismaDecimal))
    const allCrescimentoLucros = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.crescimentoLucros as PrismaDecimal))
    const allCrescimentoReceitas = companiesWithStrategies.map(c => toNumber((c.company.financialData as Record<string, unknown>[])?.[0]?.crescimentoReceitas as PrismaDecimal))
    
    // Calcular scores dos indicadores básicos
    if (companyFinancialData) {
      totalScore += scoreIndicator(allPL, toNumber(companyFinancialData.pl as PrismaDecimal), weights.pl, false, 'pl') // Menor P/L é melhor
      totalScore += scoreIndicator(allPVP, toNumber(companyFinancialData.pvp as PrismaDecimal), weights.pvp, false, 'pvp') // Menor P/VP é melhor
      totalScore += scoreIndicator(allROE, toNumber(companyFinancialData.roe as PrismaDecimal), weights.roe, true, 'roe') // Maior ROE é melhor
      totalScore += scoreIndicator(allDY, toNumber(companyFinancialData.dy as PrismaDecimal), weights.dy, true, 'dy') // Maior DY é melhor
      totalScore += scoreIndicator(allMargemLiquida, toNumber(companyFinancialData.margemLiquida as PrismaDecimal), weights.margemLiquida, true, 'margemLiquida')
      totalScore += scoreIndicator(allROIC, toNumber(companyFinancialData.roic as PrismaDecimal), weights.roic, true, 'roic')
      totalScore += scoreIndicator(allDividaEbitda, toNumber(companyFinancialData.dividaLiquidaEbitda as PrismaDecimal), weights.dividaLiquidaEbitda, false, 'dividaLiquidaEbitda')
      
      // Indicadores de crescimento (influência leve)
      totalScore += scoreIndicator(allCAGRLucros5a, toNumber(companyFinancialData.cagrLucros5a as PrismaDecimal), weights.cagrLucros5a, true, 'cagrLucros5a')
      totalScore += scoreIndicator(allCAGRReceitas5a, toNumber(companyFinancialData.cagrReceitas5a as PrismaDecimal), weights.cagrReceitas5a, true, 'cagrReceitas5a')
      totalScore += scoreIndicator(allCrescimentoLucros, toNumber(companyFinancialData.crescimentoLucros as PrismaDecimal), weights.crescimentoLucros, true, 'crescimentoLucros')
      totalScore += scoreIndicator(allCrescimentoReceitas, toNumber(companyFinancialData.crescimentoReceitas as PrismaDecimal), weights.crescimentoReceitas, true, 'crescimentoReceitas')
      
      totalWeight += weights.pl + weights.pvp + weights.roe + weights.dy + weights.margemLiquida + weights.roic + weights.dividaLiquidaEbitda + weights.cagrLucros5a + weights.cagrReceitas5a + weights.crescimentoLucros + weights.crescimentoReceitas
    }
    
    // Score geral (usando dados já carregados)
    if (overallScore?.score) {
      const allOverallScores = companiesWithStrategies.map(c => c.strategies.overallScore?.score || null)
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
  })
  console.timeEnd('Cálculo de scores');
  
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
// Função otimizada para obter análise das demonstrações financeiras (usando serviço centralizado)
async function getStatementsAnalysisForCompany(ticker: string) {
  try {
    // Buscar dados da empresa primeiro
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        id: true,
        sector: true,
        industry: true
      }
    });

    if (!company) return null;

    // Usar a função otimizada do serviço centralizado que já tem cache e serialização
    const statementsData = await getStatementsData(
      company.id.toString(), 
      ticker, 
      company.sector, 
      company.industry
    );

    if (!statementsData) return null;

    return analyzeFinancialStatements(statementsData);
  } catch (error) {
    console.error(`Erro ao analisar demonstrações para ${ticker}:`, error);
    return null;
  }
}

// Função para executar estratégias e calcular score geral usando serviço centralizado
async function executeStrategiesForCompany(company: Record<string, unknown>, currentPrice: number, userIsPremium: boolean) {
  try {
    const financialDataArray = company.financialData as Record<string, unknown>[];
    
    // Preparar dados históricos financeiros (excluindo o primeiro que é o atual)
    // IMPORTANTE: Converter todos os Decimal para number para evitar erros de serialização
    const historicalFinancials = financialDataArray.slice(1).map(data => ({
      year: data.year as number,
      roe: toNumber(data.roe as PrismaDecimal),
      roic: toNumber(data.roic as PrismaDecimal),
      pl: toNumber(data.pl as PrismaDecimal),
      pvp: toNumber(data.pvp as PrismaDecimal),
      dy: toNumber(data.dy as PrismaDecimal),
      margemLiquida: toNumber(data.margemLiquida as PrismaDecimal),
      margemEbitda: toNumber(data.margemEbitda as PrismaDecimal),
      margemBruta: toNumber(data.margemBruta as PrismaDecimal),
      liquidezCorrente: toNumber(data.liquidezCorrente as PrismaDecimal),
      liquidezRapida: toNumber(data.liquidezRapida as PrismaDecimal),
      dividaLiquidaPl: toNumber(data.dividaLiquidaPl as PrismaDecimal),
      dividaLiquidaEbitda: toNumber(data.dividaLiquidaEbitda as PrismaDecimal),
      lpa: toNumber(data.lpa as PrismaDecimal),
      vpa: toNumber(data.vpa as PrismaDecimal),
      marketCap: toNumber(data.marketCap as PrismaDecimal),
      earningsYield: toNumber(data.earningsYield as PrismaDecimal),
      evEbitda: toNumber(data.evEbitda as PrismaDecimal),
      roa: toNumber(data.roa as PrismaDecimal),
      passivoAtivos: toNumber(data.passivoAtivos as PrismaDecimal)
    }));

    const companyForAnalysis = {
      ticker: company.ticker as string,
      name: company.name as string,
      sector: company.sector as string | null,
      industry: company.industry as string | null,
      id: company.id as string,
      financialData: financialDataArray,
      dailyQuotes: company.dailyQuotes as Record<string, unknown>[],
      historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined
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

// Componente híbrido para indicador com dados atuais e médias históricas
function ComparisonIndicatorCard({ 
  title, 
  values, 
  tickers,
  icon: Icon, 
  description,
  isPremium = false,
  userIsPremium = false,
  higherIsBetter = true,
  companies,
  fieldName
}: {
  title: string
  values: (string | number)[]
  tickers: string[]
  icon: React.ComponentType<{ className?: string }>
  description?: string
  isPremium?: boolean
  userIsPremium?: boolean
  higherIsBetter?: boolean
  companies?: any[]
  fieldName?: string
}) {
  const shouldBlur = isPremium && !userIsPremium
  
  // Calcular médias históricas se dados estiverem disponíveis
  const historicalAverages = companies && fieldName ? 
    companies.map(company => calculateHistoricalAverage(company.financialData, fieldName)) : 
    null

  // Converter valores atuais para números para ranking
  const numericValues = values.map(v => {
    if (v === 'N/A' || v === null || v === undefined) return null
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      // Remover símbolos de moeda e porcentagem para conversão
      const cleanValue = v.replace(/[R$%\s]/g, '').replace(',', '.')
      const parsed = parseFloat(cleanValue)
      // Se o valor original tinha %, converter para decimal (dividir por 100)
      const isPercentage = v.includes('%')
      return isNaN(parsed) ? null : (isPercentage ? parsed / 100 : parsed)
    }
    return null
  })

  // Criar array com dados para ordenação (usar médias históricas para ranking se disponível)
  const dataForRanking = tickers.map((ticker, index) => ({
    ticker,
    currentValue: values[index],
    currentNumeric: numericValues[index],
    historicalAverage: historicalAverages?.[index] || null,
    // Usar média histórica para ranking se disponível, senão usar valor atual
    rankingValue: historicalAverages?.[index] || numericValues[index],
    originalIndex: index
  }))

  // Apenas ordenar e rankear para usuários premium
  let sortedData = dataForRanking
  
  if (userIsPremium) {
    // Filtrar apenas valores válidos para ranking
    const validData = dataForRanking.filter(item => item.rankingValue !== null)
    
    // Ordenar baseado em higherIsBetter usando rankingValue (média histórica ou atual)
    validData.sort((a, b) => {
      if (higherIsBetter) {
        return b.rankingValue! - a.rankingValue!
      } else {
        return a.rankingValue! - b.rankingValue!
      }
    })

    // Adicionar dados inválidos no final
    const invalidData = dataForRanking.filter(item => item.rankingValue === null)
    sortedData = [...validData, ...invalidData]
  }

  // Função para obter medalha e estilo baseado na posição
  const getRankInfo = (position: number, hasValidValue: boolean) => {
    if (!hasValidValue || !userIsPremium) return null
    
    switch (position) {
      case 0: // Primeiro lugar
        return {
          medal: Trophy,
          bgColor: 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20',
          borderColor: 'border-yellow-300 dark:border-yellow-600',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          medalColor: 'text-yellow-600',
          rank: '1º',
          label: 'Ouro'
        }
      case 1: // Segundo lugar
        return {
          medal: Medal,
          bgColor: 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20',
          borderColor: 'border-slate-300 dark:border-slate-600',
          textColor: 'text-slate-800 dark:text-slate-200',
          medalColor: 'text-slate-600',
          rank: '2º',
          label: 'Prata'
        }
      case 2: // Terceiro lugar
        return {
          medal: Medal,
          bgColor: 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
          borderColor: 'border-orange-300 dark:border-orange-600',
          textColor: 'text-orange-800 dark:text-orange-200',
          medalColor: 'text-orange-600',
          rank: '3º',
          label: 'Bronze'
        }
      default:
        return null
    }
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-3 p-4 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 min-w-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-sm font-medium truncate flex-1">{title}</CardTitle>
            {isPremium && (
              <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          {(historicalAverages || (!userIsPremium && !isPremium)) && (
            <div className="flex items-center justify-start gap-2 flex-wrap">
              {historicalAverages && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  <span className="hidden xl:inline">Ranking por Média 7a</span>
                  <span className="hidden lg:inline xl:hidden">Ranking 7a</span>
                  <span className="hidden md:inline lg:hidden">Média 7a</span>
                  <span className="md:hidden">7a</span>
                </Badge>
              )}
              {!userIsPremium && !isPremium && (
                <div className="flex items-center space-x-1">
                  <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    <span className="hidden sm:inline">Ranking Premium</span>
                    <span className="sm:hidden">Premium</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        )}
        {!userIsPremium && !isPremium && (
          <p className="text-xs text-blue-600 mt-1">
            💎 Upgrade para ver ranking e medalhas
          </p>
        )}
      </CardHeader>
      <CardContent className={`space-y-3 p-4 sm:p-6 pt-0 ${shouldBlur ? 'blur-sm' : ''}`}>
        {sortedData.map((item, position) => {
          const rankInfo = getRankInfo(position, item.rankingValue !== null)
          const Medal = rankInfo?.medal
          
          // Formatar valores para exibição
          const formatValue = (val: number | null, fieldName?: string) => {
            if (val === null) return 'N/A'
            
            // Formatação específica por tipo de campo
            switch (fieldName) {
              case 'marketCap':
              case 'receitaTotal':
              case 'lucroLiquido':
                if (val >= 1_000_000_000) return `R$ ${(val / 1_000_000_000).toFixed(1)}B`
                if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`
                return `R$ ${(val / 1_000).toFixed(1)}K`
              
              case 'roe':
              case 'roic':
              case 'dy':
              case 'margemLiquida':
              case 'margemEbitda':
              case 'cagrLucros5a':
              case 'cagrReceitas5a':
              case 'crescimentoLucros':
              case 'crescimentoReceitas':
                return `${(val * 100).toFixed(1)}%`
              
              case 'pl':
              case 'pvp':
              case 'dividaLiquidaEbitda':
              case 'dividaLiquidaPl':
              case 'liquidezCorrente':
                return val.toFixed(2)
              
              default:
                return val.toFixed(2)
            }
          }
          
          
          return (
            <div 
              key={item.ticker} 
              className={`flex justify-between items-center min-w-0 p-2 rounded-lg transition-all duration-200 ${
                rankInfo ? `${rankInfo.bgColor} ${rankInfo.borderColor} border` : ''
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                {rankInfo && Medal && (
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <Medal className={`w-4 h-4 ${rankInfo.medalColor}`} />
                    <span className={`text-xs font-bold ${rankInfo.textColor}`}>
                      {rankInfo.rank}
                    </span>
                  </div>
                )}
                <span className={`text-sm font-medium truncate ${
                  rankInfo ? `${rankInfo.textColor} font-semibold` : ''
                }`}>
                  {item.ticker}
                </span>
              </div>
              
              {/* Mostrar dados híbridos se disponível */}
              {historicalAverages && item.historicalAverage !== null ? (
                <div className={`text-right flex-shrink-0 ${
                  rankInfo ? `${rankInfo.textColor}` : ''
                }`}>
                  <div className="text-sm font-bold">
                    {item.currentValue}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Média 7a: {formatValue(item.historicalAverage, fieldName)}
                  </div>
                </div>
              ) : (
                <span className={`text-sm flex-shrink-0 ${
                  rankInfo ? `${rankInfo.textColor} font-semibold` : ''
                }`}>
                  {item.currentValue || 'N/A'}
                </span>
              )}
            </div>
          )
        })}
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
  const tickersParam = resolvedParams.tickers // Manter tickers originais da URL
  const tickers = tickersParam.map(t => t.toUpperCase()) // Converter para maiúsculo apenas para consulta no BD
  
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
        url: `/compara-acoes/${tickersParam.map(t => t.toLowerCase()).join('/')}`,
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
        canonical: `/compara-acoes/${tickersParam.map(t => t.toLowerCase()).join('/')}`,
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
        canonical: `/compara-acoes/${tickersParam.map(t => t.toLowerCase()).join('/')}`,
      }
    }
  }
}

export default async function CompareStocksPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickersParam = resolvedParams.tickers // Manter tickers originais da URL
  const tickers = tickersParam.map(t => t.toUpperCase()) // Converter para maiúsculo apenas para consulta no BD

  // Validar se há pelo menos 2 tickers
  if (tickers.length < 2) {
    notFound()
  }

  // Verificar sessão do usuário para recursos premium
  const session = await getServerSession(authOptions)
  let userIsPremium = false

  // Verificar se é Premium - ÚNICA FONTE DA VERDADE
  if (session?.user?.id) {
    const user = await getCurrentUser()
    userIsPremium = user?.isPremium || false
  }

  // Buscar dados das empresas com consulta otimizada (incluindo dados históricos)
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
        take: 8 // Dados atuais + até 7 anos históricos para médias
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1
      },
      keyStatistics: {
        orderBy: { endDate: 'desc' },
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
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Comparação de Ações</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {tickers.map((ticker, index) => (
            <div key={ticker} className="flex items-center">
              <Badge variant="outline" className="text-sm sm:text-base lg:text-lg px-2 sm:px-3 py-1">
                {ticker}
              </Badge>
              {index < tickers.length - 1 && (
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 mx-1 sm:mx-2 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        <p className="text-sm sm:text-base text-muted-foreground">
          Análise comparativa detalhada entre {tickers.length} ações da B3
        </p>
      </div>

      {/* Cards das Empresas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
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
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 mb-4">
                  <div className="flex-shrink-0 self-center sm:self-start">
                    <CompanyLogo
                      logoUrl={company.logoUrl}
                      companyName={company.name}
                      ticker={company.ticker}
                      size={60}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-2">
                      <h3 className="text-lg sm:text-xl font-bold truncate">{company.ticker}</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs w-fit">
                          {company.sector || 'N/A'}
                        </Badge>
                        <CompanySizeBadge 
                          marketCap={toNumber(latestFinancials?.marketCap)} 
                          size="sm"
                          className="text-xs"
                        />
                        {isBestCompany && (
                          <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs shadow-md border-0 animate-pulse w-fit">
                            <Crown className="w-3 h-3 mr-1" />
                            <span className="hidden sm:inline">Destaque</span>
                            <span className="sm:hidden">Top</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p 
                      className="text-sm text-muted-foreground mb-2 leading-tight"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word'
                      }}
                    >
                      {company.name}
                    </p>
                    <p className="text-base sm:text-lg font-bold text-green-600">
                      {formatCurrency(currentPrice)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  {company.industry && (
                    <div className="flex items-center space-x-2 min-w-0">
                      <PieChart className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{company.industry}</span>
                    </div>
                  )}
                  
                  {(company.city || company.state) && (
                    <div className="flex items-center space-x-2 min-w-0">
                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">
                        {[company.city, company.state].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  {company.fullTimeEmployees && (
                    <div className="flex items-center space-x-2 min-w-0">
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{company.fullTimeEmployees.toLocaleString()} funcionários</span>
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
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center mb-2">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 mr-2 flex-shrink-0" />
              <span className="truncate">Indicadores Fundamentalistas</span>
            </h2>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 whitespace-nowrap">
              <span className="hidden sm:inline">Ranking por Médias Históricas</span>
              <span className="sm:hidden">Médias Históricas</span>
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <ComparisonIndicatorCard
              title="P/L (Preço/Lucro)"
              values={orderedCompanies.map(c => {
                const pl = toNumber(c.financialData[0]?.pl) ?? toNumber(c.keyStatistics[0]?.forwardPE)
                return pl ? pl.toFixed(2) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={DollarSign}
              description="Quanto o mercado paga por cada R$ 1 de lucro"
              higherIsBetter={false}
              userIsPremium={userIsPremium}
              companies={orderedCompanies}
              fieldName="pl"
            />

            <ComparisonIndicatorCard
              title="P/VP (Preço/Valor Patrimonial)"
              values={orderedCompanies.map(c => {
                const pvp = toNumber(c.financialData[0]?.pvp) ?? toNumber(c.keyStatistics[0]?.priceToBook)
                return pvp ? pvp.toFixed(2) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={Building2}
              description="Relação entre preço da ação e valor patrimonial"
              higherIsBetter={false}
              userIsPremium={userIsPremium}
              companies={orderedCompanies}
              fieldName="pvp"
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
              higherIsBetter={true}
              userIsPremium={userIsPremium}
              companies={orderedCompanies}
              fieldName="roe"
            />

            <ComparisonIndicatorCard
              title="Dividend Yield"
              values={orderedCompanies.map(c => {
                const dy = toNumber(c.financialData[0]?.dy) ?? (toNumber(c.keyStatistics[0]?.dividendYield) ? toNumber(c.keyStatistics[0]?.dividendYield)! / 100 : null)
                return dy ? formatPercent(dy) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={Percent}
              description="Rendimento anual em dividendos"
              higherIsBetter={true}
              userIsPremium={userIsPremium}
              companies={orderedCompanies}
              fieldName="dy"
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
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="margemLiquida"
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
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="roic"
            />
          </div>
        </div>

        {/* Indicadores de Tamanho */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 flex-shrink-0" />
            <span className="truncate">Tamanho e Escala</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <ComparisonIndicatorCard
              title="Valor de Mercado"
              values={orderedCompanies.map(c => {
                const marketCap = toNumber(c.financialData[0]?.marketCap)
                return marketCap ? formatLargeNumber(marketCap) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={DollarSign}
              description="Valor total da empresa no mercado"
              higherIsBetter={true}
              userIsPremium={userIsPremium}
              companies={orderedCompanies}
              fieldName="marketCap"
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
              higherIsBetter={true}
              userIsPremium={userIsPremium}
              companies={orderedCompanies}
              fieldName="receitaTotal"
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
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="lucroLiquido"
            />
          </div>
        </div>

        {/* Indicadores de Crescimento - Premium */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 mr-2 flex-shrink-0" />
            <span className="truncate">Indicadores de Crescimento</span>
            <Crown className="w-4 h-4 sm:w-5 sm:h-5 ml-2 text-yellow-500 flex-shrink-0" />
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <ComparisonIndicatorCard
              title="CAGR Lucros 5a"
              values={orderedCompanies.map(c => {
                const cagrLucros = toNumber(c.financialData[0]?.cagrLucros5a)
                return cagrLucros ? formatPercent(cagrLucros) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={TrendingUp}
              description="Crescimento lucros (5 anos)"
              isPremium={true}
              userIsPremium={userIsPremium}
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="cagrLucros5a"
            />

            <ComparisonIndicatorCard
              title="CAGR Receitas 5a"
              values={orderedCompanies.map(c => {
                const cagrReceitas = toNumber(c.financialData[0]?.cagrReceitas5a)
                return cagrReceitas ? formatPercent(cagrReceitas) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={BarChart3}
              description="Crescimento receitas (5 anos)"
              isPremium={true}
              userIsPremium={userIsPremium}
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="cagrReceitas5a"
            />

            <ComparisonIndicatorCard
              title="Crescimento Lucros"
              values={orderedCompanies.map(c => {
                const crescLucros = toNumber(c.financialData[0]?.crescimentoLucros)
                return crescLucros ? formatPercent(crescLucros) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={Activity}
              description="Variação anual dos lucros"
              isPremium={true}
              userIsPremium={userIsPremium}
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="crescimentoLucros"
            />

            <ComparisonIndicatorCard
              title="Crescimento Receitas"
              values={orderedCompanies.map(c => {
                const crescReceitas = toNumber(c.financialData[0]?.crescimentoReceitas)
                return crescReceitas ? formatPercent(crescReceitas) : 'N/A'
              })}
              tickers={orderedCompanies.map(c => c.ticker)}
              icon={LineChart}
              description="Variação anual das receitas"
              isPremium={true}
              userIsPremium={userIsPremium}
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="crescimentoReceitas"
            />
          </div>
        </div>

        {/* Indicadores de Endividamento - Premium */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center">
            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 mr-2 flex-shrink-0" />
            <span className="truncate">Endividamento e Solidez</span>
            <Crown className="w-4 h-4 sm:w-5 sm:h-5 ml-2 text-yellow-500 flex-shrink-0" />
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
              higherIsBetter={false}
              companies={orderedCompanies}
              fieldName="dividaLiquidaEbitda"
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
              higherIsBetter={false}
              companies={orderedCompanies}
              fieldName="dividaLiquidaPl"
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
              higherIsBetter={true}
              companies={orderedCompanies}
              fieldName="liquidezCorrente"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Comparação Detalhada */}
      <div className="mb-8">
        <ComparisonTable 
          companies={orderedCompanies.map(company => {
            const currentPrice = toNumber(company.dailyQuotes[0]?.price) || toNumber(company.financialData[0]?.lpa) || 0
            
            // Buscar dados já calculados no cache
            const cacheKey = `strategies-${company.ticker}-${currentPrice}`;
            const cached = strategiesCache.get(cacheKey);
            const { strategies, overallScore } = cached?.data || { strategies: {}, overallScore: null };
            
            // Preparar dados históricos financeiros (excluindo o primeiro que é o atual)
            // IMPORTANTE: Converter todos os Decimal para number para evitar erros de serialização
            const historicalFinancials = company.financialData.slice(1).map(data => ({
              year: data.year,
              pl: toNumber(data.pl as PrismaDecimal),
              pvp: toNumber(data.pvp as PrismaDecimal),
              roe: toNumber(data.roe as PrismaDecimal),
              dy: toNumber(data.dy as PrismaDecimal),
              margemLiquida: toNumber(data.margemLiquida as PrismaDecimal),
              roic: toNumber(data.roic as PrismaDecimal),
              marketCap: toNumber(data.marketCap as PrismaDecimal),
              receitaTotal: toNumber(data.receitaTotal as PrismaDecimal),
              lucroLiquido: toNumber(data.lucroLiquido as PrismaDecimal),
              dividaLiquidaEbitda: toNumber(data.dividaLiquidaEbitda as PrismaDecimal),
              dividaLiquidaPl: toNumber(data.dividaLiquidaPl as PrismaDecimal),
              liquidezCorrente: toNumber(data.liquidezCorrente as PrismaDecimal),
              cagrLucros5a: toNumber(data.cagrLucros5a as PrismaDecimal),
              cagrReceitas5a: toNumber(data.cagrReceitas5a as PrismaDecimal),
              crescimentoLucros: toNumber(data.crescimentoLucros as PrismaDecimal),
              crescimentoReceitas: toNumber(data.crescimentoReceitas as PrismaDecimal),
            }))
            
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
                // Indicadores de Crescimento
                cagrLucros5a: toNumber(company.financialData[0].cagrLucros5a),
                cagrReceitas5a: toNumber(company.financialData[0].cagrReceitas5a),
                crescimentoLucros: toNumber(company.financialData[0].crescimentoLucros),
                crescimentoReceitas: toNumber(company.financialData[0].crescimentoReceitas),
              } : null,
              // Adicionar keyStatistics para fallbacks
              keyStatistics: company.keyStatistics?.length > 0 ? [{
                forwardPE: toNumber(company.keyStatistics[0].forwardPE),
                priceToBook: toNumber(company.keyStatistics[0].priceToBook),
                dividendYield: toNumber(company.keyStatistics[0].dividendYield)
              }] : undefined,
              historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined,
              strategies,
              overallScore
            }
          })}
          userIsPremium={userIsPremium}
        />
      </div>

      {/* Links para análises individuais */}
      <div className="mt-8 sm:mt-12">
        <Separator className="mb-4 sm:mb-6" />
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Análises Individuais Detalhadas</h3>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {orderedCompanies.map((company) => (
            <Button key={company.ticker} asChild variant="outline" size="sm" className="text-xs sm:text-sm">
              <Link href={`/acao/${company.ticker}`}>
                <LineChart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Análise Completa </span>
                {company.ticker}
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
