import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getTechnicalTrafficLightStatus,
  getValuationStatus,
  normalizeTechnicalLabel,
  priceRangePosition,
  technicalRangeText,
  TECHNICAL_LABELS,
} from '../../../lib/radar-service'

const analysis = { aiFairEntryPrice: 30, aiMinPrice: 27, aiMaxPrice: 34 }

test('nenhum status técnico usa "Compra" ou "Região segura"', () => {
  const prices = [20, 27, 29, 30, 31, 34, 40]
  const scores = [null, 40, 50, 80]
  for (const price of prices) {
    for (const score of scores) {
      for (const input of [analysis, { ...analysis, aiMinPrice: null, aiMaxPrice: null }]) {
        const result = getTechnicalTrafficLightStatus(input, price, score)
        assert.doesNotMatch(result.label, /compra|região segura/i)
        assert.doesNotMatch(result.description, /compra|região segura|R\$ \d+\.\d/i)
      }
    }
  }
})

test('dentro da faixa e até a entrada técnica, com score ≥ 50 → verde "Abaixo do valor estimado"', () => {
  const result = getTechnicalTrafficLightStatus(analysis, 29, 60)
  assert.equal(result.status, 'green')
  assert.equal(result.label, 'Abaixo do valor estimado')
  assert.match(result.description, /Dentro da faixa estimada/)
})

test('score fundamentalista baixo nunca fica verde', () => {
  const result = getTechnicalTrafficLightStatus(analysis, 29, 40)
  assert.equal(result.status, 'yellow')
  assert.equal(result.label, TECHNICAL_LABELS.neutral)
})

test('dentro da faixa mas acima da entrada técnica → amarelo "Acima do valor estimado"', () => {
  const result = getTechnicalTrafficLightStatus(analysis, 32, 80)
  assert.equal(result.status, 'yellow')
  assert.equal(result.label, TECHNICAL_LABELS.aboveEstimate)
})

test('fora da faixa → vermelho, acima ou abaixo', () => {
  assert.equal(getTechnicalTrafficLightStatus(analysis, 26, 80).label, TECHNICAL_LABELS.belowRange)
  assert.equal(getTechnicalTrafficLightStatus(analysis, 35, 80).label, TECHNICAL_LABELS.aboveRange)
  assert.equal(getTechnicalTrafficLightStatus(analysis, 35, 80).status, 'red')
})

test('sem análise técnica → neutro', () => {
  assert.equal(getTechnicalTrafficLightStatus(null, 30, 80).label, 'Neutro')
})

test('normalizeTechnicalLabel converte rótulos antigos', () => {
  assert.equal(normalizeTechnicalLabel('Compra'), 'Abaixo do valor estimado')
  assert.equal(normalizeTechnicalLabel('Atenção'), 'Acima do valor estimado')
  assert.equal(normalizeTechnicalLabel('Acima do Limite'), 'Acima da faixa estimada')
  assert.equal(normalizeTechnicalLabel('N/A'), null)
  assert.equal(normalizeTechnicalLabel(undefined), null)
})

test('sem faixa: até a entrada (verde), perto (neutro), mais de 10% acima (vermelho)', () => {
  const noRange = { ...analysis, aiMinPrice: null, aiMaxPrice: null }
  assert.deepEqual(
    [29, 32, 34].map((price) => {
      const r = getTechnicalTrafficLightStatus(noRange, price, 80)
      return [r.status, r.label]
    }),
    [
      ['green', TECHNICAL_LABELS.belowEntry],
      ['yellow', TECHNICAL_LABELS.neutral],
      ['red', TECHNICAL_LABELS.aboveEntry],
    ]
  )
})

test('technicalRangeText: "Acima/Abaixo da faixa" só com o preço fora da faixa', () => {
  const text = (price: number, score = 80, input: typeof analysis | Record<string, unknown> = analysis) =>
    technicalRangeText(getTechnicalTrafficLightStatus(input as typeof analysis, price, score).label)
  // Caso PETR4: preço 49,10, faixa 43,78–55,95, entrada 48,65 → dentro da faixa
  const petr4 = { aiFairEntryPrice: 48.65, aiMinPrice: 43.78, aiMaxPrice: 55.95 }
  assert.equal(technicalRangeText(getTechnicalTrafficLightStatus(petr4, 49.1, 80).label), 'Dentro da faixa, acima da entrada')
  assert.equal(text(29), 'Dentro da faixa')
  assert.equal(text(32), 'Dentro da faixa, acima da entrada')
  assert.equal(text(35), 'Acima da faixa')
  assert.equal(text(26), 'Abaixo da faixa')
  assert.equal(text(29, 40), 'Neutro')
  // Sem faixa nunca diz "faixa"
  for (const price of [20, 29, 31, 40]) {
    assert.doesNotMatch(text(price, 80, { ...analysis, aiMinPrice: null, aiMaxPrice: null }), /faixa/)
  }
})

test('technicalRangeText converte rótulos antigos em cache', () => {
  assert.equal(technicalRangeText('Compra'), 'Dentro da faixa')
  assert.equal(technicalRangeText('Atenção'), 'Dentro da faixa, acima da entrada')
  assert.equal(technicalRangeText('Caro'), 'Acima da entrada')
  assert.equal(technicalRangeText('Acima do Limite'), 'Acima da faixa')
  assert.equal(technicalRangeText('Abaixo do Limite'), 'Abaixo da faixa')
  assert.equal(technicalRangeText('Neutro'), 'Neutro')
  assert.equal(technicalRangeText('N/A'), '—')
  assert.equal(technicalRangeText(null), '—')
})

test('priceRangePosition: fração dentro da faixa e pontas limitadas', () => {
  assert.deepEqual(priceRangePosition(10, 20, 15), { fraction: 0.5, position: 'within' })
  assert.deepEqual(priceRangePosition(10, 20, 5), { fraction: 0, position: 'below' })
  assert.deepEqual(priceRangePosition(10, 20, 25), { fraction: 1, position: 'above' })
  assert.equal(priceRangePosition(null, 20, 15), null)
  assert.equal(priceRangePosition(20, 20, 20), null)
})

test('getValuationStatus formata o upside (pontos percentuais) em pt-BR', () => {
  assert.deepEqual(getValuationStatus(12.5), { status: 'green', label: '+12,5%' })
  assert.deepEqual(getValuationStatus(-3), { status: 'red', label: '−3,0%' })
  assert.deepEqual(getValuationStatus(null), { status: 'yellow', label: '—' })
})
