/**
 * SISTEMA DE CACHE INTELIGENTE PARA QUERIES
 * 
 * Este sistema implementa cache automático para queries de leitura com
 * invalidação inteligente baseada em operações de escrita nas tabelas.
 * 
 * Características:
 * - Cache automático para queries SELECT (1 hora TTL)
 * - Invalidação automática quando dados são modificados
 * - Detecção de tabelas afetadas por queries
 * - Mapeamento de dependências entre tabelas
 * - Logs detalhados para debugging
 */

import { cache } from './cache-service'
import crypto from 'crypto'

// Configurações do cache
const QUERY_CACHE_TTL = 60 * 60 // 1 hora em segundos
const CACHE_PREFIX = 'query'

// Mapeamento de dependências entre tabelas
// Quando uma tabela é modificada, invalida cache de tabelas relacionadas
const TABLE_DEPENDENCIES: Record<string, string[]> = {
  // Empresas e dados relacionados
  'companies': ['companies', 'financial_data', 'daily_quotes', 'key_statistics'],
  'financial_data': ['companies', 'financial_data', 'key_statistics'],
  'daily_quotes': ['companies', 'daily_quotes', 'key_statistics'],
  'key_statistics': ['companies', 'key_statistics'],
  
  // Demonstrações financeiras
  'balance_sheets': ['companies', 'balance_sheets', 'key_statistics'],
  'income_statements': ['companies', 'income_statements', 'key_statistics'],
  'cashflow_statements': ['companies', 'cashflow_statements', 'key_statistics'],
  'quarterly_financials': ['companies', 'quarterly_financials', 'key_statistics'],
  'value_added_statements': ['companies', 'value_added_statements'],
  
  // Usuários e dados pessoais
  'users': ['users', 'portfolios', 'portfolio_assets', 'ranking_history', 'backtest_configs'],
  'portfolios': ['users', 'portfolios', 'portfolio_assets'],
  'portfolio_assets': ['portfolios', 'portfolio_assets'],
  
  // Sistema de ranking e backtest
  'ranking_history': ['users', 'ranking_history'],
  'backtest_configs': ['users', 'backtest_configs', 'backtest_results', 'backtest_assets'],
  'backtest_results': ['backtest_configs', 'backtest_results'],
  'backtest_assets': ['backtest_configs', 'backtest_assets'],
  'backtest_transactions': ['backtest_configs', 'backtest_transactions'],
  
  // Sistema de suporte e IA
  'support_tickets': ['users', 'support_tickets', 'ticket_messages'],
  'ticket_messages': ['support_tickets', 'ticket_messages'],
  'ai_reports': ['companies', 'ai_reports', 'ai_report_feedbacks'],
  'ai_report_feedbacks': ['ai_reports', 'ai_report_feedbacks'],
  
  // Dados de mercado
  'historical_prices': ['companies', 'historical_prices'],
  'price_oscillations': ['companies', 'price_oscillations'],
  
  // Sistema de processamento
  'ticker_processing_status': ['companies', 'ticker_processing_status'],
  'alfa_waitlist': ['alfa_waitlist']
}

