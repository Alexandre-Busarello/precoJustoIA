import { AbstractStrategy, notApplicableAnalysis, toNumber } from './base-strategy';
import { BazinParams, CompanyData, StrategyAnalysis, RankBuilderResult } from './types';
import {
  fullYearTotals,
  netAmount,
  removeExtraordinary,
  toDividendEvents,
  type DividendEvent,
} from '@/lib/finance/dividends';
import { isFinancial } from '@/lib/finance/sector-classification';
import { ceilingPrice } from '@/lib/finance/valuation';
import { formatBRL, formatMultiple, formatPct } from '@/lib/format';
import { marginOfSafety, upside as upsideFraction } from '@/lib/valuation-metrics';

export const BAZIN_DEFAULTS = {
  targetDividendYield: 0.06,
  yearsForAverage: 5,
  maxDebtToEquity: 0.5,
} as const;

/**
 * DY alvo válido: número finito em (0, 1]. Zero, negativo, NaN ou absurdo cai no padrão de 6%
 * (preço-teto = média ÷ DY; com DY ≤ 0 o teto não existe).
 */
export function resolveTargetYield(value: unknown, fallback: number = BAZIN_DEFAULTS.targetDividendYield): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1 ? n : fallback;
}

/** Mínimo de anos-calendário completos com histórico para a média fazer sentido. */
const MIN_FULL_YEARS = 3;
/** Critérios de financeiras (bancos, seguradoras): ROE médio de 5 anos e payout. */
const FINANCIAL_MIN_ROE = 0.12;
const FINANCIAL_PAYOUT_RANGE = [0.25, 0.8] as const;

/**
 * Média de um indicador de `FinancialData` no ano atual + até 4 anos anteriores (5 anos), ignorando valores ausentes.
 * `null` sem nenhum valor. Usado nos critérios de financeiras (ROE médio de 5 anos).
 */
export function fiveYearAverage(companyData: CompanyData, field: string): number | null {
  const history = [...(companyData.historicalFinancials ?? [])].sort((a, b) => (b.year || 0) - (a.year || 0));
  const values = [companyData.financials[field], ...history.map((row) => row[field])]
    .slice(0, 5)
    .map((value) => toNumber(value))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

/** Anos-calendário completos de proventos carregados para Bazin, Barsi e Gordon (N−6 … N−1, mais o ano corrente). */
export const DIVIDEND_HISTORY_YEARS = 6;

/** 1º de janeiro de N − `DIVIDEND_HISTORY_YEARS` (UTC): início da janela de proventos que os carregadores buscam. */
export function dividendHistoryStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear() - DIVIDEND_HISTORY_YEARS, 0, 1));
}

interface DividendRow {
  exDate: Date | string;
  paymentDate?: Date | string | null;
  amount: unknown;
  type?: string | null;
}

/** Proventos com datas como `Date` (o cache de queries serializa em JSON e devolve datas como string). */
export function toDividendHistory(rows: readonly DividendRow[]): NonNullable<CompanyData['dividendHistory']> {
  return rows.map((row) => ({
    exDate: new Date(row.exDate),
    paymentDate: row.paymentDate ? new Date(row.paymentDate) : null,
    amount: row.amount,
    type: row.type ?? null,
  }));
}

/** Proventos por ação do `CompanyData` (valores brutos), já convertidos para number. */
export function dividendEventsOf(companyData: CompanyData): DividendEvent[] {
  return toDividendEvents(companyData.dividendHistory ?? []);
}

/** Resultado de ranking a partir de uma análise com preço justo (upside em p.p., margem = 1 − P/VJ em p.p.). */
export function toRankingResult(companyData: CompanyData, analysis: StrategyAnalysis): RankBuilderResult {
  const discount = marginOfSafety(companyData.currentPrice, analysis.fairValue);
  return {
    ticker: companyData.ticker,
    name: companyData.name,
    sector: companyData.sector,
    currentPrice: companyData.currentPrice,
    logoUrl: companyData.logoUrl,
    fairValue: analysis.fairValue,
    upside: analysis.upside,
    marginOfSafety: discount === null ? null : discount * 100,
    rational: analysis.reasoning,
    key_metrics: analysis.key_metrics,
  };
}

function sumAmounts(events: readonly DividendEvent[]): number {
  return events.reduce((acc, event) => acc + event.amount, 0);
}

/** Upside em pontos percentuais (VJ/P − 1), como as demais estratégias devolvem. */
export function upsidePoints(price: number, fairValue: number | null): number | null {
  const value = upsideFraction(price, fairValue);
  return value === null ? null : value * 100;
}

/**
 * Método Bazin: preço-teto = média anual dos proventos brutos (dividendos + JCP) dos últimos anos-calendário completos
 * ÷ dividend yield alvo. O ano corrente (parcial) nunca entra. Exige dívida baixa (ou, em financeiras, ROE e payout)
 * e lucros consistentes.
 */
export class BazinStrategy extends AbstractStrategy<BazinParams> {
  readonly name = 'bazin';

