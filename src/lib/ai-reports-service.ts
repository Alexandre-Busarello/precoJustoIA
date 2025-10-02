import { prisma } from '@/lib/prisma'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'
import { getCurrentUser } from '@/lib/user-service'

export interface AIReportData {
  id: string
  companyId: number
  content: string
  strategicAnalyses?: Record<string, any>
  metadata?: Record<string, any>
  version: number
  isActive: boolean
  status: 'GENERATING' | 'COMPLETED' | 'FAILED'
  likeCount: number
  dislikeCount: number
  createdAt: Date
  updatedAt: Date
  userFeedback?: {
    type: 'LIKE' | 'DISLIKE'
    comment?: string
  } | null
}

export interface CreateAIReportData {
  companyId: number
  content: string
  strategicAnalyses?: Record<string, any>
  metadata?: Record<string, any>
}

export class AIReportsService {
  private static readonly CACHE_DURATION_DAYS = 30

  /**
   * Verifica se há um relatório sendo gerado para a empresa
   */
  static async isGenerating(ticker: string): Promise<boolean> {
    try {
      // Buscar empresa pelo ticker
      const company = await safeQueryWithParams(
        'company-by-ticker-ai-reports',
        () => prisma.company.findUnique({
          where: { ticker: ticker.toUpperCase() }
        }),
        { ticker: ticker.toUpperCase() }
      ) as { id: number } | null

      if (!company) {
        return false
      }

      // Verificar se há relatório em geração
      const generatingReport = await safeQueryWithParams(
        'ai-report-generating',
        () => prisma.aIReport.findFirst({
          where: {
            companyId: company.id,
            status: 'GENERATING'
          }
        }),
        { companyId: company.id, status: 'GENERATING' }
      ) as any

      return !!generatingReport
    } catch (error) {
      console.error('Erro ao verificar geração:', error)
      return false
    }
  }

  /**
   * Inicia a geração de um relatório (cria registro com status GENERATING)
   */
  static async startGeneration(ticker: string, metadata?: Record<string, any>): Promise<string | null> {
    try {
      // Buscar empresa pelo ticker
      const company = await safeQueryWithParams(
        'company-by-ticker-start-generation',
        () => prisma.company.findUnique({
          where: { ticker: ticker.toUpperCase() }
        }),
        { ticker: ticker.toUpperCase() }
      ) as { id: number } | null

      if (!company) {
        throw new Error('Empresa não encontrada')
      }

      // Verificar se já está gerando
      const isAlreadyGenerating = await this.isGenerating(ticker)
      if (isAlreadyGenerating) {
        return null // Já está sendo gerado
      }

      // Desativar relatórios anteriores da mesma empresa
      await safeWrite(
        'deactivate-previous-ai-reports',
        () => prisma.aIReport.updateMany({
          where: {
            companyId: company.id,
            isActive: true
          },
          data: {
            isActive: false
          }
        }),
        ['ai_reports']
      )

      // Criar registro de geração
      const generatingReport = await safeWrite(
        'create-ai-report-generating',
        () => prisma.aIReport.create({
          data: {
            companyId: company.id,
            content: '', // Será preenchido quando completar
            metadata,
            version: 1,
            isActive: true,
            status: 'GENERATING'
          }
        }),
        ['ai_reports']
      ) as any

      return generatingReport.id
    } catch (error) {
      console.error('Erro ao iniciar geração:', error)
      throw error
    }
  }

  /**
   * Completa a geração de um relatório
   */
  static async completeGeneration(
    reportId: string, 
    content: string, 
    strategicAnalyses?: Record<string, any>
  ): Promise<AIReportData> {
    try {
      const report = await safeWrite(
        'complete-ai-report-generation',
        () => prisma.aIReport.update({
          where: { id: reportId },
          data: {
            content,
            strategicAnalyses,
            status: 'COMPLETED',
            updatedAt: new Date()
          }
        }),
        ['ai_reports']
      ) as any

      return {
        id: report.id,
        companyId: report.companyId,
        content: report.content,
        strategicAnalyses: report.strategicAnalyses as Record<string, any> || undefined,
        metadata: report.metadata as Record<string, any> || undefined,
        version: report.version,
        isActive: report.isActive,
        status: report.status as 'GENERATING' | 'COMPLETED' | 'FAILED',
        likeCount: report.likeCount,
        dislikeCount: report.dislikeCount,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      }
    } catch (error) {
      console.error('Erro ao completar geração:', error)
      throw error
    }
  }

  /**
   * Marca geração como falha
   */
  static async failGeneration(reportId: string): Promise<void> {
    try {
      await safeWrite(
        'fail-ai-report-generation',
        () => prisma.aIReport.update({
          where: { id: reportId },
          data: {
            status: 'FAILED',
            updatedAt: new Date()
          }
        }),
        ['ai_reports']
      )
    } catch (error) {
      console.error('Erro ao marcar falha:', error)
    }
  }

