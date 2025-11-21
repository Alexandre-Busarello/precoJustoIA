import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { AIReportsService } from '@/lib/ai-reports-service'
import { safeQueryWithParams } from '@/lib/prisma-wrapper'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache-service'

const CACHE_TTL = 4 * 60 * 60; // 4 horas em segundos

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()
    
    // Extrair query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE' | null
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    
    // Verificar sessão para feedback personalizado
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    // Verificar se usuário é Premium para conteúdo completo
    let userIsPremium = false
    if (userId) {
      const user = await getCurrentUser()
      userIsPremium = user?.isPremium || false
    }

    // Criar chave de cache considerando todos os parâmetros
    const cacheKey = `ai-reports:${ticker}:${type || 'default'}:${limit || 'single'}:${userIsPremium ? 'premium' : 'free'}`;

    // Verificar cache
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
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

    // Se tipo for FUNDAMENTAL_CHANGE ou limit especificado, buscar múltiplos relatórios
    if (type === 'FUNDAMENTAL_CHANGE' || limit) {
      const reports = await safeQueryWithParams(
        `ai_reports-by-type-${type || 'all'}`,
        () => prisma.aIReport.findMany({
          where: {
            companyId: company.id,
            type: type || undefined,
            status: 'COMPLETED'
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit || 10,
          select: {
            id: true,
            companyId: true,
            type: true,
            content: true,
            changeDirection: true,
            previousScore: true,
            currentScore: true,
            strategicAnalyses: true,
            likeCount: true,
            dislikeCount: true,
            createdAt: true,
            isActive: true,
            status: true
          }
        }),
        { companyId: company.id, type: type || 'all' }
      ) as any[]

      // Processar preview para usuários não Premium
      const processedReports = reports.map(report => ({
        ...report,
        content: !userIsPremium ? AIReportsService.generatePreview(report.content) : report.content,
        isPreview: !userIsPremium
      }))

      const response = {
        success: true,
        reports: processedReports,
        count: reports.length
      };

      // Salvar no cache
      await cache.set(cacheKey, response, { ttl: CACHE_TTL });

      return NextResponse.json(response)
    }

    // Buscar relatório único (comportamento padrão para MONTHLY_OVERVIEW)
    const report = await safeQueryWithParams(
      `ai_reports-latest-${type || 'default'}`,
      () => prisma.aIReport.findFirst({
        where: {
          companyId: company.id,
          type: type || 'MONTHLY_OVERVIEW',
          status: 'COMPLETED'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          companyId: true,
          type: true,
          content: true,
          changeDirection: true,
          previousScore: true,
          currentScore: true,
          strategicAnalyses: true,
          likeCount: true,
          dislikeCount: true,
          createdAt: true,
          isActive: true,
          status: true
        }
      }),
      { companyId: company.id, type: type || 'MONTHLY_OVERVIEW' }
    ) as any

    if (!report) {
      return NextResponse.json(
        { error: 'Nenhum relatório encontrado para este ativo' },
        { status: 404 }
      )
    }

    // Para usuários não Premium, retornar apenas preview
    if (!userIsPremium) {
      const response = {
        success: true,
        report: {
          ...report,
          content: AIReportsService.generatePreview(report.content),
          isPreview: true
        }
      };

      // Salvar no cache
      await cache.set(cacheKey, response, { ttl: CACHE_TTL });

      return NextResponse.json(response)
    }

    // Para usuários Premium, retornar conteúdo completo
    const response = {
      success: true,
      report: {
        ...report,
        isPreview: false
      }
    };

    // Salvar no cache
    await cache.set(cacheKey, response, { ttl: CACHE_TTL });

    return NextResponse.json(response)

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

