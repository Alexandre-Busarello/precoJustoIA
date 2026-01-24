/**
 * Componente discreto para exibir link ao ticker predecessor (ticker antigo)
 * quando uma empresa foi migrada de outro ticker
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { History, ExternalLink } from 'lucide-react';

interface PredecessorTickerLinkProps {
  predecessorTicker: string;
  currentTicker: string;
  pageType: 'analise-tecnica' | 'relatorios';
}

export function PredecessorTickerLink({
  predecessorTicker,
  currentTicker,
  pageType,
}: PredecessorTickerLinkProps) {
  const basePath = `/acao/${predecessorTicker.toLowerCase()}`;
  const href =
    pageType === 'analise-tecnica'
      ? `${basePath}/analise-tecnica`
      : `${basePath}/relatorios`;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <History className="h-3 w-3" />
      <span>Anteriormente:</span>
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
      >
        <span className="font-mono font-medium">{predecessorTicker}</span>
        <ExternalLink className="h-3 w-3" />
      </Link>
      <span className="text-muted-foreground/70">
        ({pageType === 'analise-tecnica' ? 'análise técnica' : 'relatórios'})
      </span>
    </div>
  );
}
















