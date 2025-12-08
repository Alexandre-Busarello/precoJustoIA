/**
 * SERVIÇO DE CACHE DEDICADO PARA RATE LIMITING
 * 
 * Usa REDIS_RATE_LIMIT_URL separado do cache principal da aplicação
 * para isolar o rate limiting e evitar impacto no cache geral
 */

import 'server-only';

// Importação condicional do Redis apenas no servidor
let createClient: any = null

// Só importa Redis se estivermos no servidor
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const redisModule = require('redis')
    createClient = redisModule.createClient
  } catch (error: any) {
    console.warn('Redis não disponível para rate limiting, usando apenas cache em memória')
  }
}

// Função auxiliar para serializar valores
function serializeValue(value: any): string {
  return JSON.stringify(value, (_, v) => 
    typeof v === 'bigint' ? v.toString() : v
  )
}

// Tipos para o cache
export interface RateLimitCacheOptions {
  ttl?: number // Time to live em segundos
  prefix?: string // Prefixo para as chaves
}

export interface RateLimitCacheItem<T = any> {
  data: T
  timestamp: number
  ttl?: number
}

// Cliente Redis dedicado para rate limiting
let rateLimitRedisClient: any | null = null
let rateLimitRedisConnected = false
let rateLimitInitializationPromise: Promise<void> | null = null
let isRateLimitInitializing = false

// Controle de atividade
let lastRateLimitActivity = Date.now()

// FAIL-FAST: Evita degradação quando Redis está indisponível
let rateLimitRedisDisabled = false
let lastRateLimitCriticalError: string | null = null
const CRITICAL_ERRORS = ['max number of clients', 'maxclients', 'too many clients', 'econnrefused', 'connection refused']

// Cache em memória como fallback
const rateLimitMemoryCache = new Map<string, RateLimitCacheItem>()

// Configurações
const RATE_LIMIT_DEFAULT_TTL = 86400 // 24 horas em segundos
const RATE_LIMIT_CONNECTION_TIMEOUT = 3000 // 3 segundos
const RATE_LIMIT_COMMAND_TIMEOUT = 2000 // 2 segundos
const RATE_LIMIT_LAZY_CONNECT = true

/**
 * Funções auxiliares de Fail-Fast
 */
function isCriticalError(error: any): boolean {
  const errorMsg = error?.message?.toLowerCase() || ''
  const errorCode = error?.code?.toLowerCase() || ''
  
  return CRITICAL_ERRORS.some(criticalErr => 
    errorMsg.includes(criticalErr) || errorCode.includes(criticalErr)
  )
}

function handleRateLimitRedisError(error: any): void {
  const errorMsg = error?.message || 'Unknown error'
  
  if (isCriticalError(error)) {
    console.error(`🚨 Rate Limit Redis: ERRO CRÍTICO (${errorMsg}) - Redis DESABILITADO nesta instância`)
    rateLimitRedisDisabled = true
    lastRateLimitCriticalError = errorMsg
    rateLimitRedisConnected = false
    
    if (rateLimitRedisClient) {
      rateLimitRedisClient.disconnect().catch(() => {})
      rateLimitRedisClient = null
    }
  } else {
    console.warn(`⚠️ Rate Limit Redis: Erro não crítico:`, errorMsg)
  }
}

/**
 * Classe principal do serviço de cache para rate limiting
 */
export class RateLimitCacheService {
  private static instance: RateLimitCacheService
  private initialized = false

  private constructor() {}

  static getInstance(): RateLimitCacheService {
    if (!RateLimitCacheService.instance) {
      RateLimitCacheService.instance = new RateLimitCacheService()
    }
    return RateLimitCacheService.instance
  }

