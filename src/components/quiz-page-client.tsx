"use client"

import { useRouter } from 'next/navigation'
import { useQuiz } from '@/hooks/use-quiz'
import { QuizModal } from './quiz-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface QuizPageClientProps {
  campaignId: string
}

export function QuizPageClient({ campaignId }: QuizPageClientProps) {
  const router = useRouter()
  const { quiz, isLoading, isCompleted } = useQuiz(campaignId)

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-6" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Quiz não encontrado</h2>
            <p className="text-muted-foreground mb-4">
              Este quiz não existe ou não está disponível para você.
            </p>
            <Button asChild variant="outline">
              <Link href="/notificacoes">Voltar para Notificações</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Se já foi respondido, mostrar mensagem
  if (isCompleted || quiz.isCompleted) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Quiz já respondido</h2>
            <p className="text-muted-foreground mb-4">
              Você já respondeu este quiz anteriormente. Obrigado pela sua participação!
            </p>
            {quiz.completedAt && (
              <p className="text-sm text-muted-foreground mb-4">
                Respondido em {new Date(quiz.completedAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
            <Button asChild variant="outline">
              <Link href="/notificacoes">Voltar para Notificações</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Renderizar o quiz em formato de página (não modal)
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {quiz && (
        <QuizModal 
          campaignId={campaignId} 
          onClose={() => {
            // Redirecionar para notificações após fechar
            router.push('/notificacoes')
          }}
          isPageMode={true}
        />
      )}
    </div>
  )
}

