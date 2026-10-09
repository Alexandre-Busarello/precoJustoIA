import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskResult, runAllocation, runMarketAllocation } from '../allocation/engine'
import { DEFAULT_ALLOCATION_OPTIONS, DEFAULT_MARKET_OPTIONS, getPreset } from '../allocation/constants'
import { fundamentalsStatus, type AnnualFundamentals } from '../allocation/fundamentals'
import type { AllocationOptions, AllocationResult, AssetContext, MarketOptions } from '../allocation/types'

const META = { dataDate: '2026-10-07', macro: { selic: 0.15, ke: 0.14 } }

/** Ação elegível: preço 10, Graham 15 (margem 33%), nota 80, liquidez R$ 50 mi/dia, fundamentos preservados. */
function stock(ticker: string, overrides: Partial<AssetContext> = {}): AssetContext {
  return {
    ticker,
    name: `Empresa ${ticker}`,
    assetType: 'stock',
    sector: 'Energia',
    price: 10,
    fairValues: { graham: 15 },
    qualityScore: 80,
    coverage: { used: 9, total: 9 },
    liquidity: 50_000_000,
    fundamentals: { intact: true },
    ...overrides,
  }
}

function fii(ticker: string, overrides: Partial<AssetContext> = {}): AssetContext {
  return {
    ticker,
    name: `Fundo ${ticker}`,
    assetType: 'fii',
    sector: 'Fundos Imobiliários',
    price: 100,
    fairValues: { fiiCeiling: 120 },
    qualityScore: 75,
    coverage: null,
    liquidity: 5_000_000,
    fundamentals: { intact: null },
    ...overrides,
  }
}

function options(overrides: Partial<AllocationOptions> = {}): AllocationOptions {
  return { ...DEFAULT_ALLOCATION_OPTIONS, ...overrides }
}

function assertSane(result: AllocationResult) {
  assert.ok(result.totalAllocated <= result.amount + 1e-9, 'nunca passa do aporte')
  assert.equal(Math.round((result.amount - result.totalAllocated) * 100) / 100, result.leftover)
  for (const row of result.allocations) {
    assert.ok(Number.isInteger(row.qty) && row.qty >= 1, `${row.ticker}: quantidade inteira ≥ 1`)
    assert.equal(row.value, Math.round(row.qty * row.price * 100) / 100)
    assert.ok(row.reasons.length > 0 && row.reasons.some((r) => /\d/.test(r)), `${row.ticker}: motivo numérico`)
  }
  for (const row of result.excluded) {
    assert.ok(row.reasons.length > 0 && row.reasons[0].length > 0, `${row.ticker}: motivo da exclusão`)
  }
}

test('respeita o teto por ativo, não passa do aporte e compra quantidades inteiras', () => {
  const assets = [stock('AAAA3', { price: 37.45, fairValues: { graham: 50 } }), stock('BBBB3', { price: 12.3, fairValues: { graham: 30 } }), stock('CCCC3', { price: 81.9, fairValues: { graham: 100 } })]
  const result = runAllocation({ amount: 2000, assets, options: options(), meta: META })
  assertSane(result)
  assert.equal(result.allocations.length, 3)
  for (const row of result.allocations) assert.ok(row.value <= 0.4 * 2000 + 1e-9, `${row.ticker} ≤ 40% do aporte`)
  assert.ok(result.leftover < 81.9, 'sobra menor que a ação mais cara que ainda cabe')
})

test('teto de concentração na carteira depois do aporte', () => {
  const assets = [
    stock('AAAA3', { holding: { quantity: 200, value: 2000 } }),
    stock('BBBB3', { holding: { quantity: 600, value: 6000 } }),
  ]
  const result = runAllocation({ amount: 2000, assets, options: options({ maxPerAssetPct: 1 }), meta: META })
  assertSane(result)
  const after = 8000 + 2000
  const a = result.allocations.find((r) => r.ticker === 'AAAA3')
  assert.ok(a && 2000 + a.value <= 0.25 * after + 1e-9, 'AAAA3 ≤ 25% da carteira')
  assert.equal(result.allocations.find((r) => r.ticker === 'BBBB3'), undefined, 'BBBB3 já passa de 25%')
  assert.match(result.excluded.find((r) => r.ticker === 'BBBB3')?.reasons[0] ?? '', /limite por ativo/)
})

