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
 * 
 * IMPORTANTE: Este serviço só funciona no servidor. O código já possui
 * verificações internas (typeof window === 'undefined') para garantir que
 * Redis só seja usado no servidor.
 */

/**
 * GESTÃO DE CONEXÕES (melhorias v2 + Serverless):
 * - Singleton real: UMA única conexão Redis compartilhada POR INSTÂNCIA
 * - Mutex de inicialização: evita race conditions
 * - Reutilização de conexão: verifica antes de criar nova
 * - Cleanup adequado: libera recursos na desconexão
 * - Keep-alive: mantém conexão ativa com ping automático
 * 
 * OTIMIZAÇÕES SERVERLESS (Vercel):
 * - Lazy loading: conecta apenas quando necessário
 * - Idle disconnect: desconecta após 30s de inatividade
 * - Reconexão automática: reconecta na próxima operação
 * - IMPORTANTE: Cada função Lambda tem sua própria instância/conexão
 *   (isso é normal e esperado em ambientes serverless)
 * 
 * FAIL-FAST PATTERN (prevenção de degradação):
 * - Detecta erros críticos do Redis (max clients, connection refused, etc)
 * - Desabilita Redis automaticamente nesta instância quando erro crítico ocorre
 * - Aplicação continua funcionando normalmente com cache em memória
 * - Evita tentativas repetidas que causariam timeout e degradação
 * - Cada nova instância Lambda tenta conectar normalmente (stateless)
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

// Função auxiliar para serializar valores com BigInt
function serializeValue(value: any): string {
  return JSON.stringify(value, (_, v) => 
    typeof v === 'bigint' ? v.toString() : v
  )
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

// Cliente Redis (GLOBAL ÚNICO)
let redisClient: any | null = null
let redisConnected = false
let reconnectAttempts = 0

// Controle de inicialização (evita múltiplas conexões)
let initializationPromise: Promise<void> | null = null
let isInitializing = false

// Controle de atividade (para desconexão automática em serverless)
let lastActivity = Date.now()
let idleCheckInterval: NodeJS.Timeout | null = null

// ⚡ FAIL-FAST: Evita degradação quando Redis está indisponível (otimizado para serverless)
let redisDisabled = false // true = Redis desabilitado nesta instância (max clients ou erro crítico)
let lastCriticalError: string | null = null // Último erro crítico
const CRITICAL_ERRORS = ['max number of clients', 'maxclients', 'too many clients', 'econnrefused', 'connection refused']

// Cache em memória como fallback
const memoryCache = new Map<string, CacheItem>()

// Configurações
const DEFAULT_TTL = 3600 // 1 hora em segundos
const MEMORY_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutos
const REDIS_RECONNECT_DELAY = 5000 // 5 segundos
const REDIS_IDLE_TIMEOUT = 10000 // 10 segundos de inatividade antes de desconectar (agressivo para serverless)
const LAZY_CONNECT = true // Conecta apenas quando necessário (otimização serverless)
const CONNECTION_TIMEOUT = 3000 // 3 segundos timeout para conectar (fail-fast)
const COMMAND_TIMEOUT = 2000 // 2 segundos timeout para comandos (fail-fast)
const DISCONNECT_AFTER_OPERATION = process.env.REDIS_DISCONNECT_AFTER_OP === 'true' // Desconectar após cada operação (modo ultra-agressivo)

/**
 * Funções auxiliares de Fail-Fast (otimizado para serverless)
 */
function isCriticalError(error: any): boolean {
  const errorMsg = error?.message?.toLowerCase() || ''
  const errorCode = error?.code?.toLowerCase() || ''
  
  return CRITICAL_ERRORS.some(criticalErr => 
    errorMsg.includes(criticalErr) || errorCode.includes(criticalErr)
  )
}

