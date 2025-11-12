import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { calculateDividendYield } from "@/lib/dividend-yield-calculator"
import { prisma } from "@/lib/prisma"
import { cache } from "@/lib/cache-service"

/**
 * API para gerar relatório completo de dividend yield
 * Requer autenticação
 * 
 * GET /api/calculators/dividend-yield/report?ticker=XXX&investmentAmount=10000
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Autenticação necessária" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get("ticker")
    const investmentAmount = searchParams.get("investmentAmount")

    if (!ticker || !investmentAmount) {
      return NextResponse.json(
        { success: false, error: "Ticker e valor investido são obrigatórios" },
        { status: 400 }
      )
    }

    const normalizedTicker = ticker.toUpperCase().trim()
    const amount = parseFloat(investmentAmount)

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valor investido inválido" },
        { status: 400 }
      )
    }

    // Cache key para relatório completo
    const cacheKey = `dividend-yield-report:${normalizedTicker}:${amount}:${session.user.id}`
    
    // Verificar cache (24 horas)
    const cachedReport = await cache.get(cacheKey)
    if (cachedReport) {
      return NextResponse.json({
        success: true,
        data: cachedReport,
        cached: true,
      })
    }

    // Calcular dados básicos (isso já atualiza os dividendos se necessário)
    const calculationResult = await calculateDividendYield(normalizedTicker, amount)
    
    if (!calculationResult.success || !calculationResult.data) {
      return NextResponse.json(
        { success: false, error: calculationResult.error || "Erro ao calcular" },
        { status: 400 }
      )
    }

    // Buscar dados adicionais para análise completa
    // Aumentado para garantir que temos histórico completo dos últimos 3+ anos
    const company = await prisma.company.findUnique({
      where: { ticker: normalizedTicker },
      include: {
        financialData: {
          orderBy: { year: "desc" },
          take: 5,
        },
        dividendHistory: {
          orderBy: { exDate: "desc" },
          take: 150, // Aumentado para garantir histórico completo dos últimos 5+ anos
        },
      },
    })

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Empresa não encontrada" },
        { status: 404 }
      )
    }

    // Calcular métricas de sustentabilidade
    const latestFinancials = company.financialData[0]
    const roe = latestFinancials?.roe ? Number(latestFinancials.roe) : null
    const payout = latestFinancials?.payout ? Number(latestFinancials.payout) : null
    const margemLiquida = latestFinancials?.margemLiquida ? Number(latestFinancials.margemLiquida) : null
    const liquidezCorrente = latestFinancials?.liquidezCorrente ? Number(latestFinancials.liquidezCorrente) : null

    // Verificar se é setor financeiro
    const isFinancial = isFinancialSector(company.sector, company.industry, normalizedTicker)

    // Análise de dividend trap
    const dividendTrapAlerts: string[] = []
    if (roe !== null && roe < 0.1) {
      dividendTrapAlerts.push("ROE abaixo de 10% pode indicar problemas de rentabilidade")
    }
    if (payout !== null && payout > 0.8) {
      dividendTrapAlerts.push("Payout acima de 80% pode comprometer crescimento futuro")
    }
    // Para setor financeiro, não considerar margem líquida e liquidez corrente se N/A
    if (!isFinancial && margemLiquida !== null && margemLiquida < 0.05) {
      dividendTrapAlerts.push("Margem líquida abaixo de 5% indica baixa eficiência operacional")
    }
    if (!isFinancial && liquidezCorrente !== null && liquidezCorrente < 1.0) {
      dividendTrapAlerts.push("Liquidez corrente abaixo de 1.0 indica possível dificuldade financeira")
    }

    // Calcular média setorial (simplificado - buscar empresas do mesmo setor)
    let sectorAverage = null
    if (company.sector) {
      const sectorCompanies = await prisma.company.findMany({
        where: {
          sector: company.sector,
          ticker: { not: normalizedTicker },
        },
        include: {
          financialData: {
            orderBy: { year: "desc" },
            take: 1,
          },
        },
        take: 10,
      })

      const sectorDividendYields = sectorCompanies
        .map((c) => {
          const dy = c.financialData[0]?.dy
          return dy ? Number(dy) : null
        })
        .filter((dy): dy is number => dy !== null && dy > 0)

      if (sectorDividendYields.length > 0) {
        sectorAverage =
          sectorDividendYields.reduce((sum, dy) => sum + dy, 0) / sectorDividendYields.length
      }
    }

    // Preparar histórico completo de dividendos (serializado)
    const fullDividendHistory = company.dividendHistory.map((div) => ({
      date: div.exDate.toISOString(),
      amount: Number(div.amount),
    }))

    // Preparar dados do relatório completo
    const reportData = {
      ...calculationResult.data,
      dividendHistory: fullDividendHistory, // Histórico completo para o relatório
      sustainability: {
        roe,
        payout,
        margemLiquida,
        liquidezCorrente,
        dividendTrapAlerts,
        ...calculateSustainabilityScore({
          roe,
          payout,
          margemLiquida,
          liquidezCorrente,
          sector: company.sector,
          industry: company.industry,
          ticker: normalizedTicker,
        }),
      },
      sectorComparison: {
        sectorAverage,
        companySector: company.sector,
        isAboveAverage: sectorAverage
          ? calculationResult.data.dividendYield > sectorAverage
          : null,
      },
      projections: {
        conservative: {
          monthly: calculationResult.data.monthlyIncome * 0.8,
          annual: calculationResult.data.annualIncome * 0.8,
        },
        optimistic: {
          monthly: calculationResult.data.monthlyIncome * 1.2,
          annual: calculationResult.data.annualIncome * 1.2,
        },
      },
      historicalTrend: analyzeDividendTrend(company.dividendHistory),
    }

    // Cachear relatório por 24 horas
    await cache.set(cacheKey, reportData, { ttl: 86400 })

    return NextResponse.json({
      success: true,
      data: reportData,
      cached: false,
    })
  } catch (error) {
    console.error("Erro ao gerar relatório completo:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao processar relatório. Tente novamente.",
      },
      { status: 500 }
    )
  }
}

/**
 * Verifica se uma empresa é do setor financeiro
 */
