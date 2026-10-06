/**
 * Campos do formulário de monitoramento e tipos aceitos em `?type=`.
 * Módulo puro (sem Prisma), usado pelo formulário (client), pelas páginas criar/editar (server) e pelo serviço de gatilhos.
 */

import type { TriggerConfig } from '@/lib/custom-trigger-service';
import { formatPct } from '@/lib/format';

/** Critérios numéricos simples (os alertas de valuation/proventos são objetos e têm campos próprios). */
export type ConfigKey = Exclude<keyof TriggerConfig, 'bazinCeiling' | 'fairValueDiscount' | 'dyTtmAbove'>;

/** `money` em R$, `percent` digitado em % e salvo como fração, `multiple`/`number` como digitado, `integer` sem casas. */
export type FieldKind = 'money' | 'percent' | 'multiple' | 'number' | 'integer';

export interface SingleField {
  key: ConfigKey;
  label: string;
  kind: FieldKind;
  placeholder: string;
}

export interface RangeField {
  label: string;
  min: ConfigKey;
  max: ConfigKey;
  kind: FieldKind;
  placeholders: [string, string];
}

export interface RangeGroup {
  title: string;
  fields: RangeField[];
}

export const PRICE_FIELDS: SingleField[] = [
  { key: 'priceBelow', label: 'Preço abaixo de', kind: 'money', placeholder: '30,00' },
  { key: 'priceAbove', label: 'Preço acima de', kind: 'money', placeholder: '100,00' },
  { key: 'priceReached', label: 'Preço atingir', kind: 'money', placeholder: '50,00' },
];

export const BASIC_RANGES: RangeField[] = [
  { label: 'P/L', min: 'minPl', max: 'maxPl', kind: 'multiple', placeholders: ['5', '20'] },
  { label: 'P/VP', min: 'minPvp', max: 'maxPvp', kind: 'multiple', placeholders: ['0,5', '2'] },
  { label: 'Score', min: 'minScore', max: 'maxScore', kind: 'integer', placeholders: ['60', '90'] },
];

export const ADVANCED_GROUPS: RangeGroup[] = [
  {
    title: 'Indicadores que oscilam com o preço',
    fields: [
      { label: 'Forward P/L', min: 'minForwardPE', max: 'maxForwardPE', kind: 'multiple', placeholders: ['5', '20'] },
      { label: 'Earnings yield', min: 'minEarningsYield', max: 'maxEarningsYield', kind: 'percent', placeholders: ['5', '20'] },
      { label: 'Dividend yield', min: 'minDy', max: 'maxDy', kind: 'percent', placeholders: ['5', '15'] },
      { label: 'EV/EBITDA', min: 'minEvEbitda', max: 'maxEvEbitda', kind: 'multiple', placeholders: ['5', '15'] },
      { label: 'P/Receita (PSR)', min: 'minPsr', max: 'maxPsr', kind: 'multiple', placeholders: ['0,5', '5'] },
      { label: 'LPA', min: 'minLpa', max: 'maxLpa', kind: 'money', placeholders: ['1,00', '10,00'] },
      { label: 'VPA', min: 'minVpa', max: 'maxVpa', kind: 'money', placeholders: ['10,00', '50,00'] },
    ],
  },
  {
    title: 'Rentabilidade',
    fields: [
      { label: 'ROE', min: 'minRoe', max: 'maxRoe', kind: 'percent', placeholders: ['15', '50'] },
      { label: 'ROIC', min: 'minRoic', max: 'maxRoic', kind: 'percent', placeholders: ['10', '40'] },
      { label: 'ROA', min: 'minRoa', max: 'maxRoa', kind: 'percent', placeholders: ['5', '20'] },
    ],
  },
  {
    title: 'Margens',
    fields: [
      { label: 'Margem bruta', min: 'minMargemBruta', max: 'maxMargemBruta', kind: 'percent', placeholders: ['20', '80'] },
      { label: 'Margem EBITDA', min: 'minMargemEbitda', max: 'maxMargemEbitda', kind: 'percent', placeholders: ['15', '50'] },
      { label: 'Margem líquida', min: 'minMargemLiquida', max: 'maxMargemLiquida', kind: 'percent', placeholders: ['10', '30'] },
    ],
  },
  {
    title: 'Endividamento',
    fields: [
      { label: 'Dívida líquida/PL', min: 'minDividaLiquidaPl', max: 'maxDividaLiquidaPl', kind: 'number', placeholders: ['0', '1'] },
      { label: 'Dívida/patrimônio', min: 'minDebtToEquity', max: 'maxDebtToEquity', kind: 'number', placeholders: ['0', '1'] },
    ],
  },
  {
    title: 'Crescimento e proventos',
    fields: [
      { label: 'CAGR de lucros 5 anos', min: 'minCagrLucros5a', max: 'maxCagrLucros5a', kind: 'percent', placeholders: ['10', '50'] },
      { label: 'Payout', min: 'minPayout', max: 'maxPayout', kind: 'percent', placeholders: ['20', '80'] },
    ],
  },
];

/** Valores aceitos em `?type=` para abrir o formulário já no alerta certo. */
export const ALERT_TYPES = ['bazin_ceiling', 'fair_value_discount', 'dy_ttm_above'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export function isAlertType(value: string | null | undefined): value is AlertType {
  return !!value && (ALERT_TYPES as readonly string[]).includes(value);
}

const MONITOR_FORM_KEYS = new Set<string>([
  ...PRICE_FIELDS.map((f) => f.key),
  ...[...BASIC_RANGES, ...ADVANCED_GROUPS.flatMap((g) => g.fields)].flatMap((f) => [f.min, f.max]),
]);

/** Campo numérico do formulário (ex.: `maxPl`) aceito em `?type=` para focar o campo certo. */
export function isMonitorFormKey(value: string | null | undefined): value is ConfigKey {
  return !!value && MONITOR_FORM_KEYS.has(value);
}

/** `?type=` que realmente pré-preenche ou foca um critério. Tipos ausentes ou desconhecidos são ignorados. */
export function isPrefillType(value: string | null | undefined): value is AlertType | ConfigKey {
  return isAlertType(value) || isMonitorFormKey(value);
}

/** Percentual de alerta (DY-alvo, desconto, DY mínimo): sem casas quando inteiro ("6%"), uma casa caso contrário ("6,5%"). */
export function formatAlertPct(fraction: number): string {
  const pct = Number((fraction * 100).toFixed(6));
  return formatPct(fraction, { digits: Number.isInteger(pct) ? 0 : 1 });
}
