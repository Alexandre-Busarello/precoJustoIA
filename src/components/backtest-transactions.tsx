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
  
  // Ref para scroll automático
  const transactionsTableRef = useRef<HTMLDivElement>(null);

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
            <TabsTrigger value="transactions">Transações Detalhadas</TabsTrigger>
            <TabsTrigger value="summary">Resumo por Mês</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions" className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={selectedMonth === null ? "default" : "outline"}
                size="sm"
                onClick={() => handleMonthFilter(null)}
              >
                Todos os Meses
              </Button>
              {months.map(month => (
                <Button
                  key={month}
                  variant={selectedMonth === month ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthFilter(month)}
                >
                  Mês {month}
                </Button>
              ))}
            </div>

            {/* Tabela de Transações */}
            <div ref={transactionsTableRef} className="overflow-x-auto">
              <table className="w-full text-sm">
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

            {/* Controles de Paginação */}
            {totalPages > 1 && (
              <div className="mt-6 pt-4 border-t space-y-3">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                  <span className="block sm:inline">Página {currentPage} de {totalPages}</span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">Mostrando {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} de {filteredTransactions.length} transações</span>
                </div>
                
                <div className="flex items-center justify-center gap-1 sm:gap-2">
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
            <div className="grid gap-4">
              {months.map(month => {
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
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
