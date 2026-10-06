import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDividendMonths,
  buildMonthWindow,
  flattenEvents,
  formatDateOnly,
  monthDotState,
  monthLabel,
  monthTotal,
  monthsAheadForPeriod,
  nextExDateEvent,
  perShareDigits,
  trailingTwelveMonthsTotal,
} from '../dividend-months'

const now = new Date(2026, 8, 30) // 30 set. 2026

test('janela: 4 meses passados, mês atual e 7 futuros (12 meses)', () => {
  const months = buildMonthWindow(now)
  assert.equal(months.length, 12)
  assert.equal(months[0].key, '2026-05')
  assert.equal(months[4].key, '2026-09')
  assert.equal(months[4].isCurrent, true)
  assert.equal(months[3].isPast, true)
  assert.equal(months[11].key, '2027-04')
})

test('período muda os meses à frente (limitado à janela de 12 meses)', () => {
  assert.equal(monthsAheadForPeriod('3'), 3)
  assert.equal(monthsAheadForPeriod('6'), 6)
  assert.equal(monthsAheadForPeriod('12'), 7)
  assert.equal(monthsAheadForPeriod(undefined), 7)
  assert.equal(buildDividendMonths([], [], now, { future: monthsAheadForPeriod('3') }).length, 8)
})

test('agrupa confirmados e projetados por mês, mantendo todos os eventos do mês', () => {
  const months = buildDividendMonths(
    [
      { month: 8, year: 2026, exDate: '2026-08-05T00:00:00.000Z', amount: 0.5 },
      { month: 8, year: 2026, exDate: '2026-08-20T00:00:00.000Z', amount: 0.25, paymentDate: '2026-09-10T00:00:00.000Z', type: 'JCP' },
    ],
    [{ month: 11, year: 2026, projectedExDate: '2026-11-15', projectedAmount: 0.6, confidence: 70 }],
    now
  )
  const aug = months.find((m) => m.key === '2026-08')
  const nov = months.find((m) => m.key === '2026-11')
  assert.ok(aug && nov)
  assert.equal(aug.events.length, 2)
  assert.equal(monthDotState(aug), 'confirmed')
  assert.equal(monthTotal(aug), 0.75)
  assert.equal(aug.events[1].type, 'JCP')
  assert.equal(aug.events[1].paymentDate, '2026-09-10T00:00:00.000Z')
  assert.equal(monthDotState(nov), 'projected')
  assert.equal(nov.events[0].confidence, 70)
  assert.equal(monthDotState(months[0]), 'none')
  assert.equal(monthTotal(months[0]), null)
})

test('data ex de 1º do mês (meia-noite UTC) fica no mês certo', () => {
  const months = buildDividendMonths([{ month: 7, year: 2026, exDate: '2026-08-01T00:00:00.000Z', amount: 1 }], [], now)
  assert.equal(months.find((m) => m.key === '2026-08')?.events.length, 1)
  assert.equal(months.find((m) => m.key === '2026-07')?.events.length, 0)
})

test('mês confirmado não soma projeção (caso PETR4 set. 2026: 1,58 confirmado + 1,59 projetado)', () => {
  const confirmed = [{ month: 9, year: 2026, exDate: '2026-09-17T00:00:00.000Z', amount: 1.584836 }]
  const projected = [{ month: 9, year: 2026, projectedExDate: '2026-09-28', projectedAmount: 1.5927, confidence: 80 }]
  const sep = buildDividendMonths(confirmed, projected, now).find((m) => m.isCurrent)
  assert.ok(sep)
  assert.equal(monthDotState(sep), 'confirmed')
  assert.deepEqual(sep.events.map((e) => e.kind), ['confirmed'])
  assert.equal(monthTotal(sep), 1.584836)
  // A tabela também não lista a projeção já confirmada
  assert.deepEqual(flattenEvents(confirmed, projected, now).map((e) => e.kind), ['confirmed'])
})

