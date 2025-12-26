import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Crown, Lock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { AIReportFeedback } from '@/components/ai-report-feedback';
import { isCurrentUserPremium } from '@/lib/user-service';

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
    select: {
      type: true,
      changeDirection: true,
      previousScore: true,
      currentScore: true,
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

  const isMonthlyReport = report.type === 'MONTHLY_OVERVIEW';
  const isCustomTrigger = report.type === 'CUSTOM_TRIGGER';
  const isPriceVariation = report.type === 'PRICE_VARIATION';
  const isFundamentalChange = report.type === 'FUNDAMENTAL_CHANGE';
  const isPremium = await isCurrentUserPremium();
  
  if (isMonthlyReport) {
    return {
      title: `Relatório Mensal: ${report.company.name} (${report.company.ticker}) | Preço Justo AI`,
      description: `Análise mensal completa com Inteligência Artificial de ${report.company.name}.`,
    };
  }
  
  if (isCustomTrigger) {
    return {
      title: `Gatilho Customizado: ${report.company.name} (${report.company.ticker}) | Preço Justo AI`,
      description: `Relatório de gatilho customizado disparado para ${report.company.name}.`,
    };
  }
  
  if (isPriceVariation) {
    return {
      title: `Variação de Preço: ${report.company.name} (${report.company.ticker}) | Preço Justo AI`,
      description: `Análise detalhada da variação de preço em ${report.company.name}.`,
    };
  }
  
  // FUNDAMENTAL_CHANGE
  const changeText = report.changeDirection === 'positive' ? 'Melhora' : 'Piora';
  return {
    title: `${changeText} Fundamental: ${report.company.name} (${report.company.ticker}) | Preço Justo AI`,
    description: isPremium 
      ? `Análise detalhada das mudanças fundamentais em ${report.company.name}. Score: ${report.previousScore} → ${report.currentScore}`
      : `Análise detalhada das mudanças fundamentais em ${report.company.name}. Upgrade para Premium para ver scores completos.`,
  };
}

