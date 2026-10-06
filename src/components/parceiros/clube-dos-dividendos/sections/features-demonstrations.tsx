'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const TABS = [
  { id: 'preco-justo', label: 'Preço Justo' },
  { id: 'estrategias', label: 'Estratégias' },
  { id: 'demonstracoes', label: 'Demonstrações' },
  { id: 'visao-geral', label: 'Visão Geral' },
] as const

type TabId = typeof TABS[number]['id']

// ── Preço Justo ─────────────────────────────────────────────────────────────

const VALUATION_MODELS = [
  { name: 'Benjamin Graham', pct: 89, bg: 'bg-positive-subtle', border: 'border-positive/40', text: 'text-positive', badge: 'bg-foreground text-background' },
  { name: 'Fluxo de Caixa Descontado (FCD)', pct: 88, bg: 'bg-positive-subtle', border: 'border-positive/40', text: 'text-positive', badge: 'bg-foreground text-background' },
  { name: 'Fórmula de Gordon (Método dos Dividendos)', pct: 92, bg: 'bg-positive-subtle', border: 'border-positive/40', text: 'text-positive', badge: 'bg-foreground text-background' },
  { name: 'Método Barsi (Buy-and-Hold Dividendos)', pct: 91, bg: 'bg-positive-subtle', border: 'border-positive/40', text: 'text-positive', badge: 'bg-foreground text-background' },
]

