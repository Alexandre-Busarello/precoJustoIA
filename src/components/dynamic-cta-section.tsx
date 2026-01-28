'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const KIWIFY_CHECKOUT_URL = "https://pay.kiwify.com.br/kV1DuGv"

// Mapeamento de features para copies personalizados
const FEATURE_COPIES: Record<string, {
  headline: string
  subheadline: string
  priceLabel: string
  buttonText: {
    mobile: string
    desktop: string
  }
}> = {
  'radar-inteligente': {
    headline: 'Tenha o Radar Inteligente que Monitora suas Ações',
    subheadline: 'Escolha o ativo, salve o radar e a IA faz o resto. Tudo em uma única tela por apenas R$ 17,99/mês.',
    priceLabel: 'Radar Inteligente Completo',
    buttonText: {
      mobile: 'Garantir Meu Radar Agora',
      desktop: 'Garantir Meu Radar Inteligente Agora'
    }
  },
  'tres-dados-vitais': {
    headline: 'Tenha os Três Dados Vitais em Uma Única Tela',
    subheadline: 'Score de fundamentos, análise técnica e sentimento de mercado. Tudo que você precisa para investir com confiança por R$ 17,99/mês.',
    priceLabel: 'Análise Completa em Uma Tela',
    buttonText: {
      mobile: 'Garantir Análise Completa',
      desktop: 'Garantir Análise Completa Agora'
    }
  },
  '5-minutos': {
    headline: 'Pare de Perder Horas Analisando Balanços',
    subheadline: 'Gaste apenas 5 minutos por mês ao invés de horas. O radar mostra tudo que precisa saber em uma única tela por R$ 17,99/mês.',
    priceLabel: 'Economia de Tempo',
    buttonText: {
      mobile: 'Economizar Meu Tempo',
      desktop: 'Economizar Meu Tempo Agora'
    }
  },
  'analise-tecnica': {
    headline: 'Tenha Análise Técnica com IA ao Seu Alcance',
    subheadline: 'Inteligência Artificial analisa gráficos e padrões técnicos para identificar pontos de entrada e saída ideais por R$ 17,99/mês.',
    priceLabel: 'Análise Técnica com IA',
    buttonText: {
      mobile: 'Garantir Análise Técnica',
      desktop: 'Garantir Análise Técnica com IA'
    }
  },
  'relatorios-ia': {
    headline: 'Receba Relatórios da IA Direto no Seu E-mail',
    subheadline: 'A plataforma te avisa automaticamente se algo mudar no fundamento da empresa. Você não precisa ficar checando. Por R$ 17,99/mês.',
    priceLabel: 'Relatórios Automáticos',
    buttonText: {
      mobile: 'Garantir Relatórios IA',
      desktop: 'Garantir Relatórios da IA Agora'
    }
  },
  'rankings': {
    headline: 'Encontre as Melhores Oportunidades com Rankings Inteligentes',
    subheadline: 'Rankings usando estratégias consagradas ou Inteligência Artificial para encontrar as melhores ações por R$ 17,99/mês.',
    priceLabel: 'Rankings Inteligentes',
    buttonText: {
      mobile: 'Garantir Rankings',
      desktop: 'Garantir Rankings Inteligentes'
    }
  },
  'screening': {
    headline: 'Tenha o Melhor Screening de Ações da B3',
    subheadline: 'Crie configurações personalizadas ou use a IA para encontrar as melhores empresas com mais de 65 indicadores por R$ 17,99/mês.',
    priceLabel: 'Screening Completo',
    buttonText: {
      mobile: 'Garantir Screening',
      desktop: 'Garantir Screening Completo'
    }
  },
  'analise-b3': {
    headline: 'Tenha Análise Completa de Todas as Empresas da B3',
    subheadline: 'Análise de todas as ações e BDRs com mais de 65 indicadores fundamentalistas por empresa. Por R$ 17,99/mês.',
    priceLabel: 'Análise Completa B3',
    buttonText: {
      mobile: 'Garantir Análise B3',
      desktop: 'Garantir Análise Completa da B3'
    }
  },
  'comparador': {
    headline: 'Tenha o Melhor Comparador de Empresas',
    subheadline: 'Compare empresas lado a lado e veja qual é a melhor opção de investimento com análise detalhada de indicadores por R$ 17,99/mês.',
    priceLabel: 'Comparador Completo',
    buttonText: {
      mobile: 'Garantir Comparador',
      desktop: 'Garantir Comparador Completo Agora'
    }
  },
  'dividendos': {
    headline: 'Monitore seus Dividendos com Projeções de IA',
    subheadline: 'Radar de dividendos com projeções feitas por IA para identificar as melhores oportunidades de renda passiva por R$ 17,99/mês.',
    priceLabel: 'Radar de Dividendos',
    buttonText: {
      mobile: 'Garantir Radar Dividendos',
      desktop: 'Garantir Radar de Dividendos Agora'
    }
  },
  'analise-setorial': {
    headline: 'Tenha Análise Setorial Completa da B3',
    subheadline: 'Análise completa por setores para identificar tendências e oportunidades de investimento por R$ 17,99/mês.',
    priceLabel: 'Análise Setorial',
    buttonText: {
      mobile: 'Garantir Análise Setorial',
      desktop: 'Garantir Análise Setorial Completa'
    }
  },
  'calculadora-renda': {
    headline: 'Calcule sua Renda Passiva com Precisão',
    subheadline: 'Calcule quanto você precisa investir para alcançar seus objetivos de renda passiva com dividendos por R$ 17,99/mês.',
    priceLabel: 'Calculadora de Renda',
    buttonText: {
      mobile: 'Garantir Calculadora',
      desktop: 'Garantir Calculadora de Renda Passiva'
    }
  }
}

