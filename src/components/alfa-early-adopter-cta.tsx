'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Crown, Sparkles, ArrowRight, Users, Lock } from 'lucide-react'
import Link from 'next/link'

interface AlfaStats {
  phase: string
  isLimitReached: boolean
  spotsAvailable: number
}

export function AlfaEarlyAdopterCTA() {
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

  // Só mostrar se estiver na fase Alfa E as vagas estiverem esgotadas
  if (isLoading || !stats || stats.phase !== 'ALFA' || !stats.isLimitReached) {
    return null
  }

  return (
    <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600">
      <div className="container mx-auto px-4">
        <Card className="border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white max-w-4xl mx-auto">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 mb-4">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Vagas Esgotadas!</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Mas você ainda pode garantir seu lugar!
              </h2>
              
              <p className="text-lg opacity-90 max-w-2xl mx-auto mb-6">
                As vagas gratuitas da Fase Alfa se esgotaram, mas você pode se tornar um 
                <strong> Early Adopter</strong> e garantir acesso imediato + preço congelado para sempre.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Crown className="w-6 h-6 text-yellow-300" />
                  <span className="text-lg font-semibold">Oferta Exclusiva Early Adopter</span>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>Acesso <strong>imediato</strong> à plataforma</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-yellow-300" />
                    <span>Preço <strong>congelado para sempre</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-300" />
                    <span>Canal exclusivo WhatsApp com CEO</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-lg line-through opacity-60">R$ 497/ano</span>
                  </div>
                  <div className="text-4xl font-bold text-yellow-300">
                    R$ 249/ano
                  </div>
                  <p className="text-sm opacity-80">Economia de R$ 248 por ano, para sempre!</p>
                </div>

                <Button 
                  size="lg" 
                  className="bg-white text-purple-600 hover:bg-gray-100 font-bold px-8 py-3"
                  asChild
                >
                  <Link href="/early-adopter">
                    <Crown className="mr-2 h-5 w-5" />
                    Garantir Oferta Early Adopter
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>

                <p className="text-xs opacity-70 mt-3">
                  ✅ Sem limite de vagas • ✅ Ativação instantânea
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
