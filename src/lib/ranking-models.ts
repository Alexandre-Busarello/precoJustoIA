/**
 * Registro tipado dos modelos de ranking exibidos em /ranking.
 *
 * A UI (seletor de modelo, painel de parâmetros, coluna de score e preço justo) é montada só a partir
 * deste registro: um modelo novo precisa apenas de uma entrada aqui e do suporte correspondente na API
 * (`/api/rank-builder` para ações e FIIs, `/api/etf-ranking` para ETFs).
 *
 * Unidades dos parâmetros: percentuais são **frações** (0,2 = 20%), como a API espera.
 *
 * Também concentra as regras de liquidez dos rankings (puras, usadas pela API e pela UI): exclusão de ativos
 * abaixo do volume mínimo e deduplicação das classes de ações da mesma empresa.
 */

import { LIQUIDITY_DEFAULTS, isIlliquid, toLiquidityAssetType } from '@/lib/finance/liquidity-rules'

export type RankingAssetType = 'stock' | 'fii' | 'etf' | 'bdr'
export type RankingPlan = 'free' | 'premium'

/** Universo escolhido no seletor "Classe de ativo" (é o `assetTypeFilter` enviado à API). */
export type RankingUniverse = 'b3' | 'bdr' | 'both' | 'fii' | 'etf'

export type RankingParamValue = string | number | boolean
export type RankingParams = Record<string, unknown>

/** Formato do valor de um parâmetro numérico. */
export type RankingParamUnit = 'pct' | 'multiple' | 'number' | 'brl'

interface RankingFieldBase {
  key: string
  label: string
  hint?: string
}

export interface RankingSliderField extends RankingFieldBase {
  kind: 'slider'
  unit: RankingParamUnit
  min: number
  max: number
  step: number
}

export interface RankingSelectField extends RankingFieldBase {
  kind: 'select'
  options: Array<{ value: string | number; label: string }>
}

export interface RankingSwitchField extends RankingFieldBase {
  kind: 'switch'
}

export type RankingParamField = RankingSliderField | RankingSelectField | RankingSwitchField

