'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Calendar, Users } from 'lucide-react'
import Link from 'next/link'
import { useAlfa } from '@/contexts/alfa-context'

interface AlfaBannerProps {
  variant?: 'landing' | 'dashboard'
  className?: string
}

export function AlfaBanner({ variant = 'dashboard', className = '' }: AlfaBannerProps) {
  const { stats, isLoading } = useAlfa()

  // Não mostrar o banner se não estiver na fase Alfa
  if (isLoading || !stats || stats.phase !== 'ALFA') {
    return null
  }

  const endDate = new Date(stats.endDate)
  const formattedEndDate = endDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })

  if (variant === 'landing') {
    return (
      <div className={`fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 mt-[81px] md:mt-[103px] ${className}`}>
        <div className="container mx-auto flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              FASE ALFA
            </Badge>
          </div>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {stats.isLimitReached 
                ? "Vagas esgotadas! Torne-se Early Adopter por R$ 249/ano" 
                : `Acesso PREMIUM gratuito até ${formattedEndDate}`
              }
            </span>
          </div>
          <span className="hidden md:inline">•</span>
          <div className="hidden md:flex items-center gap-2">
            <Users className="h-4 w-4" />
            {stats.isLimitReached ? (
              <Button 
                size="sm" 
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-1 h-auto text-xs"
                asChild
              >
                <Link href="/checkout?plan=early">
                  Oferta Early Adopter
                </Link>
              </Button>
            ) : (
              <span>{stats.spotsAvailable} vagas restantes</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`border border-purple-200 bg-purple-50 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
        <div className="text-purple-800 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                FASE ALFA
              </Badge>
              <span className="font-medium">
                {stats.isLimitReached 
                  ? "Vagas esgotadas! Torne-se Early Adopter e garanta preço congelado para sempre!"
                  : `Você tem acesso PREMIUM gratuito até ${formattedEndDate}!`
                }
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-purple-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Até {formattedEndDate}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {stats.isLimitReached ? (
                  <Button 
                    size="sm" 
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-2 py-1 h-auto text-xs"
                    asChild
                  >
                    <Link href="/checkout?plan=early">
                      Early Adopter: R$ 249/ano
                    </Link>
                  </Button>
                ) : (
                  <span>{stats.spotsAvailable} vagas restantes</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
