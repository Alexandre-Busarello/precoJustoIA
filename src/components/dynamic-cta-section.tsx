'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCheckoutUrl } from '@/components/kiwify-checkout-link'
import { OfertaCTAButton, OfertaPriceLink } from '@/components/oferta-checkout-buttons'
import { OFERTA_MONTHLY_PRICE_LABEL } from '@/components/landing/oferta-config'

interface FeatureCopy {
  headline: string
  subheadline: string
  priceLabel: string
  buttonText: string
}

const PRICE = `${OFERTA_MONTHLY_PRICE_LABEL}/mês`

/** Textos do CTA final conforme o card clicado na landing (`?feature=`). */
const FEATURE_COPIES: Record<string, FeatureCopy> = {
  'radar-inteligente': {
    headline: 'Tenha o radar que acompanha suas ações',
    subheadline: `Escolha os ativos, salve o radar e veja tudo em uma tela, por ${PRICE}.`,
    priceLabel: 'Radar de ações',
    buttonText: 'Garantir meu radar',
  },
  'tres-dados-vitais': {
    headline: 'Fundamentos, técnica e sentimento em uma tela',
    subheadline: `Score de fundamentos, análise técnica e sentimento de mercado lado a lado, por ${PRICE}.`,
    priceLabel: 'Três leituras em uma tela',
    buttonText: 'Garantir o acesso anual',
  },
  '5-minutos': {
    headline: 'Menos horas lendo balanços',
    subheadline: `Confira o radar em poucos minutos por mês e aprofunde só onde algo mudou, por ${PRICE}.`,
    priceLabel: 'Radar de ações',
    buttonText: 'Garantir o acesso anual',
  },
  'analise-tecnica': {
    headline: 'Análise técnica com IA',
    subheadline: `A IA descreve tendências, suportes e resistências do gráfico, por ${PRICE}. É uma estimativa gerada por IA.`,
    priceLabel: 'Análise técnica com IA',
    buttonText: 'Garantir a análise técnica',
  },
  'relatorios-ia': {
    headline: 'Relatórios da IA no seu e-mail',
    subheadline: `Receba um aviso quando algo mudar nos fundamentos de uma empresa que você acompanha, por ${PRICE}.`,
    priceLabel: 'Relatórios automáticos',
    buttonText: 'Garantir os relatórios',
  },
  rankings: {
    headline: 'Rankings por modelo de valuation',
    subheadline: `Ranqueie ações por modelos consagrados ou pela síntese com IA, por ${PRICE}.`,
    priceLabel: 'Rankings por modelo',
    buttonText: 'Garantir os rankings',
  },
  screening: {
    headline: 'Screening de ações com mais de 65 indicadores',
    subheadline: `Monte seus filtros ou descreva o que procura e deixe a IA configurar, por ${PRICE}.`,
    priceLabel: 'Screening completo',
    buttonText: 'Garantir o screening',
  },
  'analise-b3': {
    headline: 'Ações e BDRs da B3 com mais de 65 indicadores',
    subheadline: `Indicadores fundamentalistas e histórico de cada empresa, por ${PRICE}.`,
    priceLabel: 'Análise das empresas da B3',
    buttonText: 'Garantir o acesso anual',
  },
  comparador: {
    headline: 'Compare empresas lado a lado',
    subheadline: `Veja os indicadores de várias empresas na mesma tabela, por ${PRICE}.`,
    priceLabel: 'Comparador completo',
    buttonText: 'Garantir o comparador',
  },
  dividendos: {
    headline: 'Acompanhe seus dividendos',
    subheadline: `Calendário de proventos e projeções estimadas por IA, por ${PRICE}.`,
    priceLabel: 'Radar de dividendos',
    buttonText: 'Garantir o radar de dividendos',
  },
  'analise-setorial': {
    headline: 'Análise setorial da B3',
    subheadline: `Compare setores e veja como cada empresa se posiciona, por ${PRICE}.`,
    priceLabel: 'Análise setorial',
    buttonText: 'Garantir a análise setorial',
  },
  'calculadora-renda': {
    headline: 'Simule sua renda passiva',
    subheadline: `Calcule quanto investir para chegar à renda mensal em dividendos que você quer, por ${PRICE}.`,
    priceLabel: 'Calculadora de renda',
    buttonText: 'Garantir a calculadora',
  },
}

const DEFAULT_COPY: FeatureCopy = {
  headline: 'Garanta a condição enquanto ela está ativa',
  subheadline: `Acesso anual promocional por ${OFERTA_MONTHLY_PRICE_LABEL} por mês no cartão, ou com desconto maior à vista.`,
  priceLabel: 'Acesso anual promocional',
  buttonText: 'Garantir o acesso anual',
}

export function DynamicCTASection() {
  const searchParams = useSearchParams()
  const feature = searchParams.get('feature')
  const checkoutUrl = useCheckoutUrl()

  // Rola até o checkout quando a landing é aberta a partir de um card
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

  const copy = (feature && FEATURE_COPIES[feature]) || DEFAULT_COPY

  return (
    <section id="checkout" className="scroll-mt-20 border-t border-border bg-surface py-16 sm:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 [&>*]:max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{copy.headline}</h2>
        <p className="mt-3 max-w-[60ch] text-base text-muted-foreground">{copy.subheadline}</p>
        <div className="mt-6">
          <OfertaPriceLink href={checkoutUrl} label={copy.priceLabel} />
        </div>
        <div className="mt-6">
          <OfertaCTAButton href={checkoutUrl} label={copy.buttonText} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Pagamento seguro · Acesso imediato · Reembolso em até 7 dias</p>
      </div>
    </section>
  )
}
