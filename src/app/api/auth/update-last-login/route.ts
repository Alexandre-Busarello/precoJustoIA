import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/user-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import { updateLastLoginIP } from '@/lib/ip-protection-service'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }
    
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Capturar IP do request
    const ip = RateLimitMiddleware.getClientIP(request)

    // Atualizar o último login do usuário
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Atualizar IP de login na tabela user_security (armazena como hash)
    // Isso também cria o registro se não existir
    await updateLastLoginIP(user.id, ip)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating last login:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}