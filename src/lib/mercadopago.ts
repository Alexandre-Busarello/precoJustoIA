import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import crypto from 'crypto'

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  throw new Error('MERCADOPAGO_ACCESS_TOKEN is not set')
}

if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
  throw new Error('MERCADOPAGO_WEBHOOK_SECRET is not set')
}

// Configurar MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: { timeout: 5000 }
})

export const payment = new Payment(client)
export const preference = new Preference(client)

// URLs de redirecionamento
export const MERCADOPAGO_URLS = {
  success: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/checkout/success`,
  failure: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/checkout/cancel`,
  pending: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/checkout/pending`,
}

// Função para criar pagamento PIX direto (seguindo documentação oficial)
export async function createPixPayment({
  planType,
  amount,
  userId,
  userEmail,
  userName,
  idempotencyKey,
}: {
  planType: 'monthly' | 'annual'
  amount: number // Preço em reais (ex: 19.90)
  userId: string
  userEmail: string
  userName?: string
  idempotencyKey?: string
}) {
  try {
    // Descrições dos planos
    const descriptions: Record<string, string> = {
      monthly: 'Preço Justo AI - Premium Mensal',
      annual: 'Preço Justo AI - Premium Anual',
    }
    
    // Gerar uma chave de idempotência única se não fornecida
    const finalIdempotencyKey = idempotencyKey || `pix-${userId}-${planType}-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    const paymentData = {
      transaction_amount: amount,
      description: descriptions[planType] || `Preço Justo AI - ${planType}`,
      payment_method_id: 'pix',
      payer: {
        email: userEmail,
        first_name: userName?.split(' ')[0] || userEmail.split('@')[0] || 'Usuario',
        last_name: userName?.split(' ').slice(1).join(' ') || 'Premium',
        identification: {
          type: 'CPF',
          number: '19119119100', // CPF de teste válido
        },
      },
      // Metadados para rastreamento
      metadata: {
        user_id: userId,
        plan_type: planType,
        integration: 'preco-justo-ai'
      },
      // External reference para identificação
      external_reference: `${userId}-${planType}-${Date.now()}`,
      // Só adicionar notification_url em produção
      ...(process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost') 
        ? { notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago` }
        : {}
      ),
    }

    console.log('Dados do pagamento PIX:', JSON.stringify(paymentData, null, 2))
    console.log('Idempotency Key:', finalIdempotencyKey)
    
    const response = await payment.create({ 
      body: paymentData,
      requestOptions: {
        idempotencyKey: finalIdempotencyKey,
      }
    })
    
    console.log('Resposta do MercadoPago:', {
      id: response.id,
      status: response.status,
      status_detail: response.status_detail,
      has_qr_code: !!response.point_of_interaction?.transaction_data?.qr_code,
      has_qr_code_base64: !!response.point_of_interaction?.transaction_data?.qr_code_base64
    })
    
    return {
      id: response.id,
      status: response.status,
      status_detail: response.status_detail,
      qr_code: response.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      ticket_url: response.point_of_interaction?.transaction_data?.ticket_url,
      external_reference: response.external_reference,
    }
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error)
    
    // Log detalhado do erro para debug
    if (error && typeof error === 'object' && 'cause' in error) {
      console.error('Detalhes do erro:', error.cause)
    }
    
    throw error
  }
}

// Função para verificar status do pagamento
export async function getPaymentStatus(paymentId: string) {
  try {
    const paymentData = await payment.get({ id: paymentId })
    return paymentData
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error)
    throw error
  }
}

// Função para processar webhook do MercadoPago
export async function processWebhookNotification(data: any) {
  try {
    console.log('Processando webhook notification:', data)
    
    if (data.type === 'payment' || data.action === 'payment.updated') {
      const paymentId = data.data?.id || data.id
      
      if (paymentId) {
        console.log('Buscando dados do pagamento:', paymentId)
        
        const paymentData = await payment.get({ id: paymentId })
        
        console.log('Dados do pagamento obtidos:', {
          id: paymentData.id,
          status: paymentData.status,
          status_detail: paymentData.status_detail,
          external_reference: paymentData.external_reference,
          transaction_amount: paymentData.transaction_amount,
          payment_method_id: paymentData.payment_method_id,
        })
        
        return {
          id: paymentData.id,
          status: paymentData.status,
          status_detail: paymentData.status_detail,
          external_reference: paymentData.external_reference,
          metadata: paymentData.metadata,
          transaction_amount: paymentData.transaction_amount,
          payment_method_id: paymentData.payment_method_id,
          date_approved: paymentData.date_approved,
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    throw error
  }
}

// Função para validar assinatura do webhook MercadoPago
export function validateWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  rawBody: string
): boolean {
  try {
    if (!xSignature || !xRequestId || !dataId) {
      console.error('❌ Missing required headers for webhook validation')
      return false
    }

    // Extrair timestamp e assinatura do cabeçalho x-signature
    // Formato: ts=1234567890,v1=hash_value
    const parts = xSignature.split(',')
    let ts = ''
    let receivedSignature = ''

    for (const part of parts) {
      const [key, value] = part.split('=')
      if (key === 'ts') {
        ts = value
      } else if (key === 'v1') {
        receivedSignature = value
      }
    }

    if (!ts || !receivedSignature) {
      console.error('❌ Invalid x-signature format')
      return false
    }

    // Construir string de assinatura conforme documentação do MercadoPago
    const signatureTemplate = `id:${dataId};request-id:${xRequestId};ts:${ts};`
    
    console.log('🔍 Webhook signature validation:', {
      dataId,
      xRequestId,
      ts,
      signatureTemplate,
      receivedSignature: receivedSignature.substring(0, 10) + '...'
    })

    // Calcular assinatura HMAC SHA256
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET!
    const calculatedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureTemplate)
      .digest('hex')

    // Comparar assinaturas de forma segura (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )

    if (!isValid) {
      console.error('❌ Webhook signature validation failed')
      console.error('Expected:', calculatedSignature.substring(0, 10) + '...')
      console.error('Received:', receivedSignature.substring(0, 10) + '...')
    } else {
      console.log('✅ Webhook signature validated successfully')
    }

    return isValid
  } catch (error) {
    console.error('❌ Error validating webhook signature:', error)
    return false
  }
}
