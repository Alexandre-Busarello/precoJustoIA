"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Componente que detecta novos usuários OAuth e adiciona ?new_user=true
 * para disparar o pixel de LEAD. Só funciona para usuários OAuth que foram
 * criados há menos de 5 minutos.
 */
export function OAuthNewUserHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const hasCheckedRef = useRef(false);
  const hasAddedParamRef = useRef(false);

  useEffect(() => {
    // Só executar uma vez quando a sessão estiver carregada
    if (status !== "authenticated" || !session?.user || hasCheckedRef.current) {
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
            // Adicionar ?new_user=true à URL
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

