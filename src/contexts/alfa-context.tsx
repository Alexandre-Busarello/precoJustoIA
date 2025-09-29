'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface AlfaStats {
  phase: string
  userLimit: number
  endDate: string
  currentUsers: number
  spotsAvailable: number
  isLimitReached: boolean
}

interface AlfaContextType {
  stats: AlfaStats | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const AlfaContext = createContext<AlfaContextType | undefined>(undefined)

interface AlfaProviderProps {
  children: ReactNode
}

export function AlfaProvider({ children }: AlfaProviderProps) {
  const [stats, setStats] = useState<AlfaStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlfaStats = async () => {
    try {
      setError(null)
      const response = await fetch('/api/alfa/register-check')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setStats(data.stats)
    } catch (error) {
      console.error('Erro ao buscar estatísticas da fase Alfa:', error)
      setError(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  const refetch = async () => {
    setIsLoading(true)
    await fetchAlfaStats()
  }

  useEffect(() => {
    fetchAlfaStats()
  }, [])

  const value: AlfaContextType = {
    stats,
    isLoading,
    error,
    refetch
  }

  return (
    <AlfaContext.Provider value={value}>
      {children}
    </AlfaContext.Provider>
  )
}

export function useAlfa(): AlfaContextType {
  const context = useContext(AlfaContext)
  if (context === undefined) {
    throw new Error('useAlfa must be used within an AlfaProvider')
  }
  return context
}

// Hook específico para verificar se está na fase ALFA
export function useIsAlfaPhase(): boolean {
  const { stats } = useAlfa()
  return stats?.phase === 'ALFA'
}

// Hook específico para verificar se as vagas estão esgotadas
export function useIsLimitReached(): boolean {
  const { stats } = useAlfa()
  return stats?.isLimitReached || false
}
