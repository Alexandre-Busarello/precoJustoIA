/**
 * Pós-processamento das respostas do Ben (servidor, antes do streaming e da gravação):
 * - links para seções da plataforma ("metodologia do FCD" → /metodologia#fcd, "Onde aportar" → /onde-aportar);
 * - remove HTML cru e links com destino inseguro (o markdown só leva links internos, http(s) e e-mail).
 * Os tickers já viram links em `processBenMessageLinks`.
 */

interface SectionLink {
  pattern: RegExp
  href: string
}

/** Âncoras de `/metodologia` (ids de `metodologia-content`). */
const METHODOLOGY_ANCHORS: { names: string; anchor: string }[] = [
  { names: 'fcd|fluxo de caixa descontado', anchor: 'fcd' },
  { names: 'n[úu]mero de graham|graham', anchor: 'graham' },
  { names: 'bazin|m[ée]todo bazin|pre[çc]o-teto', anchor: 'bazin' },
  { names: 'barsi|m[ée]todo barsi', anchor: 'barsi' },
  { names: 'gordon|modelo de gordon', anchor: 'gordon' },
  { names: 'peter lynch|lynch|peg', anchor: 'lynch' },
  { names: 'f[óo]rmula m[áa]gica', anchor: 'formula-magica' },
  { names: 'p/vp justo', anchor: 'pvp-justo' },
  { names: 'onde aportar', anchor: 'onde-aportar' },
]

const SECTION_LINKS: SectionLink[] = [
  ...METHODOLOGY_ANCHORS.map(({ names, anchor }) => ({
    pattern: new RegExp(`\\bmetodologia (?:do|da|de) (?:modelo |m[ée]todo )?(?:${names})\\b`, 'i'),
    href: `/metodologia#${anchor}`,
  })),
  { pattern: /\b(?:p[áa]gina de |nossa )metodologia\b/i, href: '/metodologia' },
  { pattern: /\bOnde aportar\b/, href: '/onde-aportar' },
  { pattern: /\bscreening de a[çc][õo]es\b/i, href: '/screening-acoes' },
  { pattern: /\bscreening de FIIs\b/i, href: '/screening-fiis' },
  { pattern: /\bcomparador de a[çc][õo]es\b/i, href: '/comparador' },
  { pattern: /\bagenda de proventos\b/i, href: '/agenda-proventos' },
  { pattern: /\bsimulador de carteiras\b|\bbacktest de carteiras?\b/i, href: '/backtest' },
]

/** Trechos que não podem ser tocados: links markdown, código inline e blocos de código. */
const PROTECTED = /(```[\s\S]*?```|`[^`\n]*`|\[[^\]\n]*\]\([^)\n]*\))/g

const SAFE_HREF = /^(\/(?!\/)|#|https?:\/\/|mailto:)/i

/** Remove tags HTML cruas (o markdown do Ben não usa HTML). "P/L < 10" continua intacto. */
export function stripHtml(text: string): string {
  return text.replace(/<\/?[a-zA-Z][^<>]*>/g, '')
}

/** Troca links com destino inseguro (javascript:, data:, //host) pelo próprio texto. */
export function sanitizeLinks(markdown: string): string {
  return markdown.replace(/\[([^\]\n]*)\]\(([^)\n]*)\)/g, (match, text: string, href: string) =>
    SAFE_HREF.test(href.trim()) ? match : text
  )
}

/** Liga a primeira menção de cada seção da plataforma, fora de links e código. */
export function linkPlatformSections(markdown: string): string {
  let text = markdown
  for (const { pattern, href } of SECTION_LINKS) {
    // Re-divide a cada link criado para que o próximo padrão não caia dentro dele.
    const parts = text.split(PROTECTED)
    // Índices pares são texto livre; os ímpares, os trechos protegidos capturados pelo split.
    for (let index = 0; index < parts.length; index += 2) {
      const match = parts[index].match(pattern)
      if (!match || match.index === undefined) continue
      const part = parts[index]
      parts[index] = `${part.slice(0, match.index)}[${match[0]}](${href})${part.slice(match.index + match[0].length)}`
      break
    }
    text = parts.join('')
  }
  return text
}

/** Pipeline completo aplicado à resposta do Ben. */
export function postProcessBenAnswer(markdown: string): string {
  if (!markdown) return markdown
  return linkPlatformSections(sanitizeLinks(stripHtml(markdown)))
}
