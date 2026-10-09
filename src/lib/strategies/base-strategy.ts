import { 
  BaseStrategy, 
  StrategyParams, 
  CompanyData, 
  StrategyAnalysis, 
  RankBuilderResult,
  TechnicalAnalysisData,
  CompanyFinancialData
} from './types';
import { formatNumber, formatPct } from '../format';
import { MIN_DISCOUNT_GROWTH_SPREAD } from '../finance/valuation';
import { sectorClass, type SectorClass } from '../finance/sector-classification';
import { getMacroAssumptionsSync, keFromMacro, type MacroAssumptions } from '../finance/macro';
import { marginOfSafety as discountFromPrices, upside as upsideFromPrices } from '../valuation-metrics';

// Funções utilitárias

/** ETFs internacionais tratados como BDR (mesma lista de `BDRDataService.isBDR`). */
const INTERNATIONAL_ETF_TICKERS = ['IVVB11', 'SPXI11'];

/**
 * Mesma regra de `BDRDataService.isBDR` (tickers terminados em 34/35 e ETFs internacionais), sem importar o serviço,
 * que carrega o Prisma: as estratégias ficam puras e testáveis sem banco.
 */
export function isBDRTickerSymbol(ticker: string | undefined | null): boolean {
  if (!ticker) return false;
  const normalized = ticker.trim().toUpperCase();
  return normalized.endsWith('34') || normalized.endsWith('35') || INTERNATIONAL_ETF_TICKERS.includes(normalized);
}
export function isFIITicker(ticker: string | undefined | null): boolean {
  if (!ticker) return false;
  return /^[A-Z]{4}11$/.test(ticker.trim().toUpperCase());
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return parseFloat(String(value));
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/** Fração → percentual pt-BR (0,0836 → "8,4%"), via `@/lib/format`. `N/A` sem valor. */
export function formatPercent(value: unknown): string {
  const numValue = toNumber(value);
  if (numValue === null || numValue === undefined || !Number.isFinite(numValue)) return 'N/A';
  return formatPct(numValue);
}

/**
 * Campos de FinancialData armazenados como decimal (0.12 = 12%).
 * Ao exibir para humanos/IA, sempre multiplicar por 100 e usar formatPercent.
 * NÃO inclui razões (P/L, P/VP, Dívida Líq./PL, EV/EBITDA, liquidez).
 */
export const DECIMAL_PERCENT_FIELDS = [
  'roe',
  'roa',
  'roic',
  'margemLiquida',
  'margemEbitda',
  'margemBruta',
  'dy',
  'payout',
  'dividendYield12m',
  'crescimentoLucros',
  'crescimentoReceitas',
  'cagrLucros5a',
  'cagrReceitas5a',
  'passivoAtivos',
  'earningsYield',
  'retornoAnoAtual',
  'variacao52Semanas',
] as const;

export type DecimalPercentField = (typeof DECIMAL_PERCENT_FIELDS)[number];

export function isDecimalPercentField(field: string): boolean {
  return (DECIMAL_PERCENT_FIELDS as readonly string[]).includes(field);
}

/** Converte decimal (0.12) para percentual numérico (12). */
export function toPercentNumber(value: unknown): number | null {
  const numValue = toNumber(value);
  if (numValue === null) return null;
  return numValue * 100;
}

/**
 * Formata valor financeiro para prompts de IA.
 * Percentuais em decimal viram "12.00%"; razões ficam como "1.08".
 */
export function formatMetricForAi(
  value: unknown,
  options: { isPercent?: boolean; digits?: number } = {}
): string {
  const numValue = toNumber(value);
  if (numValue === null) return 'N/A';
  const digits = options.digits ?? 2;
  if (options.isPercent) {
    return `${(numValue * 100).toFixed(digits)}%`;
  }
  return numValue.toFixed(digits);
}

/**
 * Valida e normaliza o CAGR de lucros de 5 anos para evitar distorções
 * CAGR deve ser mais conservador que crescimento anual por ser uma média de longo prazo
 */
export function validateCAGR5Years(cagrLucros5a: number | null): number | null {
  if (cagrLucros5a === null || cagrLucros5a === undefined) {
    return null;
  }

  // Converter para número se necessário
  const cagr = typeof cagrLucros5a === 'number' ? cagrLucros5a : parseFloat(String(cagrLucros5a));
  
  if (isNaN(cagr)) {
    return null;
  }

  // CAGR extremos são ainda mais suspeitos que crescimento anual
  // Pois representam média de 5 anos, não deveria ter valores tão extremos
  if (Math.abs(cagr) > 1.0) { // CAGR > 100% ou < -100% é muito suspeito
    // console.warn(`⚠️ CAGR 5 anos extremo detectado: ${(cagr * 100).toFixed(1)}%. Considerando como não confiável.`);
    return null; // Tratar como dado não disponível
  }

  // Limitar CAGR a faixas ainda mais conservadoras
  // CAGR sustentável raramente excede 50% por 5 anos consecutivos
  if (cagr > 0.5) { // Limitar CAGR máximo a 50%
    return 0.5;
  }
  
  if (cagr < -0.5) { // Limitar declínio máximo a -50%
    return -0.5;
  }

  return cagr;
}

/**
 * Calcula média histórica de um indicador financeiro usando dados disponíveis
 * Tenta usar até 7 anos de dados, mas usa o máximo disponível se for menor
 */
export function calculateHistoricalAverage(
  currentValue: unknown,
  historicalValues?: unknown[]
): number | null {
  const current = toNumber(currentValue);
  
  // Se não há valor atual, retorna null
  if (current === null) return null;
  
  // Se não há dados históricos ou array vazio, retorna valor atual
  if (!historicalValues || historicalValues.length === 0) {
    return current;
  }
  
  // Converter valores históricos para números válidos
  const validHistoricalValues = historicalValues
    .map(val => toNumber(val))
    .filter(val => val !== null && !isNaN(val as number)) as number[];
  
  // Se não há valores históricos válidos, retorna valor atual
  if (validHistoricalValues.length === 0) {
    return current;
  }
  
  // Combinar valor atual com históricos (máximo 7 anos total)
  const allValues = [current, ...validHistoricalValues].slice(0, 7);
  
  // Calcular média
  const sum = allValues.reduce((acc, val) => acc + val, 0);
  return sum / allValues.length;
}

/**
 * Extrai valores históricos de um campo específico dos dados históricos
 */
export function extractHistoricalValues(
  historicalData: any[],
  fieldName: string
): unknown[] {
  if (!historicalData || historicalData.length === 0) return [];
  
  return historicalData
    .sort((a, b) => (b.year || 0) - (a.year || 0)) // Ordenar por ano (mais recente primeiro)
    .slice(0, 7) // Máximo 7 anos
    .map(data => data[fieldName])
    .filter(val => val !== null && val !== undefined);
}

/**
 * Aplica média histórica de 7 anos a um indicador se habilitado
 * Fallback para valor atual se médias não estão disponíveis ou desabilitadas
 */
export function applyHistoricalAverageIfEnabled(
  currentValue: unknown,
  use7YearAverages: boolean = false,
  historicalValues?: unknown[]
): number | null {
  if (!use7YearAverages) {
    return toNumber(currentValue);
  }
  
  return calculateHistoricalAverage(currentValue, historicalValues);
}

/** Alíquota de IR + CSLL usada no NOPAT e no benefício fiscal da dívida (34%). */
export const CORPORATE_TAX_RATE = 0.34;

/** Spread de crédito sobre a Selic (BRL) ou sobre o UST 10y (USD) para estimar o custo da dívida (Kd). */
export const CREDIT_SPREAD = 0.02;

/** Teto do potencial plausível (500%): acima disso o preço justo indica erro de dados (moeda, paridade, unidade). */
export const MAX_PLAUSIBLE_UPSIDE = 5;

/** Desconto vs valor intrínseco (`1 − preço / preço justo`), em fração. `null` sem preço ou preço justo válidos. */
export function discountFraction(price: number | null | undefined, fairValue: number | null | undefined): number | null {
  return discountFromPrices(price, fairValue);
}

/** Potencial (`preço justo / preço − 1`) em pontos percentuais (33,3 = 33,3%), a unidade de `StrategyAnalysis.upside`. */
export function upsidePercent(price: number | null | undefined, fairValue: number | null | undefined): number | null {
  const value = upsideFromPrices(price, fairValue);
  return value === null ? null : value * 100;
}

/** `true` quando o potencial passa de 500%: o preço justo não é confiável e não deve ser exibido. */
export function isImplausibleUpside(price: number | null | undefined, fairValue: number | null | undefined): boolean {
  const value = upsideFromPrices(price, fairValue);
  return value !== null && value > MAX_PLAUSIBLE_UPSIDE;
}

/** Classe setorial da empresa (financeira, utility, commodity cíclica ou outra) pelos helpers determinísticos. */
export function companySectorClass(companyData: Pick<CompanyData, 'sector' | 'industry'>): SectorClass {
  return sectorClass(companyData.sector, companyData.industry);
}

/** Premissas macro do snapshot síncrono (o chamador pode pré-carregar com `warmMacroAssumptions`). */
export function macroAssumptions(): MacroAssumptions {
  return getMacroAssumptionsSync();
}

/** Ke nominal em BRL: NTN-B real + IPCA 12m + β × ERP, nunca abaixo da Selic. */
export function costOfEquityBRL(beta = 1, macro: MacroAssumptions = macroAssumptions()): number {
  return keFromMacro(macro, beta);
}

/** Ke nominal em USD (BDRs com fundamentos em dólar): UST 10y + β × ERP. */
export function costOfEquityUSD(beta = 1, macro: MacroAssumptions = macroAssumptions()): number {
  return macro.ust10y + beta * macro.erp;
}

/** Crescimento do ano `t` (1…years) convergindo linearmente de `initial` para `terminal` (no último ano é `terminal`). */
export function convergingGrowth(initial: number, terminal: number, years: number): number[] {
  return Array.from({ length: years }, (_, i) => initial + ((terminal - initial) * (i + 1)) / years);
}

export interface DcfInput {
  /** Fluxo de caixa do ano-base (ano 0). */
  baseCashflow: number;
  /** Crescimento do ano 1 (ex.: CAGR de 5 anos limitado a 10%). */
  initialGrowth: number;
  /** Crescimento perpétuo após a projeção. */
  terminalGrowth: number;
  /** Taxa de desconto (WACC para FCFF, Ke para FCFE). */
  discountRate: number;
  years: number;
}

export interface DcfResult {
  presentValueCashflows: number;
  presentValueTerminal: number;
  /** Soma dos valores presentes: EV (FCFF) ou valor do acionista (FCFE). */
  total: number;
  /** Participação do valor terminal no total, em fração. */
  terminalValueShare: number;
  growthPath: number[];
}

/**
 * Fluxo de caixa descontado: projeta `years` anos com crescimento convergindo linearmente para o g terminal e soma o
 * valor terminal de Gordon. `null` com fluxo-base ≤ 0, horizonte inválido ou spread taxa − g abaixo de 4 p.p.
 */
export function projectDiscountedCashflows({ baseCashflow, initialGrowth, terminalGrowth, discountRate, years }: DcfInput): DcfResult | null {
  if (!Number.isFinite(baseCashflow) || baseCashflow <= 0 || !Number.isInteger(years) || years <= 0) return null;
  if (!Number.isFinite(discountRate) || !Number.isFinite(terminalGrowth) || !Number.isFinite(initialGrowth)) return null;
  if (discountRate - terminalGrowth < MIN_DISCOUNT_GROWTH_SPREAD - 1e-9) return null;

  const growthPath = convergingGrowth(initialGrowth, terminalGrowth, years);
  let cashflow = baseCashflow;
  let presentValueCashflows = 0;
  growthPath.forEach((growth, i) => {
    cashflow *= 1 + growth;
    presentValueCashflows += cashflow / Math.pow(1 + discountRate, i + 1);
  });
  const terminalValue = (cashflow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  const presentValueTerminal = terminalValue / Math.pow(1 + discountRate, years);
  const total = presentValueCashflows + presentValueTerminal;
  return { presentValueCashflows, presentValueTerminal, total, terminalValueShare: presentValueTerminal / total, growthPath };
}

/** FCFF = EBIT × (1 − 34%) + D&A − Capex − ΔNCG. */
export function fcffFromComponents({
  ebit,
  depreciation,
  capex,
  workingCapitalIncrease,
}: {
  ebit: number;
  depreciation: number;
  capex: number;
  workingCapitalIncrease: number;
}): number {
  return ebit * (1 - CORPORATE_TAX_RATE) + depreciation - capex - workingCapitalIncrease;
}

export interface BdrConversion {
  /** Moeda dos fundamentos (LPA, VPA, fluxos). */
  currency: 'USD' | 'BRL';
  /** Multiplica um valor por ação subjacente para obter o valor por recibo em BRL. */
  perReceiptFactor: number;
}

/**
 * Conversão dos fundamentos de um BDR para BRL por recibo. Usa `financialCurrency`, a cotação (`usdBrl`/`fxRate`) e
 * `bdrRatio` (recibos por ação subjacente) quando a fonte de dados os informar. `null` quando não há como converter:
 * os modelos de preço justo não se aplicam ao BDR, porque o preço é em BRL por recibo e os fundamentos vêm em USD por ação.
 */
export function bdrConversion(financials: CompanyFinancialData): BdrConversion | null {
  const currency = typeof financials.financialCurrency === 'string' ? financials.financialCurrency.toUpperCase() : null;
  const ratio = toNumber(financials.bdrRatio);
  if (currency === 'BRL') {
    return ratio && ratio > 0 ? { currency: 'BRL', perReceiptFactor: 1 / ratio } : null;
  }
  const fx = toNumber(financials.usdBrl ?? financials.fxRate);
  if (currency === 'USD' && fx && fx > 0 && ratio && ratio > 0) {
    return { currency: 'USD', perReceiptFactor: fx / ratio };
  }
  return null;
}

/** Motivo exibido quando um modelo de preço justo não se aplica a BDRs sem paridade e câmbio. */
export const BDR_NOT_APPLICABLE_REASON =
  'Modelo não aplicável a BDR: o preço é em reais por recibo e os fundamentos vêm em dólar por ação da empresa no exterior. Sem paridade e câmbio na base de dados, o preço justo não seria comparável.';

/** Início do motivo de não aplicação a BDRs; o complemento diz o que faltou (paridade, câmbio ou dados coerentes). */
export const BDR_NOT_APPLICABLE_PREFIX = 'Modelo não aplicável a BDR:';

/**
 * Paridade (recibos na B3 por ação no exterior) dos BDRs mais negociados com demonstrativos em dólar.
 * Fonte: Yahoo Finance em 09/10/2026. A razão entre `sharesOutstanding` do BDR (`XXXX34.SA`, contado em recibos) e o da
 * ação no exterior deu um número inteiro, e o preço da ação × câmbio ÷ paridade bateu com o preço do recibo (±2%).
 * Desdobramentos e grupamentos mudam a paridade: revise a lista quando a B3 anunciar um evento desses para o BDR.
 */
export const BDR_PARITY: Readonly<Record<string, { underlying: string; parity: number }>> = {
  AAPL34: { underlying: 'AAPL', parity: 20 },
  ABBV34: { underlying: 'ABBV', parity: 16 },
  ADBE34: { underlying: 'ADBE', parity: 50 },
  AMZO34: { underlying: 'AMZN', parity: 20 },
  AVGO34: { underlying: 'AVGO', parity: 70 },
  BERK34: { underlying: 'BRK-B', parity: 20 },
  BOAC34: { underlying: 'BAC', parity: 4 },
  CHVX34: { underlying: 'CVX', parity: 10 },
  COCA34: { underlying: 'KO', parity: 6 },
  COWC34: { underlying: 'COST', parity: 40 },
  CSCO34: { underlying: 'CSCO', parity: 5 },
  DISB34: { underlying: 'DIS', parity: 15 },
  EXXO34: { underlying: 'XOM', parity: 8 },
  GOGL34: { underlying: 'GOOGL', parity: 12 },
  GSGI34: { underlying: 'GS', parity: 30 },
  HOME34: { underlying: 'HD', parity: 28 },
  JNJB34: { underlying: 'JNJ', parity: 15 },
  JPMC34: { underlying: 'JPM', parity: 10 },
  LILY34: { underlying: 'LLY', parity: 30 },
  M1TA34: { underlying: 'META', parity: 28 },
  MCDC34: { underlying: 'MCD', parity: 20 },
  MELI34: { underlying: 'MELI', parity: 120 },
  MSCD34: { underlying: 'MA', parity: 31 },
  MSFT34: { underlying: 'MSFT', parity: 24 },
  NFLX34: { underlying: 'NFLX', parity: 50 },
  NIKE34: { underlying: 'NKE', parity: 10 },
  NVDC34: { underlying: 'NVDA', parity: 48 },
  ORCL34: { underlying: 'ORCL', parity: 6 },
  PEPB34: { underlying: 'PEP', parity: 15 },
  PFIZ34: { underlying: 'PFE', parity: 4 },
  PGCO34: { underlying: 'PG', parity: 14 },
  PYPL34: { underlying: 'PYPL', parity: 20 },
  ROXO34: { underlying: 'NU', parity: 6 },
  SSFO34: { underlying: 'CRM', parity: 22 },
  TSLA34: { underlying: 'TSLA', parity: 32 },
  UNHH34: { underlying: 'UNH', parity: 70 },
  VISA34: { underlying: 'V', parity: 20 },
  WALM34: { underlying: 'WMT', parity: 16 },
};

/** Paridade conhecida do BDR (`BDR_PARITY`), ou `null`. */
export function bdrParity(ticker: string | null | undefined): number | null {
  if (!ticker) return null;
  return BDR_PARITY[ticker.trim().toUpperCase()]?.parity ?? null;
}

/** Câmbio USD/BRL vale por até 4 dias (cobre fim de semana e feriado sem cotação nova). */
const USD_BRL_MAX_AGE_MS = 4 * 86_400_000;
let usdBrlSnapshot: { rate: number; at: number } | null = null;

/**
 * Registra o câmbio USD/BRL do dia (o `BDRDataService.getUsdBrlRate` chama ao buscar `BRL=X`), para os modelos, que são
 * síncronos, converterem BDRs sem consultar a rede.
 */
export function setUsdBrlSnapshot(rate: number | null, asOf: Date = new Date()): void {
  usdBrlSnapshot = rate !== null && Number.isFinite(rate) && rate > 0 ? { rate, at: asOf.getTime() } : null;
}

/** Câmbio USD/BRL registrado por `setUsdBrlSnapshot`, ou `null` se ausente ou com mais de 4 dias. */
export function getUsdBrlSnapshot(asOf: Date = new Date()): number | null {
  if (!usdBrlSnapshot) return null;
  const age = asOf.getTime() - usdBrlSnapshot.at;
  return age >= 0 && age <= USD_BRL_MAX_AGE_MS ? usdBrlSnapshot.rate : null;
}

/**
 * Que entrada cada modelo usa num BDR:
 * - `perShare`: LPA e VPA (Graham);
 * - `totals`: fluxos e dívida totais da empresa no exterior ÷ ações (FCD);
 * - `dividends`: proventos do histórico da B3, já em reais por recibo (Gordon, Bazin);
 * - `unsupported`: modelos sem conversão para BDR (Lynch, Barsi e os demais), que seguem não aplicáveis.
 */
export type BdrModelBasis = 'perShare' | 'totals' | 'dividends' | 'unsupported';

const BDR_MODEL_BASIS: Readonly<Record<string, BdrModelBasis>> = {
  graham: 'perShare',
  fcd: 'totals',
  gordon: 'dividends',
  bazin: 'dividends',
};

/** Base de entrada do modelo `strategyName` num BDR (padrão `unsupported`). */
export function bdrModelBasis(strategyName: string): BdrModelBasis {
  return BDR_MODEL_BASIS[strategyName] ?? 'unsupported';
}

export type BdrResolution =
  | {
      ok: true;
      parity: number;
      usdBrl: number;
      /** Multiplica o valor calculado pelo modelo para chegar a reais por recibo. */
      factor: number;
      /** "Convertido por paridade 20 e câmbio 5,02." */
      note: string;
    }
  | { ok: false; reason: string };

/** Dois valores a até `tolerance` (fração) um do outro. */
function near(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(Math.abs(a), Math.abs(b));
}

const UNIT_TOLERANCE = 0.15;
/** Lucro do ano (demonstrativo) e LPA dos últimos 12 meses (cotação) diferem com o tempo: tolerância maior. */
const TOTALS_TOLERANCE = 0.3;

/**
 * Fator que leva o LPA/VPA guardado a reais por recibo. A cotação do BDR no Yahoo já traz LPA e VPA em reais por
 * recibo; o demonstrativo da empresa no exterior traz em dólar por ação. Decide pela coerência com o preço do recibo:
 * preço ÷ (LPA × fator) precisa bater com o P/L (ou preço ÷ (VPA × fator) com o P/VP). Sem P/L e P/VP, assume dólar por
 * ação. `null` quando nenhuma das duas leituras é coerente.
 */
function perShareFactor(price: number, financials: CompanyFinancialData, underlyingFactor: number): number | null {
  const candidates = [1, underlyingFactor];
  const checks: [number | null, number | null][] = [
    [toNumber(financials.lpa), toNumber(financials.pl)],
    [toNumber(financials.vpa), toNumber(financials.pvp)],
  ];
  for (const [perShare, multiple] of checks) {
    if (!perShare || perShare <= 0 || !multiple || multiple <= 0) continue;
    const matches = candidates.filter((factor) => near(price / (perShare * factor), multiple, UNIT_TOLERANCE));
    return matches.length > 0 ? matches[0] : null;
  }
  return underlyingFactor;
}

/** LPA do histórico na mesma base do atual: quando a outra leitura explica melhor a diferença, a média misturaria moedas. */
function historyMatchesBasis(companyData: CompanyData, factor: number, underlyingFactor: number): boolean {
  const current = toNumber(companyData.financials.lpa);
  const history = (companyData.historicalFinancials ?? [])
    .map((row) => toNumber(row.lpa))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  if (!current || current <= 0 || history.length === 0) return true;
  // Paridade e câmbio próximos (fator perto de 1) não deixam distinguir as bases: aceita o histórico.
  if (underlyingFactor > 0.6 && underlyingFactor < 1.7) return true;
  const sorted = [...history].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const sameBasisGap = Math.abs(Math.log(median / current));
  const otherFactor = factor === 1 ? underlyingFactor : 1 / underlyingFactor;
  const otherBasisGap = Math.abs(Math.log((median * otherFactor) / current));
  return sameBasisGap <= otherBasisGap;
}

/**
 * Fator que leva valor total ÷ `sharesOutstanding` a reais por recibo. Os totais vêm em dólar; as ações podem estar
 * contadas em recibos (cotação do BDR: ações × preço do recibo ≈ valor de mercado em reais) ou em ações da empresa no
 * exterior. Confere com o LPA em reais por recibo: lucro ÷ ações × fator precisa bater com ele. `null` se incoerente.
 */
function totalsFactor(price: number, financials: CompanyFinancialData, parity: number, usdBrl: number, receiptEps: number | null): number | null {
  const shares = toNumber(financials.sharesOutstanding);
  if (!shares || shares <= 0) return null;
  const marketCap = toNumber(financials.marketCap);
  let factor = usdBrl / parity;
  if (marketCap && marketCap > 0) {
    if (near(shares * price, marketCap, UNIT_TOLERANCE)) factor = usdBrl;
    else if (!near(shares * parity * price, marketCap, UNIT_TOLERANCE)) return null;
  }
  const netIncome = toNumber(financials.lucroLiquido);
  if (receiptEps && receiptEps > 0 && netIncome && netIncome > 0 && !near((netIncome / shares) * factor, receiptEps, TOTALS_TOLERANCE)) {
    return null;
  }
  return factor;
}

/**
 * Decide se um modelo de preço justo pode rodar num BDR e com que fator converter o resultado para reais por recibo.
 * Exige as três peças: paridade (`bdrRatio` informado ou `BDR_PARITY`), câmbio USD/BRL (`usdBrl`/`fxRate` informado ou
 * `setUsdBrlSnapshot`) e fundamentos coerentes com o preço do recibo. O FCD exige moeda, paridade e câmbio nos próprios
 * dados (`bdrConversion`), porque a moeda define a taxa de desconto. Sem alguma delas, devolve o motivo da não aplicação.
 */
export function resolveBdrConversion(
  companyData: CompanyData,
  basis: BdrModelBasis,
  { asOf = new Date() }: { asOf?: Date } = {}
): BdrResolution {
  const { financials, currentPrice, ticker } = companyData;
  const fail = (detail: string): BdrResolution => ({ ok: false, reason: `${BDR_NOT_APPLICABLE_PREFIX} ${detail}` });
  if (basis === 'unsupported') {
    return fail('o modelo não tem conversão por paridade e câmbio, e o preço do recibo em reais não é comparável aos fundamentos em dólar da empresa no exterior.');
  }
  const explicitCurrency = typeof financials.financialCurrency === 'string' ? financials.financialCurrency.toUpperCase() : null;
  if (explicitCurrency && explicitCurrency !== 'USD') {
    return fail(`a conversão de demonstrativos em ${explicitCurrency} para reais por recibo não está disponível.`);
  }
  // O FCD escolhe a taxa de desconto (em dólar ou em reais) por `bdrConversion(financials)`: moeda, paridade e câmbio
  // precisam vir nos dados do BDR, não só da tabela de paridades e do câmbio registrado.
  if (basis === 'totals' && bdrConversion(financials)?.currency !== 'USD') {
    return fail('a moeda dos demonstrativos, a paridade e o câmbio não vieram com os dados do BDR, e eles definem a taxa de desconto do fluxo de caixa.');
  }
  const explicitRatio = toNumber(financials.bdrRatio);
  const parity = explicitRatio && explicitRatio > 0 ? explicitRatio : bdrParity(ticker);
  if (!parity) return fail('a paridade do BDR (recibos por ação no exterior) não está disponível, então o preço justo não seria comparável ao preço do recibo.');
  const explicitFx = toNumber(financials.usdBrl ?? financials.fxRate);
  const usdBrl = explicitFx && explicitFx > 0 ? explicitFx : getUsdBrlSnapshot(asOf);
  if (!usdBrl) return fail('o câmbio USD/BRL do dia não está disponível, então o preço justo não seria comparável ao preço do recibo.');
  if (!currentPrice || currentPrice <= 0) return fail('sem preço do recibo para conferir a conversão.');

  const underlyingFactor = usdBrl / parity;
  const inconsistent = fail('os fundamentos não batem com o preço do recibo depois da conversão por paridade e câmbio (provável mistura de moedas na base).');
  let factor = 1;
  if (basis !== 'dividends') {
    const shareFactor = perShareFactor(currentPrice, financials, underlyingFactor);
    if (shareFactor === null) return inconsistent;
    if (basis === 'perShare') {
      if (!historyMatchesBasis(companyData, shareFactor, underlyingFactor)) return inconsistent;
      factor = shareFactor;
    } else {
      const lpa = toNumber(financials.lpa);
      const receiptEps = lpa !== null && lpa > 0 ? lpa * shareFactor : null;
      const fromTotals = totalsFactor(currentPrice, financials, parity, usdBrl, receiptEps);
      if (fromTotals === null) return inconsistent;
      factor = fromTotals;
    }
  }
  return {
    ok: true,
    parity,
    usdBrl,
    factor,
    note: `Convertido por paridade ${formatNumber(parity, { digits: 0 })} e câmbio ${formatNumber(usdBrl, { digits: 2 })}.`,
  };
}

/** Resultado padrão de um modelo que não se aplica à empresa (sem preço justo e sem critérios). */
export function notApplicableAnalysis(reasoning: string): StrategyAnalysis {
  return {
    isEligible: false,
    score: 0,
    fairValue: null,
    upside: null,
    discount: null,
    reasoning,
    criteria: [],
    key_metrics: { notApplicable: 1 },
  };
}

/** Média dos valores finitos (do mais recente ao mais antigo) limitada a `years` itens. `null` sem valores. */
export function averageOfLatest(values: readonly (number | null | undefined)[], years: number): { average: number; count: number } | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).slice(0, years);
  if (valid.length === 0) return null;
  return { average: valid.reduce((acc, v) => acc + v, 0) / valid.length, count: valid.length };
}

