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
import { AssetSearchInput } from '@/components/asset-search-input';
import { MonitorLimitBanner } from '@/components/monitor-limit-banner';
import { formatBRL, formatMultiple, formatNumber, formatPct } from '@/lib/format';
import type { TriggerConfig } from '@/lib/custom-trigger-service';

type ConfigKey = keyof TriggerConfig;

/** `money` em R$, `percent` digitado em % e salvo como fração, `multiple`/`number` como digitado, `integer` sem casas. */
type FieldKind = 'money' | 'percent' | 'multiple' | 'number' | 'integer';

interface SingleField {
  key: ConfigKey;
  label: string;
  kind: FieldKind;
  placeholder: string;
}

interface RangeField {
  label: string;
  min: ConfigKey;
  max: ConfigKey;
  kind: FieldKind;
  placeholders: [string, string];
}

interface RangeGroup {
  title: string;
  fields: RangeField[];
}

const PRICE_FIELDS: SingleField[] = [
  { key: 'priceBelow', label: 'Preço abaixo de', kind: 'money', placeholder: '30,00' },
  { key: 'priceAbove', label: 'Preço acima de', kind: 'money', placeholder: '100,00' },
  { key: 'priceReached', label: 'Preço atingir', kind: 'money', placeholder: '50,00' },
];

const BASIC_RANGES: RangeField[] = [
  { label: 'P/L', min: 'minPl', max: 'maxPl', kind: 'multiple', placeholders: ['5', '20'] },
  { label: 'P/VP', min: 'minPvp', max: 'maxPvp', kind: 'multiple', placeholders: ['0,5', '2'] },
  { label: 'Score', min: 'minScore', max: 'maxScore', kind: 'integer', placeholders: ['60', '90'] },
];

const ADVANCED_GROUPS: RangeGroup[] = [
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

function isMonitorFormKey(value: string | null | undefined): value is ConfigKey {
  return !!value && FIELD_KIND.has(value as ConfigKey);
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
  /** Campo a destacar ao abrir (ex.: `?type=priceBelow`). Valores desconhecidos são ignorados. */
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
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFromConfig(initialData?.triggerConfig ?? {}));
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const focusKey = isMonitorFormKey(focusField) ? focusField : null;
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (focusKey && ADVANCED_KEYS.has(focusKey)) return true;
    return Object.keys(draftsFromConfig(initialData?.triggerConfig ?? {})).some((k) => ADVANCED_KEYS.has(k as ConfigKey));
  });
  const [invalid, setInvalid] = useState<Set<ConfigKey>>(() => new Set());

  // Limites do plano (só na criação)
  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    fetch('/api/user-asset-monitor')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.limits) setLimits(data.limits);
      })
      .catch((err) => console.error('Erro ao buscar limites:', err));
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  // Foco no campo pedido pela URL, ou no primeiro campo de preço quando a empresa já veio preenchida
  useEffect(() => {
    const target = focusKey ?? (defaultCompany && !initialData ? 'priceBelow' : null);
    if (!target) return;
    const el = document.getElementById(`monitor-${target}`);
    if (el instanceof HTMLInputElement) el.focus({ preventScroll: !focusKey });
  }, [focusKey, defaultCompany, initialData]);

  const setDraft = (key: ConfigKey, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    if (invalid.has(key)) {
      setInvalid((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const buildConfig = (): { config: TriggerConfig; errors: string[]; badKeys: Set<ConfigKey> } => {
    const errors: string[] = [];
    const badKeys = new Set<ConfigKey>();
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

    // Preserva critérios que este formulário não edita (ex.: criados por outras telas)
    const preserved: TriggerConfig = { ...(initialData?.triggerConfig ?? {}) };
    for (const key of FIELD_KIND.keys()) delete preserved[key];

    return { config: { ...preserved, ...values }, errors, badKeys };
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
      toast({ title: 'Defina pelo menos um critério', description: 'Por exemplo, um preço-alvo ou um P/L máximo.', variant: 'destructive' });
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
            description: data.message || 'Desative um monitoramento existente ou veja os planos.',
            variant: 'destructive',
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        throw new Error(data.error || data.message || 'Erro ao salvar monitoramento');
      }

      toast({
        title: initialData ? 'Monitoramento atualizado' : 'Monitoramento criado',
        description: `Você será avisado quando ${selectedCompany.ticker} atingir um dos critérios.`,
      });
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

  const renderInput = (key: ConfigKey, kind: FieldKind, placeholder: string, label: string) => (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={`monitor-${key}`} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        {kind === 'money' && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
        )}
        <Input
          id={`monitor-${key}`}
          type="text"
          inputMode={kind === 'integer' ? 'numeric' : 'decimal'}
          autoComplete="off"
          placeholder={`ex.: ${placeholder}`}
          value={drafts[key] ?? ''}
          onChange={(e) => setDraft(key, e.target.value)}
          aria-invalid={invalid.has(key) || undefined}
          className={cn('tabular-nums', kind === 'money' && 'pl-10', kind === 'percent' && 'pr-8')}
        />
        {kind === 'percent' && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
        )}
      </div>
    </div>
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
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCompany(null)}>
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
