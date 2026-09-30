import { marginOfSafety, VALUATION_STATUS_LABEL, VALUATION_STATUS_TONE, valuationStatus } from '@/lib/valuation-metrics'

/**
 * Registro tipado dos modelos de valuation exibidos na página de ativo.
 * A tabela de valuation renderiza qualquer chave deste registro presente no objeto `strategies` da API,
 * então novos modelos entram só com uma nova linha aqui.
 */

export type ValuationPlan = 'free' | 'premium'
export type ValuationAppliesTo = 'all' | 'financial' | 'nonFinancial'

export interface ValuationModel {
  key: string
  label: string
  shortLabel: string
  plan: ValuationPlan
  description: string
  appliesTo?: ValuationAppliesTo
}

/** Resultado de um modelo como a API `/api/company-analysis/[ticker]` devolve (upside em pontos percentuais). */
export interface StrategyResult {
  isEligible: boolean
  score: number
  fairValue: number | null
  upside: number | null
  reasoning: string
  criteria: { label: string; value: boolean; description: string }[]
  key_metrics?: Record<string, number | null>
}

export type StrategiesMap = Record<string, StrategyResult | null | undefined>

export const VALUATION_MODELS: ValuationModel[] = [
  {
    key: 'graham',
    label: 'Número de Graham',
    shortLabel: 'Graham',
    plan: 'free',
    description:
      'Preço justo pela fórmula de Benjamin Graham: raiz de 22,5 × LPA × VPA. Funciona melhor em empresas lucrativas e com patrimônio relevante.',
  },
  {
    key: 'fcd',
    label: 'Fluxo de caixa descontado',
    shortLabel: 'FCD',
    plan: 'premium',
    description: 'Valor presente dos fluxos de caixa livres projetados, descontados pelo custo de capital da empresa.',
  },
  {
    key: 'gordon',
    label: 'Gordon (dividendos)',
    shortLabel: 'Gordon',
    plan: 'premium',
    description:
      'Desconto de dividendos com crescimento constante. Indicado para empresas maduras e pagadoras, como bancos e elétricas.',
  },
  {
    key: 'dividendYield',
    label: 'Anti-armadilha de dividendos',
    shortLabel: 'Anti-armadilha',
    plan: 'premium',
    description:
      'Verifica se o dividend yield é sustentável (lucro, payout e endividamento) para evitar armadilhas de dividendos.',
  },
  {
    key: 'lowPE',
    label: 'P/L baixo com qualidade',
    shortLabel: 'P/L baixo',
    plan: 'premium',
    description: 'Empresas com P/L baixo que mantêm rentabilidade e crescimento, filtrando armadilhas de valor.',
  },
  {
    key: 'magicFormula',
    label: 'Fórmula Mágica',
    shortLabel: 'Fórmula Mágica',
    plan: 'premium',
    description: 'Método de Joel Greenblatt que combina retorno sobre o capital (ROIC) e preço baixo em relação ao lucro.',
  },
  {
    key: 'fundamentalist',
    label: 'Fundamentalista 3+1',
    shortLabel: '3+1',
    plan: 'premium',
    description: 'Avalia qualidade, preço, endividamento e dividendos com critérios adaptados ao setor da empresa.',
  },
  {
    key: 'barsi',
    label: 'Barsi',
    shortLabel: 'Barsi',
    plan: 'premium',
    description: 'Preço-teto pelo método de Luiz Barsi: dividendo médio dos últimos anos dividido pelo yield-alvo de 6%.',
  },
]

const MODEL_BY_KEY = new Map(VALUATION_MODELS.map((model) => [model.key, model]))

export function getValuationModel(key: string): ValuationModel | undefined {
  return MODEL_BY_KEY.get(key)
}

/** Modelos cujo resultado depende de dividendos (não se aplicam a empresas que reinvestem o lucro). */
export const DIVIDEND_MODEL_KEYS = new Set(['gordon', 'barsi', 'dividendYield'])

const FINANCIAL_TERMS = ['banco', 'segurad', 'seguros', 'previdência', 'financeir']

/** Bancos, seguradoras e demais financeiras (setor ou subsetor com esses termos). */
export function isFinancialCompany(sector?: string | null, industry?: string | null): boolean {
  const text = `${sector ?? ''} ${industry ?? ''}`.toLowerCase()
  return FINANCIAL_TERMS.some((term) => text.includes(term))
}

function applies(model: ValuationModel, isFinancial: boolean): boolean {
  if (!model.appliesTo || model.appliesTo === 'all') return true
  return model.appliesTo === 'financial' ? isFinancial : !isFinancial
}

/** Modelos do registro presentes em `strategies` e aplicáveis à empresa, na ordem do registro. */
export function getAvailableModels(strategies: StrategiesMap | null | undefined, isFinancial = false): ValuationModel[] {
  if (!strategies) return []
  return VALUATION_MODELS.filter((model) => strategies[model.key] != null && applies(model, isFinancial))
}

export interface ViewerAccess {
  /** Premium ou visitante com acesso completo liberado. */
  isPremium: boolean
  isLoggedIn: boolean
}

/** Premium bloqueado para quem não assina; o modelo gratuito exige conta (ou acesso completo). */
export function isModelLocked(model: ValuationModel, { isPremium, isLoggedIn }: ViewerAccess): boolean {
  if (isPremium) return false
  if (model.plan === 'premium') return true
  return !isLoggedIn
}

