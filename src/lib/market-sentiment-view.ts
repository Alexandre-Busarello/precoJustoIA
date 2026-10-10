/**
 * Monta, no servidor, o que o bloco "O que o mercado está falando" pode receber.
 * Não-assinantes recebem só a prévia neutra: o resumo completo, o tom e os pontos extras
 * nunca entram nas props do client component (nem no payload RSC).
 */

export interface MarketSentimentSource {
  score: number
  summary: string
  positivePoints: string[] | null
  negativePoints: string[] | null
  updatedAt: Date
}

export interface MarketSentimentView {
  /** Resumo completo (Premium) ou prévia sem o tom (demais). */
  summary: string
  /** Rótulo do tom; null quando o leitor não é assinante. */
  toneLabel: string | null
  positivePoints: string[]
  negativePoints: string[]
  hiddenPositiveCount: number
  hiddenNegativeCount: number
  updatedAt: Date
  isPreview: boolean
}

export function sentimentLabel(score: number) {
  if (score >= 71) return 'Positivo'
  if (score >= 51) return 'Neutro'
  return 'Negativo'
}

/** Corta no fim de uma palavra, sem quebrar no meio. */
function preview(text: string, max = 160) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut}…`
}

/** Frases que revelam o tom (bloqueado para não-assinantes). */
const TONE_PATTERN = /sentimento|tom\b|predominant|positiv|negativ|otimis|pessimis|neutr/i

/**
 * Prévia para não-assinantes sem revelar o tom: pula a 1ª frase (que costuma resumir o sentimento) e as
 * frases que falam do tom; sem nada neutro para mostrar, usa uma linha genérica.
 */
export function neutralSentimentPreview(summary: string, ticker: string) {
  const sentences = summary.split(/(?<=[.!?])\s+/).slice(1).filter((sentence) => !TONE_PATTERN.test(sentence))
  const text = sentences.join(' ').trim()
  return text ? preview(text) : `Resumo de vídeos e análises públicas sobre ${ticker}.`
}

export function buildMarketSentimentView(
  analysis: MarketSentimentSource | null,
  ticker: string,
  userIsPremium: boolean,
): MarketSentimentView | null {
  if (!analysis) return null

  const positive = analysis.positivePoints ?? []
  const negative = analysis.negativePoints ?? []
  const lower = analysis.summary.toLowerCase()
  // Análise sem vídeos encontrados: não há o que mostrar
  const isEmpty =
    positive.length === 0 &&
    negative.length === 0 &&
    (lower.includes('não foram encontrados') || lower.includes('sem vídeos'))
  if (isEmpty) return null

  if (userIsPremium) {
    return {
      summary: analysis.summary,
      toneLabel: sentimentLabel(analysis.score),
      positivePoints: positive,
      negativePoints: negative,
      hiddenPositiveCount: 0,
      hiddenNegativeCount: 0,
      updatedAt: analysis.updatedAt,
      isPreview: false,
    }
  }

  const visiblePositive = positive.slice(0, 1)
  const visibleNegative = negative.slice(0, 1)
  return {
    summary: neutralSentimentPreview(analysis.summary, ticker),
    toneLabel: null,
    positivePoints: visiblePositive,
    negativePoints: visibleNegative,
    hiddenPositiveCount: positive.length - visiblePositive.length,
    hiddenNegativeCount: negative.length - visibleNegative.length,
    updatedAt: analysis.updatedAt,
    isPreview: true,
  }
}
