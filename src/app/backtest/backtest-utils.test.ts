import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EXAMPLE_TICKERS,
  buildExampleConfig,
  dateFromApi,
  formatBRLInput,
  localMonthKey,
  maskBRLInput,
  monthsBetween,
  needsValidationReview,
  parseBRLInput,
  relevantAssetWarnings,
  utcMonthKey,
} from './backtest-utils'

test('carteira de exemplo: 5 ativos com pesos iguais, 5 anos, R$ 10.000 e sem aportes', () => {
  const config = buildExampleConfig(new Date(2026, 8, 30))
  assert.deepEqual(
    config.assets.map((a) => a.ticker),
    [...EXAMPLE_TICKERS]
  )
  assert.equal(config.assets.length, 5)
  for (const asset of config.assets) assert.equal(asset.allocation, 0.2)
  const total = config.assets.reduce((sum, a) => sum + a.allocation, 0)
  assert.ok(Math.abs(total - 1) < 1e-9)
  assert.equal(config.initialCapital, 10_000)
  assert.equal(config.monthlyContribution, 0)
  assert.equal(config.rebalanceFrequency, 'monthly')
  assert.equal(config.startDate.getFullYear(), 2021)
  assert.equal(config.startDate.getMonth(), 8)
  assert.equal(config.startDate.getDate(), 1)
  assert.equal(config.endDate.getFullYear(), 2026)
  assert.equal(config.endDate.getMonth(), 8)
  assert.equal(monthsBetween(config.startDate, config.endDate), 60)
})

test('carteira de exemplo não compartilha referências entre chamadas', () => {
  const a = buildExampleConfig(new Date(2026, 0, 15))
  const b = buildExampleConfig(new Date(2026, 0, 15))
  a.assets[0].allocation = 1
  assert.equal(b.assets[0].allocation, 0.2)
})

test('maskBRLInput agrupa milhares e limita a 2 casas decimais', () => {
  assert.equal(maskBRLInput('10000'), '10.000')
  assert.equal(maskBRLInput('R$ 1234567'), '1.234.567')
  assert.equal(maskBRLInput('1.500,5'), '1.500,5')
  assert.equal(maskBRLInput('1500,567'), '1.500,56')
  assert.equal(maskBRLInput(',5'), '0,5')
  assert.equal(maskBRLInput('000123'), '123')
  assert.equal(maskBRLInput('abc'), '')
  assert.equal(maskBRLInput(''), '')
  assert.equal(maskBRLInput('0'), '0')
  assert.equal(maskBRLInput('1234567890123'), '123.456.789')
})

test('parseBRLInput lê o valor mascarado', () => {
  assert.equal(parseBRLInput('10.000'), 10000)
  assert.equal(parseBRLInput('1.500,50'), 1500.5)
  assert.equal(parseBRLInput('0,5'), 0.5)
  assert.equal(parseBRLInput(''), 0)
  assert.equal(parseBRLInput('abc'), 0)
})

test('formatBRLInput devolve o texto do campo', () => {
  assert.equal(formatBRLInput(10000), '10.000')
  assert.equal(formatBRLInput(1500.5), '1.500,50')
  assert.equal(formatBRLInput(0), '0')
  assert.equal(formatBRLInput(Number.NaN), '0')
  assert.equal(parseBRLInput(formatBRLInput(987654.32)), 987654.32)
})

test('monthsBetween conta meses de calendário', () => {
  assert.equal(monthsBetween(new Date(2021, 0, 1), new Date(2021, 11, 1)), 11)
  assert.equal(monthsBetween(new Date(2020, 5, 1), new Date(2021, 5, 1)), 12)
})

test('needsValidationReview ignora o aviso de fuso quando o histórico cobre os meses pedidos', () => {
  const requested = { startDate: new Date(2021, 8, 1), endDate: new Date(2026, 8, 1) }
  const asset = {
    availableFrom: '2021-09-01T00:00:00.000Z',
    availableTo: '2026-09-01T00:00:00.000Z',
    missingMonths: 0,
    dataQuality: 'excellent' as const,
    warnings: ['Dados disponíveis apenas até 31/08/2026'],
  }
  const clean = { isValid: true, globalWarnings: [], assetsAvailability: [asset, { ...asset, warnings: [] }] }
  assert.equal(needsValidationReview(clean, requested), false)
})

