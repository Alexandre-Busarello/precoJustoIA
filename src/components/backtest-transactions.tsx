'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SectionHeader } from '@/components/ui/section-header'
import { formatMonthShort } from '@/components/portfolio-chart-parts'
import { EMPTY_VALUE, formatBRL, formatDate, formatNumber } from '@/lib/format'

interface BacktestTransaction {
  id: string
  month: number
  date: string
  ticker: string
  transactionType: 'CONTRIBUTION' | 'REBALANCE_BUY' | 'REBALANCE_SELL' | 'CASH_RESERVE' | 'CASH_CREDIT' | 'CASH_DEBIT' | 'DIVIDEND_PAYMENT' | 'DIVIDEND_REINVESTMENT'
  contribution: number
  price: number
  sharesAdded: number
  totalShares: number
  totalInvested: number
  cashReserved?: number | null
  dividendAmount?: number
  totalContribution: number
  portfolioValue: number
  cashBalance: number
}

interface BacktestTransactionsProps {
  transactions: BacktestTransaction[]
}

const PAGE_SIZE = 50
const ALL_MONTHS = 'all'

function typeLabel(type: string, ticker?: string): string {
  switch (type) {
    case 'CONTRIBUTION':
      return 'Aporte'
    case 'REBALANCE_BUY':
      return 'Rebalanceamento (aumento)'
    case 'REBALANCE_SELL':
      return 'Rebalanceamento (redução)'
    case 'DIVIDEND_PAYMENT':
      return 'Provento'
    case 'DIVIDEND_REINVESTMENT':
      return 'Reinvestimento de provento'
    case 'CASH_CREDIT':
      return 'Crédito em caixa'
    case 'CASH_DEBIT':
      return 'Débito em caixa'
    case 'CASH_RESERVE':
      return ticker === 'CASH_USED' ? 'Uso de caixa' : 'Reserva em caixa'
    default:
      return type
  }
}

/** Saída de caixa da transação (compra de ações ou débito do caixa). */
function debitOf(t: BacktestTransaction): number | null {
  if (t.ticker === 'CASH') return t.transactionType === 'CASH_DEBIT' ? Math.abs(t.contribution) : null
  if (t.transactionType === 'DIVIDEND_PAYMENT') return null
  return t.contribution > 0 ? t.contribution : null
}

/** Entrada no caixa (proventos, vendas de rebalanceamento ou crédito do caixa). */
function creditOf(t: BacktestTransaction): number | null {
  if (t.ticker === 'CASH') return t.transactionType === 'CASH_CREDIT' ? t.contribution : null
  if (t.transactionType === 'DIVIDEND_PAYMENT') return t.contribution
  if (t.transactionType === 'DIVIDEND_REINVESTMENT') return null
  return t.contribution < 0 ? Math.abs(t.contribution) : null
}

const isCashRow = (t: BacktestTransaction) => t.ticker === 'CASH' || t.ticker === 'CASH_USED'
const tickerLabel = (ticker: string) => (ticker === 'CASH' ? 'Caixa' : ticker === 'CASH_USED' ? 'Caixa usado' : ticker)

interface MonthSummary {
  month: number
  date: string
  totalContribution: number
  portfolioValue: number
  cashBalance: number
  cashUsed: number
  count: number
  hasRebalancing: boolean
}

