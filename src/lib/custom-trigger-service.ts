/**
 * CUSTOM TRIGGER SERVICE
 *
 * Avalia os gatilhos customizados (UserAssetMonitor.triggerConfig) configurados pelos usuários.
 *
 * - `evaluateTriggerConfig(config, context)` é puro: recebe preço, indicadores, proventos e preços justos já carregados
 *   e devolve `{ triggered, message }`. Os critérios são combinados com "OU": basta um ser atingido.
 * - `evaluateTrigger(monitor)` carrega o contexto do banco e chama o avaliador puro (usado pelo cron).
 * - Dado ausente nunca dispara: o critério é ignorado e o motivo vai em `missing`.
 */

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  averageFullYears,
  sumTTM,
  toDividendEvents,
  type DividendEvent,
} from './finance/dividends';
import { marginOfSafety } from './valuation-metrics';
import { formatBRL, formatNumber, formatPct } from './format';
import { formatAlertPct } from '@/app/dashboard/monitoramentos-customizados/monitor-fields';

/** Modelos com preço justo salvo no snapshot (`AssetSnapshot.snapshotData.strategies[modelo].fairValue`). */
export const FAIR_VALUE_MODELS = ['graham', 'fcd', 'gordon', 'barsi', 'bazin', 'lynch', 'bankPvp'] as const;
export type FairValueModel = (typeof FAIR_VALUE_MODELS)[number];

export const FAIR_VALUE_MODEL_LABEL: Record<FairValueModel, string> = {
  graham: 'Graham',
  fcd: 'Fluxo de caixa descontado',
  gordon: 'Gordon',
  barsi: 'Barsi',
  bazin: 'Bazin',
  lynch: 'Peter Lynch',
  bankPvp: 'P/VP justo (bancos)',
};

/** DY-alvo padrão do método Bazin (6% ao ano). */
export const DEFAULT_BAZIN_TARGET_YIELD = 0.06;
/** Anos-calendário completos usados na média de proventos do preço-teto Bazin. */
export const BAZIN_FULL_YEARS = 5;

/** Preço ≤ preço-teto Bazin (média de proventos dos 5 anos completos ÷ DY-alvo). */
export interface BazinCeilingTrigger {
  /** DY-alvo em fração (0,06 = 6%). */
  targetYield: number;
}

/** Desconto (margem de segurança = 1 − preço/preço justo) ≥ `minDiscount` no modelo escolhido. */
export interface FairValueDiscountTrigger {
  model: FairValueModel;
  /** Desconto mínimo em fração (0,2 = 20%). */
  minDiscount: number;
}

/** Dividend yield dos últimos 12 meses (soma dos proventos com data-com em 12 meses ÷ preço) ≥ `minDy`. */
export interface DyTtmTrigger {
  /** DY mínimo em fração (0,08 = 8%). */
  minDy: number;
}

export interface TriggerConfig {
  // Filtros de screening básicos
  minPl?: number;
  maxPl?: number;
  minPvp?: number;
  maxPvp?: number;
  minScore?: number;
  maxScore?: number;
  // Alertas de preço
  priceReached?: number; // Preço atingiu X
  priceBelow?: number; // Preço abaixo de X
  priceAbove?: number; // Preço acima de X
  
  // Indicadores que oscilam com preço (ratios de preço)
  minForwardPE?: number;
  maxForwardPE?: number;
  minEarningsYield?: number;
  maxEarningsYield?: number;
  minDy?: number; // Dividend Yield
  maxDy?: number;
  minEvEbitda?: number;
  maxEvEbitda?: number;
  minEvEbit?: number;
  maxEvEbit?: number;
  minEvRevenue?: number;
  maxEvRevenue?: number;
  minPsr?: number; // P/S
  maxPsr?: number;
  minPAtivos?: number;
  maxPAtivos?: number;
  minPCapGiro?: number;
  maxPCapGiro?: number;
  minPEbit?: number;
  maxPEbit?: number;
  minLpa?: number; // LPA
  maxLpa?: number;
  minTrailingEps?: number;
  maxTrailingEps?: number;
  minVpa?: number; // VPA
  maxVpa?: number;
  minReceitaPorAcao?: number;
  maxReceitaPorAcao?: number;
  minCaixaPorAcao?: number;
  maxCaixaPorAcao?: number;
  
