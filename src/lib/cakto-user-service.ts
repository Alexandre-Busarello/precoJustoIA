import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { EmailQueueService } from './email-queue-service'

interface CaktoWebhookData {
  id?: string
  status?: string
  subscription?: {
    id?: string
    next_payment?: string
  }
  subscription_period?: 'weekly' | 'monthly' | 'yearly'
  customer: {
    email: string
    name?: string
  }
}

function generateRandomPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'
  let password = 'aA1!'
  for (let i = password.length; i < 24; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

function generateInvestorName(email: string): string {
  const emailPart = email.split('@')[0]
  return emailPart
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Investidor'
}

export function calcCaktoExpiration(data: CaktoWebhookData): Date {
  if (data.subscription?.next_payment) {
    return new Date(data.subscription.next_payment)
  }
  const date = new Date()
  const period = data.subscription_period
  if (period === 'weekly') {
    date.setDate(date.getDate() + 7)
  } else if (period === 'monthly') {
    date.setMonth(date.getMonth() + 1)
  } else if (period === 'yearly') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 12)
  }
  return date
}

export async function createOrUpdateCaktoUser(
  email: string,
  name?: string,
  caktoId?: string,
  caktoOrderId?: string,
  nextPaymentDate?: Date
): Promise<{ user: { id: string; email: string; subscriptionTier: string }; isNewUser: boolean }> {
  const emailLower = email.toLowerCase().trim()
  const userName = name?.trim() || generateInvestorName(emailLower)

  const existingUser = await prisma.user.findUnique({
    where: { email: emailLower },
    select: { id: true, subscriptionTier: true, premiumExpiresAt: true },
  })

  const now = new Date()
  let expirationDate = nextPaymentDate ?? (() => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + 12)
    return d
  })()

  if (existingUser?.subscriptionTier === 'PREMIUM' && existingUser.premiumExpiresAt) {
    const current = new Date(existingUser.premiumExpiresAt)
    expirationDate = current > expirationDate ? current : expirationDate
  }

  if (existingUser) {
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: expirationDate,
        caktoId: caktoId ?? undefined,
        caktoOrderId: caktoOrderId ?? undefined,
        lastPremiumAt: now,
        firstPremiumAt: existingUser.subscriptionTier !== 'PREMIUM' ? now : undefined,
        premiumCount: existingUser.subscriptionTier !== 'PREMIUM' ? { increment: 1 } : undefined,
        wasPremiumBefore: true,
        acquisition: existingUser.subscriptionTier !== 'PREMIUM' ? 'cakto' : undefined,
      },
      select: { id: true, email: true, subscriptionTier: true },
    })
    return { user: updatedUser, isNewUser: false }
  }

  const hashedPassword = await bcrypt.hash(generateRandomPassword(), 12)
  const newUser = await prisma.user.create({
    data: {
      email: emailLower,
      name: userName,
      password: hashedPassword,
      subscriptionTier: 'PREMIUM',
      premiumExpiresAt: expirationDate,
      caktoId: caktoId ?? undefined,
      caktoOrderId: caktoOrderId ?? undefined,
      firstPremiumAt: now,
      lastPremiumAt: now,
      premiumCount: 1,
      wasPremiumBefore: false,
      acquisition: 'cakto',
    },
    select: { id: true, email: true, subscriptionTier: true },
  })
  return { user: newUser, isNewUser: true }
}

export async function sendCaktoWelcomeEmail(
  email: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailLower = email.toLowerCase().trim()
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.passwordResetToken.updateMany({
      where: { email: emailLower, used: false, expires: { gt: new Date() } },
      data: { used: true },
    })

    await prisma.passwordResetToken.create({
      data: { email: emailLower, token: resetToken, expires, used: false },
    })

    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/redefinir-senha?token=${resetToken}`

    const result = await EmailQueueService.queueEmail({
      email: emailLower,
      emailType: 'CAKTO_WELCOME',
      recipientName: userName || null,
      emailData: { resetUrl, userName: userName || 'Investidor' },
      priority: 1,
      metadata: { source: 'cakto' },
    })

    return result.success ? { success: true } : { success: false, error: result.error }
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas Cakto:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
  }
}

export async function removePremiumFromUser(email: string): Promise<boolean> {
  const emailLower = email.toLowerCase().trim()
  const user = await prisma.user.findUnique({
    where: { email: emailLower },
    select: { id: true },
  })

  if (!user) return false

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionTier: 'FREE', premiumExpiresAt: null },
  })

  return true
}
