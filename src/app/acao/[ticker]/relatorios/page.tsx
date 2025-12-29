import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, FileText, Crown, Lock, Brain, AlertTriangle, Settings } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { isCurrentUserPremium, getCurrentUser } from '@/lib/user-service';

interface PageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  
  const company = await prisma.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: {
      ticker: true,
      name: true,
    },
  });

  if (!company) {
    return {
      title: 'Empresa não encontrada',
    };
  }

  return {
    title: `Relatórios: ${company.name} (${company.ticker}) | Preço Justo AI`,
    description: `Histórico completo de relatórios e análises de ${company.name}. Acompanhe a evolução do ativo ao longo do tempo.`,
  };
}

export default async function ReportsListPage({ params }: PageProps) {
  const { ticker } = await params;

  const company = await prisma.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: {
      id: true,
      ticker: true,
      name: true,
      logoUrl: true,
      sector: true,
    },
  });

  if (!company) {
    notFound();
  }

  const isPremium = await isCurrentUserPremium();
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id || null;

  // Buscar todos os relatórios, depois filtrar por tipo e userId
  // Nota: userId pode não estar disponível no Prisma Client até regenerar após migration
  const allReportsRaw = await prisma.aIReport.findMany({
    where: {
      companyId: company.id,
      status: 'COMPLETED',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  // Buscar flags ativos associados aos relatórios para indicar perda de fundamento
  const flagsByReportId = new Map<string, boolean>();
  try {
    const activeFlags = await prisma.companyFlag.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        reportId: {
          in: allReportsRaw.map(r => r.id),
        },
      },
      select: {
        reportId: true,
      },
    });
    
    activeFlags.forEach(flag => {
      if (flag.reportId) {
        flagsByReportId.set(flag.reportId, true);
      }
    });
  } catch (error) {
    console.warn('Erro ao buscar flags para relatórios:', error);
  }

  const allReports = allReportsRaw.map(report => ({
    id: report.id,
    type: report.type as string,
    content: report.content,
    changeDirection: report.changeDirection,
    previousScore: report.previousScore,
    currentScore: report.currentScore,
    userId: (report as any).userId || null, // Campo pode não estar tipado ainda
    createdAt: report.createdAt,
    windowDays: (report as any).windowDays || null,
    conclusion: (report as any).conclusion || null,
  }));

  // Filtrar relatórios: CUSTOM_TRIGGER só aparece para o criador
  const reports = allReports.filter(report => {
    if (report.type === 'CUSTOM_TRIGGER') {
      // Só mostrar se o usuário logado criou este relatório
      return report.userId === currentUserId;
    }
    // Outros tipos são públicos
    return true;
  });

  const fundamentalChangeReports = reports.filter(r => r.type === 'FUNDAMENTAL_CHANGE');
  const monthlyReports = reports.filter(r => r.type === 'MONTHLY_OVERVIEW');
  const priceVariationReports = reports.filter(r => r.type === 'PRICE_VARIATION');
  const customTriggerReports = reports.filter(r => r.type === 'CUSTOM_TRIGGER');
  const positiveCount = fundamentalChangeReports.filter(r => r.changeDirection === 'positive').length;
  const negativeCount = fundamentalChangeReports.filter(r => r.changeDirection === 'negative').length;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/acao/${ticker.toLowerCase()}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para {company.ticker}
          </Button>
        </Link>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Relatórios
            </h1>
            <p className="text-muted-foreground">
              {company.name} ({company.ticker})
            </p>
          </div>
          
          {company.logoUrl && (
            <Image 
              src={company.logoUrl} 
              alt={company.name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-lg object-contain"
            />
          )}
        </div>

        {/* Stats */}
        {reports.length > 0 && (
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {reports.length} relatório{reports.length !== 1 ? 's' : ''} no total
              </span>
            </div>
            {monthlyReports.length > 0 && (
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-muted-foreground">
                  {monthlyReports.length} mensal{monthlyReports.length !== 1 ? 'is' : ''}
                </span>
              </div>
            )}
            {priceVariationReports.length > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-muted-foreground">
                  {priceVariationReports.length} variação{priceVariationReports.length !== 1 ? 'ões' : ''} de preço
                </span>
              </div>
            )}
            {customTriggerReports.length > 0 && (
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">
                  {customTriggerReports.length} customizado{customTriggerReports.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {fundamentalChangeReports.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">
                    {positiveCount} mudança{positiveCount !== 1 ? 's' : ''} positiva{positiveCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-muted-foreground">
                    {negativeCount} mudança{negativeCount !== 1 ? 's' : ''} negativa{negativeCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Premium Upgrade CTA */}
      {!isPremium && reports.length > 0 && (
        <Card className="p-6 mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2 text-amber-900 dark:text-amber-100">
                Upgrade para Premium
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                Desbloqueie acesso completo aos scores e análises detalhadas de todos os relatórios.
              </p>
              <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700">
                <Link href="/checkout">
                  <Crown className="h-4 w-4 mr-2" />
                  Fazer Upgrade
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            Nenhum relatório disponível
          </h3>
          <p className="text-muted-foreground">
            Ainda não há relatórios disponíveis para este ativo.
            <br />
            Inscreva-se no monitoramento para ser notificado quando houver novos relatórios.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const reportType = report.type as string;
            const isMonthlyReport = reportType === 'MONTHLY_OVERVIEW';
            const isPriceVariation = reportType === 'PRICE_VARIATION';
            const isCustomTrigger = reportType === 'CUSTOM_TRIGGER';
            const isFundamentalChange = reportType === 'FUNDAMENTAL_CHANGE';
            const isPositive = report.changeDirection === 'positive';
            const scoreDelta = report.currentScore && report.previousScore 
              ? Number(report.currentScore) - Number(report.previousScore)
              : 0;

            // Formatar janela para exibição
            const getWindowLabel = (days: number | null | undefined): string => {
              if (!days) return '';
              if (days === 1) return '1 dia';
              if (days === 5) return '5 dias';
              if (days === 30) return '30 dias';
              if (days === 365) return '365 dias';
              return `${days} dias`;
            };

            // Extrair primeiro parágrafo do relatório como preview
            const preview = report.content
              .replace(/^#.*\n/gm, '') // Remove títulos
              .replace(/\*\*/g, '') // Remove negrito
              .split('\n\n')
              .find(p => p.trim().length > 50)
              ?.substring(0, 200) + '...';

            // Verificar se há flag associado a este relatório (perda de fundamento)
            const hasFlag = flagsByReportId.has(report.id);

            return (
              <Link 
                key={report.id} 
                href={`/acao/${ticker.toLowerCase()}/relatorios/${report.id}`}
              >
                <Card className="p-4 sm:p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        {isMonthlyReport ? (
                          <Badge variant="secondary" className="text-xs sm:text-sm">
                            <Brain className="h-3 w-3 mr-1" />
                            Relatório Mensal
                          </Badge>
                        ) : isPriceVariation ? (
                          <>
                            <Badge variant="outline" className="text-xs sm:text-sm border-orange-500 text-orange-700 dark:text-orange-400">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Variação de Preço
                            </Badge>
                            {report.windowDays && (
                              <Badge variant="secondary" className="text-xs sm:text-sm">
                                {getWindowLabel(report.windowDays)}
                              </Badge>
                            )}
                            {hasFlag && isPremium && (
                              <Badge variant="destructive" className="text-xs sm:text-sm">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Perda de Fundamentos
                              </Badge>
                            )}
                          </>
                        ) : isCustomTrigger ? (
                          <Badge variant="outline" className="text-xs sm:text-sm border-blue-500 text-blue-700 dark:text-blue-400">
                            <Settings className="h-3 w-3 mr-1" />
                            Customizado
                          </Badge>
                        ) : (
                          <Badge 
                            variant={isPositive ? 'default' : 'destructive'}
                            className="text-xs sm:text-sm"
                          >
                            {isPositive ? (
                              <>
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Mudança Positiva
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Mudança Negativa
                              </>
                            )}
                          </Badge>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span className="whitespace-nowrap">
                          {new Date(report.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                          </span>
                        </div>
                      </div>

                      {/* Score - apenas para relatórios de mudança fundamental */}
                      {isFundamentalChange && (
                        <>
                          {isPremium ? (
                            <div className="mb-3">
                              <span className="text-lg font-semibold">
                                Score: {Number(report.previousScore).toFixed(1)} → {' '}
                              </span>
                              <span className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {Number(report.currentScore).toFixed(1)}
                              </span>
                              <Badge variant="outline" className="ml-2">
                                {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
                              </Badge>
                            </div>
                          ) : (
                            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                              <Lock className="h-4 w-4" />
                              <span className="text-sm">Score disponível apenas para usuários Premium</span>
                            </div>
                          )}
                        </>
                      )}

                      {preview && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {preview}
                        </p>
                      )}

                      {/* Conclusão - apenas para PRICE_VARIATION */}
                      {/* {isPriceVariation && conclusionPreview && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-md border-l-2 border-orange-500">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Conclusão:</p>
                          <p className="text-sm text-foreground">{conclusionPreview}</p>
                        </div>
                      )} */}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

