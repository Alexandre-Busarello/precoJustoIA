'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TUTORIAL_LINK_DISMISSED_KEY = 'portfolio-tutorial-banner-dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_LINK_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Link discreto para o tutorial de importação da B3, com "não mostrar de novo" persistido.
 * Fica oculto até ler a preferência (evita piscar para quem já dispensou).
 */
export function PortfolioTutorialLink({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readDismissed());
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(TUTORIAL_LINK_DISMISSED_KEY, 'true');
    } catch {
      // Sem armazenamento (aba anônima/bloqueado): some só nesta visita.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div data-testid="portfolio-tutorial-link" className={cn('inline-flex items-center', className)}>
      <Link
        href="/carteira/tutorial"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-brand underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:min-h-9"
      >
        <PlayCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Importar histórico (tutorial de 5 min)
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Não mostrar o link do tutorial de novo"
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:size-9"
      >
        <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
