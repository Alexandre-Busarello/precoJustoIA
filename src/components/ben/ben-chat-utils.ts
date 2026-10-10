/**
 * Regras puras do chat do Ben (sem React, sem rede): rótulo e chave do contexto, dica da tela inicial,
 * estado das ferramentas, sugestões de continuação, resumo de respostas longas e título da conversa.
 */

import { contextFromPath } from '@/lib/ben-context/builders'
import { contextSuggestions, type BenSuggestion } from '@/lib/ben-context/questions'
import type { BenAssetSection, BenPageContext } from '@/lib/ben-context/types'

const SECTION_LABEL: Record<BenAssetSection, string> = {
  overview: 'Valuation',
  technical: 'Análise técnica',
  reports: 'Relatórios',
  dividends: 'Dividendos',
}

/**
 * Identidade do contexto para decidir se uma conversa "é desta tela": tipo de página mais o que a distingue
 * (ticker, id da carteira, caminho). Subpáginas do mesmo ativo contam como o mesmo contexto.
 */
export function contextKey(context: BenPageContext | null | undefined): string {
  if (!context) return 'none'
  switch (context.kind) {
    case 'asset':
      return `asset:${context.ticker}`
    case 'portfolio':
      return `portfolio:${context.id}`
    case 'screening':
      return `screening:${context.assetClass}`
    case 'generic':
      return `generic:${context.path}`
    default:
      return context.kind
  }
}

/** Chave do contexto de uma conversa a partir da URL em que ela foi criada. */
export function contextKeyFromUrl(url: string | null | undefined): string {
  return contextKey(contextFromPath(url || '/'))
}

/** Texto do chip "Vendo: …". `null` quando a página não tem contexto próprio (genérico). */
export function contextLabel(context: BenPageContext | null | undefined): string | null {
  if (!context) return null
  switch (context.kind) {
    case 'asset': {
      const section = context.section ?? 'overview'
      if (context.assetType === 'index') return context.ticker
      return `${context.ticker} · ${SECTION_LABEL[section]}`
    }
    case 'portfolio':
      if (!context.name) return 'Carteira'
      return /carteira/i.test(context.name) ? context.name : `Carteira ${context.name}`
    case 'ranking':
      return context.model ? `Ranking · ${context.model}` : 'Ranking'
    case 'screening':
      return context.assetClass === 'fiis' ? 'Screening de FIIs' : 'Screening de ações'
    case 'comparador':
      return context.tickers.length >= 2 ? `Comparador · ${context.tickers.slice(0, 3).join(' x ')}` : 'Comparador'
    case 'onde-aportar':
      return 'Onde aportar'
    case 'backtest':
      return 'Backtest'
    case 'agenda':
      return 'Agenda de proventos'
    case 'alerts':
      return context.alert ? `Alerta de ${context.alert.ticker}` : 'Monitoramentos'
    case 'dashboard':
      return 'Visão geral'
    case 'generic':
      return null
  }
}

/** Uma linha sobre o que o Ben faz nesta tela (tela inicial do chat). */
export function contextHint(context: BenPageContext | null | undefined): string {
  if (!context) return GENERIC_HINT
  switch (context.kind) {
    case 'asset':
      if (context.section === 'technical') return `Pergunte sobre os indicadores técnicos, suportes e resistências de ${context.ticker}.`
      if (context.section === 'dividends') return `Pergunte sobre os proventos de ${context.ticker} e a sustentabilidade do payout.`
      if (context.assetType === 'index') return `Pergunte como está o ${context.ticker} e o que pesou no índice.`
      return `Pergunte sobre o preço justo, os riscos ou os dividendos de ${context.ticker}.`
    case 'portfolio':
      return 'Pergunte sobre o retorno, a concentração ou uma posição desta carteira.'
    case 'ranking':
      return 'Pergunte como o modelo funciona ou o que os resultados têm em comum.'
    case 'screening':
      return 'Pergunte sobre os filtros ou sobre os resultados desta busca.'
    case 'comparador':
      return 'Peça uma comparação dos ativos pelos fundamentos e pelo preço justo estimado.'
    case 'onde-aportar':
      return 'Pergunte por que a calculadora distribuiu o aporte assim e como os critérios mudam o resultado.'
    case 'backtest':
      return 'Peça uma leitura do resultado do backtest comparado ao CDI e ao Ibovespa.'
    case 'agenda':
      return 'Pergunte sobre as datas e os valores dos próximos proventos.'
    case 'alerts':
      return 'Pergunte por que um alerta disparou ou que monitoramentos criar.'
    case 'dashboard':
      return 'Pergunte sobre um ativo, as suas carteiras ou o mercado hoje.'
    case 'generic':
      return GENERIC_HINT
  }
}

const GENERIC_HINT = 'Pergunte sobre um ativo, um indicador ou um método de valuation.'

