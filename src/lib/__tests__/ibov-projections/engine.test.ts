import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildIbovProjection,
  calibrate,
  estimateAt,
  horizonLogReturns,
  percentile,
  quantilesOf,
  sanitizeCloses,
  scaleQuantiles,
  staleInfo,
  stdev,
  trailingVolatilities,
  volatilityScale,
  weekdaysBetween,
  type DailyClose,
} from '../../ibov-projections/engine'

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`)

/** Gerador determinístico (LCG) para séries sintéticas reprodutíveis. */
function lcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/** Série de pregões em dias úteis a partir de 2010-01-04, com retornos diários aleatórios de desvio `sigma`. */
function syntheticSeries(days: number, { seed = 7, sigma = 0.012, drift = 0.0003, start = 100_000 } = {}): DailyClose[] {
  const rand = lcg(seed)
  const out: DailyClose[] = []
  let value = start
  const date = new Date(Date.UTC(2010, 0, 4))
  while (out.length < days) {
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) {
      out.push({ date: date.toISOString().slice(0, 10), close: value })
      // soma de 3 uniformes ~ aproximadamente normal, centrada em 0 com desvio 0,5
      const shock = (rand() + rand() + rand() - 1.5) * 2
      value *= Math.exp(drift + sigma * shock)
    }
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return out
}

test('percentile interpola linearmente (critério R tipo 7)', () => {
  const sorted = [1, 2, 3, 4, 5]
  assert.equal(percentile(sorted, 0), 1)
  assert.equal(percentile(sorted, 1), 5)
  assert.equal(percentile(sorted, 0.5), 3)
  close(percentile(sorted, 0.16), 1.64)
  close(percentile(sorted, 0.95), 4.8)
  assert.ok(Number.isNaN(percentile([], 0.5)))
  const q = quantilesOf([5, 1, 4, 2, 3])
  const expected = { p5: 1.2, p16: 1.64, p50: 3, p84: 4.36, p95: 4.8 }
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) close(q[key], expected[key])
})

test('horizonLogReturns usa todas as janelas sobrepostas', () => {
  const values = [100, 110, 121, 133.1]
  const r1 = horizonLogReturns(values, 1)
  assert.equal(r1.length, 3)
  r1.forEach((r) => close(r, Math.log(1.1)))
  const r2 = horizonLogReturns(values, 2)
  assert.equal(r2.length, 2)
  r2.forEach((r) => close(r, Math.log(1.21)))
  assert.deepEqual(horizonLogReturns(values, 2, 1), [Math.log(133.1 / 110)])
  assert.deepEqual(horizonLogReturns(values, 5), [])
})

test('sanitizeCloses remove inválidos, ordena e deduplica', () => {
  const out = sanitizeCloses([
    { date: '2026-01-03', close: 3 },
    { date: '2026-01-01', close: 1 },
    { date: 'invalida', close: 9 },
    { date: '2026-01-02', close: Number.NaN },
    { date: '2026-01-02', close: -5 },
    { date: '2026-01-03', close: 4 },
  ])
  assert.deepEqual(out, [
    { date: '2026-01-01', close: 1 },
    { date: '2026-01-03', close: 4 },
  ])
})

test('trailingVolatilities confere com o desvio-padrão direto', () => {
  const values = syntheticSeries(200).map((c) => c.close)
  const vols = trailingVolatilities(values, 63)
  assert.equal(vols[62], null)
  assert.notEqual(vols[63], null)
  const returns = values.slice(1).map((v, i) => Math.log(v / values[i]))
  close(vols[63]!, stdev(returns.slice(0, 63)), 1e-12)
  close(vols[199]!, stdev(returns.slice(199 - 63, 199)), 1e-12)
})

test('fator de volatilidade é limitado a 0,7–1,5', () => {
  assert.equal(volatilityScale(0.03, 0.01).applied, 1.5)
  assert.equal(volatilityScale(0.03, 0.01).ratio, 3)
  assert.equal(volatilityScale(0.001, 0.01).applied, 0.7)
  close(volatilityScale(0.012, 0.01).applied, 1.2)
  assert.equal(volatilityScale(null, 0.01).applied, 1)
  assert.equal(volatilityScale(0.01, 0).applied, 1)
  const scaled = scaleQuantiles({ p5: -0.1, p16: -0.05, p50: 0.01, p84: 0.07, p95: 0.12 }, 1.5)
  close(scaled.p50, 0.01)
  close(scaled.p16, 0.01 - 0.06 * 1.5)
  close(scaled.p95, 0.01 + 0.11 * 1.5)
})

test('weekdaysBetween e staleInfo sinalizam fechamento antigo', () => {
  // sexta → segunda: 1 dia útil
  assert.equal(weekdaysBetween('2026-10-02', '2026-10-05'), 1)
  assert.equal(weekdaysBetween('2026-10-05', '2026-10-05'), 0)
  assert.equal(weekdaysBetween('2026-10-05', '2026-10-01'), 0)
  // pregão de hoje ainda aberto: o próprio dia não conta como atraso
  assert.deepEqual(staleInfo('2026-10-07', '2026-10-08', false), { isStale: false, tradingDaysSinceClose: 0 })
  assert.deepEqual(staleInfo('2026-10-07', '2026-10-08', true), { isStale: false, tradingDaysSinceClose: 1 })
  // fim de semana: sexta continua atual
  assert.equal(staleInfo('2026-10-02', '2026-10-04', true).isStale, false)
  // 4 pregões sem fechamento novo
  assert.deepEqual(staleInfo('2026-10-01', '2026-10-07', true), { isStale: true, tradingDaysSinceClose: 4 })
  assert.equal(staleInfo('2026-10-02', '2026-10-07', true).isStale, false)
  assert.equal(staleInfo(null, '2026-10-07', true).isStale, true)
})

test('estimateAt exige amostra mínima e respeita a janela de 10 anos', () => {
  const values = syntheticSeries(3000).map((c) => c.close)
  assert.equal(estimateAt(values.slice(0, 200), 199, 5, { volatilityAdjusted: false }), null)
  const estimate = estimateAt(values, values.length - 1, 5, { volatilityAdjusted: false })
  assert.ok(estimate)
  // 2520 pregões de janela → 2520 - 5 + 1 janelas
  assert.equal(estimate.sampleSize, 2516)
  const manual = quantilesOf(horizonLogReturns(values, 5, values.length - 1 - 2520))
  assert.deepEqual(estimate.rawLogQuantiles, manual)
  assert.deepEqual(estimate.logQuantiles, manual)
})

test('mesma entrada gera os mesmos números', () => {
  const series = syntheticSeries(3200)
  const options = { today: '2022-06-30', sessionClosed: true }
  assert.deepEqual(buildIbovProjection(series, options), buildIbovProjection(series, options))
})

test('faixas fazem sentido em série sintética de volatilidade parecida com a do Ibovespa', () => {
  const series = syntheticSeries(3200)
  const last = series[series.length - 1]
  const report = buildIbovProjection(series, { today: last.date, sessionClosed: true })
  assert.equal(report.status, 'ok')
  assert.equal(report.lastClose, last.close)
  assert.equal(report.stale.isStale, false)
  const weekly = report.horizons.find((h) => h.id === 'WEEKLY')!
  assert.equal(weekly.status, 'ok')
  const width = weekly.returns!.p84 - weekly.returns!.p16
  assert.ok(width > 0.01 && width < 0.1, `largura semanal ${width}`)
  const { levels } = weekly
  assert.ok(levels!.p5 < levels!.p16 && levels!.p16 < levels!.p50 && levels!.p50 < levels!.p84 && levels!.p84 < levels!.p95)
  assert.ok(weekly.positiveShare! > 0 && weekly.positiveShare! < 1)
  // horizontes mais longos têm faixa mais larga
  const monthly = report.horizons.find((h) => h.id === 'MONTHLY')!
  const annual = report.horizons.find((h) => h.id === 'ANNUAL')!
  assert.ok(monthly.returns!.p84 - monthly.returns!.p16 > width)
  assert.ok(annual.returns!.p84 - annual.returns!.p16 > monthly.returns!.p84 - monthly.returns!.p16)
  assert.equal(report.cone.length, 8)
  assert.equal(report.history.length, 253)
})

test('histórico curto: horizonte sem amostra fica como insuficiente', () => {
  const series = syntheticSeries(400)
  const report = buildIbovProjection(series, { today: series[399].date, sessionClosed: true })
  const byId = Object.fromEntries(report.horizons.map((h) => [h.id, h]))
  assert.equal(byId.WEEKLY.status, 'ok')
  assert.equal(byId.ANNUAL.status, 'insufficient')
  assert.equal(byId.ANNUAL.levels, null)
  assert.equal(byId.WEEKLY.calibration.verdict, 'insufficient')
})

test('sem dados devolve no-data e marca como desatualizado', () => {
  const report = buildIbovProjection([], { today: '2026-10-08', sessionClosed: true })
  assert.equal(report.status, 'no-data')
  assert.equal(report.stale.isStale, true)
  assert.ok(report.horizons.every((h) => h.status === 'insufficient'))
})

test('calibração: série i.i.d. fica perto das coberturas nominais', () => {
  const values = syntheticSeries(4400, { seed: 11 }).map((c) => c.close)
  const result = calibrate(values, 5, { volatilityAdjusted: false })
  assert.ok(result.evaluations > 200)
  assert.ok(Math.abs(result.insideProbable! - 0.68) < 0.1, `p16–p84 ${result.insideProbable}`)
  assert.ok(Math.abs(result.insideWide! - 0.9) < 0.07, `p5–p95 ${result.insideWide}`)
  close(result.aboveProbable! + result.belowProbable! + result.insideProbable!, 1, 1e-9)
})

test('calibração detecta faixa estreita quando a volatilidade dobra no fim da série', () => {
  const calm = syntheticSeries(3400, { seed: 3, sigma: 0.008 })
  const lastCalm = calm[calm.length - 1].close
  const wild = syntheticSeries(1300, { seed: 5, sigma: 0.024, start: lastCalm }).slice(1)
  const values = [...calm.map((c) => c.close), ...wild.map((c) => c.close)]
  const raw = calibrate(values, 5, { volatilityAdjusted: false })
  assert.equal(raw.verdict, 'too-narrow')
  const adjusted = calibrate(values, 5, { volatilityAdjusted: true })
  assert.ok(adjusted.insideProbable! > raw.insideProbable!, 'o ajuste de volatilidade melhora a cobertura')
})

test('calibração com poucos períodos independentes não dá veredito', () => {
  const values = syntheticSeries(4400, { seed: 13 }).map((c) => c.close)
  const annual = calibrate(values, 252, { volatilityAdjusted: true })
  assert.ok(annual.evaluations > 0)
  assert.equal(annual.independentPeriods, 5)
  assert.equal(annual.verdict, 'insufficient')
})
