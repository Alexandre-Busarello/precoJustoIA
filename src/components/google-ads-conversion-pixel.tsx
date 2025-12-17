"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getLeadConversionTransactionId } from "@/lib/google-ads-transaction-id";

/**
 * Componente para disparar evento de conversão do Google Ads
 * Dispara quando o usuário acessa uma página com ?new_user=true (pós-cadastro)
 * 
 * Uso recomendado:
 * - Na página /verificar-email após cadastro por email (evita quebra de sessão)
 * - Na página /dashboard após cadastro OAuth ou validação de email
 * 
 * Garante que o evento seja enviado apenas uma vez por montagem
 * e previne race conditions usando useRef
 * Usa transactionId único persistido em sessionStorage para deduplicação em refresh
 * 
 * Melhorias de resiliência:
 * - Fallback para dataLayer quando gtag não está disponível
 * - Retry com verificação de dataLayer também
 * - Logs de debug para rastreamento
 */
export function GoogleAdsConversionPixel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasFiredRef = useRef(false);
  const isFiringRef = useRef(false);
  const transactionIdRef = useRef<string | null>(null);

  // Verificar se é um novo usuário (pós-cadastro)
  const isNewUser = searchParams.get("new_user") === "true";

  useEffect(() => {
    /**
     * Função auxiliar para disparar o pixel de conversão
     * Tenta usar gtag primeiro, se não estiver disponível, usa dataLayer diretamente
     * @param transactionId - ID único da transação
     * @returns true se o pixel foi disparado com sucesso, false caso contrário
     */
    const fireConversionPixel = (transactionId: string): boolean => {
      if (typeof window === "undefined") {
        return false;
      }

      const gTagExists = typeof (window as any).gtag === "function";
      const dataLayerExists = Array.isArray((window as any).dataLayer);

      const conversionData = {
        send_to: "AW-17611977676/nd5yCJ-Us88bEMznhc5B",
        value: 1.0,
        currency: "BRL",
        transaction_id: transactionId,
      };

      try {
        if (gTagExists) {
          // Método preferido: usar gtag()
          (window as any).gtag("event", "conversion", conversionData);
          console.log("Pixel disparado via gtag()", { transactionId });
          return true;
        } else if (dataLayerExists) {
          // Fallback robusto: usar dataLayer diretamente
          (window as any).dataLayer.push({
            event: "conversion",
            ...conversionData,
          });
          console.log("Pixel disparado via dataLayer.push()", { transactionId });
          return true;
        } else {
          console.warn("Google Ads tags não encontradas (gtag e dataLayer indisponíveis)", {
            transactionId,
          });
          return false;
        }
      } catch (error) {
        console.error("Erro ao disparar pixel de conversão do Google Ads:", error, {
          transactionId,
        });
        return false;
      }
    };

    /**
     * Limpa o parâmetro new_user da URL após disparar o pixel
     */
    const clearNewUserParam = () => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("new_user");
        const newUrl = url.pathname + (url.search ? url.search : "");
        router.replace(newUrl, { scroll: false });
      } catch (error) {
        console.error("Erro ao limpar parâmetro new_user da URL:", error);
      }
    };
    // Só disparar se for um novo usuário (tem ?new_user=true na URL)
    if (!isNewUser) {
      return;
    }

    // Prevenir disparo duplicado: verificar se já foi disparado ou está em processo
    if (hasFiredRef.current || isFiringRef.current) {
      return;
    }

    // Obter transactionId único (persistido em sessionStorage para deduplicação)
    if (!transactionIdRef.current) {
      transactionIdRef.current = getLeadConversionTransactionId();
    }

    const transactionId = transactionIdRef.current;

    // Log para debug
    console.log("Tentando disparar pixel...", { transactionId });

    // Marcar como em processo para evitar race conditions
    isFiringRef.current = true;

    // Tentar disparar imediatamente
    const success = fireConversionPixel(transactionId);

    if (success) {
      // Marcar como disparado
      hasFiredRef.current = true;
      isFiringRef.current = false;

      // Limpar query param após disparar para evitar disparos em refresh
      clearNewUserParam();
    } else {
      // Se não conseguiu disparar, aguardar um pouco e tentar novamente
      // Isso pode acontecer se o script ainda não carregou completamente
      const retryTimeout = setTimeout(() => {
        const finalTransactionId = transactionIdRef.current || getLeadConversionTransactionId();
        console.log("Retry: Tentando disparar pixel novamente...", { transactionId: finalTransactionId });

        const retrySuccess = fireConversionPixel(finalTransactionId);

        if (retrySuccess) {
          hasFiredRef.current = true;
          clearNewUserParam();
        } else {
          // Se ainda não conseguiu após retry, marcar como processado
          // para evitar tentativas infinitas
          console.warn("Pixel não pôde ser disparado após retry", { transactionId: finalTransactionId });
          hasFiredRef.current = true;
        }

        isFiringRef.current = false;
      }, 1000);

      // Limpar timeout se componente for desmontado
      return () => {
        clearTimeout(retryTimeout);
        isFiringRef.current = false;
      };
    }
  }, [isNewUser, router]);

  // Componente não renderiza nada visualmente
  return null;
}

