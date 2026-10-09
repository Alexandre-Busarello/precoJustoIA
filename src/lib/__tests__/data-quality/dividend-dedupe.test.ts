import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeDividends,
  isNearDuplicateDividend,
  sumTTM,
  toDividendEvents,
  type DividendHistoryRow,
} from '../../finance/dividends'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** Linha "crua" do Yahoo: só data-com e valor. */
const yahoo = (exDate: string, amount: number): DividendHistoryRow & { source: string } => ({
  exDate: d(exDate),
  paymentDate: null,
  amount,
  type: null,
  source: 'yahoo',
})

const rendimento = (exDate: string, paymentDate: string, amount: number): DividendHistoryRow & { source: string } => ({
  exDate: d(exDate),
  paymentDate: d(paymentDate),
  amount,
  type: 'RENDIMENTO',
  source: 'b3',
})

test('HGLG11: rendimento da B3 e cópia do Yahoo a 2 dias contam uma vez só (DY TTM sem dupla contagem)', () => {
  // Mesmo formato do banco local: Yahoo no dia 1 (R$ 1,17, sem tipo nem pagamento), B3 no dia 3 (RENDIMENTO).
  const rows = [
    rendimento('2026-10-03', '2026-11-02', 1.047948),
    yahoo('2026-10-01', 1.17),
    rendimento('2026-09-03', '2026-10-03', 0.918347),
    yahoo('2026-09-01', 1.17),
    yahoo('2026-08-03', 1.17),
    rendimento('2026-08-03', '2026-09-02', 0.85748),
    yahoo('2026-05-04', 1.1),
    rendimento('2026-05-03', '2026-06-02', 0.903292),
  ]
  const kept = dedupeDividends(rows)
  assert.equal(kept.length, 4)
  assert.ok(kept.every((row) => row.type === 'RENDIMENTO'))
  // Ordem original preservada.
  assert.deepEqual(
    kept.map((row) => row.exDate.toISOString().slice(0, 10)),
    ['2026-10-03', '2026-09-03', '2026-08-03', '2026-05-03'],
  )
  const asOf = d('2026-10-09')
  const ttm = sumTTM(toDividendEvents(kept), asOf)
  assert.ok(Math.abs(ttm - (1.047948 + 0.918347 + 0.85748 + 0.903292)) < 1e-6)
  assert.ok(sumTTM(toDividendEvents(rows), asOf) > ttm + 4)
})

test('mesmo provento em duas fontes com valores a até 2%: fica a linha com tipo e data de pagamento', () => {
  const rows = [
    yahoo('2026-06-02', 0.5),
    { exDate: d('2026-06-05'), paymentDate: d('2026-06-20'), amount: 0.505, type: 'DIVIDENDO' },
  ]
  const kept = dedupeDividends(rows)
  assert.equal(kept.length, 1)
  assert.equal(kept[0].type, 'DIVIDENDO')
})

test('não junta proventos distintos', () => {
  // JCP e dividendo na mesma data, com tipos diferentes.
  const sameDay = [
    { exDate: d('2026-03-10'), paymentDate: d('2026-04-01'), amount: 0.2, type: 'JCP' },
    { exDate: d('2026-03-10'), paymentDate: d('2026-04-01'), amount: 0.2, type: 'DIVIDENDO' },
  ]
  assert.equal(dedupeDividends(sameDay).length, 2)
  // Valores muito diferentes sem rendimento de FII envolvido.
  assert.equal(dedupeDividends([yahoo('2026-03-10', 0.2), { ...sameDay[0], amount: 0.9 }]).length, 2)
  // Mais de 5 dias entre as datas-com.
  assert.equal(dedupeDividends([yahoo('2026-03-01', 1.1), rendimento('2026-03-07', '2026-03-20', 1.1)]).length, 2)
  // Pagamentos mensais iguais (um por mês).
  assert.equal(dedupeDividends([yahoo('2026-01-02', 0.018182), yahoo('2026-02-02', 0.018182), yahoo('2026-03-02', 0.018182)]).length, 3)
})

test('linha do Yahoo com a soma do dividendo e do JCP da mesma data sai', () => {
  const rows = [
    { exDate: d('2026-08-15'), paymentDate: d('2026-08-30'), amount: 0.3, type: 'DIVIDENDO' },
    { exDate: d('2026-08-15'), paymentDate: d('2026-08-30'), amount: 0.12, type: 'JCP' },
    yahoo('2026-08-14', 0.42),
  ]
  const kept = dedupeDividends(rows)
  assert.equal(kept.length, 2)
  assert.ok(kept.every((row) => row.type))
})

test('isNearDuplicateDividend respeita janela e tolerância configuráveis e ignora valores inválidos', () => {
  const a = yahoo('2026-01-01', 1)
  const b = { ...yahoo('2026-01-08', 1.03), type: 'DIVIDENDO' }
  assert.equal(isNearDuplicateDividend(a, b), false)
  assert.equal(isNearDuplicateDividend(a, b, { windowDays: 10, amountTolerance: 0.05 }), true)
  assert.equal(isNearDuplicateDividend(a, { ...b, amount: 'x' }, { windowDays: 10, amountTolerance: 0.05 }), false)
  // Valores Decimal-like (string) do Prisma.
  assert.equal(isNearDuplicateDividend({ ...a, amount: '1.000000' }, { ...a, exDate: d('2026-01-03'), amount: '1.01' }), true)
})
