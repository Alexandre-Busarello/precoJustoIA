import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INSUFFICIENT_DATA_CHECK,
  dipWithIntactFundamentals,
  drawdownFrom52wHigh,
  fundamentalsIntact,
  priceVsSma,
  smaAt,
  type PricePoint,
  type QuarterFundamentals,
} from '../../finance/signals'

/** Série diária a partir de 2025-01-01 com os fechamentos informados. */
function series(closes: readonly number[]): PricePoint[] {
  return closes.map((close, i) => ({ date: new Date(Date.UTC(2025, 0, 1 + i)), close }))
}

const flat = (n: number, value: number) => Array<number>(n).fill(value)

/** 8 trimestres estáveis: lucro 100, ROE 5%/tri, margem 10%, dívida 400, EBITDA 100/tri (alavancagem 1,0x). */
function stableQuarters(overrides: Partial<QuarterFundamentals>[] = []): QuarterFundamentals[] {
  return Array.from({ length: 8 }, (_, i) => ({
    date: new Date(Date.UTC(2024, i * 3 + 2, 31)),
    lucroLiquido: 100,
    roe: 0.05,
    margemLiquida: 0.1,
    dividaLiquida: 400,
    ebitda: 100,
    ...overrides[i],
  }))
}

/** Aplica o mesmo override aos últimos 4 trimestres. */
function lastFour(override: Partial<QuarterFundamentals>): Partial<QuarterFundamentals>[] {
  return [{}, {}, {}, {}, override, override, override, override]
}

test('smaAt: média dos últimos N fechamentos; null com menos de N pontos', () => {
  const prices = series([1, 2, 3, 4])
  assert.equal(smaAt(prices, 3), 3)
  assert.equal(smaAt(prices, 5), null)
  assert.equal(smaAt(prices, 2, new Date(Date.UTC(2025, 0, 3))), 2.5)
  assert.equal(smaAt([], 200), null)
})

test('priceVsSma: abaixo da média de 200 dá pctAbove negativo', () => {
  const result = priceVsSma(series([...flat(199, 10), 9]), 200)
  assert.equal(result.sma, 9.995)
  assert.ok(result.pctAbove !== null && result.pctAbove < 0)
  assert.equal(Number(result.pctAbove.toFixed(4)), -0.0995)
})

test('priceVsSma: dados insuficientes → campos null', () => {
  assert.deepEqual(priceVsSma(series(flat(150, 10)), 200), { sma: null, pctAbove: null })
})

test('drawdownFrom52wHigh usa só as últimas 52 semanas', () => {
  // Pico de 200 há mais de um ano (fora da janela), pico de 100 dentro dela, último fechamento 70.
  const closes = [200, ...flat(30, 90), 100, ...flat(360, 80), 70]
  const result = drawdownFrom52wHigh(series(closes))
  assert.equal(result.high52w, 100)
  assert.equal(Number(result.drawdown?.toFixed(4)), -0.3)
  assert.deepEqual(drawdownFrom52wHigh([]), { high52w: null, drawdown: null })
})

test('drawdownFrom52wHigh é 0 na máxima', () => {
  assert.equal(drawdownFrom52wHigh(series([10, 11, 12])).drawdown, 0)
})

test('fundamentalsIntact: 8 trimestres estáveis → intacto, com os 4 critérios', () => {
  const result = fundamentalsIntact(stableQuarters())
  assert.equal(result.intact, true)
  assert.deepEqual(result.checks.map((c) => c.name), ['Lucro líquido 12m', 'ROE 12m', 'Margem líquida 12m', 'Dívida líquida/EBITDA'])
})

test('fundamentalsIntact: lucro 12m caindo 15% passa, 20% reprova', () => {
  assert.equal(fundamentalsIntact(stableQuarters(lastFour({ lucroLiquido: 85 }))).intact, true)
  const result = fundamentalsIntact(stableQuarters(lastFour({ lucroLiquido: 80 })))
  assert.equal(result.intact, false)
  assert.equal(result.checks.find((c) => c.name === 'Lucro líquido 12m')?.passed, false)
})

test('fundamentalsIntact: lucro anterior negativo só passa se não piorar', () => {
  const before = [{ lucroLiquido: -10 }, { lucroLiquido: -10 }, { lucroLiquido: -10 }, { lucroLiquido: -10 }]
  assert.equal(fundamentalsIntact(stableQuarters([...before, ...lastFour({ lucroLiquido: -5 }).slice(4)])).checks[0].passed, true)
  assert.equal(fundamentalsIntact(stableQuarters([...before, ...lastFour({ lucroLiquido: -20 }).slice(4)])).checks[0].passed, false)
})

test('fundamentalsIntact: ROE 12m caindo mais de 3 p.p. reprova', () => {
  // ROE 12m de 20% (4 × 5%) para 16% (4 × 4%): −4 p.p.
  const result = fundamentalsIntact(stableQuarters(lastFour({ roe: 0.04 })))
  assert.equal(result.intact, false)
  assert.equal(result.checks.find((c) => c.name === 'ROE 12m')?.passed, false)
  // 20% → 18% (−2 p.p.) passa.
  assert.equal(fundamentalsIntact(stableQuarters(lastFour({ roe: 0.045 }))).intact, true)
})

