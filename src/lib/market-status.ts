/**
 * Utilitários para verificar status do mercado B3
 * SERVER-SIDE apenas - contém funções que usam módulos Node.js (Yahoo Finance)
 * 
 * Para funções que funcionam no cliente, use market-status-client.ts
 */

/**
 * Obtém a data de hoje no timezone de Brasília (início do dia)
 * Retorna uma Date que quando formatada em Brasília representa 00:00:00 do dia atual
 * 
 * IMPORTANTE: A Date retornada será interpretada corretamente quando passada
 * para funções que usam timezone de Brasília (como checkMarketWasOpen)
 */
export function getTodayInBrazil(): Date {
  const now = new Date();
  
  // Obter componentes da data atual em Brasília
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1; // month é 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  
  // Criar uma data de teste para descobrir o offset de Brasília
  // Usar meio-dia para evitar problemas de horário de verão
  const testDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  const testParts = formatter.formatToParts(testDate);
  const testHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0', 10);
  
  // Calcular offset: se testDate é 12:00 UTC e em Brasília é testHour, então:
  // offset = 12 - testHour
  // Para criar 00:00 em Brasília, precisamos de (0 + offset) em UTC
  const offset = 12 - testHour;
  
  // Criar data UTC que representa 00:00:00 em Brasília
  const utcHour = 0 + offset;
  const resultDate = new Date(Date.UTC(year, month, day, utcHour, 0, 0, 0));
  
  // Verificar se está correto
  const verifyParts = formatter.formatToParts(resultDate);
  const verifyDay = parseInt(verifyParts.find(p => p.type === 'day')?.value || '0', 10);
  const verifyHour = parseInt(verifyParts.find(p => p.type === 'hour')?.value || '0', 10);
  
  if (verifyDay === day && verifyHour === 0) {
    return resultDate;
  }
  
  // Fallback: tentar ajustar manualmente
  // Brasília geralmente está UTC-3 (horário padrão) ou UTC-2 (horário de verão)
  // 00:00 em Brasília (UTC-3) = 03:00 UTC
  // 00:00 em Brasília (UTC-2) = 02:00 UTC
  const utcDate3 = new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
  const verify3Parts = formatter.formatToParts(utcDate3);
  const verify3Day = parseInt(verify3Parts.find(p => p.type === 'day')?.value || '0', 10);
  const verify3Hour = parseInt(verify3Parts.find(p => p.type === 'hour')?.value || '0', 10);
  
  if (verify3Day === day && verify3Hour === 0) {
    return utcDate3;
  }
  
  const utcDate2 = new Date(Date.UTC(year, month, day, 2, 0, 0, 0));
  const verify2Parts = formatter.formatToParts(utcDate2);
  const verify2Day = parseInt(verify2Parts.find(p => p.type === 'day')?.value || '0', 10);
  const verify2Hour = parseInt(verify2Parts.find(p => p.type === 'hour')?.value || '0', 10);
  
  if (verify2Day === day && verify2Hour === 0) {
    return utcDate2;
  }
  
  // Último fallback: retornar a data calculada mesmo que não seja perfeita
  return resultDate;
}

// Re-exportar funções do cliente para compatibilidade com código existente do servidor
// Mas preferir usar market-status-client.ts quando possível
export { isBrazilMarketOpen, isBrazilMarketClosed } from './market-status-client';

// Yahoo Finance instance (lazy-loaded)
let yahooFinanceInstance: any = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    const module = await import('yahoo-finance2');
    const YahooFinance = module.default;
    yahooFinanceInstance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
  }
  return yahooFinanceInstance;
}

/**
 * Helper: Verifica se há cotação válida do IBOVESPA para uma data específica
 * Usa yahoo-finance2 que já configura User-Agent corretamente
 * 
 * @param date Data a verificar
 * @returns true se há cotação válida (close > 0) para a data, false caso contrário
 */
export async function hasIBOVQuoteForDate(date: Date): Promise<boolean> {
  try {
    const yahooFinance = await getYahooFinance();
    const ibovSymbol = '^BVSP'; // IBOVESPA no Yahoo Finance (sem .SA)
    
    // Buscar dados do dia específico (usar intervalo diário para precisão)
    const startDate = new Date(date);
    startDate.setUTCDate(startDate.getUTCDate() - 2); // Buscar alguns dias antes
    const endDate = new Date(date);
    endDate.setUTCDate(endDate.getUTCDate() + 1); // Até o dia seguinte
    
    const result = await yahooFinance.chart(ibovSymbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d', // Dados diários para precisão
      return: 'array'
    });
    
    // O resultado pode vir como array direto ou como objeto com quotes
    const quotes = Array.isArray(result) ? result : (result?.quotes || []);
    
    if (!quotes || quotes.length === 0) {
      return false;
    }
    
    // Formatter para normalizar datas usando timezone de Brasília
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    // Normalizar data alvo para string ISO (usando timezone de Brasília)
    const targetDateParts = formatter.formatToParts(date);
    const targetYear = parseInt(targetDateParts.find(p => p.type === 'year')?.value || '0', 10);
    const targetMonth = parseInt(targetDateParts.find(p => p.type === 'month')?.value || '0', 10);
    const targetDay = parseInt(targetDateParts.find(p => p.type === 'day')?.value || '0', 10);
    const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    
    // Verificar se há uma cotação exata para a data alvo
    for (const quote of quotes) {
      const quoteDate = new Date(quote.date);
      
      // Normalizar a data da cotação para string ISO (usando timezone de Brasília)
      const quoteParts = formatter.formatToParts(quoteDate);
      const quoteYear = parseInt(quoteParts.find(p => p.type === 'year')?.value || '0', 10);
      const quoteMonth = parseInt(quoteParts.find(p => p.type === 'month')?.value || '0', 10);
      const quoteDay = parseInt(quoteParts.find(p => p.type === 'day')?.value || '0', 10);
      const quoteDateStr = `${quoteYear}-${String(quoteMonth).padStart(2, '0')}-${String(quoteDay).padStart(2, '0')}`;
      
      // Comparar strings ISO (mais confiável que timestamps)
      if (quoteDateStr === targetDateStr && quote.close && quote.close > 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`❌ [MARKET STATUS] Erro ao verificar cotação do IBOVESPA para ${date.toISOString()}:`, error);
    return false;
  }
}

/**
 * Verifica se o IBOVESPA já teve movimentação hoje (primeira cotação do dia)
 * Usa hasIBOVQuoteForDate para verificar se há cotação válida de hoje
 * 
 * IMPORTANTE: Esta função verifica se o mercado já começou a funcionar hoje,
 * não apenas se está aberto no horário. Útil para invalidar cache quando
 * o mercado começa a operar.
 * 
 * @returns true se há cotação de hoje com preço válido, false caso contrário
 */
export async function hasIBOVMovementToday(): Promise<boolean> {
  try {
    const today = getTodayInBrazil();
    return await hasIBOVQuoteForDate(today);
  } catch (error) {
    console.error('Erro ao verificar movimentação do IBOVESPA via Yahoo Finance:', error);
    return false;
  }
}

