import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  annualizeFromLast12,
  averageFullYears,
  dividendYieldTTM,
  fullYearTotals,
  isJcp,
  jcpNet,
  netAmount,
  projectSeasonal,
  removeExtraordinary,
  sumTTM,
  toDividendEvents,
  type DividendEvent,
} from '../../finance/dividends'
import { ceilingPrice } from '../../finance/valuation'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const ev = (iso: string, amount: number, type: string | null = null): DividendEvent => ({ exDate: d(iso), amount, type })

function monthly(fromYear: number, fromMonth: number, count: number, amount: number): DividendEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(fromYear, fromMonth - 1 + i, 15))
    return { exDate: date, amount, type: 'RENDIMENTO' }
  })
}

test('sumTTM: 12 pagamentos de R$ 0,10 → R$ 1,20 (e ignora o que saiu da janela)', () => {
  const events = [...monthly(2025, 10, 12, 0.1), ev('2025-09-10', 5)]
  assert.equal(sumTTM(events, d('2026-09-29')), 1.2)
})

test('sumTTM inclui a data-com exatamente no asOf e exclui o futuro', () => {
  const events = [ev('2026-09-29', 1), ev('2026-10-01', 1)]
  assert.equal(sumTTM(events, d('2026-09-29')), 1)
})

test('dividendYieldTTM: R$ 1,20 sobre preço 20 → 6%', () => {
  const value = dividendYieldTTM(monthly(2025, 10, 12, 0.1), 20, d('2026-09-29'))
  assert.equal(Number(value?.toFixed(6)), 0.06)
  assert.equal(dividendYieldTTM([], 20, d('2026-09-29')), null)
  assert.equal(dividendYieldTTM(monthly(2025, 10, 12, 0.1), 0, d('2026-09-29')), null)
})

test('toDividendEvents converte Decimal/string e descarta inválidos', () => {
  const decimalLike = { valueOf: () => '0.5', toString: () => '0.5' }
  const events = toDividendEvents([
    { exDate: d('2026-01-10'), amount: decimalLike, type: 'JCP', paymentDate: d('2026-02-10') },
    { exDate: d('2026-02-10'), amount: '0.25' },
    { exDate: d('2026-03-10'), amount: null },
    { exDate: d('2026-04-10'), amount: 0 },
    { exDate: new Date('invalid'), amount: 1 },
  ])
  assert.equal(events.length, 2)
  assert.equal(events[0].amount, 0.5)
  assert.equal(events[0].type, 'JCP')
  assert.equal(events[1].amount, 0.25)
  assert.equal(events[1].paymentDate, null)
})

test('removeExtraordinary descarta pagamentos acima de 2× a mediana', () => {
  const events = [ev('2025-01-10', 1), ev('2025-04-10', 1), ev('2025-07-10', 1.1), ev('2025-10-10', 5)]
  const kept = removeExtraordinary(events)
  assert.deepEqual(kept.map((e) => e.amount), [1, 1, 1.1])
  assert.deepEqual(removeExtraordinary([]), [])
})

test('averageFullYears: 6 anos de histórico + ano corrente parcial usa exatamente os 5 anos completos', () => {
  const events: DividendEvent[] = []
  for (let year = 2020; year <= 2025; year++) {
    const perPayment = (year - 2019) / 4 // total anual: 2020 → 1, …, 2025 → 6
    for (const month of [3, 6, 9, 12]) events.push({ exDate: new Date(Date.UTC(year, month - 1, 10)), amount: perPayment })
  }
  events.push(ev('2026-03-10', 10), ev('2026-06-10', 10)) // ano corrente parcial, não entra
  const asOf = d('2026-09-29')
  const totals = fullYearTotals(events, { asOf })
  assert.deepEqual(totals.map((t) => t.year), [2021, 2022, 2023, 2024, 2025])
  assert.equal(averageFullYears(events, { asOf }), 4) // (2 + 3 + 4 + 5 + 6) / 5
})

test('averageFullYears exclui o primeiro ano de cobertura quando parcial', () => {
  const events: DividendEvent[] = [ev('2022-09-10', 1), ev('2022-12-10', 1)] // cobertura começa no meio de 2022
  for (let year = 2023; year <= 2025; year++) {
    for (const month of [3, 6, 9, 12]) events.push({ exDate: new Date(Date.UTC(year, month - 1, 10)), amount: 1 })
  }
  const asOf = d('2026-09-29')
  assert.deepEqual(fullYearTotals(events, { asOf }).map((t) => t.year), [2023, 2024, 2025])
  assert.equal(averageFullYears(events, { asOf }), 4)

  // Com início de cobertura explícito em 1º de janeiro, 2022 conta (com o que foi pago).
  const explicit = fullYearTotals(events, { asOf, coverageStart: d('2022-01-01') })
  assert.deepEqual(explicit.map((t) => t.year), [2022, 2023, 2024, 2025])
})