function isFinancialSector(sector: string | null, industry: string | null, ticker?: string): boolean {
  // Tickers conhecidos de empresas financeiras (incluindo variações ITUB3, ITUB4)
  const knownFinancialTickers = [
    'ITUB3', 'ITUB4', 'BBSE3', 'SULA11', 'PSSA3', 'BBAS3', 'SANB11', 
    'BPAC11', 'BRSR6', 'PINE4', 'WIZS3', 'ABCB4', 'BPAN4', 'BBDC3', 'BBDC4'
  ]
  
  if (ticker && knownFinancialTickers.includes(ticker.toUpperCase())) {
    return true
  }
  
  if (!sector && !industry) return false
  
  const financialKeywords = [
    'financial', 'insurance', 'bank', 'seguros', 'financeiro', 
    'previdência', 'capitalização', 'crédito', 'investimento',
    'seguridade', 'participações', 'holdings', 'caixa', 'bancário',
    'vida e previdência', 'corretora', 'asset management'
  ]
  
  const sectorLower = sector?.toLowerCase() || ''
  const industryLower = industry?.toLowerCase() || ''
  
  return financialKeywords.some(keyword => 
    sectorLower.includes(keyword) || industryLower.includes(keyword)
  )
}

/**
 * Calcula score de sustentabilidade (0-100) e retorna detalhes do cálculo
 * Ajustado para não penalizar empresas do setor financeiro quando Margem Líquida e Liquidez Corrente são N/A
 */
