'use client'

import { Card, CardContent } from "@/components/ui/card"
import { 
  Lightbulb, 
  Shield, 
  DollarSign, 
  Brain, 
  Clock, 
  Target,
  HelpCircle,
  AlertCircle,
  Star,
  Search,
  Award,
  Users,
  Code,
  Linkedin,
  Rocket,
  LucideIcon 
} from "lucide-react"

// Mapa de ícones disponíveis
const iconMap: Record<string, LucideIcon> = {
  Lightbulb,
  Shield,
  DollarSign,
  Brain,
  Clock,
  Target,
  HelpCircle,
  AlertCircle,
  Star,
  Search,
  Award,
  Users,
  Code,
  Linkedin,
  Rocket,
  // Mapeamento por palavras-chave para detecção automática
  'funciona': Lightbulb,
  'confiável': Shield,
  'preço': DollarSign,
  'ia': Brain,
  'atualização': Clock,
  'confiança': Target,
}

interface FAQItem {
  question: string
  answer: string
  iconName?: string // Nome do ícone ao invés do componente
  iconColorClass?: string // Classe CSS para cor do ícone
}

interface FAQSectionProps {
  title?: string
  description?: string
  faqs: FAQItem[]
  className?: string
}

export function FAQSection({
  title = "Perguntas Frequentes",
  description,
  faqs,
  className = ''
}: FAQSectionProps) {

  return (
    <section className={`py-16 sm:py-20 lg:py-24 bg-white dark:bg-background ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground px-2">
              {description}
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {faqs.map((faq, index) => {
            // Tentar encontrar ícone baseado no iconName ou na pergunta
            let Icon = HelpCircle // Ícone padrão
            
            if (faq.iconName && iconMap[faq.iconName]) {
              Icon = iconMap[faq.iconName]
            } else {
              // Tentar detectar automaticamente baseado na pergunta
              const detectedIcon = Object.entries(iconMap).find(([key]) => 
                faq.question.toLowerCase().includes(key) && key !== 'funciona' && key !== 'confiável' && key !== 'preço' && key !== 'ia' && key !== 'atualização' && key !== 'confiança'
              )?.[1]
              if (detectedIcon) {
                Icon = detectedIcon
              }
            }

            const iconColorClass = faq.iconColorClass || "text-blue-600"

            return (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                    <Icon className={`w-6 h-6 ${iconColorClass}`} />
                    {faq.question}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

