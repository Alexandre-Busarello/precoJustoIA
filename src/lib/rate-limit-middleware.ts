/**
 * MIDDLEWARE DE RATE LIMITING E PROTEÇÃO CONTRA BOTS
 * 
 * Sistema robusto de proteção que implementa:
 * - Rate limiting por IP com múltiplas janelas de tempo
 * - Bloqueio automático de IP após violações
 * - Detecção de padrões suspeitos
 * - Logging de atividades suspeitas
 * - Honeypot e validações adicionais
 */

import { NextRequest } from 'next/server'
import { rateLimitCache } from './rate-limit-cache-service'

// Configurações de rate limiting
export interface RateLimitConfig {
  // Limites por janela de tempo
  window1Min: number      // Requisições por minuto
  window15Min: number     // Requisições por 15 minutos
  window1Hour: number     // Requisições por hora
  window24Hour: number    // Requisições por 24 horas
  
  // Bloqueio automático
  blockAfterViolations: number  // Bloquear após N violações
  blockDuration: number         // Duração do bloqueio em segundos (padrão: 24h)
  
  // Tempo mínimo entre requisições (em ms)
  minTimeBetweenRequests?: number
  
  // Identificador único para este endpoint
  endpoint: string
}

// Configurações padrão por tipo de endpoint
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Registro de usuário - MUITO RESTRITIVO
  REGISTER: {
    window1Min: 2,           // Máximo 2 registros por minuto
    window15Min: 5,          // Máximo 5 registros por 15 minutos
    window1Hour: 10,         // Máximo 10 registros por hora
    window24Hour: 20,        // Máximo 20 registros por dia
    blockAfterViolations: 3, // Bloquear após 3 violações
    blockDuration: 86400,    // Bloqueio de 24 horas
    minTimeBetweenRequests: 5000, // Mínimo 5 segundos entre requisições
    endpoint: 'register'
  },
  
  // Login - Moderado
  LOGIN: {
    window1Min: 5,
    window15Min: 20,
    window1Hour: 50,
    window24Hour: 200,
    blockAfterViolations: 5,
    blockDuration: 3600, // 1 hora
    minTimeBetweenRequests: 2000,
    endpoint: 'login'
  },
  
  // APIs gerais - Permissivo mas protegido
  API_GENERAL: {
    window1Min: 60,
    window15Min: 300,
    window1Hour: 1000,
    window24Hour: 5000,
    blockAfterViolations: 10,
    blockDuration: 3600,
    endpoint: 'api-general'
  },
  
  // APIs Premium - Mais restritivo
  API_PREMIUM: {
    window1Min: 30,
    window15Min: 150,
    window1Hour: 500,
    window24Hour: 2000,
    blockAfterViolations: 5,
    blockDuration: 7200, // 2 horas
    endpoint: 'api-premium'
  },
  
  // Operações Admin - Permissivo mas protegido
  ADMIN_OPERATION: {
    window1Min: 100,
    window15Min: 500,
    window1Hour: 2000,
    window24Hour: 10000,
    blockAfterViolations: 10,
    blockDuration: 3600, // 1 hora
    endpoint: 'admin'
  }
}

// Estrutura de dados para tracking de rate limit
interface RateLimitData {
  count1Min: number
  count15Min: number
  count1Hour: number
  count24Hour: number
  lastRequestTime: number
  violations: number
  blockedUntil?: number
  timestamps: number[] // Histórico de timestamps para janela deslizante
}

// Resultado da verificação de rate limit
export interface RateLimitResult {
  allowed: boolean
  reason?: 'RATE_LIMIT_EXCEEDED' | 'IP_BLOCKED' | 'TOO_FAST' | 'SUSPICIOUS_PATTERN'
  retryAfter?: number // Segundos até poder tentar novamente
  remaining?: number  // Requisições restantes na janela atual
  details?: {
    window1Min?: number
    window15Min?: number
    window1Hour?: number
    window24Hour?: number
  }
}

/**
 * Classe principal de Rate Limiting
 */
export class RateLimitMiddleware {
  /**
   * Verificar rate limit para um IP
   */
  static async checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const ip = this.getClientIP(request)
    const now = Date.now()
    
    // Verificar se IP está bloqueado
    const blockKey = `ip_block:${ip}:${config.endpoint}`
    const blockData = await rateLimitCache.get<{ blockedUntil: number; reason: string }>(blockKey, {
      prefix: 'security',
      ttl: config.blockDuration
    })
    
