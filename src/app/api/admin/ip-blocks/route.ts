/**
 * ENDPOINT ADMIN PARA GERENCIAR BLOQUEIOS DE IP
 * 
 * Permite visualizar e desbloquear IPs bloqueados pelo sistema de rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/user-service'
import { RateLimitMiddleware, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit-middleware'
import { protectGetRoute, protectPostRoute } from '@/lib/api-protection'

/**
 * GET - Listar IPs bloqueados ou status de um IP específico
 */
export const GET = protectGetRoute(
  async (request: NextRequest): Promise<Response> => {
    // Verificar acesso admin
    const adminUser = await requireAdminUser()
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar este endpoint.' },
        { status: 403 }
      )
    }

    try {
      const { searchParams } = new URL(request.url)
      const ip = searchParams.get('ip')
      const endpoint = searchParams.get('endpoint') || 'register'

      if (ip) {
        // Status de um IP específico
        const status = await RateLimitMiddleware.getIPStatus(ip, endpoint)
        return NextResponse.json({
          ip,
          endpoint,
          ...status
        })
      } else {
        // Listar todos os IPs bloqueados (limitado aos últimos 100)
        // Nota: Em produção, você pode querer usar um banco de dados para isso
        return NextResponse.json({
          message: 'Para listar todos os IPs bloqueados, use um sistema de monitoramento externo',
          note: 'O cache Redis contém os bloqueios ativos. Use ferramentas de monitoramento para visualizar todos.'
        })
      }
    } catch (error) {
      console.error('Erro ao obter status de IP:', error)
      return NextResponse.json(
        { error: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }
  },
  {
    rateLimit: 'ADMIN_OPERATION'
  }
)

/**
 * POST - Desbloquear um IP
 */
export const POST = protectPostRoute(
  async (request: NextRequest): Promise<Response> => {
    // Verificar acesso admin
    const adminUser = await requireAdminUser()
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar este endpoint.' },
        { status: 403 }
      )
    }

    try {
      const body = await request.json()
      const { ip, endpoint = 'register' } = body

      if (!ip) {
        return NextResponse.json(
          { error: 'IP é obrigatório' },
          { status: 400 }
        )
      }

      const success = await RateLimitMiddleware.unblockIP(ip, endpoint)

      if (success) {
        return NextResponse.json({
          message: `IP ${ip} desbloqueado com sucesso`,
          ip,
          endpoint
        })
      } else {
        return NextResponse.json(
          { error: 'Erro ao desbloquear IP' },
          { status: 500 }
        )
      }
    } catch (error) {
      console.error('Erro ao desbloquear IP:', error)
      return NextResponse.json(
        { error: 'Erro ao processar requisição' },
        { status: 500 }
      )
    }
  },
  {
    rateLimit: 'ADMIN_OPERATION'
  }
)