  /**
   * Inicializar o serviço de cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (isRateLimitInitializing && rateLimitInitializationPromise) {
      return rateLimitInitializationPromise
    }

    isRateLimitInitializing = true
    rateLimitInitializationPromise = this._doInitialize()

    try {
      await rateLimitInitializationPromise
    } finally {
      isRateLimitInitializing = false
      rateLimitInitializationPromise = null
    }
  }

  private async _doInitialize(): Promise<void> {
    console.log('🚀 Inicializando RateLimitCacheService...')

    if (!RATE_LIMIT_LAZY_CONNECT) {
      await this.initializeRedis()
    } else {
      console.log('⏳ Rate Limit Redis conectará quando necessário')
    }

    this.initialized = true
    console.log('✅ RateLimitCacheService inicializado' + (RATE_LIMIT_LAZY_CONNECT ? ' (lazy mode)' : ''))
  }

  /**
   * Inicializar conexão Redis para rate limiting
   */
  private async initializeRedis(): Promise<void> {
    if (typeof window !== 'undefined') {
      return
    }
    
    if (!createClient) {
      console.log('⚠️ createClient não disponível para rate limiting')
      return
    }

    if (rateLimitRedisClient && rateLimitRedisConnected) {
      console.log('♻️ Rate Limit Redis já conectado, reutilizando')
      return
    }

    if (rateLimitRedisClient && !rateLimitRedisConnected) {
      try {
        await rateLimitRedisClient.connect()
        return
      } catch (error) {
        try {
          await rateLimitRedisClient.disconnect()
        } catch (e) {
          // Ignora erros ao desconectar
        }
        rateLimitRedisClient = null
      }
    }

    const redisUrl = process.env.REDIS_RATE_LIMIT_URL

    if (!redisUrl) {
      console.warn('⚠️ REDIS_RATE_LIMIT_URL não configurada, usando apenas cache em memória para rate limiting')
      return
    }
    
    console.log('✅ REDIS_RATE_LIMIT_URL configurada para rate limiting')

    try {
      rateLimitRedisClient = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: RATE_LIMIT_CONNECTION_TIMEOUT,
          commandTimeout: RATE_LIMIT_COMMAND_TIMEOUT,
          reconnectStrategy: () => false // Não reconectar automaticamente em serverless
        }
      })

      rateLimitRedisClient.on('ready', () => {
        console.log('✅ Rate Limit Redis: Pronto para uso')
        rateLimitRedisConnected = true
        
        if (rateLimitRedisDisabled) {
          console.log('🔓 Rate Limit Redis foi reabilitado')
          rateLimitRedisDisabled = false
          lastRateLimitCriticalError = null
        }
      })

      rateLimitRedisClient.on('error', (error: any) => {
        console.error('❌ Rate Limit Redis: Erro:', error.message)
        rateLimitRedisConnected = false
        handleRateLimitRedisError(error)
      })

      rateLimitRedisClient.on('end', () => {
        console.log('🔌 Rate Limit Redis: Conexão encerrada')
        rateLimitRedisConnected = false
      })

      await rateLimitRedisClient.connect()

    } catch (error) {
      console.error('❌ Erro ao conectar Rate Limit Redis:', error)
      rateLimitRedisClient = null
      rateLimitRedisConnected = false
    }
  }

  /**
   * Garantir que Redis está conectado (lazy loading)
   */
  private async ensureRedisConnection(): Promise<void> {
    if (RATE_LIMIT_LAZY_CONNECT && !rateLimitRedisConnected && !isRateLimitInitializing) {
      await this.initializeRedis()
    }
    lastRateLimitActivity = Date.now()
  }

  /**
   * Obter valor do cache
   */
  async get<T = any>(key: string, options: RateLimitCacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix)

    try {
      if (!rateLimitRedisDisabled) {
        await this.ensureRedisConnection()
        
        if (rateLimitRedisConnected && rateLimitRedisClient) {
          const value = await rateLimitRedisClient.get(fullKey)
          
          if (value !== null) {
            const parsed = JSON.parse(value)
            return parsed
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar no Rate Limit Redis (${fullKey}):`, error)
      handleRateLimitRedisError(error)
    }

    // Fallback para memória
    const memoryItem = rateLimitMemoryCache.get(fullKey)
    if (memoryItem) {
      if (!memoryItem.ttl || (Date.now() - memoryItem.timestamp) < (memoryItem.ttl * 1000)) {
        return memoryItem.data
      } else {
        rateLimitMemoryCache.delete(fullKey)
      }
    }

    return null
  }

  /**
   * Armazenar valor no cache
   */
  async set<T = any>(key: string, value: T, options: RateLimitCacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix)
    const ttl = options.ttl || RATE_LIMIT_DEFAULT_TTL
    const serialized = serializeValue(value)

    try {
      if (!rateLimitRedisDisabled) {
        await this.ensureRedisConnection()
        
        if (rateLimitRedisConnected && rateLimitRedisClient) {
          await rateLimitRedisClient.setEx(fullKey, ttl, serialized)
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao salvar no Rate Limit Redis (${fullKey}):`, error)
      handleRateLimitRedisError(error)
    }

    // Sempre salvar na memória também (fallback)
    rateLimitMemoryCache.set(fullKey, {
      data: value,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Remover valor do cache
   */
  async delete(key: string, options: RateLimitCacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix)

    try {
      if (!rateLimitRedisDisabled) {
        await this.ensureRedisConnection()
        
        if (rateLimitRedisConnected && rateLimitRedisClient) {
          await rateLimitRedisClient.del(fullKey)
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao deletar do Rate Limit Redis (${fullKey}):`, error)
      handleRateLimitRedisError(error)
    }

    rateLimitMemoryCache.delete(fullKey)
  }

  /**
   * Construir chave completa com prefixo
   */
  private buildKey(key: string, prefix?: string): string {
    const parts = ['analisador-acoes', 'rate-limit']
    
    if (prefix) {
      parts.push(prefix)
    }
    
    if (key) {
      parts.push(key)
    }

    return parts.join(':')
  }

  /**
   * Desconectar Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (rateLimitRedisClient) {
        await rateLimitRedisClient.disconnect()
        rateLimitRedisClient = null
        rateLimitRedisConnected = false
      }
    } catch (error) {
      console.warn('⚠️ Erro ao desconectar Rate Limit Redis:', error)
    }

    rateLimitMemoryCache.clear()
    this.initialized = false
  }

  /**
   * Verificar se Redis está conectado
   */
  isRedisConnected(): boolean {
    return rateLimitRedisConnected
  }
}

// Instância singleton
export const rateLimitCacheService = RateLimitCacheService.getInstance()

// Inicializar automaticamente se não estiver no browser
if (typeof window === 'undefined') {
  rateLimitCacheService.initialize().catch(error => {
    console.error('❌ Erro ao inicializar RateLimitCacheService:', error)
  })
}

// Funções de conveniência para uso direto
export const rateLimitCache = {
  /**
   * Obter valor do cache
   */
  get: <T = any>(key: string, options?: RateLimitCacheOptions) => 
    rateLimitCacheService.get<T>(key, options),

  /**
   * Armazenar valor no cache
   */
  set: <T = any>(key: string, value: T, options?: RateLimitCacheOptions) => 
    rateLimitCacheService.set(key, value, options),

  /**
   * Remover valor do cache
   */
  delete: (key: string, options?: RateLimitCacheOptions) => 
    rateLimitCacheService.delete(key, options),
}

// Cleanup na saída do processo
if (typeof window === 'undefined') {
  process.on('SIGINT', async () => {
    console.log('🛑 Encerrando RateLimitCacheService...')
    await rateLimitCacheService.disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('🛑 Encerrando RateLimitCacheService...')
    await rateLimitCacheService.disconnect()
    process.exit(0)
  })
}

