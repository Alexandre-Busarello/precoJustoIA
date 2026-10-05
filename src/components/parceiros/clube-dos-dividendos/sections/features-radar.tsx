'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const CURRENT_MONTH = 4

const RADAR_ROWS = [
  {
    ticker: 'TAEE11',
    name: 'Taesa',
    dy: '12,4%',
    payments: [
      { month: 1, type: 'paid', value: 'R$1,12' },
      { month: 3, type: 'paid', value: 'R$0,98' },
      { month: 5, type: 'projected', value: '~R$1,08' },
      { month: 7, type: 'projected', value: '~R$1,10' },
      { month: 9, type: 'projected', value: '~R$1,05' },
      { month: 11, type: 'projected', value: '~R$1,07' },
    ],
  },
  {
    ticker: 'BBSE3',
    name: 'BB Seguridade',
    dy: '9,8%',
    payments: [
      { month: 2, type: 'paid', value: 'R$0,74' },
      { month: 5, type: 'projected', value: '~R$0,80' },
      { month: 8, type: 'projected', value: '~R$0,82' },
      { month: 11, type: 'projected', value: '~R$0,78' },
    ],
  },
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística',
    dy: '11,1%',
    payments: MONTHS.map((_, i) => ({
      month: i,
      type: i <= CURRENT_MONTH ? 'paid' : 'projected',
      value: i <= CURRENT_MONTH ? 'R$0,85' : '~R$0,87',
    })),
  },
]

type PaymentEntry = { month: number; type: string; value: string }