test('fundamentalsIntact: margem líquida 12m caindo mais de 3 p.p. reprova', () => {
  const result = fundamentalsIntact(stableQuarters(lastFour({ margemLiquida: 0.06 })))
  assert.equal(result.intact, false)
  assert.equal(result.checks.find((c) => c.name === 'Margem líquida 12m')?.passed, false)
  assert.equal(fundamentalsIntact(stableQuarters(lastFour({ margemLiquida: 0.07 }))).intact, true)
})

test('fundamentalsIntact: dívida líquida/EBITDA subindo mais de 1,0x reprova', () => {
  // De 1,0x (400/400) para 2,5x (1000/400).
  const overrides = lastFour({})
  overrides[7] = { dividaLiquida: 1000 }
  const result = fundamentalsIntact(stableQuarters(overrides))
  assert.equal(result.intact, false)
  assert.equal(result.checks.find((c) => c.name === 'Dívida líquida/EBITDA')?.passed, false)
  // De 1,0x para 2,0x (+1,0x) ainda passa.
  overrides[7] = { dividaLiquida: 800 }
  assert.equal(fundamentalsIntact(stableQuarters(overrides)).intact, true)
})

test('fundamentalsIntact: EBITDA 12m não positivo reprova', () => {
  const result = fundamentalsIntact(stableQuarters(lastFour({ ebitda: -10 })))
  assert.equal(result.checks.find((c) => c.name === 'Dívida líquida/EBITDA')?.passed, false)
})

test('fundamentalsIntact: menos de 8 trimestres → dados insuficientes', () => {
  const result = fundamentalsIntact(stableQuarters().slice(0, 7))
  assert.equal(result.intact, false)
  assert.equal(result.checks.length, 1)
  assert.equal(result.checks[0].name, INSUFFICIENT_DATA_CHECK)
})

test('fundamentalsIntact: campo ausente reprova sem benefício da dúvida', () => {
  const overrides = lastFour({})
  overrides[5] = { roe: null }
  const result = fundamentalsIntact(stableQuarters(overrides))
  assert.equal(result.intact, false)
  const insufficient = result.checks.filter((c) => c.name === INSUFFICIENT_DATA_CHECK)
  assert.equal(insufficient.length, 1)
  assert.match(insufficient[0].detail, /ROE/)
})

test("fundamentalsIntact: base 'ttm' compara o último valor com o de 4 trimestres antes", () => {
  const overrides: Partial<QuarterFundamentals>[] = Array.from({ length: 8 }, () => ({ roe: 0.2, margemLiquida: 0.1 }))
  overrides[7] = { roe: 0.16, margemLiquida: 0.1 }
  const result = fundamentalsIntact(stableQuarters(overrides), { ratioBasis: 'ttm' })
  assert.equal(result.checks.find((c) => c.name === 'ROE 12m')?.passed, false)
  assert.equal(result.checks.find((c) => c.name === 'Margem líquida 12m')?.passed, true)
})

test('dipWithIntactFundamentals: abaixo da média de 200 com fundamentos intactos → true', () => {
  const prices = series([...flat(199, 10), 9])
  assert.equal(dipWithIntactFundamentals({ prices, quarters: stableQuarters() }), true)
})

test('dipWithIntactFundamentals: queda de 20% desde a máxima, mesmo acima da média → true', () => {
  // Média de 200 ≈ 50; último 80 fica acima dela, mas 20% abaixo da máxima de 100.
  const prices = series([...flat(190, 45), 100, ...flat(8, 90), 80])
  assert.ok((priceVsSma(prices).pctAbove ?? 0) > 0)
  assert.equal(dipWithIntactFundamentals({ prices, quarters: stableQuarters() }), true)
})

test('dipWithIntactFundamentals: sem correção de preço → false', () => {
  const prices = series([...flat(199, 10), 11])
  assert.equal(dipWithIntactFundamentals({ prices, quarters: stableQuarters() }), false)
})

test('dipWithIntactFundamentals: correção com fundamentos piorando → false', () => {
  const prices = series([...flat(199, 10), 9])
  assert.equal(dipWithIntactFundamentals({ prices, quarters: stableQuarters(lastFour({ lucroLiquido: 50 })) }), false)
})

test('dipWithIntactFundamentals: dados insuficientes → false', () => {
  assert.equal(dipWithIntactFundamentals({ prices: series(flat(50, 10)), quarters: stableQuarters() }), false)
  assert.equal(dipWithIntactFundamentals({ prices: series([...flat(199, 10), 9]), quarters: [] }), false)
  assert.equal(dipWithIntactFundamentals({}), false)
})

test('dipWithIntactFundamentals aceita valores pré-calculados', () => {
  assert.equal(dipWithIntactFundamentals({ priceVsSma200: { pctAbove: -0.05 }, drawdown52w: -0.1, fundamentals: { intact: true } }), true)
  assert.equal(dipWithIntactFundamentals({ priceVsSma200: { pctAbove: 0.05 }, drawdown52w: -0.2, fundamentals: { intact: true } }), true)
  assert.equal(dipWithIntactFundamentals({ priceVsSma200: { pctAbove: 0.05 }, drawdown52w: -0.19, fundamentals: { intact: true } }), false)
  assert.equal(dipWithIntactFundamentals({ priceVsSma200: null, drawdown52w: -0.3, fundamentals: { intact: false } }), false)
})