export default async function ReportDetailPage({ params }: PageProps) {
  const { ticker, reportId } = await params;

  const report = await prisma.aIReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      type: true,
      content: true,
      changeDirection: true,
      previousScore: true,
      currentScore: true,
      likeCount: true,
      dislikeCount: true,
      createdAt: true,
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

  const isPremium = await isCurrentUserPremium();
  const isMonthlyReport = report.type === 'MONTHLY_OVERVIEW';
  const isCustomTrigger = report.type === 'CUSTOM_TRIGGER';
  const isPriceVariation = report.type === 'PRICE_VARIATION';
  const isFundamentalChange = report.type === 'FUNDAMENTAL_CHANGE';
  
  // Direção de mudança e score só fazem sentido para FUNDAMENTAL_CHANGE
  // PRICE_VARIATION não tem sentido de mudança (é sobre variação de preço, não mudança fundamental)
  const hasChangeDirection = isFundamentalChange;
  const isPositive = hasChangeDirection && report.changeDirection === 'positive';
  const scoreDelta = hasChangeDirection && report.currentScore && report.previousScore 
    ? Number(report.currentScore) - Number(report.previousScore)
    : 0;

  // Extrair conclusão do relatório para PRICE_VARIATION (manter markdown para renderização)
  let fundamentalConclusion: string | null = null;
  if (isPriceVariation) {
    // Buscar a seção "## Análise de Impacto Fundamental" > "### Sobre a Queda de Preço" > "**Conclusão**:"
    // O padrão pode ser: **Conclusão**: ⚠️ **PERDA DE FUNDAMENTO DETECTADA**
    // ou: **Conclusão**: ✅ **Não indica perda de fundamento estrutural**
    const analysisSectionMatch = report.content.match(/## Análise de Impacto Fundamental[\s\S]*?### Sobre a Queda de Preço[\s\S]*?\*\*Conclusão\*\*:\s*([^\n]+)/i);
    if (analysisSectionMatch && analysisSectionMatch[1]) {
      fundamentalConclusion = analysisSectionMatch[1].trim();
      // Manter markdown para renderização correta
      // Limitar tamanho para exibição (mas preservar markdown)
      if (fundamentalConclusion && fundamentalConclusion.length > 150) {
        // Tentar cortar em um ponto seguro (após fechar tags markdown)
        const truncated = fundamentalConclusion.substring(0, 147);
        const lastBold = truncated.lastIndexOf('**');
        if (lastBold > 100) {
          // Se encontrou um ** próximo, cortar após ele
          fundamentalConclusion = truncated.substring(0, lastBold + 2) + '...';
        } else {
          fundamentalConclusion = truncated + '...';
        }
      }
    }
  }

  // Para usuários não-premium, mostrar apenas uma parte do conteúdo
  // Trunca em um ponto natural (após parágrafo ou sentença)
  const getPartialContent = (content: string, maxLength: number): string => {
    if (content.length <= maxLength) return content;
    
    // Tentar encontrar um ponto de quebra natural (fim de parágrafo)
    const truncated = content.substring(0, maxLength);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    const lastSentence = truncated.lastIndexOf('. ');
    const lastLineBreak = truncated.lastIndexOf('\n');
    
    // Usar o ponto de quebra mais próximo do limite
    const breakPoint = Math.max(lastParagraph, lastSentence, lastLineBreak);
    
    if (breakPoint > maxLength * 0.7) {
      return content.substring(0, breakPoint + 1) + '\n\n...';
    }
    
    return truncated + '...';
  };

  const contentToShow = isPremium 
    ? report.content 
    : getPartialContent(report.content, 500);

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
              {isMonthlyReport 
                ? 'Relatório Mensal' 
                : isCustomTrigger 
                  ? 'Relatório de Gatilho Customizado'
                  : isPriceVariation
                    ? 'Relatório de Variação de Preço'
                    : 'Análise de Mudança Fundamental'}
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
        <div className={`grid grid-cols-1 ${
          isPriceVariation && fundamentalConclusion
            ? 'md:grid-cols-2'
            : isMonthlyReport || isCustomTrigger 
              ? 'md:grid-cols-2' 
              : hasChangeDirection
                ? 'md:grid-cols-3'
                : 'md:grid-cols-1'
        } gap-6`}>
          {/* Data */}
          <div>
            <div className="flex items-center text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4 mr-2" />
              {isMonthlyReport ? 'Data do Relatório' : 'Data da Análise'}
            </div>
            <div className="text-lg font-semibold">
              {new Date(report.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>

          {/* Conclusão do Fundamento - apenas para PRICE_VARIATION */}
          {isPriceVariation && fundamentalConclusion && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                Conclusão do Fundamento
              </div>
              <div className="text-base font-medium prose prose-sm max-w-none dark:prose-invert">
                <MarkdownRenderer content={fundamentalConclusion} />
              </div>
            </div>
          )}

          {/* Mudança - apenas para FUNDAMENTAL_CHANGE */}
          {hasChangeDirection && (
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
          )}

          {/* Score - apenas para FUNDAMENTAL_CHANGE */}
          {hasChangeDirection && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                Overall Score
              </div>
              {isPremium ? (
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
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">Disponível apenas para Premium</span>
                </div>
              )}
            </div>
          )}

          {/* Badge de tipo para relatórios mensais e custom triggers */}
          {(isMonthlyReport || isCustomTrigger) && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                Tipo de Relatório
              </div>
              <Badge variant="secondary" className="text-base py-1.5 px-3">
                {isMonthlyReport ? '🤖 Análise Mensal com IA' : '⚙️ Gatilho Customizado'}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Premium Upgrade CTA */}
      {!isPremium && (
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
                Desbloqueie acesso completo ao score detalhado e à análise completa deste relatório.
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

      {/* Report Content */}
      <Card className="p-8 mb-6">
        <MarkdownRenderer content={contentToShow} />
        {!isPremium && report.content.length > contentToShow.length && (
          <div className="mt-6 p-4 bg-muted rounded-lg border border-dashed">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-sm">Conteúdo Premium</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Este relatório contém conteúdo adicional disponível apenas para usuários Premium.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/checkout">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade para Premium
              </Link>
            </Button>
          </div>
        )}
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

