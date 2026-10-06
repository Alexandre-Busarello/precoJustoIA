'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyLogo } from '@/components/company-logo';
import { formatDate } from '@/lib/format';

interface CompanyPreviewProps {
  ticker: string;
}

interface PreviewReport {
  id: string;
  conclusion: string | null;
  createdAt: string;
  windowDays?: number | null;
}

interface PreviewData {
  success: boolean;
  company: {
    ticker: string;
    name: string;
    sector: string | null;
    logoUrl: string | null;
  };
  reports: {
    monthly?: PreviewReport;
    priceVariation?: PreviewReport;
  };
  flags: Array<{
    id: string;
    flagType: string;
    reason: string;
    reportId: string;
  }>;
  // Versão anônima: só Graham e Barsi com status; os demais modelos apenas indicam que existem.
  strategies: {
    graham?: { isEligible: boolean };
    barsi?: { isEligible: boolean };
    dividendYield?: boolean;
    lowPE?: boolean;
    magicFormula?: boolean;
    fcd?: boolean;
    gordon?: boolean;
    fundamentalist?: boolean;
  };
  overallScore: null;
  currentPrice: number;
}

const STRATEGY_LABELS: Record<string, string> = {
  graham: 'Graham',
  barsi: 'Barsi',
  dividendYield: 'Dividend yield',
  lowPE: 'P/L baixo',
  magicFormula: 'Fórmula Mágica',
  fcd: 'FCD',
  gordon: 'Gordon',
  fundamentalist: 'Fundamentalista 3+1',
};

/** Indicadores que ficam na página completa do ativo (o preview não mostra valores, nem fictícios). */
const LOCKED_METRICS = [
  { label: 'Score geral', hint: 'Nota de 0 a 100 pelos modelos fundamentalistas' },
  { label: 'Preço justo e margem', hint: 'Estimativa por modelo (Graham, FCD, Gordon)' },
  { label: 'Análise técnica', hint: 'RSI, médias móveis e tendência' },
  { label: 'O que o mercado está falando', hint: 'Resumo de conteúdos sobre a empresa' },
];

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-6 text-muted-foreground">
      {text.split('\n\n').map((paragraph, idx) => (
        <p key={idx}>
          {paragraph.split(/\*\*([^*]+)\*\*/).map((part, i) =>
            i % 2 === 1 ? <strong key={i} className="font-medium text-foreground">{part}</strong> : part
          )}
        </p>
      ))}
    </div>
  );
}

function ReportCard({ title, report, ticker }: { title: string; report: PreviewReport; ticker: string }) {
  const meta = [formatDate(report.createdAt), report.windowDays ? `${report.windowDays} dias` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <SectionHeader as="h3" title={title} description={meta} />
      {report.conclusion ? (
        <Paragraphs text={report.conclusion} />
      ) : (
        <p className="text-sm text-muted-foreground">Conclusão não disponível.</p>
      )}
      <Button asChild variant="outline">
        <Link href={`/acao/${ticker.toLowerCase()}/relatorios/${report.id}`}>
          Ver relatório completo
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

function StrategyStatus({ label, isEligible }: { label: string; isEligible: boolean }) {
  return (
    <Badge variant={isEligible ? 'positive' : 'negative'}>
      {label}: {isEligible ? 'aprovada' : 'não aprovada'}
    </Badge>
  );
}

export function CompanyPreview({ ticker }: CompanyPreviewProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const isLoggedIn = !!session;

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/company-preview/${ticker}`);
        if (!response.ok) {
          throw new Error('Não foi possível carregar a prévia da empresa.');
        }
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a prévia da empresa.');
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchPreview();
    }
  }, [ticker]);

  if (loading) {
    return (
      <div className="mt-8 space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5" aria-busy="true">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {LOCKED_METRICS.map((metric) => (
            <Skeleton key={metric.label} className="h-16" />
          ))}
        </div>
        <span className="sr-only">Carregando análise...</span>
      </div>
    );
  }

  if (error || !data || !data.success) {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.75} aria-hidden />
        <p className="text-sm text-muted-foreground">{error || 'Não foi possível carregar a prévia da empresa.'}</p>
      </div>
    );
  }

  const otherStrategies = Object.keys(data.strategies).filter((key) => key !== 'graham' && key !== 'barsi');
  const assetHref = `/acao/${data.company.ticker.toLowerCase()}`;
  const ctaHref = isLoggedIn ? assetHref : `/register?returnUrl=${encodeURIComponent(assetHref)}`;

  return (
    <div className="mt-8 space-y-6">
      {data.reports.monthly && <ReportCard title="Conclusão do relatório mensal" report={data.reports.monthly} ticker={ticker} />}

      {data.reports.priceVariation && (
        <ReportCard title="Análise de variação de preço" report={data.reports.priceVariation} ticker={ticker} />
      )}

      {data.flags.length > 0 && (
        <section className="space-y-3 rounded-lg border border-border bg-warning-subtle p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <AlertTriangle className="size-5 text-warning" strokeWidth={1.75} aria-hidden />
            Alertas ativos
          </h3>
          {data.flags.map((flag) => (
            <div key={flag.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <p className="font-medium text-foreground">{flag.flagType}</p>
              <p className="text-sm leading-6 text-muted-foreground">{flag.reason}</p>
              {flag.reportId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/acao/${ticker.toLowerCase()}/relatorios/${flag.reportId}`}>
                    Ver relatório completo
                    <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-5">
        <SectionHeader
          as="h3"
          title="Análise completa da empresa"
          description="Prévia dos modelos aplicados. Score, preço justo e demais indicadores ficam na página do ativo."
        />

        <Link href={assetHref} className="flex min-w-0 items-center gap-3 rounded-md hover:bg-muted">
          <CompanyLogo logoUrl={data.company.logoUrl} companyName={data.company.name} ticker={data.company.ticker} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{data.company.ticker}</p>
            <p className="truncate text-sm text-muted-foreground">
              {data.company.name}
              {data.company.sector ? ` · ${data.company.sector}` : ''}
            </p>
          </div>
        </Link>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LOCKED_METRICS.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-md border border-border bg-surface p-3">
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Lock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                {isLoggedIn ? 'Na página do ativo' : 'Disponível após login'}
              </dd>
              <dd className="mt-1 text-xs text-muted-foreground">{metric.hint}</dd>
            </div>
          ))}
        </dl>

        {(data.strategies.graham || data.strategies.barsi || otherStrategies.length > 0) && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">Modelos aplicados</p>
            <div className="flex flex-wrap gap-1.5">
              {data.strategies.graham && <StrategyStatus label="Graham" isEligible={data.strategies.graham.isEligible} />}
              {data.strategies.barsi && <StrategyStatus label="Barsi" isEligible={data.strategies.barsi.isEligible} />}
              {otherStrategies.map((key) => (
                <Badge key={key} variant="neutral">
                  {STRATEGY_LABELS[key] || key}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Veja a análise completa</p>
            <p className="text-sm text-muted-foreground">
              {isLoggedIn
                ? 'Score detalhado, preço justo por modelo, indicadores financeiros e análises com IA.'
                : 'Crie sua conta para ver score, preço justo por modelo, indicadores e análises com IA.'}
            </p>
          </div>
          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link href={ctaHref}>
              {isLoggedIn ? 'Ver análise completa' : 'Criar conta grátis'}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Estimativas geradas por modelos quantitativos com dados públicos; não é recomendação de investimento.
        </p>
      </section>
    </div>
  );
}