  /**
   * Busca o relatório mais recente de uma empresa
   */
  static async getLatestReport(ticker: string, userId?: string): Promise<AIReportData | null> {
    try {
      // Buscar empresa pelo ticker
      const company = await safeQueryWithParams(
        'company-by-ticker-get-latest-report',
        () => prisma.company.findUnique({
          where: { ticker: ticker.toUpperCase() }
        }),
        { ticker: ticker.toUpperCase() }
      ) as { id: number } | null

      if (!company) {
        return null
      }

      // Buscar o relatório mais recente ativo e completo
      const report = await safeQueryWithParams(
        'ai-report-latest',
        () => prisma.aIReport.findFirst({
          where: {
            companyId: company.id,
            isActive: true,
            status: 'COMPLETED'
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            feedbacks: userId ? {
              where: { userId },
              take: 1
            } : false
          }
        }),
        { companyId: company.id, userId: userId || 'none', includeFeedbacks: !!userId }
      ) as any

      if (!report) {
        return null
      }

      return {
        id: report.id,
        companyId: report.companyId,
        content: report.content,
        strategicAnalyses: report.strategicAnalyses as Record<string, any> || undefined,
        metadata: report.metadata as Record<string, any> || undefined,
        version: report.version,
        isActive: report.isActive,
        status: report.status as 'GENERATING' | 'COMPLETED' | 'FAILED',
        likeCount: report.likeCount,
        dislikeCount: report.dislikeCount,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        userFeedback: userId && Array.isArray(report.feedbacks) && report.feedbacks.length > 0 
          ? {
              type: report.feedbacks[0].type as 'LIKE' | 'DISLIKE',
              comment: report.feedbacks[0].comment || undefined
            }
          : null
      }
    } catch (error) {
      console.error('Erro ao buscar relatório:', error)
      return null
    }
  }

  /**
   * Verifica se um relatório precisa ser regenerado (mais de 30 dias)
   */
  static needsRegeneration(report: AIReportData): boolean {
    const now = new Date()
    const reportDate = new Date(report.createdAt)
    const daysDiff = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return daysDiff >= this.CACHE_DURATION_DAYS
  }

  /**
   * Verifica se um relatório deve ser regenerado baseado no feedback negativo
   */
  static shouldRegenerateBasedOnFeedback(report: AIReportData): boolean {
    // Se tem mais de 70% de feedback negativo e pelo menos 5 feedbacks
    const totalFeedbacks = report.likeCount + report.dislikeCount
    if (totalFeedbacks >= 5) {
      const negativeRatio = report.dislikeCount / totalFeedbacks
      return negativeRatio >= 0.7
    }
    return false
  }

  /**
   * Cria um novo relatório
   */
  static async createReport(data: CreateAIReportData): Promise<AIReportData> {
    try {
      // Desativar relatórios anteriores da mesma empresa
      await safeWrite(
        'deactivate-previous-ai-reports-create',
        () => prisma.aIReport.updateMany({
          where: {
            companyId: data.companyId,
            isActive: true
          },
          data: {
            isActive: false
          }
        }),
        ['ai_reports']
      )

      // Criar novo relatório
      const report = await safeWrite(
        'create-new-ai-report',
        () => prisma.aIReport.create({
          data: {
            companyId: data.companyId,
            content: data.content,
            strategicAnalyses: data.strategicAnalyses,
            metadata: data.metadata,
            version: 1,
            isActive: true,
            status: 'COMPLETED'
          }
        }),
        ['ai_reports']
      ) as any

      return {
        id: report.id,
        companyId: report.companyId,
        content: report.content,
        strategicAnalyses: report.strategicAnalyses as Record<string, any> || undefined,
        metadata: report.metadata as Record<string, any> || undefined,
        version: report.version,
        isActive: report.isActive,
        status: report.status as 'GENERATING' | 'COMPLETED' | 'FAILED',
        likeCount: report.likeCount,
        dislikeCount: report.dislikeCount,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      }
    } catch (error) {
      console.error('Erro ao criar relatório:', error)
      throw new Error('Erro ao salvar relatório')
    }
  }

