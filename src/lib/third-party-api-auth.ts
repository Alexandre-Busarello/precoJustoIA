import { NextRequest, NextResponse } from 'next/server';

/**
 * Valida a API key de terceiros no header Authorization
 * 
 * @param request - Requisição do Next.js
 * @returns Objeto com resultado da validação ou null se válido
 */
export function validateThirdPartyApiKey(
  request: NextRequest
): { isValid: boolean; error?: NextResponse } {
  const API_KEY = process.env.THIRD_PARTY_API_KEY;

  // Se não há API key configurada, retornar erro
  if (!API_KEY) {
    console.error('❌ [THIRD_PARTY_API] THIRD_PARTY_API_KEY não configurada');
    return {
      isValid: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'API key não configurada no servidor',
          code: 'SERVER_ERROR'
        },
        { status: 500 }
      )
    };
  }

  // Buscar o header Authorization
  const authHeader = request.headers.get('authorization');

  // Verificar se o header existe e tem o formato correto
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      isValid: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Não autorizado. API key inválida ou ausente',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    };
  }

  // Extrair o token do header
  const token = authHeader.substring(7);

  // Validar se o token corresponde à API key configurada
  if (token !== API_KEY) {
    console.warn('⚠️ [THIRD_PARTY_API] Tentativa de acesso com API key inválida');
    return {
      isValid: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Não autorizado. API key inválida ou ausente',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    };
  }

  // API key válida
  return { isValid: true };
}









