/**
 * SERVIÇO DE CACHE UNIFICADO
 * 
 * Encapsulação robusta que usa Redis como cache primário
 * com fallback automático para cache em memória.
 * 
 * Características:
 * - Redis como cache principal (distribuído)
 * - Fallback automático para memória se Redis falhar
 * - Interface unificada para todo o projeto
 * - Serialização automática de objetos
 * - TTL (Time To Live) configurável
 * - Logs detalhados para debugging
 * - Reconexão automática do Redis
 */

// Importação condicional do Redis apenas no servidor
let createClient: any = null
let RedisClientType: any = null

// Só importa Redis se estivermos no servidor
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const redisModule = require('redis')
    createClient = redisModule.createClient
    RedisClientType = redisModule.RedisClientType
  } catch (error: any) {
    console.warn('Redis não disponível, usando apenas cache em memória')
  }
}

// Tipos para o cache
export interface CacheOptions {
  ttl?: number // Time to live em segundos
  prefix?: string // Prefixo para as chaves
}

export interface CacheItem<T = any> {
  data: T
  timestamp: number
  ttl?: number
}

// Cliente Redis
let redisClient: any | null = null
let redisConnected = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

// Cache em memória como fallback
const memoryCache = new Map<string, CacheItem>()

// Configurações
const DEFAULT_TTL = 3600 // 1 hora em segundos
const MEMORY_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutos
const REDIS_RECONNECT_DELAY = 5000 // 5 segundos

/**
 * Classe principal do serviço de cache
 */
export class CacheService {
  private static instance: CacheService
  private initialized = false

  private constructor() {}