// Padrões de queries que devem ser cacheadas
const CACHEABLE_PATTERNS = [
  /\.findMany\(/,
  /\.findFirst\(/,
  /\.findUnique\(/,
  /\.count\(/,
  /\.aggregate\(/,
  /\.groupBy\(/,
  /SELECT\s+/i,
  /WITH\s+/i
]

// Padrões de queries que invalidam cache (operações de escrita)
const WRITE_PATTERNS = [
  /\.create\(/,
  /\.createMany\(/,
  /\.update\(/,
  /\.updateMany\(/,
  /\.upsert\(/,
  /\.delete\(/,
  /\.deleteMany\(/,
  /INSERT\s+/i,
  /UPDATE\s+/i,
  /DELETE\s+/i,
  /UPSERT\s+/i
]

// Extração de nomes de tabelas de queries
const TABLE_PATTERNS = [
  /prisma\.(\w+)\./g,
  /FROM\s+(\w+)/gi,
  /UPDATE\s+(\w+)/gi,
  /INSERT\s+INTO\s+(\w+)/gi,
  /DELETE\s+FROM\s+(\w+)/gi
]

/**
 * Sistema de cache inteligente para queries
 */
export class SmartQueryCache {
  
  /**
   * Verifica se uma query deve ser cacheada
   */
  static shouldCacheQuery(queryName: string, operationString: string): boolean {
    // Não cachear queries muito específicas ou com parâmetros dinâmicos
    if (queryName.includes('user-specific') || queryName.includes('session')) {
      return false
    }
    
    // Verificar se é uma query de leitura
    return CACHEABLE_PATTERNS.some(pattern => pattern.test(operationString))
  }
  
  /**
   * Verifica se uma query é de escrita (modifica dados)
   */
  static isWriteQuery(operationString: string): boolean {
    return WRITE_PATTERNS.some(pattern => pattern.test(operationString))
  }
  
  /**
   * Extrai nomes de tabelas de uma query
   */
  static extractTableNames(operationString: string): string[] {
    const tables = new Set<string>()
    
    // Extrair tabelas usando diferentes padrões
    TABLE_PATTERNS.forEach(pattern => {
      const matches = operationString.matchAll(pattern)
      for (const match of matches) {
        if (match[1]) {
          // Converter de camelCase para snake_case se necessário
          const tableName = this.camelToSnakeCase(match[1])
          tables.add(tableName)
        }
      }
    })
    
    return Array.from(tables)
  }
  
  /**
   * Converte camelCase para snake_case
   */
  static camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '')
  }
  
  /**
   * Gera chave de cache baseada na query
   */
  static generateCacheKey(queryName: string, operationString: string): string {
    // Criar hash da operação completa para garantir unicidade
    // Isso inclui parâmetros, filtros, ordenação, etc.
    const hash = crypto.createHash('md5').update(operationString).digest('hex').substring(0, 12)
    return `${queryName}-${hash}`
  }
  
  /**
   * Obtém todas as tabelas que devem ter cache invalidado
   */
  static getTablesForInvalidation(modifiedTables: string[]): string[] {
    const tablesToInvalidate = new Set<string>()
    
    modifiedTables.forEach(table => {
      // Adicionar a própria tabela
      tablesToInvalidate.add(table)
      
      // Adicionar tabelas dependentes
      const dependencies = TABLE_DEPENDENCIES[table] || []
      dependencies.forEach(dep => tablesToInvalidate.add(dep))
    })
    
    return Array.from(tablesToInvalidate)
  }
  
  /**
   * Invalida cache baseado nas tabelas modificadas
   */
  static async invalidateCacheForTables(tables: string[]): Promise<void> {
    try {
      const tablesToInvalidate = this.getTablesForInvalidation(tables)
      
      console.log(`🗑️ Invalidando cache para tabelas: ${tablesToInvalidate.join(', ')}`)
      
      // Invalidar cache usando múltiplos padrões para capturar todas as chaves relacionadas
      const patterns = [
        // Padrão principal por tabela
        ...tablesToInvalidate.map(table => `${CACHE_PREFIX}-${table}`),
        // Padrão geral que pode conter qualquer tabela
        `${CACHE_PREFIX}-general`,
        // Padrões específicos para queries que podem afetar múltiplas tabelas
        ...tablesToInvalidate.map(table => `*${table}*`),
      ]
      
      let totalKeysCleared = 0
      
      for (const pattern of patterns) {
        try {
          const keysCleared = await this.clearCacheByPattern(pattern)
          totalKeysCleared += keysCleared
        } catch (patternError) {
          console.warn(`⚠️ Erro ao limpar padrão ${pattern}:`, patternError)
        }
      }
      
      // Log de invalidação
      console.log(`✅ Cache invalidado: ${totalKeysCleared} chaves para ${tablesToInvalidate.length} tabelas`)
      
    } catch (error) {
      console.error('❌ Erro ao invalidar cache:', error)
    }
  }

  /**
   * Limpa cache usando padrão específico
   */
  private static async clearCacheByPattern(pattern: string): Promise<number> {
    try {
      // Se o padrão contém asterisco, usar busca por padrão
      if (pattern.includes('*')) {
        return await cache.clearByPattern(pattern)
      } else {
        // Usar clear normal por prefixo
        await cache.clear(pattern)
        return 1 // Assumir que limpou pelo menos 1 padrão
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao limpar padrão ${pattern}:`, error)
      return 0
    }
  }
  
  /**
   * Executa query com cache inteligente
   */
  static async executeWithCache<T>(
    queryName: string,
    operation: () => Promise<T>,
    operationString?: string
  ): Promise<T> {
    const opString = operationString || operation.toString()
    
    // Verificar se é query de escrita
    if (this.isWriteQuery(opString)) {
      console.log(`✍️ Query de escrita detectada: ${queryName}`)
      
      // Executar operação de escrita
      const result = await operation()
      
      // Invalidar cache das tabelas afetadas
      const affectedTables = this.extractTableNames(opString)
      if (affectedTables.length > 0) {
        await this.invalidateCacheForTables(affectedTables)
      }
      
      return result
    }
    
    // Verificar se deve cachear query de leitura
    if (!this.shouldCacheQuery(queryName, opString)) {
      console.log(`🚫 Query não cacheável: ${queryName}`)
      return await operation()
    }
    
    // Gerar chave de cache
    const cacheKey = this.generateCacheKey(queryName, opString)
    const affectedTables = this.extractTableNames(opString)
    const tablePrefix = affectedTables.length > 0 ? affectedTables[0] : 'general'
    const fullCacheKey = `${CACHE_PREFIX}-${tablePrefix}-${cacheKey}`
    
    try {
      // Tentar obter do cache
      const cached = await cache.get<T>(fullCacheKey)
      if (cached !== null) {
        console.log(`📦 Cache HIT: ${queryName} (${fullCacheKey})`)
        return cached
      }
      
      console.log(`📦 Cache MISS: ${queryName} (${fullCacheKey})`)
      
      // Executar query e cachear resultado
      const result = await operation()
      
      // Cachear apenas se o resultado não for null/undefined
      if (result !== null && result !== undefined) {
        await cache.set(fullCacheKey, result, {
          ttl: QUERY_CACHE_TTL
        })
        console.log(`💾 Query cacheada: ${queryName} (TTL: ${QUERY_CACHE_TTL}s)`)
      }
      
      return result
      
    } catch (error) {
      console.error(`❌ Erro no cache da query '${queryName}':`, error)
      // Em caso de erro no cache, executar query normalmente
      return await operation()
    }
  }
  
  /**
   * Limpa todo o cache de queries
   */
  static async clearAllQueryCache(): Promise<void> {
    try {
      await cache.clear(CACHE_PREFIX)
      console.log('🧹 Todo o cache de queries foi limpo')
    } catch (error) {
      console.error('❌ Erro ao limpar cache de queries:', error)
    }
  }
  
  /**
   * Obtém estatísticas do cache de queries
   */
  static async getCacheStats(): Promise<{
    totalKeys: number
    cacheHitRate?: number
    topTables: string[]
  }> {
    try {
      const stats = await cache.stats()
      
      return {
        totalKeys: stats.redis.keys || stats.memory.keys,
        topTables: Object.keys(TABLE_DEPENDENCIES).slice(0, 10)
      }
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas do cache:', error)
      return {
        totalKeys: 0,
        topTables: []
      }
    }
  }
}

// Funções de conveniência para uso direto
export const smartCache = {
  /**
   * Executa query com cache inteligente
   */
  execute: <T>(queryName: string, operation: () => Promise<T>, operationString?: string) =>
    SmartQueryCache.executeWithCache(queryName, operation, operationString),
  
  /**
   * Invalida cache para tabelas específicas
   */
  invalidate: (tables: string[]) =>
    SmartQueryCache.invalidateCacheForTables(tables),
  
  /**
   * Limpa todo o cache
   */
  clear: () =>
    SmartQueryCache.clearAllQueryCache(),
  
  /**
   * Obtém estatísticas
   */
  stats: () =>
    SmartQueryCache.getCacheStats()
}
