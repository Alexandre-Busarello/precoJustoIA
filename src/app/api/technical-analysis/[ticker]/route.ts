import { NextRequest, NextResponse } from 'next/server'
import { requirePremiumUser } from '@/lib/user-service'
import { getOrCalculateTechnicalAnalysis } from '@/lib/technical-analysis-service'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar Premium - análise técnica é feature premium
    const user = await requirePremiumUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Análise técnica é uma feature Premium. Faça upgrade para acessar.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()

    // Buscar ou calcular análise técnica
    const analysis = await getOrCalculateTechnicalAnalysis(ticker, false)

    if (!analysis) {
      return NextResponse.json(
        { error: 'Dados históricos insuficientes para análise técnica' },
        { status: 404 }
      )
    }

    // Buscar dados históricos mensais para o gráfico (últimos 12 meses)
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: { id: true }
    })
    
    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }
    
    // Buscar todos os preços mensais (sem limite)
    const allMonthlyPrices = await prisma.historicalPrice.findMany({
      where: {
        companyId: company.id,
        interval: '1mo'
      },
      orderBy: { date: 'asc' }, // Ordenar crescente primeiro
      select: {
        date: true,
        close: true,
        high: true,
        low: true
      }
    })
    
    console.log(`[DEBUG] Total de registros mensais encontrados: ${allMonthlyPrices.length}`)
    
    // Agrupar por mês/ano e pegar apenas o último registro de cada mês
    const monthlyMap = new Map<string, typeof allMonthlyPrices[0]>()
    
    for (const price of allMonthlyPrices) {
      const monthKey = `${price.date.getFullYear()}-${String(price.date.getMonth() + 1).padStart(2, '0')}`
      // Se não existe ou se esta data é mais recente, substituir
      const existing = monthlyMap.get(monthKey)
      if (!existing || price.date.getTime() > existing.date.getTime()) {
        monthlyMap.set(monthKey, price)
      }
    }
    
    console.log(`[DEBUG] Meses únicos após agrupamento: ${monthlyMap.size}`)
    
    // Converter para array, ordenar por data crescente
    const allMonthlySorted = Array.from(monthlyMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    
    console.log(`[DEBUG] Primeiro mês: ${allMonthlySorted[0]?.date.toISOString()}, Último mês: ${allMonthlySorted[allMonthlySorted.length - 1]?.date.toISOString()}`)
    
    // Pegar últimos 12 meses (ou todos se tiver menos de 12)
    const monthlyPrices = allMonthlySorted.slice(-12)
    
    console.log(`[DEBUG] Meses selecionados para gráfico: ${monthlyPrices.length}`)
    
    // Buscar preço atual (dailyQuote mais recente)
    const latestQuote = await prisma.dailyQuote.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'desc' },
      select: { price: true, date: true }
    })
    
    // Preparar dados do gráfico - usar diretamente os dados mensais já agrupados
    // Não precisamos agrupar novamente, já fizemos isso acima
    const historicalData = monthlyPrices.map((hp: typeof monthlyPrices[0]) => ({
      date: hp.date.toISOString(),
      close: Number(hp.close),
      high: Number(hp.high),
      low: Number(hp.low)
    }))
    
    console.log(`[DEBUG] Dados históricos preparados: ${historicalData.length} pontos`)
    
    // Se temos preço atual, substituir ou adicionar como último ponto
    if (latestQuote) {
      const currentPrice = Number(latestQuote.price)
      const currentDate = latestQuote.date
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      
      // Verificar se já existe um ponto para o mês atual
      const currentMonthIndex = historicalData.findIndex(d => {
        const dDate = new Date(d.date)
        const dMonthKey = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}`
        return dMonthKey === currentMonthKey
      })
      
      if (currentMonthIndex >= 0) {
        // Substituir o ponto do mês atual pelo preço atual
        historicalData[currentMonthIndex] = {
          date: currentDate.toISOString(),
          close: currentPrice,
          high: currentPrice,
          low: currentPrice
        }
        console.log(`[DEBUG] Substituído ponto do mês atual (índice ${currentMonthIndex}) pelo preço atual`)
      } else {
        // Adicionar como novo ponto se não existir
        historicalData.push({
          date: currentDate.toISOString(),
          close: currentPrice,
          high: currentPrice,
          low: currentPrice
        })
        console.log(`[DEBUG] Adicionado novo ponto com preço atual`)
      }
      
      // Garantir que o último ponto seja sempre o preço atual (ordenar novamente)
      historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const lastIndex = historicalData.length - 1
      if (lastIndex >= 0) {
        historicalData[lastIndex] = {
          date: currentDate.toISOString(),
          close: currentPrice,
          high: currentPrice,
          low: currentPrice
        }
        console.log(`[DEBUG] Último ponto atualizado para preço atual: R$ ${currentPrice.toFixed(2)}`)
      }
    }
    
    console.log(`[DEBUG] Total final de pontos no gráfico: ${historicalData.length}`)

    return NextResponse.json({
      ticker,
      analysis,
      historicalData,
      cached: analysis.expiresAt > new Date()
    })
  } catch (error: any) {
    console.error('Erro ao buscar análise técnica:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar análise técnica' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar Premium - análise técnica é feature premium
    const user = await requirePremiumUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Análise técnica é uma feature Premium. Faça upgrade para acessar.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()

    // Forçar recálculo
    const analysis = await getOrCalculateTechnicalAnalysis(ticker, true)

    if (!analysis) {
      return NextResponse.json(
        { error: 'Dados históricos insuficientes para análise técnica' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ticker,
      analysis,
      recalculated: true
    })
  } catch (error: any) {
    console.error('Erro ao recalcular análise técnica:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar análise técnica' },
      { status: 500 }
    )
  }
}

