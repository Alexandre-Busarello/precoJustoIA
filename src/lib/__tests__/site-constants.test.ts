import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VALUATION_MODELS } from '@/components/asset/valuation-models'
import { RANKING_MODELS } from '@/lib/ranking-models'
import { STOCK_VALUATION_MODELS_COUNT } from '@/lib/site-constants'

test('STOCK_VALUATION_MODELS_COUNT acompanha os registros de modelos de ações', () => {
  const keys = new Set<string>(VALUATION_MODELS.map((model) => model.key))
  for (const model of RANKING_MODELS) {
    // A síntese com IA é ranking, não modelo de valuation.
    if (model.assetType === 'stock' && model.key !== 'ai') keys.add(model.key)
  }
  assert.equal(STOCK_VALUATION_MODELS_COUNT, keys.size, `modelos encontrados: ${[...keys].join(', ')}`)
})
