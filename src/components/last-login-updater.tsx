'use client'

import { useUpdateLastLogin } from '@/hooks/useUpdateLastLogin'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export function LastLoginUpdater() {
  const { data: session, status } = useSession()
  useUpdateLastLogin()

  // Processar OAuth após login bem-sucedido
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Verificar se é login via OAuth (Google)
      // Se o usuário não tem password, provavelmente é OAuth
      // Chamar endpoint para processar OAuth e registrar IP
      fetch('/api/auth/process-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(() => {
        // Ignorar erros silenciosamente
      })
    }
  }, [session, status])

  return null // Este componente não renderiza nada
}