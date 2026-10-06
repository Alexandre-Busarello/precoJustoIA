import { toNumber } from './base-strategy';

/** Tickers que não devem receber PJ-FII Score */
export const FII_UNAVAILABLE_TICKERS = new Set(['MALL11']);

export type FiiGrade =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D'
  | 'F';

export interface PillarScore {
  score: number;
  weight: number;
  reasons: string[];
  /** Nome exibido do pilar (ver `FII_PILLAR_LABELS`). */
  label: string;
}

export type FiiPillarKey = 'dividendos' | 'valuation' | 'qualidadePortfolio' | 'liquidez' | 'gestao';

/**
 * Nomes exibidos dos pilares. A chave `gestao` foi mantida por compatibilidade, mas o pilar mede segmento e
 * resiliência do fundo, não a qualidade da gestão.
 */
export const FII_PILLAR_LABELS: Record<FiiPillarKey, string> = {
  dividendos: 'Dividendos',
  valuation: 'Valuation',
  qualidadePortfolio: 'Qualidade do portfólio',
  liquidez: 'Liquidez',
  gestao: 'Segmento e resiliência',
};

export type FiiQualityLabel = 'Qualidade alta' | 'Qualidade boa' | 'Qualidade moderada' | 'Qualidade baixa';

export interface FiiOverallScore {
  score: number;
  grade: FiiGrade;
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Péssimo';
  /** Mantido por compatibilidade: mesmo valor de `qualityLabel` (nota de qualidade, não recomendação). */
  recommendation: FiiQualityLabel;
  qualityLabel: FiiQualityLabel;
  strengths: string[];
  weaknesses: string[];
  breakdown: {
    dividendos: PillarScore;
    valuation: PillarScore;
    qualidadePortfolio: PillarScore;
    liquidez: PillarScore;
    gestao: PillarScore;
  };
  flags?: string[];
}

