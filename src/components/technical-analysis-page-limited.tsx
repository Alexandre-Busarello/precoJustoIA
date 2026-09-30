import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'

interface TechnicalAnalysisPageLimitedProps {
  ticker: string
  /** Caminho desta página (ex.: /acao/petr4/analise-tecnica), usado no retorno após o cadastro. */
  analysisPath: string
  isLoggedIn: boolean
}

/** Aviso fixo das páginas de análise técnica (completa e bloqueada). */
export function TechnicalAnalysisDisclaimer() {
  return (
    <p className="max-w-[68ch] text-xs leading-5 text-muted-foreground">
      A análise técnica é um complemento à análise fundamentalista para quem investe no longo prazo e não é indicada
      para day trade. Os níveis e a faixa estimada são calculados a partir de preços passados e de um modelo de IA:
      são estimativas, não recomendação de investimento.
    </p>
  )
}

/** Valores fictícios: o dado real nunca vai para o DOM de quem não tem acesso. */
const PREVIEW_INDICATORS = [
  { label: 'IFR (14)', value: '00,0', note: 'Neutro' },
  { label: 'MACD', value: '0,0000', note: 'Histograma positivo' },
  { label: 'Estocástico %K', value: '00,0', note: '%D 00,0' },
  { label: 'Média móvel 200', value: 'R$ 00,00', note: 'Média 50: R$ 00,00' },
]

/**
 * Prévia bloqueada da análise técnica (anônimo e plano gratuito): a mesma estrutura da página completa,
 * borrada, com um único CTA.
 */
export default function TechnicalAnalysisPageLimited({ ticker, analysisPath, isLoggedIn }: TechnicalAnalysisPageLimitedProps) {
  const cta = isLoggedIn
    ? { href: '/checkout', label: 'Assinar o Premium', text: 'A análise técnica completa faz parte do Premium.' }
    : {
        href: `/register?callbackUrl=${encodeURIComponent(analysisPath)}`,
        label: 'Criar conta grátis',
        text: 'Crie sua conta e teste o Premium por 1 dia para ver a análise técnica completa.',
      }

  return (
    <div className="space-y-6">
      <section aria-labelledby="analise-tecnica-bloqueada" className="space-y-4">
        <SectionHeader
          id="analise-tecnica-bloqueada"
          title={`Análise técnica completa de ${ticker}`}
          description="Faixa estimada para 30 dias, IFR, MACD, estocástico, bandas de Bollinger, médias móveis, suporte e resistência, Fibonacci e Ichimoku."
        />
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div aria-hidden="true" className="pointer-events-none select-none space-y-6 blur-sm">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Faixa estimada (30 dias)</p>
              <div className="grid grid-cols-3 gap-4">
                {['Mínima estimada', 'Entrada técnica', 'Máxima estimada'].map((label) => (
                  <div key={label} className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">R$ 00,00</p>
                  </div>
                ))}
              </div>
              <div className="relative h-1.5 rounded-full bg-muted">
                <div className="absolute inset-y-0 left-[20%] right-[25%] rounded-full bg-brand-subtle" />
                <div className="absolute top-1/2 left-[55%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground" />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {PREVIEW_INDICATORS.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{item.value}</dd>
                  <dd className="text-xs text-muted-foreground">{item.note}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              {cta.text}
            </p>
            <Button asChild className="shrink-0">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          </div>
        </div>
      </section>

      <TechnicalAnalysisDisclaimer />
    </div>
  )
}
