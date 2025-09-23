'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Brain, Sparkles, AlertCircle, CheckCircle2, Crown, Lock, ThumbsUp, ThumbsDown, History } from 'lucide-react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { AIReportsService, AIReportData } from '@/lib/ai-reports-service'
import Link from 'next/link'

interface StrategicAnalysisResult {
  fairValue?: number | null
  upside?: number | null
  eligible?: boolean
  score?: number
  currentYield?: number | null
  currentPE?: number | null
  error?: string
}

interface AIAnalysisProps {
  ticker: string
  name: string
  sector: string | null
  currentPrice: number
  financials: Record<string, unknown>
  userIsPremium?: boolean
}


export default function AIAnalysis({ 
  ticker, 
  name, 
  sector, 
  currentPrice, 
  financials,
  userIsPremium = false
}: AIAnalysisProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [strategicAnalyses, setStrategicAnalyses] = useState<Record<string, StrategicAnalysisResult> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewAttempts, setReviewAttempts] = useState(0)
  const [currentReport, setCurrentReport] = useState<AIReportData | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [reportHistory, setReportHistory] = useState<AIReportData[]>([])
  const [userFeedback, setUserFeedback] = useState<'LIKE' | 'DISLIKE' | null>(null)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)

  // Carregar relatório existente ao montar o componente
  useEffect(() => {
    loadExistingReport()
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExistingReport = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/ai-reports/${ticker}`)
      
      if (response.ok) {
        const data = await response.json()
        
        // Se está sendo gerado, mostrar estado de carregamento
        if (data.generating) {
          setAutoGenerating(true)
          setIsLoading(true)
          // Aguardar um pouco e tentar novamente
          setTimeout(() => {
            loadExistingReport()
          }, 3000)
          return
        }
        
        if (data.success && data.report) {
          setCurrentReport(data.report)
          setAnalysis(data.report.content)
          setStrategicAnalyses(data.report.strategicAnalyses || null)
          setIsPreview(data.report.isPreview || false)
          setUserFeedback(data.report.userFeedback?.type || null)
          setFeedbackComment(data.report.userFeedback?.comment || '')
          
          // Para usuários Premium, verificar se precisa regenerar
          if (userIsPremium && data.report && AIReportsService.needsRegeneration(data.report)) {
            setError('Este relatório tem mais de 30 dias. Recomendamos gerar uma nova análise.')
          }
        } else {
          // Se não há relatório e usuário é Premium, gerar automaticamente
          if (userIsPremium) {
            console.log('🤖 Nenhum relatório encontrado para usuário Premium. Gerando automaticamente...')
            setAutoGenerating(true)
            await generateAnalysis(false)
          }
        }
      } else if (response.status === 404) {
        // Relatório não encontrado - gerar automaticamente para Premium
        if (userIsPremium) {
          console.log('🤖 Nenhum relatório encontrado para usuário Premium. Gerando automaticamente...')
          setAutoGenerating(true)
          await generateAnalysis(false)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar relatório:', err)
      // Em caso de erro, se for Premium, tentar gerar automaticamente
      if (userIsPremium) {
        console.log('🤖 Erro ao carregar relatório. Tentando gerar automaticamente para usuário Premium...')
        setAutoGenerating(true)
        await generateAnalysis(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const generateAnalysis = async (forceRegenerate = false) => {
    // Verificar se o usuário é premium
    if (!userIsPremium) {
      setError('Análise por IA disponível apenas para usuários Premium')
      return
    }

    setIsLoading(true)
    setError(null)
    setReviewAttempts(0)

    try {
      // Usar a nova API de geração controlada
      const response = await fetch(`/api/ai-reports/${ticker}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          sector,
          currentPrice,
          financials,
          forceRegenerate
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.generating) {
          // Já está sendo gerado, aguardar
          setAutoGenerating(true)
          setTimeout(() => {
            loadExistingReport()
          }, 3000)
          return
        }
        throw new Error(data.error || 'Erro ao gerar análise')
      }

      if (data.success && data.report) {
        setCurrentReport(data.report)
        setAnalysis(data.report.content)
        setStrategicAnalyses(data.report.strategicAnalyses || null)
        setIsPreview(false)
        setUserFeedback(null)
        setFeedbackComment('')
      } else {
        throw new Error('Resposta inválida da API')
      }

    } catch (err) {
      console.error('Erro ao gerar análise:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
      setAutoGenerating(false)
    }
  }

  const handleFeedback = async (type: 'LIKE' | 'DISLIKE') => {
    if (!currentReport || !userIsPremium) return

    try {
      const response = await fetch(`/api/ai-reports/${ticker}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: currentReport.id,
          type,
          comment: feedbackComment.trim() || undefined
        }),
      })

      if (response.ok) {
        setUserFeedback(type)
        setShowFeedbackForm(false)
        setFeedbackComment('')
        
        // Atualizar contadores localmente para feedback imediato
        if (currentReport) {
          const updatedReport = { ...currentReport }
          
          // Se havia feedback anterior, remover da contagem
          if (userFeedback === 'LIKE') {
            updatedReport.likeCount = Math.max(0, updatedReport.likeCount - 1)
          } else if (userFeedback === 'DISLIKE') {
            updatedReport.dislikeCount = Math.max(0, updatedReport.dislikeCount - 1)
          }
          
          // Adicionar novo feedback
          if (type === 'LIKE') {
            updatedReport.likeCount += 1
          } else {
            updatedReport.dislikeCount += 1
          }
          
          setCurrentReport(updatedReport)
        }
        
        // Recarregar relatório para sincronizar com servidor
        setTimeout(() => {
          loadExistingReport()
        }, 1000)
      }
    } catch (error) {
      console.error('Erro ao enviar feedback:', error)
    }
  }

  const loadHistory = async () => {
    if (!userIsPremium) return

    try {
      const response = await fetch(`/api/ai-reports/${ticker}/history`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setReportHistory(data.reports)
          setShowHistory(true)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    }
  }

  const renderStrategicAnalyses = () => {
    if (!strategicAnalyses) return null

    const strategyLabels: Record<string, string> = {
      graham: 'Graham',
      dividendYield: 'Dividend Yield',
      lowPE: 'Baixo P/L',
      magicFormula: 'Fórmula Mágica'
    }

    const getStrategyStatus = (result: StrategicAnalysisResult) => {
      if (result.error) return 'error'
      return result.eligible ? 'success' : 'warning'
    }

    const getStrategyIcon = (status: string) => {
      switch (status) {
        case 'success': return <CheckCircle2 className="w-4 h-4 text-green-600" />
        case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />
        case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />
        default: return <AlertCircle className="w-4 h-4 text-gray-600" />
      }
    }

    const getStrategyDescription = (strategy: string, result: StrategicAnalysisResult) => {
      if (result.error) return result.error

      switch (strategy) {
        case 'graham':
          return result.fairValue 
            ? `Preço Justo: R$ ${result.fairValue.toFixed(2)}`
            : 'Dados insuficientes'
        case 'dividendYield':
          return result.currentYield 
            ? `DY Atual: ${(result.currentYield * 100).toFixed(2)}%`
            : 'Dados insuficientes'
        case 'lowPE':
          return result.currentPE 
            ? `P/L Atual: ${result.currentPE.toFixed(1)}`
            : 'Dados insuficientes'
        case 'magicFormula':
          return result.score 
            ? `Score: ${result.score.toFixed(1)}`
            : 'Dados insuficientes'
        default:
          return 'Análise realizada'
      }
    }

    return (
      <div className="mb-6">
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center">
          <Sparkles className="w-4 h-4 mr-2" />
          Análises Estratégicas Aplicadas
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(strategicAnalyses).map(([strategy, result]) => {
            const status = getStrategyStatus(result)
            const label = strategyLabels[strategy] || strategy
            const description = getStrategyDescription(strategy, result)

            return (
              <div key={strategy} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStrategyIcon(status)}
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Badge 
                  variant={status === 'success' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {result.eligible ? 'Elegível' : result.error ? 'Erro' : 'Filtrado'}
                </Badge>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-3">
          <Brain className="w-6 h-6 text-purple-600" />
          <span>Análise com Inteligência Artificial</span>
          <Badge variant="secondary" className="ml-auto">
            Gemini AI
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Botão para gerar análise - apenas se não há análise */}
        {!analysis && !isLoading && (
          <div className="text-center py-8">
            <Brain className="w-16 h-16 text-purple-600 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2 flex items-center justify-center">
              Análise Fundamentalista com IA
              <Crown className="w-5 h-5 ml-2 text-yellow-500" />
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Nossa IA irá analisar {name} ({ticker}) usando múltiplos modelos de valuation, 
              indicadores fundamentalistas, análise de demonstrativos financeiros e informações recentes da internet.
            </p>
            
            {userIsPremium ? (
              <Button 
                onClick={() => generateAnalysis(false)}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Gerar Análise com IA
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
                    A análise por IA com demonstrativos financeiros está disponível apenas para usuários Premium.
                  </p>
                </div>
                <Button asChild size="lg" className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white">
                  <Link href="/checkout">
                    <Crown className="w-5 h-5 mr-2" />
                    Fazer Upgrade Premium
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Estado de carregamento */}
        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {autoGenerating ? 'Gerando análise automaticamente...' : 'Gerando análise...'} {reviewAttempts > 0 && `(Tentativa ${reviewAttempts}/3)`}
            </h3>
            <p className="text-muted-foreground">
              {autoGenerating 
                ? `Como usuário Premium, estamos gerando automaticamente a análise de ${name} para você.`
                : `Nossa IA está analisando ${name} com demonstrativos financeiros e buscando informações recentes na internet.`
              } Isso pode levar alguns segundos.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                <span>Analisando indicadores financeiros</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-75"></div>
                <span>Analisando demonstrativos financeiros</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-150"></div>
                <span>Aplicando modelos de valuation</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-200"></div>
                <span>Buscando notícias recentes</span>
              </div>
              {autoGenerating && (
                <div className="flex items-center justify-center space-x-2 mt-4 p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse delay-300"></div>
                  <span className="text-green-700 dark:text-green-300">🤖 Geração automática para usuário Premium</span>
                </div>
              )}
              {reviewAttempts > 0 && (
                <div className="flex items-center justify-center space-x-2 mt-4 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-300"></div>
                  <span className="text-blue-700 dark:text-blue-300">Revisando qualidade do relatório...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2 text-red-600">
              Erro ao gerar análise
            </h3>
            <p className="text-muted-foreground mb-6">
              {error}
            </p>
            <Button 
              onClick={() => generateAnalysis(false)}
              variant="outline"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Análise gerada */}
        {analysis && (
          <div>
            {/* Análises estratégicas resumo */}
            {renderStrategicAnalyses()}

            {/* Análise detalhada da IA */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-600" />
                  Análise Detalhada
                  {isPreview && (
                    <Badge variant="secondary" className="ml-2">
                      Preview
                    </Badge>
                  )}
                  {currentReport && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(currentReport.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </h3>
                <div className="flex items-center space-x-2">
                  {userIsPremium && (
                    <>
                      <Button 
                        onClick={loadHistory}
                        variant="ghost"
                        size="sm"
                      >
                        <History className="w-4 h-4 mr-1" />
                        Histórico
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Renderizar markdown */}
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <MarkdownRenderer content={analysis} />
              </div>

              {/* Estatísticas do relatório para todos os usuários */}
              {currentReport && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200">
                      📊 Avaliação da Comunidade
                    </h4>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center text-green-600 dark:text-green-400">
                        <ThumbsUp className="w-4 h-4 mr-1" />
                        {currentReport.likeCount} úteis
                      </span>
                      <span className="flex items-center text-red-600 dark:text-red-400">
                        <ThumbsDown className="w-4 h-4 mr-1" />
                        {currentReport.dislikeCount} não úteis
                      </span>
                    </div>
                  </div>
                  
                  {/* Barra de progresso visual */}
                  {(currentReport.likeCount + currentReport.dislikeCount) > 0 && (
                    <div className="mb-3">
                      <div className="flex h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500 transition-all duration-300"
                          style={{ 
                            width: `${(currentReport.likeCount / (currentReport.likeCount + currentReport.dislikeCount)) * 100}%` 
                          }}
                        />
                        <div 
                          className="bg-red-500 transition-all duration-300"
                          style={{ 
                            width: `${(currentReport.dislikeCount / (currentReport.likeCount + currentReport.dislikeCount)) * 100}%` 
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{currentReport.likeCount > 0 ? `${Math.round((currentReport.likeCount / (currentReport.likeCount + currentReport.dislikeCount)) * 100)}% útil` : ''}</span>
                        <span>{currentReport.dislikeCount > 0 ? `${Math.round((currentReport.dislikeCount / (currentReport.likeCount + currentReport.dislikeCount)) * 100)}% não útil` : ''}</span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    {(currentReport.likeCount + currentReport.dislikeCount) === 0 
                      ? "Seja o primeiro a avaliar este relatório!" 
                      : `${currentReport.likeCount + currentReport.dislikeCount} usuário${(currentReport.likeCount + currentReport.dislikeCount) > 1 ? 's' : ''} avaliaram este relatório`
                    }
                  </p>
                </div>
              )}

              {/* Preview CTA para usuários gratuitos */}
              {isPreview && (
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="text-center">
                    <Lock className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                      Continue lendo a análise completa
                    </h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                      Esta é apenas uma prévia. Usuários Premium têm acesso à análise completa, 
                      histórico de relatórios e podem dar feedback.
                    </p>
                    <Button asChild className="bg-purple-600 hover:bg-purple-700">
                      <Link href="/checkout">
                        <Crown className="w-4 h-4 mr-2" />
                        Fazer Upgrade Premium
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* Feedback para usuários Premium */}
              {userIsPremium && currentReport && !isPreview && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">💬 Sua Avaliação</h4>
                  
                  {!userFeedback ? (
                    <div className="space-y-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Ajude outros investidores avaliando este relatório:
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => handleFeedback('LIKE')}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-green-300 hover:bg-green-50 hover:border-green-400"
                        >
                          <ThumbsUp className="w-4 h-4 mr-2" />
                          Útil
                        </Button>
                        <Button
                          onClick={() => setShowFeedbackForm(true)}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-red-300 hover:bg-red-50 hover:border-red-400"
                        >
                          <ThumbsDown className="w-4 h-4 mr-2" />
                          Não útil
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-blue-700 dark:text-blue-300">
                      ✅ Obrigado pelo seu feedback! Você avaliou como: {userFeedback === 'LIKE' ? '👍 Útil' : '👎 Não útil'}
                    </div>
                  )}

                  {/* Formulário de feedback negativo */}
                  {showFeedbackForm && (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="O que podemos melhorar nesta análise? (opcional)"
                        className="w-full p-2 border rounded-md text-sm"
                        rows={3}
                      />
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleFeedback('DISLIKE')}
                          size="sm"
                          variant="destructive"
                        >
                          Enviar Feedback
                        </Button>
                        <Button
                          onClick={() => setShowFeedbackForm(false)}
                          size="sm"
                          variant="ghost"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal de histórico */}
            {showHistory && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Histórico de Relatórios - {ticker}</h3>
                    <Button
                      onClick={() => setShowHistory(false)}
                      variant="ghost"
                      size="sm"
                    >
                      ✕
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {reportHistory.map((report) => (
                      <div key={report.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {new Date(report.createdAt).toLocaleString('pt-BR')}
                          </span>
                          <div className="flex items-center space-x-2">
                            {report.isActive && (
                              <Badge variant="default" className="text-xs">Atual</Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center">
                              <ThumbsUp className="w-3 h-3 mr-1" />
                              {report.likeCount}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center">
                              <ThumbsDown className="w-3 h-3 mr-1" />
                              {report.dislikeCount}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {AIReportsService.generatePreview(report.content)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
