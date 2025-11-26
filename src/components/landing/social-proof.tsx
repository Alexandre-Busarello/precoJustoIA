'use client'

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Star, 
  TrendingUp, 
  Users, 
  CheckCircle,
  Building2,
  BarChart3,
  Shield,
  Brain,
  LucideIcon
} from "lucide-react"
import { ReactNode } from "react"

// Mapa de ícones disponíveis
const iconMap: Record<string, LucideIcon> = {
  Building2,
  BarChart3,
  TrendingUp,
  Shield,
  CheckCircle,
  Brain,
  Star,
  Users,
}

interface SocialProofProps {
  stats?: Array<{
    value: string | number
    label: string
    iconName?: string // Nome do ícone ao invés do componente
    icon?: ReactNode // Mantido para compatibilidade, mas preferir iconName
  }>
  testimonials?: Array<{
    name: string
    role?: string
    content: string
    rating?: number
  }>
  badges?: Array<{
    text: string
    iconName?: string // Nome do ícone ao invés do componente
    icon?: ReactNode // Mantido para compatibilidade, mas preferir iconName
  }>
  className?: string
}

export function SocialProof({
  stats,
  testimonials,
  badges,
  className = ''
}: SocialProofProps) {
  return (
    <section className={`py-12 sm:py-16 lg:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => {
              const IconComponent = stat.iconName ? iconMap[stat.iconName] : null
              return (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {stat.icon || (IconComponent && <IconComponent className="w-6 h-6 text-blue-600" />)}
                    <div className="text-3xl sm:text-4xl font-bold text-blue-600">
                      {stat.value}
                    </div>
                  </div>
                  <div className="text-sm sm:text-base text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {badges.map((badge, index) => {
              const IconComponent = badge.iconName ? iconMap[badge.iconName] : null
              return (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="px-4 py-2 text-sm border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300"
                >
                  {badge.icon || (IconComponent && <IconComponent className="w-4 h-4 mr-2" />)}
                  {badge.text}
                </Badge>
              )
            })}
          </div>
        )}

        {/* Testimonials */}
        {testimonials && testimonials.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  {testimonial.rating && (
                    <div className="flex items-center gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < testimonial.rating!
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    {testimonial.role && (
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

