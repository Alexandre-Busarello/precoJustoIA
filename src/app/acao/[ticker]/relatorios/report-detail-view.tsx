import type { ReactNode } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/page-header'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { AIReportFeedback } from '@/components/ai-report-feedback'
import { formatDate, formatNumber } from '@/lib/format'
import { partialContent, reportTypeLabel, windowLabel } from './report-utils'

export interface ReportDetail {
  id: string
  type: string
  content: string
  changeDirection: string | null
  previousScore: unknown
  currentScore: unknown
  likeCount: number | null
  dislikeCount: number | null
  createdAt: Date
  windowDays?: number | null
  conclusion?: string | null
}

interface ReportDetailViewProps {
  report: ReportDetail
  company: { ticker: string; name: string }
  /** Rota da página do ativo (ex.: `/acao/petr4`). */
  assetHref: string
  isPremium: boolean
  isLoggedIn: boolean
}

const PREVIEW_LENGTH = 500

const CONCLUSION_LABEL: Record<string, string> = {
  AJUSTE_DIVIDENDOS: 'Ajuste por dividendos',
  AJUSTE_BONIFICACAO: 'Ajuste por bonificação',
  PERDA_DE_FUNDAMENTO: 'Perda de fundamento detectada',
  VOLATILIDADE_ESPERADA: 'Volatilidade esperada',
  MOVIMENTO_MERCADO: 'Movimento normal de mercado',
  NOTICIA_ATIPICA: 'Reação a notícia atípica',
  AJUSTE_TECNICO: 'Ajuste técnico',
}
const DEFAULT_CONCLUSION = 'Não indica perda de fundamento estrutural'
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu

/**
 * Conclusão de um relatório de variação de preço em texto simples.
 * Usa o código salvo no banco; relatórios antigos têm a conclusão só no Markdown.
 */
function priceVariationConclusion(report: ReportDetail): { text: string; lossOfFundamentals: boolean } {
  const raw =
    report.conclusion?.trim() ||
    report.content.match(/## Análise de Impacto Fundamental[\s\S]*?### Sobre a Queda de Preço[\s\S]*?\*\*Conclusão\*\*:\s*([^\n]+)/i)?.[1]?.trim() ||
    ''
  if (CONCLUSION_LABEL[raw]) return { text: CONCLUSION_LABEL[raw], lossOfFundamentals: raw === 'PERDA_DE_FUNDAMENTO' }
  const text = raw.replace(EMOJI, '').replace(/[*_`]/g, '').trim()
  if (!text) return { text: DEFAULT_CONCLUSION, lossOfFundamentals: false }
  const sentence = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  return { text: sentence, lossOfFundamentals: /perda de fundamento/i.test(text) && !/não indica/i.test(text) }
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

/** Página de um relatório de IA: cabeçalho, metadados, prosa com largura de leitura e avaliação. */
export function ReportDetailView({ report, company, assetHref, isPremium, isLoggedIn }: ReportDetailViewProps) {
  const listHref = `${assetHref}/relatorios`
  const typeLabel = reportTypeLabel(report.type)
  const isChange = report.type === 'FUNDAMENTAL_CHANGE'
  const isPriceVariation = report.type === 'PRICE_VARIATION'
  const positive = report.changeDirection === 'positive'
  const previousScore = report.previousScore != null ? Number(report.previousScore) : null
  const currentScore = report.currentScore != null ? Number(report.currentScore) : null
  const scoreDelta = previousScore !== null && currentScore !== null ? currentScore - previousScore : null
  const conclusion = isPriceVariation ? priceVariationConclusion(report) : null
  const window = isPriceVariation ? windowLabel(report.windowDays) : null

  const content = isPremium ? report.content : partialContent(report.content, PREVIEW_LENGTH)
  const truncated = content.length < report.content.length
  const cta = isLoggedIn
    ? { label: 'Desbloquear relatório completo', href: '/checkout' }
    : { label: 'Desbloquear com 1 dia grátis', href: '/register' }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[
          { label: company.ticker, href: assetHref },
          { label: 'Relatórios', href: listHref },
          { label: typeLabel },
        ]}
        title={`${typeLabel} de ${company.ticker}`}
        description={`${company.name} · gerado por IA em ${formatDate(report.createdAt)}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={listHref}>Todos os relatórios</Link>
          </Button>
        }
      />

      {(isChange || (isPriceVariation && (window || conclusion))) && (
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
          {isChange && (
            <MetaItem label="Direção da mudança">
              <Badge variant={positive ? 'positive' : 'negative'}>{positive ? 'Melhora nos fundamentos' : 'Piora nos fundamentos'}</Badge>
            </MetaItem>
          )}
          {isChange && (
            <MetaItem label="Score geral">
              {isPremium && previousScore !== null && currentScore !== null ? (
                <span className="inline-flex flex-wrap items-center gap-x-2 tabular-nums">
                  <span>
                    {formatNumber(previousScore, { digits: 1 })} → {formatNumber(currentScore, { digits: 1 })}
                  </span>
                  {scoreDelta !== null && (
                    <span className={scoreDelta > 0 ? 'text-positive' : scoreDelta < 0 ? 'text-negative' : 'text-muted-foreground'}>
                      {scoreDelta > 0 ? '+' : scoreDelta < 0 ? '−' : ''}
                      {formatNumber(Math.abs(scoreDelta), { digits: 1 })}
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-normal text-muted-foreground">
                  <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  Disponível no Premium
                </span>
              )}
            </MetaItem>
          )}
          {window && <MetaItem label="Janela avaliada">{window}</MetaItem>}
          {conclusion && (
            <MetaItem label="Conclusão sobre os fundamentos">
              <span className={conclusion.lossOfFundamentals ? 'text-negative' : undefined}>{conclusion.text}</span>
            </MetaItem>
          )}
        </dl>
      )}

      <article className="max-w-[68ch] space-y-6">
        <MarkdownRenderer content={content} />

        {!isPremium && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {truncated
                ? 'O restante do relatório e o score detalhado estão disponíveis no Premium.'
                : 'O score detalhado e os próximos relatórios estão disponíveis no Premium.'}
            </p>
            <Button asChild size="sm" className="shrink-0">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Relatório gerado por IA a partir de dados públicos. É uma estimativa, não é recomendação de investimento.
        </p>

        {isPremium && (
          <AIReportFeedback
            reportId={report.id}
            ticker={company.ticker}
            initialLikeCount={report.likeCount || 0}
            initialDislikeCount={report.dislikeCount || 0}
          />
        )}
      </article>
    </main>
  )
}