test('exclui com motivo legível e numérico', () => {
  const assets = [
    stock('ILIQ3', { liquidity: 300_000 }),
    stock('RUIM3', { qualityScore: 35 }),
    stock('CARO3', { fairValues: { graham: 8 } }),
    stock('POUC3', { coverage: { used: 3, total: 9 } }),
    stock('PIOR3', { fundamentals: { intact: false, detail: 'Lucro líquido 12m: Variação de −40,0% no lucro 12m (limite −15,0%).' } }),
    stock('SEMH3', { fundamentals: { intact: false, insufficient: true, detail: 'Faltam dois períodos de 12 meses consecutivos.' } }),
    stock('SEMN3', { qualityScore: null, coverage: null }),
    { ...stock('AAPL34'), assetType: 'bdr' as const },
    { ...stock('BOVA11'), assetType: 'etf' as const, fairValues: {} },
    stock('BOMM3'),
  ]
  const result = runAllocation({ amount: 1000, assets, options: options(), meta: META })
  assertSane(result)
  assert.deepEqual(result.allocations.map((r) => r.ticker), ['BOMM3'])
  const reason = (t: string) => result.excluded.find((r) => r.ticker === t)?.reasons[0] ?? ''
  assert.match(reason('ILIQ3'), /Liquidez média de R\$\s300\.000,00\/dia, abaixo do mínimo de R\$\s1,0\smi\/dia/)
  assert.match(reason('RUIM3'), /Nota de qualidade 35\/100, abaixo do mínimo de 50/)
  assert.match(reason('CARO3'), /Acima do valor estimado em todos os modelos escolhidos \(margem: Graham −25,0%\)/)
  assert.match(reason('POUC3'), /3 de 9 critérios/)
  assert.match(reason('PIOR3'), /Fundamentos em piora.*−40,0%/)
  assert.match(reason('SEMH3'), /Sem histórico suficiente/)
  assert.match(reason('SEMN3'), /Sem nota de qualidade/)
  assert.match(reason('AAPL34'), /^BDR/)
  assert.match(reason('BOVA11'), /^ETF/)
  // O teto de 40% deixa sobra quando só um ativo é elegível.
  assert.equal(result.allocations[0].value, 400)
  assert.equal(result.leftover, 600)
})

test('motivos com números do desconto e da qualidade', () => {
  const asset = stock('MULT3', { price: 10, fairValues: { graham: 12, bazin: 13, fcd: 9 }, qualityScore: 81 })
  const result = runAllocation({ amount: 1000, assets: [asset], options: options(), meta: META })
  const reasons = result.allocations[0].reasons
  assert.equal(reasons[0], '23,1% abaixo do preço-teto (Bazin)')
  assert.equal(reasons[1], 'Desconto mediano de 16,7% em 3 modelos')
  assert.equal(reasons[2], 'Nota de qualidade 81/100 (9 de 9 critérios)')
  const hidden = runAllocation({ amount: 1000, assets: [asset], options: options({ revealQuality: false }), meta: META })
  assert.ok(hidden.allocations[0].reasons.every((r) => !r.includes('81')))
})

test('só os modelos escolhidos contam (plano gratuito = Graham)', () => {
  const asset = stock('BAZN3', { fairValues: { graham: null, bazin: 14 } })
  const premium = runAllocation({ amount: 500, assets: [asset], options: options(), meta: META })
  assert.equal(premium.allocations.length, 1)
  const free = runAllocation({ amount: 500, assets: [asset], options: options({ models: ['graham'] }), meta: META })
  assert.equal(free.allocations.length, 0)
  assert.match(free.excluded[0].reasons[0], /Sem preço justo calculável nos modelos escolhidos \(Graham\)/)
})