export interface FiiScoreInput {
  ticker: string;
  cotacao?: unknown;
  dividendYield?: unknown;
  pvp?: unknown;
  ffoYield?: unknown;
  capRate?: unknown;
  valorPatrimonial?: unknown;
  liquidez?: unknown;
  valorMercado?: unknown;
  qtdImoveis?: unknown;
  vacanciaMedia?: unknown;
  precoM2?: unknown;
  aluguelM2?: unknown;
  segment?: string | null;
  isPapel?: boolean | null;
  patrimonioLiquido?: unknown;
  lastFetchedAt?: Date | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Faixas de DY (em % a.a.) com nota máxima. Papel distribui a correção dos CRIs (IPCA/CDI + spread), então
 * 13–15% é normal com a Selic alta; tijolo distribui aluguel e fica tipicamente entre 8% e 12%.
 */
const DY_BANDS = {
  tijolo: { floor: 4, full: 8, ceiling: 12 },
  papel: { floor: 5, full: 10, ceiling: 15 },
} as const;

function scoreDY(dy: number | null, isPapel: boolean): number {
  if (dy === null || dy <= 0) return 0;
  const { floor, full, ceiling } = DY_BANDS[isPapel ? 'papel' : 'tijolo'];
  const pct = dy * 100;
  if (pct <= floor) return 25 + (pct / floor) * 25;
  if (pct <= full) return 50 + ((pct - floor) / (full - floor)) * 50;
  if (pct <= ceiling) return 100;
  // DY muito acima da faixa sugere risco (cota descontada por crédito ou vacância): perde nota gradualmente.
  if (pct <= ceiling + 4) return 100 - ((pct - ceiling) / 4) * 30;
  return clamp(70 - (pct - ceiling - 4) * 5, 10, 70);
}

function dividendConsistencyScore(monthsWithPayments: number): number {
  if (monthsWithPayments >= 12) return 100;
  if (monthsWithPayments >= 9) return 75;
  if (monthsWithPayments >= 6) return 50;
  return 25;
}

function cvStabilityScore(cv: number | null): number {
  if (cv === null) return 50;
  if (cv < 0.1) return 100;
  if (cv < 0.25) return 70;
  if (cv < 0.5) return 40;
  return 10;
}

function payoutFfoScore(payout: number | null): number {
  if (payout === null) return 60;
  if (payout >= 0.85 && payout <= 1.0) return 100;
  if (payout >= 0.7 && payout < 0.85) return 80;
  if (payout > 1.1) return 30;
  return 70;
}

function scorePvpBands(pvp: number | null): number {
  if (pvp === null) return 50;
  if (pvp < 0.75) return 70;
  if (pvp < 0.85) return 85;
  if (pvp <= 1.05) return 100;
  if (pvp <= 1.2) return 70;
  if (pvp <= 1.5) return 40;
  return 10;
}

function scoreCapOrFfo(rate: number | null): number {
  if (rate === null) return 50;
  const x = rate;
  if (x >= 0.08 && x <= 0.12) return 100;
  if (x >= 0.06 && x < 0.08) return 75;
  if (x >= 0.04 && x < 0.06) return 50;
  if (x < 0.04) return 20;
  return 80;
}

function scoreGapCotacaoVp(
  cotacao: number | null,
  vp: number | null
): number {
  if (!cotacao || !vp || vp <= 0) return 60;
  const gap = (cotacao - vp) / vp;
  if (gap <= 0 && gap >= -0.15) return 100;
  if (gap < -0.15 && gap >= -0.3) return 75;
  if (gap > 0) return 55;
  return 40;
}

/** Resiliência do segmento (chave `gestao`): logística, shopping e lajes corporativas pontuam mais. */
function segmentResilienceScore(segment: string | null | undefined): number {
  const s = (segment || '').toLowerCase();
  if (/shopping|log[ií]stica|lajes|escrit[oó]rio aaa|multi/i.test(s)) return 95;
  if (/hospital|varejo/i.test(s)) return 75;
  if (/residencial|hotel/i.test(s)) return 65;
  if (/desenvolvimento|outros/i.test(s)) return 45;
  return 70;
}

function segmentPapelQuality(segment: string | null | undefined): number {
  const s = (segment || '').toLowerCase();
  if (/high\s*grade|cri/i.test(s)) return 100;
  if (/multi/i.test(s)) return 80;
  if (/high\s*yield|hy/i.test(s)) return 60;
  return 60;
}

function scoreLiquidityBucket(liq: number | null): number {
  if (liq === null) return 20;
  if (liq < 100_000) return 10;
  if (liq < 500_000) return 35;
  if (liq < 1_000_000) return 55;
  if (liq < 5_000_000) return 80;
  return 100;
}

function scoreValorMercado(vm: number | null): number {
  if (vm === null) return 40;
  if (vm < 100_000_000) return 20;
  if (vm < 500_000_000) return 55;
  if (vm < 1_000_000_000) return 80;
  return 100;
}

function gradeFromScore(score: number): {
  grade: FiiGrade;
  classification: FiiOverallScore['classification'];
  qualityLabel: FiiQualityLabel;
} {
  if (score >= 85) return { grade: 'A+', classification: 'Excelente', qualityLabel: 'Qualidade alta' };
  if (score >= 75) return { grade: 'A', classification: 'Muito Bom', qualityLabel: 'Qualidade alta' };
  if (score >= 70) return { grade: 'A-', classification: 'Muito Bom', qualityLabel: 'Qualidade boa' };
  if (score >= 65) return { grade: 'B+', classification: 'Bom', qualityLabel: 'Qualidade boa' };
  if (score >= 55) return { grade: 'B', classification: 'Regular', qualityLabel: 'Qualidade moderada' };
  if (score >= 45) return { grade: 'C', classification: 'Fraco', qualityLabel: 'Qualidade baixa' };
  if (score >= 35) return { grade: 'D', classification: 'Péssimo', qualityLabel: 'Qualidade baixa' };
  return { grade: 'F', classification: 'Péssimo', qualityLabel: 'Qualidade baixa' };
}

function pillar(key: FiiPillarKey, score: number, weight: number, reasons: string[] = []): PillarScore {
  return { score, weight, reasons, label: FII_PILLAR_LABELS[key] };
}

export function calculateFiiOverallScore(
  fii: FiiScoreInput,
  dividendPayments?: { amount: unknown; exDate: Date }[]
): FiiOverallScore | null {
  const ticker = fii.ticker?.toUpperCase() || '';
  if (FII_UNAVAILABLE_TICKERS.has(ticker)) return null;

  const cotacao = toNumber(fii.cotacao);
  const dy = toNumber(fii.dividendYield);
  const pvp = toNumber(fii.pvp);
  const ffoYield = toNumber(fii.ffoYield);
  const capRate = toNumber(fii.capRate);
  const vp = toNumber(fii.valorPatrimonial);
  const liq = toNumber(fii.liquidez);
  const vm = toNumber(fii.valorMercado);
  const qtd = toNumber(fii.qtdImoveis);
  const vac = toNumber(fii.vacanciaMedia);
  const precoM2 = toNumber(fii.precoM2);
  const aluguelM2 = toNumber(fii.aluguelM2);
  const isPapel = !!fii.isPapel;

  if (cotacao !== null && cotacao <= 0) {
    return {
      score: 0,
      grade: 'F',
      classification: 'Péssimo',
      recommendation: 'Qualidade baixa',
      qualityLabel: 'Qualidade baixa',
      strengths: [],
      weaknesses: ['Sem cotação válida ou fundo deslistado.'],
      breakdown: {
        dividendos: pillar('dividendos', 0, 0.3),
        valuation: pillar('valuation', 0, 0.25),
        qualidadePortfolio: pillar('qualidadePortfolio', 0, 0.2),
        liquidez: pillar('liquidez', 0, 0.15),
        gestao: pillar('gestao', 0, 0.1),
      },
      flags: ['Sem cotação'],
    };
  }

  const wDiv = isPapel ? 0.35 : 0.3;
  const wVal = 0.25;
  const wQual = isPapel ? 0.15 : 0.2;
  const wLiq = 0.15;
  const wGest = 0.1;

  // --- Dividendos ---
  const dyPart = scoreDY(dy, isPapel);
  const payments = dividendPayments || [];
  const last12 = new Set(
    payments.slice(0, 24).map((p) => {
      const d = new Date(p.exDate);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  );
  const monthsCount = last12.size;
  const cons = dividendConsistencyScore(Math.min(monthsCount, 12));
  const amounts = payments
    .slice(0, 12)
    .map((p) => toNumber(p.amount))
    .filter((n): n is number => n !== null && n > 0);
  let cv: number | null = null;
  if (amounts.length >= 2) {
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance =
      amounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / amounts.length;
    const std = Math.sqrt(variance);
    cv = mean > 0 ? std / mean : null;
  }
  const stab = cvStabilityScore(cv);
  let payout: number | null = null;
  if (dy !== null && ffoYield !== null && ffoYield > 0) {
    payout = dy / ffoYield;
  }
  const payoutPart = payoutFfoScore(payout);

  let divSub = dyPart * 0.4 + cons * 0.3 + stab * 0.2 + payoutPart * 0.1;
  const divReasons: string[] = [];
  if (dy !== null && dy > 0.14 && pvp !== null && pvp < 0.85 && vac !== null && vac > 0.12) {
    divSub *= 0.8;
    divReasons.push('Alerta: possível armadilha de dividendo (DY alto + P/VP baixo + vacância).');
  }
  const dividendos = pillar('dividendos', clamp(divSub, 0, 100), wDiv, divReasons);

  // --- Valuation ---
  const valPvp = scorePvpBands(pvp);
  const valFlow = scoreCapOrFfo(isPapel ? ffoYield : capRate);
  const valGap = scoreGapCotacaoVp(cotacao, vp);
  const valuation = pillar('valuation', clamp(valPvp * 0.5 + valFlow * 0.3 + valGap * 0.2, 0, 100), wVal);

  // --- Qualidade portfólio ---
  let qualScore = 50;
  const qualReasons: string[] = [];
  if (!isPapel) {
    const qn = qtd ?? 0;
    let divScore = 10;
    if (qn >= 20) divScore = 100;
    else if (qn >= 10) divScore = 85;
    else if (qn >= 5) divScore = 60;
    else if (qn >= 2) divScore = 30;
    let vacScore = 50;
    if (vac !== null) {
      if (vac < 0.05) vacScore = 100;
      else if (vac < 0.1) vacScore = 80;
      else if (vac < 0.15) vacScore = 55;
      else if (vac < 0.2) vacScore = 30;
      else vacScore = 10;
    }
    let impl = 50;
    if (precoM2 && aluguelM2 && precoM2 > 0) {
      const y = (aluguelM2 * 12) / precoM2;
      if (y >= 0.07 && y <= 0.1) impl = 100;
      else if (y >= 0.05 && y < 0.07) impl = 70;
      else impl = 50;
    }
    qualScore = divScore * 0.45 + vacScore * 0.4 + impl * 0.15;
  } else {
    const seg = segmentPapelQuality(fii.segment);
    const gapPapel =
      pvp !== null && pvp >= 0.95 && pvp <= 1.05 ? 100 : pvp !== null && pvp < 0.95 ? 80 : 50;
    qualScore = seg * 0.5 + cons * 0.3 + gapPapel * 0.2;
    qualReasons.push('Portfólio papel: peso em segmento e consistência.');
  }
  const qualidadePortfolio = pillar('qualidadePortfolio', clamp(qualScore, 0, 100), wQual, qualReasons);

  // --- Liquidez ---
  const liqPart = scoreLiquidityBucket(liq);
  const vmPart = scoreValorMercado(vm);
  const porteRel = 60;
  const liquidez = pillar('liquidez', clamp(liqPart * 0.6 + vmPart * 0.3 + porteRel * 0.1, 0, 100), wLiq);

  // --- Segmento e resiliência (chave `gestao`) ---
  const segG = segmentResilienceScore(fii.segment);
  const plHist = 70;
  const idade = fii.lastFetchedAt ? 80 : 60;
  const gestao = pillar('gestao', clamp(segG * 0.5 + plHist * 0.3 + idade * 0.2, 0, 100), wGest);

  let total =
    dividendos.score * wDiv +
    valuation.score * wVal +
    qualidadePortfolio.score * wQual +
    liquidez.score * wLiq +
    gestao.score * wGest;

  const flags: string[] = [];
  if (dy !== null && dy > 0.18 && pvp !== null && pvp < 0.8 && vac !== null && vac > 0.15) {
    total -= 20;
    flags.push('Possível dividend trap (DY muito alto + P/VP baixo + vacância).');
  }
  if (liq !== null && liq < 100_000) {
    total = Math.min(total, 40);
    flags.push('Liquidez muito baixa — teto de score aplicado.');
  }

  total = clamp(total, 0, 100);
  const { grade, classification, qualityLabel } = gradeFromScore(total);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (dividendos.score >= 70) strengths.push('Pilar de dividendos sólido.');
  else weaknesses.push('Dividendos abaixo do ideal ou inconsistentes.');
  if (valuation.score >= 70) strengths.push('Valuation atrativo ou justo.');
  else weaknesses.push('Valuation exige cautela.');
  if (liquidez.score < 50) weaknesses.push('Liquidez ou porte fracos.');

  return {
    score: Math.round(total * 10) / 10,
    grade,
    classification,
    recommendation: qualityLabel,
    qualityLabel,
    strengths,
    weaknesses,
    breakdown: {
      dividendos,
      valuation,
      qualidadePortfolio,
      liquidez,
      gestao,
    },
    flags: flags.length ? flags : undefined,
  };
}
