import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  collapseRankingHistory,
  rankingHistoryLabel,
  screeningFiltersTitle,
  topTickersLabel,
  type RankingHistoryEntry,
} from '../ranking-history-label'

const RESULTS = [{ ticker: 'CMIG4' }, { ticker: 'BBAS3' }, { ticker: 'PETR4' }]

function entry(overrides: Partial<RankingHistoryEntry> = {}): RankingHistoryEntry {
  return {
    id: 'a',
    model: 'screening',
    modelLabel: 'Screening de ações',
    description: 'Parâmetros personalizados',
    resultCount: 25,
    createdAt: '2026-10-09T15:00:00.000Z',
    params: {},
    results: RESULTS,
    ...overrides,
  }
}

test('screening: os 2 filtros mais restritivos viram o título', () => {
  const params = {
    plFilter: { enabled: true, max: 10 },
    dyFilter: { enabled: true, min: 0.06 },
    roeFilter: { enabled: true, min: 0.15 },
  }
  assert.equal(screeningFiltersTitle(params), 'P/L ≤ 10 · DY ≥ 6%')
})

test('screening: faixa fechada é mais restritiva que um limite só', () => {
  const params = {
    plFilter: { enabled: true, max: 10 },
    roeFilter: { enabled: true, min: 0.125, max: 0.4 },
  }
  assert.equal(screeningFiltersTitle(params), 'ROE 12,5%–40% · P/L ≤ 10')
})

test('screening: ignora filtros desligados ou sem limite e formata cada unidade', () => {
  const params = {
    plFilter: { enabled: false, max: 10 },
    pvpFilter: { enabled: true },
    grahamUpsideFilter: { enabled: true, min: 20 },
    marketCapFilter: { enabled: true, min: 10_000_000_000 },
  }
  // Intl usa espaço não separável dentro do valor em reais
  assert.equal(screeningFiltersTitle(params)?.replace(/\s/g, ' '), 'Potencial Graham ≥ 20% · Valor de mercado ≥ R$ 10,0 bi')
})

test('screening: setores e porte completam o título quando faltam filtros', () => {
  assert.equal(
    screeningFiltersTitle({ dyFilter: { enabled: true, min: 0.08 }, selectedSectors: ['Energia'] }),
    'DY ≥ 8% · Energia'
  )
  assert.equal(screeningFiltersTitle({ selectedSectors: ['A', 'B', 'C'], companySize: 'small_caps' }), '3 setores · Small caps')
  assert.equal(
    screeningFiltersTitle({ roeFilter: { enabled: true, min: 0.15 }, selectedIndustries: ['Bancos'] }),
    'ROE ≥ 15% · Bancos'
  )
  assert.equal(screeningFiltersTitle({ selectedIndustries: ['A', 'B', 'C'] }), '3 indústrias')
  assert.equal(screeningFiltersTitle({ companySize: 'all', assetTypeFilter: 'b3' }), null)
  assert.equal(screeningFiltersTitle(null), null)
})

test('label: screening com filtros mostra o modelo e os tickers no detalhe', () => {
  const label = rankingHistoryLabel(entry({ params: { plFilter: { enabled: true, max: 8 } } }))
  assert.deepEqual(label, { title: 'P/L ≤ 8', detail: 'Screening de ações · CMIG4, BBAS3 e mais 23' })
})

test('label: sem filtros usa o nome do modelo e os primeiros tickers', () => {
  assert.deepEqual(rankingHistoryLabel(entry({ params: { companySize: 'all' } })), {
    title: 'Screening de ações',
    detail: 'CMIG4, BBAS3 e mais 23',
  })
})

test('label: modelo do registro mantém a descrição da API', () => {
  const label = rankingHistoryLabel(
    entry({ model: 'graham', modelLabel: 'Graham', description: 'Margem mínima 30%', params: { marginOfSafety: 0.3 } })
  )
  assert.deepEqual(label, { title: 'Graham', detail: 'Margem mínima 30% · CMIG4, BBAS3 e mais 23' })
})

test('label: parâmetros e resultados ausentes não quebram', () => {
  assert.deepEqual(rankingHistoryLabel(entry({ params: null, results: undefined, description: null })), {
    title: 'Screening de ações',
    detail: null,
  })
  assert.deepEqual(rankingHistoryLabel(entry({ params: undefined, results: 'invalido' })), {
    title: 'Screening de ações',
    detail: null,
  })
})

test('tickers: poucos resultados não falam em "mais"', () => {
  assert.equal(topTickersLabel([{ ticker: 'VALE3' }], 1), 'VALE3')
  assert.equal(topTickersLabel([{ ticker: 'VALE3' }, { ticker: 'ITUB4' }], 2), 'VALE3 e ITUB4')
  assert.equal(topTickersLabel([{ ticker: 'VALE3' }, { ticker: 'ITUB4' }], 3), 'VALE3, ITUB4 e mais 1')
  assert.equal(topTickersLabel([{ name: 'sem ticker' }], 5), null)
  assert.equal(topTickersLabel([], 0), null)
})

test('agrupa repetições consecutivas no mesmo dia, com parâmetros iguais em qualquer ordem', () => {
  const rows = collapseRankingHistory([
    entry({ id: '1', createdAt: '2026-10-09T18:00:00.000Z', params: { a: 1, b: { enabled: true, min: 2 } } }),
    entry({ id: '2', createdAt: '2026-10-09T16:00:00.000Z', params: { b: { min: 2, enabled: true }, a: 1 } }),
    entry({ id: '3', createdAt: '2026-10-09T13:00:00.000Z', params: { a: 1, b: { enabled: true, min: 2 } } }),
    entry({ id: '4', createdAt: '2026-10-09T12:00:00.000Z', params: { a: 2 } }),
  ])
  assert.deepEqual(
    rows.map((row) => [row.id, row.repeatCount]),
    [
      ['1', 3],
      ['4', 1],
    ]
  )
})

test('não agrupa dias diferentes (horário de Brasília), modelos diferentes nem repetições separadas', () => {
  const rows = collapseRankingHistory([
    // 09/10 00:30 em Brasília
    entry({ id: '1', createdAt: '2026-10-09T03:30:00.000Z' }),
    // 08/10 23:30 em Brasília
    entry({ id: '2', createdAt: '2026-10-09T02:30:00.000Z' }),
    entry({ id: '3', createdAt: '2026-10-09T02:00:00.000Z', model: 'graham' }),
    entry({ id: '4', createdAt: '2026-10-09T01:00:00.000Z' }),
  ])
  assert.deepEqual(
    rows.map((row) => [row.id, row.repeatCount]),
    [
      ['1', 1],
      ['2', 1],
      ['3', 1],
      ['4', 1],
    ]
  )
})
