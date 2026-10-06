import { test } from 'node:test'
import assert from 'node:assert/strict'
import { equityBridge, perShare } from '../../finance/valuation'
import { keFromMacro, MACRO_FALLBACK } from '../../finance/macro'
import { projectDiscountedCashflows } from '../../strategies/base-strategy'
import { FCDStrategy } from '../../strategies/fcd-strategy'
import { GordonStrategy, dividendsTTM, extraordinaryTTM } from '../../strategies/gordon-strategy'
import { GrahamStrategy, GRAHAM_LABEL, grahamEps } from '../../strategies/graham-strategy'
import { MagicFormulaStrategy } from '../../strategies/magic-formula-strategy'
import { DividendYieldStrategy } from '../../strategies/dividend-yield-strategy'
import { STRATEGY_CONFIG } from '../../strategies/strategy-config'
import type { CompanyData, HistoricalFinancialData, RankBuilderResult, StrategyAnalysis } from '../../strategies/types'

/** Empresa sintética com dados mínimos; `financials` e demais campos podem ser sobrescritos. */
function company(overrides: Partial<CompanyData> & { financials?: CompanyData['financials'] } = {}): CompanyData {
  return {
    ticker: 'TEST3',
    name: 'Empresa Teste',
    sector: 'Bens Industriais',
    industry: 'Máquinas e Equipamentos',
    currentPrice: 10,
    ...overrides,
    financials: { ...overrides.financials },
  }
}

const history = (rows: Partial<HistoricalFinancialData>[], fromYear = 2025): HistoricalFinancialData[] =>
  rows.map((row, i) => ({ year: fromYear - i, ...row }))

/** Os rankings excluem empresas pelo overall score; nos testes isolamos a lógica de cada modelo. */
class TestMagicFormula extends MagicFormulaStrategy {
  protected shouldExcludeCompany(): boolean {
    return false
  }
}
class TestDividendYield extends DividendYieldStrategy {
  protected shouldExcludeCompany(): boolean {
    return false
  }
}
class TestGraham extends GrahamStrategy {
  protected shouldExcludeCompany(): boolean {
    return false
  }
  toRanking(data: CompanyData, analysis: StrategyAnalysis): RankBuilderResult {
    return this.convertToRankingResult(data, analysis)
  }
  keepTickers(companies: CompanyData[]): CompanyData[] {
    return this.filterTickerEndingDigits(companies)
  }
}

const close = (actual: number | null | undefined, expected: number, digits = 6) => {
  assert.ok(typeof actual === 'number', `esperava número, veio ${actual}`)
  assert.equal(Number(actual.toFixed(digits)), Number(expected.toFixed(digits)))
}

// ─── FCD ──────────────────────────────────────────────────────────────────────

test('FCD: ponte EV → patrimônio (EV 100, dívida líquida 40, 10 ações → 6,0 por ação)', () => {
  const bridge = equityBridge({ ev: 100, totalDebt: 50, cash: 10 })
  assert.deepEqual(bridge, { ev: 100, netDebt: 40, equity: 60 })
  assert.equal(perShare(bridge!.equity, 10), 6)
  // Sem dívida do balanço, cai para enterpriseValue − marketCap.
  assert.deepEqual(equityBridge({ ev: 100, enterpriseValue: 540, marketCap: 500 }), { ev: 100, netDebt: 40, equity: 60 })
})

const fcdCompany = (financials: CompanyData['financials'] = {}) =>
  company({
    currentPrice: 20,
    financials: {
      sharesOutstanding: 1_000_000_000,
      marketCap: 20_000_000_000,
      enterpriseValue: 26_000_000_000,
      evEbit: 6.5, // EBIT = 4 bi
      ebitda: 5_000_000_000, // D&A = 1 bi
      fluxoCaixaInvestimento: -1_200_000_000, // capex = 1,2 bi
      totalDivida: 8_000_000_000,
      totalCaixa: 2_000_000_000,
      cagrReceitas5a: 0.08,
      cagrLucros5a: 0.12,
      roe: 0.18,
      margemEbitda: 0.25,
      liquidezCorrente: 1.6,
      dividaLiquidaEbitda: 1.2,
      fluxoCaixaOperacional: 3_500_000_000,
      ...financials,
    },
  })

