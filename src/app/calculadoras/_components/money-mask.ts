/**
 * Máscara de valores em reais enquanto o usuário digita (pt-BR).
 * - Aceita só dígitos e uma vírgula decimal (até 2 casas).
 * - Ponto como decimal (hábito de desktop/teclados Android): um "." digitado no fim do valor vira vírgula, e um valor
 *   colado como "10.50" (um único ponto seguido de 1-2 dígitos, sem vírgula) também. Nos demais casos o ponto é
 *   tratado como separador de milhar e ignorado.
 * - Agrupa a parte inteira com pontos: "10000,5" → "10.000,5".
 */

const MAX_INTEGER_DIGITS = 13

/**
 * Formata o texto digitado como valor em reais, sem o prefixo "R$".
 * `previous` é o texto mascarado anterior: permite saber se o usuário acabou de digitar um "." no fim
 * (decimal) ou apagou um dígito de "10.000" (continua milhar).
 */
export function maskBRL(raw: string, previous = ''): string {
  let input = raw
  if (!raw.includes(',')) {
    if (previous !== '' && raw === `${previous}.`) {
      input = `${previous},`
    } else if (raw.length > previous.length + 1 && /^\d+\.\d{1,2}$/.test(raw.trim())) {
      // Colado/autopreenchido em formato com ponto decimal.
      input = raw.replace('.', ',')
    }
  }
  const cleaned = input.replace(/[^\d,]/g, '')
  if (cleaned === '') return ''
  const commaIndex = cleaned.indexOf(',')
  const integerRaw = commaIndex === -1 ? cleaned : cleaned.slice(0, commaIndex)
  const decimalRaw = commaIndex === -1 ? null : cleaned.slice(commaIndex + 1).replace(/,/g, '').slice(0, 2)

  const integerDigits = integerRaw.replace(/^0+(?=\d)/, '').slice(0, MAX_INTEGER_DIGITS)
  const integer = (integerDigits === '' && decimalRaw !== null ? '0' : integerDigits).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimalRaw === null ? integer : `${integer},${decimalRaw}`
}

/** Converte o texto mascarado em número (`"10.000,50"` → `10000.5`). Vazio ou inválido → `null`. */
export function parseBRL(masked: string): number | null {
  const normalized = masked.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  if (normalized === '' || normalized === '.') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Valor numérico → texto mascarado (`10000.5` → `"10.000,50"`). */
export function toMaskedBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}
