'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { InfoHint } from '@/components/ui/info-hint'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/section-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Download, Pencil, Trash2 } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import { DecimalInput, NumericMoneyInput } from '@/app/calculadoras/_components/money-input'
import { useToast } from '@/hooks/use-toast'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { DebtForm, DebtFormData } from './debt-form'
import { RentabilitySelector, StrategySource } from './rentability-selector'
import { SimulationChart } from './simulation-chart'
import { SimulationSummary } from './simulation-summary'
import { AIAnalysisSection } from './ai-analysis-section'

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
        title: 'Não foi possível carregar suas dívidas',
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
      name: selectedDebts.length === 1 ? selectedDebts[0].name : `${selectedDebts.length} dívidas`,
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
      router.push('/login?callbackUrl=/arbitragem-divida')
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
          title: 'Dívida salva'
        })
        setShowDebtForm(false)
        loadDebts()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar')
      }
    } catch (error: any) {
      toast({
        title: 'Não foi possível concluir',
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
          title: 'Dívida atualizada'
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
        title: 'Não foi possível concluir',
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
          title: 'Dívida excluída'
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
        title: 'Não foi possível concluir',
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
      name: selectedDebts.length === 1 ? selectedDebts[0].name : `${selectedDebts.length} dívidas`,
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
      missingFields.push('Saldo devedor')
    }
    if (effectiveDebtData.monthlyPayment === undefined || effectiveDebtData.monthlyPayment === null || effectiveDebtData.monthlyPayment <= 0) {
      missingFields.push('Prestação mensal')
    }
    if (effectiveDebtData.interestRateAnnual === undefined || effectiveDebtData.interestRateAnnual === null || effectiveDebtData.interestRateAnnual < 0) {
      missingFields.push('Juros ao ano')
    }
    
    // Validar configuração de simulação
    if (monthlyBudget === undefined || monthlyBudget === null || monthlyBudget <= 0) {
      missingFields.push('Orçamento mensal')
    }
    
    // Validar estratégia de rentabilidade
    if (strategyType === 'FIXED_RATE') {
      if (manualRate === undefined || manualRate === null || manualRate <= 0) {
        missingFields.push('Rentabilidade anual')
      }
    } else if (strategyType === 'PORTFOLIO') {
      if (!portfolioId || portfolioId.trim() === '') {
        missingFields.push('Carteira')
      }
    } else if (strategyType === 'RANKING') {
      if (!rankingId || rankingId.trim() === '') {
        missingFields.push('Ranking')
      }
    } else if (strategyType === 'MANUAL_TICKERS') {
      if (!manualTickers || manualTickers.length === 0) {
        missingFields.push('Tickers')
      }
    }
    
    if (missingFields.length > 0) {
      // Criar mapa de erros por campo
      const errors: Record<string, string> = {}
      
      if (missingFields.includes('Saldo devedor')) {
        errors.balance = 'Campo obrigatório'
      }
      if (missingFields.includes('Prestação mensal')) {
        errors.monthlyPayment = 'Campo obrigatório'
      }
      if (missingFields.includes('Juros ao ano')) {
        errors.interestRateAnnual = 'Campo obrigatório'
      }
      if (missingFields.includes('Orçamento mensal')) {
        errors.monthlyBudget = 'Campo obrigatório'
      }
      if (missingFields.includes('Rentabilidade anual')) {
        errors.manualRate = 'Campo obrigatório'
      }
      if (missingFields.includes('Carteira')) {
        errors.portfolioId = 'Selecione uma carteira'
      }
      if (missingFields.includes('Ranking')) {
        errors.rankingId = 'Selecione um ranking'
      }
      if (missingFields.includes('Tickers')) {
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
        title: 'Preencha os campos obrigatórios',
        description: `Faltam: ${missingFields.join(', ')}.`,
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
        title: 'Revise os valores',
        description: `O orçamento mensal (${formatBRL(monthlyBudget)}) precisa cobrir a prestação mensal (${formatBRL(monthlyPayment)}).`,
        variant: 'destructive'
      })
      return
    }
    
    // Validação: split não pode ser maior que a sobra
    const surplus = monthlyBudget - monthlyPayment
    if (investmentSplit > surplus) {
      toast({
        title: 'Revise os valores',
        description: `O valor fixo para investir (${formatBRL(investmentSplit)}) não pode passar da sobra mensal (${formatBRL(surplus)}).`,
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
        title: 'Não foi possível concluir',
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

  const surplus = Math.max(0, monthlyBudget - (Number((getAggregatedDebtData() ?? debtData).monthlyPayment) || 0))

  return (
    <div className="space-y-6">
      {session && !isPublic && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <SectionHeader
            title="Suas dívidas"
            description={
              selectedDebtIds.length > 1
                ? 'Com mais de uma dívida marcada, a simulação soma saldos e prestações e usa a taxa média ponderada.'
                : 'Marque as dívidas que entram na simulação.'
            }
            actions={
              debts.length > 1 &&
              !isLoadingDebts && (
                <Button variant="outline" size="sm" onClick={handleSelectAllDebts} disabled={isLoading}>
                  {selectedDebtIds.length === debts.length ? 'Desmarcar todas' : 'Marcar todas'}
                </Button>
              )
            }
          />
          {isLoadingDebts ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : debts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma dívida cadastrada.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowDebtForm(true)}>
                Cadastrar dívida
              </Button>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {debts.map((debt) => {
                  const isSelected = selectedDebtIds.includes(debt.id)
                  return (
                    <li key={debt.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={`debt-${debt.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleDebtSelection(debt.id)}
                        disabled={isLoading}
                      />
                      <label htmlFor={`debt-${debt.id}`} className="min-w-0 flex-1 cursor-pointer py-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{debt.name}</span>
                          {isSelected && <Badge variant="brand">Na simulação</Badge>}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          Saldo {formatBRL(Number(debt.balance))}, prestação {formatBRL(Number(debt.monthlyPayment))}
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${debt.name}`}
                        onClick={() => handleEditDebt(debt)}
                        disabled={isLoading}
                      >
                        <Pencil className="size-4" strokeWidth={1.75} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${debt.name}`}
                        onClick={() => handleDeleteDebt(debt.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="size-4 text-negative" strokeWidth={1.75} />
                      </Button>
                    </li>
                  )
                })}
              </ul>
              <Button variant="outline" size="sm" onClick={() => setShowDebtForm(true)}>
                Nova dívida
              </Button>
            </>
          )}
        </section>
      )}

      {showDebtForm && (
        <DebtForm
          initialData={editingDebtId ? debtData : undefined}
          onSubmit={editingDebtId ? handleUpdateDebt : handleSaveDebt}
          onCancel={() => {
            setShowDebtForm(false)
            setEditingDebtId(null)
          }}
          isLoading={isLoading}
          isEditing={!!editingDebtId}
        />
      )}

      {(!session || isPublic || selectedDebtIds.length === 0) && !showDebtForm && (
        <DebtForm
          initialData={debtData}
          externalErrors={{
            balance: fieldErrors.balance,
            monthlyPayment: fieldErrors.monthlyPayment,
            interestRateAnnual: fieldErrors.interestRateAnnual,
          }}
          onDataChange={handleDebtDataChange}
          onSubmit={async (data) => {
            if (session) {
              await handleSaveDebt(data)
            } else {
              setDebtData(data)
              setFieldErrors({})
              toast({ title: 'Entre na sua conta para salvar dívidas e configurações' })
            }
          }}
          isLoading={isLoading}
        />
      )}

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-medium text-foreground">Premissas da simulação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="monthlyBudget">Orçamento mensal</Label>
              <InfoHint
                label="Sobre o orçamento mensal"
                content="Valor total por mês para pagar a prestação e investir. Com R$ 5.000 de orçamento e prestação de R$ 3.000, a sobra é de R$ 2.000."
              />
            </div>
            <NumericMoneyInput
              id="monthlyBudget"
              placeholder="5.000,00"
              value={monthlyBudget}
              onValueChange={(value) => {
                setMonthlyBudget(value)
                if (fieldErrors.monthlyBudget) setFieldErrors({ ...fieldErrors, monthlyBudget: '' })
              }}
              aria-invalid={fieldErrors.monthlyBudget ? true : undefined}
              enterKeyHint="next"
            />
            {fieldErrors.monthlyBudget ? (
              <p className="text-sm text-negative">{fieldErrors.monthlyBudget}</p>
            ) : (
              monthlyBudget > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">Sobra mensal: {formatBRL(surplus)}</p>
              )
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="investmentSplit">Valor fixo para investir (híbrida)</Label>
              <InfoHint
                label="Sobre o valor fixo para investir"
                content="Na estratégia híbrida, este valor é investido todo mês e o restante da sobra amortiza a dívida. Com sobra de R$ 2.000 e valor fixo de R$ 1.000, você investe R$ 1.000 e amortiza R$ 1.000."
              />
            </div>
            <NumericMoneyInput
              id="investmentSplit"
              placeholder="1.000,00"
              value={investmentSplit}
              onValueChange={setInvestmentSplit}
              enterKeyHint="next"
            />
          </div>
        </div>

        <div className="space-y-2 sm:max-w-[calc(50%-0.5rem)]">
          <div className="flex items-center gap-1">
            <Label htmlFor="monthlyTR">TR mensal</Label>
            <InfoHint
              label="Sobre a TR"
              content="A Taxa Referencial corrige o saldo devedor todo mês, antes da amortização. O padrão é 0,1% ao mês; ajuste conforme sua expectativa."
            />
          </div>
          <DecimalInput
            id="monthlyTR"
            placeholder="0,1"
            suffix="% a.m."
            value={monthlyTR * 100}
            onValueChange={(value) => setMonthlyTR(value / 100)}
            enterKeyHint="next"
          />
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
            if (fieldErrors.manualRate) setFieldErrors({ ...fieldErrors, manualRate: '' })
          }}
          onPortfolioChange={(id) => {
            setPortfolioId(id)
            if (fieldErrors.portfolioId) setFieldErrors({ ...fieldErrors, portfolioId: '' })
          }}
          onRankingChange={(id) => {
            setRankingId(id)
            if (fieldErrors.rankingId) setFieldErrors({ ...fieldErrors, rankingId: '' })
          }}
          onTickersChange={(tickers) => {
            setManualTickers(tickers)
            if (fieldErrors.manualTickers) setFieldErrors({ ...fieldErrors, manualTickers: '' })
          }}
          portfolios={portfolios}
          isLoadingPortfolios={isLoadingPortfolios}
          errors={fieldErrors}
        />

        <Button onClick={handleRunSimulation} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
          {isLoading ? 'Simulando' : 'Simular estratégias'}
        </Button>
      </section>

      {simulationResults && (
        <div ref={resultsRef} className="scroll-mt-20 space-y-6">
          <SimulationChart
            sniperData={simulationResults.sniper.monthlyData}
            hybridData={simulationResults.hybrid.monthlyData}
            sniperBreakEven={simulationResults.sniper.breakEvenMonth}
            hybridBreakEven={simulationResults.hybrid.breakEvenMonth}
          />

          <SimulationSummary
            sniperResults={{
              ...simulationResults.sniper,
              totalMonths: simulationResults.sniper.monthlyData.length,
            }}
            hybridResults={{
              ...simulationResults.hybrid,
              totalMonths: simulationResults.hybrid.monthlyData.length,
            }}
            rentabilityRate={simulationResults.rentability.annualRate}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExportCSV('sniper')}>
              <Download className="size-4" strokeWidth={1.75} />
              Exportar Sniper (CSV)
            </Button>
            <Button variant="outline" onClick={() => handleExportCSV('hybrid')}>
              <Download className="size-4" strokeWidth={1.75} />
              Exportar híbrida (CSV)
            </Button>
          </div>

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
