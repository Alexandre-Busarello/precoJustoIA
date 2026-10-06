'use client'

/**
 * Projeções do Ibovespa: estimativas semanal, mensal e anual geradas pelo Ben (IA) e já salvas no banco.
 * A página só lê as projeções; nada aqui dispara geração por IA.
 * Estimativas nunca usam verde/vermelho: a cor semântica é reservada a resultados realizados.
 */

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { NotificationMarkdown } from '@/components/notification-markdown'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import { formatDate, formatDeltaPct, formatNumber, formatPct } from '@/lib/format'
import type { ProjectionPoint } from './projection-chart'

const ProjectionChart = dynamic(() => import('./projection-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full sm:h-64" />,
})

type Period = 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
type Direction = 'ALTA' | 'QUEDA' | 'ESTABILIDADE'

interface IndicatorDetail {
  impact?: string
  weight?: number
  reason?: string
}

interface KeyIndicators {
  all?: Record<string, IndicatorDetail>
  primary?: string
  secondary?: string[]
  weights?: Record<string, number>
}

interface Projection {
  id: string
  period: Period
  projectedValue: number | string
  confidence: number
  reasoning: string
  keyIndicators: KeyIndicators | null
  validUntil: string
  createdAt: string
}

interface ProjectionsResponse {
  projections: Projection[]
  currentValue: number
  isPremium: boolean
}

const PERIODS: Period[] = ['WEEKLY', 'MONTHLY', 'ANNUAL']
const PERIOD_LABEL: Record<Period, string> = { WEEKLY: 'Semanal', MONTHLY: 'Mensal', ANNUAL: 'Anual' }
const PERIOD_HORIZON: Record<Period, string> = { WEEKLY: 'Semana', MONTHLY: 'Mês', ANNUAL: 'Ano' }
const DIRECTION_LABEL: Record<Direction, string> = {
  ALTA: 'Alta estimada',
  QUEDA: 'Queda estimada',
  ESTABILIDADE: 'Estabilidade estimada',
}
const IMPACT_LABEL: Record<string, string> = { ALTA: 'Pressão de alta', BAIXA: 'Pressão de baixa', NEUTRO: 'Neutro' }

async function fetchProjections(): Promise<ProjectionsResponse> {
  const response = await fetch('/api/ibov-projections')
  if (!response.ok) throw new Error('Não foi possível carregar as projeções.')
  return response.json()
}

/** Direção declarada no texto da IA ("Projeção: alta") ou, na falta dela, calculada pelos valores. */
function getDirection(reasoning: string, projected: number, current: number): Direction {
  const text = reasoning.toUpperCase()
  if (text.includes('PROJEÇÃO: ALTA')) return 'ALTA'
  if (text.includes('PROJEÇÃO: QUEDA')) return 'QUEDA'
  if (text.includes('PROJEÇÃO: ESTABILIDADE')) return 'ESTABILIDADE'
  const variation = current > 0 ? projected / current - 1 : 0
  if (Math.abs(variation) < 0.005) return 'ESTABILIDADE'
  return variation > 0 ? 'ALTA' : 'QUEDA'
}

/** Projeção vigente do período (ou a mais recente, se todas venceram). */
function currentProjection(list: Projection[]): Projection | undefined {
  const now = Date.now()
  return list.find((p) => new Date(p.validUntil).getTime() > now) ?? list[0]
}

