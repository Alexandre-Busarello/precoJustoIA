import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AdaptiveBacktestService,
  BACKTEST_TRADING_COST_RATE,
  buildCapitalAdjustedSeries,
  dividendsInWindow,
  type BacktestDividend,
  type BacktestParams,
  type PricePoint,
} from '../../adaptive-backtest-service'
import { netAmount, toDividendEvents, type DividendHistoryRow } from '../../finance/dividends'
import type { DataAvailability } from '../../backtest-data-validator'

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/** Barras mensais (dia 1, fechamento do mês) com preço constante: o retorno vem só dos proventos. */
function flatBars(price: number, months: number): PricePoint[] {
  return buildCapitalAdjustedSeries(
    Array.from({ length: months }, (_, i) => ({ date: utc(2025, 1 + i, 1), close: price, adjustedClose: price }))
  ).prices
}

const AVAILABILITY: DataAvailability[] = [
  {
    ticker: 'TEST3',
    availableFrom: utc(2025, 1, 1),
    availableTo: utc(2026, 1, 1),
    totalMonths: 13,
    missingMonths: 0,
    dataQuality: 'excellent',
    warnings: [],
  },
]

const PARAMS: BacktestParams = {
  // DY médio legado presente de propósito: não pode gerar crédito sintético
  assets: [{ ticker: 'TEST3', allocation: 1, averageDividendYield: 0.1 }],
  startDate: utc(2025, 1, 15),
  endDate: utc(2025, 12, 15),
  initialCapital: 10_000,
  monthlyContribution: 0,
  rebalanceFrequency: 'monthly',
  reinvestDividends: false,
}

/** Linhas de DividendHistory do ativo (valores brutos por ação). */
const FIXTURE: DividendHistoryRow[] = [
  { exDate: utc(2024, 12, 15), amount: '0.40', type: 'DIVIDENDO' }, // antes da compra
  { exDate: utc(2025, 3, 10), amount: '0.50', type: 'DIVIDENDO' },
  { exDate: utc(2025, 6, 16), amount: '1.00', type: 'JCP' }, // líquido de 15% de IRRF
  { exDate: utc(2025, 9, 22), amount: '0.50', type: 'DIVIDENDO' },
  { exDate: utc(2026, 2, 10), amount: '0.70', type: 'DIVIDENDO' }, // depois do período
]

function toBacktestDividends(rows: DividendHistoryRow[]): BacktestDividend[] {
  return toDividendEvents(rows).map((event) => ({ exDate: event.exDate, amountPerShare: netAmount(event) }))
}

function simulate(rows: DividendHistoryRow[]) {
  const service = new AdaptiveBacktestService()
  const log = console.log
  console.log = () => {} // a simulação registra o passo a passo no console
  try {
    return service.simulateAdaptivePortfolio(
      new Map([['TEST3', flatBars(10, 13)]]),
      PARAMS,
      AVAILABILITY,
      new Map([['TEST3', toBacktestDividends(rows)]])
    )
  } finally {
    console.log = log
  }
}

test('backtest de 1 ativo: proventos creditados = soma do DividendHistory no período, sem crédito sintético', () => {
  const result = simulate(FIXTURE)
  const shares = Math.floor(10_000 / (10 * (1 + BACKTEST_TRADING_COST_RATE)))
  assert.equal(result.evolution[result.evolution.length - 1].holdings.get('TEST3'), shares)

  const inPeriod = toDividendEvents(FIXTURE).filter((e) => e.exDate > utc(2025, 1, 31) && e.exDate <= utc(2025, 12, 31))
  const expected = shares * inPeriod.reduce((sum, e) => sum + netAmount(e), 0)
  assert.ok(Math.abs(expected - shares * (0.5 + 0.85 + 0.5)) < 1e-9)
  assert.ok(Math.abs(result.totalDividendsReceived - expected) < 1e-6, `${result.totalDividendsReceived} ≠ ${expected}`)

  const credited = result.monthlyHistory
    .flatMap((month) => month.transactions)
    .filter((t) => t.transactionType === 'DIVIDEND_PAYMENT')
  assert.equal(credited.length, 3)
  assert.ok(Math.abs(credited.reduce((sum, t) => sum + t.contribution, 0) - expected) < 1e-6)

  // Preço constante: o valor final é o caixa que sobrou + ações + proventos mantidos em caixa
  const last = result.evolution[result.evolution.length - 1]
  const leftover = 10_000 - shares * 10 * (1 + BACKTEST_TRADING_COST_RATE)
  assert.ok(Math.abs(last.value - (shares * 10 + leftover + expected)) < 1e-6)
})

test('sem proventos no histórico, nada é creditado (o DY médio não gera dividendo)', () => {
  const result = simulate([])
  assert.equal(result.totalDividendsReceived, 0)
  assert.ok(result.monthlyHistory.every((month) => month.transactions.every((t) => t.transactionType !== 'DIVIDEND_PAYMENT')))
})

test('custos de 0,03% por operação são debitados', () => {
  const result = simulate([])
  const shares = Math.floor(10_000 / (10 * (1 + BACKTEST_TRADING_COST_RATE)))
  assert.ok(Math.abs(result.totalTradingCosts - shares * 10 * BACKTEST_TRADING_COST_RATE) < 1e-9)
})

test('janela de data-com: (após, até], por dia', () => {
  const events: BacktestDividend[] = [
    { exDate: utc(2025, 3, 31), amountPerShare: 1 },
    { exDate: utc(2025, 4, 1), amountPerShare: 2 },
    { exDate: utc(2025, 4, 30), amountPerShare: 4 },
  ]
  assert.equal(dividendsInWindow(events, new Date(Date.UTC(2025, 2, 31, 23, 59)), new Date(Date.UTC(2025, 3, 30, 23, 59))), 6)
})

test('desdobramento não refletido no fechamento vira fator de capital; proventos não', () => {
  // 2:1 em março: o fechamento cai à metade, o ajustado não. Pequena diferença em fevereiro = provento.
  const series = buildCapitalAdjustedSeries([
    { date: utc(2025, 1, 1), close: 20, adjustedClose: 9.5 },
    { date: utc(2025, 2, 1), close: 20, adjustedClose: 9.8 },
    { date: utc(2025, 3, 1), close: 10, adjustedClose: 10 },
    { date: utc(2025, 4, 1), close: 11, adjustedClose: 11 },
  ])
  assert.deepEqual(series.prices.map((p) => Number(p.price.toFixed(6))), [10, 10, 10, 11])
  assert.equal(series.factorAt(utc(2025, 1, 20)), 0.5) // provento de janeiro (antes do desdobramento) vale metade por ação nova
  assert.equal(series.factorAt(utc(2025, 3, 20)), 1)

  // Fechamento já ajustado por desdobramento (padrão do Yahoo): nada muda
  const yahoo = buildCapitalAdjustedSeries([
    { date: utc(2025, 1, 1), close: 10, adjustedClose: 9.5 },
    { date: utc(2025, 2, 1), close: 10.2, adjustedClose: 9.9 },
  ])
  assert.deepEqual(yahoo.prices.map((p) => p.price), [10, 10.2])
})
