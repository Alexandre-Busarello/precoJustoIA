/**
 * Utilitários compartilhados para verificar status do mercado B3
 * Funções que podem ser usadas tanto no cliente quanto no servidor
 * (não usam módulos Node.js como yahoo-finance2)
 * 
 * Para funções client-side puras, use market-status-client.ts
 * Para funções server-side que usam Yahoo Finance, use market-status-server.ts
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

