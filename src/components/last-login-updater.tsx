'use client'

import { useUpdateLastLogin } from '@/hooks/useUpdateLastLogin'

export function LastLoginUpdater() {
  useUpdateLastLogin()
  return null // Este componente não renderiza nada
}