  // Indicadores de rentabilidade
  minRoe?: number;
  maxRoe?: number;
  minRoic?: number;
  maxRoic?: number;
  minRoa?: number;
  maxRoa?: number;
  
  // Indicadores de margem
  minMargemBruta?: number;
  maxMargemBruta?: number;
  minMargemEbitda?: number;
  maxMargemEbitda?: number;
  minMargemLiquida?: number;
  maxMargemLiquida?: number;
  
  // Indicadores de liquidez
  minLiquidezCorrente?: number;
  maxLiquidezCorrente?: number;
  minLiquidezRapida?: number;
  maxLiquidezRapida?: number;
  
  // Indicadores de endividamento
  minDividaLiquidaPl?: number;
  maxDividaLiquidaPl?: number;
  minDividaLiquidaEbitda?: number;
  maxDividaLiquidaEbitda?: number;
  minDebtToEquity?: number;
  maxDebtToEquity?: number;
  
  // Indicadores de eficiência
  minGiroAtivos?: number;
  maxGiroAtivos?: number;
  
  // Indicadores de crescimento
  minCagrLucros5a?: number;
  maxCagrLucros5a?: number;
  minCagrReceitas5a?: number;
  maxCagrReceitas5a?: number;
  minCrescimentoLucros?: number;
  maxCrescimentoLucros?: number;
  minCrescimentoReceitas?: number;
  maxCrescimentoReceitas?: number;
  
  // Indicadores de dividendos
  minPayout?: number;
  maxPayout?: number;
  minDividendYield12m?: number;
  maxDividendYield12m?: number;
  
  // Indicadores de performance
  minVariacao52Semanas?: number;
  maxVariacao52Semanas?: number;
  minRetornoAnoAtual?: number;
  maxRetornoAnoAtual?: number;

  // Alertas de valuation e proventos
  bazinCeiling?: BazinCeilingTrigger;
  fairValueDiscount?: FairValueDiscountTrigger;
  dyTtmAbove?: DyTtmTrigger;
}

/** Indicadores numéricos usados pelos filtros min/max (mesmos nomes de `FinancialData`, mais `score`). */
export type IndicatorValues = Record<string, number | undefined>;

/** Tudo o que o avaliador puro precisa. Campos ausentes fazem o critério correspondente ser ignorado. */
export interface TriggerContext {
  price?: number | null;
  indicators?: IndicatorValues;
  /** Proventos (dividendos + JCP brutos) por ação. */
  dividends?: readonly DividendEvent[];
  /** Preço justo por modelo, lido do snapshot mais recente. */
  fairValues?: Partial<Record<FairValueModel, number | null>>;
  /** Data de referência para TTM e anos completos. Padrão: agora. */
  asOf?: Date;
}

export interface TriggerConfigEvaluation {
  triggered: boolean;
  /** Frase pt-BR com os critérios atingidos, ou por que nada disparou. */
  message: string;
  /** Critérios atingidos, um por item. */
  reasons: string[];
  /** Critérios ignorados por falta de dado. */
  missing: string[];
  /** Valores calculados (preço-teto, DY 12m, desconto...) para o relatório. */
  computed: Record<string, number | undefined>;
}

export interface TriggerEvaluation {
  monitorId: string;
  companyId: number;
  ticker: string;
  triggered: boolean;
  reasons: string[];
  companyData: Record<string, number | undefined>;
  /** Configuração avaliada, salva na fila para o relatório explicar cada critério. */
  triggerConfig?: TriggerConfig;
}