test('FCD: FCFF = EBIT × (1 − 34%) + D&A − capex, descontado pelo WACC e convertido em valor do acionista', () => {
  const analysis = new FCDStrategy().runAnalysis(fcdCompany(), STRATEGY_CONFIG.fcd)
  const m = analysis.key_metrics!
  close(m.cashflowBase, 4_000_000_000 * 0.66 + 1_000_000_000 - 1_200_000_000, 0)
  assert.equal(m.cashflowIsFcff, 1)
  // Crescimento inicial = menor CAGR (8%), g terminal 4,5%.
  assert.equal(m.initialGrowth, 0.08)
  assert.equal(m.impliedGrowth, 0.045)
  // WACC entre o custo da dívida após IR e o Ke (17,5% com as premissas padrão, nunca abaixo da Selic).
  const ke = keFromMacro(MACRO_FALLBACK)
  close(m.costOfEquity, ke)
  assert.ok(m.impliedWACC! < ke && m.impliedWACC! > MACRO_FALLBACK.selic * 0.66)

  const bridge = analysis.equityBridge!
  assert.equal(bridge.netDebt, 6_000_000_000)
  close(bridge.equity, bridge.ev - 6_000_000_000, 0)
  close(analysis.fairValue, bridge.equity / 1_000_000_000)
  assert.ok(analysis.terminalValueShare! > 0 && analysis.terminalValueShare! < 1)
  close(analysis.discount, 1 - 20 / analysis.fairValue!)
  close(analysis.upside, (analysis.fairValue! / 20 - 1) * 100)
})

test('FCD: crescimento converge linearmente do CAGR para o g terminal', () => {
  const projection = projectDiscountedCashflows({ baseCashflow: 100, initialGrowth: 0.1, terminalGrowth: 0.05, discountRate: 0.15, years: 5 })!
  assert.deepEqual(projection.growthPath.map((g) => Number(g.toFixed(4))), [0.09, 0.08, 0.07, 0.06, 0.05])
  assert.equal(projectDiscountedCashflows({ baseCashflow: 100, initialGrowth: 0.1, terminalGrowth: 0.12, discountRate: 0.15, years: 5 }), null)
})

test('FCD: só fluxo alavancado → desconta pelo Ke e não subtrai a dívida; nunca usa EBITDA × 0,6', () => {
  const levered = new FCDStrategy().runAnalysis(
    fcdCompany({ evEbit: null, enterpriseValue: null, fluxoCaixaInvestimento: null, fluxoCaixaLivre: 2_000_000_000 }),
    STRATEGY_CONFIG.fcd
  )
  assert.equal(levered.key_metrics!.cashflowIsFcff, 0)
  assert.equal(levered.equityBridge, null)
  close(levered.key_metrics!.impliedWACC, keFromMacro(MACRO_FALLBACK))
  close(levered.fairValue, levered.key_metrics!.equityValue! / 1_000_000_000)

  const onlyEbitda = new FCDStrategy().runAnalysis(
    fcdCompany({ evEbit: null, enterpriseValue: null, fluxoCaixaInvestimento: null, fluxoCaixaLivre: null }),
    STRATEGY_CONFIG.fcd
  )
  assert.equal(onlyEbitda.fairValue, null)
  assert.match(onlyEbitda.reasoning, /dados de fluxo de caixa insuficientes/)
})

