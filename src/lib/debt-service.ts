/**
 * Serviço de Gestão de Dívidas
 * 
 * CRUD completo para gerenciamento de passivos do usuário
 */

import { prisma } from './prisma'
import { AmortizationSystem } from '@prisma/client'

export interface CreateDebtInput {
  userId: string
  name: string
  balance: number
  interestRateAnnual: number
  termMonths: number
  monthlyPayment: number
  amortizationSystem: AmortizationSystem
}

export interface UpdateDebtInput {
  name?: string
  balance?: number
  interestRateAnnual?: number
  termMonths?: number
  monthlyPayment?: number
  amortizationSystem?: AmortizationSystem
}

export interface DebtWithConfig {
  id: string
  userId: string
  name: string
  balance: number
  interestRateAnnual: number
  termMonths: number
  monthlyPayment: number
  amortizationSystem: AmortizationSystem
  createdAt: Date
  updatedAt: Date
  simulationConfig?: {
    id: string
    monthlyBudget: number
    investmentSplit: number
    monthlyTR: number
    strategyType: string
    manualRateFixed?: number
    rankingId?: string
    manualTickers: string[]
  }
}

/**
 * Cria uma nova dívida
 */
export async function createDebt(input: CreateDebtInput) {
  return await prisma.debt.create({
    data: {
      userId: input.userId,
      name: input.name,
      balance: input.balance,
      interestRateAnnual: input.interestRateAnnual,
      termMonths: input.termMonths,
      monthlyPayment: input.monthlyPayment,
      amortizationSystem: input.amortizationSystem
    }
  })
}

/**
 * Busca todas as dívidas de um usuário
 */
export async function getUserDebts(userId: string): Promise<DebtWithConfig[]> {
  const debts = await prisma.debt.findMany({
    where: {
      userId
    },
    include: {
      simulationConfig: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return debts.map(debt => ({
    id: debt.id,
    userId: debt.userId,
    name: debt.name,
    balance: Number(debt.balance),
    interestRateAnnual: Number(debt.interestRateAnnual),
    termMonths: debt.termMonths,
    monthlyPayment: Number(debt.monthlyPayment),
    amortizationSystem: debt.amortizationSystem,
    createdAt: debt.createdAt,
    updatedAt: debt.updatedAt,
    simulationConfig: debt.simulationConfig ? {
      id: debt.simulationConfig.id,
      monthlyBudget: Number(debt.simulationConfig.monthlyBudget),
      investmentSplit: Number(debt.simulationConfig.investmentSplit),
      monthlyTR: Number(debt.simulationConfig.monthlyTR ?? 0.001), // TR padrão 0,1%
      strategyType: debt.simulationConfig.strategyType,
      manualRateFixed: debt.simulationConfig.manualRateFixed ? Number(debt.simulationConfig.manualRateFixed) : undefined,
      rankingId: debt.simulationConfig.rankingId || undefined,
      manualTickers: debt.simulationConfig.manualTickers || []
    } : undefined
  }))
}

/**
 * Busca uma dívida específica
 */
export async function getDebtById(debtId: string, userId: string) {
  const debt = await prisma.debt.findFirst({
    where: {
      id: debtId,
      userId
    },
    include: {
      simulationConfig: true
    }
  })

  if (!debt) {
    return null
  }

  return {
    id: debt.id,
    userId: debt.userId,
    name: debt.name,
    balance: Number(debt.balance),
    interestRateAnnual: Number(debt.interestRateAnnual),
    termMonths: debt.termMonths,
    monthlyPayment: Number(debt.monthlyPayment),
    amortizationSystem: debt.amortizationSystem,
    createdAt: debt.createdAt,
    updatedAt: debt.updatedAt,
    simulationConfig: debt.simulationConfig ? {
      id: debt.simulationConfig.id,
      monthlyBudget: Number(debt.simulationConfig.monthlyBudget),
      investmentSplit: Number(debt.simulationConfig.investmentSplit),
      strategyType: debt.simulationConfig.strategyType,
      manualRateFixed: debt.simulationConfig.manualRateFixed ? Number(debt.simulationConfig.manualRateFixed) : undefined,
      rankingId: debt.simulationConfig.rankingId || undefined,
      manualTickers: debt.simulationConfig.manualTickers || []
    } : undefined
  }
}

/**
 * Atualiza uma dívida
 */
export async function updateDebt(
  debtId: string,
  userId: string,
  input: UpdateDebtInput
) {
  // Verificar ownership
  const existing = await prisma.debt.findFirst({
    where: {
      id: debtId,
      userId
    }
  })

  if (!existing) {
    throw new Error('Dívida não encontrada ou sem permissão')
  }

  return await prisma.debt.update({
    where: {
      id: debtId
    },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.balance !== undefined && { balance: input.balance }),
      ...(input.interestRateAnnual !== undefined && { interestRateAnnual: input.interestRateAnnual }),
      ...(input.termMonths !== undefined && { termMonths: input.termMonths }),
      ...(input.monthlyPayment !== undefined && { monthlyPayment: input.monthlyPayment }),
      ...(input.amortizationSystem !== undefined && { amortizationSystem: input.amortizationSystem })
    }
  })
}

/**
 * Deleta uma dívida
 */
export async function deleteDebt(debtId: string, userId: string) {
  // Verificar ownership
  const existing = await prisma.debt.findFirst({
    where: {
      id: debtId,
      userId
    }
  })

  if (!existing) {
    throw new Error('Dívida não encontrada ou sem permissão')
  }

  return await prisma.debt.delete({
    where: {
      id: debtId
    }
  })
}