function DividendDot({ payment }: { payment?: PaymentEntry }) {
  if (!payment) return <div className="h-7 w-7" />
  return (
    <div
      title={payment.value}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
        payment.type === 'paid'
          ? 'bg-brand text-primary-foreground'
          : 'border border-dashed border-brand bg-card text-brand'
      }`}
    >
      $
    </div>
  )
}

// ── DY Calculator preview state (illustrative) ──────────────────────────────

const DY_RESULT = {
  ticker: 'TAEE11',
  company: 'Taesa',
  price: 'R$34,20',
  invested: 'R$10.000',
  shares: '292 cotas',
  dy: '12,4%',
  lastDividend: { value: 'R$1,12', date: 'Abr/2025' },
  monthlyIncome: 'R$103,33',
  annualIncome: 'R$1.240',
  total12m: 'R$4,24/cota',
  sustainability: { score: 91, roe: '21,3%', payout: '48%', margem: '38,4%' },
  sector: { dy: '12,4%', media: '7,8%', diff: '+59%' },
}

function DYCalculatorPreview() {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* Results */}
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {DY_RESULT.company}{' '}
              <span className="text-muted-foreground font-normal">({DY_RESULT.ticker})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Preço atual: {DY_RESULT.price} · {DY_RESULT.shares}
            </p>
          </div>
          <span className="rounded-full bg-brand-subtle px-3 py-1 text-sm font-semibold text-brand">
            DY {DY_RESULT.dy}
          </span>
        </div>

        {/* Key metrics */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-brand-subtle p-2.5 text-center">
            <p className="text-sm font-semibold leading-tight text-brand">{DY_RESULT.monthlyIncome}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Renda mensal</p>
          </div>
          <div className="rounded-lg bg-brand-subtle p-2.5 text-center">
            <p className="text-sm font-semibold leading-tight text-brand">{DY_RESULT.annualIncome}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Renda anual</p>
          </div>
          <div className="rounded-lg bg-brand-subtle p-2.5 text-center">
            <p className="break-words text-sm font-semibold leading-tight text-brand">{DY_RESULT.total12m}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Total 12m/cota</p>
          </div>
        </div>

        <div className="mb-3 text-xs text-muted-foreground">
          Último dividendo: <strong className="text-foreground">{DY_RESULT.lastDividend.value}</strong>{' '}
          em {DY_RESULT.lastDividend.date}
        </div>

        {/* Sparkline — dividend history */}
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Histórico de dividendos — 12 meses</p>
          <svg viewBox="0 0 300 60" className="w-full" preserveAspectRatio="none">
            <polyline
              points="0,45 27,42 55,38 82,40 109,35 136,32 164,34 191,28 218,30 245,25 273,22 300,18"
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="2"
            />
            {[45,42,38,40,35,32,34,28,30,25,22,18].map((y, i) => (
              <circle key={i} cx={i * (300/11)} cy={y} r="2.5" fill="var(--chart-1)" />
            ))}
          </svg>
        </div>

        {/* 3 summary cards */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Total 12 meses', value: 'R$4,24/cota', color: 'text-foreground' },
            { label: 'Média mensal', value: 'R$0,97', color: 'text-foreground' },
            { label: 'Média trimestral', value: 'R$2,78', color: 'text-foreground' },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-surface p-2.5 text-center">
              <p className={`text-sm font-semibold ${c.color}`}>{c.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Sustainability */}
        <div className="mb-3 rounded-lg border border-brand/40 bg-brand-subtle p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-brand">Score de sustentabilidade</span>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {DY_RESULT.sustainability.score}/100
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['ROE', DY_RESULT.sustainability.roe],
              ['Payout', DY_RESULT.sustainability.payout],
              ['Margem Líquida', DY_RESULT.sustainability.margem],
            ].map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-brand">{k}: </span>
                <span className="font-semibold text-brand">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sector comparison */}
        <div className="mb-3 rounded-lg border border-brand/40 bg-brand-subtle p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-brand">DY vs média do setor</span>
            <span className="text-xs font-semibold text-brand">{DY_RESULT.sector.diff} acima</span>
          </div>
          <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-brand-subtle">
            <div className="h-full w-[75%] rounded-full bg-brand" />
          </div>
          <div className="flex justify-between text-xs text-brand">
            <span>Setor: {DY_RESULT.sector.media}</span>
            <span className="font-semibold">Ativo: {DY_RESULT.sector.dy}</span>
          </div>
        </div>

        {/* Projections */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-warning/40 bg-warning-subtle p-3 text-center">
            <p className="text-xs font-semibold text-warning mb-1">Conservador</p>
            <p className="text-base font-semibold text-warning">R$680/mês</p>
            <p className="text-xs text-warning">R$8.160/ano</p>
          </div>
          <div className="rounded-lg border border-brand/40 bg-brand-subtle p-3 text-center">
            <p className="text-xs font-semibold text-brand mb-1">Otimista</p>
            <p className="text-base font-semibold text-brand">R$1.020/mês</p>
            <p className="text-xs text-brand">R$12.240/ano</p>
          </div>
        </div>

        <p className="mt-2 text-right text-xs text-muted-foreground">Dados ilustrativos</p>
      </div>
    </div>
  )
}

export function FeaturesRadarSection() {
  const [activeTab, setActiveTab] = useState<'radar' | 'calculadora'>('radar')

  return (
    <section className="bg-background py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Dividendos</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Ferramentas completas para investidores de dividendos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Do radar que encontra pagadores consistentes à calculadora que projeta sua renda passiva real.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-lg bg-muted p-1">
          {([
            { id: 'radar', label: 'Radar de Dividendos' },
            { id: 'calculadora', label: 'Calculadora de DY' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Radar tab */}
        {activeTab === 'radar' && (
          <PreviewShell path="/acao/taee11">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="sticky left-0 bg-surface px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Empresa
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                    DY Proj.
                  </th>
                  {MONTHS.map((m, i) => (
                    <th
                      key={m}
                      className={`px-2 py-3 text-center text-xs font-semibold ${
                        i === CURRENT_MONTH
                          ? 'border-l-2 border-r-2 border-brand bg-brand-subtle text-brand'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RADAR_ROWS.map((row, ri) => (
                  <tr key={row.ticker} className={ri < RADAR_ROWS.length - 1 ? 'border-b border-border' : ''}>
                    <td className="sticky left-0 bg-card px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {row.ticker.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{row.ticker}</div>
                          <div className="text-xs text-muted-foreground">{row.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-brand">{row.dy}</td>
                    {MONTHS.map((_, mi) => {
                      const payment = row.payments.find((p) => p.month === mi)
                      return (
                        <td
                          key={mi}
                          className={`px-2 py-3 text-center ${
                            mi === CURRENT_MONTH
                              ? 'border-l-2 border-r-2 border-brand bg-brand-subtle'
                              : ''
                          }`}
                        >
                          <div className="flex justify-center">
                            <DividendDot payment={payment} />
                          </div>
                          {payment && (
                            <div
                              className={`mt-0.5 text-xs ${
                                payment.type === 'paid' ? 'text-brand' : 'text-muted-foreground'
                              }`}
                            >
                              {payment.value}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-primary-foreground text-xs">$</span>
                Pago (histórico)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-dashed border-brand bg-card text-brand text-xs">$</span>
                Projetado
              </span>
              <span className="ml-auto whitespace-nowrap text-muted-foreground">Dados ilustrativos · Premium</span>
            </div>
          </div>
          </PreviewShell>
        )}

        {/* Calculadora tab */}
        {activeTab === 'calculadora' && (
          <PreviewShell path="/calculadoras/dividend-yield">
            <DYCalculatorPreview />
          </PreviewShell>
        )}
      </div>
    </section>
  )
}
