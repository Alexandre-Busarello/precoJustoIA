/**
 * Validação e resumo do contexto do Ben.
 *
 * - `sanitizeBenContext`: o contexto vem do cliente (não confiável). Aceita só os campos conhecidos, corta
 *   textos e listas e descarta o resto. Nada além do que o usuário já vê na tela.
 * - `serializeBenContext`: texto curto em pt-BR (até `BEN_CONTEXT_MAX_CHARS`) para o prompt.
 */

import { formatBRL, formatDate, formatDeltaPct, formatPct } from '@/lib/format'
import { BEN_CONTEXT_LIMITS, normalizeTicker } from './builders'
import {
  BEN_CONTEXT_MAX_CHARS,
  type BenAssetSection,
  type BenAssetType,
  type BenPageContext,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Sanitização
// ─────────────────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Texto de uma linha, sem marcação que mude o prompt, cortado em `max`. */
export function cleanText(value: unknown, max = 80): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[<>`*#{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function tickerList(value: unknown, max: number = BEN_CONTEXT_LIMITS.tickers): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const ticker = typeof item === 'string' ? normalizeTicker(item) : null
    if (ticker && !out.includes(ticker)) out.push(ticker)
    if (out.length >= max) break
  }
  return out
}

function textList(value: unknown, max: number, maxLength = 60): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => cleanText(item, maxLength)).filter((item): item is string => !!item).slice(0, max)
}

function objects(value: unknown, max: number): Raw[] {
  return Array.isArray(value) ? value.filter(isObject).slice(0, max) : []
}

const ASSET_TYPES: BenAssetType[] = ['stock', 'bdr', 'fii', 'etf', 'index']
const ASSET_SECTIONS: BenAssetSection[] = ['overview', 'technical', 'reports', 'dividends']
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function isoDateTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Valida o contexto vindo do cliente. Devolve `null` quando não reconhece o formato. */
export function sanitizeBenContext(raw: unknown): BenPageContext | null {
  if (!isObject(raw) || typeof raw.kind !== 'string') return null
  const focus = cleanText(raw.focus, 60)
  const base = focus ? { focus } : {}

  switch (raw.kind) {
    case 'asset': {
      const ticker = typeof raw.ticker === 'string' ? normalizeTicker(raw.ticker) : null
      if (!ticker) return null
      const assetType = ASSET_TYPES.includes(raw.assetType as BenAssetType) ? (raw.assetType as BenAssetType) : 'stock'
      const section = ASSET_SECTIONS.includes(raw.section as BenAssetSection) ? (raw.section as BenAssetSection) : undefined
      const companyName = cleanText(raw.companyName, 60)
      return {
        kind: 'asset',
        ticker,
        assetType,
        ...(section ? { section } : {}),
        ...(companyName ? { companyName } : {}),
        price: num(raw.price),
        valuations: objects(raw.valuations, BEN_CONTEXT_LIMITS.valuations)
          .map((item) => ({ model: cleanText(item.model, 40) ?? '', fairValue: num(item.fairValue), margin: num(item.margin), score: num(item.score) }))
          .filter((item) => item.model),
        score: num(raw.score),
        ...base,
      }
    }
    case 'portfolio': {
      const id = typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : null
      if (!id) return null
      const name = cleanText(raw.name, 60)
      return {
        kind: 'portfolio',
        id,
        ...(name ? { name } : {}),
        holdings: objects(raw.holdings, BEN_CONTEXT_LIMITS.holdings)
          .map((h) => ({ ticker: typeof h.ticker === 'string' ? normalizeTicker(h.ticker) : null, weight: num(h.weight) }))
          .filter((h): h is { ticker: string; weight: number | null } => h.ticker !== null),
        holdingsCount: num(raw.holdingsCount) ?? undefined,
        returnPct: num(raw.returnPct),
        ...base,
      }
    }
    case 'ranking':
      return {
        kind: 'ranking',
        model: cleanText(raw.model, 60) ?? '',
        ...(cleanText(raw.universe, 30) ? { universe: cleanText(raw.universe, 30) } : {}),
        ...(cleanText(raw.params, 200) ? { params: cleanText(raw.params, 200) } : {}),
        tickers: tickerList(raw.tickers),
        resultCount: num(raw.resultCount),
        ...base,
      }
    case 'screening':
      return {
        kind: 'screening',
        assetClass: raw.assetClass === 'fiis' ? 'fiis' : 'acoes',
        filters: textList(raw.filters, BEN_CONTEXT_LIMITS.filters),
        resultCount: num(raw.resultCount),
        tickers: tickerList(raw.tickers),
        ...base,
      }
    case 'comparador':
      return { kind: 'comparador', tickers: tickerList(raw.tickers, 6), ...base }
    case 'onde-aportar':
      return {
        kind: 'onde-aportar',
        amount: num(raw.amount),
        ...(cleanText(raw.universe, 60) ? { universe: cleanText(raw.universe, 60) } : {}),
        allocations: objects(raw.allocations, BEN_CONTEXT_LIMITS.allocations)
          .map((row) => ({ ticker: typeof row.ticker === 'string' ? normalizeTicker(row.ticker) : null, value: num(row.value) ?? 0, pct: num(row.pct) }))
          .filter((row): row is { ticker: string; value: number; pct: number | null } => row.ticker !== null),
        leftover: num(raw.leftover),
        ...base,
      }
    case 'backtest':
      return {
        kind: 'backtest',
        ...(cleanText(raw.config, 200) ? { config: cleanText(raw.config, 200) } : {}),
        totalReturn: num(raw.totalReturn),
        cdiReturn: num(raw.cdiReturn),
        ibovReturn: num(raw.ibovReturn),
        ...base,
      }
    case 'agenda':
      return {
        kind: 'agenda',
        events: objects(raw.events, BEN_CONTEXT_LIMITS.events)
          .map((event) => ({
            ticker: typeof event.ticker === 'string' ? normalizeTicker(event.ticker) : null,
            type: cleanText(event.type, 30) ?? 'Provento',
            date: typeof event.date === 'string' && ISO_DAY.test(event.date) ? event.date : '',
            amount: num(event.amount),
          }))
          .filter((event): event is { ticker: string; type: string; date: string; amount: number | null } => event.ticker !== null && !!event.date),
        ...base,
      }
    case 'alerts': {
      const alert = isObject(raw.alert) ? raw.alert : null
      const ticker = alert && typeof alert.ticker === 'string' ? normalizeTicker(alert.ticker) : null
      return {
        kind: 'alerts',
        ...(alert && ticker
          ? {
              alert: {
                ticker,
                conditions: textList(alert.conditions, BEN_CONTEXT_LIMITS.conditions, 80),
                lastTriggeredAt: isoDateTime(alert.lastTriggeredAt),
                ...(typeof alert.active === 'boolean' ? { active: alert.active } : {}),
              },
            }
          : {}),
        ...base,
      }
    }
    case 'dashboard':
      return { kind: 'dashboard', ...base }
    case 'generic': {
      const path = typeof raw.path === 'string' && raw.path.startsWith('/') ? cleanText(raw.path, 120) : undefined
      return { kind: 'generic', path: path ?? '/', ...base }
    }
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialização
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_TYPE_LABEL: Record<BenAssetType, string> = { stock: 'ação', bdr: 'BDR', fii: 'FII', etf: 'ETF', index: 'índice' }
const SECTION_LABEL: Record<BenAssetSection, string> = {
  overview: 'visão geral',
  technical: 'análise técnica',
  reports: 'relatórios',
  dividends: 'radar de dividendos',
}

function score100(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}/100` : null
}

function listLine(label: string, items: string[], limit: number, total?: number | null): string | null {
  if (items.length === 0) return null
  const shown = items.slice(0, limit)
  const rest = (total ?? items.length) - shown.length
  return `${label}: ${shown.join('; ')}${rest > 0 ? ` (+${rest})` : ''}.`
}

function dayLabel(isoDay: string): string {
  return formatDate(`${isoDay}T12:00:00Z`)
}

/** Linhas do contexto com no máximo `limit` itens por lista. */
function contextLines(context: BenPageContext, limit: number): (string | null)[] {
  switch (context.kind) {
    case 'asset': {
      const who = context.companyName ? `${context.ticker} (${ASSET_TYPE_LABEL[context.assetType]}, ${context.companyName})` : `${context.ticker} (${ASSET_TYPE_LABEL[context.assetType]})`
      const section = context.section && context.section !== 'overview' ? `, aba ${SECTION_LABEL[context.section]}` : ''
      const price = typeof context.price === 'number' ? ` Preço na tela: ${formatBRL(context.price)}.` : ''
      const score = score100(context.score)
      const valuations = (context.valuations ?? []).map((v) => {
        const parts = [`margem ${formatDeltaPct(v.margin)}`]
        const s = score100(v.score)
        if (s) parts.push(`score ${s}`)
        return `${v.model} ${formatBRL(v.fairValue)} (${parts.join(', ')})`
      })
      return [
        `Página do ativo ${who}${section}.${price}${score ? ` Score geral: ${score}.` : ''}`,
        listLine('Preço justo por modelo na tela', valuations, limit),
      ]
    }
    case 'portfolio': {
      const holdings = context.holdings.map((h) => `${h.ticker} ${formatPct(h.weight)}`)
      return [
        `Carteira ${context.name ? `"${context.name}"` : 'do usuário'} (id ${context.id}).${typeof context.returnPct === 'number' ? ` Retorno total na tela: ${formatDeltaPct(context.returnPct)}.` : ''}`,
        listLine('Maiores posições (peso atual)', holdings, limit, context.holdingsCount),
      ]
    }
    case 'ranking':
      return [
        `Ranking${context.model ? ` pelo modelo ${context.model}` : ''}${context.universe ? `, universo ${context.universe}` : ''}.${context.params ? ` Parâmetros: ${context.params}.` : ''}`,
        listLine('Primeiros resultados', context.tickers, limit, context.resultCount),
      ]
    case 'screening':
      return [
        `Screening de ${context.assetClass === 'fiis' ? 'FIIs' : 'ações'}${typeof context.resultCount === 'number' ? ` com ${context.resultCount} resultados` : ''}.`,
        context.filters.length > 0 ? listLine('Filtros ativos', context.filters, limit) : 'Sem filtros ativos.',
        listLine('Primeiros resultados', context.tickers, limit),
      ]
    case 'comparador':
      return [context.tickers.length > 0 ? `Comparador de ativos: ${context.tickers.join(', ')}.` : 'Comparador de ativos.']
    case 'onde-aportar': {
      const rows = context.allocations.map((row) => `${row.ticker} ${formatBRL(row.value)}${row.pct !== null ? ` (${formatPct(row.pct)})` : ''}`)
      return [
        `Onde aportar: simulação de ${typeof context.amount === 'number' ? formatBRL(context.amount) : 'um aporte'}${context.universe ? `, universo ${context.universe}` : ''}.${typeof context.leftover === 'number' ? ` Sobra: ${formatBRL(context.leftover)}.` : ''}`,
        listLine('Distribuição simulada', rows, limit),
      ]
    }
    case 'backtest': {
      const results = [
        typeof context.totalReturn === 'number' ? `retorno total ${formatDeltaPct(context.totalReturn)}` : null,
        typeof context.cdiReturn === 'number' ? `CDI ${formatDeltaPct(context.cdiReturn)}` : null,
        typeof context.ibovReturn === 'number' ? `Ibovespa ${formatDeltaPct(context.ibovReturn)}` : null,
      ].filter(Boolean)
      return [
        `Backtest de carteira.${context.config ? ` Configuração: ${context.config}.` : ''}`,
        results.length > 0 ? `Resultado na tela: ${results.join(', ')}.` : null,
      ]
    }
    case 'agenda': {
      const events = context.events.map((e) => `${e.ticker} ${e.type} em ${dayLabel(e.date)}${typeof e.amount === 'number' ? ` (${formatBRL(e.amount, { digits: 4 })} por cota/ação)` : ''}`)
      return ['Agenda de proventos.', listLine('Próximos eventos', events, limit)]
    }
    case 'alerts': {
      if (!context.alert) return ['Lista de alertas e monitoramentos do usuário.']
      const { alert } = context
      return [
        `Alerta de ${alert.ticker}${alert.active === false ? ' (pausado)' : ''}.${alert.lastTriggeredAt ? ` Último aviso: ${formatDate(alert.lastTriggeredAt, { style: 'datetime' })}.` : ' Ainda sem aviso.'}`,
        listLine('Critérios', alert.conditions, limit),
      ]
    }
    case 'dashboard':
      return ['Dashboard (página inicial do usuário logado).']
    case 'generic':
      return [`Página ${context.path}.`]
  }
}

/**
 * Resumo em texto do contexto, até `maxChars`. Corta primeiro as listas (menos itens) e, em último caso, o texto.
 */
export function serializeBenContext(context: BenPageContext, maxChars: number = BEN_CONTEXT_MAX_CHARS): string {
  const focus = context.focus ? `Item em que o usuário clicou: ${context.focus}.` : null
  let text = ''
  for (let limit = BEN_CONTEXT_LIMITS.valuations; limit >= 1; limit--) {
    text = [...contextLines(context, limit), focus].filter(Boolean).join('\n')
    if (text.length <= maxChars) return text
  }
  return `${text.slice(0, maxChars - 1).trimEnd()}…`
}
