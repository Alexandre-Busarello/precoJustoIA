/**
 * Helpers puros do backtest (carteira de exemplo, máscara de valores em reais e regra de revisão da validação).
 * Sem dependência de React: usados pelo formulário, pela página e pelos testes.
 */

export type RebalanceFrequency = 'monthly' | 'quarterly' | 'yearly'

export interface BacktestAssetInput {
  ticker: string
  companyName?: string
  /** Fração da carteira (0,2 = 20%). */
  allocation: number
  /** DY médio anual como fração (0,085 = 8,5%). Vazio = sem proventos simulados. */
  averageDividendYield?: number
}

export interface BacktestConfigInput {
  name: string
  description?: string
  assets: BacktestAssetInput[]
  startDate: Date
  endDate: Date
  initialCapital: number
  monthlyContribution: number
  rebalanceFrequency: RebalanceFrequency
}

export const EXAMPLE_TICKERS = ['PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'BBAS3'] as const
export const EXAMPLE_YEARS = 5
export const EXAMPLE_INITIAL_CAPITAL = 10_000

/**
 * Carteira de exemplo que abre a ferramenta: 5 ações com pesos iguais, últimos 5 anos,
 * R$ 10.000 iniciais, sem aportes e rebalanceamento mensal. Datas no 1º dia do mês (a simulação é mensal).
 */
export function buildExampleConfig(now: Date = new Date()): BacktestConfigInput {
  const endDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const startDate = new Date(endDate.getFullYear() - EXAMPLE_YEARS, endDate.getMonth(), 1)
  const allocation = 1 / EXAMPLE_TICKERS.length
  return {
    name: 'Carteira de exemplo',
    description: 'Cinco ações da B3 com pesos iguais',
    assets: EXAMPLE_TICKERS.map((ticker) => ({ ticker, companyName: ticker, allocation })),
    startDate,
    endDate,
    initialCapital: EXAMPLE_INITIAL_CAPITAL,
    monthlyContribution: 0,
    rebalanceFrequency: 'monthly',
  }
}

const MAX_INTEGER_DIGITS = 9 // até R$ 999.999.999
const groupFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const centsFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Máscara de digitação para valores em reais: separador de milhar automático e até 2 casas após a vírgula.
 * `maskBRLInput('10000')` → `10.000`; `maskBRLInput('1500,5')` → `1.500,5`; letras e pontos digitados são ignorados.
 */
export function maskBRLInput(raw: string): string {
  const commaIndex = raw.indexOf(',')
  const hasComma = commaIndex !== -1
  const integerPart = hasComma ? raw.slice(0, commaIndex) : raw
  const decimalPart = hasComma ? raw.slice(commaIndex + 1) : ''

  const integerDigits = integerPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_INTEGER_DIGITS)
  const decimalDigits = decimalPart.replace(/\D/g, '').slice(0, 2)

  const integerFormatted = integerDigits ? groupFormat.format(Number(integerDigits)) : hasComma ? '0' : ''
  return hasComma ? `${integerFormatted},${decimalDigits}` : integerFormatted
}

/** Converte o texto mascarado em número: `'1.500,50'` → `1500.5`; vazio → `0`. */
export function parseBRLInput(masked: string): number {
  const normalized = masked.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : 0
}

/** Texto do campo a partir do valor: `10000` → `10.000`; `1500.5` → `1.500,50`. */
export function formatBRLInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  return Number.isInteger(value) ? groupFormat.format(value) : centsFormat.format(value)
}

/**
 * Data de configuração vinda da API (coluna DATE, serializada como meia-noite UTC) → data local do formulário.
 * `new Date('2021-09-01T00:00:00Z')` cairia em 31/08 no fuso de Brasília e o formulário mostraria agosto.
 */
export function dateFromApi(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** Meses inteiros entre duas datas mensais (jan → dez do mesmo ano = 11). */
export function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
}

/** Chave de mês (ano × 12 + mês) de uma data local do formulário. */
export function localMonthKey(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

/** Chave de mês de uma data vinda do banco (coluna DATE, meia-noite UTC). */
export function utcMonthKey(value: Date | string): number {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

interface ValidationSummary {
  isValid: boolean
  globalWarnings: string[]
  assetsAvailability: Array<{
    availableFrom: Date | string
    availableTo: Date | string
    missingMonths: number
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor'
    warnings: string[]
  }>
}

const COVERAGE_FROM_WARNING = /^Dados disponíveis apenas a partir de/
const COVERAGE_TO_WARNING = /^Dados disponíveis apenas até/

type AssetAvailability = ValidationSummary['assetsAvailability'][number]

/**
 * Avisos de um ativo que valem para o usuário. Os avisos de cobertura ("Dados disponíveis apenas a partir de/até")
 * são comparados por mês: as cotações mensais ficam no dia 1º à meia-noite UTC e a data do formulário é local,
 * então "dados até 31/08" (01/09 UTC exibido em Brasília) contra "fim em setembro" não é uma lacuna real.
 */
export function relevantAssetWarnings(
  asset: AssetAvailability,
  requested: { startDate: Date; endDate: Date }
): string[] {
  const coversStart = utcMonthKey(asset.availableFrom) <= localMonthKey(requested.startDate)
  const coversEnd = utcMonthKey(asset.availableTo) >= localMonthKey(requested.endDate)
  return asset.warnings.filter((warning) => {
    if (COVERAGE_FROM_WARNING.test(warning)) return !coversStart
    if (COVERAGE_TO_WARNING.test(warning)) return !coversEnd
    return true
  })
}

/**
 * A janela de revisão só abre quando há algo para o usuário decidir: dados insuficientes, avisos gerais,
 * meses faltantes, qualidade regular/ruim, histórico que não cobre os meses pedidos ou outros avisos do ativo.
 */
export function needsValidationReview(
  validation: ValidationSummary,
  requested: { startDate: Date; endDate: Date }
): boolean {
  if (!validation.isValid || validation.globalWarnings.length > 0) return true
  const startKey = localMonthKey(requested.startDate)
  const endKey = localMonthKey(requested.endDate)
  return validation.assetsAvailability.some((asset) => {
    if (asset.missingMonths > 0) return true
    if (asset.dataQuality === 'fair' || asset.dataQuality === 'poor') return true
    if (utcMonthKey(asset.availableFrom) > startKey || utcMonthKey(asset.availableTo) < endKey) return true
    return relevantAssetWarnings(asset, requested).length > 0
  })
}
