"use client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // staleTime: dados são considerados "frescos" por 5 minutos
            // Durante esse tempo, mesmo se o componente remontar, não fará refetch
            staleTime: 5 * 60 * 1000, // 5 minutos
            // gcTime: dados permanecem no cache por 10 minutos após não serem usados
            // Isso permite que ao trocar de aba e voltar, os dados ainda estejam em cache
            gcTime: 10 * 60 * 1000, // 10 minutos
            // Retry em caso de erro
            retry: 3,
            // Não refazer quando a janela recebe foco (evita requests desnecessários)
            refetchOnWindowFocus: false,
            // Comportamento de refetch ao montar:
            // - 'always': sempre refetch (padrão)
            // - true: refetch apenas se dados estão stale (fora do staleTime)
            // - false: nunca refetch, usa cache sempre que disponível
            // Usando false para evitar refetch ao trocar de aba
            refetchOnMount: false,
            // Não refazer quando reconectar (evita requests desnecessários)
            refetchOnReconnect: false,
          },
          mutations: {
            retry: 3,
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

