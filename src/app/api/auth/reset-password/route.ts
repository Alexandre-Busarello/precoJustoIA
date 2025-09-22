import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z.string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'A senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula e 1 número')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar dados de entrada
    const validatedData = resetPasswordSchema.parse(body)
    const { token, password } = validatedData

    // Buscar token válido
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        expires: true,
        used: true
      }
    })

    // Verificar se token existe
    if (!resetToken) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Token inválido ou expirado' 
        },
        { status: 400 }
      )
    }

    // Verificar se token já foi usado
    if (resetToken.used) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Este link já foi utilizado. Solicite um novo reset de senha.' 
        },
        { status: 400 }
      )
    }

    // Verificar se token expirou
    if (resetToken.expires < new Date()) {
      // Marcar token como usado
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })

      return NextResponse.json(
        { 
          success: false, 
          message: 'Token expirado. Solicite um novo reset de senha.' 
        },
        { status: 400 }
      )
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true, email: true }
    })

    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Usuário não encontrado' 
        },
        { status: 404 }
      )
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 12)

    // Usar transação para garantir consistência
    await prisma.$transaction(async (tx) => {
      // Atualizar senha do usuário
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      })

      // Marcar token como usado
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })

      // Invalidar todos os outros tokens não usados para este email
      await tx.passwordResetToken.updateMany({
        where: {
          email: resetToken.email,
          used: false,
          id: { not: resetToken.id }
        },
        data: { used: true }
      })
    })

    console.log(`✅ Senha redefinida com sucesso para: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.'
    })

  } catch (error) {
    console.error('❌ Erro no endpoint reset-password:', error)

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

// Endpoint para validar token (opcional - para verificar se token é válido antes do usuário digitar a senha)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Token é obrigatório' 
        },
        { status: 400 }
      )
    }

    // Buscar token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        email: true,
        expires: true,
        used: true
      }
    })

    if (!resetToken) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Token inválido' 
        },
        { status: 400 }
      )
    }

    if (resetToken.used) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Este link já foi utilizado' 
        },
        { status: 400 }
      )
    }

    if (resetToken.expires < new Date()) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Token expirado' 
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      email: resetToken.email.replace(/(.{2}).*(@.*)/, '$1***$2') // Mascarar email para privacidade
    })

  } catch (error) {
    console.error('❌ Erro ao validar token:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno do servidor' 
      },
      { status: 500 }
    )
  }
}
