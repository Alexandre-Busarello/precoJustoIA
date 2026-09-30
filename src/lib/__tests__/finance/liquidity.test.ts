import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIQUIDITY_DEFAULTS, isIlliquid, toLiquidityAssetType } from '../../finance/liquidity-rules'

test('limites padrão: ações R$ 1 mi, FIIs R$ 500 mil, BDRs R$ 200 mil por dia', () => {
  assert.deepEqual(LIQUIDITY_DEFAULTS, { stock: 1_000_000, fii: 500_000, bdr: 200_000 })
})

test('isIlliquid respeita o limite de cada tipo (o limite em si é líquido)', () => {
  assert.equal(isIlliquid(999_999, 'stock'), true)
  assert.equal(isIlliquid(1_000_000, 'stock'), false)
  assert.equal(isIlliquid(499_999, 'fii'), true)
  assert.equal(isIlliquid(500_000, 'fii'), false)
  assert.equal(isIlliquid(199_999, 'bdr'), true)
  assert.equal(isIlliquid(200_000, 'bdr'), false)
})

test('isIlliquid aceita os valores do enum AssetType do Prisma', () => {
  assert.equal(isIlliquid(600_000, 'FII'), false)
  assert.equal(isIlliquid(600_000, 'STOCK'), true)
  assert.equal(isIlliquid(300_000, 'BDR'), false)
  assert.equal(toLiquidityAssetType('ETF'), 'stock')
  assert.equal(toLiquidityAssetType(null), 'stock')
})

test('isIlliquid usa o limite informado no lugar do padrão', () => {
  assert.equal(isIlliquid(1_500_000, 'stock', 2_000_000), true)
  assert.equal(isIlliquid(600_000, 'stock', 500_000), false)
})

test('isIlliquid trata volume ausente ou inválido como ilíquido', () => {
  assert.equal(isIlliquid(null, 'stock'), true)
  assert.equal(isIlliquid(undefined, 'fii'), true)
  assert.equal(isIlliquid(Number.NaN, 'bdr'), true)
})