test('averageFullYears conta com zero um ano coberto sem pagamento', () => {
  const events = [ev('2021-06-10', 2), ev('2022-06-10', 2), ev('2024-06-10', 2), ev('2025-06-10', 2)]
  const totals = fullYearTotals(events, { asOf: d('2026-09-29') })
  assert.deepEqual(totals.map((t) => [t.year, t.total]), [[2021, 2], [2022, 2], [2023, 0], [2024, 2], [2025, 2]])
  assert.equal(averageFullYears(events, { asOf: d('2026-09-29') }), 1.6)
})

test('averageFullYears sem anos completos → null', () => {
  assert.equal(averageFullYears([ev('2026-03-10', 1)], { asOf: d('2026-09-29') }), null)
  assert.equal(averageFullYears([], { asOf: d('2026-09-29') }), null)
})

test('FII: 12 rendimentos mensais de R$ 0,10 com DY alvo de 10% → preço-teto R$ 12,00', () => {
  const annual = annualizeFromLast12(monthly(2025, 10, 12, 0.1))
  assert.equal(annual, 1.2)
  assert.equal(ceilingPrice(annual, 0.1), 12)
})

test('annualizeFromLast12 infere a frequência (trimestral → 4) e exige 2 pagamentos', () => {
  const quarterly = [ev('2025-03-10', 0.5), ev('2025-06-10', 0.5), ev('2025-09-10', 0.5)]
  assert.equal(annualizeFromLast12(quarterly), 2)
  assert.equal(annualizeFromLast12([ev('2025-03-10', 0.5)]), null)
})

test('jcpNet: 15% de IRRF até 2025 e 17,5% a partir de 2026', () => {
  assert.equal(jcpNet(1, d('2025-12-31')), 0.85)
  assert.equal(jcpNet(1, d('2026-01-01')), 0.825)
})

test('isJcp reconhece as grafias comuns', () => {
  assert.equal(isJcp('JCP'), true)
  assert.equal(isJcp('jscp'), true)
  assert.equal(isJcp('Juros sobre Capital Próprio'), true)
  assert.equal(isJcp('DIVIDENDO'), false)
  assert.equal(isJcp('RENDIMENTO'), false)
  assert.equal(isJcp(null), false)
})

test('netAmount desconta IRRF só do JCP', () => {
  assert.equal(netAmount(ev('2026-03-10', 1, 'JCP')), 0.825)
  assert.equal(netAmount(ev('2026-03-10', 1, 'DIVIDENDO')), 1)
})

test('projectSeasonal é determinística e só projeta meses presentes em 2 dos últimos 3 anos', () => {
  const events = [
    ev('2023-03-10', 0.5), ev('2024-03-12', 0.6), ev('2025-03-08', 0.7), // março nos 3 anos
    ev('2023-08-20', 0.3), ev('2024-08-20', 0.3), ev('2025-08-20', 0.4), // agosto nos 3 anos
    ev('2024-06-05', 0.2, 'JCP'), ev('2025-06-05', 0.4, 'JCP'), // junho em 2 anos
    ev('2024-11-15', 0.2), // novembro em 1 ano: não projeta
  ]
  const asOf = d('2026-01-15')
  const first = projectSeasonal(events, asOf)
  const second = projectSeasonal(events, asOf)
  assert.deepEqual(first, second)

  assert.deepEqual(
    first.map((p) => [p.month, p.amount, p.occurrences, p.exDate.toISOString().slice(0, 10), p.type]),
    [
      ['2026-03', 0.6, 3, '2026-03-10', null],
      ['2026-06', 0.3, 2, '2026-06-05', 'JCP'],
      ['2026-08', 0.3, 3, '2026-08-20', null],
    ]
  )
})

test('projectSeasonal respeita monthsAhead e não projeta o mês corrente', () => {
  const events = [ev('2023-01-10', 1), ev('2024-01-10', 1), ev('2025-01-10', 1), ev('2023-02-10', 1), ev('2024-02-10', 1), ev('2025-02-10', 1)]
  const asOf = d('2025-12-20')
  assert.deepEqual(projectSeasonal(events, asOf, 1).map((p) => p.month), ['2026-01'])
  assert.deepEqual(projectSeasonal(events, d('2026-01-05'), 12).map((p) => p.month), ['2026-02', '2027-01'])
})