// Classe base abstrata para todas as estratégias
export abstract class AbstractStrategy<T extends StrategyParams> implements BaseStrategy<T> {
  abstract readonly name: string;
  
  abstract runAnalysis(companyData: CompanyData, params: T): StrategyAnalysis | Promise<StrategyAnalysis>;
  abstract runRanking(companies: CompanyData[], params: T): RankBuilderResult[] | Promise<RankBuilderResult[]>;
  abstract generateRational(params: T): string;
  abstract validateCompanyData(companyData: CompanyData, params: T): boolean;
  
  // Métodos utilitários comuns
  protected calculateGrahamFairValue(lpa: number | null, vpa: number | null): number | null {
    if (!lpa || !vpa || lpa <= 0 || vpa <= 0) return null;
    return Math.sqrt(22.5 * lpa * vpa);
  }

  /**
   * Obtém valor de indicador aplicando média histórica se habilitado
   * Evita repetição de código para mesmos indicadores entre estratégias
   */
  protected getIndicatorValue(
    financialData: any,
    fieldName: string,
    use7YearAverages: boolean = false,
    historicalFinancials?: any[]
  ): number | null {
    const currentValue = financialData[fieldName];
    
    if (!use7YearAverages) {
      return toNumber(currentValue);
    }
    
    // Extrair valores históricos do campo específico
    const historicalValues = extractHistoricalValues(historicalFinancials || [], fieldName);
    
    return calculateHistoricalAverage(currentValue, historicalValues);
  }

