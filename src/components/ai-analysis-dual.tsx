'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, 
  Brain, 
  Sparkles, 
  AlertCircle, 
  Crown, 
  Lock, 
  TrendingUp,
  FileText,
  Calendar
} from 'lucide-react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { AIReportFeedback } from '@/components/ai-report-feedback'

interface AIReport {
  id: string
  type: 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE'
  content: string
  changeDirection?: 'positive' | 'negative'
  previousScore?: number
  currentScore?: number
  strategicAnalyses?: Record<string, any>
  likeCount: number
  dislikeCount: number
  createdAt: string
  isActive: boolean
  status: 'GENERATING' | 'COMPLETED' | 'FAILED'
}

interface AIAnalysisDualProps {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  financials: Record<string, unknown>
  userIsPremium?: boolean
  companyId: number
}

export default function AIAnalysisDual({ 
  ticker, 
  name, 
  sector, 
  currentPrice, 
  financials,
  userIsPremium = false,
  companyId: _companyId
}: AIAnalysisDualProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [monthlyReport, setMonthlyReport] = useState<AIReport | null>(null)
  const [changeReports, setChangeReports] = useState<AIReport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'monthly' | 'changes'>('monthly')

  // Carregar relatórios ao montar o componente
  useEffect(() => {
    loadReports()
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReports = async () => {
    try {
      setIsLoading(true)
      
      // Buscar relatório mensal
      const monthlyResponse = await fetch(`/api/ai-reports/${ticker}?type=MONTHLY_OVERVIEW`)
      if (monthlyResponse.ok) {
        const monthlyData = await monthlyResponse.json()
        if (monthlyData.success && monthlyData.report) {
          setMonthlyReport(monthlyData.report)
        }
      }

      // Buscar relatórios de mudança
      const changesResponse = await fetch(`/api/ai-reports/${ticker}?type=FUNDAMENTAL_CHANGE&limit=5`)
      if (changesResponse.ok) {
        const changesData = await changesResponse.json()
        if (changesData.success && changesData.reports) {
          setChangeReports(changesData.reports)
        }
      }

    } catch (err) {
      console.error('Erro ao carregar relatórios:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
    } finally {
      setIsLoading(false)
    }
  }

  const generateMonthlyReport = async () => {
    if (!userIsPremium) {
      setError('Análise por IA disponível apenas para usuários Premium')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/ai-reports/${ticker}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'MONTHLY_OVERVIEW',
          name,
          sector,
          currentPrice,
          financials,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar análise')
      }

      const data = await response.json()
      if (data.success && data.report) {
        setMonthlyReport(data.report)
      }

    } catch (err) {
      console.error('Erro ao gerar análise:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  const renderReport = (report: AIReport) => {
    // Converter scores para número para evitar erros com toFixed()
    const previousScore = report.previousScore ? Number(report.previousScore) : null
    const currentScore = report.currentScore ? Number(report.currentScore) : null
    
    return (
      <div>
        {/* Header do Relatório */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {report.type === 'FUNDAMENTAL_CHANGE' ? (
              <>
                <TrendingUp className={`w-5 h-5 ${report.changeDirection === 'positive' ? 'text-green-600' : 'text-red-600'}`} />
                <div>
                  <h3 className="font-semibold">Mudança Fundamental</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                    {previousScore !== null && currentScore !== null && (
                      <Badge variant={report.changeDirection === 'positive' ? 'default' : 'destructive'} className="ml-2">
                        {previousScore.toFixed(1)} → {currentScore.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <Brain className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-semibold">Análise Mensal</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </>
            )}
          </div>
          
          <Badge variant="secondary">Gemini AI</Badge>
        </div>

        {/* Conteúdo do Relatório */}
        <div className="prose prose-gray dark:prose-invert max-w-none mb-6">
          <MarkdownRenderer content={report.content} />
        </div>

        {/* Feedback e Estatísticas */}
        <AIReportFeedback
          reportId={report.id}
          ticker={ticker}
          initialLikeCount={report.likeCount}
          initialDislikeCount={report.dislikeCount}
        />
      </div>
    )
  }

  const renderChangeReportsList = () => {
    if (changeReports.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma mudança detectada</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Ainda não foram detectadas mudanças fundamentais significativas neste ativo.
            Quando o sistema detectar mudanças relevantes, elas aparecerão aqui.
          </p>
          {userIsPremium && (
            <Link href="/dashboard/subscriptions">
              <Button variant="outline" className="mt-4">
                <Sparkles className="w-4 h-4 mr-2" />
                Gerenciar Inscrições
              </Button>
            </Link>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {changeReports.map((report) => (
          <div key={report.id} className="border rounded-lg p-4">
            {renderReport(report)}
            {report.id && (
              <Link href={`/acao/${ticker.toLowerCase()}/relatorios/${report.id}`}>
                <Button variant="outline" className="w-full mt-4">
                  Ver Relatório Completo
                </Button>
              </Link>
            )}
          </div>
        ))}
        <Link href={`/acao/${ticker.toLowerCase()}/relatorios`}>
          <Button variant="ghost" className="w-full">
            Ver Histórico Completo
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-3">
          <Brain className="w-6 h-6 text-purple-600" />
          <span>Análise com Inteligência Artificial</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'monthly' | 'changes')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Análise Mensal
              {monthlyReport && <Badge variant="secondary" className="ml-1 text-xs">1</Badge>}
            </TabsTrigger>
            <TabsTrigger value="changes" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Mudanças Fundamentais
              {changeReports.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{changeReports.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Análise Mensal */}
          <TabsContent value="monthly">
            {isLoading && activeTab === 'monthly' ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Gerando análise mensal...</h3>
                <p className="text-muted-foreground">
                  Nossa IA está analisando {name} com todos os dados disponíveis.
                </p>
              </div>
            ) : monthlyReport ? (
              renderReport(monthlyReport)
            ) : (
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-purple-600 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2 flex items-center justify-center">
                  Análise Fundamentalista com IA
                  <Crown className="w-5 h-5 ml-2 text-yellow-500" />
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Nossa IA irá analisar {name} ({ticker}) usando múltiplos modelos de valuation, 
                  indicadores fundamentalistas e análise de demonstrativos financeiros.
                </p>
                
                {userIsPremium ? (
                  <Button 
                    onClick={generateMonthlyReport}
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Gerar Análise Mensal
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <Lock className="w-5 h-5 text-yellow-600" />
                        <span className="font-medium text-yellow-800 dark:text-yellow-200">
                          Recurso Premium
                        </span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
                        A análise por IA está disponível apenas para usuários Premium.
                      </p>
                    </div>
                    <Button asChild size="lg" className="bg-gradient-to-r from-yellow-400 to-yellow-500">
                      <Link href="/checkout">
                        <Crown className="w-5 h-5 mr-2" />
                        Fazer Upgrade Premium
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Tab: Mudanças Fundamentais */}
          <TabsContent value="changes">
            {isLoading && activeTab === 'changes' ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Carregando relatórios de mudanças...</p>
              </div>
            ) : (
              renderChangeReportsList()
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

