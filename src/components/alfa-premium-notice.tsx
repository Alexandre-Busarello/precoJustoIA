'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Calendar } from 'lucide-react'

interface AlfaStats {
  phase: string
  endDate: string
}

export function AlfaPremiumNotice() {
  const [stats, setStats] = useState<AlfaStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAlfaStats()
  }, [])

  const fetchAlfaStats = async () => {
    try {
      const response = await fetch('/api/alfa/register-check')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas da fase Alfa:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Não mostrar se não estiver na fase Alfa
  if (isLoading || !stats || stats.phase !== 'ALFA') {
    return null
  }

  const endDate = new Date(stats.endDate)
  const formattedEndDate = endDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="border border-green-200 bg-green-50 rounded-lg p-4 mb-4 flex justify-center items-center">
      <div className="flex items-start gap-3">
        <div className="text-green-800 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                FASE ALFA
              </Badge>
              <span className="font-medium">
                Liberado GRATUITAMENTE até {formattedEndDate}!
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
