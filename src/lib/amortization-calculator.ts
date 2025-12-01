/**
 * Calculadora de Amortização (SAC e Price)
 * 
 * Implementa os sistemas de amortização:
 * - SAC (Sistema de Amortização Constante)
 * - PRICE (Sistema de Amortização Francês / Tabela Price)
 */

export enum AmortizationSystem {
  SAC = 'SAC',
  PRICE = 'PRICE'
}

export interface AmortizationParams {
  principal: number // Saldo devedor inicial
  annualRate: number // Taxa de juros anual (ex: 0.105 = 10.5%)
  termMonths: number // Prazo em meses
  system: AmortizationSystem
}

export interface AmortizationScheduleEntry {
  month: number
  principalPayment: number // Amortização do principal
  interestPayment: number // Juros do período
  totalPayment: number // Total da prestação
  remainingBalance: number // Saldo devedor restante
}

/**
 * Calcula a prestação mensal usando o sistema SAC
 */
export function calculateSACPayment(params: AmortizationParams): number {
  const { principal, annualRate, termMonths } = params
  
  if (termMonths === 0) return 0
  
  const monthlyRate = annualRate / 12
  const principalAmortization = principal / termMonths
  
  // Primeira prestação = amortização + juros sobre o principal total
  const firstPayment = principalAmortization + (principal * monthlyRate)
  
  return firstPayment
}

/**
 * Calcula a prestação mensal usando o sistema PRICE (Tabela Price)
 */
export function calculatePRICEPayment(params: AmortizationParams): number {
  const { principal, annualRate, termMonths } = params
  
  if (termMonths === 0) return 0
  if (annualRate === 0) return principal / termMonths
  
  const monthlyRate = annualRate / 12
  
  // Fórmula da Tabela Price: PMT = PV * [i(1+i)^n] / [(1+i)^n - 1]
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, termMonths)
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1
  
  return principal * (numerator / denominator)
}

/**
 * Gera tabela de amortização completa (SAC)
 */
export function generateSACSchedule(params: AmortizationParams): AmortizationScheduleEntry[] {
  const { principal, annualRate, termMonths } = params
  const schedule: AmortizationScheduleEntry[] = []
  
  const monthlyRate = annualRate / 12
  const principalAmortization = principal / termMonths
  let remainingBalance = principal
  
  for (let month = 1; month <= termMonths; month++) {
    const interestPayment = remainingBalance * monthlyRate
    const totalPayment = principalAmortization + interestPayment
    remainingBalance -= principalAmortization
    
    // Evitar saldo negativo por arredondamento
    if (remainingBalance < 0.01) {
      remainingBalance = 0
    }
    
    schedule.push({
      month,
      principalPayment: principalAmortization,
      interestPayment,
      totalPayment,
      remainingBalance
    })
  }
  
  return schedule
}

/**
 * Gera tabela de amortização completa (PRICE)
 */
export function generatePRICESchedule(params: AmortizationParams): AmortizationScheduleEntry[] {
  const { principal, annualRate, termMonths } = params
  const schedule: AmortizationScheduleEntry[] = []
  
  const monthlyRate = annualRate / 12
  const fixedPayment = calculatePRICEPayment(params)
  let remainingBalance = principal
  
  for (let month = 1; month <= termMonths; month++) {
    const interestPayment = remainingBalance * monthlyRate
    const principalPayment = fixedPayment - interestPayment
    remainingBalance -= principalPayment
    
    // Evitar saldo negativo por arredondamento
    if (remainingBalance < 0.01) {
      remainingBalance = 0
    }
    
    schedule.push({
      month,
      principalPayment,
      interestPayment,
      totalPayment: fixedPayment,
      remainingBalance
    })
  }
  
  return schedule
}

/**
 * Calcula juros mensais sobre saldo devedor
 */
export function calculateMonthlyInterest(balance: number, annualRate: number): number {
  const monthlyRate = annualRate / 12
  return balance * monthlyRate
}

/**
 * Calcula prestação mensal baseada no sistema
 */
export function calculateMonthlyPayment(params: AmortizationParams): number {
  if (params.system === AmortizationSystem.SAC) {
    return calculateSACPayment(params)
  } else {
    return calculatePRICEPayment(params)
  }
}

