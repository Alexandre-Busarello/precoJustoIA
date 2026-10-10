import { Metadata } from 'next'
import { SectorAnalysisClient } from '@/components/sector-analysis-client'
import { getCurrentUser } from '@/lib/user-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { analyzeSectors } from '@/lib/sector-analysis-service'
import { CTASection } from '@/components/landing/cta-section'
import { FAQSection } from '@/components/landing/faq-section'
import { PageHeader } from '@/components/page-header'

export const metadata: Metadata = {
  title: 'Análise setorial de ações da B3',
  description:
    'Compare os setores da B3 por score fundamentalista: financeiro, energia, tecnologia, saúde e outros. Veja as empresas de maior score em cada setor e compare-as lado a lado.',
  keywords:
    'análise setorial B3, setores bovespa, comparação setorial ações, ranking setores B3, análise fundamentalista por setor, serviços financeiros Brasil, energia ações, tecnologia bovespa, saúde Brasil',
  openGraph: {
    title: 'Análise setorial de ações da B3',
    description:
      'Compare os setores da B3 por score fundamentalista e veja as empresas de maior score em cada um.',
    type: 'website',
    url: '/analise-setorial',
    images: [
      {
        url: '/og-sector-analysis.png',
        width: 1200,
        height: 630,
        alt: 'Análise setorial B3',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Análise setorial de ações da B3',
    description: 'Compare os setores da B3 por score fundamentalista.',
  },
  alternates: {
    canonical: '/analise-setorial',
  },
  robots: {
    index: true,
    follow: true,
  },
}

/** Setores carregados no servidor (os demais o usuário Premium adiciona na página). */
const INITIAL_SECTORS = ['Energia', 'Tecnologia da Informação']

async function fetchInitialSectorData() {
  try {
    return await analyzeSectors(INITIAL_SECTORS)
  } catch (error) {
    console.error('Erro ao buscar dados setoriais:', error)
    return []
  }
}

const faqs = [
  {
    question: 'Quantos setores são analisados?',
    answer:
      'A análise cobre os 11 setores macro da B3: financeiro, energia, tecnologia da informação, saúde, consumo cíclico, consumo não cíclico, bens industriais, materiais básicos, imobiliário, utilidade pública e comunicações.',
  },
  {
    question: 'Como as empresas de cada setor são ordenadas?',
    answer:
      'Pelo score geral da plataforma, que combina indicadores de rentabilidade, endividamento, crescimento, dividendos e valuation. A ordem é uma comparação entre empresas do mesmo setor, não uma recomendação de investimento.',
  },
  {
    question: 'A análise setorial é gratuita?',
    answer:
      'Sim, dois setores ficam abertos para todos. No Premium você adiciona os demais setores e vê também a empresa de maior score em cada um.',
  },
  {
    question: 'Como usar a análise setorial para diversificar?',
    answer:
      'Carteiras diversificadas costumam ter empresas de vários setores. Use a análise para comparar empresas parecidas dentro de cada setor e aprofunde o estudo na página de cada ação antes de decidir.',
  },
  {
    question: 'Com que frequência os dados são atualizados?',
    answer:
      'Os scores são recalculados com as cotações diárias e com os balanços mais recentes publicados pelas empresas.',
  },
  {
    question: 'Posso comparar empresas de setores diferentes?',
    answer:
      'Pode, mas a comparação é mais útil dentro do mesmo setor, porque empresas de setores diferentes têm características operacionais distintas.',
  },
]

export default async function AnaliseSetorialPage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session
  const user = await getCurrentUser()
  const isPremium = user?.isPremium || false
  const sectorData = await fetchInitialSectorData()
  // Gate Premium no servidor: a 1ª empresa de cada setor não pode chegar ao payload do cliente.
  const initialSectors = isPremium
    ? sectorData
    : sectorData.map((sector) => ({
        ...sector,
        topCompanies: sector.topCompanies.map((company, index) => (index === 0 ? null : company)),
      }))

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <PageHeader
          title="Análise setorial"
          description="Empresas de maior score em cada setor da B3, para comparar empresas parecidas lado a lado."
        />
        <SectorAnalysisClient initialSectors={initialSectors} isPremium={isPremium} />
      </div>

      {!isLoggedIn && (
        <>
          <FAQSection
            title="Perguntas frequentes sobre análise setorial"
            faqs={faqs}
            className="border-t border-border"
          />
          <CTASection
            title="Compare os setores da B3 com os seus critérios"
            description="Crie uma conta gratuita para salvar comparações e acompanhar as empresas que você estuda."
            primaryCTA={{ text: 'Criar conta grátis', href: '/register?callbackUrl=/analise-setorial' }}
            secondaryCTA={{ text: 'Ver rankings', href: '/ranking' }}
          />
        </>
      )}
    </div>
  )
}
