import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GrahamStrategy } from '../../strategies/graham-strategy'
import { FCDStrategy } from '../../strategies/fcd-strategy'
import { GordonStrategy } from '../../strategies/gordon-strategy'
import { BazinStrategy, BAZIN_DEFAULTS } from '../../strategies/bazin-strategy'
import { STRATEGY_CONFIG } from '../../strategies/strategy-config'
import { FiiDividendYieldStrategy, FII_DIVIDEND_YIELD_DEFAULTS } from '../../strategies/fii-dividend-yield-strategy'
import { FiiRankingStrategy, FII_RANKING_DEFAULTS } from '../../strategies/fii-ranking-strategy'
import { calculateFiiOverallScore } from '../../strategies/fii-overall-score'
import type { CompanyData, GordonParams, HistoricalFinancialData, RankBuilderResult, StrategyAnalysis } from '../../strategies/types'
import {
  changedRankingParams,
  fairValueModelParams,
  getRankingModel,
  universeForAssetType,
  type FairValueModelKey,
  type RankingUniverse,
} from '../../ranking-models'

/**
 * Página do ativo × ranking: para o mesmo `CompanyData`, os dois caminhos precisam chegar ao mesmo preço justo.
 * - Página: `executeCompanyAnalysis` roda `runXAnalysis` com `fairValueModelParams(modelo, universo, base)`.
 * - Ranking: o painel envia `defaults(universo)` do registro e a API roda `runXRanking` com eles.
 * O corte de qualidade do ranking (lucros consistentes e overall score) só decide quem entra na lista; aqui ele fica
 * desligado para comparar o cálculo.
 */
class RankingGraham extends GrahamStrategy {
  protected shouldExcludeCompany(): boolean {
    return false
  }
}
class RankingFcd extends FCDStrategy {
  protected shouldExcludeCompany(): boolean {
    return false
  }
}
class RankingGordon extends GordonStrategy {
  protected shouldExcludeCompany(): boolean {
    return false
  }
}
class RankingBazin extends BazinStrategy {
  protected shouldExcludeCompany(): boolean {
    return false
  }
}

const DAY = 86_400_000

/** Um provento de R$ 0,50 a cada ~6 meses nos últimos 7 anos (≈ R$ 1,00 por ano), relativo a hoje. */
function semiannualDividends(): NonNullable<CompanyData['dividendHistory']> {
  const now = Date.now()
  return Array.from({ length: 14 }, (_, i) => {
    const exDate = new Date(now - (30 + 182 * i) * DAY)
    return { exDate, paymentDate: new Date(exDate.getTime() + 15 * DAY), amount: 0.5, type: 'DIVIDENDO' }
  })
}

function yearlyHistory(): HistoricalFinancialData[] {
  const currentYear = new Date().getUTCFullYear()
  return Array.from({ length: 7 }, (_, i) => ({
    year: currentYear - 1 - i,
    roe: 0.18,
    roic: 0.16,
    dy: 0.1,
    payout: 0.5,
    lpa: 2,
    vpa: 12,
    margemLiquida: 0.15,
    liquidezCorrente: 1.6,
    dividaLiquidaPl: 0.3,
    lucroLiquido: 2_000_000_000,
  }))
}

