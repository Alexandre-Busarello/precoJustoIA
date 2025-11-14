"use client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // staleTime muito curto: dados são considerados "frescos" por apenas 2 segundos
            // Isso permite deduplicação durante a mesma renderização, mas não mantém cache por muito tempo
            staleTime: 15 * 1000, // 15 segundos
            // gcTime curto: dados são removidos do cache após 5 segundos de não uso
            // Isso garante que não acumulemos dados antigos em memória
            gcTime: 45 * 1000, // 45 segundos
            // Retry em caso de erro
            retry: 2,
            // Não refazer quando a janela recebe foco (evita requests desnecessários)
            refetchOnWindowFocus: false,
            // Sempre buscar dados frescos quando o componente montar
            refetchOnMount: true,
            // Não refazer quando reconectar (evita requests desnecessários)
            refetchOnReconnect: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