/** Comportamento antigo de getContributionSuggestions: só abaixo do alvo, ordem e valor pela distância até o alvo. */
test('modo pesos-alvo com peso de valuation 0 reproduz a prioridade "mais distante do alvo"', () => {
  const holdings: AssetContext[] = [
    stock('AAAA3', { holding: { quantity: 100, value: 1000 }, targetWeight: 0.4 }), // 10% → gap 30 p.p.
    stock('BBBB3', { holding: { quantity: 500, value: 5000 }, targetWeight: 0.3 }), // 50% → acima
    stock('CCCC3', { holding: { quantity: 300, value: 3000 }, targetWeight: 0.2 }), // 30% → acima
    stock('DDDD3', { holding: { quantity: 100, value: 1000 }, targetWeight: 0.1 }), // 10% → no alvo
  ]
  const result = runAllocation({
    amount: 1000,
    assets: [...holdings, stock('EEEE3', { targetWeight: 0.0 })],
    options: options({ weights: { valuation: 0, quality: 0, targetGap: 1 }, respectTargets: true, maxPerAssetPct: 1, maxPortfolioPct: 1 }),
    meta: META,
  })
  assertSane(result)
  assert.deepEqual(result.allocations.map((r) => r.ticker), ['AAAA3'])
  assert.match(result.excluded.find((r) => r.ticker === 'EEEE3')?.reasons[0] ?? '', /Sem peso-alvo/)
  assert.equal(result.allocations[0].value, 1000)
  assert.match(result.allocations[0].reasons.join(' | '), /30,0 p\.p\. abaixo do peso-alvo \(10,0% → alvo 40,0%\)/)
  assert.match(result.excluded.find((r) => r.ticker === 'BBBB3')?.reasons[0] ?? '', /Já está no peso-alvo ou acima/)

  const two = runAllocation({
    amount: 3000,
    assets: [
      stock('AAAA3', { holding: { quantity: 100, value: 1000 }, targetWeight: 0.5 }), // gap 0,4
      stock('BBBB3', { holding: { quantity: 800, value: 8000 }, targetWeight: 0.5 }), // acima
      stock('CCCC3', { holding: { quantity: 100, value: 1000 }, targetWeight: 0.3 }), // gap 0,2 (soma dos alvos > 1 de propósito)
    ],
    options: options({ weights: { valuation: 0, quality: 0, targetGap: 1 }, respectTargets: true, maxPerAssetPct: 1, maxPortfolioPct: 1 }),
    meta: META,
  })
  assertSane(two)
  const [first, second] = two.allocations
  assert.equal(first.ticker, 'AAAA3', 'o mais distante do alvo recebe mais')
  assert.equal(second.ticker, 'CCCC3')
  assert.equal(first.value, 2000, 'proporcional à distância: 2/3 do aporte')
  assert.equal(second.value, 1000)
})

test('nunca passa do alvo ao seguir os pesos', () => {
  const result = runAllocation({
    amount: 5000,
    assets: [stock('AAAA3', { holding: { quantity: 100, value: 1000 }, targetWeight: 0.2 }), stock('BBBB3', { holding: { quantity: 400, value: 4000 }, targetWeight: 0.8 })],
    options: options({ ...{ weights: getPreset('pesos').weights }, respectTargets: true, maxPerAssetPct: 1, maxPortfolioPct: 1 }),
    meta: META,
  })
  assertSane(result)
  const after = 5000 + 5000
  for (const row of result.allocations) {
    const held = row.ticker === 'AAAA3' ? 1000 : 4000
    const target = row.ticker === 'AAAA3' ? 0.2 : 0.8
    assert.ok(held + row.value <= target * after + 1e-9, `${row.ticker} não passa do alvo`)
  }
})

test('resultado determinístico e independente da ordem de entrada', () => {
  const assets = [
    stock('AAAA3', { price: 21.7, fairValues: { graham: 30 } }),
    stock('BBBB3', { price: 21.7, fairValues: { graham: 30 } }),
    stock('CCCC3', { price: 9.99, fairValues: { graham: 14, bazin: 12 }, qualityScore: 70 }),
    fii('DDDD11'),
  ]
  const a = runAllocation({ amount: 1234.56, assets, options: options(), meta: META })
  const b = runAllocation({ amount: 1234.56, assets: [...assets].reverse(), options: options(), meta: META })
  assert.deepEqual(a, b)
  assertSane(a)
  // Empate total: desempata por ticker.
  const tie = a.allocations.filter((r) => r.ticker === 'AAAA3' || r.ticker === 'BBBB3')
  assert.ok(tie[0].qty >= tie[1].qty)
})

