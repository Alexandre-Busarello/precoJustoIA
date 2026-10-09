import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canUseRankingModel, getRankingModel } from '../../ranking-models'

test('Fórmula Mágica: aberta no plano gratuito com 3 resultados, como a API já faz', () => {
  const model = getRankingModel('magicFormula')!
  assert.equal(canUseRankingModel(model, false), true)
  assert.equal(model.planLimitedResults, true)
  assert.match(model.description, /3 resultados no plano gratuito/)
})
