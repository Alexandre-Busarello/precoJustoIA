import { AbstractStrategy } from './base-strategy';
import { ScreeningParams, CompanyData, StrategyAnalysis, RankBuilderResult, ScreeningFilter } from './types';
import { toNumber } from './base-strategy';
import { GrahamStrategy } from './graham-strategy';
import { BazinStrategy, resolveTargetYield, BAZIN_DEFAULTS } from './bazin-strategy';
import { LynchStrategy } from './lynch-strategy';
import { applyLiquidityRules } from '@/lib/ranking-models';
import { dedupedDividendEvents, sumTTM } from '@/lib/finance/dividends';
import { dipWithIntactFundamentals } from '@/lib/finance/signals';
import { isFinancial } from '@/lib/finance/sector-classification';
import { fundamentalsStatus, type AnnualFundamentals } from '@/lib/allocation/fundamentals';
import { formatBRLCompact, formatDeltaPct, formatNumber, formatPct } from '@/lib/format';

/** Filtros do screening alinhados aos modelos do "Onde aportar" (fora de `ScreeningParams` por compatibilidade). */
export interface ScreeningSignalParams {
  /** Desconto vs. preço-teto Bazin (1 − P/teto), em fração: `{ min: 0.2 }` = pelo menos 20% abaixo do teto. */
  bazinDiscountFilter?: ScreeningFilter;
  /** DY alvo do preço-teto Bazin, em fração (padrão 6%). */
  bazinTargetYield?: number;
  /** PEG de Peter Lynch (P/L ÷ crescimento de LPA em %). Empresas fora do modelo não passam. */
  pegFilter?: ScreeningFilter;
  /** Preço abaixo da MM200 ou ≥ 20% abaixo da máxima de 52 semanas, com fundamentos preservados. */
  dipWithIntactFundamentals?: boolean;
}

export type ExtendedScreeningParams = ScreeningParams & ScreeningSignalParams;

/** Sinais de preço pré-calculados em lote pela rota (série diária), em fração. */
export interface ScreeningPriceSignals {
  /** Último fechamento ÷ média de 200 pregões − 1; `null` com menos de 200 pregões. */
  pctAboveSma200: number | null;
  /** Último fechamento ÷ máxima de 52 semanas − 1. */
  drawdown52w: number | null;
}

export type ScreeningCompanyData = CompanyData & { priceSignals?: ScreeningPriceSignals | null };

/** Métricas de modelos Premium (Bazin, Lynch) que a rota remove das respostas fora do Premium. */
export const PREMIUM_SCREENING_METRICS = ['bazinCeiling', 'bazinDiscount', 'peg'] as const;

/**
 * DY 12m com proventos reais: soma dos proventos brutos (dividendos + JCP) com data-com nos últimos 12 meses ÷ preço.
 * `0` quando não houve pagamento; `null` sem preço ou sem histórico carregado.
 */
export function dividendYield12m(company: CompanyData, asOf: Date = new Date()): number | null {
  if (!company.dividendHistory || !(company.currentPrice > 0)) return null;
  return sumTTM(dedupedDividendEvents(company.dividendHistory), asOf) / company.currentPrice;
}

export interface BazinScreening {
  ceiling: number | null;
  /** 1 − P/teto, em fração (negativo acima do teto). */
  discount: number | null;
}

/** Preço-teto Bazin e desconto pelo modelo da plataforma (mesmo cálculo da página do ativo). */
export function bazinScreening(company: CompanyData, targetYield?: number): BazinScreening {
  const analysis = new BazinStrategy().runAnalysis(company, { targetDividendYield: resolveTargetYield(targetYield) });
  return { ceiling: analysis.fairValue, discount: analysis.discount ?? null };
}

