'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Receipt, TrendingUp, Calendar, DollarSign } from 'lucide-react'

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
  dividendAmount?: number // Valor de dividendos (apenas para DIVIDEND_PAYMENT)
  totalContribution: number
  portfolioValue: number
  cashBalance: number
}

interface BacktestTransactionsProps {
  transactions: BacktestTransaction[]
}

export function BacktestTransactions({ transactions }: BacktestTransactionsProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const itemsPerPage = 20

  // Paginação do resumo por mês (12 meses por página, equivalente a 1 ano)
  const [summaryPage, setSummaryPage] = useState(1)
  const summaryItemsPerPage = 12

  // Ref para scroll automático
  const transactionsTableRef = useRef<HTMLDivElement>(null);
  const summaryTableRef = useRef<HTMLDivElement>(null);

  // Debug: verificar se as transações estão chegando
  console.log('🔍 BacktestTransactions - Transações recebidas:', transactions?.length || 0);
  console.log('📋 Primeira transação:', transactions?.[0] || 'Nenhuma');

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Histórico de Transações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-500">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Nenhuma transação disponível</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Agrupar transações por mês
  const transactionsByMonth = transactions.reduce((acc, transaction) => {
    if (!acc[transaction.month]) {
      acc[transaction.month] = []
    }
    acc[transaction.month].push(transaction)
    return acc
  }, {} as Record<number, BacktestTransaction[]>)

  const months = Object.keys(transactionsByMonth).map(Number).sort((a, b) => a - b)
  
  // Filtrar transações para exibição
  const filteredTransactions = selectedMonth !== null 
    ? transactionsByMonth[selectedMonth] || []
    : transactions

  // Paginação
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  // Paginação do resumo por mês
  const summaryTotalPages = Math.ceil(months.length / summaryItemsPerPage)
  const summaryStartIndex = (summaryPage - 1) * summaryItemsPerPage
  const summaryEndIndex = summaryStartIndex + summaryItemsPerPage
  const paginatedMonths = months.slice(summaryStartIndex, summaryEndIndex)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

const getTransactionTypeInfo = (type: string, ticker?: string) => {
  switch (type) {
    case 'CONTRIBUTION':
      return { label: 'Aporte', color: 'bg-green-100 text-green-800', icon: '💰' }
    case 'REBALANCE_BUY':
      return { label: 'Compra (Rebal.)', color: 'bg-blue-100 text-blue-800', icon: '🔄' }
    case 'REBALANCE_SELL':
      return { label: 'Venda (Rebal.)', color: 'bg-orange-100 text-orange-800', icon: '🔄' }
    case 'DIVIDEND_PAYMENT':
      return { label: 'Dividendos', color: 'bg-emerald-100 text-emerald-800', icon: '💎' }
    case 'DIVIDEND_REINVESTMENT':
      return { label: 'Reinvest. Dividendo', color: 'bg-purple-100 text-purple-800', icon: '💎' }
    case 'CASH_CREDIT':
      return { label: 'Crédito Caixa', color: 'bg-green-100 text-green-800', icon: '🏦💰' }
    case 'CASH_DEBIT':
      return { label: 'Débito Caixa', color: 'bg-red-100 text-red-800', icon: '🏦📤' }
    case 'CASH_RESERVE':
      if (ticker === 'CASH_USED') {
        return { label: 'Uso de Caixa', color: 'bg-red-100 text-red-800', icon: '🏦📤' }
      }
      return { label: 'Reserva Caixa', color: 'bg-gray-100 text-gray-800', icon: '🏦' }
    default:
      return { label: type, color: 'bg-gray-100 text-gray-800', icon: '❓' }
  }
}

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
      // Scroll para a área da paginação após mudança de página
      setTimeout(() => {
        transactionsTableRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      // Scroll para a área da paginação após mudança de página
      setTimeout(() => {
        transactionsTableRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    // Scroll para a área da paginação após mudança de página
    setTimeout(() => {
      transactionsTableRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  }

  const handleMonthFilter = (month: number | null) => {
    setSelectedMonth(month)
    setCurrentPage(1) // Reset para primeira página
  }

  const goToNextSummaryPage = () => {
    if (summaryPage < summaryTotalPages) {
      setSummaryPage(summaryPage + 1)
      setTimeout(() => {
        summaryTableRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }

  const goToPreviousSummaryPage = () => {
    if (summaryPage > 1) {
      setSummaryPage(summaryPage - 1)
      setTimeout(() => {
        summaryTableRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }

  const goToSummaryPage = (page: number) => {
    setSummaryPage(page)
    setTimeout(() => {
      summaryTableRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Histórico de Transações
        </CardTitle>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredTransactions.length} transações • {months.length} meses
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Transações Detalhadas</span>
              <span className="sm:hidden">Detalhes</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Resumo por Mês</span>
              <span className="sm:hidden">Resumo</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions" className="space-y-4">
            {/* Filtros - scroll horizontal no mobile */}
            <div className="overflow-x-auto pb-2 -mx-1 px-1">
              <div className="flex gap-2 min-w-max">
                <Button
                  variant={selectedMonth === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthFilter(null)}
                  className="flex-shrink-0"
                >
                  Todos os Meses
                </Button>
                {months.map(month => (
                  <Button
                    key={month}
                    variant={selectedMonth === month ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleMonthFilter(month)}
                    className="flex-shrink-0"
                  >
                    Mês {month === 0 ? month + 1 : month}
                  </Button>
                ))}
              </div>
            </div>

            {/* Wrapper para scroll - ref visível em mobile e desktop */}
            <div ref={transactionsTableRef}>
            {/* Layout Mobile: Cards */}
            <div className="md:hidden space-y-3">
              {paginatedTransactions.map((transaction) => {
                const typeInfo = getTransactionTypeInfo(transaction.transactionType, transaction.ticker)
                const debitValue = transaction.ticker === 'CASH'
                  ? (transaction.transactionType === 'CASH_DEBIT' ? Math.abs(transaction.contribution) : null)
                  : (transaction.transactionType !== 'DIVIDEND_PAYMENT' && transaction.contribution > 0 ? transaction.contribution : null)
                const creditValue = transaction.ticker === 'CASH'
                  ? (transaction.transactionType === 'CASH_CREDIT' ? transaction.contribution : null)
                  : (transaction.transactionType === 'DIVIDEND_PAYMENT' ? transaction.contribution : (transaction.contribution < 0 ? Math.abs(transaction.contribution) : null))
                return (
                  <Card key={transaction.id} className="overflow-hidden">
                    <CardContent className="p-3 sm:p-4 space-y-3">
                      {/* Data em linha própria para evitar sobreposição */}
                      <div className="text-xs text-gray-500">
                        {formatDate(transaction.date)}
                      </div>
                      {/* Tipo e ativo - podem quebrar linha sem sobrepor */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg flex-shrink-0">{typeInfo.icon}</span>
                        <Badge className={`${typeInfo.color} text-xs flex-shrink-0`}>
                          {typeInfo.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{transaction.ticker}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                        {(debitValue !== null && debitValue > 0) && (
                          <div>
                            <span className="text-gray-500">Débito:</span>
                            <span className="font-mono text-red-600 ml-1">{formatCurrency(debitValue)}</span>
                          </div>
                        )}
                        {(creditValue !== null && creditValue > 0) && (
                          <div>
                            <span className="text-gray-500">Crédito:</span>
                            <span className="font-mono text-green-600 ml-1">{formatCurrency(creditValue)}</span>
                          </div>
                        )}
                        {transaction.ticker !== 'CASH' && transaction.price > 0 && (
                          <div>
                            <span className="text-gray-500">Preço:</span>
                            <span className="font-mono ml-1">{formatCurrency(transaction.price)}</span>
                          </div>
                        )}
                        {transaction.ticker !== 'CASH' && transaction.sharesAdded !== 0 && (
                          <div>
                            <span className="text-gray-500">Ações:</span>
                            <span className={`font-mono ml-1 ${transaction.sharesAdded >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {transaction.sharesAdded >= 0 ? '+' : ''}{Math.floor(transaction.sharesAdded)}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-gray-500">Saldo Caixa:</span>
                          <span className="font-semibold text-blue-600 ml-1">{formatCurrency(transaction.cashBalance)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Layout Desktop: Tabela */}
            <div className="hidden md:block relative">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Ativo</th>
                    <th className="text-right p-3">Débito</th>
                    <th className="text-right p-3">Crédito</th>
                    <th className="text-right p-3">Preço</th>
                    <th className="text-right p-3">Ações</th>
                    <th className="text-right p-3">Total Ações</th>
                    <th className="text-right p-3">Saldo Caixa</th>
                  </tr>
                </thead>
                <tbody>
                            {paginatedTransactions.map((transaction) => {
                              const typeInfo = getTransactionTypeInfo(transaction.transactionType, transaction.ticker);
                              return (
                                <tr key={transaction.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(transaction.date)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{typeInfo.icon}</span>
                            <Badge className={`${typeInfo.color} text-xs`}>
                              {typeInfo.label}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{transaction.ticker}</Badge>
                        </td>
                        {/* Débito (saída de caixa) */}
                        <td className="text-right p-3 font-mono">
                          {transaction.ticker === 'CASH' ? (
                            transaction.transactionType === 'CASH_DEBIT' ? (
                              <span className="text-red-600">{formatCurrency(Math.abs(transaction.contribution))}</span>
                            ) : '-'
                          ) : (
            // Dividendos pagos não são débitos, mas reinvestidos são compras (débitos)
            transaction.transactionType === 'DIVIDEND_PAYMENT' ? '-' : (
              transaction.contribution > 0 ? (
                <span className="text-red-600">{formatCurrency(transaction.contribution)}</span>
              ) : '-'
            )
                          )}
                        </td>
                        {/* Crédito (entrada no caixa) */}
                        <td className="text-right p-3 font-mono">
                          {transaction.ticker === 'CASH' ? (
                            transaction.transactionType === 'CASH_CREDIT' ? (
                              <span className="text-green-600">{formatCurrency(transaction.contribution)}</span>
                            ) : '-'
                          ) : (
            // Dividendos pagos são créditos no caixa, reinvestidos são débitos (compras)
            transaction.transactionType === 'DIVIDEND_PAYMENT' ? (
              <span className="text-green-600">{formatCurrency(transaction.contribution)}</span>
            ) : transaction.transactionType === 'DIVIDEND_REINVESTMENT' ? '-' : (
              transaction.contribution < 0 ? (
                <span className="text-green-600">{formatCurrency(Math.abs(transaction.contribution))}</span>
              ) : '-'
            )
                          )}
                        </td>
                        <td className="text-right p-3 font-mono">
                          {transaction.ticker === 'CASH' ? '-' : formatCurrency(transaction.price)}
                        </td>
                        <td className={`text-right p-3 font-mono ${transaction.sharesAdded >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.ticker === 'CASH' ? '-' : 
                            `${transaction.sharesAdded >= 0 ? '+' : ''}${Math.floor(transaction.sharesAdded)}`
                          }
                        </td>
                        <td className="text-right p-3 font-mono">
                          {transaction.ticker === 'CASH' ? '-' : Math.floor(transaction.totalShares).toLocaleString()}
                        </td>
                        <td className="text-right p-3 font-mono">
                          <span className="font-semibold text-blue-600">
                            {formatCurrency(transaction.cashBalance)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              {/* Indicador de scroll horizontal (telas menores dentro do breakpoint md) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent lg:hidden"
              />
            </div>
            <p className="mt-2 text-xs text-center text-muted-foreground lg:hidden">
              ⟷ arraste para o lado para ver mais colunas
            </p>
            </div>

            {/* Controles de Paginação */}
            {totalPages > 1 && (
              <div className="mt-6 pt-4 border-t space-y-3">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                  <span className="block sm:inline">Página {currentPage} de {totalPages}</span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">Mostrando {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} de {filteredTransactions.length} transações</span>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                  {/* Primeira página */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                    title="Primeira página"
                  >
                    <span className="text-xs sm:text-sm">««</span>
                    <span className="hidden lg:inline text-xs">Início</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages <= 3 ? totalPages : 3, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 3) {
                        pageNum = i + 1
                      } else if (currentPage <= 2) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 1) {
                        pageNum = totalPages - 2 + i
                      } else {
                        pageNum = currentPage - 1 + i
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNum)}
                          className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  
                  {/* Última página */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                    title="Última página"
                  >
                    <span className="hidden lg:inline text-xs">Fim</span>
                    <span className="text-xs sm:text-sm">»»</span>
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {months.length} {months.length === 1 ? 'mês' : 'meses'} no total
            </div>
            <div ref={summaryTableRef} className="grid gap-4">
              {paginatedMonths.map(month => {
                const monthTransactions = transactionsByMonth[month]
                const totalContribution = monthTransactions[0]?.totalContribution || 0
                const portfolioValue = monthTransactions[0]?.portfolioValue || 0
                const cashBalance = monthTransactions[0]?.cashBalance || 0
                const transactionCount = monthTransactions.length
                            const hasRebalancing = monthTransactions.some(t => t.transactionType.includes('REBALANCE'))
                            const hasCashReserve = monthTransactions.some(t => t.transactionType === 'CASH_RESERVE' && t.ticker === 'CASH')
                            const hasCashUsage = monthTransactions.some(t => t.ticker === 'CASH_USED')
                            const cashUsed = monthTransactions
                              .filter(t => t.ticker === 'CASH_USED')
                              .reduce((sum, t) => sum + Math.abs(t.cashReserved || 0), 0)
                
                return (
                  <Card key={month}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Mês {month + 1}</CardTitle>
                        <Badge variant="secondary">{transactionCount} transações</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <DollarSign className="w-4 h-4" />
                            Aporte Total
                          </div>
                          <div className="font-semibold text-lg">
                            {formatCurrency(totalContribution)}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <TrendingUp className="w-4 h-4" />
                            Valor da Carteira
                          </div>
                          <div className="font-semibold text-lg">
                            {formatCurrency(portfolioValue)}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            🏦 Saldo em Caixa
                          </div>
                          <div className="font-semibold text-lg">
                            {formatCurrency(cashBalance)}
                          </div>
                        </div>
                        {hasCashUsage && (
                          <div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              🏦📤 Caixa Usado
                            </div>
                            <div className="font-semibold text-lg text-red-600">
                              {formatCurrency(cashUsed)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Receipt className="w-4 h-4" />
                            Data
                          </div>
                          <div className="font-semibold">
                            {formatDate(monthTransactions[0]?.date || '')}
                          </div>
                        </div>
                      </div>
                      
                      {/* Indicadores de atividade */}
                      <div className="mt-4 flex gap-2">
                        {hasRebalancing && (
                          <Badge className="bg-blue-100 text-blue-800">
                            🔄 Rebalanceamento
                          </Badge>
                        )}
                        {hasCashReserve && (
                          <Badge className="bg-gray-100 text-gray-800">
                            🏦 Reserva em Caixa
                          </Badge>
                        )}
                        {hasCashUsage && (
                          <Badge className="bg-red-100 text-red-800">
                            🏦📤 Uso de Caixa: {formatCurrency(cashUsed)}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Lista de ativos transacionados */}
                      <div className="mt-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ativos transacionados:</div>
                        <div className="flex flex-wrap gap-2">
                          {monthTransactions.map(transaction => {
                            const typeInfo = getTransactionTypeInfo(transaction.transactionType, transaction.ticker);
                            return (
                              <Badge key={`${month}-${transaction.ticker}-${transaction.transactionType}`} 
                                     className={`${typeInfo.color} text-xs`}>
                                {typeInfo.icon} {transaction.ticker === 'CASH_USED' ? 'CAIXA USADO' : transaction.ticker}: {
                                  transaction.ticker === 'CASH' 
                                    ? formatCurrency(transaction.cashBalance)
                                    : transaction.ticker === 'CASH_USED'
                                    ? formatCurrency(Math.abs(transaction.cashReserved || 0))
                                    : formatCurrency(transaction.contribution)
                                }
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Controles de Paginação do Resumo (1 página = até 12 meses) */}
            {summaryTotalPages > 1 && (
              <div className="mt-6 pt-4 border-t space-y-3">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                  <span className="block sm:inline">Página {summaryPage} de {summaryTotalPages}</span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">Mostrando meses {summaryStartIndex + 1}-{Math.min(summaryEndIndex, months.length)} de {months.length}</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                  {/* Primeira página */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToSummaryPage(1)}
                    disabled={summaryPage === 1}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                    title="Primeira página"
                  >
                    <span className="text-xs sm:text-sm">««</span>
                    <span className="hidden lg:inline text-xs">Início</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousSummaryPage}
                    disabled={summaryPage === 1}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(summaryTotalPages <= 3 ? summaryTotalPages : 3, summaryTotalPages) }, (_, i) => {
                      let pageNum
                      if (summaryTotalPages <= 3) {
                        pageNum = i + 1
                      } else if (summaryPage <= 2) {
                        pageNum = i + 1
                      } else if (summaryPage >= summaryTotalPages - 1) {
                        pageNum = summaryTotalPages - 2 + i
                      } else {
                        pageNum = summaryPage - 1 + i
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={summaryPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToSummaryPage(pageNum)}
                          className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextSummaryPage}
                    disabled={summaryPage === summaryTotalPages}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>

                  {/* Última página */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToSummaryPage(summaryTotalPages)}
                    disabled={summaryPage === summaryTotalPages}
                    className="flex items-center gap-1 h-8 px-2 sm:px-3"
                    title="Última página"
                  >
                    <span className="hidden lg:inline text-xs">Fim</span>
                    <span className="text-xs sm:text-sm">»»</span>
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
