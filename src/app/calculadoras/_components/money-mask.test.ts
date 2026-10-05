import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskBRL, parseBRL, toMaskedBRL } from './money-mask'

test('maskBRL agrupa milhares e mantém até 2 casas decimais', () => {
  assert.equal(maskBRL(''), '')
  assert.equal(maskBRL('5'), '5')
  assert.equal(maskBRL('1000'), '1.000')
  assert.equal(maskBRL('10000'), '10.000')
  assert.equal(maskBRL('1234567'), '1.234.567')
  assert.equal(maskBRL('10000,5'), '10.000,5')
  assert.equal(maskBRL('10000,567'), '10.000,56')
  assert.equal(maskBRL('10000,'), '10.000,')
})

test('maskBRL ignora letras, pontos digitados e vírgulas extras', () => {
  assert.equal(maskBRL('R$ 10.000,00'), '10.000,00')
  assert.equal(maskBRL('1.0.0.0'), '1.000')
  assert.equal(maskBRL('12,3,4'), '12,34')
  assert.equal(maskBRL('abc'), '')
})

test('maskBRL remove zeros à esquerda e completa vírgula inicial', () => {
  assert.equal(maskBRL('000123'), '123')
  assert.equal(maskBRL('0'), '0')
  assert.equal(maskBRL(',5'), '0,5')
})

test('parseBRL converte o texto mascarado em número', () => {
  assert.equal(parseBRL('10.000,50'), 10000.5)
  assert.equal(parseBRL('1.234.567'), 1234567)
  assert.equal(parseBRL('0,5'), 0.5)
  assert.equal(parseBRL('10.000,'), 10000)
  assert.equal(parseBRL(''), null)
})

test('toMaskedBRL formata número com 2 casas', () => {
  assert.equal(toMaskedBRL(10000.5), '10.000,50')
  assert.equal(toMaskedBRL(null), '')
  assert.equal(toMaskedBRL(Number.NaN), '')
})

test('maskBRL trata o ponto digitado no fim como vírgula decimal', () => {
  // Digitação tecla a tecla de "10.50"
  let value = ''
  for (const char of '10.50') value = maskBRL(value + char, value)
  assert.equal(value, '10,50')
  assert.equal(parseBRL(value), 10.5)
  // Valor colado com ponto decimal
  assert.equal(maskBRL('10.50', ''), '10,50')
  assert.equal(maskBRL('8.4', ''), '8,4')
  // Ponto de milhar colado continua milhar
  assert.equal(maskBRL('10.000', ''), '10.000')
  // Apagar um dígito de "10.000" não vira decimal
  assert.equal(maskBRL('10.00', '10.000'), '1.000')
  // Depois de uma vírgula, pontos são ignorados
  assert.equal(maskBRL('10,5.', '10,5'), '10,5')
})
