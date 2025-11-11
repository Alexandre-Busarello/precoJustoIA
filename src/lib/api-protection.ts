/**
 * MIDDLEWARE DE PROTEÇÃO PARA APIs
 * 
 * Wrapper reutilizável que pode ser usado em qualquer rota da API
 * para adicionar proteções contra bots, rate limiting e validações de segurança
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit, RATE_LIMIT_CONFIGS, RateLimitConfig, RateLimitMiddleware } from './rate-limit-middleware'

export interface ApiProtectionOptions {
  // Tipo de rate limit a usar (ou configuração customizada)
  rateLimit?: keyof typeof RATE_LIMIT_CONFIGS | RateLimitConfig
  
  // Habilitar verificação de honeypot
  enableHoneypot?: boolean
  
  // Habilitar verificação de padrões suspeitos
  enableSuspiciousPatterns?: boolean
  
  // Métodos HTTP permitidos
  allowedMethods?: string[]
  
  // Headers obrigatórios
  requiredHeaders?: string[]
}

/**
 * Wrapper principal para proteger rotas da API
 */
export function withApiProtection(
  handler: (request: NextRequest) => Promise<Response>,
  options: ApiProtectionOptions = {}
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    // Verificar método HTTP permitido
    if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
      return NextResponse.json(
        { error: 'Método não permitido' },
        { status: 405 }
      )
    }

    // Verificar headers obrigatórios
    if (options.requiredHeaders) {
      const missingHeaders = options.requiredHeaders.filter(
        header => !request.headers.get(header)
      )
      
      if (missingHeaders.length > 0) {
        return NextResponse.json(
          { error: 'Headers obrigatórios ausentes', missingHeaders },
          { status: 400 }
        )
      }
    }

    // Verificar padrões suspeitos (se habilitado)
    if (options.enableSuspiciousPatterns !== false) {
      const suspiciousPatterns = RateLimitMiddleware.detectSuspiciousPatterns(request)
      if (suspiciousPatterns.suspicious) {
        const ip = RateLimitMiddleware.getClientIP(request)
        RateLimitMiddleware.logSuspiciousActivity(
          ip,
          'SUSPICIOUS_PATTERN',
          'api',
          { reasons: suspiciousPatterns.reasons }
        )
        
        // Não bloquear imediatamente, mas logar para análise
      }
    }

    // Verificar honeypot em requisições POST/PUT/PATCH (se habilitado)
    if (options.enableHoneypot && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const body = await request.clone().json().catch(() => ({}))
        if (RateLimitMiddleware.checkHoneypot(body)) {
          const ip = RateLimitMiddleware.getClientIP(request)
          RateLimitMiddleware.logSuspiciousActivity(ip, 'HONEYPOT_TRIGGERED', 'api', {
            filledFields: Object.keys(body).filter(key => body[key])
          })
          
          // Bloquear IP imediatamente
          const config = typeof options.rateLimit === 'string' 
            ? RATE_LIMIT_CONFIGS[options.rateLimit]
            : options.rateLimit || RATE_LIMIT_CONFIGS.API_GENERAL
          
          await RateLimitMiddleware.checkRateLimit(request, {
            ...config,
            blockAfterViolations: 1
          })
          
          return NextResponse.json(
            { error: 'Requisição inválida' },
            { status: 400 }
          )
        }
      } catch (error) {
        // Se não conseguir parsear JSON, continuar normalmente
      }
    }

    // Aplicar rate limiting
    const rateLimitConfig = typeof options.rateLimit === 'string'
      ? RATE_LIMIT_CONFIGS[options.rateLimit]
      : options.rateLimit || RATE_LIMIT_CONFIGS.API_GENERAL

    return withRateLimit(
      request,
      rateLimitConfig,
      () => handler(request)
    )
  }
}

/**
 * Helper para rotas GET simples
 */
export function protectGetRoute(
  handler: (request: NextRequest) => Promise<Response>,
  options?: Omit<ApiProtectionOptions, 'allowedMethods' | 'enableHoneypot'>
) {
  return withApiProtection(handler, {
    ...options,
    allowedMethods: ['GET'],
    enableHoneypot: false // Honeypot não faz sentido para GET
  })
}

/**
 * Helper para rotas POST (com proteções extras)
 */
export function protectPostRoute(
  handler: (request: NextRequest) => Promise<Response>,
  options?: Omit<ApiProtectionOptions, 'allowedMethods'>
) {
  return withApiProtection(handler, {
    ...options,
    allowedMethods: ['POST'],
    enableHoneypot: options?.enableHoneypot !== false, // Habilitado por padrão para POST
    enableSuspiciousPatterns: options?.enableSuspiciousPatterns !== false
  })
}

/**
 * Helper para rotas PUT/PATCH
 */
export function protectPutRoute(
  handler: (request: NextRequest) => Promise<Response>,
  options?: Omit<ApiProtectionOptions, 'allowedMethods'>
) {
  return withApiProtection(handler, {
    ...options,
    allowedMethods: ['PUT', 'PATCH'],
    enableHoneypot: options?.enableHoneypot !== false
  })
}

/**
 * Helper para rotas DELETE
 */
export function protectDeleteRoute(
  handler: (request: NextRequest) => Promise<Response>,
  options?: Omit<ApiProtectionOptions, 'allowedMethods' | 'enableHoneypot'>
) {
  return withApiProtection(handler, {
    ...options,
    allowedMethods: ['DELETE'],
    enableHoneypot: false
  })
}

/**
 * Helper para rotas que requerem autenticação (combinar com proteções)
 */
export function protectAuthenticatedRoute(
  handler: (request: NextRequest) => Promise<Response>,
  options?: ApiProtectionOptions
) {
  return withApiProtection(async (request: NextRequest) => {
    // Verificar autenticação aqui ou deixar para o handler
    // Por enquanto, apenas aplicar proteções de rate limit
    return handler(request)
  }, options)
}

