/**
 * DIVIDEND YIELD CALCULATOR SERVICE
 * 
 * Serviço para calcular dividend yield e projeções de renda passiva
 * com verificação automática de atualização de dados
 */

import { prisma } from "@/lib/prisma"
import { DividendService } from "./dividend-service"

const DIVIDEND_UPDATE_THRESHOLD_DAYS = 7

/**
 * Verifica se os dividendos de uma empresa estão desatualizados
 */
export async function areDividendsOutdated(ticker: string): Promise<boolean> {
  try {
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        dataUltimoDividendo: true,
        yahooLastUpdatedAt: true,
      },
    })

    if (!company) {
      return false // Empresa não encontrada
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - DIVIDEND_UPDATE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    // Verificar data do último dividendo
    if (company.dataUltimoDividendo) {
      const lastDividendDate = new Date(company.dataUltimoDividendo)
      if (lastDividendDate < sevenDaysAgo) {
        return true
      }
    }

    // Verificar última atualização do Yahoo Finance
    if (company.yahooLastUpdatedAt) {
      const lastUpdateDate = new Date(company.yahooLastUpdatedAt)
      if (lastUpdateDate < sevenDaysAgo) {
        return true
      }
    }

    // Se não tem nenhuma data, considerar desatualizado
    if (!company.dataUltimoDividendo && !company.yahooLastUpdatedAt) {
      return true
    }

    return false
  } catch (error) {
    console.error(`Erro ao verificar se dividendos estão desatualizados para ${ticker}:`, error)
    return false // Em caso de erro, não considerar desatualizado para não bloquear
  }
}

/**
 * Atualiza dividendos garantindo pelo menos 5 anos de histórico
 * Sempre busca os últimos 5 anos para garantir dados completos e atualizados
 */
export async function updateDividendsIfNeeded(ticker: string): Promise<void> {
  try {
    // Sempre buscar pelo menos 5 anos de histórico
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    console.log(
      `🔄 [DIVIDEND-CALC] ${ticker}: Buscando dividendos dos últimos 5 anos (desde ${fiveYearsAgo.toISOString().split('T')[0]})...`
    )

    // Sempre buscar os últimos 5 anos de histórico
    // Executar de forma síncrona para garantir que os dados estejam disponíveis
    try {
      await DividendService.fetchAndSaveDividends(ticker, fiveYearsAgo)
      console.log(`✅ [DIVIDEND-CALC] ${ticker}: Dividendos atualizados com sucesso (últimos 5 anos)`)
    } catch (error) {
      console.error(`❌ [DIVIDEND-CALC] Erro ao atualizar dividendos de ${ticker}:`, error)
      // Tentar buscar sem data específica como fallback (busca histórico completo disponível)
      try {
        console.log(`🔄 [DIVIDEND-CALC] ${ticker}: Tentando fallback (busca completa)...`)
        await DividendService.fetchAndSaveDividends(ticker)
        console.log(`✅ [DIVIDEND-CALC] ${ticker}: Fallback bem-sucedido`)
      } catch (fallbackError) {
        console.error(`❌ [DIVIDEND-CALC] Erro no fallback para ${ticker}:`, fallbackError)
        // Não lançar erro para não bloquear o cálculo - usar dados disponíveis
      }
    }
  } catch (error) {
    console.error(`Erro ao atualizar dividendos para ${ticker}:`, error)
    // Não lançar erro para não bloquear o cálculo
  }
}

/**
 * Calcula dividend yield e projeções de renda
 */
export async function calculateDividendYield(
  ticker: string,
  investmentAmount: number
): Promise<{
  success: boolean
  data?: {
    ticker: string
    companyName: string
    currentPrice: number
    dividendYield: number
    monthlyIncome: number
    annualIncome: number
    lastDividend: {
      amount: number
      date: Date
    }
    dividendHistory: Array<{
      date: Date
      amount: number
    }>
    averageMonthlyDividend: number
    averageQuarterlyDividend: number
    totalDividendsLast12Months: number
  }
  error?: string
}> {
  try {
    // Verificar e atualizar dividendos ANTES de buscar dados
    // Isso garante que temos pelo menos 5 anos de histórico
    await updateDividendsIfNeeded(ticker)

    // Buscar empresa e dados financeiros após atualização
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        dividendHistory: {
          orderBy: { exDate: "desc" },
          take: 150, // Aumentado para garantir que pegamos todos os dividendos dos últimos 5+ anos
        },
        dailyQuotes: {
          orderBy: { date: "desc" },
          take: 1,
        },
        financialData: {
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    })

    if (!company) {
      return {
        success: false,
        error: "Empresa não encontrada",
      }
    }

    // Obter preço atual
    const currentPrice = company.dailyQuotes[0]?.price
      ? Number(company.dailyQuotes[0].price)
      : null

    if (!currentPrice || currentPrice <= 0) {
      return {
        success: false,
        error: "Preço atual não disponível",
      }
    }

    // Calcular dividendos dos últimos 12 meses
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const dividendsLast12Months = company.dividendHistory.filter(
      (div) => new Date(div.exDate) >= oneYearAgo
    )

    const totalDividendsLast12Months = dividendsLast12Months.reduce(
      (sum, div) => sum + Number(div.amount),
      0
    )

    // Calcular dividend yield
    const dividendYield = totalDividendsLast12Months / currentPrice

    // Calcular renda mensal e anual projetada
    const annualIncome = investmentAmount * dividendYield
    const monthlyIncome = annualIncome / 12

    // Calcular médias
    const allDividends = company.dividendHistory.map((div) => ({
      date: div.exDate,
      amount: Number(div.amount),
    }))

    // Média mensal (assumindo pagamentos mensais ou trimestrais)
    const totalDividends = allDividends.reduce((sum, div) => sum + div.amount, 0)
    const monthsWithDividends = new Set(
      allDividends.map((div) => `${div.date.getFullYear()}-${div.date.getMonth()}`)
    ).size

    const averageMonthlyDividend =
      monthsWithDividends > 0 ? totalDividends / monthsWithDividends : 0

    // Média trimestral
    const quartersWithDividends = new Set(
      allDividends.map(
        (div) => `${div.date.getFullYear()}-Q${Math.floor(div.date.getMonth() / 3) + 1}`
      )
    ).size

    const averageQuarterlyDividend =
      quartersWithDividends > 0 ? totalDividends / quartersWithDividends : 0

    // Último dividendo
    const lastDividend = company.dividendHistory[0]
      ? {
          amount: Number(company.dividendHistory[0].amount),
          date: company.dividendHistory[0].exDate,
        }
      : null

    if (!lastDividend) {
      return {
        success: false,
        error: "Nenhum dividendo encontrado para esta empresa",
      }
    }

    return {
      success: true,
      data: {
        ticker: company.ticker,
        companyName: company.name,
        currentPrice,
        dividendYield,
        monthlyIncome,
        annualIncome,
        lastDividend: {
          amount: lastDividend.amount,
          date: lastDividend.date, // Manter como Date para compatibilidade
        },
        dividendHistory: allDividends.slice(0, 20).map((div) => ({
          date: div.date, // Manter como Date para compatibilidade
          amount: div.amount,
        })),
        averageMonthlyDividend,
        averageQuarterlyDividend,
        totalDividendsLast12Months,
      },
    }
  } catch (error) {
    console.error(`Erro ao calcular dividend yield para ${ticker}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}
