import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email-service'
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

    // Enviar email
    const emailResult = await sendPasswordResetEmail(
      user.email,
      resetUrl,
      user.name || undefined
    )

    if (!emailResult.success) {
      console.error('❌ Erro ao enviar email de reset:', emailResult.error)
      
      // Marcar token como usado se o email falhou
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

    console.log(`✅ Email de reset enviado para: ${email}`)

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
          errors: error.errors 
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
