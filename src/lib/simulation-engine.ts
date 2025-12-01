/**
 * Engine de Simulação - Arbitragem Inteligente de Dívida
 * 
 * Implementa o algoritmo mês a mês para comparar estratégias:
 * - Sniper: 100% amortização (foco total na dívida)
 * - Híbrido: Split fixo para investimento + resto para amortização
 */

import { AmortizationSystem, generateSACSchedule, generatePRICESchedule } from './amortization-calculator'

export type StrategyType = 'SNIPER' | 'HYBRID'

export interface SimulationParams {
  // Dados da Dívida
  initialDebtBalance: number // Saldo devedor inicial
  monthlyPayment: number // Prestação obrigatória mensal
  debtAnnualRate: number // Taxa de juros anual da dívida
  amortizationSystem?: AmortizationSystem // Sistema de amortização (SAC ou PRICE)
  termMonths?: number // Prazo total em meses (necessário para calcular amortização)
  
  // Configuração de Orçamento
  monthlyBudget: number // Orçamento mensal total
  
  // Estratégia
  strategy: StrategyType
  investmentSplit?: number // Valor fixo do Split (apenas para Híbrido)
  
  // Rentabilidade de Investimento
  investmentAnnualRate: number // Taxa de rentabilidade anual esperada
  
  // Taxa Referencial (TR) mensal
  monthlyTR?: number // TR mensal (padrão: 0.001 = 0,1%)
  
  // Configuração de Projeção
  maxMonths?: number // Máximo de meses para projetar (padrão: 360 = 30 anos)
  continueUntilMonth?: number // Para Sniper: continuar investindo até este mês após quitar dívida
}

export interface MonthlySnapshot {
  month: number
  debtBalance: number
  investedBalance: number
  netWorth: number // Patrimônio Líquido = Investido - Dívida
  investmentContribution: number
  extraAmortization: number
  totalPayment: number
  interestPaid: number
  investmentReturn: number
}

export interface SimulationResult {
  strategy: StrategyType
  monthlySnapshots: MonthlySnapshot[]
  breakEvenMonth: number | null // Mês em que atingiu break-even (null se nunca atingiu)
  totalMonths: number
  finalDebtBalance: number
  finalInvestedBalance: number
  finalNetWorth: number
  totalInterestPaid: number
  totalInvestmentContribution: number
  totalInvestmentReturn: number
}

/**
 * Calcula simulação usando estratégia Sniper (100% amortização)
 */
