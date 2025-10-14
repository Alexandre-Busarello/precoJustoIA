'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { usePremiumStatus } from '@/hooks/use-premium-status';

interface AssetSubscriptionButtonProps {
  ticker: string;
  companyId: number; // Mantido para uso futuro
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export default function AssetSubscriptionButton({
  ticker,
  companyId, // eslint-disable-line @typescript-eslint/no-unused-vars
  variant = 'outline',
  size = 'default',
  showLabel = true,
}: AssetSubscriptionButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { data: session } = useSession();
  const { isPremium, isLoading: isPremiumLoading } = usePremiumStatus();
  const { toast } = useToast();
  const router = useRouter();

  // Verificar status da inscrição ao carregar
  useEffect(() => {
    if (session?.user) {
      checkSubscriptionStatus();
    } else {
      setIsChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ticker]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`);
      const data = await response.json();
      setIsSubscribed(data.isSubscribed || false);
    } catch (error) {
      console.error('Erro ao verificar inscrição:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleToggleSubscription = async () => {
    // Verificar autenticação
    if (!session?.user) {
      toast({
        title: 'Autenticação necessária',
        description: 'Faça login para receber notificações sobre este ativo',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }

    // Verificar Premium
    if (!isPremium) {
      toast({
        title: '👑 Recurso Premium',
        description: 'Assine o plano Premium para receber atualizações automáticas sobre seus ativos favoritos',
        variant: 'destructive',
      });
      router.push('/planos');
      return;
    }

    setIsLoading(true);

    try {
      if (isSubscribed) {
        // Cancelar inscrição
        const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok) {
          setIsSubscribed(false);
          toast({
            title: 'Inscrição cancelada',
            description: `Você não receberá mais notificações sobre ${ticker}`,
          });
        } else {
          throw new Error(data.error || 'Erro ao cancelar inscrição');
        }
      } else {
        // Criar inscrição
        const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`, {
          method: 'POST',
        });

        const data = await response.json();

        if (response.ok) {
          setIsSubscribed(true);
          toast({
            title: 'Inscrição realizada!',
            description: `Você receberá notificações quando houver mudanças relevantes em ${ticker}`,
          });
        } else {
          throw new Error(data.error || 'Erro ao criar inscrição');
        }
      }
    } catch (error: any) {
      console.error('Erro ao alterar inscrição:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao processar solicitação',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Estado de carregamento inicial
  if (isChecking || isPremiumLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel && <span className="ml-2">Verificando...</span>}
      </Button>
    );
  }

  // Usuários não autenticados ou não-premium: mostrar com badge Premium
  if (!session?.user || !isPremium) {
    return (
      <div className="flex items-center gap-2">
        <Button 
          variant={variant} 
          size={size} 
          onClick={handleToggleSubscription}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {showLabel && <span className="ml-2">Receber Atualizações</span>}
        </Button>
        {session?.user && !isPremium && (
          <Badge 
            variant="default" 
            className="bg-gradient-to-r from-amber-500 to-orange-600 whitespace-nowrap"
          >
            <Crown className="w-3 h-3 mr-1" />
            Premium
          </Badge>
        )}
      </div>
    );
  }

  // Usuário Premium autenticado
  return (
    <Button
      variant={isSubscribed ? 'default' : variant}
      size={size}
      onClick={handleToggleSubscription}
      disabled={isLoading}
      className={isSubscribed ? 'bg-green-600 hover:bg-green-700' : ''}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-4 w-4 fill-current" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-2">
          {isSubscribed ? 'Inscrito' : 'Receber Atualizações'}
        </span>
      )}
    </Button>
  );
}