/** PEG de Lynch; `null` quando o modelo não se aplica (financeiras, cíclicas, prejuízo, crescimento ≤ 0, BDRs). */
export function lynchPeg(company: CompanyData): number | null {
  const value = new LynchStrategy().runAnalysis(company, {}).key_metrics?.peg;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Os dois períodos de 12 meses mais recentes de `FinancialData` (atual + históricos), do mais novo ao mais antigo. */
function latestAnnualFundamentals(company: CompanyData): AnnualFundamentals[] {
  const rows = [company.financials, ...(company.historicalFinancials ?? [])]
    .filter((row) => typeof row.year === 'number')
    .sort((a, b) => (b.year as number) - (a.year as number));
  return rows.slice(0, 2).map((row) => ({
    year: row.year as number,
    lucroLiquido: toNumber(row.lucroLiquido),
    roe: toNumber(row.roe),
    margemLiquida: toNumber(row.margemLiquida),
    ebitda: toNumber(row.ebitda),
    dividaLiquidaEbitda: toNumber(row.dividaLiquidaEbitda),
  }));
}

export interface DipEvaluation {
  passed: boolean;
  /** Sem 200 pregões de preço ou sem dois períodos de 12 meses consecutivos: fica de fora e entra na contagem. */
  insufficient: boolean;
  pctAboveSma200: number | null;
  drawdown52w: number | null;
  /** Variação do lucro líquido 12m vs. os 12m anteriores (fração). */
  netIncomeChange: number | null;
  /** Variação do ROE 12m em pontos (fração: 0,01 = 1 p.p.). */
  roeChange: number | null;
}

/**
 * "Queda com fundamentos intactos": `dipWithIntactFundamentals` com os sinais de preço da rota e a mesma checagem de
 * fundamentos do "Onde aportar" (`fundamentalsStatus` sobre os dois últimos períodos de 12 meses).
 */
export function evaluateDip(company: ScreeningCompanyData): DipEvaluation {
  const pctAboveSma200 = company.priceSignals?.pctAboveSma200 ?? null;
  const drawdown52w = company.priceSignals?.drawdown52w ?? null;
  const annual = latestAnnualFundamentals(company);
  const status = fundamentalsStatus({ annual, financial: isFinancial(company.sector, company.industry) });
  const [last, previous] = annual;
  const netIncomeChange =
    last?.lucroLiquido != null && previous?.lucroLiquido != null && previous.lucroLiquido > 0
      ? last.lucroLiquido / previous.lucroLiquido - 1
      : null;
  const roeChange = last?.roe != null && previous?.roe != null ? last.roe - previous.roe : null;
  const insufficient = pctAboveSma200 === null || status.insufficient === true;
  const passed =
    !insufficient &&
    dipWithIntactFundamentals({
      priceVsSma200: { pctAbove: pctAboveSma200 },
      drawdown52w,
      fundamentals: { intact: status.intact === true },
    });
  return { passed, insufficient, pctAboveSma200, drawdown52w, netIncomeChange, roeChange };
}

/** Valores calculados uma vez por empresa e usados nos critérios e nas métricas. */
interface CompanySignals {
  dy12m: number | null;
  bazin: BazinScreening;
  peg: number | null;
  dip: DipEvaluation | null;
}

function rangeText(filter: ScreeningFilter, format: (value: number) => string): string {
  const parts: string[] = [];
  if (filter.min !== undefined) parts.push(`≥ ${format(filter.min)}`);
  if (filter.max !== undefined) parts.push(`≤ ${format(filter.max)}`);
  return parts.join(' e ');
}

/** Descrição do limite de liquidez aplicado (para o racional). */
function liquidityText(minLiquidity: number | null | undefined): string {
  if (minLiquidity === null) return 'inclui ativos com baixa liquidez (marcados)';
  if (typeof minLiquidity === 'number') return `volume médio diário ≥ ${formatBRLCompact(minLiquidity)}`;
  return 'volume médio diário ≥ R$ 1 mi para ações (padrão)';
}

/**
 * Estratégia de Screening Customizável
 * Permite aplicar filtros personalizados em múltiplos indicadores
 */
export class ScreeningStrategy extends AbstractStrategy<ScreeningParams> {
  name = 'Screening de Ações';

  /**
   * Valida se um valor está dentro do range especificado no filtro
   */
  private isValueInRange(value: number | null, filter: ScreeningFilter | undefined): boolean {
    if (!filter || !filter.enabled) return true; // Filtro desativado, aceita qualquer valor
    
    // Se o valor é null (N/A), a empresa deve ser reprovada quando o filtro está ativo
    if (value === null) {
      return false; // Sem dados, REPROVA o filtro (empresa não passa)
    }
    
    // Verifica min
    if (filter.min !== undefined && value < filter.min) return false;
    
    // Verifica max
    if (filter.max !== undefined && value > filter.max) return false;
    
    return true;
  }

  /**
   * Conta quantos filtros estão ativos
   */
  private countActiveFilters(params: ExtendedScreeningParams): number {
    let count = 0;

    // Modelos e sinais
    if (params.bazinDiscountFilter?.enabled) count++;
    if (params.pegFilter?.enabled) count++;
    if (params.dipWithIntactFundamentals) count++;
    
    // Valuation
    if (params.plFilter?.enabled) count++;
    if (params.pvpFilter?.enabled) count++;
    if (params.evEbitdaFilter?.enabled) count++;
    if (params.psrFilter?.enabled) count++;
    
    // Rentabilidade
    if (params.roeFilter?.enabled) count++;
    if (params.roicFilter?.enabled) count++;
    if (params.roaFilter?.enabled) count++;
    if (params.margemLiquidaFilter?.enabled) count++;
    if (params.margemEbitdaFilter?.enabled) count++;
    
    // Crescimento
    if (params.cagrLucros5aFilter?.enabled) count++;
    if (params.cagrReceitas5aFilter?.enabled) count++;
    
    // Dividendos
    if (params.dyFilter?.enabled) count++;
    if (params.payoutFilter?.enabled) count++;
    
    // Endividamento & Liquidez
    if (params.dividaLiquidaPlFilter?.enabled) count++;
    if (params.liquidezCorrenteFilter?.enabled) count++;
    if (params.dividaLiquidaEbitdaFilter?.enabled) count++;
    
    // Market Cap
    if (params.marketCapFilter?.enabled) count++;
    
    // Score Geral
    if (params.overallScoreFilter?.enabled) count++;
    
    // Graham Upside
    if (params.grahamUpsideFilter?.enabled) count++;
    
    // Setores e Indústrias
    if (params.selectedSectors && params.selectedSectors.length > 0) count++;
    if (params.selectedIndustries && params.selectedIndustries.length > 0) count++;
    
    return count;
  }

  /**
   * Gera lista de critérios aplicados
   */
  private generateCriteria(
    companyData: CompanyData,
    params: ExtendedScreeningParams,
    signals: CompanySignals
  ): { label: string; value: boolean; description: string }[] {
    const criteria: { label: string; value: boolean; description: string }[] = [];
    const financials = companyData.financials;

    // Valuation
    if (params.plFilter?.enabled) {
      const pl = toNumber(financials.pl);
      const inRange = this.isValueInRange(pl, params.plFilter);
      criteria.push({
        label: 'P/L',
        value: inRange,
        description: `${params.plFilter.min !== undefined ? `≥ ${params.plFilter.min}` : ''}${params.plFilter.min !== undefined && params.plFilter.max !== undefined ? ' e ' : ''}${params.plFilter.max !== undefined ? `≤ ${params.plFilter.max}` : ''} (atual: ${pl?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.pvpFilter?.enabled) {
      const pvp = toNumber(financials.pvp);
      const inRange = this.isValueInRange(pvp, params.pvpFilter);
      criteria.push({
        label: 'P/VP',
        value: inRange,
        description: `${params.pvpFilter.min !== undefined ? `≥ ${params.pvpFilter.min}` : ''}${params.pvpFilter.min !== undefined && params.pvpFilter.max !== undefined ? ' e ' : ''}${params.pvpFilter.max !== undefined ? `≤ ${params.pvpFilter.max}` : ''} (atual: ${pvp?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.evEbitdaFilter?.enabled) {
      const evEbitda = toNumber(financials.evEbitda);
      const inRange = this.isValueInRange(evEbitda, params.evEbitdaFilter);
      criteria.push({
        label: 'EV/EBITDA',
        value: inRange,
        description: `${params.evEbitdaFilter.min !== undefined ? `≥ ${params.evEbitdaFilter.min}` : ''}${params.evEbitdaFilter.min !== undefined && params.evEbitdaFilter.max !== undefined ? ' e ' : ''}${params.evEbitdaFilter.max !== undefined ? `≤ ${params.evEbitdaFilter.max}` : ''} (atual: ${evEbitda?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.psrFilter?.enabled) {
      const psr = toNumber(financials.psr);
      const inRange = this.isValueInRange(psr, params.psrFilter);
      criteria.push({
        label: 'PSR',
        value: inRange,
        description: `${params.psrFilter.min !== undefined ? `≥ ${params.psrFilter.min}` : ''}${params.psrFilter.min !== undefined && params.psrFilter.max !== undefined ? ' e ' : ''}${params.psrFilter.max !== undefined ? `≤ ${params.psrFilter.max}` : ''} (atual: ${psr?.toFixed(2) || 'N/A'})`
      });
    }

    // Rentabilidade
    if (params.roeFilter?.enabled) {
      const roe = toNumber(financials.roe);
      const inRange = this.isValueInRange(roe, params.roeFilter);
      criteria.push({
        label: 'ROE',
        value: inRange,
        description: `${params.roeFilter.min !== undefined ? `≥ ${(params.roeFilter.min * 100).toFixed(1)}%` : ''}${params.roeFilter.min !== undefined && params.roeFilter.max !== undefined ? ' e ' : ''}${params.roeFilter.max !== undefined ? `≤ ${(params.roeFilter.max * 100).toFixed(1)}%` : ''} (atual: ${roe ? (roe * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.roicFilter?.enabled) {
      const roic = toNumber(financials.roic);
      const inRange = this.isValueInRange(roic, params.roicFilter);
      criteria.push({
        label: 'ROIC',
        value: inRange,
        description: `${params.roicFilter.min !== undefined ? `≥ ${(params.roicFilter.min * 100).toFixed(1)}%` : ''}${params.roicFilter.min !== undefined && params.roicFilter.max !== undefined ? ' e ' : ''}${params.roicFilter.max !== undefined ? `≤ ${(params.roicFilter.max * 100).toFixed(1)}%` : ''} (atual: ${roic ? (roic * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.roaFilter?.enabled) {
      const roa = toNumber(financials.roa);
      const inRange = this.isValueInRange(roa, params.roaFilter);
      criteria.push({
        label: 'ROA',
        value: inRange,
        description: `${params.roaFilter.min !== undefined ? `≥ ${(params.roaFilter.min * 100).toFixed(1)}%` : ''}${params.roaFilter.min !== undefined && params.roaFilter.max !== undefined ? ' e ' : ''}${params.roaFilter.max !== undefined ? `≤ ${(params.roaFilter.max * 100).toFixed(1)}%` : ''} (atual: ${roa ? (roa * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.margemLiquidaFilter?.enabled) {
      const margemLiquida = toNumber(financials.margemLiquida);
      const inRange = this.isValueInRange(margemLiquida, params.margemLiquidaFilter);
      criteria.push({
        label: 'Margem Líquida',
        value: inRange,
        description: `${params.margemLiquidaFilter.min !== undefined ? `≥ ${(params.margemLiquidaFilter.min * 100).toFixed(1)}%` : ''}${params.margemLiquidaFilter.min !== undefined && params.margemLiquidaFilter.max !== undefined ? ' e ' : ''}${params.margemLiquidaFilter.max !== undefined ? `≤ ${(params.margemLiquidaFilter.max * 100).toFixed(1)}%` : ''} (atual: ${margemLiquida ? (margemLiquida * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.margemEbitdaFilter?.enabled) {
      const margemEbitda = toNumber(financials.margemEbitda);
      const inRange = this.isValueInRange(margemEbitda, params.margemEbitdaFilter);
      criteria.push({
        label: 'Margem EBITDA',
        value: inRange,
        description: `${params.margemEbitdaFilter.min !== undefined ? `≥ ${(params.margemEbitdaFilter.min * 100).toFixed(1)}%` : ''}${params.margemEbitdaFilter.min !== undefined && params.margemEbitdaFilter.max !== undefined ? ' e ' : ''}${params.margemEbitdaFilter.max !== undefined ? `≤ ${(params.margemEbitdaFilter.max * 100).toFixed(1)}%` : ''} (atual: ${margemEbitda ? (margemEbitda * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    // Crescimento
    if (params.cagrLucros5aFilter?.enabled) {
      const cagrLucros = toNumber(financials.crescimentoLucros);
      const inRange = this.isValueInRange(cagrLucros, params.cagrLucros5aFilter);
      criteria.push({
        label: 'CAGR Lucros 5a',
        value: inRange,
        description: `${params.cagrLucros5aFilter.min !== undefined ? `≥ ${(params.cagrLucros5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrLucros5aFilter.min !== undefined && params.cagrLucros5aFilter.max !== undefined ? ' e ' : ''}${params.cagrLucros5aFilter.max !== undefined ? `≤ ${(params.cagrLucros5aFilter.max * 100).toFixed(1)}%` : ''} (atual: ${cagrLucros ? (cagrLucros * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.cagrReceitas5aFilter?.enabled) {
      const cagrReceitas = toNumber(financials.cagrReceitas5a);
      const inRange = this.isValueInRange(cagrReceitas, params.cagrReceitas5aFilter);
      criteria.push({
        label: 'CAGR Receitas 5a',
        value: inRange,
        description: `${params.cagrReceitas5aFilter.min !== undefined ? `≥ ${(params.cagrReceitas5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrReceitas5aFilter.min !== undefined && params.cagrReceitas5aFilter.max !== undefined ? ' e ' : ''}${params.cagrReceitas5aFilter.max !== undefined ? `≤ ${(params.cagrReceitas5aFilter.max * 100).toFixed(1)}%` : ''} (atual: ${cagrReceitas ? (cagrReceitas * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    // Dividendos
    // DY 12m com proventos reais (o nome `dyFilter` continua o mesmo para URLs e presets salvos)
    if (params.dyFilter?.enabled) {
      const inRange = this.isValueInRange(signals.dy12m, params.dyFilter);
      criteria.push({
        label: 'DY 12m',
        value: inRange,
        description: `${rangeText(params.dyFilter, (v) => formatPct(v))} (atual: ${formatPct(signals.dy12m)})`
      });
    }

    if (params.payoutFilter?.enabled) {
      const payout = toNumber(financials.payout);
      const inRange = this.isValueInRange(payout, params.payoutFilter);
      criteria.push({
        label: 'Payout',
        value: inRange,
        description: `${params.payoutFilter.min !== undefined ? `≥ ${(params.payoutFilter.min * 100).toFixed(1)}%` : ''}${params.payoutFilter.min !== undefined && params.payoutFilter.max !== undefined ? ' e ' : ''}${params.payoutFilter.max !== undefined ? `≤ ${(params.payoutFilter.max * 100).toFixed(1)}%` : ''} (atual: ${payout ? (payout * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    // Endividamento & Liquidez
    if (params.dividaLiquidaPlFilter?.enabled) {
      const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
      const inRange = this.isValueInRange(dividaLiquidaPl, params.dividaLiquidaPlFilter);
      criteria.push({
        label: 'Dívida Líq./PL',
        value: inRange,
        description: `${params.dividaLiquidaPlFilter.min !== undefined ? `≥ ${(params.dividaLiquidaPlFilter.min * 100).toFixed(1)}%` : ''}${params.dividaLiquidaPlFilter.min !== undefined && params.dividaLiquidaPlFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaPlFilter.max !== undefined ? `≤ ${(params.dividaLiquidaPlFilter.max * 100).toFixed(1)}%` : ''} (atual: ${dividaLiquidaPl ? (dividaLiquidaPl * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.liquidezCorrenteFilter?.enabled) {
      const liquidezCorrente = toNumber(financials.liquidezCorrente);
      const inRange = this.isValueInRange(liquidezCorrente, params.liquidezCorrenteFilter);
      criteria.push({
        label: 'Liquidez Corrente',
        value: inRange,
        description: `${params.liquidezCorrenteFilter.min !== undefined ? `≥ ${params.liquidezCorrenteFilter.min.toFixed(2)}` : ''}${params.liquidezCorrenteFilter.min !== undefined && params.liquidezCorrenteFilter.max !== undefined ? ' e ' : ''}${params.liquidezCorrenteFilter.max !== undefined ? `≤ ${params.liquidezCorrenteFilter.max.toFixed(2)}` : ''} (atual: ${liquidezCorrente?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.dividaLiquidaEbitdaFilter?.enabled) {
      const dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);
      const inRange = this.isValueInRange(dividaLiquidaEbitda, params.dividaLiquidaEbitdaFilter);
      criteria.push({
        label: 'Dívida Líq./EBITDA',
        value: inRange,
        description: `${params.dividaLiquidaEbitdaFilter.min !== undefined ? `≥ ${params.dividaLiquidaEbitdaFilter.min.toFixed(2)}x` : ''}${params.dividaLiquidaEbitdaFilter.min !== undefined && params.dividaLiquidaEbitdaFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaEbitdaFilter.max !== undefined ? `≤ ${params.dividaLiquidaEbitdaFilter.max.toFixed(2)}x` : ''} (atual: ${dividaLiquidaEbitda?.toFixed(2) || 'N/A'})`
      });
    }

    // Market Cap (empresas sem Market Cap são reprovadas)
    if (params.marketCapFilter?.enabled) {
      const marketCap = toNumber(financials.marketCap);
      const marketCapBi = marketCap ? marketCap / 1_000_000_000 : null;
      const inRange = this.isValueInRange(marketCap, params.marketCapFilter);
      criteria.push({
        label: 'Market Cap',
        value: inRange,
        description: `${params.marketCapFilter.min !== undefined ? `≥ R$ ${(params.marketCapFilter.min / 1_000_000_000).toFixed(2)}bi` : ''}${params.marketCapFilter.min !== undefined && params.marketCapFilter.max !== undefined ? ' e ' : ''}${params.marketCapFilter.max !== undefined ? `≤ R$ ${(params.marketCapFilter.max / 1_000_000_000).toFixed(2)}bi` : ''} (atual: ${marketCapBi ? `R$ ${marketCapBi.toFixed(2)}bi` : 'N/A - reprovado'})`
      });
    }
    
    // Score Geral (Overall Score)
    if (params.overallScoreFilter?.enabled) {
      // Calcular overall score para a empresa usando o método herdado da base
      const overallScore = this.calculateOverallScore(companyData);
      const inRange = this.isValueInRange(overallScore, params.overallScoreFilter);
      criteria.push({
        label: 'Score Geral',
        value: inRange,
        description: `${params.overallScoreFilter.min !== undefined ? `≥ ${params.overallScoreFilter.min.toFixed(0)}` : ''}${params.overallScoreFilter.min !== undefined && params.overallScoreFilter.max !== undefined ? ' e ' : ''}${params.overallScoreFilter.max !== undefined ? `≤ ${params.overallScoreFilter.max.toFixed(0)}` : ''} (atual: ${overallScore?.toFixed(0) || 'N/A'})`
      });
    }
    
    // Graham Upside (Margem de Segurança)
    if (params.grahamUpsideFilter?.enabled) {
      const grahamUpside = this.calculateGrahamUpside(companyData);
      // Se o filtro está ativo e o valor é null, a empresa NÃO passa (reprova)
      // Se o valor existe, verifica se está no range
      const inRange = grahamUpside !== null ? this.isValueInRange(grahamUpside, params.grahamUpsideFilter) : false;
      criteria.push({
        label: 'Potencial Graham',
        value: inRange,
        description: `${params.grahamUpsideFilter.min !== undefined ? `≥ ${params.grahamUpsideFilter.min.toFixed(0)}%` : ''}${params.grahamUpsideFilter.min !== undefined && params.grahamUpsideFilter.max !== undefined ? ' e ' : ''}${params.grahamUpsideFilter.max !== undefined ? `≤ ${params.grahamUpsideFilter.max.toFixed(0)}%` : ''} (atual: ${grahamUpside !== null ? grahamUpside.toFixed(1) + '%' : 'N/A - reprovado'})`
      });
    }
    
    // Desconto vs. preço-teto Bazin
    if (params.bazinDiscountFilter?.enabled) {
      criteria.push({
        label: 'Desconto vs. preço-teto Bazin',
        value: this.isValueInRange(signals.bazin.discount, params.bazinDiscountFilter),
        description: `${rangeText(params.bazinDiscountFilter, (v) => formatPct(v))} (teto ${signals.bazin.ceiling === null ? 'indisponível' : `com DY alvo de ${formatPct(resolveTargetYield(params.bazinTargetYield))}`}; atual: ${formatPct(signals.bazin.discount)})`
      });
    }

    // PEG de Peter Lynch
    if (params.pegFilter?.enabled) {
      criteria.push({
        label: 'PEG',
        value: this.isValueInRange(signals.peg, params.pegFilter),
        description: `${rangeText(params.pegFilter, (v) => formatNumber(v, { digits: 2 }))} (atual: ${signals.peg === null ? 'modelo não se aplica' : formatNumber(signals.peg, { digits: 2 })})`
      });
    }

    // Queda com fundamentos intactos
    if (params.dipWithIntactFundamentals) {
      const dip = signals.dip;
      criteria.push({
        label: 'Queda com fundamentos intactos',
        value: dip?.passed === true,
        description: !dip || dip.insufficient
          ? 'Sem dados suficientes (200 pregões de preço e dois períodos de 12 meses)'
          : `${formatDeltaPct(dip.pctAboveSma200)} vs. MM200 · ${formatDeltaPct(dip.drawdown52w)} da máxima de 52 semanas`
      });
    }

    // Setor
    if (params.selectedSectors && params.selectedSectors.length > 0) {
      const companySector = companyData.sector;
      // Se não tem dados de setor, IGNORA o filtro (considera como passou)
      const inSelectedSector = !companySector || params.selectedSectors.includes(companySector);
      criteria.push({
        label: 'Setor',
        value: inSelectedSector,
        description: `Setores selecionados: ${params.selectedSectors.join(', ')} (empresa: ${companySector || 'N/A - filtro ignorado'})`
      });
    }
    
    // Indústria
    if (params.selectedIndustries && params.selectedIndustries.length > 0) {
      const companyIndustry = companyData.industry;
      // Se não tem dados de indústria, IGNORA o filtro (considera como passou)
      const inSelectedIndustry = !companyIndustry || params.selectedIndustries.includes(companyIndustry);
      criteria.push({
        label: 'Indústria',
        value: inSelectedIndustry,
        description: `Indústrias selecionadas: ${params.selectedIndustries.join(', ')} (empresa: ${companyIndustry || 'N/A - filtro ignorado'})`
      });
    }

    return criteria;
  }
  
  /**
   * Calcula o Graham Upside para uma empresa
   */
  private calculateGrahamUpside(companyData: CompanyData): number | null {
    try {
      const grahamStrategy = new GrahamStrategy();
      
      // Validar se temos dados suficientes
      if (!grahamStrategy.validateCompanyData(companyData)) {
        return null;
      }
      
      // Executar análise Graham
      const analysis = grahamStrategy.runAnalysis(companyData, {});
      
      // Retornar upside
      return analysis.upside;
    } catch (error) {
      console.error('Erro ao calcular Graham upside:', error);
      return null;
    }
  }

  /** DY 12m, Bazin e PEG sempre (viram colunas); a queda só quando o filtro está ativo (depende dos preços da rota). */
  private computeSignals(companyData: ScreeningCompanyData, params: ExtendedScreeningParams): CompanySignals {
    return {
      dy12m: dividendYield12m(companyData),
      bazin: bazinScreening(companyData, params.bazinTargetYield),
      peg: lynchPeg(companyData),
      dip: params.dipWithIntactFundamentals ? evaluateDip(companyData) : null,
    };
  }

  runAnalysis(companyData: CompanyData, params: ScreeningParams): StrategyAnalysis {
    return this.analyze(companyData, params, this.computeSignals(companyData, params));
  }

  private analyze(companyData: CompanyData, params: ExtendedScreeningParams, signals: CompanySignals): StrategyAnalysis {
    const financials = companyData.financials;
    const criteria = this.generateCriteria(companyData, params, signals);
    
    // Conta quantos critérios passaram
    const passedCriteria = criteria.filter(c => c.value).length;
    const totalCriteria = criteria.length;
    
    // Empresa é elegível se passou em TODOS os critérios ativos
    const isEligible = passedCriteria === totalCriteria && totalCriteria > 0;
    
    // Score baseado na porcentagem de critérios atendidos
    const score = totalCriteria > 0 ? (passedCriteria / totalCriteria) * 100 : 0;

    // Gera reasoning dinâmico
    const passedList = criteria.filter(c => c.value).map(c => c.label).join(', ');
    const failedList = criteria.filter(c => !c.value).map(c => c.label).join(', ');
    
    let reasoning = `**Screening personalizado**: ${totalCriteria} filtros aplicados.\n\n`;
    
    if (isEligible) {
      reasoning += `**Atende aos filtros**: todos os ${totalCriteria} critérios configurados.\n\n`;
      reasoning += `**Critérios atendidos**: ${passedList}`;
    } else {
      reasoning += `**Não atende a todos os filtros**: ${passedCriteria} de ${totalCriteria} critérios.\n\n`;
      if (passedCriteria > 0) {
        reasoning += `**Atendidos**: ${passedList}\n\n`;
      }
      if (failedList) {
        reasoning += `**Não atendidos**: ${failedList}`;
      }
    }

    // Coletar métricas-chave (DY = DY 12m com proventos reais, em fração)
    const key_metrics: Record<string, number | null> = {
      pl: toNumber(financials.pl),
      pvp: toNumber(financials.pvp),
      roe: toNumber(financials.roe),
      roic: toNumber(financials.roic),
      dy: signals.dy12m,
      peg: signals.peg,
      bazinCeiling: signals.bazin.ceiling,
      margemLiquida: toNumber(financials.margemLiquida),
      liquidezCorrente: toNumber(financials.liquidezCorrente),
      dividaLiquidaPl: toNumber(financials.dividaLiquidaPl),
      cagrReceitas: toNumber(financials.cagrReceitas5a),
      marketCap: toNumber(financials.marketCap)
    };
    if (params.bazinDiscountFilter?.enabled) key_metrics.bazinDiscount = signals.bazin.discount;
    if (signals.dip) {
      key_metrics.priceVsSma200 = signals.dip.pctAboveSma200;
      key_metrics.drawdown52w = signals.dip.drawdown52w;
      key_metrics.netIncomeChange = signals.dip.netIncomeChange;
      key_metrics.roeChange = signals.dip.roeChange;
    }

    return {
      isEligible,
      score,
      fairValue: null, // Screening não calcula preço justo
      upside: null,
      reasoning,
      criteria,
      key_metrics
    };
  }

  /**
   * Screening completo, sem limite: resultados ordenados e quantas empresas ficaram de fora só por falta de dados
   * para o filtro "Queda com fundamentos intactos" (passariam em todos os outros critérios).
   */
  screen(companies: CompanyData[], params: ExtendedScreeningParams): { results: RankBuilderResult[]; insufficientData: number } {
    const activeFiltersCount = this.countActiveFilters(params);
    
    // Liquidez mínima padrão (ou `params.minLiquidity`) e uma classe por empresa, a mais líquida.
    // Só age sobre empresas com liquidez calculada pelo carregador; `minLiquidity: null` inclui as ilíquidas.
    const companiesFiltered = applyLiquidityRules(companies, params.minLiquidity);
    
    // Filtrar por tipo de ativo (b3, bdr, both) e por tamanho de empresa
    let candidates = this.filterByAssetType(companiesFiltered, params.assetTypeFilter);
    if (params.companySize && params.companySize !== 'all') {
      candidates = this.filterCompaniesBySize(candidates, params.companySize);
    }

    const results: RankBuilderResult[] = [];
    let insufficientData = 0;
    // Upside de Graham para o filtro ou para a ordenação por upside
    const needsUpside = params.grahamUpsideFilter?.enabled || params.sortBy === 'upside_desc' || params.sortBy === 'upside_asc';

    for (const company of candidates) {
      const signals = this.computeSignals(company, params);
      const analysis = this.analyze(company, params, signals);

      if (activeFiltersCount > 0 && !analysis.isEligible) {
        const failed = analysis.criteria.filter((criterion) => !criterion.value);
        if (signals.dip?.insufficient && failed.length === 1 && failed[0].label === 'Queda com fundamentos intactos') {
          insufficientData++;
        }
        continue;
      }

      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice: company.currentPrice,
        logoUrl: company.logoUrl,
        fairValue: null,
        upside: activeFiltersCount > 0 && needsUpside ? this.calculateGrahamUpside(company) : null,
        marginOfSafety: null,
        rational: activeFiltersCount > 0
          ? this.generateIndividualRational(company, params, analysis)
          : '**Nenhum filtro ativo**: configure ao menos um filtro para fazer o screening.',
        key_metrics: analysis.key_metrics
      });
    }

    // Sem filtros: maiores valores de mercado primeiro. Com filtros: ordenação customizada (rotas de marketing),
    // priorização técnica e valor de mercado como desempate.
    results.sort((a, b) => {
      if (activeFiltersCount > 0) {
        if (params.sortBy) {
          const sortResult = this.customSort(a, b, params.sortBy);
          if (sortResult !== 0) return sortResult;
        }
        if (params.useTechnicalAnalysis && a.key_metrics?.technicalScore && b.key_metrics?.technicalScore) {
          const techDiff = (b.key_metrics.technicalScore as number) - (a.key_metrics.technicalScore as number);
          if (Math.abs(techDiff) > 5) return techDiff;
        }
      }
      return ((b.key_metrics?.marketCap as number) || 0) - ((a.key_metrics?.marketCap as number) || 0);
    });

    // Screening NÃO remove tickers duplicados da mesma empresa além da regra de liquidez (classe mais líquida).
    return { results, insufficientData };
  }

  runRanking(companies: CompanyData[], params: ScreeningParams): RankBuilderResult[] {
    const { results } = this.screen(companies, params);
    // `limit` indefinido: todos os resultados
    if (params.limit === undefined || params.limit === null) return results;
    return results.slice(0, params.limit);
  }

  private generateIndividualRational(
    company: CompanyData,
    params: ScreeningParams,
    analysis: StrategyAnalysis
  ): string {
    let rational = `**${company.ticker}** passou em todos os filtros configurados.\n\n`;
    
    rational += `**Critérios atendidos**:\n`;
    analysis.criteria.filter(c => c.value).forEach(criterion => {
      rational += `• ${criterion.label}: ${criterion.description}\n`;
    });

    return rational;
  }

  generateRational(params: ExtendedScreeningParams): string {
    const activeFiltersCount = this.countActiveFilters(params);
    
    if (activeFiltersCount === 0) {
      return `**Screening de ações**

**Status**: nenhum filtro ativo. Liquidez: ${liquidityText(params.minLiquidity)}.

Configure ao menos um filtro nas categorias disponíveis para fazer o screening.`;
    }

    let rational = `**Screening de ações**

**Filtros quantitativos** sobre dados públicos, com os critérios que você escolheu.

**Filtros ativos**: ${activeFiltersCount}

**Liquidez**: ${liquidityText(params.minLiquidity)}

`;

    // Listar filtros por categoria
    const sections: { title: string; filters: string[] }[] = [];

    // Valuation
    const valuationFilters: string[] = [];
    if (params.plFilter?.enabled) {
      valuationFilters.push(`• **P/L**: ${params.plFilter.min !== undefined ? `≥ ${params.plFilter.min}` : ''}${params.plFilter.min !== undefined && params.plFilter.max !== undefined ? ' e ' : ''}${params.plFilter.max !== undefined ? `≤ ${params.plFilter.max}` : ''}`);
    }
    if (params.pvpFilter?.enabled) {
      valuationFilters.push(`• **P/VP**: ${params.pvpFilter.min !== undefined ? `≥ ${params.pvpFilter.min}` : ''}${params.pvpFilter.min !== undefined && params.pvpFilter.max !== undefined ? ' e ' : ''}${params.pvpFilter.max !== undefined ? `≤ ${params.pvpFilter.max}` : ''}`);
    }
    if (params.evEbitdaFilter?.enabled) {
      valuationFilters.push(`• **EV/EBITDA**: ${params.evEbitdaFilter.min !== undefined ? `≥ ${params.evEbitdaFilter.min}` : ''}${params.evEbitdaFilter.min !== undefined && params.evEbitdaFilter.max !== undefined ? ' e ' : ''}${params.evEbitdaFilter.max !== undefined ? `≤ ${params.evEbitdaFilter.max}` : ''}`);
    }
    if (params.psrFilter?.enabled) {
      valuationFilters.push(`• **PSR**: ${params.psrFilter.min !== undefined ? `≥ ${params.psrFilter.min}` : ''}${params.psrFilter.min !== undefined && params.psrFilter.max !== undefined ? ' e ' : ''}${params.psrFilter.max !== undefined ? `≤ ${params.psrFilter.max}` : ''}`);
    }
    if (valuationFilters.length > 0) {
      sections.push({ title: '**Valuation**', filters: valuationFilters });
    }

    // Rentabilidade
    const rentabilidadeFilters: string[] = [];
    if (params.roeFilter?.enabled) {
      rentabilidadeFilters.push(`• **ROE**: ${params.roeFilter.min !== undefined ? `≥ ${(params.roeFilter.min * 100).toFixed(1)}%` : ''}${params.roeFilter.min !== undefined && params.roeFilter.max !== undefined ? ' e ' : ''}${params.roeFilter.max !== undefined ? `≤ ${(params.roeFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.roicFilter?.enabled) {
      rentabilidadeFilters.push(`• **ROIC**: ${params.roicFilter.min !== undefined ? `≥ ${(params.roicFilter.min * 100).toFixed(1)}%` : ''}${params.roicFilter.min !== undefined && params.roicFilter.max !== undefined ? ' e ' : ''}${params.roicFilter.max !== undefined ? `≤ ${(params.roicFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.roaFilter?.enabled) {
      rentabilidadeFilters.push(`• **ROA**: ${params.roaFilter.min !== undefined ? `≥ ${(params.roaFilter.min * 100).toFixed(1)}%` : ''}${params.roaFilter.min !== undefined && params.roaFilter.max !== undefined ? ' e ' : ''}${params.roaFilter.max !== undefined ? `≤ ${(params.roaFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.margemLiquidaFilter?.enabled) {
      rentabilidadeFilters.push(`• **Margem Líquida**: ${params.margemLiquidaFilter.min !== undefined ? `≥ ${(params.margemLiquidaFilter.min * 100).toFixed(1)}%` : ''}${params.margemLiquidaFilter.min !== undefined && params.margemLiquidaFilter.max !== undefined ? ' e ' : ''}${params.margemLiquidaFilter.max !== undefined ? `≤ ${(params.margemLiquidaFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.margemEbitdaFilter?.enabled) {
      rentabilidadeFilters.push(`• **Margem EBITDA**: ${params.margemEbitdaFilter.min !== undefined ? `≥ ${(params.margemEbitdaFilter.min * 100).toFixed(1)}%` : ''}${params.margemEbitdaFilter.min !== undefined && params.margemEbitdaFilter.max !== undefined ? ' e ' : ''}${params.margemEbitdaFilter.max !== undefined ? `≤ ${(params.margemEbitdaFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (rentabilidadeFilters.length > 0) {
      sections.push({ title: '**Rentabilidade**', filters: rentabilidadeFilters });
    }

    // Crescimento
    const crescimentoFilters: string[] = [];
    if (params.cagrLucros5aFilter?.enabled) {
      crescimentoFilters.push(`• **CAGR Lucros 5a**: ${params.cagrLucros5aFilter.min !== undefined ? `≥ ${(params.cagrLucros5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrLucros5aFilter.min !== undefined && params.cagrLucros5aFilter.max !== undefined ? ' e ' : ''}${params.cagrLucros5aFilter.max !== undefined ? `≤ ${(params.cagrLucros5aFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.cagrReceitas5aFilter?.enabled) {
      crescimentoFilters.push(`• **CAGR Receitas 5a**: ${params.cagrReceitas5aFilter.min !== undefined ? `≥ ${(params.cagrReceitas5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrReceitas5aFilter.min !== undefined && params.cagrReceitas5aFilter.max !== undefined ? ' e ' : ''}${params.cagrReceitas5aFilter.max !== undefined ? `≤ ${(params.cagrReceitas5aFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (crescimentoFilters.length > 0) {
      sections.push({ title: '**Crescimento**', filters: crescimentoFilters });
    }

    // Dividendos
    const dividendosFilters: string[] = [];
    if (params.dyFilter?.enabled) {
      dividendosFilters.push(`• **DY 12m (proventos reais, bruto)**: ${params.dyFilter.min !== undefined ? `≥ ${(params.dyFilter.min * 100).toFixed(1)}%` : ''}${params.dyFilter.min !== undefined && params.dyFilter.max !== undefined ? ' e ' : ''}${params.dyFilter.max !== undefined ? `≤ ${(params.dyFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.payoutFilter?.enabled) {
      dividendosFilters.push(`• **Payout**: ${params.payoutFilter.min !== undefined ? `≥ ${(params.payoutFilter.min * 100).toFixed(1)}%` : ''}${params.payoutFilter.min !== undefined && params.payoutFilter.max !== undefined ? ' e ' : ''}${params.payoutFilter.max !== undefined ? `≤ ${(params.payoutFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (dividendosFilters.length > 0) {
      sections.push({ title: '**Dividendos**', filters: dividendosFilters });
    }

    // Endividamento & Liquidez
    const endividamentoFilters: string[] = [];
    if (params.dividaLiquidaPlFilter?.enabled) {
      endividamentoFilters.push(`• **Dívida Líq./PL**: ${params.dividaLiquidaPlFilter.min !== undefined ? `≥ ${(params.dividaLiquidaPlFilter.min * 100).toFixed(1)}%` : ''}${params.dividaLiquidaPlFilter.min !== undefined && params.dividaLiquidaPlFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaPlFilter.max !== undefined ? `≤ ${(params.dividaLiquidaPlFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.liquidezCorrenteFilter?.enabled) {
      endividamentoFilters.push(`• **Liquidez Corrente**: ${params.liquidezCorrenteFilter.min !== undefined ? `≥ ${params.liquidezCorrenteFilter.min.toFixed(2)}` : ''}${params.liquidezCorrenteFilter.min !== undefined && params.liquidezCorrenteFilter.max !== undefined ? ' e ' : ''}${params.liquidezCorrenteFilter.max !== undefined ? `≤ ${params.liquidezCorrenteFilter.max.toFixed(2)}` : ''}`);
    }
    if (params.dividaLiquidaEbitdaFilter?.enabled) {
      endividamentoFilters.push(`• **Dívida Líq./EBITDA**: ${params.dividaLiquidaEbitdaFilter.min !== undefined ? `≥ ${params.dividaLiquidaEbitdaFilter.min.toFixed(2)}x` : ''}${params.dividaLiquidaEbitdaFilter.min !== undefined && params.dividaLiquidaEbitdaFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaEbitdaFilter.max !== undefined ? `≤ ${params.dividaLiquidaEbitdaFilter.max.toFixed(2)}x` : ''}`);
    }
    if (endividamentoFilters.length > 0) {
      sections.push({ title: '**Endividamento & Liquidez**', filters: endividamentoFilters });
    }

    // Market Cap
    if (params.marketCapFilter?.enabled) {
      const marketCapFilters: string[] = [];
      marketCapFilters.push(`• **Market Cap**: ${params.marketCapFilter.min !== undefined ? `≥ R$ ${(params.marketCapFilter.min / 1_000_000_000).toFixed(2)}bi` : ''}${params.marketCapFilter.min !== undefined && params.marketCapFilter.max !== undefined ? ' e ' : ''}${params.marketCapFilter.max !== undefined ? `≤ R$ ${(params.marketCapFilter.max / 1_000_000_000).toFixed(2)}bi` : ''}`);
      sections.push({ title: '**Tamanho**', filters: marketCapFilters });
    }
    
    // Score Geral e Graham Upside
    const advancedFilters: string[] = [];
    if (params.overallScoreFilter?.enabled) {
      advancedFilters.push(`• **Score Geral**: ${params.overallScoreFilter.min !== undefined ? `≥ ${params.overallScoreFilter.min.toFixed(0)}` : ''}${params.overallScoreFilter.min !== undefined && params.overallScoreFilter.max !== undefined ? ' e ' : ''}${params.overallScoreFilter.max !== undefined ? `≤ ${params.overallScoreFilter.max.toFixed(0)}` : ''}`);
    }
    if (params.grahamUpsideFilter?.enabled) {
      advancedFilters.push(`• **Potencial Graham**: ${params.grahamUpsideFilter.min !== undefined ? `≥ ${params.grahamUpsideFilter.min.toFixed(0)}%` : ''}${params.grahamUpsideFilter.min !== undefined && params.grahamUpsideFilter.max !== undefined ? ' e ' : ''}${params.grahamUpsideFilter.max !== undefined ? `≤ ${params.grahamUpsideFilter.max.toFixed(0)}%` : ''}`);
    }
    if (advancedFilters.length > 0) {
      sections.push({ title: '**Desconto e qualidade**', filters: advancedFilters });
    }

    // Modelos e sinais (Bazin, Lynch, queda com fundamentos intactos)
    const signalFilters: string[] = [];
    if (params.bazinDiscountFilter?.enabled) {
      signalFilters.push(`• **Desconto vs. preço-teto Bazin** (DY alvo de ${formatPct(resolveTargetYield(params.bazinTargetYield ?? BAZIN_DEFAULTS.targetDividendYield))}): ${rangeText(params.bazinDiscountFilter, (v) => formatPct(v))}`);
    }
    if (params.pegFilter?.enabled) {
      signalFilters.push(`• **PEG (Peter Lynch)**: ${rangeText(params.pegFilter, (v) => formatNumber(v, { digits: 2 }))}; fora do modelo (financeiras, cíclicas, prejuízo ou crescimento ≤ 0) não entra`);
    }
    if (params.dipWithIntactFundamentals) {
      signalFilters.push('• **Queda com fundamentos intactos**: preço abaixo da MM200 ou ≥ 20% abaixo da máxima de 52 semanas, sem piora relevante de lucro, ROE, margem e endividamento nos últimos 12 meses');
    }
    if (signalFilters.length > 0) {
      sections.push({ title: '**Modelos e sinais**', filters: signalFilters });
    }
    
    // Setores e Indústrias
    const sectorFilters: string[] = [];
    if (params.selectedSectors && params.selectedSectors.length > 0) {
      sectorFilters.push(`• **Setores**: ${params.selectedSectors.join(', ')}`);
    }
    if (params.selectedIndustries && params.selectedIndustries.length > 0) {
      sectorFilters.push(`• **Indústrias**: ${params.selectedIndustries.join(', ')}`);
    }
    if (sectorFilters.length > 0) {
      sections.push({ title: '**Filtro Setorial**', filters: sectorFilters });
    }

    // Adicionar seções ao rational
    sections.forEach(section => {
      rational += `${section.title}\n`;
      section.filters.forEach(filter => {
        rational += `${filter}\n`;
      });
      rational += '\n';
    });

    rational += `**Ordenação**: empresas que atendem a todos os critérios, ordenadas por valor de mercado${params.useTechnicalAnalysis ? ', com ativos em sobrevenda primeiro' : ''}.

Filtros quantitativos sobre dados públicos. Não é recomendação de investimento.`;

    return rational;
  }

  /**
   * Ordenação customizada para rotas de marketing
   * Garante que os melhores resultados apareçam primeiro
   */
  private customSort(a: RankBuilderResult, b: RankBuilderResult, sortBy: string): number {
    const [field, direction] = sortBy.split('_');
    const isAsc = direction === 'asc';
    
    let aValue: number | null = null;
    let bValue: number | null = null;
    
    switch (field) {
      case 'pl':
        // Menor P/L primeiro (mais barato)
        aValue = a.key_metrics?.pl as number ?? null;
        bValue = b.key_metrics?.pl as number ?? null;
        break;
      case 'dy':
        // Maior DY primeiro (maior yield)
        aValue = a.key_metrics?.dy as number ?? null;
        bValue = b.key_metrics?.dy as number ?? null;
        break;
      case 'cagr':
        // Maior CAGR primeiro (maior crescimento)
        aValue = a.key_metrics?.cagrReceitas as number ?? null;
        bValue = b.key_metrics?.cagrReceitas as number ?? null;
        break;
      case 'drawdown':
        // Maior queda desde a máxima de 52 semanas primeiro (drawdown_asc)
        aValue = a.key_metrics?.drawdown52w ?? null;
        bValue = b.key_metrics?.drawdown52w ?? null;
        break;
      case 'upside':
        // Maior Upside primeiro (maior potencial)
        aValue = a.upside ?? null;
        bValue = b.upside ?? null;
        break;
      case 'magic':
        // Maior score da fórmula mágica primeiro
        // Nota: Esta ordenação será aplicada quando usar modelo magicFormula
        return 0; // Fallback para ordenação padrão
      default:
        return 0; // Sem ordenação customizada, usar padrão
    }
    
    // Tratar valores nulos (colocar no final)
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1; // a vai para o final
    if (bValue === null) return -1; // b vai para o final
    
    // Aplicar ordenação
    if (isAsc) {
      return aValue - bValue; // Crescente
    } else {
      return bValue - aValue; // Decrescente
    }
  }

  validateCompanyData(companyData: CompanyData): boolean {
    // Screening precisa de pelo menos market cap
    const marketCap = toNumber(companyData.financials.marketCap);
    return marketCap !== null && marketCap > 0;
  }
}
