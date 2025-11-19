'use client'

import { useUpdateLastLogin } from '@/hooks/useUpdateLastLogin'
import { useProcessOAuth } from '@/hooks/use-user-data'

export function LastLoginUpdater() {
  useUpdateLastLogin()
  useProcessOAuth() // Processa OAuth com cache (evita múltiplas chamadas)

  return null // Este componente não renderiza nada
}