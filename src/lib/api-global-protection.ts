/**
 * PROTEÇÃO GLOBAL PARA APIs
 * 
 * Este módulo pode ser usado no middleware do Next.js para aplicar
 * rate limiting básico em TODAS as rotas da API automaticamente.
 * 
 * IMPORTANTE: Use este middleware para proteção básica global,
 * e use protectGetRoute/protectPostRoute para proteções específicas
 * em rotas críticas (como registro, login, etc).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server'
import { RateLimitMiddleware, RATE_LIMIT_CONFIGS } from './rate-limit-middleware'

// Configuração de rate limiting global para APIs
const GLOBAL_API_RATE_LIMIT = {
  window1Min: 100,        // 100 requisições por minuto por IP
  window15Min: 500,      // 500 requisições por 15 minutos
  window1Hour: 2000,     // 2000 requisições por hora
  window24Hour: 10000,   // 10000 requisições por dia
  blockAfterViolations: 10,
  blockDuration: 3600,   // 1 hora de bloqueio
  endpoint: 'api-global'
}

// Rotas que devem ter rate limiting mais restritivo
const STRICT_ROUTES: Record<string, typeof RATE_LIMIT_CONFIGS.REGISTER> = {
  '/api/auth/register': RATE_LIMIT_CONFIGS.REGISTER,
  '/api/auth/login': RATE_LIMIT_CONFIGS.LOGIN,
  '/api/auth/reset-password': RATE_LIMIT_CONFIGS.LOGIN,
  '/api/auth/forgot-password': RATE_LIMIT_CONFIGS.LOGIN,
}

// Rotas que devem ser excluídas do rate limiting global
// (webhooks, health checks, etc)
const EXCLUDED_ROUTES = [
  '/api/health',
  '/api/webhooks', // Webhooks geralmente têm sua própria autenticação
]

/**
 * Aplicar rate limiting global em uma requisição de API
 * 
 * Use isso no middleware do Next.js para proteger todas as rotas /api/*
 */
export async function applyGlobalApiProtection(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl

  // Apenas aplicar em rotas da API
  if (!pathname.startsWith('/api/')) {
    return null // Não é uma rota da API, deixar passar
  }

  // Verificar se a rota está excluída
  if (EXCLUDED_ROUTES.some(route => pathname.startsWith(route))) {
    return null // Rota excluída, deixar passar
  }

  // Verificar se é uma rota com rate limiting mais restritivo
  const strictConfig = STRICT_ROUTES[pathname]
  const config = strictConfig || GLOBAL_API_RATE_LIMIT
  config.endpoint = pathname;

  // Aplicar rate limiting
  const rateLimitResult = await RateLimitMiddleware.checkRateLimit(request, config)

  if (!rateLimitResult.allowed) {
    // Verificar padrões suspeitos
    const suspiciousPatterns = RateLimitMiddleware.detectSuspiciousPatterns(request)
    if (suspiciousPatterns.suspicious) {
      const ip = RateLimitMiddleware.getClientIP(request)
      RateLimitMiddleware.logSuspiciousActivity(
        ip,
        'SUSPICIOUS_PATTERN',
        config.endpoint,
        { reasons: suspiciousPatterns.reasons, pathname }
      )
    }

    // Retornar resposta de rate limit
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    
    if (rateLimitResult.retryAfter) {
      headers.set('Retry-After', rateLimitResult.retryAfter.toString())
      headers.set('X-RateLimit-Retry-After', rateLimitResult.retryAfter.toString())
    }

    if (rateLimitResult.details) {
      headers.set('X-RateLimit-Limit-1Min', config.window1Min.toString())
      headers.set('X-RateLimit-Limit-15Min', config.window15Min.toString())
      headers.set('X-RateLimit-Limit-1Hour', config.window1Hour.toString())
      headers.set('X-RateLimit-Limit-24Hour', config.window24Hour.toString())
      
      if (rateLimitResult.details.window1Min !== undefined) {
        headers.set(
          'X-RateLimit-Remaining-1Min',
          Math.max(0, config.window1Min - rateLimitResult.details.window1Min).toString()
        )
      }
    }

    const statusCode = rateLimitResult.reason === 'IP_BLOCKED' ? 403 : 429

    return NextResponse.json(
      {
        error:
          rateLimitResult.reason === 'IP_BLOCKED'
            ? 'Seu IP foi bloqueado temporariamente devido a atividade suspeita'
            : 'Muitas requisições. Tente novamente mais tarde.',
        code: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter,
        ...(rateLimitResult.details && { details: rateLimitResult.details }),
      },
      {
        status: statusCode,
        headers,
      }
    )
  }

  // Rate limit OK, deixar passar
  return null
}

/**
 * Verificar se uma rota precisa de proteção adicional
 * (útil para identificar rotas que ainda não têm proteção específica)
 */
export function needsSpecificProtection(pathname: string): boolean {
  // Rotas críticas que devem ter proteção específica
  const criticalRoutes = [
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/reset-password',
    '/api/auth/forgot-password',
    '/api/checkout',
    '/api/payment',
    '/api/admin',
  ]

  return criticalRoutes.some(route => pathname.startsWith(route))
}