  validateCompanyData(companyData: CompanyData): boolean {
    return companyData.currentPrice > 0;
  }

  runAnalysis(companyData: CompanyData, params: BazinParams = {}): StrategyAnalysis {
    const bdrReason = this.bdrNotApplicableReason(companyData);
    if (bdrReason) return notApplicableAnalysis(bdrReason);
    const targetYield = resolveTargetYield(params.targetDividendYield);
    const years = params.yearsForAverage ?? BAZIN_DEFAULTS.yearsForAverage;
    const maxDebtToEquity = params.maxDebtToEquity ?? BAZIN_DEFAULTS.maxDebtToEquity;
    const { currentPrice: price, financials } = companyData;

    const allEvents = dividendEventsOf(companyData);
    // Extraordinários (> 2× a mediana, sem recorrência sazonal) ficam fora por padrão: um provento pontual
    // inflaria a média e o preço-teto por cinco anos.
    const excludeExtraordinary = params.excludeExtraordinary ?? true;
    let events = excludeExtraordinary ? removeExtraordinary(allEvents) : allEvents;
    const extraordinaryRemoved = sumAmounts(allEvents) - sumAmounts(events);
    if (params.useNetJcp) events = events.map((event) => ({ ...event, amount: netAmount(event) }));

    const totals = fullYearTotals(events, { years });
    const averageDividend = totals.length > 0 ? totals.reduce((acc, t) => acc + t.total, 0) / totals.length : null;
    const ceiling = ceilingPrice(averageDividend, targetYield);
    const averageYield = averageDividend !== null && price > 0 ? averageDividend / price : null;
    const amountLabel = params.useNetJcp ? 'líquidos' : 'brutos';
    const extraordinaryNote = extraordinaryRemoved > 0.005
      ? ` · ${formatBRL(extraordinaryRemoved)} em proventos extraordinários fora da média`
      : '';

    const hasHistory = totals.length >= MIN_FULL_YEARS;
    const meetsYield = averageYield !== null && averageYield >= targetYield;
    const consistentProfits = this.hasConsistentProfits(companyData);
    const financial = isFinancial(companyData.sector, companyData.industry);

    const criteria: StrategyAnalysis['criteria'] = [
      {
        label: `Histórico de proventos (${MIN_FULL_YEARS}+ anos completos)`,
        value: hasHistory,
        description: totals.length > 0
          ? `Anos usados na média: ${totals.map((t) => t.year).join(', ')}`
          : 'Sem proventos nos últimos anos completos',
      },
      {
        label: `DY médio ≥ ${formatPct(targetYield)}`,
        value: meetsYield,
        description: `Média de proventos ${amountLabel}: ${formatBRL(averageDividend)} por ação ao ano · DY médio sobre o preço: ${formatPct(averageYield)}${extraordinaryNote}`,
      },
    ];

    let financialHealthOk: boolean;
    if (financial) {
      const roe5y = fiveYearAverage(companyData, 'roe');
      const payout = toNumber(financials.payout);
      const roeOk = roe5y !== null && roe5y >= FINANCIAL_MIN_ROE;
      const payoutOk = payout !== null && payout >= FINANCIAL_PAYOUT_RANGE[0] && payout <= FINANCIAL_PAYOUT_RANGE[1];
      criteria.push(
        { label: `ROE médio de 5 anos ≥ ${formatPct(FINANCIAL_MIN_ROE, { digits: 0 })}`, value: roeOk, description: `ROE médio: ${formatPct(roe5y)}` },
        {
          label: `Payout entre ${formatPct(FINANCIAL_PAYOUT_RANGE[0], { digits: 0 })} e ${formatPct(FINANCIAL_PAYOUT_RANGE[1], { digits: 0 })}`,
          value: payoutOk,
          description: `Payout: ${formatPct(payout)}`,
        }
      );
      financialHealthOk = roeOk && payoutOk;
    } else {
      const debtToEquity = toNumber(financials.dividaLiquidaPl);
      financialHealthOk = debtToEquity !== null && Number.isFinite(debtToEquity) && debtToEquity <= maxDebtToEquity;
      criteria.push({
        label: `Dív. líq./PL ≤ ${formatMultiple(maxDebtToEquity)}`,
        value: financialHealthOk,
        description: debtToEquity === null ? 'Sem dado de endividamento' : `Dív. líq./PL: ${formatMultiple(debtToEquity, { digits: 2 })}`,
      });
    }

    criteria.push({
      label: 'Lucros consistentes (até 2 anos de prejuízo em 8)',
      value: consistentProfits,
      description: consistentProfits ? 'Histórico de lucros dentro do limite' : 'Prejuízos acima do limite no histórico',
    });

    const passed = criteria.filter((c) => c.value).length;
    const isEligible = hasHistory && meetsYield && financialHealthOk && consistentProfits;
    const fairValue = hasHistory ? ceiling : null;
    const discount = marginOfSafety(price, fairValue);

    let reasoning: string;
    if (!hasHistory) {
      reasoning = `Histórico de proventos insuficiente para o método Bazin: ${totals.length} ano(s) completo(s), mínimo de ${MIN_FULL_YEARS}.`;
    } else {
      const position = discount === null
        ? ''
        : discount >= 0
          ? `O preço atual de ${formatBRL(price)} está ${formatPct(discount)} abaixo do preço-teto.`
          : `O preço atual de ${formatBRL(price)} está ${formatPct(-discount)} acima do preço-teto.`;
      const failed = criteria.filter((c) => !c.value).map((c) => c.label.toLowerCase());
      reasoning = [
        `Preço-teto Bazin de ${formatBRL(fairValue)}: média de proventos ${amountLabel} de ${formatBRL(averageDividend)} por ação (${totals.length} anos completos) ÷ DY alvo de ${formatPct(targetYield)}.`,
        extraordinaryRemoved > 0.005
          ? `Proventos extraordinários (${formatBRL(extraordinaryRemoved)} por ação no período) não entram na média, porque não devem se repetir.`
          : '',
        position,
        isEligible ? 'Atende a todos os critérios do método.' : `Não atende: ${failed.join('; ')}.`,
      ].filter(Boolean).join(' ');
    }

    return {
      isEligible,
      score: (passed / criteria.length) * 100,
      fairValue,
      upside: upsidePoints(price, fairValue),
      discount,
      reasoning,
      criteria,
      key_metrics: {
        ceilingPrice: fairValue,
        averageDividend,
        dividendYield: averageYield,
        discountFromCeiling: discount === null ? null : discount * 100,
        fullYearsUsed: totals.length,
        roe: toNumber(financials.roe),
        dividaLiquidaPl: financial ? null : toNumber(financials.dividaLiquidaPl),
        payout: toNumber(financials.payout),
      },
    };
  }

