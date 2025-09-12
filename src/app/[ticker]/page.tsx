import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import Link from 'next/link'

// Shadcn UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

// Lucide Icons
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Percent,
  DollarSign,
  Target,
  BarChart3,
  Activity,
  PieChart,
  CheckCircle,
  XCircle,
  Eye,
  User,
  Crown,
  Zap,
  Mail,
  Coins,
  Calculator
} from 'lucide-react'

interface PageProps {
  params: {
    ticker: string
  }
}

// Tipo para dados financeiros (completo com todos os campos usados)
type FinancialDataType = {
  // Campos básicos
  lpa?: PrismaDecimal | null
  vpa?: PrismaDecimal | null
  pl?: PrismaDecimal | null
  pvp?: PrismaDecimal | null
  dy?: PrismaDecimal | null
  
  // Rentabilidade
  roe?: PrismaDecimal | null
  roa?: PrismaDecimal | null
  roic?: PrismaDecimal | null
  margemLiquida?: PrismaDecimal | null
  margemEbitda?: PrismaDecimal | null
  
  // Endividamento e Liquidez
  liquidezCorrente?: PrismaDecimal | null
  dividaLiquidaPl?: PrismaDecimal | null
  dividaLiquidaEbitda?: PrismaDecimal | null
  passivoAtivos?: PrismaDecimal | null
  
  // Crescimento
  crescimentoLucros?: PrismaDecimal | null
  crescimentoReceitas?: PrismaDecimal | null
  
  // Dados de mercado
  marketCap?: PrismaDecimal | null
  receitaTotal?: PrismaDecimal | null
  evEbitda?: PrismaDecimal | null
  
  // Dados gerais
  updatedAt?: Date | null
  
  [key: string]: PrismaDecimal | Date | null | undefined
}

// Interface para análise estratégica
interface StrategyAnalysis {
  isEligible: boolean
  score: number
  fairValue: number | null
  upside: number | null
  reasoning: string
  criteria: { label: string; value: boolean; description: string }[]
}

// Funções de formatação definidas mais abaixo

// Função helper para determinar tipo de indicador
function getIndicatorType(value: number | null, positiveThreshold?: number, negativeThreshold?: number): 'positive' | 'negative' | 'neutral' | 'default' {
  if (value === null) return 'default'
  
  if (positiveThreshold !== undefined && value >= positiveThreshold) return 'positive'
  if (negativeThreshold !== undefined && value <= negativeThreshold) return 'positive'
  if (positiveThreshold !== undefined && value < positiveThreshold) return 'negative'
  if (negativeThreshold !== undefined && value > negativeThreshold) return 'negative'
  
  return 'neutral'
}

// Componente IndicatorCard definido abaixo (após os componentes inline)

// Tipo para valores do Prisma que podem ser Decimal
type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

// Função para converter Decimal para number
function toNumber(value: PrismaDecimal | Date | string | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }
  return parseFloat(String(value))
}

// Funções de formatação
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatPercent(value: PrismaDecimal | Date | string | null): string {
  const numValue = toNumber(value)
  if (numValue === null || numValue === undefined) return 'N/A'
  return `${(numValue * 100).toFixed(2)}%`
}