    if (blockData && blockData.blockedUntil > now) {
      const retryAfter = Math.ceil((blockData.blockedUntil - now) / 1000)
      this.logSuspiciousActivity(ip, 'IP_BLOCKED', config.endpoint, {
        reason: blockData.reason,
        retryAfter
      })
      
      return {
        allowed: false,
        reason: 'IP_BLOCKED',
        retryAfter
      }
    }
    
    // Obter dados de rate limit
    const rateLimitKey = `rate_limit:${ip}:${config.endpoint}`
    const rateLimitData = await rateLimitCache.get<RateLimitData>(rateLimitKey, {
      prefix: 'security',
      ttl: 86400 // 24 horas
    }) || {
      count1Min: 0,
      count15Min: 0,
      count1Hour: 0,
      count24Hour: 0,
      lastRequestTime: 0,
      violations: 0,
      timestamps: []
    }
    
    // Verificar tempo mínimo entre requisições
    if (config.minTimeBetweenRequests && rateLimitData.lastRequestTime > 0) {
      const timeSinceLastRequest = now - rateLimitData.lastRequestTime
      if (timeSinceLastRequest < config.minTimeBetweenRequests) {
        this.logSuspiciousActivity(ip, 'TOO_FAST', config.endpoint, {
          timeSinceLastRequest,
          minTimeBetweenRequests: config.minTimeBetweenRequests
        })
        
        // Incrementar violações
        rateLimitData.violations++
        await this.saveRateLimitData(rateLimitKey, rateLimitData, config)
        
        // Bloquear se exceder limite de violações
        if (rateLimitData.violations >= config.blockAfterViolations) {
          await this.blockIP(ip, config, 'Múltiplas requisições muito rápidas')
          return {
            allowed: false,
            reason: 'IP_BLOCKED',
            retryAfter: config.blockDuration
          }
        }
        
        return {
          allowed: false,
          reason: 'TOO_FAST',
          retryAfter: Math.ceil((config.minTimeBetweenRequests - timeSinceLastRequest) / 1000)
        }
      }
    }
    
    // Limpar timestamps antigos (janela deslizante)
    const oneMinAgo = now - 60000
    const fifteenMinAgo = now - 900000
    const oneHourAgo = now - 3600000
    const oneDayAgo = now - 86400000
    
    rateLimitData.timestamps = rateLimitData.timestamps.filter(ts => ts > oneDayAgo)
    
    // Contar requisições em cada janela
    rateLimitData.count1Min = rateLimitData.timestamps.filter(ts => ts > oneMinAgo).length
    rateLimitData.count15Min = rateLimitData.timestamps.filter(ts => ts > fifteenMinAgo).length
    rateLimitData.count1Hour = rateLimitData.timestamps.filter(ts => ts > oneHourAgo).length
    rateLimitData.count24Hour = rateLimitData.timestamps.length
    
    // Verificar limites
    const violations: string[] = []
    
    if (rateLimitData.count1Min >= config.window1Min) {
      violations.push(`1min:${rateLimitData.count1Min}/${config.window1Min}`)
    }
    if (rateLimitData.count15Min >= config.window15Min) {
      violations.push(`15min:${rateLimitData.count15Min}/${config.window15Min}`)
    }
    if (rateLimitData.count1Hour >= config.window1Hour) {
      violations.push(`1h:${rateLimitData.count1Hour}/${config.window1Hour}`)
    }
    if (rateLimitData.count24Hour >= config.window24Hour) {
      violations.push(`24h:${rateLimitData.count24Hour}/${config.window24Hour}`)
    }
    
