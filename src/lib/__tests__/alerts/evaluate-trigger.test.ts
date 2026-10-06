import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeTriggerConfigs,
  bazinCeilingPrice,
  checkMonitorLimit,
  evaluateTriggerConfig,
  fairValuesFromSnapshot,
  FREE_MONITOR_LIMIT,
  parseTriggerConfig,
  type TriggerContext,
} from '../../custom-trigger-service'
import type { DividendEvent } from '../../finance/dividends'
import { formatAlertPct, isPrefillType } from '../../../app/dashboard/monitoramentos-customizados/monitor-fields'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const ev = (iso: string, amount: number, type = 'DIVIDENDO'): DividendEvent => ({ exDate: d(iso), amount, type })

const asOf = d('2026-10-05')

/** R$ 3,00 por ano em 2021–2025 (dividendos + JCP), mais R$ 2,00 com data-com nos últimos 12 meses. */
const dividends: DividendEvent[] = [
  ...[2021, 2022, 2023, 2024].flatMap((year) => [ev(`${year}-05-10`, 2), ev(`${year}-11-10`, 1, 'JCP')]),
  ev('2025-05-10', 2),
  ev('2025-11-10', 1, 'JCP'),
  ev('2026-05-10', 1),
]
// Média dos 5 anos completos (2021–2025) = 3,00 → teto a 6% = 50,00. TTM (out/25–out/26) = 1 + 1 = 2,00.

const base = (overrides: Partial<TriggerContext> = {}): TriggerContext => ({ asOf, dividends, ...overrides })

test('bazinCeilingPrice: média dos 5 anos completos ÷ DY-alvo', () => {
  assert.equal(bazinCeilingPrice(dividends, 0.06, asOf), 50)
  assert.equal(bazinCeilingPrice(dividends, 0.08, asOf), 37.5)
  assert.equal(bazinCeilingPrice([], 0.06, asOf), null)
  assert.equal(bazinCeilingPrice(dividends, 0, asOf), null)
})

test('bazin_ceiling: dispara com preço abaixo do teto', () => {
  const result = evaluateTriggerConfig({ bazinCeiling: { targetYield: 0.06 } }, base({ price: 45 }))
  assert.equal(result.triggered, true)
  assert.match(result.message, /preço-teto Bazin/)
  assert.match(result.message, /R\$\s50,00/)
  assert.equal(result.computed.bazinCeiling, 50)
})

test('bazin_ceiling: não dispara com preço acima do teto', () => {
  const result = evaluateTriggerConfig({ bazinCeiling: { targetYield: 0.06 } }, base({ price: 55 }))
  assert.equal(result.triggered, false)
  assert.deepEqual(result.missing, [])
  assert.equal(result.message, 'Nenhum critério atingido')
})

test('bazin_ceiling: sem proventos ou sem cotação não dispara e explica o motivo', () => {
  const noDividends = evaluateTriggerConfig({ bazinCeiling: { targetYield: 0.06 } }, base({ price: 1, dividends: [] }))
  assert.equal(noDividends.triggered, false)
  assert.match(noDividends.missing[0], /sem proventos/)
  assert.match(noDividends.message, /Dados indisponíveis/)

  const noPrice = evaluateTriggerConfig({ bazinCeiling: { targetYield: 0.06 } }, base({ price: null }))
  assert.equal(noPrice.triggered, false)
  assert.match(noPrice.missing[0], /cotação indisponível/)
})

test('fair_value_discount: dispara quando o desconto atinge o mínimo', () => {
  const config = { fairValueDiscount: { model: 'graham' as const, minDiscount: 0.2 } }
  const result = evaluateTriggerConfig(config, base({ price: 75, fairValues: { graham: 100 } }))
  assert.equal(result.triggered, true)
  assert.equal(result.computed.discount, 0.25)
  assert.match(result.message, /Graham/)
})

test('fair_value_discount: não dispara com desconto menor que o mínimo', () => {
  const config = { fairValueDiscount: { model: 'fcd' as const, minDiscount: 0.3 } }
  const result = evaluateTriggerConfig(config, base({ price: 80, fairValues: { fcd: 100 } }))
  assert.equal(result.triggered, false)
  assert.deepEqual(result.missing, [])
})

