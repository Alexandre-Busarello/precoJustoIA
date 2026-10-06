import { Metadata } from 'next';
import { PortfolioTutorialPage } from '@/components/portfolio-tutorial-page';

export const metadata: Metadata = {
  title: 'Importar histórico da B3',
  description: 'Passo a passo para trazer suas negociações da Área do Investidor da B3 para a sua carteira.',
};

export default function Page() {
  return <PortfolioTutorialPage />;
}
