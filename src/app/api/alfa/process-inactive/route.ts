import { NextRequest, NextResponse } from 'next/server'
import { findInactiveUsers, processInactiveUser } from '@/lib/alfa-service'

/**
 * API para processar usuários inativos na fase Alfa
 * Deve ser chamada por um cron job diariamente
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se tem o secret correto (para segurança)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }
    
    // Encontrar usuários inativos
    const inactiveUserIds = await findInactiveUsers()
    
    if (inactiveUserIds.length === 0) {
      return NextResponse.json({
        message: 'Nenhum usuário inativo encontrado',
        processed: 0
      })
    }
    
    // Processar cada usuário inativo (remover e convidar próximo da lista)
    let processedCount = 0
    const errors: string[] = []
    
    for (const userId of inactiveUserIds) {
      try {
        const success = await processInactiveUser(userId)
        if (success) {
          processedCount++
        } else {
          errors.push(`Erro ao processar usuário ${userId}`)
        }
      } catch (error) {
        errors.push(`Erro ao processar usuário ${userId}: ${error}`)
      }
    }
    
    return NextResponse.json({
      message: `Processamento concluído`,
      totalInactive: inactiveUserIds.length,
      processed: processedCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Erro ao processar usuários inativos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