test('FCD não se aplica a bancos, com o motivo', () => {
  const bank = company({ ticker: 'ITUB4', sector: 'Financeiro', industry: 'Bancos', financials: { fluxoCaixaLivre: 1e10, sharesOutstanding: 1e9 } })
  const analysis = new FCDStrategy().runAnalysis(bank, STRATEGY_CONFIG.fcd)
  assert.equal(analysis.fairValue, null)
  assert.equal(analysis.isEligible, false)
  assert.equal(analysis.reasoning, 'Modelo não se aplica a bancos e seguradoras; veja P/VP justo.')
  assert.equal(analysis.key_metrics?.notApplicable, 1)
})

// ─── Gordon ───────────────────────────────────────────────────────────────────

test('Gordon: D0 = soma dos 12 proventos mensais de R$ 0,10 (R$ 1,20), D1 = D0 × (1 + g)', () => {
  const now = Date.now()
  const monthly = Array.from({ length: 12 }, (_, i) => ({ exDate: new Date(now - (i * 30 + 5) * 86_400_000), amount: 0.1, type: 'DIVIDENDO' }))
  const older = Array.from({ length: 12 }, (_, i) => ({ exDate: new Date(now - (400 + i * 30) * 86_400_000), amount: 0.09, type: 'JCP' }))
  const data = company({
    currentPrice: 8,
    ultimoDividendo: 0.1,
    financials: { dy: 0.15, dividendYield12m: 0.15, ultimoDividendo: 0.1, roe: 0.2, payout: 0.5 },
    dividendHistory: [...monthly, ...older],
  })
  const params = { ...STRATEGY_CONFIG.gordon, dividendGrowthRate: 0.04 }
  const analysis = new GordonStrategy().runAnalysis(data, params)
  const m = analysis.key_metrics!
  close(m.d0, 1.2)
  close(m.d1, 1.2 * 1.04)
  assert.equal(m.growthRate, 0.04)
  const k = keFromMacro(MACRO_FALLBACK)
  close(m.costOfEquity, k)
  close(analysis.fairValue, (1.2 * 1.04) / (k - 0.04))
  assert.match(analysis.reasoning, /D0 R\$\s1,20/)
})

test('Gordon: g limitado por ROE × (1 − payout); sem histórico usa DY 12m × preço (nunca o último pagamento)', () => {
  const data = company({ currentPrice: 10, financials: { dividendYield12m: 0.08, ultimoDividendo: 0.05, roe: 0.1, payout: 0.8 } })
  const analysis = new GordonStrategy().runAnalysis(data, STRATEGY_CONFIG.gordon)
  close(analysis.key_metrics!.d0, 0.8)
  close(analysis.key_metrics!.growthRate, 0.02)
})

test('Gordon: D0 mantém dividendos semestrais regulares e só corta o extraordinário', () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
  const asOf = d('2026-09-30')
  // Banco: JCP mensal de R$ 0,02 + dividendo semestral de R$ 0,60, todo ano igual → TTM bruto.
  const regular = []
  for (let year = 2022; year <= 2026; year++) {
    for (let month = 1; month <= 12; month++) regular.push({ exDate: new Date(Date.UTC(year, month - 1, 5)), amount: 0.02, type: 'JCP' })
    regular.push({ exDate: new Date(Date.UTC(year, 2, 20)), amount: 0.6 }, { exDate: new Date(Date.UTC(year, 7, 20)), amount: 0.6 })
  }
  close(dividendsTTM(regular, asOf), 12 * 0.02 + 1.2)
  // Mesmo histórico com um dividendo extraordinário de R$ 5 no último ano → volta para o padrão.
  close(dividendsTTM([...regular, { exDate: d('2026-06-10'), amount: 5 }], asOf), 12 * 0.02 + 1.2)
})

