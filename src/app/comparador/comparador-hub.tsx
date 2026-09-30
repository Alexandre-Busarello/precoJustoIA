import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/ui/section-header'
import { Badge } from '@/components/ui/badge'
import { EnhancedStockComparisonSelector } from '@/components/enhanced-stock-comparison-selector'
import { EtfComparisonSelector } from '@/components/etf-comparison-selector'
import { SEOSectionWrapper } from '@/components/seo-section-wrapper'
import { CTASection } from '@/components/landing/cta-section'
import { FAQSection } from '@/components/landing/faq-section'
import { ComparadorTabs, type ComparadorTipo } from './comparador-tabs'

interface PopularComparison {
  title: string
  description: string
  tickers: string[]
  href: string
}

const stockComparisons: PopularComparison[] = [
  { title: 'Commodities', description: 'Vale (mineração) e Petrobras (petróleo), duas das maiores empresas do país', tickers: ['VALE3', 'PETR4'] },
  { title: 'Grandes bancos', description: 'Os três maiores bancos privados em lucro e tamanho', tickers: ['ITUB4', 'BBDC4', 'SANB11'] },
  { title: 'Varejo', description: 'Magazine Luiza, Americanas e Lojas Renner: estratégias de varejo diferentes', tickers: ['MGLU3', 'AMER3', 'LREN3'] },
  { title: 'Setor elétrico', description: 'Eletrobras e Cemig, geração e distribuição de energia', tickers: ['ELET3', 'ELET6', 'CMIG4'] },
  { title: 'Telecomunicações', description: 'Vivo, TIM e Oi: conectividade e 5G no Brasil', tickers: ['VIVT3', 'TIMS3', 'OIBR3'] },
  { title: 'Siderurgia', description: 'Usiminas, CSN e Gerdau: aço para construção e indústria', tickers: ['USIM5', 'CSNA3', 'GGBR4'] },
  { title: 'Tecnologia', description: 'Locaweb, Totvs e Positivo: software e tecnologia', tickers: ['LWSA3', 'TOTS3', 'POSI3'] },
].map((c) => ({ ...c, href: `/compara-acoes/${c.tickers.map((t) => t.toLowerCase()).join('/')}` }))

const etfComparisons: PopularComparison[] = [
  { title: 'Ibovespa', description: 'ETFs que replicam o Ibovespa e índices amplos de ações brasileiras', tickers: ['BOVA11', 'BOVB11', 'BBOV11'] },
  { title: 'Internacional com hedge', description: 'Exposição internacional com proteção cambial, retorno em reais', tickers: ['SPXR11', 'NASD11', 'WRLD11'] },
  { title: 'Internacional sem hedge', description: 'S&P 500 e mercado global com variação cambial', tickers: ['IVVB11', 'SPYI11', 'ACWI11'] },
  { title: 'Dividendos', description: 'ETFs focados em empresas pagadoras de proventos no Brasil', tickers: ['DIVO11', 'DIVD11', 'NDIV11'] },
  { title: 'Renda fixa', description: 'Títulos públicos indexados à Selic, ao IPCA ou prefixados', tickers: ['IMAB11', 'B5P211', 'IRFM11'] },
].map((c) => ({ ...c, href: `/compara-etfs/${c.tickers.map((t) => t.toLowerCase()).join('/')}` }))

const indicators = [
  { name: 'P/L (preço sobre lucro)', description: 'Quantos anos de lucro atual pagariam o preço da ação.', interpretation: 'Valores baixos podem indicar desconto.', isPremium: false },
  { name: 'ROE (retorno sobre patrimônio)', description: 'Quanto a empresa lucra com o capital dos acionistas.', interpretation: 'Acima de 15% costuma ser considerado bom.', isPremium: false },
  { name: 'Dividend yield', description: 'Dividendos pagos no ano em relação ao preço da ação.', interpretation: 'Relevante para quem busca renda passiva.', isPremium: false },
  { name: 'Margem líquida', description: 'Parte da receita que vira lucro depois de todos os custos.', interpretation: 'Margens maiores indicam mais eficiência.', isPremium: true },
  { name: 'ROIC (retorno sobre capital investido)', description: 'Eficiência no uso de todo o capital aplicado no negócio.', interpretation: 'Acima de 10% indica boa alocação de capital.', isPremium: true },
  { name: 'CAGR de lucros e receitas', description: 'Crescimento anual composto dos últimos 5 anos.', interpretation: 'Crescimento consistente acima de 10% é forte.', isPremium: true },
]

const steps = [
  { title: 'Busque as empresas', text: 'Digite o ticker (ex.: VALE3) ou o nome da empresa e escolha de 2 a 6 ações.' },
  { title: 'Veja a tabela', text: 'Os indicadores de cada empresa aparecem lado a lado, agrupados por valuation, rentabilidade, dívida, dividendos e crescimento.' },
  { title: 'Compare linha a linha', text: 'O melhor valor de cada indicador fica destacado, e o resumo mostra quem lidera em mais indicadores.' },
]