export function calculateSniperStrategy(params: SimulationParams): SimulationResult {
  const {
    initialDebtBalance,
    monthlyPayment,
    debtAnnualRate,
    monthlyBudget,
    investmentAnnualRate,
    maxMonths = 360,
    amortizationSystem = 'SAC',
    termMonths = 0
  } = params
  
  const snapshots: MonthlySnapshot[] = []
  let debtBalance = initialDebtBalance
  let investedBalance = 0
  let totalInterestPaid = 0
  let totalInvestmentContribution = 0
  let totalInvestmentReturn = 0
  let breakEvenMonth: number | null = null
  
  const monthlyInvestmentRate = investmentAnnualRate / 12
  const monthlyTR = params.monthlyTR ?? 0.001 // TR mensal padrão 0,1% (0.001)
  const surplus = monthlyBudget - monthlyPayment
  const { continueUntilMonth } = params
  
  let debtQuitMonth: number | null = null
  
  // Gerar tabela de amortização para calcular quanto da prestação amortiza o principal
  let amortizationSchedule: Array<{ month: number; principalPayment: number; interestPayment: number; remainingBalance: number }> = []
  if (termMonths > 0 && initialDebtBalance > 0) {
    if (amortizationSystem === 'SAC') {
      amortizationSchedule = generateSACSchedule({
        principal: initialDebtBalance,
        annualRate: debtAnnualRate,
        termMonths,
        system: AmortizationSystem.SAC
      })
    } else {
      amortizationSchedule = generatePRICESchedule({
        principal: initialDebtBalance,
        annualRate: debtAnnualRate,
        termMonths,
        system: AmortizationSystem.PRICE
      })
    }
  }
  
  // IMPORTANTE: Se temos continueUntilMonth, precisamos garantir que o loop continue até lá
  // mesmo após quitar a dívida. O loop deve processar exatamente até o mês continueUntilMonth
  const maxLoopMonths = continueUntilMonth 
    ? Math.max(maxMonths, continueUntilMonth) // Processar até o mês continueUntilMonth (inclusive)
    : maxMonths
  
  for (let month = 1; month <= maxLoopMonths; month++) {
    // Verificar se devemos parar após processar este mês
    // IMPORTANTE: Não fazer break antes de processar o mês, pois precisamos aplicar o investimento
    // Se já quitou a dívida e não precisa continuar, vamos processar este mês e depois parar
    // Mas se temos continueUntilMonth, devemos continuar até lá mesmo após quitar a dívida
    // Parar APÓS processar o mês continueUntilMonth (não processar mês seguinte)
    const shouldStopAfterThisMonth = debtBalance <= 0 && (!continueUntilMonth || month >= continueUntilMonth)
    
    // 1. Aplicar TR mensal sobre o saldo devedor (padrão 0,1% ao mês) ANTES de calcular amortização
    // Se a dívida já foi quitada, não aplicar TR
    const trIncrease = debtBalance > 0 ? debtBalance * monthlyTR : 0
    debtBalance = debtBalance + trIncrease
    
    // 2. Calcular rendimentos do investimento
    const investmentReturn = investedBalance > 0 ? investedBalance * monthlyInvestmentRate : 0
    investedBalance = investedBalance + investmentReturn
    
    totalInvestmentReturn += investmentReturn
    
    // 2. Definir fluxo de caixa
    const currentSurplus = monthlyBudget - monthlyPayment
    
    // 3. Aplicar estratégia Sniper
    let investmentContribution = 0
    let extraAmortization = 0
    let totalPayment = 0
    let principalAmortizationFromPayment = 0
    let interestFromPayment = 0
    
    if (debtBalance <= 0) {
      // Dívida já quitada: TODO o orçamento vai para investimento
      // IMPORTANTE: Garantir que o investimento continue crescendo mesmo após quitar a dívida
      investmentContribution = monthlyBudget
      extraAmortization = 0
      totalPayment = 0
      debtBalance = 0 // Garantir que o saldo seja zero
      principalAmortizationFromPayment = 0
      interestFromPayment = 0
      
      // Marcar mês da quitação se ainda não foi marcado
      if (debtQuitMonth === null) {
        debtQuitMonth = month - 1 // Mês anterior foi quando quitou
      }
    } else {
      // Ainda há dívida: aplicar estratégia Sniper (100% da sobra para amortização)
      extraAmortization = currentSurplus
      
      // 4. Calcular quanto da prestação amortiza o principal
      // IMPORTANTE: A prestação informada já inclui os juros, então não precisamos calcular juros separadamente
      // No SAC: a prestação já inclui amortização automática do principal
      // No PRICE: a prestação cobre apenas juros, então toda amortização vem de amortização extra
      
      if (amortizationSystem === 'SAC') {
        // No SAC, usar a tabela de amortização para saber quanto amortiza
        if (amortizationSchedule.length > 0 && month <= amortizationSchedule.length) {
          const scheduleEntry = amortizationSchedule[month - 1]
          principalAmortizationFromPayment = scheduleEntry.principalPayment
          interestFromPayment = scheduleEntry.interestPayment
        } else {
          // Fallback: calcular amortização constante
          if (termMonths > 0) {
            // Amortização constante = saldo inicial / prazo
            principalAmortizationFromPayment = initialDebtBalance / termMonths
            interestFromPayment = monthlyPayment - principalAmortizationFromPayment
          } else {
            // Se não temos prazo, assumir que toda prestação amortiza
            principalAmortizationFromPayment = monthlyPayment
            interestFromPayment = 0
          }
        }
      } else {
        // No PRICE: a prestação é fixa e cobre apenas juros
        // Toda amortização vem da amortização extra
        interestFromPayment = monthlyPayment
        principalAmortizationFromPayment = 0
      }
      
      totalInterestPaid += interestFromPayment
      totalPayment = monthlyPayment + extraAmortization
      
      // Reduzir saldo pelo pagamento do principal (amortização da prestação + amortização extra)
      const totalPrincipalPayment = principalAmortizationFromPayment + extraAmortization
      const debtBeforePayment = debtBalance
      debtBalance = Math.max(0, debtBalance - totalPrincipalPayment)
      
      // Se sobrou troco após quitar dívida, vai para investimento
      if (debtBalance < 0) {
        const change = Math.abs(debtBalance)
        investmentContribution += change
        debtBalance = 0
        debtQuitMonth = month
      }
      
      // Se a dívida foi totalmente quitada neste mês, o restante do orçamento vai para investimento
      if (debtBeforePayment > 0 && debtBalance === 0) {
        debtQuitMonth = month
        // O que sobrou do orçamento após quitar a dívida vai para investimento
        const remainingBudget = monthlyBudget - totalPayment
        if (remainingBudget > 0) {
          investmentContribution += remainingBudget
        }
      }
    }
    
    // Aplicar aporte de investimento
    investedBalance += investmentContribution
    totalInvestmentContribution += investmentContribution
    
    // 5. Calcular patrimônio líquido
    const netWorth = investedBalance - debtBalance
    
    // Verificar break-even (primeira vez que investido >= dívida)
    // No Sniper, break-even não se aplica porque foca 100% na amortização
    // breakEvenMonth permanece null para Sniper
    
    const snapshotDebtBalance = Math.max(0, debtBalance)
    
    // IMPORTANTE: Sempre criar snapshot antes de verificar se deve parar
    // Isso garante que o último mês processado seja incluído nos resultados
    snapshots.push({
      month,
      debtBalance: snapshotDebtBalance,
      investedBalance,
      netWorth,
      investmentContribution,
      extraAmortization,
      totalPayment,
      interestPaid: interestFromPayment || 0,
      investmentReturn
    })
    
    // Se devemos parar após este mês, fazer break agora
    // IMPORTANTE: Verificar DEPOIS de criar o snapshot para garantir que o último mês seja incluído
    if (shouldStopAfterThisMonth) {
      break
    }
  }
  
  const finalSnapshot = snapshots[snapshots.length - 1]
  
  return {
    strategy: 'SNIPER',
    monthlySnapshots: snapshots,
    breakEvenMonth,
    totalMonths: snapshots.length,
    finalDebtBalance: finalSnapshot.debtBalance,
    finalInvestedBalance: finalSnapshot.investedBalance,
    finalNetWorth: finalSnapshot.netWorth,
    totalInterestPaid,
    totalInvestmentContribution,
    totalInvestmentReturn
  }
}

