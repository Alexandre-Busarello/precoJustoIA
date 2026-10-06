import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RANKING_MODELS } from '../ranking-models'
import { RANKING_METHODOLOGY, methodologyHref } from '../ranking-methodology'
import { metodologiaSectionIds } from '../metodologia-content'

const BANNED = /\b(compr[ae]|recomenda|melhores ações|garant)/i

test('todo modelo do registro de rankings tem "Como funciona"', () => {
  for (const model of RANKING_MODELS) {
    const doc = RANKING_METHODOLOGY[model.key]
    assert.ok(doc, `sem metodologia: ${model.key}`)
    assert.ok(doc.summary.trim().length > 0, `resumo vazio: ${model.key}`)
    assert.ok(doc.steps.length >= 3 && doc.steps.length <= 5, `${model.key}: ${doc.steps.length} passos (esperado 3 a 5)`)
  }
})

test('a âncora de cada modelo existe em /metodologia', () => {
  const ids = new Set(metodologiaSectionIds())
  for (const model of RANKING_MODELS) {
    const anchor = RANKING_METHODOLOGY[model.key]?.anchor
    assert.ok(anchor && ids.has(anchor), `âncora ausente em /metodologia: ${model.key} → ${anchor}`)
    assert.equal(methodologyHref(model.key), `/metodologia#${anchor}`)
  }
})

test('ids de seção de /metodologia são únicos', () => {
  const ids = metodologiaSectionIds()
  assert.equal(new Set(ids).size, ids.length, `ids repetidos: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`)
})

test('não há metodologia de modelo que saiu do registro', () => {
  const keys = new Set(RANKING_MODELS.map((model) => model.key))
  for (const key of Object.keys(RANKING_METHODOLOGY)) assert.ok(keys.has(key), `metodologia órfã: ${key}`)
})

test('textos do "Como funciona" evitam linguagem de recomendação', () => {
  for (const [key, doc] of Object.entries(RANKING_METHODOLOGY)) {
    for (const text of [doc.summary, ...doc.steps]) assert.doesNotMatch(text, BANNED, `${key}: ${text}`)
  }
})
