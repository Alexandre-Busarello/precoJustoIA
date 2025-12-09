/**
 * Helper para carregar yahoo-finance2 apenas no servidor
 * Este arquivo garante que o import dinâmico só aconteça quando realmente necessário
 * e nunca seja incluído no bundle do cliente
 * 
 * IMPORTANTE: Este arquivo nunca deve ser importado em componentes client-side
 */

/**
 * Carrega a instância do Yahoo Finance apenas no servidor
 * Retorna null se chamado no cliente (para evitar bundle)
 * 
 * Usa uma técnica de lazy loading que evita análise estática do webpack
 */
export async function loadYahooFinance(): Promise<any> {
  // Verificação crítica: se estamos no cliente, retornar null imediatamente
  // ANTES de qualquer outra operação para evitar análise estática
  if (typeof window !== 'undefined') {
    return null;
  }
  
  // Verificação adicional usando process.env (disponível apenas no servidor)
  // Isso garante que o código abaixo nunca seja executado no cliente
  if (typeof process === 'undefined' || !process.env) {
    return null;
  }
  
  // Usar uma função interna que só é criada no servidor
  // Isso ajuda o webpack a entender que este código não deve ser incluído no bundle do cliente
  const loadModule = async () => {
    // Import dinâmico usando string literal para evitar análise estática
    const moduleName = 'yahoo-finance2';
    const module = await import(moduleName);
    const YahooFinance = module.default;
    return new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
  };
  
  try {
    return await loadModule();
  } catch (error) {
    console.error('Erro ao carregar yahoo-finance2:', error);
    return null;
  }
}

