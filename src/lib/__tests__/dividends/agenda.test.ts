import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAgendaEvents,
  buildIcsCalendar,
  dividendTypeLabel,
  filterAgendaEvents,
  foldIcsLine,
  icsSummary,
  isSameDividend,
  monthlyPortfolioIncome,
  netPerShare,
  nextPortfolioPayment,
  portfolioIncomeBetween,
  positionAtExDate,
  seasonalProjectionsFrom,
  type AgendaEvent,
  type PositionTrade,
} from '../../../app/agenda-proventos/agenda-model'
import { buildDividendProjections, isProjectionCacheStale } from '../../dividend-projections'
import type { DividendEvent } from '../../finance/dividends'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** Pagador trimestral (mar, jun, set, dez) de 2022 a set/2026: JCP em junho, dividendo nos demais. */
function quarterlyFixture(): DividendEvent[] {
  const events: DividendEvent[] = []
  for (let year = 2022; year <= 2026; year++) {
    for (const month of [3, 6, 9, 12]) {
      const exDate = new Date(Date.UTC(year, month - 1, 15))
      if (exDate.getTime() > d('2026-09-30').getTime()) continue
      events.push({
        exDate,
        paymentDate: new Date(exDate.getTime() + 20 * 86_400_000),
        amount: month === 6 ? 0.5 : 0.3 + (year - 2022) * 0.01,
        type: month === 6 ? 'JCP' : 'DIVIDENDO',
      })
    }
  }
  return events
}

// ─── Projeção determinística ────────────────────────────────────────────────

test('seasonalProjectionsFrom: mesmo histórico e mesmo dia, mesmo resultado (sem IA)', () => {
  const today = d('2026-10-05')
  const first = seasonalProjectionsFrom(quarterlyFixture(), today)
  const second = seasonalProjectionsFrom(quarterlyFixture(), today)
  assert.deepEqual(first, second)
  // Começa no mês corrente (out/2026) e cobre 12 meses: dez, mar, jun, set
  assert.deepEqual(
    first.map((p) => p.month),
    ['2026-12', '2027-03', '2027-06', '2027-09'],
  )
  const june = first.find((p) => p.month === '2027-06')
  assert.equal(june?.amount, 0.5)
  assert.equal(june?.type, 'JCP')
  assert.equal(june?.exDate.toISOString().slice(0, 10), '2027-06-15')
})

test('buildDividendProjections: formato do radar, método estatístico e confiança pela recorrência', () => {
  const projections = buildDividendProjections(quarterlyFixture(), d('2026-10-05'))
  assert.equal(projections.length, 4)
  for (const p of projections) {
    assert.equal(p.method, 'seasonal')
    assert.equal(p.confidence, 80)
    assert.match(p.projectedExDate, /^\d{4}-\d{2}-\d{2}$/)
  }
  assert.deepEqual(
    projections.map((p) => [p.year, p.month]),
    [[2026, 12], [2027, 3], [2027, 6], [2027, 9]],
  )
})

test('isProjectionCacheStale: recalcula cache feito por IA, de mês anterior ou com mês passado', () => {
  const today = d('2026-10-05')
  const fresh = [{ month: 12, year: 2026, projectedExDate: '2026-12-15', projectedAmount: 0.3, confidence: 80, method: 'seasonal' }]
  assert.equal(isProjectionCacheStale(fresh, new Date('2026-10-02T12:00:00Z'), today), false)
  assert.equal(isProjectionCacheStale([{ ...fresh[0], method: undefined }], new Date('2026-10-02T12:00:00Z'), today), true)
  assert.equal(isProjectionCacheStale(fresh, new Date('2026-09-28T12:00:00Z'), today), true)
  assert.equal(isProjectionCacheStale([{ ...fresh[0], projectedExDate: '2026-09-15' }], new Date('2026-10-02T12:00:00Z'), today), true)
})

// ─── Posição na data ex ─────────────────────────────────────────────────────

test('positionAtExDate: compras e vendas antes, na e depois da data ex', () => {
  const trades: PositionTrade[] = [
    { date: d('2026-01-10'), type: 'BUY', quantity: 100 },
    { date: d('2026-03-01'), type: 'SELL_WITHDRAWAL', quantity: 30 },
    { date: d('2026-03-14'), type: 'BUY_REBALANCE', quantity: 10 },
    // Na data ex: compra não tem direito; venda ainda recebe
    { date: d('2026-03-15'), type: 'BUY', quantity: 50 },
    { date: d('2026-03-15'), type: 'SELL_REBALANCE', quantity: 80 },
    { date: d('2026-04-01'), type: 'BUY', quantity: 1000 },
    // Tipos sem efeito na quantidade
    { date: d('2026-02-01'), type: 'DIVIDEND', quantity: 999 },
  ]
  assert.equal(positionAtExDate(trades, d('2026-03-15')), 80)
  assert.equal(positionAtExDate(trades, d('2026-01-10')), 0)
  assert.equal(positionAtExDate(trades, d('2026-01-11')), 100)
  assert.equal(positionAtExDate(trades, d('2026-03-16')), 50)
  assert.equal(positionAtExDate([{ date: d('2026-01-01'), type: 'SELL_WITHDRAWAL', quantity: 5 }], d('2026-02-01')), 0)
})