test('projeção com data ex estimada já passada é descartada; futura no mesmo mês de outra confirmada também', () => {
  const stale = [{ month: 9, year: 2026, projectedExDate: '2026-09-28', projectedAmount: 1, confidence: 80 }]
  const sep = buildDividendMonths([], stale, now).find((m) => m.isCurrent)
  assert.equal(sep && monthDotState(sep), 'none')
  assert.equal(flattenEvents([], stale, now).length, 0)
  const oct = buildDividendMonths(
    [{ month: 10, year: 2026, exDate: '2026-10-02T00:00:00.000Z', amount: 0.4 }],
    [{ month: 10, year: 2026, projectedExDate: '2026-10-20', projectedAmount: 0.5, confidence: 70 }],
    now
  ).find((m) => m.key === '2026-10')
  assert.equal(oct && monthTotal(oct), 0.4)
})

test('monthTotal nunca mistura estimativa com confirmado', () => {
  const mixed = {
    events: [
      { kind: 'confirmed' as const, exDate: '2026-09-02T00:00:00.000Z', paymentDate: null, amount: 1, type: null, confidence: null },
      { kind: 'projected' as const, exDate: '2026-09-29T00:00:00.000Z', paymentDate: null, amount: 2, type: null, confidence: 60 },
    ],
  }
  assert.equal(monthTotal(mixed), 1)
})

test('formatDateOnly não volta um dia no fuso de Brasília', () => {
  assert.equal(formatDateOnly('2026-08-15T00:00:00.000Z'), '15 ago. 2026')
  assert.equal(formatDateOnly('2026-11-15'), '15 nov. 2026')
  assert.equal(formatDateOnly(null), '—')
})

test('flattenEvents ordena do mais recente para o mais antigo', () => {
  const events = flattenEvents(
    [{ month: 1, year: 2025, exDate: '2025-01-10T00:00:00.000Z', amount: 1 }],
    [{ month: 11, year: 2026, projectedExDate: '2026-11-15', projectedAmount: 1, confidence: 50 }],
    now
  )
  assert.equal(events[0].kind, 'projected')
  assert.equal(events[1].kind, 'confirmed')
})

test('proventos dos últimos 12 meses e próxima data projetada', () => {
  const total = trailingTwelveMonthsTotal(
    [
      { month: 3, year: 2026, exDate: '2026-03-10T00:00:00.000Z', amount: 1 },
      { month: 8, year: 2025, exDate: '2025-08-10T00:00:00.000Z', amount: 5 },
      { month: 9, year: 2026, exDate: '2026-09-10T00:00:00.000Z', amount: 0.5 },
    ],
    now
  )
  assert.equal(total, 1.5)
  assert.equal(trailingTwelveMonthsTotal([], now), null)
  const projected = [
    { month: 8, year: 2026, projectedExDate: '2026-08-15', projectedAmount: 1, confidence: 50 },
    { month: 12, year: 2026, projectedExDate: '2026-12-15', projectedAmount: 1, confidence: 50 },
    { month: 10, year: 2026, projectedExDate: '2026-10-15', projectedAmount: 1, confidence: 50 },
  ]
  const next = nextExDateEvent([], projected, now)
  assert.equal(next?.exDate.slice(0, 10), '2026-10-15')
  assert.equal(next?.kind, 'projected')
  // Provento já anunciado com data ex futura vem antes da projeção
  const announced = nextExDateEvent(
    [{ month: 10, year: 2026, exDate: '2026-10-06T00:00:00.000Z', amount: 0.7 }],
    projected,
    now
  )
  assert.equal(announced?.exDate.slice(0, 10), '2026-10-06')
  assert.equal(announced?.kind, 'confirmed')
  assert.equal(nextExDateEvent([], [], now), null)
})

test('rótulos e casas decimais', () => {
  assert.equal(monthLabel(9, 2026), 'Setembro de 2026')
  assert.equal(perShareDigits(0.1234), 4)
  assert.equal(perShareDigits(1.5), 2)
})
