import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BazinStrategy, resolveTargetYield } from '../../strategies/bazin-strategy'
import { LynchStrategy, lynchGrowth, pegBand } from '../../strategies/lynch-strategy'
import { BankPvpStrategy } from '../../strategies/bank-pvp-strategy'
import { BarsiStrategy } from '../../strategies/barsi-strategy'
import type { CompanyData, HistoricalFinancialData } from '../../strategies/types'
import { applyLiquidityRules, companyPrefix, dedupeShareClasses, type LiquidityItem } from '../../ranking-models'

const CURRENT_YEAR = new Date().getUTCFullYear()

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/** Oito anos de lucro: o atual em `financials` e sete em `historicalFinancials`. */
function profitHistory(profits: number[]): { current: number; history: HistoricalFinancialData[] } {
  const [current, ...rest] = profits
  return {
    current,
    history: rest.map((lucroLiquido, i) => ({ year: CURRENT_YEAR - 1 - i, lucroLiquido })),
  }
}

function company(overrides: Partial<CompanyData> & { financials?: CompanyData['financials'] } = {}): CompanyData {
  const { current, history } = profitHistory([10, 9, 8, 7, 6, 5, 4, 3])
  return {
    ticker: 'TEST3',
    name: 'Empresa Teste',
    sector: 'Consumo Não Cíclico',
    industry: 'Bebidas',
    currentPrice: 40,
    assetType: 'STOCK',
    historicalFinancials: history,
    ...overrides,
    financials: { lucroLiquido: current, dividaLiquidaPl: 0.3, roe: 0.15, payout: 0.5, ...overrides.financials },
  }
}

/** Dois proventos por ano (abril dividendo, outubro JCP) somando `total`. */
function yearEvents(year: number, total: number) {
  return [
    { exDate: utc(year, 4, 15), paymentDate: utc(year, 5, 1), amount: total * 0.6, type: 'DIVIDENDO' },
    { exDate: utc(year, 10, 15), paymentDate: utc(year, 11, 1), amount: total * 0.4, type: 'JCP' },
  ]
}

// Anos N−6 … N−1 com totais 10, 1, 2, 3, 4, 5 e um ano corrente parcial com R$ 20 em janeiro.
const SIX_YEARS_PLUS_PARTIAL = [
  ...yearEvents(CURRENT_YEAR - 6, 10),
  ...yearEvents(CURRENT_YEAR - 5, 1),
  ...yearEvents(CURRENT_YEAR - 4, 2),
  ...yearEvents(CURRENT_YEAR - 3, 3),
  ...yearEvents(CURRENT_YEAR - 2, 4),
  ...yearEvents(CURRENT_YEAR - 1, 5),
  { exDate: utc(CURRENT_YEAR, 1, 1), paymentDate: utc(CURRENT_YEAR, 1, 20), amount: 20, type: 'DIVIDENDO' },
]

// ─── Bazin ──────────────────────────────────────────────────────────────────

test('Bazin: preço-teto usa só os 5 anos completos (ignora N−6 e o ano corrente parcial)', () => {
  const analysis = new BazinStrategy().runAnalysis(company({ dividendHistory: SIX_YEARS_PLUS_PARTIAL }), {})
  // Média de 1, 2, 3, 4, 5 = 3 → teto = 3 / 6% = 50.
  assert.equal(analysis.key_metrics?.averageDividend, 3)
  assert.equal(analysis.key_metrics?.fullYearsUsed, 5)
  assert.ok(Math.abs((analysis.fairValue ?? 0) - 50) < 1e-9)
  assert.ok(Math.abs((analysis.upside ?? 0) - 25) < 1e-9, 'upside em p.p. = 50/40 − 1')
  assert.ok(Math.abs((analysis.discount ?? 0) - 0.2) < 1e-9, 'desconto = 1 − 40/50')
  assert.ok(Math.abs((analysis.key_metrics?.dividendYield ?? 0) - 0.075) < 1e-9)
  assert.equal(analysis.isEligible, true)
})

