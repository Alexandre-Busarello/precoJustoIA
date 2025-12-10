"use client";

import { useEffect, useRef } from "react";
import { getLeadConversionTransactionId } from "@/lib/google-ads-transaction-id";

/**
 * Componente para disparar evento de conversão do Google Ads
 * Garante que o evento seja enviado apenas uma vez por montagem
 * e previne race conditions usando useRef
 * Usa transactionId único persistido em sessionStorage para deduplicação em refresh
 */
export function GoogleAdsConversionPixel() {
  const hasFiredRef = useRef(false);
  const isFiringRef = useRef(false);
  const transactionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Prevenir disparo duplicado: verificar se já foi disparado ou está em processo
    if (hasFiredRef.current || isFiringRef.current) {
      return;
    }

    // Obter transactionId único (persistido em sessionStorage para deduplicação)
    if (!transactionIdRef.current) {
      transactionIdRef.current = getLeadConversionTransactionId();
    }

    // Marcar como em processo para evitar race conditions
    isFiringRef.current = true;

    // Verificar se gtag está disponível
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      try {
        // Disparar evento de conversão com transactionId único
        (window as any).gtag("event", "conversion", {
          send_to: "AW-17611977676/nd5yCJ-Us88bEMznhc5B",
          value: 1.0,
          currency: "BRL",
          transaction_id: transactionIdRef.current,
        });

        // Marcar como disparado
        hasFiredRef.current = true;
        isFiringRef.current = false;
      } catch (error) {
        // Em caso de erro, marcar como processado para evitar tentativas infinitas
        hasFiredRef.current = true;
        isFiringRef.current = false;
        console.error("Erro ao disparar pixel de conversão do Google Ads:", error);
      }
    } else {
      // Se gtag não estiver disponível ainda, aguardar um pouco e tentar novamente
      // Isso pode acontecer se o script ainda não carregou completamente
      const retryTimeout = setTimeout(() => {
        if (typeof (window as any).gtag === "function") {
          try {
            (window as any).gtag("event", "conversion", {
              send_to: "AW-17611977676/nd5yCJ-Us88bEMznhc5B",
              value: 1.0,
              currency: "BRL",
              transaction_id: transactionIdRef.current || getLeadConversionTransactionId(),
            });
            hasFiredRef.current = true;
          } catch (error) {
            console.error("Erro ao disparar pixel de conversão do Google Ads (retry):", error);
            hasFiredRef.current = true; // Marcar como processado mesmo em caso de erro
          }
        } else {
          // Se gtag ainda não estiver disponível após retry, marcar como processado
          // para evitar tentativas infinitas
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
  }, []);

  // Componente não renderiza nada visualmente
  return null;
}

