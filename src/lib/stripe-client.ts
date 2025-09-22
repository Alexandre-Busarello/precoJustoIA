import { loadStripe } from '@stripe/stripe-js'

// Verificar se a chave pública está definida
if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
}

// Criar instância do Stripe (singleton)
let stripePromise: Promise<any> | null = null

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}

// Configurações dos planos
export const PLANS = {
  monthly: {
    name: 'Premium Mensal',
    price: 47.00,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
    interval: 'month',
    description: 'Acesso completo a todos os recursos premium',
    features: [
      'Tudo do plano gratuito',
      '8 modelos de valuation',
      'Análise com IA (Gemini)',
      'Comparador ilimitado',
      'Rankings personalizáveis',
      'Análise individual completa',
      'Dados históricos de 5+ anos',
      'Suporte prioritário',
    ],
  },
  annual: {
    name: 'Premium Anual',
    price: 497.00,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID!,
    interval: 'year',
    description: 'Plano anual com 12% de desconto',
    originalPrice: 564.00,
    savings: 67.00,
    features: [
      'Tudo do Premium Mensal',
      '12% de desconto',
      'Acesso antecipado a novos recursos',
      'Relatórios mensais personalizados',
      'Suporte VIP',
    ],
  },
} as const

export type PlanType = keyof typeof PLANS

// Função para redirecionar para checkout
export async function redirectToCheckout(priceId: string) {
  try {
    const stripe = await getStripe()
    
    if (!stripe) {
      throw new Error('Stripe não foi carregado corretamente')
    }

    // Fazer chamada para API para criar sessão de checkout
    const response = await fetch('/api/checkout/create-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao criar sessão de checkout')
    }

    const { sessionId } = await response.json()

    // Redirecionar para o checkout
    const { error } = await stripe.redirectToCheckout({
      sessionId,
    })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Erro ao redirecionar para checkout:', error)
    throw error
  }
}

// Função para formatar preço em reais
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price)
}

// Função para calcular economia anual
export function calculateAnnualSavings(): number {
  const monthlyTotal = PLANS.monthly.price * 12
  const annualPrice = PLANS.annual.price
  return monthlyTotal - annualPrice
}

// Função para obter preço mensal do plano anual
export function getAnnualMonthlyPrice(): number {
  return PLANS.annual.price / 12
}
