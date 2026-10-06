/**
 * Texto livre da IA na análise técnica: troca expressões que soam como recomendação
 * ("sinal de compra", "região segura", "preço justo de entrada"...) por termos descritivos.
 * O texto continua sendo uma leitura do modelo, não recomendação de investimento.
 */

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bsina(l|is) de compra\b/gi, 'sina$1 de alta'],
  [/\bsina(l|is) de venda\b/gi, 'sina$1 de baixa'],
  [/\boportunidades? de compra\b/gi, 'ponto de entrada estimado'],
  [/\bregi(ão|ões) segura(s)?( para (a )?entrada)?\b/gi, 'regi$1 estimada$2'],
  [/\bregi(ão|ões) de entrada considerada(s)? justa(s)?\b/gi, 'regi$1 de entrada estimada$2 pelo modelo'],
  [/\bconsiderad([oa]s?) just([oa]s?)\b/gi, 'estimad$1 pelo modelo'],
  [/\bpreço justo de entrada\b/gi, 'entrada técnica estimada'],
  [/\bgarantid([oa]s?)\b/gi, 'provável'],
  [/\brecomenda(mos|-se)\b/gi, 'o modelo aponta'],
  [/\brecomendaç(ão|ões) de compra\b/gi, 'leitura do modelo'],
]

/** Aplica as trocas preservando a caixa da primeira letra do trecho original. */
export function softenAiText(text: string | null | undefined): string {
  if (!text) return ''
  let result = text
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, (match, ...groups: unknown[]) => {
      const captures = groups.slice(0, -2) as Array<string | undefined>
      const replaced = replacement.replace(/\$(\d)/g, (_, n: string) => captures[Number(n) - 1] ?? '')
      const first = match.charAt(0)
      return first === first.toUpperCase() && first !== first.toLowerCase()
        ? replaced.charAt(0).toUpperCase() + replaced.slice(1)
        : replaced
    })
  }
  return result
}