/**
 * Calcula simulação usando estratégia Híbrida (Split fixo)
 */
export function calculateHybridStrategy(params: SimulationParams): SimulationResult {
  const {
    initialDebtBalance,
    monthlyPayment,
    debtAnnualRate,
    monthlyBudget,
    investmentSplit = 0,
    investmentAnnualRate,
    maxMonths = 360,
    amortizationSystem = 'SAC',
    termMonths = 0
  } = params
  
  const snapshots: MonthlySnapshot[] = []
  let debtBalance = initialDebtBalance
  let investedBalance = 0
  let totalInterestPaid = 0
  let totalInvestmentContribution = 0
  let totalInvestmentReturn = 0
  let breakEvenMonth: number | null = null
  
  const monthlyInvestmentRate = investmentAnnualRate / 12
  const monthlyTR = params.monthlyTR ?? 0.001 // TR mensal padrão 0,1% (0.001)
  const surplus = monthlyBudget - monthlyPayment

  // Gerar tabela de amortização para calcular quanto da prestação amortiza o principal
  let amortizationSchedule: Array<{ month: number; principalPayment: number; interestPayment: number; remainingBalance: number }> = []
  if (termMonths > 0 && initialDebtBalance > 0) {
    if (amortizationSystem === 'SAC') {
      amortizationSchedule = generateSACSchedule({
        principal: initialDebtBalance,
        annualRate: debtAnnualRate,
        termMonths,
        system: AmortizationSystem.SAC
      })
    } else {
      amortizationSchedule = generatePRICESchedule({
        principal: initialDebtBalance,
        annualRate: debtAnnualRate,
        termMonths,
        system: AmortizationSystem.PRICE
      })
    }
  }
  
  // IMPORTANTE: Híbrido deve continuar até quitar completamente a dívida, não limitar a maxMonths
  // Usar um loop while para garantir que continue até quitar completamente
  // Aumentar o limite para garantir que temos espaço suficiente mesmo se a dívida demorar muito
  let month = 1
  const maxHybridMonths = maxMonths * 3 // Aumentar para 3x para garantir que temos espaço suficiente
  while (month <= maxHybridMonths && debtBalance > 0) {
    // 1. Aplicar TR mensal sobre o saldo devedor (padrão 0,1% ao mês) ANTES de calcular amortização
    const trIncrease = debtBalance > 0 ? debtBalance * monthlyTR : 0
    debtBalance = debtBalance + trIncrease
    
    // 2. Calcular rendimentos do investimento
    const investmentReturn = investedBalance > 0 ? investedBalance * monthlyInvestmentRate : 0
    investedBalance = investedBalance + investmentReturn
    
    totalInvestmentReturn += investmentReturn
    
    // 2. Definir fluxo de caixa
    const currentSurplus = monthlyBudget - monthlyPayment
    
    // 3. Aplicar estratégia Híbrida
    let investmentContribution = 0
    let extraAmortization = 0
    let totalPayment = 0
    
    // Regra de proteção: se SOBRA < Split, investe apenas SOBRA
    // IMPORTANTE: Garantir que investmentContribution nunca seja negativo
    if (currentSurplus < investmentSplit) {
      investmentContribution = Math.max(0, currentSurplus)
      extraAmortization = Math.max(0, currentSurplus - investmentContribution)
    } else {
      investmentContribution = investmentSplit
      extraAmortization = Math.max(0, currentSurplus - investmentSplit)
    }
    
    // Garantir que investmentContribution nunca seja negativo
    investmentContribution = Math.max(0, investmentContribution)
    
    // 4. Calcular quanto da prestação amortiza o principal
    // IMPORTANTE: A prestação informada já inclui os juros, então não precisamos calcular juros separadamente
    // No SAC: a prestação já inclui amortização automática do principal
    // No PRICE: a prestação cobre apenas juros, então toda amortização vem de amortização extra
    let principalAmortizationFromPayment = 0
    let interestFromPayment = 0
    
    if (amortizationSystem === 'SAC') {
      // No SAC, usar a tabela de amortização para saber quanto amortiza
      if (amortizationSchedule.length > 0 && month <= amortizationSchedule.length) {
        const scheduleEntry = amortizationSchedule[month - 1]
        principalAmortizationFromPayment = scheduleEntry.principalPayment
        interestFromPayment = scheduleEntry.interestPayment
      } else {
        // Fallback: calcular amortização constante
        if (termMonths > 0) {
          // Amortização constante = saldo inicial / prazo
          principalAmortizationFromPayment = initialDebtBalance / termMonths
          interestFromPayment = monthlyPayment - principalAmortizationFromPayment
        } else {
          // Se não temos prazo, assumir que toda prestação amortiza
          principalAmortizationFromPayment = monthlyPayment
          interestFromPayment = 0
        }
      }
    } else {
      // No PRICE: a prestação é fixa e cobre apenas juros
      // Toda amortização vem da amortização extra
      interestFromPayment = monthlyPayment
      principalAmortizationFromPayment = 0
    }
    
    totalInterestPaid += interestFromPayment
    totalPayment = monthlyPayment + extraAmortization
    
    // Reduzir saldo pelo pagamento do principal (amortização da prestação + amortização extra)
    const totalPrincipalPayment = principalAmortizationFromPayment + extraAmortization
    const debtBeforePayment = debtBalance
    debtBalance = Math.max(0, debtBalance - totalPrincipalPayment)
    
    // Se sobrou troco após quitar dívida, vai para investimento
    if (debtBalance < 0) {
      const change = Math.abs(debtBalance)
      investmentContribution += change
      debtBalance = 0
    }
    
    // Aplicar aporte de investimento
    investedBalance += investmentContribution
    totalInvestmentContribution += investmentContribution
    
    // 5. Calcular patrimônio líquido
    const netWorth = investedBalance - debtBalance
    
    // Verificar break-even (primeira vez que investido >= dívida)
    if (breakEvenMonth === null && investedBalance >= debtBalance && debtBalance > 0) {
      breakEvenMonth = month
    }
    
    const snapshotDebtBalance = Math.max(0, debtBalance)
    
    // DEBUG: Log detalhado para os últimos 5 meses ou quando investido está próximo de zero
    const isLastFewMonths = month >= (maxHybridMonths - 5) || month % 50 === 0
    const isInvestedBalanceLow = investedBalance < 1000 && investedBalance > 0
    
    if (isLastFewMonths || isInvestedBalanceLow || debtBalance < 1000) {
      console.log(`\n=== DEBUG HÍBRIDO - MÊS ${month} ===`)
      console.log(`Saldo devedor ANTES TR: ${(debtBalance - trIncrease).toFixed(2)}`)
      console.log(`TR aplicada: ${trIncrease.toFixed(2)}`)
      console.log(`Saldo devedor APÓS TR: ${debtBalance.toFixed(2)}`)
      console.log(`Patrimônio investido ANTES: ${(investedBalance - investmentContribution - investmentReturn).toFixed(2)}`)
      console.log(`Rendimento do investimento: ${investmentReturn.toFixed(2)}`)
      console.log(`Aporte de investimento: ${investmentContribution.toFixed(2)}`)
      console.log(`Patrimônio investido DEPOIS: ${investedBalance.toFixed(2)}`)
      console.log(`Orçamento mensal: ${monthlyBudget.toFixed(2)}`)
      console.log(`Prestação: ${monthlyPayment.toFixed(2)}`)
      console.log(`Sobra: ${currentSurplus.toFixed(2)}`)
      console.log(`Split: ${investmentSplit.toFixed(2)}`)
      console.log(`Amortização extra: ${extraAmortization.toFixed(2)}`)
      console.log(`Total amortização aplicada: ${totalPrincipalPayment.toFixed(2)}`)
      console.log(`Saldo devedor FINAL: ${snapshotDebtBalance.toFixed(2)}`)
      console.log(`Patrimônio líquido: ${netWorth.toFixed(2)}`)
      console.log(`=== FIM DEBUG HÍBRIDO MÊS ${month} ===\n`)
    }
    
    snapshots.push({
      month,
      debtBalance: snapshotDebtBalance,
      investedBalance,
      netWorth,
      investmentContribution,
      extraAmortization,
      totalPayment,
      interestPaid: interestFromPayment || 0,
      investmentReturn
    })
    
    // DEBUG: Log do último snapshot criado
    if (month === maxHybridMonths || debtBalance <= 0) {
      console.log(`\n=== ÚLTIMO SNAPSHOT HÍBRIDO ===`)
      console.log(`Mês: ${month}`)
      console.log(`Saldo devedor: ${snapshotDebtBalance.toFixed(2)}`)
      console.log(`Patrimônio investido: ${investedBalance.toFixed(2)}`)
      console.log(`Patrimônio líquido: ${netWorth.toFixed(2)}`)
      console.log(`Total de snapshots criados: ${snapshots.length}`)
      console.log(`=== FIM ÚLTIMO SNAPSHOT ===\n`)
    }
    
    // Parar simulação quando dívida for quitada (Híbrida não continua investindo)
    if (debtBalance <= 0) {
      break
    }
    
    month++
  }
  
  const finalSnapshot = snapshots[snapshots.length - 1]
  
  return {
    strategy: 'HYBRID',
    monthlySnapshots: snapshots,
    breakEvenMonth,
    totalMonths: snapshots.length,
    finalDebtBalance: finalSnapshot.debtBalance,
    finalInvestedBalance: finalSnapshot.investedBalance,
    finalNetWorth: finalSnapshot.netWorth,
    totalInterestPaid,
    totalInvestmentContribution,
    totalInvestmentReturn
  }
}