function Indicators({ indicators }: { indicators: KeyIndicators }) {
  if (indicators.all && typeof indicators.all === 'object') {
    return (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {Object.entries(indicators.all).map(([name, detail]) => (
          <li key={name} className="space-y-1 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{name}</span>
              <span className="flex items-center gap-2">
                <Badge variant="neutral">{IMPACT_LABEL[detail?.impact ?? 'NEUTRO'] ?? detail?.impact}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  peso {formatPct(Number(detail?.weight ?? 0), { digits: 0 })}
                </span>
              </span>
            </div>
            {detail?.reason && <p className="text-xs leading-5 text-muted-foreground">{detail.reason}</p>}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {indicators.primary && <Badge variant="brand">Principal: {indicators.primary}</Badge>}
        {indicators.secondary?.map((name) => (
          <Badge key={name} variant="neutral">
            {name}
          </Badge>
        ))}
      </div>
      {indicators.weights && (
        <dl className="space-y-1 text-xs">
          {Object.entries(indicators.weights).map(([name, weight]) => (
            <div key={name} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{name}</dt>
              <dd className="tabular-nums">{formatPct(Number(weight), { digits: 0 })}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function PeriodSection({
  period,
  list,
  currentValue,
  isPremium,
}: {
  period: Period
  list: Projection[]
  currentValue: number
  isPremium: boolean
}) {
  const projection = currentProjection(list)
  const title = `Estimativa ${PERIOD_LABEL[period].toLowerCase()}`

  if (!projection) {
    return (
      <section className="space-y-2 rounded-lg border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">Ainda não há estimativa para este período.</p>
      </section>
    )
  }

  const projected = Number(projection.projectedValue) || 0
  const hasValue = isPremium && projected > 0
  const variation = hasValue && currentValue > 0 ? projected / currentValue - 1 : null
  const direction = hasValue ? getDirection(projection.reasoning, projected, currentValue) : null
  const history = list.filter((p) => p.id !== projection.id).slice(0, 5)

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <SectionHeader
        title={title}
        description={`Criada em ${formatDate(projection.createdAt, { style: 'datetime' })}, válida até ${formatDate(projection.validUntil, { style: 'datetime' })}`}
        actions={
          <>
            <Badge variant="neutral">Estimativa</Badge>
            {direction && <Badge variant="brand">{DIRECTION_LABEL[direction]}</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Ibovespa agora" value={currentValue > 0 ? formatNumber(currentValue, { digits: 0 }) : '—'} caption="pontos" />
        <Stat
          label="Valor estimado"
          value={hasValue ? formatNumber(projected, { digits: 0 }) : '—'}
          caption={variation !== null ? `${formatDeltaPct(variation)} vs. agora` : 'pontos'}
          locked={!isPremium}
        />
        <Stat
          label="Confiança"
          value={formatPct(projection.confidence / 100, { digits: 0 })}
          locked={!isPremium}
          hint="Grau de confiança declarado pela IA ao gerar a estimativa. Não é probabilidade de acerto."
        />
      </div>

      {isPremium ? (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Análise do Ben (estimativa gerada por IA)</h3>
            <div className="rounded-lg bg-surface p-4 text-sm leading-6">
              <NotificationMarkdown content={projection.reasoning} className="text-sm" />
            </div>
          </div>

          {projection.keyIndicators && typeof projection.keyIndicators === 'object' && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Indicadores considerados</h3>
              <Indicators indicators={projection.keyIndicators} />
            </div>
          )}

          {history.length > 0 && (
            <details className="group rounded-lg border border-border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                Estimativas anteriores ({history.length})
                <span aria-hidden="true" className="text-muted-foreground">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <ul className="divide-y divide-border border-t border-border text-sm">
                {history.map((item) => {
                  const value = Number(item.projectedValue) || 0
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-muted-foreground">{formatDate(item.createdAt)}</span>
                      <span className="tabular-nums">
                        {value > 0 ? `${formatNumber(value, { digits: 0 })} pts` : '—'}
                        {value > 0 && currentValue > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">{formatDeltaPct(value / currentValue - 1)}</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Valor estimado, análise completa e indicadores ficam no Premium.
          </p>
          <Button asChild size="sm">
            <Link href="/planos">Conhecer o Premium</Link>
          </Button>
        </div>
      )}
    </section>
  )
}

export default function ProjecoesIbovPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['ibov-projections'], queryFn: fetchProjections })
  // A API já oculta os valores para quem não é Premium; o próprio retorno diz qual é o caso.
  const isPremium = data?.isPremium ?? false

  const projections = data?.projections ?? []
  const currentValue = data?.currentValue ?? 0
  const byPeriod = Object.fromEntries(PERIODS.map((p) => [p, projections.filter((x) => x.period === p)])) as Record<
    Period,
    Projection[]
  >

  const chartPoints: ProjectionPoint[] = [
    ...(currentValue > 0 ? [{ label: 'Hoje', value: currentValue, current: true }] : []),
    ...PERIODS.flatMap((period) => {
      const projection = currentProjection(byPeriod[period])
      const value = Number(projection?.projectedValue) || 0
      return value > 0 ? [{ label: PERIOD_HORIZON[period], value }] : []
    }),
  ]
  const showChart = isPremium && currentValue > 0 && chartPoints.length > 1

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <PageHeader
          title="Projeções do Ibovespa"
          description="Estimativas semanal, mensal e anual geradas pelo Ben, o assistente de IA, a partir de indicadores macroeconômicos e de mercado."
        />

        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-foreground">Não foi possível carregar as projeções.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {showChart && (
              <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
                <SectionHeader title="Trajetória estimada" description="Valor atual do índice e as estimativas vigentes por horizonte." />
                <ProjectionChart points={chartPoints} />
              </section>
            )}
            {PERIODS.map((period) => (
              <PeriodSection
                key={period}
                period={period}
                list={byPeriod[period]}
                currentValue={currentValue}
                isPremium={isPremium}
              />
            ))}
          </>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          As projeções são estimativas geradas por IA com base em dados públicos e podem não se confirmar. Não é
          recomendação de investimento. Rentabilidade passada não garante resultados futuros.
        </p>
      </div>
    </div>
  )
}
