import { annualizeFromLast12, toDividendEvents } from '@/lib/finance/dividends';
import { getMacroAssumptionsSync, MACRO_FALLBACK, type MacroAssumptions } from '@/lib/finance/macro';
import { ceilingPrice } from '@/lib/finance/valuation';
import { formatNumber, formatPct } from '@/lib/format';
import { toNumber } from '@/lib/strategies/base-strategy';
import type { CompanyData } from '@/lib/strategies/types';

/** Spread sobre a NTN-B (fração a.a.) no DY-alvo: tijolo 2,5 pp, papel 2 pp e 2,5 pp quando o tipo é desconhecido. */
export const FII_TARGET_SPREADS = { tijolo: 0.025, papel: 0.02, default: 0.025 } as const;

export type FiiKind = keyof typeof FII_TARGET_SPREADS;

type TargetMacro = Pick<MacroAssumptions, 'ntnbRealLong' | 'ipcaExpected' | 'asOf'>;

export interface FiiTargetDY {
  /** DY-alvo (fração a.a.) = NTN-B real longa + IPCA esperado + spread. */
  value: number;
  ntnbRealLong: number;
  ipcaExpected: number;
  spread: number;
  /** Data mais recente das premissas macro (YYYY-MM-DD). */
  asOf: string;
}

/** DY-alvo do FII a partir das premissas macro: `NTN-B real + IPCA esperado + spread`. */
export function fiiTargetDY(kind: FiiKind = 'default', macro: TargetMacro = getMacroAssumptionsSync()): FiiTargetDY {
  const spread = FII_TARGET_SPREADS[kind];
  return {
    value: macro.ntnbRealLong + macro.ipcaExpected + spread,
    ntnbRealLong: macro.ntnbRealLong,
    ipcaExpected: macro.ipcaExpected,
    spread,
    asOf: macro.asOf,
  };
}

/**
 * DY-alvo de referência (premissas macro de fallback, tipo de fundo desconhecido).
 * Para exibir o DY-alvo de um fundo, use `FiiListingValuation.targetDY`, que segue as premissas vigentes.
 */
export const FII_LISTING_TARGET_DY = fiiTargetDY('default', MACRO_FALLBACK).value;

export type FiiListingUpsideSource = 'dy_teto' | 'valor_patrimonial';

export interface FiiListingValuation {
  fairValue: number | null;
  /** Potencial em % (25 = 25%), como nas demais estratégias. */
  upside: number | null;
  upsideSource: FiiListingUpsideSource | null;
  /** Rendimento anual por cota / DY-alvo, quando calculável. */
  precoTetoDY: number | null;
  /** DY-alvo usado no preço-teto e as premissas dele. */
  targetDY: FiiTargetDY;
  /** Rendimento anual por cota usado no preço-teto (BRL). */
  annualIncome: number | null;
  /** Origem do rendimento anual: últimos 12 rendimentos ou DY de 12 meses × cotação. */
  annualIncomeSource: 'historico_12m' | 'dy_12m' | null;
}

/** O histórico só vale se o último rendimento tiver data-com nos últimos ~13 meses (fundo que parou de pagar não conta). */
const MAX_HISTORY_STALENESS_DAYS = 400;

function annualIncomeFromHistory(c: CompanyData, asOf: Date): number | null {
  if (!c.dividendHistory?.length) return null;
  const events = toDividendEvents(c.dividendHistory);
  if (events.length === 0) return null;
  const latest = Math.max(...events.map((e) => e.exDate.getTime()));
  if (asOf.getTime() - latest > MAX_HISTORY_STALENESS_DAYS * 86_400_000) return null;
  return annualizeFromLast12(events);
}

function fiiKind(c: CompanyData, isPapel: boolean | null | undefined): FiiKind {
  const flag = isPapel ?? c.financials.fiiIsPapel;
  if (flag === undefined || flag === null) return 'default';
  return flag ? 'papel' : 'tijolo';
}

