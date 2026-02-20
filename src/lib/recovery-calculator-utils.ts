/**
 * Utilitários da Calculadora de Recuperação
 * Fórmula: Q_nova = Q_atual * ((avgPrice * profitFactor) - targetPrice) / (targetPrice - (currentPrice * profitFactor))
 */

export interface RecoveryInputs {
  currentQty: number
  avgPrice: number
  currentPrice: number
  targetRise: number // % (ex: 15 para 15%)
  targetProfit: number // % (ex: 0 para empate, 10 para lucro)
}

export interface RecoveryResult {
  success: true
  qtyToBuy: number
  investmentRequired: number
  newAvgPrice: number
  targetPrice: number
  profitInReais: number
}

export interface RecoveryError {
  success: false
  type: 'impossible' | 'no_contribution_needed'
  message: string
}

export type RecoveryCalculation = RecoveryResult | RecoveryError

/**
 * Calcula a quantidade de ações a comprar para atingir o lucro desejado
 */
export function calculateRecovery(inputs: RecoveryInputs): RecoveryCalculation {
  const { currentQty, avgPrice, currentPrice, targetRise, targetProfit } = inputs

  // Validação: targetRise deve ser > targetProfit
  if (targetRise <= targetProfit) {
    return {
      success: false,
      type: 'impossible',
      message: `Para lucrar ${targetProfit}%, o ativo precisa subir mais do que isso.`,
    }
  }

  const profitFactor = 1 + targetProfit / 100
  const targetPrice = currentPrice * (1 + targetRise / 100)
  const denominator = targetPrice - currentPrice * profitFactor

  // Evitar divisão por zero
  if (denominator <= 0) {
    return {
      success: false,
      type: 'impossible',
      message: `Para lucrar ${targetProfit}%, o ativo precisa subir mais do que isso.`,
    }
  }

  const numerator = avgPrice * profitFactor - targetPrice
  const qtyRaw = currentQty * (numerator / denominator)

  // Q_nova <= 0: usuário já atingiria a meta apenas segurando
  if (qtyRaw <= 0) {
    return {
      success: false,
      type: 'no_contribution_needed',
      message: 'Você não precisa aportar. Apenas segurando, você atinge o objetivo.',
    }
  }

  const qtyToBuy = Math.ceil(qtyRaw)
  const investmentRequired = qtyToBuy * currentPrice
  const totalQty = currentQty + qtyToBuy
  const totalInvested = currentQty * avgPrice + investmentRequired
  const newAvgPrice = totalInvested / totalQty

  // Lucro em reais se atingir targetPrice
  const totalValueAtTarget = totalQty * targetPrice
  const profitInReais = totalValueAtTarget - totalInvested

  return {
    success: true,
    qtyToBuy,
    investmentRequired,
    newAvgPrice,
    targetPrice,
    profitInReais,
  }
}

/**
 * Calcula a queda percentual atual (avgPrice -> currentPrice)
 */
export function calculateCurrentDrop(avgPrice: number, currentPrice: number): number {
  if (avgPrice <= 0) return 0
  return ((avgPrice - currentPrice) / avgPrice) * 100
}

/**
 * Calcula o prejuízo em reais
 */
export function calculateLossInReais(
  currentQty: number,
  avgPrice: number,
  currentPrice: number
): number {
  return currentQty * (avgPrice - currentPrice)
}
