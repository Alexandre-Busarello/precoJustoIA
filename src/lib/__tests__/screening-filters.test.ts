import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ScreeningStrategy,
  bazinScreening,
  dividendYield12m,
  evaluateDip,
  lynchPeg,
  type ExtendedScreeningParams,
  type ScreeningCompanyData,
} from '../strategies/screening-strategy'
import {
  countActiveStockFilters,
  dipReason,
  fiiParamsFromQuery,
  fiiParamsToQuery,
  formatLiquidityOption,
  stockParamsFromQuery,
  stockParamsToQuery,
} from '../../components/screening/screening-metrics'

const DAY_MS = 86_400_000
const NOW = Date.now()

/** Proventos trimestrais de `amount` por ação, do mais recente (15 dias atrás) para trás, por `years` anos. */
function quarterlyDividends(amount: number, years = 7) {
  return Array.from({ length: years * 4 }, (_, i) => ({
    exDate: new Date(NOW - 15 * DAY_MS - i * 91 * DAY_MS),
    paymentDate: null,
    amount,
    type: 'DIVIDENDO',
  }))
}

const THIS_YEAR = new Date().getUTCFullYear()

function company(ticker: string, overrides: Partial<ScreeningCompanyData> = {}): ScreeningCompanyData {
  return {
    ticker,
    name: ticker,
    sector: 'Saúde',
    industry: 'Medicamentos e Outros Produtos',
    assetType: 'STOCK',
    currentPrice: 20,
    averageDailyTradedValue: 5_000_000,
    financials: {
      year: THIS_YEAR,
      lpa: 2.5,
      vpa: 15,
      pl: 8,
      pvp: 1.3,
      dy: 0.03,
      roe: 0.18,
      margemLiquida: 0.12,
      lucroLiquido: 1_040,
      ebitda: 2_000,
      dividaLiquidaEbitda: 1,
      dividaLiquidaPl: 0.3,
      cagrLucros5a: 0.1,
      marketCap: 10_000_000_000,
      payout: 0.5,
    },
    historicalFinancials: [
      { year: THIS_YEAR - 1, lucroLiquido: 1_000, roe: 0.175, margemLiquida: 0.12, ebitda: 1_900, dividaLiquidaEbitda: 1.1 },
      { year: THIS_YEAR - 2, lucroLiquido: 950, roe: 0.17, margemLiquida: 0.11, ebitda: 1_800, dividaLiquidaEbitda: 1.2 },
    ],
    dividendHistory: quarterlyDividends(0.5),
    ...overrides,
  }
}

const screen = (companies: ScreeningCompanyData[], params: ExtendedScreeningParams) =>
  new ScreeningStrategy().screen(companies, { assetTypeFilter: 'both', ...params })

const tickers = (companies: { ticker: string }[]) => companies.map((c) => c.ticker).sort()

test('liquidez: padrão de R$ 1 mi/dia exclui ações ilíquidas; incluir baixa liquidez as marca', () => {
  const liquid = company('LIQD3')
  const illiquid = company('ILIQ3', { averageDailyTradedValue: 300_000 })
  const params: ExtendedScreeningParams = { plFilter: { enabled: true, max: 20 } }

  assert.deepEqual(tickers(screen([liquid, illiquid], params).results), ['LIQD3'])
  assert.deepEqual(tickers(screen([liquid, illiquid], { ...params, minLiquidity: 200_000 }).results), ['ILIQ3', 'LIQD3'])

  const included = screen([liquid, illiquid], { ...params, minLiquidity: null }).results
  assert.deepEqual(tickers(included), ['ILIQ3', 'LIQD3'])
  // A marcação de baixa liquidez vem da regra de liquidez; a rota a repassa para o badge.
  const strategy = new ScreeningStrategy()
  assert.equal(strategy.runRanking([liquid, illiquid], { ...params, minLiquidity: 10_000_000 }).length, 0)
})

test('DY 12m: soma dos proventos com data-com nos últimos 12 meses ÷ preço (0 sem pagamentos)', () => {
  // 4 pagamentos de R$ 0,50 na janela de 12 meses → R$ 2,00 / R$ 20,00 = 10%.
  assert.ok(Math.abs((dividendYield12m(company('DIVD3')) ?? 0) - 0.1) < 1e-9)
  assert.equal(dividendYield12m(company('NODV3', { dividendHistory: [] })), 0)
  assert.equal(dividendYield12m(company('NOHI3', { dividendHistory: undefined })), null)

  // O filtro antigo `dyFilter` usa o DY 12m real, não o DY cadastrado (3%).
  const results = screen([company('DIVD3'), company('NODV3', { dividendHistory: [] })], { dyFilter: { enabled: true, min: 0.08 } })
  assert.deepEqual(tickers(results.results), ['DIVD3'])
  assert.ok(Math.abs((results.results[0].key_metrics?.dy ?? 0) - 0.1) < 1e-9)
})

