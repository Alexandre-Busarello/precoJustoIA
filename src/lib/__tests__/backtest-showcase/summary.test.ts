import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHOWCASE_DEFINITIONS, SHOWCASE_MIN_MONTHS, type ShowcaseDefinition } from '@/lib/backtest-showcase/definitions'
import {
  SHOWCASE_MAX_POINTS,
  allOrNothing,
  commonStart,
  downsample,
  formatShowcasePeriod,
  isoDay,
  showcaseWindow,
  summarizeShowcase,
  type ShowcaseEngineResult,
} from '@/lib/backtest-showcase/summary'
import { showcaseCompositionLabel, showcaseMoneyLabel } from '@/components/backtest-showcase/labels'

const utc = (y: number, m: number, d = 1) => new Date(Date.UTC(y, m - 1, d))

test('definições: três carteiras fixas, nesta ordem, sem falar de desempenho', () => {
  assert.deepEqual(
    SHOWCASE_DEFINITIONS.map((d) => d.id),
    ['ibov-aportes', 'dividendos-etf', 'exemplo-5-acoes']
  )
  assert.deepEqual(SHOWCASE_DEFINITIONS[2].tickers, ['PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'BBAS3'])
  for (const d of SHOWCASE_DEFINITIONS) {
    assert.doesNotMatch(d.why, /rend|retorno|lucro|ganh|bat|melhor|%/i)
  }
})

test('janela: últimos 5 anos completos até o 1º dia do mês corrente em Brasília', () => {
  const w = showcaseWindow(new Date('2026-10-09T15:00:00Z'))
  assert.equal(isoDay(w.startDate), '2021-10-01')
  assert.equal(isoDay(w.endDate), '2026-10-01')
})

test('janela: virada de mês segue o fuso de Brasília, não o UTC', () => {
  // 1º de novembro 01:00 UTC ainda é 31 de outubro 22:00 em Brasília
  const before = showcaseWindow(new Date('2026-11-01T01:00:00Z'))
  assert.equal(isoDay(before.endDate), '2026-10-01')
  assert.equal(isoDay(before.startDate), '2021-10-01')
  // 1º de novembro 03:00 UTC é meia-noite em Brasília: a janela anda um mês
  const after = showcaseWindow(new Date('2026-11-01T03:00:00Z'))
  assert.equal(isoDay(after.endDate), '2026-11-01')
  assert.equal(isoDay(after.startDate), '2021-11-01')
  // Virada de ano
  const january = showcaseWindow(new Date('2027-01-01T12:00:00Z'))
  assert.equal(isoDay(january.startDate), '2022-01-01')
  assert.equal(isoDay(january.endDate), '2027-01-01')
})

test('início comum: sem atraso usa a janela; com atraso, o início mais tardio para todas', () => {
  const window = { startDate: utc(2021, 10), endDate: utc(2026, 10) }
  assert.deepEqual(commonStart(window, [utc(2021, 10), utc(2021, 10)]), { startDate: utc(2021, 10), shortened: false })
  // Início no meio do mês conta como o mês inteiro
  assert.deepEqual(commonStart(window, [utc(2021, 10), utc(2022, 3, 15)]), { startDate: utc(2022, 3), shortened: true })
})

test('início comum: menos de 36 meses de histórico comum não gera vitrine', () => {
  const window = { startDate: utc(2021, 10), endDate: utc(2026, 10) }
  assert.equal(SHOWCASE_MIN_MONTHS, 36)
  assert.ok(commonStart(window, [utc(2023, 10)])) // exatamente 36 meses
  assert.equal(commonStart(window, [utc(2023, 11)]), null) // 35 meses
})

test('redução da série: até o limite fica inteira; acima, mantém primeiro e último', () => {
  const sixty = Array.from({ length: 60 }, (_, i) => i)
  assert.deepEqual(downsample(sixty), sixty)
  const long = Array.from({ length: 121 }, (_, i) => i)
  const reduced = downsample(long)
  assert.equal(reduced.length, SHOWCASE_MAX_POINTS)
  assert.equal(reduced[0], 0)
  assert.equal(reduced[reduced.length - 1], 120)
  assert.deepEqual([...reduced].sort((a, b) => a - b), reduced, 'em ordem')
  assert.equal(new Set(reduced).size, reduced.length, 'sem repetição')
  assert.deepEqual(downsample([1, 2, 3, 4], 2), [1, 4])
})

test('tudo ou nada: uma vitrine faltando esconde o bloco inteiro', () => {
  assert.deepEqual(allOrNothing([1, 2, 3]), [1, 2, 3])
  assert.equal(allOrNothing([1, null, 3]), null)
  assert.equal(allOrNothing([1, undefined]), null)
  assert.equal(allOrNothing([]), null)
})

const definition: ShowcaseDefinition = {
  id: 'teste',
  title: 'Teste',
  why: 'Uma carteira de teste.',
  tickers: ['BOVA11'],
  initialCapital: 0,
  monthlyContribution: 1000,
  rebalanceFrequency: 'monthly',
}

function engineResult(overrides: Partial<ShowcaseEngineResult> = {}): ShowcaseEngineResult {
  return {
    finalValue: 3300,
    totalInvested: 3000,
    totalReturn: 0.1, // fração: 10%
    annualizedReturn: 0.25,
    maxDrawdown: 0.05,
    volatility: 0.18,
    monthlyReturns: [
      { date: '2021-10-31', portfolioValue: 1000, cdiValue: 1005, ibovValue: 990 },
      { date: '2021-11-30', portfolioValue: 2100, cdiValue: 2015, ibovValue: 1950 },
      { date: '2021-12-31', portfolioValue: 3300, cdiValue: 3030, ibovValue: 2700 },
    ],
    assumptions: { tradingCostRate: 0.0003, totalTradingCosts: 0.9 },
    ...overrides,
  }
}

test('resumo: mantém as frações do motor e calcula o retorno dos benchmarks sobre o mesmo aporte', () => {
  const summary = summarizeShowcase(definition, [1], engineResult())
  assert.ok(summary)
  assert.equal(summary.totalReturn, 0.1)
  assert.equal(summary.annualizedReturn, 0.25)
  assert.equal(summary.maxDrawdown, 0.05)
  assert.equal(summary.volatility, 0.18)
  assert.equal(summary.tradingCostRate, 0.0003)
  assert.equal(summary.totalTradingCosts, 0.9)
  assert.equal(summary.finalValue, 3300)
  assert.equal(summary.cdiFinalValue, 3030)
  assert.equal(summary.ibovFinalValue, 2700)
  assert.ok(Math.abs(summary.cdiReturn - 0.01) < 1e-12)
  assert.ok(Math.abs(summary.ibovReturn - -0.1) < 1e-12)
  assert.equal(summary.firstMonth, '2021-10')
  assert.equal(summary.lastMonth, '2021-12')
  assert.equal(summary.months, 3)
  assert.deepEqual(summary.series[2], { month: '2021-12', portfolio: 3300, cdi: 3030, ibov: 2700 })
  // Serializável (vai para o data cache como JSON)
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), summary)
})