export const comparadorFaqs = [
  {
    question: 'Como funciona o comparador de ações?',
    answer: 'Você escolhe de 2 a 6 ações da B3 e vê os indicadores fundamentalistas lado a lado em uma tabela única: P/L, P/VP, ROE, dividend yield, margens, endividamento, crescimento e as notas dos modelos de valuation. O melhor valor de cada linha fica destacado.',
  },
  {
    question: 'Quais indicadores são comparados?',
    answer: 'Valuation (P/L, P/VP), rentabilidade (ROE, ROIC, margem líquida), endividamento (dívida líquida/EBITDA, dívida líquida/patrimônio, liquidez corrente), dividendos (dividend yield), crescimento (CAGR e variação anual de lucro e receita), porte e as notas por modelo.',
  },
  {
    question: 'Posso comparar ações de setores diferentes?',
    answer: 'Sim. A comparação costuma ser mais útil entre empresas do mesmo setor, que têm características operacionais e financeiras parecidas, como bancos com bancos ou varejistas com varejistas.',
  },
  {
    question: 'Os dados são atualizados?',
    answer: 'Sim. Os dados vêm das cotações da B3 e das demonstrações financeiras publicadas pelas empresas, atualizados regularmente.',
  },
  {
    question: 'O comparador é gratuito?',
    answer: 'Sim. A versão gratuita compara até 6 ações com P/L, P/VP, ROE, dividend yield, valor de mercado e receita. No Premium entram margem líquida, ROIC, endividamento, crescimento, notas por modelo e médias históricas de 7 anos.',
  },
  {
    question: 'Como escolher quais ações comparar?',
    answer: 'Comece pelas empresas do setor que você está estudando. Para bancos, por exemplo, compare ITUB4, BBDC4 e SANB11; para energia, ELET3 e CMIG4. Assim fica mais fácil ver as diferenças dentro do mesmo segmento.',
  },
]

function PopularGrid({ items }: { items: PopularComparison[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.href} className="min-w-0">
          <Link
            href={item.href}
            prefetch={false}
            className="flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="text-sm font-medium text-foreground">{item.title}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{item.tickers.join(' · ')}</span>
            <span className="mt-1 text-sm text-muted-foreground">{item.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function StocksTab() {
  return (
    <div className="space-y-12">
      <EnhancedStockComparisonSelector />

      <section className="space-y-4">
        <SectionHeader title="Comparações populares" description="Comparações prontas entre empresas da B3, por setor." />
        <PopularGrid items={stockComparisons} />
      </section>

      <SEOSectionWrapper>
        <section className="space-y-4">
          <SectionHeader title="Indicadores comparados" description="O que cada indicador mostra e como ler o resultado." />
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {indicators.map((indicator) => (
              <div key={indicator.name} className="min-w-0 space-y-1">
                <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {indicator.name}
                  {indicator.isPremium && <Badge variant="brand">Premium</Badge>}
                </dt>
                <dd className="text-sm leading-6 text-muted-foreground">
                  {indicator.description} {indicator.interpretation}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </SEOSectionWrapper>

      <SEOSectionWrapper>
        <section className="space-y-4">
          <SectionHeader title="Como usar o comparador" />
          <ol className="grid gap-6 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="min-w-0 space-y-1">
                <span className="text-xs font-medium text-muted-foreground tabular-nums">Passo {index + 1}</span>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </SEOSectionWrapper>

      <SEOSectionWrapper>
        <FAQSection
          title="Perguntas frequentes"
          description="O que você precisa saber sobre o comparador de ações."
          faqs={comparadorFaqs}
          className="py-0 sm:py-0 [&_h2]:text-lg [&>div]:max-w-none [&>div]:px-0"
        />
      </SEOSectionWrapper>

      <SEOSectionWrapper>
        <CTASection
          title="Compare as empresas que você acompanha"
          description="Escolha de 2 a 6 ações e veja os indicadores lado a lado, com o melhor valor de cada linha destacado."
          primaryCTA={{ text: 'Comparar ações', href: '#comparador' }}
          secondaryCTA={{ text: 'Ver rankings', href: '/ranking' }}
          className="rounded-lg border py-10 sm:py-12 [&_h2]:text-xl"
        />
      </SEOSectionWrapper>
    </div>
  )
}

function EtfsTab() {
  return (
    <div className="space-y-12">
      <EtfComparisonSelector />

      <section className="space-y-4">
        <SectionHeader title="Como a comparação funciona" />
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <dt className="text-sm font-medium text-foreground">Score PJ-ETF</dt>
            <dd className="text-sm leading-6 text-muted-foreground">
              Nota de 0 a 100 que pondera custo (18%), retorno (22%), liquidez (18%), solidez (12%), qualidade da carteira
              (18%) e análise por IA (12%).
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm font-medium text-foreground">Melhor valor por linha</dt>
            <dd className="text-sm leading-6 text-muted-foreground">
              Em cada indicador, o melhor valor aparece em destaque. O resumo no topo mostra qual ETF lidera em mais
              indicadores.
            </dd>
          </div>
          <div className="min-w-0 space-y-1">
            <dt className="text-sm font-medium text-foreground">Retornos históricos</dt>
            <dd className="text-sm leading-6 text-muted-foreground">
              Retornos de 1 mês a 5 anos e desde o início, lado a lado, junto com taxa, patrimônio, volatilidade e
              concentração.
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Comparações populares" description="ETFs da mesma classe, para comparar custo e retorno." />
        <PopularGrid items={etfComparisons} />
      </section>
    </div>
  )
}

/** Hub do comparador: cabeçalho e abas Ações | ETFs. Usado em /comparador e /comparador-etfs. */
export function ComparadorHub({ tipo }: { tipo: ComparadorTipo }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[{ label: 'Início', href: '/' }, { label: 'Comparador' }]}
        title="Comparador de ações e ETFs"
        description="Compare até 6 ativos da B3 lado a lado, indicador por indicador."
      />
      <ComparadorTabs defaultTipo={tipo} acoes={<StocksTab />} etfs={<EtfsTab />} />
    </div>
  )
}
