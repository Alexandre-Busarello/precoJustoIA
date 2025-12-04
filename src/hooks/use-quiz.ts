"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface QuizQuestion {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TEXT' | 'SCALE'
  question: string
  options?: string[]
  required: boolean
  min?: number
  max?: number
}

interface QuizNotification {
  id: string
  campaignId: string
  title: string
  message: string
  quizConfig: {
    questions: QuizQuestion[]
  }
  modalTemplate: 'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED' | null
  illustrationUrl: string | null
  isCompleted?: boolean
  completedAt?: Date
}

export function useQuiz(campaignId?: string) {
  const queryClient = useQueryClient()
  const [responses, setResponses] = useState<Record<string, any>>({})

  // Buscar quiz pendente ou específico
  const { data, isLoading } = useQuery<{ quiz: QuizNotification | null; isCompleted?: boolean }>({
    queryKey: ['notifications', 'quiz', campaignId || 'pending'],
    queryFn: async () => {
      const url = campaignId 
        ? `/api/notifications/quiz/${campaignId}`
        : '/api/notifications/modal' // Buscar modal pendente que pode ser quiz
      const res = await fetch(url)
      if (!res.ok) {
        // Se for 404 e tiver campaignId, pode ser que já foi respondido
        if (res.status === 404 && campaignId) {
          return { quiz: null, isCompleted: false }
        }
        return { quiz: null, isCompleted: false }
      }
      const data = await res.json()
      // Se for modal, verificar se é quiz
      if (data.notification && data.notification.campaignId) {
        // Buscar quiz específico
        const quizRes = await fetch(`/api/notifications/quiz/${data.notification.campaignId}`)
        if (quizRes.ok) {
          return await quizRes.json()
        }
      }
      return data
    },
    enabled: true,
    refetchOnWindowFocus: false
  })

  // Mutation para submeter quiz
  const submitMutation = useMutation({
    mutationFn: async (quizResponses: Record<string, any>) => {
      const quiz = data?.quiz
      if (!quiz) throw new Error('Quiz não encontrado')
      
      const res = await fetch(`/api/notifications/quiz/${quiz.campaignId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: quizResponses })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao submeter quiz')
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['notifications', 'quiz'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'modal'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setResponses({})
    }
  })

  const updateResponse = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const validateResponses = (): { valid: boolean; errors: string[] } => {
    const quiz = data?.quiz
    if (!quiz) return { valid: false, errors: ['Quiz não encontrado'] }

    const errors: string[] = []
    
    for (const question of quiz.quizConfig.questions) {
      const response = responses[question.id]
      
      if (question.required && (response === undefined || response === null || response === '')) {
        errors.push(`A pergunta "${question.question}" é obrigatória`)
        continue
      }

      if (question.type === 'SCALE' && response !== undefined && response !== null && response !== '') {
        const numValue = Number(response)
        if (question.min !== undefined && numValue < question.min) {
          errors.push(`A resposta para "${question.question}" deve ser no mínimo ${question.min}`)
        }
        if (question.max !== undefined && numValue > question.max) {
          errors.push(`A resposta para "${question.question}" deve ser no máximo ${question.max}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  const submit = async () => {
    const validation = validateResponses()
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }
    // Retornar Promise para poder aguardar no componente
    return new Promise<void>((resolve, reject) => {
      submitMutation.mutate(responses, {
        onSuccess: () => {
          resolve()
        },
        onError: (error) => {
          reject(error)
        }
      })
    })
  }

  // Mutation para marcar quiz como visto (quando fecha sem responder)
  const markAsViewedMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/notifications/modal/${campaignId}/viewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true })
      })
      if (!res.ok) throw new Error('Erro ao marcar quiz como visto')
      return res.json()
    },
    onSuccess: () => {
      // Invalidar queries para não mostrar mais automaticamente
      queryClient.invalidateQueries({ queryKey: ['notifications', 'modal'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'quiz'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const markAsViewed = (campaignId: string) => {
    markAsViewedMutation.mutate(campaignId)
  }

  return {
    quiz: data?.quiz || null,
    isLoading,
    isCompleted: data?.isCompleted || false,
    responses,
    updateResponse,
    submit,
    validateResponses,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error,
    markAsViewed,
    isMarkingAsViewed: markAsViewedMutation.isPending
  }
}