test('needsValidationReview pede revisão com dados inválidos, avisos, lacunas ou qualidade baixa', () => {
  const requested = { startDate: new Date(2021, 8, 1), endDate: new Date(2026, 8, 1) }
  const asset = {
    availableFrom: '2021-09-01T00:00:00.000Z',
    availableTo: '2026-09-01T00:00:00.000Z',
    missingMonths: 0,
    dataQuality: 'excellent' as const,
    warnings: [] as string[],
  }
  const base = { isValid: true, globalWarnings: [] as string[], assetsAvailability: [asset] }
  assert.equal(needsValidationReview({ ...base, isValid: false }, requested), true)
  assert.equal(needsValidationReview({ ...base, globalWarnings: ['Período curto'] }, requested), true)
  assert.equal(needsValidationReview({ ...base, assetsAvailability: [{ ...asset, missingMonths: 3 }] }, requested), true)
  assert.equal(needsValidationReview({ ...base, assetsAvailability: [{ ...asset, dataQuality: 'fair' as const }] }, requested), true)
  assert.equal(
    needsValidationReview({ ...base, assetsAvailability: [{ ...asset, availableFrom: '2023-01-01T00:00:00.000Z' }] }, requested),
    true
  )
  assert.equal(
    needsValidationReview({ ...base, assetsAvailability: [{ ...asset, availableTo: '2026-07-01T00:00:00.000Z' }] }, requested),
    true
  )
  assert.equal(
    needsValidationReview({ ...base, assetsAvailability: [{ ...asset, warnings: ['2 registros com preços inválidos'] }] }, requested),
    true
  )
})

test('chaves de mês: local para o formulário, UTC para o banco', () => {
  assert.equal(localMonthKey(new Date(2026, 8, 1)), 2026 * 12 + 8)
  assert.equal(utcMonthKey('2026-09-01T00:00:00.000Z'), 2026 * 12 + 8)
  assert.equal(utcMonthKey(new Date(Date.UTC(2021, 0, 1))), 2021 * 12)
})

test('dateFromApi mantém o dia e o mês da coluna DATE em qualquer fuso', () => {
  const date = dateFromApi('2021-09-01T00:00:00.000Z')
  assert.equal(date.getFullYear(), 2021)
  assert.equal(date.getMonth(), 8)
  assert.equal(date.getDate(), 1)
  assert.equal(dateFromApi(new Date(Date.UTC(2026, 0, 1))).getMonth(), 0)
})

test('relevantAssetWarnings mostra só os avisos de cobertura que são lacunas reais', () => {
  const asset = {
    availableFrom: '2016-09-01T00:00:00.000Z',
    availableTo: '2026-09-01T00:00:00.000Z',
    missingMonths: 0,
    dataQuality: 'excellent' as const,
    warnings: [
      'Dados disponíveis apenas a partir de 31/08/2016',
      'Dados disponíveis apenas até 31/08/2026',
      '2 registros com preços inválidos',
    ],
  }
  // Início em 2000: o histórico começa depois (lacuna real); o fim em setembro/2026 está coberto
  assert.deepEqual(relevantAssetWarnings(asset, { startDate: new Date(2000, 0, 1), endDate: new Date(2026, 8, 1) }), [
    'Dados disponíveis apenas a partir de 31/08/2016',
    '2 registros com preços inválidos',
  ])
  // Período dentro do histórico: nenhum aviso de cobertura
  assert.deepEqual(relevantAssetWarnings(asset, { startDate: new Date(2016, 8, 1), endDate: new Date(2026, 8, 1) }), [
    '2 registros com preços inválidos',
  ])
  // Fim depois do último mês com dados: o aviso de "até" volta a valer
  assert.deepEqual(
    relevantAssetWarnings({ ...asset, warnings: [asset.warnings[1]] }, { startDate: new Date(2020, 0, 1), endDate: new Date(2026, 9, 1) }),
    ['Dados disponíveis apenas até 31/08/2026']
  )
})
