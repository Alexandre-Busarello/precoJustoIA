"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent } from '@/components/ui/card'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useQuiz } from '@/hooks/use-quiz'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

interface QuizModalProps {
  campaignId?: string
  onClose?: () => void
  isPageMode?: boolean // Se true, renderiza como página ao invés de modal
}

export function QuizModal({ campaignId, onClose, isPageMode = false }: QuizModalProps) {
  const { quiz, isLoading, isCompleted, responses, updateResponse, submit, isSubmitting, submitError } = useQuiz(campaignId)
  const { toast } = useToast()
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (submitError) {
      toast({
        title: 'Erro',
        description: submitError instanceof Error ? submitError.message : 'Erro ao submeter quiz',
        variant: 'destructive'
      })
    }
  }, [submitError, toast])

  // No modo modal, retornar null se não houver quiz ou se já foi respondido
  // No modo página, o componente pai (QuizPageClient) já trata isso
  if (!isPageMode && (isLoading || !quiz || isCompleted)) return null

  const handleSubmit = async () => {
    try {
      const validation = validateResponses()
      if (!validation.valid) {
        setErrors(validation.errors)
        toast({
          title: 'Campos obrigatórios',
          description: Object.values(validation.errors).join(', '),
          variant: 'destructive'
        })
        return
      }
      setErrors({})
      
      // Aguardar o submit completar antes de fazer qualquer redirecionamento
      await submit()
      
      toast({
        title: 'Quiz enviado!',
        description: 'Obrigado por responder!',
      })
      
      // Aguardar um pouco antes de redirecionar para o usuário ver o toast
      setTimeout(() => {
        if (onClose) {
          onClose()
        } else if (isPageMode) {
          // Usar router.push ao invés de window.location.href para evitar reload completo
          router.push('/notificacoes')
        }
      }, 1500)
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao submeter quiz',
        variant: 'destructive'
      })
    }
  }

  const validateResponses = (): { valid: boolean; errors: Record<string, string> } => {
    const validationErrors: Record<string, string> = {}
    
    if (!quiz) {
      return { valid: false, errors: { general: 'Quiz não encontrado' } }
    }
    
    for (const question of quiz.quizConfig.questions) {
      const response = responses[question.id]
      
      if (question.required && (response === undefined || response === null || response === '')) {
        validationErrors[question.id] = 'Esta pergunta é obrigatória'
        continue
      }

      if (question.type === 'SCALE' && response !== undefined && response !== null && response !== '') {
        const numValue = Number(response)
        if (question.min !== undefined && numValue < question.min) {
          validationErrors[question.id] = `Valor mínimo é ${question.min}`
        }
        if (question.max !== undefined && numValue > question.max) {
          validationErrors[question.id] = `Valor máximo é ${question.max}`
        }
      }
    }

    return {
      valid: Object.keys(validationErrors).length === 0,
      errors: validationErrors
    }
  }

  if (!quiz) return null

  const template = quiz.modalTemplate || 'GRADIENT'

  const renderQuestion = (question: any) => {
    const response = responses[question.id]
    const error = errors[question.id]
    const isDisabled = isCompleted || quiz?.isCompleted

    return (
      <div key={question.id} className="space-y-2">
        <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {question.type === 'MULTIPLE_CHOICE' && question.options && (
          <div className="space-y-2">
            {question.options.map((option: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => !isDisabled && updateResponse(question.id, option)}
                disabled={isDisabled}
                className={cn(
                  "w-full text-left p-3 rounded-lg border-2 transition-all",
                  isDisabled && "opacity-50 cursor-not-allowed",
                  response === option
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    response === option
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-slate-300 dark:border-slate-600"
                  )}>
                    {response === option && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {question.type === 'TEXT' && (
          <Textarea
            value={response || ''}
            onChange={(e) => !isDisabled && updateResponse(question.id, e.target.value)}
            placeholder="Digite sua resposta..."
            className={cn(error && "border-red-500", isDisabled && "opacity-50 cursor-not-allowed")}
            rows={3}
            disabled={isDisabled}
          />
        )}

        {question.type === 'SCALE' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{question.min || 0}</span>
              <span className="font-medium">{response || question.min || 0}</span>
              <span>{question.max || 10}</span>
            </div>
            <Slider
              value={[Number(response) || question.min || 0]}
              onValueChange={(value) => !isDisabled && updateResponse(question.id, value[0])}
              min={question.min || 0}
              max={question.max || 10}
              step={1}
              className={cn("w-full", isDisabled && "opacity-50")}
              disabled={isDisabled}
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}
      </div>
    )
  }

  // Template GRADIENT
  const gradientContent = (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 rounded-lg p-6 border-2 border-indigo-200 dark:border-indigo-800">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          {quiz.illustrationUrl && (
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white dark:border-slate-800">
              <Image
                src={quiz.illustrationUrl}
                alt=""
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 mb-2">
              {quiz.title}
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {quiz.message}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {quiz.quizConfig.questions.map(renderQuestion)}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isCompleted || quiz?.isCompleted}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Enviando...' : (isCompleted || quiz?.isCompleted) ? 'Quiz já respondido' : 'Enviar Respostas'}
          <CheckCircle2 className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )

  // Template SOLID
  const solidContent = (
    <div className="bg-slate-900 dark:bg-slate-800 rounded-lg p-6 border-2 border-slate-700 dark:border-slate-600">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          {quiz.illustrationUrl && (
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-slate-700">
              <Image
                src={quiz.illustrationUrl}
                alt=""
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-xl text-white mb-2">
              {quiz.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {quiz.message}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {quiz.quizConfig.questions.map(renderQuestion)}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-white text-slate-900 hover:bg-slate-100 font-medium"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Respostas'}
          <CheckCircle2 className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )

  // Template MINIMAL
  const minimalContent = (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 mb-2">
            {quiz.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {quiz.message}
          </p>
        </div>
        <div className="space-y-4">
          {quiz.quizConfig.questions.map(renderQuestion)}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          variant="default"
          className="w-full"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Respostas'}
          <CheckCircle2 className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )

  // Template ILLUSTRATED
  const illustratedContent = (
    <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
      {quiz.illustrationUrl && (
        <div className="relative w-full h-64 overflow-hidden">
          <Image
            src={quiz.illustrationUrl}
            alt={quiz.title}
            width={600}
            height={256}
            className="object-cover w-full h-full"
            priority
            unoptimized={quiz.illustrationUrl.startsWith('/files/') || quiz.illustrationUrl.includes('precojusto.ai/files/')}
          />
          {/* Overlay sutil no topo para melhor contraste do texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
        </div>
      )}
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <h3 className="font-bold text-2xl text-slate-900 dark:text-slate-100 leading-tight">
            {quiz.title}
          </h3>
          <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            {quiz.message}
          </p>
        </div>
        <div className="space-y-4">
          {quiz.quizConfig.questions.map(renderQuestion)}
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="lg"
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Respostas'}
          <CheckCircle2 className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  )

  const getTemplateContent = () => {
    switch (template) {
      case 'SOLID':
        return solidContent
      case 'MINIMAL':
        return minimalContent
      case 'ILLUSTRATED':
        return illustratedContent
      case 'GRADIENT':
      default:
        return gradientContent
    }
  }

  // Se for modo página, renderizar sem Dialog
  if (isPageMode) {
    return (
      <Card className={cn(
        "max-w-2xl mx-auto",
        template === 'ILLUSTRATED' && "max-w-3xl"
      )}>
        <CardContent className="p-6 relative">
          {getTemplateContent()}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClose()}
              className="absolute top-4 right-4"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Modo modal (padrão)
  return (
    <Dialog open={!!quiz} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className={cn(
        "max-w-2xl max-h-[90vh] overflow-y-auto",
        template === 'ILLUSTRATED' && "max-w-3xl"
      )} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="sr-only">{quiz.title}</DialogTitle>
        </DialogHeader>
        {getTemplateContent()}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClose?.()}
          className="absolute top-4 right-4"
          disabled={isSubmitting}
        >
          <X className="w-4 h-4" />
        </Button>
      </DialogContent>
    </Dialog>
  )
}

