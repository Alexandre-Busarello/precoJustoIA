"use client";

import { useEffect, useRef } from "react";
import { getPurchaseConversionTransactionId } from "@/lib/google-ads-transaction-id";

interface GoogleAdsPurchasePixelProps {
  /**
   * ID da transação (opcional)
   * Se não fornecido, será gerado automaticamente e persistido em sessionStorage
   * para deduplicação em caso de refresh
   */
  transactionId?: string;
}

/**
 * Componente para disparar evento de conversão de COMPRA do Google Ads
 * Garante que o evento seja enviado apenas uma vez por montagem
 * e previne race conditions usando useRef
 * Usa transactionId único persistido em sessionStorage para deduplicação em refresh
 * 
 * Melhorias de resiliência:
 * - Fallback para dataLayer quando gtag não está disponível
 * - Retry com verificação de dataLayer também
 * - Logs de debug para rastreamento
 */
export function GoogleAdsPurchasePixel({ transactionId }: GoogleAdsPurchasePixelProps) {
  const hasFiredRef = useRef(false);
  const isFiringRef = useRef(false);
  const transactionIdRef = useRef<string | null>(null);

  useEffect(() => {
    /**
     * Função auxiliar para disparar o pixel de conversão de compra
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
        send_to: "AW-17611977676/LsUpCM6Xws8bEMznhc5B",
        value: 20.0,
        currency: "BRL",
        transaction_id: transactionId,
      };

      try {
        if (gTagExists) {
          // Método preferido: usar gtag()
          (window as any).gtag("event", "conversion", conversionData);
          console.log("Pixel de compra disparado via gtag()", { transactionId });
          return true;
        } else if (dataLayerExists) {
          // Fallback robusto: usar dataLayer diretamente
          (window as any).dataLayer.push({
            event: "conversion",
            ...conversionData,
          });
          console.log("Pixel de compra disparado via dataLayer.push()", { transactionId });
          return true;
        } else {
          console.warn("Google Ads tags não encontradas (gtag e dataLayer indisponíveis)", {
            transactionId,
          });
          return false;
        }
      } catch (error) {
        console.error("Erro ao disparar pixel de conversão de compra do Google Ads:", error, {
          transactionId,
        });
        return false;
      }
    };

    // Prevenir disparo duplicado: verificar se já foi disparado ou está em processo
    if (hasFiredRef.current || isFiringRef.current) {
      return;
    }

    // Obter transactionId: usar o fornecido como prop ou gerar/persistir um único
    if (!transactionIdRef.current) {
      transactionIdRef.current = transactionId || getPurchaseConversionTransactionId();
    }

    const finalTransactionId = transactionIdRef.current;

    // Log para debug
    console.log("Tentando disparar pixel de compra...", { transactionId: finalTransactionId });

    // Marcar como em processo para evitar race conditions
    isFiringRef.current = true;

    // Tentar disparar imediatamente
    const success = fireConversionPixel(finalTransactionId);

    if (success) {
      // Marcar como disparado
      hasFiredRef.current = true;
      isFiringRef.current = false;
    } else {
      // Se não conseguiu disparar, aguardar um pouco e tentar novamente
      // Isso pode acontecer se o script ainda não carregou completamente
      const retryTimeout = setTimeout(() => {
        const retryTransactionId =
          transactionIdRef.current || transactionId || getPurchaseConversionTransactionId();
        console.log("Retry: Tentando disparar pixel de compra novamente...", {
          transactionId: retryTransactionId,
        });

        const retrySuccess = fireConversionPixel(retryTransactionId);

        if (retrySuccess) {
          hasFiredRef.current = true;
        } else {
          // Se ainda não conseguiu após retry, marcar como processado
          // para evitar tentativas infinitas
          console.warn("Pixel de compra não pôde ser disparado após retry", {
            transactionId: retryTransactionId,
          });
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
  }, [transactionId]);

  // Componente não renderiza nada visualmente
  return null;
}

