/**
 * Utilitários para formatação e cálculo de preços
 */

/**
 * Formata um preço em centavos para o formato brasileiro "R$ X,XX"
 * @param priceInCents Preço em centavos (ex: 1990 = R$ 19,90)
 * @returns String formatada (ex: "R$ 19,90")
 */
export function formatPrice(priceInCents: number): string {
  const priceInReais = priceInCents / 100
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceInReais)
}

/**
 * Calcula o equivalente mensal de um preço anual
 * @param annualPriceInCents Preço anual em centavos
 * @returns Equivalente mensal em centavos
 */
export function calculateMonthlyEquivalent(annualPriceInCents: number): number {
  return Math.round(annualPriceInCents / 12)
}

/**
 * Calcula o desconto percentual do plano anual em relação ao plano mensal
 * @param monthlyPriceInCents Preço mensal em centavos
 * @param annualPriceInCents Preço anual em centavos
 * @returns Desconto em percentual (ex: 0.37 = 37%)
 */
export function calculateDiscount(
  monthlyPriceInCents: number,
  annualPriceInCents: number
): number {
  const monthlyAnnualTotal = monthlyPriceInCents * 12
  const discount = 1 - (annualPriceInCents / monthlyAnnualTotal)
  return Math.max(0, Math.min(1, discount)) // Garantir entre 0 e 1
}

/**
 * Formata um desconto percentual para exibição
 * @param discount Desconto entre 0 e 1 (ex: 0.37 = 37%)
 * @returns String formatada (ex: "37%")
 */
export function formatDiscount(discount: number): string {
  const percentage = Math.round(discount * 100)
  return `${percentage}%`
}

