/**
 * Helper para fazer requisições ao Yahoo Finance API com User-Agent
 * 
 * O Yahoo Finance bloqueia requisições sem User-Agent (erro 429 Too Many Requests)
 * Este helper adiciona um User-Agent válido em todas as requisições
 * 
 * Baseado em: https://stackoverflow.com/questions/78111453/yahoo-finance-api-file-get-contents-429-too-many-requests
 */

/**
 * User-Agent padrão para requisições ao Yahoo Finance
 * Usa um User-Agent de navegador comum para evitar bloqueios
 */
const YAHOO_FINANCE_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Faz uma requisição fetch ao Yahoo Finance com User-Agent configurado
 * 
 * @param url URL completa do Yahoo Finance API
 * @param options Opções adicionais para fetch (headers serão mesclados)
 * @returns Response da requisição
 */
export async function fetchYahooFinance(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Mesclar headers existentes com User-Agent
  const headers = new Headers(options.headers);
  headers.set('User-Agent', YAHOO_FINANCE_USER_AGENT);
  
  // Criar novas opções com headers atualizados
  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };
  
  return fetch(url, fetchOptions);
}

/**
 * Faz uma requisição fetch ao Yahoo Finance e retorna JSON parseado
 * 
 * @param url URL completa do Yahoo Finance API
 * @param options Opções adicionais para fetch
 * @returns Dados JSON parseados
 */
export async function fetchYahooFinanceJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchYahooFinance(url, options);
  
  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

