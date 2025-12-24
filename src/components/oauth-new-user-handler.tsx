"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Componente que detecta novos usuários OAuth e adiciona ?new_user=true
 * para disparar o pixel de LEAD. Só funciona para usuários OAuth que foram
 * criados há menos de 5 minutos.
 * Também verifica se há um returnUrl no cookie para redirecionar após OAuth.
 */
export function OAuthNewUserHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const hasCheckedRef = useRef(false);
  const hasAddedParamRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  // Função auxiliar para obter cookie
  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    }
    return null;
  };

  // Função auxiliar para deletar cookie
  const deleteCookie = (name: string) => {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  };

  useEffect(() => {
    // Só executar uma vez quando a sessão estiver carregada
    if (status !== "authenticated" || !session?.user || hasCheckedRef.current) {
      return;
    }

    // Verificar se há returnUrl no cookie (vindo de landing page)
    const returnUrlFromCookie = getCookie("returnUrl");
    
    // Se há returnUrl no cookie e ainda não redirecionamos, redirecionar primeiro
    if (returnUrlFromCookie && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      hasCheckedRef.current = true; // Marcar como verificado para evitar execução duplicada
      
      // Verificar se é novo usuário antes de redirecionar
      const checkAndRedirect = async () => {
        try {
          const response = await fetch("/api/auth/check-new-user", {
            method: "GET",
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            // Limpar cookie antes de redirecionar
            deleteCookie("returnUrl");
            
            // Redirecionar para returnUrl com new_user=true se for novo usuário
            const redirectUrl = data.isNewUser 
              ? `${returnUrlFromCookie}${returnUrlFromCookie.includes('?') ? '&' : '?'}new_user=true`
              : returnUrlFromCookie;
            
            console.log(`[OAUTH] Redirecionando para returnUrl: ${redirectUrl}`, { isNewUser: data.isNewUser });
            router.push(redirectUrl);
            return;
          }
        } catch (error) {
          console.error("Erro ao verificar novo usuário OAuth:", error);
          // Em caso de erro, limpar cookie e redirecionar mesmo assim
          deleteCookie("returnUrl");
          router.push(returnUrlFromCookie);
        }
      };

      checkAndRedirect();
      return;
    }

    // Se já tem ?new_user=true, não fazer nada
    if (searchParams.get("new_user") === "true") {
      hasCheckedRef.current = true;
      return;
    }

    // Verificar se é um novo usuário OAuth (criado há menos de 5 minutos)
    const checkNewOAuthUser = async () => {
      try {
        const response = await fetch("/api/auth/check-new-user", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isNewUser && !hasAddedParamRef.current) {
            // Adicionar ?new_user=true à URL atual
            const url = new URL(window.location.href);
            url.searchParams.set("new_user", "true");
            router.replace(url.pathname + url.search, { scroll: false });
            hasAddedParamRef.current = true;
          }
        }
      } catch (error) {
        console.error("Erro ao verificar novo usuário OAuth:", error);
      } finally {
        hasCheckedRef.current = true;
      }
    };

    checkNewOAuthUser();
  }, [status, session, router, searchParams]);

  return null;
}

