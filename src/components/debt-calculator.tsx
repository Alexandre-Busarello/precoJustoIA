'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Info, Edit, Trash2, CheckSquare, Square } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { DebtForm, DebtFormData } from './debt-form'
import { RentabilitySelector, StrategySource } from './rentability-selector'
import { SimulationChart } from './simulation-chart'
import { SimulationSummary } from './simulation-summary'
import { AIAnalysisSection } from './ai-analysis-section'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DebtCalculatorProps {
  isPublic?: boolean
  initialDebtId?: string
}

export function DebtCalculator({ isPublic = false, initialDebtId }: DebtCalculatorProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { isPremium } = usePremiumStatus()
  
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDebts, setIsLoadingDebts] = useState(false)
  const [showDebtForm, setShowDebtForm] = useState(false)
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [debts, setDebts] = useState<any[]>([])
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>(initialDebtId ? [initialDebtId] : [])
  const [simulationResults, setSimulationResults] = useState<any>(null)
  const isLoadingDebtsRef = useRef(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  
  // Formulário de simulação (modo visitante ou com dívida selecionada)
  const [debtData, setDebtData] = useState<Partial<DebtFormData>>({
    name: '',
    balance: 0,
    interestRateAnnual: 0,
    termMonths: 0,
    monthlyPayment: 0,
    amortizationSystem: 'SAC'
  })
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [investmentSplit, setInvestmentSplit] = useState(0)
  const [monthlyTR, setMonthlyTR] = useState(0.001) // TR padrão 0,1% (0.001)
  const [strategyType, setStrategyType] = useState<StrategySource>('FIXED_RATE')
  const [manualRate, setManualRate] = useState(0.10)
  const [portfolioId, setPortfolioId] = useState<string | undefined>()
  const [rankingId, setRankingId] = useState<string | undefined>()
  const [manualTickers, setManualTickers] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [portfolios, setPortfolios] = useState<Array<{ id: string; name: string }>>([])
  const [isLoadingPortfolios, setIsLoadingPortfolios] = useState(false)

  // Callback memoizado para atualizar dados da dívida (evita loops infinitos)
  const handleDebtDataChange = useCallback((data: DebtFormData) => {
    setDebtData((prevData) => {
      // Só atualizar se realmente mudou
      if (JSON.stringify(prevData) === JSON.stringify(data)) {
        return prevData
      }
      return data
    })
    // Limpar erros relacionados quando dados são atualizados
    setFieldErrors((prevErrors) => {
      const newErrors = { ...prevErrors }
      if (data.balance > 0) delete newErrors.balance
      if (data.monthlyPayment > 0) delete newErrors.monthlyPayment
      if (data.interestRateAnnual >= 0) delete newErrors.interestRateAnnual
      // Só atualizar se realmente mudou
      if (JSON.stringify(prevErrors) === JSON.stringify(newErrors)) {
        return prevErrors
      }
      return newErrors
    })
  }, [])

  const loadDebts = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas usando ref
    if (isLoadingDebtsRef.current) {
      return
    }
    
    isLoadingDebtsRef.current = true
    setIsLoadingDebts(true)
    try {
      const response = await fetch('/api/debt')
      if (response.ok) {
        const data = await response.json()
        setDebts(data.debts || [])
      }
    } catch (error) {
      console.error('Erro ao carregar dívidas:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar suas dívidas',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingDebts(false)
      isLoadingDebtsRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carregar carteiras
  const loadPortfolios = useCallback(async () => {
    if (!session || isPublic) return
    
    setIsLoadingPortfolios(true)
    try {
      const response = await fetch('/api/portfolio')
      if (response.ok) {
        const data = await response.json()
        setPortfolios((data.portfolios || []).map((p: any) => ({
          id: p.id,
          name: p.name
        })))
      }
    } catch (error) {
      console.error('Erro ao carregar carteiras:', error)
    } finally {
      setIsLoadingPortfolios(false)
    }
  }, [session, isPublic])

  // Carregar dívidas se logado (apenas uma vez quando componente monta ou quando session/isPublic mudam)
  useEffect(() => {
    if (session && !isPublic && !isLoadingDebtsRef.current) {
      loadDebts()
      loadPortfolios()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, isPublic])

  // Atualizar dados quando seleção mudar
  useEffect(() => {
    // Não atualizar se ainda está carregando dívidas
    if (isLoadingDebts) {
      return
    }

    if (selectedDebtIds.length === 0) {
      // Limpar dados se nenhuma dívida selecionada
      setDebtData({
        name: '',
        balance: 0,
        interestRateAnnual: 0,
        termMonths: 0,
        monthlyPayment: 0,
        amortizationSystem: 'SAC'
      })
      return
    }

    const selectedDebts = debts.filter(d => selectedDebtIds.includes(d.id))
    if (selectedDebts.length === 0) {
      return
    }

    // Agregar dados: somar saldos e prestações, calcular taxa média ponderada
    const totalBalance = selectedDebts.reduce((sum, d) => sum + Number(d.balance), 0)
    const totalMonthlyPayment = selectedDebts.reduce((sum, d) => sum + Number(d.monthlyPayment), 0)
    
    // Taxa média ponderada pelo saldo
    const weightedRate = totalBalance > 0 
      ? selectedDebts.reduce((sum, d) => {
          return sum + (Number(d.interestRateAnnual) * Number(d.balance))
        }, 0) / totalBalance
      : 0

    const aggregatedData = {
      name: selectedDebts.length === 1 ? selectedDebts[0].name : `Múltiplas Dívidas (${selectedDebts.length})`,
      balance: totalBalance,
      monthlyPayment: totalMonthlyPayment,
      interestRateAnnual: weightedRate,
      termMonths: Math.max(...selectedDebts.map(d => d.termMonths)),
      amortizationSystem: selectedDebts[0].amortizationSystem as 'SAC' | 'PRICE'
    }

    setDebtData({
      name: aggregatedData.name,
      balance: aggregatedData.balance,
      interestRateAnnual: aggregatedData.interestRateAnnual,
      termMonths: aggregatedData.termMonths,
      monthlyPayment: aggregatedData.monthlyPayment,
      amortizationSystem: aggregatedData.amortizationSystem
    })

    // Se apenas uma dívida selecionada, carregar configuração dela
    if (selectedDebtIds.length === 1) {
      const selectedDebt = selectedDebts[0]
      if (selectedDebt?.simulationConfig) {
        setMonthlyBudget(selectedDebt.simulationConfig.monthlyBudget)
        setInvestmentSplit(selectedDebt.simulationConfig.investmentSplit)
        setMonthlyTR(selectedDebt.simulationConfig.monthlyTR ?? 0.001) // TR padrão 0,1%
        setStrategyType(selectedDebt.simulationConfig.strategyType as StrategySource)
        setManualRate(selectedDebt.simulationConfig.manualRateFixed || 0.10)
      }
    }
  }, [selectedDebtIds, debts, isLoadingDebts])

  const handleSaveDebt = async (data: DebtFormData) => {
    if (!session) {
      toast({
        title: 'Login necessário',
        description: 'Faça login para salvar suas dívidas',
        variant: 'default'
      })
      router.push('/auth/signin')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Dívida salva com sucesso'
        })
        setShowDebtForm(false)
        loadDebts()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar')
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateDebt = async (data: DebtFormData) => {
    if (!session || !editingDebtId) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/debt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDebtId,
          ...data
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Sucesso',
          description: 'Dívida atualizada com sucesso'
        })
        setEditingDebtId(null)
        setShowDebtForm(false)
        await loadDebts()
        // Se estava selecionada, atualizar dados
        if (selectedDebtIds.includes(editingDebtId) && result.debt) {
          // Recarregar lista para atualizar dados
          await loadDebts()
        }
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar')
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteDebt = async (debtId: string) => {
    if (!session) {
      return
    }

    if (!confirm('Tem certeza que deseja excluir esta dívida?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/debt?id=${debtId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Dívida excluída com sucesso'
        })
        // Remover da seleção se estava selecionada
        setSelectedDebtIds(prev => prev.filter(id => id !== debtId))
        loadDebts()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao excluir')
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditDebt = (debt: any) => {
    setEditingDebtId(debt.id)
    setDebtData({
      name: debt.name,
      balance: debt.balance,
      interestRateAnnual: debt.interestRateAnnual,
      termMonths: debt.termMonths,
      monthlyPayment: debt.monthlyPayment,
      amortizationSystem: debt.amortizationSystem
    })
    setShowDebtForm(true)
  }

  const handleToggleDebtSelection = (debtId: string) => {
    setSelectedDebtIds(prev => {
      if (prev.includes(debtId)) {
        return prev.filter(id => id !== debtId)
      } else {
        return [...prev, debtId]
      }
    })
    // Fechar formulário de edição se estiver aberto
    if (showDebtForm) {
      setShowDebtForm(false)
      setEditingDebtId(null)
    }
  }

  const handleSelectAllDebts = () => {
    if (selectedDebtIds.length === debts.length) {
      // Desmarcar todas
      setSelectedDebtIds([])
    } else {
      // Marcar todas
      setSelectedDebtIds(debts.map(d => d.id))
    }
    // Fechar formulário de edição se estiver aberto
    if (showDebtForm) {
      setShowDebtForm(false)
      setEditingDebtId(null)
    }
  }

  // Calcular dados agregados das dívidas selecionadas
  const getAggregatedDebtData = () => {
    if (selectedDebtIds.length === 0) {
      return null
    }

    const selectedDebts = debts.filter(d => selectedDebtIds.includes(d.id))
    if (selectedDebts.length === 0) {
      return null
    }

    // Agregar dados: somar saldos e prestações, calcular taxa média ponderada
    const totalBalance = selectedDebts.reduce((sum, d) => sum + Number(d.balance), 0)
    const totalMonthlyPayment = selectedDebts.reduce((sum, d) => sum + Number(d.monthlyPayment), 0)
    
    // Taxa média ponderada pelo saldo
    const weightedRate = totalBalance > 0
      ? selectedDebts.reduce((sum, d) => {
          return sum + (Number(d.interestRateAnnual) * Number(d.balance))
        }, 0) / totalBalance
      : selectedDebts.reduce((sum, d) => sum + Number(d.interestRateAnnual), 0) / selectedDebts.length

    const names = selectedDebts.map(d => d.name).join(', ')

    return {
      name: selectedDebts.length === 1 ? selectedDebts[0].name : `Múltiplas Dívidas (${selectedDebts.length})`,
      balance: totalBalance,
      monthlyPayment: totalMonthlyPayment,
      interestRateAnnual: weightedRate,
      termMonths: Math.max(...selectedDebts.map(d => d.termMonths)), // Maior prazo
      amortizationSystem: selectedDebts[0].amortizationSystem as 'SAC' | 'PRICE',
      debtIds: selectedDebtIds,
      allNames: names
    }
  }

  const handleRunSimulation = async () => {
    // Obter dados agregados se houver dívidas selecionadas
    const aggregatedData = getAggregatedDebtData()
    const effectiveDebtData = aggregatedData || debtData
    
    // Validação detalhada dos campos obrigatórios
    const missingFields: string[] = []
    
    // Validar dados da dívida (usar dados agregados se houver seleção múltipla)
    if (effectiveDebtData.balance === undefined || effectiveDebtData.balance === null || effectiveDebtData.balance <= 0) {
      missingFields.push('Saldo Devedor')
    }
    if (effectiveDebtData.monthlyPayment === undefined || effectiveDebtData.monthlyPayment === null || effectiveDebtData.monthlyPayment <= 0) {
      missingFields.push('Prestação Mensal')
    }
    if (effectiveDebtData.interestRateAnnual === undefined || effectiveDebtData.interestRateAnnual === null || effectiveDebtData.interestRateAnnual < 0) {
      missingFields.push('Taxa de Juros Anual')
    }
    
    // Validar configuração de simulação
    if (monthlyBudget === undefined || monthlyBudget === null || monthlyBudget <= 0) {
      missingFields.push('Orçamento Mensal Total')
    }
    
    // Validar estratégia de rentabilidade
    if (strategyType === 'FIXED_RATE') {
      if (manualRate === undefined || manualRate === null || manualRate <= 0) {
        missingFields.push('Taxa de Rentabilidade Anual')
      }
    } else if (strategyType === 'PORTFOLIO') {
      if (!portfolioId || portfolioId.trim() === '') {
        missingFields.push('Seleção de Carteira')
      }
    } else if (strategyType === 'RANKING') {
      if (!rankingId || rankingId.trim() === '') {
        missingFields.push('Seleção de Ranking')
      }
    } else if (strategyType === 'MANUAL_TICKERS') {
      if (!manualTickers || manualTickers.length === 0) {
        missingFields.push('Tickers Manuais')
      }
    }
    
    if (missingFields.length > 0) {
      // Criar mapa de erros por campo
      const errors: Record<string, string> = {}
      
      if (missingFields.includes('Saldo Devedor')) {
        errors.balance = 'Campo obrigatório'
      }
      if (missingFields.includes('Prestação Mensal')) {
        errors.monthlyPayment = 'Campo obrigatório'
      }
      if (missingFields.includes('Taxa de Juros Anual')) {
        errors.interestRateAnnual = 'Campo obrigatório'
      }
      if (missingFields.includes('Orçamento Mensal Total')) {
        errors.monthlyBudget = 'Campo obrigatório'
      }
      if (missingFields.includes('Taxa de Rentabilidade Anual')) {
        errors.manualRate = 'Campo obrigatório'
      }
      if (missingFields.includes('Seleção de Carteira')) {
        errors.portfolioId = 'Selecione uma carteira'
      }
      if (missingFields.includes('Seleção de Ranking')) {
        errors.rankingId = 'Selecione um ranking'
      }
      if (missingFields.includes('Tickers Manuais')) {
        errors.manualTickers = 'Adicione pelo menos um ticker'
      }
      
      setFieldErrors(errors)
      
      // Scroll para o primeiro campo com erro
      setTimeout(() => {
        const firstErrorField = Object.keys(errors)[0]
        if (firstErrorField) {
          const fieldIdMap: Record<string, string> = {
            balance: 'balance',
            monthlyPayment: 'monthlyPayment',
            interestRateAnnual: 'interestRateAnnual',
            monthlyBudget: 'monthlyBudget',
            manualRate: 'manualRate'
          }
          const fieldId = fieldIdMap[firstErrorField]
          if (fieldId) {
            const element = document.getElementById(fieldId)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
              element.focus()
            }
          }
        }
      }, 100)
      
      toast({
        title: 'Campos obrigatórios não preenchidos',
        description: `Por favor, preencha os seguintes campos: ${missingFields.join(', ')}. Os campos com erro estão destacados em vermelho.`,
        variant: 'destructive'
      })
      return
    }
    
    // Limpar erros se validação passou
    setFieldErrors({})
    
    // Validação adicional: orçamento deve ser maior que prestação
    const monthlyPayment = effectiveDebtData.monthlyPayment || 0
    if (monthlyPayment > 0 && monthlyBudget < monthlyPayment) {
      toast({
        title: 'Erro de validação',
        description: `O Orçamento Mensal (R$ ${monthlyBudget.toLocaleString('pt-BR')}) deve ser maior ou igual à Prestação Mensal Total (R$ ${monthlyPayment.toLocaleString('pt-BR')})`,
        variant: 'destructive'
      })
      return
    }
    
    // Validação: split não pode ser maior que a sobra
    const surplus = monthlyBudget - monthlyPayment
    if (investmentSplit > surplus) {
      toast({
        title: 'Erro de validação',
        description: `O Split de Investimento (R$ ${investmentSplit.toLocaleString('pt-BR')}) não pode ser maior que a SOBRA disponível (R$ ${surplus.toLocaleString('pt-BR')})`,
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      // Preparar parâmetros de simulação
      const simulationParams: any = {
        monthlyBudget,
        investmentSplit,
        monthlyTR,
        strategyType,
        manualRateFixed: strategyType === 'FIXED_RATE' ? manualRate : undefined,
        portfolioId: strategyType === 'PORTFOLIO' ? portfolioId : undefined,
        rankingId: strategyType === 'RANKING' ? rankingId : undefined,
        manualTickers: strategyType === 'MANUAL_TICKERS' ? manualTickers : undefined
      }

      // Se tem dívidas selecionadas, usar elas; senão usar dados inline (modo visitante)
      if (selectedDebtIds.length > 0 && session) {
        if (selectedDebtIds.length === 1) {
          simulationParams.debtId = selectedDebtIds[0]
        } else {
          // Múltiplas dívidas: usar dados agregados
          simulationParams.debtIds = selectedDebtIds
          simulationParams.debtData = {
            balance: effectiveDebtData.balance,
            monthlyPayment: effectiveDebtData.monthlyPayment,
            interestRateAnnual: effectiveDebtData.interestRateAnnual,
            amortizationSystem: effectiveDebtData.amortizationSystem || 'SAC',
            termMonths: effectiveDebtData.termMonths || 0
          }
        }
      } else {
        simulationParams.debtId = 'temp'
        simulationParams.debtData = {
          balance: effectiveDebtData.balance,
          monthlyPayment: effectiveDebtData.monthlyPayment || 0,
          interestRateAnnual: effectiveDebtData.interestRateAnnual || 0,
          amortizationSystem: effectiveDebtData.amortizationSystem || 'SAC',
          termMonths: effectiveDebtData.termMonths || 0
        }
      }

      const response = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulationParams)
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.requiresPremium && !isPremium) {
          toast({
            title: 'Recurso Premium',
            description: error.error,
            variant: 'default'
          })
          return
        }
        throw new Error(error.error || 'Erro ao executar simulação')
      }

      const results = await response.json()
      setSimulationResults(results)
      
      // Scroll automático para os resultados após um pequeno delay para garantir renderização
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 300)
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCSV = async (strategy: 'sniper' | 'hybrid') => {
    if (!simulationResults) return

    const data = strategy === 'sniper' ? simulationResults.sniper.monthlyData : simulationResults.hybrid.monthlyData
    
    const aggregatedData = getAggregatedDebtData()
    const debtName = aggregatedData?.name || debtData.name || 'divida'
    
    const response = await fetch('/api/simulation/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy,
        monthlyData: data,
        debtName
      })
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `simulacao-${strategy}-${debtName.replace(/\s+/g, '-')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }
  }

  return (
    <div className="space-y-6">
      {/* Seção de Dívida */}
      {session && !isPublic && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Suas Dívidas</CardTitle>
              {debts.length > 1 && !isLoadingDebts && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllDebts}
                  disabled={isLoading}
                >
                  {selectedDebtIds.length === debts.length ? (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Desmarcar Todas
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Selecionar Todas
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingDebts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Carregando dívidas...</span>
              </div>
            ) : debts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Nenhuma dívida cadastrada</p>
                <Button
                  variant="outline"
                  onClick={() => setShowDebtForm(true)}
                >
                  Cadastrar Primeira Dívida
                </Button>
              </div>
            ) : (
              <>
            {selectedDebtIds.length > 0 && (
              <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary">
                  {selectedDebtIds.length === 1 
                    ? '1 dívida selecionada'
                    : `${selectedDebtIds.length} dívidas selecionadas`
                  }
                </p>
                {selectedDebtIds.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    A simulação será feita com os dados agregados (soma de saldos e prestações, taxa média ponderada)
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              {debts.map((debt) => {
                const isSelected = selectedDebtIds.includes(debt.id)
                return (
                  <div
                    key={debt.id}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleDebtSelection(debt.id)}
                        className="flex-shrink-0"
                        disabled={isLoading}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleToggleDebtSelection(debt.id)}
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{debt.name}</p>
                          {isSelected && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              Selecionada
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Saldo: R$ {debt.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                          Prestação: R$ {debt.monthlyPayment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditDebt(debt)
                        }}
                        disabled={isLoading}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteDebt(debt.id)
                        }}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setShowDebtForm(true)}
            >
              Nova Dívida
            </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {showDebtForm && (
        <DebtForm
          initialData={editingDebtId ? debtData : undefined}
          onSubmit={editingDebtId ? handleUpdateDebt : handleSaveDebt}
          onCancel={() => {
            setShowDebtForm(false)
            setEditingDebtId(null)
            // Os dados serão restaurados automaticamente pelo useEffect quando selectedDebtIds mudar
          }}
          isLoading={isLoading}
          isEditing={!!editingDebtId}
        />
      )}

      {/* Formulário de Dívida (modo visitante ou nova) */}
      {(!session || isPublic || selectedDebtIds.length === 0) && !showDebtForm && (
        <DebtForm
          initialData={debtData}
          externalErrors={{
            balance: fieldErrors.balance,
            monthlyPayment: fieldErrors.monthlyPayment,
            interestRateAnnual: fieldErrors.interestRateAnnual
          }}
          onDataChange={handleDebtDataChange}
          onSubmit={async (data) => {
            // Se usuário está logado, sempre tentar salvar (independente de isPublic)
            if (session) {
              await handleSaveDebt(data)
            } else {
              // Modo visitante: apenas atualizar estado local
              setDebtData(data)
              // Limpar erros ao atualizar dados
              setFieldErrors({})
              toast({
                title: 'Dica',
                description: 'Faça login para salvar suas dívidas e configurações',
                variant: 'default'
              })
            }
          }}
          isLoading={isLoading}
        />
      )}

      {/* Configuração de Simulação */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Simulação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="monthlyBudget">Orçamento Mensal Total (R$)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">Orçamento Mensal Total</p>
                      <p className="text-sm">
                        Valor total disponível por mês para pagar a prestação da dívida e investir.
                        Exemplo: Se você tem R$ 5.000/mês e a prestação é R$ 3.000, sua SOBRA é R$ 2.000.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="monthlyBudget"
                type="number"
                step="0.01"
                value={monthlyBudget || ''}
                onChange={(e) => {
                  setMonthlyBudget(parseFloat(e.target.value) || 0)
                  if (fieldErrors.monthlyBudget) {
                    setFieldErrors({ ...fieldErrors, monthlyBudget: '' })
                  }
                }}
                placeholder="Ex: 5000"
                className={fieldErrors.monthlyBudget ? 'border-red-500' : ''}
              />
              {fieldErrors.monthlyBudget && (
                <p className="text-sm text-red-500">{fieldErrors.monthlyBudget}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="investmentSplit">Split de Investimento - Híbrido (R$)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">Split de Investimento</p>
                      <p className="text-sm mb-2">
                        Valor fixo que você deseja investir mensalmente na estratégia Híbrida, mantendo o hábito de investir mesmo enquanto paga a dívida.
                      </p>
                      <p className="text-sm">
                        <strong>Exemplo:</strong> Se sua SOBRA é R$ 2.000 e o Split é R$ 1.000, você investe R$ 1.000 e amortiza R$ 1.000 extra na dívida.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="investmentSplit"
                type="number"
                step="0.01"
                value={investmentSplit || ''}
                onChange={(e) => setInvestmentSplit(parseFloat(e.target.value) || 0)}
                placeholder="Ex: 1000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="monthlyTR">Taxa Referencial (TR) Mensal (%)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Taxa Referencial (TR) Mensal</p>
                    <p className="text-sm mb-2">
                      A TR é aplicada mensalmente sobre o saldo devedor antes do cálculo da amortização.
                      Ela representa a correção monetária da dívida.
                    </p>
                    <p className="text-sm">
                      <strong>Padrão:</strong> 0,1% ao mês. Você pode ajustar este valor conforme sua expectativa de inflação ou correção monetária.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="monthlyTR"
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={monthlyTR * 100 || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0
                setMonthlyTR(value / 100) // Converter de % para decimal (ex: 0.1% = 0.001)
              }}
              placeholder="Ex: 0.1"
            />
            <p className="text-xs text-muted-foreground">
              Valor em porcentagem (ex: 0.1 para 0,1% ao mês)
            </p>
          </div>

          <RentabilitySelector
            value={strategyType}
            manualRate={manualRate}
            portfolioId={portfolioId}
            rankingId={rankingId}
            manualTickers={manualTickers}
            onStrategyChange={setStrategyType}
            onManualRateChange={(rate) => {
              setManualRate(rate)
              if (fieldErrors.manualRate) {
                setFieldErrors({ ...fieldErrors, manualRate: '' })
              }
            }}
            onPortfolioChange={(id) => {
              setPortfolioId(id)
              if (fieldErrors.portfolioId) {
                setFieldErrors({ ...fieldErrors, portfolioId: '' })
              }
            }}
            onRankingChange={(id) => {
              setRankingId(id)
              if (fieldErrors.rankingId) {
                setFieldErrors({ ...fieldErrors, rankingId: '' })
              }
            }}
            onTickersChange={(tickers) => {
              setManualTickers(tickers)
              if (fieldErrors.manualTickers) {
                setFieldErrors({ ...fieldErrors, manualTickers: '' })
              }
            }}
            portfolios={portfolios}
            isLoadingPortfolios={isLoadingPortfolios}
            errors={fieldErrors}
          />

          <Button
            onClick={handleRunSimulation}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Executar Simulação
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {simulationResults && (
        <div ref={resultsRef} className="space-y-4">
          <SimulationChart
            sniperData={simulationResults.sniper.monthlyData}
            hybridData={simulationResults.hybrid.monthlyData}
            sniperBreakEven={simulationResults.sniper.breakEvenMonth}
            hybridBreakEven={simulationResults.hybrid.breakEvenMonth}
          />

          <SimulationSummary
            sniperResults={{
              ...simulationResults.sniper,
              totalMonths: simulationResults.sniper.monthlyData.length
            }}
            hybridResults={{
              ...simulationResults.hybrid,
              totalMonths: simulationResults.hybrid.monthlyData.length
            }}
            rentabilityRate={simulationResults.rentability.annualRate}
          />

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleExportCSV('sniper')}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar Sniper (CSV)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportCSV('hybrid')}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar Híbrido (CSV)
            </Button>
          </div>

          {/* Análise AI - Apenas para Premium */}
          {isPremium && session && (
            <AIAnalysisSection
              simulationResults={simulationResults}
              debtData={selectedDebtIds.length > 0 ? getAggregatedDebtData() : debtData}
              monthlyBudget={monthlyBudget}
              investmentSplit={investmentSplit}
              rentabilityRate={simulationResults.rentability.annualRate}
              rentabilitySource={simulationResults.rentability.source}
            />
          )}
        </div>
      )}
    </div>
  )
}

