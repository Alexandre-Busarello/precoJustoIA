/**
 * MIDDLEWARE DE SEGURANÇA ADICIONAL
 * 
 * Este middleware adiciona camadas extras de segurança mesmo com RLS ativado,
 * implementando validações de acesso baseadas em contexto de usuário.
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SubscriptionTier } from '@prisma/client'
import { cache } from '@/lib/cache-service'

// Tipos de operações sensíveis
export type SensitiveOperation = 
  | 'USER_DATA_ACCESS'
  | 'PORTFOLIO_MODIFICATION'
  | 'ADMIN_OPERATION'
  | 'PREMIUM_FEATURE'
  | 'FINANCIAL_DATA_EXPORT'

// Configuração de segurança por operação
const SECURITY_CONFIG = {
  USER_DATA_ACCESS: {
    requiresAuth: true,
    requiresPremium: false,
    requiresAdmin: false,
    rateLimitPerMinute: 60
  },
  PORTFOLIO_MODIFICATION: {
    requiresAuth: true,
    requiresPremium: false,
    requiresAdmin: false,
    rateLimitPerMinute: 30
  },
  ADMIN_OPERATION: {
    requiresAuth: true,
    requiresPremium: false,
    requiresAdmin: true,
    rateLimitPerMinute: 100
  },
  PREMIUM_FEATURE: {
    requiresAuth: true,
    requiresPremium: true,
    requiresAdmin: false,
    rateLimitPerMinute: 120
  },
  FINANCIAL_DATA_EXPORT: {
    requiresAuth: true,
    requiresPremium: true,
    requiresAdmin: false,
    rateLimitPerMinute: 10
  }
} as const

// Rate limiting agora usa Redis com fallback para memória

/**
 * Middleware principal de segurança
 */
export class SecurityMiddleware {
  
  /**
   * Valida se uma operação pode ser executada
   */
  static async validateOperation(
    request: NextRequest,
    operation: SensitiveOperation,
    additionalContext?: {
      userId?: string
      resourceId?: string
      ipAddress?: string
    }
  ): Promise<{
    allowed: boolean
    reason?: string
    user?: any
  }> {
    try {
      const config = SECURITY_CONFIG[operation]
      const session = await getServerSession(authOptions)
      
      // 1. Verificar autenticação
      if (config.requiresAuth && !session?.user) {
        return {
          allowed: false,
          reason: 'AUTHENTICATION_REQUIRED'
        }
      }

      // 2. Verificar rate limiting
      const rateLimitKey = `${operation}:${session?.user?.email || additionalContext?.ipAddress || 'anonymous'}`
      const rateLimitResult = await this.checkRateLimit(rateLimitKey, config.rateLimitPerMinute)
      
      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'RATE_LIMIT_EXCEEDED'
        }
      }

      // 3. Buscar dados completos do usuário se necessário
      // Usar user-service.ts que é a fonte única da verdade
      let user: any = session?.user
      if (session?.user?.id && (config.requiresPremium || config.requiresAdmin)) {
        const { getCurrentUser } = await import('@/lib/user-service')
        const currentUser = await getCurrentUser()
        if (currentUser) {
          user = currentUser
        }
      }

      // 4. Verificar acesso Premium usando user-service.ts
      if (config.requiresPremium) {
        if (!user?.isPremium) {
          return {
            allowed: false,
            reason: 'PREMIUM_REQUIRED',
            user
          }
        }
      }

