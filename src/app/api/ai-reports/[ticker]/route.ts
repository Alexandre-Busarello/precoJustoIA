import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { AIReportsService } from '@/lib/ai-reports-service'
import { safeQueryWithParams } from '@/lib/prisma-wrapper'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()
    
    // Verificar sessão para feedback personalizado
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    // Verificar se está sendo gerado
    const isGenerating = await AIReportsService.isGenerating(ticker)
    if (isGenerating) {
      return NextResponse.json({
        success: true,
        generating: true,
        message: 'Relatório sendo gerado. Aguarde alguns instantes.'
      })
    }

    // Buscar relatório mais recente
    const report = await AIReportsService.getLatestReport(ticker, userId)

    if (!report) {
      return NextResponse.json(
        { error: 'Nenhum relatório encontrado para este ativo' },
        { status: 404 }
      )
    }

    // Verificar se usuário é Premium para conteúdo completo
    let userIsPremium = false
    if (userId) {
      const user = await getCurrentUser()
      userIsPremium = user?.isPremium || false
    }

    // Para usuários não Premium, retornar apenas preview
    if (!userIsPremium) {
      return NextResponse.json({
        success: true,
        report: {
          ...report,
          content: AIReportsService.generatePreview(report.content),
          isPreview: true
        }
      })
    }

    // Para usuários Premium, retornar conteúdo completo
    return NextResponse.json({
      success: true,
      report: {
        ...report,
        isPreview: false
      }
    })

  } catch (error) {
    console.error('Erro ao buscar relatório:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()
    
    // Verificar autenticação
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é Premium
    const user = await getCurrentUser()
    if (!user?.isPremium) {
      return NextResponse.json(
        { error: 'Recurso disponível apenas para usuários Premium' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { content, strategicAnalyses, metadata, forceRegenerate = false } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Conteúdo do relatório é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar empresa
    const company = await safeQueryWithParams(
      'company-by-ticker-ai-reports-route',
      () => prisma.company.findUnique({
        where: { ticker }
      }),
      { ticker }
    ) as { id: number } | null

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se já está sendo gerado
    const isGenerating = await AIReportsService.isGenerating(ticker)
    if (isGenerating) {
      return NextResponse.json({
        success: false,
        generating: true,
        message: 'Relatório já está sendo gerado. Aguarde alguns instantes.'
      })
    }

    // Verificar se já existe relatório recente (se não for regeneração forçada)
    if (!forceRegenerate) {
      const existingReport = await AIReportsService.getLatestReport(ticker)
      if (existingReport && !AIReportsService.needsRegeneration(existingReport)) {
        return NextResponse.json({
          success: true,
          report: existingReport,
          message: 'Relatório recente já existe'
        })
      }
    }

    // Criar novo relatório
    const newReport = await AIReportsService.createReport({
      companyId: company.id,
      content,
      strategicAnalyses,
      metadata
    })

    return NextResponse.json({
      success: true,
      report: newReport,
      message: 'Relatório criado com sucesso'
    })

  } catch (error) {
    console.error('Erro ao criar relatório:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