function formatLargeNumber(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  
  if (value >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(2)}K`
  }
  return formatCurrency(value)
}

// Função para calcular preço justo de Graham
function calculateGrahamFairValue(lpa: PrismaDecimal | Date | string | null, vpa: PrismaDecimal | Date | string | null): number | null {
  const numLpa = toNumber(lpa)
  const numVpa = toNumber(vpa)
  if (!numLpa || !numVpa || numLpa <= 0 || numVpa <= 0) return null
  return Math.sqrt(22.5 * numLpa * numVpa)
}

// Componente inline para registro
function RegisterPrompt({ strategy }: { strategy: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg">
      <div className="mb-6">
        <User className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Crie sua conta gratuita
        </h3>
        <p className="text-muted-foreground">
          Para acessar a análise <strong>{strategy}</strong>
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6 max-w-md">
        <h4 className="font-semibold mb-4">✨ Com sua conta gratuita você terá:</h4>
        <div className="space-y-3 text-left">
          <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Análise Benjamin Graham completa
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Eye className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Histórico de análises salvas
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Zap className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span className="text-sm text-purple-800 dark:text-purple-200">
              Rankings personalizados
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
          <Link href="/register">
            <Mail className="w-4 h-4 mr-2" />
            Criar conta gratuita
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">
            Já tenho conta
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Componente inline para upgrade premium
function PremiumUpgrade({ strategy }: { strategy: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 rounded-lg">
      <div className="mb-6">
        <Crown className="w-16 h-16 text-orange-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Recurso Premium
        </h3>
        <p className="text-muted-foreground">
          A análise <strong>{strategy}</strong> está disponível para assinantes Premium
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6 max-w-md">
        <h4 className="font-semibold mb-4 flex items-center">
          <Crown className="w-5 h-5 text-orange-600 mr-2" />
          Premium inclui:
        </h4>
        <div className="space-y-3 text-left">
          <div className="flex items-center space-x-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <span className="text-sm text-orange-800 dark:text-orange-200">
              Anti-Dividend Trap
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span className="text-sm text-purple-800 dark:text-purple-200">
              Value Investing Completo
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Fórmula Mágica de Greenblatt
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Rankings ilimitados
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg" className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
          <Link href="/premium">
            <Crown className="w-4 h-4 mr-2" />
            Assinar Premium
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/pricing">
            Ver planos
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Componente para indicador com ícone - copiado exatamente do ticker-page-client
function IndicatorCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  type = 'default'
}: {
  title: string
  value: string | number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  description?: string
  type?: 'positive' | 'negative' | 'neutral' | 'default'
}) {
  const getColorClass = () => {
    switch (type) {
      case 'positive': return 'text-green-600 dark:text-green-400'
      case 'negative': return 'text-red-600 dark:text-red-400'
      case 'neutral': return 'text-blue-600 dark:text-blue-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${getColorClass()}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-xl font-bold">
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Análises estratégicas (seguindo exatamente os critérios do backend)
function analyzeGraham(financials: FinancialDataType, currentPrice: number): StrategyAnalysis {
  const lpa = toNumber(financials.lpa)
  const vpa = toNumber(financials.vpa)
  const roe = toNumber(financials.roe)
  const liquidezCorrente = toNumber(financials.liquidezCorrente)
  const margemLiquida = toNumber(financials.margemLiquida)
  const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl)
  const crescimentoLucros = toNumber(financials.crescimentoLucros)
  
  const fairValue = calculateGrahamFairValue(lpa, vpa)
  const upside = fairValue && currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : null
  
  const criteria = [
    { label: 'LPA positivo', value: !!(lpa && lpa > 0), description: `LPA: ${formatCurrency(lpa)}` },
    { label: 'VPA positivo', value: !!(vpa && vpa > 0), description: `VPA: ${formatCurrency(vpa)}` },
    { label: 'ROE ≥ 10%', value: !!(roe && roe >= 0.10), description: `ROE: ${formatPercent(roe)}` },
    { label: 'Liquidez Corrente ≥ 1.0', value: !!(liquidezCorrente && liquidezCorrente >= 1.0), description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A'}` },
    { label: 'Margem Líquida positiva', value: !!(margemLiquida && margemLiquida > 0), description: `Margem: ${formatPercent(margemLiquida)}` },
    { label: 'Dív. Líq./PL ≤ 150%', value: !dividaLiquidaPl || dividaLiquidaPl <= 1.5, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A'}` },
    { label: 'Crescimento Lucros ≥ -15%', value: !crescimentoLucros || crescimentoLucros >= -0.15, description: `Crescimento: ${formatPercent(crescimentoLucros)}` }
  ]

  const passedCriteria = criteria.filter(c => c.value).length
  const isEligible = passedCriteria >= 5 && !!fairValue && !!upside && upside >= 10
  const score = (passedCriteria / criteria.length) * 100
  
  // Calcular quality score como no backend
  const qualityScore = (
    Math.min(roe || 0, 0.25) * 40 +
    Math.min(liquidezCorrente || 0, 2.5) * 20 +
    Math.min(margemLiquida || 0, 0.15) * 100 +
    Math.max(0, (crescimentoLucros || 0) + 0.15) * 50
  )

  return {
    isEligible,
    score,
    fairValue,
    upside,
    reasoning: isEligible 
      ? `✅ Empresa aprovada no modelo Graham com ${upside?.toFixed(1)}% de margem de segurança. Score de qualidade: ${qualityScore.toFixed(1)}/100.`
      : `❌ Empresa não atende aos critérios Graham (${passedCriteria}/7 critérios aprovados).`,
    criteria
  }
}