// Copy padrão quando não há feature específica
const DEFAULT_COPY = {
  headline: 'Clique no link e garanta sua condição antes que encerre!',
  subheadline: 'Acesso anual promocional por apenas R$ 17,99 mensais no cartão ou com desconto ainda maior se for à vista. Evite o giro excessivo e monitore suas ações com inteligência artificial.',
  priceLabel: 'Acesso Anual Promocional',
  buttonText: {
    mobile: 'Garantir Condição Agora',
    desktop: 'Garantir Minha Condição Agora'
  }
}

export function DynamicCTASection() {
  const searchParams = useSearchParams()
  const feature = searchParams.get('feature')
  
  // Scroll para o checkout quando há feature na URL
  useEffect(() => {
    if (feature && window.location.hash === '#checkout') {
      const element = document.getElementById('checkout')
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    }
  }, [feature])
  
  const copy = feature && FEATURE_COPIES[feature] 
    ? FEATURE_COPIES[feature] 
    : DEFAULT_COPY

  return (
    <section id="checkout" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-blue-600 to-violet-600 text-white scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
            {copy.headline}
          </h2>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 opacity-90 max-w-2xl mx-auto">
            {copy.subheadline}
          </p>
          <div className="mb-6 sm:mb-8">
            <a 
              href={KIWIFY_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-col items-center gap-2 bg-white/10 backdrop-blur-sm rounded-2xl px-6 sm:px-8 py-4 sm:py-5 border-2 border-white/20 hover:bg-white/20 hover:border-white/40 transition-all hover:shadow-xl transform hover:scale-105 cursor-pointer"
            >
              <div className="text-sm sm:text-base opacity-90">{copy.priceLabel}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                  R$ 17,99
                </span>
                <span className="text-lg sm:text-xl opacity-90">/mês</span>
              </div>
            </a>
          </div>
          <Button 
            size="lg" 
            className="bg-white text-blue-600 hover:bg-gray-100 text-base sm:text-lg md:text-xl px-6 sm:px-8 md:px-12 py-5 sm:py-6 md:py-7 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 w-full sm:w-auto font-bold"
            asChild
          >
            <a 
              href={KIWIFY_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 sm:gap-3"
            >
              <span className="whitespace-nowrap">
                <span className="sm:hidden">{copy.buttonText.mobile}</span>
                <span className="hidden sm:inline">{copy.buttonText.desktop}</span>
              </span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            </a>
          </Button>
          <p className="text-xs sm:text-sm md:text-base mt-6 opacity-80 px-4">
            ✅ Pagamento 100% seguro • ✅ Acesso imediato • ✅ Garantia de 7 dias • ✅ Condição encerre em breve
          </p>
        </div>
      </div>
    </section>
  )
}

