/**
 * Utilitários para verificar status do mercado B3
 * Versão CLIENT-SIDE apenas - funções puras sem dependências Node.js
 * 
 * IMPORTANTE: Este arquivo pode ser usado tanto no cliente quanto no servidor
 * mas não contém código que depende de módulos Node.js
 */

/**
 * Verifica se o mercado B3 está aberto no momento atual (horário de Brasília)
 * Função pura que funciona tanto no cliente quanto no servidor
 */
export function isBrazilMarketOpen(): boolean {
  const now = new Date();
  
  // Criar formatter para horário de Brasília
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  });
  
  // Formatar e parsear partes
  const parts = formatter.formatToParts(now);
  
  const hour = parseInt(
    parts.find((p) => p.type === 'hour')?.value || '0',
    10
  );
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  
  // Mapear dia da semana
  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };
  
  const dayOfWeek = dayMap[weekday] ?? 0;
  
  // Mercado B3: Segunda a Sexta, 10h às 18h (horário de Brasília)
  return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 18;
}

/**
 * Verifica se o mercado B3 está fechado (horário de Brasília)
 */
export function isBrazilMarketClosed(): boolean {
  return !isBrazilMarketOpen();
}

