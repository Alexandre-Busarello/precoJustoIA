/**
 * Link discreto para o ticker anterior (predecessor) quando a empresa migrou de ticker.
 */

import Link from 'next/link';
import { History } from 'lucide-react';

interface PredecessorTickerLinkProps {
  predecessorTicker: string;
  currentTicker: string;
  pageType: 'analise-tecnica' | 'relatorios';
}

export function PredecessorTickerLink({
  predecessorTicker,
  pageType,
}: PredecessorTickerLinkProps) {
  const basePath = `/acao/${predecessorTicker.toLowerCase()}`;
  const href = pageType === 'analise-tecnica' ? `${basePath}/analise-tecnica` : `${basePath}/relatorios`;

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <History className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>Anteriormente</span>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center font-medium text-foreground underline decoration-dotted underline-offset-2 hover:text-brand md:min-h-0"
      >
        {predecessorTicker}
      </Link>
      <span>({pageType === 'analise-tecnica' ? 'análise técnica' : 'relatórios'})</span>
    </p>
  );
}
