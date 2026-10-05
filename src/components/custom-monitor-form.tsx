'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssetSearchInput } from '@/components/asset-search-input';
import { MonitorLimitBanner } from '@/components/monitor-limit-banner';
import { formatBRL, formatMultiple, formatNumber, formatPct } from '@/lib/format';
import type { FairValueModel, TriggerConfig } from '@/lib/custom-trigger-service';
import {
  ADVANCED_GROUPS,
  BASIC_RANGES,
  PRICE_FIELDS,
  formatAlertPct,
  isAlertType,
  isMonitorFormKey,
  type AlertType,
  type ConfigKey,
  type FieldKind,
  type RangeField,
} from '@/app/dashboard/monitoramentos-customizados/monitor-fields';

/** Mesmos rótulos de `FAIR_VALUE_MODEL_LABEL` (o serviço é server-only); o `Record` garante todos os modelos. */
const FAIR_VALUE_MODEL_OPTIONS: Record<FairValueModel, string> = {
  graham: 'Graham',
  fcd: 'Fluxo de caixa descontado',
  gordon: 'Gordon',
  bazin: 'Preço-teto (Bazin)',
  bankPvp: 'P/VP justo (bancos)',
};
const DEFAULT_FAIR_VALUE_MODEL: FairValueModel = 'graham';
const DEFAULT_BAZIN_TARGET_YIELD = 0.06;
/** Valores sugeridos quando o formulário abre por `?type=` (o usuário pode trocar antes de salvar). */
const DEFAULT_FAIR_VALUE_MIN_DISCOUNT = 0.2;
const DEFAULT_DY_TTM_MIN = 0.08;

const ALERT_INPUT_ID: Record<AlertType, string> = {
  bazin_ceiling: 'monitor-bazin-yield',
  fair_value_discount: 'monitor-fair-discount',
  dy_ttm_above: 'monitor-dy-ttm',
};


const FIELD_KIND = new Map<ConfigKey, FieldKind>();
const FIELD_LABEL = new Map<ConfigKey, string>();
for (const f of PRICE_FIELDS) {
  FIELD_KIND.set(f.key, f.kind);
  FIELD_LABEL.set(f.key, f.label);
}
for (const f of [...BASIC_RANGES, ...ADVANCED_GROUPS.flatMap((g) => g.fields)]) {
  FIELD_KIND.set(f.min, f.kind);
  FIELD_KIND.set(f.max, f.kind);
  FIELD_LABEL.set(f.min, `${f.label} mínimo`);
  FIELD_LABEL.set(f.max, `${f.label} máximo`);
}
const ADVANCED_KEYS = new Set<ConfigKey>(ADVANCED_GROUPS.flatMap((g) => g.fields.flatMap((f) => [f.min, f.max])));
const ALL_RANGES = [...BASIC_RANGES, ...ADVANCED_GROUPS.flatMap((g) => g.fields)];

function formatValue(value: number, kind: FieldKind): string {
  switch (kind) {
    case 'money':
      return formatBRL(value);
    case 'percent':
      return formatPct(value);
    case 'multiple':
      return formatMultiple(value);
    case 'integer':
      return formatNumber(value, { digits: 0 });
    default:
      return formatNumber(value);
  }
}

/** Descreve os critérios de um monitoramento em frases curtas pt-BR (ex.: "P/L ≤ 20,0x", "Preço abaixo de R$ 30,00"). */
export function describeTriggerConfig(config: TriggerConfig): string[] {
  const parts: string[] = [];
  if (config.bazinCeiling) {
    parts.push(`Preço abaixo do teto Bazin (DY-alvo ${formatAlertPct(config.bazinCeiling.targetYield)})`);
  }
  if (config.fairValueDiscount) {
    const model = FAIR_VALUE_MODEL_OPTIONS[config.fairValueDiscount.model] ?? config.fairValueDiscount.model;
    parts.push(`Desconto ≥ ${formatAlertPct(config.fairValueDiscount.minDiscount)} vs ${model}`);
  }
  if (config.dyTtmAbove) {
    parts.push(`DY 12 meses ≥ ${formatAlertPct(config.dyTtmAbove.minDy)}`);
  }
  for (const field of PRICE_FIELDS) {
    const value = config[field.key];
    if (typeof value === 'number') parts.push(`${field.label} ${formatValue(value, field.kind)}`);
  }
  for (const range of ALL_RANGES) {
    const min = config[range.min];
    const max = config[range.max];
    if (typeof min === 'number') parts.push(`${range.label} ≥ ${formatValue(min, range.kind)}`);
    if (typeof max === 'number') parts.push(`${range.label} ≤ ${formatValue(max, range.kind)}`);
  }
  return parts;
}


