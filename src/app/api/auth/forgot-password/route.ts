import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmailQueueService } from '@/lib/email-queue-service'
import crypto from 'crypto'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar dados de entrada
    const validatedData = forgotPasswordSchema.parse(body)
    const { email } = validatedData

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true }
    })

    // Por segurança, sempre retornar sucesso mesmo se o email não existir
    // Isso evita que atacantes descubram quais emails estão cadastrados
    if (!user) {
      console.log(`🔍 Tentativa de reset para email não cadastrado: ${email}`)
      return NextResponse.json({
        success: true,
        message: 'Se este email estiver cadastrado, você receberá as instruções para redefinir sua senha.'
      })
    }

    // Gerar token único e seguro
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    // Invalidar tokens anteriores para este email
    await prisma.passwordResetToken.updateMany({
      where: { 
        email: email.toLowerCase(),
        used: false,
        expires: { gt: new Date() }
      },
      data: { used: true }
    })

    // Criar novo token
    await prisma.passwordResetToken.create({
      data: {
        email: email.toLowerCase(),
        token: resetToken,
        expires,
        used: false
      }
    })

    // Construir URL de reset
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/redefinir-senha?token=${resetToken}`

    // Adicionar email à fila (tenta enviar imediatamente)
    const emailResult = await EmailQueueService.queueEmail({
      email: user.email,
      emailType: 'PASSWORD_RESET',
      recipientName: user.name || null,
      emailData: {
        resetUrl,
        userName: user.name || undefined
      },
      priority: 1, // Prioridade alta para emails críticos
      metadata: {
        userId: user.id,
        token: resetToken
      }
    })

    if (!emailResult.success) {
      console.error('❌ Erro ao adicionar email de reset à fila:', emailResult.error)
      
      // Marcar token como usado se falhou ao adicionar à fila
      await prisma.passwordResetToken.updateMany({
        where: { token: resetToken },
        data: { used: true }
      })

      return NextResponse.json(
        { 
          success: false, 
          message: 'Erro interno. Tente novamente em alguns minutos.' 
        },
        { status: 500 }
      )
    }

    console.log(`✅ Email de reset ${emailResult.sent ? 'enviado' : 'adicionado à fila'} para: ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Se este email estiver cadastrado, você receberá as instruções para redefinir sua senha.'
    })

  } catch (error) {
    console.error('❌ Erro no endpoint forgot-password:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Dados inválidos',
          errors: error.issues 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno do servidor' 
      },
      { status: 500 }
    )
  }
}
