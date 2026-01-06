/**
 * YAHOO FINANCE2 SERVICE
 * 
 * Serviço centralizado que encapsula todos os usos da biblioteca yahoo-finance2
 * com cache inteligente e proteção contra erros consecutivos.
 * 
 * Características:
 * - Cache Redis com TTL de 24 horas baseado em parâmetros + data atual
 * - Proteção contra erros consecutivos (marca indisponível por 1h após 3 erros)
 * - Logs detalhados para debugging
 * - Interface unificada para todos os métodos do yahoo-finance2
 * 
 * IMPORTANTE: Este serviço só funciona no servidor. O loadYahooFinance() já
 * possui verificações para garantir que não seja executado no cliente.
 */

import crypto from 'crypto';
import { CacheService } from './cache-service';
import { loadYahooFinance } from './yahoo-finance-loader';

// Yahoo Finance instance (lazy-loaded)
let yahooFinanceInstance: any = null;

// Cache service instance
const cacheService = CacheService.getInstance();

// Constantes
const CACHE_TTL = 86400; // 24 horas em segundos
const UNAVAILABLE_TTL = 3600; // 1 hora em segundos
const MAX_CONSECUTIVE_ERRORS = 3;
const CACHE_PREFIX = 'yahoo';
const UNAVAILABLE_KEY = `${CACHE_PREFIX}:unavailable`;
const ERROR_COUNT_KEY = `${CACHE_PREFIX}:error_count`;

/**
 * Carrega instância do Yahoo Finance (lazy loading)
 */
async function getYahooFinanceInstance(): Promise<any> {
  if (!yahooFinanceInstance) {
    yahooFinanceInstance = await loadYahooFinance();
    if (!yahooFinanceInstance) {
      throw new Error('getYahooFinanceInstance() can only be called on the server');
    }
  }
  return yahooFinanceInstance;
}

/**
 * Gera hash MD5 dos parâmetros para usar como parte da chave de cache
 */
function hashParams(params: any): string {
  if (!params || Object.keys(params).length === 0) {
    return 'default';
  }
  
  // Normalizar parâmetros ordenando as chaves para garantir consistência
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Constrói chave de cache baseada em método, símbolo, parâmetros e data atual
 */
function buildCacheKey(method: string, symbol: string, params?: any): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const paramsHash = hashParams(params);
  return `${CACHE_PREFIX}:${method}:${symbol}:${paramsHash}:${today}`;
}

/**
 * Verifica se Yahoo Finance está marcado como indisponível
 */
async function isYahooUnavailable(): Promise<boolean> {
  try {
    const unavailable = await cacheService.get(UNAVAILABLE_KEY);
    return unavailable !== null;
  } catch (error) {
    // Se houver erro ao verificar cache, assumir disponível para não bloquear
    console.warn('⚠️ [YAHOO SERVICE] Erro ao verificar indisponibilidade, assumindo disponível:', error);
    return false;
  }
}

/**
 * Incrementa contador de erros consecutivos
 */
async function incrementErrorCount(): Promise<number> {
  try {
    const currentCount = await cacheService.get<number>(ERROR_COUNT_KEY) || 0;
    const newCount = currentCount + 1;
    await cacheService.set(ERROR_COUNT_KEY, newCount, { ttl: UNAVAILABLE_TTL }); // TTL igual ao de indisponibilidade
    return newCount;
  } catch (error) {
    console.warn('⚠️ [YAHOO SERVICE] Erro ao incrementar contador de erros:', error);
    return 1; // Retornar 1 como fallback
  }
}

/**
 * Reseta contador de erros consecutivos (chamado após sucesso)
 */
async function resetErrorCount(): Promise<void> {
  try {
    await cacheService.set(ERROR_COUNT_KEY, 0, { ttl: UNAVAILABLE_TTL });
  } catch (error) {
    // Ignorar erros ao resetar contador
  }
}

/**
 * Marca Yahoo Finance como indisponível por 1 hora
 */
async function markYahooUnavailable(): Promise<void> {
  try {
    await cacheService.set(UNAVAILABLE_KEY, true, { ttl: UNAVAILABLE_TTL });
    console.warn(`🚨 [YAHOO SERVICE] Yahoo Finance marcado como indisponível por ${UNAVAILABLE_TTL}s`);
  } catch (error) {
    console.warn('⚠️ [YAHOO SERVICE] Erro ao marcar Yahoo como indisponível:', error);
  }
}

