'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateAssetSubscriptionCache } from '@/hooks/use-company-data';

interface AutoSubscribeHandlerProps {
  ticker: string;
}

export function AutoSubscribeHandler({ ticker }: AutoSubscribeHandlerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Aguardar autenticação estar completa
    if (status === 'loading') return;

    // Verificar se há parâmetro subscribe=true e usuário está autenticado
    const shouldSubscribe = searchParams.get('subscribe') === 'true';
    const isAuthenticated = status === 'authenticated' && session?.user;

    if (shouldSubscribe && isAuthenticated) {
      // Remover parâmetro da URL
      const newUrl = window.location.pathname;
      router.replace(newUrl, { scroll: false });

      // Inscrever automaticamente
      const subscribe = async () => {
        try {
          const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`, {
            method: 'POST',
          });

          const data = await response.json();

          if (response.ok) {
            // Invalidar cache de subscription (React Query + localStorage) e forçar refetch
            invalidateAssetSubscriptionCache(queryClient, ticker);
            // Forçar refetch imediato sem usar cache
            await queryClient.refetchQueries({ 
              queryKey: ['asset-subscription', ticker.toUpperCase()],
              type: 'active'
            });
            
            toast({
              title: 'Inscrição realizada!',
              description: `Você receberá notificações quando houver mudanças relevantes em ${ticker}`,
            });
          } else {
            // Se já estiver inscrito, não mostrar erro
            if (data.error?.includes('já está inscrito')) {
              // Invalidar cache mesmo se já estiver inscrito para garantir que o status está atualizado
              invalidateAssetSubscriptionCache(queryClient, ticker);
              // Forçar refetch imediato sem usar cache
              await queryClient.refetchQueries({ 
                queryKey: ['asset-subscription', ticker.toUpperCase()],
                type: 'active'
              });
              
              toast({
                title: 'Você já está inscrito',
                description: `Você receberá notificações sobre ${ticker}`,
              });
            }
          }
        } catch (error) {
          console.error('Erro ao inscrever automaticamente:', error);
        }
      };

      subscribe();
    }
  }, [searchParams, router, session, status, ticker, toast, queryClient]);

  return null;
}

