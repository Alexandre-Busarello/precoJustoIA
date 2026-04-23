import { toNumber } from '@/lib/strategies/base-strategy';
import type { CompanyData } from '@/lib/strategies/types';

/** Mesma meta da análise estratégica do FII (`FiiStrategicAnalysis`). */
export const FII_LISTING_TARGET_DY = 0.08;

export type FiiListingUpsideSource = 'dy_teto' | 'valor_patrimonial';

export interface FiiListingValuation {
  fairValue: number | null;
  upside: number | null;
  upsideSource: FiiListingUpsideSource | null;
  /** Último dividendo / DY alvo, quando calculável */
  precoTetoDY: number | null;
}

function latestDividendAmount(c: CompanyData): number | null {
  const fromFiiData = toNumber(
    (c.financials as { fiiLastDividendValue?: unknown }).fiiLastDividendValue
  );
  if (fromFiiData !== null && fromFiiData > 0) return fromFiiData;
  const fromCompany = toNumber(c.ultimoDividendo);
  if (fromCompany !== null && fromCompany > 0) return fromCompany;
  const fromFinancials = toNumber((c.financials as { ultimoDividendo?: unknown }).ultimoDividendo);
  if (fromFinancials !== null && fromFinancials > 0) return fromFinancials;
  if (c.dividendHistory?.length) {
    const sorted = [...c.dividendHistory].sort(
      (a, b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime()
    );
    const amt = toNumber(sorted[0]?.amount);
    if (amt !== null && amt > 0) return amt;
  }
  return null;
}

/**
 * Referência de preço e upside para listagens (ranking/screening/quick ranker).
 * 1) Preço teto por DY alvo (último dividendo / meta DY) — mesmo conceito da página do FII.
 * 2) Se não houver dividendo: upside vs valor patrimonial por cota (VPA ou cotação/P/VP).
 */
export function computeFiiListingValuation(
  companyData: CompanyData,
  options?: { targetDY?: number }
): FiiListingValuation {
  const targetDY = options?.targetDY ?? FII_LISTING_TARGET_DY;
  const cot =
    toNumber(companyData.financials.fiiCotacao) ?? companyData.currentPrice;
  if (cot === null || cot <= 0) {
    return { fairValue: null, upside: null, upsideSource: null, precoTetoDY: null };
  }

  const lastDiv = latestDividendAmount(companyData);
  const dy = toNumber(companyData.financials.dy);
  const precoTetoFromPayment =
    lastDiv !== null && lastDiv > 0 && targetDY > 0 ? lastDiv / targetDY : null;
  /** Renda anual implícita (DY × cota) / meta DY — robusto quando o histórico traz só provento mensal. */
  const precoTetoFromYield =
    dy !== null && dy > 0 && targetDY > 0 && cot > 0 ? (cot * dy) / targetDY : null;

  let precoTeto: number | null = null;
  if (precoTetoFromPayment !== null && precoTetoFromYield !== null) {
    if (precoTetoFromPayment < precoTetoFromYield * 0.55) {
      precoTeto = precoTetoFromYield;
    } else {
      precoTeto = precoTetoFromPayment;
    }
  } else {
    precoTeto = precoTetoFromPayment ?? precoTetoFromYield;
  }

  const vpa = toNumber(companyData.financials.vpa);
  const pvp = toNumber(companyData.financials.pvp);
  let vpPar: number | null = null;
  if (vpa !== null && vpa > 0) {
    vpPar = vpa;
  } else if (pvp !== null && pvp > 0) {
    vpPar = cot / pvp;
  }

  if (precoTeto !== null && precoTeto > 0) {
    const upside = ((precoTeto - cot) / cot) * 100;
    return {
      fairValue: precoTeto,
      upside,
      upsideSource: 'dy_teto',
      precoTetoDY: precoTeto,
    };
  }

  if (vpPar !== null && vpPar > 0) {
    const upside = ((vpPar - cot) / cot) * 100;
    return {
      fairValue: vpPar,
      upside,
      upsideSource: 'valor_patrimonial',
      precoTetoDY: null,
    };
  }

  return { fairValue: null, upside: null, upsideSource: null, precoTetoDY: null };
}

export function fiiListingFairValueModelLabel(
  source: FiiListingUpsideSource | null
): string | null {
  if (source === 'dy_teto') return 'Teto DY 8% a.a.';
  if (source === 'valor_patrimonial') return 'Valor patrimonial (VP)';
  return null;
}