test('DY alvo inválido (0, negativo, NaN, > 100%) volta ao padrão de 6%', () => {
  for (const bad of [0, -0.05, Number.NaN, Number.POSITIVE_INFINITY, 2, 'abc', null, undefined]) {
    assert.equal(resolveTargetYield(bad), 0.06, String(bad))
  }
  assert.equal(resolveTargetYield(0.08), 0.08)
  assert.equal(resolveTargetYield('0.07'), 0.07)
  const analysis = new BazinStrategy().runAnalysis(
    company({ dividendHistory: SIX_YEARS_PLUS_PARTIAL }),
    { targetDividendYield: 0 }
  )
  assert.ok(Math.abs((analysis.fairValue ?? 0) - 50) < 1e-9, 'DY alvo 0 usa 6%: teto = 3 / 6%')
})

test('Bazin: DY alvo editável e dívida alta reprovam', () => {
  const strategy = new BazinStrategy()
  const highTarget = strategy.runAnalysis(company({ dividendHistory: SIX_YEARS_PLUS_PARTIAL }), { targetDividendYield: 0.1 })
  assert.ok(Math.abs((highTarget.fairValue ?? 0) - 30) < 1e-9)
  assert.equal(highTarget.isEligible, false)

  const indebted = strategy.runAnalysis(
    company({ dividendHistory: SIX_YEARS_PLUS_PARTIAL, financials: { dividaLiquidaPl: 0.9 } }),
    {}
  )
  assert.equal(indebted.isEligible, false)
  assert.ok(indebted.criteria.some((c) => c.label.startsWith('Dív. líq./PL') && !c.value))
})

test('Bazin: financeiras usam ROE médio e payout no lugar da dívida', () => {
  const bank = company({
    ticker: 'BANK4',
    sector: 'Financeiro',
    industry: 'Bancos',
    dividendHistory: SIX_YEARS_PLUS_PARTIAL,
    financials: { dividaLiquidaPl: null, roe: 0.18, payout: 0.45 },
  })
  const analysis = new BazinStrategy().runAnalysis(bank, {})
  assert.equal(analysis.criteria.some((c) => c.label.startsWith('Dív. líq./PL')), false)
  assert.ok(analysis.criteria.some((c) => c.label.startsWith('ROE médio') && c.value))
  assert.equal(analysis.isEligible, true)
})

test('Bazin: sem histórico suficiente não estima preço-teto', () => {
  const analysis = new BazinStrategy().runAnalysis(
    company({ dividendHistory: [...yearEvents(CURRENT_YEAR - 1, 5)] }),
    {}
  )
  assert.equal(analysis.fairValue, null)
  assert.equal(analysis.isEligible, false)
})

// ─── Barsi ──────────────────────────────────────────────────────────────────

test('Barsi: média de proventos brutos em anos completos (sem o ano corrente parcial)', async () => {
  const analysis = await new BarsiStrategy().runAnalysis(
    company({ dividendHistory: SIX_YEARS_PLUS_PARTIAL, financials: { dy: 0.07, roe: 0.15 } }),
    { targetDividendYield: 0.06 }
  )
  assert.equal(analysis.key_metrics?.averageDividend, 3)
  assert.ok(Math.abs((analysis.fairValue ?? 0) - 50) < 1e-9)
  assert.ok(Math.abs((analysis.upside ?? 0) - 25) < 1e-9)
})

// ─── Peter Lynch ────────────────────────────────────────────────────────────

function lynchCompany(price: number, cagrLucros5a = 0.2, industry = 'Bebidas'): CompanyData {
  return company({ currentPrice: price, industry, financials: { lpa: 2, dy: 0.05, cagrLucros5a } })
}

test('Lynch: PEG < 0,5 é "muito barato"', () => {
  const analysis = new LynchStrategy().runAnalysis(lynchCompany(10), {})
  // P/L 5 ÷ 20 = 0,25; P/L justo = 20 + 5 = 25; valor = 2 × 25 = 50.
  assert.ok(Math.abs((analysis.key_metrics?.peg ?? 0) - 0.25) < 1e-9)
  assert.equal(pegBand(analysis.key_metrics?.peg ?? 0), 'muito barato')
  assert.ok(Math.abs((analysis.fairValue ?? 0) - 50) < 1e-9)
  assert.equal(analysis.isEligible, true)
})

