import { LandingHero } from '@/components/landing/landing-hero'
import { FAQSection } from '@/components/landing/faq-section'
import { CTASection } from '@/components/landing/cta-section'
import { SectionHeader } from '@/components/ui/section-header'
import { ExamplePortfolioCard } from './example-portfolio-card'

const REGISTER_HREF = '/register?returnUrl=/backtest'

const RESULT_ITEMS = [
  {
    title: 'Retorno total e anualizado',
    text: 'Quanto a carteira rendeu no período e o equivalente ao ano, com juros compostos.',
  },
  {
    title: 'Comparação com CDI e Ibovespa',
    text: 'O mesmo dinheiro aplicado nos dois índices, com os mesmos aportes e no mesmo período.',
  },
  {
    title: 'Volatilidade e índice de Sharpe',
    text: 'O quanto os retornos oscilaram e o retorno obtido por unidade de risco.',
  },
  {
    title: 'Drawdown máximo',
    text: 'A maior queda do pico ao vale e quanto tempo a carteira levou para se recuperar.',
  },
  {
    title: 'Resultado por ativo',
    text: 'Valor final, aportes, proventos reinvestidos e rebalanceamentos de cada ação.',
  },
  {
    title: 'Histórico de transações',
    text: 'Cada aporte, ajuste de rebalanceamento e provento simulado, mês a mês.',
  },
]

const STEPS = [
  {
    title: 'Escolha os ativos e os pesos',
    text: 'Até 20 ações da B3, com os percentuais que você definir.',
  },
  {
    title: 'Defina o período e os valores',
    text: 'Capital inicial, aporte mensal e frequência de rebalanceamento: mensal, trimestral ou anual.',
  },
  {
    title: 'Execute a simulação',
    text: 'Usamos cotações mensais históricas e mostramos métricas, gráficos e transações.',
  },
]

export const BACKTEST_FAQS = [
  {
    question: 'O que é um backtest?',
    answer:
      'É uma simulação de como uma carteira teria se comportado no passado, usando cotações históricas. Serve para estudar risco e retorno de uma estratégia antes de aplicá-la.',
  },
  {
    question: 'O backtest é gratuito?',
    answer:
      'O backtest faz parte do plano Premium. Com a conta gratuita você continua usando as ferramentas gratuitas da plataforma.',
  },
  {
    question: 'Quais métricas são calculadas?',
    answer:
      'Retorno total e anualizado, volatilidade, índice de Sharpe, drawdown máximo, meses positivos e negativos, tempo de recuperação e a comparação com CDI e Ibovespa.',
  },
  {
    question: 'Posso simular aportes mensais?',
    answer:
      'Sim. Informe um aporte mensal fixo ou deixe em zero para simular apenas o capital inicial.',
  },
  {
    question: 'Como funciona o rebalanceamento?',
    answer:
      'Na frequência escolhida (mensal, trimestral ou anual), a simulação ajusta as posições para voltar aos percentuais definidos para cada ativo.',
  },
  {
    question: 'De onde vêm os dados e quais são as limitações?',
    answer:
      'Usamos cotações mensais históricas das ações da B3 e o histórico real de proventos de cada ativo: cada provento é creditado pela data-com (JCP líquido de IRRF) e, no mês seguinte, reinvestido junto do aporte ou mantido em caixa, conforme a sua escolha. Cada operação da carteira paga um custo de 0,03% do valor negociado (corretagem e emolumentos). Spread e imposto sobre ganho de capital não são considerados, e resultados passados não garantem resultados futuros.',
  },
]

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: BACKTEST_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precojusto.ai' },
      { '@type': 'ListItem', position: 2, name: 'Backtest de carteira', item: 'https://precojusto.ai/backtest' },
    ],
  },
]

/** Landing pública do backtest (visitante sem sessão). Compartilhada por /backtest e /backtesting-carteiras. */
export function BacktestLanding() {
  return (
    <div className="bg-background">
      <LandingHero
        headline="Backtest de carteiras de ações"
        subheadline="Simule como uma carteira de ações da B3 teria se comportado no passado, com aportes mensais, rebalanceamento e comparação com CDI e Ibovespa."
        socialProof={[
          { text: 'Cotações históricas da B3' },
          { text: 'Comparação com CDI e Ibovespa' },
          { text: 'Recurso do plano Premium' },
        ]}
        primaryCTA={{ text: 'Criar conta grátis', href: REGISTER_HREF }}
        secondaryCTA={{ text: 'Ver planos', href: '/planos' }}
        showQuickAccess={false}
        media={<ExamplePortfolioCard />}
      />

      <section aria-labelledby="backtest-results-title" className="border-b border-border py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            id="backtest-results-title"
            title="O que o resultado mostra"
            description="Métricas de risco e retorno calculadas mês a mês sobre a carteira simulada."
          />
          <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {RESULT_ITEMS.map((item) => (
              <div key={item.title} className="border-t border-border pt-4">
                <dt className="text-sm font-medium text-foreground">{item.title}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="backtest-steps-title" className="border-b border-border bg-surface py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader id="backtest-steps-title" title="Como funciona" />
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-medium tabular-nums text-muted-foreground"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[68ch] text-xs leading-5 text-muted-foreground">
            A simulação usa os proventos reais de cada ativo e desconta 0,03% de custo por operação; spread e imposto sobre
            ganho de capital não são considerados. Resultados passados não garantem resultados futuros. O backtest é uma ferramenta de estudo e não é recomendação de investimento.
          </p>
        </div>
      </section>

      <FAQSection
        title="Perguntas frequentes sobre backtest"
        description="Dúvidas comuns sobre a simulação histórica de carteiras."
        faqs={BACKTEST_FAQS}
      />

      <CTASection
        title="Teste sua carteira com dados históricos"
        description="Crie sua conta e assine o Premium para rodar backtests com os seus ativos."
        primaryCTA={{ text: 'Criar conta grátis', href: REGISTER_HREF }}
        secondaryCTA={{ text: 'Ver planos', href: '/planos' }}
      />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
