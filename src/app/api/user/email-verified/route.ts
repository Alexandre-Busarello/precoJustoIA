import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { isEmailVerified } from '@/lib/email-verification-service'

/**
 * GET /api/user/email-verified
 * Verifica se o email do usuário atual está verificado
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user || !user.id) {
      return NextResponse.json({ verified: false }, { status: 401 })
    }

    const verified = await isEmailVerified(user.id)
    
    return NextResponse.json({ verified })
  } catch (error) {
    console.error('Erro ao verificar status de email:', error)
    return NextResponse.json({ verified: false }, { status: 500 })
  }
}

