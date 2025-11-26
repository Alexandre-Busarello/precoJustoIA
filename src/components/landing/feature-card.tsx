'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, LucideIcon } from "lucide-react"
import Link from "next/link"
import React, { ReactNode } from "react"
import {
  Cloud,
  Code,
  Users,
  Building2,
  BarChart3,
  Brain,
  Rocket,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  Shield,
  Zap,
  CheckCircle,
  Search,
  DollarSign,
  Clock,
  Calendar,
  Lightbulb,
  Star,
  HelpCircle,
  AlertCircle
} from "lucide-react"

// Mapa de ícones disponíveis
const iconMap: Record<string, LucideIcon> = {
  Cloud,
  Code,
  Users,
  Building2,
  BarChart3,
  Brain,
  Rocket,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  Shield,
  Zap,
  CheckCircle,
  Search,
  DollarSign,
  Clock,
  Calendar,
  Lightbulb,
  Star,
  HelpCircle,
  AlertCircle
}

interface FeatureCardProps {
  title: string
  description: string
  icon?: LucideIcon | ReactNode // Mantido para compatibilidade
  iconName?: string // Nome do ícone ao invés do componente
  href?: string
  badge?: {
    text: string
    variant?: "default" | "secondary" | "outline"
    className?: string
  }
  isPremium?: boolean
  className?: string
  iconBgClass?: string // Classe CSS customizada para o background do ícone
  onClick?: () => void
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  iconName,
  href,
  badge,
  isPremium = false,
  className = "",
  iconBgClass,
  onClick
}: FeatureCardProps) {
  // Determinar qual ícone usar: iconName (string) tem prioridade sobre icon (componente)
  let IconComponent: LucideIcon | ReactNode | null = null
  
  if (iconName && iconMap[iconName]) {
    IconComponent = iconMap[iconName]
  } else if (Icon) {
    IconComponent = Icon
  }

  // Renderizar o ícone corretamente
  const renderIcon = () => {
    if (!IconComponent) return null
    
    // Se já é um elemento React válido, renderizar diretamente
    if (React.isValidElement(IconComponent)) {
      return IconComponent
    }
    
    // Caso contrário, assumir que é um LucideIcon (componente React)
    const LucideIconComponent = IconComponent as LucideIcon
    return <LucideIconComponent className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
  }

  const content = (
    <Card className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden cursor-pointer h-full ${className}`}>
      {badge && (
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
          <Badge className={badge.className || (isPremium ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-1")}>
            {badge.text}
          </Badge>
        </div>
      )}
      <CardContent className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
        {IconComponent && (
          <div className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 ${iconBgClass || 'bg-gradient-to-br from-blue-500 to-blue-600'} rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform flex-shrink-0`}>
            {renderIcon()}
          </div>
        )}
        <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed flex-grow">
          {description}
        </p>
        {(href || onClick) && (
          <div className="text-xs sm:text-sm text-blue-600 font-medium group-hover:text-blue-700 flex items-center gap-1 mt-auto">
            <span>{href ? "Ver mais" : "Explorar"}</span>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <div onClick={onClick}>
        {content}
      </div>
    )
  }

  return content
}

