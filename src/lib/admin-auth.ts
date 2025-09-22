import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * Verifica se o usuário é administrador
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    })

    return user?.isAdmin || false
  } catch (error) {
    console.error('Erro ao verificar se usuário é admin:', error)
    return false
  }
}

/**
 * Middleware para verificar acesso de admin em rotas da API
 */
export async function requireAdminAccess(): Promise<NextResponse | null> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userIsAdmin = await isAdmin(session.user.id)
    
    if (!userIsAdmin) {
      return NextResponse.json({ 
        error: 'Acesso negado. Apenas administradores podem acessar este recurso.' 
      }, { status: 403 })
    }

    return null // Acesso permitido
  } catch (error) {
    console.error('Erro ao verificar acesso de admin:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * Hook para verificar se o usuário atual é admin (para uso em componentes)
 */
export async function getCurrentUserAdminStatus(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return false
    }

    return await isAdmin(session.user.id)
  } catch (error) {
    console.error('Erro ao verificar status de admin do usuário atual:', error)
    return false
  }
}

/**
 * Cria um usuário admin (função utilitária para setup inicial)
 */
export async function makeUserAdmin(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`Usuário com email ${email} não encontrado`)
      return false
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true }
    })

    console.log(`Usuário ${email} agora é administrador`)
    return true
  } catch (error) {
    console.error('Erro ao tornar usuário admin:', error)
    return false
  }
}

/**
 * Lista todos os administradores
 */
export async function listAdmins() {
  try {
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            assignedTickets: true
          }
        }
      },
    })

    return admins
  } catch (error) {
    console.error('Erro ao listar admins:', error)
    return []
  }
}
