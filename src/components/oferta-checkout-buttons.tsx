'use client'

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useCheckoutUrl } from "@/components/kiwify-checkout-link"

// Componente Client para o link de preço no hero
export function HeroPriceLink() {
  const checkoutUrl = useCheckoutUrl()
  
  return (
    <a 
      href={checkoutUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex flex-col items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 rounded-xl sm:rounded-2xl px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all hover:shadow-lg transform hover:scale-105 cursor-pointer"
    >
      <div className="text-xs sm:text-sm md:text-base text-muted-foreground">Acesso Anual Promocional</div>
      <div className="flex items-baseline gap-1.5 sm:gap-2">
        <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
          R$ 17,99
        </span>
        <span className="text-base sm:text-lg md:text-xl text-muted-foreground">/mês</span>
      </div>
      <div className="text-xs sm:text-sm text-muted-foreground text-center">
        No cartão ou com desconto ainda maior à vista
      </div>
    </a>
  )
}

// Componente Client para o botão CTA principal
export function HeroCTAButton() {
  const checkoutUrl = useCheckoutUrl()
  
  return (
    <Button 
      size="lg" 
      className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-sm sm:text-base md:text-lg lg:text-xl px-5 sm:px-6 md:px-8 lg:px-12 py-3.5 sm:py-4 md:py-5 lg:py-6 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 w-full sm:w-auto"
      asChild
    >
      <a 
        href={checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 sm:gap-3"
      >
        <span className="whitespace-nowrap">
          <span className="sm:hidden">Garantir Acesso Agora</span>
          <span className="hidden sm:inline">Garantir Meu Acesso Anual Agora</span>
        </span>
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
      </a>
    </Button>
  )
}

// Componente Client para o botão CTA intermediário
export function IntermediateCTAButton() {
  const checkoutUrl = useCheckoutUrl()
  
  return (
    <Button 
      size="lg" 
      className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-base sm:text-lg md:text-xl px-6 sm:px-8 md:px-12 py-5 sm:py-6 md:py-7 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 w-full sm:w-auto"
      asChild
    >
      <a 
        href={checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 sm:gap-3"
      >
        <span className="whitespace-nowrap">
          <span className="sm:hidden">Garantir por R$ 17,99/mês</span>
          <span className="hidden sm:inline">Garantir Acesso Anual por R$ 17,99/mês</span>
        </span>
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
      </a>
    </Button>
  )
}


