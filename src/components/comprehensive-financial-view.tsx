'use client'

import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { formatCompact } from '@/lib/format'

interface ComprehensiveFinancialViewProps {
  data: {
    company: {
      ticker: string
      name: string
      sector: string | null
      industry: string | null
    }
    financialData: Record<string, unknown>[]
    balanceSheets: Record<string, unknown>[]
    incomeStatements: Record<string, unknown>[]
    cashflowStatements: Record<string, unknown>[]
    keyStatistics: Record<string, unknown>[]
    valueAddedStatements: Record<string, unknown>[]
  }
}

type Statement = Record<string, unknown>

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

function statementYear(statement: Statement): number | null {
  const year = new Date(statement.endDate as string).getFullYear()
  return Number.isFinite(year) ? year : null
}

interface LineDefinition {
  key: string
  label: string
  value: (statement: Statement) => number | null
}

interface StatementRow {
  key: string
  label: string
  values: Record<number, number | null>
}

const MAX_YEARS = 7

const INCOME_LINES: LineDefinition[] = [
  // Bancos e seguradoras não informam receita total: usa o resultado operacional como receita
  { key: 'revenue', label: 'Receita líquida', value: (s) => toNumber(s.totalRevenue) ?? toNumber(s.operatingIncome) },
  { key: 'grossProfit', label: 'Lucro bruto', value: (s) => toNumber(s.grossProfit) },
  { key: 'ebit', label: 'EBIT', value: (s) => toNumber(s.ebit) },
  { key: 'incomeBeforeTax', label: 'Lucro antes dos impostos', value: (s) => toNumber(s.incomeBeforeTax) },
  { key: 'netIncome', label: 'Lucro líquido', value: (s) => toNumber(s.netIncome) },
]

const BALANCE_LINES: LineDefinition[] = [
  { key: 'totalAssets', label: 'Ativo total', value: (s) => toNumber(s.totalAssets) },
  { key: 'currentAssets', label: 'Ativo circulante', value: (s) => toNumber(s.totalCurrentAssets) },
  { key: 'cash', label: 'Caixa e equivalentes', value: (s) => toNumber(s.cash) },
  { key: 'totalLiab', label: 'Passivo total', value: (s) => toNumber(s.totalLiab) },
  { key: 'currentLiab', label: 'Passivo circulante', value: (s) => toNumber(s.totalCurrentLiabilities) },
  { key: 'equity', label: 'Patrimônio líquido', value: (s) => toNumber(s.totalStockholderEquity) },
]

const CASHFLOW_LINES: LineDefinition[] = [
  { key: 'operating', label: 'Fluxo de caixa operacional', value: (s) => toNumber(s.operatingCashFlow) },
  { key: 'investment', label: 'Fluxo de caixa de investimento', value: (s) => toNumber(s.investmentCashFlow) },
  { key: 'financing', label: 'Fluxo de caixa de financiamento', value: (s) => toNumber(s.financingCashFlow) },
  { key: 'change', label: 'Variação do caixa', value: (s) => toNumber(s.increaseOrDecreaseInCash) },
]

/** Transpõe as demonstrações: uma linha por conta, uma coluna por ano (mais recente primeiro). Contas sem nenhum valor saem. */
function buildTable(statements: Statement[], lines: LineDefinition[]): { years: number[]; rows: StatementRow[] } {
  const byYear = new Map<number, Statement>()
  for (const statement of statements) {
    const year = statementYear(statement)
    if (year !== null && !byYear.has(year)) byYear.set(year, statement)
  }
  const years = [...byYear.keys()].sort((a, b) => b - a).slice(0, MAX_YEARS)
  const rows = lines
    .map((line) => ({
      key: line.key,
      label: line.label,
      values: Object.fromEntries(years.map((year) => [year, line.value(byYear.get(year)!)])) as Record<number, number | null>,
    }))
    .filter((row) => years.some((year) => row.values[year] !== null))
  return { years, rows }
}

function StatementTable({ statements, lines, caption }: { statements: Statement[]; lines: LineDefinition[]; caption: string }) {
  const { years, rows } = useMemo(() => buildTable(statements, lines), [statements, lines])

  const columns: DataTableColumn<StatementRow>[] = [
    {
      key: 'label',
      header: 'Conta',
      width: 140,
      className: 'w-[140px] min-w-[140px] whitespace-normal leading-5 text-foreground',
      headerClassName: 'w-[140px] min-w-[140px]',
    },
    ...years.map<DataTableColumn<StatementRow>>((year) => ({
      key: String(year),
      header: String(year),
      align: 'right',
      className: 'whitespace-nowrap text-foreground',
      cell: (row) => formatCompact(row.values[year]),
    })),
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.key}
      stickyFirstColumn
      dense
      caption={caption}
      empty={{ title: 'Demonstração indisponível', description: 'Ainda não há dados anuais importados para esta demonstração.' }}
    />
  )
}

/** Demonstrações financeiras anuais (DRE, balanço e fluxo de caixa) em tabela com a coluna de contas fixa. */
export default function ComprehensiveFinancialView({ data }: ComprehensiveFinancialViewProps) {
  const { company, financialData, balanceSheets, incomeStatements, cashflowStatements } = data
  const isFinancialSector = Boolean(financialData[0]?._hasFinancialFallbacks)

  return (
    <Tabs defaultValue="income" className="gap-3">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="income">DRE</TabsTrigger>
        <TabsTrigger value="balance">Balanço</TabsTrigger>
        <TabsTrigger value="cashflow">Fluxo de caixa</TabsTrigger>
      </TabsList>
      <TabsContent value="income">
        <StatementTable statements={incomeStatements} lines={INCOME_LINES} caption={`DRE anual de ${company.ticker}`} />
      </TabsContent>
      <TabsContent value="balance">
        <StatementTable statements={balanceSheets} lines={BALANCE_LINES} caption={`Balanço patrimonial anual de ${company.ticker}`} />
      </TabsContent>
      <TabsContent value="cashflow">
        <StatementTable
          statements={cashflowStatements}
          lines={CASHFLOW_LINES}
          caption={`Fluxo de caixa anual de ${company.ticker}`}
        />
      </TabsContent>
      <p className="text-xs text-muted-foreground">
        Valores em reais (mi = milhões, bi = bilhões, tri = trilhões).
        {isFinancialSector && ' Instituição financeira: receita e margens seguem a estrutura contábil de bancos e seguradoras.'}
      </p>
    </Tabs>
  )
}
