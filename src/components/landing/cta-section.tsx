'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  ArrowRight, 
  Rocket,
  LucideIcon 
} from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"

// Mapa de ícones disponíveis
const iconMap: Record<string, LucideIcon> = {
  Rocket,
}

interface CTASectionProps {
  title: string | ReactNode
  description?: string | ReactNode
  primaryCTA: {
    text: string
    href: string
    iconName?: string // Nome do ícone ao invés do componente
    icon?: ReactNode // Mantido para compatibilidade
  }
  secondaryCTA?: {
    text: string
    href: string
    iconName?: string // Nome do ícone ao invés do componente
    icon?: ReactNode // Mantido para compatibilidade
  }
  variant?: 'default' | 'gradient' | 'minimal'
  className?: string
  benefits?: string[]
}

export function CTASection({
  title,
  description,
  primaryCTA,
  secondaryCTA,
  variant = 'gradient',
  className = '',
  benefits
}: CTASectionProps) {
  const gradientClasses = variant === 'gradient' 
    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white'
    : variant === 'minimal'
    ? 'bg-white dark:bg-background border-2'
    : 'bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background'

  const textColor = variant === 'gradient' ? 'text-white' : 'text-foreground'
  const buttonVariant = variant === 'gradient' ? 'secondary' : 'default'

  return (
    <section className={`py-16 sm:py-20 lg:py-24 ${gradientClasses} ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 leading-tight ${textColor}`}>
          {title}
        </h2>
        {description && (
          <p className={`text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-4xl mx-auto opacity-90 px-2 ${variant === 'gradient' ? 'text-blue-100' : 'text-muted-foreground'}`}>
            {description}
          </p>
        )}
        
        {benefits && benefits.length > 0 && (
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 lg:gap-8 mb-8 text-xs sm:text-sm opacity-80 px-2">
            {benefits.map((benefit, index) => (
              <div key={index} className={`flex items-center gap-2 ${variant === 'gradient' ? 'text-white' : 'text-muted-foreground'}`}>
                <span>✅</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center px-4">
          <Button 
            size="lg" 
            className={`${variant === 'gradient' ? 'bg-white text-blue-600 hover:bg-gray-100' : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700'} text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 font-bold shadow-xl w-full sm:w-auto`} 
            asChild
          >
            <Link href={primaryCTA.href} className="flex items-center justify-center gap-2 sm:gap-3">
              {primaryCTA.icon || (primaryCTA.iconName && iconMap[primaryCTA.iconName] ? (
                (() => {
                  const IconComponent = iconMap[primaryCTA.iconName]
                  return <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                })()
              ) : (
                <Rocket className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              ))}
              <span className="truncate">{primaryCTA.text}</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            </Link>
          </Button>
          {secondaryCTA && (
            <Button 
              variant={variant === 'gradient' ? 'outline' : 'outline'} 
              size="lg" 
              className={`${variant === 'gradient' ? 'border-2 border-white hover:bg-white hover:text-blue-600' : 'border-2'} text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto`} 
              asChild
            >
              <Link href={secondaryCTA.href}>{secondaryCTA.text}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