test('preset muda a distribuição de forma previsível', () => {
  const assets = [stock('DESC3', { fairValues: { graham: 25 }, qualityScore: 55 }), stock('QUAL3', { fairValues: { graham: 11 }, qualityScore: 95 })]
  const desconto = runAllocation({ amount: 1000, assets, options: options({ weights: getPreset('desconto').weights, maxPerAssetPct: 1 }), meta: META })
  const equilibrio = runAllocation({ amount: 1000, assets, options: options({ weights: getPreset('equilibrio').weights, maxPerAssetPct: 1 }), meta: META })
  const valueOf = (r: AllocationResult, t: string) => r.allocations.find((a) => a.ticker === t)?.value ?? 0
  assert.ok(valueOf(desconto, 'DESC3') > valueOf(equilibrio, 'DESC3'))
  assert.ok(valueOf(desconto, 'QUAL3') < valueOf(equilibrio, 'QUAL3'))
})

test('universo vazio ou todo excluído devolve estado vazio claro', () => {
  const empty = runAllocation({ amount: 1000, assets: [], options: options(), meta: META })
  assert.deepEqual(empty.allocations, [])
  assert.equal(empty.leftover, 1000)
  const all = runAllocation({ amount: 1000, assets: [stock('CARO3', { fairValues: { graham: 5 } })], options: options(), meta: META })
  assert.equal(all.allocations.length, 0)
  assert.equal(all.totalAllocated, 0)
  assert.equal(all.excluded.length, 1)
})

test('universo misto de FII e ação', () => {
  const result = runAllocation({ amount: 2000, assets: [stock('AAAA3'), fii('HGLG11', { price: 158.4, fairValues: { fiiCeiling: 190 } })], options: options(), meta: META })
  assertSane(result)
  const f = result.allocations.find((r) => r.ticker === 'HGLG11')
  assert.ok(f, 'FII entra pelo preço-teto')
  assert.equal(f.assetType, 'fii')
  assert.match(f.reasons[0], /abaixo do preço-teto do FII/)
})

test('sem fracionário compra ações em lotes de 100', () => {
  const result = runAllocation({ amount: 5000, assets: [stock('AAAA3', { price: 9.5 }), fii('XPML11', { price: 105 })], options: options({ allowFractional: false, maxPerAssetPct: 1 }), meta: META })
  assertSane(result)
  const a = result.allocations.find((r) => r.ticker === 'AAAA3')
  assert.ok(a && a.qty % 100 === 0)
})

test('lote mais caro que o aporte vai para "ficaram de fora" com o motivo', () => {
  const result = runAllocation({ amount: 100, assets: [stock('CARA3', { price: 450, fairValues: { graham: 600 } })], options: options(), meta: META })
  assert.equal(result.allocations.length, 0)
  assert.match(result.excluded[0].reasons[0], /custa R\$\s450,00, acima do aporte/)
})

/** Universo de mercado: 3 setores com 4 ações cada, prioridades decrescentes. */
function marketUniverse(): AssetContext[] {
  const sectors = ['Energia', 'Financeiro', 'Saúde']
  const out: AssetContext[] = []
  sectors.forEach((sector, si) => {
    for (let i = 0; i < 4; i++) {
      out.push(stock(`${sector.slice(0, 3).toUpperCase()}${i}3`, { sector, price: 10 + i, fairValues: { graham: 20 - si - i }, qualityScore: 90 - i * 5 }))
    }
  })
  out.push(stock('ILIQ3', { liquidity: 10_000 }))
  out.push(stock('RUIM3', { qualityScore: 20 }))
  out.push(stock('CARO3', { fairValues: { graham: 5 } }))
  out.push({ ...stock('AAPL34'), assetType: 'bdr' })
  return out
}

function market(overrides: Partial<MarketOptions> = {}): MarketOptions {
  return { ...DEFAULT_MARKET_OPTIONS, ...overrides }
}

