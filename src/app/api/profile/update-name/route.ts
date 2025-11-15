import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import { z } from 'zod'

const updateNameSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
})

/**
 * PUT /api/profile/update-name
 * Atualiza o nome do usuário
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
    const validatedData = updateNameSchema.parse(body)
    const { name } = validatedData

    await safeWrite(
      'update-user-name',
      () => prisma.user.update({
        where: { id: user.id },
        data: { name: name.trim() }
      }),
      ['users']
    )

    return NextResponse.json({
      success: true,
      message: 'Nome atualizado com sucesso',
      name: name.trim()
    })
  } catch (error) {
    console.error('Erro ao atualizar nome:', error)

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

