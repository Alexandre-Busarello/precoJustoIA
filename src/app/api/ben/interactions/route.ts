/**
 * API Route para rastrear interações do usuário com o Ben
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { getUserBenInteractionState, shouldShowProactiveMessage, generateProactiveMessage } from '@/lib/ben-interaction-service'
import { extractPageContext } from '@/lib/ben-page-context'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const contextUrl = searchParams.get('contextUrl') || undefined
    
    // Extrair contexto da página se fornecido
    let pageContext
    if (contextUrl) {
      pageContext = await extractPageContext(contextUrl)
    }

    // Obter estado de interação
    const state = await getUserBenInteractionState(user.id)
    
    // Verificar se deve mostrar mensagem proativa
    const proactiveCheck = await shouldShowProactiveMessage(user.id, pageContext)
    
    let proactiveMessage = null
    if (proactiveCheck.shouldShow && proactiveCheck.messageType) {
      proactiveMessage = generateProactiveMessage(proactiveCheck.messageType, pageContext)
    }

    return NextResponse.json({
      success: true,
      state,
      proactive: {
        shouldShow: proactiveCheck.shouldShow,
        messageType: proactiveCheck.messageType,
        message: proactiveMessage
      }
    })
  } catch (error) {
    console.error('Erro ao obter estado de interação:', error)
    return NextResponse.json(
      { error: 'Erro ao obter estado de interação' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Registrar interação (a interação já está registrada através das conversas/mensagens)
    // Esta rota pode ser usada para futuras métricas adicionais
    
    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Erro ao registrar interação:', error)
    return NextResponse.json(
      { error: 'Erro ao registrar interação' },
      { status: 500 }
    )
  }
}