/**
 * Encontra o mês do break-even point
 */
export function findBreakEvenPoint(snapshots: MonthlySnapshot[]): number | null {
  for (const snapshot of snapshots) {
    if (snapshot.investedBalance >= snapshot.debtBalance && snapshot.debtBalance > 0) {
      return snapshot.month
    }
  }
  return null
}

/**
 * Executa simulação completa (ambas estratégias)
 */
export function runSimulation(params: SimulationParams): {
  sniper: SimulationResult
  hybrid: SimulationResult
} {
  const hybridParams = { ...params, strategy: 'HYBRID' as const }
  
  // Primeiro calcular Híbrido para saber quantos meses leva para quitar a dívida
  const hybridResult = calculateHybridStrategy(hybridParams)
  
  // Encontrar o mês em que a Híbrida quitou a dívida
  let hybridQuitMonth: number | null = null
  for (let i = hybridResult.monthlySnapshots.length - 1; i >= 0; i--) {
    if (hybridResult.monthlySnapshots[i].debtBalance <= 0) {
      hybridQuitMonth = hybridResult.monthlySnapshots[i].month
      break
    }
  }
  
  // Se a Híbrida quitou a dívida, fazer o Sniper continuar investindo até o mesmo mês
  // IMPORTANTE: Se não encontrou mês de quitação, usar o último mês da simulação Híbrida
  const continueUntilMonth = hybridQuitMonth || hybridResult.monthlySnapshots[hybridResult.monthlySnapshots.length - 1]?.month || undefined
  
  const sniperParams = { 
    ...params, 
    strategy: 'SNIPER' as const,
    continueUntilMonth
  }
  
  const sniperResult = calculateSniperStrategy(sniperParams)
  
  return {
    sniper: sniperResult,
    hybrid: hybridResult
  }
}

