'use client';

import { useSession } from 'next-auth/react';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { useCompanyAnalysis } from '@/hooks/use-company-data';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import Link from 'next/link';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Lucide Icons
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Eye,
  User,
  Crown,
  Zap,
  Mail,
  Coins,
  Calculator,
  Target,
  ChevronDown,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Shield,
  AlertCircle,
  Activity,
  BarChart3
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Interface para análise estratégica
interface StrategyAnalysis {
  isEligible: boolean;
  score: number;
  fairValue: number | null;
  upside: number | null;
  reasoning: string;
  criteria: { label: string; value: boolean; description: string }[];
  key_metrics?: Record<string, number | null>;
}

// Interface para análise das demonstrações
interface StatementsAnalysis {
  score: number;
  redFlags: string[];
  positiveSignals: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Interface para score geral
interface OverallScore {
  score: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Péssimo';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Empresa Excelente' | 'Empresa Boa' | 'Empresa Regular' | 'Empresa Fraca' | 'Empresa Péssima';
  statementsAnalysis?: StatementsAnalysis;
}

// Interface para resposta da API
interface CompanyAnalysisResponse {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  overallScore: OverallScore | null;
  strategies: {
    graham: StrategyAnalysis;
    dividendYield: StrategyAnalysis;
    lowPE: StrategyAnalysis;
    magicFormula: StrategyAnalysis;
    fcd: StrategyAnalysis;
    gordon: StrategyAnalysis;
    fundamentalist: StrategyAnalysis;
    barsi: StrategyAnalysis;
  };
}

interface Props {
  ticker: string;
  currentPrice: number;
  latestFinancials: Record<string, unknown>;
  userIsPremium?: boolean; // Status Premium do servidor (fonte da verdade)
}

// Função para formatar valores como moeda
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Componente para exibir preços da análise técnica
function TechnicalAnalysisPrices({ ticker, isPremium }: { ticker: string; isPremium: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['technical-analysis-prices', ticker],
    queryFn: async () => {
      const response = await fetch(`/api/technical-analysis/${ticker}`)
      if (!response.ok) {
        return null
      }
      return response.json()
    },
    enabled: isPremium, // Só buscar se for premium
    staleTime: 1000 * 60 * 30, // Cache por 30 minutos
    retry: false
  })

  if (!isPremium) {
    return (
      <>
        <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
          <div>
            <span className="font-medium">Análise Técnica (IA)</span>
            <Crown className="w-3 h-3 ml-1 inline text-yellow-500" />
          </div>
          <span className="text-lg font-bold text-purple-600">🔒 Premium</span>
        </div>
      </>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
        <span className="font-medium">Análise Técnica (IA)</span>
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    )
  }

  const analysis = data?.analysis
  if (!analysis?.aiFairEntryPrice) {
    return null
  }