function analyzeDividendYield(financials: FinancialDataType, currentPrice: number, minYield: number = 0.04): StrategyAnalysis {
  const dy = toNumber(financials.dy)
  const roe = toNumber(financials.roe)
  const liquidezCorrente = toNumber(financials.liquidezCorrente)
  const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl)
  const pl = toNumber(financials.pl)
  const margemLiquida = toNumber(financials.margemLiquida)
  const marketCap = toNumber(financials.marketCap)
  const roic = toNumber(financials.roic)

  const criteria = [
    { label: `Dividend Yield ≥ ${(minYield * 100).toFixed(0)}%`, value: !!(dy && dy >= minYield), description: `DY: ${formatPercent(dy)}` },
    { label: 'ROE ≥ 10%', value: !!(roe && roe >= 0.10), description: `ROE: ${formatPercent(roe)}` },
    { label: 'Liquidez Corrente ≥ 1.2', value: !!(liquidezCorrente && liquidezCorrente >= 1.2), description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A'}` },
    { label: 'Dív. Líq./PL ≤ 100%', value: !dividaLiquidaPl || dividaLiquidaPl <= 1.0, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A'}` },
    { label: 'P/L entre 5-25', value: !!(pl && pl >= 5 && pl <= 25), description: `P/L: ${pl?.toFixed(1) || 'N/A'}` },
    { label: 'Margem Líquida ≥ 5%', value: !!(margemLiquida && margemLiquida >= 0.05), description: `Margem: ${formatPercent(margemLiquida)}` },
    { label: 'Market Cap ≥ R$ 1B', value: !!(marketCap && marketCap >= 1000000000), description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000000).toFixed(1)}B` : 'N/A'}` }
  ]
  
  const passedCriteria = criteria.filter(c => c.value).length
  const isEligible = passedCriteria >= 5 && !!dy && dy >= minYield
  const score = (passedCriteria / criteria.length) * 100

  // Calcular sustainability score como no backend
  const sustainabilityScore = (
    Math.min(roe || 0, 0.30) * 25 +
    Math.min(liquidezCorrente || 0, 3) * 15 +
    Math.max(0, 50 - (dividaLiquidaPl || 0) * 50) +
    Math.min(margemLiquida || 0, 0.20) * 75 +
    Math.min(roic || 0, 0.25) * 20 +
    (dy || 0) * 50
  )
  
  return {
    isEligible,
    score,
    fairValue: null,
    upside: dy ? (dy * 100) : null,
    reasoning: isEligible 
      ? `✅ Aprovada no Anti-Dividend Trap com DY ${formatPercent(dy)}. Score de sustentabilidade: ${sustainabilityScore.toFixed(1)}/100.`
      : `❌ Empresa pode ser dividend trap (${passedCriteria}/7 critérios aprovados).`,
    criteria
  }
}

function analyzeLowPE(financials: FinancialDataType, maxPE: number = 12, minROE: number = 0): StrategyAnalysis {
  const pl = toNumber(financials.pl)
  const roe = toNumber(financials.roe)
  const crescimentoReceitas = toNumber(financials.crescimentoReceitas)
  const margemLiquida = toNumber(financials.margemLiquida)
  const liquidezCorrente = toNumber(financials.liquidezCorrente)
  const roa = toNumber(financials.roa)
  const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl)
  const marketCap = toNumber(financials.marketCap)
  const roic = toNumber(financials.roic)

  const criteria = [
    { label: `P/L entre 3-${maxPE}`, value: !!(pl && pl > 3 && pl <= maxPE), description: `P/L: ${pl?.toFixed(1) || 'N/A'}` },
    { label: `ROE ≥ ${(minROE * 100).toFixed(0)}%`, value: !!(roe && roe >= minROE), description: `ROE: ${formatPercent(roe)}` },
    { label: 'Crescimento Receitas ≥ -10%', value: !crescimentoReceitas || crescimentoReceitas >= -0.10, description: `Crescimento: ${formatPercent(crescimentoReceitas)}` },
    { label: 'Margem Líquida ≥ 3%', value: !!(margemLiquida && margemLiquida >= 0.03), description: `Margem: ${formatPercent(margemLiquida)}` },
    { label: 'Liquidez Corrente ≥ 1.0', value: !!(liquidezCorrente && liquidezCorrente >= 1.0), description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A'}` },
    { label: 'ROA ≥ 5%', value: !!(roa && roa >= 0.05), description: `ROA: ${formatPercent(roa)}` },
    { label: 'Dív. Líq./PL ≤ 200%', value: !dividaLiquidaPl || dividaLiquidaPl <= 2.0, description: `Dív/PL: ${dividaLiquidaPl?.toFixed(1) || 'N/A'}` },
    { label: 'Market Cap ≥ R$ 500M', value: !!(marketCap && marketCap >= 500000000), description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000).toFixed(0)}M` : 'N/A'}` }
  ]
  
  const passedCriteria = criteria.filter(c => c.value).length
  const isEligible = passedCriteria >= 6 && !!pl && pl > 3 && pl <= maxPE
  const score = (passedCriteria / criteria.length) * 100

  // Calcular value score como no backend
  const valueScore = (
    Math.max(0, 50 - (pl || 0) * 2) +
    Math.min(roe || 0, 0.30) * 50 +
    Math.min(roa || 0, 0.20) * 100 +
    Math.min(margemLiquida || 0, 0.20) * 80 +
    Math.max(0, (crescimentoReceitas || 0) + 0.10) * 30 +
    Math.min(roic || 0, 0.25) * 40
  )
  
  return {
    isEligible,
    score,
    fairValue: null,
    upside: null,
    reasoning: isEligible 
      ? `✅ Aprovada no Value Investing com P/L ${pl?.toFixed(1)}. Value Score: ${valueScore.toFixed(1)}/100. Não é value trap.`
      : `❌ Empresa pode ser value trap (${passedCriteria}/8 critérios aprovados).`,
    criteria
  }
}

