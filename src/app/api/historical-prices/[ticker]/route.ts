import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeQueryWithParams } from '@/lib/prisma-wrapper'
import { TechnicalIndicators, type PriceData, type TechnicalAnalysisResult } from '@/lib/technical-indicators'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()

    // Buscar empresa
    const company = await safeQueryWithParams(
      `company-by-ticker`,
      () => prisma.company.findUnique({
        where: { ticker },
        select: { id: true, name: true }
      }),
      { ticker }
    ) as { id: number; name: string } | null

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Buscar dados históricos dos últimos 2 anos para ter dados suficientes para os indicadores
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

    const historicalData = await safeQueryWithParams(
      `historical-prices`,
      () => prisma.historicalPrice.findMany({
        where: {
          companyId: company.id,
          interval: '1mo', // Dados mensais
          date: { gte: twoYearsAgo }
        },
        select: {
          date: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
          adjustedClose: true
        },
        orderBy: { date: 'asc' }
      }),
      { 
        companyId: company.id, 
        interval: '1mo', 
        dateFrom: twoYearsAgo.toISOString() 
      }
    ) as Array<{
      date: Date;
      open: any;
      high: any;
      low: any;
      close: any;
      volume: any;
      adjustedClose: any;
    }>

    if (historicalData.length === 0) {
      return NextResponse.json({
        ticker,
        companyName: company.name,
        historicalData: [],
        technicalAnalysis: null,
        message: 'Nenhum dado histórico encontrado'
      })
    }

    // Converter dados para o formato esperado pelos indicadores técnicos
    // Filtrar registros com dados inválidos (valores zerados)
    const validHistoricalData = historicalData.filter((data: any) => 
      Number(data.high) > 0 && 
      Number(data.low) > 0 && 
      Number(data.close) > 0 &&
      Number(data.open) > 0
    )

    const priceData: PriceData[] = validHistoricalData.map((data: any) => ({
      date: data.date,
      open: Number(data.open),
      high: Number(data.high),
      low: Number(data.low),
      close: Number(data.close),
      volume: Number(data.volume)
    }))

    // Calcular indicadores técnicos
    let technicalAnalysis: TechnicalAnalysisResult | null = null
    
    if (priceData.length >= 20) { // Mínimo necessário para calcular indicadores
      technicalAnalysis = TechnicalIndicators.calculateTechnicalAnalysis(priceData)
    }

    // Preparar dados para o gráfico (últimos 12 meses)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    // Função para ajustar data mensal: se a data é dia 1 do mês, representa o fechamento do mês anterior
    // Exemplo: 2025-12-01 representa fechamento de Novembro → ajustar para 2025-11-30
    const adjustMonthlyDate = (date: Date): Date => {
      const adjustedDate = new Date(date)
      // Se é dia 1 do mês (dados mensais), ajustar para o último dia do mês anterior
      // Isso garante que o gráfico exiba corretamente: 2025-12-01 aparece como Nov/2025
      if (adjustedDate.getDate() === 1) {
        adjustedDate.setMonth(adjustedDate.getMonth() - 1)
        adjustedDate.setDate(0) // Último dia do mês anterior (ex: 30/11 para Novembro)
      }
      return adjustedDate
    }
    
    const chartData = validHistoricalData
      .filter((data: any) => data.date >= oneYearAgo)
      .map((data: any) => {
        // Ajustar data para representar corretamente o mês de fechamento
        const adjustedDate = adjustMonthlyDate(new Date(data.date))
        
        return {
          date: adjustedDate.toISOString(),
          open: Number(data.open),
          high: Number(data.high),
          low: Number(data.low),
          close: Number(data.close),
          adjustedClose: Number(data.adjustedClose),
          volume: Number(data.volume)
        }
      })

    return NextResponse.json({
      ticker,
      companyName: company.name,
      historicalData: chartData,
      technicalAnalysis: technicalAnalysis ? {
        rsi: technicalAnalysis.rsi.slice(-12), // Últimos 12 meses de RSI
        stochastic: technicalAnalysis.stochastic.slice(-12), // Últimos 12 meses de Estocástico
        currentRSI: technicalAnalysis.currentRSI,
        currentStochastic: technicalAnalysis.currentStochastic,
        overallSignal: technicalAnalysis.overallSignal
      } : null,
      dataCount: validHistoricalData.length,
      lastUpdate: validHistoricalData[validHistoricalData.length - 1]?.date
    })

  } catch (error) {
    console.error('Erro ao buscar dados históricos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
