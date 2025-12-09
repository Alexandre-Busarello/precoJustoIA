/**
 * Funções server-side do market-status que usam Yahoo Finance
 * Este arquivo NUNCA deve ser importado em componentes client-side
 * 
 * Para funções client-side, use market-status-client.ts
 * Para funções server-side que não usam Yahoo Finance, use market-status.ts
 */

import { loadYahooFinance } from './yahoo-finance-loader';

// Yahoo Finance instance (lazy-loaded)
let yahooFinanceInstance: any = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    yahooFinanceInstance = await loadYahooFinance();
    if (!yahooFinanceInstance) {
      throw new Error('getYahooFinance() can only be called on the server');
    }
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

import { getTodayInBrazil } from './market-status';

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

