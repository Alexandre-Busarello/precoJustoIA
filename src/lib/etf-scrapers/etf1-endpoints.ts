/**
 * Endpoints da API interna do etf1.com.br descobertos via scripts/discover-etf1-api.ts
 *
 * Descoberta em 2026-05-22: API é pública (sem cookie/sessão).
 * Um único endpoint retorna detalhes, holdings, retornos e características.
 */

export const ETF1_BASE_URL = 'https://etf1.com.br';

// Endpoint único: detalhes + holdings + retornos
export const ETF1_ETF_URL_TEMPLATE = `${ETF1_BASE_URL}/api/v1/etfs/{ticker}?currency=BRL`;

export const ETF1_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; PrecoJustoAI/1.0)',
  Accept: 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Referer: ETF1_BASE_URL,
};

export function buildEtfUrl(ticker: string): string {
  return ETF1_ETF_URL_TEMPLATE.replace('{ticker}', ticker);
}

// ── Interfaces da resposta real ────────────────────────────────────────────

export interface Etf1Identification {
  ticker?: string;
  name?: string;
  category?: string;
  asset_class?: string;
}

export interface Etf1Characteristics {
  expense_ratio?: string;   // "0.1%" — precisa parse
  aum?: string;             // "R$13.7B" — precisa parse
  holdings_count?: string;
  index_name?: string;      // → benchmarkIndex
  dividend_policy?: string;
  dividend_yield?: string;
  inception_date?: string;
}

export interface Etf1ReturnPeriod {
  period: string;           // "6m", "1a", "3a", "5a", "10a", "Max"
  return_pct?: string;      // "+29.86%" — precisa parse
  cagr?: string;
  volatility?: string;      // "17.17%" — precisa parse
  sharpe?: string | number;
}

export interface Etf1HoldingItem {
  ticker?: string;
  name: string;
  portfolio_percent: number; // já é número (ex: 12.23 = 12.23%)
  sector?: string;
  country?: string;
  is_etf_derivado?: boolean;
}

export interface Etf1Response {
  identification?: Etf1Identification;
  characteristics?: Etf1Characteristics;
  holdings?: Etf1HoldingItem[];
  returns?: Etf1ReturnPeriod[];
  rentability?: {
    total_return?: string;
    cagr?: string;
    volatility?: string;
  };
  index_class?: {
    nome?: string;
    sigla?: string;
  };
  [key: string]: unknown;
}

// ── Helpers de parse ───────────────────────────────────────────────────────

/** "+29.86%" → 0.2986 */
export function parsePct(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace('%', '').replace('+', '').replace(',', '.'));
  return isNaN(n) ? null : n / 100;
}

/** "0.1%" → 0.001 */
export function parseExpenseRatio(value: string | undefined | null): number | null {
  return parsePct(value);
}

/** "R$13.7B" → 13700000000  |  "R$105M" → 105000000 */
export function parseAum(value: string | undefined | null): number | null {
  if (!value) return null;
  const clean = value.replace(/R\$|,/g, '').trim();
  const match = clean.match(/^([\d.]+)([KMBT]?)$/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return isNaN(num) ? null : num * (mult[suffix] ?? 1);
}
