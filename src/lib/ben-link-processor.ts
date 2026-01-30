/**
 * Processador de links para mensagens do Ben
 * Detecta menções de tickers/empresas e cria links markdown automaticamente
 */

/**
 * Padrão regex para detectar tickers brasileiros
 * Formato: 4 letras maiúsculas + 1-2 dígitos (ex: PETR4, VALE3, ITUB4)
 */
const TICKER_PATTERN = /\b([A-Z]{4}\d{1,2})\b/g

/**
 * Padrão para detectar links markdown já existentes
 * Evita criar links duplicados
 * Captura links completos incluindo links aninhados
 */
const MARKDOWN_LINK_PATTERN = /\[([^\]]*\[[^\]]*\][^\]]*|[^\]]+)\]\([^\)]+\)/g

/**
 * Protege links markdown para não serem afetados por outros processamentos
 * Melhora a detecção de links mesmo quando estão dentro de parênteses
 */
function protectMarkdownLinks(text: string): { protectedText: string; placeholders: Array<{ placeholder: string; original: string }> } {
  if (!text || typeof text !== 'string') {
    return { protectedText: text, placeholders: [] }
  }
  
  const placeholders: Array<{ placeholder: string; original: string }> = []
  let placeholderIndex = 0
  let protectedText = text
  
  // Proteger links markdown - usar regex mais robusto que captura links mesmo dentro de parênteses
  // O padrão precisa capturar [texto](url) mesmo quando há parênteses ao redor
  // Usar lookahead negativo para evitar capturar parênteses que não fazem parte do link
  const linkPattern = /\[([^\]]+)\]\(([^\)]+)\)/g
  let match
  const matches: Array<{ fullMatch: string; start: number; end: number }> = []
  
  // Primeiro, coletar todos os matches com suas posições
  while ((match = linkPattern.exec(text)) !== null) {
    matches.push({
      fullMatch: match[0],
      start: match.index,
      end: match.index + match[0].length
    })
  }
  
  // Processar de trás para frente para manter índices corretos
  for (let i = matches.length - 1; i >= 0; i--) {
    const { fullMatch, start, end } = matches[i]
    const placeholder = `__PLACEHOLDER_LINK_${placeholderIndex}__`
    placeholders.push({ placeholder, original: fullMatch })
    protectedText = protectedText.substring(0, start) + placeholder + protectedText.substring(end)
    placeholderIndex++
  }
  
  return { protectedText, placeholders }
}

/**
 * Restaura links markdown protegidos
 */
function restoreMarkdownLinks(text: string, placeholders: Array<{ placeholder: string; original: string }>): string {
  let restored = text
  
  // Restaurar na ordem inversa para evitar problemas com placeholders aninhados
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const { placeholder, original } = placeholders[i]
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    restored = restored.replace(new RegExp(escapedPlaceholder, 'g'), original)
  }
  
  return restored
}

/**
 * Remove links duplicados onde o mesmo ticker aparece múltiplas vezes
 * Exemplo: ([[TEND3](/acao/TEND3)](/acao/[TEND3](/acao/TEND3))) -> ([TEND3](/acao/TEND3))
 */
function removeDuplicateLinks(text: string): string {
  let result = text
  
  // Padrão específico: ([[TICKER](/acao/TICKER)](/acao/[TICKER](/acao/TICKER)))
  // Captura quando há um link aninhado seguido de outro link com mesmo ticker
  // Regex mais simples que captura o padrão completo
  // Estrutura: ([[TICKER](...)](.../[TICKER](...)))
  const duplicatePattern = /\(\[\[([A-Z]{4}\d{1,2})\]\([^\)]+\)\]\([^\)]*\/acao\/\[([A-Z]{4}\d{1,2})\]\([^\)]+\)\)\)/g
  
  result = result.replace(duplicatePattern, (match, ticker1, ticker2) => {
    // Se ambos os tickers são iguais, manter apenas um link simples
    if (ticker1 === ticker2) {
      return `([${ticker1}](/acao/${ticker1}))`
    }
    return match
  })
  
  return result
}

/**
 * Processa texto e cria links markdown para tickers mencionados
 * 
 * @param content - Texto a ser processado
 * @returns Texto com links markdown adicionados
 */