const isPositive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const fmtRatio = (v: number) => formatNumber(v, { digits: 2 });
const fmtScore = (v: number) => formatNumber(v, { digits: 1 });
const fmtPct = (v: number) => formatPct(v, { digits: 2 });

type RangeRule = [minKey: keyof TriggerConfig, maxKey: keyof TriggerConfig, indicator: string, label: string, format: (v: number) => string];

/** Filtros min/max: dispara quando o valor atual chega ao mínimo (≥) ou ao máximo (≤) configurado. */
const RANGE_RULES: RangeRule[] = [
  ['minPl', 'maxPl', 'pl', 'P/L', fmtRatio],
  ['minPvp', 'maxPvp', 'pvp', 'P/VP', fmtRatio],
  ['minScore', 'maxScore', 'score', 'Score', fmtScore],
  ['minForwardPE', 'maxForwardPE', 'forwardPE', 'Forward P/L', fmtRatio],
  ['minEarningsYield', 'maxEarningsYield', 'earningsYield', 'Earnings yield', fmtPct],
  ['minDy', 'maxDy', 'dy', 'Dividend yield', fmtPct],
  ['minEvEbitda', 'maxEvEbitda', 'evEbitda', 'EV/EBITDA', fmtRatio],
  ['minEvEbit', 'maxEvEbit', 'evEbit', 'EV/EBIT', fmtRatio],
  ['minEvRevenue', 'maxEvRevenue', 'evRevenue', 'EV/Receita', fmtRatio],
  ['minPsr', 'maxPsr', 'psr', 'P/Receita', fmtRatio],
  ['minPAtivos', 'maxPAtivos', 'pAtivos', 'P/Ativos', fmtRatio],
  ['minPCapGiro', 'maxPCapGiro', 'pCapGiro', 'P/Cap. giro', fmtRatio],
  ['minPEbit', 'maxPEbit', 'pEbit', 'P/EBIT', fmtRatio],
  ['minLpa', 'maxLpa', 'lpa', 'LPA', fmtRatio],
  ['minTrailingEps', 'maxTrailingEps', 'trailingEps', 'LPA (12 meses)', fmtRatio],
  ['minVpa', 'maxVpa', 'vpa', 'VPA', fmtRatio],
  ['minReceitaPorAcao', 'maxReceitaPorAcao', 'receitaPorAcao', 'Receita por ação', fmtRatio],
  ['minCaixaPorAcao', 'maxCaixaPorAcao', 'caixaPorAcao', 'Caixa por ação', fmtRatio],
  ['minRoe', 'maxRoe', 'roe', 'ROE', fmtPct],
  ['minRoic', 'maxRoic', 'roic', 'ROIC', fmtPct],
  ['minRoa', 'maxRoa', 'roa', 'ROA', fmtPct],
  ['minMargemBruta', 'maxMargemBruta', 'margemBruta', 'Margem bruta', fmtPct],
  ['minMargemEbitda', 'maxMargemEbitda', 'margemEbitda', 'Margem EBITDA', fmtPct],
  ['minMargemLiquida', 'maxMargemLiquida', 'margemLiquida', 'Margem líquida', fmtPct],
  ['minLiquidezCorrente', 'maxLiquidezCorrente', 'liquidezCorrente', 'Liquidez corrente', fmtRatio],
  ['minLiquidezRapida', 'maxLiquidezRapida', 'liquidezRapida', 'Liquidez rápida', fmtRatio],
  ['minDividaLiquidaPl', 'maxDividaLiquidaPl', 'dividaLiquidaPl', 'Dívida líquida/PL', fmtRatio],
  ['minDividaLiquidaEbitda', 'maxDividaLiquidaEbitda', 'dividaLiquidaEbitda', 'Dívida líquida/EBITDA', fmtRatio],
  ['minDebtToEquity', 'maxDebtToEquity', 'debtToEquity', 'Dívida/patrimônio', fmtRatio],
  ['minGiroAtivos', 'maxGiroAtivos', 'giroAtivos', 'Giro de ativos', fmtRatio],
  ['minCagrLucros5a', 'maxCagrLucros5a', 'cagrLucros5a', 'CAGR de lucros 5 anos', fmtPct],
  ['minCagrReceitas5a', 'maxCagrReceitas5a', 'cagrReceitas5a', 'CAGR de receitas 5 anos', fmtPct],
  ['minCrescimentoLucros', 'maxCrescimentoLucros', 'crescimentoLucros', 'Crescimento de lucros', fmtPct],
  ['minCrescimentoReceitas', 'maxCrescimentoReceitas', 'crescimentoReceitas', 'Crescimento de receitas', fmtPct],
  ['minPayout', 'maxPayout', 'payout', 'Payout', fmtPct],
  ['minDividendYield12m', 'maxDividendYield12m', 'dividendYield12m', 'Dividend yield 12m', fmtPct],
  ['minVariacao52Semanas', 'maxVariacao52Semanas', 'variacao52Semanas', 'Variação em 52 semanas', fmtPct],
  ['minRetornoAnoAtual', 'maxRetornoAnoAtual', 'retornoAnoAtual', 'Retorno no ano', fmtPct],
];

