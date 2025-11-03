'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'

export function useUpdateLastLogin() {
  const { data: session, status } = useSession()
  const hasUpdated = useRef(false)

  useEffect(() => {
    // Só executa uma vez por sessão e apenas se o usuário estiver autenticado
    if (status === 'authenticated' && session?.user && !hasUpdated.current) {
      hasUpdated.current = true
      
      // Fazer a chamada para atualizar o último login
      fetch('/api/auth/update-last-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(() => {
        // Ignorar erros silenciosamente
        // Se falhar, tentará novamente na próxima sessão
        hasUpdated.current = false
      })
    }
  }, [session, status])
}