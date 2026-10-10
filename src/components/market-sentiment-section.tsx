'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Lock } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import type { MarketSentimentView } from '@/lib/market-sentiment-view'

interface MarketSentimentSectionProps {
  ticker: string
  /** Já recortado no servidor por plano (ver buildMarketSentimentView). */
  sentiment: MarketSentimentView | null
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
 * visualmente separado do score: o sentimento não entra no score geral. Não-assinantes veem uma prévia
 * que não revela o tom e uma linha discreta com link (o CTA primário fica no cabeçalho do ativo).
 */
export default function MarketSentimentSection({ ticker, sentiment }: MarketSentimentSectionProps) {
  const [showPoints, setShowPoints] = useState(false)
  const { data: session } = useSession()

  if (!sentiment) return null

  const userIsPremium = !sentiment.isPreview
  const hasPoints =
    sentiment.positivePoints.length + sentiment.negativePoints.length +
      sentiment.hiddenPositiveCount + sentiment.hiddenNegativeCount > 0
  const pointsId = `sentiment-points-${ticker.toLowerCase()}`
  const upsellLink = session?.user
    ? { label: 'Ver planos', href: '/planos' }
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
            {sentiment.toneLabel ? (
              <span className="font-medium text-foreground">{sentiment.toneLabel}</span>
            ) : (
              <>
                <span aria-hidden="true" className="select-none font-medium text-foreground blur-sm">
                  Neutro
                </span>
                <span className="sr-only">disponível no Premium</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">Atualizado em {formatDate(sentiment.updatedAt)}</p>
        </div>

        <p className="mt-3 text-sm leading-6 text-foreground">
          {sentiment.summary}
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
                <PointList title="Pontos positivos" points={sentiment.positivePoints} hiddenCount={sentiment.hiddenPositiveCount} />
                <PointList title="Pontos de atenção" points={sentiment.negativePoints} hiddenCount={sentiment.hiddenNegativeCount} />
              </div>
            )}
          </>
        )}

        {!userIsPremium && (
          <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>
              Resumo completo e todos os pontos disponíveis no Premium.{' '}
              <Link
                href={upsellLink.href}
                className="whitespace-nowrap py-3 font-medium text-brand underline-offset-4 hover:underline"
              >
                {upsellLink.label}
              </Link>
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
