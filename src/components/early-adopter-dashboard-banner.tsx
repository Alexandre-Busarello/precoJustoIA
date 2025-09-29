'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, Star, MessageCircle, Infinity, ArrowRight, X } from 'lucide-react'
import Link from 'next/link'
import { useAlfa } from '@/contexts/alfa-context'

interface EarlyAdopterDashboardBannerProps {
  className?: string
}

export function EarlyAdopterDashboardBanner({ className = '' }: EarlyAdopterDashboardBannerProps) {
  const { stats, isLoading } = useAlfa()
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Verificar se o banner foi dispensado (localStorage)
    const dismissed = localStorage.getItem('early-adopter-banner-dismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
    }
  }, [])

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('early-adopter-banner-dismissed', 'true')
  }

  // Não mostrar o banner se não estiver na fase Alfa, se foi dispensado, ou se ainda está carregando
  if (isLoading || !stats || stats.phase !== 'ALFA' || isDismissed) {
    return null
  }

  return (
    <Card className={`bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 text-white border-0 shadow-2xl relative overflow-hidden ${className}`}>
      {/* Botão de fechar */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 z-10 text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Efeito de brilho animado */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-pulse"></div>
      
      <CardContent className="p-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Conteúdo Principal */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Crown className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">Oferta Especial Early Adopter</h3>
                  <Badge className="bg-yellow-500 text-black font-bold px-2 py-1 text-xs">
                    LIMITADA
                  </Badge>
                </div>
                <p className="text-purple-100 text-sm">
                  Garanta o preço atual para sempre + benefícios exclusivos
                </p>
              </div>
            </div>

            {/* Benefícios Exclusivos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Infinity className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                <span className="font-medium">Preço congelado para sempre</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                <span className="font-medium">Canal exclusivo WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                <span className="font-medium">Acesso antecipado</span>
              </div>
            </div>

            {/* Preço e Economia */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-purple-200">De R$ 497/ano por</span>
                <span className="text-2xl font-bold text-yellow-300">R$ 249/ano</span>
              </div>
              <Badge className="bg-green-500 text-white font-bold">
                Economia de R$ 248/ano
              </Badge>
            </div>
          </div>

          {/* CTA */}
          <div className="flex-shrink-0">
            <Button 
              size="lg" 
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8 py-3 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
              asChild
            >
              <Link href="/checkout?plan=early" className="flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Garantir Oferta
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <p className="text-xs text-purple-100 text-center mt-2">
              ⚡ Ativação instantânea
            </p>
          </div>
        </div>

        {/* Indicador de urgência */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center justify-between text-xs text-purple-100">
            <span>🔥 Oferta exclusiva da Fase Alfa</span>
            <span>⏰ Disponível apenas durante esta fase</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