/** Empresa que passa nos quatro modelos com os padrões do registro (Graham, FCD, Gordon e Bazin). */
function fixture(overrides: Partial<CompanyData> = {}): CompanyData {
  return {
    ticker: 'TEST3',
    name: 'Empresa Teste',
    sector: 'Bens Industriais',
    industry: 'Máquinas e Equipamentos',
    assetType: 'STOCK',
    currentPrice: 6,
    overallScore: 80,
    dividendHistory: semiannualDividends(),
    historicalFinancials: yearlyHistory(),
    ...overrides,
    financials: {
      year: new Date().getUTCFullYear(),
      lpa: 2,
      vpa: 12,
      pl: 3,
      pvp: 0.5,
      roe: 0.18,
      roic: 0.16,
      dy: 0.1,
      dividendYield12m: 0.1,
      payout: 0.5,
      margemLiquida: 0.15,
      liquidezCorrente: 1.6,
      dividaLiquidaPl: 0.3,
      dividaLiquidaEbitda: 1.2,
      crescimentoLucros: 0.05,
      lucroLiquido: 2_000_000_000,
      sharesOutstanding: 1_000_000_000,
      marketCap: 6_000_000_000,
      enterpriseValue: 12_000_000_000,
      evEbit: 3, // EBIT = 4 bi
      ebitda: 5_000_000_000,
      fluxoCaixaInvestimento: -1_200_000_000,
      totalDivida: 8_000_000_000,
      totalCaixa: 2_000_000_000,
      cagrReceitas5a: 0.08,
      cagrLucros5a: 0.12,
      margemEbitda: 0.25,
      fluxoCaixaOperacional: 3_500_000_000,
      ...overrides.financials,
    },
  }
}

interface ModelPaths {
  page: (data: CompanyData, universe: RankingUniverse) => StrategyAnalysis
  ranking: (data: CompanyData, universe: RankingUniverse) => RankBuilderResult[]
}

const rankingDefaults = (key: FairValueModelKey, universe: RankingUniverse) => getRankingModel(key)!.defaults(universe)

const PATHS: Record<'graham' | 'fcd' | 'gordon' | 'bazin', ModelPaths> = {
  graham: {
    page: (data, u) => new GrahamStrategy().runAnalysis(data, fairValueModelParams('graham', u, STRATEGY_CONFIG.graham)),
    ranking: (data, u) => new RankingGraham().runRanking([data], rankingDefaults('graham', u)),
  },
  fcd: {
    page: (data, u) => new FCDStrategy().runAnalysis(data, fairValueModelParams('fcd', u, STRATEGY_CONFIG.fcd)),
    ranking: (data, u) => new RankingFcd().runRanking([data], rankingDefaults('fcd', u)),
  },
  gordon: {
    page: (data, u) => new GordonStrategy().runAnalysis(data, fairValueModelParams('gordon', u, STRATEGY_CONFIG.gordon)),
    ranking: (data, u) => new RankingGordon().runRanking([data], rankingDefaults('gordon', u) as unknown as GordonParams),
  },
  bazin: {
    page: (data, u) => new BazinStrategy().runAnalysis(data, fairValueModelParams('bazin', u, BAZIN_DEFAULTS)),
    ranking: (data, u) => new RankingBazin().runRanking([data], rankingDefaults('bazin', u)),
  },
}