function analyzeMagicFormula(financials: FinancialDataType): StrategyAnalysis {
  const roic = toNumber(financials.roic)
  const pl = toNumber(financials.pl)
  const marketCap = toNumber(financials.marketCap)
  const crescimentoReceitas = toNumber(financials.crescimentoReceitas)
  const margemEbitda = toNumber(financials.margemEbitda)
  const liquidezCorrente = toNumber(financials.liquidezCorrente)
  const roe = toNumber(financials.roe)

  const criteria = [
    { label: 'ROIC > 0%', value: !!(roic && roic > 0), description: `ROIC: ${formatPercent(roic)}` },
    { label: 'P/L > 0', value: !!(pl && pl > 0), description: `P/L: ${pl?.toFixed(1) || 'N/A'}` },
    { label: 'Market Cap ≥ R$ 1B', value: !!(marketCap && marketCap >= 1000000000), description: `Market Cap: ${marketCap ? `R$ ${(marketCap / 1000000000).toFixed(1)}B` : 'N/A'}` },
    { label: 'Crescimento Receitas ≥ -15%', value: !crescimentoReceitas || crescimentoReceitas >= -0.15, description: `Crescimento: ${formatPercent(crescimentoReceitas)}` },
    { label: 'Margem EBITDA ≥ 10%', value: !!(margemEbitda && margemEbitda >= 0.10), description: `Margem EBITDA: ${formatPercent(margemEbitda)}` },
    { label: 'Liquidez Corrente ≥ 1.0', value: !!(liquidezCorrente && liquidezCorrente >= 1.0), description: `LC: ${liquidezCorrente?.toFixed(2) || 'N/A'}` },
    { label: 'ROE ≥ 8%', value: !!(roe && roe >= 0.08), description: `ROE: ${formatPercent(roe)}` }
  ]
  
  const passedCriteria = criteria.filter(c => c.value).length
  const isEligible = passedCriteria >= 6 && !!roic && roic > 0 && !!pl && pl > 0
  const score = (passedCriteria / criteria.length) * 100

  // Calcular ROIC ajustado e Earnings Yield como no backend
  const adjustedROIC = roic && margemEbitda && crescimentoReceitas 
    ? roic * (1 + Math.min((margemEbitda - 0.10), 0.20) * 0.01 + Math.max(-0.15, crescimentoReceitas) * 0.005)
    : roic || 0

  const earningsYield = pl ? 1 / pl : 0

  return {
    isEligible,
    score,
    fairValue: null,
    upside: null,
    reasoning: isEligible 
      ? `✅ Aprovada na Enhanced Magic Formula. ROIC Ajustado: ${(adjustedROIC * 100).toFixed(1)}%, Earnings Yield: ${(earningsYield * 100).toFixed(1)}%. Qualidade operacional + preço atrativo.`
      : `❌ Empresa não atende à Fórmula Mágica (${passedCriteria}/7 critérios aprovados).`,
    criteria
  }
}

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const ticker = resolvedParams.ticker.toUpperCase()
  
  try {
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        financialData: {
          orderBy: { reportDate: 'desc' },
          take: 1
        },
        dailyQuotes: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    })

    if (!company) {
      return {
        title: `${ticker} - Ticker Não Encontrado | Análise Fácil`,
        description: `O ticker ${ticker} não foi encontrado em nossa base de dados de análise de ações.`
      }
    }

    const latestFinancials = company.financialData[0]
    const currentPrice = toNumber(company.dailyQuotes[0]?.price) || 0
    const grahamFairValue = calculateGrahamFairValue(latestFinancials?.lpa, latestFinancials?.vpa)
    
    const title = `${ticker} - ${company.name} | Análise Fundamentalista Completa`
    const description = `Análise completa de ${company.name} (${ticker}): Preço atual R$ ${currentPrice.toFixed(2)}${grahamFairValue ? `, Preço Justo Graham R$ ${grahamFairValue.toFixed(2)}` : ''}. P/L: ${latestFinancials?.pl ? toNumber(latestFinancials.pl)?.toFixed(1) : 'N/A'}, ROE: ${latestFinancials?.roe ? (toNumber(latestFinancials.roe)! * 100).toFixed(1) + '%' : 'N/A'}. Setor: ${company.sector || 'N/A'}.`

    return {
      title,
      description,
      keywords: `${ticker}, ${company.name}, análise fundamentalista, ações, B3, bovespa, investimentos, ${company.sector}`,
      openGraph: {
        title,
        description,
        type: 'article',
        images: company.logoUrl ? [{ url: company.logoUrl, alt: `Logo ${company.name}` }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: company.logoUrl ? [company.logoUrl] : undefined,
      },
      alternates: {
        canonical: `/${ticker}`,
      },
      other: {
        'article:section': 'Análise de Ações',
        'article:tag': `${ticker}, ${company.name}, ${company.sector}`,
      }
    }
  } catch {
    return {
      title: `${ticker} - Análise de Ações | Análise Fácil`,
      description: `Análise fundamentalista da ação ${ticker} com indicadores financeiros, valuation e estratégias de investimento.`
    }
  }
}

