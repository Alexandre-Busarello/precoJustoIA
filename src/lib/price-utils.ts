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

/**
 * Calcula o desconto de 15% para pagamento via PIX
 * @param priceInCents Preço em centavos
 * @returns Preço com desconto PIX em centavos
 */
export function calculatePixDiscount(priceInCents: number): number {
  return Math.round(priceInCents * 0.85) // 15% de desconto
}

/**
 * Calcula o valor do desconto PIX em centavos
 * @param priceInCents Preço original em centavos
 * @returns Valor do desconto em centavos
 */
export function getPixDiscountAmount(priceInCents: number): number {
  return Math.round(priceInCents * 0.15) // 15% de desconto
}

/**
 * Preços de fallback/estáticos usados enquanto os dados dinâmicos da API
 * de pricing (`/api/v1/pricing/offers`, com base na tabela `offers` no banco)
 * ainda não carregaram, e também no JSON-LD estático de SEO (que não pode
 * fazer fetch em tempo de renderização).
 *
 * IMPORTANTE: esta é a ÚNICA fonte de verdade para esses valores de fallback.
 * Não hardcode "R$ 19,90"/"R$ 189,90" (ou "19.90"/"189.90") em outros lugares —
 * importe estas constantes para evitar divergência entre UI e JSON-LD.
 * Caso o preço real cadastrado no banco mude, atualize aqui também.
 */
export const FALLBACK_MONTHLY_PRICE_IN_CENTS = 1990 // R$ 19,90
export const FALLBACK_ANNUAL_PRICE_IN_CENTS = 18990 // R$ 189,90

export const FALLBACK_MONTHLY_PRICE_FORMATTED = formatPrice(FALLBACK_MONTHLY_PRICE_IN_CENTS)
export const FALLBACK_ANNUAL_PRICE_FORMATTED = formatPrice(FALLBACK_ANNUAL_PRICE_IN_CENTS)

// Valor decimal sem símbolo de moeda, no formato exigido pelo schema.org (ex: "19.90")
export const FALLBACK_MONTHLY_PRICE_DECIMAL = (FALLBACK_MONTHLY_PRICE_IN_CENTS / 100).toFixed(2)
export const FALLBACK_ANNUAL_PRICE_DECIMAL = (FALLBACK_ANNUAL_PRICE_IN_CENTS / 100).toFixed(2)