// ─── JCP líquido ────────────────────────────────────────────────────────────

test('JCP líquido: IRRF 17,5% desde 2026 e 15% antes; dividendos e rendimentos isentos', () => {
  assert.equal(dividendTypeLabel('JCP'), 'JCP')
  assert.equal(dividendTypeLabel('Juros sobre Capital Próprio'), 'JCP')
  assert.equal(dividendTypeLabel('RENDIMENTO'), 'Rendimento')
  assert.equal(dividendTypeLabel(null), 'Dividendo')
  assert.equal(netPerShare(1, 'JCP', d('2026-03-10')), 0.825)
  assert.equal(netPerShare(1, 'JCP', d('2025-12-31')), 0.85)
  assert.equal(netPerShare(1, 'Dividendo', d('2026-03-10')), 1)
  assert.equal(netPerShare(0.1, 'Rendimento', d('2026-03-10')), 0.1)
})

test('isSameDividend: deduplica lançamentos automáticos (bruto ou líquido) e manuais no mesmo mês', () => {
  const candidate = { ticker: 'ITUB4', date: d('2026-07-05'), quantity: 100, grossPerShare: 0.5, netPerShare: 0.4125, total: 41.25 }
  assert.equal(isSameDividend({ ticker: 'ITUB4', date: d('2026-07-20'), amount: 41.25, perShare: 0.4125 }, candidate), true)
  // Lançamento automático antigo, gravado com o JCP bruto
  assert.equal(isSameDividend({ ticker: 'ITUB4', date: d('2026-07-20'), amount: 50, perShare: 0.5 }, candidate), true)
  // Manual sem valor por ação
  assert.equal(isSameDividend({ ticker: 'ITUB4', date: d('2026-07-01'), amount: 41.3, perShare: null }, candidate), true)
  assert.equal(isSameDividend({ ticker: 'ITUB4', date: d('2026-08-01'), amount: 41.25, perShare: 0.4125 }, candidate), false)
  assert.equal(isSameDividend({ ticker: 'PETR4', date: d('2026-07-20'), amount: 41.25, perShare: 0.4125 }, candidate), false)
  assert.equal(isSameDividend({ ticker: 'ITUB4', date: d('2026-07-20'), amount: 10, perShare: null }, candidate), false)
})

// ─── Eventos e renda mensal ─────────────────────────────────────────────────

function agendaFixture() {
  const today = d('2026-10-05')
  const history = [
    ...quarterlyFixture(),
    // Anunciado: data ex já passou, pagamento futuro
    { exDate: d('2026-10-01'), paymentDate: d('2026-10-20'), amount: 0.2, type: 'JCP' },
  ]
  const events = buildAgendaEvents({
    companies: [
      { ticker: 'ABCD3', name: 'ABCD', dividends: history },
      { ticker: 'RADR3', name: 'Radar', dividends: quarterlyFixture() },
      { ticker: 'NONE3', name: 'Fora', dividends: quarterlyFixture() },
    ],
    portfolioTickers: ['ABCD3'],
    radarTickers: ['RADR3', 'ABCD3'],
    tradesByTicker: new Map([['ABCD3', [{ date: d('2026-01-02'), type: 'BUY', quantity: 100 }]]]),
    today,
  })
  return { today, events }
}

test('buildAgendaEvents: carteira com quantidade na data ex, radar sem posição, estimativas fora dos meses anunciados', () => {
  const { events } = agendaFixture()
  assert.ok(events.every((e) => e.ticker !== 'NONE3'))

  const announced = events.find((e) => e.ticker === 'ABCD3' && e.exDate === '2026-10-01')
  assert.ok(announced)
  assert.equal(announced.kind, 'confirmed')
  assert.equal(announced.type, 'JCP')
  assert.equal(announced.netAmount, 0.165)
  assert.equal(announced.quantity, 100)
  assert.equal(announced.positionGross, 20)
  assert.equal(announced.positionNet, 16.5)
  assert.deepEqual(announced.sources, ['portfolio', 'radar'])

  const projected = events.filter((e) => e.ticker === 'ABCD3' && e.kind === 'projected')
  assert.deepEqual(projected.map((e) => e.exDate), ['2026-12-15', '2027-03-15', '2027-06-15', '2027-09-15'])
  // Pagamento estimado pelo intervalo mediano do histórico (20 dias)
  assert.equal(projected[0].paymentDate, '2027-01-04')
  assert.equal(projected[0].paymentDateEstimated, true)

  const radarOnly = events.find((e) => e.ticker === 'RADR3' && e.kind === 'projected')
  assert.equal(radarOnly?.quantity, null)
  assert.equal(radarOnly?.positionNet, null)

  // Ids estáveis e únicos
  assert.equal(new Set(events.map((e) => e.id)).size, events.length)
  assert.deepEqual(agendaFixture().events.map((e) => e.id), events.map((e) => e.id))
})