/** Preço-teto Bazin = média anual de proventos dos anos completos ÷ DY-alvo. `null` sem proventos ou DY-alvo inválido. */
export function bazinCeilingPrice(
  dividends: readonly DividendEvent[],
  targetYield: number,
  asOf: Date = new Date()
): number | null {
  if (!isPositive(targetYield)) return null;
  const average = averageFullYears(dividends, { years: BAZIN_FULL_YEARS, asOf });
  return isPositive(average) ? average / targetYield : null;
}

/**
 * Avaliador puro dos gatilhos. Cada critério configurado é testado de forma independente ("OU").
 * Sem preço, proventos ou preço justo, o critério correspondente não dispara e o motivo vai em `missing`.
 */
export function evaluateTriggerConfig(config: TriggerConfig, context: TriggerContext): TriggerConfigEvaluation {
  const reasons: string[] = [];
  const missing: string[] = [];
  const computed: Record<string, number | undefined> = {};
  const indicators = context.indicators ?? {};
  const asOf = context.asOf ?? new Date();
  const price = isPositive(context.price) ? context.price : null;

  for (const [minKey, maxKey, indicator, label, format] of RANGE_RULES) {
    const min = config[minKey] as number | undefined;
    const max = config[maxKey] as number | undefined;
    if (min === undefined && max === undefined) continue;
    const value = indicators[indicator];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      missing.push(`${label}: indicador indisponível`);
      continue;
    }
    if (min !== undefined && value >= min) {
      reasons.push(`${label} (${format(value)}) atingiu o mínimo configurado (${format(min)})`);
    }
    if (max !== undefined && value <= max) {
      reasons.push(`${label} (${format(value)}) atingiu o máximo configurado (${format(max)})`);
    }
  }

  const hasPriceRule =
    config.priceReached !== undefined || config.priceBelow !== undefined || config.priceAbove !== undefined;
  if (hasPriceRule && price === null) missing.push('Preço: cotação indisponível');
  if (price !== null) {
    // "Atingiu" = até 1% de distância do valor configurado
    if (config.priceReached !== undefined && Math.abs(price - config.priceReached) <= config.priceReached * 0.01) {
      reasons.push(`Preço (${formatBRL(price)}) atingiu o valor configurado (${formatBRL(config.priceReached)})`);
    }
    if (config.priceBelow !== undefined && price <= config.priceBelow) {
      reasons.push(`Preço (${formatBRL(price)}) está abaixo do valor configurado (${formatBRL(config.priceBelow)})`);
    }
    if (config.priceAbove !== undefined && price >= config.priceAbove) {
      reasons.push(`Preço (${formatBRL(price)}) está acima do valor configurado (${formatBRL(config.priceAbove)})`);
    }
  }

  if (config.bazinCeiling) {
    const targetYield = config.bazinCeiling.targetYield;
    const ceiling = bazinCeilingPrice(context.dividends ?? [], targetYield, asOf);
    computed.bazinCeiling = ceiling ?? undefined;
    if (ceiling === null) {
      missing.push(`Preço-teto Bazin: sem proventos nos últimos ${BAZIN_FULL_YEARS} anos completos`);
    } else if (price === null) {
      missing.push('Preço-teto Bazin: cotação indisponível');
    } else if (price <= ceiling) {
      reasons.push(
        `Preço (${formatBRL(price)}) está abaixo do preço-teto Bazin (${formatBRL(ceiling)}, DY-alvo ${formatAlertPct(targetYield)})`
      );
    }
  }

  if (config.fairValueDiscount) {
    const { model, minDiscount } = config.fairValueDiscount;
    const label = FAIR_VALUE_MODEL_LABEL[model] ?? model;
    const fair = context.fairValues?.[model];
    if (!isPositive(fair)) {
      missing.push(`Desconto vs ${label}: preço justo indisponível`);
    } else if (price === null) {
      missing.push(`Desconto vs ${label}: cotação indisponível`);
    } else {
      const discount = marginOfSafety(price, fair);
      computed.fairValue = fair;
      computed.discount = discount ?? undefined;
      if (discount !== null && discount >= minDiscount) {
        reasons.push(
          `Preço (${formatBRL(price)}) está ${formatPct(discount)} abaixo do preço justo estimado por ${label} (${formatBRL(fair)}), acima do desconto mínimo de ${formatAlertPct(minDiscount)}`
        );
      }
    }
  }

  if (config.dyTtmAbove) {
    const { minDy } = config.dyTtmAbove;
    const total = sumTTM(context.dividends ?? [], asOf);
    if (total <= 0) {
      missing.push('DY 12 meses: sem proventos nos últimos 12 meses');
    } else if (price === null) {
      missing.push('DY 12 meses: cotação indisponível');
    } else {
      const dy = total / price;
      computed.dyTtm = dy;
      if (dy >= minDy) {
        reasons.push(`Dividend yield 12 meses (${formatPct(dy)}) atingiu o mínimo configurado (${formatAlertPct(minDy)})`);
      }
    }
  }

  const triggered = reasons.length > 0;
  let message: string;
  if (triggered) message = reasons.join('; ');
  else if (missing.length > 0) message = `Nenhum critério atingido. Dados indisponíveis: ${missing.join('; ')}`;
  else message = 'Nenhum critério atingido';

  return { triggered, message, reasons, missing, computed };
}

