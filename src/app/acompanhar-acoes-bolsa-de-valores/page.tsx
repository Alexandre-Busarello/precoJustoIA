import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/landing/breadcrumbs';
import { getCurrentUser } from '@/lib/user-service';
import MonitorAssetsForm from '@/components/monitor-assets-form';

export const metadata: Metadata = {
  title: 'Acompanhar ações da bolsa de valores com alertas por e-mail',
  description: 'Acompanhe ações da bolsa de valores com alertas por e-mail: quedas fortes de preço, mudanças no score de fundamentos e um resumo mensal gerado por IA. Grátis para começar.',
  keywords: [
    'acompanhar ações',
    'monitorar ações',
    'acompanhar bolsa de valores',
    'acompanhar ações em tempo real',
    'site para acompanhar ações',
    'acompanhar bolsa de valores em tempo real',
    'monitoramento de ações',
    'alertas de ações',
    'relatórios de ações',
  ].join(', '),
  openGraph: {
    title: 'Acompanhar ações da bolsa de valores com alertas por e-mail',
    description: 'Alertas por e-mail sobre quedas fortes de preço, mudanças no score de fundamentos e um resumo mensal gerado por IA.',
    type: 'website',
    url: 'https://precojusto.ai/acompanhar-acoes-bolsa-de-valores',
    siteName: 'Preço Justo AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acompanhar ações da bolsa de valores com alertas por e-mail',
    description: 'Alertas por e-mail sobre preço, fundamentos e um resumo mensal gerado por IA.',
  },
  alternates: {
    canonical: '/acompanhar-acoes-bolsa-de-valores',
  },
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
};

const REPORTS = [
  {
    title: 'Resumo mensal',
    text: 'Leitura dos indicadores financeiros e dos modelos de valuation de cada empresa, gerada por IA uma vez por mês.',
  },
  {
    title: 'Mudança no score',
    text: 'Aviso quando o score de fundamentos muda de forma relevante, com a comparação do que mudou.',
  },
  {
    title: 'Queda forte de preço',
    text: 'Aviso quando a ação cai 5% ou mais em um dia, com uma pesquisa sobre a possível causa.',
  },
] as const;

const FAQ = [
  {
    question: 'Como funciona o monitoramento?',
    answer:
      'Você informa os tickers. A plataforma acompanha essas empresas e envia um e-mail quando detecta uma queda forte de preço ou uma mudança relevante nos fundamentos, além do resumo mensal.',
  },
  {
    question: 'Preciso pagar?',
    answer:
      'O monitoramento básico é gratuito. Monitoramentos customizados, com critérios como P/L, P/VP, score ou preço, exigem uma conta.',
  },
  {
    question: 'Os preços são em tempo real?',
    answer: 'Não. Os preços são atualizados diariamente e os alertas saem quando a variação é detectada no processamento do dia.',
  },
  {
    question: 'Como cancelo os alertas?',
    answer:
      'Todo e-mail tem um link de descadastro no rodapé. Com conta, você também gerencia os monitoramentos no painel.',
  },
  {
    question: 'Os alertas dizem quando comprar ou vender?',
    answer:
      'Não. Os alertas descrevem o que mudou nos números da empresa. São estimativas de modelos sobre dados públicos e não são recomendação de investimento.',
  },
] as const;

export default async function MonitorStocksPage() {
  const currentUser = await getCurrentUser();
  const isLoggedIn = !!currentUser;

  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: 'Acompanhar ações' }]} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <header className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Acompanhe ações da bolsa com alertas por e-mail
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Informe os tickers e receba um aviso quando o preço cair forte ou os fundamentos mudarem, além de um resumo mensal de
              cada empresa.
            </p>
            {isLoggedIn ? (
              <p className="text-sm text-muted-foreground">
                Quer critérios próprios, como P/L, P/VP, score ou preço?{' '}
                <Link href="/dashboard/monitoramentos-customizados/criar" className="font-medium text-brand underline-offset-4 hover:underline">
                  Criar monitoramento customizado
                </Link>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Com uma conta grátis você também cria monitoramentos com critérios próprios, como P/L, P/VP, score ou preço.{' '}
                <Link href="/register?callbackUrl=/acompanhar-acoes-bolsa-de-valores" className="font-medium text-brand underline-offset-4 hover:underline">
                  Criar conta
                </Link>
              </p>
            )}
          </header>

          <section aria-labelledby="monitorar" className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <h2 id="monitorar" className="mb-4 text-lg font-semibold tracking-tight text-foreground">
              Monitorar ativos
            </h2>
            <MonitorAssetsForm isLoggedIn={isLoggedIn} />
          </section>
        </div>

        <section aria-labelledby="alertas" className="mt-12">
          <h2 id="alertas" className="text-lg font-semibold tracking-tight text-foreground">
            O que você recebe
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            {REPORTS.map((report) => (
              <div key={report.title} className="rounded-lg border border-border bg-card p-4">
                <dt className="text-sm font-medium text-foreground">{report.title}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{report.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="perguntas" className="mt-12 max-w-[68ch]">
          <h2 id="perguntas" className="text-lg font-semibold tracking-tight text-foreground">
            Perguntas frequentes
          </h2>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            {FAQ.map((item) => (
              <div key={item.question} className="py-4">
                <dt className="text-base font-medium text-foreground">{item.question}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        {!isLoggedIn && (
          <section className="mt-12 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base text-foreground">Prefere acompanhar tudo em um painel?</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register?callbackUrl=/acompanhar-acoes-bolsa-de-valores">Criar conta grátis</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/planos">Ver planos</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
