import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DividendRadarPageContent } from '@/components/dividend-radar-page-content'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: 'Radar de Dividendos Gratuito | Ganhar Dinheiro com Dividendos | Empresas Pagando Altos Dividendos',
  description: 'Descubra como ganhar dinheiro com dividendos! Encontre empresas pagando altos dividendos na B3. Radar gratuito com projeções de dividendos dos próximos 12 meses usando inteligência artificial. Calendário completo de proventos e ações pagadoras.',
  keywords: [
    'ganhar dinheiro dividendos',
    'empresas pagando altos dividendos',
    'radar de dividendos',
    'projeção de dividendos',
    'dividendos ações',
    'calendário de dividendos',
    'proventos ações',
    'dividend yield',
    'investimentos',
    'ações pagadoras',
    'como ganhar dinheiro com dividendos',
    'melhores ações para dividendos',
    'ações com maior dividend yield',
    'renda passiva dividendos',
    'investir em dividendos',
  ],
  openGraph: {
    title: 'Radar de Dividendos Gratuito | Ganhar Dinheiro com Dividendos',
    description: 'Encontre empresas pagando altos dividendos na B3. Projeções inteligentes dos próximos 12 meses usando IA. Ferramenta 100% gratuita.',
    type: 'website',
  },
  alternates: {
    canonical: '/radar-dividendos',
  },
}

export default async function RadarDividendosPage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session

  return (
    <>
      <DividendRadarPageContent isLoggedIn={isLoggedIn} />
      {!isLoggedIn && <Footer />}
    </>
  )
}