test('todo o mercado: contagem por etapa, N ativos e limite por setor', () => {
  const result = runMarketAllocation({ amount: 2000, assets: marketUniverse(), options: options(), market: market(), meta: META })
  assertSane(result)
  assert.deepEqual(
    result.funnel?.map((s) => s.count),
    [16, 15, 14, 14, 13, 13, 12],
    'BDR → liquidez → (dados) → qualidade → (fundamentos) → valor estimado'
  )
  assert.equal(result.allocations.length, 5)
  const perSector = new Map<string, number>()
  const valuePerSector = new Map<string, number>()
  for (const row of result.allocations) {
    perSector.set(row.sector ?? '', (perSector.get(row.sector ?? '') ?? 0) + 1)
    valuePerSector.set(row.sector ?? '', (valuePerSector.get(row.sector ?? '') ?? 0) + row.value)
  }
  for (const [, count] of perSector) assert.ok(count <= 2)
  for (const [, value] of valuePerSector) assert.ok(value <= 0.35 * 2000 + 1e-9)
  assert.ok((result.candidates?.length ?? 0) <= 20)
  assert.equal(result.candidates?.[0].rank, 1)
  assert.ok(result.candidates?.some((c) => c.status === 'lower-priority' && /menor que a do 5º selecionado/.test(c.note)))

  const onePerSector = runMarketAllocation({ amount: 2000, assets: marketUniverse(), options: options(), market: market({ sectorMaxAssets: 1 }), meta: META })
  assertSane(onePerSector)
  assert.equal(onePerSector.allocations.length, 3, 'só 3 setores no universo')
  assert.equal(new Set(onePerSector.allocations.map((r) => r.sector)).size, 3)
  assert.ok(onePerSector.candidates?.some((c) => c.status === 'sector-limit' && /Limite de 1 ativo por setor/.test(c.note)))
})

test('todo o mercado: número de ativos e exclusões do usuário', () => {
  const one = runMarketAllocation({ amount: 2000, assets: marketUniverse(), options: options(), market: market({ maxAssets: 1 }), meta: META })
  assert.equal(one.allocations.length, 1)
  const top = one.allocations[0].ticker
  const without = runMarketAllocation({ amount: 2000, assets: marketUniverse(), options: options(), market: market({ maxAssets: 1 }), meta: META, excludeTickers: [top] })
  assert.notEqual(without.allocations[0].ticker, top)
})

test('complementar a carteira tira prioridade de setor já pesado', () => {
  const base = runMarketAllocation({ amount: 2000, assets: marketUniverse(), options: options(), market: market({ complementPortfolio: false }), meta: META })
  const energyBase = base.allocations.filter((r) => r.sector === 'Energia').reduce((s, r) => s + r.value, 0)
  assert.ok(energyBase > 0)
  const complemented = runMarketAllocation({
    amount: 2000,
    assets: marketUniverse(),
    options: options(),
    market: market({ complementPortfolio: true, portfolio: [{ ticker: 'XXXX3', sector: 'Energia', value: 9000 }, { ticker: 'YYYY3', sector: 'Saúde', value: 1000 }] }),
    meta: META,
  })
  const energy = complemented.allocations.filter((r) => r.sector === 'Energia').reduce((s, r) => s + r.value, 0)
  assert.ok(energy < energyBase, 'menos aporte no setor que já pesa 90% da carteira')
  const penalized = complemented.candidates?.find((c) => c.sector === 'Energia')
  assert.equal(penalized?.components.penalty, 0.5)
})

test('todo o mercado: determinístico e rápido com 600 ativos', () => {
  const universe: AssetContext[] = Array.from({ length: 600 }, (_, i) =>
    stock(`T${String(i).padStart(3, '0')}3`, {
      sector: ['Energia', 'Financeiro', 'Saúde', 'Varejo', 'Utilidade Pública', 'Materiais'][i % 6],
      price: 5 + (i % 37),
      fairValues: { graham: 5 + ((i * 7) % 53), bazin: 4 + ((i * 11) % 47) },
      qualityScore: 40 + (i % 60),
      liquidity: (i % 5) * 1_000_000,
    })
  )
  const start = performance.now()
  const a = runMarketAllocation({ amount: 2000, assets: universe, options: options(), market: market(), meta: META })
  const elapsed = performance.now() - start
  const b = runMarketAllocation({ amount: 2000, assets: [...universe].reverse(), options: options(), market: market(), meta: META })
  assert.deepEqual(a, b)
  assertSane(a)
  assert.ok(elapsed < 500, `motor em ${elapsed.toFixed(0)} ms`)
})

