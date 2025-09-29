import { NextRequest, NextResponse } from 'next/server'
import { addToWaitlist } from '@/lib/alfa-service'
import { z } from 'zod'

const waitlistSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido')
})

/**
 * API para adicionar usuário à lista de interesse da fase Alfa
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar dados
    const validation = waitlistSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }
    
    const { name, email } = validation.data
    
    // Adicionar à lista de interesse
    const success = await addToWaitlist(name, email)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Email já está na lista de interesse' },
        { status: 409 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Adicionado à lista de interesse com sucesso!'
    })
  } catch (error) {
    console.error('Erro ao adicionar à lista de interesse:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
