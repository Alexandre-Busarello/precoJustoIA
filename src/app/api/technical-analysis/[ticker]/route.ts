import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requirePremiumUser } from '@/lib/user-service'
import { 
  getOrCalculateTechnicalAnalysis, 
  getTechnicalAnalysisByDate,
  getTechnicalAnalysisById,
  checkSameDayAnalysis
} from '@/lib/technical-analysis-service'
import { checkFeatureUsage, recordFeatureUsage } from '@/lib/feature-usage-service'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar se usuário está logado (não apenas Premium)
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Você precisa estar logado para visualizar análise técnica.' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const idParam = searchParams.get('id')

    // Se for usuário gratuito, verificar limite antes de continuar
    if (!user.isPremium) {
      const usageCheck = await checkFeatureUsage(user.id, 'technical_analysis', ticker)
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { 
            error: 'Limite de análises técnicas atingido para este mês.',
            limit: usageCheck.limit,
            currentUsage: usageCheck.currentUsage,
            remaining: 0
          },
          { status: 429 }
        )
      }
    }

    let analysis

    // Buscar análise por ID se fornecido
    if (idParam) {
      analysis = await getTechnicalAnalysisById(ticker, idParam)
      if (!analysis) {
        return NextResponse.json(
          { error: 'Análise técnica não encontrada' },
          { status: 404 }
        )
      }
    }
    // Buscar análise por data se fornecido
    else if (dateParam) {
      const targetDate = new Date(dateParam)
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: 'Data inválida. Use o formato YYYY-MM-DD' },
          { status: 400 }
        )
      }
      analysis = await getTechnicalAnalysisByDate(ticker, targetDate)
      if (!analysis) {
        return NextResponse.json(
          { error: 'Nenhuma análise técnica encontrada para esta data' },
          { status: 404 }
        )
      }
    }
    // Buscar análise atual (padrão)
    else {
      analysis = await getOrCalculateTechnicalAnalysis(ticker, false)
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Dados históricos insuficientes para análise técnica' },
        { status: 404 }
      )
    }

    // Registrar uso para usuários gratuitos
    if (!user.isPremium) {
      await recordFeatureUsage(user.id, 'technical_analysis', ticker, { ticker })
    }

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
    
    // Preparar dados do gráfico - ajustar datas mensais para representar corretamente o mês de fechamento
    const historicalData = monthlyPrices.map((hp: typeof monthlyPrices[0]) => {
      const adjustedDate = adjustMonthlyDate(new Date(hp.date))
      return {
        date: adjustedDate.toISOString(),
        close: Number(hp.close),
        high: Number(hp.high),
        low: Number(hp.low)
      }
    })
    
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
        // Não ajustar data do preço atual (é um dado diário, não mensal)
        historicalData[currentMonthIndex] = {
          date: currentDate.toISOString(), // Manter data original (dados diários não são ajustados)
          close: currentPrice,
          high: currentPrice,
          low: currentPrice
        }
        console.log(`[DEBUG] Substituído ponto do mês atual (índice ${currentMonthIndex}) pelo preço atual`)
      } else {
        // Adicionar como novo ponto se não existir
        // Não ajustar data do preço atual (é um dado diário, não mensal)
        historicalData.push({
          date: currentDate.toISOString(), // Manter data original (dados diários não são ajustados)
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

    // Buscar informações de uso para usuários gratuitos
    let usageInfo = null
    if (!user.isPremium) {
      const usageCheck = await checkFeatureUsage(user.id, 'technical_analysis', ticker)
      usageInfo = {
        remaining: usageCheck.remaining,
        limit: usageCheck.limit,
        currentUsage: usageCheck.currentUsage
      }
    }

    return NextResponse.json({
      ticker,
      analysis,
      historicalData,
      cached: analysis.expiresAt > new Date(),
      usage: usageInfo
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
    // Verificar se usuário é Premium ou Admin
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Você precisa estar logado para atualizar análise técnica.' },
        { status: 401 }
      )
    }

    if (!user.isPremium && !user.isAdmin) {
      return NextResponse.json(
        { error: 'Apenas usuários Premium ou Admin podem atualizar análises técnicas.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()

    // Buscar empresa para verificar se já existe análise do dia atual
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

    // Verificar se já existe análise para o dia atual
    const sameDayExists = await checkSameDayAnalysis(company.id)

    if (sameDayExists) {
      // Retornar análise existente do dia atual
      const todayAnalysis = await getOrCalculateTechnicalAnalysis(ticker, false)
      return NextResponse.json({
        ticker,
        analysis: todayAnalysis,
        recalculated: false,
        message: 'Já existe uma análise técnica para o dia atual.'
      })
    }

    // Gerar nova análise (permitir mesmo dia para Premium/Admin)
    const analysis = await getOrCalculateTechnicalAnalysis(ticker, true, true)

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

