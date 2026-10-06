import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const INDICATORS = [
  { label: 'P/L', value: '8,4', sub: 'Abaixo da média', color: 'text-positive', bg: 'bg-positive-subtle', border: 'border-positive/40' },
  { label: 'P/VP', value: '1,2', sub: 'Justo', color: 'text-positive', bg: 'bg-positive-subtle', border: 'border-positive/40' },
  { label: 'DY (12m)', value: '12,4%', sub: 'Alto', color: 'text-brand', bg: 'bg-brand-subtle', border: 'border-brand/40' },
  { label: 'ROE', value: '21,3%', sub: 'Excelente', color: 'text-positive', bg: 'bg-positive-subtle', border: 'border-positive/40' },
  { label: 'Payout', value: '48%', sub: 'Saudável ≤ 60%', color: 'text-positive', bg: 'bg-positive-subtle', border: 'border-positive/40' },
  { label: 'Dív.Líq/PL', value: '0,8x', sub: 'Controlado', color: 'text-brand', bg: 'bg-brand-subtle', border: 'border-brand/40' },
  { label: 'Margem Líq.', value: '38,4%', sub: 'Alta', color: 'text-positive', bg: 'bg-positive-subtle', border: 'border-positive/40' },
  { label: 'ROIC', value: '17,8%', sub: 'Acima da média', color: 'text-positive', bg: 'bg-positive-subtle', border: 'border-positive/40' },
]

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const CURRENT_MONTH = 4

const DIVIDEND_MONTHS = [
  { month: 1, type: 'paid', value: 'R$1,12' },
  { month: 3, type: 'paid', value: 'R$0,98' },
  { month: 5, type: 'projected', value: '~R$1,08' },
  { month: 7, type: 'projected', value: '~R$1,10' },
  { month: 9, type: 'projected', value: '~R$1,05' },
  { month: 11, type: 'projected', value: '~R$1,07' },
]

export function FeaturesSustainabilitySection() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Score de sustentabilidade</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Evite armadilhas de dividendos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Veja exatamente o que nossa plataforma exibe ao analisar um ativo — fundamentos, score, payout e radar de dividendos em uma tela só.
          </p>
        </div>

        {/* Stock analysis page preview */}
        <PreviewShell path="/acao/taee11">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">

          {/* Company header */}
          <div className="border-b border-border bg-surface px-5 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-lg font-semibold text-primary-foreground">
                  TA
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-foreground">TAEE11</h3>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Transmissão de Energia</span>
                    <span className="rounded-full border border-brand/40 bg-brand-subtle px-2 py-0.5 text-xs text-brand">Grande</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Transmissora Aliança de Energia Elétrica S.A.</p>
                </div>
              </div>

              {/* Score circle */}
              <div className="flex shrink-0 flex-col items-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <svg className="absolute inset-0" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="7" />
                    <circle
                      cx="40" cy="40" r="34"
                      fill="none" stroke="var(--positive)" strokeWidth="7"
                      strokeDasharray="213.6" strokeDashoffset="21.4"
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-xl font-semibold text-brand">91</p>
                    <p className="text-xs font-semibold text-brand">A+</p>
                  </div>
                </div>
                <span className="mt-1 rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand">
                  Excelente
                </span>
              </div>
            </div>
          </div>

          {/* Sustainability score banner */}
          <div className="flex items-center gap-3 border-b border-brand/40 bg-brand-subtle px-5 py-3">
            <Check className="size-4 shrink-0 text-primary-foreground" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-brand">Score de sustentabilidade de dividendos: 91/100</p>
              <p className="text-xs text-brand">Payout saudável · Cobertura de lucro adequada · Dívida controlada · Crescimento consistente</p>
            </div>
          </div>

          {/* Indicators grid */}
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">Indicadores Fundamentalistas</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INDICATORS.map((ind) => (
                <div key={ind.label} className={`rounded-lg border ${ind.border} ${ind.bg} px-3 py-2.5`}>
                  <p className={`text-base font-semibold ${ind.color}`}>{ind.value}</p>
                  <p className="text-xs font-medium text-foreground">{ind.label}</p>
                  <p className="text-xs text-muted-foreground">{ind.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Dividend radar */}
          <div className="border-t border-border px-5 pb-5">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">Radar de Dividendos</p>
            <div className="overflow-x-auto">
              <div className="flex min-w-[560px] gap-1">
                {MONTHS_SHORT.map((m, i) => {
                  const payment = DIVIDEND_MONTHS.find((p) => p.month === i)
                  const isCurrent = i === CURRENT_MONTH
                  return (
                    <div
                      key={m}
                      className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg px-1 py-2 ${
                        isCurrent ? 'border border-brand/40 bg-brand-subtle' : ''
                      }`}
                    >
                      <span className={`text-xs ${isCurrent ? 'font-semibold text-brand' : 'text-muted-foreground'}`}>{m}</span>
                      {payment ? (
                        <div
                          title={payment.value}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                            payment.type === 'paid' ? 'bg-brand text-primary-foreground' : 'border border-dashed border-brand bg-card text-brand'
                          }`}
                        >
                          $
                        </div>
                      ) : (
                        <div className="h-7 w-7" />
                      )}
                      {payment && (
                        <span className={`text-xs ${payment.type === 'paid' ? 'text-brand' : 'text-muted-foreground'}`}>
                          {payment.value}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3 text-xs text-muted-foreground">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-primary-foreground text-xs">$</span>
                Pago
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-brand bg-card text-brand text-xs">$</span>
                Projetado
              </span>
            </div>
            <span>Dados ilustrativos · Premium</span>
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
