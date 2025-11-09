import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { AIReportsService } from '@/lib/ai-reports-service'
import { generateAnalysisInternal } from '@/app/api/generate-analysis/route'
import { reviewAnalysisInternal } from '@/app/api/review-analysis/route'
import { prisma } from '@/lib/prisma'
import { safeQueryWithParams } from '@/lib/prisma-wrapper'
import { AssetMonitoringService } from '@/lib/asset-monitoring-service'
import { sendAssetChangeEmail, sendMonthlyReportEmail } from '@/lib/email-service'

// Validar se a API key do Gemini está configurada
function validateGeminiConfig() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada')
  }
}

/**
 * Envia emails para subscribers em background (não bloqueia)
 * Para relatórios de mudança fundamental
 */
async function sendEmailsToSubscribersInBackground(params: {
  companyId: number
  ticker: string
  companyName: string
  companyLogoUrl: string | null
  reportId: string
  reportContent: string
  reportType: string
  changeDirection?: 'positive' | 'negative'
  previousScore?: number
  currentScore?: number
}) {
  const {
    companyId,
    ticker,
    companyName,
    companyLogoUrl,
    reportId,
    reportContent,
    changeDirection,
    previousScore,
    currentScore,
  } = params

  try {
    // Buscar subscribers
    const subscribers = await AssetMonitoringService.getSubscribersForCompany(companyId)
    
    if (subscribers.length === 0) {
      console.log(`📧 ${ticker}: Nenhum subscriber encontrado`)
      return
    }

    console.log(`📧 ${ticker}: Enviando emails para ${subscribers.length} subscribers`)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai'
    const reportUrl = `${baseUrl}/acao/${ticker.toLowerCase()}/relatorios/${reportId}`

    // Extrair resumo do relatório (primeiros 500 caracteres)
    const reportSummary = reportContent
      .replace(/[#*`]/g, '')
      .substring(0, 500)
      .trim() + '...'

    // Enviar emails para cada subscriber
    let emailsSent = 0
    for (const subscriber of subscribers) {
      try {
        // Só enviar se tiver todas as informações necessárias
        if (changeDirection && previousScore !== undefined && currentScore !== undefined) {
          await sendAssetChangeEmail({
            email: subscriber.email,
            userName: subscriber.name || 'Investidor',
            ticker,
            companyName,
            companyLogoUrl,
            changeDirection,
            previousScore,
            currentScore,
            reportSummary,
            reportUrl,
          })
          emailsSent++
        }
      } catch (emailError) {
        console.error(`❌ Erro ao enviar email para ${subscriber.email}:`, emailError)
        // Continuar enviando para outros subscribers
      }
    }

    console.log(`✅ ${ticker}: ${emailsSent} emails enviados com sucesso`)
  } catch (error) {
    console.error(`❌ Erro ao processar envio de emails para ${ticker}:`, error)
    throw error
  }
}

/**
 * Envia emails para subscribers em background (não bloqueia)
 * Para relatórios mensais (MONTHLY_OVERVIEW)
 */
async function sendMonthlyReportEmailsInBackground(params: {
  companyId: number
  ticker: string
  companyName: string
  companyLogoUrl: string | null
  reportId: string
  reportContent: string
}) {
  const {
    companyId,
    ticker,
    companyName,
    companyLogoUrl,
    reportId,
    reportContent,
  } = params

  try {
    // Buscar subscribers
    const subscribers = await AssetMonitoringService.getSubscribersForCompany(companyId)
    
    if (subscribers.length === 0) {
      console.log(`📧 ${ticker}: Nenhum subscriber encontrado`)
      return
    }

    console.log(`📧 ${ticker}: Enviando notificações de relatório mensal para ${subscribers.length} subscribers`)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai'
    const reportUrl = `${baseUrl}/acao/${ticker.toLowerCase()}/relatorios/${reportId}`

    // Extrair resumo do relatório (primeiros 500 caracteres)
    const reportSummary = reportContent
      .replace(/[#*`]/g, '')
      .substring(0, 500)
      .trim() + '...'

    // Enviar emails usando o template específico para relatórios mensais
    let emailsSent = 0
    for (const subscriber of subscribers) {
      try {
        await sendMonthlyReportEmail({
          email: subscriber.email,
          userName: subscriber.name || 'Investidor',
          ticker,
          companyName,
          companyLogoUrl,
          reportSummary,
          reportUrl,
        })
        emailsSent++
      } catch (emailError) {
        console.error(`❌ Erro ao enviar email para ${subscriber.email}:`, emailError)
        // Continuar enviando para outros subscribers
      }
    }

    console.log(`✅ ${ticker}: ${emailsSent} notificações de relatório mensal enviadas`)
  } catch (error) {
    console.error(`❌ Erro ao processar envio de emails para ${ticker}:`, error)
    throw error
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    validateGeminiConfig()

    const resolvedParams = await params
    const ticker = resolvedParams.ticker.toUpperCase()
    const body = await request.json()
    const { name, sector, currentPrice, financials, type = 'MONTHLY_OVERVIEW' } = body

    // 1. Verificar sessão do usuário para garantir que é Premium
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Autenticação necessária para gerar relatórios de IA' },
        { status: 401 }
      )
    }
    const user = await getCurrentUser()
    if (!user?.isPremium) {
      return NextResponse.json(
        { error: 'Recurso Premium. Faça upgrade para acessar análises avançadas.' },
        { status: 403 }
      )
    }

    // 2. Controle de Concorrência: Verificar se já está sendo gerado
    const isAlreadyGenerating = await AIReportsService.isGenerating(ticker)
    if (isAlreadyGenerating) {
      console.log(`🤖 Relatório para ${ticker} já está sendo gerado.`)
      return NextResponse.json({
        success: false,
        generating: true,
        message: 'Relatório já está sendo gerado. Aguarde alguns instantes.'
      })
    }

    // 2.3 Validação de regra de negócio: Para MONTHLY_OVERVIEW, verificar se já existe relatório recente (< 30 dias)
    // 2.5 Buscar empresa e contexto de mudança fundamental (reutilizar para ambos os casos)
    let company: { id: number } | null = null
    let fundamentalChangeContext: any = null
    
    if (type === 'MONTHLY_OVERVIEW') {
      // Buscar empresa uma única vez
      company = await safeQueryWithParams(
        'company-by-ticker-for-validation',
        () => prisma.company.findUnique({
          where: { ticker }
        }),
        { ticker }
      ) as { id: number } | null

      if (company) {
        // Buscar especificamente o último relatório mensal para validação
        const latestMonthlyReport = await safeQueryWithParams(
          'ai_reports-latest-monthly',
          () => prisma.aIReport.findFirst({
            where: {
              companyId: company!.id,
              type: 'MONTHLY_OVERVIEW',
              status: 'COMPLETED'
            },
            orderBy: {
              createdAt: 'desc'
            },
            select: {
              id: true,
              createdAt: true,
              content: true
            }
          }),
          { companyId: company!.id }
        ) as { id: string; createdAt: Date; content: string } | null

        if (latestMonthlyReport) {
          // Verificar se o relatório precisa ser regenerado (mais de 30 dias)
          const reportDate = new Date(latestMonthlyReport.createdAt)
          const now = new Date()
          const daysDiff = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff < 30) {
            console.log(`⏸️ Relatório mensal para ${ticker} ainda é recente (${daysDiff} dias). Não será gerado novo relatório.`)
            return NextResponse.json({
              success: false,
              error: 'Já existe um relatório mensal recente para este ativo. Aguarde 30 dias para gerar um novo.',
              daysUntilRegeneration: 30 - daysDiff,
              lastReportDate: latestMonthlyReport.createdAt
            }, { status: 409 }) // 409 Conflict
          }
          console.log(`✅ Relatório mensal para ${ticker} tem ${daysDiff} dias (mais de 30). Prosseguindo com geração...`)
        } else {
          console.log(`📝 Nenhum relatório mensal encontrado para ${ticker}. Gerando primeiro relatório...`)
        }

        // Buscar o último relatório de FUNDAMENTAL_CHANGE para contexto
        const lastChangeReport = await safeQueryWithParams(
          'ai_reports-last-fundamental-change',
          () => prisma.aIReport.findFirst({
            where: {
              companyId: company!.id,
              type: 'FUNDAMENTAL_CHANGE',
              status: 'COMPLETED'
            },
            orderBy: {
              createdAt: 'desc'
            },
            select: {
              content: true,
              changeDirection: true,
              previousScore: true,
              currentScore: true,
              createdAt: true
            }
          }),
          { companyId: company!.id }
        ) as any

        if (lastChangeReport) {
          fundamentalChangeContext = {
            summary: lastChangeReport.content.substring(0, 500), // Primeiros 500 caracteres
            direction: lastChangeReport.changeDirection,
            scoreBefore: lastChangeReport.previousScore,
            scoreAfter: lastChangeReport.currentScore,
            date: lastChangeReport.createdAt
          }
          console.log(`📊 Contexto de mudança fundamental encontrado para ${ticker}`)
        }
      }
    }

    // 3. Iniciar Geração: Criar registro com status GENERATING
    console.log(`🤖 Iniciando geração do relatório ${type} para ${ticker}`)
    const reportId = await AIReportsService.startGeneration(ticker, {
      type,
      ticker,
      name,
      sector,
      currentPrice,
      fundamentalChangeContext,
      timestamp: new Date().toISOString()
    })

    if (!reportId) {
      // Isso pode acontecer se outro processo iniciou a geração entre a verificação e o start
      console.warn(`⚠️ Falha ao iniciar geração para ${ticker}: reportId nulo. Concorrência detectada.`)
      return NextResponse.json({
        success: false,
        generating: true,
        message: 'Outro processo já iniciou a geração do relatório. Aguarde.'
      })
    }

    let finalAnalysis = null
    let finalStrategicAnalyses = null
    let attempts = 0
    const maxAttempts = 3

    try {
      while (!finalAnalysis && attempts < maxAttempts) {
        attempts++
        console.log(`📝 Tentativa ${attempts}/${maxAttempts} para ${ticker}`)

        // Gerar análise usando função interna
        const analysisResult = await generateAnalysisInternal({
          ticker,
          name,
          sector,
          currentPrice: Number(currentPrice),
          financials,
          includeStatements: true,
          fundamentalChangeContext: fundamentalChangeContext || undefined
        })

        if (!analysisResult.success || !analysisResult.analysis) {
          throw new Error('Falha na geração da análise')
        }

        // Revisar a análise usando função interna
        const reviewResult = await reviewAnalysisInternal({
          analysis: analysisResult.analysis,
          ticker,
          name
        })

        if (reviewResult.success && reviewResult.approved) {
          console.log(`✅ Análise gerada e aprovada na revisão para ${ticker}`)
          finalAnalysis = analysisResult.analysis
          finalStrategicAnalyses = analysisResult.strategicAnalyses
        } else if (attempts >= maxAttempts) {
          finalAnalysis = analysisResult.analysis
          finalStrategicAnalyses = analysisResult.strategicAnalyses
          console.warn('Análise não foi totalmente aprovada na revisão, mas será exibida após máximo de tentativas')
        } else {
          console.log(`⚠️ Análise reprovada na revisão (tentativa ${attempts}/${maxAttempts}): ${reviewResult.reason}`)
        }
      }

      if (!finalAnalysis) {
        throw new Error('Não foi possível gerar uma análise válida após múltiplas tentativas')
      }

      // PASSO 4: Completar geração (atualiza registro para COMPLETED)
      let completedReport
      try {
        completedReport = await AIReportsService.completeGeneration(
          reportId,
          finalAnalysis,
          finalStrategicAnalyses || undefined
        )
        console.log(`🎉 Relatório ${reportId} concluído com sucesso para ${ticker}`)
      } catch (completeError) {
        // Se for erro de duplicado, retornar sucesso mas indicar que foi ignorado
        if (completeError instanceof Error && completeError.message.includes('duplicado')) {
          console.log(`⏸️ Relatório ${reportId} duplicado detectado. Já existe relatório completo no mesmo dia para ${ticker}.`)
          return NextResponse.json({
            success: false,
            error: 'Relatório duplicado. Já existe um relatório completo no mesmo dia.',
            duplicate: true
          }, { status: 409 }) // 409 Conflict
        }
        throw completeError
      }

      // PASSO 5: Enviar emails para subscribers em background (não bloqueia a resposta)
      // Buscar empresa completa com logoUrl
      const companyForEmail = await safeQueryWithParams(
        'company-by-ticker-for-email',
        () => prisma.company.findUnique({
          where: { ticker },
          select: {
            id: true,
            logoUrl: true,
          }
        }),
        { ticker }
      ) as { id: number; logoUrl: string | null } | null

      if (companyForEmail) {
        if (type === 'FUNDAMENTAL_CHANGE') {
          // Para relatórios de mudança fundamental, enviar emails com informações de score
          sendEmailsToSubscribersInBackground({
            companyId: companyForEmail.id,
            ticker,
            companyName: name,
            companyLogoUrl: companyForEmail.logoUrl || null,
            reportId: completedReport.id,
            reportContent: finalAnalysis,
            reportType: type,
            changeDirection: (completedReport as any).changeDirection,
            previousScore: (completedReport as any).previousScore ? Number((completedReport as any).previousScore) : undefined,
            currentScore: (completedReport as any).currentScore ? Number((completedReport as any).currentScore) : undefined,
          }).catch((error) => {
            console.error(`❌ Erro ao enviar emails em background para ${ticker}:`, error)
            // Não falhar o processo por causa de erro de email
          })
        } else if (type === 'MONTHLY_OVERVIEW') {
          // Para relatórios mensais, enviar notificação simples
          sendMonthlyReportEmailsInBackground({
            companyId: companyForEmail.id,
            ticker,
            companyName: name,
            companyLogoUrl: companyForEmail.logoUrl || null,
            reportId: completedReport.id,
            reportContent: finalAnalysis,
          }).catch((error) => {
            console.error(`❌ Erro ao enviar emails em background para ${ticker}:`, error)
            // Não falhar o processo por causa de erro de email
          })
        }
      }

      return NextResponse.json({
        success: true,
        report: completedReport,
        message: 'Relatório gerado e salvo com sucesso'
      })

    } catch (generationError) {
      console.error(`❌ Erro na geração do relatório ${reportId} para ${ticker}:`, generationError)
      // Marcar relatório como falha
      await AIReportsService.failGeneration(reportId)
      console.log(`💥 Relatório ${reportId} marcado como FAILED`)
      throw generationError // Re-throw para ser pego pelo catch externo
    }

  } catch (error) {
    console.error('Erro na API de geração controlada:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao gerar análise',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}