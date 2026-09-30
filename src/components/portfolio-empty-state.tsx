'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortfolioTutorialLink } from '@/components/portfolio-tutorial-banner';

interface PortfolioEmptyStateProps {
  onCreateClick: () => void;
  onConvertBacktestClick: () => void;
  isPremium: boolean;
}

/** Estado vazio de /carteira: 1 frase, 1 ação principal e as alternativas. */
export function PortfolioEmptyState({
  onCreateClick,
  onConvertBacktestClick,
  isPremium,
}: PortfolioEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center sm:px-8">
      <h2 className="text-lg font-semibold text-foreground">Você ainda não tem carteiras</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Cadastre seus ativos da B3 para acompanhar patrimônio, retorno e alocação em um só lugar.
      </p>
      <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
        <Button onClick={onCreateClick}>
          <Plus strokeWidth={1.75} aria-hidden="true" />
          Criar carteira
        </Button>
        <Button onClick={onConvertBacktestClick} variant="outline">
          Criar a partir de um backtest
        </Button>
      </div>
      <PortfolioTutorialLink className="mt-4" />
      {!isPremium && (
        <p className="mt-4 text-xs text-muted-foreground">
          No plano gratuito você pode ter 1 carteira.{' '}
          <Link href="/planos" className="text-brand underline-offset-4 hover:underline">
            Ver planos
          </Link>
        </p>
      )}
    </div>
  );
}
