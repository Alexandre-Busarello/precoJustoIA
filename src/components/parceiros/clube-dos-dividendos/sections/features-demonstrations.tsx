'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const TABS = [
  { id: 'preco-justo', label: 'Preço Justo', icon: '▣' },
  { id: 'estrategias', label: 'Estratégias', icon: '⚙' },
  { id: 'demonstracoes', label: 'Demonstrações', icon: '▤' },
  { id: 'visao-geral', label: 'Visão Geral', icon: '◎' },
] as const

type TabId = typeof TABS[number]['id']

// ── Preço Justo ─────────────────────────────────────────────────────────────

const VALUATION_MODELS = [
  { name: 'Benjamin Graham', icon: '▣', pct: 89, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', badge: 'bg-black text-white' },
  { name: 'Fluxo de Caixa Descontado (FCD)', icon: '▣', pct: 88, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', badge: 'bg-black text-white' },
  { name: 'Fórmula de Gordon (Método dos Dividendos)', icon: '$', pct: 92, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', badge: 'bg-black text-white' },
  { name: 'Método Barsi (Buy-and-Hold Dividendos)', icon: '$', pct: 91, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', badge: 'bg-black text-white' },
]

function PrecoJustoContent() {
  return (
    <div className="space-y-2 p-5">
      {VALUATION_MODELS.map((m) => (
        <div key={m.name} className={`flex items-center justify-between rounded-xl border ${m.border} ${m.bg} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{m.icon}</span>
            <span className={`text-sm font-medium ${m.text}`}>{m.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.badge}`}>
              {m.pct}% dos critérios
            </span>
            <span className="text-slate-400 text-xs">›</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Estratégias ──────────────────────────────────────────────────────────────

const STRATEGIES = [
  { name: 'Dividendos (Anti-Armadilha)', icon: '$', pct: 94, bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-black text-white' },
  { name: 'Value Investing', icon: '▣', pct: 87, bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-black text-white' },
  { name: 'Fórmula Mágica', icon: '⚙', pct: 81, bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-black text-white' },
  { name: 'Fundamentalista 3+1', icon: '〜', pct: 78, bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-black text-white' },
]

function EstrategiasContent() {
  return (
    <div className="space-y-2 p-5">
      {STRATEGIES.map((s) => (
        <div key={s.name} className={`flex items-center justify-between rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{s.icon}</span>
            <span className="text-sm font-medium text-slate-800">{s.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.badge}`}>
              {s.pct}% dos critérios
            </span>
            <span className="text-slate-400 text-xs">›</span>
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
            <span className="text-slate-400">▣</span>
            <p className="font-semibold text-slate-900">Análise das Demonstrações Financeiras</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Análise automatizada da DRE, Balanço Patrimonial e Fluxo de Caixa de todos os anos disponíveis
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          ◎ Baixo Risco
        </span>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Score de Qualidade</p>
          <p className="text-xs text-slate-400">Baseado em 20+ indicadores</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-green-600">96</span>
          <span className="text-sm text-slate-400">de 100</span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <p className="text-sm font-semibold text-green-800">Pontos Fortes</p>
          </div>
          <ul className="space-y-2.5">
            {STRONG_POINTS.map((point, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-green-900">
                <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                <span>
                  <strong>{point.split(':')[0]}:</strong>
                  {point.split(':').slice(1).join(':')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-red-600">△</span>
            <p className="text-sm font-semibold text-red-800">Alertas</p>
          </div>
          <ul className="space-y-2.5">
            {ALERTS.map((alert, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-red-900">
                <span className="mt-0.5 shrink-0 text-red-500">△</span>
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
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-blue-500 text-sm">〜</span>
          <p className="text-xs font-semibold text-blue-800">Metodologia</p>
        </div>
        <p className="text-xs leading-relaxed text-blue-700">
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
  { label: 'Valuation', value: 91, color: 'bg-green-500' },
  { label: 'Rentabilidade', value: 88, color: 'bg-green-500' },
  { label: 'Endividamento', value: 85, color: 'bg-green-500' },
  { label: 'Crescimento', value: 72, color: 'bg-yellow-500' },
  { label: 'Eficiência', value: 90, color: 'bg-green-500' },
]

function VisaoGeralContent() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col items-center gap-2 py-2">
        <p className="text-xs font-semibold uppercase text-slate-400">Score Geral ✦</p>
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle
              cx="48" cy="48" r="40"
              fill="none" stroke="#10b981" strokeWidth="8"
              strokeDasharray="251.3" strokeDashoffset="25.1"
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-emerald-600">91</p>
            <p className="text-xs font-bold text-emerald-600">A+</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700">Muito Bom</p>
        <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">Empresa Excelente</span>
      </div>

      <div className="space-y-2">
        {SCORE_BREAKDOWN.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-slate-500">{s.label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.value}%` }} />
            </div>
            <span className="w-7 shrink-0 text-right text-xs font-semibold text-slate-700">{s.value}</span>
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
    <section className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 bg-blue-100 text-blue-700">Demonstrações Financeiras</Badge>
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Alertas automáticos nos demonstrativos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Nossa IA analisa DRE, Balanço Patrimonial e Fluxo de Caixa de todos os anos disponíveis — detectando pontos fortes e sinais de alerta que passariam despercebidos numa análise manual.
          </p>
        </div>

        {/* Company context header */}
        <PreviewShell path="/acao/taee11">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-base font-extrabold text-white">
                TA
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-slate-900">TAEE11</span>
                  <span className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500">Energia</span>
                  <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700">Large Caps</span>
                </div>
                <p className="text-xs text-slate-400">Transmissora Aliança de Energia Elétrica S.A.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Preço Atual</p>
              <p className="text-xl font-extrabold text-green-600">R$ 34,20</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-slate-900 bg-white font-semibold text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span>{tab.icon}</span>
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

          <div className="border-t border-slate-100 bg-slate-50 px-5 py-2 text-right text-xs text-slate-400">
            Dados ilustrativos · PREMIUM
          </div>
        </div>
        </PreviewShell>
      </div>
    </section>
  )
}
