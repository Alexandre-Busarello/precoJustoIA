import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DividendRadarPageContent } from '@/components/dividend-radar-page-content'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/ui/section-header'
import { CTASection } from '@/components/landing/cta-section'
import { FAQSection } from '@/components/landing/faq-section'

export const metadata: Metadata = {
  title: 'Radar de dividendos: calendário e projeções de proventos',
  description:
    'Calendário de proventos de ações da B3: dividendos e JCP confirmados nos últimos meses e datas estimadas estatisticamente para os próximos meses. Ferramenta gratuita, sem cadastro.',
  keywords: [
    'radar de dividendos',
    'calendário de dividendos',
    'projeção de dividendos',
    'data ex dividendos',
    'data com dividendos',
    'proventos ações',
    'dividendos ações B3',
    'JCP',
    'dividend yield',
    'ações pagadoras de dividendos',
    'renda passiva dividendos',
    'investir em dividendos',
  ],
  openGraph: {
    title: 'Radar de dividendos: calendário e projeções de proventos',
    description: 'Proventos confirmados e datas estimadas estatisticamente para os próximos meses, empresa por empresa. Gratuito.',
    type: 'website',
    url: '/radar-dividendos',
  },
  alternates: {
    canonical: '/radar-dividendos',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const FAQS = [
  {
    question: 'Como funciona a projeção de dividendos?',
    answer:
      'A projeção é estatística, sem IA: usa o histórico de proventos dos últimos anos de cada empresa (meses de pagamento e valores por ação) para estimar as próximas datas ex e valores. É uma estimativa: a empresa pode mudar a política de proventos a qualquer momento.',
  },
  {
    question: 'O radar de dividendos é gratuito?',
    answer:
      'Sim. O calendário com proventos confirmados e projetados é gratuito e não exige cadastro. Com uma conta, você também pode filtrar só os seus ativos.',
  },
  {
    question: 'O que é data ex e data-com?',
    answer:
      'A data-com é o último dia em que quem tem a ação garante o direito ao provento. A partir da data ex, a ação é negociada sem esse direito, e o preço costuma cair perto do valor do provento. O radar mostra a data ex.',
  },
  {
    question: 'Com que frequência os dados são atualizados?',
    answer:
      'Os proventos confirmados são atualizados a partir dos anúncios das empresas, e as projeções são recalculadas quando surge um provento novo no histórico.',
  },
  {
    question: 'Dividend yield alto é sempre bom?',
    answer:
      'Não. Um yield alto pode vir de um lucro extraordinário ou de uma queda forte do preço. Vale conferir o payout, o endividamento e a regularidade dos pagamentos na página de análise da empresa.',
  },
  {
    question: 'Qual a diferença entre dividendos e JCP?',
    answer:
      'Os dois têm tratamento tributário diferente: os juros sobre capital próprio (JCP) têm imposto de renda retido na fonte (17,5% desde 2026), e os dividendos seguem regras próprias. Os valores do radar são brutos, por ação.',
  },
]

export default async function RadarDividendosPage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-4 pb-12">
        <PageHeader
          breadcrumb={[{ label: 'Início', href: '/' }, { label: 'Radar de dividendos' }]}
          title="Radar de dividendos"
          description="Proventos confirmados nos últimos meses e datas estimadas estatisticamente para os próximos, empresa por empresa."
        />

        <div id="radar-tool">
          <DividendRadarPageContent isLoggedIn={isLoggedIn} />
        </div>

        {!isLoggedIn && (
          <section aria-labelledby="sobre-radar" className="max-w-[68ch] space-y-3 border-t border-border pt-8">
            <SectionHeader as="h2" id="sobre-radar" title="Como usar o radar de dividendos" />
            <div className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                O radar reúne, em um calendário, os dividendos e juros sobre capital próprio já anunciados pelas empresas da B3
                nos últimos meses e as datas estimadas para os próximos. Assim dá para ver quais empresas pagam proventos com
                regularidade e em que meses costumam pagar.
              </p>
              <p>
                As projeções vêm de um modelo de IA que lê o histórico de cada empresa. Use os filtros para buscar por ticker,
                setor ou período e toque em uma empresa para ver a data ex e o valor por ação de cada provento.
              </p>
              <p>
                Proventos são uma parte do retorno: antes de investir, confira na página de análise da empresa os fundamentos,
                o payout e a sustentabilidade dos pagamentos.
              </p>
            </div>
          </section>
        )}
      </div>

      {!isLoggedIn && (
        <>
          <FAQSection
            title="Perguntas frequentes sobre dividendos"
            faqs={FAQS}
            className="border-t border-border"
          />
          <CTASection
            title="Acompanhe os proventos dos seus ativos"
            description="Crie uma conta gratuita para filtrar o radar pelos seus ativos e acompanhar sua carteira."
            primaryCTA={{ text: 'Criar conta grátis', href: '/register?callbackUrl=/radar-dividendos' }}
            secondaryCTA={{ text: 'Ver rankings de ações', href: '/ranking' }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: FAQS.map((faq) => ({
                  '@type': 'Question',
                  name: faq.question,
                  acceptedAnswer: { '@type': 'Answer', text: faq.answer },
                })),
              }),
            }}
          />
        </>
      )}
    </>
  )
}