/** Sugestões da tela inicial: as do contexto (até 3). */
export function startSuggestions(context: BenPageContext | null | undefined): BenSuggestion[] {
  const list = contextSuggestions(context)
  return list.length > 0 ? list : contextSuggestions({ kind: 'generic', path: '/' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Ferramentas em execução
// ─────────────────────────────────────────────────────────────────────────────

function tickerArg(args: unknown): string | null {
  if (!args || typeof args !== 'object') return null
  const value = (args as Record<string, unknown>).ticker
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase().slice(0, 10) : null
}

/** "buscando fundamentos de PETR4": o que a ferramenta do Ben está consultando, em linguagem simples. */
export function toolStatusLabel(name: string, args?: unknown): string {
  const ticker = tickerArg(args)
  const of = (text: string) => (ticker ? `${text} de ${ticker}` : text)
  switch (name) {
    case 'getCompanyMetrics':
      return of('Buscando fundamentos')
    case 'getFairValue':
      return of('Calculando o preço justo')
    case 'getTechnicalAnalysis':
      return of('Lendo a análise técnica')
    case 'getDividendProjections':
      return of('Buscando proventos')
    case 'listCompanyAIReports':
    case 'getCompanyAIReportContent':
      return of('Lendo relatórios')
    case 'getCompanyFlags':
      return 'Verificando sinais de atenção das empresas'
    case 'getMarketSentiment':
      return 'Lendo o sentimento do mercado'
    case 'getIbovData':
      return 'Buscando dados do Ibovespa'
    case 'webSearch':
      return 'Pesquisando notícias recentes'
    case 'getUserRadar':
    case 'getUserRadarWithFallback':
      return 'Lendo o seu radar'
    case 'getUserPortfolios':
      return 'Lendo as suas carteiras'
    case 'getPlatformFeatures':
      return 'Consultando as ferramentas da plataforma'
    default:
      return 'Consultando os dados da plataforma'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sugestões depois da resposta
// ─────────────────────────────────────────────────────────────────────────────

const TICKER_IN_TEXT = /\b([A-Z]{4}\d{1,2})\b/g

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Até 2 perguntas de continuação: tickers citados na resposta que não são o da tela e as sugestões do contexto
 * que ainda não foram feitas.
 */
export function followUpSuggestions(
  context: BenPageContext | null | undefined,
  askedQuestions: string[],
  lastAnswer: string
): BenSuggestion[] {
  const asked = new Set(askedQuestions.map(normalize))
  const out: BenSuggestion[] = []
  const add = (item: BenSuggestion) => {
    if (out.length >= 2) return
    if (asked.has(normalize(item.prompt)) || asked.has(normalize(item.label))) return
    if (out.some((existing) => existing.prompt === item.prompt)) return
    out.push(item)
  }

  const own = context?.kind === 'asset' ? context.ticker : null
  const mentioned = Array.from(new Set(lastAnswer.match(TICKER_IN_TEXT) ?? [])).filter((t) => t !== own)
  if (own && mentioned[0]) {
    add({ label: `Compare ${own} e ${mentioned[0]}`, prompt: `Compare ${own} e ${mentioned[0]} pelos fundamentos e pelo preço justo estimado.` })
  } else if (mentioned[0]) {
    add({ label: `Preço justo de ${mentioned[0]}`, prompt: `Qual o preço justo estimado de ${mentioned[0]} pelos modelos da plataforma?` })
  }

  for (const item of startSuggestions(context)) add(item)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Respostas longas
// ─────────────────────────────────────────────────────────────────────────────

/** A partir deste tamanho a resposta aparece resumida, com "Ver mais". */
export const LONG_ANSWER_CHARS = 1200
const SUMMARY_TARGET_CHARS = 450

/**
 * Resumo de uma resposta longa: os primeiros blocos de markdown (parágrafos, listas, tabelas) até ~450 caracteres,
 * sem cortar um bloco no meio. `null` quando a resposta é curta ou o resumo seria quase tudo.
 */
export function summarizeLongAnswer(markdown: string): string | null {
  if (markdown.length < LONG_ANSWER_CHARS) return null
  const blocks = markdown.split(/\n{2,}/)
  let summary = ''
  for (const block of blocks) {
    if (summary && summary.length + block.length > SUMMARY_TARGET_CHARS) break
    summary = summary ? `${summary}\n\n${block}` : block
    if (summary.length >= SUMMARY_TARGET_CHARS) break
  }
  // Um primeiro bloco enorme (parágrafo único): corta na última frase antes do alvo.
  if (summary.length > SUMMARY_TARGET_CHARS * 2) {
    const cut = summary.slice(0, SUMMARY_TARGET_CHARS * 2)
    const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
    summary = sentenceEnd > SUMMARY_TARGET_CHARS / 2 ? cut.slice(0, sentenceEnd + 1) : `${cut.trimEnd()}…`
  }
  return summary.length < markdown.length * 0.8 ? summary : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversa
// ─────────────────────────────────────────────────────────────────────────────

const TITLE_MAX = 60

/** Título da conversa a partir da primeira pergunta (o servidor pode trocá-lo depois da primeira resposta). */
export function conversationTitleFrom(question: string): string {
  const text = question.replace(/\s+/g, ' ').trim()
  if (text.length <= TITLE_MAX) return text
  const cut = text.slice(0, TITLE_MAX)
  const space = cut.lastIndexOf(' ')
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, '')}…`
}

/** Texto do limite do plano gratuito: "2 mensagens por dia · restam 1". */
export function limitLabel(limit: number, remaining: number): string {
  const perDay = `${limit} ${limit === 1 ? 'mensagem' : 'mensagens'} por dia`
  if (remaining <= 0) return `${perDay} · nenhuma restante hoje`
  return `${perDay} · ${remaining === 1 ? 'resta 1' : `restam ${remaining}`}`
}
