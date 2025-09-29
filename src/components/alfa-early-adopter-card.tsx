'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, CheckCircle, ArrowRight, Sparkles, Lock, MessageCircle } from 'lucide-react'
import Link from 'next/link'

interface AlfaStats {
  phase: string
}

export function AlfaEarlyAdopterCard() {
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

  // Só mostrar se estiver na fase Alfa
  if (isLoading || !stats || stats.phase !== 'ALFA') {
    return null
  }

  return (
    <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 hover:shadow-2xl transition-all duration-300 relative h-full flex flex-col">
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-3 rounded-full text-sm font-bold shadow-lg">
          👑 OFERTA ESPECIAL
        </div>
      </div>
      
      <CardHeader className="text-center pt-12 pb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <CardTitle className="text-3xl font-bold mb-4">Early Adopter</CardTitle>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-2xl text-gray-400 line-through">R$ 497,00</span>
        </div>
        <div className="text-5xl font-bold text-yellow-600 mb-2">
          R$ 249,00
        </div>
        <p className="text-sm text-muted-foreground">por ano • PIX ou Cartão</p>
        <p className="text-lg font-bold text-green-600 mt-1">Economia de R$ 248/ano!</p>
        
        <div className="flex items-center justify-center gap-2 text-lg font-semibold text-yellow-600 mt-4">
          <Lock className="w-6 h-6" />
          <span>Preço congelado PARA SEMPRE</span>
        </div>
      </CardHeader>
      
      <CardContent className="px-8 pb-8 flex-1 flex flex-col">
        <div className="grid grid-cols-1 gap-6 mb-6 flex-1">
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-600" />
              Benefícios Exclusivos
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span><strong>Preço congelado</strong> em todas as renovações</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span><strong>Canal exclusivo WhatsApp</strong> com CEO</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span><strong>Acesso antecipado</strong> a novos recursos</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span><strong>Badge especial</strong> Early Adopter</span>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-bold mb-4 flex items-center justify-center gap-2">
              <Crown className="w-5 h-5 text-yellow-600" />
              Todos os Recursos Premium
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>8 modelos de valuation</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Análise preditiva com IA</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Rankings ilimitados</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Canal exclusivo WhatsApp</span>
              </div>
            </div>
          </div>
        </div>

        <Button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 text-base mt-auto" asChild>
          <Link href="/early-adopter">
            <Crown className="mr-2 h-4 w-4" />
            Garantir Oferta
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            ✅ Sem limite de vagas • ✅ Preço garantido para sempre • ✅ Ativação instantânea
          </p>
        </div>
      </CardContent>
    </Card>
  )
}


