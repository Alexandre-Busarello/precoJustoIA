import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { getTechnicalAnalysisHistory } from '@/lib/technical-analysis-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar se usuário está logado
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Você precisa estar logado para visualizar histórico.' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()
    const { searchParams } = new URL(request.url)
    
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')
    
    const page = pageParam ? parseInt(pageParam, 10) : 1
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : 20

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: 'Página inválida. Deve ser maior que 0.' },
        { status: 400 }
      )
    }

    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: 'Tamanho da página inválido. Deve ser entre 1 e 100.' },
        { status: 400 }
      )
    }

    const result = await getTechnicalAnalysisHistory(ticker, page, pageSize)

    return NextResponse.json({
      ticker,
      history: result.analyses.map(item => ({
        id: item.id,
        calculatedAt: item.calculatedAt.toISOString(),
        expiresAt: item.expiresAt.toISOString()
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages
      }
    })
  } catch (error: any) {
    console.error('Erro ao buscar histórico de análise técnica:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar histórico' },
      { status: 500 }
    )
  }
}

