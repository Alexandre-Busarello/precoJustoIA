/**
 * Partes puras do ETF Score e dos presets do ranking de ETFs (sem Prisma), para serem testáveis.
 * Zero é um valor válido (taxa de administração zerada, retorno nulo no período): só `null`/`undefined` é ausência.
 */

/** Número a partir de Decimal/string/number; `null` só quando o valor não existe ou não é numérico. Zero continua zero. */
export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Retorno de 12 meses; sem ele, o de 6 meses anualizado. Um retorno de 0% é usado como está. */
export function effectiveReturn1y(item: { return1y: number | null; return6m: number | null }): number | null {
  if (item.return1y !== null) return item.return1y;
  if (item.return6m !== null) return (1 + item.return6m) ** 2 - 1;
  return null;
}

export function linearNormalize(value: number, min: number, max: number): number {
  if (max === min) return 100;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export function logNormalize(value: number, allValues: number[]): number {
  const positives = allValues.filter((v) => v > 0);
  if (positives.length === 0) return 50;
  const logVal = Math.log1p(value);
  const logMin = Math.log1p(Math.min(...positives));
  const logMax = Math.log1p(Math.max(...positives));
  return linearNormalize(logVal, logMin, logMax);
}

const MIN_EXPENSE_RATIO = 0.001; // 0,10% a.a. ou menos: nota máxima
const MAX_EXPENSE_RATIO = 0.015; // 1,50% a.a. ou mais: nota zero

/** Dimensão custo (0–100): quanto menor a taxa, maior a nota. Taxa 0 vale 100; sem taxa, `null` (o score não sai). */
export function costScore(netExpenseRatio: number | null): number | null {
  if (netExpenseRatio === null) return null;
  if (netExpenseRatio <= MIN_EXPENSE_RATIO) return 100;
  if (netExpenseRatio >= MAX_EXPENSE_RATIO) return 0;
  return ((MAX_EXPENSE_RATIO - netExpenseRatio) / (MAX_EXPENSE_RATIO - MIN_EXPENSE_RATIO)) * 100;
}

/** Dimensão retorno (0–100): posição do retorno entre os ETFs do mesmo índice; sozinho no grupo, 75 (neutro). */
export function returnScore(return1y: number, group: number[]): number {
  if (group.length <= 1) return 75;
  return linearNormalize(return1y, Math.min(...group), Math.max(...group));
}

/** Penalidade (0–20 pts) quando os 5 maiores ativos passam de 65% da carteira; sem dado, 0. */
export function concentrationPenalty(holdingsConcentrationTop5: number | null): number {
  if (holdingsConcentrationTop5 === null) return 0;
  const THRESHOLD = 0.65;
  const MAX_EXCESS = 0.35;
  const MAX_PENALTY = 20;
  if (holdingsConcentrationTop5 <= THRESHOLD) return 0;
  const excess = holdingsConcentrationTop5 - THRESHOLD;
  return Math.min(MAX_PENALTY, (excess / MAX_EXCESS) * MAX_PENALTY);
}

/**
 * Índices do preset "Renda fixa (Selic e IPCA)", reconhecidos como palavra inteira no nome do índice: Selic, IPCA,
 * IRF-M (IRF-M 1, IRFM1+) e IMA (IMA-B, IMA-B 5+, IMA-S, IMA-Geral). Evita os falsos positivos da busca por
 * substring, como "ima" em "Climate" ou "Maxima".
 */
const FIXED_INCOME_BENCHMARK = /(?:^|[^a-z0-9])(?:selic|ipca|irf-?m\d*|ima(?:-?[bsc]\d*|-geral)?)(?![a-z])/i;

export function isFixedIncomeBenchmark(benchmark: string | null | undefined): boolean {
  if (!benchmark) return false;
  return FIXED_INCOME_BENCHMARK.test(benchmark);
}
