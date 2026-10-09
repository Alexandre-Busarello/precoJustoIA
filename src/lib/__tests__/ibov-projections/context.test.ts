import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  brazilClock,
  buildPlBolsaContext,
  percentileRank,
  quotesToCloses,
  reportCacheKey,
  snapshotValidUntil,
} from '../../ibov-projections/context'
import { buildCommentaryPrompt, validateCommentary } from '../../ibov-projections/commentary'
import { buildIbovProjection, type DailyClose } from '../../ibov-projections/engine'

test('brazilClock usa o fuso de Brasília e o horário de fechamento', () => {
  // 2026-10-08 é quinta. 20:00 UTC = 17:00 em Brasília: pregão aberto
  assert.deepEqual(brazilClock(new Date('2026-10-08T20:00:00Z')), { today: '2026-10-08', sessionClosed: false })
  // 21:30 UTC = 18:30 em Brasília: fechado
  assert.deepEqual(brazilClock(new Date('2026-10-08T21:30:00Z')), { today: '2026-10-08', sessionClosed: true })
  // 02:00 UTC de sexta ainda é quinta em Brasília
  assert.equal(brazilClock(new Date('2026-10-09T02:00:00Z')).today, '2026-10-08')
  // sábado
  assert.equal(brazilClock(new Date('2026-10-10T13:00:00Z')).sessionClosed, true)
})

test('quotesToCloses descarta a barra parcial de hoje antes do fechamento', () => {
  const quotes = [
    { date: new Date('2026-10-07T13:00:00Z'), close: 100 },
    { date: new Date('2026-10-08T13:00:00Z'), close: 101 },
    { date: '2026-10-06T13:00:00Z', close: null },
  ]
  assert.deepEqual(quotesToCloses(quotes, { today: '2026-10-08', sessionClosed: false }), [{ date: '2026-10-07', close: 100 }])
  assert.deepEqual(quotesToCloses(quotes, { today: '2026-10-08', sessionClosed: true }), [
    { date: '2026-10-07', close: 100 },
    { date: '2026-10-08', close: 101 },
  ])
})

test('percentileRank e contexto do P/L da bolsa', () => {
  assert.equal(percentileRank([1, 2, 3, 4], 3), 0.75)
  assert.ok(Number.isNaN(percentileRank([], 1)))
  assert.equal(buildPlBolsaContext([{ date: '2026-01-01', pl: 8 }]), null)
  const rows = Array.from({ length: 24 }, (_, i) => ({ date: `20${24 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`, pl: 6 + i * 0.25 }))
  const context = buildPlBolsaContext([...rows].reverse())!
  assert.equal(context.current, 6 + 23 * 0.25)
  assert.equal(context.percentileRank, 1)
  assert.equal(context.asOf, '2025-12-01')
  assert.equal(context.since, '2024-01-01')
  assert.equal(context.samples, 24)
})

test('chave de cache muda por dia e fase do pregão', () => {
  assert.equal(reportCacheKey({ today: '2026-10-08', sessionClosed: false }, 'm'), 'ibov-projections:m:2026-10-08:open')
  assert.equal(reportCacheKey({ today: '2026-10-08', sessionClosed: true }, 'm'), 'ibov-projections:m:2026-10-08:closed')
  assert.equal(snapshotValidUntil('2026-10-08').toISOString(), '2026-10-09T02:59:59.000Z')
})

test('validateCommentary rejeita previsão, alvo e ordem de compra/venda', () => {
  const ok = 'O P/L agregado da bolsa está acima da média histórica, enquanto a Selic segue elevada. A volatilidade recente está um pouco acima do padrão dos últimos dez anos.'
  assert.equal(validateCommentary(`**${ok}**`), ok)
  assert.equal(validateCommentary('O Ibovespa vai subir com a queda dos juros, que deve continuar nos próximos meses do ano.'), null)
  assert.equal(validateCommentary('O alvo de mercado para o índice está em 220 mil pontos segundo a média das casas.'), null)
  assert.equal(validateCommentary('É um bom momento de compra para quem pensa no longo prazo e aceita oscilações.'), null)
  assert.equal(validateCommentary('curto'), null)
  assert.equal(validateCommentary(null), null)
  assert.equal(validateCommentary('x'.repeat(800)), null)
})

test('prompt do comentário leva só os números calculados', () => {
  const series: DailyClose[] = []
  let value = 100_000
  const date = new Date(Date.UTC(2020, 0, 1))
  while (series.length < 600) {
    if (![0, 6].includes(date.getUTCDay())) {
      series.push({ date: date.toISOString().slice(0, 10), close: value })
      value *= series.length % 3 === 0 ? 0.99 : 1.006
    }
    date.setUTCDate(date.getUTCDate() + 1)
  }
  const core = buildIbovProjection(series, { today: series[599].date, sessionClosed: true })
  const prompt = buildCommentaryPrompt({
    ...core,
    context: { plBolsa: null, selic: { value: 0.15, asOf: '2026-10-01', source: 'db' }, cdi: null },
  })
  assert.match(prompt, /Horizonte 1 semana: faixa provável/)
  assert.match(prompt, /Selic: 15,00% ao ano/)
  assert.match(prompt, /Não altere nem recalcule/)
})
