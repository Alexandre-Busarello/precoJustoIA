import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser, isCurrentUserPremium } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import TechnicalAnalysisPage from '@/components/technical-analysis-page'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Crown, Lock } from 'lucide-react'

interface PageProps {
  params: {
    ticker: string
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const ticker = resolvedParams.ticker.toUpperCase()
  
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { name: true }
  })

  if (!company) {
    return {
      title: `${ticker} - Análise Técnica | Preço Justo AI`
    }
  }

  return {
    title: `Análise Técnica - ${ticker} (${company.name}) | Preço Justo AI`,
    description: `Análise técnica completa de ${ticker} com indicadores avançados: RSI, MACD, Bollinger Bands, Fibonacci, Ichimoku e previsão de preços com IA.`,
    robots: {
      index: true,
      follow: true
    }
  }
}

export default async function TechnicalAnalysisPageRoute({ params }: PageProps) {
  const resolvedParams = await params
  const tickerParam = resolvedParams.ticker
  const ticker = tickerParam.toUpperCase()

  // Verificar se empresa existe
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      id: true,
      name: true,
      assetType: true
    }
  })

  if (!company) {
    notFound()
  }

  // Verificar se é ação (STOCK)
  if (company.assetType !== 'STOCK') {
    redirect(`/acao/${tickerParam.toLowerCase()}`)
  }

  // Verificar Premium
  const session = await getServerSession(authOptions)
  const userIsPremium = session ? await isCurrentUserPremium() : false

  // Se não for premium, mostrar CTA de upgrade
  if (!userIsPremium) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button asChild variant="ghost" className="mb-4">
              <Link href={`/acao/${tickerParam.toLowerCase()}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para página do ativo
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Análise Técnica - {ticker}</h1>
            <p className="text-muted-foreground mt-2">{company.name}</p>
          </div>

          {/* Premium CTA */}
          <Card className="border-2 border-amber-200 dark:border-amber-800">
            <CardContent className="p-8 text-center">
              <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">Análise Técnica Premium</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                A análise técnica completa com indicadores avançados é uma feature exclusiva para assinantes Premium.
              </p>
              
              <div className="mb-6 p-4 bg-muted/50 rounded-lg text-left max-w-md mx-auto">
                <h3 className="font-semibold mb-3">O que você terá acesso:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Indicadores técnicos completos (RSI, MACD, Stochastic, Bollinger Bands)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Análise de Fibonacci e Ichimoku Cloud</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Detecção automática de suporte e resistência</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Previsão de preços com IA (mínimo, máximo e preço justo de entrada)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Gráficos interativos com todos os indicadores</span>
                  </li>
                </ul>
              </div>

              <Button asChild size="lg" className="bg-amber-600 hover:bg-amber-700">
                <Link href="/checkout">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade para Premium
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Buscar dados da empresa para passar ao componente
  const companyData = await prisma.company.findUnique({
    where: { ticker },
    select: {
      id: true,
      name: true,
      sector: true,
      logoUrl: true,
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { price: true }
      }
    }
  })

  const currentPrice = companyData?.dailyQuotes[0]?.price
    ? Number(companyData.dailyQuotes[0].price)
    : 0

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link href={`/acao/${tickerParam.toLowerCase()}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para página do ativo
            </Link>
          </Button>
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-3xl font-bold">Análise Técnica</h1>
              <p className="text-muted-foreground mt-1">
                {ticker} - {companyData?.name || company.name}
              </p>
            </div>
          </div>
        </div>

        {/* Componente de Análise Técnica */}
        <TechnicalAnalysisPage
          ticker={ticker}
          companyName={companyData?.name || company.name}
          sector={companyData?.sector}
          currentPrice={currentPrice}
        />
      </div>
    </div>
  )
}

