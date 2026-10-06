'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Maybe<T> = T | null | undefined;

/**
 * Converte texto numérico digitado ou colado em número.
 * Aceita pt-BR ("1.234,56", "R$ 1.234,56") e ponto decimal ("1234.56").
 * Com vírgula, os pontos são separadores de milhar. Sem vírgula, um único ponto seguido
 * de 1 ou 2 dígitos é decimal ("32.5"); nos demais casos os pontos são milhar ("1.500").
 */
export function parseMoneyText(text: string): number | undefined {
  const cleaned = text.replace(/R\$/gi, '').replace(/[\s ]/g, '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) return undefined;
  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.').replace(/,/g, '');
  } else if (/^-?\d+\.\d{1,2}$/.test(cleaned)) {
    normalized = cleaned;
  } else {
    normalized = cleaned.replace(/\./g, '');
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function groupThousands(integerDigits: string): string {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Máscara de centavos (padrão de apps bancários): mantém só os dígitos e os lê da direita
 * para a esquerda. `maskMoneyDigits('123456')` → `1.234,56`; `''` → `''`.
 */
export function maskMoneyDigits(text: string, digits = 2): string {
  const onlyDigits = text.replace(/\D/g, '').replace(/^0+/, '');
  if (onlyDigits === '') return text.replace(/\D/g, '') === '' ? '' : formatMoneyInput(0, digits);
  const padded = onlyDigits.padStart(digits + 1, '0');
  const integerPart = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  return digits > 0 ? `${groupThousands(integerPart)},${fraction}` : groupThousands(integerPart);
}

/** Valor → texto do campo (sem "R$"): `formatMoneyInput(1234.5)` → `1.234,50`. Vazio para nulo. */
export function formatMoneyInput(value: Maybe<number>, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Arredonda para as casas do campo (evita 0,1 + 0,2 = 0,30000000000000004 no estado). */
export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Texto de quantidade: só dígitos (e uma vírgula quando `allowFraction`). */
export function sanitizeQuantityText(text: string, allowFraction = false): string {
  if (!allowFraction) return text.replace(/\D/g, '');
  const kept = text.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [integerPart, ...rest] = kept.split(',');
  return rest.length > 0 ? `${integerPart},${rest.join('')}` : integerPart;
}

/** `parseQuantityText('1.500')` → 1500; `'10,5'` → 10.5; `''` → undefined. */
export function parseQuantityText(text: string): number | undefined {
  const normalized = text.replace(/\./g, '').replace(',', '.');
  if (normalized.trim() === '' || normalized === '.') return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

type NativeInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode'>;

interface PortfolioMoneyInputProps extends NativeInputProps {
  value: Maybe<number>;
  onValueChange: (value: number | undefined) => void;
  /** Casas decimais (padrão 2). */
  digits?: number;
}

/**
 * Campo de valor em reais: teclado decimal no celular, máscara BRL de centavos
 * ("150000" vira "1.500,00") e prefixo "R$". Colar "1.500,00" ou "1500.5" também funciona.
 */
export function PortfolioMoneyInput({
  value,
  onValueChange,
  digits = 2,
  className,
  onPaste,
  ...props
}: PortfolioMoneyInputProps) {
  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={formatMoneyInput(value, digits)}
        onChange={(event) => {
          const masked = maskMoneyDigits(event.target.value, digits);
          onValueChange(masked === '' ? undefined : parseMoneyText(masked));
        }}
        onPaste={(event) => {
          onPaste?.(event);
          const pasted = parseMoneyText(event.clipboardData.getData('text'));
          if (pasted === undefined) return;
          event.preventDefault();
          onValueChange(roundTo(Math.abs(pasted), digits));
        }}
        className={cn('pl-10 tabular-nums', className)}
      />
    </div>
  );
}

interface PortfolioQuantityInputProps extends NativeInputProps {
  value: Maybe<number>;
  onValueChange: (value: number | undefined) => void;
  /** Aceita fração com vírgula (padrão: só inteiros). */
  allowFraction?: boolean;
}

function formatQuantity(value: Maybe<number>): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

/** Campo de quantidade: teclado numérico no celular e só dígitos. */
export function PortfolioQuantityInput({
  value,
  onValueChange,
  allowFraction = false,
  className,
  ...props
}: PortfolioQuantityInputProps) {
  const [draft, setDraft] = React.useState(() => formatQuantity(value));
  const [prevValue, setPrevValue] = React.useState(value);

  // Sincroniza quando o valor muda por fora (ex.: recálculo a partir do total).
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseQuantityText(draft) !== (value ?? undefined)) setDraft(formatQuantity(value));
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern={allowFraction ? undefined : '[0-9]*'}
      autoComplete="off"
      value={draft}
      onChange={(event) => {
        const next = sanitizeQuantityText(event.target.value, allowFraction);
        setDraft(next);
        onValueChange(parseQuantityText(next));
      }}
      className={cn('tabular-nums', className)}
    />
  );
}

interface PortfolioPercentInputProps {
  /** Valor já em pontos percentuais (15 para 15%). */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Rótulo acessível (o rótulo visual fica fora do campo). */
  ariaLabel: string;
  placeholder?: string;
  /** Sufixo exibido dentro do campo (padrão "%"). */
  suffix?: string;
  disabled?: boolean;
  className?: string;
  enterKeyHint?: React.ComponentProps<'input'>['enterKeyHint'];
}

/** Número em pontos percentuais → texto do campo: `12.5` → `12,5`; nulo → vazio. */
export function formatPercentInput(value: Maybe<number>): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return String(roundTo(value, 4)).replace('.', ',');
}

/**
 * Campo de alocação em %: teclado decimal no celular, vírgula decimal e o texto digitado
 * preservado durante a digitação ("12," não vira "12").
 */
export function PortfolioPercentInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  suffix = '%',
  disabled,
  className,
  enterKeyHint,
}: PortfolioPercentInputProps) {
  const [draft, setDraft] = React.useState(() => formatPercentInput(value));
  const [prevValue, setPrevValue] = React.useState(value);

  // Sincroniza quando o valor muda por fora (redistribuição, IA, lista colada).
  if (value !== prevValue) {
    setPrevValue(value);
    const parsed = parseQuantityText(draft);
    const same =
      parsed === undefined || value === undefined ? parsed === value : Math.abs(parsed - value) <= 1e-9;
    if (!same) setDraft(formatPercentInput(value));
  }

  return (
    <div className={cn('relative min-w-0', className)}>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        disabled={disabled}
        enterKeyHint={enterKeyHint}
        onChange={(event) => {
          const next = sanitizeQuantityText(event.target.value, true);
          setDraft(next);
          onChange(parseQuantityText(next));
        }}
        className={cn('tabular-nums', suffix && 'pr-9')}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}
