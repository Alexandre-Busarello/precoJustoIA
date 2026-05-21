import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import {
  calcCaktoExpiration,
  createOrUpdateCaktoUser,
  removePremiumFromUser,
  sendCaktoWelcomeEmail,
} from '@/lib/cakto-user-service'

export const dynamic = 'force-dynamic'

interface CaktoPayload {
  event: string
  secret?: string
  data: {
    id?: string
    status?: string
    customer?: {
      email: string
      name?: string
    }
    subscription?: {
      id?: string
      next_payment?: string
    }
    subscription_period?: 'weekly' | 'monthly' | 'yearly'
  }
}

const PROCESSED_EVENTS = [
  'purchase_approved',
  'refund',
  'chargeback',
  'subscription_canceled',
  'subscription_renewed',
  'subscription_renewal_refused',
]

export async function POST(request: NextRequest) {
  const isTestMode = process.env.NODE_ENV === 'development' && process.env.ALLOW_TEST_WEBHOOK === 'true'

  let body: CaktoPayload
  try {
    body = JSON.parse(await request.text())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isTestMode) {
    const secret = process.env.CAKTO_WEBHOOK_SECRET
    if (!secret) {
      console.warn('⚠️ CAKTO_WEBHOOK_SECRET não configurado. Webhook rejeitado.')
      return NextResponse.json({ error: 'Secret inválido' }, { status: 401 })
    }
    if (body.secret !== secret) {
      console.error('❌ Cakto webhook: secret inválido')
      return NextResponse.json({ error: 'Secret inválido' }, { status: 401 })
    }
  }

  const event = body.event
  const data = body.data || {}

  if (!event || !PROCESSED_EVENTS.includes(event)) {
    console.log(`⚠️ Cakto webhook: evento ignorado (${event ?? 'nenhum'})`)
    return NextResponse.json({ success: true, message: 'Evento ignorado' })
  }

  const customerEmail = data.customer?.email ?? null
  let webhookEventId = ''

  try {
    const saved = await safeWrite(
      'save-cakto-webhook-event',
      () => prisma.webhookEvent.create({
        data: {
          provider: 'CAKTO',
          eventId: data.id ?? undefined,
          eventType: event,
          status: 'PROCESSING',
          rawData: body as object,
          processedData: { customerEmail, orderId: data.id, eventType: event },
          externalReference: data.id ?? undefined,
        },
      }),
      ['webhook_events']
    )
    webhookEventId = saved.id
    console.log(`💾 Cakto webhook salvo: ${webhookEventId} (${event})`)
  } catch (err) {
    console.error('❌ Falha ao salvar WebhookEvent:', err)
  }

  try {
    await dispatch(event, data)

    if (webhookEventId) {
      await safeWrite(
        'cakto-webhook-done',
        () => prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: { status: 'DONE', processedAt: new Date(), lastProcessedAt: new Date() },
        }),
        ['webhook_events']
      )
    }

    console.log(`✅ Cakto webhook processado: ${event}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error(`❌ Erro ao processar evento Cakto (${event}):`, err)

    if (webhookEventId) {
      await safeWrite(
        'cakto-webhook-failed',
        () => prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'FAILED',
            errorMessage,
            lastProcessedAt: new Date(),
            retryCount: { increment: 1 },
          },
        }),
        ['webhook_events']
      ).catch((e) => console.error('Erro ao atualizar status FAILED:', e))
    }

    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}

async function dispatch(event: string, data: CaktoPayload['data']): Promise<void> {
  switch (event) {
    case 'purchase_approved':
      await handlePurchaseApproved(data)
      break
    case 'refund':
    case 'chargeback':
    case 'subscription_canceled':
      if (data.customer?.email) {
        await removePremiumFromUser(data.customer.email)
      }
      break
    case 'subscription_renewed':
      await handleRenewal(data)
      break
    case 'subscription_renewal_refused':
      console.log('ℹ️ subscription_renewal_refused — sem ação')
      break
  }
}

async function handlePurchaseApproved(data: CaktoPayload['data']): Promise<void> {
  if (data.status !== 'paid') {
    console.log(`⚠️ purchase_approved ignorado: status=${data.status}`)
    return
  }

  const email = data.customer?.email
  if (!email) throw new Error('Email ausente no payload purchase_approved')

  const expirationDate = calcCaktoExpiration({
    customer: data.customer!,
    subscription: data.subscription,
    subscription_period: data.subscription_period,
  })

  const { user, isNewUser } = await createOrUpdateCaktoUser(
    email,
    data.customer?.name,
    data.subscription?.id,
    data.id,
    expirationDate
  )

  const wasFreeBefore = !isNewUser && user.subscriptionTier !== 'PREMIUM'
  if (isNewUser || wasFreeBefore) {
    await sendCaktoWelcomeEmail(email, data.customer?.name)
  }
}

async function handleRenewal(data: CaktoPayload['data']): Promise<void> {
  const email = data.customer?.email
  if (!email) throw new Error('Email ausente no payload subscription_renewed')

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  })

  if (!user) {
    console.warn(`⚠️ subscription_renewed: usuário não encontrado para ${email}`)
    return
  }

  const expirationDate = calcCaktoExpiration({
    customer: data.customer!,
    subscription: data.subscription,
    subscription_period: data.subscription_period,
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionTier: 'PREMIUM', premiumExpiresAt: expirationDate, lastPremiumAt: new Date() },
  })
}
