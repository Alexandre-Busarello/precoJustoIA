"use client"

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { useQuiz } from '@/hooks/use-quiz'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface QuizModalProps {
  campaignId?: string
  onClose?: () => void
  /** Renderiza como conteúdo de página (rota /quiz/[campaignId]) em vez de Dialog. */
  isPageMode?: boolean
}

type Quiz = NonNullable<ReturnType<typeof useQuiz>['quiz']>
type QuizQuestion = Quiz['quizConfig']['questions'][number]
type ResponseValue = string | number | undefined

/** Teclas que mudam o valor do slider (Shift, Tab etc. não contam como resposta) */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

function isAnswered(value: unknown) {
  return value !== undefined && value !== null && value !== ''
}

function isUnoptimizedImage(url: string) {
  return url.startsWith('/files/') || url.includes('precojusto.ai/files/')
}

/** Pesquisa (quiz) de campanha: perguntas de múltipla escolha, texto livre e escala. */
export function QuizModal({ campaignId, onClose, isPageMode = false }: QuizModalProps) {
  const { quiz, isLoading, isCompleted, responses, updateResponse, submit, isSubmitting, submitError } = useQuiz(campaignId)
  const { toast } = useToast()
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (submitError) {
      toast({
        title: 'Não foi possível enviar',
        description: submitError instanceof Error ? submitError.message : 'Tente novamente em instantes.',
        variant: 'destructive'
      })
    }
  }, [submitError, toast])

  // No modo modal nada aparece enquanto carrega, sem quiz ou já respondido (a página trata esses estados)
  if (!quiz || (!isPageMode && (isLoading || isCompleted))) return null

  const questions = quiz.quizConfig.questions
  const locked = Boolean(isCompleted || quiz.isCompleted)

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {}
    for (const question of questions) {
      const response = responses[question.id]
      if (question.required && !isAnswered(response)) {
        found[question.id] = 'Responda esta pergunta.'
        continue
      }
      if (question.type === 'SCALE' && isAnswered(response)) {
        const value = Number(response)
        if (question.min !== undefined && value < question.min) found[question.id] = `O valor mínimo é ${question.min}.`
        if (question.max !== undefined && value > question.max) found[question.id] = `O valor máximo é ${question.max}.`
      }
    }
    return found
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      document.getElementById(`quiz-q-${Object.keys(found)[0]}`)?.focus()
      return
    }
    try {
      await submit()
      toast({ title: 'Respostas enviadas', description: 'Obrigado por participar.' })
      setTimeout(() => {
        if (onClose) onClose()
        else if (isPageMode) router.push('/notificacoes')
      }, 1200)
    } catch (error) {
      toast({
        title: 'Não foi possível enviar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive'
      })
    }
  }

  const answeredCount = questions.filter((q) => isAnswered(responses[q.id])).length

  const form = (
    <form id="quiz-form" onSubmit={handleSubmit} className="grid gap-6" noValidate>
      {questions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={responses[question.id] as ResponseValue}
          error={errors[question.id]}
          disabled={locked}
          onChange={(value) => updateResponse(question.id, value)}
        />
      ))}
    </form>
  )

  const submitLabel = isSubmitting ? 'Enviando…' : locked ? 'Já respondido' : 'Enviar respostas'

  if (isPageMode) {
    return (
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        {quiz.illustrationUrl && (
          <Image
            src={quiz.illustrationUrl}
            alt=""
            width={768}
            height={256}
            className="h-40 w-full border-b border-border object-cover sm:h-56"
            unoptimized={isUnoptimizedImage(quiz.illustrationUrl)}
          />
        )}
        <div className="grid gap-6 p-4 sm:p-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{quiz.title}</h1>
            {quiz.message && <p className="text-sm leading-6 text-muted-foreground">{quiz.message}</p>}
            {questions.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {answeredCount} de {questions.length} respondida{questions.length === 1 ? '' : 's'}
                </p>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Progresso do quiz"
                  aria-valuemin={0}
                  aria-valuemax={questions.length}
                  aria-valuenow={answeredCount}
                >
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
                </div>
              </div>
            )}
          </header>
          {form}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onClose && (
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Voltar
              </Button>
            )}
            <Button type="submit" form="quiz-form" disabled={isSubmitting || locked}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl sm:p-0 [&>[data-slot=dialog-close]]:bg-popover">
        {quiz.illustrationUrl && (
          <Image
            src={quiz.illustrationUrl}
            alt=""
            width={640}
            height={256}
            className="h-40 w-full border-b border-border object-cover sm:h-52"
            unoptimized={isUnoptimizedImage(quiz.illustrationUrl)}
          />
        )}
        <div className="grid gap-5 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg leading-snug">{quiz.title}</DialogTitle>
            {quiz.message ? (
              <DialogDescription className="leading-6">{quiz.message}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Pesquisa da equipe Preço Justo AI</DialogDescription>
            )}
          </DialogHeader>
          {form}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onClose?.()} disabled={isSubmitting}>
              Agora não
            </Button>
            <Button type="submit" form="quiz-form" disabled={isSubmitting || locked}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function QuestionField({
  question,
  value,
  error,
  disabled,
  onChange,
}: {
  question: QuizQuestion
  value: ResponseValue
  error?: string
  disabled: boolean
  onChange: (value: string | number) => void
}) {
  const fieldId = `quiz-q-${question.id}`
  const errorId = `${fieldId}-error`
  const min = question.min ?? 0
  const max = question.max ?? 10

  const label = (
    <>
      {question.question}
      {question.required ? (
        <span className="text-muted-foreground font-normal"> · obrigatória</span>
      ) : null}
    </>
  )

  return (
    <div className="grid gap-2">
      {question.type === 'MULTIPLE_CHOICE' && question.options ? (
        <fieldset
          className="grid gap-2"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
        >
          <legend className="mb-2 text-sm font-medium text-foreground">{label}</legend>
          {question.options.map((option, index) => {
            const checked = value === option
            return (
              <label
                key={option}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                  checked ? 'border-brand bg-brand-subtle' : 'border-border'
                )}
              >
                <input
                  id={index === 0 ? fieldId : undefined}
                  type="radio"
                  name={fieldId}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(option)}
                  className="size-4 shrink-0 accent-[var(--brand)] outline-none"
                />
                {option}
              </label>
            )
          })}
        </fieldset>
      ) : (
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}

      {question.type === 'TEXT' && (
        <Textarea
          id={fieldId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sua resposta"
          rows={3}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
        />
      )}

      {question.type === 'SCALE' && (
        <div className="grid gap-2">
          <Slider
            id={fieldId}
            value={[isAnswered(value) ? Number(value) : min]}
            onValueChange={(next) => onChange(next[0])}
            // Sem resposta, o polegar fica no mínimo e o Radix não dispara mudança ao tocar nele: registra o mínimo
            onPointerDown={() => {
              if (!isAnswered(value)) onChange(min)
            }}
            onKeyDown={(e) => {
              if (!isAnswered(value) && SLIDER_KEYS.has(e.key)) onChange(min)
            }}
            min={min}
            max={max}
            step={1}
            disabled={disabled}
            aria-label={question.question}
            aria-describedby={error ? errorId : undefined}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{min}</span>
            <span className="font-medium text-foreground">{isAnswered(value) ? value : '—'}</span>
            <span>{max}</span>
          </div>
        </div>
      )}

      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-negative">
          <AlertCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
