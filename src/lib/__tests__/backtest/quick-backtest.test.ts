import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  QUICK_DEFAULTS,
  backLabel,
  busyLabel,
  currentMonthInSaoPaulo,
  droppedAssetsNote,
  fiiRejectionMessage,
  hasCustomSettings,
  isQuickSource,
  normalizeTickers,
  normalizeWeights,
  periodAdjustments,
  quickConfigName,
  quickLandingUrl,
  quickPeriod,
  quickSourceLabel,
  resolveQuickSettings,
  safeReturnPath,
} from '@/lib/backtest/quick-backtest'

const iso = (date: Date) => date.toISOString().slice(0, 10)
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

test('período padrão: 5 anos completos até o 1º dia do mês corrente, em UTC', () => {
  const { startDate, endDate } = quickPeriod(new Date('2026-10-09T15:00:00Z'))
  assert.equal(iso(startDate), '2021-10-01')
  assert.equal(iso(endDate), '2026-10-01')
  assert.equal(startDate.getUTCHours(), 0)
})

test('período padrão usa o fuso de Brasília na virada do mês', () => {
  // 01/11 às 01h UTC ainda é 31/10 às 22h em Brasília
  const { endDate } = quickPeriod(new Date('2026-11-01T01:00:00Z'))
  assert.equal(iso(endDate), '2026-10-01')
  assert.deepEqual(currentMonthInSaoPaulo(new Date('2026-11-01T01:00:00Z')), { year: 2026, month: 9 })
  // 01/11 às 04h UTC já é 01/11 em Brasília
  assert.equal(iso(quickPeriod(new Date('2026-11-01T04:00:00Z')).endDate), '2026-11-01')
  // Virada do ano
  assert.equal(iso(quickPeriod(new Date('2027-01-01T02:00:00Z')).endDate), '2026-12-01')
})

test('período com 3 e 10 anos', () => {
  const now = new Date('2026-10-09T12:00:00Z')
  assert.equal(iso(quickPeriod(now, 3).startDate), '2023-10-01')
  assert.equal(iso(quickPeriod(now, 10).startDate), '2016-10-01')
})

test('ajustes: anos só 3/5/10, valores inválidos voltam ao padrão', () => {
  assert.deepEqual(resolveQuickSettings(undefined), QUICK_DEFAULTS)
  assert.equal(resolveQuickSettings({ years: 10 }).years, 10)
  assert.equal(resolveQuickSettings({ years: 3 }).years, 3)
  assert.equal(resolveQuickSettings({ years: 7 }).years, 5)
  assert.equal(resolveQuickSettings({ years: '10' }).years, 5)
  assert.equal(resolveQuickSettings({ years: 0 }).years, 5)
  assert.equal(resolveQuickSettings({ initialCapital: -10 }).initialCapital, 10_000)
  assert.equal(resolveQuickSettings({ initialCapital: Number.NaN }).initialCapital, 10_000)
  assert.equal(resolveQuickSettings({ initialCapital: 0 }).initialCapital, 0)
  assert.equal(resolveQuickSettings({ monthlyContribution: 1500.555 }).monthlyContribution, 1500.56)
  assert.equal(resolveQuickSettings({ initialCapital: 1e12 }).initialCapital, 999_999_999)
  assert.equal(resolveQuickSettings({ rebalanceFrequency: 'weekly' }).rebalanceFrequency, 'monthly')
  assert.equal(resolveQuickSettings({ rebalanceFrequency: 'yearly' }).rebalanceFrequency, 'yearly')
})

test('hasCustomSettings: só quando algo difere dos padrões', () => {
  assert.equal(hasCustomSettings(undefined), false)
  assert.equal(hasCustomSettings({ years: 5, initialCapital: 10_000 }), false)
  assert.equal(hasCustomSettings({ years: 7 }), false)
  assert.equal(hasCustomSettings({ years: 10 }), true)
  assert.equal(hasCustomSettings({ monthlyContribution: 0 }), true)
})

test('tickers: maiúsculas, sem espaços e sem repetição', () => {
  assert.deepEqual(normalizeTickers([' petr4', 'PETR4', 'vale3 ', '', 42]), { ok: true, tickers: ['PETR4', 'VALE3'] })
})

test('tickers: vazio, inválido e acima de 20', () => {
  assert.equal(normalizeTickers([]).ok, false)
  assert.equal(normalizeTickers('PETR4').ok, false)
  const invalid = normalizeTickers(['PETR4', 'DROP TABLE'])
  assert.equal(invalid.ok, false)
  if (!invalid.ok) assert.match(invalid.error, /Ticker inválido/)
  const many = normalizeTickers(Array.from({ length: 21 }, (_, i) => `ABCD${i + 10}`))
  assert.equal(many.ok, false)
  if (!many.ok) assert.match(many.error, /até 20 ativos/)
  assert.equal(normalizeTickers(Array.from({ length: 20 }, (_, i) => `ABCD${i + 10}`)).ok, true)
})