export default async function TickerPage({ params }: PageProps) {
  const resolvedParams = await params
  const ticker = resolvedParams.ticker.toUpperCase()

  // Verificar sessão do usuário
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user
  const isPremium = session?.user?.subscriptionTier === 'PREMIUM'

  // Buscar dados da empresa
  const companyData = await prisma.company.findUnique({
    where: { ticker },
    include: {
      financialData: {
        orderBy: { reportDate: 'desc' },
        take: 1
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1
      }
    }
  })

  if (!companyData) {
    notFound()
  }

  const latestFinancials = companyData.financialData[0]
  const latestQuote = companyData.dailyQuotes[0]
  const currentPrice = toNumber(latestQuote?.price) || toNumber(latestFinancials?.lpa) || 0

  // Executar análises estratégicas
  let strategicAnalyses: Record<string, StrategyAnalysis> = {}
  if (latestFinancials) {
    strategicAnalyses = {
      graham: analyzeGraham(latestFinancials, currentPrice),
      dividendYield: analyzeDividendYield(latestFinancials, currentPrice),
      lowPE: analyzeLowPE(latestFinancials),
      magicFormula: analyzeMagicFormula(latestFinancials)
    }
  }

  // Converter dados financeiros para números (evitar erro Decimal do Prisma)
  const serializedFinancials = latestFinancials ? Object.fromEntries(
    Object.entries(latestFinancials).map(([key, value]) => [
      key,
      // Converter Decimals para números, manter Dates e outros tipos
      value && typeof value === 'object' && 'toNumber' in value 
        ? value.toNumber() 
        : value
    ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any : null

  return (
    <>
      <div className="container mx-auto py-8 px-4">
        {/* Header da Empresa - EXATAMENTE como no ticker-page-client */}
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start space-x-6">
                {/* Logo da empresa com fallback */}
                <div className="flex-shrink-0">
                  <CompanyLogo
                    logoUrl={companyData.logoUrl}
                    companyName={companyData.name}
                    ticker={ticker}
                    size={80}
                  />
                </div>

                {/* Informações básicas */}
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-bold">{ticker}</h1>
                    <Badge variant="secondary" className="text-sm">
                      {companyData.sector || 'N/A'}
                    </Badge>
                  </div>
                  
                  <h2 className="text-xl text-muted-foreground mb-3">
                    {companyData.name}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {companyData.industry && (
                      <div className="flex items-center space-x-2">
                        <PieChart className="w-4 h-4 text-muted-foreground" />
                        <span>{companyData.industry}</span>
                      </div>
                    )}
                    
                    {companyData.website && (
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <Link 
                          href={companyData.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Site oficial
                        </Link>
                      </div>
                    )}
                    
                    {(companyData.city || companyData.state) && (
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {[companyData.city, companyData.state].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}

                    {companyData.fullTimeEmployees && (
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{companyData.fullTimeEmployees.toLocaleString()} funcionários</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preço atual */}
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Preço Atual</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(currentPrice)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Último dado disponível
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {latestFinancials && (
          <>
            {/* Análises Estratégicas - EXATAMENTE como no ticker-page-client */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                <Zap className="w-6 h-6" />
                <span>Análises de Investimento</span>
              </h2>

              <Tabs defaultValue="graham" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="graham" className="flex items-center space-x-2">
                    <Calculator className="w-4 h-4" />
                    <span className="hidden sm:inline">Graham</span>
                    {!isLoggedIn && <Crown className="w-3 h-3 ml-1" />}
                  </TabsTrigger>
                  
                  <TabsTrigger value="dividend" className="flex items-center space-x-2">
                    <Coins className="w-4 h-4" />
                    <span className="hidden sm:inline">Dividendos</span>
                    {!isPremium && <Crown className="w-3 h-3 ml-1 text-yellow-500" />}
                  </TabsTrigger>
                  
                  <TabsTrigger value="value" className="flex items-center space-x-2">
                    <Target className="w-4 h-4" />
                    <span className="hidden sm:inline">Value</span>
                    {!isPremium && <Crown className="w-3 h-3 ml-1 text-yellow-500" />}
                  </TabsTrigger>
                  
                  <TabsTrigger value="magic" className="flex items-center space-x-2">
                    <Crown className="w-4 h-4" />
                    <span className="hidden sm:inline">Magic</span>
                    {!isPremium && <Crown className="w-3 h-3 ml-1 text-yellow-500" />}
                  </TabsTrigger>
                </TabsList>

                {/* Benjamin Graham Analysis */}
                <TabsContent value="graham" className="mt-6">
                  {!isLoggedIn ? (
                    <RegisterPrompt strategy="Benjamin Graham" />
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Calculator className="w-5 h-5" />
                            <span>Benjamin Graham</span>
                          </div>
                          <Badge variant={strategicAnalyses.graham?.isEligible ? "default" : "secondary"}>
                            {strategicAnalyses.graham?.score?.toFixed(0) || 0}% dos critérios
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Atual</p>
                            <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Justo Graham</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {strategicAnalyses.graham?.fairValue ? 
                                formatCurrency(strategicAnalyses.graham.fairValue) : 'N/A'
                              }
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Margem de Segurança</p>
                            <div className="flex items-center justify-center space-x-2">
                              {strategicAnalyses.graham?.upside && strategicAnalyses.graham.upside > 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-500" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-red-500" />
                              )}
                              <p className={`text-2xl font-bold ${
                                strategicAnalyses.graham?.upside && strategicAnalyses.graham.upside > 0 ? 
                                'text-green-600' : 'text-red-600'
                              }`}>
                                {strategicAnalyses.graham?.upside ? 
                                  `${strategicAnalyses.graham.upside.toFixed(1)}%` : 'N/A'
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <MarkdownRenderer content={strategicAnalyses.graham?.reasoning || ''} />
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium">Critérios Avaliados:</h4>
                          {strategicAnalyses.graham?.criteria.map((criterion, index) => (
                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                {criterion.value ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">{criterion.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {criterion.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Dividend Yield Analysis - Requires Premium */}
                <TabsContent value="dividend" className="mt-6">
                  {!isPremium ? (
                    !isLoggedIn ? (
                      <RegisterPrompt strategy="Anti-Dividend Trap" />
                    ) : (
                      <PremiumUpgrade strategy="Anti-Dividend Trap" />
                    )
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Coins className="w-5 h-5" />
                            <span>Anti-Dividend Trap</span>
                          </div>
                          <Badge variant={strategicAnalyses.dividendYield?.isEligible ? "default" : "secondary"}>
                            {strategicAnalyses.dividendYield?.score?.toFixed(0) || 0}% dos critérios
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Dividend Yield</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatPercent(latestFinancials.dy)}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Rendimento Anual Est.</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {strategicAnalyses.dividendYield?.upside ? 
                                `${strategicAnalyses.dividendYield.upside.toFixed(1)}%` : 'N/A'
                              }
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Sustentabilidade</p>
                            <div className="flex items-center justify-center space-x-2">
                              {strategicAnalyses.dividendYield?.isEligible ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <p className={`text-lg font-bold ${
                                strategicAnalyses.dividendYield?.isEligible ? 
                                'text-green-600' : 'text-red-600'
                              }`}>
                                {strategicAnalyses.dividendYield?.isEligible ? 'Segura' : 'Risco'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <MarkdownRenderer content={strategicAnalyses.dividendYield?.reasoning || ''} />
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium">Critérios Anti-Trap:</h4>
                          {strategicAnalyses.dividendYield?.criteria.map((criterion, index) => (
                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                {criterion.value ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">{criterion.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {criterion.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Value Investing Analysis - Requires Premium */}
                <TabsContent value="value" className="mt-6">
                  {!isPremium ? (
                    !isLoggedIn ? (
                      <RegisterPrompt strategy="Value Investing" />
                    ) : (
                      <PremiumUpgrade strategy="Value Investing" />
                    )
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Target className="w-5 h-5" />
                            <span>Value Investing</span>
                          </div>
                          <Badge variant={strategicAnalyses.lowPE?.isEligible ? "default" : "secondary"}>
                            {strategicAnalyses.lowPE?.score?.toFixed(0) || 0}% dos critérios
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <MarkdownRenderer content={strategicAnalyses.lowPE?.reasoning || ''} />
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium">Critérios Anti-Value Trap:</h4>
                          {strategicAnalyses.lowPE?.criteria.map((criterion, index) => (
                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                {criterion.value ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">{criterion.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {criterion.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Magic Formula Analysis - Requires Premium */}
                <TabsContent value="magic" className="mt-6">
                  {!isPremium ? (
                    !isLoggedIn ? (
                      <RegisterPrompt strategy="Fórmula Mágica" />
                    ) : (
                      <PremiumUpgrade strategy="Fórmula Mágica" />
                    )
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Crown className="w-5 h-5" />
                            <span>Fórmula Mágica (Greenblatt)</span>
                          </div>
                          <Badge variant={strategicAnalyses.magicFormula?.isEligible ? "default" : "secondary"}>
                            {strategicAnalyses.magicFormula?.score?.toFixed(0) || 0}% dos critérios
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">ROIC</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {formatPercent(latestFinancials.roic)}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">P/L</p>
                            <p className="text-2xl font-bold text-green-600">
                              {toNumber(latestFinancials.pl)?.toFixed(1) || 'N/A'}
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Qualidade Operacional</p>
                            <div className="flex items-center justify-center space-x-2">
                              {strategicAnalyses.magicFormula?.isEligible ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <p className={`text-lg font-bold ${
                                strategicAnalyses.magicFormula?.isEligible ? 
                                'text-green-600' : 'text-red-600'
                              }`}>
                                {strategicAnalyses.magicFormula?.isEligible ? 'Aprovada' : 'Reprovada'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <MarkdownRenderer content={strategicAnalyses.magicFormula?.reasoning || ''} />
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium">Critérios da Fórmula Mágica:</h4>
                          {strategicAnalyses.magicFormula?.criteria.map((criterion, index) => (
                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                {criterion.value ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">{criterion.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {criterion.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Indicadores Financeiros - SEMPRE VISÍVEIS PARA SEO - EXATAMENTE como no ticker-page-client */}
            <div className="space-y-8">
              {/* Valuation */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Indicadores de Valuation</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <IndicatorCard
                    title="P/L"
                    value={toNumber(latestFinancials.pl)?.toFixed(2) || 'N/A'}
                    icon={BarChart3}
                    description="Preço/Lucro por Ação"
                    type={getIndicatorType(toNumber(latestFinancials.pl), undefined, 15)}
                  />
                  
                  <IndicatorCard
                    title="P/VP"
                    value={toNumber(latestFinancials.pvp)?.toFixed(2) || 'N/A'}
                    icon={PieChart}
                    description="Preço/Valor Patrimonial"
                    type={getIndicatorType(toNumber(latestFinancials.pvp), undefined, 1.5)}
                  />
                  
                  <IndicatorCard
                    title="Dividend Yield"
                    value={formatPercent(latestFinancials.dy)}
                    icon={DollarSign}
                    description="Rendimento de Dividendos"
                    type={getIndicatorType(toNumber(latestFinancials.dy), 0.06)}
                  />
                  
                  <IndicatorCard
                    title="EV/EBITDA"
                    value={toNumber(latestFinancials.evEbitda)?.toFixed(2) || 'N/A'}
                    icon={Activity}
                    description="Enterprise Value/EBITDA"
                    type={getIndicatorType(toNumber(latestFinancials.evEbitda), undefined, 10)}
                  />
                </div>
              </div>

              {/* Rentabilidade */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Percent className="w-5 h-5" />
                  <span>Indicadores de Rentabilidade</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <IndicatorCard
                    title="ROE"
                    value={formatPercent(latestFinancials.roe)}
                    icon={TrendingUp}
                    description="Return on Equity"
                    type={getIndicatorType(toNumber(latestFinancials.roe), 0.15)}
                  />
                  
                  <IndicatorCard
                    title="ROA"
                    value={formatPercent(latestFinancials.roa)}
                    icon={BarChart3}
                    description="Return on Assets"
                    type={getIndicatorType(toNumber(latestFinancials.roa), 0.05)}
                  />
                  
                  <IndicatorCard
                    title="ROIC"
                    value={formatPercent(latestFinancials.roic)}
                    icon={Target}
                    description="Return on Invested Capital"
                    type={getIndicatorType(toNumber(latestFinancials.roic), 0.10)}
                  />
                  
                  <IndicatorCard
                    title="Margem Líquida"
                    value={formatPercent(latestFinancials.margemLiquida)}
                    icon={PieChart}
                    description="Margem de Lucro Líquido"
                    type={getIndicatorType(toNumber(latestFinancials.margemLiquida), 0.10)}
                  />
                </div>
              </div>

              {/* Endividamento e Liquidez */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Building2 className="w-5 h-5" />
                  <span>Endividamento e Liquidez</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <IndicatorCard
                    title="Liquidez Corrente"
                    value={toNumber(latestFinancials.liquidezCorrente)?.toFixed(2) || 'N/A'}
                    icon={Activity}
                    description="Ativos/Passivos Circulantes"
                    type={getIndicatorType(toNumber(latestFinancials.liquidezCorrente), 1.2)}
                  />
                  
                  <IndicatorCard
                    title="Dív. Líq./PL"
                    value={toNumber(latestFinancials.dividaLiquidaPl)?.toFixed(2) || 'N/A'}
                    icon={TrendingDown}
                    description="Dívida Líquida/Patrimônio"
                    type={getIndicatorType(toNumber(latestFinancials.dividaLiquidaPl), undefined, 0.5)}
                  />
                  
                  <IndicatorCard
                    title="Dív. Líq./EBITDA"
                    value={toNumber(latestFinancials.dividaLiquidaEbitda)?.toFixed(2) || 'N/A'}
                    icon={BarChart3}
                    description="Dívida Líquida/EBITDA"
                    type={getIndicatorType(toNumber(latestFinancials.dividaLiquidaEbitda), undefined, 3)}
                  />
                  
                  <IndicatorCard
                    title="Passivo/Ativos"
                    value={formatPercent(latestFinancials.passivoAtivos)}
                    icon={PieChart}
                    description="Alavancagem da Empresa"
                    type={getIndicatorType(toNumber(latestFinancials.passivoAtivos), undefined, 0.6)}
                  />
                </div>
              </div>

              {/* Dados de Mercado */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Dados de Mercado</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <IndicatorCard
                    title="Market Cap"
                    value={formatLargeNumber(toNumber(latestFinancials.marketCap))}
                    icon={Building2}
                    description="Valor de Mercado"
                  />
                  
                  <IndicatorCard
                    title="LPA"
                    value={formatCurrency(toNumber(latestFinancials.lpa))}
                    icon={DollarSign}
                    description="Lucro por Ação"
                  />
                  
                  <IndicatorCard
                    title="VPA"
                    value={formatCurrency(toNumber(latestFinancials.vpa))}
                    icon={BarChart3}
                    description="Valor Patrimonial por Ação"
                  />
                  
                  <IndicatorCard
                    title="Receita Total"
                    value={formatLargeNumber(toNumber(latestFinancials.receitaTotal))}
                    icon={TrendingUp}
                    description="Receita Anual"
                  />
                </div>
              </div>
            </div>

            {/* Footer com data da atualização */}
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Dados financeiros atualizados em: {' '}
                {latestFinancials.updatedAt 
                  ? new Date(latestFinancials.updatedAt).toLocaleDateString('pt-BR')
                  : 'N/A'
                }
              </p>
            </div>
          </>
        )}
      </div>

      {/* Schema Structured Data para SEO */}
      {latestFinancials && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Corporation",
              "name": companyData.name,
              "alternateName": ticker,
              "description": `Análise fundamentalista completa de ${companyData.name} (${ticker}) com indicadores financeiros, valuation e estratégias de investimento.`,
              "url": `https://analise-facil.com.br/${ticker}`,
              "logo": companyData.logoUrl || undefined,
              "sameAs": companyData.website ? [companyData.website] : undefined,
              "address": companyData.address ? {
                "@type": "PostalAddress",
                "addressLocality": companyData.city,
                "addressRegion": companyData.state,
                "addressCountry": "BR"
              } : undefined,
              "numberOfEmployees": companyData.fullTimeEmployees,
              "industry": companyData.industry,
              "sector": companyData.sector,
              "marketCapitalization": {
                "@type": "MonetaryAmount",
                "currency": "BRL",
                "value": toNumber(latestFinancials.marketCap)
              },
              "revenue": {
                "@type": "MonetaryAmount", 
                "currency": "BRL",
                "value": toNumber(latestFinancials.receitaTotal)
              },
              "stockExchange": "B3 - Brasil Bolsa Balcão",
              "tickerSymbol": ticker,
              "priceRange": formatCurrency(currentPrice),
              "dividendYield": toNumber(latestFinancials.dy),
              "peRatio": toNumber(latestFinancials.pl),
              "pbRatio": toNumber(latestFinancials.pvp),
              "roe": toNumber(latestFinancials.roe),
              "roa": toNumber(latestFinancials.roa),
              "lastUpdated": latestFinancials.updatedAt?.toISOString()
            })
          }}
        />
      )}
    </>
  )
}
