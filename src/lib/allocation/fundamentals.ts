/**
 * Checagem "fundamentos preservados" do "Onde aportar", sobre `fundamentalsIntact` (src/lib/finance/signals.ts).
 *
 * Com 8 trimestres consecutivos, usa os trimestres. Sem eles (a base guarda demonstrações anuais), compara os dois
 * últimos períodos de 12 meses de `FinancialData`: cada ano vira 4 "trimestres" com 1/4 do lucro e do EBITDA e os
 * índices de 12 meses repetidos (`ratioBasis: 'ttm'`). Assim valem os mesmos critérios e limites da função original:
 * lucro 12m não cai mais de 15%, ROE e margem não caem mais de 3 p.p., dívida líquida/EBITDA não sobe mais de 1,0x.
 * Em bancos e seguradoras a alavancagem por EBITDA não se aplica e o critério é ignorado.
 */

import { fundamentalsIntact, INSUFFICIENT_DATA_CHECK, type QuarterFundamentals } from '@/lib/finance/signals'
import { isFiniteNumber } from '@/lib/finance/utils'
import type { FundamentalsStatus } from './types'

/** Um período de 12 meses (linha anual de `FinancialData`). Índices em fração. */
export interface AnnualFundamentals {
  year: number
  lucroLiquido: number | null
  roe: number | null
  margemLiquida: number | null
  ebitda: number | null
  /** Dívida líquida / EBITDA (x). */
  dividaLiquidaEbitda: number | null
}

const LEVERAGE_CHECK = 'Dívida líquida/EBITDA'

function yearToQuarters(row: AnnualFundamentals, financial: boolean): QuarterFundamentals[] {
  const ebitda = financial ? 1 : row.ebitda
  const netDebt = financial ? 0 : isFiniteNumber(row.ebitda) && isFiniteNumber(row.dividaLiquidaEbitda) ? row.dividaLiquidaEbitda * row.ebitda : null
  return [0, 1, 2, 3].map((q) => ({
    date: new Date(Date.UTC(row.year - 1, 2 + q * 3, 28)),
    lucroLiquido: isFiniteNumber(row.lucroLiquido) ? row.lucroLiquido / 4 : null,
    roe: row.roe,
    margemLiquida: row.margemLiquida,
    dividaLiquida: netDebt,
    ebitda: isFiniteNumber(ebitda) ? ebitda / 4 : null,
  }))
}

function toStatus(checks: { name: string; passed: boolean; detail: string }[]): FundamentalsStatus {
  const insufficient = checks.find((c) => !c.passed && c.name === INSUFFICIENT_DATA_CHECK)
  if (insufficient) return { intact: false, insufficient: true, detail: insufficient.detail }
  const failed = checks.find((c) => !c.passed)
  if (failed) return { intact: false, detail: `${failed.name}: ${failed.detail}` }
  return { intact: true }
}

/**
 * Situação dos fundamentos a partir dos trimestres (preferidos) ou dos dois últimos anos.
 * Sem nenhum dos dois, devolve `insufficient` (o motor exclui: sem benefício da dúvida).
 */
export function fundamentalsStatus({
  quarters,
  annual,
  financial,
}: {
  quarters?: readonly QuarterFundamentals[]
  annual?: readonly AnnualFundamentals[]
  financial: boolean
}): FundamentalsStatus {
  let series: QuarterFundamentals[] | null = null
  let ratioBasis: 'quarterly' | 'ttm' = 'ttm'
  if (quarters && quarters.length >= 8) {
    series = financial ? quarters.map((q) => ({ ...q, dividaLiquida: 0, ebitda: 1 })) : [...quarters]
    ratioBasis = 'quarterly'
  } else if (annual && annual.length >= 2) {
    const [last, previous] = [...annual].sort((a, b) => b.year - a.year)
    if (last.year - previous.year === 1) series = [...yearToQuarters(previous, financial), ...yearToQuarters(last, financial)]
  }
  if (!series) return { intact: false, insufficient: true, detail: 'Faltam dois períodos de 12 meses consecutivos.' }

  const result = fundamentalsIntact(series, { ratioBasis })
  const checks = financial ? result.checks.filter((c) => c.name !== LEVERAGE_CHECK) : result.checks
  return toStatus(checks)
}