  /**
   * Singleton pattern
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  /**
   * Inicializar o serviço de cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('🚀 Inicializando CacheService...')

    // Tentar conectar ao Redis
    await this.initializeRedis()

    // Configurar limpeza automática do cache em memória
    this.setupMemoryCleanup()

    this.initialized = true
    console.log('✅ CacheService inicializado com sucesso')
  }

  /**
   * Inicializar conexão Redis
   */
  private async initializeRedis(): Promise<void> {
    // Verificar se estamos no servidor e se Redis está disponível
    if (typeof window !== 'undefined' || !createClient) {
      console.log('🔄 Redis não disponível, usando apenas cache em memória')
      return
    }

    const redisUrl = process.env.REDIS_URL

    if (!redisUrl) {
      console.warn('⚠️ REDIS_URL não configurada, usando apenas cache em memória')
      return
    }

    try {
      console.log('🔗 Conectando ao Redis...')
      
      redisClient = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries: number) => {
            if (retries > MAX_RECONNECT_ATTEMPTS) {
              console.error('❌ Redis: Máximo de tentativas de reconexão atingido')
              return false
            }
            const delay = Math.min(retries * 1000, REDIS_RECONNECT_DELAY)
            console.log(`🔄 Redis: Tentativa de reconexão ${retries}/${MAX_RECONNECT_ATTEMPTS} em ${delay}ms`)
            return delay
          }
        }
      })

      // Event listeners
      redisClient.on('connect', () => {
        console.log('🔗 Redis: Conectando...')
      })

      redisClient.on('ready', () => {
        console.log('✅ Redis: Pronto para uso')
        redisConnected = true
        reconnectAttempts = 0
      })

      redisClient.on('error', (error: any) => {
        console.error('❌ Redis: Erro de conexão:', error.message)
        redisConnected = false
      })

      redisClient.on('end', () => {
        console.log('🔌 Redis: Conexão encerrada')
        redisConnected = false
      })

      redisClient.on('reconnecting', () => {
        console.log('🔄 Redis: Reconectando...')
        reconnectAttempts++
      })

      // Conectar
      await redisClient.connect()

    } catch (error) {
      console.error('❌ Erro ao conectar ao Redis:', error)
      redisClient = null
      redisConnected = false
    }
  }

  /**
   * Configurar limpeza automática do cache em memória
   */
  private setupMemoryCleanup(): void {
    setInterval(() => {
      this.cleanupMemoryCache()
    }, MEMORY_CLEANUP_INTERVAL)

    console.log(`🧹 Limpeza automática do cache em memória configurada (${MEMORY_CLEANUP_INTERVAL / 1000}s)`)
  }

  /**
   * Limpar itens expirados do cache em memória
   */
  private cleanupMemoryCache(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, item] of memoryCache.entries()) {
      if (item.ttl && (now - item.timestamp) > (item.ttl * 1000)) {
        memoryCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache em memória: ${cleaned} itens expirados removidos`)
    }
  }

  /**
   * Obter valor do cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix)

    try {
      // Tentar Redis primeiro
      if (redisConnected && redisClient) {
        const value = await redisClient.get(fullKey)
        if (value !== null) {
          const parsed = JSON.parse(value)
          console.log(`📦 Cache HIT (Redis): ${fullKey}`)
          return parsed
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar no Redis (${fullKey}):`, error)
    }

    // Fallback para memória
    const memoryItem = memoryCache.get(fullKey)
    if (memoryItem) {
      // Verificar se não expirou
      if (!memoryItem.ttl || (Date.now() - memoryItem.timestamp) < (memoryItem.ttl * 1000)) {
        console.log(`📦 Cache HIT (Memory): ${fullKey}`)
        return memoryItem.data
      } else {
        // Remover item expirado
        memoryCache.delete(fullKey)
      }
    }

    console.log(`📦 Cache MISS: ${fullKey}`)
    return null
  }

  /**
   * Armazenar valor no cache
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix)
    const ttl = options.ttl || DEFAULT_TTL
    const serialized = JSON.stringify(value)

    try {
      // Tentar Redis primeiro
      if (redisConnected && redisClient) {
        await redisClient.setEx(fullKey, ttl, serialized)
        console.log(`💾 Cache SET (Redis): ${fullKey} (TTL: ${ttl}s)`)
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao salvar no Redis (${fullKey}):`, error)
    }

    // Sempre salvar na memória também (fallback)
    memoryCache.set(fullKey, {
      data: value,
      timestamp: Date.now(),
      ttl
    })
    console.log(`💾 Cache SET (Memory): ${fullKey} (TTL: ${ttl}s)`)
  }

  /**
   * Remover valor do cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix)

    try {
      // Remover do Redis
      if (redisConnected && redisClient) {
        await redisClient.del(fullKey)
        console.log(`🗑️ Cache DELETE (Redis): ${fullKey}`)
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao deletar do Redis (${fullKey}):`, error)
    }

    // Remover da memória
    memoryCache.delete(fullKey)
    console.log(`🗑️ Cache DELETE (Memory): ${fullKey}`)
  }

  /**
   * Limpar todo o cache
   */
  async clear(prefix?: string): Promise<void> {
    try {
      // Limpar Redis
      if (redisConnected && redisClient) {
        if (prefix) {
          const pattern = this.buildKey('*', prefix)
          const keys = await redisClient.keys(pattern)
          if (keys.length > 0) {
            await redisClient.del(keys)
            console.log(`🧹 Cache CLEAR (Redis): ${keys.length} chaves com prefixo "${prefix}"`)
          }
        } else {
          await redisClient.flushDb()
          console.log('🧹 Cache CLEAR (Redis): Todos os dados')
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao limpar Redis:', error)
    }

    // Limpar memória
    if (prefix) {
      const prefixPattern = this.buildKey('', prefix)
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefixPattern)) {
          memoryCache.delete(key)
        }
      }
      console.log(`🧹 Cache CLEAR (Memory): Chaves com prefixo "${prefix}"`)
    } else {
      memoryCache.clear()
      console.log('🧹 Cache CLEAR (Memory): Todos os dados')
    }
  }

  /**
   * Buscar chaves por padrão (Redis KEYS command)
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      if (redisConnected && redisClient) {
        return await redisClient.keys(pattern)
      }
      
      // Fallback para memória
      const keys: string[] = []
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          keys.push(key)
        }
      }
      
      return keys
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar chaves por padrão ${pattern}:`, error)
      return []
    }
  }

  /**
   * Deletar múltiplas chaves
   */
  async deleteKeys(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0
    
    let deleted = 0
    
    try {
      // Deletar do Redis
      if (redisConnected && redisClient && keys.length > 0) {
        deleted += await redisClient.del(keys)
      }
    } catch (error) {
      console.warn('⚠️ Erro ao deletar chaves do Redis:', error)
    }
    
    // Deletar da memória
    for (const key of keys) {
      if (memoryCache.has(key)) {
        memoryCache.delete(key)
        deleted++
      }
    }
    
    return deleted
  }

  /**
   * Limpar cache por padrão wildcard
   */
  async clearByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.getKeysByPattern(pattern)
      if (keys.length > 0) {
        const deleted = await this.deleteKeys(keys)
        console.log(`🧹 Cache CLEAR (Pattern): ${deleted} chaves com padrão "${pattern}"`)
        return deleted
      }
      return 0
    } catch (error) {
      console.warn(`⚠️ Erro ao limpar por padrão ${pattern}:`, error)
      return 0
    }
  }

  /**
   * Verificar se Redis está conectado
   */
  isRedisConnected(): boolean {
    return redisConnected
  }

  /**
   * Obter estatísticas do cache
   */
  async getStats(): Promise<{
    redis: { connected: boolean; keys?: number }
    memory: { keys: number; size: string }
  }> {
    const stats = {
      redis: { connected: redisConnected } as any,
      memory: {
        keys: memoryCache.size,
        size: this.getMemoryCacheSize()
      }
    }

    try {
      if (redisConnected && redisClient) {
        const info = await redisClient.info('keyspace')
        const dbKeys = info.match(/keys=(\d+)/)
        stats.redis.keys = dbKeys ? parseInt(dbKeys[1]) : 0
      }
    } catch (error) {
      console.warn('⚠️ Erro ao obter stats do Redis:', error)
    }

    return stats
  }

  /**
   * Construir chave completa com prefixo
   */
  private buildKey(key: string, prefix?: string): string {
    const parts = ['analisador-acoes'] // Prefixo global do projeto
    
    if (prefix) {
      parts.push(prefix)
    }
    
    if (key) {
      parts.push(key)
    }

    return parts.join(':')
  }

  /**
   * Calcular tamanho aproximado do cache em memória
   */
  private getMemoryCacheSize(): string {
    let size = 0
    for (const [key, value] of memoryCache.entries()) {
      size += key.length * 2 // Aproximação para string UTF-16
      size += JSON.stringify(value).length * 2
    }
    
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  /**
   * Fechar conexões
   */
  async disconnect(): Promise<void> {
    try {
      if (redisClient) {
        await redisClient.disconnect()
        console.log('🔌 Redis: Desconectado')
      }
    } catch (error) {
      console.warn('⚠️ Erro ao desconectar Redis:', error)
    }

    memoryCache.clear()
    console.log('🧹 Cache em memória limpo')
  }
}