test('pesos iguais somam 1 com 4 casas', () => {
  const assets = normalizeWeights(['A1B1', 'B2C2', 'C3D3'])
  assert.deepEqual(assets.map((a) => a.allocation), [0.3334, 0.3333, 0.3333])
  assert.equal(Math.round(sum(assets.map((a) => a.allocation)) * 10_000), 10_000)
  const seven = normalizeWeights(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => `${l}XX3`))
  assert.equal(Math.round(sum(seven.map((a) => a.allocation)) * 10_000), 10_000)
  assert.ok(seven.every((a) => a.allocation > 0))
})

test('pesos da carteira são normalizados e o peso zero sai da simulação', () => {
  const assets = normalizeWeights(['PETR4', 'VALE3', 'ITUB4'], [50, 30, 0])
  assert.deepEqual(assets, [
    { ticker: 'PETR4', allocation: 0.625 },
    { ticker: 'VALE3', allocation: 0.375 },
  ])
  const fractions = normalizeWeights(['PETR4', 'VALE3'], [0.6, 0.4])
  assert.deepEqual(fractions.map((a) => a.allocation), [0.6, 0.4])
})

test('pesos inválidos ou incompletos viram pesos iguais', () => {
  assert.deepEqual(normalizeWeights(['PETR4', 'VALE3'], [1]).map((a) => a.allocation), [0.5, 0.5])
  assert.deepEqual(normalizeWeights(['PETR4', 'VALE3'], [0, 0]).map((a) => a.allocation), [0.5, 0.5])
  assert.deepEqual(normalizeWeights(['PETR4', 'VALE3'], [Number.NaN, 1]).map((a) => a.allocation), [0.5, 0.5])
  assert.deepEqual(normalizeWeights([], [1]), [])
})

test('mensagem de FII legível, no singular e no plural', () => {
  assert.equal(fiiRejectionMessage(['HGLG11']), 'O backtest ainda não simula FIIs (HGLG11). Remova esse ativo e tente de novo.')
  assert.equal(
    fiiRejectionMessage(['HGLG11', 'KNRI11', 'MXRF11']),
    'O backtest ainda não simula FIIs (HGLG11, KNRI11 e MXRF11). Remova esses ativos e tente de novo.'
  )
  assert.equal(droppedAssetsNote(['HGLG11'], 'fii'), 'HGLG11 ficou de fora: o backtest ainda não simula FIIs')
  assert.equal(droppedAssetsNote(['ABCD3', 'EFGH3'], 'no-data'), 'ABCD3 e EFGH3 ficaram de fora: sem cotações no período')
})

test('nome automático estável por origem', () => {
  const now = new Date('2026-10-09T15:00:00Z')
  assert.equal(quickConfigName({ source: 'asset', tickers: ['PETR4'], years: 5, sourceLabel: 'PETR4' }), 'PETR4 · 5 anos')
  assert.equal(quickConfigName({ source: 'comparador', tickers: ['PETR4'], years: 3 }), 'PETR4 · 3 anos')
  assert.equal(
    quickConfigName({ source: 'ranking', tickers: ['A', 'B', 'C', 'D', 'E'], years: 5, sourceLabel: 'Fórmula de Graham', now }),
    'Top 5 · Fórmula de Graham · 09/10/2026'
  )
  // 23h em Brasília ainda é o mesmo dia
  assert.equal(
    quickConfigName({ source: 'ranking', tickers: ['A', 'B', 'C'], years: 5, sourceLabel: 'Graham', now: new Date('2026-10-10T02:00:00Z') }),
    'Top 3 · Graham · 09/10/2026'
  )
  assert.equal(quickConfigName({ source: 'ranking', tickers: ['PETR4'], years: 5, sourceLabel: 'PETR4' }), 'PETR4 · 5 anos')
  assert.equal(quickConfigName({ source: 'carteira', tickers: ['PETR4'], years: 5, sourceLabel: 'Dividendos' }), 'Carteira Dividendos · 5 anos')
  assert.equal(quickConfigName({ source: 'carteira', tickers: ['PETR4'], years: 5, sourceLabel: 'Carteira longo prazo' }), 'Carteira longo prazo · 5 anos')
  assert.equal(
    quickConfigName({ source: 'asset', tickers: ['AAAA3', 'BBBB3', 'CCCC3', 'DDDD3', 'EEEE3'], years: 5 }),
    'AAAA3, BBBB3, CCCC3 e mais 2 · 5 anos'
  )
})

