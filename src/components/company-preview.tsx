'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompanyLogo } from '@/components/company-logo';
import { RadarStatusIndicator } from '@/components/radar-status-indicator';
import { 
  Brain, 
  AlertTriangle, 
  Calendar, 
  ArrowRight, 
  FileText,
  Info,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CompanyPreviewProps {
  ticker: string;
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
    monthly?: {
      id: string;
      conclusion: string | null;
      createdAt: string;
    };
    priceVariation?: {
      id: string;
      conclusion: string | null;
      windowDays: number | null;
      createdAt: string;
    };
  };
  flags: Array<{
    id: string;
    flagType: string;
    reason: string;
    reportId: string;
  }>;
  // Versão anônima
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
  valuation: {
    status: 'green' | 'yellow' | 'red';
    label: string;
  };
  technical: {
    status: 'green' | 'yellow' | 'red';
    label: string;
  };
  sentiment: {
    status: 'green' | 'yellow' | 'red';
    label: string;
  };
  currentPrice: number;
}

const STRATEGY_LABELS: Record<string, string> = {
  graham: 'Graham',
  barsi: 'Bazin',
  dividendYield: 'DY',
  lowPE: 'Low P/E',
  magicFormula: 'MF',
  fcd: 'FCD',
  gordon: 'Gordon',
  fundamentalist: 'Fund',
};

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
        const response = await fetch(`/api/company-preview/${ticker}`);
        
        if (!response.ok) {
          throw new Error('Erro ao buscar preview');
        }

        const previewData = await response.json();
        setData(previewData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
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
      <Card className="mt-8">
        <CardContent className="p-8 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando análise...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data || !data.success) {
    return (
      <Card className="mt-8">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {error || 'Erro ao carregar preview da empresa'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Lista de estratégias disponíveis (apenas nomes para as que não são Graham/Barsi)
  const strategyList = Object.entries(data.strategies)
    .filter(([key]) => key !== 'graham' && key !== 'barsi')
    .map(([key]) => key);

  return (
    <div className="space-y-6 mt-8">
      {/* Relatórios */}
      {data.reports.monthly && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Conclusão do Analista
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {formatDate(data.reports.monthly.createdAt)}
            </div>
          </CardHeader>
          <CardContent>
            {data.reports.monthly.conclusion ? (
              <div className="text-muted-foreground leading-relaxed">
                {data.reports.monthly.conclusion.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-3 last:mb-0">
                    {paragraph.split(/\*\*([^*]+)\*\*/).map((part, i) => 
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Conclusão não disponível</p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link href={`/acao/${ticker.toLowerCase()}/relatorios/${data.reports.monthly.id}`}>
                Ver relatório completo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data.reports.priceVariation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Análise de Variação de Preço
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {formatDate(data.reports.priceVariation.createdAt)}
              {data.reports.priceVariation.windowDays && (
                <span className="text-xs">• {data.reports.priceVariation.windowDays} dias</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.reports.priceVariation.conclusion ? (
              <div className="text-muted-foreground leading-relaxed">
                {data.reports.priceVariation.conclusion.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-3 last:mb-0">
                    {paragraph.split(/\*\*([^*]+)\*\*/).map((part, i) => 
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Conclusão não disponível</p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link href={`/acao/${ticker.toLowerCase()}/relatorios/${data.reports.priceVariation.id}`}>
                Ver relatório completo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Flags */}
      {data.flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Alertas Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.flags.map((flag) => (
                <div key={flag.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="font-semibold text-sm text-red-900 dark:text-red-100 mb-1">
                    {flag.flagType}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {flag.reason}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview estilo Radar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Análise Completa da Empresa
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Preview da análise completa. Faça login para ver todos os detalhes.
          </p>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            {/* Desktop: Tabela */}
            <div className="hidden md:block overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                      Ativo
                    </th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                          Score
                          <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Score geral da empresa (0-100)</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                          Estratégias
                          <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Estratégias de valuation aplicadas à empresa</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                          Valuation
                          <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Potencial de valorização baseado em modelos de valuation</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                          Técnico
                          <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Análise técnica: melhor ponto de entrada</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                          Sentimento
                          <Info className="w-3 h-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sentimento do mercado baseado em análise de conteúdo</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-muted/50 transition-colors">
                    {/* Ticker */}
                    <td className="p-3">
                      <Link
                        href={`/acao/${data.company.ticker.toLowerCase()}`}
                        className="flex items-center gap-3 group"
                      >
                        <CompanyLogo
                          logoUrl={data.company.logoUrl}
                          companyName={data.company.name}
                          ticker={data.company.ticker}
                          size={40}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{data.company.ticker}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {data.company.name}
                          </div>
                          {data.company.sector && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {data.company.sector}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </td>

                    {/* Score Geral - COM BLUR */}
                    <td className="p-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative cursor-help">
                            <div className="filter blur-sm pointer-events-none select-none">
                              <RadarStatusIndicator
                                status="green"
                                label="Score"
                                value={87.5}
                              />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Score geral da empresa (0-100)</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    {/* Estratégias */}
                    <td className="p-3 text-center">
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {/* Graham e Bazin: apenas status verde/vermelho */}
                        {data.strategies.graham && (
                          <Badge
                            variant={data.strategies.graham.isEligible ? 'default' : 'destructive'}
                            className={cn(
                              'text-xs px-2 py-1',
                              data.strategies.graham.isEligible
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                            )}
                          >
                            {STRATEGY_LABELS.graham}
                          </Badge>
                        )}
                        {data.strategies.barsi && (
                          <Badge
                            variant={data.strategies.barsi.isEligible ? 'default' : 'destructive'}
                            className={cn(
                              'text-xs px-2 py-1',
                              data.strategies.barsi.isEligible
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                            )}
                          >
                            {STRATEGY_LABELS.barsi}
                          </Badge>
                        )}
                        {/* Outras estratégias: apenas nomes com fundo sem cor e blur */}
                        {strategyList.map((key) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="text-xs px-2 py-1 bg-muted/50 blur-sm"
                          >
                            {STRATEGY_LABELS[key] || key}
                          </Badge>
                        ))}
                      </div>
                    </td>

                    {/* Valuation - COM BLUR */}
                    <td className="p-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative cursor-help">
                            <div className="filter blur-sm pointer-events-none select-none">
                              <RadarStatusIndicator
                                status="green"
                                label="Upside"
                                value="+25.5%"
                              />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Potencial de valorização baseado em modelos de valuation</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    {/* Análise Técnica - COM BLUR */}
                    <td className="p-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative cursor-help">
                            <div className="filter blur-sm pointer-events-none select-none">
                              <RadarStatusIndicator
                                status="green"
                                label="Entry"
                                value="Compra"
                              />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Análise técnica: melhor ponto de entrada</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    {/* Sentimento - COM BLUR */}
                    <td className="p-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative cursor-help">
                            <div className="filter blur-sm pointer-events-none select-none">
                              <RadarStatusIndicator
                                status="green"
                                label="Sentimento"
                                value="Positivo"
                              />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sentimento do mercado baseado em análise de conteúdo</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-4">
              <Card className="overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <Link
                    href={`/acao/${data.company.ticker.toLowerCase()}`}
                    className="block mb-4"
                  >
                    <div className="flex items-start gap-3">
                      <CompanyLogo
                        logoUrl={data.company.logoUrl}
                        companyName={data.company.name}
                        ticker={data.company.ticker}
                        size={48}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-base">{data.company.ticker}</span>
                          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="text-sm text-muted-foreground break-words mb-2">
                          {data.company.name}
                        </div>
                        {data.company.sector && (
                          <Badge variant="outline" className="text-xs">
                            {data.company.sector}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Indicadores em grid para mobile */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Score Geral - COM BLUR */}
                    <div className="relative">
                      <div className="filter blur-sm pointer-events-none select-none">
                        <RadarStatusIndicator
                          status="green"
                          label="Score Geral"
                          value={87.5}
                        />
                      </div>
                      <div className="mt-2 md:hidden">
                        <p className="text-xs text-muted-foreground text-center">
                          Score geral (0-100). <span className="text-blue-600 font-medium">Faça login para ver</span>
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="hidden md:block absolute inset-0 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Score geral da empresa (0-100)</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Valuation - COM BLUR */}
                    <div className="relative">
                      <div className="filter blur-sm pointer-events-none select-none">
                        <RadarStatusIndicator
                          status="green"
                          label="Upside"
                          value="+25.5%"
                        />
                      </div>
                      <div className="mt-2 md:hidden">
                        <p className="text-xs text-muted-foreground text-center">
                          Potencial de valorização. <span className="text-blue-600 font-medium">Faça login para ver</span>
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="hidden md:block absolute inset-0 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Potencial de valorização baseado em modelos de valuation</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Técnico - COM BLUR */}
                    <div className="col-span-2 relative">
                      <div className="filter blur-sm pointer-events-none select-none">
                        <RadarStatusIndicator
                          status="green"
                          label="Entry Point"
                          value="Compra"
                        />
                      </div>
                      <div className="mt-2 md:hidden">
                        <p className="text-xs text-muted-foreground text-center">
                          Análise técnica: melhor ponto de entrada. <span className="text-blue-600 font-medium">Faça login para ver</span>
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="hidden md:block absolute inset-0 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Análise técnica: melhor ponto de entrada</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Sentimento - COM BLUR */}
                    <div className="relative">
                      <div className="filter blur-sm pointer-events-none select-none">
                        <RadarStatusIndicator
                          status="green"
                          label="Sentimento"
                          value="Positivo"
                        />
                      </div>
                      <div className="mt-2 md:hidden">
                        <p className="text-xs text-muted-foreground text-center">
                          Sentimento do mercado. <span className="text-blue-600 font-medium">Faça login para ver</span>
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="hidden md:block absolute inset-0 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sentimento do mercado baseado em análise de conteúdo</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Estratégias */}
                  <div className="pt-4 border-t">
                    <div className="text-xs font-semibold text-foreground mb-3">
                      Estratégias
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Graham e Bazin: apenas status verde/vermelho */}
                      {data.strategies.graham && (
                        <Badge
                          variant={data.strategies.graham.isEligible ? 'default' : 'destructive'}
                          className={cn(
                            'text-xs px-2 py-1',
                            data.strategies.graham.isEligible
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                          )}
                        >
                          {STRATEGY_LABELS.graham}
                        </Badge>
                      )}
                      {data.strategies.barsi && (
                        <Badge
                          variant={data.strategies.barsi.isEligible ? 'default' : 'destructive'}
                          className={cn(
                            'text-xs px-2 py-1',
                            data.strategies.barsi.isEligible
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                          )}
                        >
                          {STRATEGY_LABELS.barsi}
                        </Badge>
                      )}
                      {/* Outras estratégias: apenas nomes com fundo sem cor e blur */}
                      {strategyList.map((key) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className="text-xs px-2 py-1 bg-muted/50 blur-sm"
                        >
                          {STRATEGY_LABELS[key] || key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TooltipProvider>

          {/* CTA Cadastro */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-900/20 dark:to-violet-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-lg">Veja a Análise Completa</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {isLoggedIn 
                ? 'Veja scores detalhados, valuation completo, todos os indicadores financeiros e análises com IA'
                : 'Faça login para ver análise completa com scores, valuation, indicadores e IA'}
            </p>
            <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 w-full sm:w-auto">
              <Link href={isLoggedIn ? '/acao/' + ticker.toLowerCase() : `/register?returnUrl=${encodeURIComponent('/acao/' + ticker.toLowerCase())}`}>
                {isLoggedIn ? 'Ver Análise Completa' : 'Cadastre-se Grátis'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