function hasFairValue(strategy: StrategyResult | null | undefined): strategy is StrategyResult & { fairValue: number } {
  return typeof strategy?.fairValue === 'number' && Number.isFinite(strategy.fairValue) && strategy.fairValue > 0
}

const DEFAULT_ORDER_FINANCIAL = ['barsi', 'graham', 'gordon', 'fcd']
const DEFAULT_ORDER_GENERAL = ['fcd', 'graham', 'barsi', 'gordon']

/**
 * Modelo exibido por padrão no cabeçalho: o mais adequado entre os liberados para o visitante e com preço justo.
 * Premium: Barsi (preço-teto por dividendos) para financeiras, FCD para as demais, com Graham como alternativa.
 * Free/anônimo: Graham.
 */
export function pickDefaultModel(
  strategies: StrategiesMap | null | undefined,
  { isFinancial = false, ...access }: ViewerAccess & { isFinancial?: boolean }
): string | null {
  const candidates = getAvailableModels(strategies, isFinancial).filter(
    (model) => !isModelLocked(model, access) && hasFairValue(strategies?.[model.key])
  )
  if (candidates.length === 0) return null
  const order = isFinancial ? DEFAULT_ORDER_FINANCIAL : DEFAULT_ORDER_GENERAL
  const preferred = order.find((key) => candidates.some((model) => model.key === key))
  return preferred ?? candidates[0].key
}

export function criteriaCount(strategy: StrategyResult | null | undefined): { passed: number; total: number } | null {
  if (!strategy?.criteria || strategy.criteria.length === 0) return null
  return { passed: strategy.criteria.filter((c) => c.value).length, total: strategy.criteria.length }
}

export type ModelStatusTone = 'positive' | 'warning' | 'negative' | 'neutral'

/**
 * Status de uma linha da tabela. Com preço justo, segue a margem de segurança (valuationStatus).
 * Sem preço justo (modelos de triagem), segue a proporção de critérios atendidos.
 */
const VALUATION_STATUS_SHORT: Record<'below' | 'within' | 'above', string> = {
  below: 'Abaixo',
  within: 'Na faixa',
  above: 'Acima',
}

/** Status da linha: `label` completo (desktop e leitores de tela) e `shortLabel` para telas estreitas. */
export function modelStatus(
  strategy: StrategyResult | null | undefined,
  price: number | null | undefined
): { tone: ModelStatusTone; label: string; shortLabel: string } {
  const margin = hasFairValue(strategy) ? marginOfSafety(price, strategy.fairValue) : null
  const status = valuationStatus(margin)
  if (status) {
    return { tone: VALUATION_STATUS_TONE[status], label: VALUATION_STATUS_LABEL[status], shortLabel: VALUATION_STATUS_SHORT[status] }
  }

  const count = criteriaCount(strategy)
  if (!strategy || !count) return { tone: 'neutral', label: 'Dados insuficientes', shortLabel: 'Sem dados' }
  if (strategy.isEligible) return { tone: 'positive', label: 'Atende aos critérios', shortLabel: 'Atende' }
  if (count.passed / count.total >= 0.5) return { tone: 'warning', label: 'Atende em parte', shortLabel: 'Em parte' }
  return { tone: 'negative', label: 'Não atende aos critérios', shortLabel: 'Não atende' }
}

/**
 * Score do modelo reduzido por falta de margem: a proporção de critérios atendidos
 * ficou ao menos 5 pontos acima do score final.
 */
export function adjustedScore(strategy: StrategyResult | null | undefined): { criteriaPct: number; score: number } | null {
  const count = criteriaCount(strategy)
  if (!strategy || !count) return null
  const criteriaPct = (count.passed / count.total) * 100
  return criteriaPct - strategy.score >= 5 ? { criteriaPct, score: strategy.score } : null
}

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]\s?/gu

/** Termos em inglês que alguns modelos ainda emitem. */
const ENGLISH_TERMS: Array<[RegExp, string]> = [
  [/\bLow P\/E\b/g, 'P/L baixo'],
  [/\bUpside\b/g, 'Potencial'],
  [/\bupside\b/g, 'potencial'],
]

/**
 * Número com ponto e sem vírgula: decimal em inglês ("12.5", "45.30") vira vírgula; milhar pt-BR
 * ("1.234", "45.000", "1.234.567") fica como está. Com vírgula já é pt-BR ("1.234,56").
 */
function localizeNumberToken(token: string): string {
  if (token.includes(',')) return token
  const parts = token.split('.')
  if (parts.length !== 2) return token
  const [integer, fraction] = parts
  const looksLikeThousands = fraction.length === 3 && integer.length <= 3 && !integer.startsWith('0')
  return looksLikeThousands ? token : `${integer},${fraction}`
}

/**
 * Ajusta textos gerados pelos modelos para a UI: remove emoji, "N/A" vira travessão, termos em inglês
 * comuns ("Upside", "Low P/E") viram pt-BR e decimais com ponto ("12.5%", "R$ 45.30") passam a usar
 * vírgula. Números já em pt-BR ("R$ 1.234,56", "R$ 1.234") ficam intactos.
 */
export function localizeStrategyText(text: string | null | undefined): string {
  if (!text) return ''
  let out = text.replace(EMOJI, '').replace(/\bN\/A\b/g, '—')
  for (const [pattern, replacement] of ENGLISH_TERMS) out = out.replace(pattern, replacement)
  return out.replace(/\d+(?:\.\d+)+(?:,\d+)?/g, localizeNumberToken)
}
