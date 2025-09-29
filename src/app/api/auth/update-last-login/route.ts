import { NextRequest, NextResponse } from 'next/server'
import { updateLastLogin } from '@/lib/alfa-service'

/**
 * API para atualizar o último login do usuário
 * Chamada pelo middleware para rastrear atividade
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (chamada interna)
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'internal'}`
    
    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }
    
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      )
    }
    
    await updateLastLogin(userId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao atualizar último login:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