/** Limite de monitoramentos ativos no plano gratuito. Premium não tem limite. */
export const FREE_MONITOR_LIMIT = 3;

export interface MonitorLimitCheck {
  allowed: boolean;
  current: number;
  /** `null` = sem limite (Premium). */
  max: number | null;
}

/** Pode ativar mais um monitoramento? Gratuito: até `FREE_MONITOR_LIMIT` ativos; Premium: sempre. */
export function checkMonitorLimit(isPremium: boolean, activeCount: number): MonitorLimitCheck {
  const max = isPremium ? null : FREE_MONITOR_LIMIT;
  return { allowed: max === null || activeCount < max, current: activeCount, max };
}

export function monitorLimitMessage(max: number): string {
  return `O plano gratuito permite até ${max} monitoramentos ativos. Pause ou remova um para criar outro, ou veja os planos para ter monitoramentos sem limite.`;
}

const PRICE_KEYS = ['priceReached', 'priceBelow', 'priceAbove'] as const;

/** Schema da configuração (API). Só aceita critérios conhecidos; frações em 0–1 para DY e desconto. */
export const triggerConfigSchema = z
  .object({
    ...Object.fromEntries(PRICE_KEYS.map((key) => [key, z.number().positive('deve ser maior que zero').optional()])),
    ...Object.fromEntries(RANGE_RULES.flatMap(([minKey, maxKey]) => [
      [minKey, z.number().optional()],
      [maxKey, z.number().optional()],
    ])),
    bazinCeiling: z
      .object({ targetYield: z.number().gt(0, 'o DY-alvo deve ser maior que zero').max(1, 'o DY-alvo deve ser até 100%') })
      .strict()
      .optional(),
    fairValueDiscount: z
      .object({
        model: z.enum(FAIR_VALUE_MODELS, 'modelo de preço justo inválido'),
        minDiscount: z.number().gt(0, 'o desconto mínimo deve ser maior que zero').lt(1, 'o desconto mínimo deve ser menor que 100%'),
      })
      .strict()
      .optional(),
    dyTtmAbove: z
      .object({ minDy: z.number().gt(0, 'o DY mínimo deve ser maior que zero').max(1, 'o DY mínimo deve ser até 100%') })
      .strict()
      .optional(),
  })
  .strict();

