import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateOverallScore,
  overallScoreWeights,
  qualityLabelFromScore,
  type OverallScoreWithBreakdown,
} from '../../strategies/overall-score'
import type { CompanyData, StrategyAnalysis } from '../../strategies/types'
import {
  computeFiiListingValuation,
  fiiTargetDY,
  fiiTargetDYAssumptions,
} from '../../fii-listing-valuation'
import { medianModelFairValue } from '../../strategies/ai-strategy'

const analysis = (score: number, fairValue: number | null = null, upside: number | null = null): StrategyAnalysis => ({
  isEligible: score >= 60,
  score,
  fairValue,
  upside,
  reasoning: '',
  criteria: [],
})

/** Todas as estratégias com o mesmo score; as de preço justo com 30% de potencial (sem penalização progressiva). */
const allStrategies = (score: number) => ({
  graham: analysis(score, 13, 30),
  dividendYield: analysis(score),
  lowPE: analysis(score),
  magicFormula: analysis(score),
  fcd: analysis(score, 13, 30),
  gordon: analysis(score, 13, 30),
  fundamentalist: analysis(score),
  barsi: analysis(score, 13, 30),
})

/** Empresa lucrativa, payout relevante, pouca dívida e margem alta: nenhuma penalização. */
const healthyFinancials = {
  roe: 0.25,
  liquidezCorrente: 2,
  dividaLiquidaPl: 0.2,
  margemLiquida: 0.25,
  payout: 0.5,
  lpa: 2,
  dy: 0.06,
}

const sumOf = (weights: Record<string, number>) => Object.values(weights).reduce((acc, w) => acc + w, 0)

test('pesos somam 1 com e sem dividendos, para ações e BDRs', () => {
  for (const isBDR of [false, true]) {
    for (const includeDividends of [false, true]) {
      const weights = overallScoreWeights({ isBDR, includeDividends })
      assert.ok(Math.abs(sumOf(weights) - 1) < 1e-12, `isBDR=${isBDR} includeDividends=${includeDividends}`)
    }
  }
  const noDividends = overallScoreWeights({ includeDividends: false })
  assert.equal(noDividends.dividendYield + noDividends.barsi + noDividends.gordon, 0)
})

test('empresa sintética perfeita chega a 100', () => {
  const result = calculateOverallScore(allStrategies(100), healthyFinancials, 10, undefined, true) as OverallScoreWithBreakdown
  assert.equal(result.score, 100)
  assert.equal(result.grade, 'A+')
  assert.equal(result.qualityLabel, 'Qualidade alta')
  assert.equal(result.recommendation, 'Qualidade alta')
  // Sem demonstrações financeiras: 8 dos 9 critérios aplicáveis.
  assert.deepEqual(result.dataCoverage, { used: 8, total: 9 })
  const weightSum = (result.contributions ?? []).reduce((acc, c) => acc + c.weight, 0)
  assert.ok(Math.abs(weightSum - 1) < 1e-12)
  assert.equal(result.rawScore, 100)
})

test('dado faltante é neutro: metade dos critérios sem dado não supera a empresa completa', () => {
  for (const score of [100, 70, 40]) {
    const complete = calculateOverallScore(allStrategies(score), healthyFinancials, 10)
    const partial = calculateOverallScore(
      { ...allStrategies(score), graham: null, lowPE: null, magicFormula: null, barsi: null },
      healthyFinancials,
      10
    )
    assert.ok(partial.score <= complete.score, `score ${score}: parcial ${partial.score} > completa ${complete.score}`)
    assert.deepEqual(partial.dataCoverage, { used: 4, total: 9 })
  }
})

test('critério ausente não conta como aprovado nem como reprovado', () => {
  const strategies = { ...allStrategies(80), lowPE: analysis(20) }
  const withWeak = calculateOverallScore(strategies, healthyFinancials, 10)
  const withoutLowPE = calculateOverallScore({ ...strategies, lowPE: null }, healthyFinancials, 10)
  assert.equal(withoutLowPE.score, 80)
  assert.ok(withWeak.score < withoutLowPE.score)
})

test('sentimento do YouTube não altera a nota', () => {
  const base = calculateOverallScore(allStrategies(70), healthyFinancials, 10)
  const withYoutube = calculateOverallScore(
    allStrategies(70),
    { ...healthyFinancials, youtubeAnalysis: { score: 100, summary: '', positivePoints: ['Tudo ótimo'] } },
    10
  )
  assert.equal(withYoutube.score, base.score)
  assert.deepEqual(withYoutube.strengths, base.strengths)
})

test('sem payout relevante, as estratégias de dividendos saem do total de critérios', () => {
  const result = calculateOverallScore(allStrategies(90), { ...healthyFinancials, payout: 0.1 }, 10)
  assert.deepEqual(result.dataCoverage, { used: 5, total: 6 })
  assert.equal(result.score, 90)
})

