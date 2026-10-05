'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { PreviewShell } from '../preview-shell'

const TABS = [
  { id: 'mensal', label: 'Relatório mensal' },
  { id: 'queda', label: 'Queda de preço' },
  { id: 'sentimento', label: 'Sentimento' },
  { id: 'tecnica', label: 'Análise técnica' },
] as const

type TabId = typeof TABS[number]['id']

// ── Relatório Mensal ────────────────────────────────────────────────────────

function RelatorioMensalPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">ITSA4 — Relatório mensal de IA</p>
            <p className="text-xs text-muted-foreground">Mai/2025 · Itaúsa</p>
          </div>
        </div>
        <span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold text-brand">
          Score 87
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Resumo</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            ITSA4 mantém fundamentos sólidos em maio, impulsionada pelo desempenho do Itaú Unibanco.
            Payout consistente de 44% e ROE de 21,3% colocam o ativo entre os mais sustentáveis do setor financeiro.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Análise</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A holding registrou crescimento de 8,4% no lucro líquido no trimestre. O desconto estrutural
            sobre o valor patrimonial do Itaú permanece em ~18%, criando margem de segurança para o investidor de longo prazo.
          </p>
        </div>

        <div className="rounded-lg border border-brand/40 bg-brand-subtle p-3">
          <p className="text-xs font-semibold text-brand mb-1">Veredito da IA</p>
          <p className="text-sm font-semibold text-brand">Fundamentos sólidos nos indicadores analisados.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[87%] rounded-full bg-brand" />
          </div>
          <span className="text-xs text-muted-foreground">87/100</span>
        </div>

        {/* Community feedback */}
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Avaliação da comunidade:</span>
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[78%] bg-positive" />
            <div className="h-full w-[22%] bg-negative" />
          </div>
          <span className="text-xs text-positive">78% positivo</span>
        </div>
      </div>

      <div className="border-t border-border bg-card px-5 py-2 text-right text-xs text-muted-foreground">
        Dados ilustrativos · Premium
      </div>
    </div>
  )
}

// ── Relatório de Queda ──────────────────────────────────────────────────────

function RelatorioQuedaPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">MGLU3 — variação de preço</p>
            <p className="text-xs text-muted-foreground">Janela: 5 dias · Queda −8,3%</p>
          </div>
        </div>
        <span className="rounded-full border border-warning/40 px-3 py-1 text-xs font-semibold text-warning">
          −8,3%
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* Conclusion box */}
        <div className="rounded-lg border border-warning/40 bg-warning-subtle p-3">
          <p className="text-xs font-semibold text-warning mb-1">Conclusão do fundamento</p>
          <p className="text-sm font-semibold text-warning">Deterioração de fundamento detectada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A queda reflete piora estrutural em margem bruta e aumento de dívida. Não se trata de ajuste técnico ou volatilidade normal.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Resumo da variação</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            MGLU3 acumulou −8,3% nos últimos 5 pregões após divulgação de resultados abaixo do esperado.
            A margem EBITDA recuou 3,2 p.p. e o endividamento líquido subiu R$ 1,1 bi.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Estado dos fundamentos</p>
          <div className="space-y-1.5">
            {[
              { label: 'Margem bruta', value: '23,1%', status: 'red' },
              { label: 'Dívida Líq./EBITDA', value: '4,2x', status: 'red' },
              { label: 'Cobertura de Juros', value: '1,1x', status: 'yellow' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={r.status === 'red' ? 'font-semibold text-negative' : 'font-semibold text-warning'}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card px-5 py-2 text-right text-xs text-muted-foreground">
        Dados ilustrativos · Premium
      </div>
    </div>
  )
}

// ── Análise de Sentimento ───────────────────────────────────────────────────

function SentimentoPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">PETR4 — Sentimento de mercado</p>
            <p className="text-xs text-muted-foreground">Análise de YouTube + Internet com IA</p>
          </div>
        </div>
        <span className="rounded-full bg-positive-subtle px-3 py-1 text-xs font-semibold text-positive">
          72/100
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* Score bar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sentimento geral</span>
            <span className="font-semibold text-positive">Positivo</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[72%] rounded-full bg-positive" />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Negativo</span><span>Neutro</span><span>Positivo</span>
          </div>
        </div>

        {/* Summary */}
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Resumo da análise</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O sentimento em torno da Petrobras é predominantemente positivo. Criadores de conteúdo destacam
            o alto dividend yield e a previsibilidade de distribuição como diferenciais frente ao setor.
          </p>
        </div>

        {/* Points */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-3 w-1 rounded-full bg-positive" />
              <span className="text-xs font-semibold text-positive">Pontos positivos</span>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>· Alto DY histórico</li>
              <li>· Resultados acima do esperado</li>
              <li>· Redução de dívida</li>
            </ul>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-3 w-1 rounded-full bg-negative" />
              <span className="text-xs font-semibold text-negative">Pontos de atenção</span>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>· Risco de intervenção política</li>
              <li>· Volatilidade do petróleo</li>
              <li>· Câmbio pressionado</li>
            </ul>
          </div>
        </div>

        <p className="text-right text-xs text-muted-foreground">Última atualização: 20/05/2025</p>
      </div>

      <div className="border-t border-border bg-card px-5 py-2 text-right text-xs text-muted-foreground">
        Dados ilustrativos · Premium
      </div>
    </div>
  )
}