  /**
   * Busca histórico de relatórios de uma empresa
   */
  static async getReportHistory(ticker: string, limit: number = 10): Promise<AIReportData[]> {
    try {
      // Buscar empresa pelo ticker
      const company = await safeQueryWithParams(
        'company-by-ticker-report-history',
        () => prisma.company.findUnique({
          where: { ticker: ticker.toUpperCase() }
        }),
        { ticker: ticker.toUpperCase() }
      ) as { id: number } | null

      if (!company) {
        return []
      }

      const reports = await safeQueryWithParams(
        'ai-reports-history',
        () => prisma.aIReport.findMany({
          where: {
            companyId: company.id
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit
        }),
        { companyId: company.id, limit }
      ) as any[]

      return reports.map(report => ({
        id: report.id,
        companyId: report.companyId,
        content: report.content,
        strategicAnalyses: report.strategicAnalyses as Record<string, any> || undefined,
        metadata: report.metadata as Record<string, any> || undefined,
        version: report.version,
        isActive: report.isActive,
        status: report.status as 'GENERATING' | 'COMPLETED' | 'FAILED',
        likeCount: report.likeCount,
        dislikeCount: report.dislikeCount,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      }))
    } catch (error) {
      console.error('Erro ao buscar histórico:', error)
      return []
    }
  }

  /**
   * Adiciona feedback a um relatório
   */
  static async addFeedback(
    reportId: string, 
    type: 'LIKE' | 'DISLIKE', 
    comment?: string
  ): Promise<boolean> {
    try {
      const user = await getCurrentUser()
      if (!user) {
        throw new Error('Usuário não autenticado')
      }

      // Verificar se já existe feedback do usuário
      const existingFeedback = await safeQueryWithParams(
        'ai-report-feedback-check',
        () => prisma.aIReportFeedback.findUnique({
          where: {
            reportId_userId: {
              reportId,
              userId: user.id
            }
          }
        }),
        { reportId, userId: user.id }
      ) as any

      if (existingFeedback) {
        // Atualizar feedback existente
        await safeWrite(
          'update-ai-report-feedback',
          () => prisma.aIReportFeedback.update({
            where: {
              id: existingFeedback.id
            },
            data: {
              type,
              comment,
              updatedAt: new Date()
            }
          }),
          ['ai_report_feedbacks', 'ai_reports']
        )

        // Atualizar contadores no relatório
        await this.updateReportCounters(reportId)
      } else {
        // Criar novo feedback
        await safeWrite(
          'create-ai-report-feedback',
          () => prisma.aIReportFeedback.create({
            data: {
              reportId,
              userId: user.id,
              type,
              comment
            }
          }),
          ['ai_report_feedbacks', 'ai_reports']
        )

        // Atualizar contadores no relatório
        await this.updateReportCounters(reportId)
      }

      return true
    } catch (error) {
      console.error('Erro ao adicionar feedback:', error)
      return false
    }
  }

  /**
   * Atualiza os contadores de like/dislike de um relatório
   */
  private static async updateReportCounters(reportId: string): Promise<void> {
    try {
      // Contar likes e dislikes
      const [likeCount, dislikeCount] = await Promise.all([
        safeQueryWithParams(
          'ai-report-feedback-like-count',
          () => prisma.aIReportFeedback.count({
            where: { reportId, type: 'LIKE' }
          }),
          { reportId, type: 'LIKE' }
        ) as Promise<number>,
        safeQueryWithParams(
          'ai-report-feedback-dislike-count',
          () => prisma.aIReportFeedback.count({
            where: { reportId, type: 'DISLIKE' }
          }),
          { reportId, type: 'DISLIKE' }
        ) as Promise<number>
      ])

      // Atualizar relatório
      await safeWrite(
        'update-ai-report-counters',
        () => prisma.aIReport.update({
          where: { id: reportId },
          data: {
            likeCount,
            dislikeCount
          }
        }),
        ['ai_reports']
      )
    } catch (error) {
      console.error('Erro ao atualizar contadores:', error)
    }
  }

  /**
   * Remove feedback de um relatório
   */
  static async removeFeedback(reportId: string): Promise<boolean> {
    try {
      const user = await getCurrentUser()
      if (!user) {
        throw new Error('Usuário não autenticado')
      }

      await safeWrite(
        'remove-ai-report-feedback',
        () => prisma.aIReportFeedback.delete({
          where: {
            reportId_userId: {
              reportId,
              userId: user.id
            }
          }
        }),
        ['ai_report_feedbacks', 'ai_reports']
      )

      // Atualizar contadores
      await this.updateReportCounters(reportId)

      return true
    } catch (error) {
      console.error('Erro ao remover feedback:', error)
      return false
    }
  }

  /**
   * Gera preview do relatório para usuários gratuitos (primeiros 300 caracteres)
   */
  static generatePreview(content: string): string {
    // Remove markdown headers e formatação para o preview
    const cleanContent = content
      .replace(/^#+\s*/gm, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove code
      .replace(/\n\s*\n/g, '\n') // Remove linhas vazias duplas
      .trim()

    if (cleanContent.length <= 300) {
      return cleanContent
    }

    // Corta no último ponto antes de 300 caracteres
    const preview = cleanContent.substring(0, 300)
    const lastPeriod = preview.lastIndexOf('.')
    
    if (lastPeriod > 200) {
      return preview.substring(0, lastPeriod + 1)
    }
    
    return preview + '...'
  }
}
