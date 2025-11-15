import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres'),
})

/**
 * PUT /api/profile/update-password
 * Atualiza a senha do usuário
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = updatePasswordSchema.parse(body)
    const { currentPassword, newPassword } = validatedData

    // Buscar usuário com senha
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userWithPassword || !userWithPassword.password) {
      return NextResponse.json(
        { error: 'Usuário não possui senha cadastrada. Use o login social.' },
        { status: 400 }
      )
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Senha atual incorreta' },
        { status: 400 }
      )
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await safeWrite(
      'update-user-password',
      () => prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      }),
      ['users']
    )

    return NextResponse.json({
      success: true,
      message: 'Senha atualizada com sucesso'
    })
  } catch (error) {
    console.error('Erro ao atualizar senha:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', errors: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

