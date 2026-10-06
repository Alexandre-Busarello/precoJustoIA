/** Utilitários das páginas de relatórios de IA (ações e BDRs). */

export type ReportType = 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE' | 'PRICE_VARIATION' | 'CUSTOM_TRIGGER'

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  MONTHLY_OVERVIEW: 'Análise mensal',
  FUNDAMENTAL_CHANGE: 'Mudança fundamental',
  PRICE_VARIATION: 'Variação de preço',
  CUSTOM_TRIGGER: 'Gatilho personalizado',
}

export function reportTypeLabel(type: string): string {
  return REPORT_TYPE_LABEL[type as ReportType] ?? 'Relatório'
}

const TITLE_MAX = 90

/** Título do relatório: primeiro título do Markdown (ou primeira linha), sem marcação; cai no tipo quando não há texto. */
export function reportTitle(content: string, type: string): string {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
  const heading = lines.find((line) => /^#{1,3}\s/.test(line)) ?? lines[0]
  const clean = (heading ?? '').replace(/^[#>\s*-]+/, '').replace(/[*_`]/g, '').trim()
  if (!clean) return reportTypeLabel(type)
  if (clean.length <= TITLE_MAX) return clean
  const cut = clean.slice(0, TITLE_MAX)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : TITLE_MAX)}…`
}

/**
 * Trecho inicial para quem não é Premium, cortado em fim de parágrafo ou de frase (nunca no meio de uma palavra).
 * Devolve o conteúdo inteiro quando ele já é curto.
 */
export function partialContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content
  const truncated = content.slice(0, maxLength)
  const breakPoint = Math.max(truncated.lastIndexOf('\n\n'), truncated.lastIndexOf('. '), truncated.lastIndexOf('\n'))
  if (breakPoint > maxLength * 0.5) return content.slice(0, breakPoint + 1).trimEnd()
  const lastSpace = truncated.lastIndexOf(' ')
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`
}

/** Rótulo da janela avaliada em relatórios de variação de preço. */
export function windowLabel(days: number | null | undefined): string | null {
  if (!days) return null
  return days === 1 ? '1 dia' : `${days} dias`
}
