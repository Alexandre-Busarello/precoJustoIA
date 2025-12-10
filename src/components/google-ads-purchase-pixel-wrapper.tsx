"use client";

import { useEffect, useState } from "react";
import { usePaymentVerification } from "@/components/session-refresh-provider";
import { GoogleAdsPurchasePixel } from "./google-ads-purchase-pixel";

interface GoogleAdsPurchasePixelWrapperProps {
  /**
   * Status Premium inicial do usuário
   * O pixel só será disparado quando o usuário realmente se tornar Premium
   */
  initialIsPremium: boolean;
}

/**
 * Wrapper para GoogleAdsPurchasePixel que só dispara quando o usuário
 * realmente se torna Premium. Monitora o status Premium e aguarda confirmação
 * antes de disparar o pixel de conversão.
 */
export function GoogleAdsPurchasePixelWrapper({
  initialIsPremium,
}: GoogleAdsPurchasePixelWrapperProps) {
  const { startVerification, checkSession } = usePaymentVerification();
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  // Se já é Premium inicialmente, marcar como disparado para renderizar imediatamente
  const [hasFiredPixel, setHasFiredPixel] = useState(initialIsPremium);

  useEffect(() => {
    // Se o usuário já é Premium inicialmente, não precisa fazer nada
    // (hasFiredPixel já é true e o pixel será renderizado imediatamente)
    if (initialIsPremium) {
      return;
    }

    // Se o usuário ainda não é Premium, iniciar verificação
    if (!hasFiredPixel) {
      startVerification();

      // Verificar periodicamente se a sessão foi atualizada
      const checkInterval = setInterval(async () => {
        const updatedUser = await checkSession();
        if (updatedUser && updatedUser.subscriptionTier === "PREMIUM") {
          console.log("✅ Usuário agora é Premium! Disparando pixel de compra...");
          setIsPremium(true);
          setHasFiredPixel(true);
          clearInterval(checkInterval);
        }
      }, 2000);

      // Parar verificação após 2 minutos
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
      }, 120000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [initialIsPremium, hasFiredPixel, startVerification, checkSession]);

  // Só renderizar o pixel se o usuário for Premium e ainda não tiver disparado
  if (isPremium && hasFiredPixel) {
    return <GoogleAdsPurchasePixel />;
  }

  // Não renderizar nada enquanto aguarda confirmação Premium
  return null;
}

