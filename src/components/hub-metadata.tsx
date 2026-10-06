"use client"

import Head from "next/head"
import { STOCK_VALUATION_MODELS_COUNT } from "@/lib/site-constants"

const RANKING_TITLE = `Rankings de Ações B3 - ${STOCK_VALUATION_MODELS_COUNT} Modelos de Valuation | Preço Justo AI`
const RANKING_DESCRIPTION = `Rankings de ações e BDRs com ${STOCK_VALUATION_MODELS_COUNT} modelos de valuation (Graham grátis, Fórmula Mágica, FCD, Gordon, Barsi, Bazin, Peter Lynch e outros), síntese com IA e rankings de FIIs e ETFs. Não é recomendação de investimento.`

interface HubMetadataProps {
  pageType: 'screening' | 'ranking'
}

export function HubMetadata({ pageType }: HubMetadataProps) {
  if (pageType === 'screening') {
    return (
      <Head>
        <title>Screening de Ações B3 - Filtro Customizável de Ações | Preço Justo AI</title>
        <meta name="description" content="Screening de ações B3 com filtros customizáveis. Encontre ações por valuation (P/L, P/VP), rentabilidade (ROE, ROIC), crescimento, dividendos e endividamento. Filtre mais de 600 ativos da Bolsa brasileira, incluindo BDRs com critérios personalizados. Análise fundamentalista gratuita." />
        <meta name="keywords" content="screening ações, filtro ações B3, análise fundamentalista, buscar ações, screening ações B3, filtro ações bolsa, valuation ações, dividendos ações, ROE ações, P/L ações, P/VP ações, screening fundamentalista, encontrar ações, ações subvalorizadas, filtro ações customizado, análise ações B3, screening BDR, filtro BDR" />
        <meta property="og:title" content="Screening de Ações B3 - Filtro Customizável | Preço Justo AI" />
        <meta property="og:description" content="Configure filtros personalizados e encontre ações da B3 e BDRs que atendem aos seus critérios: valuation, rentabilidade, crescimento e dividendos." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://precojusto.ai/screening-acoes" />
        <meta property="og:site_name" content="Preço Justo AI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Screening de Ações B3 - Filtro Customizável | Preço Justo AI" />
        <meta name="twitter:description" content="Configure filtros personalizados e encontre ações da B3 e BDRs que atendem aos seus critérios." />
        <link rel="canonical" href="https://precojusto.ai/screening-acoes" />
        <meta name="robots" content="index, follow" />
      </Head>
    )
  }

  return (
    <Head>
      <title>{RANKING_TITLE}</title>
      <meta name="description" content={RANKING_DESCRIPTION} />
      <meta name="keywords" content="rankings ações, ranking ações B3, análise fundamentalista ações, fórmula graham, fórmula mágica greenblatt, método barsi, bazin, peter lynch, fluxo de caixa descontado, ranking FIIs, ranking ETFs, valuation ações, ROE ações, P/L ações" />
      <meta property="og:title" content={RANKING_TITLE} />
      <meta property="og:description" content={RANKING_DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://precojusto.ai/ranking" />
      <meta property="og:site_name" content="Preço Justo AI" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={RANKING_TITLE} />
      <meta name="twitter:description" content={RANKING_DESCRIPTION} />
      <link rel="canonical" href="https://precojusto.ai/ranking" />
      <meta name="robots" content="index, follow" />
    </Head>
  )
}

