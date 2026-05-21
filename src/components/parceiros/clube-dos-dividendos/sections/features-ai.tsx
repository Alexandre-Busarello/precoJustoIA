'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const TABS = [
  { id: 'mensal', label: 'Relatório Mensal' },
  { id: 'queda', label: 'Queda de Preço' },
  { id: 'sentimento', label: 'Sentimento' },
  { id: 'tecnica', label: 'Análise Técnica' },
] as const

type TabId = typeof TABS[number]['id']

// ── Relatório Mensal ────────────────────────────────────────────────────────

function RelatorioMensalPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/20">
            <span className="text-base text-purple-400">🧠</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ITSA4 — Relatório Mensal de IA</p>
            <p className="text-xs text-slate-500">Mai/2025 · Itaúsa</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
          Score 87
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Resumo</p>
          <p className="text-sm leading-relaxed text-slate-300">
            ITSA4 mantém fundamentos sólidos em maio, impulsionada pelo desempenho do Itaú Unibanco.
            Payout consistente de 44% e ROE de 21,3% colocam o ativo entre os mais sustentáveis do setor financeiro.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Análise</p>
          <p className="text-sm leading-relaxed text-slate-300">
            A holding registrou crescimento de 8,4% no lucro líquido no trimestre. O desconto estrutural
            sobre o valor patrimonial do Itaú permanece em ~18%, criando margem de segurança para o investidor de longo prazo.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-xs font-semibold uppercase text-emerald-400 mb-1">Veredito da IA</p>
          <p className="text-sm font-semibold text-emerald-300">Fundamentos sólidos. Oportunidade para acumulação gradual.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-emerald-500 to-purple-500" />
          </div>
          <span className="text-xs text-slate-400">87/100</span>
        </div>

        {/* Community feedback */}
        <div className="flex items-center gap-3 border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-500">Avaliação da comunidade:</span>
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-[78%] bg-green-500" />
            <div className="h-full w-[22%] bg-red-500" />
          </div>
          <span className="text-xs text-green-400">78% 👍</span>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-900/80 px-5 py-2 text-right text-xs text-slate-600">
        Dados ilustrativos · PREMIUM
      </div>
    </div>
  )
}

// ── Relatório de Queda ──────────────────────────────────────────────────────

function RelatorioQuedaPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/20">
            <span className="text-base text-orange-400">⚠️</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">MGLU3 — Variação de Preço</p>
            <p className="text-xs text-slate-500">Janela: 5 dias · Queda −8,3%</p>
          </div>
        </div>
        <span className="rounded-full border border-orange-500/40 px-3 py-1 text-xs font-bold text-orange-400">
          −8,3%
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* Conclusion box */}
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
          <p className="text-xs font-semibold uppercase text-orange-400 mb-1">Conclusão do Fundamento</p>
          <p className="text-sm font-bold text-orange-300">⚠️ Deterioração de Fundamento Detectada</p>
          <p className="mt-1 text-xs text-slate-400">
            A queda reflete piora estrutural em margem bruta e aumento de dívida. Não se trata de ajuste técnico ou volatilidade normal.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Resumo da Variação</p>
          <p className="text-sm leading-relaxed text-slate-300">
            MGLU3 acumulou −8,3% nos últimos 5 pregões após divulgação de resultados abaixo do esperado.
            A margem EBITDA recuou 3,2 p.p. e o endividamento líquido subiu R$ 1,1 bi.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Estado dos Fundamentos</p>
          <div className="space-y-1.5">
            {[
              { label: 'Margem Bruta', value: '23,1%', status: 'red' },
              { label: 'Dívida Líq./EBITDA', value: '4,2x', status: 'red' },
              { label: 'Cobertura de Juros', value: '1,1x', status: 'yellow' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs">
                <span className="text-slate-400">{r.label}</span>
                <span className={r.status === 'red' ? 'font-semibold text-red-400' : 'font-semibold text-yellow-400'}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-900/80 px-5 py-2 text-right text-xs text-slate-600">
        Dados ilustrativos · PREMIUM
      </div>
    </div>
  )
}

// ── Análise de Sentimento ───────────────────────────────────────────────────

function SentimentoPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20">
            <span className="text-base">📺</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">PETR4 — Sentimento de Mercado</p>
            <p className="text-xs text-slate-500">Análise de YouTube + Internet com IA</p>
          </div>
        </div>
        <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">
          72/100
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* Score bar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-500">Sentimento geral</span>
            <span className="font-semibold text-green-400">Positivo</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-600">
            <span>Negativo</span><span>Neutro</span><span>Positivo</span>
          </div>
        </div>

        {/* Summary */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Resumo da Análise</p>
          <p className="text-sm leading-relaxed text-slate-300">
            O sentimento em torno da Petrobras é predominantemente positivo. Criadores de conteúdo destacam
            o alto dividend yield e a previsibilidade de distribuição como diferenciais frente ao setor.
          </p>
        </div>

        {/* Points */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-3 w-1 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-green-400">Pontos Positivos</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>· Alto DY histórico</li>
              <li>· Resultados acima do esperado</li>
              <li>· Redução de dívida</li>
            </ul>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-3 w-1 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-red-400">Pontos de Atenção</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>· Risco de intervenção política</li>
              <li>· Volatilidade do petróleo</li>
              <li>· Câmbio pressionado</li>
            </ul>
          </div>
        </div>

        <p className="text-right text-xs text-slate-600">Última atualização: 20/05/2025</p>
      </div>

      <div className="border-t border-slate-800 bg-slate-900/80 px-5 py-2 text-right text-xs text-slate-600">
        Dados ilustrativos · PREMIUM
      </div>
    </div>
  )
}

// ── Análise Técnica com IA ──────────────────────────────────────────────────

function AnaliseTecnicaPreview() {
  return (
    <div className="space-y-3">
      {/* Traffic light */}
      <div className="overflow-hidden rounded-2xl border-2 border-green-500 bg-green-950/40">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-green-500" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">VALE3 — Zona de Compra</p>
              <p className="text-xs text-slate-400">Preço atual: R$ 62,40</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Preço justo de entrada</p>
            <p className="text-base font-extrabold text-green-400">R$ 58,20</p>
          </div>
        </div>
        <div className="border-t border-green-500/30 bg-green-500/10 px-5 py-2 text-xs text-green-300">
          Ativo negociado abaixo do preço justo calculado pela IA. Sinal de entrada confirmado.
        </div>
      </div>

      {/* AI analysis card */}
      <div className="overflow-hidden rounded-2xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-950/60 to-slate-900">
        <div className="flex items-center gap-3 border-b border-purple-500/20 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/20">
            <span className="text-base text-purple-400">🧠</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Análise Técnica por IA</p>
            <p className="text-xs text-slate-500">Confiança: 85% · Válido até 23/05/2025</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="mb-1 text-xs font-semibold text-purple-300">Análise da IA:</p>
            <p className="text-sm leading-relaxed text-slate-300">
              Os indicadores convergem para sinal de compra. RSI em 42 indica espaço para valorização sem sobrecompra.
              MACD cruzando positivo e preço acima da SMA200 reforçam o cenário de acumulação.
            </p>
          </div>

          {/* Indicators */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'RSI (14)', value: '42,3', color: 'text-green-400' },
              { label: 'MACD', value: '+0,82', color: 'text-green-400' },
              { label: 'Stochastic', value: '38/41', color: 'text-yellow-400' },
              { label: 'SMA 20', value: 'R$60,10', color: 'text-slate-300' },
              { label: 'SMA 200', value: 'R$57,80', color: 'text-slate-300' },
              { label: 'Bollinger', value: 'Médio', color: 'text-slate-300' },
            ].map((ind) => (
              <div key={ind.label} className="rounded-lg bg-slate-800/60 px-3 py-2 text-center">
                <p className={`text-sm font-bold ${ind.color}`}>{ind.value}</p>
                <p className="text-xs text-slate-500">{ind.label}</p>
              </div>
            ))}
          </div>

          {/* Support / Resistance */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
              <p className="font-semibold text-green-400">Suporte</p>
              <p className="text-slate-300">R$ 58,20 · R$ 55,40</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="font-semibold text-red-400">Resistência</p>
              <p className="text-slate-300">R$ 65,00 · R$ 68,50</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-right text-xs text-slate-600">Dados ilustrativos · PREMIUM</p>
    </div>
  )
}

// ── Main section ────────────────────────────────────────────────────────────

export function FeaturesAISection() {
  const [activeTab, setActiveTab] = useState<TabId>('mensal')

  return (
    <section className="bg-slate-950 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 border-violet-500/30 bg-violet-500/10 text-violet-400">
            Inteligência Artificial
          </Badge>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            4 relatórios de IA que nenhuma outra plataforma oferece
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            De análise mensal de fundamentos ao diagnóstico automático de quedas de preço — tudo gerado por IA com dados reais da B3.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-xl bg-slate-800/60 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <PreviewShell path="/acao/taee11/relatorios">
          {activeTab === 'mensal' && <RelatorioMensalPreview />}
          {activeTab === 'queda' && <RelatorioQuedaPreview />}
          {activeTab === 'sentimento' && <SentimentoPreview />}
          {activeTab === 'tecnica' && <AnaliseTecnicaPreview />}
        </PreviewShell>
      </div>
    </section>
  )
}