  runRanking(companies: CompanyData[], params: BazinParams = {}): RankBuilderResult[] {
    let candidates = this.filterByAssetType(companies, params.assetTypeFilter);
    candidates = this.filterCompaniesBySize(candidates, params.companySize || 'all');

    const ranked = candidates
      .filter((company) => this.validateCompanyData(company))
      .map((company) => ({ company, analysis: this.runAnalysis(company, params) }))
      .filter(({ analysis }) => analysis.isEligible && analysis.fairValue !== null)
      // Maior DY médio primeiro (equivale ao maior potencial até o preço-teto).
      .sort((a, b) => (b.analysis.key_metrics?.dividendYield ?? 0) - (a.analysis.key_metrics?.dividendYield ?? 0))
      .slice(0, params.limit ?? 50)
      .map(({ company, analysis }) => toRankingResult(company, analysis));

    return this.applyTechnicalPrioritization(ranked, companies, params.useTechnicalAnalysis);
  }

  generateRational(params: BazinParams = {}): string {
    const targetYield = resolveTargetYield(params.targetDividendYield);
    const years = params.yearsForAverage ?? BAZIN_DEFAULTS.yearsForAverage;
    const maxDebtToEquity = params.maxDebtToEquity ?? BAZIN_DEFAULTS.maxDebtToEquity;

    return `# Método Bazin (preço-teto)

Décio Bazin propôs um preço máximo a pagar por ações pagadoras de dividendos: o valor que entrega um dividend yield mínimo sobre os proventos que a empresa costuma distribuir.

## Fórmula

**Preço-teto = média anual dos proventos ÷ DY alvo (${formatPct(targetYield)})**

- A média usa os últimos ${years} anos-calendário completos. O ano corrente, ainda parcial, não entra.
- Proventos ${params.useNetJcp ? 'líquidos (JCP descontado do IRRF)' : 'brutos (dividendos + JCP antes do IRRF), o padrão de mercado'}.
- ${params.excludeExtraordinary === false ? 'Proventos extraordinários entram na média.' : 'Proventos extraordinários (acima de 2× a mediana e sem repetição no mesmo mês de outros anos) ficam fora da média.'}
- São necessários ao menos ${MIN_FULL_YEARS} anos completos de histórico.

## Critérios

- DY médio sobre o preço atual ≥ ${formatPct(targetYield)} (equivale a preço ≤ preço-teto).
- Dív. líq./PL ≤ ${formatMultiple(maxDebtToEquity)}. Bancos e seguradoras usam ROE médio de 5 anos ≥ ${formatPct(FINANCIAL_MIN_ROE, { digits: 0 })} e payout entre ${formatPct(FINANCIAL_PAYOUT_RANGE[0], { digits: 0 })} e ${formatPct(FINANCIAL_PAYOUT_RANGE[1], { digits: 0 })}.
- Lucros consistentes: no máximo 2 anos de prejuízo nos últimos 8.

**Ordenação**: maior DY médio sobre o preço atual${params.useTechnicalAnalysis ? ', com priorização técnica dentro de faixas semelhantes' : ''}.

O preço-teto é uma estimativa baseada em proventos passados, que podem não se repetir. Não é recomendação de investimento.`;
  }
}
