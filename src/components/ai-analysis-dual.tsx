'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { AIReportFeedback } from '@/components/ai-report-feedback'
import { useAIReports } from '@/hooks/use-company-data'
import { formatDate, formatNumber } from '@/lib/format'

interface AIReport {
  id: string
  type: 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE'
  content: string
  changeDirection?: 'positive' | 'negative'
  previousScore?: number
  currentScore?: number
  strategicAnalyses?: Record<string, any>
  likeCount: number
  dislikeCount: number
  createdAt: string
  isActive: boolean
  status: 'GENERATING' | 'COMPLETED' | 'FAILED'
  /** A API devolve só a prévia (primeiras linhas) para quem não é Premium. */
  isPreview?: boolean
}

interface AIAnalysisDualProps {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  financials: Record<string, unknown>
  userIsPremium?: boolean
  companyId: number
  /** Página de relatórios do ativo (padrão: `/acao/<ticker>/relatorios`). */
  reportsHref?: string
}

const DISCLAIMER = 'Conteúdo gerado por IA a partir de dados públicos. É uma estimativa, não é recomendação de investimento.'

/** Primeiras linhas reais do relatório, sem marcação de Markdown, para a prévia borrada. */
function previewText(content: string): string {
  return content
    .split('\n')
    .map((line) => line.replace(/^[\s>#*-]+/, '').replace(/[*_`]/g, '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
}

function UnlockCta({ message }: { message: string }) {
  const { data: session } = useSession()
  const cta = session?.user
    ? { label: 'Desbloquear relatório completo', href: '/checkout' }
    : { label: 'Desbloquear com 1 dia grátis', href: '/register' }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {message}
      </p>
      <Button asChild size="sm" className="shrink-0">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  )
}

/** Prévia real borrada (3 linhas, sem corte aparente no meio da frase). */
function BlurredPreview({ content }: { content: string }) {
  const text = previewText(content)
  if (!text) return null
  return (
    <p aria-hidden="true" className="line-clamp-3 select-none text-sm leading-6 text-muted-foreground blur-[3px]">
      {text}
    </p>
  )
}

function ReportHeader({ report, locked, href }: { report: AIReport; locked: boolean; href?: string }) {
  const isChange = report.type === 'FUNDAMENTAL_CHANGE'
  const title = isChange ? 'Mudança fundamental' : 'Análise mensal'
  const previousScore = report.previousScore != null ? Number(report.previousScore) : null
  const currentScore = report.currentScore != null ? Number(report.currentScore) : null
  const positive = report.changeDirection === 'positive'

  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-foreground">
          {href ? (
            <Link href={href} className="hover:text-brand hover:underline underline-offset-4">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <p className="text-xs text-muted-foreground">Gerado por IA em {formatDate(report.createdAt)}</p>
      </div>
      {isChange && report.changeDirection && (
        <Badge variant={positive ? 'positive' : 'negative'} className="tabular-nums">
          {!locked && previousScore !== null && currentScore !== null
            ? `Score ${formatNumber(previousScore, { digits: 1 })} → ${formatNumber(currentScore, { digits: 1 })}`
            : positive
              ? 'Melhora nos fundamentos'
              : 'Piora nos fundamentos'}
        </Badge>
      )}
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-3" aria-label="Carregando relatório">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}

/** Relatórios de IA do ativo: análise mensal e mudanças fundamentais, com prévia borrada para quem não é Premium. */
export default function AIAnalysisDual({
  ticker,
  name,
  sector,
  currentPrice,
  financials,
  userIsPremium = false,
  companyId: _companyId, // eslint-disable-line @typescript-eslint/no-unused-vars
  reportsHref,
}: AIAnalysisDualProps) {
  const [activeTab, setActiveTab] = useState<'monthly' | 'changes'>('monthly')
  const [isAutoGenerating, setIsAutoGenerating] = useState(false)
  const [isGeneratingLoading, setIsGeneratingLoading] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const reportsBase = reportsHref ?? `/acao/${ticker.toLowerCase()}/relatorios`

  // Evita chamadas de geração simultâneas
  const isGeneratingRef = useRef(false)

  const { data: monthlyData, isLoading: isLoadingMonthly, error: monthlyError, refetch: refetchMonthly } = useAIReports(ticker, 'MONTHLY_OVERVIEW')
  const { data: changesData, isLoading: isLoadingChanges } = useAIReports(ticker, 'FUNDAMENTAL_CHANGE')

  const monthlyReport = monthlyData?.success && monthlyData.report ? monthlyData.report as unknown as AIReport : null
  const changeReports = changesData?.success && changesData.reports ? changesData.reports as unknown as AIReport[] : []
  const error = generationError || (monthlyError ? (monthlyError instanceof Error ? monthlyError.message : 'Erro ao carregar relatórios') : null)
  const isLocked = (report: AIReport) => !userIsPremium || report.isPreview === true

  // Relatório mensal com 30 dias ou mais é regenerado para o Premium
  const needsRegeneration = (report: AIReport): boolean => {
    if (!report?.createdAt) return true
    const daysDiff = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff >= 30
  }

  useEffect(() => {
    if (!monthlyReport || isLoadingMonthly || isAutoGenerating || isGeneratingRef.current) return
    if (userIsPremium && needsRegeneration(monthlyReport)) {
      generateMonthlyReport().catch((err) => {
        console.error('Erro ao gerar relatório mensal:', err)
        isGeneratingRef.current = false
        setIsAutoGenerating(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyReport, isLoadingMonthly, userIsPremium, isAutoGenerating])

  // Sem relatório mensal: o Premium gera automaticamente
  useEffect(() => {
    if (isLoadingMonthly || isAutoGenerating || isGeneratingRef.current || !userIsPremium) return
    const hasNoReport = !monthlyReport && (
      // 404 tratado como resposta válida (success=false) ou resposta ausente sem erro
      (monthlyData && monthlyData.success === false) || (!monthlyData && !monthlyError)
    )
    if (hasNoReport) {
      generateMonthlyReport().catch((err) => {
        console.error('Erro ao gerar relatório mensal:', err)
        isGeneratingRef.current = false
        setIsAutoGenerating(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyReport, monthlyData, monthlyError, isLoadingMonthly, userIsPremium, isAutoGenerating])

  const finishGeneration = () => {
    isGeneratingRef.current = false
    setIsAutoGenerating(false)
    setIsGeneratingLoading(false)
  }

  const generateMonthlyReport = async () => {
    if (isGeneratingRef.current) return
    isGeneratingRef.current = true
    setIsAutoGenerating(true)
    setIsGeneratingLoading(true)
    setGenerationError(null)

    if (!userIsPremium) {
      setGenerationError('Análise por IA disponível apenas no Premium.')
      finishGeneration()
      return
    }

    try {
      const response = await fetch(`/api/ai-reports/${ticker}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'MONTHLY_OVERVIEW', name, sector, currentPrice, financials }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Já está sendo gerado: aguarda e recarrega
        if (errorData.generating) {
          setTimeout(() => refetchMonthly(), 3000)
          return
        }
        // Duplicado: só recarrega
        if (errorData.duplicate || response.status === 409) {
          finishGeneration()
          setTimeout(() => refetchMonthly(), 1000)
          return
        }
        throw new Error(errorData.error || 'Erro ao gerar análise')
      }

      const data = await response.json()
      if (data.success && data.report) {
        finishGeneration()
        setTimeout(() => refetchMonthly(), 1000)
      } else if (data.generating) {
        // Geração em segundo plano: mantém o estado de "gerando" e recarrega depois
        isGeneratingRef.current = false
        setIsAutoGenerating(false)
        setTimeout(() => refetchMonthly(), 3000)
      } else {
        finishGeneration()
      }
    } catch (err) {
      console.error('Erro ao gerar análise:', err)
      setGenerationError(err instanceof Error ? err.message : 'Erro desconhecido')
      finishGeneration()
    }
  }

  const renderMonthly = () => {
    if (isGeneratingLoading) {
      return (
        <div className="flex items-start gap-3 py-6" role="status">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Gerando análise mensal</p>
            <p className="text-sm text-muted-foreground">A IA está lendo os dados de {name}. Isso leva cerca de um minuto.</p>
          </div>
        </div>
      )
    }
    if (isLoadingMonthly) return <ReportSkeleton />

    if (monthlyReport) {
      const locked = isLocked(monthlyReport)
      return (
        <div className="space-y-4">
          <ReportHeader report={monthlyReport} locked={locked} />
          {locked ? (
            <>
              <BlurredPreview content={monthlyReport.content} />
              <UnlockCta message="O relatório completo gerado por IA está disponível no Premium." />
            </>
          ) : (
            <>
              <MarkdownRenderer content={monthlyReport.content} className="max-w-[68ch]" />
              <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
              <AIReportFeedback
                reportId={monthlyReport.id}
                ticker={ticker}
                initialLikeCount={monthlyReport.likeCount}
                initialDislikeCount={monthlyReport.dislikeCount}
              />
            </>
          )}
        </div>
      )
    }

    if (!userIsPremium) {
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            A análise mensal com IA avalia {name} ({ticker}) a partir dos modelos de valuation, dos indicadores e das
            demonstrações financeiras.
          </p>
          <UnlockCta message="Relatórios gerados por IA estão disponíveis no Premium." />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Ainda não há análise mensal de {ticker}.</p>
        <Button type="button" size="sm" onClick={generateMonthlyReport}>
          Gerar análise mensal
        </Button>
      </div>
    )
  }

  const renderChanges = () => {
    if (isLoadingChanges) return <ReportSkeleton />

    if (changeReports.length === 0) {
      return (
        <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Nenhuma mudança fundamental relevante detectada nos últimos 6 meses. Quando houver, o relatório aparece aqui.
          </p>
          {userIsPremium && (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/dashboard/subscriptions">Gerenciar acompanhamentos</Link>
            </Button>
          )}
        </div>
      )
    }

    const anyLocked = changeReports.some(isLocked)
    return (
      <div className="space-y-4">
        <ul className="divide-y divide-border">
          {changeReports.map((report) => {
            const locked = isLocked(report)
            return (
              <li key={report.id} className="space-y-3 py-4 first:pt-0">
                <ReportHeader report={report} locked={locked} href={`${reportsBase}/${report.id}`} />
                {locked ? (
                  <BlurredPreview content={report.content} />
                ) : (
                  <>
                    <MarkdownRenderer content={report.content} className="max-w-[68ch]" />
                    <AIReportFeedback
                      reportId={report.id}
                      ticker={ticker}
                      initialLikeCount={report.likeCount}
                      initialDislikeCount={report.dislikeCount}
                    />
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {anyLocked ? (
          <UnlockCta message="Os relatórios completos de mudanças fundamentais estão disponíveis no Premium." />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={reportsBase}>Ver todos os relatórios</Link>
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'monthly' | 'changes')} className="gap-4">
        <TabsList variant="underline">
          <TabsTrigger value="monthly">Análise mensal</TabsTrigger>
          <TabsTrigger value="changes">
            Mudanças fundamentais
            {changeReports.length > 0 && (
              <span className="tabular-nums text-muted-foreground">({changeReports.length})</span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="monthly">{renderMonthly()}</TabsContent>
        <TabsContent value="changes">{renderChanges()}</TabsContent>
      </Tabs>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-negative-subtle p-3" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-negative" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-sm text-negative">{error}</p>
        </div>
      )}
    </div>
  )
}