    // Se houver violações, bloquear
    if (violations.length > 0) {
      rateLimitData.violations++
      
      this.logSuspiciousActivity(ip, 'RATE_LIMIT_EXCEEDED', config.endpoint, {
        violations: violations.join(', '),
        totalViolations: rateLimitData.violations
      })
      
      // Bloquear se exceder limite de violações
      if (rateLimitData.violations >= config.blockAfterViolations) {
        await this.blockIP(ip, config, `Rate limit excedido: ${violations.join(', ')}`)
        await this.saveRateLimitData(rateLimitKey, rateLimitData, config)
        
        return {
          allowed: false,
          reason: 'IP_BLOCKED',
          retryAfter: config.blockDuration,
          details: {
            window1Min: rateLimitData.count1Min,
            window15Min: rateLimitData.count15Min,
            window1Hour: rateLimitData.count1Hour,
            window24Hour: rateLimitData.count24Hour
          }
        }
      }
      
      await this.saveRateLimitData(rateLimitKey, rateLimitData, config)
      
      // Calcular retry after baseado na janela mais restritiva violada
      let retryAfter = 60 // Padrão: 1 minuto
      if (rateLimitData.count1Min >= config.window1Min) {
        retryAfter = 60
      } else if (rateLimitData.count15Min >= config.window15Min) {
        retryAfter = 900 // 15 minutos
      } else if (rateLimitData.count1Hour >= config.window1Hour) {
        retryAfter = 3600 // 1 hora
      } else if (rateLimitData.count24Hour >= config.window24Hour) {
        retryAfter = 86400 // 24 horas
      }
      
      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
        details: {
          window1Min: rateLimitData.count1Min,
          window15Min: rateLimitData.count15Min,
          window1Hour: rateLimitData.count1Hour,
          window24Hour: rateLimitData.count24Hour
        }
      }
    }
    
    // Requisição permitida - atualizar dados
    rateLimitData.timestamps.push(now)
    rateLimitData.lastRequestTime = now
    rateLimitData.count1Min++
    rateLimitData.count15Min++
    rateLimitData.count1Hour++
    rateLimitData.count24Hour++
    
    // Resetar violações após período sem problemas (decay)
    if (rateLimitData.violations > 0 && rateLimitData.timestamps.length > 0) {
      const oldestTimestamp = Math.min(...rateLimitData.timestamps)
      const hoursSinceOldest = (now - oldestTimestamp) / 3600000
      
      // Reduzir violações após 24 horas sem problemas
      if (hoursSinceOldest > 24) {
        rateLimitData.violations = Math.max(0, rateLimitData.violations - 1)
      }
    }
    
    await this.saveRateLimitData(rateLimitKey, rateLimitData, config)
    
    return {
      allowed: true,
      remaining: Math.max(0, config.window1Min - rateLimitData.count1Min),
      details: {
        window1Min: rateLimitData.count1Min,
        window15Min: rateLimitData.count15Min,
        window1Hour: rateLimitData.count1Hour,
        window24Hour: rateLimitData.count24Hour
      }
    }
  }
  
  /**
   * Bloquear um IP
   */
  private static async blockIP(
    ip: string,
    config: RateLimitConfig,
    reason: string
  ): Promise<void> {
    const blockKey = `ip_block:${ip}:${config.endpoint}`
    const blockedUntil = Date.now() + (config.blockDuration * 1000)
    
    await rateLimitCache.set(blockKey, {
      blockedUntil,
      reason,
      blockedAt: Date.now(),
      endpoint: config.endpoint
    }, {
      prefix: 'security',
      ttl: config.blockDuration
    })
    
    console.error(`🚨 IP BLOQUEADO: ${ip} até ${new Date(blockedUntil).toISOString()} - ${reason}`)
  }
  
  /**
   * Salvar dados de rate limit
   */
  private static async saveRateLimitData(
    key: string,
    data: RateLimitData,
    config: RateLimitConfig
  ): Promise<void> {
    await rateLimitCache.set(key, data, {
      prefix: 'security',
      ttl: 86400 // 24 horas
    })
  }
  
  /**
   * Obter IP do cliente (considerando proxies)
   */
  static getClientIP(request: NextRequest): string {
    // Verificar headers de proxy primeiro
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
      // Pegar o primeiro IP da lista (IP real do cliente)
      const ips = forwardedFor.split(',').map(ip => ip.trim())
      return ips[0] || 'unknown'
    }
    
    const realIP = request.headers.get('x-real-ip')
    if (realIP) {
      return realIP
    }
    
    // Fallback para Cloudflare ou outros proxies
    const cfIP = request.headers.get('cf-connecting-ip')
    if (cfIP) {
      return cfIP
    }
    
    return 'unknown'
  }
  
  /**
   * Verificar padrões suspeitos na requisição
   */
  static detectSuspiciousPatterns(request: NextRequest): {
    suspicious: boolean
    reasons: string[]
  } {
    const reasons: string[] = []
    const userAgent = request.headers.get('user-agent') || ''
    const referer = request.headers.get('referer') || ''
    
    // User-Agent suspeito ou ausente
    if (!userAgent || userAgent.length < 10) {
      reasons.push('User-Agent ausente ou muito curto')
    }
    
    // User-Agents conhecidos de bots (exceto crawlers legítimos)
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /node/i,
      /postman/i,
      /insomnia/i
    ]
    
    const isKnownBot = botPatterns.some(pattern => pattern.test(userAgent))
    if (isKnownBot && !userAgent.match(/googlebot|bingbot|slurp/i)) {
      reasons.push(`User-Agent de bot detectado: ${userAgent.substring(0, 50)}`)
    }
    
    // Referer ausente em requisições POST (pode indicar requisição direta de bot)
    if (request.method === 'POST' && !referer && !userAgent.match(/mobile|android|ios/i)) {
      reasons.push('Requisição POST sem referer')
    }
    
    // Headers suspeitos
    const accept = request.headers.get('accept') || ''
    if (!accept || accept.length < 5) {
      reasons.push('Header Accept ausente ou inválido')
    }
    
    return {
      suspicious: reasons.length > 0,
      reasons
    }
  }
  
  /**
   * Verificar honeypot field (campo oculto que bots preenchem)
   */
  static checkHoneypot(body: any): boolean {
    // Campos honeypot comuns que bots preenchem
    const honeypotFields = [
      'website',
      'url',
      'homepage',
      'phone',
      'company',
      'comment',
      'message',
      'subject'
    ]
    
    for (const field of honeypotFields) {
      if (body[field] && body[field].trim().length > 0) {
        return true // Bot detectado!
      }
    }
    
    return false
  }
  
  /**
   * Log de atividades suspeitas
   */
  static logSuspiciousActivity(
    ip: string,
    reason: string,
    endpoint: string,
    details?: Record<string, any>
  ): void {
    console.warn('🚨 ATIVIDADE SUSPEITA:', {
      ip,
      reason,
      endpoint,
      timestamp: new Date().toISOString(),
      ...details
    })
    
    // Em produção, você pode enviar para um serviço de monitoramento
    // como Sentry, DataDog, CloudWatch, etc.
  }
  
  /**
   * Desbloquear um IP manualmente (útil para admin)
   */
  static async unblockIP(ip: string, endpoint: string): Promise<boolean> {
    try {
      const blockKey = `ip_block:${ip}:${endpoint}`
      await rateLimitCache.delete(blockKey, { prefix: 'security' })
      
      // Também resetar violações
      const rateLimitKey = `rate_limit:${ip}:${endpoint}`
      const data = await rateLimitCache.get<RateLimitData>(rateLimitKey, { prefix: 'security' })
      if (data) {
        data.violations = 0
        await rateLimitCache.set(rateLimitKey, data, { prefix: 'security', ttl: 86400 })
      }
      
      console.log(`✅ IP DESBLOQUEADO: ${ip} para endpoint ${endpoint}`)
      return true
    } catch (error) {
      console.error('Erro ao desbloquear IP:', error)
      return false
    }
  }
  
  /**
   * Obter status de um IP
   */
  static async getIPStatus(ip: string, endpoint: string): Promise<{
    blocked: boolean
    blockedUntil?: number
    violations: number
    rateLimitData?: RateLimitData
  }> {
    const blockKey = `ip_block:${ip}:${endpoint}`
    const blockData = await rateLimitCache.get<{ blockedUntil: number }>(blockKey, { prefix: 'security' })
    
    const rateLimitKey = `rate_limit:${ip}:${endpoint}`
    const rateLimitData = await rateLimitCache.get<RateLimitData>(rateLimitKey, { prefix: 'security' })
    
    return {
      blocked: blockData ? blockData.blockedUntil > Date.now() : false,
      blockedUntil: blockData?.blockedUntil,
      violations: rateLimitData?.violations || 0,
      rateLimitData: rateLimitData || undefined
    }
  }
}