test('prévia bloqueada mantém a forma sem revelar ativos', () => {
  const result = runMarketAllocation({ amount: 2000, assets: marketUniverse(), options: options(), market: market(), meta: META })
  const masked = maskResult(result, { hideTickers: true })
  assert.equal(masked.allocations.length, result.allocations.length)
  assert.deepEqual(masked.funnel, result.funnel)
  assert.ok(masked.allocations.every((a) => a.ticker.startsWith('ATIVO') && a.value === 0 && a.reasons.length === 0))
  assert.equal(masked.excluded.length, 0)
})

test('fundamentos: dois anos de dados alimentam fundamentalsIntact', () => {
  const year = (y: number, o: Partial<AnnualFundamentals> = {}): AnnualFundamentals => ({
    year: y,
    lucroLiquido: 1000,
    roe: 0.2,
    margemLiquida: 0.15,
    ebitda: 2000,
    dividaLiquidaEbitda: 1,
    ...o,
  })
  assert.deepEqual(fundamentalsStatus({ annual: [year(2025), year(2024)], financial: false }), { intact: true })
  const drop = fundamentalsStatus({ annual: [year(2025, { lucroLiquido: 500 }), year(2024)], financial: false })
  assert.equal(drop.intact, false)
  assert.match(drop.detail ?? '', /Lucro líquido 12m/)
  const leverage = fundamentalsStatus({ annual: [year(2025, { dividaLiquidaEbitda: 3 }), year(2024)], financial: false })
  assert.match(leverage.detail ?? '', /Dívida líquida\/EBITDA/)
  // Bancos: sem EBITDA, a alavancagem não se aplica.
  const bank = fundamentalsStatus({ annual: [year(2025, { ebitda: null, dividaLiquidaEbitda: null }), year(2024, { ebitda: null, dividaLiquidaEbitda: null })], financial: true })
  assert.deepEqual(bank, { intact: true })
  const missing = fundamentalsStatus({ annual: [year(2025)], financial: false })
  assert.equal(missing.insufficient, true)
  const gap = fundamentalsStatus({ annual: [year(2025), year(2022)], financial: false })
  assert.equal(gap.insufficient, true)
})

test('desconto conta mesmo com mediana negativa: "Mais desconto" e "Equilíbrio" ordenam diferente', () => {
  // AAAA3: Graham +10%, FCD −60% (mediana −25%), nota 90. BBBB3: Graham +5%, FCD −10% (mediana −2,5%), nota 60.
  const assets = [
    stock('AAAA3', { fairValues: { graham: 10 / 0.9, fcd: 10 / 1.6 }, qualityScore: 90 }),
    stock('BBBB3', { fairValues: { graham: 10 / 0.95, fcd: 10 / 1.1 }, qualityScore: 60 }),
  ]
  const run = (preset: 'desconto' | 'equilibrio') => {
    const result = runAllocation({ amount: 2000, assets, options: options({ models: ['graham', 'fcd'], weights: getPreset(preset).weights }), meta: META })
    assertSane(result)
    return new Map(result.allocations.map((row) => [row.ticker, row.components]))
  }
  const desconto = run('desconto')
  const equilibrio = run('equilibrio')
  const a = desconto.get('AAAA3')!
  const b = desconto.get('BBBB3')!
  assert.ok(Math.abs(a.normalized.valuation - 0.25) < 1e-9, 'mediana −25% → 0,25')
  assert.ok(Math.abs(b.normalized.valuation - 0.475) < 1e-9, 'mediana −2,5% → 0,475')
  assert.ok(b.priority > a.priority, 'Mais desconto prioriza a menor distância do valor estimado')
  assert.ok(equilibrio.get('AAAA3')!.priority > equilibrio.get('BBBB3')!.priority, 'Equilíbrio pesa a qualidade')
})
