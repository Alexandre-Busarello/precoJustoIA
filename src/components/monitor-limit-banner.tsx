'use client';

import { usePremiumStatus } from '@/hooks/use-premium-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Crown, Info } from 'lucide-react';

interface MonitorLimitBannerProps {
  current: number;
  max: number | null;
  showUpgrade?: boolean;
}

export function MonitorLimitBanner({ current, max, showUpgrade = false }: MonitorLimitBannerProps) {
  const { isPremium, isLoading } = usePremiumStatus();

  if (isLoading) {
    return null;
  }

  // Não mostrar para usuários Premium
  if (isPremium || max === null) {
    return null;
  }

  const isLimitReached = current >= max;
  const remaining = max - current;

  return (
    <Card className={isLimitReached ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950' : 'border-blue-200 bg-blue-50 dark:bg-blue-950'}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-base">
            {isLimitReached ? 'Limite Atingido' : 'Plano Gratuito'}
          </CardTitle>
        </div>
        <CardDescription>
          {isLimitReached
            ? 'Você atingiu o limite de monitores customizados no plano gratuito.'
            : `Você pode criar até ${max} monitoramento${max > 1 ? 's' : ''} customizado${max > 1 ? 's' : ''} no plano gratuito.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {current}/{max} monitores utilizados
            </p>
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {remaining} monitor{remaining > 1 ? 'es' : ''} restante{remaining > 1 ? 's' : ''}
              </p>
            )}
          </div>
          {isLimitReached && (
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Premium Ilimitado
              </span>
            </div>
          )}
        </div>

        {(showUpgrade || isLimitReached) && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Upgrade para Premium e crie monitores customizados ilimitados:
            </p>
            <ul className="text-sm space-y-1 mb-4 text-muted-foreground">
              <li>✓ Monitores customizados ilimitados</li>
              <li>✓ Alertas em tempo real</li>
              <li>✓ Relatórios completos de IA</li>
              <li>✓ Acesso a todas as estratégias</li>
            </ul>
            <Button asChild className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white">
              <Link href="/checkout">
                <Crown className="w-4 h-4 mr-2" />
                Fazer Upgrade Premium
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

