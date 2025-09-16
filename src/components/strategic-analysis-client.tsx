'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
  DollarSign
} from 'lucide-react';

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

// Interface para score geral
interface OverallScore {
  score: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Muito Fraco';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Compra Forte' | 'Compra' | 'Neutro' | 'Venda' | 'Venda Forte';
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
  };
}

interface Props {
  ticker: string;
  currentPrice: number;
  latestFinancials: Record<string, unknown>;
}

// Função para formatar valores como moeda
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Função para formatar valores como percentual
function formatPercent(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return 'N/A';
  return `${(numValue * 100).toFixed(2)}%`;
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

// Componente inline para upgrade premium
function PremiumUpgrade({ strategy }: { strategy: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 rounded-lg">
      <div className="mb-6">
        <Crown className="w-16 h-16 text-orange-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Recurso Premium
        </h3>
        <p className="text-muted-foreground">
          A análise <strong>{strategy}</strong> está disponível para assinantes Premium
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6 max-w-md">
        <h4 className="font-semibold mb-4 flex items-center">
          <Crown className="w-5 h-5 text-orange-600 mr-2" />
          Premium inclui:
        </h4>
        <div className="space-y-3 text-left">
          <div className="flex items-center space-x-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <span className="text-sm text-orange-800 dark:text-orange-200">
              Anti-Dividend Trap
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span className="text-sm text-purple-800 dark:text-purple-200">
              Value Investing Completo
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Fórmula Mágica de Greenblatt
            </span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Rankings ilimitados
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg" className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
          <Link href="/premium">
            <Crown className="w-4 h-4 mr-2" />
            Assinar Premium
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/pricing">
            Ver planos
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function StrategicAnalysisClient({ ticker, currentPrice, latestFinancials }: Props) {
  const { data: session } = useSession();
  const [analysisData, setAnalysisData] = useState<CompanyAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = !!session?.user;
  const isPremium = session?.user?.subscriptionTier === 'PREMIUM';

  // Buscar análises estratégicas
  useEffect(() => {
    async function fetchStrategicAnalysis() {
      if (!ticker) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/company-analysis/${ticker}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao buscar análises');
        }

        const data = await response.json();
        setAnalysisData(data);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar análises estratégicas:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    }

    fetchStrategicAnalysis();
  }, [ticker]);

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
          <Zap className="w-6 h-6" />
          <span>Análises de Investimento</span>
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
          <span>Análises de Investimento</span>
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

  const { strategies } = analysisData;

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
        <Zap className="w-6 h-6" />
        <span>Análises de Investimento</span>
      </h2>

      <Tabs defaultValue="fair-value" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="fair-value" className="flex items-center space-x-2">
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">Preço Justo</span>
            {!isLoggedIn && <Crown className="w-3 h-3 ml-1" />}
          </TabsTrigger>
          
          <TabsTrigger value="strategies" className="flex items-center space-x-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Estratégias</span>
            {!isPremium && <Crown className="w-3 h-3 ml-1 text-yellow-500" />}
          </TabsTrigger>
          
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
        </TabsList>

        {/* Preço Justo Tab */}
        <TabsContent value="fair-value" className="mt-6">
          {!isLoggedIn ? (
            <RegisterPrompt strategy="Cálculos de Preço Justo" />
          ) : (
            <div className="space-y-6">
              {/* Graham Analysis */}
              <Card className={
                isLoggedIn && strategies.graham?.score
                  ? !strategies.graham?.isEligible
                    ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                    : strategies.graham.score === 100 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.graham.score >= 70 
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
                              : strategies.graham.score === 100 
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.graham.score >= 70 
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isLoggedIn && strategies.graham?.score
                            ? !strategies.graham?.isEligible
                              ? "text-yellow-900 dark:text-yellow-100"
                              : strategies.graham.score === 100 
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.graham.score >= 70 
                              ? "text-yellow-900 dark:text-yellow-100" 
                              : "text-red-900 dark:text-red-100"
                            : ""
                        }`}>Benjamin Graham</span>
                        <Badge variant={strategies.graham?.isEligible ? "default" : "secondary"}>
                          {strategies.graham?.score?.toFixed(0) || 0}% dos critérios
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

              {/* FCD Analysis - Requires Premium */}
              {!isPremium ? (
                <PremiumUpgrade strategy="Fluxo de Caixa Descontado" />
              ) : (
                <Card className={
                  isPremium && strategies.fcd?.score
                    ? !strategies.fcd?.isEligible
                      ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                      : strategies.fcd.score === 100 
                      ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : strategies.fcd.score >= 70 
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
                                : strategies.fcd.score === 100 
                                ? "text-green-700 dark:text-green-400" 
                                : strategies.fcd.score >= 70 
                                ? "text-yellow-700 dark:text-yellow-400" 
                                : "text-red-700 dark:text-red-400"
                              : "text-purple-600"
                          }`} />
                          <span className={`text-lg font-semibold ${
                            isPremium && strategies.fcd?.score
                              ? !strategies.fcd?.isEligible
                                ? "text-yellow-900 dark:text-yellow-100"
                                : strategies.fcd.score === 100 
                                ? "text-green-900 dark:text-green-100" 
                                : strategies.fcd.score >= 70 
                                ? "text-yellow-900 dark:text-yellow-100" 
                                : "text-red-900 dark:text-red-100"
                              : ""
                          }`}>Fluxo de Caixa Descontado (FCD)</span>
                          <Badge variant={strategies.fcd?.isEligible ? "default" : "secondary"}>
                            {strategies.fcd?.score?.toFixed(0) || 0}% dos critérios
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

              {/* Gordon Analysis - Requires Premium */}
              {!isPremium ? (
                <PremiumUpgrade strategy="Fórmula de Gordon (Método dos Dividendos)" />
              ) : (
                <Card className={
                  isPremium && strategies.gordon?.score
                    ? !strategies.gordon?.isEligible
                      ? "bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                      : strategies.gordon.score === 100 
                      ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : strategies.gordon.score >= 70 
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
                                : strategies.gordon.score === 100 
                                ? "text-green-700 dark:text-green-400" 
                                : strategies.gordon.score >= 70 
                                ? "text-yellow-700 dark:text-yellow-400" 
                                : "text-red-700 dark:text-red-400"
                              : "text-orange-600"
                          }`} />
                          <span className={`text-lg font-semibold ${
                            isPremium && strategies.gordon?.score
                              ? !strategies.gordon?.isEligible
                                ? "text-yellow-900 dark:text-yellow-100"
                                : strategies.gordon.score === 100 
                                ? "text-green-900 dark:text-green-100" 
                                : strategies.gordon.score >= 70 
                                ? "text-yellow-900 dark:text-yellow-100" 
                                : "text-red-900 dark:text-red-100"
                              : ""
                          }`}>Fórmula de Gordon (Método dos Dividendos)</span>
                          <Badge variant={strategies.gordon?.isEligible ? "default" : "secondary"}>
                            {strategies.gordon?.score?.toFixed(0) || 0}% dos critérios
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
            </div>
          )}
        </TabsContent>

        {/* Strategies Tab */}
        <TabsContent value="strategies" className="mt-6">
          {!isPremium ? (
            !isLoggedIn ? (
              <RegisterPrompt strategy="Estratégias Premium" />
            ) : (
              <PremiumUpgrade strategy="Estratégias Premium" />
            )
          ) : (
            <div className="space-y-6">
              {/* Dividend Yield Analysis */}
              <Card className={
                isPremium && strategies.dividendYield?.score
                  ? strategies.dividendYield.score === 100 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.dividendYield.score >= 70 
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
                            ? strategies.dividendYield.score === 100 
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.dividendYield.score >= 70 
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.dividendYield?.score
                            ? strategies.dividendYield.score === 100 
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.dividendYield.score >= 70 
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
                  ? strategies.lowPE.score === 100 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.lowPE.score >= 70 
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
                            ? strategies.lowPE.score === 100 
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.lowPE.score >= 70 
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.lowPE?.score
                            ? strategies.lowPE.score === 100 
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.lowPE.score >= 70 
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
                  ? strategies.magicFormula.score === 100 
                    ? "bg-green-100 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                    : strategies.magicFormula.score >= 70 
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
                            ? strategies.magicFormula.score === 100 
                              ? "text-green-700 dark:text-green-400" 
                              : strategies.magicFormula.score >= 70 
                              ? "text-yellow-700 dark:text-yellow-400" 
                              : "text-red-700 dark:text-red-400"
                            : ""
                        }`} />
                        <span className={`text-lg font-semibold ${
                          isPremium && strategies.magicFormula?.score
                            ? strategies.magicFormula.score === 100 
                              ? "text-green-900 dark:text-green-100" 
                              : strategies.magicFormula.score >= 70 
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
                      {!isLoggedIn && <Crown className="w-3 h-3 ml-1 inline text-gray-400" />}
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
                        : strategies.graham.score === 100 
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.graham.score >= 70 
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
                        : strategies.fcd.score === 100 
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.fcd.score >= 70 
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
                        : strategies.gordon.score === 100 
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.gordon.score >= 70 
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
                      ? strategies.dividendYield.score === 100 
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.dividendYield.score >= 70 
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
                      ? strategies.lowPE.score === 100 
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.lowPE.score >= 70 
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
                      ? strategies.magicFormula.score === 100 
                        ? "bg-green-100 dark:bg-green-950/30" 
                        : strategies.magicFormula.score >= 70 
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
