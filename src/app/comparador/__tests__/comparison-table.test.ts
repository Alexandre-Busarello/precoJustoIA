import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBestIndices, summarizeLeaders, type ComparisonCell, type ComparisonGroup } from '../../../components/comparison-table'

const cells = (...values: Array<number | null>): ComparisonCell[] => values.map((value) => ({ value, text: String(value) }))

test('getBestIndices: maior e menor é melhor', () => {
  assert.deepEqual(getBestIndices(cells(0.12, 0.2, 0.05), 'higher'), [1])
  assert.deepEqual(getBestIndices(cells(8, 4.5, 12), 'lower'), [1])
})

test('getBestIndices: dívida negativa (caixa líquido) vence em "lower"', () => {
  assert.deepEqual(getBestIndices(cells(1.2, -0.4), 'lower'), [1])
})

test('getBestIndices: "lower-positive" ignora P/L negativo ou zero', () => {
  assert.deepEqual(getBestIndices(cells(-3, 6, 9), 'lower-positive'), [1])
  assert.deepEqual(getBestIndices(cells(-3, 0, 9), 'lower-positive'), [])
})

test('getBestIndices: sem destaque com menos de 2 valores, todos iguais ou linha informativa', () => {
  assert.deepEqual(getBestIndices(cells(null, 5), 'higher'), [])
  assert.deepEqual(getBestIndices(cells(5, 5), 'higher'), [])
  assert.deepEqual(getBestIndices(cells(1, 2), 'none'), [])
})

test('getBestIndices: empate no melhor valor marca os empatados', () => {
  assert.deepEqual(getBestIndices(cells(10, 10, 3), 'higher'), [0, 1])
})

const assets = [
  { ticker: 'PETR4', name: 'Petrobras', href: '/acao/petr4' },
  { ticker: 'VALE3', name: 'Vale', href: '/acao/vale3' },
]

test('summarizeLeaders: conta só linhas liberadas com melhor valor', () => {
  const groups: ComparisonGroup[] = [
    {
      key: 'g',
      label: 'Grupo',
      rows: [
        { key: 'pl', label: 'P/L', better: 'lower-positive', cells: cells(4, 6) },
        { key: 'roe', label: 'ROE', better: 'higher', cells: cells(0.3, 0.2) },
        { key: 'dy', label: 'DY', better: 'higher', cells: cells(0.05, 0.08) },
        { key: 'cap', label: 'Valor de mercado', better: 'none', cells: cells(1e11, 2e11) },
        { key: 'roic', label: 'ROIC', better: 'higher', locked: true, cells: cells(null, null) },
      ],
    },
  ]
  assert.deepEqual(summarizeLeaders(assets, groups), { leaders: ['PETR4'], wins: 2, total: 3 })
})

test('summarizeLeaders: empate na liderança e ausência de dados', () => {
  const tie: ComparisonGroup[] = [
    {
      key: 'g',
      label: 'Grupo',
      rows: [
        { key: 'a', label: 'A', better: 'higher', cells: cells(2, 1) },
        { key: 'b', label: 'B', better: 'higher', cells: cells(1, 2) },
      ],
    },
  ]
  assert.deepEqual(summarizeLeaders(assets, tie), { leaders: ['PETR4', 'VALE3'], wins: 1, total: 2 })
  const empty: ComparisonGroup[] = [{ key: 'g', label: 'Grupo', rows: [{ key: 'a', label: 'A', better: 'higher', cells: cells(null, 1) }] }]
  assert.equal(summarizeLeaders(assets, empty), null)
})
