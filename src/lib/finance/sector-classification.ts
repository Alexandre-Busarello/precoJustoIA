/**
 * Classificação setorial por dicionário, determinística e insensível a acentos/maiúsculas.
 *
 * Cobre os nomes da Classificação Setorial B3 (setor / subsetor / segmento, ex.: "Financeiro" / "Bancos") e os nomes
 * do Yahoo traduzidos por LLM (`scripts/fetch-data-ward.ts`, ex.: "Serviços Financeiros", "Utilidades Públicas",
 * "Bancos - Regionais"). As strings de produção precisam ser validadas pelo dono com `SELECT DISTINCT sector, industry`.
 */

import { normalizeText } from './utils'

type Maybe<T> = T | null | undefined

/** Casa qualquer padrão contra o texto já normalizado (minúsculas, sem acentos). */
function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return text !== '' && patterns.some((p) => p.test(text))
}

/** Imobiliário não é financeira, mesmo quando a B3 o coloca no setor "Financeiro" (Exploração de Imóveis) ou é FII. */
const REAL_ESTATE = [/imobiliari/, /imoveis/, /real estate/, /\breits?\b/, /incorporac/, /construcao civil/]

/** Termos de instituições financeiras (setor ou indústria). Portado de `isBankOrFinancial` em overall-score.ts. */
const FINANCIAL = [
  /\bbanc/, // banco, bancos, bancário
  /\bbank/, // bank, banks, banking
  /financ/, // financeiro, financeira, serviços financeiros, financial services
  /intermediarios financeiros/,
  /seguro/, // seguros, seguradora
  /segurador/,
  /insurance/,
  /resseguro/,
  /reinsurance/,
  /previdencia/,
  /mercado(s)? de capita/, // mercados de capitais
  /capital markets/,
  /gestao de (ativos|recursos)/,
  /asset management/,
  /servicos de credito/,
  /credit services/,
  /securitizadora/,
  /sociedade(s)? de credito/,
]

/**
 * Banco, seguradora, previdência, holding financeira ou serviços financeiros. Holdings entram pelo setor
 * (B3: "Financeiro" / "Holdings Diversificadas"). Imobiliário (inclusive FIIs e "Exploração de Imóveis") fica de fora.
 */
export function isFinancial(sector: Maybe<string>, industry: Maybe<string>): boolean {
  const s = normalizeText(sector)
  const i = normalizeText(industry)
  if (matchesAny(s, REAL_ESTATE) || matchesAny(i, REAL_ESTATE)) return false
  return matchesAny(i, FINANCIAL) || matchesAny(s, FINANCIAL)
}

/** Setor inteiro de utilidade pública (B3 "Utilidade Pública"; Yahoo "Utilities" → "Utilidades/Serviços Públicos"). */
const UTILITY_SECTOR = [/utilidade(s)? publica/, /servicos publicos/, /\butilit/]

/** Indústrias de energia elétrica, saneamento e gás canalizado. */
const UTILITY_INDUSTRY = [
  /energia eletrica/,
  /eletricidade/,
  /eletric(o|a)s? regulad/, // "Elétricos Regulados", "Elétrica Regulada"
  /regulated electric/,
  /electric utilit/,
  /(geracao|transmissao|distribuicao) de (energia|eletricidade)/,
  /produtor(es)? (independentes )?de energia/,
  /power producer/,
  /energias? renovave/,
  /renewable/,
  /saneamento/,
  /\bagua\b/,
  /\bwater\b/,
  /^gas$/, // B3: Utilidade Pública / Gás
  /gas regulad/,
  /regulated gas/,
  /(distribuicao|distribuidora) de gas/,
  /gas canalizado/,
]

/** Evita que "Petróleo, Gás e Biocombustíveis" ou equipamentos elétricos caiam em utilities. */
const NOT_UTILITY = [/petroleo/, /\boil\b/, /combustive/, /equipament/, /equipment/, /aparelhos/]

/** Energia elétrica (geração, transmissão, distribuição), saneamento e gás canalizado. */
export function isUtility(sector: Maybe<string>, industry: Maybe<string>): boolean {
  const s = normalizeText(sector)
  const i = normalizeText(industry)
  if (matchesAny(i, NOT_UTILITY)) return false
  return matchesAny(s, UTILITY_SECTOR) || matchesAny(i, UTILITY_INDUSTRY)
}

/** Commodities cíclicas: petróleo, mineração, siderurgia, papel e celulose, petroquímica e commodities agrícolas. */
const CYCLICAL_COMMODITY = [
  /petroleo/,
  /\boil\b/,
  /oil & gas/,
  /exploracao(,| e) (e )?producao/, // "Exploração, Refino e Distribuição", "Exploração e Produção"
  /refino/,
  /biocombustive/,
  /petroquimic/,
  /mineracao/,
  /minerais metalicos/,
  /minerio/,
  /\bmining\b/,
  /\bmetais\b/,
  /\bmetals\b/,
  /siderurgi/,
  /metalurgi/,
  /\bsteel\b/,
  /\baco\b/,
  /papel e celulose/,
  /madeira e papel/,
  /celulose/,
  /\bpulp\b/,
  /\bpaper\b/,
  /produtos florestais/,
  /forest products/,
  /agropecuari/,
  /agricultur/,
  /agricola/,
  /agricultural/,
  /farm products/,
  /acucar/,
  /\bsugar\b/,
  /\bgraos\b/,
  /\bgrains\b/,
]

/** Ciclo de preços de commodity domina o lucro (normalizar LPA antes de valuation). Só olha a indústria, e o setor quando não há indústria. */
export function isCyclicalCommodity(sector: Maybe<string>, industry: Maybe<string>): boolean {
  const i = normalizeText(industry)
  if (i) return matchesAny(i, CYCLICAL_COMMODITY)
  return matchesAny(normalizeText(sector), CYCLICAL_COMMODITY)
}

export type SectorClass = 'financial' | 'utility' | 'cyclicalCommodity' | 'other'

/** Classe única, na ordem de precedência financeira → utility → commodity cíclica → outra. */
export function sectorClass(sector: Maybe<string>, industry: Maybe<string>): SectorClass {
  if (isFinancial(sector, industry)) return 'financial'
  if (isUtility(sector, industry)) return 'utility'
  if (isCyclicalCommodity(sector, industry)) return 'cyclicalCommodity'
  return 'other'
}
