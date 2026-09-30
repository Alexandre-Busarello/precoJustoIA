import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RANKING_MODELS,
  buildRankBuilderBody,
  canAutoRunRankingModel,
  canUseRankingModel,
  defaultModelForUniverse,
  getRankingModel,
  modelsForUniverse,
  previewCredentials,
  rankingModelLabel,
  universeForModel,
} from '../../lib/ranking-models'
import {
  etfRowsFromApi,
  etfRowsFromHistory,
  formatParamValue,
  rankingMetrics,
  stripEmoji,
  summarizeParams,
  toRankingRows,
  type RankingResult,
} from './ranking-data'
import { applyRankingSelection, parseRankingUrl } from './ranking-url'

const params = (entries: Record<string, string>) => new URLSearchParams(entries)

test('registro: chaves únicas, campos com padrão e rótulos sem termos proibidos', () => {
  const keys = RANKING_MODELS.map((m) => m.key)
  assert.equal(new Set(keys).size, keys.length)
  const banned = /compra|venda|melhores|preditiv|garantid|único/i
  for (const model of RANKING_MODELS) {
    assert.doesNotMatch(`${model.label} ${model.description}`, banned, model.key)
    const defaults = model.defaults('b3')
    for (const field of model.fields) {
      assert.ok(field.key in defaults, `${model.key}.${field.key} sem valor padrão`)
      if (field.kind === 'slider') {
        const value = defaults[field.key] as number
        assert.ok(value >= field.min && value <= field.max, `${model.key}.${field.key} fora do intervalo`)
      }
    }
  }
})

test('registro: padrões de BDR ficam dentro dos intervalos dos sliders', () => {
  for (const model of modelsForUniverse('bdr')) {
    const defaults = model.defaults('bdr')
    for (const field of model.fields) {
      if (field.kind !== 'slider') continue
      const value = defaults[field.key] as number
      assert.ok(value >= field.min && value <= field.max, `${model.key}.${field.key}=${value}`)
    }
  }
})

test('modelos por universo e modelo padrão', () => {
  assert.ok(modelsForUniverse('b3').every((m) => m.assetType === 'stock'))
  assert.deepEqual(
    modelsForUniverse('fii').map((m) => m.key),
    ['fiiDividendYield', 'fiiRanking']
  )
  assert.ok(modelsForUniverse('etf').every((m) => m.key.startsWith('etfs-')))
  assert.equal(defaultModelForUniverse('b3').key, 'graham')
  assert.equal(defaultModelForUniverse('fii').key, 'fiiDividendYield')
  assert.equal(defaultModelForUniverse('etf').key, 'etfs-melhor-score-geral')
  assert.equal(universeForModel(getRankingModel('fiiRanking')!, 'b3'), 'fii')
  assert.equal(universeForModel(getRankingModel('fcd')!, 'bdr'), 'bdr')
})

test('plano: gratuito usa Graham; IA nunca roda sozinha', () => {
  const graham = getRankingModel('graham')!
  const fcd = getRankingModel('fcd')!
  const ai = getRankingModel('ai')!
  assert.equal(canUseRankingModel(graham, false), true)
  assert.equal(canUseRankingModel(fcd, false), false)
  assert.equal(canUseRankingModel(fcd, true), true)
  assert.equal(canAutoRunRankingModel(ai, true), false)
  assert.equal(canAutoRunRankingModel(fcd, true), true)
})

test('corpo da API: universo vira assetTypeFilter e FIIs sempre usam "fii"', () => {
  const graham = getRankingModel('graham')!
  assert.deepEqual(buildRankBuilderBody(graham, 'both', { marginOfSafety: 0.2 }).params, {
    marginOfSafety: 0.2,
    includeBDRs: true,
    assetTypeFilter: 'both',
  })
  assert.equal(buildRankBuilderBody(graham, 'b3', {}).params.includeBDRs, false)
  const fii = getRankingModel('fiiDividendYield')!
  const body = buildRankBuilderBody(fii, 'b3', fii.defaults('fii'))
  assert.equal(body.params.assetTypeFilter, 'fii')
  assert.equal(body.params.includeBDRs, false)
})

