'use client'

import { useMemo } from 'react'
import { isFinancialSector } from '@/lib/financial-data-service'
import {
  IndicatorGrid,
  sevenYearAverage,
  type IndicatorBetter,
  type IndicatorFormat,
  type IndicatorGroup,
  type IndicatorItem,
  type IndicatorYearValue,
} from '@/components/asset/indicator-grid'

type Row = Record<string, unknown>

/** Converte Decimal do Prisma, string ou número em número finito (ou `null`). */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: unknown }).toNumber === 'function') {
    const n = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(n) ? n : null
  }
  const n = parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

/** Considera anual o registro de dezembro (fim do ano fiscal) ou marcado como YEARLY. */
function isAnnual(row: Row): boolean {
  const endDate = new Date(row.endDate as string)
  return endDate.getMonth() === 11 || row.period === 'YEARLY'
}

interface IndicatorDefinition {
  key: string
  /** Campo em `financialData` (valor atual e série histórica). */
  field: string
  label: string
  format: IndicatorFormat
  digits?: number
  better: IndicatorBetter
  description: string
  reference?: string
}

const GROUPS: Array<{ title: string; items: IndicatorDefinition[] }> = [
  {
    title: 'Valuation',
    items: [
      {
        key: 'pl',
        field: 'pl',
        label: 'P/L',
        format: 'multiple',
        better: 'lower',
        description: 'Preço da ação dividido pelo lucro por ação: quantos anos de lucro atual equivalem ao preço pago.',
        reference: 'entre 8x e 15x',
      },
      {
        key: 'pvp',
        field: 'pvp',
        label: 'P/VP',
        format: 'multiple',
        digits: 2,
        better: 'lower',
        description: 'Preço da ação dividido pelo valor patrimonial por ação. Abaixo de 1x, o mercado paga menos que o patrimônio contábil.',
        reference: 'entre 0,8x e 2x',
      },
      {
        key: 'evEbitda',
        field: 'evEbitda',
        label: 'EV/EBITDA',
        format: 'multiple',
        better: 'lower',
        description: 'Valor da firma (mercado + dívida líquida) dividido pela geração de caixa operacional. Útil para comparar empresas com dívidas diferentes.',
        reference: 'entre 6x e 12x',
      },
      {
        key: 'dy',
        field: 'dy',
        label: 'Dividend yield',
        format: 'percent',
        better: 'higher',
        description: 'Proventos pagos nos últimos 12 meses em relação ao preço atual. Valores muito altos podem refletir queda do preço ou pagamento não recorrente.',
        reference: 'acima de 4%',
      },
    ],
  },
  {
    title: 'Rentabilidade',
    items: [
      {
        key: 'roe',
        field: 'roe',
        label: 'ROE',
        format: 'percent',
        better: 'higher',
        description: 'Lucro líquido sobre o patrimônio líquido: quanto a empresa gera de lucro com o capital dos acionistas.',
        reference: 'acima de 15%',
      },
      {
        key: 'roic',
        field: 'roic',
        label: 'ROIC',
        format: 'percent',
        better: 'higher',
        description: 'Retorno sobre todo o capital investido (próprio e de terceiros). Deve superar o custo de capital da empresa.',
        reference: 'acima de 12%',
      },
      {
        key: 'roa',
        field: 'roa',
        label: 'ROA',
        format: 'percent',
        better: 'higher',
        description: 'Lucro líquido sobre os ativos totais: eficiência no uso dos ativos para gerar lucro.',
        reference: 'acima de 8%',
      },
      {
        key: 'margemLiquida',
        field: 'margemLiquida',
        label: 'Margem líquida',
        format: 'percent',
        better: 'higher',
        description: 'Parcela da receita que vira lucro líquido depois de custos, despesas, juros e impostos.',
        reference: 'acima de 10%',
      },
    ],
  },
  {
    title: 'Endividamento',
    items: [
      {
        key: 'liquidezCorrente',
        field: 'liquidezCorrente',
        label: 'Liquidez corrente',
        format: 'multiple',
        digits: 2,
        better: 'higher',
        description: 'Ativo circulante dividido pelo passivo circulante: capacidade de pagar as obrigações de curto prazo.',
        reference: 'entre 1,2x e 2x',
      },
      {
        key: 'dividaLiquidaPl',
        field: 'dividaLiquidaPl',
        label: 'Dív. líq./PL',
        format: 'multiple',
        digits: 2,
        better: 'lower',
        description: 'Dívida líquida em relação ao patrimônio líquido. Mede a alavancagem; valor negativo indica caixa maior que a dívida.',
        reference: 'abaixo de 0,5x',
      },
      {
        key: 'dividaLiquidaEbitda',
        field: 'dividaLiquidaEbitda',
        label: 'Dív. líq./EBITDA',
        format: 'multiple',
        digits: 2,
        better: 'lower',
        description: 'Quantos anos da geração de caixa atual seriam necessários para quitar a dívida líquida.',
        reference: 'abaixo de 3x',
      },
      {
        key: 'passivoAtivos',
        field: 'passivoAtivos',
        label: 'Passivo/ativos',
        format: 'percent',
        better: 'lower',
        description: 'Parcela dos ativos financiada por dívidas e outras obrigações.',
        reference: 'abaixo de 60%',
      },
    ],
  },
  {
    title: 'Crescimento',
    items: [
      {
        key: 'cagrLucros5a',
        field: 'cagrLucros5a',
        label: 'CAGR lucros 5a',
        format: 'percent',
        better: 'higher',
        description: 'Crescimento anual composto do lucro líquido nos últimos 5 anos.',
        reference: 'acima de 10% a.a.',
      },
      {
        key: 'cagrReceitas5a',
        field: 'cagrReceitas5a',
        label: 'CAGR receitas 5a',
        format: 'percent',
        better: 'higher',
        description: 'Crescimento anual composto da receita nos últimos 5 anos.',
        reference: 'acima de 8% a.a.',
      },
      {
        key: 'crescimentoLucros',
        field: 'crescimentoLucros',
        label: 'Cresc. lucros (ano)',
        format: 'percent',
        better: 'higher',
        description: 'Variação do lucro líquido em relação ao ano anterior. Resultados não recorrentes distorcem este número.',
      },
      {
        key: 'crescimentoReceitas',
        field: 'crescimentoReceitas',
        label: 'Cresc. receitas (ano)',
        format: 'percent',
        better: 'higher',
        description: 'Variação da receita em relação ao ano anterior.',
      },
    ],
  },
  {
    title: 'Mercado',
    items: [
      {
        key: 'marketCap',
        field: 'marketCap',
        label: 'Valor de mercado',
        format: 'brlCompact',
        better: null,
        description: 'Preço da ação multiplicado pelo total de ações emitidas.',
      },
      {
        key: 'receitaTotal',
        field: 'receitaTotal',
        label: 'Receita total',
        format: 'brlCompact',
        better: 'higher',
        description: 'Receita anual com vendas e serviços. Crescimento sustentado indica expansão do negócio.',
      },
      {
        key: 'lpa',
        field: 'lpa',
        label: 'LPA',
        format: 'brl',
        better: 'higher',
        description: 'Lucro líquido dividido pelo número de ações. Compare a evolução ao longo dos anos.',
      },
      {
        key: 'vpa',
        field: 'vpa',
        label: 'VPA',
        format: 'brl',
        better: 'higher',
        description: 'Patrimônio líquido dividido pelo número de ações: valor contábil de cada ação.',
      },
    ],
  },
]

