import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, FileText, Crown, Lock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { isCurrentUserPremium } from '@/lib/user-service';

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
    title: `Relatórios de Mudanças: ${company.name} (${company.ticker}) | Preço Justo AI`,
    description: `Histórico completo de análises de mudanças fundamentais em ${company.name}. Acompanhe a evolução do ativo ao longo do tempo.`,
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

  const reports = await prisma.aIReport.findMany({
    where: {
      companyId: company.id,
      type: 'FUNDAMENTAL_CHANGE',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  const positiveCount = reports.filter(r => r.changeDirection === 'positive').length;
  const negativeCount = reports.filter(r => r.changeDirection === 'negative').length;

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
              Relatórios de Mudanças Fundamentais
            </h1>
            <p className="text-muted-foreground">
              {company.name} ({company.ticker})
            </p>
          </div>
          
          {company.logoUrl && (
            <img 
              src={company.logoUrl} 
              alt={company.name}
              className="w-16 h-16 rounded-lg object-contain"
            />
          )}
        </div>

        {/* Stats */}
        {reports.length > 0 && (
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {reports.length} relatório{reports.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">
                {positiveCount} positiva{positiveCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">
                {negativeCount} negativa{negativeCount !== 1 ? 's' : ''}
              </span>
            </div>
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
            Ainda não foram detectadas mudanças fundamentais significativas neste ativo.
            <br />
            Inscreva-se no monitoramento para ser notificado quando houver mudanças.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isPositive = report.changeDirection === 'positive';
            const scoreDelta = report.currentScore && report.previousScore 
              ? Number(report.currentScore) - Number(report.previousScore)
              : 0;

            // Extrair primeiro parágrafo do relatório como preview
            const preview = report.content
              .replace(/^#.*\n/gm, '') // Remove títulos
              .replace(/\*\*/g, '') // Remove negrito
              .split('\n\n')
              .find(p => p.trim().length > 50)
              ?.substring(0, 200) + '...';

            return (
              <Link 
                key={report.id} 
                href={`/acao/${ticker.toLowerCase()}/relatorios/${report.id}`}
              >
                <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge 
                          variant={isPositive ? 'default' : 'destructive'}
                          className="text-sm"
                        >
                          {isPositive ? (
                            <>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Positiva
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Negativa
                            </>
                          )}
                        </Badge>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(report.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>

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

                      {preview && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {preview}
                        </p>
                      )}
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