test('fair_value_discount: sem preço justo do modelo não dispara e explica o motivo', () => {
  const config = { fairValueDiscount: { model: 'gordon' as const, minDiscount: 0.1 } }
  const result = evaluateTriggerConfig(config, base({ price: 10, fairValues: { graham: 100, gordon: null } }))
  assert.equal(result.triggered, false)
  assert.match(result.missing[0], /Gordon: preço justo indisponível/)
})

test('dy_ttm_above: dispara quando DY 12m ≥ mínimo', () => {
  // 2,00 / 20,00 = 10%
  const result = evaluateTriggerConfig({ dyTtmAbove: { minDy: 0.08 } }, base({ price: 20 }))
  assert.equal(result.triggered, true)
  assert.equal(result.computed.dyTtm, 0.1)
  assert.match(result.message, /Dividend yield 12 meses \(10,0%\)/)
})

test('dy_ttm_above: não dispara quando DY 12m < mínimo', () => {
  // 2,00 / 40,00 = 5%
  const result = evaluateTriggerConfig({ dyTtmAbove: { minDy: 0.08 } }, base({ price: 40 }))
  assert.equal(result.triggered, false)
  assert.equal(result.computed.dyTtm, 0.05)
})

test('dy_ttm_above: sem proventos em 12 meses não dispara e explica o motivo', () => {
  const old = [ev('2020-05-10', 5)]
  const result = evaluateTriggerConfig({ dyTtmAbove: { minDy: 0.01 } }, base({ price: 10, dividends: old }))
  assert.equal(result.triggered, false)
  assert.match(result.missing[0], /últimos 12 meses/)
})

test('critérios existentes continuam funcionando (preço e min/max) e combinam com OU', () => {
  const config = { priceBelow: 30, maxPl: 8, bazinCeiling: { targetYield: 0.06 } }
  const result = evaluateTriggerConfig(config, base({ price: 60, indicators: { pl: 7.5 } }))
  assert.equal(result.triggered, true)
  assert.equal(result.reasons.length, 1)
  assert.match(result.reasons[0], /P\/L \(7,50\) atingiu o máximo configurado/)

  const price = evaluateTriggerConfig({ priceBelow: 30 }, base({ price: 29.5 }))
  assert.equal(price.triggered, true)

  const missingIndicator = evaluateTriggerConfig({ minRoe: 0.15 }, base({ price: 10 }))
  assert.equal(missingIndicator.triggered, false)
  assert.match(missingIndicator.missing[0], /ROE: indicador indisponível/)
})

test('fairValuesFromSnapshot lê strategies[modelo].fairValue e ignora ausentes', () => {
  const snapshot = {
    strategies: {
      graham: { fairValue: 42.5 },
      fcd: { fairValue: null },
      gordon: { fairValue: -3 },
      lowPE: { fairValue: 10 },
      bazin: { fairValue: '30.1' },
    },
  }
  assert.deepEqual(fairValuesFromSnapshot(snapshot), { graham: 42.5, bazin: 30.1 })
  assert.deepEqual(fairValuesFromSnapshot(null), {})
  assert.deepEqual(fairValuesFromSnapshot({ strategies: 'x' }), {})
})

test('checkMonitorLimit: gratuito até 3 ativos, Premium sem limite', () => {
  assert.equal(FREE_MONITOR_LIMIT, 3)
  assert.deepEqual(checkMonitorLimit(false, 0), { allowed: true, current: 0, max: 3 })
  assert.deepEqual(checkMonitorLimit(false, 2), { allowed: true, current: 2, max: 3 })
  assert.deepEqual(checkMonitorLimit(false, 3), { allowed: false, current: 3, max: 3 })
  assert.deepEqual(checkMonitorLimit(false, 5), { allowed: false, current: 5, max: 3 })
  assert.deepEqual(checkMonitorLimit(true, 50), { allowed: true, current: 50, max: null })
})

