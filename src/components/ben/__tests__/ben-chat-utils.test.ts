import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  contextHint,
  contextKey,
  contextKeyFromUrl,
  contextLabel,
  conversationTitleFrom,
  followUpSuggestions,
  limitLabel,
  startSuggestions,
  summarizeLongAnswer,
  toolStatusLabel,
} from '../ben-chat-utils'
import type { BenPageContext } from '../../../lib/ben-context/types'

const petr4: BenPageContext = { kind: 'asset', ticker: 'PETR4', assetType: 'stock' }

test('contextKey: subpáginas do mesmo ativo são o mesmo contexto; carteiras se distinguem pelo id', () => {
  assert.equal(contextKey(petr4), 'asset:PETR4')
  assert.equal(contextKey({ ...petr4, section: 'technical' }), 'asset:PETR4')
  assert.equal(contextKeyFromUrl('/acao/petr4/analise-tecnica'), 'asset:PETR4')
  assert.notEqual(contextKeyFromUrl('/carteira/a1'), contextKeyFromUrl('/carteira/b2'))
  assert.notEqual(contextKeyFromUrl('/acao/petr4'), contextKeyFromUrl('/carteira/a1'))
  assert.equal(contextKeyFromUrl(null), 'dashboard')
  assert.equal(contextKey(null), 'none')
})

test('contextLabel: chip "Vendo: …" por tipo de página', () => {
  assert.equal(contextLabel(petr4), 'PETR4 · Valuation')
  assert.equal(contextLabel({ ...petr4, section: 'technical' }), 'PETR4 · Análise técnica')
  assert.equal(contextLabel({ kind: 'asset', ticker: 'IBOV', assetType: 'index' }), 'IBOV')
  assert.equal(contextLabel({ kind: 'portfolio', id: 'x', holdings: [], name: 'Dividendos' }), 'Carteira Dividendos')
  assert.equal(contextLabel({ kind: 'portfolio', id: 'x', holdings: [], name: 'Carteira Dividendos' }), 'Carteira Dividendos')
  assert.equal(contextLabel({ kind: 'portfolio', id: 'x', holdings: [] }), 'Carteira')
  assert.equal(contextLabel({ kind: 'ranking', model: 'Graham', tickers: [] }), 'Ranking · Graham')
  assert.equal(contextLabel({ kind: 'ranking', model: '', tickers: [] }), 'Ranking')
  assert.equal(contextLabel({ kind: 'screening', assetClass: 'fiis', filters: [], resultCount: null, tickers: [] }), 'Screening de FIIs')
  assert.equal(contextLabel({ kind: 'comparador', tickers: ['PETR4', 'VALE3'] }), 'Comparador · PETR4 x VALE3')
  assert.equal(contextLabel({ kind: 'dashboard' }), 'Visão geral')
  assert.equal(contextLabel({ kind: 'generic', path: '/perfil' }), null)
  assert.equal(contextLabel(null), null)
})

test('contextHint e startSuggestions: uma linha e até 3 sugestões, sem linguagem de indicação', () => {
  assert.match(contextHint(petr4), /PETR4/)
  assert.match(contextHint({ kind: 'dashboard' }), /carteiras/)
  const suggestions = startSuggestions(petr4)
  assert.ok(suggestions.length > 0 && suggestions.length <= 3)
  assert.ok(startSuggestions({ kind: 'generic', path: '/perfil' }).length >= 1)
  for (const kind of [petr4, { kind: 'dashboard' } as BenPageContext, { kind: 'onde-aportar', amount: null, allocations: [] } as BenPageContext]) {
    for (const s of startSuggestions(kind)) assert.doesNotMatch(`${s.label} ${s.prompt}`, /\b(compra|venda|recomenda)/i)
    assert.doesNotMatch(contextHint(kind), /\b(compra|venda|recomenda)/i)
  }
})

test('toolStatusLabel: ferramenta e ticker em linguagem simples', () => {
  assert.equal(toolStatusLabel('getCompanyMetrics', { ticker: 'petr4' }), 'Buscando fundamentos de PETR4')
  assert.equal(toolStatusLabel('getFairValue', { ticker: 'VALE3' }), 'Calculando o preço justo de VALE3')
  assert.equal(toolStatusLabel('getCompanyMetrics'), 'Buscando fundamentos')
  assert.equal(toolStatusLabel('getIbovData', {}), 'Buscando dados do Ibovespa')
  assert.equal(toolStatusLabel('ferramentaNova', null), 'Consultando os dados da plataforma')
})

test('followUpSuggestions: no máximo 2, sem repetir perguntas feitas, com o ticker citado na resposta', () => {
  const answer = 'PETR4 negocia abaixo do preço justo estimado; PRIO3 tem margem parecida.'
  const list = followUpSuggestions(petr4, [], answer)
  assert.equal(list.length, 2)
  assert.equal(list[0].label, 'Compare PETR4 e PRIO3')

  const asked = startSuggestions(petr4).map((s) => s.prompt)
  const rest = followUpSuggestions(petr4, asked, 'Sem outros tickers aqui.')
  for (const item of rest) assert.ok(!asked.includes(item.prompt))
  assert.ok(rest.length <= 2)

  const dashboard = followUpSuggestions({ kind: 'dashboard' }, [], 'Veja ITUB4.')
  assert.equal(dashboard[0].label, 'Preço justo de ITUB4')
  assert.ok(dashboard.length <= 2)
})

test('summarizeLongAnswer: curta fica inteira; longa vira os primeiros blocos', () => {
  assert.equal(summarizeLongAnswer('Resposta curta.'), null)
  const blocks = Array.from({ length: 8 }, (_, i) => `Parágrafo ${i + 1}. ${'texto '.repeat(40)}`)
  const long = blocks.join('\n\n')
  const summary = summarizeLongAnswer(long)
  assert.ok(summary)
  assert.ok(summary!.startsWith('Parágrafo 1.'))
  assert.ok(summary!.length < long.length / 2)
  assert.ok(!summary!.includes('Parágrafo 8.'))

  // Um parágrafo único enorme é cortado numa frase
  const single = Array.from({ length: 60 }, (_, i) => `Frase número ${i} sobre o ativo.`).join(' ')
  const cut = summarizeLongAnswer(single)
  assert.ok(cut && cut.endsWith('.') && cut.length < single.length)
})

test('conversationTitleFrom e limitLabel', () => {
  assert.equal(conversationTitleFrom('  Por que   o preço justo pelo FCD é R$ 45,10? '), 'Por que o preço justo pelo FCD é R$ 45,10?')
  const long = conversationTitleFrom('Explique em detalhes como funciona a calculadora Onde aportar e por que ela escolheu estes ativos')
  assert.ok(long.length <= 61 && long.endsWith('…'))
  assert.equal(limitLabel(2, 2), '2 mensagens por dia · restam 2')
  assert.equal(limitLabel(2, 1), '2 mensagens por dia · resta 1')
  assert.equal(limitLabel(2, 0), '2 mensagens por dia · nenhuma restante hoje')
})
