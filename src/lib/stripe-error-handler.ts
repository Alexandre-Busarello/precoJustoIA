export interface StripeErrorInfo {
  title: string
  message: string
  suggestion: string
  canRetry: boolean
  requiresNewCard: boolean
  icon: 'card' | 'warning' | 'clock' | 'shield' | 'alert'
  severity: 'error' | 'warning' | 'info'
}

export const STRIPE_ERROR_MESSAGES: Record<string, StripeErrorInfo> = {
  // Erros de cartão
  card_declined: {
    title: 'Cartão Recusado',
    message: 'Seu cartão foi recusado pelo banco.',
    suggestion: 'Verifique os dados do cartão ou tente com outro cartão.',
    canRetry: true,
    requiresNewCard: true,
    icon: 'card',
    severity: 'error'
  },
  expired_card: {
    title: 'Cartão Expirado',
    message: 'A data de validade do seu cartão expirou.',
    suggestion: 'Verifique a data de validade ou use outro cartão.',
    canRetry: true,
    requiresNewCard: true,
    icon: 'clock',
    severity: 'error'
  },
  incorrect_cvc: {
    title: 'CVV Incorreto',
    message: 'O código de segurança (CVV) está incorreto.',
    suggestion: 'Verifique o código de 3 dígitos no verso do cartão.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'shield',
    severity: 'error'
  },
  invalid_cvc: {
    title: 'CVV Inválido',
    message: 'O código de segurança (CVV) é inválido.',
    suggestion: 'Digite o código de 3 dígitos no verso do cartão.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'shield',
    severity: 'error'
  },
  incorrect_number: {
    title: 'Número Incorreto',
    message: 'O número do cartão está incorreto.',
    suggestion: 'Verifique o número do cartão ou use outro cartão.',
    canRetry: true,
    requiresNewCard: true,
    icon: 'card',
    severity: 'error'
  },
  invalid_number: {
    title: 'Número Inválido',
    message: 'O número do cartão é inválido.',
    suggestion: 'Digite um número de cartão válido.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'card',
    severity: 'error'
  },
  incorrect_address: {
    title: 'Endereço Incorreto',
    message: 'O endereço de cobrança não confere.',
    suggestion: 'Verifique o endereço cadastrado no seu cartão.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'warning',
    severity: 'error'
  },
  incorrect_zip: {
    title: 'CEP Incorreto',
    message: 'O CEP não confere com o cadastrado no cartão.',
    suggestion: 'Verifique o CEP do endereço de cobrança.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'warning',
    severity: 'error'
  },
  invalid_expiry_month: {
    title: 'Mês de Validade Inválido',
    message: 'O mês de validade do cartão é inválido.',
    suggestion: 'Digite um mês válido (01-12).',
    canRetry: true,
    requiresNewCard: false,
    icon: 'clock',
    severity: 'error'
  },
  invalid_expiry_year: {
    title: 'Ano de Validade Inválido',
    message: 'O ano de validade do cartão é inválido.',
    suggestion: 'Digite um ano válido.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'clock',
    severity: 'error'
  },
  
  // Erros de processamento
  processing_error: {
    title: 'Erro de Processamento',
    message: 'Ocorreu um erro ao processar o pagamento.',
    suggestion: 'Tente novamente em alguns minutos ou use outro cartão.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'alert',
    severity: 'warning'
  },
  authentication_required: {
    title: 'Autenticação Necessária',
    message: 'Seu banco requer autenticação adicional.',
    suggestion: 'Complete a autenticação solicitada pelo seu banco.',
    canRetry: true,
    requiresNewCard: false,
    icon: 'shield',
    severity: 'info'
  },
  
  // Erros de limite
  card_decline_rate_limit_exceeded: {
    title: 'Muitas Tentativas',
    message: 'Este cartão foi recusado muitas vezes.',
    suggestion: 'Aguarde 24 horas ou use outro cartão.',
    canRetry: false,
    requiresNewCard: true,
    icon: 'warning',
    severity: 'error'
  },
  amount_too_large: {
    title: 'Valor Muito Alto',
    message: 'O valor excede o limite permitido.',
    suggestion: 'Entre em contato conosco para valores maiores.',
    canRetry: false,
    requiresNewCard: false,
    icon: 'warning',
    severity: 'error'
  },
  amount_too_small: {
    title: 'Valor Muito Baixo',
    message: 'O valor é menor que o mínimo permitido.',
    suggestion: 'Escolha um plano com valor maior.',
    canRetry: false,
    requiresNewCard: false,
    icon: 'warning',
    severity: 'error'
  },
  
  // Erros de conta/saldo
  balance_insufficient: {
    title: 'Saldo Insuficiente',
    message: 'Não há saldo suficiente no cartão.',
    suggestion: 'Verifique o saldo ou use outro cartão.',
    canRetry: true,
    requiresNewCard: true,
    icon: 'warning',
    severity: 'error'
  },
  
  // Erros de configuração
  testmode_charges_only: {
    title: 'Modo de Teste',
    message: 'A conta está em modo de teste.',
    suggestion: 'Entre em contato com o suporte.',
    canRetry: false,
    requiresNewCard: false,
    icon: 'alert',
    severity: 'warning'
  },
  
  // Erro genérico
  generic_decline: {
    title: 'Pagamento Recusado',
    message: 'O pagamento foi recusado.',
    suggestion: 'Tente com outro cartão ou método de pagamento.',
    canRetry: true,
    requiresNewCard: true,
    icon: 'card',
    severity: 'error'
  }
}

export function getStripeErrorInfo(errorCode?: string, declineCode?: string): StripeErrorInfo {
  // Primeiro, tenta encontrar por decline_code (mais específico)
  if (declineCode && STRIPE_ERROR_MESSAGES[declineCode]) {
    return STRIPE_ERROR_MESSAGES[declineCode]
  }
  
  // Depois, tenta encontrar por error code
  if (errorCode && STRIPE_ERROR_MESSAGES[errorCode]) {
    return STRIPE_ERROR_MESSAGES[errorCode]
  }
  
  // Fallback para erro genérico
  return STRIPE_ERROR_MESSAGES.generic_decline
}

export function formatStripeError(error: any): StripeErrorInfo & { originalError: any } {
  const errorInfo = getStripeErrorInfo(error?.code, error?.decline_code)
  
  return {
    ...errorInfo,
    originalError: error
  }
}

// Função para determinar se deve mostrar opção de tentar novamente
export function shouldShowRetryOption(errorInfo: StripeErrorInfo): boolean {
  return errorInfo.canRetry && !errorInfo.requiresNewCard
}

// Função para determinar se deve mostrar opção de novo cartão
export function shouldShowNewCardOption(errorInfo: StripeErrorInfo): boolean {
  return errorInfo.requiresNewCard
}

// Função para obter a cor do tema baseada na severidade
export function getSeverityColor(severity: StripeErrorInfo['severity']): string {
  switch (severity) {
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'info':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}