test('Gordon: padrão ITUB4 (JCP mensal + dividendo mensal pequeno + trimestral + complementar anual) só corta o extraordinário', () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
  const asOf = d('2026-10-05')
  const events: { exDate: Date; amount: number; type?: string | null }[] = []
  for (let year = 2021; year <= 2026; year++) {
    for (let month = 1; month <= 12; month++) {
      const date = new Date(Date.UTC(year, month - 1, 1))
      if (date > asOf) continue
      events.push({ exDate: date, amount: 0.2, type: 'JCP' }, { exDate: new Date(Date.UTC(year, month - 1, 2)), amount: 0.018 })
    }
    for (const month of [3, 6, 9, 12]) {
      const date = new Date(Date.UTC(year, month - 1, 20))
      if (date <= asOf) events.push({ exDate: date, amount: 0.35 })
    }
    events.push({ exDate: new Date(Date.UTC(year, 1, 20)), amount: 1 + (year - 2021) * 0.1 }) // complementar anual: recorrente
  }
  const regularTTM = dividendsTTM(events, asOf)
  // Extraordinário de R$ 2,17 em dez/2025 (como o de ITUB4): fora do D0, e o resto fica intacto.
  const withExtra = [...events, { exDate: d('2025-12-10'), amount: 2.17 }]
  close(dividendsTTM(withExtra, asOf), regularTTM)
  close(extraordinaryTTM(withExtra, asOf), 2.17)
  close(regularTTM, 12 * 0.2 + 12 * 0.018 + 4 * 0.35 + 1.5)
})

// ─── Fórmula Mágica ──────────────────────────────────────────────────────────

test('Fórmula Mágica: soma das posições de ROIC e EBIT/EV com 5 empresas; exclui bancos e utilities', () => {
  const mf = (ticker: string, roic: number, evEbit: number, extra: Partial<CompanyData> = {}) =>
    company({ ticker, ...extra, financials: { roic, evEbit, marketCap: 5e9 } })
  const companies = [
    mf('AAAA3', 0.3, 10), // ROIC 1º, EY 4º → 5
    mf('BBBB3', 0.25, 5), // ROIC 2º, EY 2º → 4
    mf('CCCC3', 0.2, 4), // ROIC 3º, EY 1º → 4 (desempate: maior EY)
    mf('DDDD3', 0.15, 8), // ROIC 4º, EY 3º → 7
    mf('EEEE3', 0.1, 12), // ROIC 5º, EY 5º → 10
    mf('ITUB4', 0.4, 3, { sector: 'Financeiro', industry: 'Bancos' }),
    mf('TAEE11', 0.35, 3, { sector: 'Utilidade Pública', industry: 'Energia Elétrica' }),
  ]
  const ranking = new TestMagicFormula().runRanking(companies, { limit: 10 })
  assert.deepEqual(ranking.map((r) => r.ticker), ['CCCC3', 'BBBB3', 'AAAA3', 'DDDD3', 'EEEE3'])
  assert.deepEqual(ranking.map((r) => r.key_metrics?.combinedRank), [4, 4, 5, 7, 10])
  close(ranking[0].key_metrics?.earningsYield, 0.25)
  assert.equal(ranking[0].key_metrics?.magicScore, 100)
})

test('Fórmula Mágica: análise individual usa EY = 1 / EV/EBIT, mínimo padrão de 8%, e não se aplica a bancos', () => {
  const strategy = new MagicFormulaStrategy()
  const ok = strategy.runAnalysis(company({ financials: { roic: 0.2, evEbit: 10, roe: 0.2, margemLiquida: 0.1 } }), {})
  close(ok.key_metrics?.earningsYield, 0.1)
  assert.equal(ok.criteria[1].value, true)
  const expensive = strategy.runAnalysis(company({ financials: { roic: 0.2, evEbit: 20 } }), {})
  assert.equal(expensive.criteria[1].value, false) // EY 5% < 8%
  const bank = strategy.runAnalysis(company({ sector: 'Financeiro', industry: 'Bancos', financials: { roic: 0.2, evEbit: 5 } }), {})
  assert.equal(bank.key_metrics?.notApplicable, 1)
})