test('rótulos de qualidade por faixa de nota', () => {
  assert.equal(qualityLabelFromScore(85), 'Qualidade alta')
  assert.equal(qualityLabelFromScore(70), 'Qualidade boa')
  assert.equal(qualityLabelFromScore(50), 'Qualidade moderada')
  assert.equal(qualityLabelFromScore(49), 'Qualidade baixa')
})

// --- FII: preço-teto pela soma dos últimos 12 rendimentos / DY-alvo (integração com fii-listing-valuation) ---

const macro = { ntnbRealLong: 0.0768, ipcaExpected: 0.04, asOf: '2026-09-16' }
const asOf = new Date(Date.UTC(2026, 9, 1))

const monthlyHistory = (amount: number) =>
  Array.from({ length: 12 }, (_, i) => ({ exDate: new Date(Date.UTC(2025, 9 + i, 10)), amount }))

const fii = (overrides: Partial<CompanyData['financials']> = {}, dividendHistory = monthlyHistory(0.1)): CompanyData => ({
  ticker: 'TEST11',
  name: 'Fundo Teste',
  sector: 'Logística',
  currentPrice: 10,
  financials: { fiiCotacao: 10, dy: 0.12, vpa: 11, ...overrides },
  dividendHistory,
})

test('FII: 12 rendimentos mensais de R$ 0,10 com DY-alvo de 10% → preço-teto R$ 12,00 e potencial de 20%', () => {
  const valuation = computeFiiListingValuation(fii(), { targetDY: 0.1, asOf })
  assert.equal(valuation.upsideSource, 'dy_teto')
  assert.equal(valuation.annualIncomeSource, 'historico_12m')
  assert.equal(valuation.annualIncome, 1.2)
  assert.equal(valuation.fairValue, 12)
  assert.equal(valuation.precoTetoDY, 12)
  assert.ok(Math.abs((valuation.upside ?? 0) - 20) < 1e-9)
})

test('FII: DY-alvo = NTN-B + IPCA esperado + spread (tijolo 2,5 pp, papel 2 pp)', () => {
  const tijolo = computeFiiListingValuation(fii({ fiiIsPapel: false }), { macro, asOf })
  const papel = computeFiiListingValuation(fii({ fiiIsPapel: true }), { macro, asOf })
  const unknown = computeFiiListingValuation(fii(), { macro, asOf })
  assert.ok(Math.abs(tijolo.targetDY.value - 0.1418) < 1e-12)
  assert.ok(Math.abs(papel.targetDY.value - 0.1368) < 1e-12)
  assert.equal(unknown.targetDY.spread, 0.025)
  // Preço-teto e potencial têm o mesmo sinal: cota de R$ 10 com renda de R$ 1,20 e alvo de 14,18% fica acima do teto.
  assert.ok((tijolo.fairValue ?? 0) < 10 && (tijolo.upside ?? 0) < 0)
  assert.ok((papel.fairValue ?? 0) > (tijolo.fairValue ?? 0))
  assert.equal(fiiTargetDYAssumptions(fiiTargetDY('tijolo', macro)).replace(/\s/g, ' '), 'NTN-B 7,7% + IPCA esperado 4,0% + spread de 2,5 pp')
})

test('FII: sem histórico recente, usa DY 12m × cotação; sem rendimento, cai para o valor patrimonial', () => {
  const stale = computeFiiListingValuation(fii({}, [{ exDate: new Date(Date.UTC(2023, 0, 10)), amount: 5 }]), { targetDY: 0.1, asOf })
  assert.equal(stale.annualIncomeSource, 'dy_12m')
  assert.ok(Math.abs((stale.fairValue ?? 0) - 12) < 1e-9)

  const noIncome = computeFiiListingValuation(fii({ dy: null }, []), { targetDY: 0.1, asOf })
  assert.equal(noIncome.upsideSource, 'valor_patrimonial')
  assert.equal(noIncome.fairValue, 11)
  assert.equal(noIncome.precoTetoDY, null)
})

// --- Síntese com IA: preço justo e potencial vêm só da mediana dos modelos determinísticos ---

test('IA: preço justo = mediana dos modelos com valor positivo; sem modelos, null', () => {
  const strategies = {
    graham: analysis(80, 12, null),
    fcd: analysis(70, 18, null),
    gordon: analysis(60, null, null),
    barsi: analysis(60, 15, null),
    lowPE: analysis(90, 999, null), // modelo sem preço justo próprio: ignorado
  }
  const reference = medianModelFairValue(strategies, 10)
  assert.equal(reference.fairValue, 15)
  assert.ok(Math.abs((reference.upside ?? 0) - 50) < 1e-9)
  assert.deepEqual(medianModelFairValue({ graham: analysis(50, -3, null) }, 10), { fairValue: null, upside: null })
})
