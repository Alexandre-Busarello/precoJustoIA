/**
 * Utilitário para disparar pixel de engajamento do Google Ads
 * EXCLUSIVO para usuários anônimos/deslogados
 * Dispara apenas UMA VEZ por sessão do usuário
 */

/**
 * Gera um UUID v4 simples
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_KEY_FIRED = 'google_ads_engagement_fired';
const STORAGE_KEY_TRANSACTION_ID = 'google_ads_engagement_transaction_id';

/**
 * Obtém ou gera um transactionId único para o pixel de engajamento
 * O ID persiste durante a sessão (sessionStorage) para garantir consistência
 */
function getEngagementTransactionId(): string {
  if (typeof window === "undefined") {
    // Server-side: retornar ID temporário (será substituído no client)
    return generateUUID();
  }

  // Tentar recuperar ID existente do sessionStorage
  const existingId = sessionStorage.getItem(STORAGE_KEY_TRANSACTION_ID);
  if (existingId) {
    return existingId;
  }

  // Gerar novo ID e armazenar
  const newId = generateUUID();
  sessionStorage.setItem(STORAGE_KEY_TRANSACTION_ID, newId);
  return newId;
}

/**
 * Verifica se o pixel de engajamento já foi disparado nesta sessão
 */
export function hasEngagementPixelFired(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(STORAGE_KEY_FIRED) === 'true';
}

/**
 * Marca o pixel de engajamento como disparado nesta sessão
 */
function markEngagementPixelFired(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(STORAGE_KEY_FIRED, 'true');
}

/**
 * Dispara o pixel de conversão de engajamento do Google Ads
 * 
 * CRÍTICO: 
 * - Só dispara se usuário estiver DESLOGADO (isAnonymous === true)
 * - Dispara apenas UMA VEZ por sessão do usuário
 * - Usa UUID único por sessão para garantir consistência no Google Ads
 * 
 * @param isAnonymous - Se true, usuário está deslogado e pixel pode ser disparado
 * @returns true se o pixel foi disparado com sucesso, false caso contrário
 */
export function fireEngagementPixel(isAnonymous: boolean): boolean {
  // Verificação obrigatória: só disparar se usuário estiver deslogado
  if (!isAnonymous) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  // CRÍTICO: Verificar se já foi disparado nesta sessão
  if (hasEngagementPixelFired()) {
    return false; // Já foi disparado, não disparar novamente
  }

  // Obter ou gerar transaction_id único por sessão
  const transactionId = getEngagementTransactionId();

  const gTagExists = typeof (window as any).gtag === "function";
  const dataLayerExists = Array.isArray((window as any).dataLayer);

  const conversionData = {
    send_to: "AW-17611977676/JYUICKSg49UbEMznhc5B",
    value: 0.1,
    currency: "BRL",
    transaction_id: transactionId,
  };

  try {
    if (gTagExists) {
      // Método preferido: usar gtag()
      (window as any).gtag("event", "conversion", conversionData);
      
      if (process.env.NODE_ENV === 'development') {
        console.log("Pixel de engajamento disparado via gtag()", { transactionId });
      }
      
      // Marcar como disparado após sucesso
      markEngagementPixelFired();
      return true;
    } else if (dataLayerExists) {
      // Fallback robusto: usar dataLayer diretamente
      (window as any).dataLayer.push({
        event: "conversion",
        ...conversionData,
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log("Pixel de engajamento disparado via dataLayer.push()", { transactionId });
      }
      
      // Marcar como disparado após sucesso
      markEngagementPixelFired();
      return true;
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn("Google Ads tags não encontradas (gtag e dataLayer indisponíveis)");
      }
      return false;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Erro ao disparar pixel de engajamento do Google Ads:", error);
    }
    return false;
  }
}

