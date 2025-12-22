'use client'

import { Button } from "@/components/ui/button"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { useSession } from "next-auth/react"
import { 
  ArrowRight, 
  Rocket, 
  Sparkles,
  Building2,
  BarChart3,
  Brain,
  BookOpen,
  Award,
  Users,
  TrendingUp,
  Search,
  Target,
  CheckCircle,
  LucideIcon
} from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"

// Mapa de ícones disponíveis
const iconMap: Record<string, LucideIcon> = {
  Building2,
  BarChart3,
  Brain,
  Rocket,
  Sparkles,
  ArrowRight,
  BookOpen,
  Award,
  Users,
  TrendingUp,
  Search,
  Target,
  CheckCircle,
}

interface LandingHeroProps {
  headline: string | ReactNode
  subheadline: string | ReactNode
  primaryCTA?: {
    text: string
    href: string
    iconName?: string // Nome do ícone ao invés do componente
    icon?: ReactNode // Mantido para compatibilidade
  }
  secondaryCTA?: {
    text: string
    href: string
  }
  badge?: {
    text: string
    iconName?: string // Nome do ícone ao invés do componente
    icon?: ReactNode // Mantido para compatibilidade
  }
  socialProof?: Array<{
    iconName?: string // Nome do ícone ao invés do componente
    icon?: ReactNode // Mantido para compatibilidade
    text: string
  }>
  showQuickAccess?: boolean
}

export function LandingHero({
  headline,
  subheadline,
  primaryCTA,
  secondaryCTA,
  badge,
  socialProof,
  showQuickAccess = true
}: LandingHeroProps) {
  const { data: session } = useSession()
  const { trackEngagement } = useEngagementPixel()

  // Handler para disparar pixel quando usuário deslogado clica em CTA
  const handleCTAClick = () => {
    if (!session) {
      trackEngagement()
    }
  }

  return (
    <section className="relative overflow-hidden w-full bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20 pt-4 sm:pt-6 lg:pt-32 pb-12 sm:pb-16 lg:pb-24">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
      
      <div className="relative text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Badge */}
        {badge && (
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-4 sm:px-6 py-2 sm:py-3 mb-4 sm:mb-6 lg:mb-8 shadow-lg">
            {badge.icon || (badge.iconName && iconMap[badge.iconName] ? (
              (() => {
                const IconComponent = iconMap[badge.iconName]
                return <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
              })()
            ) : (
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
            ))}
            <span className="text-xs sm:text-sm font-semibold">{badge.text}</span>
          </div>
        )}
        
        {/* Headline */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold tracking-tight mb-4 sm:mb-6 lg:mb-8 leading-tight px-2">
          {headline}
        </h1>
        
        {/* Subheadline */}
        <div className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-muted-foreground mb-6 sm:mb-8 lg:mb-12 max-w-5xl mx-auto leading-relaxed px-2">
          {subheadline}
        </div>

        {/* Social Proof */}
        {socialProof && socialProof.length > 0 && (
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8 lg:mb-12 text-xs sm:text-sm text-muted-foreground px-2">
            {socialProof.map((item, index) => {
              const IconComponent = item.iconName ? iconMap[item.iconName] : null
              return (
                <div key={index} className="flex items-center gap-2">
                  {item.icon || (IconComponent && (
                    <IconComponent className="w-4 h-4 flex-shrink-0" />
                  ))}
                  <span>{item.text}</span>
                </div>
              )
            })}
          </div>
        )}
        
        {/* CTAs */}
        {(primaryCTA || secondaryCTA) && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-6 justify-center mb-4 sm:mb-6 lg:mb-8 px-4">
            {primaryCTA && (
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-sm sm:text-base lg:text-lg px-5 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto" 
                asChild
              >
                <Link href={primaryCTA.href} onClick={handleCTAClick} className="flex items-center justify-center gap-2 sm:gap-3">
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
            )}
            {secondaryCTA && (
              <Button 
                variant="outline" 
                size="lg" 
                className="text-sm sm:text-base lg:text-lg px-5 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 w-full sm:w-auto" 
                asChild
              >
                <Link href={secondaryCTA.href} onClick={handleCTAClick}>{secondaryCTA.text}</Link>
              </Button>
            )}
          </div>
        )}

        {/* Quick Access */}
        {showQuickAccess && (
          <p className="text-xs sm:text-sm text-muted-foreground px-4">
            ✅ Grátis para sempre • ✅ Sem cartão de crédito • ✅ Acesso imediato
          </p>
        )}
      </div>
    </section>
  )
}

