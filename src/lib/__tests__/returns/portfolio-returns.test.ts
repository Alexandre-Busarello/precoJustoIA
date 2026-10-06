import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  annualizeReturn,
  cdiLevel,
  computeTwr,
  ipcaLevel,
  periodReturnsBetween,
  returnBetween,
  sharpeRatio,
  simulateWithFlows,
  xirr,
  type BenchmarkDataPoint,
  type ValuationPoint,
} from '../../benchmark-service'

/** CDI diário sintético (dias úteis de seg. a sex.), com a taxa variando ao longo do período. */
function syntheticCdi(from: string, to: string): BenchmarkDataPoint[] {
  const points: BenchmarkDataPoint[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`), i = 0; t <= end; t += 86_400_000) {
    const day = new Date(t).getUTCDay()
    if (day === 0 || day === 6) continue
    points.push({ date: new Date(t).toISOString().slice(0, 10), value: 0.045 + 0.01 * Math.sin(i++ / 40) })
  }
  return points
}

function monthStarts(fromYear: number, fromMonth: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(fromYear, fromMonth - 1 + i, 1)).toISOString().slice(0, 10))
}

test('carteira que rende exatamente o CDI tem Sharpe ≈ 0 (mesmo com aportes)', () => {
  const dates = monthStarts(2024, 1, 25)
  const cdi = syntheticCdi('2023-12-01', '2026-02-01')
  const level = cdiLevel(cdi)

  // Patrimônio cresce pelo CDI; aporte de R$ 1.000 a cada 3 meses
  const points: ValuationPoint[] = []
  let value = 0
  dates.forEach((date, i) => {
    if (i > 0) value *= 1 + (returnBetween(level, dates[i - 1], date) ?? 0)
    const flow = i === 0 ? 10_000 : i % 3 === 0 ? 1_000 : 0
    value += flow
    points.push({ date, value, flow })
  })

  const twr = computeTwr(points)
  const portfolioReturns = twr.periodReturns.map((p) => p.return)
  const cdiReturns = periodReturnsBetween(level, dates) as number[]
  assert.equal(portfolioReturns.length, cdiReturns.length)

  const sharpe = sharpeRatio(portfolioReturns, cdiReturns)
  assert.ok(sharpe !== null)
  assert.ok(Math.abs(sharpe) < 0.05, `Sharpe ${sharpe}`)

  // Com taxa livre de risco zero (erro antigo) o mesmo caso daria um Sharpe enorme
  const zeroRf = sharpeRatio(portfolioReturns, portfolioReturns.map(() => 0))
  assert.ok(zeroRf !== null && zeroRf > 10)
})

test('XIRR: caso conhecido (exemplo da documentação do Excel) = 37,34% a.a.', () => {
  const rate = xirr([
    { date: '2008-01-01', amount: -10_000 },
    { date: '2008-03-01', amount: 2_750 },
    { date: '2008-10-30', amount: 4_250 },
    { date: '2009-02-15', amount: 3_250 },
    { date: '2009-04-01', amount: 2_750 },
  ])
  assert.ok(rate !== null)
  assert.ok(Math.abs(rate - 0.373362535) < 1e-6, `XIRR ${rate}`)
})

test('XIRR: um aporte e um resgate um ano depois', () => {
  const rate = xirr([
    { date: '2025-01-01', amount: -1_000 },
    { date: '2026-01-01', amount: 1_100 },
  ])
  assert.ok(rate !== null && Math.abs(rate - 0.1) < 1e-9)
  assert.equal(xirr([{ date: '2025-01-01', amount: -1_000 }]), null)
})

test('TWR com aporte no meio do período é igual ao retorno da cota', () => {
  // Cota: 1,00 → 1,10 (+10%) → 0,99 (−10%) → 1,089 (+10%)
  const points: ValuationPoint[] = [
    { date: '2025-01-01', value: 1_000, flow: 1_000 },
    { date: '2025-02-01', value: 1_100 + 5_000, flow: 5_000 }, // aporte depois de +10%
    { date: '2025-03-01', value: 6_100 * 0.9, flow: 0 },
    { date: '2025-04-01', value: 6_100 * 0.9 * 1.1, flow: 0 },
  ]
  const twr = computeTwr(points)
  const quotaReturn = 1.1 * 0.9 * 1.1 - 1
  assert.ok(Math.abs(twr.cumulative - quotaReturn) < 1e-12)
  assert.deepEqual(
    twr.periodReturns.map((p) => Number(p.return.toFixed(10))),
    [0.1, -0.1, 0.1]
  )

  // O retorno sobre o capital investido é outro número (o aporte grande pegou a queda)
  const capitalReturn = points[3].value / 6_000 - 1
  assert.ok(Math.abs(capitalReturn - quotaReturn) > 0.05)
})

test('TWR com resgate: resgatar não muda a cota', () => {
  const twr = computeTwr([
    { date: '2025-01-01', value: 10_000, flow: 10_000 },
    { date: '2025-02-01', value: 11_000 - 4_000, flow: -4_000 },
    { date: '2025-03-01', value: 7_000 * 1.05, flow: 0 },
  ])
  assert.ok(Math.abs(twr.cumulative - (1.1 * 1.05 - 1)) < 1e-12)
})

test('CDI composto dia a dia (não pela média do mês)', () => {
  const cdi: BenchmarkDataPoint[] = [
    { date: '2025-01-02', value: 0.04 },
    { date: '2025-01-03', value: 0.05 },
    { date: '2025-01-06', value: 0.06 },
  ]
  const level = cdiLevel(cdi)
  const expected = 1.0004 * 1.0005 * 1.0006 - 1
  assert.ok(Math.abs((returnBetween(level, '2025-01-01', '2025-01-07') ?? 0) - expected) < 1e-15)
  // A taxa do dia rende até o dia útil seguinte: entre 02/01 e 03/01 só conta a de 02/01
  assert.ok(Math.abs((returnBetween(level, '2025-01-02', '2025-01-03') ?? 0) - 0.0004) < 1e-15)
})

test('IPCA e IPCA + 6% acumulados por mês encerrado', () => {
  const ipca: BenchmarkDataPoint[] = [
    { date: '2025-01-01', value: 0.5 },
    { date: '2025-02-01', value: 1.0 },
  ]
  assert.ok(Math.abs((returnBetween(ipcaLevel(ipca), '2025-01-01', '2025-03-01') ?? 0) - (1.005 * 1.01 - 1)) < 1e-12)
  // Fevereiro ainda não terminou em 15/02
  assert.ok(Math.abs((returnBetween(ipcaLevel(ipca), '2025-01-01', '2025-02-15') ?? 0) - 0.005) < 1e-12)
  const plus = returnBetween(ipcaLevel(ipca, 0.06), '2025-01-01', '2025-03-01') ?? 0
  assert.ok(Math.abs(plus - (1.005 * 1.01 * 1.06 ** (2 / 12) - 1)) < 1e-12)
})

test('benchmark simulado com os mesmos aportes', () => {
  const cdi = syntheticCdi('2025-01-01', '2025-04-01')
  const level = cdiLevel(cdi)
  const dates = ['2025-01-31', '2025-02-28', '2025-03-31']
  const values = simulateWithFlows(level, [
    { date: '2025-01-01', amount: 1_000 },
    { date: '2025-02-01', amount: 100 },
    { date: '2025-03-01', amount: 100 },
  ], dates)
  const growth = (a: string, b: string) => 1 + (returnBetween(level, a, b) ?? 0)
  const expectedJan = 1_000 * growth('2025-01-01', '2025-01-31')
  const expectedFeb = (expectedJan * growth('2025-01-31', '2025-02-01') + 100) * growth('2025-02-01', '2025-02-28')
  assert.ok(Math.abs(values[0] - expectedJan) < 1e-9)
  assert.ok(Math.abs(values[1] - expectedFeb) < 1e-9)
  assert.ok(values[2] > values[1] + 100)
})

test('anualização só a partir de um ano', () => {
  assert.equal(annualizeReturn(0.05, 200), null)
  assert.ok(Math.abs((annualizeReturn(0.21, 730) ?? 0) - 0.1) < 1e-3)
})
