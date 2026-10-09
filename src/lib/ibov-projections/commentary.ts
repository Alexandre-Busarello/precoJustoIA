/**
 * Comentário opcional gerado por IA sobre o contexto das faixas. A IA recebe os números já calculados e só escreve
 * 2 a 3 frases de contexto: não produz alvo, não altera faixa e não sugere operação. Funções puras (prompt e
 * validação); a chamada ao modelo fica no serviço.
 */

import { formatDate, formatNumber, formatPct } from '@/lib/format'
import type { IbovProjectionReport } from './types'

export const COMMENTARY_MAX_LENGTH = 700

/** Expressões proibidas no comentário (previsão, alvo, ordem de compra/venda, promessa). */
const FORBIDDEN = [
  /\bvai\s+(subir|cair|chegar|atingir|bater|valorizar|desvalorizar)/i,
  /\bir[áa]\s+(subir|cair|chegar|atingir|bater)/i,
  /\balvo\b/i,
  /\bcompra(r)?\b/i,
  /\bvend(a|er)\b/i,
  /recomend/i,
  /garanti/i,
  /\bprevis[ãa]o\b/i,
  /\bpreditiv/i,
  /\bcerteza\b/i,
]

export function buildCommentaryPrompt(report: Pick<IbovProjectionReport, 'lastClose' | 'lastCloseDate' | 'horizons' | 'context'>): string {
  const lines: string[] = []
  lines.push(`Último fechamento do Ibovespa: ${formatNumber(report.lastClose, { digits: 0 })} pontos em ${formatDate(report.lastCloseDate)}.`)
  for (const h of report.horizons) {
    if (h.status !== 'ok' || !h.levels || h.positiveShare === null) continue
    const vol = h.volatility?.ratio ? `; volatilidade recente ${formatNumber(h.volatility.ratio, { digits: 2 })}x a mediana de 10 anos` : ''
    lines.push(
      `Horizonte ${h.label}: faixa provável (68%) de ${formatNumber(h.levels.p16, { digits: 0 })} a ${formatNumber(h.levels.p84, { digits: 0 })} pontos; ` +
        `alta em ${formatPct(h.positiveShare, { digits: 0 })} das janelas históricas${vol}.`
    )
  }
  const { plBolsa, selic, cdi } = report.context
  if (plBolsa) {
    lines.push(
      `P/L agregado da bolsa: ${formatNumber(plBolsa.current, { digits: 1 })} (média histórica ${formatNumber(plBolsa.average, { digits: 1 })}, percentil ${formatNumber(plBolsa.percentileRank * 100, { digits: 0 })} da série desde ${plBolsa.since.slice(0, 4)}).`
    )
  }
  if (selic) lines.push(`Selic: ${formatPct(selic.value, { digits: 2 })} ao ano.`)
  if (cdi) lines.push(`CDI: ${formatPct(cdi.value, { digits: 2 })} ao ano.`)

  return [
    'Você escreve uma nota curta de contexto para investidores pessoa física, em português do Brasil.',
    'Os números abaixo foram calculados por um método estatístico a partir do histórico do Ibovespa. Não altere nem recalcule nenhum deles.',
    '',
    ...lines,
    '',
    'Escreva de 2 a 3 frases (no máximo 600 caracteres) sobre o cenário macro e de valuation que esses dados descrevem.',
    'Regras obrigatórias:',
    '- Não faça previsão, não indique alvo nem direção futura do índice e não use "vai subir", "vai cair" ou "alvo".',
    '- Não sugira compra, venda nem qualquer operação; não use as palavras "compra", "venda" ou "recomendação".',
    '- Não invente números novos: cite apenas os números fornecidos, se precisar.',
    '- Sem títulos, listas, markdown ou emoji. Tom neutro e sóbrio.',
    'Responda apenas com o texto da nota.',
  ].join('\n')
}

/** Normaliza o texto do modelo; devolve `null` se ele violar as regras (aí a página fica sem comentário). */
export function validateCommentary(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw
    .replace(/[*_#`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length < 40 || text.length > COMMENTARY_MAX_LENGTH) return null
  if (FORBIDDEN.some((re) => re.test(text))) return null
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) return null
  return text
}