test('rótulos de modelos salvos, inclusive os que saíram do registro', () => {
  assert.equal(rankingModelLabel('graham'), 'Número de Graham')
  assert.equal(rankingModelLabel('screening'), 'Screening de ações')
  assert.equal(rankingModelLabel('desconhecido'), 'desconhecido')
})

const baseResult: RankingResult = {
  ticker: 'LREN3',
  name: 'Lojas Renner S.A.',
  sector: 'Consumo Cíclico',
  currentPrice: 75,
  logoUrl: null,
  fairValue: 100,
  upside: 33.33,
  marginOfSafety: 33.33,
  rational: 'Aprovada. \n\n📊 **Análise Técnica**: RSI 33',
  key_metrics: { qualityScore: 73.2, roe: 0.105, pl: 6.4, desconhecida: 5 },
}

test('linhas: margem de segurança = 1 − preço/preço justo e score do modelo', () => {
  const [row] = toRankingRows([baseResult], getRankingModel('graham'))
  assert.equal(row.margin, 0.25)
  assert.equal(row.score, 73.2)
  assert.equal(row.fairValueSource, null)
  assert.equal(row.href, '/acao/lren3')
  assert.equal(row.position, 1)
  assert.deepEqual(
    row.metrics.map((m) => m.key),
    ['pl', 'roe']
  )
  assert.equal(row.rationale.includes('📊'), false)
})

test('linhas: Barsi usa o preço-teto como referência', () => {
  const [row] = toRankingRows(
    [{ ...baseResult, fairValue: 41, fairValueModel: 'Gordon', key_metrics: { ceilingPrice: 150, barsiScore: 90 } }],
    getRankingModel('barsi')
  )
  assert.equal(row.fairValue, 150)
  assert.equal(row.margin, 0.5)
  assert.equal(row.fairValueSource, null)
  assert.equal(row.score, 90)
})

test('linhas: preço justo de outro modelo mostra a origem; FII aponta para /fii', () => {
  const [stock] = toRankingRows([{ ...baseResult, fairValueModel: 'Graham' }], getRankingModel('lowPE'))
  assert.equal(stock.fairValueSource, 'Graham')
  const [fii] = toRankingRows(
    [{ ...baseResult, ticker: 'MXRF11', fairValue: null, key_metrics: { dy: 0.123 } }],
    getRankingModel('fiiDividendYield')
  )
  assert.equal(fii.href, '/fii/mxrf11')
  assert.equal(fii.margin, null)
  assert.equal(fii.score, 0.123)
})

test('linhas: preço ou preço justo ausente não inventa margem', () => {
  const [row] = toRankingRows([{ ...baseResult, currentPrice: 0 }], getRankingModel('graham'))
  assert.equal(row.price, null)
  assert.equal(row.margin, null)
})

test('métricas: unidades por chave e ordem estável', () => {
  const metrics = rankingMetrics({ discountFromCeiling: 40.8, dividendYield: 0.109, barsiScore: 90 }, 'barsiScore')
  assert.deepEqual(
    metrics.map((m) => [m.key, m.value]),
    [
      ['dividendYield', '10,9%'],
      ['discountFromCeiling', '+40,8%'],
    ]
  )
})

test('ETFs: retorno de 6 meses anualizado quando falta 12 meses', () => {
  const [row] = etfRowsFromApi([
    {
      ticker: 'BOVA11',
      name: 'iShares Ibovespa',
      logoUrl: null,
      etfScore: 92,
      netExpenseRatio: 0.001,
      return1y: null,
      return6m: 0.1,
      return3y: null,
      return5y: null,
      netAssets: null,
      benchmarkIndex: 'Ibovespa',
      isEstimatedReturn: true,
    },
  ])
  assert.ok(Math.abs((row.return1y ?? 0) - 0.21) < 1e-9)
  assert.equal(row.href, '/etf/bova11')
  const [saved] = etfRowsFromHistory([{ ...baseResult, ticker: 'IVVB11', key_metrics: { etfScore: 88, retorno_1a: 0.2, taxa_adm: 0.0023 } }])
  assert.equal(saved.score, 88)
  assert.equal(saved.expenseRatio, 0.0023)
})

