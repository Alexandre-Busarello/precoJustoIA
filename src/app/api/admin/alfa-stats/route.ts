import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/user-service'
import { getAlfaStats } from '@/lib/alfa-service'
import { prisma } from '@/lib/prisma'

/**
 * API para administradores visualizarem estatísticas detalhadas da fase Alfa
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se é admin
    const adminUser = await requireAdminUser()
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }
    
    // Obter estatísticas básicas
    const basicStats = await getAlfaStats()
    
    // Obter dados detalhados
    const inactiveUsers = await prisma.user.findMany({
      where: {
        isInactive: true,
        isEarlyAdopter: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        lastLoginAt: true,
        inactivatedAt: true
      },
      orderBy: {
        inactivatedAt: 'desc'
      }
    })
    
    const waitlistUsers = await prisma.alfaWaitlist.findMany({
      where: {
        isInvited: false
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    
    const recentlyInvited = await prisma.alfaWaitlist.findMany({
      where: {
        isInvited: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        invitedAt: true
      },
      orderBy: {
        invitedAt: 'desc'
      },
      take: 10
    })
    
    return NextResponse.json({
      ...basicStats,
      details: {
        inactiveUsers,
        waitlistUsers,
        recentlyInvited
      }
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas da fase Alfa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * API para reativar um usuário manualmente (admin)
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se é admin
    const adminUser = await requireAdminUser()
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }
    
    const { userId, action } = await request.json()
    
    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId e action são obrigatórios' },
        { status: 400 }
      )
    }
    
    if (action === 'reactivate') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isInactive: false,
          inactivatedAt: null,
          lastLoginAt: new Date()
        }
      })
      
      return NextResponse.json({
        success: true,
        message: 'Usuário reativado com sucesso'
      })
    }
    
    return NextResponse.json(
      { error: 'Ação não reconhecida' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Erro ao processar ação admin:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
