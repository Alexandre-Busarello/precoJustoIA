import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_VALUE,
  formatBRL,
  formatBRLCompact,
  formatCompact,
  formatDate,
  formatDeltaPct,
  formatMultiple,
  formatNullable,
  formatNumber,
  formatPct,
} from '../format'

const NBSP = ' '
const MINUS = '−'

test('formatBRL', () => {
  assert.equal(formatBRL(48.56), `R$${NBSP}48,56`)
  assert.equal(formatBRL(1234567.891), `R$${NBSP}1.234.567,89`)
  assert.equal(formatBRL(0), `R$${NBSP}0,00`)
  assert.equal(formatBRL(-0.001), `R$${NBSP}0,00`)
  assert.equal(formatBRL(10, { digits: 0 }), `R$${NBSP}10`)
})

test('formatBRLCompact usa mi/bi/tri', () => {
  assert.equal(formatBRLCompact(625_680_000_000), `R$${NBSP}625,7 bi`)
  assert.equal(formatBRLCompact(29_338_560_000_000), `R$${NBSP}29,3 tri`)
  assert.equal(formatBRLCompact(12_500_000), `R$${NBSP}12,5 mi`)
  assert.equal(formatBRLCompact(-2_000_000_000), `${MINUS}R$${NBSP}2,0 bi`)
  assert.equal(formatBRLCompact(999_950_000), `R$${NBSP}1,0 bi`)
  assert.equal(formatBRLCompact(999_949_999), `R$${NBSP}999,9 mi`)
  assert.equal(formatBRLCompact(950_000), `R$${NBSP}950.000,00`)
})

test('formatCompact sem moeda', () => {
  assert.equal(formatCompact(1_500_000), '1,5 mi')
  assert.equal(formatCompact(1234), '1.234')
  assert.equal(formatCompact(950_000), '950.000')
  assert.equal(formatCompact(-1_500_000), `${MINUS}1,5 mi`)
  assert.equal(formatCompact(999_960_000_000), '1,0 tri')
})

test('formatPct recebe fração', () => {
  assert.equal(formatPct(0.126), '12,6%')
  assert.equal(formatPct(0.126, { digits: 2 }), '12,60%')
  assert.equal(formatPct(-0.0004), '0,0%')
  assert.equal(formatPct(1), '100,0%')
})

test('formatDeltaPct sempre com sinal e U+2212', () => {
  assert.equal(formatDeltaPct(-0.2159), `${MINUS}21,6%`)
  assert.equal(formatDeltaPct(0.05), '+5,0%')
  assert.equal(formatDeltaPct(0), '0,0%')
  assert.equal(formatDeltaPct(-0.00001), '0,0%')
})

test('formatMultiple', () => {
  assert.equal(formatMultiple(10.82), '10,8x')
  assert.equal(formatMultiple(0.5, { digits: 2 }), '0,50x')
})

test('formatNumber', () => {
  assert.equal(formatNumber(1234.5), '1.234,5')
  assert.equal(formatNumber(1234.5, { digits: 2 }), '1.234,50')
  assert.equal(formatNumber(1234.567, { digits: 0 }), '1.235')
})

test('formatDate curta, com hora e relativa', () => {
  const d = new Date('2026-09-29T16:00:00Z') // 13:00 em Brasília
  assert.equal(formatDate(d), '29 set. 2026')
  assert.equal(formatDate('2026-09-29T16:00:00Z', { style: 'datetime' }), '29 set. 2026, 13:00')
  const now = new Date('2026-10-04T16:00:00Z')
  assert.equal(formatDate(d, { style: 'relative', now }), 'há 5 dias')
  assert.equal(formatDate(new Date('2026-10-03T16:00:00Z'), { style: 'relative', now }), 'ontem')
  assert.equal(formatDate(new Date('2026-10-04T13:00:00Z'), { style: 'relative', now }), 'há 3 horas')
  assert.equal(formatDate(new Date('2026-10-04T15:59:30Z'), { style: 'relative', now }), 'agora')
  assert.equal(formatDate(new Date('2026-06-04T16:00:00Z'), { style: 'relative', now }), 'há 4 meses')
})

test('valores ausentes viram travessão em todas as funções', () => {
  for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatBRL(bad), EMPTY_VALUE)
    assert.equal(formatBRLCompact(bad), EMPTY_VALUE)
    assert.equal(formatCompact(bad), EMPTY_VALUE)
    assert.equal(formatPct(bad), EMPTY_VALUE)
    assert.equal(formatDeltaPct(bad), EMPTY_VALUE)
    assert.equal(formatMultiple(bad), EMPTY_VALUE)
    assert.equal(formatNumber(bad), EMPTY_VALUE)
  }
  assert.equal(formatDate(null), EMPTY_VALUE)
  assert.equal(formatDate('not a date'), EMPTY_VALUE)
  assert.equal(EMPTY_VALUE, '—')
})

test('formatNullable', () => {
  assert.equal(formatNullable(null, formatBRL), '—')
  assert.equal(formatNullable(undefined, formatPct), '—')
  assert.equal(formatNullable(Number.NaN, formatPct), '—')
  assert.equal(formatNullable(0.1, formatPct), '10,0%')
})

test('negativos usam U+2212 em todas as funções', () => {
  assert.equal(formatBRL(-500), `${MINUS}R$${NBSP}500,00`)
  assert.equal(formatBRLCompact(-500), `${MINUS}R$${NBSP}500,00`)
  assert.equal(formatPct(-0.126), `${MINUS}12,6%`)
  assert.equal(formatMultiple(-3.21), `${MINUS}3,2x`)
  assert.equal(formatNumber(-1234.5), `${MINUS}1.234,5`)
  assert.equal(formatCompact(-950_000), `${MINUS}950.000`)
  assert.ok(!formatBRL(-1).includes('-'))
})

test('arredondamento que chega a 1 milhão sobe para mi', () => {
  assert.equal(formatCompact(999_999.6), '1,0 mi')
  assert.equal(formatCompact(999_999.4), '999.999')
  assert.equal(formatBRLCompact(999_999.999), `R$${NBSP}1,0 mi`)
  assert.equal(formatBRLCompact(999_999.99), `R$${NBSP}999.999,99`)
})
