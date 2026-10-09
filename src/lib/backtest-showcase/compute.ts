import 'server-only'
import { BacktestService } from '@/lib/backtest-service'
import { BacktestDataValidator } from '@/lib/backtest-data-validator'
import { monthStartUtc, normalizeWeights } from '@/lib/backtest/quick-backtest'
import { SHOWCASE_DEFINITIONS, type ShowcaseDefinition } from './definitions'
import { allOrNothing, commonStart, isoDay, summarizeShowcase, type ShowcaseBlock, type ShowcaseWindow } from './summary'

export class ShowcaseUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShowcaseUnavailableError'
  }
}

/**
 * Roda as vitrines no mesmo motor e com os mesmos parâmetros do backtest rápido (`/api/backtest/quick`): pesos
 * normalizados, início no 1º mês com cotações de todos os ativos e fim no 1º dia do mês corrente. Lança
 * `ShowcaseUnavailableError` se qualquer vitrine não puder ser calculada (o bloco inteiro some).
 */
export async function computeShowcases(
  window: ShowcaseWindow,
  definitions: readonly ShowcaseDefinition[] = SHOWCASE_DEFINITIONS
): Promise<ShowcaseBlock> {
  const validator = new BacktestDataValidator()
  const prepared = []
  for (const definition of definitions) {
    const assets = normalizeWeights(definition.tickers)
    const validation = await validator.validateBacktestData(assets, window.startDate, window.endDate)
    const missing = validation.assetsAvailability.filter((asset) => asset.totalMonths === 0).map((asset) => asset.ticker)
    if (missing.length > 0) throw new ShowcaseUnavailableError(`${definition.id}: sem cotações de ${missing.join(', ')}`)
    prepared.push({ definition, assets, start: monthStartUtc(validation.adjustedStartDate) })
  }

  const common = commonStart(window, prepared.map((item) => item.start))
  if (!common) throw new ShowcaseUnavailableError('histórico comum menor que 36 meses')

  const service = new BacktestService()
  const summaries = []
  for (const { definition, assets } of prepared) {
    const result = await service.runBacktest({
      assets,
      startDate: common.startDate,
      endDate: window.endDate,
      initialCapital: definition.initialCapital,
      monthlyContribution: definition.monthlyContribution,
      rebalanceFrequency: definition.rebalanceFrequency,
    })
    const summary = summarizeShowcase(
      definition,
      assets.map((asset) => asset.allocation),
      result
    )
    if (!summary) throw new ShowcaseUnavailableError(`${definition.id}: resultado incompleto (sem CDI ou Ibovespa)`)
    summaries.push(summary)
  }

  const items = allOrNothing(summaries)
  if (!items || items.length !== definitions.length) throw new ShowcaseUnavailableError('vitrine incompleta')
  return {
    computedAt: new Date().toISOString(),
    windowStart: isoDay(common.startDate),
    windowEnd: isoDay(window.endDate),
    shortenedWindow: common.shortened,
    items,
  }
}