/**
 * Verifica se um erro deve ser considerado para contagem de erros consecutivos
 */
function isRetryableError(error: any): boolean {
  const errorMsg = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';
  const errorString = String(error).toLowerCase();
  
  // Erros que indicam problema temporário do Yahoo
  const retryablePatterns = [
    '429', // Rate limiting
    'rate limit',
    'too many',
    'jwt',
    'verification',
    'crumb',
    'unauthorized',
    'forbidden',
    'timeout',
    'fetch failed',
    'network',
    'econnreset',
    'etimedout',
    'econnrefused',
    'service unavailable',
    'temporary',
  ];
  
  return retryablePatterns.some(pattern => 
    errorMsg.includes(pattern) || 
    errorCode.includes(pattern) || 
    errorString.includes(pattern)
  );
}

/**
 * Função genérica para executar métodos do Yahoo Finance com cache e proteção
 */
async function executeWithCache<T>(
  method: string,
  symbol: string,
  executor: () => Promise<T>,
  params?: any
): Promise<T> {
  const cacheKey = buildCacheKey(method, symbol, params);
  
  // 1. Verificar cache primeiro
  try {
    const cached = await cacheService.get<T>(cacheKey);
    if (cached !== null) {
      console.log(`✅ [YAHOO SERVICE] Cache hit: ${method}(${symbol})`);
      return cached;
    }
  } catch (error) {
    console.warn(`⚠️ [YAHOO SERVICE] Erro ao verificar cache, continuando com consulta direta:`, error);
  }
  
  // 2. Verificar se Yahoo está indisponível
  const unavailable = await isYahooUnavailable();
  if (unavailable) {
    const error = new Error(`Yahoo Finance está temporariamente indisponível (marcado após erros consecutivos). Tente novamente em até 1 hora.`);
    console.warn(`🚫 [YAHOO SERVICE] Bloqueado: ${method}(${symbol}) - Yahoo indisponível`);
    throw error;
  }
  
  // 3. Executar consulta ao Yahoo Finance
  try {
    console.log(`🔄 [YAHOO SERVICE] Consultando Yahoo: ${method}(${symbol})`);
    const result = await executor();
    
    // 4. Sucesso: salvar no cache e resetar contador de erros
    try {
      await cacheService.set(cacheKey, result, { ttl: CACHE_TTL });
      await resetErrorCount();
      console.log(`✅ [YAHOO SERVICE] Sucesso: ${method}(${symbol}) - dados salvos no cache`);
    } catch (cacheError) {
      console.warn(`⚠️ [YAHOO SERVICE] Erro ao salvar no cache (dados retornados mesmo assim):`, cacheError);
    }
    
    return result;
  } catch (error) {
    // 5. Erro: verificar se é erro recuperável
    const isRetryable = isRetryableError(error);
    
    if (isRetryable) {
      // Incrementar contador de erros
      const errorCount = await incrementErrorCount();
      console.warn(`⚠️ [YAHOO SERVICE] Erro recuperável (${errorCount}/${MAX_CONSECUTIVE_ERRORS}): ${method}(${symbol}) - ${error instanceof Error ? error.message : String(error)}`);
      
      // Se atingiu limite de erros, marcar como indisponível
      if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
        await markYahooUnavailable();
      }
    } else {
      // Erro não recuperável (ex: símbolo inválido), não contar como erro consecutivo
      console.error(`❌ [YAHOO SERVICE] Erro não recuperável: ${method}(${symbol}) - ${error instanceof Error ? error.message : String(error)}`);
    }
    
    throw error;
  }
}

/**
 * YAHOO FINANCE2 SERVICE
 * 
 * Encapsula todos os métodos do yahoo-finance2 com cache e proteção
 */
export class YahooFinance2Service {
  /**
   * Obtém cotação atual de um símbolo
   */
  static async getQuote(symbol: string): Promise<any> {
    const yahooFinance = await getYahooFinanceInstance();
    return executeWithCache(
      'quote',
      symbol,
      () => yahooFinance.quote(symbol)
    );
  }

  /**
   * Obtém dados de gráfico (histórico) de um símbolo
   */
  static async getChart(symbol: string, options?: any): Promise<any> {
    const yahooFinance = await getYahooFinanceInstance();
    return executeWithCache(
      'chart',
      symbol,
      () => yahooFinance.chart(symbol, options),
      options
    );
  }

