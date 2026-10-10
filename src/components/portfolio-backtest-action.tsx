'use client';

import { QuickBacktestButton } from '@/components/backtest/quick-backtest-button';

interface PortfolioBacktestActionProps {
  portfolioId: string;
  portfolioName: string;
}

/**
 * "Simular no backtest" no cabeçalho da carteira: um clique simula os últimos 5 anos com os pesos-alvo da carteira
 * (ou, sem alvo definido, o peso atual de cada posição) e abre o resultado. O menu tem "Personalizar antes".
 */
export function PortfolioBacktestAction({ portfolioId, portfolioName }: PortfolioBacktestActionProps) {
  return (
    <QuickBacktestButton
      request={{ tickers: [], source: 'carteira', sourceLabel: portfolioName, portfolioId }}
      label="Simular no backtest"
      customizable
    />
  );
}