// Instância singleton
export const cacheService = CacheService.getInstance()

// Inicializar automaticamente se não estiver no browser
if (typeof window === 'undefined') {
  cacheService.initialize().catch(error => {
    console.error('❌ Erro ao inicializar CacheService:', error)
  })
}

// Funções de conveniência para uso direto
export const cache = {
  /**
   * Obter valor do cache
   */
  get: <T = any>(key: string, options?: CacheOptions) => 
    cacheService.get<T>(key, options),

  /**
   * Armazenar valor no cache
   */
  set: <T = any>(key: string, value: T, options?: CacheOptions) => 
    cacheService.set(key, value, options),

  /**
   * Remover valor do cache
   */
  delete: (key: string, options?: CacheOptions) => 
    cacheService.delete(key, options),

  /**
   * Limpar cache
   */
  clear: (prefix?: string) => 
    cacheService.clear(prefix),

  /**
   * Obter estatísticas
   */
  stats: () => 
    cacheService.getStats(),

  /**
   * Wrapper para cache com função
   * Executa a função apenas se não houver cache
   */
  wrap: async <T = any>(
    key: string, 
    fn: () => Promise<T> | T, 
    options?: CacheOptions
  ): Promise<T> => {
    // Tentar obter do cache primeiro
    const cached = await cacheService.get<T>(key, options)
    if (cached !== null) {
      return cached
    }

    // Executar função e cachear resultado
    const result = await fn()
    await cacheService.set(key, result, options)
    return result
  },

  /**
   * Buscar chaves por padrão
   */
  getKeysByPattern: (pattern: string) => 
    cacheService.getKeysByPattern(pattern),

  /**
   * Deletar múltiplas chaves
   */
  deleteKeys: (keys: string[]) => 
    cacheService.deleteKeys(keys),

  /**
   * Limpar cache por padrão
   */
  clearByPattern: (pattern: string) => 
    cacheService.clearByPattern(pattern),

  /**
   * Verificar se Redis está conectado
   */
  isRedisConnected: () => 
    cacheService.isRedisConnected()
}

// Cleanup na saída do processo
if (typeof window === 'undefined') {
  process.on('SIGINT', async () => {
    console.log('🛑 Encerrando CacheService...')
    await cacheService.disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('🛑 Encerrando CacheService...')
    await cacheService.disconnect()
    process.exit(0)
  })
}