test('Lynch: PEG entre 0,5 e 1 é "barato"', () => {
  const analysis = new LynchStrategy().runAnalysis(lynchCompany(30), {})
  assert.ok(Math.abs((analysis.key_metrics?.peg ?? 0) - 0.75) < 1e-9)
  assert.equal(pegBand(analysis.key_metrics?.peg ?? 0), 'barato')
  assert.equal(analysis.isEligible, true)
})

test('Lynch: PEG acima de 1 é "caro" e não entra no ranking', () => {
  const strategy = new LynchStrategy()
  const analysis = strategy.runAnalysis(lynchCompany(60), {})
  assert.ok(Math.abs((analysis.key_metrics?.peg ?? 0) - 1.5) < 1e-9)
  assert.equal(pegBand(analysis.key_metrics?.peg ?? 0), 'caro')
  assert.equal(analysis.isEligible, false)

  const ranking = strategy.runRanking(
    [lynchCompany(60), { ...lynchCompany(30), ticker: 'BBBB3' }, { ...lynchCompany(10), ticker: 'AAAA3' }],
    {}
  )
  assert.deepEqual(ranking.map((r) => r.ticker), ['AAAA3', 'BBBB3'], 'menor PEG primeiro, sem o caro')
})

test('Lynch: crescimento limitado a 25% e só positivo', () => {
  assert.equal(lynchGrowth(0.4), 0.25)
  assert.equal(lynchGrowth(0.1), 0.1)
  assert.equal(lynchGrowth(-0.05), null)
  assert.equal(lynchGrowth(null), null)
  assert.equal(lynchGrowth(Number.NaN), null)
})

test('Lynch: commodities cíclicas e LPA ≤ 0 ficam fora, com o motivo', () => {
  const strategy = new LynchStrategy()
  const oil = strategy.runAnalysis(lynchCompany(10, 0.2, 'Petróleo, Gás e Biocombustíveis'), {})
  assert.equal(oil.isEligible, false)
  assert.equal(oil.fairValue, null)
  assert.match(oil.reasoning, /commodities cíclicas/)

  const loss = strategy.runAnalysis(company({ financials: { lpa: -1, dy: 0.05, cagrLucros5a: 0.2 } }), {})
  assert.equal(loss.isEligible, false)
  assert.match(loss.reasoning, /lucro por ação positivo/)
})

// ─── P/VP justo (bancos) ────────────────────────────────────────────────────

function bankCompany(price = 40): CompanyData {
  return company({
    ticker: 'BANK4',
    sector: 'Financeiro',
    industry: 'Bancos',
    currentPrice: price,
    financials: { roe: 0.2, payout: 0.5, vpa: 30, pvp: price / 30 },
    historicalFinancials: [1, 2, 3, 4].map((i) => ({ year: CURRENT_YEAR - i, roe: 0.2 })),
  })
}

test('P/VP justo: (ROE − g) / (Ke − g) com g = min(ROE × (1 − payout), 6%)', () => {
  const analysis = new BankPvpStrategy().runAnalysis(bankCompany(), { costOfEquity: 0.14 })
  // g = min(0,20 × 0,5, 6%) = 6%; P/VP = (0,20 − 0,06) / (0,14 − 0,06) = 1,75; valor = 30 × 1,75 = 52,5.
  assert.ok(Math.abs((analysis.key_metrics?.growthRate ?? 0) - 0.06) < 1e-9)
  assert.ok(Math.abs((analysis.key_metrics?.fairPVP ?? 0) - 1.75) < 1e-9)
  assert.ok(Math.abs((analysis.fairValue ?? 0) - 52.5) < 1e-9)
  assert.equal(analysis.isEligible, true)
})

