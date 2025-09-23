import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AIReportsService } from '@/lib/ai-reports-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { reportId, type, comment } = body

    if (!reportId || !type) {
      return NextResponse.json(
        { error: 'reportId e type são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['LIKE', 'DISLIKE'].includes(type)) {
      return NextResponse.json(
        { error: 'type deve ser LIKE ou DISLIKE' },
        { status: 400 }
      )
    }

    const success = await AIReportsService.addFeedback(reportId, type, comment)

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao adicionar feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback adicionado com sucesso'
    })

  } catch (error) {
    console.error('Erro ao adicionar feedback:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('reportId')

    if (!reportId) {
      return NextResponse.json(
        { error: 'reportId é obrigatório' },
        { status: 400 }
      )
    }

    const success = await AIReportsService.removeFeedback(reportId)

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao remover feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback removido com sucesso'
    })

  } catch (error) {
    console.error('Erro ao remover feedback:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

