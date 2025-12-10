/**
 * Utilitário para gerar e persistir transactionIds únicos para pixels do Google Ads
 * Usa sessionStorage para garantir que o mesmo ID seja reutilizado em caso de refresh
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

/**
 * Obtém ou gera um transactionId único para o pixel de inscrição
 * O ID persiste durante a sessão (sessionStorage) para evitar duplicações em refresh
 */
export function getLeadConversionTransactionId(): string {
  if (typeof window === "undefined") {
    // Server-side: retornar ID temporário (será substituído no client)
    return generateUUID();
  }

  const storageKey = "google_ads_lead_conversion_transaction_id";
  
  // Tentar recuperar ID existente do sessionStorage
  const existingId = sessionStorage.getItem(storageKey);
  if (existingId) {
    return existingId;
  }

  // Gerar novo ID e armazenar
  const newId = generateUUID();
  sessionStorage.setItem(storageKey, newId);
  return newId;
}

/**
 * Obtém ou gera um transactionId único para o pixel de compra
 * O ID persiste durante a sessão (sessionStorage) para evitar duplicações em refresh
 */
export function getPurchaseConversionTransactionId(): string {
  if (typeof window === "undefined") {
    // Server-side: retornar ID temporário (será substituído no client)
    return generateUUID();
  }

  const storageKey = "google_ads_purchase_conversion_transaction_id";
  
  // Tentar recuperar ID existente do sessionStorage
  const existingId = sessionStorage.getItem(storageKey);
  if (existingId) {
    return existingId;
  }

  // Gerar novo ID e armazenar
  const newId = generateUUID();
  sessionStorage.setItem(storageKey, newId);
  return newId;
}