      // 5. Verificar acesso Admin
      if (config.requiresAdmin) {
        // Buscar dados admin se não temos ainda
        if (typeof user?.isAdmin === 'undefined' && session?.user?.email) {
          const adminUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { isAdmin: true }
          })
          if (adminUser) {
            user = { ...user, isAdmin: adminUser.isAdmin }
          }
        }
        
        if (!user?.isAdmin) {
          return {
            allowed: false,
            reason: 'ADMIN_REQUIRED',
            user
          }
        }
      }

      // 6. Validações específicas por contexto
      if (additionalContext?.userId && session?.user?.email) {
        const isOwner = await this.validateResourceOwnership(
          session.user.email,
          additionalContext.userId,
          additionalContext.resourceId
        )
        
        if (!isOwner) {
          return {
            allowed: false,
            reason: 'RESOURCE_ACCESS_DENIED',
            user
          }
        }
      }

      return {
        allowed: true,
        user
      }

    } catch (error) {
      console.error('Erro no middleware de segurança:', error)
      return {
        allowed: false,
        reason: 'SECURITY_CHECK_FAILED'
      }
    }
  }

  /**
   * Verifica rate limiting usando Redis/cache
   */
  private static async checkRateLimit(key: string, limitPerMinute: number): Promise<{ allowed: boolean }> {
    const now = Date.now()
    const windowStart = now - (60 * 1000) // 1 minuto atrás
    const cacheKey = `rate_limit:${key}`
    
    try {
      const current = await cache.get<{ count: number; resetTime: number }>(cacheKey, {
        prefix: 'security',
        ttl: 120 // 2 minutos de TTL
      })
      
      if (!current || current.resetTime < windowStart) {
        // Nova janela de tempo
        await cache.set(cacheKey, { count: 1, resetTime: now }, {
          prefix: 'security',
          ttl: 120
        })
        return { allowed: true }
      }
      
      if (current.count >= limitPerMinute) {
        return { allowed: false }
      }
      
      // Incrementar contador
      await cache.set(cacheKey, { count: current.count + 1, resetTime: current.resetTime }, {
        prefix: 'security',
        ttl: 120
      })
      return { allowed: true }
      
    } catch (error) {
      console.error('Erro no rate limiting:', error)
      // Em caso de erro, permitir acesso (fail-open)
      return { allowed: true }
    }
  }

  /**
   * Verifica acesso Premium
   */
  /**
   * DEPRECATED: Use getCurrentUser() do user-service.ts que é a fonte única da verdade
   * Mantido para compatibilidade, mas agora usa user.isPremium diretamente
   */
  private static checkPremiumAccess(user: any): boolean {
    // user.isPremium já vem calculado do user-service.ts incluindo trial
    return user?.isPremium || false
  }

  /**
   * Valida propriedade de recursos
   */
  private static async validateResourceOwnership(
    userEmail: string,
    targetUserId: string,
    resourceId?: string
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, isAdmin: true }
      })
      
      if (!user) return false
      
      // Admins têm acesso total
      if (user.isAdmin) return true
      
      // Usuário só pode acessar seus próprios dados
      return user.id === targetUserId
      
    } catch (error) {
      console.error('Erro ao validar propriedade do recurso:', error)
      return false
    }
  }

  /**
   * Log de atividades suspeitas
   */
  static logSuspiciousActivity(
    operation: SensitiveOperation,
    reason: string,
    context: {
      userEmail?: string
      ipAddress?: string
      userAgent?: string
      timestamp?: Date
    }
  ) {
    // Em produção, enviar para sistema de monitoramento
    console.warn('🚨 ATIVIDADE SUSPEITA DETECTADA:', {
      operation,
      reason,
      context: {
        ...context,
        timestamp: context.timestamp || new Date()
      }
    })
  }

  /**
   * Limpa cache de rate limiting (agora gerenciado automaticamente pelo Redis/cache)
   */
  static async cleanupRateLimitCache() {
    try {
      // O cache service já gerencia TTL automaticamente
      // Mas podemos forçar limpeza se necessário
      await cache.clear('security')
      console.log('🧹 Cache de rate limiting limpo')
    } catch (error) {
      console.error('Erro ao limpar cache de rate limiting:', error)
    }
  }
}

/**
 * Helper para usar em API routes
 */
export async function withSecurity(
  request: NextRequest,
  operation: SensitiveOperation,
  handler: (context: { user: any }) => Promise<Response>
): Promise<Response> {
  const validation = await SecurityMiddleware.validateOperation(request, operation)
  
  if (!validation.allowed) {
    SecurityMiddleware.logSuspiciousActivity(operation, validation.reason!, {
      userEmail: validation.user?.email,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined
    })
    
    return new Response(
      JSON.stringify({ 
        error: 'Acesso negado',
        code: validation.reason 
      }),
      { 
        status: validation.reason === 'AUTHENTICATION_REQUIRED' ? 401 : 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  return handler({ user: validation.user })
}

// Limpeza automática agora é gerenciada pelo cache service
// Mas mantemos uma limpeza periódica adicional se necessário
if (typeof window === 'undefined') {
  setInterval(async () => {
    await SecurityMiddleware.cleanupRateLimitCache()
  }, 30 * 60 * 1000) // A cada 30 minutos
}
