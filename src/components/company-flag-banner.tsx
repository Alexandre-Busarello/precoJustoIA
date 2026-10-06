'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/markdown-renderer';

interface CompanyFlagBannerProps {
  flag: {
    id: string;
    reason: string;
    reportId: string | null;
  };
  ticker: string;
  isPremium: boolean;
}

/** Alerta de possível perda de fundamentos detectada pela IA (aviso sutil, dispensável). */
export function CompanyFlagBanner({ flag, ticker, isPremium }: CompanyFlagBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  // Markdown (**, #, links) é renderizado completo; texto simples é resumido em 300 caracteres
  const hasMarkdown = /[*#[\]()]/.test(flag.reason);
  const reasonSummary =
    hasMarkdown || flag.reason.length <= 300 ? flag.reason : `${flag.reason.substring(0, 300)}…`;

  return (
    <div role="note" className="rounded-lg border border-warning/30 bg-warning-subtle p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">
              {isPremium ? 'Alerta: possível perda de fundamentos' : 'Alerta de fundamentos detectado pela IA'}
            </h2>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="relative -m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Fechar alerta"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          {isPremium ? (
            <>
              <div className="mt-1 text-sm text-foreground">
                {hasMarkdown ? (
                  <MarkdownRenderer content={reasonSummary} className="prose-sm max-w-none text-foreground dark:prose-invert" />
                ) : (
                  <p>{reasonSummary}</p>
                )}
              </div>
              {flag.reportId && (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href={`/acao/${ticker.toLowerCase()}/relatorios/${flag.reportId}`}>Ver relatório completo</Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                A IA identificou uma mudança relevante nos fundamentos desta empresa. O motivo e o relatório completo
                estão disponíveis no Premium.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/checkout">Ver detalhes no Premium</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