test('Bazin: desconto = 1 − preço ÷ preço-teto, com DY alvo editável', () => {
  // Média de R$ 2,00/ano ÷ 6% = R$ 33,33; preço R$ 20 → desconto de 40%.
  const { ceiling, discount } = bazinScreening(company('BAZN3'))
  assert.ok(ceiling !== null && Math.abs(ceiling - 2 / 0.06) < 0.01)
  assert.ok(discount !== null && Math.abs(discount - (1 - 20 / (2 / 0.06))) < 1e-4)

  // DY alvo de 10%: teto de R$ 20 → desconto zero.
  const tenPct = bazinScreening(company('BAZN3'), 0.1)
  assert.ok(tenPct.ceiling !== null && Math.abs(tenPct.ceiling - 20) < 0.01)

  const expensive = company('CARO3', { currentPrice: 30 })
  const noHistory = company('SEMH3', { dividendHistory: [] })
  const filter = { bazinDiscountFilter: { enabled: true, min: 0.2 } }
  const { results } = screen([company('BAZN3'), expensive, noHistory], filter)
  assert.deepEqual(tickers(results), ['BAZN3'])
  assert.ok(Math.abs((results[0].key_metrics?.bazinDiscount ?? 0) - 0.4) < 1e-3)
  assert.equal(screen([company('BAZN3')], { ...filter, bazinTargetYield: 0.1 }).results.length, 0)
})

test('PEG: definição de Lynch; fora do modelo fica "—" (null) e sai quando o filtro está ativo', () => {
  // P/L 8 ÷ crescimento de 10% = 0,8.
  assert.equal(lynchPeg(company('PEGO3')), 0.8)
  const bank = company('BANK4', { sector: 'Financeiro', industry: 'Bancos' })
  const mining = company('MINA3', { sector: 'Materiais Básicos', industry: 'Mineração' })
  const shrinking = company('ENCO3', { financials: { ...company('X').financials, cagrLucros5a: -0.05 } })
  assert.equal(lynchPeg(bank), null)
  assert.equal(lynchPeg(mining), null)
  assert.equal(lynchPeg(shrinking), null)

  const all = [company('PEGO3'), bank, mining, shrinking]
  // Sem o filtro, as empresas fora do modelo continuam na lista com PEG null.
  const withoutFilter = screen(all, { pvpFilter: { enabled: true, max: 5 } }).results
  assert.equal(withoutFilter.length, 4)
  assert.equal(withoutFilter.find((r) => r.ticker === 'BANK4')?.key_metrics?.peg, null)

  assert.deepEqual(tickers(screen(all, { pegFilter: { enabled: true, max: 1 } }).results), ['PEGO3'])
  assert.equal(screen(all, { pegFilter: { enabled: true, max: 0.5 } }).results.length, 0)
})

test('queda com fundamentos intactos: preço em correção E fundamentos preservados; sem histórico conta à parte', () => {
  const belowSma = company('QUED3', { priceSignals: { pctAboveSma200: -0.12, drawdown52w: -0.1 } })
  const deepDrawdown = company('DRAW3', { priceSignals: { pctAboveSma200: 0.02, drawdown52w: -0.24 } })
  const noDip = company('ALTA3', { priceSignals: { pctAboveSma200: 0.05, drawdown52w: -0.05 } })
  const brokenFundamentals = company('RUIM3', {
    priceSignals: { pctAboveSma200: -0.2, drawdown52w: -0.3 },
    financials: { ...company('X').financials, lucroLiquido: 600 },
  })
  const shortHistory = company('NOVA3', { priceSignals: { pctAboveSma200: null, drawdown52w: -0.3 } })
  const noAnnual = company('SEMB3', { priceSignals: { pctAboveSma200: -0.1, drawdown52w: -0.2 }, historicalFinancials: [] })

  assert.equal(evaluateDip(belowSma).passed, true)
  assert.equal(evaluateDip(deepDrawdown).passed, true)
  assert.equal(evaluateDip(noDip).passed, false)
  assert.equal(evaluateDip(brokenFundamentals).passed, false)
  assert.equal(evaluateDip(shortHistory).insufficient, true)
  assert.equal(evaluateDip(noAnnual).insufficient, true)

  const dip = evaluateDip(belowSma)
  assert.ok(Math.abs((dip.netIncomeChange ?? 0) - 0.04) < 1e-9)
  assert.ok(Math.abs((dip.roeChange ?? 0) - 0.005) < 1e-9)

  const { results, insufficientData } = screen(
    [belowSma, deepDrawdown, noDip, brokenFundamentals, shortHistory, noAnnual],
    { dipWithIntactFundamentals: true }
  )
  assert.deepEqual(tickers(results), ['DRAW3', 'QUED3'])
  assert.equal(insufficientData, 2)
  assert.equal(dipReason(results.find((r) => r.ticker === 'QUED3')?.key_metrics), '−12% vs. MM200 · −10% da máx. 52s · lucro 12m +4% · ROE estável')

  // Combinado com outro filtro: quem já falha no outro critério não entra na contagem de "sem dados".
  const combined = screen([belowSma, shortHistory], { dipWithIntactFundamentals: true, plFilter: { enabled: true, max: 5 } })
  assert.equal(combined.results.length, 0)
  assert.equal(combined.insufficientData, 0)
})

