'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface AIReportFeedbackProps {
  reportId: string
  ticker: string
  initialLikeCount: number
  initialDislikeCount: number
  initialUserFeedback?: 'LIKE' | 'DISLIKE' | null
  onFeedbackUpdate?: (type: 'LIKE' | 'DISLIKE', newCounts: { likes: number, dislikes: number }) => void
}

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
  const [userFeedback, setUserFeedback] = useState<'LIKE' | 'DISLIKE' | null>(initialUserFeedback)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [comment, setComment] = useState('')

  const handleFeedback = async (type: 'LIKE' | 'DISLIKE') => {
    if (!session?.user) {
      router.push('/login')
      return
    }

    // Se o usuário clica no mesmo tipo de feedback, não faz nada
    if (userFeedback === type) {
      return
    }

    // Se é DISLIKE, mostrar formulário de comentário
    if (type === 'DISLIKE' && !userFeedback) {
      setShowCommentForm(true)
      return
    }

    setIsSubmitting(true)

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

      if (response.ok) {
        // Atualizar contadores localmente
        let newLikes = likeCount
        let newDislikes = dislikeCount

        // Remover feedback anterior
        if (userFeedback === 'LIKE') {
          newLikes = Math.max(0, newLikes - 1)
        } else if (userFeedback === 'DISLIKE') {
          newDislikes = Math.max(0, newDislikes - 1)
        }

        // Adicionar novo feedback
        if (type === 'LIKE') {
          newLikes += 1
        } else {
          newDislikes += 1
        }

        setLikeCount(newLikes)
        setDislikeCount(newDislikes)
        setUserFeedback(type)
        setShowCommentForm(false)
        setComment('')

        // Notificar componente pai
        if (onFeedbackUpdate) {
          onFeedbackUpdate(type, { likes: newLikes, dislikes: newDislikes })
        }
      }
    } catch (error) {
      console.error('Erro ao enviar feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Estatísticas da Comunidade */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-800 dark:text-gray-200">
            📊 Avaliação da Comunidade
          </h4>
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center text-green-600 dark:text-green-400">
              <ThumbsUp className="w-4 h-4 mr-1" />
              {likeCount}
            </span>
            <span className="flex items-center text-red-600 dark:text-red-400">
              <ThumbsDown className="w-4 h-4 mr-1" />
              {dislikeCount}
            </span>
          </div>
        </div>

        {/* Barra de progresso visual */}
        {(likeCount + dislikeCount) > 0 && (
          <div className="mb-3">
            <div className="flex h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 transition-all duration-300"
                style={{ 
                  width: `${(likeCount / (likeCount + dislikeCount)) * 100}%` 
                }}
              />
              <div 
                className="bg-red-500 transition-all duration-300"
                style={{ 
                  width: `${(dislikeCount / (likeCount + dislikeCount)) * 100}%` 
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{likeCount > 0 ? `${Math.round((likeCount / (likeCount + dislikeCount)) * 100)}% útil` : ''}</span>
              <span>{dislikeCount > 0 ? `${Math.round((dislikeCount / (likeCount + dislikeCount)) * 100)}% não útil` : ''}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          {(likeCount + dislikeCount) === 0 
            ? "Seja o primeiro a avaliar este relatório!" 
            : `${likeCount + dislikeCount} usuário${(likeCount + dislikeCount) > 1 ? 's' : ''} avaliaram este relatório`
          }
        </p>
      </div>

      {/* Ações de Feedback do Usuário */}
      {session?.user && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">💬 Sua Avaliação</h4>
          
          {!userFeedback ? (
            <div className="space-y-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Este relatório foi útil para você?
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => handleFeedback('LIKE')}
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  className="flex-1 border-green-300 hover:bg-green-50 hover:border-green-400 dark:border-green-700 dark:hover:bg-green-950"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Útil
                </Button>
                <Button
                  onClick={() => handleFeedback('DISLIKE')}
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  className="flex-1 border-red-300 hover:bg-red-50 hover:border-red-400 dark:border-red-700 dark:hover:bg-red-950"
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

          {/* Formulário de comentário para feedback negativo */}
          {showCommentForm && (
            <div className="mt-4 space-y-3">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="O que podemos melhorar nesta análise? (opcional)"
                className="w-full p-2 border rounded-md text-sm dark:bg-gray-900 dark:border-gray-700"
                rows={3}
              />
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleFeedback('DISLIKE')}
                  size="sm"
                  variant="destructive"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Feedback'}
                </Button>
                <Button
                  onClick={() => {
                    setShowCommentForm(false)
                    setComment('')
                  }}
                  size="sm"
                  variant="ghost"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

