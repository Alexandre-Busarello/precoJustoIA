import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Crown
} from 'lucide-react';

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const ticker = params.ticker.toUpperCase();
  
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { name: true }
  });

  if (!company) {
    return {
      title: 'Empresa não encontrada',
    };
  }

  return {
    title: `Como é calculado o Score de ${ticker} | ${company.name}`,
    description: `Entenda como calculamos o score de ${ticker} (${company.name}). Veja a contribuição de cada critério de análise, penalidades aplicadas e a metodologia completa em detalhes.`,
  };
}

interface OverallScoreBreakdown {
  score: number;
  grade: string;
  classification: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  contributions: {
    name: string;
    score: number;
    weight: number;
    points: number;
    eligible: boolean;
    description: string;
  }[];
  penalties?: {
    reason: string;
    amount: number;
    details?: string[]; // Detalhes específicos (red flags, contradições, etc)
  }[];
  rawScore: number; // Score antes das penalidades
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getScoreBreakdown(ticker: string, _isPremium: boolean, _isLoggedIn: boolean): Promise<OverallScoreBreakdown | null> {
  try {
    // SEMPRE buscar dados completos (mesmo para não-premium) para mostrar a página
    // A proteção será feita no overlay visual, não no fetch de dados
    // Os parâmetros isPremium/isLoggedIn são recebidos mas não usados (prefixados com _)
    const analysisResult = await calculateCompanyOverallScore(ticker, {
      isPremium: true, // ← Sempre buscar dados completos
      isLoggedIn: true,
      includeStatements: true, // ← Sempre incluir statements
      includeStrategies: true
    });

    if (!analysisResult || !analysisResult.overallScore) {
      return null;
    }

    // Buscar análise do YouTube separadamente (se disponível)
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      include: {
        youtubeAnalyses: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const youtubeAnalysis = company?.youtubeAnalyses[0] ? {
      score: typeof company.youtubeAnalyses[0].score === 'object' 
        ? (company.youtubeAnalyses[0].score as any).toNumber() 
        : Number(company.youtubeAnalyses[0].score)
    } : null;

    const data = {
      overallScore: analysisResult.overallScore,
      strategies: analysisResult.strategies
    };

    // Calcular contribuições (mesma lógica do cálculo original)
    const hasYouTubeAnalysis = !!youtubeAnalysis;
    const baseMultiplier = hasYouTubeAnalysis ? 0.90 : 1.00;
    
    const weights = {
      graham: { weight: 0.08 * baseMultiplier, label: 'Graham (Valor Intrínseco)' },
      dividendYield: { weight: 0.08 * baseMultiplier, label: 'Dividend Yield' },
      lowPE: { weight: 0.15 * baseMultiplier, label: 'Low P/E' },
      magicFormula: { weight: 0.13 * baseMultiplier, label: 'Fórmula Mágica' },
      fcd: { weight: 0.15 * baseMultiplier, label: 'Fluxo de Caixa Descontado' },
      gordon: { weight: 0.01 * baseMultiplier, label: 'Gordon (Dividendos)' },
      fundamentalist: { weight: 0.20 * baseMultiplier, label: 'Fundamentalista 3+1' },
      statements: { weight: 0.20 * baseMultiplier, label: 'Demonstrações Financeiras' },
      youtube: { weight: hasYouTubeAnalysis ? 0.10 : 0, label: 'Sentimento de Mercado' }
    };

    const contributions = [];
    let rawScore = 0;

    // Adicionar contribuições de estratégias (se disponíveis na resposta)
    if (data.strategies) {
      const strategyKeys = ['graham', 'dividendYield', 'lowPE', 'magicFormula', 'fcd', 'gordon', 'fundamentalist'] as const;
      
      strategyKeys.forEach((key) => {
        const strategy = data.strategies?.[key];
        const config = weights[key];
        
        if (strategy && config) {
          const points = strategy.score * config.weight;
          rawScore += points;
          
          contributions.push({
            name: config.label,
            score: strategy.score,
            weight: config.weight,
            points,
            eligible: strategy.isEligible || false,
            description: getStrategyDescription(key)
          });
        }
      });
    }

    // Adicionar Demonstrações Financeiras
    if (data.overallScore.statementsAnalysis) {
      const statementsScore = data.overallScore.statementsAnalysis.score;
      const points = statementsScore * weights.statements.weight;
      rawScore += points;
      
      contributions.push({
        name: weights.statements.label,
        score: statementsScore,
        weight: weights.statements.weight,
        points,
        eligible: statementsScore >= 60,
        description: 'Análise profunda dos balanços, DRE e demonstrações de fluxo de caixa'
      });
    }

    // Adicionar YouTube se disponível
    if (hasYouTubeAnalysis && youtubeAnalysis) {
      const youtubeScore = youtubeAnalysis.score;
      const points = youtubeScore * weights.youtube.weight;
      rawScore += points;
      
      contributions.push({
        name: weights.youtube.label,
        score: youtubeScore,
        weight: weights.youtube.weight,
        points,
        eligible: youtubeScore >= 70,
        description: 'Sentimento agregado de múltiplas fontes especializadas de mercado'
      });
    }

    // Ordenar por contribuição
    contributions.sort((a, b) => b.points - a.points);

    // Calcular penalidades e extrair detalhes
    const penalties = [];
    const finalScore = data.overallScore.score;
    const penaltyAmount = rawScore - finalScore;

    if (penaltyAmount > 0.5) {
      // Coletar detalhes das penalidades
      const penaltyDetails: string[] = [];
      
      // Red flags das demonstrações financeiras
      if (data.overallScore.statementsAnalysis?.redFlags) {
        const redFlags = data.overallScore.statementsAnalysis.redFlags;
        if (redFlags.length > 0) {
          penaltyDetails.push(`🚩 ${redFlags.length} alerta(s) crítico(s) identificado(s):`);
          redFlags.forEach(flag => {
            penaltyDetails.push(`   • ${flag}`);
          });
        }
      }

      // Weaknesses do overall score
      if (data.overallScore.weaknesses && data.overallScore.weaknesses.length > 0) {
        const weaknessCount = data.overallScore.weaknesses.length;
        const strengthCount = data.overallScore.strengths?.length || 0;
        
        if (weaknessCount > strengthCount) {
          penaltyDetails.push(`⚠️ Proporção desfavorável: ${weaknessCount} pontos fracos vs ${strengthCount} pontos fortes`);
        }
      }

      // Nível de risco
      if (data.overallScore.statementsAnalysis?.riskLevel) {
        const riskLevel = data.overallScore.statementsAnalysis.riskLevel;
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
          penaltyDetails.push(`⚠️ Nível de risco: ${riskLevel === 'HIGH' ? 'ALTO' : 'CRÍTICO'}`);
        }
      }

      // Força da empresa com detalhamento
      if (data.overallScore.statementsAnalysis?.companyStrength) {
        const strength = data.overallScore.statementsAnalysis.companyStrength;
        const contextualFactors = data.overallScore.statementsAnalysis.contextualFactors || [];
        
        // Debug: log dos contextual factors
        console.log(`[DEBUG] Company Strength: ${strength}`);
        console.log(`[DEBUG] Contextual Factors (${contextualFactors.length}):`, contextualFactors);
        
        if (strength === 'WEAK' || strength === 'MODERATE') {
          penaltyDetails.push('');
          penaltyDetails.push(`⚠️ Força Fundamentalista: ${strength === 'WEAK' ? 'FRACA' : 'MODERADA'}`);
          
          // Adicionar TODOS os fatores contextuais disponíveis
          if (contextualFactors.length > 0) {
            penaltyDetails.push('Análise detalhada dos fundamentos:');
            // Mostrar todos os fatores sem filtro
            contextualFactors.forEach(factor => {
              penaltyDetails.push(`   • ${factor}`);
            });
          } else {
            // Se não há contextualFactors, adicionar análise baseada nos dados brutos
            penaltyDetails.push('Análise dos fundamentos:');
            
            // Extrair weaknesses do overallScore
            if (data.overallScore.weaknesses && data.overallScore.weaknesses.length > 0) {
              data.overallScore.weaknesses.slice(0, 5).forEach(weakness => {
                penaltyDetails.push(`   • ${weakness}`);
              });
            } else {
              penaltyDetails.push('   • Indicadores fundamentalistas abaixo do esperado');
              penaltyDetails.push('   • Empresa não atende critérios de qualidade mínima');
            }
          }
        }
      }

      // Se não há detalhes específicos, adicionar mensagem genérica
      if (penaltyDetails.length === 0) {
        penaltyDetails.push('Ajustes conservadores baseados na análise qualitativa');
      }

      penalties.push({
        reason: 'Penalidades por Qualidade e Riscos Identificados',
        amount: -penaltyAmount,
        details: penaltyDetails
      });
    }

    return {
      score: finalScore,
      grade: data.overallScore.grade,
      classification: data.overallScore.classification,
      strengths: data.overallScore.strengths || [],
      weaknesses: data.overallScore.weaknesses || [],
      recommendation: data.overallScore.recommendation,
      contributions,
      penalties: penalties.length > 0 ? penalties : undefined,
      rawScore
    };
  } catch (error) {
    console.error('Erro ao buscar breakdown do score:', error);
    return null;
  }
}

function getStrategyDescription(key: string): string {
  const descriptions: Record<string, string> = {
    graham: 'Avalia se a ação está sendo negociada abaixo do seu valor intrínseco calculado',
    dividendYield: 'Analisa a qualidade e sustentabilidade dos dividendos pagos',
    lowPE: 'Verifica se o P/L está abaixo da média do setor indicando subavaliação',
    magicFormula: 'Combina ROE elevado com P/L baixo para identificar boas empresas baratas',
    fcd: 'Calcula o valor presente dos fluxos de caixa futuros da empresa',
    gordon: 'Valuation baseado no crescimento perpétuo de dividendos',
    fundamentalist: 'Análise completa de qualidade, preço, endividamento e dividendos'
  };
  return descriptions[key] || '';
}

export default async function EntendendoScorePage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();