  /**
   * Métodos específicos para indicadores mais comuns
   * Evita repetição e centraliza lógica de médias históricas
   */
  protected getROE(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'roe', use7YearAverages, historicalFinancials);
  }

  protected getROIC(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'roic', use7YearAverages, historicalFinancials);
  }

  protected getDividendYield(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'dy', use7YearAverages, historicalFinancials);
  }

  protected getPL(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'pl', use7YearAverages, historicalFinancials);
  }

  protected getPVP(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'pvp', use7YearAverages, historicalFinancials);
  }

  protected getMargemLiquida(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'margemLiquida', use7YearAverages, historicalFinancials);
  }

  protected getMargemEbitda(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'margemEbitda', use7YearAverages, historicalFinancials);
  }

  protected getLiquidezCorrente(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'liquidezCorrente', use7YearAverages, historicalFinancials);
  }

  protected getDividaLiquidaPl(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'dividaLiquidaPl', use7YearAverages, historicalFinancials);
  }

  protected getDividaLiquidaEbitda(financialData: any, use7YearAverages: boolean = false, historicalFinancials?: any[]): number | null {
    return this.getIndicatorValue(financialData, 'dividaLiquidaEbitda', use7YearAverages, historicalFinancials);
  }
  
  /**
   * Motivo de não aplicação a BDRs (sem paridade, câmbio ou fundamentos coerentes; ver `resolveBdrConversion`), ou
   * `null` quando o modelo pode rodar.
   */
  protected bdrNotApplicableReason(companyData: CompanyData): string | null {
    if (!this.isBDRTicker(companyData.ticker)) return null;
    const resolution = resolveBdrConversion(companyData, bdrModelBasis(this.name));
    return resolution.ok ? null : resolution.reason;
  }

  /**
   * Fator para levar o valor calculado pelo modelo a reais por recibo (1 para ações da B3 e para modelos de proventos,
   * cujo histórico da B3 já está em reais por recibo).
   */
  protected perReceiptFactor(companyData: CompanyData): number {
    if (!this.isBDRTicker(companyData.ticker)) return 1;
    const resolution = resolveBdrConversion(companyData, bdrModelBasis(this.name));
    return resolution.ok ? resolution.factor : 1;
  }

  /** Nota da conversão do BDR ("Convertido por paridade 20 e câmbio 5,02."), ou `null` quando não houve conversão. */
  protected bdrConversionNote(companyData: CompanyData): string | null {
    if (!this.isBDRTicker(companyData.ticker)) return null;
    const resolution = resolveBdrConversion(companyData, bdrModelBasis(this.name));
    return resolution.ok ? resolution.note : null;
  }

  // Filtrar empresas por tamanho (Market Cap)
  protected filterCompaniesBySize(companies: CompanyData[], sizeFilter: string): CompanyData[] {
    if (sizeFilter === 'all') return companies;
    
    return companies.filter(company => {
      const marketCap = toNumber(company.financials.marketCap);
      if (!marketCap) return false;
      
      // Valores em bilhões de reais
      const marketCapBillions = marketCap / 1_000_000_000;
      
      switch (sizeFilter) {
        case 'small_caps':
          return marketCapBillions < 2; // Menos de R$ 2 bilhões
        case 'mid_caps':
          return marketCapBillions >= 2 && marketCapBillions < 10; // R$ 2-10 bilhões
        case 'blue_chips':
          return marketCapBillions >= 10; // Mais de R$ 10 bilhões
        default:
          return true;
      }
    });
  }

  // Verificar se um ticker é BDR
  protected isBDRTicker(ticker?: string | null): boolean {
    return isBDRTickerSymbol(ticker);
  }

  // Filtrar empresas por inclusão/exclusão de BDRs
  protected filterBDRs(companies: CompanyData[], includeBDRs: boolean = true): CompanyData[] {
    if (includeBDRs) return companies;
    
    return companies.filter(company => !this.isBDRTicker(company.ticker));
  }

  // Filtrar empresas por tipo de ativo (b3, bdr, both, fii)
  protected filterByAssetType(
    companies: CompanyData[],
    assetTypeFilter?: 'b3' | 'bdr' | 'both' | 'fii'
  ): CompanyData[] {
    if (assetTypeFilter === 'fii') {
      return companies.filter((company) => company.assetType === 'FII');
    }

    if (!assetTypeFilter || assetTypeFilter === 'both') {
      return companies; // Incluir todos
    }

    if (assetTypeFilter === 'b3') {
      // Apenas ações B3 (excluir BDRs)
      return companies.filter((company) => !this.isBDRTicker(company.ticker));
    }

    if (assetTypeFilter === 'bdr') {
      // Apenas BDRs
      return companies.filter((company) => this.isBDRTicker(company.ticker));
    }

    return companies;
  }

  /**
   * Mantido por compatibilidade: devolve a lista sem alteração. Antes excluía tickers terminados em 5–9, o que removia
   * classes PNA/PNB líquidas (USIM5, BRKM5, ELET6...). A escolha da classe mais líquida de cada empresa acontece antes,
   * na montagem dos dados do ranking.
   */
  protected filterTickerEndingDigits(companies: CompanyData[]): CompanyData[] {
    return companies;
  }

  /**
   * Converte StrategyAnalysis em RankBuilderResult. `upside` é o potencial (preço justo ÷ preço − 1) e `marginOfSafety`
   * é o desconto vs valor intrínseco (1 − preço ÷ preço justo), ambos em pontos percentuais.
   */
  protected convertToRankingResult(
    companyData: CompanyData, 
    analysis: StrategyAnalysis
  ): RankBuilderResult {
    const discount = analysis.discount ?? discountFraction(companyData.currentPrice, analysis.fairValue);
    return {
      ticker: companyData.ticker,
      name: companyData.name,
      sector: companyData.sector,
      currentPrice: companyData.currentPrice,
      logoUrl: companyData.logoUrl,
      fairValue: analysis.fairValue,
      upside: analysis.upside ?? upsidePercent(companyData.currentPrice, analysis.fairValue),
      marginOfSafety: discount === null ? null : Number((discount * 100).toFixed(2)),
      rational: analysis.reasoning,
      key_metrics: analysis.key_metrics
    };
  }

  // Calcular score de análise técnica para priorização (sobrevenda = oportunidade)
  protected calculateTechnicalScore(technicalData?: TechnicalAnalysisData): number {
    if (!technicalData) return 0;

    let score = 0;

    // RSI: Priorizar sobrevenda como oportunidade de entrada
    if (technicalData.rsi !== undefined) {
      if (technicalData.rsi <= 25) {
        score += 5; // Sobrevenda extrema - excelente oportunidade
      } else if (technicalData.rsi <= 30) {
        score += 4; // Forte sobrevenda - boa oportunidade
      } else if (technicalData.rsi <= 40) {
        score += 2; // Sobrevenda moderada - oportunidade razoável
      } else if (technicalData.rsi <= 50) {
        score += 1; // Neutro baixo - leve oportunidade
      } else if (technicalData.rsi >= 75) {
        score -= 3; // Sobrecompra forte - evitar
      } else if (technicalData.rsi >= 70) {
        score -= 1; // Sobrecompra moderada - cautela
      }
    }

    // Oscilador Estocástico: Confirmar sinais de sobrevenda
    if (technicalData.stochasticK !== undefined && technicalData.stochasticD !== undefined) {
      const avgStochastic = (technicalData.stochasticK + technicalData.stochasticD) / 2;
      if (avgStochastic <= 15) {
        score += 4; // Sobrevenda extrema
      } else if (avgStochastic <= 20) {
        score += 3; // Forte sobrevenda
      } else if (avgStochastic <= 30) {
        score += 2; // Sobrevenda moderada
      } else if (avgStochastic >= 85) {
        score -= 3; // Sobrecompra forte
      } else if (avgStochastic >= 80) {
        score -= 1; // Sobrecompra moderada
      }
    }

    // Sinal geral: Peso maior para confirmação
    if (technicalData.overallSignal === 'SOBREVENDA') {
      score += 3; // Confirmação de oportunidade
    } else if (technicalData.overallSignal === 'SOBRECOMPRA') {
      score -= 2; // Confirmação de cautela
    }

    return score;
  }

  /**
   * Verifica se a empresa teve lucros consistentes nos últimos 8 anos disponíveis
   * Exclui empresas que tiveram mais de 2 anos de prejuízo nos últimos 8 anos
   * (historicalFinancials contém atual + 7 anos históricos = 8 anos total)
   */
  protected hasConsistentProfits(companyData: CompanyData): boolean {
    const { financials, historicalFinancials } = companyData;
    
    // Verificar lucro atual
    const currentProfit = toNumber(financials.lucroLiquido);
    
    // Se não tem dados históricos, usar apenas o lucro atual
    if (!historicalFinancials || historicalFinancials.length === 0) {
      // Se não tem lucro atual ou é negativo, excluir
      return currentProfit !== null && currentProfit > 0;
    }
    
    // Coletar dados de lucro dos últimos anos (incluindo atual)
    const profitData: { year: number; profit: number | null }[] = [];
    
    // Adicionar lucro atual (ano mais recente)
    const currentYear = new Date().getFullYear();
    if (currentProfit !== null) {
      profitData.push({ year: currentYear, profit: currentProfit });
    }
    
    // Adicionar dados históricos (máximo 7 anos históricos)
    historicalFinancials.forEach(data => {
      const profit = toNumber(data.lucroLiquido);
      if (profit !== null && data.year) {
        profitData.push({ year: data.year, profit });
      }
    });
    
    // Se não tem dados suficientes (menos de 3 anos), ser mais rigoroso
    if (profitData.length < 3) {
      // Todos os anos disponíveis devem ter lucro
      return profitData.every(data => data.profit !== null && data.profit > 0);
    }
    
    // Contar anos com prejuízo
    const lossYears = profitData.filter(data => data.profit !== null && data.profit <= 0).length;
    const totalYears = profitData.length;
    
    // Para 8 anos de dados: máximo 2 anos de prejuízo (25%)
    // Para menos anos: proporcionalmente mais rigoroso
    let maxLossYears: number;
    if (totalYears >= 8) {
      maxLossYears = 2; // Máximo 2 anos de prejuízo em 8 anos
    } else if (totalYears >= 5) {
      maxLossYears = 1; // Máximo 1 ano de prejuízo em 5-7 anos
    } else {
      maxLossYears = 0; // Nenhum prejuízo permitido para menos de 5 anos
    }
    
    return lossYears <= maxLossYears;
  }

  /**
   * Calcula o Overall Score executando todas as estratégias
   * INCLUINDO análise das demonstrações financeiras (igual à tela da empresa)
   */
  protected calculateOverallScore(companyData: CompanyData): number {
    const { financials, currentPrice, incomeStatements, balanceSheets, cashflowStatements } = companyData;
    
    // Preparar dados financeiros no formato esperado
    const financialData = {
      roe: toNumber(financials.roe),
      liquidezCorrente: toNumber(financials.liquidezCorrente),
      dividaLiquidaPl: toNumber(financials.dividaLiquidaPl),
      margemLiquida: toNumber(financials.margemLiquida)
    };
    
    // Preparar dados das demonstrações financeiras se disponíveis
    const statementsData = (incomeStatements && balanceSheets && cashflowStatements) ? {
      incomeStatements,
      balanceSheets,
      cashflowStatements,
      company: {
        ticker: companyData.ticker,
        name: companyData.name,
        sector: companyData.sector,
        marketCap: toNumber(financials.marketCap)
      }
    } : undefined;
    
    try {
      // Importar estratégias e factory
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { StrategyFactory } = require('./strategy-factory');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { STRATEGY_CONFIG } = require('./strategy-config');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { calculateOverallScore } = require('./overall-score');
      
      // Executar todas as estratégias
      const strategies = {
        graham: StrategyFactory.runGrahamAnalysis(companyData, STRATEGY_CONFIG.graham),
        dividendYield: StrategyFactory.runDividendYieldAnalysis(companyData, STRATEGY_CONFIG.dividendYield),
        lowPE: StrategyFactory.runLowPEAnalysis(companyData, STRATEGY_CONFIG.lowPE),
        magicFormula: StrategyFactory.runMagicFormulaAnalysis(companyData, STRATEGY_CONFIG.magicFormula),
        fcd: StrategyFactory.runFCDAnalysis(companyData, STRATEGY_CONFIG.fcd),
        gordon: StrategyFactory.runGordonAnalysis(companyData, STRATEGY_CONFIG.gordon),
        fundamentalist: StrategyFactory.runFundamentalistAnalysis(companyData, STRATEGY_CONFIG.fundamentalist)
      };
      
      // Calcular o score usando a função real COM demonstrações financeiras
      // Não incluir breakdown aqui (só precisamos do score numérico)
      const result = calculateOverallScore(strategies, financialData, currentPrice, statementsData, false);
      return result.score;
      
    } catch (error) {
      // Fallback conservador
      console.warn(`[${companyData.ticker}] Erro ao calcular Overall Score:`, error);
      return 30; // Score baixo para excluir por segurança
    }
  }

  /**
   * Verifica se a empresa deve ser excluída do ranking
   * Critérios de exclusão:
   * 1. Não teve lucros consistentes nos últimos 8 anos disponíveis
   * 2. Overall Score inferior a 50 (incluindo demonstrações financeiras)
   */
  protected shouldExcludeCompany(companyData: CompanyData): boolean {
    // Critério 1: Verificar lucros consistentes
    if (!this.hasConsistentProfits(companyData)) {
      return true;
    }
    
    // Critério 2: Verificar Overall Score (com demonstrações financeiras)
    const overallScore = this.calculateOverallScore(companyData);
    if (overallScore < 50) {
      return true;
    }
    
    return false;
  }

  /**
   * Remove tickers duplicados da mesma empresa, mantendo apenas o primeiro
   * Ex: Se RAPT3 aparece antes de RAPT4, remove RAPT4 do ranking
   */
  protected removeDuplicateCompanies(results: RankBuilderResult[]): RankBuilderResult[] {
    const seenCompanyPrefixes = new Set<string>();
    const filteredResults: RankBuilderResult[] = [];
    
    for (const result of results) {
      // Extrair prefixo da empresa (remove números e letras finais)
      const companyPrefix = this.extractCompanyPrefix(result.ticker);
      
      // Se ainda não vimos essa empresa, adicionar ao resultado
      if (!seenCompanyPrefixes.has(companyPrefix)) {
        seenCompanyPrefixes.add(companyPrefix);
        filteredResults.push(result);
      }
      // Se já vimos, pular (manter apenas o primeiro)
    }
    
    return filteredResults;
  }
  
  /**
   * Extrai o prefixo da empresa do ticker
   * Ex: RAPT3 -> RAPT, VALE3 -> VALE, PETR4 -> PETR
   */
  private extractCompanyPrefix(ticker: string): string {
    // Remove números e letras finais (3, 4, 11, F, etc.)
    return ticker.replace(/[0-9]+[A-Z]*$/, '').toUpperCase();
  }

  /**
   * Aplicar priorização técnica no ranking (complementar à análise fundamentalista)
   * 
   * ESTRATÉGIA:
   * 1. Preserva a ordem fundamentalista como critério principal
   * 2. Agrupa ativos em faixas de qualidade similar (~20% cada)
   * 3. Dentro de cada grupo, prioriza oportunidades técnicas (sobrevenda)
   * 4. Mantém a qualidade fundamentalista como base, usando técnica para timing
   */
  protected applyTechnicalPrioritization(
    results: RankBuilderResult[], 
    companies: CompanyData[], 
    useTechnicalAnalysis: boolean = false
  ): RankBuilderResult[] {
    if (!useTechnicalAnalysis) return results;

    // Criar mapa de dados técnicos por ticker
    const technicalMap = new Map<string, TechnicalAnalysisData>();
    companies.forEach(company => {
      if (company.technicalAnalysis) {
        technicalMap.set(company.ticker, company.technicalAnalysis);
      }
    });

    // Adicionar score técnico aos resultados (preservando ordem fundamentalista)
    const resultsWithTechnicalScore = results.map((result, originalIndex) => {
      const technicalData = technicalMap.get(result.ticker);
      const technicalScore = this.calculateTechnicalScore(technicalData);
      
      return {
        ...result,
        technicalScore,
        originalIndex, // Preservar posição original baseada na análise fundamentalista
        // Adicionar informação técnica ao rational se disponível
        rational: technicalData ? 
          `${result.rational}\n\n**Análise técnica**: ${this.getTechnicalSummary(technicalData)}` : 
          result.rational
      };
    });

    // Agrupar por faixas de qualidade fundamentalista e ordenar tecnicamente dentro de cada grupo
    const groupSize = Math.max(3, Math.floor(results.length / 5)); // Grupos de ~20% ou mínimo 3
    const reorderedResults: typeof resultsWithTechnicalScore = [];

    for (let i = 0; i < resultsWithTechnicalScore.length; i += groupSize) {
      const group = resultsWithTechnicalScore.slice(i, i + groupSize);
      
      // Dentro de cada grupo, priorizar por análise técnica (sobrevenda = melhor oportunidade)
      const sortedGroup = group.sort((a, b) => {
        // Primeiro critério: score técnico (maior = melhor oportunidade de entrada)
        if (b.technicalScore !== a.technicalScore) {
          return b.technicalScore - a.technicalScore;
        }
        // Segundo critério: manter ordem fundamentalista original
        return a.originalIndex - b.originalIndex;
      });
      
      reorderedResults.push(...sortedGroup);
    }

    return reorderedResults.map(({ ...result }) => result);
  }

  // Gerar resumo da análise técnica
  private getTechnicalSummary(technicalData: TechnicalAnalysisData): string {
    const parts: string[] = [];

    if (technicalData.rsi !== undefined) {
      let rsiStatus = '';
      if (technicalData.rsi <= 30) rsiStatus = 'forte sobrevenda';
      else if (technicalData.rsi <= 40) rsiStatus = 'sobrevenda';
      else if (technicalData.rsi >= 70) rsiStatus = 'sobrecompra';
      else rsiStatus = 'neutro';
      
      parts.push(`RSI ${technicalData.rsi.toFixed(1)} (${rsiStatus})`);
    }

    if (technicalData.stochasticK !== undefined && technicalData.stochasticD !== undefined) {
      const avgStochastic = (technicalData.stochasticK + technicalData.stochasticD) / 2;
      let stochStatus = '';
      if (avgStochastic <= 20) stochStatus = 'forte sobrevenda';
      else if (avgStochastic <= 30) stochStatus = 'sobrevenda';
      else if (avgStochastic >= 80) stochStatus = 'sobrecompra';
      else stochStatus = 'neutro';
      
      parts.push(`Estocástico ${avgStochastic.toFixed(1)} (${stochStatus})`);
    }

    if (technicalData.overallSignal) {
      const signalText = technicalData.overallSignal === 'SOBREVENDA' ? 'sobrevenda' :
                        technicalData.overallSignal === 'SOBRECOMPRA' ? 'sobrecompra' : 'neutro';
      parts.push(`Sinal: ${signalText}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Dados técnicos não disponíveis';
  }

  /**
   * Filtra empresas com overall_score > 50 (empresas de qualidade)
   * Remove automaticamente empresas ruins/problemáticas do ranking
   * 
   * @param companies Array de empresas a serem filtradas
   * @param minScore Score mínimo aceitável (padrão: 50)
   * @returns Array filtrado com apenas empresas de qualidade
   */
  protected filterCompaniesByOverallScore(companies: CompanyData[], minScore: number = 50): CompanyData[] {
    const filteredCompanies = companies.filter(company => {
      // Se não tem overall_score, incluir (benefício da dúvida)
      if (company.overallScore === null || company.overallScore === undefined) {
        return true;
      }
      
      // Filtrar apenas empresas com score acima do mínimo
      return company.overallScore > minScore;
    });
    
    const removedCount = companies.length - filteredCompanies.length;
    if (removedCount > 0) {
      console.log(`🎯 Filtro de Qualidade: ${removedCount} empresas removidas por overall_score ≤ ${minScore}`);
    }
    
    return filteredCompanies;
  }
}
