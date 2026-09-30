import { calculateDiscount, calculateMonthlyEquivalent, calculatePixDiscount } from '@/lib/price-utils'

export interface PlanPricing {
  /** Preço do mensal em reais. */
  monthly: number
  /** Preço do anual em reais. */
  annual: number
  /** Anual dividido por 12, em reais. */
  annualMonthlyEquivalent: number
  /** Desconto do anual sobre 12 mensalidades, como fração: 1 − anual / (12 × mensal). */
  annualDiscount: number
  /** Mensal com 15% de desconto no PIX, em reais. */
  monthlyPix: number
  /** Anual com 15% de desconto no PIX, em reais. */
  annualPix: number
}

/** Valores exibidos nos cards de planos, calculados a partir das ofertas (em centavos). */
export function getPlanPricing(monthlyCents: number, annualCents: number): PlanPricing {
  return {
    monthly: monthlyCents / 100,
    annual: annualCents / 100,
    annualMonthlyEquivalent: calculateMonthlyEquivalent(annualCents) / 100,
    annualDiscount: calculateDiscount(monthlyCents, annualCents),
    monthlyPix: calculatePixDiscount(monthlyCents) / 100,
    annualPix: calculatePixDiscount(annualCents) / 100,
  }
}
