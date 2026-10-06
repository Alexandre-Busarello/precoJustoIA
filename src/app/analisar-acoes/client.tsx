'use client';

import { useState } from 'react';
import CompanySearch from '@/components/company-search';
import { CompanyPreview } from '@/components/company-preview';
import Link from 'next/link';
import { CTALinkWithPixel } from '@/components/cta-link-with-pixel';

interface Company {
  ticker: string;
  assetType: string;
}

export default function AnalisarAcoesClient() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const handleCompanySelect = (company: Company) => {
    // Apenas ações são suportadas no preview
    if (company.assetType === 'STOCK') {
      setSelectedTicker(company.ticker);
      // Scroll suave para o preview (ajustado para considerar header e posicionar um pouco mais acima)
      setTimeout(() => {
        const previewElement = document.getElementById('company-preview');
        if (previewElement) {
          const elementPosition = previewElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - 120; // 120px de offset para header + espaço
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  };

  return (
    <div className="bg-background">
      <section className="container mx-auto px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Análise de ações da B3</h1>
          <p className="mx-auto mt-3 max-w-[60ch] text-base leading-7 text-muted-foreground">
            Busque uma ação para ver o preço justo estimado por modelo de valuation, a margem de segurança e os principais
            indicadores.
          </p>

          <div className="mt-6 flex justify-center">
            <CompanySearch
              placeholder="Digite o ticker, como PETR4 ou VALE3"
              className="w-full max-w-xl"
              onCompanySelect={handleCompanySelect}
            />
          </div>

          {!selectedTicker && (
            <p className="mt-6 text-sm text-muted-foreground">
              Quer salvar análises e montar sua carteira?{' '}
              <CTALinkWithPixel href="/register" className="font-medium text-brand underline-offset-4 hover:underline">
                Criar conta grátis
              </CTALinkWithPixel>
            </p>
          )}
        </div>
      </section>

      {selectedTicker && (
        <section id="company-preview" className="container mx-auto px-4 pb-12">
          <CompanyPreview ticker={selectedTicker} />
        </section>
      )}

      {!selectedTicker && (
        <section className="container mx-auto px-4 pb-12 sm:pb-16">
          <dl className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Vários modelos lado a lado',
                text: 'Graham, fluxo de caixa descontado, Gordon, Bazin e outros, cada um com critérios e limitações à vista.',
              },
              {
                title: 'Margem de segurança',
                text: 'Quanto o preço atual está abaixo ou acima de cada estimativa, com a data do dado.',
              },
              {
                title: 'Síntese com IA',
                text: 'Um resumo dos resultados dos modelos. Os números vêm sempre das fórmulas, não da IA.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-card p-4">
                <dt className="text-sm font-medium text-foreground">{item.title}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mx-auto mt-6 max-w-4xl text-xs text-muted-foreground">
            Estimativas de modelos quantitativos com dados públicos; não são recomendação de investimento.{' '}
            <Link href="/metodologia" className="underline underline-offset-4 hover:text-foreground">
              Ver metodologia
            </Link>
            .
          </p>
        </section>
      )}

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Análise de ações da B3',
            description: 'Preço justo estimado por modelo de valuation e margem de segurança.',
            url: 'https://precojusto.ai/analisar-acoes',
            mainEntity: {
              '@type': 'SoftwareApplication',
              name: 'Preço Justo AI',
              applicationCategory: 'FinanceApplication',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'BRL',
              },
            },
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://precojusto.ai/analisar-acoes?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
    </div>
  );
}

