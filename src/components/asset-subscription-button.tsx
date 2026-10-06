'use client';

import { useState, useSyncExternalStore } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { useQueryClient } from '@tanstack/react-query';
import { useAssetSubscription, invalidateAssetSubscriptionCache } from '@/hooks/use-company-data';
import { cn } from '@/lib/utils';

interface AssetSubscriptionButtonProps {
  ticker: string;
  companyId: number; // Mantido para uso futuro
  variant?: 'default' | 'outline' | 'ghost' | 'card';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  compact?: boolean; // Layout compacto/vertical (variante card)
}

const subscribeNoop = () => () => {};

const iconProps = { className: 'size-4', strokeWidth: 1.75, 'aria-hidden': true } as const;

/**
 * Inscrição em notificações por e-mail de um ativo. Visitantes vão para o cadastro (com retorno para o ativo).
 * Variante `card`: bloco com título, descrição e botão; as demais: só o botão.
 */
export default function AssetSubscriptionButton({
  ticker,
  companyId, // eslint-disable-line @typescript-eslint/no-unused-vars
  variant = 'card',
  size = 'default',
  showLabel = true,
  compact = false,
}: AssetSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();
  const { isLoading: isPremiumLoading } = usePremiumStatus();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Status da inscrição (com cache); só consulta com sessão
  const subscriptionQuery = useAssetSubscription(session?.user ? ticker : '');
  const { refetch: refetchSubscription } = subscriptionQuery;
  // O hook semeia dados do localStorage; até hidratar, repete o estado do servidor (carregando)
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const subscriptionData = hydrated ? subscriptionQuery.data : undefined;
  const isChecking = hydrated ? subscriptionQuery.isLoading : true;

  const isSubscribed = subscriptionData?.isSubscribed || false;
  const isLoggedIn = !!session?.user;

  const handleToggleSubscription = async () => {
    // Sem sessão: cadastro com retorno para o ativo (inscrição automática após o login)
    if (!isLoggedIn) {
      const callbackUrl = `/acao/${ticker.toLowerCase()}?subscribe=true`;
      router.push(`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`, {
        method: isSubscribed ? 'DELETE' : 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (isSubscribed ? 'Erro ao cancelar inscrição' : 'Erro ao criar inscrição'));
      }

      invalidateAssetSubscriptionCache(queryClient, ticker);
      refetchSubscription();
      toast(
        isSubscribed
          ? { title: 'Inscrição cancelada', description: `Você não receberá mais notificações sobre ${ticker}.` }
          : { title: 'Inscrição ativada', description: `Você receberá um e-mail quando houver mudanças relevantes em ${ticker}.` }
      );
    } catch (error) {
      console.error('Erro ao alterar inscrição:', error);
      toast({
        title: 'Não foi possível concluir',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checking = isLoggedIn && (isChecking || isPremiumLoading);

  if (variant === 'card') {
    if (checking) {
      return (
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-9 w-full" />
        </div>
      );
    }

    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', !compact && 'sm:flex sm:items-center sm:justify-between sm:gap-4')}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {isSubscribed ? `Recebendo notificações sobre ${ticker}` : `Acompanhar ${ticker}`}
          </p>
          {!isSubscribed && (
            <p className="mt-1 text-sm text-muted-foreground">
              Receba um e-mail quando houver mudanças relevantes nos fundamentos de {ticker}.
            </p>
          )}
        </div>
        <Button
          onClick={handleToggleSubscription}
          disabled={isLoading}
          variant={isSubscribed ? 'ghost' : 'default'}
          size="sm"
          className={cn('mt-3 shrink-0', compact ? 'w-full' : 'w-full sm:mt-0 sm:w-auto')}
        >
          {isLoading ? <Loader2 {...iconProps} className="size-4 animate-spin" /> : isSubscribed ? <BellOff {...iconProps} /> : <Bell {...iconProps} />}
          {isSubscribed ? 'Cancelar' : isLoggedIn ? 'Ativar notificações' : 'Criar conta grátis'}
        </Button>
      </div>
    );
  }

  if (checking) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 {...iconProps} className="size-4 animate-spin" />
        {showLabel && 'Verificando'}
      </Button>
    );
  }

  const label = !isLoggedIn ? 'Receber atualizações' : isSubscribed ? 'Parar de acompanhar' : 'Ativar notificações';

  return (
    <Button
      variant={isSubscribed ? 'outline' : variant}
      size={size}
      onClick={handleToggleSubscription}
      disabled={isLoading}
      aria-label={showLabel ? undefined : label}
    >
      {isLoading ? <Loader2 {...iconProps} className="size-4 animate-spin" /> : isSubscribed ? <BellOff {...iconProps} /> : <Bell {...iconProps} />}
      {showLabel && label}
    </Button>
  );
}