test('Graham: LPA normalizado não conta duas vezes o ano corrente nem anos repetidos do histórico', () => {
  const data = company({
    financials: { lpa: 10, year: 2026 } as CompanyData['financials'],
    historicalFinancials: [
      { year: 2026, lpa: 10 },
      { year: 2025, lpa: 4 },
      { year: 2025, lpa: 4 },
      { year: 2024, lpa: 4 },
      { year: 2023, lpa: 4 },
      { year: 2022, lpa: 4 },
    ] as HistoricalFinancialData[],
  })
  const eps = grahamEps(data)
  assert.equal(eps.years, 5)
  close(eps.value, (10 + 4 * 4) / 5)
})

// ─── Dividendos (anti-armadilha) ─────────────────────────────────────────────

test('Anti-armadilha: banco avaliado por critérios de financeira (sem liquidez corrente nem dívida/PL)', () => {
  const bank = company({
    ticker: 'ITUB4',
    sector: 'Financeiro',
    industry: 'Bancos',
    currentPrice: 35,
    financials: { dy: 0.08, roe: 0.2, payout: 0.55, pl: 8, marketCap: 300e9, lucroLiquido: 40e9, margemLiquida: 0.2 },
    historicalFinancials: history([
      { roe: 0.18, lucroLiquido: 35e9 },
      { roe: 0.19, lucroLiquido: 30e9 },
      { roe: 0.21, lucroLiquido: 28e9 },
      { roe: 0.22, lucroLiquido: 26e9 },
    ]),
  })
  const params = { ...STRATEGY_CONFIG.dividendYield }
  const analysis = new DividendYieldStrategy().runAnalysis(bank, params)
  const labels = analysis.criteria.map((c) => c.label)
  assert.ok(labels.some((l) => l.startsWith('ROE médio de 5 anos')))
  assert.ok(labels.some((l) => l.startsWith('Payout entre')))
  assert.ok(labels.includes('Lucros consistentes'))
  assert.ok(!labels.some((l) => /Liquidez corrente|Dív\. líq\./.test(l)))
  close(analysis.key_metrics?.roe5y, (0.2 + 0.18 + 0.19 + 0.21 + 0.22) / 5)
  assert.equal(analysis.isEligible, true)

  const ranking = new TestDividendYield().runRanking([bank], params)
  assert.equal(ranking.length, 1)
  assert.match(ranking[0].rational, /DY de 8,0%/)
  assert.match(ranking[0].rational, /ROE de 20,0% \(média de 5 anos\)/)
})

test('Anti-armadilha: utility usa dívida líquida/EBITDA ≤ 3,5 no lugar de dívida/PL', () => {
  const utility = company({
    sector: 'Utilidade Pública',
    industry: 'Energia Elétrica',
    financials: { dy: 0.09, roe: 0.16, dividaLiquidaPl: 1.8, dividaLiquidaEbitda: 3.2, liquidezCorrente: 1.3, pl: 9, marketCap: 13e9, margemLiquida: 0.3 },
  })
  const analysis = new DividendYieldStrategy().runAnalysis(utility, STRATEGY_CONFIG.dividendYield)
  const leverage = analysis.criteria.find((c) => c.label.startsWith('Dív. líq.'))!
  assert.equal(leverage.label, 'Dív. líq./EBITDA ≤ 3,5')
  assert.equal(leverage.value, true)
  assert.equal(analysis.isEligible, true)
})

// ─── Margem de segurança vs potencial, Graham e BDR ──────────────────────────

