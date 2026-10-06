"use client"

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuiz } from '@/hooks/use-quiz'
import { QuizModal } from './quiz-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'

interface QuizPageClientProps {
  campaignId: string
}

function StateCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {children}
      <Button asChild variant="outline">
        <Link href="/notificacoes">Voltar para notificações</Link>
      </Button>
    </section>
  )
}

export function QuizPageClient({ campaignId }: QuizPageClientProps) {
  const router = useRouter()
  const { quiz, isLoading, isCompleted } = useQuiz(campaignId)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {isLoading ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-6" aria-busy="true" aria-label="Carregando quiz">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !quiz ? (
        <StateCard title="Quiz não encontrado">
          <p className="text-sm text-muted-foreground">Este quiz não existe ou não está disponível para a sua conta.</p>
        </StateCard>
      ) : isCompleted || quiz.isCompleted ? (
        <StateCard title="Quiz já respondido">
          <p className="text-sm text-muted-foreground">Você já respondeu este quiz. Obrigado pela participação.</p>
          {quiz.completedAt && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Respondido em {formatDate(quiz.completedAt, { style: 'datetime' })}
            </p>
          )}
        </StateCard>
      ) : (
        <QuizModal campaignId={campaignId} onClose={() => router.push('/notificacoes')} isPageMode />
      )}
    </div>
  )
}