test('resumo: sem CDI ou Ibovespa em algum mês, sem meses ou sem custos, não há resumo', () => {
  const months = engineResult().monthlyReturns
  assert.equal(summarizeShowcase(definition, [1], engineResult({ monthlyReturns: [] })), null)
  assert.equal(
    summarizeShowcase(definition, [1], engineResult({ monthlyReturns: [months[0], { date: '2021-11-30', portfolioValue: 2100, ibovValue: 1950 }] })),
    null
  )
  assert.equal(
    summarizeShowcase(definition, [1], engineResult({ monthlyReturns: [{ date: '2021-10-31', portfolioValue: 1000, cdiValue: 1005 }] })),
    null
  )
  assert.equal(summarizeShowcase(definition, [1], engineResult({ assumptions: undefined })), null)
  assert.equal(summarizeShowcase(definition, [1], engineResult({ totalInvested: 0 })), null)
  assert.equal(summarizeShowcase(definition, [1], engineResult({ totalReturn: Number.NaN })), null)
})

test('rótulos: período, valores e composição', () => {
  const brl = (text: string) => text.replace(/R\$ /g, 'R$\u00a0') // Intl usa espaço não separável
  assert.equal(formatShowcasePeriod('2021-10', '2026-09'), 'out. 2021 a set. 2026')
  assert.equal(showcaseMoneyLabel({ initialCapital: 0, monthlyContribution: 1000 }), brl('R$ 1.000/mês, sem capital inicial'))
  assert.equal(showcaseMoneyLabel({ initialCapital: 10000, monthlyContribution: 0 }), brl('R$ 10.000 iniciais, sem aportes'))
  assert.equal(showcaseMoneyLabel({ initialCapital: 10000, monthlyContribution: 1000 }), brl('R$ 10.000 iniciais + R$ 1.000/mês'))
  assert.equal(showcaseCompositionLabel({ tickers: ['BOVA11'], allocations: [1] }), 'BOVA11, 100%')
  assert.equal(
    showcaseCompositionLabel({ tickers: ['PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'BBAS3'], allocations: [0.2, 0.2, 0.2, 0.2, 0.2] }),
    'PETR4, VALE3, ITUB4, WEGE3 e BBAS3, 20% cada'
  )
})
