import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { AIReportFeedback } from '@/components/ai-report-feedback';

interface PageProps {
  params: Promise<{
    ticker: string;
    reportId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker, reportId } = await params;
  
  const report = await prisma.aIReport.findUnique({
    where: { id: reportId },
    include: {
      company: {
        select: {
          ticker: true,
          name: true,
        },
      },
    },
  });

  if (!report || report.company.ticker !== ticker.toUpperCase()) {
    return {
      title: 'Relatório não encontrado',
    };
  }

  const changeText = report.changeDirection === 'positive' ? 'Melhora' : 'Piora';
  
  return {
    title: `${changeText} Fundamental: ${report.company.name} (${report.company.ticker}) | Preço Justo AI`,
    description: `Análise detalhada das mudanças fundamentais em ${report.company.name}. Score: ${report.previousScore} → ${report.currentScore}`,
  };
}

export default async function ReportDetailPage({ params }: PageProps) {
  const { ticker, reportId } = await params;

  const report = await prisma.aIReport.findUnique({
    where: { id: reportId },
    include: {
      company: {
        select: {
          ticker: true,
          name: true,
          logoUrl: true,
          sector: true,
        },
      },
    },
  });

  if (!report || report.company.ticker !== ticker.toUpperCase()) {
    notFound();
  }

  const isPositive = report.changeDirection === 'positive';
  const scoreDelta = report.currentScore && report.previousScore 
    ? Number(report.currentScore) - Number(report.previousScore)
    : 0;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/acao/${ticker.toLowerCase()}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para {report.company.ticker}
          </Button>
        </Link>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Análise de Mudança Fundamental
            </h1>
            <p className="text-muted-foreground">
              {report.company.name} ({report.company.ticker})
            </p>
          </div>
          
          {report.company.logoUrl && (
            <img 
              src={report.company.logoUrl} 
              alt={report.company.name}
              className="w-16 h-16 rounded-lg object-contain"
            />
          )}
        </div>
      </div>

      {/* Metadata Card */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Data */}
          <div>
            <div className="flex items-center text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4 mr-2" />
              Data da Análise
            </div>
            <div className="text-lg font-semibold">
              {new Date(report.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>

          {/* Mudança */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Direção da Mudança
            </div>
            <Badge 
              variant={isPositive ? 'default' : 'destructive'}
              className="text-base py-1.5 px-3"
            >
              {isPositive ? (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Positiva
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Negativa
                </>
              )}
            </Badge>
          </div>

          {/* Score */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Overall Score
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium">{Number(report.previousScore).toFixed(1)}</span>
              <span className="text-muted-foreground">→</span>
              <span className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {Number(report.currentScore).toFixed(1)}
              </span>
              <Badge variant="outline" className="ml-2">
                {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      <Card className="p-8 mb-6">
        <MarkdownRenderer content={report.content} />
      </Card>

      {/* Feedback Section */}
      <div className="mb-6">
        <AIReportFeedback
          reportId={report.id}
          ticker={ticker}
          initialLikeCount={report.likeCount || 0}
          initialDislikeCount={report.dislikeCount || 0}
        />
      </div>

      {/* Footer Actions */}
      <div className="flex justify-center">
        <Link href={`/acao/${ticker.toLowerCase()}/relatorios`}>
          <Button variant="ghost">
            Ver todos os relatórios de {report.company.ticker}
          </Button>
        </Link>
      </div>
    </div>
  );
}

