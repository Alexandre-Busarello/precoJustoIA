import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marginOfSafety, upside, valuationStatus, valuationStatusLabel } from '../valuation-metrics'

test('marginOfSafety: PJ 100, preço 75 → 0,25', () => {
  assert.equal(marginOfSafety(75, 100), 0.25)
})

test('upside: PJ 100, preço 75 → 0,3333', () => {
  const value = upside(75, 100)
  assert.ok(value !== null)
  assert.equal(Number(value.toFixed(4)), 0.3333)
})

test('preço acima do justo dá margem e upside negativos', () => {
  assert.equal(marginOfSafety(125, 100), -0.25)
  assert.equal(Number(upside(125, 100)?.toFixed(4)), -0.2)
})

test('valores ausentes, zero ou negativos devolvem null', () => {
  assert.equal(marginOfSafety(null, 100), null)
  assert.equal(marginOfSafety(75, undefined), null)
  assert.equal(marginOfSafety(75, 0), null)
  assert.equal(upside(0, 100), null)
  assert.equal(upside(Number.NaN, 100), null)
  assert.equal(upside(75, -10), null)
})

test('valuationStatus usa faixa de ±5%', () => {
  assert.equal(valuationStatus(0.25), 'below')
  assert.equal(valuationStatus(0.05), 'below')
  assert.equal(valuationStatus(0.049), 'within')
  assert.equal(valuationStatus(-0.049), 'within')
  assert.equal(valuationStatus(-0.05), 'above')
  assert.equal(valuationStatus(null), null)
  assert.equal(valuationStatus(Number.NaN), null)
})

test('valuationStatusLabel devolve os rótulos pt-BR', () => {
  assert.equal(valuationStatusLabel(0.3), 'Abaixo do preço justo')
  assert.equal(valuationStatusLabel(0), 'Dentro da faixa estimada')
  assert.equal(valuationStatusLabel(-0.3), 'Acima do preço justo')
  assert.equal(valuationStatusLabel(undefined), null)
})

test('valuationStatus segue a margem exibida (1 casa em %)', () => {
  // 4,99% aparece como 5,0%: não pode ser rotulado "Dentro da faixa estimada".
  assert.equal(valuationStatus(0.0499), 'below')
  assert.equal(valuationStatus(-0.0499), 'above')
  assert.equal(valuationStatus(0.0494), 'within')
})
