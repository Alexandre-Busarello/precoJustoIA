import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BDR_PARITY,
  bdrModelBasis,
  bdrParity,
  getUsdBrlSnapshot,
  resolveBdrConversion,
  setUsdBrlSnapshot,
} from '../../strategies/base-strategy'
import { GrahamStrategy } from '../../strategies/graham-strategy'
import { LynchStrategy } from '../../strategies/lynch-strategy'
import { STRATEGY_CONFIG } from '../../strategies/strategy-config'
import type { CompanyData } from '../../strategies/types'

const FX = 5.0187

/**
 * AAPL34 como a cotação do Yahoo traz (09/10/2026): preço, LPA e VPA em reais por recibo, ações contadas em recibos
 * (ações da Apple × 20) e valor de mercado em reais. Lucro do demonstrativo em dólar.
 */
function aapl34(financials: CompanyData['financials'] = {}): CompanyData {
  return {
    ticker: 'AAPL34',
    name: 'Apple',
    sector: 'Tecnologia da Informação',
    industry: 'Equipamentos',
    currentPrice: 85.47,
    financials: {
      lpa: 2.28,
      vpa: 1.8481688,
      pl: 37.486843,
      pvp: 46.245777,
      sharesOutstanding: 291_883_600_000,
      marketCap: 24_947_292_372_992,
      lucroLiquido: 117_000_000_000,
      ...financials,
    },
  }
}

afterEach(() => setUsdBrlSnapshot(null))

test('paridade da tabela documentada e modelos cobertos', () => {
  assert.equal(bdrParity('aapl34'), 20)
  assert.equal(bdrParity('MSFT34'), 24)
  assert.equal(bdrParity('XPTO34'), null)
  assert.ok(Object.values(BDR_PARITY).every((entry) => Number.isInteger(entry.parity) && entry.parity > 0))
  assert.equal(bdrModelBasis('graham'), 'perShare')
  assert.equal(bdrModelBasis('fcd'), 'totals')
  assert.equal(bdrModelBasis('gordon'), 'dividends')
  assert.equal(bdrModelBasis('bazin'), 'dividends')
  assert.equal(bdrModelBasis('lynch'), 'unsupported')
})

test('câmbio do dia: vale por até 4 dias', () => {
  const now = new Date('2026-10-09T12:00:00Z')
  setUsdBrlSnapshot(FX, now)
  assert.equal(getUsdBrlSnapshot(now), FX)
  assert.equal(getUsdBrlSnapshot(new Date('2026-10-12T12:00:00Z')), FX)
  assert.equal(getUsdBrlSnapshot(new Date('2026-10-14T12:00:00Z')), null)
  setUsdBrlSnapshot(Number.NaN, now)
  assert.equal(getUsdBrlSnapshot(now), null)
})

test('sem câmbio ou sem paridade: não aplicável com o motivo', () => {
  const noFx = resolveBdrConversion(aapl34(), 'perShare')
  assert.equal(noFx.ok, false)
  assert.match(noFx.ok ? '' : noFx.reason, /não aplicável a BDR: o câmbio USD\/BRL/)

  setUsdBrlSnapshot(FX)
  const unknown = resolveBdrConversion({ ...aapl34(), ticker: 'XPTO34' }, 'perShare')
  assert.equal(unknown.ok, false)
  assert.match(unknown.ok ? '' : unknown.reason, /paridade do BDR/)

  const otherCurrency = resolveBdrConversion(aapl34({ financialCurrency: 'CNY', usdBrl: FX, bdrRatio: 28 }), 'perShare')
  assert.match(otherCurrency.ok ? '' : otherCurrency.reason, /demonstrativos em CNY/)
})

test('LPA/VPA já em reais por recibo (cotação do BDR): fator 1 e nota com paridade e câmbio', () => {
  setUsdBrlSnapshot(FX)
  const resolution = resolveBdrConversion(aapl34(), 'perShare')
  assert.ok(resolution.ok)
  if (!resolution.ok) return
  assert.equal(resolution.factor, 1)
  assert.equal(resolution.parity, 20)
  assert.equal(resolution.note, 'Convertido por paridade 20 e câmbio 5,02.')

  const graham = new GrahamStrategy().runAnalysis(aapl34(), STRATEGY_CONFIG.graham)
  const expected = Math.sqrt(22.5 * 2.28 * 1.8481688)
  assert.ok(graham.fairValue !== null && Math.abs(graham.fairValue - expected) < 1e-9)
  // Mesmo resultado que o Graham da ação no exterior (US$ 8,72 e US$ 7,36) convertido para recibo: ~R$ 9,6.
  const underlying = Math.sqrt(22.5 * 8.72 * 7.36) * (FX / 20)
  assert.ok(Math.abs(graham.fairValue! / underlying - 1) < 0.05)
  assert.ok(graham.upside !== null && graham.upside > -100 && graham.upside <= 500)
})

