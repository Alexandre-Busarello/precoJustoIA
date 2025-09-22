import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'

// GET /api/admin/users - Listar usuários admin (apenas admins)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin - ÚNICA FONTE DA VERDADE
    const user = await requireAdminUser()

    if (!user) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem acessar este endpoint.' }, { status: 403 })
    }

    const admins = await prisma.user.findMany({
      where: {
        isAdmin: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            assignedTickets: {
              where: {
                status: {
                  in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN']
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(admins)

  } catch (error) {
    console.error('Erro ao buscar admins:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