  /**
   * Executa método do Yahoo Finance SEM CACHE
   * Útil para realtime-return que precisa sempre buscar dados atualizados
   */
  private static async executeWithoutCache<T>(
    method: string,
    symbol: string,
    executor: () => Promise<T>
  ): Promise<T> {
    // Verificar se Yahoo está indisponível (mesma proteção, mas sem cache)
    const unavailable = await isYahooUnavailable();
    if (unavailable) {
      const error = new Error(`Yahoo Finance está temporariamente indisponível (marcado após erros consecutivos). Tente novamente em até 1 hora.`);
      console.warn(`🚫 [YAHOO SERVICE] Bloqueado (sem cache): ${method}(${symbol}) - Yahoo indisponível`);
      throw error;
    }
    
    try {
      console.log(`🔄 [YAHOO SERVICE] Consultando Yahoo SEM CACHE: ${method}(${symbol})`);
      const result = await executor();
      await resetErrorCount();
      console.log(`✅ [YAHOO SERVICE] Sucesso (sem cache): ${method}(${symbol})`);
      return result;
    } catch (error) {
      const isRetryable = isRetryableError(error);
      
      if (isRetryable) {
        const errorCount = await incrementErrorCount();
        console.warn(`⚠️ [YAHOO SERVICE] Erro recuperável (${errorCount}/${MAX_CONSECUTIVE_ERRORS}) sem cache: ${method}(${symbol}) - ${error instanceof Error ? error.message : String(error)}`);
        
        if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
          await markYahooUnavailable();
        }
      } else {
        console.error(`❌ [YAHOO SERVICE] Erro não recuperável (sem cache): ${method}(${symbol}) - ${error instanceof Error ? error.message : String(error)}`);
      }
      
      throw error;
    }
  }

  /**
   * Obtém cotação atual de um símbolo SEM CACHE
   * Útil para realtime-return que precisa sempre buscar dados atualizados
   */
  static async getQuoteWithoutCache(symbol: string): Promise<any> {
    const yahooFinance = await getYahooFinanceInstance();
    return this.executeWithoutCache(
      'quote',
      symbol,
      () => yahooFinance.quote(symbol)
    );
  }

  /**
   * Obtém dados de gráfico (histórico) de um símbolo SEM CACHE
   * Útil para realtime-return que precisa sempre buscar dados atualizados
   */
  static async getChartWithoutCache(symbol: string, options?: any): Promise<any> {
    const yahooFinance = await getYahooFinanceInstance();
    return this.executeWithoutCache(
      'chart',
      symbol,
      () => yahooFinance.chart(symbol, options)
    );
  }

  /**
   * Obtém resumo detalhado de um símbolo
   */
  static async getQuoteSummary(symbol: string, options?: any): Promise<any> {
    const yahooFinance = await getYahooFinanceInstance();
    return executeWithCache(
      'quoteSummary',
      symbol,
      () => yahooFinance.quoteSummary(symbol, options),
      options
    );
  }

  /**
   * Obtém séries temporais de fundamentos
   */
  static async getFundamentalsTimeSeries(ticker: string, options?: any): Promise<any> {
    const yahooFinance = await getYahooFinanceInstance();
    return executeWithCache(
      'fundamentalsTimeSeries',
      ticker,
      () => yahooFinance.fundamentalsTimeSeries(ticker, options),
      options
    );
  }

  /**
   * Obtém dados históricos (método deprecated, mas ainda usado)
   */
  static async getHistorical(ticker: string, options?: any): Promise<any> {
    const yahooFinance = await getYahooFinanceInstance();
    return executeWithCache(
      'historical',
      ticker,
      () => yahooFinance.historical(ticker, options),
      options
    );
  }
}

// Exportar métodos como funções standalone para facilitar uso
export const getQuote = YahooFinance2Service.getQuote.bind(YahooFinance2Service);
export const getChart = YahooFinance2Service.getChart.bind(YahooFinance2Service);
export const getQuoteWithoutCache = YahooFinance2Service.getQuoteWithoutCache.bind(YahooFinance2Service);
export const getChartWithoutCache = YahooFinance2Service.getChartWithoutCache.bind(YahooFinance2Service);
export const getQuoteSummary = YahooFinance2Service.getQuoteSummary.bind(YahooFinance2Service);
export const getFundamentalsTimeSeries = YahooFinance2Service.getFundamentalsTimeSeries.bind(YahooFinance2Service);
export const getHistorical = YahooFinance2Service.getHistorical.bind(YahooFinance2Service);

