import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { EmailQueueService } from './email-queue-service'

/**
 * SERVIÇO DE GERENCIAMENTO DE USUÁRIOS KIWIFY
 * 
 * Gerencia criação e atualização de usuários vindos do webhook do Kiwify
 */

/**
 * Gera uma senha aleatória segura
 */
export function generateRandomPassword(): string {
  // Gerar senha com 24 caracteres: letras minúsculas, maiúsculas, números e símbolos
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%&*'
  const allChars = lowercase + uppercase + numbers + symbols
  
  let password = ''
  
  // Garantir pelo menos um de cada tipo
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // Preencher o resto aleatoriamente
  for (let i = password.length; i < 24; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Embaralhar a senha
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * Gera nome de investidor baseado no email
 */
function generateInvestorName(email: string): string {
  const emailPart = email.split('@')[0]
  const name = emailPart
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return name || 'Investidor'
}

/**
 * Cria ou atualiza usuário do Kiwify
 * 
 * @param email Email do cliente
 * @param name Nome do cliente (opcional)
 * @param kiwifyId ID da subscription no Kiwify
 * @param kiwifyOrderId ID do pedido no Kiwify
 * @param nextPaymentDate Data de próximo pagamento (opcional, padrão: hoje + 12 meses)
 * @returns Objeto com user e isNewUser
 */
export async function createOrUpdateKiwifyUser(
  email: string,
  name?: string,
  kiwifyId?: string,
  kiwifyOrderId?: string,
  nextPaymentDate?: Date
): Promise<{ user: any; isNewUser: boolean }> {
  const emailLower = email.toLowerCase().trim()
  const userName = name?.trim() || generateInvestorName(emailLower)
  
  // Buscar usuário existente
  const existingUser = await prisma.user.findUnique({
    where: { email: emailLower },
    select: {
      id: true,
      subscriptionTier: true,
      premiumExpiresAt: true,
      password: true,
    },
  })

  // Calcular data de expiração
  const now = new Date()
  let expirationDate: Date
  
  if (nextPaymentDate) {
    expirationDate = new Date(nextPaymentDate)
  } else {
    // Padrão: 12 meses a partir de hoje
    expirationDate = new Date(now)
    expirationDate.setMonth(expirationDate.getMonth() + 12)
  }

  // Se usuário já existe e é Premium, estender assinatura
  if (existingUser && existingUser.subscriptionTier === 'PREMIUM' && existingUser.premiumExpiresAt) {
    const currentExpiration = new Date(existingUser.premiumExpiresAt)
    // Usar a data mais distante: atual ou nova
    expirationDate = currentExpiration > expirationDate ? currentExpiration : expirationDate
  }

  if (existingUser) {
    // Atualizar usuário existente
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: expirationDate,
        kiwifyId: kiwifyId || undefined,
        kiwifyOrderId: kiwifyOrderId || undefined,
        lastPremiumAt: now,
        // Atualizar firstPremiumAt apenas se não tiver
        firstPremiumAt: existingUser.subscriptionTier !== 'PREMIUM' ? now : undefined,
        // Incrementar premiumCount se estava FREE antes
        premiumCount: existingUser.subscriptionTier !== 'PREMIUM' 
          ? { increment: 1 }
          : undefined,
        wasPremiumBefore: true,
      },
    })

    return { user: updatedUser, isNewUser: false }
  } else {
    // Criar novo usuário
    const randomPassword = generateRandomPassword()
    const hashedPassword = await bcrypt.hash(randomPassword, 12)

    const newUser = await prisma.user.create({
      data: {
        email: emailLower,
        name: userName,
        password: hashedPassword,
        subscriptionTier: 'PREMIUM',
        premiumExpiresAt: expirationDate,
        kiwifyId: kiwifyId || undefined,
        kiwifyOrderId: kiwifyOrderId || undefined,
        firstPremiumAt: now,
        lastPremiumAt: now,
        premiumCount: 1,
        wasPremiumBefore: false,
        emailVerified: null, // Será verificado quando configurar senha
        acquisition: 'kiwify',
      },
    })

    return { user: newUser, isNewUser: true }
  }
}

/**
 * Envia email de boas-vindas com link de primeiro acesso
 * 
 * @param email Email do usuário
 * @param userName Nome do usuário
 * @returns Resultado do envio
 */
export async function sendWelcomeEmailWithPasswordReset(
  email: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailLower = email.toLowerCase().trim()

    // Gerar token de reset de senha único
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

    // Invalidar tokens anteriores para este email
    await prisma.passwordResetToken.updateMany({
      where: {
        email: emailLower,
        used: false,
        expires: { gt: new Date() },
      },
      data: { used: true },
    })

    // Criar novo token
    await prisma.passwordResetToken.create({
      data: {
        email: emailLower,
        token: resetToken,
        expires,
        used: false,
      },
    })

    // Construir URL de primeiro acesso
    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/redefinir-senha?token=${resetToken}`

    // Enviar email via fila
    const result = await EmailQueueService.queueEmail({
      email: emailLower,
      emailType: 'KIWIFY_WELCOME',
      recipientName: userName || null,
      emailData: {
        resetUrl,
        userName: userName || 'Investidor',
      },
      priority: 1, // Prioridade alta para emails de boas-vindas
      metadata: {
        source: 'kiwify',
      },
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Erro ao adicionar email à fila',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

