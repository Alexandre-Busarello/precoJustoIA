import { Metadata } from 'next'
import { EtfComparisonSelector } from '@/components/etf-comparison-selector'
import { Breadcrumbs } from '@/components/landing/breadcrumbs'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  ArrowRight,
  Trophy,
  DollarSign,
  Activity,
  Globe,
  Coins,
  Building2,
  Shield,
  Leaf
} from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comparador de ETFs B3 | Compare Fundos de Índice com Score PJ - Preço Justo',
  description: 'Compare até 6 ETFs da B3 lado a lado. Analise taxa de administração, retornos históricos, patrimônio, concentração e o Score Preço Justo. Encontre o melhor ETF para sua carteira.',
  keywords: 'comparar ETFs B3, comparador ETF bovespa, BOVA11 vs IVVB11, melhores ETFs 2024, taxa ETF, score ETF, retorno ETF, fundos de índice Brasil',
  alternates: { canonical: '/comparador-etfs' },
  robots: { index: true, follow: true },
}

const popularComparisons = [
  {
    title: 'Renda Variável BR',
    description: 'Os principais ETFs que replicam o Ibovespa e índices de ações brasileiras',
    tickers: ['BOVA11', 'BOVB11', 'BBOV11'],
    icon: TrendingUp,
    color: 'green',
  },
  {
    title: 'Internacional (c/ hedge)',
    description: 'ETFs internacionais com proteção cambial — retorno em reais',
    tickers: ['SPXR11', 'NASD11', 'WRLD11'],
    icon: Globe,
    color: 'blue',
  },
  {
    title: 'Internacional (BDR)',
    description: 'Exposição ao S&P 500 e mercado global sem hedge cambial',
    tickers: ['IVVB11', 'SPYI11', 'ACWI11'],
    icon: Globe,
    color: 'indigo',
  },
  {
    title: 'Dividendos',
    description: 'ETFs focados em empresas pagadoras de proventos no Brasil',
    tickers: ['DIVO11', 'DIVD11', 'NDIV11'],
    icon: DollarSign,
    color: 'yellow',
  },
  {
    title: 'Renda Fixa',
    description: 'Fundos indexados a títulos públicos: Selic, IPCA+ e pré-fixado',
    tickers: ['IMAB11', 'B5P211', 'IRFM11'],
    icon: Shield,
    color: 'purple',
  },
  // {
  //   title: 'Setorial',
  //   description: 'ETFs de setores específicos: agro, infra, utilities e outros',
  //   tickers: ['AGRI11', 'IFRA11', 'UTL11'],
  //   icon: Building2,
  //   color: 'orange',
  // },
  // {
  //   title: 'Commodities',
  //   description: 'Ouro e outras commodities como proteção de carteira',
  //   tickers: ['GOLD11', 'OGLD11'],
  //   icon: Coins,
  //   color: 'amber',
  // },
  // {
  //   title: 'ESG',
  //   description: 'ETFs com critérios ambientais, sociais e de governança',
  //   tickers: ['ESGB11', 'ECOO11'],
  //   icon: Leaf,
  //   color: 'teal',
  // },
]

const colorMap: Record<string, string> = {
  green: 'from-green-500 to-emerald-500',
  blue: 'from-blue-500 to-cyan-500',
  indigo: 'from-indigo-500 to-blue-500',
  yellow: 'from-yellow-500 to-orange-500',
  purple: 'from-purple-500 to-violet-500',
  orange: 'from-orange-500 to-red-500',
  amber: 'from-amber-400 to-yellow-500',
  teal: 'from-teal-500 to-green-500',
}

export default function ComparadorEtfsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto max-w-7xl px-4 pt-6">
        <Breadcrumbs items={[
          { label: 'Ferramentas', href: '/ranking' },
          { label: 'Comparador de ETFs' },
        ]} />
      </div>

      <div className="container mx-auto max-w-7xl px-4 pt-4 pb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Comparador de ETFs</h1>
            <p className="text-muted-foreground">
              Compare até 6 ETFs lado a lado — taxa, retorno, patrimônio e Score PJ
            </p>
          </div>
          <Badge className="bg-teal-600 text-white">
            <Trophy className="w-3.5 h-3.5 mr-1" />
            Ouro / Prata / Bronze
          </Badge>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-12 space-y-14">
        {/* Selector */}
        <EtfComparisonSelector />

        {/* Como funciona */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 hover:border-teal-300 dark:hover:border-teal-700 transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-green-500 rounded-xl flex items-center justify-center mb-3">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-base">Score PJ-ETF</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nosso score 0–100 pondera custo (18%), retorno (22%), liquidez (18%), solidez (12%), qualidade da carteira (18%) e análise IA (12%).
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-teal-300 dark:hover:border-teal-700 transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mb-3">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-base">Medalhas por Critério</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cada coluna elege o vencedor com 🥇 ouro, 🥈 prata e 🥉 bronze. Identifique qual ETF ganha em cada dimensão de análise.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-teal-300 dark:hover:border-teal-700 transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-3">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-base">Retornos Históricos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Compare retornos em 1m, 3m, 6m, 1 ano, 3 anos e 5 anos lado a lado. Veja qual ETF entrega mais no longo prazo.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Comparações populares */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1">Comparações Populares por Classe</h2>
            <p className="text-muted-foreground text-sm">
              Clique para comparar ETFs da mesma categoria e encontrar o melhor da classe
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularComparisons.map((comp) => {
              const Icon = comp.icon
              const grad = colorMap[comp.color] ?? 'from-gray-500 to-gray-600'
              return (
                <Card
                  key={comp.title}
                  className="group hover:shadow-xl transition-all border-2 hover:border-teal-300 dark:hover:border-teal-700"
                >
                  <CardHeader className="pb-2">
                    <div className={`w-10 h-10 bg-gradient-to-br ${grad} rounded-lg flex items-center justify-center mb-2`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <CardTitle className="text-sm">{comp.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{comp.description}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {comp.tickers.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all text-xs"
                    >
                      <Link href={`/compara-etfs/${comp.tickers.map((t) => t.toLowerCase()).join('/')}`}>
                        Comparar
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