test('filterAgendaEvents: escopo e período usam data ex ou pagamento', () => {
  const { events } = agendaFixture()
  const next30 = filterAgendaEvents(events, 'carteira', 'proximos-30', '2026-10-05')
  assert.deepEqual(next30.map((e) => e.exDate), ['2026-09-15', '2026-10-01'])
  const radar90 = filterAgendaEvents(events, 'radar', 'proximos-90', '2026-10-05')
  assert.ok(radar90.every((e) => e.sources.includes('radar')))
  assert.ok(radar90.some((e) => e.ticker === 'RADR3' && e.exDate === '2026-12-15'))
  const past = filterAgendaEvents(events, 'todos', 'ultimos-90', '2026-10-05')
  // Mais recente primeiro
  assert.equal(past[0].exDate, '2026-10-01')
  assert.ok(past.some((e) => e.exDate === '2026-09-15'))
})

function agendaEvent(overrides: Partial<AgendaEvent> & Pick<AgendaEvent, 'ticker' | 'exDate'>): AgendaEvent {
  return {
    id: `${overrides.ticker}-${overrides.exDate}`,
    companyName: null,
    kind: 'confirmed',
    type: 'Dividendo',
    paymentDate: null,
    paymentDateEstimated: false,
    amount: 1,
    netAmount: 1,
    sources: ['portfolio'],
    quantity: 100,
    positionGross: 100,
    positionNet: 100,
    ...overrides,
  }
}

test('nextPortfolioPayment: menor data de pagamento futura, não a primeira data ex', () => {
  const events = [
    agendaEvent({ ticker: 'TAEE11', exDate: '2026-10-13', paymentDate: '2026-12-01', kind: 'projected', paymentDateEstimated: true }),
    agendaEvent({ ticker: 'EGIE3', exDate: '2026-10-14', paymentDate: '2026-11-21' }),
    // Já pago, só radar ou sem posição: ignorados
    agendaEvent({ ticker: 'PAGO3', exDate: '2026-09-01', paymentDate: '2026-10-01' }),
    agendaEvent({ ticker: 'RADR3', exDate: '2026-10-06', paymentDate: '2026-10-10', sources: ['radar'], positionNet: null }),
    agendaEvent({ ticker: 'ZERO3', exDate: '2026-10-06', paymentDate: '2026-10-11', positionNet: 0 }),
    agendaEvent({ ticker: 'SEMD3', exDate: '2026-10-07', paymentDate: null }),
  ]
  assert.equal(nextPortfolioPayment(events, '2026-10-05')?.ticker, 'EGIE3')
  // Pagamento hoje conta
  assert.equal(nextPortfolioPayment(events, '2026-10-01')?.ticker, 'PAGO3')
  assert.equal(nextPortfolioPayment(events, '2026-12-02'), null)
})

test('filterAgendaEvents: ordem segue a data ex visível', () => {
  const events = [
    agendaEvent({ ticker: 'BBBB3', exDate: '2026-10-14', paymentDate: '2026-11-21' }),
    agendaEvent({ ticker: 'AAAA3', exDate: '2026-09-17', paymentDate: '2026-10-20' }),
    agendaEvent({ ticker: 'CCCC3', exDate: '2026-10-01', paymentDate: '2026-10-31' }),
    agendaEvent({ ticker: 'DDDD3', exDate: '2026-10-13', paymentDate: '2026-12-01' }),
  ]
  const upcoming = filterAgendaEvents(events, 'todos', 'proximos-90', '2026-10-05')
  assert.deepEqual(upcoming.map((e) => e.exDate), ['2026-09-17', '2026-10-01', '2026-10-13', '2026-10-14'])
  const past = filterAgendaEvents(events, 'todos', 'ultimos-90', '2026-10-05')
  assert.deepEqual(past.map((e) => e.exDate), ['2026-10-01', '2026-09-17'])
})

