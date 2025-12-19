"use client"

import Head from "next/head"

interface HubMetadataProps {
  pageType: 'screening' | 'ranking'
}

export function HubMetadata({ pageType }: HubMetadataProps) {
  if (pageType === 'screening') {
    return (
      <Head>
        <title>Screening de Ações B3 - Filtro Customizável de Ações | Preço Justo AI</title>
        <meta name="description" content="Screening de ações B3 com filtros customizáveis. Encontre ações por valuation (P/L, P/VP), rentabilidade (ROE, ROIC), crescimento, dividendos e endividamento. Filtre +500 empresas da Bolsa brasileira e BDRs com critérios personalizados. Análise fundamentalista gratuita." />
        <meta name="keywords" content="screening ações, filtro ações B3, análise fundamentalista, buscar ações, screening ações B3, filtro ações bolsa, valuation ações, dividendos ações, ROE ações, P/L ações, P/VP ações, screening fundamentalista, encontrar ações, ações subvalorizadas, filtro ações customizado, análise ações B3, screening BDR, filtro BDR" />
        <meta property="og:title" content="Screening de Ações B3 - Filtro Customizável | Preço Justo AI" />
        <meta property="og:description" content="Configure filtros personalizados e encontre as melhores ações da B3 e BDRs baseado em seus critérios de investimento. Valuation, rentabilidade, crescimento e dividendos." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://precojusto.ai/screening-acoes" />
        <meta property="og:site_name" content="Preço Justo AI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Screening de Ações B3 - Filtro Customizável | Preço Justo AI" />
        <meta name="twitter:description" content="Configure filtros personalizados e encontre as melhores ações da B3 e BDRs baseado em seus critérios de investimento." />
        <link rel="canonical" href="https://precojusto.ai/screening-acoes" />
        <meta name="robots" content="index, follow" />
      </Head>
    )
  }

  return (
    <Head>
      <title>Rankings de Ações B3 - 8 Modelos de Análise Fundamentalista | Preço Justo AI</title>
      <meta name="description" content="Rankings de ações B3 com 8 modelos de análise fundamentalista: Fórmula de Graham (grátis), Value Investing, Fórmula Mágica, Dividend Yield, FCD, Gordon, Fundamentalista 3+1 e Análise Preditiva com IA. Encontre as melhores ações da Bolsa brasileira e BDRs." />
      <meta name="keywords" content="rankings ações, ranking ações B3, análise fundamentalista ações, fórmula graham, value investing, fórmula mágica greenblatt, dividend yield, fluxo de caixa descontado, análise ações, ranking ações bolsa, melhores ações B3, ações subvalorizadas, análise preditiva IA, screening ações, valuation ações, ROE ações, P/L ações" />
      <meta property="og:title" content="Rankings de Ações B3 - 8 Modelos de Análise Fundamentalista | Preço Justo AI" />
      <meta property="og:description" content="Encontre as melhores ações da B3 e BDRs com 8 modelos de análise fundamentalista. De Graham a Inteligência Artificial: escolha a estratégia ideal para seu perfil." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://precojusto.ai/ranking" />
      <meta property="og:site_name" content="Preço Justo AI" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Rankings de Ações B3 - 8 Modelos de Análise Fundamentalista | Preço Justo AI" />
      <meta name="twitter:description" content="Encontre as melhores ações da B3 e BDRs com 8 modelos de análise fundamentalista. De Graham a Inteligência Artificial." />
      <link rel="canonical" href="https://precojusto.ai/ranking" />
      <meta name="robots" content="index, follow" />
    </Head>
  )
}

