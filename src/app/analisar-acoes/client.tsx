'use client';

import { useState } from 'react';
import CompanySearch from '@/components/company-search';
import { CompanyPreview } from '@/components/company-preview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/footer';
import { Rocket, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-background">
      {/* Primeira Seção: Input de Busca */}
      <section className="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Análise de Ações B3
            </span>
            <br />
            <span className="text-foreground">
              com Inteligência Artificial
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed">
            Calcule <strong>valuation</strong>, <strong>fluxo de caixa descontado</strong> e encontre o <strong>preço justo</strong> de qualquer ação da Bovespa. 
            Análise completa com <strong>8 modelos automatizados</strong> e <strong>IA</strong>.
          </p>
          
          {/* Input de Busca */}
          <div className="flex justify-center mb-8">
            <CompanySearch
              placeholder="Digite o ticker da ação (ex: PETR4, VALE3)..."
              className="w-full max-w-2xl"
              onCompanySelect={handleCompanySelect}
            />
          </div>

          {/* CTA Discreto (apenas se não houver preview) */}
          {!selectedTicker && (
            <div className="mt-8">
              <p className="text-sm text-muted-foreground mb-4">
                Ou comece sua análise gratuita agora
              </p>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" asChild>
                <CTALinkWithPixel href="/register" className="flex items-center gap-2">
                  <Rocket className="w-4 h-4" />
                  Começar análise gratuita
                  <ArrowRight className="w-4 h-4" />
                </CTALinkWithPixel>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Segunda Seção: Preview Dinâmico */}
      {selectedTicker && (
        <section id="company-preview" className="container mx-auto px-4 pb-12">
          <CompanyPreview ticker={selectedTicker} />
        </section>
      )}

      {/* Seção de Benefícios (apenas se não houver preview) */}
      {!selectedTicker && (
        <section className="container mx-auto px-4 py-12 sm:py-16 bg-gradient-to-b from-white to-gray-50 dark:from-background dark:to-background/80">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
              Por que usar nossa plataforma?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold mb-2">Análise em Segundos</h3>
                  <p className="text-sm text-muted-foreground">
                    8 modelos de valuation automatizados analisam +500 empresas da B3 em tempo real
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <ArrowRight className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold mb-2">Valuation Completo</h3>
                  <p className="text-sm text-muted-foreground">
                    Calcule preço justo usando Graham, DCF, Fórmula Mágica e mais 5 estratégias consagradas
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-2">Análise com IA</h3>
                  <p className="text-sm text-muted-foreground">
                    Inteligência Artificial analisa todos os modelos e gera insights preditivos personalizados
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <Footer />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Análise de Ações B3 | Calcular Valuation',
            description: 'Análise de ações B3 com IA. Calcule valuation, fluxo de caixa descontado e encontre o preço justo.',
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