/**
 * Referência de preço e potencial para a página do FII e as listagens (ranking/screening/quick ranker).
 * 1) Preço-teto = rendimento anual por cota / DY-alvo. O rendimento anual vem dos últimos 12 rendimentos
 *    (`annualizeFromLast12`) ou, sem histórico, do DY de 12 meses × cotação.
 * 2) Sem rendimento: potencial vs valor patrimonial por cota (VPA ou cotação/P/VP).
 */
export function computeFiiListingValuation(
  companyData: CompanyData,
  options?: {
    /** DY-alvo fixo (fração). Sem ele, usa NTN-B + IPCA esperado + spread do tipo do fundo. */
    targetDY?: number;
    /** Tipo do fundo; sem ele, usa `financials.fiiIsPapel` (ou o spread padrão quando desconhecido). */
    isPapel?: boolean | null;
    /** Premissas macro; padrão: snapshot síncrono (`getMacroAssumptionsSync`). */
    macro?: TargetMacro;
    /** Data de referência para validar o histórico; padrão: agora. */
    asOf?: Date;
  }
): FiiListingValuation {
  const computedTarget = fiiTargetDY(fiiKind(companyData, options?.isPapel), options?.macro);
  const targetDY: FiiTargetDY =
    options?.targetDY !== undefined ? { ...computedTarget, value: options.targetDY } : computedTarget;
  const empty: FiiListingValuation = {
    fairValue: null,
    upside: null,
    upsideSource: null,
    precoTetoDY: null,
    targetDY,
    annualIncome: null,
    annualIncomeSource: null,
  };

  const cot = toNumber(companyData.financials.fiiCotacao) ?? companyData.currentPrice;
  if (cot === null || !Number.isFinite(cot) || cot <= 0) return empty;

  const fromHistory = annualIncomeFromHistory(companyData, options?.asOf ?? new Date());
  const dy = toNumber(companyData.financials.dy);
  const fromYield = dy !== null && Number.isFinite(dy) && dy > 0 ? cot * dy : null;
  const annualIncome = fromHistory ?? fromYield;
  const annualIncomeSource = fromHistory !== null ? 'historico_12m' : fromYield !== null ? 'dy_12m' : null;

  const precoTeto = ceilingPrice(annualIncome, targetDY.value);
  if (precoTeto !== null) {
    return {
      fairValue: precoTeto,
      upside: ((precoTeto - cot) / cot) * 100,
      upsideSource: 'dy_teto',
      precoTetoDY: precoTeto,
      targetDY,
      annualIncome,
      annualIncomeSource,
    };
  }

  const vpa = toNumber(companyData.financials.vpa);
  const pvp = toNumber(companyData.financials.pvp);
  const vpPar = vpa !== null && vpa > 0 ? vpa : pvp !== null && pvp > 0 ? cot / pvp : null;
  if (vpPar !== null) {
    return { ...empty, fairValue: vpPar, upside: ((vpPar - cot) / cot) * 100, upsideSource: 'valor_patrimonial' };
  }

  return empty;
}

/** Premissas do DY-alvo em uma linha: "NTN-B 7,7% + IPCA esperado 4,0% + spread de 2,5 pp". */
export function fiiTargetDYAssumptions(target: FiiTargetDY): string {
  return `NTN-B ${formatPct(target.ntnbRealLong)} + IPCA esperado ${formatPct(target.ipcaExpected)} + spread de ${formatNumber(target.spread * 100, { digits: 1 })} pp`;
}

export function fiiListingFairValueModelLabel(
  source: FiiListingUpsideSource | null,
  targetDY: number = FII_LISTING_TARGET_DY
): string | null {
  if (source === 'dy_teto') return `Teto DY ${formatPct(targetDY)} a.a.`;
  if (source === 'valor_patrimonial') return 'Valor patrimonial (VP)';
  return null;
}
