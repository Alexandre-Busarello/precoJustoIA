import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/link-google-account
 * Vincula conta Google a uma conta existente após login com email/senha
 * Deve ser chamado quando usuário está autenticado e quer vincular Google
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar se já existe Account do Google para este usuário
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    })

    if (existingAccount) {
      return NextResponse.json({ 
        success: true,
        message: 'Conta Google já está vinculada'
      })
    }

    // Retornar sucesso - o linking real será feito no próximo login OAuth
    // Este endpoint apenas confirma que o usuário quer vincular
    return NextResponse.json({ 
      success: true,
      message: 'Pronto para vincular conta Google. Faça login com Google novamente.'
    })
  } catch (error) {
    console.error('Erro ao vincular conta Google:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