  // Verificar sessão e status Premium
  const session = await getServerSession(authOptions);
  let userIsPremium = false;
  let isLoggedIn = false;

  if (session?.user?.id) {
    isLoggedIn = true;
    const user = await getCurrentUser();
    userIsPremium = user?.isPremium || false;
  }

  // Buscar empresa básica
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { name: true }
  });

  if (!company) {
    notFound();
  }

  // Buscar breakdown do score (mesma fonte que a API)
  const breakdown = await getScoreBreakdown(ticker, userIsPremium, isLoggedIn);

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
                Não foi possível carregar o breakdown do score. Tente novamente mais tarde.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className={`container mx-auto px-4 py-8 max-w-5xl ${!userIsPremium ? 'relative' : ''}`}>
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href={`/acao/${ticker.toLowerCase()}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para {ticker}
            </Link>
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                Entendendo o Score
                {!userIsPremium && (
                  <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-orange-600">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground">
                {company.name} ({ticker})
              </p>
            </div>

            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Score Geral</div>
              <div className="text-4xl font-bold">
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
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Resumo da Avaliação
            </CardTitle>
            <CardDescription>
              Classificação: <strong>{breakdown.classification}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pontos Fortes */}
              {breakdown.strengths.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-4 h-4" />
                    Pontos Fortes
                  </h3>
                  <ul className="space-y-2">
                    {breakdown.strengths.map((strength, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pontos Fracos */}
              {breakdown.weaknesses.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-4 h-4" />
                    Pontos Fracos
                  </h3>
                  <ul className="space-y-2">
                    {breakdown.weaknesses.map((weakness, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>{weakness}</span>
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
            <CardTitle>Contribuição de Cada Critério</CardTitle>
            <CardDescription>
              Como cada estratégia e critério contribui para o score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdown.contributions.map((contrib, index) => {
                const Icon = contrib.eligible ? CheckCircle2 : XCircle;
                const color = contrib.eligible ? 'text-green-600' : 'text-red-600';
                const percentage = (contrib.weight * 100).toFixed(1);
                
                return (
                  <div 
                    key={index}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${color}`} />
                          <h4 className="font-semibold">{contrib.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            Peso: {percentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {contrib.description}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Contribuição</div>
                        <div className="text-2xl font-bold text-green-600">
                          +{contrib.points.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ({contrib.score.toFixed(0)}/100 × {percentage}%)
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
                      <div 
                        className={`h-full transition-all ${
                          contrib.eligible ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${contrib.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Subtotal */}
              <div className="border-t-2 border-dashed pt-4">
                <div className="flex items-center justify-between px-4">
                  <div>
                    <h4 className="font-semibold">Subtotal (Contribuições)</h4>
                    <p className="text-sm text-muted-foreground">
                      Soma de todas as contribuições positivas
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {breakdown.rawScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pontos
                    </div>
                  </div>
                </div>
              </div>

              {/* Penalidades */}
              {breakdown.penalties && breakdown.penalties.length > 0 && (
                <>
                  {breakdown.penalties.map((penalty, index) => (
                    <div 
                      key={index}
                      className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-950"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <h4 className="font-semibold text-orange-900 dark:text-orange-100">
                              {penalty.reason}
                            </h4>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-orange-600 dark:text-orange-400">Ajuste</div>
                          <div className="text-2xl font-bold text-red-600">
                            {penalty.amount.toFixed(1)}
                          </div>
                        </div>
                      </div>

                      {/* Detalhes das penalidades */}
                      {penalty.details && penalty.details.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                          <div className="space-y-1.5 text-sm">
                            {penalty.details.map((detail, detailIndex) => (
                              <div 
                                key={detailIndex}
                                className={`${
                                  detail.startsWith('   •') 
                                    ? 'ml-6 text-orange-700 dark:text-orange-300' 
                                    : 'font-medium text-orange-800 dark:text-orange-200'
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
              <div className="border-t-4 border-primary pt-4 bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold">Score Final</h4>
                    <p className="text-sm text-muted-foreground">
                      {breakdown.classification}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold">
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
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Como interpretar este detalhamento dos pontos
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mb-2">
                    O score é calculado pela soma ponderada das contribuições de cada estratégia. Penalidades são 
                    aplicadas quando há contradições entre pontos fortes e fracos, ou quando a proporção de alertas 
                    é muito alta, garantindo uma avaliação conservadora e realista.
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>Fórmula:</strong> Score Final = Subtotal - Penalidades
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Score calculado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* Overlay Premium para não-assinantes */}
        {!userIsPremium && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
            <Card className="max-w-lg mx-4">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full">
                    <Lock className="w-8 h-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl">
                  Entendimento Detalhado do Score
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Recurso exclusivo para assinantes Premium
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Breakdown Completo das Contribuições</p>
                      <p className="text-sm text-muted-foreground">
                        Veja exatamente como cada estratégia contribui para o score final
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Detalhamento de Penalidades</p>
                      <p className="text-sm text-muted-foreground">
                        Entenda todos os alertas críticos e riscos identificados
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Análise de Fundamentos</p>
                      <p className="text-sm text-muted-foreground">
                        Veja os motivos específicos da força fundamentalista da empresa
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Matemática Transparente</p>
                      <p className="text-sm text-muted-foreground">
                        Acompanhe o cálculo passo a passo: contribuições, penalidades e score final
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg p-4 mb-4">
                    <p className="text-sm text-center font-medium">
                      <Crown className="w-4 h-4 inline mr-1" />
                      Acesso completo a <strong>todas as estratégias premium</strong> de análise fundamentalista
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
                      <Link href="/planos">
                        <Crown className="w-4 h-4 mr-2" />
                        Assinar Premium
                      </Link>
                    </Button>
                    
                    <Button asChild variant="outline" className="w-full">
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
