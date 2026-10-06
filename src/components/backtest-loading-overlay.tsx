'use client';

import { Loader2 } from 'lucide-react';

interface BacktestLoadingOverlayProps {
  title: string;
  description?: string;
}

/**
 * Overlay de carregamento compartilhado pelas telas de backtest
 * (formulário, página e lista de configurações).
 */
export function BacktestLoadingOverlay({ title, description }: BacktestLoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-popover p-6 text-center shadow-md">
        <Loader2 className="mx-auto size-6 animate-spin text-brand" strokeWidth={1.75} aria-hidden="true" />
        <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
