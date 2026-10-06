import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sgsWindows, type BenchmarkDataPoint } from '../../benchmark-service'
import {
  AdaptiveBacktestService,
  BACKTEST_TRADING_COST_RATE,
  buildCapitalAdjustedSeries,
  computeBenchmarkSeries,
  snapshotPeriod,
  type BacktestParams,
} from '../../adaptive-backtest-service'
import type { DataAvailability } from '../../backtest-data-validator'

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

function dailyCdi(from: string, to: string, rate: number): BenchmarkDataPoint[] {
  const points: BenchmarkDataPoint[] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const day = new Date(t).getUTCDay()
    if (day !== 0 && day !== 6) points.push({ date: new Date(t).toISOString().slice(0, 10), value: rate })
  }
  return points
}

test('SGS: blocos fixos de 5 anos civis, contíguos (o BCB recusa mais de 10 anos por consulta)', () => {
  const windows = sgsWindows('2001-03-15', '2026-09-30')
  assert.deepEqual(windows, [
    { start: '2000-01-01', end: '2004-12-31' },
    { start: '2005-01-01', end: '2009-12-31' },
    { start: '2010-01-01', end: '2014-12-31' },
    { start: '2015-01-01', end: '2019-12-31' },
    { start: '2020-01-01', end: '2024-12-31' },
    { start: '2025-01-01', end: '2026-09-30' },
  ])
  // Mesmos blocos para períodos diferentes: aproveita o cache
  assert.deepEqual(sgsWindows('2003-07-01', '2004-01-31'), [{ start: '2000-01-01', end: '2004-01-31' }])
  assert.deepEqual(sgsWindows('2024-01-01', '2024-01-01'), [{ start: '2020-01-01', end: '2024-01-01' }])
})

test('período do mês simulado: compra no fechamento de M, avaliação no fechamento de M+1', () => {
  assert.deepEqual(snapshotPeriod({ date: utc(2025, 3, 31) }), { start: '2025-04-01', end: '2025-05-01' })
  assert.deepEqual(
    snapshotPeriod({ date: utc(2025, 3, 31), periodStart: '2025-04-01', periodEnd: '2025-04-20' }),
    { start: '2025-04-01', end: '2025-04-20' }
  )
})

test('benchmarks do backtest: CDI desde o primeiro aporte, mês a mês, e Ibovespa no mesmo período', () => {
  const evolution = [
    { date: utc(2025, 1, 31), contribution: 1_000 },
    { date: utc(2025, 2, 28), contribution: 1_000 },
    { date: utc(2025, 3, 31), contribution: 1_000 },
  ]
  const cdi = dailyCdi('2025-01-01', '2025-05-31', 0.05)
  const ibov: BenchmarkDataPoint[] = [
    { date: '2025-01-31', value: 100 },
    { date: '2025-02-28', value: 110 },
    { date: '2025-03-31', value: 121 },
    { date: '2025-04-30', value: 121 },
  ]
  const series = computeBenchmarkSeries(evolution, 10_000, cdi, ibov)

  // CDI de cada mês: todos os dias úteis do mês seguinte ao rótulo (nenhum mês fica com 0%)
  const businessDays = (from: string, to: string) => dailyCdi(from, to, 0).length
  const expectedReturns = [
    1.0005 ** businessDays('2025-02-01', '2025-02-28') - 1,
    1.0005 ** businessDays('2025-03-01', '2025-03-31') - 1,
    1.0005 ** businessDays('2025-04-01', '2025-04-30') - 1,
  ]
  assert.ok(series.cdiReturns)
  series.cdiReturns!.forEach((value, i) => assert.ok(Math.abs(value - expectedReturns[i]) < 1e-12, `mês ${i}`))
  assert.ok(series.cdiReturns!.every((value) => value > 0))

  // Saldo no CDI com os mesmos aportes: 11.000 no 1º mês, +1.000 a cada mês
  let balance = 0
  const expectedValues = [11_000, 1_000, 1_000].map((flow, i) => (balance = (balance + flow) * (1 + expectedReturns[i])))
  series.cdiValues!.forEach((value, i) => assert.ok(Math.abs(value - expectedValues[i]) < 1e-6))

  // Ibovespa: aporte no fechamento de jan (100) e avaliação no de fev (110): +10% já no primeiro mês
  assert.ok(Math.abs(series.ibovValues![0] - 11_000 * 1.1) < 1e-6)
  assert.ok(Math.abs(series.ibovValues![1] - (11_000 * 1.1 + 1_000) * 1.1) < 1e-6)
})

test('sem CDI disponível, o Sharpe fica sem taxa livre de risco e o Ibovespa continua', () => {
  const series = computeBenchmarkSeries([{ date: utc(2025, 1, 31), contribution: 0 }], 1_000, [], [
    { date: '2025-01-31', value: 100 },
    { date: '2025-02-28', value: 90 },
  ])
  assert.equal(series.cdiReturns, null)
  assert.equal(series.cdiValues, null)
  assert.ok(Math.abs(series.ibovValues![0] - 900) < 1e-9)
})

test('simulação grava período, custos e proventos de cada mês (identifica a metodologia ao reabrir)', () => {
  const bars = buildCapitalAdjustedSeries(
    Array.from({ length: 6 }, (_, i) => ({ date: utc(2025, 1 + i, 1), close: 10, adjustedClose: 10 }))
  ).prices
  const availability: DataAvailability[] = [
    {
      ticker: 'TEST3',
      availableFrom: utc(2025, 1, 1),
      availableTo: utc(2025, 6, 1),
      totalMonths: 6,
      missingMonths: 0,
      dataQuality: 'excellent',
      warnings: [],
    },
  ]
  const params: BacktestParams = {
    assets: [{ ticker: 'TEST3', allocation: 1 }],
    startDate: utc(2025, 1, 15),
    endDate: utc(2025, 4, 15),
    initialCapital: 10_000,
    monthlyContribution: 0,
    rebalanceFrequency: 'monthly',
  }
  const service = new AdaptiveBacktestService()
  const log = console.log
  console.log = () => {}
  let result
  try {
    result = service.simulateAdaptivePortfolio(new Map([['TEST3', bars]]), params, availability, new Map())
  } finally {
    console.log = log
  }
  const first = result.evolution[0]
  assert.equal(first.periodStart, '2025-02-01')
  assert.equal(first.periodEnd, '2025-03-01')
  const shares = Math.floor(10_000 / (10 * (1 + BACKTEST_TRADING_COST_RATE)))
  assert.ok(Math.abs((first.tradingCosts ?? 0) - shares * 10 * BACKTEST_TRADING_COST_RATE) < 1e-9)
  assert.equal(first.dividends, 0)
  // Meses consecutivos: o fim de um é o início do seguinte
  for (let i = 1; i < result.evolution.length; i++) {
    assert.equal(result.evolution[i].periodStart, result.evolution[i - 1].periodEnd)
  }
})
