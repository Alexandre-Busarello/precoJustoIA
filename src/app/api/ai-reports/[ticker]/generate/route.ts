import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { AIReportsService } from '@/lib/ai-reports-service'
import { generateAnalysisInternal } from '@/app/api/generate-analysis/route'
import { reviewAnalysisInternal } from '@/app/api/review-analysis/route'

// Validar se a API key do Gemini está configurada
function validateGeminiConfig() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada')
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
    const { name, sector, currentPrice, financials } = body

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

    // 3. Iniciar Geração: Criar registro com status GENERATING
    console.log(`🤖 Iniciando geração do relatório para ${ticker}`)
    const reportId = await AIReportsService.startGeneration(ticker, {
      ticker,
      name,
      sector,
      currentPrice,
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
          includeStatements: true
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
      const completedReport = await AIReportsService.completeGeneration(
        reportId,
        finalAnalysis,
        finalStrategicAnalyses || undefined
      )

      console.log(`🎉 Relatório ${reportId} concluído com sucesso para ${ticker}`)

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