'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface AIReportFeedbackProps {
  reportId: string
  ticker: string
  initialLikeCount: number
  initialDislikeCount: number
  initialUserFeedback?: 'LIKE' | 'DISLIKE' | null
  onFeedbackUpdate?: (type: 'LIKE' | 'DISLIKE', newCounts: { likes: number, dislikes: number }) => void
}

type FeedbackType = 'LIKE' | 'DISLIKE'

/** "Este relatório foi útil?" com contagem da comunidade; voto negativo pede um comentário opcional. */
export function AIReportFeedback({
  reportId,
  ticker,
  initialLikeCount,
  initialDislikeCount,
  initialUserFeedback = null,
  onFeedbackUpdate
}: AIReportFeedbackProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [userFeedback, setUserFeedback] = useState<FeedbackType | null>(initialUserFeedback)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [comment, setComment] = useState('')
  const [submitError, setSubmitError] = useState(false)

  const totalVotes = likeCount + dislikeCount

  const handleFeedback = async (type: FeedbackType, { withComment = false } = {}) => {
    if (!session?.user) {
      router.push('/login')
      return
    }

    // Mesmo voto de novo: nada a fazer
    if (userFeedback === type) return

    // Primeiro voto negativo: abre o campo de comentário antes de enviar
    if (type === 'DISLIKE' && !userFeedback && !withComment) {
      setShowCommentForm(true)
      return
    }

    setIsSubmitting(true)
    setSubmitError(false)

    try {
      const response = await fetch(`/api/ai-reports/${ticker}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          type,
          comment: type === 'DISLIKE' ? comment.trim() || undefined : undefined
        }),
      })

      if (!response.ok) {
        setSubmitError(true)
        return
      }

      let newLikes = likeCount
      let newDislikes = dislikeCount

      // Remove o voto anterior e soma o novo
      if (userFeedback === 'LIKE') newLikes = Math.max(0, newLikes - 1)
      else if (userFeedback === 'DISLIKE') newDislikes = Math.max(0, newDislikes - 1)
      if (type === 'LIKE') newLikes += 1
      else newDislikes += 1

      setLikeCount(newLikes)
      setDislikeCount(newDislikes)
      setUserFeedback(type)
      setShowCommentForm(false)
      setComment('')
      onFeedbackUpdate?.(type, { likes: newLikes, dislikes: newDislikes })
    } catch (error) {
      console.error('Erro ao enviar feedback:', error)
      setSubmitError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {userFeedback ? 'Obrigado pela avaliação' : 'Este relatório foi útil?'}
          </p>
          <p className="text-xs text-muted-foreground">
            {totalVotes === 0
              ? 'Ainda sem avaliações.'
              : `${totalVotes} ${totalVotes === 1 ? 'avaliação' : 'avaliações'} da comunidade`}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Avaliar relatório">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleFeedback('LIKE')}
            disabled={isSubmitting}
            aria-pressed={userFeedback === 'LIKE'}
            className={cn('flex-1 sm:flex-none', userFeedback === 'LIKE' && 'border-brand bg-brand-subtle text-brand')}
          >
            <ThumbsUp strokeWidth={1.75} aria-hidden="true" />
            Útil
            <span className="tabular-nums text-muted-foreground">{likeCount}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleFeedback('DISLIKE')}
            disabled={isSubmitting}
            aria-pressed={userFeedback === 'DISLIKE'}
            className={cn('flex-1 sm:flex-none', userFeedback === 'DISLIKE' && 'border-brand bg-brand-subtle text-brand')}
          >
            <ThumbsDown strokeWidth={1.75} aria-hidden="true" />
            Não útil
            <span className="tabular-nums text-muted-foreground">{dislikeCount}</span>
          </Button>
        </div>
      </div>

      {showCommentForm && (
        <div className="space-y-3">
          <label htmlFor={`feedback-${reportId}`} className="text-sm text-muted-foreground">
            O que podemos melhorar nesta análise? (opcional)
          </label>
          <Textarea
            id={`feedback-${reportId}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleFeedback('DISLIKE', { withComment: true })}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando…' : 'Enviar avaliação'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCommentForm(false)
                setComment('')
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {submitError && (
        <p className="text-sm text-negative" role="alert">
          Não foi possível registrar a avaliação. Tente novamente.
        </p>
      )}
    </div>
  )
}
