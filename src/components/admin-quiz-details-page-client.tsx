"use client"

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { ArrowLeft, FileQuestion, Users, CheckCircle2, Download, User, BarChart3, MessageSquare } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'

interface QuizDetail {
  id: string
  title: string
  message: string
  quizConfig: {
    questions: Array<{
      id: string
      type: 'MULTIPLE_CHOICE' | 'TEXT' | 'SCALE'
      question: string
      options?: string[]
      required: boolean
      min?: number
      max?: number
    }>
  }
  createdAt: Date
  dashboardExpiresAt: Date | null
  totalNotifications: number
  totalResponses: number
  responseRate: string
}

interface QuizResponse {
  id: string
  userId: string
  userName: string
  userEmail: string
  responses: Record<string, any>
  completedAt: Date
}

export function AdminQuizDetailsPageClient({ campaignId }: { campaignId: string }) {
  const { data, isLoading, error } = useQuery<{ quiz: QuizDetail; responses: QuizResponse[] }>({
    queryKey: ['admin', 'quiz', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/quizzes/${campaignId}`)
      if (!res.ok) throw new Error('Erro ao buscar detalhes do quiz')
      return res.json()
    },
  })

  const quiz = data?.quiz
  const responses = useMemo(() => data?.responses || [], [data?.responses])

  // Compilar estatísticas por pergunta
  const questionStats = useMemo(() => {
    if (!quiz || !responses.length) return []

    return quiz.quizConfig.questions.map((question) => {
      const answers = responses
        .map(r => r.responses[question.id])
        .filter(a => a !== undefined && a !== null && a !== '')

      if (question.type === 'MULTIPLE_CHOICE') {
        // Contar ocorrências de cada opção
        const counts: Record<string, number> = {}
        answers.forEach(answer => {
          counts[answer] = (counts[answer] || 0) + 1
        })
        
        const chartData = question.options?.map(option => ({
          name: option,
          value: counts[option] || 0,
          percentage: answers.length > 0 ? ((counts[option] || 0) / answers.length * 100).toFixed(1) : '0.0'
        })) || []

        return {
          questionId: question.id,
          question: question.question,
          type: question.type,
          totalAnswers: answers.length,
          chartData,
          stats: {
            mostCommon: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
            distribution: counts
          }
        }
      } else if (question.type === 'SCALE') {
        // Estatísticas numéricas
        const numericAnswers = answers.map(a => Number(a)).filter(n => !isNaN(n))
        
        if (numericAnswers.length === 0) {
          return {
            questionId: question.id,
            question: question.question,
            type: question.type,
            totalAnswers: 0,
            chartData: [],
            stats: {
              average: 0,
              median: 0,
              min: 0,
              max: 0,
              distribution: {}
            }
          }
        }

        const sorted = [...numericAnswers].sort((a, b) => a - b)
        const average = numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length
        const median = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]

        // Distribuição por faixas
        const minValue = question.min !== undefined ? question.min : Math.min(...numericAnswers)
        const maxValue = question.max !== undefined ? question.max : Math.max(...numericAnswers)
        const range = maxValue - minValue
        
        // Se range é 0 ou muito pequeno, usar valores individuais
        const distribution: Record<string, number> = {}
        
        if (range === 0) {
          // Todos os valores são iguais
          distribution[String(minValue)] = numericAnswers.length
        } else if (range <= 10) {
          // Para escalas pequenas (1-10), mostrar cada valor individualmente
          numericAnswers.forEach(value => {
            const label = String(value)
            distribution[label] = (distribution[label] || 0) + 1
          })
        } else {
          // Para escalas maiores, criar buckets
          const buckets = Math.min(10, Math.ceil(range / 2))
          const bucketSize = range / buckets

          numericAnswers.forEach(value => {
            let bucket = Math.floor((value - minValue) / bucketSize)
            // Garantir que o último bucket inclua o valor máximo
            if (bucket >= buckets) bucket = buckets - 1
            
            const bucketStart = minValue + bucket * bucketSize
            const bucketEnd = bucket === buckets - 1 
              ? maxValue 
              : minValue + (bucket + 1) * bucketSize
            
            const bucketLabel = bucket === buckets - 1 && bucketEnd === maxValue
              ? `${bucketStart.toFixed(1)}-${bucketEnd.toFixed(1)}`
              : `${bucketStart.toFixed(1)}-${bucketEnd.toFixed(1)}`
            
            distribution[bucketLabel] = (distribution[bucketLabel] || 0) + 1
          })
        }

        const chartData = Object.entries(distribution).map(([name, value]) => ({
          name,
          value,
          percentage: ((value / numericAnswers.length) * 100).toFixed(1)
        }))

        return {
          questionId: question.id,
          question: question.question,
          type: question.type,
          totalAnswers: numericAnswers.length,
          chartData,
          stats: {
            average: average.toFixed(2),
            median: median.toFixed(2),
            min: minValue,
            max: maxValue,
            distribution
          }
        }
      } else if (question.type === 'TEXT') {
        // Respostas mais comuns (primeiras palavras ou frases curtas)
        const textAnswers = answers.map(a => String(a).trim().toLowerCase())
        
        // Contar palavras-chave comuns (palavras com mais de 3 caracteres)
        const wordCounts: Record<string, number> = {}
        textAnswers.forEach(answer => {
          const words = answer.split(/\s+/).filter(w => w.length > 3)
          words.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1
          })
        })

        const topWords = Object.entries(wordCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([word, count]) => ({
            name: word,
            value: count,
            percentage: ((count / textAnswers.length) * 100).toFixed(1)
          }))

        return {
          questionId: question.id,
          question: question.question,
          type: question.type,
          totalAnswers: answers.length,
          chartData: topWords,
          stats: {
            totalUnique: new Set(textAnswers).size,
            topWords: Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
            sampleAnswers: textAnswers.slice(0, 5)
          }
        }
      }

      return {
        questionId: question.id,
        question: question.question,
        type: question.type,
        totalAnswers: answers.length,
        chartData: [],
        stats: {}
      }
    })
  }, [quiz, responses])

  const formatTime = (date: Date) => {
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: ptBR,
      })
    } catch {
      return 'há pouco tempo'
    }
  }

  const formatDate = (date: Date) => {
    try {
      return new Date(date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Data inválida'
    }
  }

  const exportToCSV = () => {
    if (!quiz || !responses.length) return

    const headers = ['Usuário', 'Email', 'Data de Resposta', ...quiz.quizConfig.questions.map(q => q.question)]
    const rows = responses.map(r => {
      const row = [r.userName, r.userEmail, formatDate(r.completedAt)]
      quiz.quizConfig.questions.forEach(q => {
        const answer = r.responses[q.id]
        if (q.type === 'MULTIPLE_CHOICE') {
          row.push(answer || '')
        } else if (q.type === 'TEXT') {
          row.push(`"${(answer || '').replace(/"/g, '""')}"`)
        } else if (q.type === 'SCALE') {
          row.push(answer || '')
        } else {
          row.push(answer || '')
        }
      })
      return row
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `quiz-${quiz.title.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderAnswer = (questionId: string, answer: any) => {
    const question = quiz?.quizConfig.questions.find(q => q.id === questionId)
    if (!question) return String(answer || '-')

    if (question.type === 'MULTIPLE_CHOICE') {
      return answer || '-'
    } else if (question.type === 'TEXT') {
      return answer || '-'
    } else if (question.type === 'SCALE') {
      return `${answer}${question.min !== undefined && question.max !== undefined ? ` (${question.min}-${question.max})` : ''}`
    }
    return String(answer || '-')
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-full mb-4" />
            <Skeleton className="h-4 w-3/4 mb-6" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive">Erro ao carregar detalhes do quiz</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin/quizzes">Voltar para Quizzes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/admin/quizzes" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Quizzes
          </Link>
        </Button>
        <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
        <p className="text-muted-foreground">{quiz.message}</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Notificações Enviadas</p>
                <p className="text-2xl font-bold">{quiz.totalNotifications}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Respostas Recebidas</p>
                <p className="text-2xl font-bold">{quiz.totalResponses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <FileQuestion className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Resposta</p>
                <p className="text-2xl font-bold">{quiz.responseRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="mb-6 flex justify-end">
        <Button onClick={exportToCSV} disabled={responses.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabs: Estatísticas e Respostas Individuais */}
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Estatísticas e Gráficos
          </TabsTrigger>
          <TabsTrigger value="responses" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Respostas Individuais ({responses.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Estatísticas */}
        <TabsContent value="stats" className="space-y-6">
          {responses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Ainda não há respostas para este quiz</p>
              </CardContent>
            </Card>
          ) : (
            questionStats.map((stat) => (
              <Card key={stat.questionId}>
                <CardHeader>
                  <CardTitle className="text-lg">{stat.question}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {stat.totalAnswers} resposta{stat.totalAnswers !== 1 ? 's' : ''}
                  </p>
                </CardHeader>
                <CardContent>
                  {stat.type === 'MULTIPLE_CHOICE' && stat.chartData.length > 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Gráfico de Barras */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">Distribuição de Respostas</h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stat.chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45}
                                textAnchor="end"
                                height={100}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip
                                formatter={(value: any, name: string, props: any) => [
                                  `${value} (${props.payload.percentage}%)`,
                                  'Respostas'
                                ]}
                              />
                              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Gráfico de Pizza */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">Proporção</h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <RechartsPieChart>
                              <Pie
                                data={stat.chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percentage }) => `${name}: ${percentage}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {stat.chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d946ef', '#ec4899'][index % 6]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: any, name: string, props: any) => [
                                  `${value} (${props.payload.percentage}%)`,
                                  'Respostas'
                                ]}
                              />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">
                          <strong>Mais escolhido:</strong> {stat.stats.mostCommon}
                        </p>
                      </div>
                    </div>
                  )}

                  {stat.type === 'SCALE' && stat.chartData.length > 0 && (
                    <div className="space-y-4">
                      {/* Estatísticas Numéricas */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-xs text-muted-foreground">Média</p>
                          <p className="text-2xl font-bold">{stat.stats.average}</p>
                        </div>
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <p className="text-xs text-muted-foreground">Mediana</p>
                          <p className="text-2xl font-bold">{stat.stats.median}</p>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-xs text-muted-foreground">Mínimo</p>
                          <p className="text-2xl font-bold">{stat.stats.min}</p>
                        </div>
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <p className="text-xs text-muted-foreground">Máximo</p>
                          <p className="text-2xl font-bold">{stat.stats.max}</p>
                        </div>
                      </div>

                      {/* Gráfico de Distribuição */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Distribuição</h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={stat.chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              formatter={(value: any, name: string, props: any) => [
                                `${value} (${props.payload.percentage}%)`,
                                'Respostas'
                              ]}
                            />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {stat.type === 'TEXT' && stat.chartData.length > 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Gráfico de Palavras Mais Comuns */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">Palavras Mais Comuns</h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stat.chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="name" 
                                angle={-45}
                                textAnchor="end"
                                height={100}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip
                                formatter={(value: any) => [`${value} ocorrências`, '']}
                              />
                              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Respostas de Exemplo */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">Respostas de Exemplo</h4>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {stat.stats.sampleAnswers?.map((answer, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-sm">{answer}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Total de respostas únicas: {stat.stats.totalUnique}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {stat.chartData.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Sem dados suficientes para exibir gráficos
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tab: Respostas Individuais */}
        <TabsContent value="responses">
          <Card>
            <CardHeader>
              <CardTitle>Respostas Individuais ({responses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <div className="text-center py-12">
                  <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Ainda não há respostas para este quiz</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {responses.map((response) => (
                      <Card key={response.id} className="border-l-4 border-l-indigo-500">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <p className="font-semibold">{response.userName}</p>
                                <p className="text-sm text-muted-foreground">{response.userEmail}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary" className="mb-2">
                                {formatTime(response.completedAt)}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(response.completedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 mt-4 pt-4 border-t">
                            {quiz.quizConfig.questions.map((question) => {
                              const answer = response.responses[question.id]
                              return (
                                <div key={question.id} className="space-y-1">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {question.question}
                                    {question.required && <span className="text-red-500 ml-1">*</span>}
                                  </p>
                                  <div className="pl-4">
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                      {renderAnswer(question.id, answer)}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

