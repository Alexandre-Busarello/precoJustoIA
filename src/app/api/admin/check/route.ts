import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'

// GET /api/admin/check - Verificar se o usuário é admin
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ isAdmin: false })
    }

    // Usar fonte única da verdade para verificar admin
    const user = await getCurrentUser()
    
    return NextResponse.json({ isAdmin: user?.isAdmin || false })

  } catch (error) {
    console.error('Erro ao verificar status de admin:', error)
    return NextResponse.json({ isAdmin: false })
  }
}
