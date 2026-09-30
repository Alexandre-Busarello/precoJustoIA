import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { executeMultipleCompanyAnalysis } from '@/lib/company-analysis-service'
import { cache } from '@/lib/cache-service'
import { checkAndRecordUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import {
  formatBRL,
  formatBRLCompact,
  formatDeltaPct,
  formatMultiple,
  formatNumber,
  formatPct,
} from '@/lib/format'
import { AnonLimitCTA } from '@/components/anon-limit-cta'
import { PageHeader } from '@/components/page-header'
import { AddToBacktestButton } from '@/components/add-to-backtest-button'
import { Button } from '@/components/ui/button'
import {
  ComparisonTable,
  type ComparisonBetter,
  type ComparisonGroup,
  type ComparisonRow,
} from '@/components/comparison-table'

interface PageProps {
  params: {
    tickers: string[]
  }
}

// Tipo para valores do Prisma que podem ser Decimal
type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

// Converte Decimal/string para number (null quando não há valor válido)
function toNumber(value: PrismaDecimal | Date | string | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && 'toNumber' in value) return value.toNumber()
  const parsed = parseFloat(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

// Média de até 7 anos históricos de um indicador (excluindo o ano atual, que é o primeiro)
function calculateHistoricalAverage(financialDataArray: Record<string, unknown>[], fieldName: string): number | null {
  if (!financialDataArray || financialDataArray.length === 0) return null
  const validValues = financialDataArray
    .slice(1, 8)
    .map((data) => toNumber(data[fieldName] as PrismaDecimal))
    .filter((val): val is number => val !== null && !Number.isNaN(val))
  if (validValues.length === 0) return null
  return validValues.reduce((acc, val) => acc + val, 0) / validValues.length
}

// Cache usa Redis com fallback para memória
const STRATEGIES_CACHE_TTL = 1440 * 60 // 1 dia em segundos

type StrategyScore = { score: number } | null | undefined
interface CompanyStrategies {
  strategies: Record<string, StrategyScore> | null
  overallScore: { score: number } | null
}

// Executa as estratégias e o score geral de cada empresa (em paralelo, com cache)
async function loadStrategies(companies: Record<string, unknown>[]): Promise<Map<string, CompanyStrategies>> {
  const entries = await Promise.all(
    companies.map(async (company) => {
      const dailyQuotes = company.dailyQuotes as Record<string, unknown>[]
      const financialData = company.financialData as Record<string, unknown>[]
      const currentPrice =
        toNumber(dailyQuotes?.[0]?.price as PrismaDecimal) || toNumber(financialData?.[0]?.lpa as PrismaDecimal) || 0

      const cacheKey = `strategies-${company.ticker}-${currentPrice}`
      const cached = await cache.get<CompanyStrategies>(cacheKey, { prefix: 'comparison', ttl: STRATEGIES_CACHE_TTL })
      if (cached) return [company.ticker as string, cached] as const

      const strategies = await executeStrategiesForCompany(company, true)
      await cache.set(cacheKey, strategies, { prefix: 'comparison', ttl: STRATEGIES_CACHE_TTL })
      return [company.ticker as string, strategies] as const
    })
  )
  return new Map(entries)
}

// Executa estratégias e calcula o score geral usando o serviço centralizado
async function executeStrategiesForCompany(company: Record<string, unknown>, userIsPremium: boolean): Promise<CompanyStrategies> {
  try {
    const financialDataArray = company.financialData as Record<string, unknown>[]

    // Dados históricos (excluindo o primeiro, que é o atual). Decimal → number para evitar erros de serialização.
    const historicalFinancials = financialDataArray.slice(1).map((data) => ({
      year: data.year as number,
      roe: toNumber(data.roe as PrismaDecimal),
      roic: toNumber(data.roic as PrismaDecimal),
      pl: toNumber(data.pl as PrismaDecimal),
      pvp: toNumber(data.pvp as PrismaDecimal),
      dy: toNumber(data.dy as PrismaDecimal),
      margemLiquida: toNumber(data.margemLiquida as PrismaDecimal),
      margemEbitda: toNumber(data.margemEbitda as PrismaDecimal),
      margemBruta: toNumber(data.margemBruta as PrismaDecimal),
      liquidezCorrente: toNumber(data.liquidezCorrente as PrismaDecimal),
      liquidezRapida: toNumber(data.liquidezRapida as PrismaDecimal),
      dividaLiquidaPl: toNumber(data.dividaLiquidaPl as PrismaDecimal),
      dividaLiquidaEbitda: toNumber(data.dividaLiquidaEbitda as PrismaDecimal),
      lpa: toNumber(data.lpa as PrismaDecimal),
      vpa: toNumber(data.vpa as PrismaDecimal),
      marketCap: toNumber(data.marketCap as PrismaDecimal),
      earningsYield: toNumber(data.earningsYield as PrismaDecimal),
      evEbitda: toNumber(data.evEbitda as PrismaDecimal),
      roa: toNumber(data.roa as PrismaDecimal),
      passivoAtivos: toNumber(data.passivoAtivos as PrismaDecimal),
    }))

    const companyForAnalysis = {
      ticker: company.ticker as string,
      name: company.name as string,
      sector: company.sector as string | null,
      industry: company.industry as string | null,
      id: company.id as string,
      financialData: financialDataArray,
      dailyQuotes: company.dailyQuotes as Record<string, unknown>[],
      historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined,
    }

    const [result] = await executeMultipleCompanyAnalysis([companyForAnalysis], {
      isLoggedIn: true, // Assumir logado para comparação
      isPremium: userIsPremium,
      includeStatements: true, // Sempre incluir demonstrações para consistência
    })

    return {
      strategies: result.strategies as unknown as Record<string, StrategyScore>,
      overallScore: result.overallScore,
    }
  } catch (error) {
    console.error(`Erro ao executar estratégias para ${company.ticker}:`, error)
    return { strategies: null, overallScore: null }
  }
}

// Gerar metadata dinâmico para SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const tickersParam = resolvedParams.tickers // Manter tickers originais da URL
  const tickers = tickersParam.map((t) => t.toUpperCase()) // Maiúsculo apenas para consulta no BD
  const canonical = `/compara-acoes/${tickersParam.map((t) => t.toLowerCase()).join('/')}`

  if (tickers.length < 2) {
    return {
      title: 'Comparação de ações',
      description: 'Compare ações da B3 com análise fundamentalista completa.',
    }
  }

  try {
    const companies = await prisma.company.findMany({
      where: { ticker: { in: tickers } },
      select: { ticker: true, name: true, sector: true },
    })

    const foundTickers = companies.map((c) => c.ticker).join(' vs ')
    const companyNames = companies.map((c) => c.name).join(', ')

    const title = `Comparação ${foundTickers} | Análise Comparativa de Ações`
    const description = `Compare as ações ${foundTickers} (${companyNames}) com análise fundamentalista completa. Indicadores financeiros, valuation, estratégias de investimento e scores lado a lado.`

    return {
      title,
      description,
      keywords: `${foundTickers}, comparação de ações, análise comparativa, ${companyNames}, B3, bovespa, investimentos, análise fundamentalista, valuation`,
      openGraph: {
        title,
        description,
        type: 'article',
        url: canonical,
        siteName: 'Preço Justo AI',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        creator: '@PrecoJustoAI',
        site: '@PrecoJustoAI',
      },
      alternates: { canonical },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
    }
  } catch {
    return {
      title: `Comparação ${tickers.join(' vs ')} | Análise Comparativa de Ações`,
      description: `Compare as ações ${tickers.join(', ')} com análise fundamentalista completa, indicadores financeiros e estratégias de investimento.`,
      alternates: { canonical },
    }
  }
}

export default async function CompareStocksPage({ params }: PageProps) {
  const resolvedParams = await params
  const tickersParam = resolvedParams.tickers // Manter tickers originais da URL
  const tickers = tickersParam.map((t) => t.toUpperCase()) // Maiúsculo apenas para consulta no BD

  // Validar se há pelo menos 2 tickers
  if (tickers.length < 2) {
    notFound()
  }

  // Sessão do usuário para recursos premium e SEO
  const session = await getServerSession(authOptions)
  let canViewFullContent = false
  let shouldShowAnonLimitCTA = false

  if (session?.user?.id) {
    // Premium é a única fonte da verdade para usuários logados
    const user = await getCurrentUser()
    canViewFullContent = user?.isPremium || false
  } else {
    // Anônimo: limite de 2 visualizações completas por IP
    const headersList = await headers()
    const ip = RateLimitMiddleware.getClientIPFromHeaders(headersList)
    const resourceId = `compare:${[...tickers].sort().join('-')}`
    const usageResult = await checkAndRecordUsage({
      userId: null,
      ip,
      feature: 'anon_full_view',
      resourceId,
      recordUsage: true,
    })
    canViewFullContent = usageResult.allowed
    shouldShowAnonLimitCTA = !usageResult.allowed && usageResult.shouldConvertLead
  }

  // Dados das empresas (atual + até 7 anos históricos para médias)
  const companiesData = await prisma.company.findMany({
    where: { ticker: { in: tickers } },
    select: {
      id: true,
      ticker: true,
      name: true,
      sector: true,
      industry: true,
      logoUrl: true,
      financialData: {
        orderBy: { year: 'desc' },
        take: 8,
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
      },
      keyStatistics: {
        orderBy: { endDate: 'desc' },
        take: 1,
      },
    },
  })

  // Verificar se todas as empresas foram encontradas
  const foundTickers = companiesData.map((c) => c.ticker)
  if (tickers.some((t) => !foundTickers.includes(t))) {
    notFound()
  }

  // Colunas na ordem pedida na URL
  const companies = tickers.map((ticker) => companiesData.find((c) => c.ticker === ticker)!)
  // Score e notas por modelo só aparecem com acesso completo: sem ele, nem calcula
  const strategiesByTicker = canViewFullContent
    ? await loadStrategies(companies as unknown as Record<string, unknown>[])
    : new Map<string, CompanyStrategies>()

  type Company = (typeof companies)[number]
  const latest = (c: Company) => c.financialData[0] as Record<string, unknown> | undefined
  const field = (c: Company, name: string) => toNumber(latest(c)?.[name] as PrismaDecimal)
  const history = (c: Company) => c.financialData as unknown as Record<string, unknown>[]
  const strategyScore = (c: Company, key: string) => {
    const score = strategiesByTicker.get(c.ticker)?.strategies?.[key]?.score
    return typeof score === 'number' ? score : null
  }
  const score100 = (v: number | null) => formatNumber(v, { digits: 0 })

  function metricRow(options: {
    key: string
    label: string
    description?: string
    hint?: string
    better: ComparisonBetter
    premium?: boolean
    get: (c: Company) => number | null
    format: (v: number | null) => string
    /** Campo de `financialData` usado na média de 7 anos. */
    historyField?: string
  }): ComparisonRow {
    const locked = !!options.premium && !canViewFullContent
    return {
      key: options.key,
      label: options.label,
      description: options.description,
      hint: options.hint,
      better: options.better,
      locked,
      cells: companies.map((c) => {
        if (locked) return { value: null, text: '' }
        const value = options.get(c)
        const average = options.historyField ? calculateHistoricalAverage(history(c), options.historyField) : null
        return {
          value,
          text: options.format(value),
          secondary: average !== null ? `média 7a: ${options.format(average)}` : null,
        }
      }),
    }
  }

  function strategyRow(key: string, label: string, description: string, hint?: string): ComparisonRow {
    return metricRow({
      key: `strategy-${key}`,
      label,
      description,
      hint,
      better: 'higher',
      premium: true,
      get: (c) => strategyScore(c, key),
      format: score100,
    })
  }

  const groups: ComparisonGroup[] = [
    {
      key: 'valuation',
      label: 'Valuation',
      rows: [
        metricRow({
          key: 'pl',
          label: 'P/L',
          description: 'Preço sobre lucro',
          better: 'lower-positive',
          get: (c) => field(c, 'pl') ?? toNumber(c.keyStatistics[0]?.forwardPE),
          format: formatMultiple,
          historyField: 'pl',
        }),
        metricRow({
          key: 'pvp',
          label: 'P/VP',
          description: 'Preço sobre valor patrimonial',
          hint: 'Compara o preço da ação com o patrimônio da empresa por ação. Valores baixos podem indicar que a ação está barata em relação ao que a empresa possui.',
          better: 'lower-positive',
          get: (c) => field(c, 'pvp') ?? toNumber(c.keyStatistics[0]?.priceToBook),
          format: formatMultiple,
          historyField: 'pvp',
        }),
      ],
    },
    {
      key: 'rentabilidade',
      label: 'Rentabilidade',
      rows: [
        metricRow({
          key: 'roe',
          label: 'ROE',
          description: 'Retorno sobre patrimônio',
          better: 'higher',
          get: (c) => field(c, 'roe'),
          format: formatPct,
          historyField: 'roe',
        }),
        metricRow({
          key: 'roic',
          label: 'ROIC',
          description: 'Retorno sobre capital investido',
          hint: 'Mostra o quanto a empresa ganha de retorno para cada real investido em suas operações. Quanto maior, mais eficiente a empresa é em usar o dinheiro investido para gerar lucro.',
          better: 'higher',
          premium: true,
          get: (c) => field(c, 'roic'),
          format: formatPct,
          historyField: 'roic',
        }),
        metricRow({
          key: 'margemLiquida',
          label: 'Margem líquida',
          description: 'Lucro sobre a receita',
          hint: 'De cada R$ 100 que a empresa vende, quanto sobra de lucro no final. Quanto maior, mais eficiente é o negócio em gerar lucro.',
          better: 'higher',
          premium: true,
          get: (c) => field(c, 'margemLiquida'),
          format: formatPct,
          historyField: 'margemLiquida',
        }),
      ],
    },
    {
      key: 'endividamento',
      label: 'Endividamento',
      rows: [
        metricRow({
          key: 'dividaLiquidaEbitda',
          label: 'Dív. líq./EBITDA',
          description: 'Anos de caixa para quitar a dívida',
          hint: 'Indica quantos anos a empresa levaria para quitar suas dívidas usando só a geração de caixa operacional. Quanto menor, menos endividada ela está.',
          better: 'lower',
          premium: true,
          get: (c) => field(c, 'dividaLiquidaEbitda'),
          format: formatMultiple,
          historyField: 'dividaLiquidaEbitda',
        }),
        metricRow({
          key: 'dividaLiquidaPl',
          label: 'Dív. líq./PL',
          description: 'Dívida líquida sobre patrimônio',
          better: 'lower',
          premium: true,
          get: (c) => field(c, 'dividaLiquidaPl'),
          format: (v) => formatNumber(v, { digits: 2 }),
          historyField: 'dividaLiquidaPl',
        }),
        metricRow({
          key: 'liquidezCorrente',
          label: 'Liquidez corrente',
          description: 'Capacidade de pagar o curto prazo',
          better: 'higher',
          premium: true,
          get: (c) => field(c, 'liquidezCorrente'),
          format: (v) => formatNumber(v, { digits: 2 }),
          historyField: 'liquidezCorrente',
        }),
      ],
    },
    {
      key: 'dividendos',
      label: 'Dividendos',
      rows: [
        metricRow({
          key: 'dy',
          label: 'Dividend yield',
          description: 'Rendimento anual em dividendos',
          better: 'higher',
          get: (c) => {
            const dy = field(c, 'dy')
            if (dy !== null) return dy
            const fallback = toNumber(c.keyStatistics[0]?.dividendYield) // em pontos percentuais
            return fallback !== null ? fallback / 100 : null
          },
          format: formatPct,
          historyField: 'dy',
        }),
      ],
    },
    {
      key: 'crescimento',
      label: 'Crescimento',
      rows: [
        metricRow({
          key: 'cagrLucros5a',
          label: 'CAGR lucros 5a',
          description: 'Crescimento anual composto do lucro',
          hint: 'É a taxa média de crescimento anual do lucro da empresa nos últimos 5 anos, considerando o efeito composto (juros sobre juros).',
          better: 'higher',
          premium: true,
          get: (c) => field(c, 'cagrLucros5a'),
          format: formatDeltaPct,
        }),
        metricRow({
          key: 'cagrReceitas5a',
          label: 'CAGR receitas 5a',
          description: 'Crescimento anual composto da receita',
          hint: 'É a taxa média de crescimento anual da receita (vendas) da empresa nos últimos 5 anos, considerando o efeito composto.',
          better: 'higher',
          premium: true,
          get: (c) => field(c, 'cagrReceitas5a'),
          format: formatDeltaPct,
        }),
        metricRow({
          key: 'crescimentoLucros',
          label: 'Crescimento do lucro',
          description: 'Variação no último ano',
          better: 'higher',
          premium: true,
          get: (c) => field(c, 'crescimentoLucros'),
          format: formatDeltaPct,
        }),
        metricRow({
          key: 'crescimentoReceitas',
          label: 'Crescimento da receita',
          description: 'Variação no último ano',
          better: 'higher',
          premium: true,
          get: (c) => field(c, 'crescimentoReceitas'),
          format: formatDeltaPct,
        }),
      ],
    },
    {
      key: 'porte',
      label: 'Porte',
      rows: [
        metricRow({
          key: 'marketCap',
          label: 'Valor de mercado',
          better: 'none',
          get: (c) => field(c, 'marketCap'),
          format: formatBRLCompact,
        }),
        metricRow({
          key: 'receitaTotal',
          label: 'Receita total',
          better: 'none',
          get: (c) => field(c, 'receitaTotal'),
          format: formatBRLCompact,
        }),
        metricRow({
          key: 'lucroLiquido',
          label: 'Lucro líquido',
          better: 'none',
          premium: true,
          get: (c) => field(c, 'lucroLiquido'),
          format: formatBRLCompact,
        }),
      ],
    },
    {
      key: 'score',
      label: 'Score e modelos (0 a 100)',
      collapseAfter: 1,
      rows: [
        metricRow({
          key: 'overallScore',
          label: 'Score geral',
          description: 'Resumo dos modelos e dos balanços',
          hint: 'Uma nota de 0 a 100 que resume a saúde financeira e o potencial da empresa, combinando vários indicadores e modelos de análise.',
          better: 'higher',
          premium: true,
          get: (c) => {
            const score = strategiesByTicker.get(c.ticker)?.overallScore?.score
            return typeof score === 'number' ? score : null
          },
          format: score100,
        }),
        strategyRow('graham', 'Graham', 'Lucro e patrimônio', 'Modelo criado pelo "pai do value investing" que estima um preço justo com base no lucro e no valor patrimonial da empresa. Nota alta indica ação potencialmente descontada por esse método.'),
        strategyRow('fcd', 'FCD', 'Fluxo de caixa descontado', 'Estima quanto a empresa vale hoje somando o dinheiro que ela deve gerar no futuro, trazido a valor presente.'),
        strategyRow('gordon', 'Gordon', 'Dividendos e crescimento', 'Calcula o preço justo de uma ação com base nos dividendos que ela paga e na expectativa de crescimento desses dividendos ao longo do tempo.'),
        strategyRow('magicFormula', 'Fórmula mágica', 'Método de Greenblatt', 'Busca boas empresas negociadas a preços baixos, combinando rentabilidade sobre o capital com o quanto a ação está barata.'),
        strategyRow('lowPE', 'P/L baixo', 'Múltiplo baixo com qualidade'),
        strategyRow('dividendYield', 'Dividendos', 'Modelo de dividend yield'),
        strategyRow('fundamentalist', 'Fundamentalista 3+1', 'Valuation, rentabilidade, dívida e crescimento', 'Método simplificado que avalia a empresa em 3 pilares (valuation, rentabilidade e endividamento) mais 1 critério de crescimento.'),
      ],
    },
  ]

  const assets = companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    href: `/acao/${c.ticker.toLowerCase()}`,
    meta: c.dailyQuotes[0] ? formatBRL(toNumber(c.dailyQuotes[0].price)) : null,
  }))

  const title = tickers.join(' vs ')
  const canonicalUrl = `https://precojusto.ai/compara-acoes/${tickers.map((t) => t.toLowerCase()).join('/')}`

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <PageHeader
        breadcrumb={[{ label: 'Início', href: '/' }, { label: 'Comparador', href: '/comparador' }, { label: title }]}
        title={title}
        actions={
          <Button asChild variant="outline">
            <Link href="/comparador">Nova comparação</Link>
          </Button>
        }
      />

      {shouldShowAnonLimitCTA && <AnonLimitCTA />}

      <ComparisonTable
        caption={`Indicadores de ${tickers.join(', ')}`}
        assets={assets}
        groups={groups}
        secondaryLabel="Média de 7 anos"
        footerRow={{
          label: 'Backtest',
          cells: companies.map((c) => (
            <AddToBacktestButton
              key={c.ticker}
              asset={{
                ticker: c.ticker,
                companyName: c.name,
                sector: c.sector || undefined,
                currentPrice: toNumber(c.dailyQuotes[0]?.price) ?? undefined,
              }}
              variant="outline"
              size="sm"
              showLabel={false}
              className="min-w-11 max-md:h-11"
            />
          )),
        }}
        lockedNotice={
          shouldShowAnonLimitCTA ? undefined : (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                ROIC, margem, endividamento, crescimento e as notas por modelo ficam disponíveis no Premium.
              </p>
              <Button asChild size="sm" className="shrink-0">
                <Link href="/planos">Ver planos</Link>
              </Button>
            </div>
          )
        }
      />

      {/* Schema Structured Data para SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: `Comparação ${tickers.join(' vs ')} - Análise Comparativa de Ações`,
            description: `Análise comparativa detalhada entre as ações ${tickers.join(', ')} com indicadores financeiros, valuation e métricas fundamentalistas.`,
            url: canonicalUrl,
            author: { '@type': 'Organization', name: 'Preço Justo AI' },
            publisher: { '@type': 'Organization', name: 'Preço Justo AI' },
            datePublished: new Date().toISOString(),
            dateModified: new Date().toISOString(),
            mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
            about: tickers.map((ticker) => ({ '@type': 'Corporation', tickerSymbol: ticker, exchange: 'B3' })),
          }),
        }}
      />

      {/* Schema FAQPage para SEO - apenas para usuários deslogados */}
      {!session && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'Como comparar múltiplas ações ao mesmo tempo?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Use o comparador de ações para analisar até 6 empresas ao mesmo tempo. Os indicadores financeiros, o valuation, os scores e as notas por modelo aparecem lado a lado, com o melhor valor de cada linha destacado.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Quais indicadores são comparados?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'P/L, P/VP, ROE, ROIC, margem líquida, dividend yield, endividamento, liquidez, crescimento de lucro e receita, porte e as notas dos modelos de valuation. Os dados são atualizados com base nas demonstrações financeiras oficiais.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'O comparador é gratuito?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Sim. O comparador básico é gratuito e permite comparar até 6 ações. No Premium, a comparação inclui rentabilidade, endividamento, crescimento e as notas por modelo.',
                  },
                },
              ],
            }),
          }}
        />
      )}
    </div>
  )
}
