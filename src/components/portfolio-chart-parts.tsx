'use client';

import type { ReactNode } from 'react';

/** Rótulos dos eixos: 12 px na cor secundária do tema (legível no claro e no escuro). */
export const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const;

const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "YYYY-MM-DD" (sem fuso) → Date em UTC no dia 15, para não trocar de mês por fuso. */
function monthDate(dateString: string): Date {
  const [year, month] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, 15));
}

/** `2026-09-30` → `set. 2026`. */
export function formatMonthShort(dateString: string): string {
  const parts = monthShort.formatToParts(monthDate(dateString));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')} ${get('year')}`;
}

/** `2026-09-30` → `setembro de 2026`. */
export function formatMonthLong(dateString: string): string {
  return monthLong.format(monthDate(dateString));
}

/** `2026-09-30` → `09/26` (eixo X compacto). */
export function formatMonthTick(dateString: string): string {
  const [year, month] = dateString.split('-');
  return `${month}/${(year ?? '').slice(2)}`;
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

/** Legenda em linha (sem depender da legenda do recharts). */
export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden="true">
            <line
              x1="0"
              y1="2"
              x2="16"
              y2="2"
              stroke={item.color}
              strokeWidth="2"
              strokeDasharray={item.dashed ? '3 2' : undefined}
            />
          </svg>
          {item.label}
        </span>
      ))}
    </div>
  );
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  series: ChartSeries[];
  formatLabel: (label: string) => string;
  formatValue: (value: number, key: string) => ReactNode;
}

/** Tooltip com tokens do tema e números em pt-BR. */
export function ChartTooltip({ active, label, payload, series, formatLabel, formatValue }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">{formatLabel(String(label ?? ''))}</p>
      <ul className="space-y-0.5">
        {series.map((item) => {
          const entry = payload.find((p) => p.dataKey === item.key);
          if (!entry || typeof entry.value !== 'number') return null;
          return (
            <li key={item.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
              <span className="font-medium tabular-nums">{formatValue(entry.value, item.key)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
