'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, BarChart3 } from 'lucide-react';

interface PortfolioEmptyStateProps {
  onCreateClick: () => void;
  onConvertBacktestClick: () => void;
  isPremium: boolean;
}

export function PortfolioEmptyState({
  onCreateClick,
  onConvertBacktestClick,
  isPremium,
}: PortfolioEmptyStateProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              Comece sua Jornada de Investimentos
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Organize seus ativos da B3 e receba recomendações de IA.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={onCreateClick} size="lg">
                <Briefcase className="mr-2 h-5 w-5" />
                Criar minha primeira Carteira
              </Button>
              <Button
                onClick={onConvertBacktestClick}
                size="lg"
                variant="outline"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                A partir de Backtest
              </Button>
            </div>

            {!isPremium && (
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg max-w-md">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <strong>Nota:</strong> Usuários gratuitos podem criar 1
                  carteira. Faça upgrade para Premium para carteiras
                  ilimitadas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

