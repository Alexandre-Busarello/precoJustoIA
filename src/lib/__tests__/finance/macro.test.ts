import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MACRO_FALLBACK,
  annualizeDailyRate,
  buildMacroAssumptions,
  compoundMonthlyRates,
  computeKe,
  getMacroAssumptionsSync,
  keFromMacro,
  nominalRiskFree,
  parseSgsDate,
} from '../../finance/macro'

const now = new Date('2026-09-29T12:00:00.000Z')
const daysAgo = (n: number) => new Date(Date.UTC(2026, 8, 29 - n))

test('taxa livre de risco nominal = (1 + NTN-B real) × (1 + IPCA) − 1', () => {
  assert.equal(Number(nominalRiskFree(0.0768, 0.04).toFixed(6)), 0.119872)
})

test('computeKe = rf + β × ERP, nunca abaixo da Selic', () => {
  assert.equal(computeKe({ rfNominal: 0.119872, erp: 0.055, selic: 0.1375 }), 0.174872)
  assert.equal(computeKe({ rfNominal: 0.119872, beta: 1.2, erp: 0.055, selic: 0.1375 }), 0.185872)
  assert.equal(computeKe({ rfNominal: 0.05, erp: 0.05, selic: 0.1375 }), 0.1375)
  assert.equal(computeKe({ rfNominal: 0.05, erp: 0.05 }), MACRO_FALLBACK.selic)
})

test('keFromMacro com o fallback dá ~17,5%', () => {
  assert.equal(keFromMacro(MACRO_FALLBACK), 0.174872)
})

test('snapshot síncrono começa no fallback', () => {
  const snapshot = getMacroAssumptionsSync()
  assert.equal(snapshot.selic, MACRO_FALLBACK.selic)
  assert.equal(snapshot.sources.selic.source, 'fallback')
  assert.equal(snapshot.asOf, MACRO_FALLBACK.asOf)
})

test('conversões de unidade das séries SGS', () => {
  assert.equal(Number(annualizeDailyRate(0.050788).toFixed(4)), 0.1365)
  assert.equal(Number(compoundMonthlyRates(Array(12).fill(0.33)).toFixed(4)), 0.0403)
  assert.equal(parseSgsDate('16/09/2026')?.toISOString(), '2026-09-16T00:00:00.000Z')
  assert.equal(parseSgsDate('2026-09-16'), null)
})

test('buildMacroAssumptions usa o banco quando o dado é recente e plausível', () => {
  const ipca = Array.from({ length: 12 }, (_, i) => ({ date: new Date(Date.UTC(2025, 8 + i, 1)), value: 0.33 }))
  const result = buildMacroAssumptions(
    {
      selic: [{ date: daysAgo(5), value: 14.25 }, { date: daysAgo(1), value: 13.75 }],
      cdi: [{ date: daysAgo(1), value: 0.050788 }],
      ipca,
    },
    now
  )
  assert.equal(result.selic, 0.1375)
  assert.equal(result.sources.selic.source, 'db')
  assert.equal(result.sources.selic.symbol, 'BCB_SGS_432')
  assert.equal(result.sources.selic.asOf, '2026-09-28')
  assert.equal(Number(result.cdi.toFixed(4)), 0.1365)
  assert.equal(result.sources.cdi.source, 'db')
  assert.equal(Number(result.ipcaExpected.toFixed(4)), 0.0403)
  assert.equal(result.sources.ipcaExpected.asOf, '2026-08-01')
  // Sem dado no banco: fallback por campo.
  assert.equal(result.ntnbRealLong, MACRO_FALLBACK.ntnbRealLong)
  assert.equal(result.sources.ntnbRealLong.source, 'fallback')
  assert.equal(result.erp, MACRO_FALLBACK.erp)
  assert.equal(result.asOf, '2026-09-28')
})

test('buildMacroAssumptions descarta dado velho, implausível ou IPCA com menos de 12 meses', () => {
  const result = buildMacroAssumptions(
    {
      selic: [{ date: daysAgo(60), value: 13.75 }],
      cdi: [{ date: daysAgo(1), value: 5 }], // 5% ao dia: fora da faixa
      ipca: [{ date: new Date(Date.UTC(2026, 7, 1)), value: 0.4 }],
      ntnbRealLong: [{ date: daysAgo(2), value: 7.5 }],
    },
    now
  )
  assert.equal(result.sources.selic.source, 'fallback')
  assert.equal(result.sources.cdi.source, 'fallback')
  assert.equal(result.sources.ipcaExpected.source, 'fallback')
  assert.equal(result.ntnbRealLong, 0.075)
  assert.equal(result.sources.ntnbRealLong.source, 'db')
})

test('buildMacroAssumptions ignora datas futuras (meta Selic publicada até o próximo Copom)', () => {
  const result = buildMacroAssumptions(
    { selic: [{ date: daysAgo(1), value: 13.75 }, { date: daysAgo(-30), value: 12 }] },
    now
  )
  assert.equal(result.selic, 0.1375)
  assert.equal(result.sources.selic.asOf, '2026-09-28')
})

test('buildMacroAssumptions exige 12 meses consecutivos de IPCA', () => {
  const withGap = Array.from({ length: 12 }, (_, i) => ({ date: new Date(Date.UTC(2025, 6 + i + (i > 5 ? 2 : 0), 1)), value: 0.3 }))
  const result = buildMacroAssumptions({ ipca: withGap }, now)
  assert.equal(result.sources.ipcaExpected.source, 'fallback')
})