test('parâmetros: formato e resumo do painel', () => {
  const graham = getRankingModel('graham')!
  const [, margin] = graham.fields
  assert.equal(formatParamValue(margin, 0.2), '20%')
  assert.equal(formatParamValue(getRankingModel('dividendYield')!.fields[1], 0.025), '2,5%')
  assert.equal(summarizeParams(graham, graham.defaults('b3')), 'Upside mínimo 20%')
  assert.equal(
    summarizeParams(graham, { ...graham.defaults('b3'), companySize: 'small_caps' }),
    'Tamanho da empresa Small caps (até R$ 2 bi) · Upside mínimo 20%'
  )
})

test('stripEmoji remove emoji e espaços duplicados', () => {
  assert.equal(stripEmoji('📊 **Análise**  ok ✅'), '**Análise** ok')
})

test('URL: padrão, links antigos e ranking salvo', () => {
  assert.deepEqual(parseRankingUrl(params({})), { tab: 'ranking', rankingId: null, universe: 'b3', modelKey: 'graham' })
  assert.equal(parseRankingUrl(params({ s: 'historico' })).tab, 'historico')
  assert.equal(parseRankingUrl(params({ tab: 'historico' })).tab, 'historico')
  assert.deepEqual(parseRankingUrl(params({ assetType: 'etf' })), {
    tab: 'ranking',
    rankingId: null,
    universe: 'etf',
    modelKey: 'etfs-melhor-score-geral',
  })
  assert.equal(parseRankingUrl(params({ model: 'fiiRanking' })).universe, 'fii')
  assert.equal(parseRankingUrl(params({ model: 'inexistente' })).modelKey, 'graham')
  assert.equal(parseRankingUrl(params({ id: 'abc' })).rankingId, 'abc')
})

test('prévia: sem cookies só quando o plano não muda o resultado', () => {
  const graham = getRankingModel('graham')!
  const etf = defaultModelForUniverse('etf')
  const fcd = getRankingModel('fcd')!
  assert.equal(previewCredentials(graham, false), 'omit')
  assert.equal(previewCredentials(graham, true), 'omit')
  // ETFs: gratuito recebe 10 de qualquer jeito; Premium precisa da sessão para a lista completa.
  assert.equal(previewCredentials(etf, false), 'omit')
  assert.equal(previewCredentials(etf, true), 'same-origin')
  assert.equal(previewCredentials(fcd, true), 'same-origin')
})

test('URL: seleção de modelo e classe de ativo vai para a URL e volta igual', () => {
  const select = (start: Record<string, string>, modelKey: string, universe: Parameters<typeof applyRankingSelection>[2]) => {
    const next = new URLSearchParams(start)
    applyRankingSelection(next, modelKey, universe)
    return next
  }
  assert.equal(select({ assetType: 'etf', tab: 'historico' }, 'graham', 'b3').toString(), 'tab=historico')
  assert.equal(select({ id: 'abc' }, 'fcd', 'b3').toString(), 'model=fcd')
  assert.equal(select({}, 'fiiDividendYield', 'fii').toString(), 'assetType=fii')
  const cases: Array<[string, Parameters<typeof applyRankingSelection>[2]]> = [
    ['graham', 'b3'],
    ['fcd', 'b3'],
    ['gordon', 'bdr'],
    ['fiiRanking', 'fii'],
    [defaultModelForUniverse('etf').key, 'etf'],
    [modelsForUniverse('etf')[1].key, 'etf'],
  ]
  for (const [modelKey, universe] of cases) {
    const parsed = parseRankingUrl(select({}, modelKey, universe))
    assert.equal(parsed.modelKey, modelKey)
    assert.equal(parsed.universe, universe)
    assert.equal(parsed.rankingId, null)
  }
})
