"use client"

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { ArrowRight, FileQuestion, Users, CheckCircle2, Calendar } from 'lucide-react'

interface Quiz {
  id: string
  title: string
  message: string
  createdAt: Date
  dashboardExpiresAt: Date | null
  totalNotifications: number
  totalResponses: number
  responseRate: string
}

export function AdminQuizzesPageClient() {
  const { data, isLoading, error } = useQuery<{ quizzes: Quiz[] }>({
    queryKey: ['admin', 'quizzes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/quizzes')
      if (!res.ok) throw new Error('Erro ao buscar quizzes')
      return res.json()
    },
  })

  const quizzes = data?.quizzes || []

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Quizzes e Respostas</h1>
        <p className="text-muted-foreground">
          Visualize e acompanhe todas as respostas dos quizzes criados
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-64 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive">Erro ao carregar quizzes</p>
          </CardContent>
        </Card>
      ) : quizzes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileQuestion className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Nenhum quiz encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Ainda não foram criados quizzes. Crie um quiz em Campanhas de Notificações.
            </p>
            <Button asChild>
              <Link href="/admin/notifications">Criar Quiz</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                        <FileQuestion className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-1">{quiz.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {quiz.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {quiz.totalNotifications} notificações enviadas
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-muted-foreground">
                          {quiz.totalResponses} respostas ({quiz.responseRate}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground mr-2" />
                        <span className="text-muted-foreground">
                          Criado {formatTime(quiz.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4">
                    <Button asChild variant="outline">
                      <Link href={`/admin/quizzes/${quiz.id}`} className="flex items-center gap-2">
                        Ver Respostas
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