test('LPA/VPA em dólar por ação da empresa no exterior: converte por câmbio ÷ paridade', () => {
  setUsdBrlSnapshot(FX)
  const usd = aapl34({ lpa: 8.72, vpa: 7.36, pl: 37.486843, pvp: 46.245777 })
  const resolution = resolveBdrConversion(usd, 'perShare')
  assert.ok(resolution.ok)
  if (!resolution.ok) return
  assert.ok(Math.abs(resolution.factor - FX / 20) < 1e-12)
  const graham = new GrahamStrategy().runAnalysis(usd, STRATEGY_CONFIG.graham)
  assert.ok(graham.fairValue !== null && Math.abs(graham.fairValue - Math.sqrt(22.5 * 8.72 * 7.36) * (FX / 20)) < 1e-9)
})

test('fundamentos que não batem com o preço em nenhuma leitura: não aplicável', () => {
  setUsdBrlSnapshot(FX)
  const broken = aapl34({ lpa: 40, pl: 37.486843 })
  const resolution = resolveBdrConversion(broken, 'perShare')
  assert.equal(resolution.ok, false)
  assert.match(resolution.ok ? '' : resolution.reason, /não batem com o preço do recibo/)
  const graham = new GrahamStrategy().runAnalysis(broken, STRATEGY_CONFIG.graham)
  assert.equal(graham.fairValue, null)
  assert.equal(graham.upside, null)
})

test('histórico de LPA em outra moeda que o atual: não aplicável (a média misturaria moedas)', () => {
  setUsdBrlSnapshot(FX)
  const mixed: CompanyData = {
    ...aapl34(),
    historicalFinancials: [
      { year: 2025, lpa: 7.5 },
      { year: 2024, lpa: 6.1 },
      { year: 2023, lpa: 6.2 },
    ],
  }
  assert.equal(resolveBdrConversion(mixed, 'perShare').ok, false)
  const sameBasis: CompanyData = { ...mixed, historicalFinancials: [{ year: 2025, lpa: 2.0 }, { year: 2024, lpa: 1.6 }] }
  assert.equal(resolveBdrConversion(sameBasis, 'perShare').ok, true)
})

test('proventos do histórico da B3 já em reais por recibo: fator 1', () => {
  setUsdBrlSnapshot(FX)
  const resolution = resolveBdrConversion(aapl34(), 'dividends')
  assert.ok(resolution.ok && resolution.factor === 1)
})

test('FCD: exige moeda, paridade e câmbio nos dados e confere totais × ações', () => {
  setUsdBrlSnapshot(FX)
  const implicit = resolveBdrConversion(aapl34(), 'totals')
  assert.match(implicit.ok ? '' : implicit.reason, /moeda dos demonstrativos/)

  const explicit = { financialCurrency: 'USD', bdrRatio: 20, usdBrl: FX }
  // Ações contadas em recibos (ações × preço do recibo ≈ valor de mercado): total em dólar ÷ recibos × câmbio.
  const receipts = resolveBdrConversion(aapl34(explicit), 'totals')
  assert.ok(receipts.ok && Math.abs(receipts.factor - FX) < 1e-12)

  // Ações da empresa no exterior: total ÷ ações × câmbio ÷ paridade.
  const underlying = resolveBdrConversion(aapl34({ ...explicit, sharesOutstanding: 14_594_180_000 }), 'totals')
  assert.ok(underlying.ok && Math.abs(underlying.factor - FX / 20) < 1e-12)

  // Lucro em reais (base local) não bate com o LPA por recibo depois de converter: não aplicável.
  const brlTotals = resolveBdrConversion(aapl34({ ...explicit, lucroLiquido: 117_000_000_000 * FX }), 'totals')
  assert.equal(brlTotals.ok, false)
})

test('modelos sem conversão seguem não aplicáveis a BDR', () => {
  setUsdBrlSnapshot(FX)
  const lynch = new LynchStrategy().runAnalysis(aapl34())
  assert.equal(lynch.fairValue, null)
  assert.match(lynch.reasoning, /não aplicável a BDR/)
})
