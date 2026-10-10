import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  concentrationPenalty,
  costScore,
  effectiveReturn1y,
  isFixedIncomeBenchmark,
  toNullableNumber,
} from '../../etf-scoring-core'

test('ETF: taxa de administração 0 é a melhor nota, não dado ausente', () => {
  assert.equal(costScore(0), 100)
  assert.equal(costScore(null), null)
  assert.equal(costScore(0.015), 0)
  assert.ok(Math.abs((costScore(0.008) ?? 0) - 50) < 1e-9)
})

test('ETF: retorno de 0% em 12 meses é usado, sem cair no de 6 meses', () => {
  assert.equal(effectiveReturn1y({ return1y: 0, return6m: 0.1 }), 0)
  assert.ok(Math.abs((effectiveReturn1y({ return1y: null, return6m: 0.1 }) ?? 0) - 0.21) < 1e-9)
  assert.equal(effectiveReturn1y({ return1y: null, return6m: null }), null)
})

test('ETF: conversão numérica preserva o zero e só anula ausentes ou inválidos', () => {
  assert.equal(toNullableNumber(0), 0)
  assert.equal(toNullableNumber('0'), 0)
  assert.equal(toNullableNumber({ toString: () => '0.0035' }), 0.0035)
  assert.equal(toNullableNumber(null), null)
  assert.equal(toNullableNumber(undefined), null)
  assert.equal(toNullableNumber('abc'), null)
  assert.equal(toNullableNumber(''), null)
  assert.equal(toNullableNumber('  '), null)
})

test('ETF: penalidade de concentração só acima de 65% nos 5 maiores', () => {
  assert.equal(concentrationPenalty(null), 0)
  assert.equal(concentrationPenalty(0), 0)
  assert.equal(concentrationPenalty(0.65), 0)
  assert.equal(concentrationPenalty(1), 20)
})

test('ETF renda fixa: índices reconhecidos como palavra, sem falso positivo de "ima"', () => {
  for (const name of ['Selic', 'IPCA+ 2035', 'IMA-B', 'IMA-B 5+', 'IMAB11', 'IMA-S', 'IMA-Geral', 'IRF-M 1', 'IRFM1+', 'Índice B3 Selic']) {
    assert.equal(isFixedIncomeBenchmark(name), true, name)
  }
  for (const name of ['MSCI Climate Change', 'Maxima Dividend', 'Ibovespa', 'S&P 500', 'Imagem e Mídia', null, '']) {
    assert.equal(isFixedIncomeBenchmark(name), false, String(name))
  }
})