interface FinancialIndicatorsProps {
  ticker: string
  latestFinancials: any
  comprehensiveData?: any
}

/** Indicadores do ativo em grade única (valor atual, média de 7 anos e diferença), com histórico por indicador. */
export default function FinancialIndicators({ ticker, latestFinancials, comprehensiveData }: FinancialIndicatorsProps) {
  const groups = useMemo<IndicatorGroup[]>(() => {
    const financials: Row = latestFinancials ?? {}
    const incomeStatements: Row[] = comprehensiveData?.incomeStatements ?? []
    const keyStatistics: Row[] = comprehensiveData?.keyStatistics ?? []
    const history: Row[] = comprehensiveData?.financialData ?? []
    const isFinancial = isFinancialSector(null, null, ticker)

    // Dados ANUAIS mais recentes das demonstrações, usados como alternativa quando o indicador não foi calculado
    const annualIncome = incomeStatements.find(isAnnual) ?? incomeStatements[0]
    const annualStats = keyStatistics.find(isAnnual) ?? keyStatistics[0]

    const margemLiquida = (): number | null => {
      const direct = toNumber(financials.margemLiquida)
      // Bancos e seguradoras têm estrutura contábil própria: sem estimativa a partir da DRE
      if (direct !== null || isFinancial) return direct
      const netIncome = toNumber(annualIncome?.netIncome)
      const totalRevenue = toNumber(annualIncome?.totalRevenue)
      if (netIncome !== null && totalRevenue && totalRevenue > 0) return netIncome / totalRevenue
      const operatingIncome = toNumber(annualIncome?.operatingIncome)
      if (netIncome !== null && operatingIncome && operatingIncome > 0) return netIncome / operatingIncome
      return null
    }

    const receitaTotal = (): number | null => {
      const direct = toNumber(financials.receitaTotal)
      if (direct !== null) return direct
      const totalRevenue = toNumber(annualIncome?.totalRevenue)
      if (totalRevenue !== null || isFinancial) return totalRevenue
      return toNumber(annualIncome?.operatingIncome)
    }

    const dividendYieldStats = toNumber(annualStats?.dividendYield)
    const currentValue: Record<string, () => number | null> = {
      pl: () => toNumber(financials.pl) ?? toNumber(annualStats?.forwardPE),
      pvp: () => toNumber(financials.pvp) ?? toNumber(annualStats?.priceToBook),
      // keyStatistics traz o DY em pontos percentuais; financialData, em fração
      dy: () => toNumber(financials.dy) ?? (dividendYieldStats !== null ? dividendYieldStats / 100 : null),
      margemLiquida,
      receitaTotal,
      lpa: () => toNumber(financials.lpa) ?? toNumber(annualStats?.trailingEps),
      vpa: () => toNumber(financials.vpa) ?? toNumber(annualStats?.bookValue),
    }

    const currentYear = new Date().getFullYear()

    return GROUPS.map((group) => ({
      title: group.title,
      items: group.items.map<IndicatorItem>((definition) => {
        const series: IndicatorYearValue[] = history
          .map((row) => ({ year: Number(row.year), value: toNumber(row[definition.field]) }))
          .filter((point): point is IndicatorYearValue => Number.isFinite(point.year) && point.value !== null)
          .sort((a, b) => a.year - b.year)
        const value = currentValue[definition.key]?.() ?? toNumber(financials[definition.field])
        return {
          key: definition.key,
          label: definition.label,
          format: definition.format,
          digits: definition.digits,
          better: definition.better,
          description: definition.description,
          reference: definition.reference,
          value,
          average: sevenYearAverage(series, currentYear),
          history: series,
        }
      }),
    }))
  }, [ticker, latestFinancials, comprehensiveData])

  return <IndicatorGrid groups={groups} ticker={ticker} />
}