// ── Análise Técnica com IA ──────────────────────────────────────────────────

function AnaliseTecnicaPreview() {
  return (
    <div className="space-y-3">
      {/* Traffic light */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">VALE3</p>
              <Badge variant="warning">Acima do preço justo</Badge>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">Preço atual: R$ 62,40</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Preço justo estimado</p>
            <p className="text-base font-semibold text-foreground tabular-nums">R$ 58,20</p>
          </div>
        </div>
        <div className="border-t border-border bg-muted px-5 py-2 text-xs text-muted-foreground">
          Ativo negociado acima do preço justo estimado pelos modelos. Indicadores técnicos em faixa neutra.
        </div>
      </div>

      {/* AI analysis card */}
      <div className="overflow-hidden rounded-lg border-2 border-brand/40">
        <div className="flex items-center gap-3 border-b border-brand/40 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Análise técnica por IA</p>
            <p className="text-xs text-muted-foreground">Confiança: 85% · Válido até 23/05/2025</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg bg-muted p-3">
            <p className="mb-1 text-xs font-semibold text-brand">Análise da IA:</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              RSI em 42, em faixa neutra (nem sobrecompra, nem sobrevenda).
              MACD cruzando positivo e preço acima da SMA200 indicam momento técnico positivo no curto prazo.
            </p>
          </div>

          {/* Indicators */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'RSI (14)', value: '42,3', color: 'text-foreground' },
              { label: 'MACD', value: '+0,82', color: 'text-positive' },
              { label: 'Stochastic', value: '38/41', color: 'text-foreground' },
              { label: 'SMA 20', value: 'R$60,10', color: 'text-muted-foreground' },
              { label: 'SMA 200', value: 'R$57,80', color: 'text-muted-foreground' },
              { label: 'Bollinger', value: 'Médio', color: 'text-muted-foreground' },
            ].map((ind) => (
              <div key={ind.label} className="rounded-lg bg-muted px-3 py-2 text-center">
                <p className={`text-sm font-semibold ${ind.color}`}>{ind.value}</p>
                <p className="text-xs text-muted-foreground">{ind.label}</p>
              </div>
            ))}
          </div>

          {/* Support / Resistance */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-positive/40 bg-positive-subtle px-3 py-2">
              <p className="font-semibold text-positive">Suporte</p>
              <p className="text-muted-foreground">R$ 58,20 · R$ 55,40</p>
            </div>
            <div className="rounded-lg border border-negative/40 bg-negative-subtle px-3 py-2">
              <p className="font-semibold text-negative">Resistência</p>
              <p className="text-muted-foreground">R$ 65,00 · R$ 68,50</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-right text-xs text-muted-foreground">Dados ilustrativos · Premium</p>
    </div>
  )
}

// ── Main section ────────────────────────────────────────────────────────────

export function FeaturesAISection() {
  const [activeTab, setActiveTab] = useState<TabId>('mensal')

  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <Badge className="mb-3 border-brand/40 bg-brand-subtle text-brand">
            Inteligência artificial
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            4 relatórios gerados por IA
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            De análise mensal de fundamentos ao diagnóstico automático de quedas de preço — tudo gerado por IA com dados reais da B3.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
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
