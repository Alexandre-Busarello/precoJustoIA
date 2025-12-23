import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUser } from "@/lib/user-service";
import { prisma } from "@/lib/prisma";
import { getScoreBreakdown } from "@/lib/score-breakdown-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calculator,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  Lock,
  Crown,
  Activity,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();

  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { name: true },
  });

  if (!company) {
    return {
      title: "Empresa não encontrada",
    };
  }

  return {
    title: `Como é calculado o Score de ${ticker} | ${company.name}`,
    description: `Entenda como calculamos o score de ${ticker} (${company.name}). Veja a contribuição de cada critério de análise, penalidades aplicadas e a metodologia completa em detalhes.`,
  };
}

// Interface movida para score-breakdown-service.ts

// Função movida para score-breakdown-service.ts para evitar duplicação

export default async function EntendendoScorePage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();

  // Verificar sessão e status Premium
  const session = await getServerSession(authOptions);
  let userIsPremium = false;
  let isLoggedIn = false;

  if (session?.user?.id) {
    isLoggedIn = true;
    const user = await getCurrentUser();
    userIsPremium = user?.isPremium || false;
  }

  // Buscar empresa básica e dados financeiros
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { 
      name: true,
      financialData: {
        orderBy: { year: 'desc' },
        take: 1,
        select: {
          payout: true,
          lpa: true,
          dy: true
        }
      }
    },
  });

  if (!company) {
    notFound();
  }

  // Buscar breakdown do score (mesma fonte que a API)
  const breakdown = await getScoreBreakdown(ticker, userIsPremium, isLoggedIn);
  
  // Verificar se empresa está reinvestindo
  const latestFinancials = company.financialData[0];
  const payout = latestFinancials?.payout ? 
    (typeof latestFinancials.payout === 'object' && 'toNumber' in latestFinancials.payout 
      ? latestFinancials.payout.toNumber() 
      : Number(latestFinancials.payout)) : null;
  const lpa = latestFinancials?.lpa ? 
    (typeof latestFinancials.lpa === 'object' && 'toNumber' in latestFinancials.lpa 
      ? latestFinancials.lpa.toNumber() 
      : Number(latestFinancials.lpa)) : null;
  const dy = latestFinancials?.dy ? 
    (typeof latestFinancials.dy === 'object' && 'toNumber' in latestFinancials.dy 
      ? latestFinancials.dy.toNumber() 
      : Number(latestFinancials.dy)) : null;
  const hasPositiveProfit = lpa !== null && lpa > 0;
  const hasZeroPayout = payout === 0;
  const hasZeroDividendYield = dy !== null && dy === 0;
  const hasLowPayout = payout !== null && payout > 0 && payout <= 0.30;
  // Se payout for zero OU dividend yield for zero (são equivalentes quando payout é zero), considerar como reinvestimento
  const isReinvesting = hasPositiveProfit && (hasLowPayout || hasZeroPayout || hasZeroDividendYield);
  
  // Mostrar indicador se empresa está reinvestindo (lucro positivo mas payout baixo ou payout/dividend yield zero)
  const shouldShowReinvestmentIndicator = isReinvesting;

  if (!breakdown) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/acao/${ticker.toLowerCase()}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para {ticker}
            </Link>
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Não foi possível carregar o breakdown do score. Tente novamente
                mais tarde.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div
        className={`container mx-auto px-4 py-8 max-w-5xl ${
          !userIsPremium ? "relative" : ""
        }`}
      >
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/acao/${ticker.toLowerCase()}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para {ticker}
            </Link>
          </Button>

          <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex flex-wrap items-center gap-2">
                Entendendo o Score
                {!userIsPremium && (
                  <Badge
                    variant="default"
                    className="bg-gradient-to-r from-amber-500 to-orange-600 whitespace-nowrap"
                  >
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base break-words">
                {company.name} ({ticker})
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="text-sm text-muted-foreground mb-1">
                Score Geral
              </div>
              <div className="text-3xl sm:text-4xl font-bold">
                {breakdown.score.toFixed(1)}
              </div>
              <Badge variant="outline" className="mt-2">
                {breakdown.grade}
              </Badge>
            </div>
          </div>
        </div>

        {/* Overall Score Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calculator className="w-5 h-5 shrink-0" />
              <span className="break-words">Resumo da Avaliação</span>
            </CardTitle>
            <CardDescription className="text-sm break-words">
              Classificação: <strong>{breakdown.classification}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pontos Fortes */}
              {breakdown.strengths.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-600 text-sm sm:text-base">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    Pontos Fortes
                  </h3>
                  <ul className="space-y-2">
                    {breakdown.strengths.map((strength, index) => (
                      <li
                        key={index}
                        className="text-xs sm:text-sm flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="break-words">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pontos Fracos */}
              {breakdown.weaknesses.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-600 text-sm sm:text-base">
                    <TrendingDown className="w-4 h-4 shrink-0" />
                    Pontos Fracos
                  </h3>
                  <ul className="space-y-2">
                    {breakdown.weaknesses.map((weakness, index) => (
                      <li
                        key={index}
                        className="text-xs sm:text-sm flex items-start gap-2"
                      >
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span className="break-words">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contribution Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl break-words">
              Contribuição de Cada Critério
            </CardTitle>
            <CardDescription className="text-sm break-words">
              Como cada estratégia e critério contribui para o score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Indicador de Reinvestimento - Mostrar antes das contribuições se empresa está reinvestindo */}
              {shouldShowReinvestmentIndicator && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full shrink-0">
                        <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="font-semibold text-sm sm:text-base text-blue-900 dark:text-blue-100">
                            Empresa em Crescimento
                          </h4>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700 text-xs">
                            Reinvestimento
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed break-words">
                          Esta empresa tem <strong>lucro positivo</strong> mas <strong>payout baixo ({payout ? (payout * 100).toFixed(0) : '0'}%)</strong>, 
                          indicando que ela <strong>reinveste seus lucros no próprio negócio</strong> para crescimento. 
                          Por isso, as estratégias focadas em dividendos (Dividend Yield, Método Barsi e Gordon) não são aplicadas aqui, e a empresa <strong>não é penalizada</strong> por não pagar dividendos altos.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {breakdown.contributions.map((contrib, index) => {
                const Icon = contrib.eligible ? CheckCircle2 : XCircle;
                const color = contrib.eligible
                  ? "text-green-600"
                  : "text-red-600";
                const percentage = (contrib.weight * 100).toFixed(1);

                return (
                  <div
                    key={index}
                    className="border rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 mb-2">
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Icon className={`w-4 h-4 ${color} shrink-0`} />
                          <h4 className="font-semibold text-sm sm:text-base break-words">
                            {contrib.name}
                          </h4>
                          <Badge
                            variant="outline"
                            className="text-xs whitespace-nowrap"
                          >
                            Peso: {percentage}%
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">
                          {contrib.description}
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          Contribuição
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-green-600">
                          +{contrib.points.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground break-words">
                          ({contrib.score.toFixed(0)}/100 × {percentage}%)
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
                      <div
                        className={`h-full transition-all ${
                          contrib.eligible ? "bg-green-500" : "bg-red-500"
                        }`}
                        style={{ width: `${contrib.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Subtotal */}
              <div className="border-t-2 border-dashed pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 sm:px-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm sm:text-base">
                      Subtotal (Contribuições)
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      Soma de todas as contribuições positivas
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">
                      {breakdown.rawScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Pontos</div>
                  </div>
                </div>
              </div>

              {/* Penalização de Flag de IA */}
              {breakdown.flagPenalty && (
                <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 bg-red-50 dark:bg-red-950/30">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 mb-3">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-start gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                        <h4 className="font-semibold text-sm sm:text-base text-red-900 dark:text-red-100 break-words">
                          Penalização por Perda de Fundamentos (IA)
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-2 break-words">
                        {breakdown.flagPenalty.reason}
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                        Penalização
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-red-600">
                        {breakdown.flagPenalty.value.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Link para relatório */}
                  {breakdown.flagPenalty.reportId && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
                      >
                        <Link href={`/acao/${ticker.toLowerCase()}/relatorios#report-${breakdown.flagPenalty.reportId}`}>
                          <Info className="w-3 h-3 mr-2" />
                          Ver Relatório Completo
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Penalidades */}
              {breakdown.penalties && breakdown.penalties.length > 0 && (
                <>
                  {breakdown.penalties.map((penalty, index) => (
                    <div
                      key={index}
                      className="border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4 bg-orange-50 dark:bg-orange-950"
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 mb-3">
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex items-start gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                            <h4 className="font-semibold text-sm sm:text-base text-orange-900 dark:text-orange-100 break-words">
                              {penalty.reason}
                            </h4>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <div className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">
                            Ajuste
                          </div>
                          <div className="text-xl sm:text-2xl font-bold text-red-600">
                            {penalty.amount.toFixed(1)}
                          </div>
                        </div>
                      </div>

                      {/* Detalhes das penalidades */}
                      {penalty.details && penalty.details.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                          <div className="space-y-1.5 text-xs sm:text-sm">
                            {penalty.details.map((detail, detailIndex) => (
                              <div
                                key={detailIndex}
                                className={`break-words ${
                                  detail.startsWith("   •")
                                    ? "ml-4 sm:ml-6 text-orange-700 dark:text-orange-300"
                                    : "font-medium text-orange-800 dark:text-orange-200"
                                }`}
                              >
                                {detail}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Score Final */}
              <div className="border-t-4 border-primary pt-4 bg-muted/30 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base sm:text-lg font-bold">
                      Score Final
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      {breakdown.classification}
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-3xl sm:text-4xl font-bold">
                      {breakdown.score.toFixed(1)}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {breakdown.grade}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs sm:text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Como interpretar este detalhamento dos pontos
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mb-2 break-words">
                    O score é calculado pela soma ponderada das contribuições de
                    cada estratégia. Penalidades são aplicadas quando há
                    contradições entre pontos fortes e fracos, ou quando a
                    proporção de alertas é muito alta, garantindo uma avaliação
                    conservadora e realista.
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 break-words">
                    <strong>Fórmula:</strong> Score Final = Subtotal -
                    Penalidades
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Score calculado em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>

        {/* Overlay Premium para não-assinantes */}
        {!userIsPremium && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
            <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-3 sm:p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full">
                    <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-xl sm:text-2xl break-words">
                  Entendimento Detalhado do Score
                </CardTitle>
                <CardDescription className="text-sm sm:text-base mt-2 break-words">
                  Recurso exclusivo para assinantes Premium
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm sm:text-base break-words">
                        Breakdown Completo das Contribuições
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground break-words">
                        Veja exatamente como cada estratégia contribui para o
                        score final
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm sm:text-base break-words">
                        Detalhamento de Penalidades
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground break-words">
                        Entenda todos os alertas críticos e riscos identificados
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm sm:text-base break-words">
                        Análise de Fundamentos
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground break-words">
                        Veja os motivos específicos da força fundamentalista da
                        empresa
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm sm:text-base break-words">
                        Matemática Transparente
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground break-words">
                        Acompanhe o cálculo passo a passo: contribuições,
                        penalidades e score final
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg p-3 sm:p-4 mb-4">
                    <p className="text-xs sm:text-sm text-center font-medium break-words">
                      <Crown className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                      Acesso completo a{" "}
                      <strong>todas as estratégias premium</strong> de análise
                      fundamentalista
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      asChild
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm sm:text-base"
                    >
                      <Link href="/planos">
                        <Crown className="w-4 h-4 mr-2" />
                        Assinar Premium
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      className="w-full text-sm sm:text-base"
                    >
                      <Link href={`/acao/${ticker.toLowerCase()}`}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para {ticker}
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
