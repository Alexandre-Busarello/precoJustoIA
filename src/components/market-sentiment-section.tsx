'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Lock } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'

interface MarketSentimentSectionProps {
  ticker: string
  youtubeAnalysis: {
    score: number
    summary: string
    positivePoints: string[] | null
    negativePoints: string[] | null
    updatedAt: Date
  } | null
  userIsPremium: boolean
}

function sentimentLabel(score: number) {
  if (score >= 71) return 'Positivo'
  if (score >= 51) return 'Neutro'
  return 'Negativo'
}

/** Corta no fim de uma palavra, sem quebrar no meio. */
function preview(text: string, max = 160) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut}…`
}

function PointList({ title, points, hiddenCount }: { title: string; points: string[]; hiddenCount: number }) {
  if (points.length === 0 && hiddenCount === 0) return null
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground marker:text-muted-foreground">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Mais {hiddenCount} {hiddenCount === 1 ? 'ponto disponível' : 'pontos disponíveis'} no Premium.
        </p>
      )}
    </div>
  )
}

/**
 * "O que o mercado está falando": resumo por IA de vídeos e análises públicas. Bloco neutro,
 * visualmente separado do score: o sentimento não entra no score geral. Não-assinantes veem uma prévia e um único CTA.
 */
export default function MarketSentimentSection({ ticker, youtubeAnalysis, userIsPremium }: MarketSentimentSectionProps) {
  const [showPoints, setShowPoints] = useState(false)
  const { data: session } = useSession()

  if (!youtubeAnalysis) return null

  const positive = youtubeAnalysis.positivePoints ?? []
  const negative = youtubeAnalysis.negativePoints ?? []
  const summary = youtubeAnalysis.summary.toLowerCase()
  // Análise sem vídeos encontrados: não há o que mostrar
  const isEmpty =
    positive.length === 0 &&
    negative.length === 0 &&
    (summary.includes('não foram encontrados') || summary.includes('sem vídeos'))
  if (isEmpty) return null

  const visiblePositive = userIsPremium ? positive : positive.slice(0, 1)
  const visibleNegative = userIsPremium ? negative : negative.slice(0, 1)
  const hasPoints = positive.length > 0 || negative.length > 0
  const pointsId = `sentiment-points-${ticker.toLowerCase()}`
  const cta = session?.user
    ? { label: 'Ver análise completa no Premium', href: '/checkout' }
    : { label: 'Criar conta grátis', href: '/register' }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="O que o mercado está falando"
        description={`Resumo por IA de vídeos e análises públicas sobre ${ticker}. Não entra no score.`}
      />
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <p className="text-muted-foreground">
            Tom predominante:{' '}
            {userIsPremium ? (
              <span className="font-medium text-foreground">{sentimentLabel(youtubeAnalysis.score)}</span>
            ) : (
              <>
                <span aria-hidden="true" className="select-none font-medium text-foreground blur-sm">
                  Neutro
                </span>
                <span className="sr-only">disponível no Premium</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">Atualizado em {formatDate(youtubeAnalysis.updatedAt)}</p>
        </div>

        <p className="mt-3 text-sm leading-6 text-foreground">
          {userIsPremium ? youtubeAnalysis.summary : preview(youtubeAnalysis.summary)}
        </p>

        {hasPoints && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-3 mt-2 text-muted-foreground"
              aria-expanded={showPoints}
              aria-controls={pointsId}
              onClick={() => setShowPoints((open) => !open)}
            >
              {showPoints ? 'Ocultar pontos' : 'Ver pontos positivos e de atenção'}
              <ChevronDown
                className={cn('size-4 transition-transform', showPoints && 'rotate-180')}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </Button>
            {showPoints && (
              <div id={pointsId} className="mt-3 grid gap-4 md:grid-cols-2">
                <PointList title="Pontos positivos" points={visiblePositive} hiddenCount={positive.length - visiblePositive.length} />
                <PointList title="Pontos de atenção" points={visibleNegative} hiddenCount={negative.length - visibleNegative.length} />
              </div>
            )}
          </>
        )}

        {!userIsPremium && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Resumo completo e todos os pontos disponíveis no Premium.
            </p>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