test('preset de queda ordena pela maior queda desde a máxima de 52 semanas', () => {
  const a = company('AAAA3', { priceSignals: { pctAboveSma200: -0.05, drawdown52w: -0.1 } })
  const b = company('BBBB3', { priceSignals: { pctAboveSma200: -0.05, drawdown52w: -0.3 } })
  const { results } = screen([a, b], { dipWithIntactFundamentals: true, sortBy: 'drawdown_asc' })
  assert.deepEqual(results.map((r) => r.ticker), ['BBBB3', 'AAAA3'])
})

test('dipReason descreve variação de ROE em pontos quando não é estável', () => {
  assert.equal(
    dipReason({ priceVsSma200: 0.03, drawdown52w: -0.22, netIncomeChange: -0.05, roeChange: -0.021 }),
    '+3% vs. MM200 · −22% da máx. 52s · lucro 12m −5% · ROE −2,1 p.p.'
  )
  assert.equal(dipReason({ pl: 8 }), null)
})

test('filtros na URL: ida e volta, com o nome antigo `dy` preservado', () => {
  const params: ExtendedScreeningParams = {
    companySize: 'small_caps',
    useTechnicalAnalysis: true,
    assetTypeFilter: 'both',
    dyFilter: { enabled: true, min: 0.06 },
    plFilter: { enabled: true, max: 15 },
    bazinDiscountFilter: { enabled: true, min: 0.2 },
    bazinTargetYield: 0.07,
    pegFilter: { enabled: true, max: 1 },
    dipWithIntactFundamentals: true,
    minLiquidity: null,
    selectedSectors: ['Saúde', 'Financeiro'],
  }
  const query = stockParamsToQuery(params)
  assert.equal(query.get('dy'), '0.06~')
  assert.equal(query.get('liq'), 'todos')
  assert.equal(query.get('assetType'), 'both')
  // O hub lê `assetType` à parte e o passa como padrão.
  assert.deepEqual(stockParamsFromQuery(new URLSearchParams(query.toString()), 'both'), params)

  // B3 é o padrão: sem parâmetro na URL.
  assert.equal(stockParamsToQuery({ assetTypeFilter: 'b3', companySize: 'all' }).toString(), '')
  // Valores inválidos são ignorados.
  const parsed = stockParamsFromQuery(new URLSearchParams('pl=abc~&liq=-5&porte=gigante&bazinDy=3'), 'b3')
  assert.equal(parsed.plFilter, undefined)
  assert.equal(parsed.minLiquidity, undefined)
  assert.equal(parsed.companySize, 'all')
  assert.equal(parsed.bazinTargetYield, undefined)

  const fii = { tipoFii: 'tijolo' as const, minDY: 0.09, minLiquidity: 2_000_000, segmento: 'Logística' }
  assert.deepEqual(fiiParamsFromQuery(new URLSearchParams(fiiParamsToQuery(fii).toString())), fii)
})

test('contagem de filtros ativos inclui os novos filtros e a liquidez fora do padrão', () => {
  const base: ExtendedScreeningParams = { companySize: 'all', useTechnicalAnalysis: true, assetTypeFilter: 'b3' }
  assert.equal(countActiveStockFilters(base), 0)
  assert.equal(
    countActiveStockFilters({
      ...base,
      pegFilter: { enabled: true, max: 1 },
      bazinDiscountFilter: { enabled: true, min: 0.1 },
      dipWithIntactFundamentals: true,
      minLiquidity: 2_000_000,
    }),
    4
  )
  const plain = (text: string) => text.replace(/\u00a0/g, ' ')
  assert.equal(plain(formatLiquidityOption(1_000_000)), '≥ R$ 1 mi/dia')
  assert.equal(plain(formatLiquidityOption(500_000)), '≥ R$ 500 mil/dia')
})