type Drafts = Partial<Record<ConfigKey, string>>;

function toDraft(value: number | undefined, kind: FieldKind): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '';
  const shown = kind === 'percent' ? Number((value * 100).toFixed(6)) : value;
  return String(shown).replace('.', ',');
}

/** Aceita "1.234,56", "1234,56" e "1234.56". Vazio → undefined; inválido → NaN. */
function parseDecimal(raw: string): number | undefined {
  const text = raw.trim().replace(/\s|R\$|%/g, '');
  if (!text) return undefined;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  if (!/^-?\d*\.?\d+$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

function draftsFromConfig(config: TriggerConfig): Drafts {
  const drafts: Drafts = {};
  for (const [key, kind] of FIELD_KIND) {
    const value = config[key];
    if (typeof value === 'number') drafts[key] = toDraft(value, kind);
  }
  return drafts;
}

interface DecimalInputProps {
  id: string;
  kind: FieldKind;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** Campo numérico pt-BR: teclado decimal no celular, prefixo R$ ou sufixo % conforme o tipo. */
function DecimalInput({ id, kind, label, placeholder, value, onChange, invalid = false }: DecimalInputProps) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        {kind === 'money' && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
        )}
        <Input
          id={id}
          type="text"
          inputMode={kind === 'integer' ? 'numeric' : 'decimal'}
          autoComplete="off"
          placeholder={`ex.: ${placeholder}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          className={cn('tabular-nums', kind === 'money' && 'pl-10', kind === 'percent' && 'pr-8')}
        />
        {kind === 'percent' && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
        )}
      </div>
    </div>
  );
}

export interface MonitorCompany {
  id: number;
  ticker: string;
  name: string;
}

interface CustomMonitorFormProps {
  initialData?: {
    id: string;
    companyId: number;
    ticker: string;
    companyName: string;
    triggerConfig: TriggerConfig;
    isActive: boolean;
  };
  /** Empresa pré-selecionada na criação (ex.: `?ticker=PETR4` vindo da página do ativo). */
  defaultCompany?: MonitorCompany | null;
  /**
   * Alerta ou campo a destacar ao abrir (`?type=`): `bazin_ceiling`, `fair_value_discount`, `dy_ttm_above`
   * ou um critério numérico (ex.: `priceBelow`). Valores desconhecidos são ignorados.
   */
  focusField?: string | null;
}

export default function CustomMonitorForm({ initialData, defaultCompany, focusField }: CustomMonitorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [limits, setLimits] = useState<{ current: number; max: number | null; isPremium: boolean } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<MonitorCompany | null>(
    initialData
      ? { id: initialData.companyId, ticker: initialData.ticker, name: initialData.companyName }
      : defaultCompany ?? null
  );
  const initialConfig = initialData?.triggerConfig ?? {};
  const alertType = isAlertType(focusField) ? focusField : null;
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFromConfig(initialConfig));
  const [bazinEnabled, setBazinEnabled] = useState(() => !!initialConfig.bazinCeiling || alertType === 'bazin_ceiling');
  const [bazinYield, setBazinYield] = useState(() =>
    toDraft(initialConfig.bazinCeiling?.targetYield ?? DEFAULT_BAZIN_TARGET_YIELD, 'percent')
  );
  const [fairModel, setFairModel] = useState<FairValueModel>(
    () => initialConfig.fairValueDiscount?.model ?? DEFAULT_FAIR_VALUE_MODEL
  );
  const [fairDiscount, setFairDiscount] = useState(() =>
    toDraft(
      initialConfig.fairValueDiscount?.minDiscount ??
        (alertType === 'fair_value_discount' ? DEFAULT_FAIR_VALUE_MIN_DISCOUNT : undefined),
      'percent'
    )
  );
  const [dyTtm, setDyTtm] = useState(() =>
    toDraft(initialConfig.dyTtmAbove?.minDy ?? (alertType === 'dy_ttm_above' ? DEFAULT_DY_TTM_MIN : undefined), 'percent')
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const focusKey = isMonitorFormKey(focusField) ? focusField : null;
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (focusKey && ADVANCED_KEYS.has(focusKey)) return true;
    return Object.keys(draftsFromConfig(initialData?.triggerConfig ?? {})).some((k) => ADVANCED_KEYS.has(k as ConfigKey));
  });
  const [invalid, setInvalid] = useState<Set<string>>(() => new Set());

  // Limites do plano (só na criação)
  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    fetch('/api/user-asset-monitor')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success || !data.limits) return;
        setLimits(data.limits);
        // Limite atingido: mostra o aviso do topo em vez do campo focado pela URL
        if (data.limits.max !== null && data.limits.current >= data.limits.max) window.scrollTo({ top: 0 });
      })
      .catch((err) => console.error('Erro ao buscar limites:', err));
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  // Foco no alerta/campo pedido pela URL, ou no primeiro campo de preço quando a empresa já veio preenchida
  useEffect(() => {
    const requested = alertType ? ALERT_INPUT_ID[alertType] : focusKey ? `monitor-${focusKey}` : null;
    const target = requested ?? (defaultCompany && !initialData ? 'monitor-priceBelow' : null);
    if (!target) return;
    const el = document.getElementById(target);
    if (el instanceof HTMLInputElement) el.focus({ preventScroll: !requested });
    if (requested && el) el.scrollIntoView({ block: 'center' });
  }, [alertType, focusKey, defaultCompany, initialData]);

  const clearInvalid = (key: string) => {
    if (!invalid.has(key)) return;
    setInvalid((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const setDraft = (key: ConfigKey, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    clearInvalid(key);
  };

  const buildConfig = (): { config: TriggerConfig; errors: string[]; badKeys: Set<string> } => {
    const errors: string[] = [];
    const badKeys = new Set<string>();
    const values: Partial<Record<ConfigKey, number>> = {};

    for (const [key, kind] of FIELD_KIND) {
      const parsed = parseDecimal(drafts[key] ?? '');
      if (parsed === undefined) continue;
      if (Number.isNaN(parsed) || (kind === 'integer' && !Number.isInteger(parsed))) {
        errors.push(`${FIELD_LABEL.get(key)}: valor inválido`);
        badKeys.add(key);
        continue;
      }
      values[key] = kind === 'percent' ? parsed / 100 : parsed;
    }

    for (const range of ALL_RANGES) {
      const min = values[range.min];
      const max = values[range.max];
      if (min !== undefined && max !== undefined && min > max) {
        errors.push(`${range.label}: o mínimo é maior que o máximo`);
        badKeys.add(range.min);
        badKeys.add(range.max);
      }
    }

    /** Percentual digitado → fração; registra erro fora de (0, max]. */
    const readPercent = (raw: string, key: string, label: string, maxPct: number, maxInclusive = true): number | undefined => {
      const parsed = parseDecimal(raw);
      if (parsed === undefined) return undefined;
      const outOfRange = Number.isNaN(parsed) || parsed <= 0 || (maxInclusive ? parsed > maxPct : parsed >= maxPct);
      if (outOfRange) {
        errors.push(`${label}: informe um valor entre 0 e ${maxPct}%`);
        badKeys.add(key);
        return undefined;
      }
      return parsed / 100;
    };

    const alerts: Pick<TriggerConfig, 'bazinCeiling' | 'fairValueDiscount' | 'dyTtmAbove'> = {};
    if (bazinEnabled) {
      const targetYield = readPercent(bazinYield, 'bazinYield', 'DY-alvo do preço-teto Bazin', 100);
      if (targetYield !== undefined) alerts.bazinCeiling = { targetYield };
      else if (!badKeys.has('bazinYield')) {
        errors.push('DY-alvo do preço-teto Bazin: informe o percentual');
        badKeys.add('bazinYield');
      }
    }
    const minDiscount = readPercent(fairDiscount, 'fairDiscount', 'Desconto mínimo vs preço justo', 100, false);
    if (minDiscount !== undefined) alerts.fairValueDiscount = { model: fairModel, minDiscount };
    const minDy = readPercent(dyTtm, 'dyTtm', 'DY 12 meses mínimo', 100);
    if (minDy !== undefined) alerts.dyTtmAbove = { minDy };

    // Preserva critérios que este formulário não edita (ex.: criados por outras telas)
    const preserved: TriggerConfig = { ...(initialData?.triggerConfig ?? {}) };
    for (const key of FIELD_KIND.keys()) delete preserved[key];
    delete preserved.bazinCeiling;
    delete preserved.fairValueDiscount;
    delete preserved.dyTtmAbove;

    return { config: { ...preserved, ...values, ...alerts }, errors, badKeys };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompany) {
      toast({ title: 'Selecione um ativo', description: 'Busque pelo ticker ou nome da empresa.', variant: 'destructive' });
      return;
    }

    const { config, errors, badKeys } = buildConfig();
    if (errors.length > 0) {
      setInvalid(badKeys);
      toast({ title: 'Revise os critérios', description: errors.join('. '), variant: 'destructive' });
      return;
    }
    if (!Object.values(config).some((value) => value !== undefined && value !== null)) {
      toast({
        title: 'Defina pelo menos um critério',
        description: 'Por exemplo, o preço-teto Bazin, um preço-alvo ou um P/L máximo.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(initialData ? `/api/user-asset-monitor/${initialData.id}` : '/api/user-asset-monitor', {
        method: initialData ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          triggerConfig: config,
          ...(initialData ? { isActive } : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.error === 'LIMIT_REACHED') {
          if (data.limits) setLimits(data.limits);
          toast({
            title: 'Limite do plano gratuito atingido',
            description: data.message || 'Pause ou remova um monitoramento para criar outro, ou veja os planos.',
            variant: 'destructive',
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        throw new Error(data.error || data.message || 'Erro ao salvar monitoramento');
      }

      toast(
        data.merged
          ? {
              title: `Critérios somados ao monitoramento de ${selectedCompany.ticker}`,
              description: 'Você já monitorava este ativo. Os critérios anteriores foram mantidos.',
            }
          : {
              title: initialData ? 'Monitoramento atualizado' : 'Monitoramento criado',
              description: `Você será avisado quando ${selectedCompany.ticker} atingir um dos critérios.`,
            }
      );
      router.push('/dashboard/monitoramentos-customizados');
      router.refresh();
    } catch (error) {
      console.error('Erro ao salvar monitoramento:', error);
      toast({
        title: 'Não foi possível salvar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isLimitReached = !initialData && !!limits && limits.max !== null && limits.current >= limits.max;
  const typedBazinYield = parseDecimal(bazinYield);
  const bazinTargetLabel = formatAlertPct(
    typedBazinYield !== undefined && Number.isFinite(typedBazinYield) && typedBazinYield > 0
      ? typedBazinYield / 100
      : DEFAULT_BAZIN_TARGET_YIELD
  );

  const renderInput = (key: ConfigKey, kind: FieldKind, placeholder: string, label: string) => (
    <DecimalInput
      id={`monitor-${key}`}
      kind={kind}
      label={label}
      placeholder={placeholder}
      value={drafts[key] ?? ''}
      onChange={(value) => setDraft(key, value)}
      invalid={invalid.has(key)}
    />
  );

  const renderRange = (range: RangeField) => (
    <fieldset key={range.label} className="min-w-0 space-y-1.5">
      <legend className="text-sm font-medium text-foreground">{range.label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {renderInput(range.min, range.kind, range.placeholders[0], 'Mínimo')}
        {renderInput(range.max, range.kind, range.placeholders[1], 'Máximo')}
      </div>
    </fieldset>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {!initialData && limits && (
        <MonitorLimitBanner current={limits.current} max={limits.max} showUpgrade={isLimitReached} />
      )}

      <section className="space-y-3" aria-labelledby="monitor-asset">
        <h2 id="monitor-asset" className="text-lg font-semibold tracking-tight text-foreground">
          Ativo
        </h2>
        {selectedCompany ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{selectedCompany.ticker}</p>
              <p className="truncate text-sm text-muted-foreground">{selectedCompany.name}</p>
            </div>
            {!initialData && (
              <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-0" onClick={() => setSelectedCompany(null)}>
                Trocar
              </Button>
            )}
          </div>
        ) : (
          <AssetSearchInput
            placeholder="Buscar por ticker ou nome"
            onCompanySelect={(company) => setSelectedCompany({ id: company.id, ticker: company.ticker, name: company.name })}
          />
        )}
        {initialData && <p className="text-xs text-muted-foreground">O ativo não pode ser trocado depois de criado.</p>}
      </section>

      <section className="space-y-3" aria-labelledby="monitor-valuation">
        <div className="space-y-1">
          <h2 id="monitor-valuation" className="text-lg font-semibold tracking-tight text-foreground">
            Preço-teto, preço justo e proventos
          </h2>
          <p className="text-sm text-muted-foreground">
            Avisos calculados com os proventos e os modelos de valuation do ativo. Os valores são estimativas e o aviso não é recomendação de investimento.
          </p>
        </div>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          <li className="space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="monitor-bazin-enabled" className="text-sm font-medium text-foreground">
                  Preço-teto Bazin
                </Label>
                <p id="monitor-bazin-help" className="text-sm text-muted-foreground">
                  Avise quando o preço ficar abaixo do preço-teto Bazin (DY-alvo {bazinTargetLabel}). O teto é a média
                  de dividendos e JCP dos últimos 5 anos completos dividida pelo DY-alvo.
                </p>
              </div>
              <Switch
                id="monitor-bazin-enabled"
                checked={bazinEnabled}
                onCheckedChange={(checked) => {
                  setBazinEnabled(checked);
                  if (!checked) clearInvalid('bazinYield');
                }}
                aria-describedby="monitor-bazin-help"
                className="relative mt-0.5 after:absolute after:-inset-2.5"
              />
            </div>
            {bazinEnabled && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <DecimalInput
                  id={ALERT_INPUT_ID.bazin_ceiling}
                  kind="percent"
                  label="DY-alvo"
                  placeholder="6"
                  value={bazinYield}
                  onChange={(value) => {
                    setBazinYield(value);
                    clearInvalid('bazinYield');
                  }}
                  invalid={invalid.has('bazinYield')}
                />
              </div>
            )}
          </li>
          <li className="space-y-3 px-4 py-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-medium text-foreground">Desconto vs preço justo</h3>
              <p className="text-sm text-muted-foreground">
                Avise quando o preço estiver pelo menos o percentual informado abaixo do preço justo estimado pelo modelo.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="monitor-fair-model" className="text-xs font-normal text-muted-foreground">
                  Modelo
                </Label>
                <Select value={fairModel} onValueChange={(value) => setFairModel(value as FairValueModel)}>
                  <SelectTrigger id="monitor-fair-model" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(FAIR_VALUE_MODEL_OPTIONS) as Array<[FairValueModel, string]>).map(([model, label]) => (
                      <SelectItem key={model} value={model}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DecimalInput
                id={ALERT_INPUT_ID.fair_value_discount}
                kind="percent"
                label="Desconto mínimo"
                placeholder="20"
                value={fairDiscount}
                onChange={(value) => {
                  setFairDiscount(value);
                  clearInvalid('fairDiscount');
                }}
                invalid={invalid.has('fairDiscount')}
              />
            </div>
          </li>
          <li className="space-y-3 px-4 py-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-medium text-foreground">Dividend yield de 12 meses</h3>
              <p className="text-sm text-muted-foreground">
                Avise quando os proventos dos últimos 12 meses divididos pelo preço atual passarem do mínimo.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DecimalInput
                id={ALERT_INPUT_ID.dy_ttm_above}
                kind="percent"
                label="DY mínimo"
                placeholder="8"
                value={dyTtm}
                onChange={(value) => {
                  setDyTtm(value);
                  clearInvalid('dyTtm');
                }}
                invalid={invalid.has('dyTtm')}
              />
            </div>
          </li>
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="monitor-price">
        <div className="space-y-1">
          <h2 id="monitor-price" className="text-lg font-semibold tracking-tight text-foreground">
            Preço
          </h2>
          <p className="text-sm text-muted-foreground">Receba um aviso quando a cotação cruzar um valor.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRICE_FIELDS.map((field) => (
            <div key={field.key}>{renderInput(field.key, field.kind, field.placeholder, field.label)}</div>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="monitor-basic">
        <div className="space-y-1">
          <h2 id="monitor-basic" className="text-lg font-semibold tracking-tight text-foreground">
            Valuation e score
          </h2>
          <p className="text-sm text-muted-foreground">Deixe em branco o que não quiser acompanhar.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{BASIC_RANGES.map(renderRange)}</div>
      </section>

      <section className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          aria-controls="monitor-advanced"
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Mais indicadores</span>
            <span className="block text-sm text-muted-foreground">Rentabilidade, margens, endividamento e crescimento</span>
          </span>
          <ChevronDown
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', showAdvanced && 'rotate-180')}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>
        {showAdvanced && (
          <div id="monitor-advanced" className="space-y-6 border-t border-border px-4 py-4">
            {ADVANCED_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{group.fields.map(renderRange)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {initialData && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="monitor-isActive">Monitoramento ativo</Label>
            <p className="text-sm text-muted-foreground">
              {isActive ? 'Os critérios estão sendo verificados.' : 'Pausado: os critérios não serão verificados.'}
            </p>
          </div>
          <Switch id="monitor-isActive" checked={isActive} onCheckedChange={setIsActive} />
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/monitoramentos-customizados">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isSaving || isLimitReached}>
          {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isSaving ? 'Salvando' : initialData ? 'Salvar alterações' : 'Criar monitoramento'}
        </Button>
      </div>
    </form>
  );
}
