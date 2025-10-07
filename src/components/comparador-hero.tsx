'use client'

import { usePremiumStatus } from '@/hooks/use-premium-status'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  CheckCircle2,
  Sparkles,
  Activity
} from 'lucide-react'
import Link from 'next/link'

export function ComparadorHero() {
  const { isPremium } = usePremiumStatus()

  return (
    <section className={`bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 ${
      isPremium ? 'py-6 md:py-8' : 'py-16 md:py-24'
    }`}>
      <div className="container mx-auto max-w-7xl">
        <div className="text-center">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link href="/" className="text-blue-100 hover:text-white text-sm">
              Início
            </Link>
            <span className="text-blue-200 mx-2">/</span>
            <span className="text-white text-sm font-medium">Comparador de Ações</span>
          </div>

          {!isPremium && (
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl">
                <BarChart3 className="w-12 h-12 md:w-16 md:h-16" />
              </div>
            </div>
          )}
          
          <h1 className={`font-bold ${
            isPremium ? 'text-2xl md:text-3xl mb-2' : 'text-4xl md:text-6xl mb-6'
          }`}>
            Comparador de Ações B3
          </h1>
          
          {!isPremium && (
            <>
              <p className="text-xl md:text-2xl text-blue-100 mb-4 max-w-4xl mx-auto">
                Compare até 6 ações da Bovespa lado a lado com análise fundamentalista completa
              </p>
              
              <p className="text-lg text-blue-200 max-w-3xl mx-auto mb-8">
                Descubra qual investimento oferece o melhor potencial: P/L, ROE, Dividend Yield, margem líquida e +25 indicadores
              </p>
            </>
          )}

          <div className={`flex flex-wrap justify-center gap-3 ${isPremium ? 'mt-3' : ''}`}>
            <Badge variant="secondary" className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Grátis para Começar
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Análise com IA
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white">
              <Activity className="w-4 h-4 mr-2" />
              Dados Atualizados
            </Badge>
          </div>
        </div>
      </div>
    </section>
  )
}


