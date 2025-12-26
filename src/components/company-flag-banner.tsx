'use client';

import Link from 'next/link';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';

interface CompanyFlagBannerProps {
  flag: {
    id: string;
    reason: string;
    reportId: string | null;
  };
  ticker: string;
  isPremium: boolean;
}

export function CompanyFlagBanner({ flag, ticker, isPremium }: CompanyFlagBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  // Verificar se o reason contém markdown (contém **, *, #, etc)
  const hasMarkdown = /[\*\#\[\]\(\)]/.test(flag.reason);
  
  // Resumo do motivo (primeiros 300 caracteres se não for markdown, ou manter completo se for markdown)
  const reasonSummary = hasMarkdown 
    ? flag.reason
    : flag.reason.length > 300 
      ? flag.reason.substring(0, 300) + '...'
      : flag.reason;

  if (isPremium) {
    // Banner para usuários Premium: mostra detalhes completos
    return (
      <Card className="mb-6 border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-base sm:text-lg font-semibold text-red-900 dark:text-red-100">
                  Alerta: Perda de Fundamentos Detectada
                </h3>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                  aria-label="Fechar alerta"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
              <div className="text-sm sm:text-base text-red-800 dark:text-red-200 mb-4 prose prose-sm max-w-none dark:prose-invert prose-red">
                {hasMarkdown ? (
                  <MarkdownRenderer 
                    content={reasonSummary} 
                    className="prose-sm prose-red dark:prose-invert"
                  />
                ) : (
                  <p>{reasonSummary}</p>
                )}
              </div>
              {flag.reportId && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
                >
                  <Link href={`/acao/${ticker.toLowerCase()}/relatorios/${flag.reportId}`}>
                    Ver Relatório Completo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Banner para usuários não-Premium: copy de conversão sem detalhes
  return (
    <Card className="mb-6 border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 via-red-50 to-orange-50 dark:from-orange-950/30 dark:via-red-950/30 dark:to-orange-950/30">
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-orange-900 dark:text-orange-100">
                Situação Crítica Detectada pela IA
              </h3>
              <button
                onClick={() => setIsDismissed(true)}
                className="flex-shrink-0 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 transition-colors"
                aria-label="Fechar alerta"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <p className="text-sm sm:text-base text-orange-800 dark:text-orange-200 mb-4">
              Nossa inteligência artificial detectou uma situação crítica nesta empresa que requer atenção imediata.
              <br />
              <strong>Upgrade para Premium</strong> e descubra os detalhes completos da análise, incluindo o motivo específico e recomendações de ação.
            </p>
            <Button
              asChild
              size="sm"
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold shadow-lg"
            >
              <Link href="/checkout">
                Liberar Detalhes
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