export interface RankingModel {
  key: string
  label: string
  plan: RankingPlan
  assetType: RankingAssetType
  /** Uma frase: o que o modelo procura. */
  description: string
  /** Modelos com IA nunca rodam automaticamente (custo e tempo de execução). */
  isAi?: boolean
  /**
   * O tamanho do resultado depende do plano de quem pede (ex.: ETFs: 10 no gratuito, lista completa no Premium).
   * A prévia automática desses modelos precisa levar a sessão quando o usuário é Premium.
   */
  planLimitedResults?: boolean
  /** Parâmetros editáveis no painel. */
  fields: RankingParamField[]
  /** Parâmetros iniciais (inclui os fixos, que não aparecem no painel). */
  defaults: (universe: RankingUniverse) => RankingParams
  /** Métrica de `key_metrics` exibida na coluna Score. */
  score?: { key: string; label: string; format: 'score' | 'pct' }
  /** Métrica de `key_metrics` usada como preço de referência no lugar de `fairValue` (ex.: preço-teto). */
  fairValueKey?: string
  /** Rótulo da coluna de preço de referência (padrão "Preço justo"). */
  fairValueLabel?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Campos reutilizados
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY_SIZE: RankingSelectField = {
  kind: 'select',
  key: 'companySize',
  label: 'Tamanho da empresa',
  options: [
    { value: 'all', label: 'Todas as empresas' },
    { value: 'small_caps', label: 'Small caps (até R$ 2 bi)' },
    { value: 'mid_caps', label: 'Médias (R$ 2 bi a R$ 10 bi)' },
    { value: 'blue_chips', label: 'Large caps (acima de R$ 10 bi)' },
  ],
}

const TECHNICAL: RankingSwitchField = {
  kind: 'switch',
  key: 'useTechnicalAnalysis',
  label: 'Priorizar ativos em sobrevenda',
  hint: 'Reordena o resultado pelo RSI e pelo estocástico: ativos em sobrevenda aparecem primeiro. Não altera os critérios do modelo.',
}

const TIPO_FII: RankingSelectField = {
  kind: 'select',
  key: 'tipoFii',
  label: 'Tipo de FII',
  options: [
    { value: 'both', label: 'Tijolo e papel' },
    { value: 'tijolo', label: 'Só tijolo' },
    { value: 'papel', label: 'Só papel' },
  ],
  hint: 'FIIs de tijolo têm imóveis físicos; os de papel investem em CRIs e outros títulos.',
}

function fiiLiquidityField(): RankingSelectField {
  return {
    kind: 'select',
    key: 'minLiquidity',
    label: 'Liquidez diária mínima',
    options: [
      { value: 100_000, label: 'R$ 100 mil' },
      { value: 300_000, label: 'R$ 300 mil' },
      { value: 500_000, label: 'R$ 500 mil' },
      { value: 1_000_000, label: 'R$ 1 mi' },
      { value: 5_000_000, label: 'R$ 5 mi' },
    ],
    hint: 'Volume médio negociado por dia. Mais liquidez facilita comprar e vender cotas.',
  }
}

const isBdr = (universe: RankingUniverse) => universe === 'bdr'

/** Parâmetros comuns aos modelos de ações. A priorização técnica fica desligada por padrão. */
function stockBase(): RankingParams {
  return { companySize: 'all', useTechnicalAnalysis: false }
}

function etfPreset(key: string, label: string, description: string): RankingModel {
  return {
    key,
    label,
    plan: 'free',
    assetType: 'etf',
    description,
    planLimitedResults: true,
    fields: [],
    defaults: () => ({}),
    score: { key: 'etfScore', label: 'Score', format: 'score' },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registro
// ─────────────────────────────────────────────────────────────────────────────

export const RANKING_MODELS: RankingModel[] = [
  {
    key: 'graham',
    label: 'Número de Graham',
    plan: 'free',
    assetType: 'stock',
    description: 'Preço justo pela fórmula de Graham (√(22,5 × LPA × VPA)), ordenado por um score de margem de segurança e qualidade.',
    fields: [
      COMPANY_SIZE,
      {
        kind: 'slider',
        key: 'marginOfSafety',
        label: 'Margem de segurança mínima',
        unit: 'pct',
        min: 0.05,
        max: 0.5,
        step: 0.05,
        hint: 'Quanto o preço precisa estar abaixo do preço justo (1 − preço ÷ preço justo).',
      },
      TECHNICAL,
    ],
    defaults: (universe) => ({ ...stockBase(), marginOfSafety: isBdr(universe) ? 0.15 : 0.2 }),
    score: { key: 'qualityScore', label: 'Score', format: 'score' },
  },
  {
    key: 'dividendYield',
    label: 'Anti-armadilha de dividendos',
    plan: 'premium',
    assetType: 'stock',
    description: 'Dividend yield médio alto com filtros de sustentabilidade que descartam yields inflados por queda de preço.',
    fields: [
      COMPANY_SIZE,
      { kind: 'slider', key: 'minYield', label: 'Dividend yield mínimo', unit: 'pct', min: 0.02, max: 0.12, step: 0.005 },
      TECHNICAL,
    ],
    defaults: (universe) => ({ ...stockBase(), minYield: isBdr(universe) ? 0.025 : 0.04 }),
    score: { key: 'sustainabilityScore', label: 'Score', format: 'score' },
  },
  {
    key: 'lowPE',
    label: 'P/L baixo com qualidade',
    plan: 'premium',
    assetType: 'stock',
    description: 'P/L baixo combinado com médias históricas de ROE, margem e crescimento para evitar armadilhas de valor.',
    fields: [
      COMPANY_SIZE,
      { kind: 'slider', key: 'maxPE', label: 'P/L máximo', unit: 'multiple', min: 5, max: 30, step: 1 },
      { kind: 'slider', key: 'minROE', label: 'ROE mínimo', unit: 'pct', min: 0.05, max: 0.25, step: 0.01 },
      TECHNICAL,
    ],
    defaults: (universe) => ({ ...stockBase(), maxPE: isBdr(universe) ? 25 : 12, minROE: 0.12 }),
    score: { key: 'valueScore', label: 'Score', format: 'score' },
  },
  {
    key: 'magicFormula',
    label: 'Fórmula Mágica',
    plan: 'premium',
    assetType: 'stock',
    description: 'Método de Joel Greenblatt: combina retorno sobre o capital (ROIC) e earnings yield.',
    fields: [
      COMPANY_SIZE,
      TECHNICAL,
    ],
    defaults: () => ({ ...stockBase(), limit: 10 }),
    score: { key: 'magicScore', label: 'Score', format: 'score' },
  },
  {
    key: 'fcd',
    label: 'Fluxo de caixa descontado',
    plan: 'premium',
    assetType: 'stock',
    description: 'Valor intrínseco pela projeção do fluxo de caixa livre da firma, descontado pelo custo de capital.',
    fields: [
      COMPANY_SIZE,
      {
        kind: 'slider',
        key: 'growthRate',
        label: 'Crescimento perpétuo',
        unit: 'pct',
        min: 0.04,
        max: 0.05,
        step: 0.005,
        hint: 'Crescimento nominal em reais depois dos anos de projeção. O modelo aceita de 4% a 5% ao ano (BDRs com balanço em dólar usam 2,5% fixo).',
      },
      {
        kind: 'slider',
        key: 'discountRate',
        label: 'Taxa de desconto (WACC)',
        unit: 'pct',
        min: 0.05,
        max: 0.2,
        step: 0.005,
        hint: 'Só vale quando é maior que o custo de capital calculado pelas premissas macro.',
      },
      { kind: 'slider', key: 'yearsProjection', label: 'Anos de projeção', unit: 'number', min: 3, max: 10, step: 1 },
      {
        kind: 'slider',
        key: 'minMarginOfSafety',
        label: 'Margem de segurança mínima',
        unit: 'pct',
        min: 0.1,
        max: 0.5,
        step: 0.05,
        hint: 'Quanto o preço precisa estar abaixo do preço justo (1 − preço ÷ preço justo).',
      },
      TECHNICAL,
    ],
    defaults: (universe) => ({
      ...stockBase(),
      // O FCD limita o crescimento perpétuo a 4%–5% (BRL): 4% é o mesmo resultado dos antigos 2,5%/3%.
      growthRate: 0.04,
      discountRate: isBdr(universe) ? 0.12 : 0.1,
      yearsProjection: 5,
      minMarginOfSafety: isBdr(universe) ? 0.1 : 0.15,
      limit: 10,
    }),
    score: { key: 'fcdQualityScore', label: 'Score', format: 'score' },
  },
  {
    key: 'gordon',
    label: 'Gordon',
    plan: 'premium',
    assetType: 'stock',
    description: 'Preço justo pelo modelo de dividendos de Gordon, com taxas calibradas por setor.',
    fields: [
      COMPANY_SIZE,
      {
        kind: 'slider',
        key: 'discountRate',
        label: 'Taxa de desconto',
        unit: 'pct',
        min: 0.05,
        max: 0.2,
        step: 0.005,
        hint: 'Só vale quando é maior que o custo de capital calculado pelas premissas macro (nunca abaixo da Selic).',
      },
      {
        kind: 'slider',
        key: 'dividendGrowthRate',
        label: 'Teto do crescimento dos dividendos',
        unit: 'pct',
        min: 0,
        max: 0.1,
        step: 0.005,
        hint: 'O crescimento usado é o menor entre este teto, ROE × (1 − payout) e 6%.',
      },
      {
        kind: 'switch',
        key: 'useSectoralAdjustment',
        label: 'Ajuste setorial automático',
        hint: 'Ajusta a taxa de desconto e o crescimento conforme o setor da empresa.',
      },
      TECHNICAL,
    ],
    defaults: (universe) => ({
      ...stockBase(),
      discountRate: isBdr(universe) ? 0.12 : 0.11,
      dividendGrowthRate: isBdr(universe) ? 0.05 : 0.04,
      useSectoralAdjustment: true,
      sectoralWaccAdjustment: 0,
      limit: 10,
    }),
    score: { key: 'compositeScore', label: 'Score', format: 'score' },
  },
  {
    key: 'fundamentalist',
    label: 'Fundamentalista 3+1',
    plan: 'premium',
    assetType: 'stock',
    description: 'Três indicadores essenciais (qualidade, preço e endividamento) adaptados ao perfil da empresa, com bônus de dividendos.',
    fields: [
      COMPANY_SIZE,
      {
        kind: 'slider',
        key: 'minROE',
        label: 'ROE mínimo',
        unit: 'pct',
        min: 0.1,
        max: 0.3,
        step: 0.01,
        hint: 'ROE que dá a nota máxima de qualidade a empresas sem dívida relevante. Abaixo de 5%, a empresa sai.',
      },
      {
        kind: 'slider',
        key: 'minROIC',
        label: 'ROIC mínimo',
        unit: 'pct',
        min: 0.1,
        max: 0.3,
        step: 0.01,
        hint: 'ROIC que dá a nota máxima de qualidade a empresas com dívida. Abaixo de 5%, a empresa sai.',
      },
      { kind: 'slider', key: 'maxDebtToEbitda', label: 'Dív. líq./EBITDA máxima', unit: 'multiple', min: 1, max: 6, step: 0.5 },
      {
        kind: 'slider',
        key: 'minPayout',
        label: 'Payout mínimo',
        unit: 'pct',
        min: 0.2,
        max: 0.8,
        step: 0.05,
        hint: 'Payout dentro da faixa, com DY ≥ 4%, dá o bônus máximo de dividendos.',
      },
      { kind: 'slider', key: 'maxPayout', label: 'Payout máximo', unit: 'pct', min: 0.4, max: 1, step: 0.05 },
      TECHNICAL,
    ],
    defaults: (universe) => ({
      ...stockBase(),
      minROE: 0.15,
      minROIC: 0.15,
      maxDebtToEbitda: isBdr(universe) ? 4 : 3,
      minPayout: isBdr(universe) ? 0.3 : 0.4,
      maxPayout: isBdr(universe) ? 0.9 : 0.8,
      limit: 10,
    }),
    score: { key: 'fundamentalistScore', label: 'Score', format: 'score' },
  },
  {
    key: 'barsi',
    label: 'Barsi',
    plan: 'premium',
    assetType: 'stock',
    description: 'Dividendos em setores perenes (B.E.S.T.), com o mesmo preço-teto do método Bazin: proventos médios ÷ dividend yield alvo.',
    fields: [
      COMPANY_SIZE,
      { kind: 'slider', key: 'targetDividendYield', label: 'Dividend yield alvo', unit: 'pct', min: 0.03, max: 0.1, step: 0.005 },
      {
        kind: 'slider',
        key: 'maxPriceToPayMultiplier',
        label: 'Multiplicador do preço-teto',
        unit: 'multiple',
        min: 0.8,
        max: 1.5,
        step: 0.1,
      },
      {
        kind: 'slider',
        key: 'minConsecutiveDividends',
        label: 'Anos com dividendos',
        unit: 'number',
        min: 1,
        max: 10,
        step: 1,
        hint: 'Janela de anos analisada: exige dividend yield acima de 1% em 80% deles, arredondado para baixo (2 de 3 no padrão).',
      },
      { kind: 'slider', key: 'maxDebtToEquity', label: 'Dív. líq./PL máxima', unit: 'multiple', min: 0.5, max: 2, step: 0.1 },
      { kind: 'slider', key: 'minROE', label: 'ROE mínimo', unit: 'pct', min: 0.05, max: 0.25, step: 0.01 },
      {
        kind: 'switch',
        key: 'focusOnBEST',
        label: 'Só setores perenes',
        hint: 'Bancos e serviços financeiros, energia, saneamento e utilidade pública, seguros, telecomunicações e gás.',
      },
      TECHNICAL,
    ],
    defaults: (universe) => ({
      ...stockBase(),
      targetDividendYield: isBdr(universe) ? 0.03 : 0.06,
      maxPriceToPayMultiplier: 1,
      minConsecutiveDividends: 3,
      maxDebtToEquity: isBdr(universe) ? 1.5 : 1,
      minROE: isBdr(universe) ? 0.12 : 0.1,
      focusOnBEST: true,
      limit: 10,
    }),
    score: { key: 'barsiScore', label: 'Score', format: 'score' },
    fairValueKey: 'ceilingPrice',
    fairValueLabel: 'Preço-teto',
  },
  {
    key: 'bazin',
    label: 'Bazin (preço-teto)',
    plan: 'premium',
    assetType: 'stock',
    description:
      'Preço-teto de Décio Bazin: média dos proventos brutos dos últimos 5 anos completos, sem extraordinários, dividida pelo dividend yield alvo, com dívida baixa e lucros consistentes.',
    fields: [
      COMPANY_SIZE,
      { kind: 'slider', key: 'targetDividendYield', label: 'Dividend yield alvo', unit: 'pct', min: 0.04, max: 0.12, step: 0.005 },
      {
        kind: 'slider',
        key: 'maxDebtToEquity',
        label: 'Dív. líq./PL máxima',
        unit: 'multiple',
        min: 0.2,
        max: 1.5,
        step: 0.1,
        hint: 'Não vale para bancos e seguradoras, avaliados por ROE médio e payout.',
      },
      TECHNICAL,
    ],
    defaults: () => ({ ...stockBase(), targetDividendYield: 0.06, maxDebtToEquity: 0.5, yearsForAverage: 5 }),
    score: { key: 'dividendYield', label: 'DY médio', format: 'pct' },
    fairValueKey: 'ceilingPrice',
    fairValueLabel: 'Preço-teto',
  },
  {
    key: 'lynch',
    label: 'Peter Lynch (PEG)',
    plan: 'premium',
    assetType: 'stock',
    description:
      'PEG de Peter Lynch: P/L dividido pelo crescimento dos lucros, com P/L de referência = crescimento + dividend yield. Bancos e commodities cíclicas ficam de fora.',
    fields: [
      COMPANY_SIZE,
      { kind: 'slider', key: 'maxPeg', label: 'PEG máximo', unit: 'multiple', min: 0.3, max: 2, step: 0.1 },
      TECHNICAL,
    ],
    defaults: () => ({ ...stockBase(), maxPeg: 1, maxGrowthRate: 0.25 }),
  },
  {
    key: 'ai',
    label: 'Síntese com IA',
    plan: 'premium',
    assetType: 'stock',
    isAi: true,
    description: 'Estimativa gerada por IA que combina os modelos quantitativos. Leva alguns minutos e pode variar entre execuções.',
    fields: [COMPANY_SIZE, TECHNICAL],
    defaults: () => ({
      ...stockBase(),
      riskTolerance: 'Moderado',
      timeHorizon: 'Longo Prazo',
      focus: 'Crescimento e Valor',
      limit: 10,
    }),
    score: { key: 'compositeScore', label: 'Score', format: 'score' },
  },
  {
    key: 'fiiDividendYield',
    label: 'Maior dividend yield (FIIs)',
    plan: 'free',
    assetType: 'fii',
    description: 'FIIs ordenados pelo dividend yield, com limites de P/VP e liquidez para reduzir armadilhas.',
    fields: [
      TIPO_FII,
      { kind: 'slider', key: 'minYield', label: 'Dividend yield mínimo', unit: 'pct', min: 0.04, max: 0.14, step: 0.005 },
      { kind: 'slider', key: 'maxPvp', label: 'P/VP máximo', unit: 'multiple', min: 0.5, max: 1.5, step: 0.05 },
      fiiLiquidityField(),
    ],
    defaults: () => ({ tipoFii: 'both', minYield: 0.08, maxPvp: 1.1, minLiquidity: 500_000, assetTypeFilter: 'fii', limit: 50 }),
    score: { key: 'dy', label: 'DY', format: 'pct' },
  },
  {
    key: 'fiiRanking',
    label: 'Ranking PJ-FII',
    plan: 'premium',
    assetType: 'fii',
    description: 'Score próprio de 0 a 100 com cinco pilares: dividendos, valuation, qualidade do portfólio, liquidez e segmento e resiliência.',
    fields: [
      TIPO_FII,
      { kind: 'slider', key: 'minScore', label: 'Score mínimo', unit: 'number', min: 40, max: 90, step: 5 },
      fiiLiquidityField(),
    ],
    defaults: () => ({ tipoFii: 'both', minScore: 55, minLiquidity: 1_000_000, companySize: 'all', assetTypeFilter: 'fii', limit: 30 }),
    score: { key: 'pjFiiScore', label: 'Score', format: 'score' },
  },
  etfPreset(
    'etfs-melhor-score-geral',
    'Maior score (ETFs)',
    'ETFs com maior score composto: custo, retorno, liquidez, patrimônio, qualidade da carteira e análise qualitativa.'
  ),
  etfPreset('etfs-menor-taxa-administracao', 'Menor taxa de administração', 'ETFs com score a partir de 40, ordenados pela menor taxa de administração.'),
  etfPreset('etfs-maior-retorno-1a', 'Maior retorno em 12 meses', 'ETFs com maior retorno em 12 meses (retorno de 6 meses anualizado quando falta histórico).'),
  etfPreset('etfs-renda-fixa', 'Renda fixa (Selic e IPCA)', 'ETFs cujo índice de referência é Selic, IPCA, IRF-M ou IMA.'),
]

// ─────────────────────────────────────────────────────────────────────────────
// Universos e helpers
// ─────────────────────────────────────────────────────────────────────────────

export const RANKING_UNIVERSES: Array<{ value: RankingUniverse; label: string }> = [
  { value: 'b3', label: 'Ações B3' },
  { value: 'bdr', label: 'BDRs' },
  { value: 'both', label: 'Ações e BDRs' },
  { value: 'fii', label: 'FIIs' },
  { value: 'etf', label: 'ETFs' },
]

export const DEFAULT_RANKING_UNIVERSE: RankingUniverse = 'b3'
export const DEFAULT_RANKING_MODEL = 'graham'

/** Tipos de modelo aceitos em cada universo. */
const UNIVERSE_ASSET_TYPES: Record<RankingUniverse, RankingAssetType[]> = {
  b3: ['stock'],
  bdr: ['stock', 'bdr'],
  both: ['stock', 'bdr'],
  fii: ['fii'],
  etf: ['etf'],
}

/** Modelo aberto quando o usuário troca de universo e o modelo atual não se aplica. */
const UNIVERSE_DEFAULT_MODEL: Record<RankingUniverse, string> = {
  b3: DEFAULT_RANKING_MODEL,
  bdr: DEFAULT_RANKING_MODEL,
  both: DEFAULT_RANKING_MODEL,
  fii: 'fiiDividendYield',
  etf: 'etfs-melhor-score-geral',
}

export function isRankingUniverse(value: unknown): value is RankingUniverse {
  return RANKING_UNIVERSES.some((u) => u.value === value)
}

export function getRankingModel(key: string | null | undefined): RankingModel | undefined {
  if (!key) return undefined
  return RANKING_MODELS.find((m) => m.key === key)
}

export function modelsForUniverse(universe: RankingUniverse): RankingModel[] {
  const types = UNIVERSE_ASSET_TYPES[universe]
  return RANKING_MODELS.filter((m) => types.includes(m.assetType))
}

export function isModelInUniverse(model: RankingModel, universe: RankingUniverse): boolean {
  return UNIVERSE_ASSET_TYPES[universe].includes(model.assetType)
}

export function defaultModelForUniverse(universe: RankingUniverse): RankingModel {
  return getRankingModel(UNIVERSE_DEFAULT_MODEL[universe]) ?? RANKING_MODELS[0]
}

/** Universo natural de um modelo (usado em links como `/ranking?model=fiiRanking`). */
export function universeForModel(model: RankingModel, preferred: RankingUniverse = DEFAULT_RANKING_UNIVERSE): RankingUniverse {
  if (isModelInUniverse(model, preferred)) return preferred
  if (model.assetType === 'fii') return 'fii'
  if (model.assetType === 'etf') return 'etf'
  if (model.assetType === 'bdr') return 'bdr'
  return 'b3'
}

export function canUseRankingModel(model: RankingModel, isPremium: boolean): boolean {
  return model.plan === 'free' || isPremium
}

/** Modelo que pode rodar sem clique: liberado para o plano e sem IA. */
export function canAutoRunRankingModel(model: RankingModel, isPremium: boolean): boolean {
  return canUseRankingModel(model, isPremium) && !model.isAi
}

/** Rótulo de um modelo salvo no histórico, inclusive os que saíram do registro. */
export function rankingModelLabel(key: string): string {
  const legacy: Record<string, string> = {
    screening: 'Screening de ações',
    fiiScreening: 'Screening de FIIs',
  }
  return getRankingModel(key)?.label ?? legacy[key] ?? key
}

/** Corpo enviado à API para um modelo de ações/FIIs (`/api/rank-builder`). */
export function buildRankBuilderBody(model: RankingModel, universe: RankingUniverse, params: RankingParams) {
  const assetTypeFilter = model.assetType === 'fii' ? 'fii' : universe
  return {
    model: model.key,
    params: {
      ...params,
      includeBDRs: assetTypeFilter === 'both' || assetTypeFilter === 'bdr',
      assetTypeFilter,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidez
// ─────────────────────────────────────────────────────────────────────────────

/** Modelos com a opção "Incluir ativos com baixa liquidez" (os de FII têm o próprio seletor de liquidez mínima). */
export function supportsLowLiquidityToggle(model: RankingModel | undefined): boolean {
  return model?.assetType === 'stock' || model?.assetType === 'bdr'
}

/** `true` quando os parâmetros pedem para incluir ativos abaixo do volume mínimo (`minLiquidity: null`). */
export function includesLowLiquidity(params: RankingParams): boolean {
  return params.minLiquidity === null
}

/** Liga/desliga a inclusão de ativos ilíquidos: `null` inclui todos; sem a chave, vale o limite padrão. */
export function withLowLiquidity(params: RankingParams, include: boolean): RankingParams {
  const next = { ...params }
  delete next.minLiquidity
  return include ? { ...next, minLiquidity: null } : next
}

export interface LiquidityItem {
  ticker: string
  /** Prisma `AssetType` ('STOCK', 'BDR', 'FII'…). */
  assetType?: string | null
  /** R$/dia; `null` = sem dado (conta como ilíquido); `undefined` = não calculado (fica fora das regras). */
  averageDailyTradedValue?: number | null
  lowLiquidity?: boolean
}

/** Raiz do ticker, comum às classes da mesma empresa: PETR3/PETR4 → PETR, TAEE11 → TAEE. */
export function companyPrefix(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/[0-9]+[A-Z]*$/, '')
}

function liquidityOf(item: LiquidityItem): number {
  const value = item.averageDailyTradedValue
  return typeof value === 'number' && Number.isFinite(value) ? value : -Infinity
}

/**
 * Mantém uma classe por empresa (mesma raiz de ticker): a de maior volume médio diário. A ordem de entrada é
 * preservada (a classe escolhida ocupa a posição da primeira classe da empresa). FIIs não passam por aqui.
 */
export function dedupeShareClasses<T extends LiquidityItem>(items: readonly T[]): T[] {
  const best = new Map<string, T>()
  for (const item of items) {
    const prefix = companyPrefix(item.ticker)
    const current = best.get(prefix)
    if (!current || liquidityOf(item) > liquidityOf(current)) best.set(prefix, item)
  }
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const prefix = companyPrefix(item.ticker)
    if (seen.has(prefix)) continue
    seen.add(prefix)
    result.push(best.get(prefix) as T)
  }
  return result
}

/**
 * Regras de liquidez dos rankings:
 * - classes da mesma empresa são deduplicadas pela mais líquida (exceto FIIs);
 * - ações e FIIs abaixo do limite (`minLiquidity`, ou o padrão do tipo) saem; com `minLiquidity: null` ficam, marcados;
 * - BDRs nunca saem: abaixo do limite ficam marcados com `lowLiquidity`.
 * Itens sem liquidez calculada (`undefined`) não são filtrados nem marcados.
 */
export function applyLiquidityRules<T extends LiquidityItem>(items: readonly T[], minLiquidity?: number | null): T[] {
  const stocks = items.filter((item) => toLiquidityAssetType(item.assetType) !== 'fii')
  const fiis = items.filter((item) => toLiquidityAssetType(item.assetType) === 'fii')
  const candidates = [...dedupeShareClasses(stocks), ...fiis]
  const result: T[] = []
  for (const item of candidates) {
    if (item.averageDailyTradedValue === undefined) {
      result.push(item)
      continue
    }
    const type = toLiquidityAssetType(item.assetType)
    const threshold = typeof minLiquidity === 'number' ? minLiquidity : LIQUIDITY_DEFAULTS[type]
    const illiquid = isIlliquid(item.averageDailyTradedValue, type, threshold)
    if (illiquid && type !== 'bdr' && minLiquidity !== null) continue
    result.push(illiquid ? { ...item, lowLiquidity: true } : item)
  }
  return result
}