export function BacktestTransactions({ transactions }: BacktestTransactionsProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(ALL_MONTHS)
  const [page, setPage] = useState(1)

  const byMonth = useMemo(() => {
    const groups = new Map<number, BacktestTransaction[]>()
    for (const t of transactions ?? []) {
      const list = groups.get(t.month) ?? []
      list.push(t)
      groups.set(t.month, list)
    }
    return groups
  }, [transactions])

  const months = useMemo(() => [...byMonth.keys()].sort((a, b) => a - b), [byMonth])

  const summaries: MonthSummary[] = useMemo(
    () =>
      months.map((month) => {
        const list = byMonth.get(month) ?? []
        return {
          month,
          date: String(list[0]?.date ?? ''),
          totalContribution: list[0]?.totalContribution || 0,
          portfolioValue: list[0]?.portfolioValue || 0,
          cashBalance: list[0]?.cashBalance || 0,
          cashUsed: list.filter((t) => t.ticker === 'CASH_USED').reduce((sum, t) => sum + Math.abs(t.cashReserved || 0), 0),
          count: list.length,
          hasRebalancing: list.some((t) => t.transactionType.includes('REBALANCE')),
        }
      }),
    [months, byMonth]
  )

  if (!transactions || transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Nenhuma transação disponível</p>
        <p className="mt-1 text-sm text-muted-foreground">Execute o backtest novamente para registrar as transações.</p>
      </div>
    )
  }

  const filtered = selectedMonth === ALL_MONTHS ? transactions : byMonth.get(Number(selectedMonth)) ?? []
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const transactionColumns: DataTableColumn<BacktestTransaction>[] = [
    { key: 'date', header: 'Data', sticky: true, cell: (t) => <span className="whitespace-nowrap tabular-nums">{formatDate(t.date)}</span> },
    { key: 'ticker', header: 'Ativo', cell: (t) => <span className="font-medium text-foreground">{tickerLabel(t.ticker)}</span> },
    {
      key: 'transactionType',
      header: 'Tipo',
      cell: (t) => <Badge variant="neutral">{typeLabel(t.transactionType, t.ticker)}</Badge>,
    },
    {
      key: 'debit',
      header: 'Saída',
      align: 'right',
      cell: (t) => {
        const value = debitOf(t)
        return value !== null && value > 0 ? formatBRL(-value) : EMPTY_VALUE
      },
    },
    {
      key: 'credit',
      header: 'Entrada',
      align: 'right',
      cell: (t) => {
        const value = creditOf(t)
        return value !== null && value > 0 ? formatBRL(value) : EMPTY_VALUE
      },
    },
    { key: 'price', header: 'Preço', align: 'right', cell: (t) => (isCashRow(t) ? EMPTY_VALUE : formatBRL(t.price)) },
    {
      key: 'sharesAdded',
      header: 'Qtd.',
      align: 'right',
      cell: (t) => {
        if (isCashRow(t)) return EMPTY_VALUE
        const shares = Math.floor(t.sharesAdded)
        return `${shares > 0 ? '+' : ''}${formatNumber(shares, { digits: 0 })}`
      },
    },
    {
      key: 'totalShares',
      header: 'Posição',
      align: 'right',
      cell: (t) => (isCashRow(t) ? EMPTY_VALUE : formatNumber(Math.floor(t.totalShares), { digits: 0 })),
    },
    { key: 'cashBalance', header: 'Saldo em caixa', align: 'right', cell: (t) => formatBRL(t.cashBalance) },
  ]

  const summaryColumns: DataTableColumn<MonthSummary>[] = [
    { key: 'date', header: 'Mês', sticky: true, cell: (s) => <span className="whitespace-nowrap">{s.date ? formatMonthShort(s.date) : `Mês ${s.month + 1}`}</span> },
    { key: 'totalContribution', header: 'Aporte', align: 'right', cell: (s) => formatBRL(s.totalContribution) },
    { key: 'portfolioValue', header: 'Valor da carteira', align: 'right', cell: (s) => formatBRL(s.portfolioValue) },
    { key: 'cashBalance', header: 'Saldo em caixa', align: 'right', cell: (s) => formatBRL(s.cashBalance) },
    { key: 'cashUsed', header: 'Caixa usado', align: 'right', cell: (s) => (s.cashUsed > 0 ? formatBRL(s.cashUsed) : EMPTY_VALUE) },
    { key: 'count', header: 'Transações', align: 'right' },
    { key: 'hasRebalancing', header: 'Rebalanceamento', cell: (s) => (s.hasRebalancing ? 'Sim' : EMPTY_VALUE) },
  ]

  return (
    <section aria-labelledby="backtest-transactions-title" className="space-y-4">
      <SectionHeader
        as="h3"
        id="backtest-transactions-title"
        title="Transações simuladas"
        description={`${formatNumber(transactions.length, { digits: 0 })} transações em ${months.length} meses`}
      />

      <Tabs defaultValue="transactions" className="gap-4">
        <TabsList>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="summary">Resumo por mês</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full space-y-1 sm:w-56">
              <Label htmlFor="backtest-transactions-month" className="text-xs font-normal text-muted-foreground">
                Mês
              </Label>
              <Select
                value={selectedMonth}
                onValueChange={(value) => {
                  setSelectedMonth(value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="backtest-transactions-month" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MONTHS}>Todos os meses</SelectItem>
                  {summaries.map((s) => (
                    <SelectItem key={s.month} value={String(s.month)}>
                      {s.date ? formatMonthShort(s.date) : `Mês ${s.month + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">{formatNumber(filtered.length, { digits: 0 })} transações</p>
          </div>

          <DataTable
            columns={transactionColumns}
            rows={pageRows}
            getRowId={(t, index) => t.id ?? `${t.month}-${t.ticker}-${t.transactionType}-${index}`}
            dense
            caption="Transações simuladas do backtest"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
                Anterior
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>
                Próxima
                <ChevronRight strokeWidth={1.75} aria-hidden="true" />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary">
          <DataTable
            columns={summaryColumns}
            rows={summaries}
            getRowId={(s) => String(s.month)}
            dense
            maxHeight={560}
            caption="Resumo das transações por mês"
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
