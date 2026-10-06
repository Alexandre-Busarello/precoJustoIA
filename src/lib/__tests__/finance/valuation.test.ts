import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bankFairValue,
  ceilingPrice,
  equityBridge,
  equityFromEV,
  fairPVP,
  gordonValue,
  lynchFairPE,
  magicFormulaRank,
  marginOfSafety,
  netDebtFromMarket,
  peg,
  perShare,
  upside,
} from '../../finance/valuation'

const close = (actual: number | null, expected: number, digits = 4) => {
  assert.ok(actual !== null, `esperado ${expected}, veio null`)
  assert.equal(Number(actual.toFixed(digits)), expected)
}

test('ponte EV → Equity: EV 100, dívida líquida 40, 10 ações → 6,0 por ação', () => {
  const equity = equityFromEV(100, 50, 10)
  assert.equal(equity, 60)
  assert.equal(perShare(equity, 10), 6)
  assert.deepEqual(equityBridge({ ev: 100, totalDebt: 50, cash: 10 }), { ev: 100, netDebt: 40, equity: 60 })
})

test('equityBridge usa enterpriseValue − marketCap quando não há dívida do balanço', () => {
  assert.equal(netDebtFromMarket(140, 100), 40)
  assert.deepEqual(equityBridge({ ev: 100, enterpriseValue: 140, marketCap: 100 }), { ev: 100, netDebt: 40, equity: 60 })
  assert.equal(equityBridge({ ev: 100 }), null)
  assert.equal(perShare(60, 0), null)
})

test('caixa líquido aumenta o valor do acionista', () => {
  assert.equal(equityFromEV(100, 10, 30), 120)
  assert.equal(equityFromEV(100, 10, null), 90)
})

test('margem de segurança VJ 100 / P 75 → 0,25 e upside 0,3333', () => {
  assert.equal(marginOfSafety(75, 100), 0.25)
  close(upside(75, 100), 0.3333)
})

test('Gordon: k − g < 4 p.p. → null', () => {
  assert.equal(gordonValue({ d0: 1.2, g: 0.1, k: 0.13 }), null)
  assert.equal(gordonValue({ d0: 1.2, g: 0.12, k: 0.12 }), null)
})

test('Gordon: k 0,16, g 0,05, D0 1,20 → 1,26 / 0,11 = 11,4545', () => {
  close(gordonValue({ d0: 1.2, g: 0.05, k: 0.16 }), 11.4545)
})

test('Gordon aceita spread de exatamente 4 p.p. apesar do ponto flutuante', () => {
  assert.notEqual(gordonValue({ d0: 1, g: 0.11, k: 0.15 }), null)
  assert.equal(gordonValue({ d0: 0, g: 0.05, k: 0.16 }), null)
})

test('P/VP justo: ROE 0,20, g 0,05, Ke 0,15 → 1,5', () => {
  close(fairPVP({ roe: 0.2, g: 0.05, ke: 0.15 }), 1.5)
  assert.equal(fairPVP({ roe: 0.2, g: 0.12, ke: 0.15 }), null) // spread < 4 p.p.
  assert.equal(fairPVP({ roe: 0.04, g: 0.05, ke: 0.15 }), null) // ROE ≤ g
})

test('bankFairValue = VPA × P/VP justo', () => {
  close(bankFairValue(20, 0.2, 0.05, 0.15), 30)
  assert.equal(bankFairValue(0, 0.2, 0.05, 0.15), null)
})

test('PEG(10, 0,20) = 0,5 e P/L justo de Lynch(0,15, 0,04) = 19', () => {
  assert.equal(peg(10, 0.2), 0.5)
  assert.equal(lynchFairPE(0.15, 0.04), 19)
  assert.equal(peg(10, 0), null)
  assert.equal(peg(-5, 0.2), null)
})

test('ceilingPrice divide proventos anuais pelo DY alvo', () => {
  assert.equal(ceilingPrice(3, 0.06), 50)
  assert.equal(ceilingPrice(null, 0.06), null)
  assert.equal(ceilingPrice(3, 0), null)
})

test('magicFormulaRank com 5 empresas sintéticas bate com a ordem calculada à mão', () => {
  // ROIC: D 1, A 2, B 3, E 4, C 5. EY (1/EV/EBIT): C 1 (0,25), B 2 (0,20), E 3 (0,125), A 4 (0,10), D 5 (0,05).
  // Somas: B 5; A, C, D 6 (desempate por maior EY: C, A, D); E 7. F tem EV/EBIT negativo e fica de fora.
  const items = [
    { id: 'A', roic: 0.3, evEbit: 10 },
    { id: 'B', roic: 0.25, evEbit: 5 },
    { id: 'C', roic: 0.1, evEbit: 4 },
    { id: 'D', roic: 0.4, evEbit: 20 },
    { id: 'E', roic: 0.2, evEbit: 8 },
    { id: 'F', roic: 0.5, evEbit: -3 },
  ]
  const ranked = magicFormulaRank(items)
  assert.deepEqual(ranked.map((r) => r.id), ['B', 'C', 'A', 'D', 'E'])
  assert.deepEqual(ranked.map((r) => r.combinedRank), [5, 6, 6, 6, 7])
  assert.deepEqual(ranked.map((r) => r.position), [1, 2, 3, 4, 5])
  const b = ranked[0]
  assert.equal(b.roicRank, 3)
  assert.equal(b.eyRank, 2)
  assert.equal(b.earningsYield, 0.2)
})

test('magicFormulaRank ignora EV/EBIT zero e ROIC ausente; empates dividem a posição', () => {
  const ranked = magicFormulaRank([
    { id: 1, roic: 0.2, evEbit: 5 },
    { id: 2, roic: 0.2, evEbit: 10 },
    { id: 3, roic: null, evEbit: 5 },
    { id: 4, roic: 0.3, evEbit: 0 },
  ])
  assert.deepEqual(ranked.map((r) => r.id), [1, 2])
  assert.deepEqual(ranked.map((r) => r.roicRank), [1, 1])
})

test('magicFormulaRank exclui ROIC ≤ 0 e earnings yield não positivo (EV/EBIT negativo)', () => {
  const ranked = magicFormulaRank([
    { id: 'A', roic: 0.15, evEbit: 6 },
    { id: 'B', roic: 0, evEbit: 4 },
    { id: 'C', roic: -0.05, evEbit: 3 },
    { id: 'D', roic: 0.25, evEbit: -8 },
  ])
  assert.deepEqual(ranked.map((r) => r.id), ['A'])
})
