'use client'

import { useState, useEffect } from 'react'

interface TrialAvailableResponse {
  isAvailable: boolean
  trialEnabled: boolean
  isProd: boolean
  message: string
}

/**
 * Hook para verificar se o trial está disponível para novos usuários
 * Retorna se ENABLE_TRIAL=true E fase PROD
 */
export function useTrialAvailable() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [trialEnabled, setTrialEnabled] = useState<boolean>(false)
  const [isProd, setIsProd] = useState<boolean>(false)

  useEffect(() => {
    const checkTrialAvailable = async () => {
      try {
        const response = await fetch('/api/trial/available')
        if (response.ok) {
          const data: TrialAvailableResponse = await response.json()
          setIsAvailable(data.isAvailable)
          setTrialEnabled(data.trialEnabled)
          setIsProd(data.isProd)
        } else {
          setIsAvailable(false)
        }
      } catch (error) {
        console.error('Erro ao verificar disponibilidade do trial:', error)
        setIsAvailable(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkTrialAvailable()
  }, [])

  return {
    isAvailable,
    isLoading,
    trialEnabled,
    isProd
  }
}