function calculateSustainabilityScore(metrics: {
  roe: number | null
  payout: number | null
  margemLiquida: number | null
  liquidezCorrente: number | null
  sector?: string | null
  industry?: string | null
  ticker?: string
}): {
  score: number
  breakdown: {
    roe: { points: number; maxPoints: number; value: number | null; description: string }
    payout: { points: number; maxPoints: number; value: number | null; description: string }
    margemLiquida: { points: number; maxPoints: number; value: number | null; description: string }
    liquidezCorrente: { points: number; maxPoints: number; value: number | null; description: string }
  }
} {
  const isFinancial = isFinancialSector(metrics.sector || null, metrics.industry || null, metrics.ticker)
  let totalScore = 0
  let totalMaxPoints = 0
  const breakdown = {
    roe: { points: 0, maxPoints: 30, value: metrics.roe, description: "" },
    payout: { points: 0, maxPoints: 25, value: metrics.payout, description: "" },
    margemLiquida: { points: 0, maxPoints: 25, value: metrics.margemLiquida, description: "" },
    liquidezCorrente: { points: 0, maxPoints: 20, value: metrics.liquidezCorrente, description: "" },
  }

  // ROE (peso 30%)
  if (metrics.roe !== null) {
    if (metrics.roe >= 0.15) {
      breakdown.roe.points = 30
      breakdown.roe.description = "Excelente (≥15%)"
    } else if (metrics.roe >= 0.1) {
      breakdown.roe.points = 20
      breakdown.roe.description = "Bom (10-15%)"
    } else if (metrics.roe >= 0.05) {
      breakdown.roe.points = 10
      breakdown.roe.description = "Regular (5-10%)"
    } else {
      breakdown.roe.points = 0
      breakdown.roe.description = "Baixo (<5%)"
    }
    totalScore += breakdown.roe.points
    totalMaxPoints += breakdown.roe.maxPoints
  } else {
    breakdown.roe.description = "Dados não disponíveis"
  }

  // Payout (peso 25%)
  if (metrics.payout !== null) {
    if (metrics.payout >= 0.3 && metrics.payout <= 0.6) {
      breakdown.payout.points = 25
      breakdown.payout.description = "Ideal (30-60%)"
    } else if (metrics.payout >= 0.2 && metrics.payout <= 0.7) {
      breakdown.payout.points = 15
      breakdown.payout.description = "Aceitável (20-70%)"
    } else if (metrics.payout >= 0.1 && metrics.payout <= 0.8) {
      breakdown.payout.points = 5
      breakdown.payout.description = "Atenção (10-80%)"
    } else {
      breakdown.payout.points = 0
      breakdown.payout.description = "Risco (<10% ou >80%)"
    }
    totalScore += breakdown.payout.points
    totalMaxPoints += breakdown.payout.maxPoints
  } else {
    breakdown.payout.description = "Dados não disponíveis"
  }

  // Margem Líquida (peso 25%)
  // Para empresas do setor financeiro, não penalizar se N/A (não aplicável)
  if (metrics.margemLiquida !== null) {
    if (metrics.margemLiquida >= 0.1) {
      breakdown.margemLiquida.points = 25
      breakdown.margemLiquida.description = "Excelente (≥10%)"
    } else if (metrics.margemLiquida >= 0.05) {
      breakdown.margemLiquida.points = 15
      breakdown.margemLiquida.description = "Bom (5-10%)"
    } else if (metrics.margemLiquida >= 0.02) {
      breakdown.margemLiquida.points = 5
      breakdown.margemLiquida.description = "Regular (2-5%)"
    } else {
      breakdown.margemLiquida.points = 0
      breakdown.margemLiquida.description = "Baixo (<2%)"
    }
    totalScore += breakdown.margemLiquida.points
    totalMaxPoints += breakdown.margemLiquida.maxPoints
  } else {
    if (isFinancial) {
      breakdown.margemLiquida.description = "Não aplicável (setor financeiro)"
      breakdown.margemLiquida.maxPoints = 0 // Não contar no máximo possível
    } else {
      breakdown.margemLiquida.description = "Dados não disponíveis"
    }
  }

  // Liquidez Corrente (peso 20%)
  // Para empresas do setor financeiro, não penalizar se N/A (não aplicável)
  if (metrics.liquidezCorrente !== null) {
    if (metrics.liquidezCorrente >= 1.5) {
      breakdown.liquidezCorrente.points = 20
      breakdown.liquidezCorrente.description = "Excelente (≥1.5)"
    } else if (metrics.liquidezCorrente >= 1.2) {
      breakdown.liquidezCorrente.points = 15
      breakdown.liquidezCorrente.description = "Bom (1.2-1.5)"
    } else if (metrics.liquidezCorrente >= 1.0) {
      breakdown.liquidezCorrente.points = 10
      breakdown.liquidezCorrente.description = "Aceitável (1.0-1.2)"
    } else {
      breakdown.liquidezCorrente.points = 0
      breakdown.liquidezCorrente.description = "Risco (<1.0)"
    }
    totalScore += breakdown.liquidezCorrente.points
    totalMaxPoints += breakdown.liquidezCorrente.maxPoints
  } else {
    if (isFinancial) {
      breakdown.liquidezCorrente.description = "Não aplicável (setor financeiro)"
      breakdown.liquidezCorrente.maxPoints = 0 // Não contar no máximo possível
    } else {
      breakdown.liquidezCorrente.description = "Dados não disponíveis"
    }
  }

  // Calcular score final (proporcional ao máximo possível)
  const finalScore = totalMaxPoints > 0 ? Math.round((totalScore / totalMaxPoints) * 100) : 50

  return {
    score: finalScore,
    breakdown,
  }
}