export type ParseTriggerConfigResult = { success: true; config: TriggerConfig } | { success: false; error: string };

/**
 * Remove critérios de primeiro nível com valor \`null\` (configurações antigas salvavam NaN como null).
 * Critério vazio equivale a critério ausente; qualquer outro valor segue para a validação.
 */
function stripNullCriteria(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== null));
}

/** Valida a configuração vinda da API. Exige ao menos um critério. */
export function parseTriggerConfig(input: unknown): ParseTriggerConfigResult {
  const parsed = triggerConfigSchema.safeParse(stripNullCriteria(input));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join('.');
    const detail =
      issue.code === 'unrecognized_keys'
        ? `critério desconhecido (${issue.keys.join(', ')})`
        : issue.code === 'invalid_type'
          ? issue.expected === 'number'
            ? 'deve ser um número'
            : 'formato inválido'
          : issue.message;
    return { success: false, error: `Critério inválido${path ? ` em ${path}` : ''}: ${detail}` };
  }
  const config = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  ) as TriggerConfig;
  if (Object.keys(config).length === 0) {
    return { success: false, error: 'Defina pelo menos um critério' };
  }
  return { success: true, config };
}

/** Configuração já validada no formato JSON aceito pelo Prisma (`UserAssetMonitor.triggerConfig`). */
export function triggerConfigToJson(config: TriggerConfig): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(config)) as Prisma.InputJsonObject;
}

/**
 * Soma critérios novos a uma configuração já salva: chaves novas substituem as mesmas chaves,
 * as demais são mantidas. Usado quando o usuário cria um alerta para um ativo que já monitora.
 */