  return (
    <>
      {/* Preço Justo de Entrada */}
      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
        <div>
          <span className="font-medium">Análise Técnica - Preço Justo</span>
          <Crown className="w-3 h-3 ml-1 inline text-yellow-500" />
        </div>
        <span className="text-lg font-bold text-purple-600">
          {formatCurrency(analysis.aiFairEntryPrice)}
        </span>
      </div>

      {/* Preço Mínimo e Máximo na mesma linha */}
      {analysis.aiMinPrice && analysis.aiMaxPrice && (
        <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
          <span className="font-medium text-sm text-muted-foreground">Faixa Prevista (30 dias)</span>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-semibold text-red-600">
              Min: {formatCurrency(analysis.aiMinPrice)}
            </span>
            <span className="text-sm font-semibold text-green-600">
              Max: {formatCurrency(analysis.aiMaxPrice)}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

// Função para formatar valores como percentual
function formatPercent(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return 'N/A';
  return `${(numValue * 100).toFixed(2)}%`;
}

/**
 * Calcula a porcentagem real de critérios atendidos e verifica se o score foi ajustado
 * Retorna um objeto com a porcentagem real e se houve ajuste
 * 
 * Estratégias como FCD, Graham, Gordon e Barsi podem ter seus scores ajustados para valores
 * fixos (20 ou 25) quando o upside é insuficiente, mesmo que atendam mais critérios.
 */
function getCriteriaPercentage(strategy: StrategyAnalysis | null): {
  realPercentage: number;
  wasAdjusted: boolean;
  adjustedScore: number | null;
} {
  if (!strategy || !strategy.criteria || strategy.criteria.length === 0) {
    return { realPercentage: 0, wasAdjusted: false, adjustedScore: null };
  }

  const passedCriteria = strategy.criteria.filter(c => c.value).length;
  const realPercentage = (passedCriteria / strategy.criteria.length) * 100;
  
  // Detectar penalização progressiva: score significativamente menor que porcentagem real
  // Considerar ajustado se diferença for >= 5% (permite detectar penalizações de 5% ou mais)
  const scoreDifference = realPercentage - strategy.score;
  const wasAdjusted = scoreDifference >= 5; // Threshold para detectar penalização
  
  return {
    realPercentage,
    wasAdjusted,
    adjustedScore: wasAdjusted ? strategy.score : null
  };
}

// Componente inline para registro
function RegisterPrompt({ strategy }: { strategy: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg">
      <div className="mb-6">
        <User className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Crie sua conta gratuita
        </h3>
        <p className="text-muted-foreground">
          Para acessar a análise <strong>{strategy}</strong>
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6 max-w-md">
        <h4 className="font-semibold mb-4">✨ Com sua conta gratuita você terá:</h4>
        <div className="space-y-3 text-left">
          <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Análise Benjamin Graham completa
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Eye className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Histórico de análises salvas
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Zap className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span className="text-sm text-purple-800 dark:text-purple-200">
              Rankings personalizados
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
          <Link href="/register">
            <Mail className="w-4 h-4 mr-2" />
            Criar conta gratuita
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">
            Já tenho conta
          </Link>
        </Button>
      </div>
    </div>
  );
}


// Componente para exibir análise das demonstrações financeiras
function StatementsAnalysisContent({ analysis }: { analysis: StatementsAnalysis }) {
  // Função para obter cor do risco
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Função para obter ícone do risco
  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return <Shield className="w-4 h-4" />;
      case 'MEDIUM': return <AlertCircle className="w-4 h-4" />;
      case 'HIGH': return <AlertTriangle className="w-4 h-4" />;
      case 'CRITICAL': return <AlertTriangle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Função para obter texto do risco
  const getRiskText = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'Baixo Risco';
      case 'MEDIUM': return 'Risco Moderado';
      case 'HIGH': return 'Alto Risco';
      case 'CRITICAL': return 'Risco Crítico';
      default: return 'Indefinido';
    }
  };

  // Função para obter cor do score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header com Score e Risco */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Análise das Demonstrações Financeiras</span>
            </CardTitle>
            <Badge className={`${getRiskColor(analysis.riskLevel)} border`}>
              <div className="flex items-center space-x-1">
                {getRiskIcon(analysis.riskLevel)}
                <span className="text-xs font-medium">{getRiskText(analysis.riskLevel)}</span>
              </div>
            </Badge>
          </div>
          <CardDescription>
            Análise automatizada da DRE, Balanço Patrimonial e Fluxo de Caixa de todos os anos disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Score Principal */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white rounded-full shadow-sm">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Score de Qualidade</p>
                <p className="text-xs text-gray-500">Baseado em 20+ indicadores</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${getScoreColor(analysis.score)}`}>
                {analysis.score}
              </p>
              <p className="text-xs text-gray-500">de 100</p>
            </div>
          </div>

          {/* Resumo Rápido */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sinais Positivos */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">Pontos Fortes</span>
              </div>
              {analysis.positiveSignals.length > 0 ? (
                <div className="space-y-2">
                  {analysis.positiveSignals.map((signal, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-green-800">{signal}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-700">Nenhum ponto forte identificado</p>
              )}
            </div>

            {/* Red Flags */}
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">Alertas</span>
              </div>
              {analysis.redFlags.length > 0 ? (
                <div className="space-y-2">
                  {analysis.redFlags.map((flag, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-red-800">{flag}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-red-700">Nenhum alerta identificado</p>
              )}
            </div>
          </div>

          {/* Metodologia */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">Metodologia</span>
            </div>
            <p className="text-sm text-blue-700 leading-relaxed">
              Esta análise examina automaticamente todos os últimos anos disponíveis das demonstrações financeiras, 
              detectando anomalias em receitas, margens, liquidez, endividamento, fluxo de caixa e tendências. 
              O score combina 20+ indicadores para avaliar a qualidade e consistência dos resultados financeiros.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StrategicAnalysisClient({ ticker, currentPrice, latestFinancials, userIsPremium: serverIsPremium }: Props) {
  const { data: session } = useSession();
  const { data: analysisData, isLoading: loading, error: queryError } = useCompanyAnalysis(ticker);

  const isLoggedIn = !!session?.user;
  const { isPremium: clientIsPremium } = usePremiumStatus();
  
  // Usar status Premium do servidor como fonte da verdade, fallback para cliente
  const isPremium = serverIsPremium !== undefined ? serverIsPremium : clientIsPremium;
  
  // Debug temporário
  console.log('🔍 Premium Status Debug:', {
    serverIsPremium,
    clientIsPremium,
    finalIsPremium: isPremium,
    ticker
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Erro desconhecido') : null;

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
          <Zap className="w-6 h-6" />
          <span>Análises Fundamentalista</span>
        </h2>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando análises...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
          <Zap className="w-6 h-6" />
          <span>Análises Fundamentalista</span>
        </h2>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-600 mb-2">Erro ao carregar análises</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return null;
  }

  // Type assertion para garantir que analysisData tem o tipo correto
  const typedAnalysisData = analysisData as unknown as CompanyAnalysisResponse;
  const { strategies } = typedAnalysisData;

  // Verificar se empresa está reinvestindo (para mostrar indicador global)
  const payout = latestFinancials.payout ? parseFloat(latestFinancials.payout.toString()) : null;
  const lpa = latestFinancials.lpa ? parseFloat(latestFinancials.lpa.toString()) : null;
  const dy = latestFinancials.dy ? parseFloat(latestFinancials.dy.toString()) : null;
  console.log('payout', payout);
  console.log('lpa', lpa);
  console.log('dy', dy);
  const hasPositiveProfit = lpa !== null && lpa > 0;
  const hasZeroPayout = payout === 0 || payout === null;
  const hasZeroDividendYield = dy !== null && dy === 0 || dy === null;
  const hasLowPayout = payout !== null && payout > 0 && payout <= 0.30;
  // Se payout for zero OU dividend yield for zero (são equivalentes quando payout é zero), considerar como reinvestimento
  console.log('hasZeroPayout', hasZeroPayout);
  console.log('hasZeroDividendYield', hasZeroDividendYield);
  console.log('hasLowPayout', hasLowPayout);
  console.log('hasPositiveProfit', hasPositiveProfit);
  
  const isReinvesting = hasPositiveProfit && (hasLowPayout || hasZeroPayout || hasZeroDividendYield);
  console.log('isReinvesting', isReinvesting);

  return (
    <div className="mb-8">
      <div className="mb-6 space-y-2">
        <div className="flex items-center space-x-2">
          <Zap className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Análises Fundamentalista</h2>
        </div>
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 inline-block">
          <span className="hidden xl:inline">Médias 7 anos para indicadores</span>
          <span className="hidden lg:inline xl:hidden">Médias 7 anos</span>
          <span className="hidden md:inline lg:hidden">Médias 7a</span>
          <span className="md:hidden">7a</span>
        </Badge>
      </div>

      {/* Indicador de Reinvestimento - Global para todas as abas */}
      {isReinvesting && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 mb-6">
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

      <Tabs defaultValue="fair-value" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fair-value" className="flex items-center space-x-1">
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">Preço Justo</span>
            {!isLoggedIn && <Badge variant="outline" className="ml-1 text-xs">Login</Badge>}
          </TabsTrigger>
          
          <TabsTrigger value="strategies" className="flex items-center space-x-1">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Estratégias</span>
            {!isLoggedIn ? (
              <Badge variant="outline" className="ml-1 text-xs">Login</Badge>
            ) : !isPremium ? (
              <Badge variant="secondary" className="ml-1 text-xs bg-orange-100 text-orange-800">Premium</Badge>
            ) : null}
          </TabsTrigger>

          <TabsTrigger value="statements" className="flex items-center space-x-1">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Demonstrações</span>
            {!isPremium && (
              <Badge variant="secondary" className="ml-1 text-xs bg-orange-100 text-orange-800">Premium</Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="overview" className="flex items-center space-x-1">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
        </TabsList>

        {/* Preço Justo Tab */}
        <TabsContent value="fair-value" className="mt-6">
          <div className="space-y-6">
            {/* Graham Analysis - SEMPRE VISÍVEL */}
            {!isLoggedIn ? (
              <RegisterPrompt strategy="Benjamin Graham" />
            ) : (
              <Card className={
                isLoggedIn && strategies.graham?.score
                  ? !strategies.graham?.isEligible
                    ? "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    : strategies.graham.score >= 80 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.graham.score >= 60 
                    ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                    : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : ""
              }>
                <Collapsible>
                  <CollapsibleTrigger className="w-full p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Calculator className={`w-5 h-5 ${
                          isLoggedIn && strategies.graham?.score
                            ? !strategies.graham?.isEligible
                              ? "text-yellow-700 dark:text-yellow-400"
                              : strategies.graham.score >= 80
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.graham.score >= 60 
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isLoggedIn && strategies.graham?.score
                            ? !strategies.graham?.isEligible
                              ? "text-yellow-900 dark:text-yellow-100"
                              : strategies.graham.score >= 80
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.graham.score >= 60
                              ? "text-yellow-900 dark:text-yellow-100" 
                              : "text-red-900 dark:text-red-100"
                            : ""
                        }`}>Benjamin Graham</span>
                        <Badge variant={strategies.graham?.isEligible ? "default" : "secondary"}>
                          {(() => {
                            const criteriaInfo = getCriteriaPercentage(strategies.graham);
                            return `${criteriaInfo.realPercentage.toFixed(0)}% dos critérios`;
                          })()}
                        </Badge>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Preço Atual</p>
                          <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Preço Justo Graham</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {strategies.graham?.fairValue ? 
                              formatCurrency(strategies.graham.fairValue) : 'N/A'
                            }
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Margem de Segurança</p>
                          <div className="flex items-center justify-center space-x-2">
                            {strategies.graham?.upside && strategies.graham.upside > 0 ? (
                              <TrendingUp className="w-5 h-5 text-green-500" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-500" />
                            )}
                            <p className={`text-2xl font-bold ${
                              strategies.graham?.upside && strategies.graham.upside > 0 ? 
                              'text-green-600' : 'text-red-600'
                            }`}>
                              {strategies.graham?.upside ? 
                                `${strategies.graham.upside.toFixed(1)}%` : 'N/A'
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <MarkdownRenderer content={strategies.graham?.reasoning || ''} />
                      </div>

                      {(() => {
                        const criteriaInfo = getCriteriaPercentage(strategies.graham);
                        if (criteriaInfo.wasAdjusted) {
                          return (
                            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 flex items-start space-x-2">
                              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                  Score Ajustado
                                </p>
                                <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                                  A empresa atendeu {criteriaInfo.realPercentage.toFixed(0)}% dos critérios, mas o score foi ajustado para {criteriaInfo.adjustedScore?.toFixed(0)} devido ao upside insuficiente ({strategies.graham?.upside?.toFixed(1)}%).
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="space-y-2">
                        <h4 className="font-medium">Critérios Avaliados:</h4>
                        {strategies.graham?.criteria?.map((criterion, index) => (
                          <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                            <div className="flex items-center space-x-2">
                              {criterion.value ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm">{criterion.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {criterion.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* FCD Analysis - Preview + Paywall para não-Premium */}
            {!isPremium ? (
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calculator className="w-5 h-5 text-purple-600" />
                      <span className="text-lg font-semibold">Fluxo de Caixa Descontado (FCD)</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Método mais sofisticado para calcular o valor intrínseco baseado em projeções de fluxo de caixa futuro
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Preview do que o usuário veria */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 opacity-60">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Preço Atual</p>
                      <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Preço Justo FCD</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-purple-600 blur-sm">R$ XX,XX</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Upside Potencial</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-green-600 blur-sm">+XX,X%</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA de Conversão */}
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 p-6 rounded-lg border border-orange-200 text-center">
                    <Crown className="w-12 h-12 text-orange-600 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                      Desbloqueie o Fluxo de Caixa Descontado
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-200 mb-4">
                      Veja o valor intrínseco calculado com projeções de crescimento e taxa de desconto personalizada
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
                        <Link href={isLoggedIn ? "/checkout" : "/register"}>
                          <Crown className="w-4 h-4 mr-2" />
                          {isLoggedIn ? "Assinar Premium" : "Cadastre-se para Ver"}
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/planos">
                          Ver todos os benefícios
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
                <Card className={
                  isPremium && strategies.fcd?.score
                    ? !strategies.fcd?.isEligible
                      ? "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                      : strategies.fcd.score >= 80 
                      ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : strategies.fcd.score >= 60 
                      ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                      : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    : "border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20"
                }>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Calculator className={`w-5 h-5 ${
                            isPremium && strategies.fcd?.score
                              ? !strategies.fcd?.isEligible
                                ? "text-yellow-700 dark:text-yellow-400"
                                : strategies.fcd.score >= 80
                                ? "text-green-700 dark:text-green-400" 
                                : strategies.fcd.score >= 60 
                                ? "text-yellow-700 dark:text-yellow-400" 
                                : "text-red-700 dark:text-red-400"
                              : "text-purple-600"
                          }`} />
                          <span className={`text-lg font-semibold ${
                            isPremium && strategies.fcd?.score
                              ? !strategies.fcd?.isEligible
                                ? "text-yellow-900 dark:text-yellow-100"
                                : strategies.fcd.score >= 80 
                                ? "text-green-900 dark:text-green-100" 
                                : strategies.fcd.score >= 60
                                ? "text-yellow-900 dark:text-yellow-100" 
                                : "text-red-900 dark:text-red-100"
                              : ""
                          }`}>Fluxo de Caixa Descontado (FCD)</span>
                          <Badge variant={strategies.fcd?.isEligible ? "default" : "secondary"}>
                            {(() => {
                              const criteriaInfo = getCriteriaPercentage(strategies.fcd);
                              return `${criteriaInfo.realPercentage.toFixed(0)}% dos critérios`;
                            })()}
                          </Badge>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Atual</p>
                            <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Justo FCD</p>
                            <p className="text-2xl font-bold text-purple-600">
                              {strategies.fcd?.fairValue ? 
                                formatCurrency(strategies.fcd.fairValue) : 'N/A'
                              }
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Upside Potencial</p>
                            <div className="flex items-center justify-center space-x-2">
                              {strategies.fcd?.upside && strategies.fcd.upside > 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-500" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-red-500" />
                              )}
                              <p className={`text-2xl font-bold ${
                                strategies.fcd?.upside && strategies.fcd.upside > 0 ? 
                                'text-green-600' : 'text-red-600'
                              }`}>
                                {strategies.fcd?.upside ? 
                                  `${strategies.fcd.upside.toFixed(1)}%` : 'N/A'
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <MarkdownRenderer content={strategies.fcd?.reasoning || ''} />
                        </div>

                        {(() => {
                          const criteriaInfo = getCriteriaPercentage(strategies.fcd);
                          if (criteriaInfo.wasAdjusted) {
                            return (
                              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 flex items-start space-x-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                    Score Ajustado
                                  </p>
                                  <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                                    A empresa atendeu {criteriaInfo.realPercentage.toFixed(0)}% dos critérios, mas o score foi ajustado para {criteriaInfo.adjustedScore?.toFixed(0)} devido ao upside insuficiente ({strategies.fcd?.upside?.toFixed(1)}%).
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="space-y-2">
                          <h4 className="font-medium">Critérios Premium:</h4>
                          {strategies.fcd?.criteria?.map((criterion, index) => (
                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                {criterion.value ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">{criterion.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {criterion.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

            {/* Gordon Analysis - Preview + Paywall para não-Premium */}
            {!isPremium ? (
              <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-orange-600" />
                      <span className="text-lg font-semibold">Fórmula de Gordon (Método dos Dividendos)</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Avalia empresas pagadoras de dividendos baseado no crescimento sustentável dos proventos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Preview do que o usuário veria */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 opacity-60">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Dividend Yield</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPercent(latestFinancials.dy)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Preço Justo Gordon</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-orange-600 blur-sm">R$ XX,XX</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Crescimento Dividendos</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-blue-600 blur-sm">+X,X%</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA de Conversão */}
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 p-6 rounded-lg border border-orange-200 text-center">
                    <DollarSign className="w-12 h-12 text-orange-600 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                      Desbloqueie a Fórmula de Gordon
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-200 mb-4">
                      Ideal para empresas pagadoras de dividendos consistentes. Veja se os proventos são sustentáveis!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
                        <Link href={isLoggedIn ? "/checkout" : "/register"}>
                          <Crown className="w-4 h-4 mr-2" />
                          {isLoggedIn ? "Assinar Premium" : "Cadastre-se para Ver"}
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/planos">
                          Ver metodologia completa
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
                <Card className={
                  isPremium && strategies.gordon?.score
                    ? !strategies.gordon?.isEligible
                      ? "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                      : strategies.gordon.score >= 80 
                      ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : strategies.gordon.score >= 60
                      ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                      : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    : "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20"
                }>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <DollarSign className={`w-5 h-5 ${
                            isPremium && strategies.gordon?.score
                              ? !strategies.gordon?.isEligible
                                ? "text-yellow-700 dark:text-yellow-400"
                                : strategies.gordon.score >= 80
                                ? "text-green-700 dark:text-green-400" 
                                : strategies.gordon.score >= 60
                                ? "text-yellow-700 dark:text-yellow-400" 
                                : "text-red-700 dark:text-red-400"
                              : "text-orange-600"
                          }`} />
                          <span className={`text-lg font-semibold ${
                            isPremium && strategies.gordon?.score
                              ? !strategies.gordon?.isEligible
                                ? "text-yellow-900 dark:text-yellow-100"
                                : strategies.gordon.score >= 80
                                ? "text-green-900 dark:text-green-100" 
                                : strategies.gordon.score >= 60
                                ? "text-yellow-900 dark:text-yellow-100" 
                                : "text-red-900 dark:text-red-100"
                              : ""
                          }`}>Fórmula de Gordon (Método dos Dividendos)</span>
                          <Badge variant={strategies.gordon?.isEligible ? "default" : "secondary"}>
                            {(() => {
                              const criteriaInfo = getCriteriaPercentage(strategies.gordon);
                              return `${criteriaInfo.realPercentage.toFixed(0)}% dos critérios`;
                            })()}
                          </Badge>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Atual</p>
                            <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Justo Gordon</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {strategies.gordon?.fairValue ? 
                                formatCurrency(strategies.gordon.fairValue) : 'N/A'
                              }
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Upside Potencial</p>
                            <div className="flex items-center justify-center space-x-2">
                              {strategies.gordon?.upside && strategies.gordon.upside > 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-500" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-red-500" />
                              )}
                              <p className={`text-2xl font-bold ${
                                strategies.gordon?.upside && strategies.gordon.upside > 0 ? 
                                'text-green-600' : 'text-red-600'
                              }`}>
                                {strategies.gordon?.upside ? 
                                  `${strategies.gordon.upside.toFixed(1)}%` : 'N/A'
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <MarkdownRenderer content={strategies.gordon?.reasoning || ''} />
                        </div>

                        {(() => {
                          const criteriaInfo = getCriteriaPercentage(strategies.gordon);
                          if (criteriaInfo.wasAdjusted) {
                            return (
                              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 flex items-start space-x-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                    Score Ajustado
                                  </p>
                                  <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                                    A empresa atendeu {criteriaInfo.realPercentage.toFixed(0)}% dos critérios, mas o score foi ajustado para {criteriaInfo.adjustedScore?.toFixed(0)} devido ao upside insuficiente ({strategies.gordon?.upside?.toFixed(1)}% &lt; 15%).
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="space-y-2">
                          <h4 className="font-medium">Critérios Avaliados:</h4>
                          {strategies.gordon?.criteria?.map((criterion, index) => (
                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                {criterion.value ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">{criterion.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {criterion.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* Barsi Analysis - Preview + Paywall para não-Premium */}
            {!isPremium ? (
              <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="text-lg font-semibold">Método Barsi (Buy-and-Hold Dividendos)</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Estratégia de Luiz Barsi para construção de patrimônio através de dividendos em setores perenes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Preview do que o usuário veria */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 opacity-60">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Dividend Yield</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPercent(latestFinancials.dy)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Preço Teto Barsi</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-green-600 blur-sm">R$ XX,XX</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Desconto do Teto</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-blue-600 blur-sm">+X,X%</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA de Conversão */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 rounded-lg border border-green-200 text-center">
                    <DollarSign className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                      Desbloqueie o Método Barsi
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-200 mb-4">
                      Estratégia completa dos 5 passos de Luiz Barsi para independência financeira através de dividendos
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                        <Link href={isLoggedIn ? "/checkout" : "/register"}>
                          <Crown className="w-4 h-4 mr-2" />
                          {isLoggedIn ? "Assinar Premium" : "Cadastre-se para Ver"}
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/planos">
                          Ver os 5 passos do Barsi
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
                <Card className={
                  isPremium && strategies.barsi?.score
                    ? !strategies.barsi?.isEligible
                      ? "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                      : strategies.barsi.score >= 80 
                      ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : strategies.barsi.score >= 60
                      ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                      : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    : "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20"
                }>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <DollarSign className={`w-5 h-5 ${
                            isPremium && strategies.barsi?.score
                              ? !strategies.barsi?.isEligible
                                ? "text-yellow-700 dark:text-yellow-400"
                                : strategies.barsi.score >= 80
                                ? "text-green-700 dark:text-green-400" 
                                : strategies.barsi.score >= 60
                                ? "text-yellow-700 dark:text-yellow-400" 
                                : "text-red-700 dark:text-red-400"
                              : "text-green-600"
                          }`} />
                          <span className={`text-lg font-semibold ${
                            isPremium && strategies.barsi?.score
                              ? !strategies.barsi?.isEligible
                                ? "text-yellow-900 dark:text-yellow-100"
                                : strategies.barsi.score >= 80
                                ? "text-green-900 dark:text-green-100" 
                                : strategies.barsi.score >= 60
                                ? "text-yellow-900 dark:text-yellow-100" 
                                : "text-red-900 dark:text-red-100"
                              : ""
                          }`}>Método Barsi (Buy-and-Hold Dividendos)</span>
                          <Badge variant={strategies.barsi?.isEligible ? "default" : "secondary"}>
                            {(() => {
                              const criteriaInfo = getCriteriaPercentage(strategies.barsi);
                              return `${criteriaInfo.realPercentage.toFixed(0)}% dos critérios`;
                            })()}
                          </Badge>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Atual</p>
                            <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Preço Teto Barsi</p>
                            <p className="text-2xl font-bold text-green-600">
                              {strategies.barsi?.fairValue ? 
                                formatCurrency(strategies.barsi.fairValue) : 'N/A'
                              }
                            </p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Desconto do Teto</p>
                            <div className="flex items-center justify-center space-x-2">
                              {strategies.barsi?.upside && strategies.barsi.upside > 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-500" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-red-500" />
                              )}
                              <p className={`text-2xl font-bold ${
                                strategies.barsi?.upside && strategies.barsi.upside > 0 ? 
                                'text-green-600' : 'text-red-600'
                              }`}>
                                {strategies.barsi?.upside ? 
                                  `${strategies.barsi.upside.toFixed(1)}%` : 'N/A'
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg mb-4">
                          <MarkdownRenderer content={strategies.barsi?.reasoning || ''} />
                        </div>

                        {(() => {
                          const criteriaInfo = getCriteriaPercentage(strategies.barsi);
                          if (criteriaInfo.wasAdjusted) {
                            return (
                              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 flex items-start space-x-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                    Score Ajustado
                                  </p>
                                  <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                                    A empresa atendeu {criteriaInfo.realPercentage.toFixed(0)}% dos critérios, mas o score foi ajustado para {criteriaInfo.adjustedScore?.toFixed(0)} devido ao upside insuficiente ({strategies.barsi?.upside?.toFixed(1)}% &lt; 10%).
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="space-y-2">
                          <h4 className="font-medium">Critérios dos 5 Passos do Barsi:</h4>
                          {strategies.barsi?.criteria?.map((criterion, index) => (
                            <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                              <div className="flex items-center space-x-2">
                                {criterion.value ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">{criterion.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {criterion.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Strategies Tab */}
        <TabsContent value="strategies" className="mt-6">
          {!isLoggedIn ? (
            <RegisterPrompt strategy="Estratégias de Investimento" />
          ) : !isPremium ? (
            <div className="space-y-6">
              {/* Preview das Estratégias Premium */}
              <div className="text-center mb-6 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 rounded-lg border border-orange-200">
                <Crown className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-2">
                  Estratégias Premium de Investimento
                </h3>
                <p className="text-orange-700 dark:text-orange-200 mb-4">
                  Acesse 5 estratégias avançadas para identificar as melhores oportunidades do mercado
                </p>
                <Button asChild size="lg" className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
                  <Link href={isLoggedIn ? "/checkout" : "/register"}>
                    <Crown className="w-4 h-4 mr-2" />
                    {isLoggedIn ? "Assinar Premium - 1 dia grátis" : "Cadastre-se para Ver"}
                  </Link>
                </Button>
              </div>

              {/* Preview Anti-Dividend Trap */}
              <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 opacity-75">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Coins className="w-5 h-5 text-green-600" />
                      <span className="text-lg font-semibold">Anti-Dividend Trap</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Identifica empresas com dividendos sustentáveis e evita &quot;armadilhas de dividendos&quot;
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 opacity-60">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Dividend Yield</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPercent(latestFinancials.dy)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Sustentabilidade</p>
                      <div className="relative">
                        <p className="text-lg font-bold text-green-600 blur-sm">Segura</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-orange-600" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Score</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-blue-600 blur-sm">XX%</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      🔒 Análise completa disponível para assinantes Premium
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Preview Value Investing */}
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 opacity-75">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span className="text-lg font-semibold">Value Investing</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Estratégia clássica para encontrar empresas subvalorizadas com fundamentos sólidos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 opacity-60">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">P/L</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {latestFinancials.pl ? parseFloat(latestFinancials.pl.toString()).toFixed(1) : 'N/A'}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">P/VP</p>
                      <p className="text-2xl font-bold text-green-600">
                        {latestFinancials.pvp ? parseFloat(latestFinancials.pvp.toString()).toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Qualificação</p>
                      <div className="relative">
                        <p className="text-lg font-bold text-green-600 blur-sm">Aprovada</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      🔒 Critérios anti-value trap disponíveis no Premium
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Preview Fórmula Mágica */}
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 opacity-75">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Crown className="w-5 h-5 text-purple-600" />
                      <span className="text-lg font-semibold">Fórmula Mágica (Greenblatt)</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Estratégia quantitativa que combina qualidade operacional com preço atrativo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 opacity-60">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">ROIC</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatPercent(latestFinancials.roic)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Earnings Yield</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPercent(latestFinancials.earningsYield)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Ranking</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-purple-600 blur-sm">Top XX</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      🔒 Ranking completo e critérios no Premium
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Preview Fundamentalista 3+1 */}
              <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 opacity-75">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      <span className="text-lg font-semibold">Fundamentalista 3+1</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Metodologia adaptativa que analisa Qualidade + Preço + Endividamento + Dividendos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 opacity-60">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">ROE</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatPercent(latestFinancials.roe)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Dívida/PL</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {latestFinancials.dividaLiquidaPl ? parseFloat(latestFinancials.dividaLiquidaPl.toString()).toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Score Final</p>
                      <div className="relative">
                        <p className="text-2xl font-bold text-indigo-600 blur-sm">XX/100</p>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-orange-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      🔒 Análise completa dos 4 pilares no Premium
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* CTA Final */}
              <div className="text-center p-8 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 rounded-lg border border-orange-200">
                <Crown className="w-20 h-20 text-orange-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-3">
                  Desbloqueie Todas as Estratégias
                </h3>
                <p className="text-orange-700 dark:text-orange-200 mb-6 max-w-2xl mx-auto">
                  Tenha acesso completo a 5 estratégias Premium + análise de demonstrações financeiras + rankings ilimitados
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
                    <Link href="/planos">
                      <Crown className="w-5 h-5 mr-2" />
                      Começar teste grátis de 1 dia
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/planos">
                      Ver todos os planos
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dividend Yield Analysis */}
              <Card className={
                isPremium && strategies.dividendYield?.score
                  ? strategies.dividendYield.score >= 80 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.dividendYield.score >= 60
                    ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                    : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : ""
              }>
                <Collapsible>
                  <CollapsibleTrigger className="w-full p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Coins className={`w-5 h-5 ${
                          isPremium && strategies.dividendYield?.score
                            ? strategies.dividendYield.score >= 80  
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.dividendYield.score >= 60
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.dividendYield?.score
                            ? strategies.dividendYield.score >= 80 
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.dividendYield.score >= 60 
                              ? "text-yellow-900 dark:text-yellow-100" 
                              : "text-red-900 dark:text-red-100"
                            : ""
                        }`}>Anti-Dividend Trap</span>
                        <Badge variant={strategies.dividendYield?.isEligible ? "default" : "secondary"}>
                          {strategies.dividendYield?.score?.toFixed(0) || 0}% dos critérios
                        </Badge>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Dividend Yield</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatPercent(latestFinancials.dy)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Rendimento Anual Est.</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {strategies.dividendYield?.upside ? 
                              `${strategies.dividendYield.upside.toFixed(1)}%` : 'N/A'
                            }
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Sustentabilidade</p>
                          <div className="flex items-center justify-center space-x-2">
                            {strategies.dividendYield?.isEligible ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <p className={`text-lg font-bold ${
                              strategies.dividendYield?.isEligible ? 
                              'text-green-600' : 'text-red-600'
                            }`}>
                              {strategies.dividendYield?.isEligible ? 'Segura' : 'Risco'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <MarkdownRenderer content={strategies.dividendYield?.reasoning || ''} />
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Critérios Anti-Trap:</h4>
                        {strategies.dividendYield?.criteria?.map((criterion, index) => (
                          <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                            <div className="flex items-center space-x-2">
                              {criterion.value ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm">{criterion.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {criterion.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Value Investing Analysis */}
              <Card className={
                isPremium && strategies.lowPE?.score
                  ? strategies.lowPE.score >= 80 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.lowPE.score >= 60 
                    ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                    : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : ""
              }>
                <Collapsible>
                  <CollapsibleTrigger className="w-full p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Target className={`w-5 h-5 ${
                          isPremium && strategies.lowPE?.score
                            ? strategies.lowPE.score >= 80  
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.lowPE.score >= 60
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.lowPE?.score
                            ? strategies.lowPE.score >= 80  
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.lowPE.score >= 60
                              ? "text-yellow-900 dark:text-yellow-100" 
                              : "text-red-900 dark:text-red-100"
                            : ""
                        }`}>Value Investing</span>
                        <Badge variant={strategies.lowPE?.isEligible ? "default" : "secondary"}>
                          {strategies.lowPE?.score?.toFixed(0) || 0}% dos critérios
                        </Badge>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <MarkdownRenderer content={strategies.lowPE?.reasoning || ''} />
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Critérios Anti-Value Trap:</h4>
                        {strategies.lowPE?.criteria?.map((criterion, index) => (
                          <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                            <div className="flex items-center space-x-2">
                              {criterion.value ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm">{criterion.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {criterion.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Magic Formula Analysis */}
              <Card className={
                isPremium && strategies.magicFormula?.score
                  ? strategies.magicFormula.score >= 80  
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.magicFormula.score >= 60 
                    ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                    : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : ""
              }>
                <Collapsible>
                  <CollapsibleTrigger className="w-full p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Crown className={`w-5 h-5 ${
                          isPremium && strategies.magicFormula?.score
                            ? strategies.magicFormula.score >= 80  
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.magicFormula.score >= 60 
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.magicFormula?.score
                            ? strategies.magicFormula.score >= 80  
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.magicFormula.score >= 60 
                              ? "text-yellow-900 dark:text-yellow-100" 
                              : "text-red-900 dark:text-red-100"
                            : ""
                        }`}>Fórmula Mágica (Greenblatt)</span>
                        <Badge variant={strategies.magicFormula?.isEligible ? "default" : "secondary"}>
                          {strategies.magicFormula?.score?.toFixed(0) || 0}% dos critérios
                        </Badge>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">ROIC</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatPercent(latestFinancials.roic)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">P/L</p>
                          <p className="text-2xl font-bold text-green-600">
                            {latestFinancials.pl ? parseFloat(latestFinancials.pl.toString()).toFixed(1) : 'N/A'}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Qualidade Operacional</p>
                          <div className="flex items-center justify-center space-x-2">
                            {strategies.magicFormula?.isEligible ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <p className={`text-lg font-bold ${
                              strategies.magicFormula?.isEligible ? 
                              'text-green-600' : 'text-red-600'
                            }`}>
                              {strategies.magicFormula?.isEligible ? 'Aprovada' : 'Reprovada'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <MarkdownRenderer content={strategies.magicFormula?.reasoning || ''} />
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Critérios da Fórmula Mágica:</h4>
                        {strategies.magicFormula?.criteria?.map((criterion, index) => (
                          <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                            <div className="flex items-center space-x-2">
                              {criterion.value ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm">{criterion.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {criterion.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Fundamentalist 3+1 Analysis */}
              <Card className={
                isPremium && strategies.fundamentalist?.score
                  ? strategies.fundamentalist.score >= 80  
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.fundamentalist.score >= 60 
                    ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                    : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : ""
              }>
                <Collapsible>
                  <CollapsibleTrigger className="w-full p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className={`w-5 h-5 ${
                          isPremium && strategies.fundamentalist?.score
                            ? strategies.fundamentalist.score >= 80  
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.fundamentalist.score >= 60 
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.fundamentalist?.score
                            ? strategies.fundamentalist.score >= 80  
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.fundamentalist.score >= 60 
                              ? "text-yellow-900 dark:text-yellow-100" 
                              : "text-red-900 dark:text-red-100"
                            : ""
                        }`}>Fundamentalista 3+1</span>
                        <Badge variant={strategies.fundamentalist?.isEligible ? "default" : "secondary"}>
                          {strategies.fundamentalist?.score?.toFixed(0) || 0}/100
                        </Badge>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">ROE</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatPercent(latestFinancials.roe)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">P/L</p>
                          <p className="text-2xl font-bold text-green-600">
                            {latestFinancials.pl ? parseFloat(latestFinancials.pl.toString()).toFixed(1) : 'N/A'}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Payout</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {formatPercent(latestFinancials.payout)}
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <MarkdownRenderer content={strategies.fundamentalist?.reasoning || ''} />
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Análise Adaptativa:</h4>
                        {strategies.fundamentalist?.criteria?.map((criterion, index) => (
                          <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                            <div className="flex items-center space-x-2">
                              {criterion.value ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm">{criterion.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {criterion.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Barsi Analysis */}
              <Card className={
                isPremium && strategies.barsi?.score
                  ? strategies.barsi.score >= 80 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.barsi.score >= 60
                    ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" 
                    : "bg-red-100 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  : ""
              }>
                <Collapsible>
                  <CollapsibleTrigger className="w-full p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <DollarSign className={`w-5 h-5 ${
                          isPremium && strategies.barsi?.score
                            ? strategies.barsi.score >= 80
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.barsi.score >= 60
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.barsi?.score
                            ? strategies.barsi.score >= 80
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.barsi.score >= 60
                              ? "text-yellow-900 dark:text-yellow-100" 
                              : "text-red-900 dark:text-red-100"
                            : ""
                        }`}>Método Barsi</span>
                        <Badge variant={strategies.barsi?.isEligible ? "default" : "secondary"}>
                          {(() => {
                            const criteriaInfo = getCriteriaPercentage(strategies.barsi);
                            return `${criteriaInfo.realPercentage.toFixed(0)}% dos critérios`;
                          })()}
                        </Badge>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Dividend Yield</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatPercent(latestFinancials.dy)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Preço Teto</p>
                          <p className="text-2xl font-bold text-green-600">
                            {strategies.barsi?.fairValue ? 
                              formatCurrency(strategies.barsi.fairValue) : 'N/A'
                            }
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Score Barsi</p>
                          <div className="flex items-center justify-center space-x-2">
                            {strategies.barsi?.isEligible ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <p className={`text-lg font-bold ${
                              strategies.barsi?.isEligible ? 
                              'text-green-600' : 'text-red-600'
                            }`}>
                              {strategies.barsi?.key_metrics?.barsiScore || 'N/A'}/100
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <MarkdownRenderer content={strategies.barsi?.reasoning || ''} />
                      </div>

                      {(() => {
                        const criteriaInfo = getCriteriaPercentage(strategies.barsi);
                        if (criteriaInfo.wasAdjusted) {
                          return (
                            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 flex items-start space-x-2">
                              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                  Score Ajustado
                                </p>
                                <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                                  A empresa atendeu {criteriaInfo.realPercentage.toFixed(0)}% dos critérios, mas o score foi ajustado para {criteriaInfo.adjustedScore?.toFixed(0)} devido ao upside insuficiente ({strategies.barsi?.upside?.toFixed(1)}%).
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="space-y-2">
                        <h4 className="font-medium">Os 5 Passos do Barsi:</h4>
                        {strategies.barsi?.criteria?.map((criterion, index) => (
                          <div key={index} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                            <div className="flex items-center space-x-2">
                              {criterion.value ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm">{criterion.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {criterion.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Demonstrações Tab */}
        <TabsContent value="statements" className="mt-6">
          {!isPremium ? (
            <div className="space-y-6">
              {/* Preview da Análise de Demonstrações */}
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="text-lg font-semibold">Análise Inteligente das Demonstrações</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Premium
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    IA analisa automaticamente DRE, Balanço e Fluxo de Caixa de todos os anos disponíveis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Preview do Score */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6 opacity-60">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white rounded-full shadow-sm">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Score de Qualidade</p>
                        <p className="text-xs text-gray-500">Baseado em 20+ indicadores</p>
                      </div>
                    </div>
                    <div className="text-right relative">
                      <p className="text-2xl font-bold text-blue-600 blur-sm">XX</p>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Crown className="w-6 h-6 text-orange-600" />
                      </div>
                      <p className="text-xs text-gray-500">de 100</p>
                    </div>
                  </div>

                  {/* Preview dos Alertas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 opacity-60">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Pontos Fortes</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-green-800 blur-sm">Crescimento consistente de receitas</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-green-800 blur-sm">Margens estáveis nos últimos anos</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span className="font-medium text-red-800">Alertas</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-red-800 blur-sm">Aumento do endividamento</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-red-800 blur-sm">Queda na geração de caixa</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA de Conversão */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-lg border border-blue-200 text-center">
                    <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Desbloqueie a Análise Completa
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-200 mb-4">
                      IA examina automaticamente anos de demonstrações financeiras e detecta red flags e oportunidades
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                        <Link href={isLoggedIn ? "/checkout" : "/register"}>
                          <Crown className="w-4 h-4 mr-2" />
                          {isLoggedIn ? "Assinar Premium" : "Cadastre-se para Ver"}
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/planos">
                          Ver exemplo completo
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              {typedAnalysisData?.overallScore?.statementsAnalysis ? (
                <StatementsAnalysisContent analysis={typedAnalysisData.overallScore.statementsAnalysis} />
              ) : (
                <Card className="border-gray-200 bg-gray-50/30">
                  <CardContent className="p-6 text-center">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium mb-2">Análise não disponível</p>
                    <p className="text-sm text-gray-500">
                      Dados insuficientes para realizar a análise das demonstrações financeiras.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resumo dos Preços Justos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="w-5 h-5" />
                  <span>Resumo dos Preços Justos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">Preço Atual</span>
                    <span className="text-lg font-bold">{formatCurrency(currentPrice)}</span>
                  </div>
                  
                  {/* Graham */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium">Graham</span>
                      {!isLoggedIn && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Gratuito
                        </Badge>
                      )}
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      {isLoggedIn && strategies.graham?.fairValue 
                        ? formatCurrency(strategies.graham.fairValue)
                        : !isLoggedIn ? '🔒 Login' : 'N/A'
                      }
                    </span>
                  </div>

                  {/* FCD */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium">Fluxo de Caixa Descontado (FCD)</span>
                      {!isPremium && <Crown className="w-3 h-3 ml-1 inline text-yellow-500" />}
                    </div>
                    <span className="text-lg font-bold text-purple-600">
                      {isPremium && strategies.fcd?.fairValue 
                        ? formatCurrency(strategies.fcd.fairValue)
                        : !isPremium ? '🔒 Premium' : 'N/A'
                      }
                    </span>
                  </div>

                  {/* Gordon */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium">Fórmula de Gordon</span>
                      {!isPremium && <Crown className="w-3 h-3 ml-1 inline text-yellow-500" />}
                    </div>
                    <span className="text-lg font-bold text-orange-600">
                      {isPremium && strategies.gordon?.fairValue 
                        ? formatCurrency(strategies.gordon.fairValue)
                        : !isPremium ? '🔒 Premium' : 'N/A'
                      }
                    </span>
                  </div>

                  {/* Barsi */}
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium">Método Barsi (Preço Teto)</span>
                      {!isPremium && <Crown className="w-3 h-3 ml-1 inline text-yellow-500" />}
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {isPremium && strategies.barsi?.fairValue 
                        ? formatCurrency(strategies.barsi.fairValue)
                        : !isPremium ? '🔒 Premium' : 'N/A'
                      }
                    </span>
                  </div>

                  {/* Análise Técnica - Preços da IA */}
                  <TechnicalAnalysisPrices ticker={ticker} isPremium={isPremium!} />
                </div>
              </CardContent>
            </Card>

            {/* Status das Estratégias */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Qualificação por Estratégia</span>
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground mt-2">
                  % de critérios atendidos • ≥80% = Confiável • &lt;80% = Reprovada
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Graham Status */}
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    isLoggedIn && strategies.graham?.score 
                      ? !strategies.graham?.isEligible
                        ? "bg-yellow-100 dark:bg-yellow-950/30"
                        : strategies.graham.score >= 80
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.graham.score >= 60
                        ? "bg-yellow-100 dark:bg-yellow-950/30" 
                        : "bg-red-100 dark:bg-red-950/30"
                      : "bg-muted/50"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Benjamin Graham</span>
                      {isLoggedIn && strategies.graham?.score && strategies.graham.score < 70 && (
                        <span className="text-xs text-red-600 font-medium">Reprovada</span>
                      )}
                    </div>
                    <Badge variant={
                      isLoggedIn && strategies.graham?.score && strategies.graham.score >= 80 
                        ? "default" 
                        : isLoggedIn && strategies.graham?.score && strategies.graham.score < 70
                        ? "destructive"
                        : "secondary"
                    }>
                      {isLoggedIn ? `${strategies.graham?.score?.toFixed(0) || 0}%` : 'Login'}
                    </Badge>
                  </div>

                  {/* FCD Status */}
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    isPremium && strategies.fcd?.score 
                      ? !strategies.fcd?.isEligible
                        ? "bg-yellow-100 dark:bg-yellow-950/30"
                        : strategies.fcd.score >= 80
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.fcd.score >= 60 
                        ? "bg-yellow-100 dark:bg-yellow-950/30" 
                        : "bg-red-100 dark:bg-red-950/30"
                      : "bg-muted/50"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Fluxo de Caixa Descontado (FCD)</span>
                      {isPremium && strategies.fcd?.score && strategies.fcd.score < 70 && (
                        <span className="text-xs text-red-600 font-medium">Reprovada</span>
                      )}
                    </div>
                    <Badge variant={
                      isPremium && strategies.fcd?.score && strategies.fcd.score >= 80 
                        ? "default" 
                        : isPremium && strategies.fcd?.score && strategies.fcd.score < 70
                        ? "destructive"
                        : "secondary"
                    }>
                      {isPremium ? `${strategies.fcd?.score?.toFixed(0) || 0}%` : 'Premium'}
                    </Badge>
                  </div>

                  {/* Gordon Status */}
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    isPremium && strategies.gordon?.score 
                      ? !strategies.gordon?.isEligible
                        ? "bg-yellow-100 dark:bg-yellow-950/30"
                        : strategies.gordon.score >= 80
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.gordon.score >= 60 
                        ? "bg-yellow-100 dark:bg-yellow-950/30" 
                        : "bg-red-100 dark:bg-red-950/30"
                      : "bg-muted/50"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Fórmula de Gordon</span>
                      {isPremium && strategies.gordon?.score && strategies.gordon.score < 70 && (
                        <span className="text-xs text-red-600 font-medium">Reprovada</span>
                      )}
                    </div>
                    <Badge variant={
                      isPremium && strategies.gordon?.score && strategies.gordon.score >= 80 
                        ? "default" 
                        : isPremium && strategies.gordon?.score && strategies.gordon.score < 70
                        ? "destructive"
                        : "secondary"
                    }>
                      {isPremium ? `${strategies.gordon?.score?.toFixed(0) || 0}%` : 'Premium'}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    isPremium && strategies.dividendYield?.score 
                      ? strategies.dividendYield.score >= 80
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.dividendYield.score >= 60 
                        ? "bg-yellow-100 dark:bg-yellow-950/30" 
                        : "bg-red-100 dark:bg-red-950/30"
                      : "bg-muted/50"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Dividend Yield</span>
                      {isPremium && strategies.dividendYield?.score && strategies.dividendYield.score < 70 && (
                        <span className="text-xs text-red-600 font-medium">Reprovada</span>
                      )}
                    </div>
                    <Badge variant={
                      isPremium && strategies.dividendYield?.score && strategies.dividendYield.score >= 80 
                        ? "default" 
                        : isPremium && strategies.dividendYield?.score && strategies.dividendYield.score < 70
                        ? "destructive"
                        : "secondary"
                    }>
                      {isPremium ? `${strategies.dividendYield?.score?.toFixed(0) || 0}%` : 'Premium'}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    isPremium && strategies.lowPE?.score 
                      ? strategies.lowPE.score >= 80 
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.lowPE.score >= 60 
                        ? "bg-yellow-100 dark:bg-yellow-950/30" 
                        : "bg-red-100 dark:bg-red-950/30"
                      : "bg-muted/50"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Value Investing</span>
                      {isPremium && strategies.lowPE?.score && strategies.lowPE.score < 70 && (
                        <span className="text-xs text-red-600 font-medium">Reprovada</span>
                      )}
                    </div>
                    <Badge variant={
                      isPremium && strategies.lowPE?.score && strategies.lowPE.score >= 80 
                        ? "default" 
                        : isPremium && strategies.lowPE?.score && strategies.lowPE.score < 70
                        ? "destructive"
                        : "secondary"
                    }>
                      {isPremium ? `${strategies.lowPE?.score?.toFixed(0) || 0}%` : 'Premium'}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    isPremium && strategies.magicFormula?.score 
                      ? strategies.magicFormula.score >= 80
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.magicFormula.score >= 60 
                        ? "bg-yellow-100 dark:bg-yellow-950/30" 
                        : "bg-red-100 dark:bg-red-950/30"
                      : "bg-muted/50"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Fórmula Mágica</span>
                      {isPremium && strategies.magicFormula?.score && strategies.magicFormula.score < 70 && (
                        <span className="text-xs text-red-600 font-medium">Reprovada</span>
                      )}
                    </div>
                    <Badge variant={
                      isPremium && strategies.magicFormula?.score && strategies.magicFormula.score >= 80 
                        ? "default" 
                        : isPremium && strategies.magicFormula?.score && strategies.magicFormula.score < 70
                        ? "destructive"
                        : "secondary"
                    }>
                      {isPremium ? `${strategies.magicFormula?.score?.toFixed(0) || 0}%` : 'Premium'}
                    </Badge>
                  </div>

                  {/* Fundamentalist 3+1 Status */}
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    isPremium && strategies.fundamentalist?.score 
                      ? strategies.fundamentalist.score >= 80
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.fundamentalist.score >= 60 
                        ? "bg-yellow-100 dark:bg-yellow-950/30" 
                        : "bg-red-100 dark:bg-red-950/30"
                      : "bg-muted/50"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Fundamentalista 3+1</span>
                      {isPremium && strategies.fundamentalist?.score && strategies.fundamentalist.score < 70 && (
                        <span className="text-xs text-red-600 font-medium">Reprovada</span>
                      )}
                    </div>
                    <Badge variant={
                      isPremium && strategies.fundamentalist?.score && strategies.fundamentalist.score >= 80 
                        ? "default" 
                        : isPremium && strategies.fundamentalist?.score && strategies.fundamentalist.score < 70
                        ? "destructive"
                        : "secondary"
                    }>
                      {isPremium ? `${strategies.fundamentalist?.score?.toFixed(0) || 0}/100` : 'Premium'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
