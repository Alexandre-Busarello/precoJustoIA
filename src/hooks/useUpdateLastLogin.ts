/**
 * Hook para atualizar último login do usuário
 * Agora usa React Query com cache de 1 hora
 * Re-exporta do use-user-data para manter compatibilidade
 */

'use client'

export { useUpdateLastLogin } from '@/hooks/use-user-data'