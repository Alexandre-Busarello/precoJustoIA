'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { usePremiumStatus } from '@/hooks/use-premium-status';

interface AssetSubscriptionButtonProps {
  ticker: string;
  companyId: number; // Mantido para uso futuro
  variant?: 'default' | 'outline' | 'ghost' | 'card';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export default function AssetSubscriptionButton({
  ticker,
  companyId, // eslint-disable-line @typescript-eslint/no-unused-vars
  variant = 'card',
  size = 'default',
  showLabel = true,
}: AssetSubscriptionButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { data: session } = useSession();
  const { isLoading: isPremiumLoading } = usePremiumStatus();
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
    // Verificar autenticação - redirecionar para registro/login para capturar lead
    if (!session?.user) {
      // Salvar o ticker na URL para redirecionar após login
      const callbackUrl = `/acao/${ticker.toLowerCase()}?subscribe=true`;
      router.push(`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`);
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

  // Versão Card destacada
  if (variant === 'card') {
    if (isChecking || isPremiumLoading) {
      return (
        <Card className="border border-dashed border-muted bg-muted/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Verificando...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Card discreto quando inscrito
    if (isSubscribed) {
      return (
        <Card className="border border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                  <Bell className="h-4 w-4 fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Recebendo notificações sobre {ticker}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleToggleSubscription}
                disabled={isLoading}
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <BellOff className="h-4 w-4 mr-1.5" />
                    Cancelar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Card destacado quando não inscrito (logado ou não)
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-50 dark:from-primary/10 dark:to-purple-950/20 hover:border-primary/40 transition-all duration-200 hover:shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Ícone */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary dark:bg-primary/20 flex items-center justify-center">
                <Mail className="h-6 w-6" />
              </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
                Receba Notificações por Email
              </h3>
              <p className="text-sm text-muted-foreground mb-3 sm:mb-0">
                {session?.user 
                  ? `Seja notificado por email quando houver mudanças significativas nos fundamentos de ${ticker}`
                  : `Crie uma conta gratuita e receba notificações quando houver mudanças relevantes em ${ticker}`
                }
              </p>
            </div>

            {/* Botão de Ação */}
            <div className="flex-shrink-0">
              <Button
                onClick={handleToggleSubscription}
                disabled={isLoading}
                size="default"
                className="w-full sm:w-auto min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {session?.user ? 'Ativando...' : 'Carregando...'}
                  </>
                ) : session?.user ? (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Ativar Notificações
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Criar Conta Grátis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Versão botão simples (para compatibilidade)
  if (isChecking || isPremiumLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel && <span className="ml-2">Verificando...</span>}
      </Button>
    );
  }

  // Usuários não autenticados
  if (!session?.user) {
    return (
      <Button 
        variant={variant} 
        size={size} 
        onClick={handleToggleSubscription}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {showLabel && <span className="ml-2">Receber Atualizações</span>}
      </Button>
    );
  }

  // Usuário autenticado (Premium ou Gratuito)
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

