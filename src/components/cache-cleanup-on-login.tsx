"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { clearReactQueryCache } from "@/lib/react-query-persister";
import { portfolioCache } from "@/lib/portfolio-cache";

/**
 * Componente que limpa todos os caches quando um usuário anônimo faz login
 * 
 * Detecta mudança de estado de anônimo para autenticado e limpa:
 * - Cache do React Query (em memória)
 * - Cache do React Query no localStorage
 * - Cache de carteiras no localStorage
 * - Outros caches específicos da aplicação
 */
export function CacheCleanupOnLogin() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const wasAnonymousRef = useRef<boolean | null>(null); // null = ainda não inicializado
  const hasCleanedRef = useRef<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);

  useEffect(() => {
    // Aguardar até que a sessão seja carregada
    if (status === "loading") {
      return;
    }

    const isAuthenticated = !!(session?.user?.id || session?.user?.email);
    
    // Na primeira montagem, inicializar o estado baseado na sessão atual
    if (isInitialMountRef.current) {
      wasAnonymousRef.current = !isAuthenticated;
      isInitialMountRef.current = false;
      return; // Não limpar na primeira montagem, apenas inicializar
    }

    const wasAnonymous = wasAnonymousRef.current;

    // Se o usuário estava anônimo e agora está autenticado, limpar caches
    if (wasAnonymous && isAuthenticated && !hasCleanedRef.current) {
      console.log("🧹 [CACHE CLEANUP] Detectado login - limpando todos os caches...");

      try {
        // 1. Limpar cache do React Query em memória
        queryClient.clear();
        console.log("✅ [CACHE CLEANUP] Cache do React Query (memória) limpo");

        // 2. Limpar cache do React Query no localStorage
        clearReactQueryCache();
        console.log("✅ [CACHE CLEANUP] Cache do React Query (localStorage) limpo");

        // 3. Limpar cache de carteiras
        portfolioCache.clearAll();
        console.log("✅ [CACHE CLEANUP] Cache de carteiras limpo");

        // 4. Limpar outros caches específicos da aplicação
        if (typeof window !== "undefined") {
          const keysToRemove: string[] = [];

          // Coletar todas as chaves do localStorage relacionadas à aplicação
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            // Remover caches relacionados a:
            // - React Query (já removido acima, mas garantir)
            // - Portfolios (já removido acima, mas garantir)
            // - Onboarding
            // - Email capture
            // - Screening anônimo
            // - Market ticker banner
            // - Email verification banner
            // - Trial notifications
            // - Backtest preconfigured assets
            // - Ranking history
            // - Index realtime return cache
            if (
              key.startsWith("rq-cache-") ||
              key.startsWith("portfolio_") ||
              key.startsWith("onboarding-") ||
              key.startsWith("email-capture-") ||
              key === "anonymousScreeningsCount" ||
              key.startsWith("market-ticker-") ||
              key.startsWith("market-indices-cache-") ||
              key.startsWith("email-verification-") ||
              key.startsWith("trial-notification-") ||
              key.startsWith("backtest-") ||
              key.startsWith("dashboard_portfolios") ||
              key.startsWith("index-realtime-return-cache-")
            ) {
              keysToRemove.push(key);
            }
          }

          // Remover todas as chaves coletadas
          keysToRemove.forEach((key) => {
            try {
              localStorage.removeItem(key);
            } catch (error) {
              console.warn(`⚠️ [CACHE CLEANUP] Erro ao remover chave ${key}:`, error);
            }
          });

          console.log(`✅ [CACHE CLEANUP] ${keysToRemove.length} chaves adicionais removidas do localStorage`);

          // Limpar sessionStorage também (alguns dados podem estar lá)
          try {
            const sessionKeysToRemove: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (!key) continue;

              // Remover dados relacionados a ranking, prefill, etc.
              if (
                key.startsWith("prefillRanking") ||
                key.startsWith("screeningParams") ||
                key.startsWith("google-ads-transaction-")
              ) {
                sessionKeysToRemove.push(key);
              }
            }

            sessionKeysToRemove.forEach((key) => {
              try {
                sessionStorage.removeItem(key);
              } catch (error) {
                console.warn(`⚠️ [CACHE CLEANUP] Erro ao remover chave do sessionStorage ${key}:`, error);
              }
            });

            if (sessionKeysToRemove.length > 0) {
              console.log(`✅ [CACHE CLEANUP] ${sessionKeysToRemove.length} chaves removidas do sessionStorage`);
            }
          } catch (error) {
            console.warn("⚠️ [CACHE CLEANUP] Erro ao limpar sessionStorage:", error);
          }
        }

        hasCleanedRef.current = true;
        console.log("✅ [CACHE CLEANUP] Limpeza completa de caches concluída após login");
      } catch (error) {
        console.error("❌ [CACHE CLEANUP] Erro ao limpar caches:", error);
      }
    }

    // Atualizar referência do estado anterior
    wasAnonymousRef.current = !isAuthenticated;
    
    // Se o usuário fez logout, resetar flag de limpeza para permitir limpeza em próximo login
    if (!isAuthenticated) {
      hasCleanedRef.current = false;
    }
  }, [session, status, queryClient]);

  // Este componente não renderiza nada
  return null;
}