export function processBenMessageLinks(content: string): string {
  if (!content || typeof content !== 'string') {
    return content
  }

  // Proteger links markdown antes de qualquer processamento
  const { protectedText: protectedContent, placeholders } = protectMarkdownLinks(content)

  // Normalizar listas markdown (converter * para - para compatibilidade)
  // O modelo pode gerar * mas o markdown padrão usa -
  // Também garantir que há espaço após o marcador
  let processedContent = protectedContent
    .replace(/^(\s*)\*\s+/gm, '$1- ')  // Converter * para -
    .replace(/^(\s*)-([^\s-])/gm, '$1- $2')  // Garantir espaço após -
    .replace(/^(\s*)\d+\.([^\s])/gm, (match, indent, rest) => {
      // Garantir espaço após número seguido de ponto
      const numMatch = match.match(/^(\s*)(\d+)\./)
      if (numMatch) {
        return `${numMatch[1]}${numMatch[2]}. ${rest}`
      }
      return match
    })

  // Encontrar todos os links markdown existentes (incluindo links aninhados)
  const linkRanges: Array<{ start: number; end: number }> = []
  let match
  const linkPattern = /\[([^\]]*\[[^\]]*\][^\]]*|[^\]]+)\]\([^\)]+\)/g
  
  while ((match = linkPattern.exec(processedContent)) !== null) {
    linkRanges.push({
      start: match.index,
      end: match.index + match[0].length
    })
  }

  // Resetar regex
  linkPattern.lastIndex = 0

  // Criar função para verificar se um índice está dentro de um link
  const isInsideLink = (index: number): boolean => {
    return linkRanges.some(range => index >= range.start && index < range.end)
  }

  // Encontrar todos os tickers no texto que NÃO estão dentro de links
  const tickerMatches: Array<{ ticker: string; index: number; length: number }> = []
  
  while ((match = TICKER_PATTERN.exec(processedContent)) !== null) {
    const ticker = match[1].toUpperCase()
    const matchIndex = match.index
    
    // Verificar se o ticker está dentro de um link markdown existente
    // Não usar Set para permitir processar o mesmo ticker múltiplas vezes se não estiver dentro de links
    if (!isInsideLink(matchIndex)) {
      tickerMatches.push({
        ticker,
        index: matchIndex,
        length: match[0].length
      })
    }
  }

  // Processar de trás para frente para manter índices corretos
  tickerMatches.reverse().forEach(({ ticker, index, length }) => {
    const before = processedContent.substring(0, index)
    const after = processedContent.substring(index + length)

    // Criar link markdown
    const linkUrl = `/acao/${ticker}`
    const linkMarkdown = `[${ticker}](${linkUrl})`

    processedContent = before + linkMarkdown + after
  })

  // Limpar links duplicados/aninhados que possam ter sido criados pelo modelo
  // Exemplo: [[SAPR4](/acao/SAPR4)](/acao/SAPR4) -> [SAPR4](/acao/SAPR4)
  // Também limpar casos como [[TICKER](/acao/TICKER)](/acao/TICKER)
  processedContent = processedContent.replace(/\[\[([A-Z]{4}\d{1,2})\]\([^\)]+\)\]\([^\)]+\)/g, '[$1](/acao/$1)')
  
  // Limpar links aninhados mais complexos recursivamente
  // Exemplo: [[SAPR4](/acao/SAPR4)](/acao/SAPR4) -> [SAPR4](/acao/SAPR4)
  // Também limpar casos como (([NIKE34](/acao/NIKE34))) -> ([NIKE34](/acao/NIKE34))
  // E casos como ([[TEND3](/acao/TEND3)](/acao/[TEND3](/acao/TEND3))) -> ([TEND3](/acao/TEND3))
  let previousContent = ''
  let iterations = 0
  const maxIterations = 10 // Prevenir loops infinitos
  
  while (previousContent !== processedContent && iterations < maxIterations) {
    previousContent = processedContent
    
    // Remover links aninhados: [link] dentro de [link]
    processedContent = processedContent.replace(/\[(\[[^\]]+\]\([^\)]+\))\]\([^\)]+\)/g, '$1')
    
    // Remover parênteses duplicados ao redor de links: (([TICKER](/acao/TICKER))) -> ([TICKER](/acao/TICKER))
    processedContent = processedContent.replace(/\(\(\[([A-Z]{4}\d{1,2})\]\([^\)]+\)\)\)/g, '([$1](/acao/$1))')
    
    // Remover links duplicados com mesmo ticker: ([TICKER](/acao/TICKER))](/acao/TICKER) -> ([TICKER](/acao/TICKER))
    processedContent = processedContent.replace(/\(\[([A-Z]{4}\d{1,2})\]\([^\)]+\)\)\]\([^\)]*\/acao\/\1[^\)]*\)/g, '([$1](/acao/$1))')
    
    // Remover casos como ([[TICKER](/acao/TICKER)](/acao/[TICKER](/acao/TICKER))) -> ([TICKER](/acao/TICKER))
    // Este padrão captura quando há um link aninhado seguido de outro link com o mesmo ticker na URL
    // Exemplo: ([[TEND3](/acao/TEND3)](/acao/[TEND3](/acao/TEND3))) -> ([TEND3](/acao/TEND3))
    processedContent = processedContent.replace(/\(\[\[([A-Z]{4}\d{1,2})\]\([^\)]+\)\]\([^\)]*\/acao\/\[([A-Z]{4}\d{1,2})\]\([^\)]*\/acao\/\2[^\)]*\)\)\)/g, '([$1](/acao/$1))')
    
    iterations++
  }
  
  // Usar função auxiliar para remover links duplicados de forma mais robusta
  processedContent = removeDuplicateLinks(processedContent)

  // Restaurar links markdown protegidos
  processedContent = restoreMarkdownLinks(processedContent, placeholders)

  return processedContent
}

/**
 * Valida se um ticker tem formato válido
 */
export function isValidTicker(ticker: string): boolean {
  return TICKER_PATTERN.test(ticker.toUpperCase())
}