test('parseTriggerConfig valida os novos tipos e rejeita dados inválidos', () => {
  const ok = parseTriggerConfig({
    bazinCeiling: { targetYield: 0.06 },
    fairValueDiscount: { model: 'graham', minDiscount: 0.2 },
    dyTtmAbove: { minDy: 0.08 },
    priceBelow: 30,
  })
  assert.equal(ok.success, true)

  const badModel = parseTriggerConfig({ fairValueDiscount: { model: 'tarot', minDiscount: 0.2 } })
  assert.equal(badModel.success, false)

  const badYield = parseTriggerConfig({ bazinCeiling: { targetYield: 0 } })
  assert.equal(badYield.success, false)

  const unknownKey = parseTriggerConfig({ foo: 1 })
  assert.equal(unknownKey.success, false)
  if (!unknownKey.success) assert.match(unknownKey.error, /critério desconhecido/)

  const empty = parseTriggerConfig({})
  assert.equal(empty.success, false)
  if (!empty.success) assert.equal(empty.error, 'Defina pelo menos um critério')

  const dropsUndefined = parseTriggerConfig({ priceAbove: 10, priceBelow: undefined })
  assert.deepEqual(dropsUndefined, { success: true, config: { priceAbove: 10 } })
})

test('mergeTriggerConfigs soma o novo critério sem apagar os existentes', () => {
  const existing = { dyTtmAbove: { minDy: 0.09 }, bazinCeiling: { targetYield: 0.07 }, maxPl: 12 }
  const merged = mergeTriggerConfigs(existing, { bazinCeiling: { targetYield: 0.06 } })
  assert.deepEqual(merged, { dyTtmAbove: { minDy: 0.09 }, bazinCeiling: { targetYield: 0.06 }, maxPl: 12 })
  // não altera o objeto salvo
  assert.deepEqual(existing.bazinCeiling, { targetYield: 0.07 })
  // configuração salva inválida ou vazia vira só o novo critério
  assert.deepEqual(mergeTriggerConfigs(null, { minDy: 0.05 }), { minDy: 0.05 })
  assert.deepEqual(mergeTriggerConfigs([1, 2], { minDy: 0.05 }), { minDy: 0.05 })
})

test('mensagens usam o mesmo formato de percentual do formulário (6%, 6,5%)', () => {
  const whole = evaluateTriggerConfig({ bazinCeiling: { targetYield: 0.06 } }, base({ price: 45 }))
  assert.match(whole.message, /DY-alvo 6%/)
  const fraction = evaluateTriggerConfig({ dyTtmAbove: { minDy: 0.035 } }, base({ price: 20 }))
  assert.match(fraction.message, /mínimo configurado \(3,5%\)/)
  assert.equal(formatAlertPct(0.06), '6%')
  assert.equal(formatAlertPct(0.065), '6,5%')
})

test('parseTriggerConfig ignora critérios null de configurações antigas e traduz erros de tipo', () => {
  assert.deepEqual(parseTriggerConfig({ maxPl: 12, minPl: null, priceBelow: null }), {
    success: true,
    config: { maxPl: 12 },
  })
  const onlyNull = parseTriggerConfig({ minPl: null })
  assert.equal(onlyNull.success, false)
  if (!onlyNull.success) assert.equal(onlyNull.error, 'Defina pelo menos um critério')

  const wrongType = parseTriggerConfig({ maxPl: 'doze' })
  assert.equal(wrongType.success, false)
  if (!wrongType.success) assert.equal(wrongType.error, 'Critério inválido em maxPl: deve ser um número')

  const nested = parseTriggerConfig({ bazinCeiling: { targetYield: null } })
  assert.equal(nested.success, false)
  if (!nested.success) assert.doesNotMatch(nested.error, /expected|received/)

  assert.equal(parseTriggerConfig(null).success, false)
  assert.deepEqual(mergeTriggerConfigs({ maxPl: 12, minPl: null }, { minDy: 0.05 }), { maxPl: 12, minDy: 0.05 })
})

test('isPrefillType aceita só alertas e campos conhecidos (texto do cabeçalho de edição depende disso)', () => {
  assert.equal(isPrefillType('bazin_ceiling'), true)
  assert.equal(isPrefillType('fair_value_discount'), true)
  assert.equal(isPrefillType('dy_ttm_above'), true)
  assert.equal(isPrefillType('maxPl'), true)
  assert.equal(isPrefillType('priceBelow'), true)
  assert.equal(isPrefillType(null), false)
  assert.equal(isPrefillType(''), false)
  assert.equal(isPrefillType('xyz'), false)
  assert.equal(isPrefillType('bazinCeiling'), false)
})