test('Margem de segurança (1 − P/VJ) e potencial (VJ/P − 1) são distintos: VJ 100 e preço 75 → 25% e 33,3%', () => {
  const graham = new TestGraham()
  // √(22,5 × 4 × 111,111…) = 100
  const data = company({ currentPrice: 75, financials: { lpa: 4, vpa: 1000 / 9, roe: 0.15, marketCap: 10e9 } })
  const analysis = graham.runAnalysis(data, STRATEGY_CONFIG.graham)
  close(analysis.fairValue, 100)
  close(analysis.discount, 0.25)
  close(analysis.upside, 100 / 3)
  const ranking = graham.toRanking(data, analysis)
  assert.equal(ranking.marginOfSafety, 25)
  close(ranking.upside, 100 / 3)
  assert.match(analysis.reasoning, new RegExp(GRAHAM_LABEL.replace(/[()]/g, '\\$&')))

  // O filtro de margem usa o desconto: 16,67% (= antigo potencial de 20%) aceita VJ 100 a P 83, mas não a P 84.
  const at = (price: number) => graham.runRanking([{ ...data, currentPrice: price }], STRATEGY_CONFIG.graham).length
  assert.equal(at(83), 1)
  assert.equal(at(84), 0)
})

test('Graham usa LPA normalizado (média de 5 anos), sempre em commodities cíclicas', () => {
  const data = company({
    sector: 'Materiais Básicos',
    industry: 'Mineração',
    currentPrice: 60,
    financials: { lpa: 12, vpa: 40 },
    historicalFinancials: history([{ lpa: 4 }]),
  })
  const analysis = new GrahamStrategy().runAnalysis(data, STRATEGY_CONFIG.graham)
  assert.equal(analysis.key_metrics?.lpaNormalizado, 8)
  close(analysis.fairValue, Math.sqrt(22.5 * 8 * 40))
  assert.match(analysis.reasoning, /LPA normalizado \(média de 2 anos/)

  // Empresa não cíclica com só 2 anos de histórico: LPA atual.
  const other = new GrahamStrategy().runAnalysis({ ...data, sector: 'Saúde', industry: 'Medicamentos' }, STRATEGY_CONFIG.graham)
  assert.equal(other.key_metrics?.lpaNormalizado, null)
  close(other.fairValue, Math.sqrt(22.5 * 12 * 40))
})

test('BDR sem paridade e câmbio: modelos de preço justo não se aplicam (nada de potencial negativo ou absurdo)', () => {
  const bdr = company({ ticker: 'AAPL34', sector: 'Tecnologia da Informação', currentPrice: 85.75, financials: { lpa: 1.85, vpa: 1.2, dy: 0.01 } })
  for (const analysis of [
    new GrahamStrategy().runAnalysis(bdr, STRATEGY_CONFIG.graham),
    new GordonStrategy().runAnalysis(bdr, STRATEGY_CONFIG.gordon),
    new FCDStrategy().runAnalysis(bdr, STRATEGY_CONFIG.fcd),
  ]) {
    assert.equal(analysis.fairValue, null)
    assert.equal(analysis.upside, null)
    assert.match(analysis.reasoning, /não aplicável a BDR/)
  }
  // Com moeda, câmbio e paridade informados, converte para reais por recibo.
  const converted = new GrahamStrategy().runAnalysis(
    { ...bdr, financials: { ...bdr.financials, lpa: 7, vpa: 4.5, financialCurrency: 'USD', usdBrl: 5, bdrRatio: 20 } },
    STRATEGY_CONFIG.graham
  )
  close(converted.fairValue, Math.sqrt(22.5 * 7 * 4.5) * (5 / 20))
})

test('filterTickerEndingDigits mantém classes PNA/PNB líquidas (USIM5, ELET6)', () => {
  const tickers = ['USIM5', 'ELET6', 'PETR4', 'VALE3', 'TAEE11'].map((ticker) => company({ ticker }))
  assert.deepEqual(new TestGraham().keepTickers(tickers).map((c) => c.ticker), ['USIM5', 'ELET6', 'PETR4', 'VALE3', 'TAEE11'])
})

test('Priorização técnica desligada por padrão em todos os modelos', () => {
  for (const [key, config] of Object.entries(STRATEGY_CONFIG)) {
    assert.equal((config as { useTechnicalAnalysis?: boolean }).useTechnicalAnalysis, false, key)
  }
})
