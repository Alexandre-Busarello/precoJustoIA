import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPlanPricing } from './pricing-math'
import { formatBRL, formatPct } from '../../lib/format'

test('getPlanPricing com os preços atuais (R$ 19,90 e R$ 189,90)', () => {
  const pricing = getPlanPricing(1990, 18990)
  assert.equal(pricing.monthly, 19.9)
  assert.equal(pricing.annual, 189.9)
  assert.equal(formatBRL(pricing.annualMonthlyEquivalent), formatBRL(15.83))
  assert.equal(formatPct(pricing.annualDiscount), '20,5%')
  assert.equal(formatBRL(pricing.monthlyPix), formatBRL(16.92))
  assert.equal(formatBRL(pricing.annualPix), formatBRL(161.42))
})

test('desconto do anual nunca fica negativo', () => {
  assert.equal(getPlanPricing(1000, 13000).annualDiscount, 0)
})
