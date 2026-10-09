import 'server-only'
import { unstable_cache } from 'next/cache'
import { computeShowcases } from './compute'
import { SHOWCASE_CACHE_TAG, SHOWCASE_DEFINITIONS, SHOWCASE_REVALIDATE_SECONDS } from './definitions'
import { isoDay, showcaseWindow, type ShowcaseBlock } from './summary'

/** Depois de uma falha, esta instância espera 10 minutos antes de tentar de novo (não roda 3 backtests por visita). */
const FAILURE_BACKOFF_MS = 10 * 60 * 1000

let lastFailureAt = 0
/** Cálculos em andamento por janela: visitas simultâneas com o cache vazio esperam o mesmo cálculo. */
const inFlight = new Map<string, Promise<ShowcaseBlock>>()

const DEFINITION_IDS = SHOWCASE_DEFINITIONS.map((definition) => definition.id).join(',')

/**
 * Data cache do Next: a chave é a lista de definições + a janela (muda uma vez por mês). Os resultados não vão para o
 * banco. Uma falha lança e não é guardada no cache.
 */
const cachedShowcases = unstable_cache(
  async (_definitionIds: string, windowStart: string, windowEnd: string): Promise<ShowcaseBlock> => {
    const key = `${windowStart}_${windowEnd}`
    const running = inFlight.get(key)
    if (running) return running
    const started = Date.now()
    const promise = computeShowcases({ startDate: new Date(`${windowStart}T00:00:00Z`), endDate: new Date(`${windowEnd}T00:00:00Z`) })
      .then((block) => {
        console.info(`[backtest-showcase] ${block.items.length} vitrines calculadas em ${Date.now() - started} ms (${key})`)
        return block
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  },
  ['backtest-showcase'],
  { revalidate: SHOWCASE_REVALIDATE_SECONDS, tags: [SHOWCASE_CACHE_TAG] }
)

async function load(force: boolean): Promise<ShowcaseBlock | null> {
  if (!force && lastFailureAt > 0 && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) return null
  const window = showcaseWindow()
  try {
    const block = await cachedShowcases(DEFINITION_IDS, isoDay(window.startDate), isoDay(window.endDate))
    lastFailureAt = 0
    return block
  } catch (error) {
    // Um log por falha: as próximas visitas caem no intervalo de espera e não tentam (nem registram) de novo
    lastFailureAt = Date.now()
    console.error('[backtest-showcase] vitrine indisponível:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Vitrine completa (as três carteiras) ou `null` se qualquer uma não puder ser calculada. Nunca lança. */
export function getShowcaseResults(): Promise<ShowcaseBlock | null> {
  return load(false)
}

/** Cron: recalcula ignorando o intervalo de espera depois de uma falha. */
export function warmShowcaseResults(): Promise<ShowcaseBlock | null> {
  return load(true)
}
