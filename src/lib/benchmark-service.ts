/**
 * Benchmarks e matemática de rentabilidade.
 *
 * Benchmarks: CDI (BCB SGS 12, % ao dia), IPCA (BCB SGS 433, % ao mês), IPCA + 6% a.a. e Ibovespa (Yahoo `^BVSP`,
 * fechamento diário em pontos). As únicas fontes externas são o BCB SGS e o Yahoo Finance.
 *
 * Rentabilidade: TWR por cota, TIR (XIRR), volatilidade e Sharpe com o CDI do mesmo período.
 *
 * Convenções:
 * - datas como texto `YYYY-MM-DD` (UTC);
 * - retornos e taxas como fração (0,12 = 12%); o CDI e o IPCA brutos ficam em % como o BCB publica;
 * - o módulo não importa nada de servidor no topo (Yahoo e BCB entram por import dinâmico), porque também é usado
 *   por componentes de cliente e por testes.
 */

export interface BenchmarkDataPoint {
  date: string;
  value: number;
}

export interface BenchmarkData {
  /** CDI diário em % (0,0551 = 0,0551% no dia). */
  cdi: BenchmarkDataPoint[];
  /** Ibovespa: fechamento diário em pontos. */
  ibov: BenchmarkDataPoint[];
  /** IPCA mensal em %, datado no dia 1 do mês de referência. Vazio se não foi pedido. */
  ipca: BenchmarkDataPoint[];
}

export interface FetchBenchmarkOptions {
  /** Também busca o IPCA (padrão: não). */
  ipca?: boolean;
}

const DAY_MS = 86_400_000;

/** Data → `YYYY-MM-DD` em UTC. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** O BCB SGS recusa (HTTP 406) consultas de séries diárias com janela maior que 10 anos. */
const SGS_MAX_WINDOW_YEARS = 5;
/** Séries do BCB e do Yahoo ficam em memória por algumas horas: evita repetir as mesmas consultas a cada mutação. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const seriesCache = new Map<string, { expires: number; promise: Promise<BenchmarkDataPoint[]> }>();

/** Memoriza a busca por chave; falhas não ficam em cache. */
function cached(key: string, load: () => Promise<BenchmarkDataPoint[]>): Promise<BenchmarkDataPoint[]> {
  const now = Date.now();
  const hit = seriesCache.get(key);
  if (hit && hit.expires > now) return hit.promise.then((points) => points.slice());
  if (seriesCache.size > 200) {
    for (const [k, v] of seriesCache) if (v.expires <= now) seriesCache.delete(k);
  }
  const promise = load();
  seriesCache.set(key, { expires: now + CACHE_TTL_MS, promise });
  promise.catch(() => {
    if (seriesCache.get(key)?.promise === promise) seriesCache.delete(key);
  });
  return promise.then((points) => points.slice());
}

/**
 * Blocos fixos de `blockYears` anos civis (2000–2004, 2005–2009, …) que cobrem `[start, end]` (`YYYY-MM-DD`). Blocos
 * fixos ficam em cache aqui e no próprio BCB (a primeira consulta de uma janela nova leva ~20 s), e respeitam o limite
 * de 10 anos por consulta de série diária. O último bloco termina em `end`. Exportada para teste.
 */
export function sgsWindows(start: string, end: string, blockYears = SGS_MAX_WINDOW_YEARS): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  const firstYear = Number(start.slice(0, 4));
  const lastYear = Number(end.slice(0, 4));
  for (let year = firstYear - (((firstYear % blockYears) + blockYears) % blockYears); year <= lastYear; year += blockYears) {
    const blockStart = `${year}-01-01`;
    const blockEnd = `${year + blockYears - 1}-12-31`;
    windows.push({ start: blockStart, end: blockEnd < end ? blockEnd : end });
  }
  return windows;
}

function sgsDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function fetchSgsWindow(code: number, start: string, end: string): Promise<BenchmarkDataPoint[]> {
  const { parseSgsDate } = await import('./finance/macro');
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${sgsDate(start)}&dataFinal=${sgsDate(end)}`;
  let lastError: unknown = null;
  // Até 3 tentativas com espera crescente: o SGS devolve 502/503 de forma intermitente
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      if (response.status === 404) return []; // janela sem dados
      if (!response.ok) throw new Error(`BCB SGS ${code}: HTTP ${response.status}`);
      const body: unknown = await response.json();
      if (!Array.isArray(body)) throw new Error(`BCB SGS ${code}: resposta inesperada`);
      const points: BenchmarkDataPoint[] = [];
      for (const item of body) {
        if (typeof item !== 'object' || item === null) continue;
        const { data, valor } = item as { data?: unknown; valor?: unknown };
        const date = typeof data === 'string' ? parseSgsDate(data) : null;
        const value = typeof valor === 'string' || typeof valor === 'number' ? Number(valor) : Number.NaN;
        if (date && Number.isFinite(value)) points.push({ date: toIsoDate(date), value });
      }
      return points;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /HTTP 4\d\d/.test(error.message)) break; // erro do pedido: não adianta repetir
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`BCB SGS ${code}: falha na consulta`);
}

/** Série do BCB SGS entre as datas (inclusive), consultada em blocos fixos de 5 anos (até hoje) e recortada. */
async function fetchSgs(code: number, startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  const today = toIsoDate(new Date());
  const start = toIsoDate(startOfUtcDay(startDate));
  const requestedEnd = toIsoDate(startOfUtcDay(endDate));
  const end = requestedEnd < today ? requestedEnd : today;
  if (start > end) return [];

  // Um bloco por vez: consultas simultâneas aumentam os 502 do SGS
  const byDate = new Map<string, number>();
  for (const window of sgsWindows(start, today)) {
    if (window.start > end) break;
    const points = await cached(`sgs:${code}:${window.start}:${window.end}`, () => fetchSgsWindow(code, window.start, window.end));
    for (const point of points) if (point.date >= start && point.date <= end) byDate.set(point.date, point.value);
  }
  return Array.from(byDate, ([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

/** CDI diário (BCB SGS 12), em % ao dia. */
export async function fetchCdiDaily(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  const { SGS_CODES } = await import('./finance/macro');
  return fetchSgs(SGS_CODES.cdi, startDate, endDate);
}

/** IPCA mensal (BCB SGS 433), em % ao mês, a partir do mês de `startDate`. */
async function fetchIpcaMonthly(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  const { SGS_CODES } = await import('./finance/macro');
  const monthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  return fetchSgs(SGS_CODES.ipca, monthStart, endDate);
}

/** Ibovespa diário (Yahoo `^BVSP`), fechamento em pontos. */
async function fetchIbovDaily(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  return cached(`ibov:${toIsoDate(startDate)}:${toIsoDate(endDate)}`, () => loadIbovDaily(startDate, endDate));
}

async function loadIbovDaily(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  const { getChart } = await import('./yahooFinance2-service');
  const period1 = startOfUtcDay(startDate);
  const period2 = new Date(startOfUtcDay(endDate).getTime() + DAY_MS);
  const chart = await getChart('^BVSP', { period1, period2, interval: '1d', return: 'array' });
  const quotes: Array<{ date?: Date | string; close?: number | null }> = Array.isArray(chart) ? chart : chart?.quotes ?? [];

  const byDate = new Map<string, number>();
  for (const quote of quotes) {
    if (!quote?.date || typeof quote.close !== 'number' || !(quote.close > 0)) continue;
    byDate.set(toIsoDate(new Date(quote.date)), quote.close);
  }
  return Array.from(byDate, ([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

async function settle(label: string, task: Promise<BenchmarkDataPoint[]>): Promise<BenchmarkDataPoint[]> {
  try {
    return await task;
  } catch (error) {
    console.error(`Erro ao buscar ${label}:`, error);
    return [];
  }
}

/** Busca os benchmarks do período. Uma fonte que falha volta vazia, sem derrubar as outras. */
export async function fetchBenchmarkData(
  startDate: Date,
  endDate: Date,
  options: FetchBenchmarkOptions = {}
): Promise<BenchmarkData> {
  const [cdi, ibov, ipca] = await Promise.all([
    settle('CDI', fetchCdiDaily(startDate, endDate)),
    settle('Ibovespa', fetchIbovDaily(startDate, endDate)),
    options.ipca ? settle('IPCA', fetchIpcaMonthly(startDate, endDate)) : Promise.resolve([]),
  ]);
  return { cdi, ibov, ipca };
}

// ===== Índices acumulados =====

/** Nível acumulado de um benchmark numa data (base arbitrária); `null` quando não há dados. */
export type BenchmarkLevel = (date: string) => number | null;

/** Quantidade de itens de `sorted` menores que `date` (ou menores ou iguais, com `inclusive`). */
function countBefore(sorted: readonly string[], date: string, inclusive = false): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < date || (inclusive && sorted[mid] === date)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sortedByDate(points: readonly BenchmarkDataPoint[]): BenchmarkDataPoint[] {
  return points.filter((p) => Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
}

function prefixProducts(factors: readonly number[]): number[] {
  const prefix = [1];
  for (const factor of factors) prefix.push(prefix[prefix.length - 1] * factor);
  return prefix;
}

/**
 * CDI acumulado com capitalização diária. A taxa publicada para o dia `d` rende de `d` ao dia útil seguinte,
 * então o nível na data `x` multiplica as taxas de todos os dias anteriores a `x`.
 */
export function cdiLevel(daily: readonly BenchmarkDataPoint[]): BenchmarkLevel {
  const points = sortedByDate(daily);
  if (points.length === 0) return () => null;
  const dates = points.map((p) => p.date);
  const prefix = prefixProducts(points.map((p) => 1 + p.value / 100));
  return (date) => prefix[countBefore(dates, date)];
}

function nextMonthStart(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(Date.UTC(year, month, 1)));
}

/**
 * IPCA acumulado em degraus mensais: o mês de referência entra quando termina (dia 1 do mês seguinte).
 * `realSpreadAnnual` compõe um juro real ao mês (0,06 → IPCA + 6% a.a.).
 */
export function ipcaLevel(monthly: readonly BenchmarkDataPoint[], realSpreadAnnual = 0): BenchmarkLevel {
  const points = sortedByDate(monthly);
  if (points.length === 0) return () => null;
  const spread = (1 + realSpreadAnnual) ** (1 / 12);
  const ends = points.map((p) => nextMonthStart(p.date));
  const prefix = prefixProducts(points.map((p) => (1 + p.value / 100) * spread));
  return (date) => prefix[countBefore(ends, date, true)];
}

/** Índice de preço (Ibovespa): último fechamento até a data; antes do primeiro, o primeiro disponível. */
export function priceLevel(prices: readonly BenchmarkDataPoint[]): BenchmarkLevel {
  const points = sortedByDate(prices).filter((p) => p.value > 0);
  if (points.length === 0) return () => null;
  const dates = points.map((p) => p.date);
  return (date) => points[Math.max(0, countBefore(dates, date, true) - 1)].value;
}

/** Retorno do benchmark entre duas datas (fração); `null` sem dados. */
export function returnBetween(level: BenchmarkLevel, from: string, to: string): number | null {
  const start = level(from);
  const end = level(to);
  if (start === null || end === null || !(start > 0)) return null;
  return end / start - 1;
}

/** Retornos do benchmark entre datas consecutivas (`dates.length − 1` períodos). */
export function periodReturnsBetween(level: BenchmarkLevel, dates: readonly string[]): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 1; i < dates.length; i++) out.push(returnBetween(level, dates[i - 1], dates[i]));
  return out;
}

export interface CashFlow {
  date: string;
  /** Valor aplicado (positivo) ou resgatado (negativo). */
  amount: number;
}

/**
 * Simula o benchmark recebendo os mesmos fluxos da carteira: cada aporte passa a render o benchmark a partir da
 * própria data. Devolve o saldo em cada data de avaliação (datas em ordem cronológica).
 */
export function simulateWithFlows(level: BenchmarkLevel, flows: readonly CashFlow[], valuationDates: readonly string[]): number[] {
  const pending = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const growth = (from: string, to: string) => 1 + (returnBetween(level, from, to) ?? 0);

  let value = 0;
  let lastDate: string | null = null;
  let next = 0;
  return valuationDates.map((date) => {
    while (next < pending.length && pending[next].date <= date) {
      const flow = pending[next++];
      if (lastDate !== null) value *= growth(lastDate, flow.date);
      value += flow.amount;
      lastDate = flow.date;
    }
    if (lastDate !== null) {
      value *= growth(lastDate, date);
      lastDate = date;
    }
    return value;
  });
}

export interface FlowPeriod {
  /** Data do aporte (início do período). */
  start: string;
  /** Data da avaliação (fim do período). Pode coincidir com o início do período seguinte. */
  end: string;
  amount: number;
}

/**
 * Como `simulateWithFlows`, mas com um período por aporte: o saldo de cada período é medido no fim dele, antes do
 * aporte do período seguinte, mesmo quando as duas datas coincidem.
 */
export function simulatePeriods(level: BenchmarkLevel, periods: readonly FlowPeriod[]): number[] {
  const growth = (from: string, to: string) => (to > from ? 1 + (returnBetween(level, from, to) ?? 0) : 1);
  let value = 0;
  let lastDate: string | null = null;
  return periods.map(({ start, end, amount }) => {
    if (lastDate !== null) value *= growth(lastDate, start);
    value += amount;
    value *= growth(start, end);
    lastDate = end > start ? end : start;
    return value;
  });
}

// ===== Rentabilidade =====

export interface ValuationPoint {
  date: string;
  /** Patrimônio na data, já com o fluxo da data. */
  value: number;
  /** Fluxo externo líquido na data: aportes positivos, resgates negativos. Proventos não são fluxo externo. */
  flow: number;
}

export interface TwrResult {
  /** Retorno acumulado por cota no período (fração). */
  cumulative: number;
  /** Valor da cota em cada ponto (começa em 1). */
  quotas: Array<{ date: string; quota: number }>;
  /** Retorno da cota entre pontos consecutivos. */
  periodReturns: Array<{ date: string; return: number }>;
}

/**
 * Rentabilidade por cota (TWR). A cota começa em 1; cada fluxo compra ou resgata cotas pelo valor da cota na data,
 * calculado com o patrimônio antes do fluxo. Assim aportes e resgates não distorcem o retorno.
 */
export function computeTwr(points: readonly ValuationPoint[]): TwrResult {
  const quotas: TwrResult['quotas'] = [];
  const periodReturns: TwrResult['periodReturns'] = [];
  let quota = 1;
  let units = 0;

  for (const point of points) {
    if (units > 1e-9) {
      const nextQuota = (point.value - point.flow) / units;
      if (Number.isFinite(nextQuota) && nextQuota > 0) {
        periodReturns.push({ date: point.date, return: nextQuota / quota - 1 });
        quota = nextQuota;
      }
    }
    units = point.value > 0 ? point.value / quota : 0;
    quotas.push({ date: point.date, quota });
  }

  return { cumulative: quota - 1, quotas, periodReturns };
}

/** Dias corridos entre duas datas `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Retorno anualizado (base 365 dias corridos); `null` para períodos menores que um ano. */
export function annualizeReturn(total: number, days: number): number | null {
  if (!Number.isFinite(total) || total <= -1 || days < 365) return null;
  return (1 + total) ** (365 / days) - 1;
}

export interface XirrFlow {
  date: string;
  /** Do ponto de vista do investidor: aportes negativos; resgates e patrimônio final positivos. */
  amount: number;
}

/** TIR anual de fluxos datados (XIRR, base 365). `null` sem troca de sinal ou sem convergência. */
export function xirr(flows: readonly XirrFlow[]): number | null {
  const valid = flows.filter((f) => Number.isFinite(f.amount) && f.amount !== 0);
  if (!valid.some((f) => f.amount < 0) || !valid.some((f) => f.amount > 0)) return null;

  const origin = valid.reduce((min, f) => (f.date < min ? f.date : min), valid[0].date);
  const terms = valid.map((f) => ({ t: daysBetween(origin, f.date) / 365, amount: f.amount }));
  const npv = (rate: number) => terms.reduce((sum, { t, amount }) => sum + amount / (1 + rate) ** t, 0);
  const slope = (rate: number) => terms.reduce((sum, { t, amount }) => sum - (t * amount) / (1 + rate) ** (t + 1), 0);

  // Newton a partir de 10% a.a.
  let rate = 0.1;
  for (let i = 0; i < 50; i++) {
    const value = npv(rate);
    if (Math.abs(value) < 1e-7) return rate;
    const derivative = slope(rate);
    if (!Number.isFinite(derivative) || derivative === 0) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }

  // Bisseção como reserva
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  if (fLo * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-10) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return null;
}

/** Retorno composto de uma sequência de retornos por período. */
export function compoundReturns(returns: readonly number[]): number {
  return returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

/** Volatilidade anualizada (desvio padrão amostral × √períodos por ano); `null` com menos de 2 retornos. */
export function annualizedVolatility(returns: readonly number[], periodsPerYear = 12): number | null {
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

/**
 * Índice de Sharpe com o CDI do mesmo período: (retorno anualizado da carteira − CDI anualizado) / volatilidade
 * anualizada. Os dois vetores cobrem os mesmos períodos. `null` com menos de 2 períodos ou volatilidade nula.
 */
export function sharpeRatio(
  portfolioReturns: readonly number[],
  riskFreeReturns: readonly number[],
  periodsPerYear = 12
): number | null {
  const n = portfolioReturns.length;
  if (n < 2 || riskFreeReturns.length !== n) return null;
  const volatility = annualizedVolatility(portfolioReturns, periodsPerYear);
  if (volatility === null || volatility < 1e-9) return null;
  const annualized = (returns: readonly number[]) => (1 + compoundReturns(returns)) ** (periodsPerYear / n) - 1;
  return (annualized(portfolioReturns) - annualized(riskFreeReturns)) / volatility;
}