function handleRedisError(error: any): void {
  const errorMsg = error?.message || 'Unknown error'
  console.log(`🔍 DEBUG handleRedisError:`, {
    message: errorMsg,
    isCritical: isCriticalError(error),
    redisDisabled,
    redisConnected
  })
  
  // Se for erro crítico (max clients, connection refused, etc), desabilita Redis nesta instância
  if (isCriticalError(error)) {
    console.error(`🚨 Redis: ERRO CRÍTICO (${errorMsg}) - Redis DESABILITADO nesta instância`)
    console.log('📝 Aplicação continuará usando cache em memória como fallback')
    
    redisDisabled = true
    lastCriticalError = errorMsg
    redisConnected = false
    
    // Desconectar e limpar cliente para liberar recursos
    if (redisClient) {
      redisClient.disconnect().catch(() => {})
      redisClient = null
    }
  } else {
    // Erros não críticos apenas logam
    console.warn(`⚠️ Redis: Erro não crítico, tentará novamente na próxima operação:`, errorMsg)
  }
}

/**
 * Desconectar após operação (modo ultra-agressivo para minimizar conexões)
 * Só executa se a variável de ambiente REDIS_DISCONNECT_AFTER_OP=true
 */
async function disconnectAfterOperation(): Promise<void> {
  if (DISCONNECT_AFTER_OPERATION && redisClient && redisConnected) {
    try {
      await redisClient.disconnect()
      redisConnected = false
      console.log('🔌 Redis: Desconectado após operação (modo ultra-agressivo)')
    } catch (error) {
      // Ignora erros ao desconectar
    }
  }
}

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
   * Usa mutex para evitar múltiplas inicializações simultâneas
   */
  async initialize(): Promise<void> {
    // Se já inicializado, retorna imediatamente
    if (this.initialized) return

    // Se já está inicializando, aguarda a inicialização em progresso
    if (isInitializing && initializationPromise) {
      console.log('⏳ CacheService já está sendo inicializado, aguardando...')
      return initializationPromise
    }

    // Marca como inicializando e cria a promise
    isInitializing = true
    initializationPromise = this._doInitialize()

    try {
      await initializationPromise
    } finally {
      isInitializing = false
      initializationPromise = null
    }
  }

  /**
   * Realiza a inicialização efetiva (método privado)
   */
  private async _doInitialize(): Promise<void> {
    console.log('🚀 Inicializando CacheService...')
    console.log('🔍 Configuração:', {
      LAZY_CONNECT,
      REDIS_IDLE_TIMEOUT,
      DISCONNECT_AFTER_OPERATION,
      isServerless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
    })

    // Em modo lazy, não conecta ao Redis imediatamente
    if (!LAZY_CONNECT) {
      console.log('📡 LAZY_CONNECT = false: Conectando imediatamente ao Redis')
      await this.initializeRedis()
    } else {
      console.log('⏳ LAZY_CONNECT = true: Redis conectará quando necessário')
    }

    // Configurar limpeza automática do cache em memória (apenas uma vez)
    if (!this.initialized) {
      this.setupMemoryCleanup()
      
      // Configurar monitoramento de inatividade (serverless)
      this.setupIdleDisconnect()
    }

    this.initialized = true
    console.log('✅ CacheService inicializado com sucesso' + (LAZY_CONNECT ? ' (lazy mode)' : ''))
  }

  /**
   * Configurar desconexão automática por inatividade (otimização serverless)
   */
  private setupIdleDisconnect(): void {
    // Apenas em ambientes serverless (Vercel)
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      idleCheckInterval = setInterval(() => {
        const idleTime = Date.now() - lastActivity
        
        if (idleTime > REDIS_IDLE_TIMEOUT && redisClient && redisConnected) {
          console.log(`⏰ Redis ocioso por ${Math.round(idleTime / 1000)}s, desconectando para liberar conexão...`)
          this.disconnectRedis().catch(err => 
            console.warn('Erro ao desconectar Redis ocioso:', err)
          )
        }
      }, Math.min(REDIS_IDLE_TIMEOUT / 2, 5000)) // Verifica com mais frequência (máx 5s)
      
      console.log(`⏰ Monitoramento agressivo de inatividade configurado (${REDIS_IDLE_TIMEOUT / 1000}s)`)
    }
  }

  /**
   * Inicializar conexão Redis
   */
  private async initializeRedis(): Promise<void> {
    console.log('🚀 initializeRedis CHAMADO')
    
    // Verificar se estamos no servidor e se Redis está disponível
    if (typeof window !== 'undefined') {
      console.log('⚠️ Rodando no browser, não pode usar Redis')
      return
    }
    
    if (!createClient) {
      console.log('⚠️ createClient não disponível (módulo redis não carregado)')
      return
    }
    
    console.log('✅ Ambiente: Servidor + Redis module disponível')

    // Se já existe uma conexão ativa, reutiliza
    if (redisClient && redisConnected) {
      console.log('♻️ Redis já conectado, reutilizando conexão existente')
      return
    }

    // Se já existe um cliente mas não está conectado, tenta reconectar
    if (redisClient && !redisConnected) {
      try {
        console.log('🔄 Tentando reconectar cliente Redis existente...')
        await redisClient.connect()
        console.log('✅ Redis reconectado com sucesso')
        return
      } catch (error) {
        console.warn('⚠️ Falha ao reconectar, criando nova conexão:', error)
        // Limpa o cliente anterior antes de criar novo
        try {
          await redisClient.disconnect()
        } catch (e) {
          // Ignora erros ao desconectar
        }
        redisClient = null
      }
    }

    const redisUrl = process.env.REDIS_URL

    if (!redisUrl) {
      console.warn('⚠️ REDIS_URL não configurada, usando apenas cache em memória')
      return
    }
    
    console.log('✅ REDIS_URL configurada:', redisUrl.substring(0, 30) + '...')

    try {
      console.log('🔗 Criando nova conexão Redis...')
      
      redisClient = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: CONNECTION_TIMEOUT, // 3s timeout (fail-fast)
          commandTimeout: COMMAND_TIMEOUT, // 2s timeout para comandos
          reconnectStrategy: (retries: number) => {
            // Em serverless, não tentar reconectar automaticamente
            // (deixa a próxima Lambda tentar)
            console.warn(`❌ Redis: Falha na conexão (tentativa ${retries}), desabilitando reconexão automática`)
            return false // Não reconectar
          },
          // Otimizações para reduzir uso de conexões
          keepAlive: 0, // Desabilitar TCP keep-alive (reduz overhead)
          noDelay: true // Desabilitar algoritmo de Nagle (menor latência, menos buffers)
        },
        // IMPORTANTE: Desabilitar ping/keep-alive para não manter conexão aberta
        // Em serverless, queremos desconectar rapidamente quando ocioso
        // pingInterval não é definido (desabilitado)
      })

      // Event listeners
      redisClient.on('connect', () => {
        console.log('🔗 Redis: Conectando...')
      })

      redisClient.on('ready', () => {
        console.log('✅ Redis: Pronto para uso')
        redisConnected = true
        reconnectAttempts = 0
        
        // 🔧 IMPORTANTE: Resetar flag disabled quando conectar com sucesso
        if (redisDisabled) {
          console.log('🔓 Redis foi reabilitado após conexão bem-sucedida')
          redisDisabled = false
          lastCriticalError = null
        }
      })

      redisClient.on('error', (error: any) => {
        console.error('❌ Redis: Erro de conexão:', error.message)
        redisConnected = false
        handleRedisError(error)
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
      console.log('📡 Chamando redisClient.connect()...')
      await redisClient.connect()
      console.log('✅ redisClient.connect() completou (aguardando evento "ready")')

    } catch (error) {
      console.error('❌ Erro ao conectar ao Redis:', error)
      console.error('❌ Stack:', error instanceof Error ? error.stack : 'N/A')
      redisClient = null
      redisConnected = false
    }
    
    console.log('🏁 initializeRedis finalizado. Estado:', {
      clientExists: redisClient !== null,
      connected: redisConnected
    })
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
   * Garantir que Redis está conectado (lazy loading)
   */
  private async ensureRedisConnection(): Promise<void> {
    if (LAZY_CONNECT && !redisConnected && !isInitializing) {
      console.log('🔄 Iniciando Redis via lazy loading...')
      await this.initializeRedis()
    }
    // Atualizar timestamp de atividade
    lastActivity = Date.now()
  }

  /**
   * Obter valor do cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix)

    try {
      // ⚡ FAIL-FAST: Verificar se foi DESABILITADO (erro crítico anterior)
      if (redisDisabled) {
        // Redis desabilitado, usar apenas memória (silencioso)
      } else {
        // 🔄 Garantir conexão (lazy loading) - SEMPRE tentar se não disabled
        await this.ensureRedisConnection()
        
        // ✅ Agora verificar se está conectado e usar Redis
        if (redisConnected && redisClient) {
          const value = await redisClient.get(fullKey)
          
          // Desconectar após operação (modo ultra-agressivo)
          await disconnectAfterOperation()
          
          if (value !== null) {
            const parsed = JSON.parse(value)
            return parsed
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar no Redis (${fullKey}):`, error)
      handleRedisError(error)
      await disconnectAfterOperation() // Desconectar mesmo em caso de erro
    }

    // Fallback para memória
    const memoryItem = memoryCache.get(fullKey)
    if (memoryItem) {
      // Verificar se não expirou
      if (!memoryItem.ttl || (Date.now() - memoryItem.timestamp) < (memoryItem.ttl * 1000)) {
        return memoryItem.data
      } else {
        // Remover item expirado
        memoryCache.delete(fullKey)
      }
    }
    return null
  }

  /**
   * Armazenar valor no cache
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix)
    const ttl = options.ttl || DEFAULT_TTL
    const serialized = serializeValue(value)

    try {
      // ⚡ FAIL-FAST: Verificar se foi DESABILITADO
      if (!redisDisabled) {
        // 🔄 Garantir conexão (lazy loading)
        await this.ensureRedisConnection()
        
        // ✅ Tentar Redis se conectado
        if (redisConnected && redisClient) {
          await redisClient.setEx(fullKey, ttl, serialized)

          // Desconectar após operação (modo ultra-agressivo)
          await disconnectAfterOperation()
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao salvar no Redis (${fullKey}):`, error)
      handleRedisError(error)
      await disconnectAfterOperation() // Desconectar mesmo em caso de erro
    }

    // Sempre salvar na memória também (fallback)
    memoryCache.set(fullKey, {
      data: value,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Remover valor do cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix)

    try {
      // ⚡ FAIL-FAST: Verificar se foi DESABILITADO
      if (!redisDisabled) {
        await this.ensureRedisConnection()
        
        if (redisConnected && redisClient) {
          await redisClient.del(fullKey)
          console.log(`🗑️ Cache DELETE (Redis): ${fullKey}`)
          await disconnectAfterOperation()
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao deletar do Redis (${fullKey}):`, error)
      handleRedisError(error)
      await disconnectAfterOperation()
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
      // ⚡ FAIL-FAST: Verificar se foi DESABILITADO
      if (!redisDisabled) {
        await this.ensureRedisConnection()
        
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
          await disconnectAfterOperation()
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao limpar Redis:', error)
      handleRedisError(error)
      await disconnectAfterOperation()
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
      // ⚡ FAIL-FAST: Verificar se foi DESABILITADO
      if (!redisDisabled) {
        await this.ensureRedisConnection()
        
        if (redisConnected && redisClient) {
          const keys = await redisClient.keys(pattern)
          await disconnectAfterOperation()
          return keys
        }
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
      handleRedisError(error)
      await disconnectAfterOperation()
      
      // Fallback para memória em caso de erro
      const keys: string[] = []
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          keys.push(key)
        }
      }
      
      return keys
    }
  }

  /**
   * Deletar múltiplas chaves
   */
  async deleteKeys(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0
    
    let deleted = 0
    
    try {
      // ⚡ FAIL-FAST: Verificar se foi DESABILITADO
      if (!redisDisabled) {
        await this.ensureRedisConnection()
        
        if (redisConnected && redisClient && keys.length > 0) {
          deleted += await redisClient.del(keys)
          await disconnectAfterOperation()
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao deletar chaves do Redis:', error)
      handleRedisError(error)
      await disconnectAfterOperation()
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
   * Obter informações detalhadas sobre a conexão Redis
   */
  getConnectionInfo(): {
    connected: boolean
    clientExists: boolean
    reconnectAttempts: number
    initialized: boolean
    idleTime: number
    lazyMode: boolean
    isServerless: boolean
    redisDisabled: boolean
    lastCriticalError: string | null
  } {
    return {
      connected: redisConnected,
      clientExists: redisClient !== null,
      reconnectAttempts,
      initialized: this.initialized,
      idleTime: Math.round((Date.now() - lastActivity) / 1000), // em segundos
      lazyMode: LAZY_CONNECT,
      isServerless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
      redisDisabled: redisDisabled,
      lastCriticalError: lastCriticalError
    }
  }

  /**
   * Obter estatísticas do cache
   */
  async getStats(): Promise<{
    redis: { connected: boolean; keys?: number; disabled?: boolean }
    memory: { keys: number; size: string }
  }> {
    const stats = {
      redis: { 
        connected: redisConnected,
        disabled: redisDisabled
      } as any,
      memory: {
        keys: memoryCache.size,
        size: this.getMemoryCacheSize()
      }
    }

    try {
      // ⚡ FAIL-FAST: Verificar se foi DESABILITADO
      if (!redisDisabled) {
        await this.ensureRedisConnection()
        
        if (redisConnected && redisClient) {
          const info = await redisClient.info('keyspace')
          const dbKeys = info.match(/keys=(\d+)/)
          stats.redis.keys = dbKeys ? parseInt(dbKeys[1]) : 0
          await disconnectAfterOperation()
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao obter stats do Redis:', error)
      handleRedisError(error)
      await disconnectAfterOperation()
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
      size += serializeValue(value).length * 2
    }
    
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  /**
   * Desconectar apenas o Redis (mantém serviço ativo para reconexão)
   */
  private async disconnectRedis(): Promise<void> {
    try {
      if (redisClient && redisConnected) {
        await redisClient.disconnect()
        redisConnected = false
        console.log('🔌 Redis: Desconectado (idle)')
      }
    } catch (error) {
      console.warn('⚠️ Erro ao desconectar Redis:', error)
      redisConnected = false
    }
  }

  /**
   * Fechar conexões e limpar tudo
   */
  async disconnect(): Promise<void> {
    // Limpar interval de idle check
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval)
      idleCheckInterval = null
    }

    try {
      if (redisClient) {
        await redisClient.disconnect()
        redisClient = null
        redisConnected = false
        console.log('🔌 Redis: Desconectado e cliente limpo')
      }
    } catch (error) {
      console.warn('⚠️ Erro ao desconectar Redis:', error)
      // Força limpeza mesmo com erro
      redisClient = null
      redisConnected = false
    }

    // 🔧 IMPORTANTE: Resetar flags ao desconectar (preparar para reconexão limpa)
    redisDisabled = false
    lastCriticalError = null

    memoryCache.clear()
    this.initialized = false
    console.log('🧹 Cache em memória limpo e serviço resetado (flags resetadas)')
  }
}

// Instância singleton
export const cacheService = CacheService.getInstance()

// Inicializar automaticamente se não estiver no browser
if (typeof window === 'undefined') {
  console.log('🌟 Módulo cache-service carregado no servidor - iniciando auto-init')
  cacheService.initialize().catch(error => {
    console.error('❌ Erro ao inicializar CacheService automaticamente:', error)
    console.error('❌ Stack:', error instanceof Error ? error.stack : 'N/A')
  })
} else {
  console.log('🌐 Módulo cache-service carregado no browser - pulando init')
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
    cacheService.isRedisConnected(),

  /**
   * Obter informações detalhadas da conexão
   */
  getConnectionInfo: () => 
    cacheService.getConnectionInfo()
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
