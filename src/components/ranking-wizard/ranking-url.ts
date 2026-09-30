import {
  DEFAULT_RANKING_UNIVERSE,
  defaultModelForUniverse,
  getRankingModel,
  isRankingUniverse,
  universeForModel,
  type RankingUniverse,
} from '@/lib/ranking-models'

export type RankingTab = 'ranking' | 'historico'

export interface RankingUrlState {
  tab: RankingTab
  /** Ranking salvo a abrir. */
  rankingId: string | null
  universe: RankingUniverse
  modelKey: string
}

interface SearchParamsLike {
  get(name: string): string | null
}

/**
 * Lê o estado inicial de /ranking a partir da URL. Aceita os links antigos:
 * `?s=historico` (aba Histórico), `?assetType=etf` (universo) e `?model=graham` (modelo).
 */
export function parseRankingUrl(searchParams: SearchParamsLike): RankingUrlState {
  const tabParam = searchParams.get('tab') ?? searchParams.get('s')
  const assetType = searchParams.get('assetType')
  const model = getRankingModel(searchParams.get('model'))
  const preferred = isRankingUniverse(assetType) ? assetType : DEFAULT_RANKING_UNIVERSE
  const universe = model ? universeForModel(model, preferred) : preferred
  const modelKey = model?.key ?? defaultModelForUniverse(universe).key

  return {
    tab: tabParam === 'historico' ? 'historico' : 'ranking',
    rankingId: searchParams.get('id') || null,
    universe,
    modelKey,
  }
}

/**
 * Grava o modelo e a classe de ativo escolhidos na URL (recarregar ou compartilhar reabre a mesma seleção).
 * Omite os valores padrão para manter `/ranking` limpo e sai do ranking salvo (`id`).
 */
export function applyRankingSelection(params: URLSearchParams, modelKey: string, universe: RankingUniverse): void {
  params.delete('id')
  if (universe === DEFAULT_RANKING_UNIVERSE) params.delete('assetType')
  else params.set('assetType', universe)
  if (modelKey === defaultModelForUniverse(universe).key) params.delete('model')
  else params.set('model', modelKey)
}