test('monthlyPortfolioIncome: 12 meses a partir do corrente, anunciado separado da estimativa', () => {
  const { events, today } = agendaFixture()
  const months = monthlyPortfolioIncome(events, today)
  assert.equal(months.length, 12)
  assert.equal(months[0].month, '2026-10')
  assert.equal(months[11].month, '2027-09')
  // Out/26: JCP anunciado (100 × 0,165) + dividendo de set/26 pago em 05/out (100 × 0,34)
  assert.equal(months[0].confirmed, 50.5)
  assert.equal(months[0].projected, 0)
  // Jan/27: estimativa de dez/26 paga 20 dias depois
  const jan = months.find((m) => m.month === '2027-01')
  assert.ok(jan && jan.projected > 0 && jan.confirmed === 0)
  assert.equal(portfolioIncomeBetween(events, '2026-10-05', '2026-11-04'), 50.5)
})

// ─── ICS ────────────────────────────────────────────────────────────────────

function sampleEvent(overrides: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: 'ITUB4-JCP-2026-10-01-0.450000',
    ticker: 'ITUB4',
    companyName: 'Itaú Unibanco',
    kind: 'confirmed',
    type: 'JCP',
    exDate: '2026-10-01',
    paymentDate: '2026-10-20',
    paymentDateEstimated: false,
    amount: 0.45,
    netAmount: 0.37125,
    sources: ['portfolio'],
    quantity: 100,
    positionGross: 45,
    positionNet: 37.13,
    ...overrides,
  }
}

/** Parser mínimo de iCalendar: desdobra linhas e devolve os VEVENTs como mapas de propriedades. */
function parseIcs(text: string): { calendar: string[]; events: Array<Map<string, string>> } {
  const unfolded = text.replace(/\r\n[ \t]/g, '')
  const lines = unfolded.split('\r\n')
  assert.equal(lines.pop(), '', 'termina com CRLF')
  const events: Array<Map<string, string>> = []
  let current: Map<string, string> | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = new Map()
    else if (line === 'END:VEVENT') {
      assert.ok(current)
      events.push(current)
      current = null
    } else if (current) {
      const idx = line.indexOf(':')
      assert.ok(idx > 0, `linha válida: ${line}`)
      current.set(line.slice(0, idx), line.slice(idx + 1))
    }
  }
  return { calendar: lines, events }
}

test('buildIcsCalendar: RFC 5545 com CRLF, campos obrigatórios e UID estável', () => {
  const now = new Date('2026-10-05T12:00:00Z')
  const ics = buildIcsCalendar([sampleEvent(), sampleEvent({ id: 'X-estimativa', kind: 'projected', paymentDate: null, type: 'Dividendo', amount: 1.5, netAmount: 1.5 })], now)
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.ok(!/[^\r]\n/.test(ics), 'toda quebra de linha é CRLF')
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `linha até 75 octetos: ${line}`)

  const { calendar, events } = parseIcs(ics)
  assert.ok(calendar.includes('PRODID:-//Preço Justo AI//Agenda de proventos//PT-BR'))
  assert.equal(events.length, 2)
  const [paid, projected] = events
  for (const ev of events) {
    for (const key of ['UID', 'DTSTAMP', 'DTSTART;VALUE=DATE', 'DTEND;VALUE=DATE', 'SUMMARY']) assert.ok(ev.has(key), key)
  }
  assert.equal(paid.get('UID'), 'ITUB4-JCP-2026-10-01-0.450000@precojusto.ai')
  assert.equal(paid.get('DTSTAMP'), '20261005T120000Z')
  assert.equal(paid.get('DTSTART;VALUE=DATE'), '20261020')
  assert.equal(paid.get('DTEND;VALUE=DATE'), '20261021')
  assert.equal(paid.get('SUMMARY'), 'ITUB4 JCP R$ 0\\,4500/ação')
  assert.match(paid.get('DESCRIPTION') ?? '', /IRRF 17\\,5%/)
  // Sem pagamento: data ex, rotulada e marcada como estimativa
  assert.equal(projected.get('DTSTART;VALUE=DATE'), '20261001')
  assert.equal(projected.get('SUMMARY'), 'Data ex · ITUB4 Dividendo R$ 1\\,50/ação (estimativa)')
})

test('icsSummary e foldIcsLine', () => {
  assert.equal(icsSummary(sampleEvent({ paymentDateEstimated: true })), 'Pagamento estimado · ITUB4 JCP R$ 0,4500/ação')
  const long = 'DESCRIPTION:' + 'ação '.repeat(30)
  const folded = foldIcsLine(long)
  assert.equal(folded.replace(/\r\n /g, ''), long)
  for (const part of folded.split('\r\n')) assert.ok(new TextEncoder().encode(part).length <= 75)
})
