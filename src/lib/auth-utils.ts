/**
 * Utilitários para gerenciamento de autenticação e tokens
 */

import { JWT } from "next-auth/jwt"

/**
 * Verifica se um token JWT está expirado
 * @param token - Token JWT a ser verificado
 * @returns true se o token está expirado ou inválido, false caso contrário
 */
export function isTokenExpired(token: JWT | null | undefined): boolean {
  if (!token) {
    return true
  }

  // Tokens sem exp ou iat são considerados inválidos (tokens antigos)
  if (!token.exp || !token.iat) {
    return true
  }

  // Verificar se o token expirou
  return Date.now() >= token.exp * 1000
}

/**
 * Verifica se um token JWT é válido (não expirado e tem campos obrigatórios)
 * @param token - Token JWT a ser verificado
 * @returns true se o token é válido, false caso contrário
 */
export function isTokenValid(token: JWT | null | undefined): boolean {
  return !isTokenExpired(token)
}

/**
 * Obtém o tempo restante até a expiração do token em milissegundos
 * @param token - Token JWT
 * @returns Tempo restante em milissegundos, ou 0 se expirado/inválido
 */
export function getTokenTimeRemaining(token: JWT | null | undefined): number {
  if (!token || !token.exp) {
    return 0
  }

  const remaining = token.exp * 1000 - Date.now()
  return remaining > 0 ? remaining : 0
}

/**
 * Trata erros de sessão expirada ou inválida
 * @param error - Erro capturado
 * @returns true se o erro é relacionado a expiração/invalidação de token
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Token expirado') ||
      error.message.includes('Token inválido') ||
      error.message.includes('requer novo login')
    )
  }
  return false
}