/**
 * Wrapper para usar em rotas da API
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  handler: () => Promise<Response>
): Promise<Response> {
  // Verificar rate limit
  const rateLimitResult = await RateLimitMiddleware.checkRateLimit(request, config)
  
  if (!rateLimitResult.allowed) {
    // Verificar padrões suspeitos adicionais
    const suspiciousPatterns = RateLimitMiddleware.detectSuspiciousPatterns(request)
    
    if (suspiciousPatterns.suspicious) {
      const ip = RateLimitMiddleware.getClientIP(request)
      RateLimitMiddleware.logSuspiciousActivity(
        ip,
        'SUSPICIOUS_PATTERN',
        config.endpoint,
        { reasons: suspiciousPatterns.reasons }
      )
    }
    
    // Retornar resposta de erro com informações de rate limit
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
        headers.set('X-RateLimit-Remaining-1Min', Math.max(0, config.window1Min - rateLimitResult.details.window1Min).toString())
      }
    }
    
    const statusCode = rateLimitResult.reason === 'IP_BLOCKED' ? 403 : 429
    
    return new Response(
      JSON.stringify({
        error: rateLimitResult.reason === 'IP_BLOCKED' 
          ? 'Seu IP foi bloqueado temporariamente devido a atividade suspeita'
          : 'Muitas requisições. Tente novamente mais tarde.',
        code: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter,
        ...(rateLimitResult.details && { details: rateLimitResult.details })
      }),
      {
        status: statusCode,
        headers
      }
    )
  }
  
  // Executar handler
  return handler()
}