test('rótulo da origem e do botão voltar', () => {
  assert.equal(quickSourceLabel('asset', ['PETR4'], 'PETR4'), 'PETR4')
  assert.equal(quickSourceLabel('comparador', ['PETR4', 'VALE3']), 'PETR4 e VALE3')
  assert.equal(quickSourceLabel('ranking', ['A', 'B', 'C'], 'Graham'), 'Top 3 · Graham')
  assert.equal(quickSourceLabel('ranking', ['PETR4'], 'PETR4'), 'PETR4')
  assert.equal(quickSourceLabel('carteira', ['PETR4'], 'Dividendos'), 'Carteira Dividendos')
  assert.equal(backLabel('asset', 'PETR4'), 'Voltar para PETR4')
  assert.equal(backLabel('ranking'), 'Voltar para o ranking')
  assert.equal(backLabel('carteira'), 'Voltar para a carteira')
  assert.equal(busyLabel(), 'Simulando 5 anos…')
  assert.equal(isQuickSource('ranking'), true)
  assert.equal(isQuickSource('home'), false)
})

test('avisos de período ajustado', () => {
  const requestedStart = new Date(Date.UTC(2021, 9, 1))
  const requestedEnd = new Date(Date.UTC(2026, 9, 1))
  const notes = periodAdjustments({
    requestedStart,
    requestedEnd,
    adjustedStart: new Date(Date.UTC(2022, 2, 1)),
    adjustedEnd: new Date(Date.UTC(2026, 8, 1)),
    availability: [
      { ticker: 'PETR4', availableFrom: requestedStart, availableTo: new Date(Date.UTC(2026, 8, 1)), totalMonths: 60 },
      { ticker: 'VALE3', availableFrom: new Date(Date.UTC(2022, 2, 1)), availableTo: new Date(Date.UTC(2026, 8, 1)), totalMonths: 54 },
    ],
  })
  // Última barra no mês anterior ao fim pedido é o normal: só o início foi ajustado
  assert.deepEqual(notes, ['Período começou em mar. 2022: VALE3 não tem cotações antes disso'])

  const none = periodAdjustments({
    requestedStart,
    requestedEnd,
    adjustedStart: requestedStart,
    adjustedEnd: requestedEnd,
    availability: [],
  })
  assert.deepEqual(none, [])

  const both = periodAdjustments({
    requestedStart,
    requestedEnd,
    adjustedStart: new Date(Date.UTC(2023, 0, 1)),
    adjustedEnd: new Date(Date.UTC(2025, 5, 1)),
    availability: [
      { ticker: 'AAAA3', availableFrom: new Date(Date.UTC(2023, 0, 1)), availableTo: new Date(Date.UTC(2025, 5, 1)), totalMonths: 30 },
      { ticker: 'BBBB3', availableFrom: new Date(Date.UTC(2023, 0, 1)), availableTo: requestedEnd, totalMonths: 40 },
    ],
  })
  assert.deepEqual(both, [
    'Período começou em jan. 2023: AAAA3 e BBBB3 não têm cotações antes disso',
    'Período terminou em jun. 2025: AAAA3 não tem cotações depois disso',
  ])
})

test('caminho de volta só interno', () => {
  assert.equal(safeReturnPath('/acao/petr4'), '/acao/petr4')
  assert.equal(safeReturnPath('//evil.com'), undefined)
  assert.equal(safeReturnPath('https://evil.com'), undefined)
  assert.equal(safeReturnPath('/\\evil.com'), undefined)
  assert.equal(safeReturnPath(undefined), undefined)
})

test('URL de pouso no resultado e na configuração', () => {
  const results = quickLandingUrl({
    configId: 'cfg1',
    view: 'results',
    source: 'asset',
    sourceLabel: 'PETR4',
    returnTo: '/acao/petr4',
    adjustments: ['Período começou em mar. 2022: VALE3 não tem cotações antes disso'],
  })
  const params = new URL(results, 'http://x').searchParams
  assert.equal(params.get('view'), 'results')
  assert.equal(params.get('configId'), 'cfg1')
  assert.equal(params.get('from'), 'asset')
  assert.equal(params.get('label'), 'PETR4')
  assert.equal(params.get('back'), '/acao/petr4')
  assert.deepEqual(params.getAll('ajuste'), ['Período começou em mar. 2022: VALE3 não tem cotações antes disso'])

  assert.equal(quickLandingUrl({ configId: 'cfg1', view: 'configure', source: 'ranking' }), '/backtest?view=configure&configId=cfg1')
  const unsafe = new URL(quickLandingUrl({ configId: 'c', view: 'results', source: 'asset', returnTo: '//evil.com' }), 'http://x')
  assert.equal(unsafe.searchParams.get('back'), null)
})
