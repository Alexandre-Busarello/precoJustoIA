/**
 * Ben Tools - Funções que o Gemini pode chamar via Function Calling
 * 
 * Este arquivo contém todas as ferramentas disponíveis para o Ben usar
 * durante as conversas com usuários.
 */

import { calculateCompanyOverallScore, CompanyScoreResult } from './calculate-company-score-service'
import { getComprehensiveFinancialData } from './financial-data-service'
import { prisma } from './prisma'
import { getTickerPrice } from './quote-service'
import { getCurrentUser } from './user-service'
import { getOrCalculateTechnicalAnalysis } from './technical-analysis-service'
import { DividendRadarService } from './dividend-radar-service'
import { getLatestPrices } from './quote-service'
import { getRadarStatusColor, getTechnicalEntryStatus, getSentimentStatus, getValuationStatus } from './radar-service'
import { calculateUpside } from './index-strategy-integration'
import { getUserMemory } from './ben-memory-service'
import { PortfolioMetricsService } from './portfolio-metrics-service'

/**
 * Obtém métricas completas de uma empresa
 * PRIORIDADE: Banco de dados é a fonte da verdade
 * Yahoo Finance é usado apenas como fallback se não houver dados recentes no banco
 */
export async function getCompanyMetrics(ticker: string) {
  try {
    const normalizedTicker = ticker.toUpperCase()
    
    const company = await prisma.company.findUnique({
      where: { ticker: normalizedTicker },
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

    if (!company) {
      return {
        success: false,
        error: `Empresa ${normalizedTicker} não encontrada`
      }
    }

    const latestFinancial = company.financialData[0]

    // PRIORIDADE: Banco de dados é a fonte da verdade
    // Usar Yahoo Finance apenas se não houver dados no banco ou estiverem muito desatualizados
    let currentPrice: number | null = null
    let priceDate: Date | null = null
    let priceSource: 'database' | 'yahoo' | null = null
    
    const latestQuote = company.dailyQuotes[0]
    
    // Verificar se há dados no banco e se estão atualizados (últimas 24h)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const isQuoteRecent = latestQuote && new Date(latestQuote.date) >= oneDayAgo
    
    if (latestQuote && isQuoteRecent) {
      // Usar dados do banco (fonte da verdade)
      currentPrice = Number(latestQuote.price)
      priceDate = latestQuote.date
      priceSource = 'database'
      console.log(`[Ben] Preço ${normalizedTicker} obtido do banco (fonte da verdade): R$ ${currentPrice} (data: ${priceDate.toISOString().split('T')[0]})`)
    } else {
      // Banco não tem dados recentes, buscar do Yahoo Finance como fallback
      console.log(`[Ben] Banco não tem dados recentes para ${normalizedTicker}, buscando do Yahoo Finance...`)
      try {
        const priceData = await getTickerPrice(normalizedTicker, false) // false = usar cache
        if (priceData && priceData.price > 0) {
          currentPrice = priceData.price
          priceDate = priceData.timestamp
          priceSource = 'yahoo'
          console.log(`[Ben] Preço ${normalizedTicker} obtido do Yahoo Finance (fallback): R$ ${currentPrice}`)
        }
      } catch (error) {
        console.warn(`[Ben] Erro ao buscar preço do Yahoo Finance para ${normalizedTicker}:`, error)
      }
      
      // Se Yahoo Finance também falhar, usar último preço do banco mesmo que antigo
      if (!currentPrice && latestQuote) {
        currentPrice = Number(latestQuote.price)
        priceDate = latestQuote.date
        priceSource = 'database'
        console.log(`[Ben] Preço ${normalizedTicker} obtido do banco (último disponível, pode estar desatualizado): R$ ${currentPrice}`)
      }
    }

    // Validação de dados críticos
    if (currentPrice === null || currentPrice <= 0 || isNaN(currentPrice)) {
      console.error(`[Ben] ⚠️ Preço inválido para ${normalizedTicker}: ${currentPrice}`)
      return {
        success: false,
        error: `Não foi possível obter preço válido para ${normalizedTicker}. Preço obtido: ${currentPrice}`
      }
    }

    // Calcular score se possível
    let score: number | null = null
    try {
      const scoreResult: CompanyScoreResult | null = await calculateCompanyOverallScore(normalizedTicker, {
        isPremium: true,
        isLoggedIn: true
      })
      score = scoreResult?.overallScore?.score || null
    } catch (error) {
      console.error(`Erro ao calcular score para ${normalizedTicker}:`, error)
    }

    return {
      success: true,
      data: {
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        industry: company.industry,
        currentPrice: currentPrice,
        priceDate: priceDate,
        priceSource: priceSource,
        score: score,
        financials: latestFinancial ? {
          pl: latestFinancial.pl ? Number(latestFinancial.pl) : null,
          pvp: latestFinancial.pvp ? Number(latestFinancial.pvp) : null,
          dy: latestFinancial.dy ? Number(latestFinancial.dy) : null,
          roe: latestFinancial.roe ? Number(latestFinancial.roe) : null,
          roic: latestFinancial.roic ? Number(latestFinancial.roic) : null,
          roa: latestFinancial.roa ? Number(latestFinancial.roa) : null,
          margemLiquida: latestFinancial.margemLiquida ? Number(latestFinancial.margemLiquida) : null,
          dividaLiquidaPl: latestFinancial.dividaLiquidaPl ? Number(latestFinancial.dividaLiquidaPl) : null,
          year: latestFinancial.year
        } : null
      }
    }
  } catch (error) {
    console.error(`Erro ao buscar métricas de ${ticker}:`, error)
    return {
      success: false,
      error: `Erro ao buscar dados da empresa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Obtém sentimento de mercado atual
 */
export async function getMarketSentiment() {
  try {
    // Buscar análises recentes do YouTube (sentimento de mercado)
    const recentAnalyses = await prisma.youTubeAnalysis.findMany({
      where: {
        isActive: true,
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 dias
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        company: {
          select: {
            ticker: true,
            name: true
          }
        }
      }
    })

    if (recentAnalyses.length === 0) {
      return {
        success: true,
        data: {
          averageScore: 50,
          totalAnalyses: 0,
          message: 'Não há análises recentes disponíveis'
        }
      }
    }

    const scores: number[] = recentAnalyses
      .map((a: any) => typeof a.score === 'object' && 'toNumber' in a.score ? a.score.toNumber() : Number(a.score))
      .filter((s: number) => !isNaN(s))

    const averageScore = scores.length > 0
      ? scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length
      : 50

    const positiveCount = scores.filter((s: number) => s > 70).length
    const negativeCount = scores.filter((s: number) => s < 40).length

    return {
      success: true,
      data: {
        averageScore: Math.round(averageScore),
        totalAnalyses: recentAnalyses.length,
        positiveCount,
        negativeCount,
        neutralCount: scores.length - positiveCount - negativeCount,
        sentiment: averageScore > 70 ? 'POSITIVO' : averageScore < 40 ? 'NEGATIVO' : 'NEUTRO',
        topCompanies: recentAnalyses
          .slice(0, 5)
          .map((a: any) => ({
            ticker: a.company.ticker,
            name: a.company.name,
            score: typeof a.score === 'object' && 'toNumber' in a.score ? a.score.toNumber() : Number(a.score)
          }))
      }
    }
  } catch (error) {
    console.error('Erro ao buscar sentimento de mercado:', error)
    return {
      success: false,
      error: `Erro ao buscar sentimento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Obtém dados do IBOVESPA
 * SEMPRE busca valor atual do Yahoo Finance sem cache para garantir dados atualizados
 */
export async function getIbovData() {
  try {
    // PRIORIDADE: Buscar valor atual do Yahoo Finance SEM CACHE
    try {
      const { YahooFinance2Service } = await import('./yahooFinance2-service')
      const quote = await YahooFinance2Service.getQuoteWithoutCache('^BVSP')
      
      if (quote?.regularMarketPrice) {
        const currentValue = Number(quote.regularMarketPrice)
        const previousClose = quote.regularMarketPreviousClose ? Number(quote.regularMarketPreviousClose) : null
        
        const changePercent = previousClose 
          ? ((currentValue - previousClose) / previousClose) * 100
          : 0

        console.log(`✅ [IBOV] Valor atual do Yahoo Finance: ${currentValue.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`)
        
        return {
          success: true,
          data: {
            currentValue,
            date: new Date().toISOString().split('T')[0],
            changePercent,
            historicalData: [] // Não necessário para projeções, apenas histórico se precisar
          }
        }
      }
    } catch (yahooError) {
      console.warn('⚠️ [IBOV] Yahoo Finance falhou, tentando BRAPI como fallback:', yahooError)
    }

    // Fallback: Buscar dados do IBOV via BRAPI (com cache para histórico)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 1) // Último ano

    const brapiToken = process.env.BRAPI_TOKEN
    const diffYears = (endDate.getFullYear() - startDate.getFullYear())
    const range = diffYears >= 5 ? '10y' : diffYears >= 2 ? '5y' : diffYears >= 1 ? '2y' : '1y'
    const brapiUrl = `https://brapi.dev/api/quote/%5EBVSP?range=${range}&interval=1mo${brapiToken ? `&token=${brapiToken}` : ''}`

    const response = await fetch(brapiUrl, {
      next: { revalidate: 3600 }
    })

    if (!response.ok) {
      throw new Error(`Erro ao buscar IBOV: ${response.status}`)
    }

    const data = await response.json()
    const historicalData = data.results?.[0]?.historicalDataPrice || []

    if (historicalData.length === 0) {
      return {
        success: false,
        error: 'Não foi possível obter dados do IBOVESPA'
      }
    }

    // Transformar dados
    const ibovData = historicalData
      .map((item: any) => ({
        date: item.date,
        value: item.close || item.adjClose || 0
      }))
      .filter((item: any) => item.value > 0)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const latest = ibovData[ibovData.length - 1]
    const previous = ibovData.length > 1 ? ibovData[ibovData.length - 2] : null

    const change = previous
      ? ((Number(latest.value) - Number(previous.value)) / Number(previous.value)) * 100
      : 0

    console.log(`⚠️ [IBOV] Usando BRAPI (fallback): ${Number(latest.value).toFixed(2)}`)

    return {
      success: true,
      data: {
        currentValue: Number(latest.value),
        date: latest.date,
        changePercent: change,
        historicalData: ibovData.slice(-30).map((d: any) => ({
          date: d.date,
          value: Number(d.value)
        }))
      }
    }
  } catch (error) {
    console.error('Erro ao buscar dados do IBOV:', error)
    return {
      success: false,
      error: `Erro ao buscar IBOV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Busca na web usando Gemini (via function calling)
 * Nota: Esta função será chamada pelo próprio Gemini quando necessário
 */
export async function webSearch(query: string) {
  // Esta função será implementada pelo Gemini usando sua ferramenta de busca
  // Retornamos uma estrutura que indica que a busca deve ser feita pelo Gemini
  return {
    success: true,
    message: 'Busca na web será realizada pelo Gemini',
    query
  }
}

/**
 * Consulta empresas de interesse do usuário com fallback inteligente
 * PRIORIDADE 1: Busca empresas no radar de oportunidades (com todos os dados disponíveis)
 * PRIORIDADE 2: Se não houver radar, busca empresas de interesse na memória
 * Retorna lista de empresas com dados consolidados completos
 */
export async function getUserRadarWithFallback(userId: string) {
  try {
    // PRIORIDADE 1: Buscar radar de oportunidades primeiro
    const radarResult = await getUserRadar(userId)
    
    // Se o radar tem empresas, retornar com flag indicando origem
    if (radarResult.success && radarResult.data && radarResult.data.count > 0) {
      return {
        success: true,
        source: 'radar',
        data: {
          ...radarResult.data,
          message: 'Empresas do seu radar de oportunidades'
        }
      }
    }

    // PRIORIDADE 2: Se não houver radar, buscar empresas de interesse na memória
    console.log('[Ben] Radar vazio, buscando empresas de interesse na memória...')
    const memories = await getUserMemory(userId)
    
    // Filtrar apenas memórias de empresas (COMPANIES ou COMPANY_INTEREST)
    const companyMemories = memories.filter(m => 
      m.category === 'COMPANIES' || m.category === 'COMPANY_INTEREST'
    )

    if (companyMemories.length === 0) {
      return {
        success: true,
        source: 'none',
        data: {
          tickers: [],
          count: 0,
          data: [],
          message: 'Você não possui empresas no radar nem empresas de interesse registradas na memória'
        }
      }
    }

    // Extrair tickers únicos das memórias
    const tickerSet = new Set<string>()
    companyMemories.forEach(memory => {
      const metadata = memory.metadata as any
      if (metadata?.ticker) {
        tickerSet.add(metadata.ticker.toUpperCase())
      }
      // Também verificar se o próprio key é um ticker (formato: 4 letras + 1 dígito)
      if (memory.key) {
        const normalizedKey = memory.key.toUpperCase()
        if (/^[A-Z]{4}\d$/.test(normalizedKey)) {
          tickerSet.add(normalizedKey)
        }
      }
    })

    const tickers = Array.from(tickerSet)
    
    if (tickers.length === 0) {
      return {
        success: true,
        source: 'memory',
        data: {
          tickers: [],
          count: 0,
          data: [],
          message: 'Encontradas empresas de interesse na memória, mas não foi possível extrair tickers válidos'
        }
      }
    }

    console.log(`[Ben] Encontradas ${tickers.length} empresas de interesse na memória: ${tickers.join(', ')}`)

    // Buscar dados completos para cada empresa (mesmo processo do radar)
    const isPremium = true
    const isLoggedIn = true
    const updatedPrices = await getLatestPrices(tickers)

    const dataPromises = tickers.map(async (ticker: string) => {
      try {
        const analysisResult = await calculateCompanyOverallScore(ticker, {
          isPremium,
          isLoggedIn,
          includeStatements: isPremium,
          includeStrategies: true
        })

        if (!analysisResult) {
          return null
        }

        const { ticker: companyTicker, companyName, sector, currentPrice: analysisPrice, logoUrl, overallScore, strategies } = analysisResult
        
        const updatedPrice = updatedPrices.get(ticker.toUpperCase())
        const currentPrice = updatedPrice?.price ?? analysisPrice

        const technicalAnalysis = await getOrCalculateTechnicalAnalysis(ticker, false, false)

        const company = await prisma.company.findUnique({
          where: { ticker: ticker.toUpperCase() },
          select: { id: true }
        })

        let youtubeScore: number | null = null
        if (company) {
          const youtubeAnalysis = await (prisma as any).youTubeAnalysis.findFirst({
            where: {
              companyId: company.id,
              isActive: true
            },
            orderBy: { createdAt: 'desc' },
            select: { score: true }
          })

          if (youtubeAnalysis) {
            youtubeScore = Number(youtubeAnalysis.score)
          }
        }

        const upsides: number[] = []
        if (strategies?.graham?.upside !== null && strategies?.graham?.upside !== undefined) {
          upsides.push(strategies.graham.upside)
        }
        if (strategies?.fcd?.upside !== null && strategies?.fcd?.upside !== undefined) {
          upsides.push(strategies.fcd.upside)
        }
        if (strategies?.gordon?.upside !== null && strategies?.gordon?.upside !== undefined) {
          upsides.push(strategies.gordon.upside)
        }
        const bestUpside = upsides.length > 0 ? Math.max(...upsides) : null

        const technicalStatus = getTechnicalEntryStatus(technicalAnalysis, currentPrice, overallScore?.score)
        const sentimentStatus = getSentimentStatus(youtubeScore)
        const valuationStatus = getValuationStatus(bestUpside)
        const overallStatus = overallScore 
          ? getRadarStatusColor(overallScore.score)
          : 'gray'

        return {
          ticker: companyTicker,
          companyName,
          sector,
          currentPrice,
          logoUrl,
          score: overallScore?.score || null,
          technicalStatus,
          sentimentStatus,
          valuationStatus,
          overallStatus,
          technicalAnalysis: technicalAnalysis ? {
            rsi: technicalAnalysis.rsi,
            sma20: technicalAnalysis.sma20,
            sma50: technicalAnalysis.sma50,
            sma200: technicalAnalysis.sma200,
            supportLevels: technicalAnalysis.supportLevels,
            resistanceLevels: technicalAnalysis.resistanceLevels,
            aiFairEntryPrice: technicalAnalysis.aiFairEntryPrice,
            aiAnalysis: technicalAnalysis.aiAnalysis
          } : null,
          youtubeScore,
          bestUpside
        }
      } catch (error) {
        console.error(`[Ben] Erro ao buscar dados da memória para ${ticker}:`, error)
        return null
      }
    })

    const memoryData = (await Promise.all(dataPromises)).filter(item => item !== null)

    return {
      success: true,
      source: 'memory',
      data: {
        tickers,
        count: memoryData.length,
        data: memoryData,
        message: 'Empresas de interesse encontradas na memória'
      }
    }
  } catch (error) {
    console.error('[Ben] Erro ao buscar radar com fallback:', error)
    return {
      success: false,
      source: 'error',
      error: `Erro ao buscar empresas de interesse: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Consulta o radar de investimentos do usuário atual
 * Retorna lista de tickers monitorados com dados consolidados
 */
export async function getUserRadar(userId: string) {
  try {
    // Buscar configuração do radar
    const radarConfig = await prisma.radarConfig.findUnique({
      where: { userId },
      select: {
        tickers: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!radarConfig || !radarConfig.tickers || (radarConfig.tickers as string[]).length === 0) {
      return {
        success: true,
        data: {
          tickers: [],
          count: 0,
          message: 'Usuário não possui tickers no radar ainda'
        }
      }
    }

    const tickers = radarConfig.tickers as string[]
    const isPremium = true // Assumir premium para acesso completo aos dados
    const isLoggedIn = true

    // Atualizar preços do Yahoo Finance
    const updatedPrices = await getLatestPrices(tickers)

    // Buscar dados consolidados para cada ticker
    const dataPromises = tickers.map(async (ticker: string) => {
      try {
        // Buscar análise completa da empresa
        const analysisResult = await calculateCompanyOverallScore(ticker, {
          isPremium,
          isLoggedIn,
          includeStatements: isPremium,
          includeStrategies: true
        })

        if (!analysisResult) {
          return null
        }

        const { ticker: companyTicker, companyName, sector, currentPrice: analysisPrice, logoUrl, overallScore, strategies } = analysisResult
        
        // Usar preço atualizado do Yahoo Finance se disponível
        const updatedPrice = updatedPrices.get(ticker.toUpperCase())
        const currentPrice = updatedPrice?.price ?? analysisPrice

        // Buscar análise técnica
        const technicalAnalysis = await getOrCalculateTechnicalAnalysis(ticker, false, false)

        // Buscar análise de sentimento (YouTube)
        const company = await prisma.company.findUnique({
          where: { ticker: ticker.toUpperCase() },
          select: { id: true }
        })

        let youtubeScore: number | null = null
        if (company) {
          const youtubeAnalysis = await (prisma as any).youTubeAnalysis.findFirst({
            where: {
              companyId: company.id,
              isActive: true
            },
            orderBy: { createdAt: 'desc' },
            select: { score: true }
          })

          if (youtubeAnalysis) {
            youtubeScore = Number(youtubeAnalysis.score)
          }
        }

        // Calcular melhor upside entre estratégias
        const upsides: number[] = []
        if (strategies?.graham?.upside !== null && strategies?.graham?.upside !== undefined) {
          upsides.push(strategies.graham.upside)
        }
        if (strategies?.fcd?.upside !== null && strategies?.fcd?.upside !== undefined) {
          upsides.push(strategies.fcd.upside)
        }
        if (strategies?.gordon?.upside !== null && strategies?.gordon?.upside !== undefined) {
          upsides.push(strategies.gordon.upside)
        }
        const bestUpside = upsides.length > 0 ? Math.max(...upsides) : null

        // Determinar status
        const technicalStatus = getTechnicalEntryStatus(technicalAnalysis, currentPrice, overallScore?.score)
        const sentimentStatus = getSentimentStatus(youtubeScore)
        const valuationStatus = getValuationStatus(bestUpside)
        const overallStatus = overallScore 
          ? getRadarStatusColor(overallScore.score)
          : 'gray'

        return {
          ticker: companyTicker,
          companyName,
          sector,
          currentPrice,
          logoUrl,
          score: overallScore?.score || null,
          technicalStatus,
          sentimentStatus,
          valuationStatus,
          overallStatus,
          technicalAnalysis: technicalAnalysis ? {
            rsi: technicalAnalysis.rsi,
            sma20: technicalAnalysis.sma20,
            sma50: technicalAnalysis.sma50,
            sma200: technicalAnalysis.sma200,
            supportLevels: technicalAnalysis.supportLevels,
            resistanceLevels: technicalAnalysis.resistanceLevels,
            aiFairEntryPrice: technicalAnalysis.aiFairEntryPrice,
            aiAnalysis: technicalAnalysis.aiAnalysis
          } : null,
          youtubeScore,
          bestUpside
        }
      } catch (error) {
        console.error(`[Ben] Erro ao buscar dados do radar para ${ticker}:`, error)
        return null
      }
    })

    const radarData = (await Promise.all(dataPromises)).filter(item => item !== null)

    return {
      success: true,
      data: {
        tickers,
        count: radarData.length,
        data: radarData,
        createdAt: radarConfig.createdAt,
        updatedAt: radarConfig.updatedAt
      }
    }
  } catch (error) {
    console.error('[Ben] Erro ao buscar radar do usuário:', error)
    return {
      success: false,
      error: `Erro ao buscar radar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Calcula sinal geral baseado nos indicadores técnicos
 */
function calculateOverallSignal(analysis: any): 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO' {
  let buySignals = 0
  let sellSignals = 0

  // RSI
  if (analysis.rsi !== null) {
    if (analysis.rsi <= 30) buySignals++
    else if (analysis.rsi >= 70) sellSignals++
  }

  // Stochastic
  if (analysis.stochasticK !== null && analysis.stochasticD !== null) {
    if (analysis.stochasticK <= 20 && analysis.stochasticD <= 20) buySignals++
    else if (analysis.stochasticK >= 80 && analysis.stochasticD >= 80) sellSignals++
  }

  // MACD
  if (analysis.macd !== null && analysis.macdSignal !== null && analysis.macdHistogram !== null) {
    if (analysis.macdHistogram > 0 && analysis.macd > analysis.macdSignal) buySignals++
    else if (analysis.macdHistogram < 0 && analysis.macd < analysis.macdSignal) sellSignals++
  }

  // Bollinger Bands
  if (analysis.bbLower !== null && analysis.bbUpper !== null && analysis.currentPrice !== null) {
    if (analysis.currentPrice < analysis.bbLower) buySignals++
    else if (analysis.currentPrice > analysis.bbUpper) sellSignals++
  }

  // Médias móveis (tendência)
  if (analysis.sma20 !== null && analysis.sma50 !== null && analysis.currentPrice !== null) {
    if (analysis.currentPrice > analysis.sma20 && analysis.sma20 > analysis.sma50) buySignals++
    else if (analysis.currentPrice < analysis.sma20 && analysis.sma20 < analysis.sma50) sellSignals++
  }

  // Determinar sinal geral
  if (buySignals >= 2) {
    return 'SOBREVENDA'
  } else if (sellSignals >= 2) {
    return 'SOBRECOMPRA'
  }
  return 'NEUTRO'
}

/**
 * Obtém análise técnica completa de uma ação
 * Retorna indicadores técnicos, sinais de compra/venda, suportes/resistências e análise de IA
 */
export async function getTechnicalAnalysis(ticker: string) {
  try {
    const normalizedTicker = ticker.toUpperCase()
    
    const analysis = await getOrCalculateTechnicalAnalysis(normalizedTicker, false, false)

    if (!analysis) {
      return {
        success: false,
        error: `Análise técnica não disponível para ${normalizedTicker}. Dados históricos insuficientes.`
      }
    }

    // Calcular sinal geral baseado nos indicadores
    const overallSignal = calculateOverallSignal(analysis)

    return {
      success: true,
      data: {
        ticker: normalizedTicker,
        currentPrice: analysis.currentPrice,
        overallSignal, // SOBRECOMPRA, SOBREVENDA ou NEUTRO
        // Indicadores de momentum
        rsi: analysis.rsi,
        stochasticK: analysis.stochasticK,
        stochasticD: analysis.stochasticD,
        macd: analysis.macd,
        macdSignal: analysis.macdSignal,
        macdHistogram: analysis.macdHistogram,
        // Médias móveis
        sma20: analysis.sma20,
        sma50: analysis.sma50,
        sma200: analysis.sma200,
        ema12: analysis.ema12,
        ema26: analysis.ema26,
        // Bollinger Bands
        bbUpper: analysis.bbUpper,
        bbMiddle: analysis.bbMiddle,
        bbLower: analysis.bbLower,
        // Suporte e Resistência
        supportLevels: analysis.supportLevels,
        resistanceLevels: analysis.resistanceLevels,
        psychologicalLevels: analysis.psychologicalLevels,
        // Análise de IA (preços alvo)
        aiMinPrice: analysis.aiMinPrice,
        aiMaxPrice: analysis.aiMaxPrice,
        aiFairEntryPrice: analysis.aiFairEntryPrice,
        aiAnalysis: analysis.aiAnalysis,
        aiConfidence: analysis.aiConfidence,
        calculatedAt: analysis.calculatedAt
      }
    }
  } catch (error) {
    console.error(`[Ben] Erro ao buscar análise técnica de ${ticker}:`, error)
    return {
      success: false,
      error: `Erro ao buscar análise técnica: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Calcula o valor justo de uma empresa usando múltiplas estratégias de valuation
 * Combina Graham, FCD, Gordon, Barsi e Análise Técnica para uma avaliação completa
 */
export async function getFairValue(ticker: string) {
  try {
    const normalizedTicker = ticker.toUpperCase()
    
    // Calcular valores justos usando todas as estratégias disponíveis
    const upsideData = await calculateUpside(normalizedTicker)
    
    if (!upsideData) {
      return {
        success: false,
        error: `Não foi possível calcular valor justo para ${normalizedTicker}. Dados financeiros insuficientes.`
      }
    }

    const {
      currentPrice,
      fairValue,
      upside,
      fairValueModel,
      upsides,
      fairValues,
      overallScore,
      dividendYield
    } = upsideData

    // Buscar nome da empresa e indicadores fundamentais para contexto
    const company = await prisma.company.findUnique({
      where: { ticker: normalizedTicker },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 1
        }
      }
    })

    // Extrair indicadores fundamentais principais
    const latestFinancials = company?.financialData?.[0]
    const fundamentalIndicators = latestFinancials ? {
      pl: latestFinancials.pl ? Number(latestFinancials.pl) : null,
      pvp: latestFinancials.pvp ? Number(latestFinancials.pvp) : null,
      roe: latestFinancials.roe ? Number(latestFinancials.roe) * 100 : null, // Converter para %
      roic: latestFinancials.roic ? Number(latestFinancials.roic) * 100 : null, // Converter para %
      roa: latestFinancials.roa ? Number(latestFinancials.roa) * 100 : null, // Converter para %
      dy: latestFinancials.dy ? Number(latestFinancials.dy) * 100 : null, // Converter para %
      margemLiquida: latestFinancials.margemLiquida ? Number(latestFinancials.margemLiquida) * 100 : null, // Converter para %
      dividaLiquidaPl: latestFinancials.dividaLiquidaPl ? Number(latestFinancials.dividaLiquidaPl) : null,
      lpa: latestFinancials.lpa ? Number(latestFinancials.lpa) : null,
      vpa: latestFinancials.vpa ? Number(latestFinancials.vpa) : null
    } : null

    // Construir análise combinada
    const strategies = []
    
    if (fairValues.graham !== null && upsides.graham !== null) {
      strategies.push({
        model: 'Graham',
        fairValue: fairValues.graham,
        upside: upsides.graham,
        description: 'Fórmula clássica de Benjamin Graham: √(22.5 × LPA × VPA). Método conservador baseado em lucro por ação e valor patrimonial.'
      })
    }

    if (fairValues.fcd !== null && upsides.fcd !== null) {
      strategies.push({
        model: 'FCD (Fluxo de Caixa Descontado)',
        fairValue: fairValues.fcd,
        upside: upsides.fcd,
        description: 'Projeção de fluxos de caixa futuros descontados ao valor presente. Método mais preciso para empresas com fluxos de caixa estáveis.'
      })
    }

    if (fairValues.gordon !== null && upsides.gordon !== null) {
      strategies.push({
        model: 'Gordon (Dividend Discount Model)',
        fairValue: fairValues.gordon,
        upside: upsides.gordon,
        description: 'Modelo de desconto de dividendos. Ideal para empresas pagadoras de dividendos consistentes.'
      })
    }

    if (fairValues.barsi !== null && upsides.barsi !== null) {
      strategies.push({
        model: 'Barsi',
        fairValue: fairValues.barsi,
        upside: upsides.barsi,
        description: 'Método desenvolvido por Luiz Barsi. Foca em empresas com histórico sólido de dividendos e crescimento.'
      })
    }

    if (fairValues.technical !== null && upsides.technical !== null) {
      strategies.push({
        model: 'Análise Técnica (IA)',
        fairValue: fairValues.technical,
        upside: upsides.technical,
        description: 'Preço justo baseado em análise técnica e padrões de mercado identificados por IA.'
      })
    }

    // Determinar melhor estratégia (maior upside ou mais conservadora)
    const bestStrategy = strategies.length > 0 
      ? strategies.reduce((best, current) => 
          (current.upside || 0) > (best.upside || 0) ? current : best
        )
      : null

    // Construir análise combinada que amarra valores justos com indicadores
    let combinedAnalysis = ''
    if (bestStrategy && fundamentalIndicators) {
      const indicators = fundamentalIndicators
      combinedAnalysis = `**Análise Combinada de Valor Justo e Indicadores Fundamentais:**

**Valores Justos Calculados:**
${strategies.map(s => `- ${s.model}: R$ ${s.fairValue.toFixed(2)} (potencial de ${s.upside > 0 ? '+' : ''}${s.upside.toFixed(2)}%)`).join('\n')}

**Indicadores Fundamentais Relevantes:**
${indicators.pl !== null ? `- P/L: ${indicators.pl.toFixed(2)}x ${indicators.pl < 15 ? '(atrativo)' : indicators.pl > 25 ? '(caro)' : '(moderado)'}` : ''}
${indicators.pvp !== null ? `- P/VP: ${indicators.pvp.toFixed(2)}x ${indicators.pvp < 1.5 ? '(atrativo)' : indicators.pvp > 3 ? '(caro)' : '(moderado)'}` : ''}
${indicators.roe !== null ? `- ROE: ${indicators.roe.toFixed(2)}% ${indicators.roe > 15 ? '(bom)' : indicators.roe < 10 ? '(fraco)' : '(moderado)'}` : ''}
${indicators.roic !== null ? `- ROIC: ${indicators.roic.toFixed(2)}% ${indicators.roic > 12 ? '(bom)' : indicators.roic < 8 ? '(fraco)' : '(moderado)'}` : ''}
${indicators.dy !== null ? `- Dividend Yield: ${indicators.dy.toFixed(2)}% ${indicators.dy > 6 ? '(alto)' : indicators.dy < 3 ? '(baixo)' : '(moderado)'}` : ''}

**Conclusão Integrada:**
Os modelos de valuation indicam ${bestStrategy.upside > 0 ? 'potencial de valorização' : bestStrategy.upside < 0 ? 'possível sobrevalorização' : 'avaliação neutra'}, o que ${fundamentalIndicators.pl && fundamentalIndicators.pl < 15 && fundamentalIndicators.pvp && fundamentalIndicators.pvp < 2 ? 'é corroborado pelos indicadores de valuation (P/L e P/VP) que sugerem preço atrativo' : fundamentalIndicators.pl && fundamentalIndicators.pl > 25 ? 'contrasta com indicadores de valuation elevados (P/L alto)' : 'deve ser analisado em conjunto com outros fatores'}.`

    } else if (bestStrategy) {
      combinedAnalysis = `**Valores Justos Calculados:**
${strategies.map(s => `- ${s.model}: R$ ${s.fairValue.toFixed(2)} (potencial de ${s.upside > 0 ? '+' : ''}${s.upside.toFixed(2)}%)`).join('\n')}

**Conclusão:**
O modelo ${bestStrategy.model} indica um valor justo de R$ ${bestStrategy.fairValue.toFixed(2)}, representando um potencial de ${bestStrategy.upside > 0 ? '+' : ''}${bestStrategy.upside.toFixed(2)}% em relação ao preço atual de R$ ${currentPrice.toFixed(2)}.`
    }

    return {
      success: true,
      data: {
        ticker: normalizedTicker,
        companyName: company?.name || null,
        sector: company?.sector || null,
        currentPrice,
        bestFairValue: fairValue,
        bestUpside: upside,
        bestModel: fairValueModel,
        overallScore,
        dividendYield,
        fundamentalIndicators,
        strategies,
        analysis: {
          summary: bestStrategy 
            ? `O valor justo estimado para ${normalizedTicker} varia entre R$ ${Math.min(...strategies.map(s => s.fairValue)).toFixed(2)} e R$ ${Math.max(...strategies.map(s => s.fairValue)).toFixed(2)} dependendo do modelo utilizado. O modelo ${bestStrategy.model} indica um valor justo de R$ ${bestStrategy.fairValue.toFixed(2)}, representando um potencial de ${bestStrategy.upside.toFixed(2)}% em relação ao preço atual de R$ ${currentPrice.toFixed(2)}.`
            : 'Não foi possível calcular valor justo com os modelos disponíveis.',
          recommendation: bestStrategy && bestStrategy.upside > 0
            ? `Com base na análise combinada de ${strategies.length} modelos diferentes, ${normalizedTicker} apresenta potencial de valorização. O modelo ${bestStrategy.model} sugere que a ação está subvalorizada.`
            : bestStrategy && bestStrategy.upside < 0
            ? `A análise combinada sugere que ${normalizedTicker} pode estar sobrevalorizada segundo os modelos fundamentais.`
            : 'Análise inconclusiva. Considere fatores adicionais antes de tomar decisão de investimento.',
          combinedAnalysis: combinedAnalysis || null
        },
        pageUrl: `/acao/${normalizedTicker}`, // URL da página oficial do ticker
        note: `💡 O valor justo detalhado também está disponível na página oficial de ${normalizedTicker} em /acao/${normalizedTicker} com visualização completa, gráficos e análise detalhada de cada modelo.`
      }
    }
  } catch (error) {
    console.error(`[Ben] Erro ao calcular valor justo de ${ticker}:`, error)
    return {
      success: false,
      error: `Erro ao calcular valor justo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Consulta todas as carteiras do usuário com métricas completas
 * Retorna informações detalhadas sobre cada carteira incluindo:
 * - Informações básicas (nome, descrição, data de início)
 * - Métricas de performance (retorno total, retorno anualizado, volatilidade, Sharpe ratio, max drawdown)
 * - Holdings (ativos e suas posições com retornos individuais)
 * - Alocação por setor e indústria
 * - Evolução temporal mensal
 * - Comparação com benchmark (quando disponível)
 */
export async function getUserPortfolios(userId: string) {
  try {
    // Buscar todas as carteiras ativas do usuário
    const portfolios = await prisma.portfolioConfig.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        assets: {
          where: { isActive: true },
          select: {
            ticker: true,
            targetAllocation: true
          }
        },
        metrics: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (portfolios.length === 0) {
      return {
        success: true,
        data: {
          portfolios: [],
          count: 0,
          message: 'Usuário não possui carteiras cadastradas'
        }
      }
    }

    // Buscar métricas completas para cada carteira
    const portfoliosWithMetrics = await Promise.all(
      portfolios.map(async (portfolio) => {
        try {
          // Verificar se as métricas estão atualizadas (últimas 5 minutos)
          const metrics = portfolio.metrics
          const needsRefresh = !metrics || 
            !metrics.lastCalculatedAt || 
            (Date.now() - new Date(metrics.lastCalculatedAt).getTime() > 5 * 60 * 1000)

          if (needsRefresh) {
            console.log(`[Ben] Atualizando métricas da carteira ${portfolio.id}...`)
            await PortfolioMetricsService.updateMetrics(portfolio.id, userId)
          }

          // Buscar métricas atualizadas
          const updatedMetrics = await PortfolioMetricsService.getMetrics(portfolio.id, userId)

          // Extrair holdings do JSON
          const holdings = (updatedMetrics.assetHoldings as any[]) || []
          const monthlyReturns = (updatedMetrics.monthlyReturns as any[]) || []
          const evolutionData = (updatedMetrics.evolutionData as any[]) || []
          const sectorAllocation = (updatedMetrics.sectorAllocation as any[]) || []
          const industryAllocation = (updatedMetrics.industryAllocation as any[]) || []

          // Calcular estatísticas resumidas
          const totalHoldings = holdings.length
          const totalPositions = holdings.reduce((sum, h) => sum + (h.quantity || 0), 0)
          const topHoldings = holdings
            .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
            .slice(0, 5)
            .map(h => ({
              ticker: h.ticker,
              quantity: h.quantity || 0,
              currentValue: h.currentValue || 0,
              returnPercentage: h.returnPercentage || 0,
              allocation: h.actualAllocation || 0
            }))

          // Calcular top setores
          const topSectors = sectorAllocation
            .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
            .slice(0, 5)
            .map(s => ({
              sector: s.sector,
              value: s.value || 0,
              percentage: s.percentage || 0
            }))

          // Calcular estatísticas de retorno mensal
          const positiveMonths = monthlyReturns.filter((r: any) => (r.return || 0) > 0).length
          const negativeMonths = monthlyReturns.filter((r: any) => (r.return || 0) < 0).length
          const bestMonth = monthlyReturns.length > 0
            ? monthlyReturns.reduce((best: any, current: any) => 
                (current.return || 0) > (best.return || 0) ? current : best
              )
            : null
          const worstMonth = monthlyReturns.length > 0
            ? monthlyReturns.reduce((worst: any, current: any) => 
                (current.return || 0) < (worst.return || 0) ? current : worst
              )
            : null

          return {
            id: portfolio.id,
            name: portfolio.name,
            description: portfolio.description || null,
            startDate: portfolio.startDate,
            monthlyContribution: Number(portfolio.monthlyContribution) || 0,
            rebalanceFrequency: portfolio.rebalanceFrequency,
            createdAt: portfolio.createdAt,
            updatedAt: portfolio.updatedAt,
            // Métricas de valor
            currentValue: updatedMetrics.currentValue || 0,
            cashBalance: updatedMetrics.cashBalance || 0,
            totalInvested: updatedMetrics.totalInvested || 0,
            totalWithdrawn: updatedMetrics.totalWithdrawn || 0,
            netInvested: updatedMetrics.netInvested || 0,
            totalDividends: updatedMetrics.totalDividends || 0,
            // Métricas de performance
            totalReturn: updatedMetrics.totalReturn || 0,
            totalReturnPercentage: (updatedMetrics.totalReturn || 0) * 100,
            annualizedReturn: updatedMetrics.annualizedReturn || null,
            annualizedReturnPercentage: updatedMetrics.annualizedReturn ? updatedMetrics.annualizedReturn * 100 : null,
            volatility: updatedMetrics.volatility || null,
            volatilityPercentage: updatedMetrics.volatility ? updatedMetrics.volatility * 100 : null,
            sharpeRatio: updatedMetrics.sharpeRatio || null,
            maxDrawdown: updatedMetrics.maxDrawdown || null,
            maxDrawdownPercentage: updatedMetrics.maxDrawdown ? updatedMetrics.maxDrawdown * 100 : null,
            // Holdings e alocação
            totalHoldings,
            totalPositions,
            topHoldings,
            sectorAllocation: topSectors,
            industryAllocation: industryAllocation.slice(0, 5),
            // Estatísticas de retorno mensal
            monthlyReturnsCount: monthlyReturns.length,
            positiveMonths,
            negativeMonths,
            bestMonth: bestMonth ? {
              date: bestMonth.date,
              return: bestMonth.return || 0,
              returnPercentage: (bestMonth.return || 0) * 100,
              portfolioValue: bestMonth.portfolioValue || 0
            } : null,
            worstMonth: worstMonth ? {
              date: worstMonth.date,
              return: worstMonth.return || 0,
              returnPercentage: (worstMonth.return || 0) * 100,
              portfolioValue: worstMonth.portfolioValue || 0
            } : null,
            // Evolução temporal (últimos 6 meses)
            recentEvolution: evolutionData.slice(-6),
            // Ativos configurados
            configuredAssets: portfolio.assets.map(a => ({
              ticker: a.ticker,
              targetAllocation: Number(a.targetAllocation) * 100
            })),
            // Data da última atualização das métricas
            metricsLastUpdated: updatedMetrics.lastCalculatedAt || null
          }
        } catch (error) {
          console.error(`[Ben] Erro ao buscar métricas da carteira ${portfolio.id}:`, error)
          // Retornar informações básicas mesmo se houver erro nas métricas
          return {
            id: portfolio.id,
            name: portfolio.name,
            description: portfolio.description || null,
            startDate: portfolio.startDate,
            createdAt: portfolio.createdAt,
            error: `Erro ao calcular métricas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          }
        }
      })
    )

    // Filtrar carteiras com erro (opcional - pode manter para mostrar que existem mas têm problemas)
    const validPortfolios = portfoliosWithMetrics.filter(p => !p.error)
    const portfoliosWithErrors = portfoliosWithMetrics.filter(p => p.error)

    return {
      success: true,
      data: {
        portfolios: validPortfolios,
        portfoliosWithErrors: portfoliosWithErrors.length > 0 ? portfoliosWithErrors : undefined,
        count: validPortfolios.length,
        totalCount: portfolios.length,
        summary: {
          totalValue: validPortfolios.reduce((sum, p) => sum + (p.currentValue || 0), 0),
          totalInvested: validPortfolios.reduce((sum, p) => sum + (p.totalInvested || 0), 0),
          totalReturn: validPortfolios.length > 0
            ? validPortfolios.reduce((sum, p) => sum + (p.totalReturn || 0), 0) / validPortfolios.length
            : 0,
          averageSharpeRatio: validPortfolios
            .filter(p => p.sharpeRatio !== null)
            .length > 0
            ? validPortfolios
                .filter(p => p.sharpeRatio !== null)
                .reduce((sum, p) => sum + (p.sharpeRatio || 0), 0) /
              validPortfolios.filter(p => p.sharpeRatio !== null).length
            : null
        }
      }
    }
  } catch (error) {
    console.error('[Ben] Erro ao buscar carteiras do usuário:', error)
    return {
      success: false,
      error: `Erro ao buscar carteiras: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Lista relatórios de IA disponíveis para uma empresa (apenas metadados e links)
 * Retorna apenas informações básicas: tipo, data, link - SEM conteúdo completo
 * Use quando o usuário pedir para LISTAR relatórios disponíveis
 */
export async function listCompanyAIReports(ticker: string, reportType?: string, limit?: number) {
  try {
    const normalizedTicker = ticker.toUpperCase()
    
    // Buscar empresa com assetType para determinar a rota correta
    const company = await prisma.company.findUnique({
      where: { ticker: normalizedTicker },
      select: { id: true, name: true, ticker: true, assetType: true }
    })

    if (!company) {
      return {
        success: false,
        error: `Empresa ${normalizedTicker} não encontrada`
      }
    }

    // Determinar o prefixo da rota baseado no tipo de ativo
    const getRoutePrefix = (assetType: string) => {
      switch (assetType) {
        case 'BDR':
          return 'bdr'
        case 'ETF':
          return 'etf'
        case 'FII':
          return 'fii'
        case 'STOCK':
        default:
          return 'acao'
      }
    }

    const routePrefix = getRoutePrefix(company.assetType || 'STOCK')
    const tickerLower = normalizedTicker.toLowerCase()

    // Construir filtro de tipo
    const typeFilter = reportType 
      ? (reportType.toUpperCase() as 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE' | 'PRICE_VARIATION' | 'CUSTOM_TRIGGER')
      : undefined

    // Buscar TODOS os relatórios (sem limite padrão e sem filtro isActive para listar todos)
    const reports = await prisma.aIReport.findMany({
      where: {
        companyId: company.id,
        status: 'COMPLETED',
        // Remover filtro isActive para retornar TODOS os relatórios, não apenas os ativos
        ...(typeFilter && { type: typeFilter })
      },
      orderBy: {
        createdAt: 'desc'
      },
      // Aplicar limite apenas se especificado explicitamente
      ...(limit && limit > 0 ? { take: limit } : {}),
      include: {
        flags: {
          where: { isActive: true },
          select: {
            id: true,
            flagType: true,
            reason: true,
            createdAt: true
          }
        }
      }
    })

    if (reports.length === 0) {
      return {
        success: true,
        data: {
          ticker: normalizedTicker,
          companyName: company.name,
          reports: [],
          count: 0,
          message: `Nenhum relatório de IA encontrado para ${normalizedTicker}${typeFilter ? ` do tipo ${typeFilter}` : ''}`
        }
      }
    }

    // Processar relatórios - APENAS METADADOS (sem conteúdo completo)
    const processedReports = reports.map(report => {
      // Determinar tipo de relatório em português
      const getReportTypeLabel = (type: string) => {
        switch (type) {
          case 'MONTHLY_OVERVIEW':
            return 'Relatório Mensal'
          case 'FUNDAMENTAL_CHANGE':
            return 'Mudança Fundamental'
          case 'PRICE_VARIATION':
            return 'Variação de Preço'
          case 'CUSTOM_TRIGGER':
            return 'Gatilho Customizado'
          default:
            return type
        }
      }

      return {
        id: report.id,
        type: report.type,
        typeLabel: getReportTypeLabel(report.type),
        // Metadados básicos apenas
        currentScore: report.currentScore ? Number(report.currentScore) : null,
        previousScore: report.previousScore ? Number(report.previousScore) : null,
        changeDirection: report.changeDirection || null,
        windowDays: report.windowDays || null,
        createdAt: report.createdAt,
        hasActiveFlags: report.flags.length > 0,
        // Links diretos para a plataforma
        url: `/${routePrefix}/${tickerLower}/relatorios/${report.id}`,
        listUrl: `/${routePrefix}/${tickerLower}/relatorios`
      }
    })

    // Calcular estatísticas
    const stats = {
      totalReports: reports.length,
      byType: reports.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      withFlags: reports.filter(r => r.flags.length > 0).length,
      averageScore: reports
        .filter(r => r.currentScore !== null)
        .length > 0
        ? reports
            .filter(r => r.currentScore !== null)
            .reduce((sum, r) => sum + Number(r.currentScore || 0), 0) /
          reports.filter(r => r.currentScore !== null).length
        : null,
      latestReportDate: reports[0]?.createdAt || null
    }

    return {
      success: true,
      data: {
        ticker: normalizedTicker,
        companyName: company.name,
        reports: processedReports,
        count: processedReports.length,
        statistics: stats,
        listUrl: `/${routePrefix}/${tickerLower}/relatorios`,
        message: `Encontrados ${processedReports.length} relatório(s) de IA para ${normalizedTicker}`,
        instruction: `Esta ferramenta retorna APENAS metadados (tipo, data, link) dos relatórios. Para ver o CONTEÚDO completo dos relatórios, use a ferramenta getCompanyAIReportContent. Apresente lista numerada. Formato: "1. **[typeLabel]** - [data pt-BR]\n   [Link do Relatório]([url])". Máximo 1 linha de introdução.`
      }
    }
  } catch (error) {
    console.error(`[Ben] Erro ao buscar relatórios de IA de ${ticker}:`, error)
    return {
      success: false,
      error: `Erro ao buscar relatórios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Busca o CONTEÚDO COMPLETO de relatórios de IA específicos de uma empresa
 * Retorna conteúdo completo (content), conclusão (conclusion), análises estratégicas, scores, etc.
 * Use quando o usuário pedir para RESUMAR, ANALISAR, ou fazer perguntas sobre o CONTEÚDO dos relatórios
 */
export async function getCompanyAIReportContent(ticker: string, reportType?: string, reportIds?: string[]) {
  try {
    const normalizedTicker = ticker.toUpperCase()
    
    // Buscar empresa com assetType para determinar a rota correta
    const company = await prisma.company.findUnique({
      where: { ticker: normalizedTicker },
      select: { id: true, name: true, ticker: true, assetType: true }
    })

    if (!company) {
      return {
        success: false,
        error: `Empresa ${normalizedTicker} não encontrada`
      }
    }

    // Determinar o prefixo da rota baseado no tipo de ativo
    const getRoutePrefix = (assetType: string) => {
      switch (assetType) {
        case 'BDR':
          return 'bdr'
        case 'ETF':
          return 'etf'
        case 'FII':
          return 'fii'
        case 'STOCK':
        default:
          return 'acao'
      }
    }

    const routePrefix = getRoutePrefix(company.assetType || 'STOCK')
    const tickerLower = normalizedTicker.toLowerCase()

    // Construir filtro de tipo
    const typeFilter = reportType 
      ? (reportType.toUpperCase() as 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE' | 'PRICE_VARIATION' | 'CUSTOM_TRIGGER')
      : undefined

    // Buscar relatórios com CONTEÚDO COMPLETO
    const whereClause: any = {
      companyId: company.id,
      status: 'COMPLETED',
      ...(typeFilter && { type: typeFilter }),
      ...(reportIds && reportIds.length > 0 ? { id: { in: reportIds } } : {})
    }

    const reports = await prisma.aIReport.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        flags: {
          where: { isActive: true },
          select: {
            id: true,
            flagType: true,
            reason: true,
            createdAt: true
          }
        }
      }
    })

    if (reports.length === 0) {
      return {
        success: true,
        data: {
          ticker: normalizedTicker,
          companyName: company.name,
          reports: [],
          count: 0,
          message: `Nenhum relatório de IA encontrado para ${normalizedTicker}${typeFilter ? ` do tipo ${typeFilter}` : ''}`
        }
      }
    }

    // Processar relatórios com CONTEÚDO COMPLETO
    const processedReports = reports.map(report => {
      const getReportTypeLabel = (type: string) => {
        switch (type) {
          case 'MONTHLY_OVERVIEW':
            return 'Relatório Mensal'
          case 'FUNDAMENTAL_CHANGE':
            return 'Mudança Fundamental'
          case 'PRICE_VARIATION':
            return 'Variação de Preço'
          case 'CUSTOM_TRIGGER':
            return 'Gatilho Customizado'
          default:
            return type
        }
      }

      return {
        id: report.id,
        type: report.type,
        typeLabel: getReportTypeLabel(report.type),
        // CONTEÚDO COMPLETO para análise
        content: report.content,
        conclusion: report.conclusion || null,
        strategicAnalyses: report.strategicAnalyses || null,
        metadata: report.metadata || null,
        currentScore: report.currentScore ? Number(report.currentScore) : null,
        previousScore: report.previousScore ? Number(report.previousScore) : null,
        changeDirection: report.changeDirection || null,
        windowDays: report.windowDays || null,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        hasActiveFlags: report.flags.length > 0,
        flags: report.flags.map(flag => ({
          id: flag.id,
          flagType: flag.flagType,
          reason: flag.reason,
          createdAt: flag.createdAt
        })),
        url: `/${routePrefix}/${tickerLower}/relatorios/${report.id}`,
        listUrl: `/${routePrefix}/${tickerLower}/relatorios`
      }
    })

    return {
      success: true,
      data: {
        ticker: normalizedTicker,
        companyName: company.name,
        reports: processedReports,
        count: processedReports.length,
        message: `Conteúdo completo de ${processedReports.length} relatório(s) de IA para ${normalizedTicker}`,
        instruction: `CRÍTICO: Use APENAS o conteúdo real dos campos "content" e "conclusion" de cada relatório para responder. NÃO invente informações genéricas. Cite diretamente do conteúdo quando perguntar "o que concluiu" ou "o que diz". Se o campo "conclusion" existir, use-o primeiro. Se não existir, extraia do campo "content". NUNCA generalize - sempre cite informações específicas dos relatórios.`
      }
    }
  } catch (error) {
    console.error(`[Ben] Erro ao buscar conteúdo dos relatórios de IA de ${ticker}:`, error)
    return {
      success: false,
      error: `Erro ao buscar conteúdo dos relatórios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Busca empresas com flags ativos (problemas fundamentais, riscos, etc.)
 * Permite filtrar e ordenar para responder perguntas sobre empresas problemáticas
 * Use quando o usuário perguntar sobre empresas que perderam fundamentos,
 * piores empresas da bolsa, empresas de risco, ou qualquer variação similar
 */
export async function getCompanyFlags(options?: {
  flagType?: string
  limit?: number
  orderBy?: 'recent' | 'oldest' | 'company'
  includeInactive?: boolean
}): Promise<any> {
  try {
    const {
      flagType,
      limit = 50,
      orderBy = 'recent',
      includeInactive = false
    } = options || {}

    // Construir filtro
    const whereClause: any = {
      ...(includeInactive ? {} : { isActive: true })
    }

    if (flagType) {
      whereClause.flagType = flagType.toUpperCase()
    }

    // Buscar flags com informações da empresa
    const flags = await prisma.companyFlag.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            ticker: true,
            name: true,
            sector: true,
            industry: true
          }
        },
        report: {
          select: {
            id: true,
            type: true,
            currentScore: true,
            previousScore: true,
            createdAt: true
          }
        }
      },
      orderBy: orderBy === 'recent' 
        ? { createdAt: 'desc' }
        : orderBy === 'oldest'
        ? { createdAt: 'asc' }
        : { company: { ticker: 'asc' } },
      take: limit
    })

    if (flags.length === 0) {
      return {
        success: true,
        data: {
          flags: [],
          count: 0,
          message: includeInactive 
            ? 'Nenhuma flag encontrada no sistema'
            : 'Nenhuma flag ativa encontrada no sistema'
        }
      }
    }

    // Processar flags com informações completas
    const processedFlags = flags.map(flag => ({
      id: flag.id,
      flagType: flag.flagType,
      reason: flag.reason,
      isActive: flag.isActive,
      createdAt: flag.createdAt,
      lastReevaluatedAt: flag.lastReevaluatedAt || null,
      reevaluationCount: flag.reevaluationCount,
      company: {
        ticker: flag.company.ticker,
        name: flag.company.name,
        sector: flag.company.sector,
        industry: flag.company.industry
      },
      report: {
        id: flag.report.id,
        type: flag.report.type,
        currentScore: flag.report.currentScore ? Number(flag.report.currentScore) : null,
        previousScore: flag.report.previousScore ? Number(flag.report.previousScore) : null,
        createdAt: flag.report.createdAt
      }
    }))

    // Calcular estatísticas
    const stats = {
      totalFlags: flags.length,
      activeFlags: flags.filter(f => f.isActive).length,
      inactiveFlags: flags.filter(f => !f.isActive).length,
      byType: flags.reduce((acc, f) => {
        acc[f.flagType] = (acc[f.flagType] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      bySector: flags.reduce((acc, f) => {
        const sector = f.company.sector || 'Não informado'
        acc[sector] = (acc[sector] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      averageScore: flags
        .filter(f => f.report.currentScore !== null)
        .length > 0
        ? flags
            .filter(f => f.report.currentScore !== null)
            .reduce((sum, f) => sum + Number(f.report.currentScore || 0), 0) /
          flags.filter(f => f.report.currentScore !== null).length
        : null,
      oldestFlag: flags.length > 0 ? flags[flags.length - 1]?.createdAt : null,
      newestFlag: flags.length > 0 ? flags[0]?.createdAt : null
    }

    return {
      success: true,
      data: {
        flags: processedFlags,
        count: processedFlags.length,
        statistics: stats,
        message: `Encontradas ${processedFlags.length} flag(s)${flagType ? ` do tipo ${flagType}` : ''}`
      }
    }
  } catch (error) {
    console.error('[Ben] Erro ao buscar flags de empresas:', error)
    return {
      success: false,
      error: `Erro ao buscar flags: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Obtém projeções de dividendos para uma ação
 */
export async function getDividendProjections(ticker: string) {
  try {
    const normalizedTicker = ticker.toUpperCase()
    
    // Buscar projeções
    const projections = await DividendRadarService.getOrGenerateProjections(normalizedTicker)

    // Buscar histórico de dividendos
    const company = await prisma.company.findUnique({
      where: { ticker: normalizedTicker },
      select: {
        name: true,
        dividendHistory: {
          orderBy: { exDate: 'desc' },
          take: 12, // Últimos 12 dividendos
          select: {
            exDate: true,
            amount: true
          }
        }
      }
    })

    if (!company) {
      return {
        success: false,
        error: `Empresa ${normalizedTicker} não encontrada`
      }
    }

    // Calcular totais
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const dividendsLast12Months = company.dividendHistory.filter(
      div => new Date(div.exDate) >= oneYearAgo
    )
    const totalLast12Months = dividendsLast12Months.reduce(
      (sum, div) => sum + Number(div.amount),
      0
    )

    // Calcular total projetado para próximos 12 meses
    const next12Months = projections.filter(proj => {
      const projDate = new Date(proj.projectedExDate)
      return projDate >= now && projDate <= new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    })
    const totalProjected = next12Months.reduce(
      (sum, proj) => sum + Number(proj.projectedAmount),
      0
    )

    return {
      success: true,
      data: {
        ticker: normalizedTicker,
        companyName: company.name,
        projections: projections.map(proj => ({
          month: proj.month,
          year: proj.year,
          amount: Number(proj.projectedAmount),
          date: proj.projectedExDate,
          confidence: proj.confidence
        })),
        historicalDividends: company.dividendHistory.map(div => ({
          date: div.exDate,
          amount: Number(div.amount)
        })),
        summary: {
          totalLast12Months,
          totalProjected,
          projectionCount: projections.length,
          historicalCount: company.dividendHistory.length
        }
      }
    }
  } catch (error) {
    console.error(`[Ben] Erro ao buscar projeções de dividendos de ${ticker}:`, error)
    return {
      success: false,
      error: `Erro ao buscar projeções de dividendos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Estrutura de dados das features da plataforma
 */
interface PlatformFeature {
  name: string
  description: string
  url: string
  category: 'valuation' | 'análise' | 'carteiras' | 'backtest' | 'conteúdo' | 'outros'
  plan: 'gratuito' | 'premium' | 'público'
  steps: string[]
  whenToUse: string
  examples: string[]
}

/**
 * Base de dados completa das features da plataforma
 */
const PLATFORM_FEATURES: PlatformFeature[] = [
  // MODELOS DE VALUATION
  {
    name: 'Fórmula de Graham',
    description: 'Método clássico de Benjamin Graham para calcular o preço justo de uma ação. Fórmula: Preço Justo = √(22.5 × LPA × VPA). Inclui filtros de qualidade: ROE ≥ 10%, Liquidez ≥ 1.0, Margem Líquida > 0%, Dívida/PL ≤ 150%.',
    url: '/ranking',
    category: 'valuation',
    plan: 'gratuito',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Fórmula de Graham"',
      'Configure os filtros de qualidade conforme necessário',
      'Visualize o ranking gerado (até 10 empresas no plano gratuito)',
      'Clique em uma empresa para ver análise detalhada'
    ],
    whenToUse: 'Use quando quiser encontrar ações subvalorizadas usando o método clássico de Benjamin Graham. Ideal para investidores conservadores que buscam segurança.',
    examples: ['Encontrar ações baratas e de qualidade', 'Ranking de ações com bom P/L e VPA', 'Análise fundamentalista básica']
  },
  {
    name: 'Anti-Dividend Trap',
    description: 'Estratégia focada em renda passiva sustentável que evita dividend traps. Filtros: ROE ≥ 10%, Liquidez Corrente ≥ 1.2, P/L entre 4-25, Margem Líquida ≥ 5%, Market Cap ≥ R$ 1B.',
    url: '/ranking',
    category: 'valuation',
    plan: 'premium',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Anti-Dividend Trap"',
      'Os filtros anti-trap já estão aplicados automaticamente',
      'Analise as empresas que aparecem no ranking',
      'Verifique o histórico de dividendos na análise individual'
    ],
    whenToUse: 'Use quando buscar empresas que pagam dividendos de forma sustentável, evitando empresas que podem estar pagando dividendos insustentáveis.',
    examples: ['Encontrar ações com dividendos sustentáveis', 'Evitar dividend traps', 'Renda passiva de qualidade']
  },
  {
    name: 'Fórmula Mágica de Greenblatt',
    description: 'Combina Earnings Yield (retorno sobre lucros) e ROIC (retorno sobre capital investido) para encontrar empresas baratas e de qualidade simultaneamente.',
    url: '/ranking',
    category: 'valuation',
    plan: 'premium',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Fórmula Mágica de Greenblatt"',
      'Visualize o ranking combinado de empresas baratas e de qualidade',
      'Analise as empresas top do ranking',
      'Considere rebalanceamento anual conforme a estratégia'
    ],
    whenToUse: 'Use quando quiser encontrar empresas que são ao mesmo tempo baratas (baixo P/L) e de alta qualidade (alto ROIC).',
    examples: ['Ranking de empresas baratas e boas', 'Estratégia de Joel Greenblatt', 'Investimento em valor com qualidade']
  },
  {
    name: 'Fundamentalista 3+1',
    description: 'Análise simplificada adaptativa que ajusta os critérios conforme o tipo de empresa: SEM Dívida (ROE + P/L), COM Dívida (ROIC + EV/EBITDA), Bancos/Seguradoras (ROE + P/L). Inclui bônus de análise de dividendos.',
    url: '/ranking',
    category: 'valuation',
    plan: 'premium',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Fundamentalista 3+1"',
      'O sistema automaticamente ajusta os critérios por tipo de empresa',
      'Analise os resultados considerando o tipo de empresa',
      'Verifique o bônus de dividendos quando aplicável'
    ],
    whenToUse: 'Use quando quiser uma análise adaptativa que considera as características específicas de cada tipo de empresa (com/sem dívida, bancos, etc.).',
    examples: ['Análise adaptativa por tipo de empresa', 'Ranking considerando estrutura de capital', 'Análise fundamentalista simplificada']
  },
  {
    name: 'Fluxo de Caixa Descontado (FCD)',
    description: 'Método mais preciso de valuation que projeta os fluxos de caixa futuros (5-10 anos) e desconta ao valor presente usando WACC. Inclui valor terminal e análise de sensibilidade.',
    url: '/ranking',
    category: 'valuation',
    plan: 'premium',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Fluxo de Caixa Descontado - FCD"',
      'Visualize o ranking baseado em projeções de fluxo de caixa',
      'Acesse a análise individual para ver detalhes das projeções',
      'Analise a sensibilidade aos diferentes cenários'
    ],
    whenToUse: 'Use quando quiser a avaliação mais precisa possível, baseada em projeções de fluxo de caixa futuro. Ideal para análise profunda de empresas.',
    examples: ['Valuation preciso de empresas', 'Análise de fluxo de caixa futuro', 'Valor justo baseado em projeções']
  },
  {
    name: 'Fórmula de Gordon (DDM)',
    description: 'Modelo de Desconto de Dividendos que calcula o valor de uma ação baseado nos dividendos futuros. Fórmula: Valor = D₁ ÷ (r - g). Ideal para empresas pagadoras de dividendos.',
    url: '/ranking',
    category: 'valuation',
    plan: 'premium',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Fórmula de Gordon - DDM"',
      'Visualize o ranking de empresas pagadoras de dividendos',
      'Analise as empresas com melhor projeção de dividendos',
      'Verifique a sustentabilidade dos dividendos'
    ],
    whenToUse: 'Use quando focar em empresas pagadoras de dividendos e quiser avaliar o valor justo baseado nos dividendos futuros.',
    examples: ['Avaliar ações pagadoras de dividendos', 'Renda passiva com crescimento', 'Modelo de desconto de dividendos']
  },
  {
    name: 'Low P/E Strategy',
    description: 'Estratégia que combina P/L baixo com qualidade operacional. Critérios: P/L entre 3-15, ROE ≥ 15%, ROA ≥ 5%, Liquidez ≥ 1.0.',
    url: '/ranking',
    category: 'valuation',
    plan: 'premium',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Low P/E Strategy"',
      'Visualize empresas com P/L baixo e alta qualidade',
      'Analise as empresas do ranking',
      'Compare com outras estratégias de valor'
    ],
    whenToUse: 'Use quando quiser encontrar empresas baratas (baixo P/L) que também têm alta qualidade operacional (alto ROE e ROA).',
    examples: ['Ações baratas com qualidade', 'Estratégia de P/L baixo', 'Value investing com qualidade']
  },
  {
    name: 'Análise Preditiva com IA',
    description: 'Google Gemini AI analisando todos os 7 modelos simultaneamente. Inclui análise de demonstrações financeiras, busca de notícias, contexto macroeconômico, ranking preditivo personalizado e insights qualitativos.',
    url: '/ranking',
    category: 'valuation',
    plan: 'premium',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo "Análise Preditiva com IA"',
      'Aguarde a análise completa da IA (pode levar alguns segundos)',
      'Visualize o ranking preditivo personalizado',
      'Leia os insights qualitativos fornecidos pela IA',
      'Analise as empresas recomendadas'
    ],
    whenToUse: 'Use quando quiser a análise mais completa e avançada, combinando todos os modelos com inteligência artificial, notícias e contexto macroeconômico.',
    examples: ['Análise completa com IA', 'Ranking preditivo personalizado', 'Insights qualitativos de investimento']
  },
  // FERRAMENTAS DE ANÁLISE
  {
    name: 'Ranking Rápido (Quick Ranker)',
    description: 'Ferramenta interativa na homepage que permite gerar rankings instantâneos. Seleção de modelo, configuração de parâmetros com sliders/inputs, visualização de até 10 empresas (gratuito) ou ilimitado (premium).',
    url: '/',
    category: 'análise',
    plan: 'gratuito',
    steps: [
      'Acesse a homepage (/)',
      'Localize a seção "Ranking Rápido"',
      'Selecione o modelo de valuation desejado',
      'Ajuste os parâmetros usando os sliders',
      'Clique em "Gerar Ranking"',
      'Visualize os resultados instantaneamente'
    ],
    whenToUse: 'Use quando quiser gerar um ranking rápido sem precisar acessar a página completa de rankings. Ideal para testes rápidos.',
    examples: ['Teste rápido de modelos', 'Ranking instantâneo', 'Análise rápida na homepage']
  },
  {
    name: 'Rankings Avançados',
    description: 'Página completa de rankings com todos os 8 modelos disponíveis. Filtros avançados por setor e tamanho de empresa, histórico de rankings salvos, exportação de resultados e comparação lado a lado.',
    url: '/ranking',
    category: 'análise',
    plan: 'gratuito',
    steps: [
      'Acesse a página de Rankings (/ranking)',
      'Selecione o modelo de valuation desejado',
      'Configure filtros por setor ou tamanho de empresa (premium)',
      'Ajuste os parâmetros do modelo',
      'Gere o ranking',
      'Salve o ranking para histórico (premium)',
      'Exporte os resultados se necessário (premium)',
      'Compare com rankings anteriores'
    ],
    whenToUse: 'Use quando quiser análises completas de rankings com todas as opções disponíveis, filtros avançados e histórico.',
    examples: ['Ranking completo de ações', 'Análise de setores', 'Comparação de modelos de valuation']
  },
  {
    name: 'Screening de Ações',
    description: 'Filtros customizáveis avançados para encontrar ações específicas. Filtros por Valuation (P/L, P/VP, EV/EBITDA, PSR), Rentabilidade (ROE, ROIC, ROA), Crescimento, Dividendos, Endividamento, Liquidez, Market Cap. Inclui assistente com IA para gerar filtros.',
    url: '/screening-acoes',
    category: 'análise',
    plan: 'premium',
    steps: [
      'Acesse a página de Screening (/screening-acoes)',
      'Use o assistente com IA para gerar filtros ou configure manualmente',
      'Selecione os filtros desejados por categoria',
      'Configure os valores mínimos/máximos para cada filtro',
      'Aplique filtro por tamanho de empresa se necessário',
      'Visualize os resultados',
      'Salve o screening para uso futuro',
      'Acesse análises individuais das empresas encontradas'
    ],
    whenToUse: 'Use quando quiser encontrar ações específicas que atendem critérios muito específicos de múltiplos indicadores simultaneamente.',
    examples: ['Encontrar ações com ROE alto e P/L baixo', 'Screening por dividendos e crescimento', 'Filtros customizados avançados']
  },
  {
    name: 'Comparador de Ações',
    description: 'Compare até 6 ações lado a lado com mais de 25 indicadores fundamentalistas. Indicadores básicos (gratuito): P/L, P/VP, ROE, Dividend Yield, Valor de Mercado, Receita. Indicadores premium: Margem Líquida, ROIC, CAGR, médias históricas, rankings com medalhas.',
    url: '/comparador',
    category: 'análise',
    plan: 'gratuito',
    steps: [
      'Acesse a página do Comparador (/comparador)',
      'Use a busca inteligente para adicionar ações (até 6)',
      'Ou escolha uma comparação pré-configurada popular',
      'Visualize os indicadores lado a lado',
      'Compare indicadores básicos (gratuito) ou completos (premium)',
      'Analise as diferenças entre as empresas',
      'Acesse análises individuais clicando nas ações'
    ],
    whenToUse: 'Use quando quiser comparar múltiplas ações simultaneamente para tomar decisões de investimento. Ideal para escolher entre opções similares.',
    examples: ['Comparar bancos', 'Escolher entre ações do mesmo setor', 'Análise comparativa detalhada']
  },
  {
    name: 'Análise Setorial',
    description: 'Compare empresas por setor. Análise de 25+ setores da B3, melhores empresas de cada setor, comparação lado a lado dentro do setor, indicadores setoriais agregados e identificação de líderes setoriais.',
    url: '/analise-setorial',
    category: 'análise',
    plan: 'premium',
    steps: [
      'Acesse a página de Análise Setorial (/analise-setorial)',
      'Selecione o setor de interesse',
      'Visualize as melhores empresas do setor',
      'Compare empresas lado a lado dentro do setor',
      'Analise indicadores setoriais agregados',
      'Identifique líderes setoriais',
      'Acesse análises individuais das empresas'
    ],
    whenToUse: 'Use quando quiser entender a dinâmica de um setor específico e identificar as melhores empresas dentro dele.',
    examples: ['Análise do setor bancário', 'Melhores empresas de tecnologia', 'Comparação dentro do setor']
  },
  {
    name: 'Radar de Oportunidades',
    description: 'Visão consolidada e visual de oportunidades de investimento. Visualização em grid/radar, filtros por múltiplos critérios e identificação rápida de oportunidades.',
    url: '/radar',
    category: 'análise',
    plan: 'premium',
    steps: [
      'Acesse a página do Radar (/radar)',
      'Configure os filtros de oportunidade desejados',
      'Visualize as empresas em formato de grid/radar',
      'Identifique rapidamente as melhores oportunidades',
      'Clique em uma empresa para análise detalhada',
      'Adicione empresas ao seu radar pessoal'
    ],
    whenToUse: 'Use quando quiser uma visão visual e consolidada de múltiplas oportunidades de investimento de forma rápida.',
    examples: ['Encontrar oportunidades rapidamente', 'Visão geral do mercado', 'Radar visual de ações']
  },
  {
    name: 'Radar de Dividendos',
    description: 'Projeções de dividendos com IA. Projeções dos próximos 12 meses, calendário completo de proventos, empresas pagadoras de altos dividendos, análise de sustentabilidade de dividendos e histórico de pagamentos.',
    url: '/radar-dividendos',
    category: 'análise',
    plan: 'gratuito',
    steps: [
      'Acesse a página do Radar de Dividendos (/radar-dividendos)',
      'Visualize as projeções dos próximos 12 meses',
      'Consulte o calendário completo de proventos',
      'Filtre por empresas com maiores dividendos',
      'Analise a sustentabilidade dos dividendos',
      'Verifique o histórico de pagamentos',
      'Acesse análises individuais para mais detalhes'
    ],
    whenToUse: 'Use quando focar em renda passiva e quiser planejar investimentos baseados em projeções de dividendos.',
    examples: ['Planejar renda passiva', 'Calendário de dividendos', 'Encontrar ações pagadoras']
  },
  {
    name: 'Análise Individual de Ação',
    description: 'Página completa de análise por empresa. Todos os 8 modelos aplicados, score geral ponderado, 65+ indicadores fundamentalistas, histórico de preços (5+ anos), análise com IA (premium), análise técnica (premium), relatórios em PDF (premium), comparação com setor e gráficos interativos.',
    url: '/acao',
    category: 'análise',
    plan: 'gratuito',
    steps: [
      'Acesse a página de análise individual (/acao/[ticker])',
      'Visualize o score geral da empresa',
      'Analise todos os 8 modelos de valuation aplicados',
      'Consulte os 65+ indicadores fundamentalistas',
      'Veja o histórico de preços (5+ anos)',
      'Acesse análise com IA se for premium',
      'Veja análise técnica se for premium',
      'Compare com outras empresas do setor',
      'Gere relatório em PDF se for premium'
    ],
    whenToUse: 'Use quando quiser uma análise completa e detalhada de uma empresa específica antes de investir.',
    examples: ['Análise completa de PETR4', 'Avaliar empresa antes de comprar', 'Análise detalhada fundamentalista']
  },
  // GESTÃO DE CARTEIRAS
  {
    name: 'Gestão de Carteiras',
    description: 'Sistema completo de gestão de carteiras. Múltiplas carteiras por usuário, configuração de alocação de ativos (%), acompanhamento de transações (Compra, Venda, Dividendos, JCP, Bonificação, Desdobramento, Grupamento), métricas de performance (Retorno total, Retorno percentual, Sharpe Ratio, Drawdown Máximo), integração com Backtest e sugestões de transações com IA.',
    url: '/carteira',
    category: 'carteiras',
    plan: 'premium',
    steps: [
      'Acesse a página de Carteiras (/carteira)',
      'Crie uma nova carteira ou selecione uma existente',
      'Configure a alocação de ativos (%)',
      'Adicione transações (compras, vendas, dividendos, etc.)',
      'Visualize métricas de performance',
      'Use sugestões de transações com IA',
      'Confirme ou rejeite transações sugeridas',
      'Integre com backtest se desejar',
      'Acompanhe a evolução temporal da carteira'
    ],
    whenToUse: 'Use quando quiser gerenciar suas carteiras de investimento, acompanhar transações e medir performance.',
    examples: ['Gerenciar minha carteira', 'Acompanhar transações', 'Medir performance de investimentos']
  },
  // BACKTESTING
  {
    name: 'Backtesting de Carteiras',
    description: 'Simulação de desempenho histórico de carteiras. Configuração de carteira inicial, aportes mensais configuráveis, rebalanceamento automático, período histórico configurável, métricas avançadas (Sharpe Ratio, Drawdown Máximo, Volatilidade, Retorno anualizado), comparação com benchmark (IBOV), visualização gráfica e exportação de resultados.',
    url: '/backtest',
    category: 'backtest',
    plan: 'premium',
    steps: [
      'Acesse a página de Backtest (/backtest)',
      'Configure a carteira inicial (ativos e percentuais)',
      'Defina aportes mensais se desejar',
      'Configure rebalanceamento automático',
      'Selecione o período histórico',
      'Execute o backtest',
      'Analise as métricas de performance',
      'Compare com o benchmark (IBOV)',
      'Visualize gráficos de evolução',
      'Exporte os resultados',
      'Salve a configuração para uso futuro'
    ],
    whenToUse: 'Use quando quiser simular como uma carteira teria se comportado historicamente antes de investir.',
    examples: ['Simular carteira histórica', 'Testar estratégia de investimento', 'Comparar com IBOV']
  },
  // CONTEÚDO E EDUCAÇÃO
  {
    name: 'Blog',
    description: 'Artigos educativos sobre análise fundamentalista. Categorias: Educação, Estratégias, Renda Passiva, Tecnologia, Análise Setorial. Sistema de markdown completo, busca e filtros por categoria, posts em destaque, tempo de leitura estimado e SEO otimizado.',
    url: '/blog',
    category: 'conteúdo',
    plan: 'público',
    steps: [
      'Acesse a página do Blog (/blog)',
      'Navegue pelos posts em destaque',
      'Use busca ou filtros por categoria',
      'Leia os artigos educativos',
      'Veja o tempo estimado de leitura',
      'Compartilhe artigos interessantes'
    ],
    whenToUse: 'Use quando quiser aprender mais sobre análise fundamentalista, estratégias de investimento e educação financeira.',
    examples: ['Aprender análise fundamentalista', 'Estratégias de investimento', 'Educação financeira']
  },
  {
    name: 'Metodologia',
    description: 'Documentação completa das metodologias utilizadas. Explicação detalhada de cada modelo, fórmulas matemáticas, critérios e filtros, exemplos práticos e base científica e acadêmica.',
    url: '/metodologia',
    category: 'conteúdo',
    plan: 'público',
    steps: [
      'Acesse a página de Metodologia (/metodologia)',
      'Navegue pelos diferentes modelos de valuation',
      'Leia as explicações detalhadas',
      'Entenda as fórmulas matemáticas',
      'Veja exemplos práticos',
      'Consulte a base científica e acadêmica'
    ],
    whenToUse: 'Use quando quiser entender em detalhes como funcionam os modelos de valuation e as metodologias utilizadas.',
    examples: ['Entender como funciona o Graham', 'Metodologias de valuation', 'Base científica dos modelos']
  },
  {
    name: 'Calculadoras',
    description: 'Ferramentas de cálculo financeiro. Calculadora de Dividend Yield e outras calculadoras financeiras.',
    url: '/calculadoras/dividend-yield',
    category: 'conteúdo',
    plan: 'público',
    steps: [
      'Acesse a página de Calculadoras (/calculadoras/dividend-yield)',
      'Insira os valores necessários',
      'Calcule o resultado',
      'Use para análises rápidas'
    ],
    whenToUse: 'Use quando precisar fazer cálculos rápidos de indicadores financeiros.',
    examples: ['Calcular dividend yield', 'Cálculos financeiros rápidos']
  },
  // OUTRAS FEATURES
  {
    name: 'Análise Técnica',
    description: 'Complemento à análise fundamentalista. Gráficos, indicadores técnicos (RSI, MACD, Bollinger Bands), suporte/resistência e sinais de compra/venda.',
    url: '/acao',
    category: 'outros',
    plan: 'premium',
    steps: [
      'Acesse a análise individual de uma ação (/acao/[ticker])',
      'Navegue até a aba "Análise Técnica"',
      'Visualize os gráficos interativos',
      'Analise os indicadores técnicos',
      'Veja os níveis de suporte e resistência',
      'Consulte os sinais de compra/venda'
    ],
    whenToUse: 'Use quando quiser complementar a análise fundamentalista com análise técnica e gráficos.',
    examples: ['Análise técnica de PETR4', 'Gráficos e indicadores técnicos', 'Suporte e resistência']
  },
  {
    name: 'P/L Histórico da Bolsa',
    description: 'Evolução do P/L agregado da Bovespa. Gráficos históricos desde 2010 e filtros avançados.',
    url: '/pl-bolsa',
    category: 'outros',
    plan: 'público',
    steps: [
      'Acesse a página P/L Histórico (/pl-bolsa)',
      'Visualize os gráficos históricos',
      'Use os filtros avançados',
      'Analise a evolução do P/L ao longo do tempo'
    ],
    whenToUse: 'Use quando quiser entender a evolução histórica do P/L agregado da bolsa brasileira.',
    examples: ['Evolução do P/L da bolsa', 'Histórico de valuation do mercado']
  },
  {
    name: 'Dashboard do Usuário',
    description: 'Visão geral da conta e atividades. Estatísticas de uso, rankings recentes, carteiras ativas, backtests salvos, atividade recente, informações da conta e links rápidos para ferramentas.',
    url: '/dashboard',
    category: 'outros',
    plan: 'premium',
    steps: [
      'Acesse o Dashboard (/dashboard)',
      'Visualize suas estatísticas de uso',
      'Veja rankings recentes',
      'Acesse carteiras ativas',
      'Consulte backtests salvos',
      'Veja atividade recente',
      'Gerencie informações da conta',
      'Use links rápidos para ferramentas'
    ],
    whenToUse: 'Use quando quiser uma visão geral de todas as suas atividades e acessos rápidos às ferramentas.',
    examples: ['Visão geral da conta', 'Acessos rápidos', 'Minhas atividades']
  },
  {
    name: 'Central de Tickets',
    description: 'Sistema de suporte premium. Criação de tickets, categorias (Geral, Técnico, Faturamento, Feature Request, Bug Report, Conta), prioridades (Baixa, Média, Alta, Urgente), histórico de conversas e status tracking.',
    url: '/suporte',
    category: 'outros',
    plan: 'premium',
    steps: [
      'Acesse a Central de Tickets (/suporte)',
      'Crie um novo ticket',
      'Selecione a categoria apropriada',
      'Defina a prioridade',
      'Descreva o problema ou solicitação',
      'Acompanhe o status do ticket',
      'Veja o histórico de conversas'
    ],
    whenToUse: 'Use quando precisar de suporte, reportar bugs ou solicitar novas funcionalidades.',
    examples: ['Suporte técnico', 'Reportar bug', 'Solicitar feature']
  }
]

/**
 * Busca e retorna features da plataforma
 * @param query - Termo de busca opcional para filtrar features
 * @param category - Categoria opcional para filtrar (valuation, análise, carteiras, backtest, conteúdo, outros)
 */
export async function getPlatformFeatures(query?: string, category?: string) {
  try {
    let features = PLATFORM_FEATURES

    // Filtrar por categoria se fornecida
    if (category) {
      const normalizedCategory = category.toLowerCase().trim()
      features = features.filter(f => 
        f.category.toLowerCase() === normalizedCategory ||
        f.category === normalizedCategory
      )
    }

    // Filtrar por query se fornecida
    if (query) {
      const normalizedQuery = query.toLowerCase().trim()
      features = features.filter(f => 
        f.name.toLowerCase().includes(normalizedQuery) ||
        f.description.toLowerCase().includes(normalizedQuery) ||
        f.whenToUse.toLowerCase().includes(normalizedQuery) ||
        f.examples.some(ex => ex.toLowerCase().includes(normalizedQuery)) ||
        f.category.toLowerCase().includes(normalizedQuery)
      )
    }

    // Ordenar por relevância (categoria primeiro, depois alfabético)
    features.sort((a, b) => {
      if (a.category !== b.category) {
        const categoryOrder = ['valuation', 'análise', 'carteiras', 'backtest', 'conteúdo', 'outros']
        return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
      }
      return a.name.localeCompare(b.name)
    })

    return {
      success: true,
      features: features.map(f => ({
        name: f.name,
        description: f.description,
        url: f.url,
        category: f.category,
        plan: f.plan,
        steps: f.steps,
        whenToUse: f.whenToUse,
        examples: f.examples
      })),
      total: features.length
    }
  } catch (error) {
    console.error('[Ben] Erro ao buscar features da plataforma:', error)
    return {
      success: false,
      error: `Erro ao buscar features: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    }
  }
}

/**
 * Schema das ferramentas para Function Calling do Gemini
 */
export const benToolsSchema = [
  {
    name: 'getCompanyMetrics',
    description: 'Obtém métricas financeiras FUNDAMENTALISTAS de uma empresa (P/L, P/VP, ROE, ROIC, margem líquida, score geral, etc.). Use quando o usuário perguntar sobre FUNDAMENTOS, VALORIZAÇÃO, RENTABILIDADE ou ANÁLISE FUNDAMENTALISTA de uma ação específica. NÃO use para análise técnica ou gráficos.',
    parameters: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Ticker da empresa (ex: PETR4, VALE3)'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'getMarketSentiment',
    description: 'Obtém o sentimento geral do mercado brasileiro baseado em análises recentes. Use quando o usuário perguntar sobre o sentimento de mercado ou tendências gerais.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getIbovData',
    description: 'Obtém dados atuais e históricos do índice IBOVESPA. Use quando o usuário perguntar sobre o IBOV ou o mercado em geral.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'webSearch',
    description: 'Busca informações na internet sobre um tópico específico. Use quando precisar de informações atualizadas que não estão no banco de dados.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query de busca na internet'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'getUserRadar',
    description: 'Consulta o radar de investimentos do usuário atual. Retorna lista de tickers monitorados com dados consolidados (score, preço, análise técnica, sentimento). Use quando o usuário perguntar especificamente sobre seu radar de oportunidades configurado.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getUserRadarWithFallback',
    description: 'Consulta as empresas de interesse do usuário com fallback inteligente. PRIMEIRO busca empresas no radar de oportunidades (com todos os dados disponíveis). SE não houver nada no radar, busca empresas de interesse na memória. Retorna lista completa de empresas com dados consolidados (score, preço, análise técnica, sentimento, upside). Use SEMPRE quando o usuário perguntar sobre "quais empresas estão em seu radar", "empresas de interesse", "empresas que você acompanha", "empresas no seu radar" ou qualquer variação similar. Esta ferramenta garante que o usuário sempre receba informações sobre suas empresas de interesse, seja do radar ou da memória.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getTechnicalAnalysis',
    description: 'Obtém ANÁLISE TÉCNICA completa de uma ação específica. Retorna indicadores técnicos (RSI, MACD, Stochastic, Bollinger Bands, médias móveis), sinais de SOBRECOMPRA/SOBREVENDA/NEUTRO, níveis de suporte e resistência, preços alvo da IA e análise de tendência. Use SEMPRE que o usuário mencionar "análise técnica", "gráficos", "indicadores técnicos", "RSI", "MACD", "médias móveis", "suporte/resistência", "sinais de compra/venda" ou qualquer termo relacionado a análise técnica. NÃO use getCompanyMetrics para análise técnica.',
    parameters: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Ticker da empresa (ex: PETR4, VALE3)'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'getFairValue',
    description: 'Calcula o VALOR JUSTO de uma empresa usando múltiplas estratégias de valuation combinadas: Graham, FCD (Fluxo de Caixa Descontado), Gordon (Dividend Discount Model), Barsi e Análise Técnica. Retorna valores justos e potenciais de valorização (upside) para cada modelo, além de uma análise combinada. Use SEMPRE que o usuário perguntar sobre "valor justo", "preço justo", "valor intrínseco", "fair value", "valuation", "quanto vale", "preço alvo", "quanto deveria valer" ou qualquer pergunta sobre avaliação/precificação de uma ação. IMPORTANTE: Sempre mencione que o valor justo também está disponível na página oficial do ticker (/acao/TICKER) com visualização detalhada.',
    parameters: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Ticker da empresa (ex: PETR4, VALE3)'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'getDividendProjections',
    description: 'Obtém projeções de dividendos para uma ação específica. Retorna projeções dos próximos 12 meses e histórico recente. Use quando o usuário perguntar sobre dividendos, renda passiva, ou projeções de pagamentos.',
    parameters: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Ticker da empresa (ex: PETR4, VALE3)'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'getPlatformFeatures',
    description: 'Busca e explica features da plataforma Preço Justo AI. Use SEMPRE que o usuário mencionar: "simular carteira", "simulação", "backtest", "backtesting", "carteira", "portfólio", "gestão de carteira", ou quando perguntar sobre funcionalidades disponíveis, como usar determinada ferramenta, ou quando precisar orientar sobre recursos da plataforma. Também use como complemento quando a pergunta do usuário for vaga ou quando parecer que ele está buscando informações sobre o que a plataforma oferece.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termo de busca opcional para filtrar features específicas (ex: "simular carteira", "backtest", "ranking", "carteira", "dividendos", "screening")'
        },
        category: {
          type: 'string',
          description: 'Categoria opcional para filtrar (ex: "valuation", "análise", "carteiras", "backtest", "conteúdo", "outros"). Use "backtest" ou "carteiras" quando o usuário mencionar simulação de carteira.'
        }
      },
      required: []
    }
  },
  {
    name: 'getUserPortfolios',
    description: 'Consulta todas as carteiras de investimento do usuário com métricas completas e detalhadas. Retorna informações sobre cada carteira incluindo: valor atual, total investido, retorno total e anualizado, volatilidade, Sharpe ratio, max drawdown, holdings (posições atuais), alocação por setor/indústria, evolução temporal mensal, melhores e piores meses, e estatísticas de performance. Use SEMPRE quando o usuário perguntar sobre suas carteiras, portfólios, performance de investimentos, retorno das carteiras, composição das carteiras, ou qualquer informação relacionada às suas carteiras de investimento.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'listCompanyAIReports',
    description: 'LISTA relatórios de IA disponíveis para uma empresa retornando APENAS metadados (tipo, data, link). NÃO retorna conteúdo completo. Use quando o usuário pedir para LISTAR relatórios disponíveis. Formato de resposta: lista numerada "1. **[typeLabel]** - [data pt-BR]\n   [Link do Relatório]([url])". Máximo 1 linha de introdução. Para ver o CONTEÚDO completo dos relatórios, use getCompanyAIReportContent.',
    parameters: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Ticker da empresa (ex: PETR4, VALE3)'
        },
        reportType: {
          type: 'string',
          description: 'Tipo de relatório opcional para filtrar: MONTHLY_OVERVIEW, FUNDAMENTAL_CHANGE, PRICE_VARIATION, CUSTOM_TRIGGER'
        },
        limit: {
          type: 'number',
          description: 'Número máximo de relatórios a retornar (padrão: 10)'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'getCompanyAIReportContent',
    description: 'Busca o CONTEÚDO COMPLETO de relatórios de IA de uma empresa. Retorna conteúdo completo (content), conclusão (conclusion), análises estratégicas (strategicAnalyses), scores, flags e todos os dados detalhados. Use quando o usuário pedir para RESUMAR, ANALISAR, fazer perguntas sobre CONTEÚDO/CONCLUSÕES dos relatórios, ou quando perguntar "o que concluiu", "o que diz", "me resuma". CRÍTICO: Você DEVE usar APENAS o campo "content" e "conclusion" de cada relatório retornado. NÃO invente informações genéricas. Cite diretamente do conteúdo quando perguntar "o que concluiu" ou "o que diz". Se o campo "conclusion" existir, use-o primeiro. Se não existir, extraia do campo "content". NUNCA generalize - sempre cite informações específicas dos relatórios.',
    parameters: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Ticker da empresa (ex: PETR4, VALE3)'
        },
        reportType: {
          type: 'string',
          description: 'Tipo de relatório opcional para filtrar: MONTHLY_OVERVIEW, FUNDAMENTAL_CHANGE, PRICE_VARIATION, CUSTOM_TRIGGER'
        },
        reportIds: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'IDs específicos de relatórios para buscar conteúdo (opcional). Se não fornecido, retorna todos os relatórios do tipo especificado.'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'getCompanyFlags',
    description: 'Busca empresas com flags ativos (problemas fundamentais, riscos, perda de fundamentos). Retorna lista de empresas com flags incluindo motivo, tipo de flag, informações da empresa e relatório associado. Permite filtrar por tipo de flag, ordenar por data ou empresa, e incluir flags inativas. Use SEMPRE quando o usuário perguntar sobre: "empresas que perderam fundamentos", "piores empresas da bolsa", "empresas de risco", "empresas com problemas fundamentais", "empresas com flags", "quais empresas têm problemas", "empresas problemáticas", "empresas com risco", ou qualquer variação similar sobre empresas problemáticas ou com flags.',
    parameters: {
      type: 'object',
      properties: {
        flagType: {
          type: 'string',
          description: 'Tipo de flag para filtrar (ex: FUNDAMENTAL_LOSS). Se não especificado, retorna todos os tipos.'
        },
        limit: {
          type: 'number',
          description: 'Número máximo de flags a retornar (padrão: 50)'
        },
        orderBy: {
          type: 'string',
          description: 'Ordenação: "recent" (mais recentes primeiro), "oldest" (mais antigas primeiro), ou "company" (por ticker)'
        },
        includeInactive: {
          type: 'boolean',
          description: 'Se deve incluir flags inativas (padrão: false, apenas ativas)'
        }
      },
      required: []
    }
  }
]