export function mergeTriggerConfigs(existing: unknown, incoming: TriggerConfig): TriggerConfig {
  const cleaned = stripNullCriteria(existing);
  const base =
    cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) ? (cleaned as TriggerConfig) : {};
  const merged: TriggerConfig = { ...base };
  for (const [key, value] of Object.entries(incoming) as Array<[keyof TriggerConfig, TriggerConfig[keyof TriggerConfig]]>) {
    if (value !== undefined && value !== null) (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

/** Converte `snapshotData.strategies` em preço justo por modelo, ignorando valores ausentes ou ≤ 0. */
export function fairValuesFromSnapshot(snapshotData: unknown): Partial<Record<FairValueModel, number>> {
  const result: Partial<Record<FairValueModel, number>> = {};
  if (!snapshotData || typeof snapshotData !== 'object') return result;
  const strategies = (snapshotData as { strategies?: unknown }).strategies;
  if (!strategies || typeof strategies !== 'object') return result;
  for (const model of FAIR_VALUE_MODELS) {
    const strategy = (strategies as Record<string, unknown>)[model];
    if (!strategy || typeof strategy !== 'object') continue;
    const fair = Number((strategy as { fairValue?: unknown }).fairValue);
    if (Number.isFinite(fair) && fair > 0) result[model] = fair;
  }
  return result;
}

/**
 * Busca monitores ativos separados por prioridade (Premium primeiro)
 * Ordena por lastProcessedAt (mais antigos primeiro) para garantir loop de processamento
 */
export async function getMonitorsByPriority(): Promise<{
  premium: Array<{
    id: string;
    companyId: number;
    triggerConfig: TriggerConfig;
    company: { ticker: string };
    isAlertActive: boolean;
    lastProcessedAt: Date | null;
  }>;
  free: Array<{
    id: string;
    companyId: number;
    triggerConfig: TriggerConfig;
    company: { ticker: string };
    isAlertActive: boolean;
    lastProcessedAt: Date | null;
  }>;
}> {
  const { isUserPremium } = await import('./user-service');

  const monitors = await prisma.userAssetMonitor.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { lastProcessedAt: { sort: 'asc', nulls: 'first' } }, // Processar os mais antigos primeiro
    ],
    select: {
      id: true,
      companyId: true,
      triggerConfig: true,
      isAlertActive: true,
      lastProcessedAt: true,
      company: {
        select: {
          id: true,
          ticker: true,
        },
      },
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  const premium: typeof monitors = [];
  const free: typeof monitors = [];

  // Separar por status Premium
  for (const monitor of monitors) {
    const userIsPremium = await isUserPremium(monitor.user.id);
    if (userIsPremium) {
      premium.push(monitor);
    } else {
      free.push(monitor);
    }
  }

  return {
    premium: premium.map(m => ({
      id: m.id,
      companyId: m.companyId,
      triggerConfig: m.triggerConfig as TriggerConfig,
      company: m.company,
      isAlertActive: m.isAlertActive ?? false,
      lastProcessedAt: m.lastProcessedAt,
    })),
    free: free.map(m => ({
      id: m.id,
      companyId: m.companyId,
      triggerConfig: m.triggerConfig as TriggerConfig,
      company: m.company,
      isAlertActive: m.isAlertActive ?? false,
      lastProcessedAt: m.lastProcessedAt,
    })),
  };
}

/**
 * Busca todos os monitoramentos ativos e avalia se devem ser disparados
 * @deprecated Use getMonitorsByPriority() para processamento prioritário
 */
export async function checkCustomTriggers(): Promise<TriggerEvaluation[]> {
  const monitors = await prisma.userAssetMonitor.findMany({
    where: {
      isActive: true,
    },
    include: {
      company: {
        select: {
          id: true,
          ticker: true,
        },
      },
    },
  });

  const evaluations: TriggerEvaluation[] = [];

  for (const monitor of monitors) {
    try {
      const evaluation = await evaluateTrigger({
        id: monitor.id,
        companyId: monitor.companyId,
        triggerConfig: monitor.triggerConfig as TriggerConfig,
        company: monitor.company,
      });
      if (evaluation) {
        evaluations.push(evaluation);
      }
    } catch (error) {
      console.error(`Erro ao avaliar gatilho ${monitor.id}:`, error);
      // Continuar com outros monitoramentos mesmo se um falhar
    }
  }

  return evaluations;
}

const INDICATOR_FIELDS = [
  'pl', 'pvp', 'forwardPE', 'earningsYield', 'dy', 'evEbitda', 'evEbit', 'evRevenue', 'psr', 'pAtivos', 'pCapGiro',
  'pEbit', 'lpa', 'trailingEps', 'vpa', 'receitaPorAcao', 'caixaPorAcao', 'roe', 'roic', 'roa', 'margemBruta',
  'margemEbitda', 'margemLiquida', 'liquidezCorrente', 'liquidezRapida', 'dividaLiquidaPl', 'dividaLiquidaEbitda',
  'debtToEquity', 'giroAtivos', 'cagrLucros5a', 'cagrReceitas5a', 'crescimentoLucros', 'crescimentoReceitas', 'payout',
  'dividendYield12m', 'variacao52Semanas', 'retornoAnoAtual',
] as const;

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Carrega do banco o contexto de um monitoramento (indicadores, score, preço justo, proventos e cotação)
 * e avalia os critérios com `evaluateTriggerConfig`. Retorna `null` quando nada disparou.
 *
 * `overrides` substitui partes do contexto (ex.: `{ price }` em testes locais, sem consultar a cotação).
 */
export async function evaluateTrigger(
  monitor: {
    id: string;
    companyId: number;
    triggerConfig: TriggerConfig;
    company: { ticker: string };
  },
  overrides: Partial<TriggerContext> = {}
): Promise<TriggerEvaluation | null> {
  const { triggerConfig, company } = monitor;
  const ticker = company.ticker;
  const needsDividends = !!(triggerConfig.bazinCeiling || triggerConfig.dyTtmAbove);

  const select = Object.fromEntries(INDICATOR_FIELDS.map((field) => [field, true])) as Record<
    (typeof INDICATOR_FIELDS)[number],
    true
  >;

  const [financialData, snapshot, dividendRows] = await Promise.all([
    prisma.financialData.findFirst({
      where: { companyId: monitor.companyId },
      orderBy: { year: 'desc' },
      select,
    }),
    prisma.assetSnapshot.findFirst({
      where: { companyId: monitor.companyId, isLatest: true },
      select: { overallScore: true, snapshotData: true },
    }),
    needsDividends && !overrides.dividends
      ? prisma.dividendHistory.findMany({
          where: {
            companyId: monitor.companyId,
            // Anos completos do Bazin (N−1 … N−5) e a janela de 12 meses
            exDate: { gte: new Date(Date.UTC(new Date().getUTCFullYear() - BAZIN_FULL_YEARS - 1, 0, 1)) },
          },
          select: { exDate: true, paymentDate: true, amount: true, type: true },
          orderBy: { exDate: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  let price = overrides.price;
  if (price === undefined) {
    const { getTickerPrice } = await import('./quote-service');
    price = (await getTickerPrice(ticker))?.price ?? null;
  }

  const indicators: IndicatorValues = {};
  for (const field of INDICATOR_FIELDS) indicators[field] = toNumber(financialData?.[field]);
  indicators.score = toNumber(snapshot?.overallScore);

  const context: TriggerContext = {
    price,
    indicators: { ...indicators, ...overrides.indicators },
    dividends: overrides.dividends ?? toDividendEvents(dividendRows),
    fairValues: overrides.fairValues ?? fairValuesFromSnapshot(snapshot?.snapshotData),
    asOf: overrides.asOf,
  };

  const result = evaluateTriggerConfig(triggerConfig, context);
  if (!result.triggered) return null;

  return {
    monitorId: monitor.id,
    companyId: monitor.companyId,
    ticker,
    triggered: true,
    reasons: result.reasons,
    companyData: { ...context.indicators, ...result.computed, currentPrice: price ?? undefined },
    triggerConfig,
  };
}

/**
 * Cria entrada na fila de relatórios para um gatilho customizado disparado
 */
export async function createQueueEntry(
  monitorId: string,
  evaluation: TriggerEvaluation
): Promise<string> {
  const queueEntry = await prisma.aIReportsQueue.create({
    data: {
      companyId: evaluation.companyId,
      reportType: 'CUSTOM_TRIGGER',
      triggerReason: {
        monitorId,
        reasons: evaluation.reasons,
        companyData: evaluation.companyData,
        ...(evaluation.triggerConfig ? { triggerConfig: triggerConfigToJson(evaluation.triggerConfig) } : {}),
      },
      status: 'PENDING',
      priority: 0,
    },
  });

  // Atualizar lastTriggeredAt e marcar isAlertActive = true do monitoramento
  await prisma.userAssetMonitor.update({
    where: { id: monitorId },
    data: {
      lastTriggeredAt: new Date(),
      isAlertActive: true,
    },
  });

  return queueEntry.id;
}

