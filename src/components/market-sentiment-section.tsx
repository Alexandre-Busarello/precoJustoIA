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

/** Frases que revelam o tom (bloqueado para não-assinantes). */
const TONE_PATTERN = /sentimento|tom\b|predominant|positiv|negativ|otimis|pessimis|neutr/i

/**
 * Prévia para não-assinantes sem revelar o tom: pula a 1ª frase (que costuma resumir o sentimento) e as
 * frases que falam do tom; sem nada neutro para mostrar, usa uma linha genérica.
 */
function neutralPreview(summary: string, ticker: string) {
  const sentences = summary.split(/(?<=[.!?])\s+/).slice(1).filter((sentence) => !TONE_PATTERN.test(sentence))
  const text = sentences.join(' ').trim()
  return text ? preview(text) : `Resumo de vídeos e análises públicas sobre ${ticker}.`
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
          {userIsPremium ? youtubeAnalysis.summary : neutralPreview(youtubeAnalysis.summary, ticker)}
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
