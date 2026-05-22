import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import TechnicalAnalysisPage from '@/components/technical-analysis-page'
import TechnicalAnalysisPageLimited from '@/components/technical-analysis-page-limited'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Crown, Lock, AlertTriangle } from 'lucide-react'
import { BenChatFAB } from '@/components/ben-chat-fab'

const MIN_MONTHLY_PRICES = 50

interface PageProps {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: {
      name: true,
      dailyQuotes: { orderBy: { date: 'desc' }, take: 1, select: { price: true } },
    },
  })

  if (!company) {
    return { title: `${ticker} - Análise Técnica | Preço Justo AI` }
  }

  const currentPrice = company.dailyQuotes[0]?.price
    ? Number(company.dailyQuotes[0].price).toFixed(2)
    : null

  const description = currentPrice
    ? `Análise técnica do ETF ${ticker} (${company.name}). Preço atual: R$ ${currentPrice}. Indicadores técnicos avançados e previsão de preços com IA.`
    : `Análise técnica do ETF ${ticker} (${company.name}). Indicadores técnicos avançados e previsão de preços com IA.`

  return {
    title: `Análise Técnica - ${ticker} (${company.name}) | Preço Justo AI`,
    description,
    alternates: { canonical: `/etf/${tickerParam.toLowerCase()}/analise-tecnica` },
    robots: { index: true, follow: true },
  }
}

export default async function EtfTechnicalAnalysisPage({ params }: PageProps) {
  const { ticker: tickerParam } = await params
  const ticker = tickerParam.toUpperCase()

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { id: true, name: true, assetType: true },
  })

  if (!company) notFound()

  if (company.assetType !== 'ETF') {
    redirect(`/etf/${tickerParam.toLowerCase()}`)
  }

  const session = await getServerSession(authOptions)
  const user = session ? await getCurrentUser() : null
  const userIsPremium = user?.isPremium || false

  const companyData = await prisma.company.findUnique({
    where: { ticker },
    select: {
      id: true,
      name: true,
      sector: true,
      dailyQuotes: { orderBy: { date: 'desc' }, take: 1, select: { price: true } },
    },
  })

  const currentPrice = companyData?.dailyQuotes[0]?.price
    ? Number(companyData.dailyQuotes[0].price)
    : 0

  // Verificar se há dados históricos suficientes para análise técnica
  const monthlyPricesCount = companyData
    ? await prisma.historicalPrice.count({
        where: { companyId: companyData.id, interval: '1mo' },
      })
    : 0
  const hasEnoughData = monthlyPricesCount >= MIN_MONTHLY_PRICES

  const backLink = (
    <Button asChild variant="ghost" className="mb-4">
      <Link href={`/etf/${tickerParam.toLowerCase()}`}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar para página do ETF
      </Link>
    </Button>
  )

  // ETF com histórico insuficiente — mostrar mensagem para todos
  if (!hasEnoughData) {
    const monthsNeeded = MIN_MONTHLY_PRICES - monthlyPricesCount
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {backLink}
          <Card className="border-2 border-amber-200 dark:border-amber-800">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-3">Histórico insuficiente</h2>
              <p className="text-muted-foreground mb-2">
                O ETF <strong>{ticker}</strong> possui apenas{' '}
                <strong>{monthlyPricesCount} meses</strong> de dados históricos.
              </p>
              <p className="text-muted-foreground text-sm">
                São necessários ao menos <strong>{MIN_MONTHLY_PRICES} meses</strong> (≈ 4 anos)
                para calcular indicadores técnicos confiáveis.
                Faltam ainda <strong>{monthsNeeded} meses</strong> de histórico.
              </p>
            </CardContent>
          </Card>
        </div>
        <BenChatFAB />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            {backLink}
            <h1 className="text-3xl font-bold">Análise Técnica</h1>
            <p className="text-muted-foreground mt-1">
              {ticker} — {companyData?.name || company.name}
            </p>
          </div>
          <TechnicalAnalysisPageLimited
            ticker={ticker}
            companyName={companyData?.name || company.name}
            currentPrice={currentPrice}
          />
        </div>
        <BenChatFAB />
      </div>
    )
  }

  if (!userIsPremium) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            {backLink}
            <h1 className="text-3xl font-bold">Análise Técnica — {ticker}</h1>
            <p className="text-muted-foreground mt-2">{company.name}</p>
          </div>
          <Card className="border-2 border-amber-200 dark:border-amber-800">
            <CardContent className="p-8 text-center">
              <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">Análise Técnica Premium</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                A análise técnica completa com indicadores avançados é uma feature exclusiva para assinantes Premium.
              </p>
              <Button asChild size="lg" className="bg-amber-600 hover:bg-amber-700">
                <Link href="/checkout">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade para Premium
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <BenChatFAB />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          {backLink}
          <h1 className="text-3xl font-bold">Análise Técnica</h1>
          <p className="text-muted-foreground mt-1">
            {ticker} — {companyData?.name || company.name}
          </p>
        </div>
        <TechnicalAnalysisPage
          ticker={ticker}
          companyName={companyData?.name || company.name}
          sector={companyData?.sector ?? null}
          currentPrice={currentPrice}
        />
      </div>
      <BenChatFAB />
    </div>
  )
}