/**
 * Analisa tendência de dividendos
 */
function analyzeDividendTrend(
  dividendHistory: Array<{ exDate: Date; amount: any }>
): {
  trend: "increasing" | "decreasing" | "stable"
  averageGrowth: number
  consistency: number
} {
  if (dividendHistory.length < 2) {
    return {
      trend: "stable",
      averageGrowth: 0,
      consistency: 0,
    }
  }

  // Agrupar por ano
  const yearlyDividends = new Map<number, number[]>()
  dividendHistory.forEach((div) => {
    const year = div.exDate.getFullYear()
    if (!yearlyDividends.has(year)) {
      yearlyDividends.set(year, [])
    }
    yearlyDividends.get(year)!.push(Number(div.amount))
  })

  // Calcular total por ano
  const yearlyTotals = Array.from(yearlyDividends.entries())
    .map(([year, amounts]) => ({
      year,
      total: amounts.reduce((sum, amt) => sum + amt, 0),
    }))
    .sort((a, b) => a.year - b.year)

  if (yearlyTotals.length < 2) {
    return {
      trend: "stable",
      averageGrowth: 0,
      consistency: 0,
    }
  }

  // Calcular crescimento médio
  // Usar média geométrica para evitar distorções por valores extremos
  const growthRates: number[] = []
  for (let i = 1; i < yearlyTotals.length; i++) {
    const prev = yearlyTotals[i - 1].total
    const curr = yearlyTotals[i].total
    if (prev > 0 && curr > 0) {
      // Calcular taxa de crescimento: (novo - antigo) / antigo
      const growthRate = (curr - prev) / prev
      
      // Limitar valores extremos para evitar distorções
      // Máximo de 500% (5x) de crescimento ou -90% de queda
      const cappedGrowthRate = Math.max(-0.9, Math.min(5, growthRate))
      growthRates.push(cappedGrowthRate)
    } else if (prev === 0 && curr > 0) {
      // Se não havia dividendos antes e agora há, considerar crescimento moderado (100%)
      growthRates.push(1.0)
    }
  }

  // Calcular média geométrica para crescimento mais realista
  // Se todos os valores são positivos, usar média geométrica
  // Caso contrário, usar média aritmética simples
  let averageGrowth = 0
  if (growthRates.length > 0) {
    const allPositive = growthRates.every(rate => rate > -1) // Taxa de crescimento > -100%
    
    if (allPositive) {
      // Média geométrica: (1 + r1) * (1 + r2) * ... ^ (1/n) - 1
      const product = growthRates.reduce((prod, rate) => prod * (1 + rate), 1)
      averageGrowth = Math.pow(product, 1 / growthRates.length) - 1
    } else {
      // Se há valores negativos extremos, usar média aritmética simples
      averageGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
    }
    
    // Limitar resultado final para evitar valores absurdos
    // Máximo de 1000% (10x) de crescimento médio
    averageGrowth = Math.max(-0.95, Math.min(10, averageGrowth))
  }

  // Determinar tendência considerando:
  // 1. Tendência dos últimos anos (mais relevante)
  // 2. Volatilidade (se muito volátil, considerar estável)
  // 3. Comparação entre primeiro e último ano
  
  let trend: "increasing" | "decreasing" | "stable" = "stable"
  
  if (yearlyTotals.length >= 2) {
    // Calcular tendência dos últimos 3 anos (se disponível)
    const recentYears = yearlyTotals.slice(-3)
    let recentTrend = 0
    
    if (recentYears.length >= 2) {
      const recentGrowthRates: number[] = []
      for (let i = 1; i < recentYears.length; i++) {
        const prev = recentYears[i - 1].total
        const curr = recentYears[i].total
        if (prev > 0 && curr > 0) {
          const growthRate = (curr - prev) / prev
          recentGrowthRates.push(Math.max(-0.9, Math.min(5, growthRate)))
        }
      }
      
      if (recentGrowthRates.length > 0) {
        recentTrend = recentGrowthRates.reduce((sum, rate) => sum + rate, 0) / recentGrowthRates.length
      }
    }
    
    // Comparar primeiro e último ano (tendência geral)
    const firstYear = yearlyTotals[0].total
    const lastYear = yearlyTotals[yearlyTotals.length - 1].total
    let overallTrend = 0
    if (firstYear > 0 && lastYear > 0) {
      overallTrend = (lastYear - firstYear) / firstYear
    }
    
    // Calcular volatilidade (desvio padrão dos crescimentos)
    const growthRatesForVolatility = []
    for (let i = 1; i < yearlyTotals.length; i++) {
      const prev = yearlyTotals[i - 1].total
      const curr = yearlyTotals[i].total
      if (prev > 0 && curr > 0) {
        growthRatesForVolatility.push((curr - prev) / prev)
      }
    }
    
    let volatility = 0
    if (growthRatesForVolatility.length > 1) {
      const meanGrowth = growthRatesForVolatility.reduce((sum, r) => sum + r, 0) / growthRatesForVolatility.length
      const variance = growthRatesForVolatility.reduce((sum, r) => sum + Math.pow(r - meanGrowth, 2), 0) / growthRatesForVolatility.length
      volatility = Math.sqrt(variance)
    }
    
    // Se muito volátil (desvio padrão > 50%), considerar estável
    if (volatility > 0.5) {
      trend = "stable"
    } else {
      // Dar mais peso à tendência recente (60%) vs geral (40%)
      const weightedTrend = (recentTrend * 0.6) + (overallTrend * 0.4)
      
      // Usar threshold mais conservador para evitar classificações errôneas
      if (weightedTrend > 0.1) {
        trend = "increasing"
      } else if (weightedTrend < -0.1) {
        trend = "decreasing"
      } else {
        trend = "stable"
      }
    }
  } else {
    // Fallback para lógica simples se não houver dados suficientes
    if (averageGrowth > 0.1) trend = "increasing"
    else if (averageGrowth < -0.1) trend = "decreasing"
    else trend = "stable"
  }

  // Calcular consistência baseada na regularidade dos pagamentos
  // Ordenar dividendos por data (mais antigo primeiro)
  const sortedDividends = [...dividendHistory]
    .map((div) => ({
      date: new Date(div.exDate),
      amount: Number(div.amount),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (sortedDividends.length < 2) {
    return {
      trend: "stable",
      averageGrowth: 0,
      consistency: 0,
    }
  }

  // Calcular intervalo total de tempo coberto
  const firstDate = sortedDividends[0].date
  const lastDate = sortedDividends[sortedDividends.length - 1].date
  const totalDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)

  // Calcular intervalos entre pagamentos consecutivos (em dias)
  const intervals: number[] = []
  for (let i = 1; i < sortedDividends.length; i++) {
    const daysDiff =
      (sortedDividends[i].date.getTime() - sortedDividends[i - 1].date.getTime()) /
      (1000 * 60 * 60 * 24)
    if (daysDiff > 0 && daysDiff < 400) {
      // Ignorar intervalos muito grandes (pode ser empresa que parou de pagar temporariamente)
      intervals.push(daysDiff)
    }
  }

  if (intervals.length === 0) {
    return {
      trend,
      averageGrowth: averageGrowth, // Manter como decimal (ex: 0.05 = 5%), a página vai formatar
      consistency: 0,
    }
  }

  // Calcular média e desvio padrão dos intervalos
  const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length
  const variance =
    intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length
  const stdDev = Math.sqrt(variance)

  // Calcular coeficiente de variação dos intervalos
  // CV baixo = intervalos regulares (alta consistência)
  // CV alto = intervalos irregulares (baixa consistência)
  const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : 1

  // Fator de frequência: penalizar empresas com poucos pagamentos
  // Se tem muitos pagamentos em relação ao período, aumenta consistência
  const expectedPayments = totalDays > 0 ? Math.floor(totalDays / avgInterval) : 0
  const frequencyFactor = expectedPayments > 0 
    ? Math.min(1, sortedDividends.length / expectedPayments) 
    : 0.5

  // Consistência baseada em:
  // 1. Regularidade dos intervalos (CV baixo = mais consistente)
  // 2. Frequência de pagamentos (mais pagamentos = mais consistente)
  // Fórmula: (1 - CV) * frequência, limitado entre 0 e 100
  const regularityScore = Math.max(0, 1 - Math.min(coefficientOfVariation, 1))
  const consistency = Math.max(0, Math.min(100, regularityScore * frequencyFactor * 100))

  return {
    trend,
    averageGrowth: averageGrowth, // Manter como decimal (ex: 0.05 = 5%), a página vai formatar
    consistency: Math.round(consistency),
  }
}

