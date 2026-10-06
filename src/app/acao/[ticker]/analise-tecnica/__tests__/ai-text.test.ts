import { test } from 'node:test'
import assert from 'node:assert/strict'
import { softenAiText } from '../ai-text'

test('troca expressões de recomendação por termos descritivos', () => {
  assert.equal(softenAiText('Região de entrada considerada justa.'), 'Região de entrada estimada pelo modelo.')
  assert.equal(softenAiText('O RSI indica sinal de compra.'), 'O RSI indica sinal de alta.')
  assert.equal(softenAiText('Sinais de venda no curto prazo'), 'Sinais de baixa no curto prazo')
  assert.equal(softenAiText('Preço em região segura para entrada.'), 'Preço em região estimada.')
  assert.equal(softenAiText('Recomendamos cautela.'), 'O modelo aponta cautela.')
  assert.equal(softenAiText('retorno garantido'), 'retorno provável')
})

test('texto neutro fica igual; vazio vira string vazia', () => {
  const neutral = 'A média de 50 dias cruzou a de 200 dias. Volatilidade moderada.'
  assert.equal(softenAiText(neutral), neutral)
  assert.equal(softenAiText(null), '')
})

test('nenhum termo proibido sobra', () => {
  const text = softenAiText('Sinal de compra em região segura, oportunidade de compra garantida, preço justo de entrada.')
  assert.doesNotMatch(text, /compra|região segura|garantid|preço justo de entrada/i)
})
