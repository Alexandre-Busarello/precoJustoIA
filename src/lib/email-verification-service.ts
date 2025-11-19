import { prisma } from '@/lib/prisma'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'
import { sendEmail } from './email-service'
import { generateEmailVerificationTemplate } from './email-service'
import * as crypto from 'crypto'

/**
 * SERVIÇO DE VERIFICAÇÃO DE EMAIL
 * 
 * Gerencia verificação de email para prevenir contas com emails fake
 * e garantir que apenas emails válidos recebam TRIAL
 */

const TOKEN_EXPIRY_HOURS = 24 // Token expira em 24 horas
const MAX_RESEND_ATTEMPTS = 3 // Máximo de tentativas de reenvio por hora

/**
 * Gera token único para verificação de email
 */
export async function generateVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date()
  expires.setHours(expires.getHours() + TOKEN_EXPIRY_HOURS)

  // Usar VerificationToken do NextAuth (já existe no schema)
  // Nota: VerificationToken não tem safeQueryWithParams, então usamos prisma diretamente
  await prisma.verificationToken.upsert({
    where: {
      identifier_token: {
        identifier: userId,
        token: token
      }
    },
    create: {
      identifier: userId,
      token: token,
      expires: expires
    },
    update: {
      token: token,
      expires: expires
    }
  })

  return token
}

/**
 * Envia email de verificação
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await generateVerificationToken(userId)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://precojusto.ai'
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`

    const template = generateEmailVerificationTemplate(verificationUrl, userName)

    const result = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar email de verificação:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

/**
 * Verifica token de email e marca email como verificado
 */
export async function verifyEmailToken(
  token: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Buscar token válido
    const verificationToken = await safeQueryWithParams(
      'find-verification-token',
      () => prisma.verificationToken.findUnique({
        where: { token }
      }),
      { token }
    )

    if (!verificationToken) {
      return {
        success: false,
        error: 'Token inválido ou não encontrado'
      }
    }

    // Verificar se token expirou
    if (verificationToken.expires < new Date()) {
      // Deletar token expirado
      await prisma.verificationToken.delete({
        where: { token }
      })

      return {
        success: false,
        error: 'Token expirado. Solicite um novo link de verificação.'
      }
    }

    const userId = verificationToken.identifier

    // Verificar se usuário existe
    const user = await safeQueryWithParams(
      'find-user-for-verification',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true
        }
      }),
      { userId }
    )

    if (!user) {
      return {
        success: false,
        error: 'Usuário não encontrado'
      }
    }

    // Se já está verificado, retornar sucesso mas não fazer nada
    if (user.emailVerified) {
      return {
        success: true,
        userId: user.id
      }
    }

    // Marcar email como verificado
    await safeWrite(
      'verify-email',
      () => prisma.user.update({
        where: { id: userId },
        data: {
          emailVerified: new Date()
        }
      }),
      ['users']
    )

    // Deletar token usado
    await prisma.verificationToken.delete({
      where: { token }
    })

    return {
      success: true,
      userId: user.id
    }
  } catch (error) {
    console.error('Erro ao verificar token de email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao verificar email'
    }
  }
}

/**
 * Verifica se email está verificado
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const user = await safeQueryWithParams(
      'check-email-verified',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailVerified: true
        }
      }),
      { userId }
    )

    return user?.emailVerified !== null && user?.emailVerified !== undefined
  } catch (error) {
    console.error('Erro ao verificar status de email:', error)
    return false
  }
}

/**
 * Verifica se usuário precisa verificar email (criado há mais de 1 dia sem verificação)
 */
export async function requiresEmailVerification(userId: string): Promise<boolean> {
  try {
    const user = await safeQueryWithParams(
      'check-email-verification-required',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailVerified: true,
          createdAt: true
        }
      }),
      { userId }
    ) as { emailVerified: Date | null; createdAt: Date } | null

    if (!user) {
      return false
    }

    // Se já está verificado, não precisa verificar
    if (user.emailVerified) {
      return false
    }

    // Se foi criado há menos de 1 dia, não precisa verificar ainda
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
    return user.createdAt < oneDayAgo
  } catch (error) {
    console.error('Erro ao verificar necessidade de verificação de email:', error)
    return false // Em caso de erro, não bloquear acesso
  }
}

/**
 * Reenvia email de verificação (com rate limiting)
 */
export async function resendVerificationEmail(
  userId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Verificar se email já está verificado
    const verified = await isEmailVerified(userId)
    if (verified) {
      return {
        success: false,
        error: 'Email já está verificado'
      }
    }

    // Buscar usuário para obter email
    const user = await safeQueryWithParams(
      'find-user-for-resend',
      () => prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true
        }
      }),
      { userId }
    )

    if (!user) {
      return {
        success: false,
        error: 'Usuário não encontrado'
      }
    }

    // Verificar rate limit de reenvio (simples - contar tokens criados na última hora)
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const recentTokens = await prisma.verificationToken.findMany({
      where: {
        identifier: userId,
        expires: {
          gte: oneHourAgo
        }
      }
    })

    if (recentTokens.length >= MAX_RESEND_ATTEMPTS) {
      return {
        success: false,
        error: `Você já solicitou ${MAX_RESEND_ATTEMPTS} emails de verificação na última hora. Aguarde um pouco antes de tentar novamente.`
      }
    }

    // Enviar email
    const result = await sendVerificationEmail(user.id, user.email, user.name || undefined)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Erro ao enviar email'
      }
    }

    return {
      success: true,
      message: 'Email de verificação enviado com sucesso!'
    }
  } catch (error) {
    console.error('Erro ao reenviar email de verificação:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao reenviar email'
    }
  }
}