function PrecoJustoContent() {
  return (
    <div className="space-y-2 p-5">
      {VALUATION_MODELS.map((m) => (
        <div key={m.name} className={`flex items-center justify-between rounded-lg border ${m.border} ${m.bg} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${m.text}`}>{m.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.badge}`}>
              {m.pct}% dos critérios
            </span>
            <span className="text-muted-foreground text-xs">›</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Estratégias ──────────────────────────────────────────────────────────────

const STRATEGIES = [
  { name: 'Dividendos (Anti-Armadilha)', pct: 94, bg: 'bg-positive-subtle', border: 'border-positive/40', badge: 'bg-foreground text-background' },
  { name: 'Value Investing', pct: 87, bg: 'bg-positive-subtle', border: 'border-positive/40', badge: 'bg-foreground text-background' },
  { name: 'Fórmula Mágica', pct: 81, bg: 'bg-positive-subtle', border: 'border-positive/40', badge: 'bg-foreground text-background' },
  { name: 'Fundamentalista 3+1', pct: 78, bg: 'bg-warning-subtle', border: 'border-warning/40', badge: 'bg-foreground text-background' },
]

function EstrategiasContent() {
  return (
    <div className="space-y-2 p-5">
      {STRATEGIES.map((s) => (
        <div key={s.name} className={`flex items-center justify-between rounded-lg border ${s.border} ${s.bg} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{s.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badge}`}>
              {s.pct}% dos critérios
            </span>
            <span className="text-muted-foreground text-xs">›</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Demonstrações ────────────────────────────────────────────────────────────

const STRONG_POINTS = [
  'Rentabilidade sólida: ROE de 21,3% acima da média do setor elétrico (15%). Excelente retorno para os acionistas.',
  'Fluxo de caixa consistente: Geração de caixa operacional crescente nos últimos 5 anos, cobrindo dividendos com folga.',
  'Liquidez adequada: Cobre R$1,10 em ativos líquidos para cada R$1,00 de obrigações de curto prazo.',
  'Margem líquida excepcional: 38,4% de margem, superior à média histórica do setor de transmissão (28%).',
  'Dívida controlada: Alavancagem de 0,8x Dívida/PL, dentro dos limites regulatórios e confortável para o setor.',
]

const ALERTS = [
  'Crescimento estagnado: Receitas crescem apenas 2,1% ao ano. Risco de perda de poder de compra no longo prazo.',
  'Concentração de concessões: Vencimentos entre 2030–2035 podem impactar receitas futuras se não renovados.',
]

function DemonstracoesContent() {
  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">Análise das Demonstrações Financeiras</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Análise automatizada da DRE, Balanço Patrimonial e Fluxo de Caixa de todos os anos disponíveis
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-positive/40 bg-positive-subtle px-3 py-1 text-xs font-semibold text-positive">
          Baixo risco
        </span>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Score de Qualidade</p>
          <p className="text-xs text-muted-foreground">Baseado em 20+ indicadores</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold text-positive">96</span>
          <span className="text-sm text-muted-foreground">de 100</span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-positive/40 bg-positive-subtle p-4">
          <div className="mb-3 flex items-center gap-2">
            <Check className="size-4 shrink-0 text-positive" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm font-semibold text-positive">Pontos fortes</p>
          </div>
          <ul className="space-y-2.5">
            {STRONG_POINTS.map((point, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-positive">
                <Check className="size-4 shrink-0 mt-0.5 text-positive" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  <strong>{point.split(':')[0]}:</strong>
                  {point.split(':').slice(1).join(':')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-negative/40 bg-negative-subtle p-4">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-negative">Alertas</p>
          </div>
          <ul className="space-y-2.5">
            {ALERTS.map((alert, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-negative">
                <span>
                  <strong>{alert.split(':')[0]}:</strong>
                  {alert.split(':').slice(1).join(':')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Metodologia */}
      <div className="rounded-lg border border-brand/40 bg-brand-subtle px-4 py-3">
        <div className="mb-1 flex items-center gap-1.5">
          <p className="text-xs font-semibold text-brand">Metodologia</p>
        </div>
        <p className="text-xs leading-relaxed text-brand">
          Esta análise examina automaticamente todos os anos disponíveis das demonstrações financeiras,
          detectando anomalias em receitas, margens, liquidez, endividamento, fluxo de caixa e tendências.
          O score combina 20+ indicadores para avaliar a qualidade e consistência dos resultados financeiros.
        </p>
      </div>
    </div>
  )
}

// ── Visão Geral ──────────────────────────────────────────────────────────────

const SCORE_BREAKDOWN = [
  { label: 'Valuation', value: 91, color: 'bg-positive' },
  { label: 'Rentabilidade', value: 88, color: 'bg-positive' },
  { label: 'Endividamento', value: 85, color: 'bg-positive' },
  { label: 'Crescimento', value: 72, color: 'bg-warning' },
  { label: 'Eficiência', value: 90, color: 'bg-positive' },
]

function VisaoGeralContent() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col items-center gap-2 py-2">
        <p className="text-xs font-semibold text-muted-foreground">Score geral</p>
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="48" cy="48" r="40"
              fill="none" stroke="var(--positive)" strokeWidth="8"
              strokeDasharray="251.3" strokeDashoffset="25.1"
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div className="text-center">
            <p className="text-2xl font-semibold text-brand">91</p>
            <p className="text-xs font-semibold text-brand">A+</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground">Muito Bom</p>
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Empresa excelente</span>
      </div>

      <div className="space-y-2">
        {SCORE_BREAKDOWN.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">{s.label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-muted h-2">
              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.value}%` }} />
            </div>
            <span className="w-7 shrink-0 text-right text-xs font-semibold text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

export function FeaturesDemonstrationsSection() {
  const [activeTab, setActiveTab] = useState<TabId>('demonstracoes')

  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-brand-subtle text-brand">Demonstrações Financeiras</Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            Alertas automáticos nos demonstrativos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Nossa IA analisa DRE, Balanço Patrimonial e Fluxo de Caixa de todos os anos disponíveis — detectando pontos fortes e sinais de alerta que passariam despercebidos numa análise manual.
          </p>
        </div>

        {/* Company context header */}
        <PreviewShell path="/acao/taee11">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-base font-semibold text-primary-foreground">
                TA
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-foreground">TAEE11</span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Energia</span>
                  <span className="rounded border border-positive/40 bg-positive-subtle px-1.5 py-0.5 text-xs text-positive">Large Caps</span>
                </div>
                <p className="text-xs text-muted-foreground">Transmissora Aliança de Energia Elétrica S.A.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Preço atual</p>
              <p className="text-xl font-semibold text-foreground tabular-nums">R$ 34,20</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border bg-surface overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-border bg-card font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'preco-justo' && <PrecoJustoContent />}
          {activeTab === 'estrategias' && <EstrategiasContent />}
          {activeTab === 'demonstracoes' && <DemonstracoesContent />}
          {activeTab === 'visao-geral' && <VisaoGeralContent />}

          <div className="border-t border-border bg-surface px-5 py-2 text-right text-xs text-muted-foreground">
            Dados ilustrativos · Premium
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