test('P/VP justo: Ke − g abaixo de 4 p.p. torna o modelo inelegível', () => {
  const analysis = new BankPvpStrategy().runAnalysis(bankCompany(), { costOfEquity: 0.09 })
  assert.equal(analysis.fairValue, null)
  assert.equal(analysis.isEligible, false)
  assert.match(analysis.reasoning, /abaixo do mínimo/)
})

test('P/VP justo: não se aplica a não financeiras', () => {
  const analysis = new BankPvpStrategy().runAnalysis(company(), { costOfEquity: 0.14 })
  assert.equal(analysis.fairValue, null)
  assert.match(analysis.reasoning, /bancos, seguradoras/)
})

// ─── Liquidez e deduplicação ────────────────────────────────────────────────

test('liquidez: exclui ações e FIIs abaixo do limite, mantém BDRs marcados', () => {
  const liquidity = new Map<string, number | null>([
    ['LIQD3', 2_000_000],
    ['POUC3', 500_000],
    ['SEMD3', null],
    ['AAPL34', 100_000],
    ['FIIA11', 400_000],
    ['FIIB11', 600_000],
  ])
  const assetTypes: Record<string, string> = { AAPL34: 'BDR', FIIA11: 'FII', FIIB11: 'FII' }
  const items: LiquidityItem[] = [...liquidity.keys()].map((ticker) => ({
    ticker,
    assetType: assetTypes[ticker] ?? 'STOCK',
    averageDailyTradedValue: liquidity.get(ticker),
  }))

  const byDefault = applyLiquidityRules(items)
  assert.deepEqual(byDefault.map((i) => i.ticker), ['LIQD3', 'AAPL34', 'FIIB11'])
  assert.equal(byDefault.find((i) => i.ticker === 'AAPL34')?.lowLiquidity, true)
  assert.equal(byDefault.find((i) => i.ticker === 'LIQD3')?.lowLiquidity, undefined)

  const includeAll = applyLiquidityRules(items, null)
  assert.equal(includeAll.length, items.length)
  assert.equal(includeAll.find((i) => i.ticker === 'POUC3')?.lowLiquidity, true)

  const custom = applyLiquidityRules(items, 300_000)
  assert.deepEqual(custom.map((i) => i.ticker), ['LIQD3', 'POUC3', 'AAPL34', 'FIIA11', 'FIIB11'])
})

test('liquidez: itens sem liquidez calculada não são filtrados', () => {
  const items = [{ ticker: 'NOVA3', assetType: 'STOCK' }]
  assert.deepEqual(applyLiquidityRules(items), items)
})

test('deduplicação: mantém a classe mais líquida da empresa, na posição da primeira', () => {
  const items = [
    { ticker: 'PETR3', averageDailyTradedValue: 1_000_000 },
    { ticker: 'VALE3', averageDailyTradedValue: 9_000_000 },
    { ticker: 'PETR4', averageDailyTradedValue: 5_000_000 },
    { ticker: 'TAEE4', averageDailyTradedValue: 3_000_000 },
    { ticker: 'TAEE11', averageDailyTradedValue: 40_000_000 },
  ]
  assert.deepEqual(dedupeShareClasses(items).map((i) => i.ticker), ['PETR4', 'VALE3', 'TAEE11'])
  assert.equal(companyPrefix('TAEE11'), 'TAEE')
  assert.equal(companyPrefix('usim5'), 'USIM')
})

// ─── Lucros consistentes ────────────────────────────────────────────────────

test('lucros consistentes: 8 anos com 3 prejuízos excluem, com 2 mantêm', () => {
  const strategy = new BazinStrategy() as unknown as { hasConsistentProfits(company: CompanyData): boolean }
  const threeLosses = profitHistory([10, -1, 8, -2, 6, -3, 4, 3])
  const twoLosses = profitHistory([10, -1, 8, -2, 6, 5, 4, 3])

  assert.equal(
    strategy.hasConsistentProfits(company({ financials: { lucroLiquido: threeLosses.current }, historicalFinancials: threeLosses.history })),
    false
  )
  assert.equal(
    strategy.hasConsistentProfits(company({ financials: { lucroLiquido: twoLosses.current }, historicalFinancials: twoLosses.history })),
    true
  )
})
