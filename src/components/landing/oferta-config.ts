/**
 * Constantes da landing /oferta. Ficam num módulo sem 'use client' para poderem ser
 * lidas tanto pelo server component (metadata, fallbacks do Suspense) quanto pelos
 * botões client. Exportar valores de um módulo 'use client' e usá-los no servidor
 * gera uma client reference (função), não a string.
 */

/** Preço promocional exibido na landing /oferta (valor definido pela campanha). */
export const OFERTA_MONTHLY_PRICE_LABEL = "R$ 17,99"
/** Link estático usado no fallback do Suspense, antes de a URL do checkout (com UTMs) ser resolvida. */
export const OFERTA_FALLBACK_CHECKOUT_URL = "https://pay.kiwify.com.br/kV1DuGv"