const close = (actual: number | null | undefined, expected: number | null | undefined, label: string) => {
  assert.ok(typeof actual === 'number' && typeof expected === 'number', `${label}: esperava números (${actual}, ${expected})`)
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} ≠ ${expected}`)
}

for (const [model, paths] of Object.entries(PATHS)) {
  test(`${model}: página do ativo e ranking padrão chegam ao mesmo preço justo`, () => {
    const data = fixture()
    const universe = universeForAssetType(data.assetType)
    const page = paths.page(data, universe)
    const row = paths.ranking(data, universe).find((result) => result.ticker === data.ticker)
    assert.ok(row, `${model}: a empresa de teste deveria entrar no ranking padrão`)
    close(page.fairValue, row.fairValue, `${model} preço justo`)
    close(page.upside, row.upside, `${model} potencial`)
  })
}

test('Gordon: crescimento g igual nos dois caminhos e diferente do antigo padrão da página (5%)', () => {
  const data = fixture()
  const page = PATHS.gordon.page(data, 'b3')
  const row = PATHS.gordon.ranking(data, 'b3')[0]
  close(page.key_metrics?.growthRate, row.key_metrics?.growthRate, 'g')
  assert.equal(page.key_metrics?.growthRate, 0.04)
  const legacy = new GordonStrategy().runAnalysis(data, STRATEGY_CONFIG.gordon)
  assert.notEqual(legacy.fairValue, page.fairValue, 'com o padrão antigo da página o valor divergia do ranking')
})

test('Gordon: sem o payout no histórico, a média muda o g (por isso a página monta o histórico como o ranking)', () => {
  const withPayout = fixture({ financials: { payout: 0.95 } })
  const withoutPayout = fixture({
    financials: { payout: 0.95 },
    historicalFinancials: yearlyHistory().map((row) => ({ ...row, payout: undefined })),
  })
  const g = (data: CompanyData) => PATHS.gordon.page(data, 'b3').key_metrics?.growthRate
  // Com o histórico completo, a média de 7 anos do payout fica ~56% e g = 4%; só com o ano atual (95%), g < 1%.
  assert.equal(g(withPayout), 0.04)
  assert.ok((g(withoutPayout) ?? 1) < 0.01)
})

test('BDR: página e ranking de BDRs usam os padrões de BDR do registro', () => {
  const params = fairValueModelParams('gordon', universeForAssetType('BDR'), STRATEGY_CONFIG.gordon)
  assert.equal(params.dividendGrowthRate, 0.05)
  assert.equal(params.discountRate, 0.12)
  assert.equal(universeForAssetType('STOCK'), 'b3')
  assert.equal(universeForAssetType(null), 'b3')
})

test('Parâmetros só de lista (tamanho, priorização técnica, limite) não entram no cálculo da página', () => {
  const params = fairValueModelParams('fcd', 'b3', STRATEGY_CONFIG.fcd) as Record<string, unknown>
  assert.equal(params.limit, undefined)
  assert.equal(params.companySize, STRATEGY_CONFIG.fcd.companySize)
  assert.equal(params.growthRate, 0.04)
  assert.equal(params.discountRate, 0.1)
})

test('Ranking com parâmetros alterados: só os campos diferentes do padrão são listados', () => {
  const gordon = getRankingModel('gordon')!
  assert.deepEqual(changedRankingParams(gordon, 'b3', gordon.defaults('b3')), [])
  const changed = changedRankingParams(gordon, 'b3', { ...gordon.defaults('b3'), dividendGrowthRate: 0.06, companySize: 'blue_chips' })
  assert.deepEqual(
    changed.map((c) => [c.field.key, c.value]),
    [['dividendGrowthRate', 0.06]]
  )
  // Ponto flutuante do slider (0,04 + 0,005 − 0,005) não conta como alteração.
  assert.deepEqual(changedRankingParams(gordon, 'b3', { ...gordon.defaults('b3'), dividendGrowthRate: 0.04 + 0.005 - 0.005 }), [])
  // Um BDR num ranking de ações B3 recebe a nota (os padrões de BDR são outros).
  assert.ok(changedRankingParams(gordon, 'bdr', gordon.defaults('b3')).length > 0)
})

// ─── FIIs ──────────────────────────────────────────────────────────────────

test('FIIs: padrões das estratégias iguais aos do registro', () => {
  const dy = getRankingModel('fiiDividendYield')!.defaults('fii')
  assert.equal(FII_DIVIDEND_YIELD_DEFAULTS.minYield, dy.minYield)
  assert.equal(FII_DIVIDEND_YIELD_DEFAULTS.maxPvp, dy.maxPvp)
  assert.equal(FII_DIVIDEND_YIELD_DEFAULTS.minLiquidity, dy.minLiquidity)
  assert.equal(FII_DIVIDEND_YIELD_DEFAULTS.limit, dy.limit)

  const ranking = getRankingModel('fiiRanking')!.defaults('fii')
  assert.equal(FII_RANKING_DEFAULTS.minScore, ranking.minScore)
  assert.equal(FII_RANKING_DEFAULTS.minLiquidity, ranking.minLiquidity)
  assert.equal(FII_RANKING_DEFAULTS.limit, ranking.limit)
})

function fii(ticker: string, financials: CompanyData['financials'] = {}): CompanyData {
  return {
    ticker,
    name: `FII ${ticker}`,
    sector: 'Fundos Imobiliários',
    assetType: 'FII',
    currentPrice: 100,
    dividendHistory: semiannualDividends().map((row) => ({ ...row, amount: 0.8 })),
    financials: {
      dy: 0.1,
      pvp: 0.95,
      vpa: 105,
      marketCap: 2_000_000_000,
      fiiLiquidez: 5_000_000,
      fiiQtdImoveis: 12,
      fiiVacanciaMedia: 0.05,
      fiiCapRate: 0.09,
      fiiFfoYield: 0.1,
      fiiSegment: 'Logística',
      fiiIsPapel: false,
      fiiCotacao: 98,
      patrimonioLiquido: 2_100_000_000,
      ...financials,
    },
  }
}

test('FIIs por DY sem parâmetros: P/VP máximo 1,1 (não 1,3) e limite de 50', () => {
  const strategy = new FiiDividendYieldStrategy()
  const rows = strategy.runRanking([fii('AAAA11', { pvp: 1.05 }), fii('BBBB11', { pvp: 1.2 })], { assetTypeFilter: 'fii' })
  assert.deepEqual(rows.map((r) => r.ticker), ['AAAA11'])
  const many = Array.from({ length: 60 }, (_, i) => fii(`F${String(i).padStart(3, '0')}11`))
  assert.equal(strategy.runRanking(many, { assetTypeFilter: 'fii' }).length, 50)
})

test('PJ-FII: o score do ranking é o mesmo da página do FII (pilar segmento usa a data de atualização)', () => {
  const lastFetchedAt = new Date('2026-09-30T12:00:00Z')
  const data = fii('LOGI11', { fiiLastFetchedAt: lastFetchedAt })
  const pageScore = calculateFiiOverallScore(
    {
      ticker: data.ticker,
      cotacao: data.currentPrice,
      dividendYield: data.financials.dy,
      pvp: data.financials.pvp,
      ffoYield: data.financials.fiiFfoYield,
      capRate: data.financials.fiiCapRate,
      valorPatrimonial: data.financials.vpa,
      liquidez: data.financials.fiiLiquidez,
      valorMercado: data.financials.marketCap,
      qtdImoveis: data.financials.fiiQtdImoveis,
      vacanciaMedia: data.financials.fiiVacanciaMedia,
      segment: 'Logística',
      isPapel: false,
      patrimonioLiquido: data.financials.patrimonioLiquido,
      lastFetchedAt,
    },
    data.dividendHistory
  )
  assert.ok(pageScore)
  const analysis = new FiiRankingStrategy().runAnalysis(data, {})
  assert.equal(analysis.key_metrics?.pjFiiScore, pageScore.score)

  const pillar = (row: RankBuilderResult | undefined) => row?.rational.match(/Segmento e resiliência (\d+)/)?.[1]
  const loose = { minScore: 0, minLiquidity: 0, assetTypeFilter: 'fii' as const }
  const [row] = new FiiRankingStrategy().runRanking([data], loose)
  assert.equal(pillar(row), pageScore.breakdown.gestao.score.toFixed(0))
  assert.match(row!.rational, /^PJ-FII \d+(,\d+)? \(/, 'score no formato pt-BR (vírgula decimal)')
  const [withoutDate] = new FiiRankingStrategy().runRanking([fii('LOGI11')], loose)
  assert.notEqual(pillar(withoutDate), pillar(row), 'sem a data de atualização o pilar cai (60 em vez de 80 no componente idade)')

  // Cache JSON devolve a data como string: continua valendo como "atualizado".
  const fromCache = new FiiRankingStrategy().runAnalysis(fii('LOGI11', { fiiLastFetchedAt: lastFetchedAt.toISOString() }), {})
  assert.equal(fromCache.key_metrics?.pjFiiScore, pageScore.score)
})
