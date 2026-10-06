"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { cn } from "@/lib/utils"

type QuestionStep = "name" | "acquisition" | "experience" | "focus"
type OnboardingStep = "welcome" | QuestionStep | "done"

const QUESTION_ORDER: QuestionStep[] = ["name", "acquisition", "experience", "focus"]

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  /** Mostra só estas perguntas, sem a tela de boas-vindas (ex.: ['acquisition', 'experience']). */
  onlyQuestions?: string[]
  /** Perguntas ainda sem resposta (onboarding-status). Na tela de boas-vindas, limita "Personalizar" a elas. */
  pendingQuestions?: string[]
  /** Respostas já salvas, preservadas quando o usuário pula uma pergunta. */
  savedData?: {
    name?: string | null
    acquisitionSource?: string | null
    experienceLevel?: string | null
    investmentFocus?: string | null
  }
}

interface Option {
  value: string
  label: string
  description?: string
}

const ACQUISITION_OPTIONS: Option[] = [
  { value: "google", label: "Pesquisa no Google" },
  { value: "youtube", label: "Vídeo no YouTube" },
  { value: "friend", label: "Indicação de amigo ou colega" },
  { value: "instagram", label: "Instagram ou Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "article", label: "Artigo ou notícia (blog, portal)" },
  { value: "other", label: "Outro" },
]

const EXPERIENCE_OPTIONS: Option[] = [
  { value: "beginner", label: "Estou começando agora", description: "Iniciante" },
  { value: "intermediate", label: "Já invisto, mas não costumo analisar a fundo", description: "Intermediário" },
  { value: "advanced", label: "Faço minhas próprias análises fundamentalistas", description: "Avançado" },
]

const FOCUS_OPTIONS: Option[] = [
  { value: "dividends", label: "Renda passiva", description: "Receber dividendos" },
  { value: "growth", label: "Crescimento", description: "Valorização das ações" },
  { value: "both", label: "Os dois", description: "Dividendos e crescimento" },
  { value: "explore", label: "Explorar e aprender" },
]

/** Primeiros passos: levam direto ao que o Premium entrega (o teste dura 1 dia). */
const FIRST_STEPS = [
  {
    href: "/acao/petr4",
    title: "Abrir o valuation completo de uma ação",
    description: "Modelos de valuation lado a lado, preço justo estimado, margem de segurança e histórico. Exemplo: PETR4.",
  },
  {
    href: "/dashboard/monitoramentos-customizados/criar",
    title: "Criar um alerta de preço",
    description: "Receba um e-mail quando o ativo chegar ao preço que você definir.",
  },
  {
    href: "/ranking?model=barsi",
    title: "Gerar um ranking Barsi ou Gordon",
    description: "Ações pagadoras de dividendos ordenadas por preço-teto ou pelo modelo de Gordon.",
  },
] as const

function splitAcquisition(saved?: string | null): { source: string; detail: string } {
  if (!saved) return { source: "", detail: "" }
  if (saved.startsWith("other: ")) return { source: "other", detail: saved.replace("other: ", "") }
  return { source: saved, detail: "" }
}

export function OnboardingModal({ isOpen, onClose, onComplete, onlyQuestions, pendingQuestions, savedData }: OnboardingModalProps) {
  const { data: session } = useSession()
  const { isPremium, isTrialActive } = usePremiumStatus()
  const partial = Boolean(onlyQuestions && onlyQuestions.length > 0)
  const questions = partial
    ? QUESTION_ORDER.filter((q) => onlyQuestions!.includes(q))
    : pendingQuestions
      ? // O status não lista o nome: ele conta como pendente só se ainda não foi salvo
        QUESTION_ORDER.filter((q) => (q === "name" ? !savedData?.name : pendingQuestions.includes(q)))
      : QUESTION_ORDER

  // O provider só monta o modal quando ele abre: o estado inicial vem das respostas salvas
  const initialAcquisition = splitAcquisition(savedData?.acquisitionSource)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(() => (partial ? questions[0] ?? "welcome" : "welcome"))
  const [name, setName] = useState(savedData?.name ?? "")
  const [acquisitionSource, setAcquisitionSource] = useState(initialAcquisition.source)
  const [acquisitionOtherDetail, setAcquisitionOtherDetail] = useState(initialAcquisition.detail)
  const [experienceLevel, setExperienceLevel] = useState(savedData?.experienceLevel ?? "")
  const [investmentFocus, setInvestmentFocus] = useState(savedData?.investmentFocus ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const markedSeenRef = useRef(false)

  // Registra que o onboarding foi exibido (lastOnboardingSeenAt), uma vez por abertura
  useEffect(() => {
    if (!isOpen) {
      markedSeenRef.current = false
      return
    }
    if (markedSeenRef.current || !session?.user?.email) return
    markedSeenRef.current = true
    fetch("/api/user/onboarding/mark-seen", { method: "POST", headers: { "Content-Type": "application/json" } }).catch(
      (error) => console.error("Erro ao marcar onboarding como visto:", error)
    )
  }, [isOpen, session?.user?.email])

  const finalAcquisition = () => {
    if (acquisitionSource === "other") {
      const detail = acquisitionOtherDetail.trim()
      return detail ? `other: ${detail}` : savedData?.acquisitionSource ?? null
    }
    return acquisitionSource || savedData?.acquisitionSource || null
  }

  /** Salva as respostas; perguntas sem resposta nova mantêm o valor salvo. */
  const saveAnswers = async () => {
    if (!session?.user?.email) return
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || savedData?.name || null,
          acquisitionSource: finalAcquisition(),
          experienceLevel: experienceLevel || savedData?.experienceLevel || null,
          investmentFocus: investmentFocus || savedData?.investmentFocus || null,
        }),
      })
      if (!response.ok) {
        console.error("Erro ao salvar dados do onboarding")
        return
      }
      localStorage.removeItem(`onboarding-status-cache-${session.user.email}`)
    } catch (error) {
      console.error("Erro ao salvar dados do onboarding:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasAnswers = Boolean(name.trim() || acquisitionSource || experienceLevel || investmentFocus)

  /** Esc, "Fechar" ou "Agora não": guarda o que já foi respondido e fecha. */
  const handleDismiss = async () => {
    if (isSubmitting) return
    if (currentStep !== "welcome" && currentStep !== "done" && hasAnswers) {
      await saveAnswers()
      onComplete()
    }
    onClose()
  }

  const goToNextQuestion = async (from: QuestionStep) => {
    const next = questions[questions.indexOf(from) + 1]
    if (next) {
      setCurrentStep(next)
      return
    }
    await saveAnswers()
    onComplete()
    if (partial) onClose()
    else setCurrentStep("done")
  }

  const canProceed = (() => {
    switch (currentStep) {
      case "acquisition":
        return acquisitionSource === "other" ? Boolean(acquisitionOtherDetail.trim()) : Boolean(acquisitionSource)
      case "experience":
        return Boolean(experienceLevel)
      case "focus":
        return Boolean(investmentFocus)
      default:
        return true
    }
  })()

  const questionIndex = currentStep === "welcome" || currentStep === "done" ? -1 : questions.indexOf(currentStep)
  const isLastQuestion = questionIndex === questions.length - 1

  const trialNote = isTrialActive
    ? "Seu teste Premium vale por 1 dia. Comece pelo que mais importa:"
    : isPremium
      ? "Comece pelo que mais importa:"
      : "Comece pelo que mais importa. Alguns recursos fazem parte do plano Premium."

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-lg">
        {currentStep === "welcome" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl text-balance">Boas-vindas ao Preço Justo AI</DialogTitle>
              <DialogDescription>{trialNote}</DialogDescription>
            </DialogHeader>
            <FirstStepsList onNavigate={onClose} />
            <DialogFooter>
              <Button variant="ghost" onClick={handleDismiss}>
                Agora não
              </Button>
              {questions.length > 0 && (
                <Button variant="outline" onClick={() => setCurrentStep(questions[0])}>
                  {questions.length === 1 ? "Personalizar em 1 pergunta" : `Personalizar em ${questions.length} perguntas`}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {currentStep === "done" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Tudo pronto</DialogTitle>
              <DialogDescription>{trialNote}</DialogDescription>
            </DialogHeader>
            <FirstStepsList onNavigate={onClose} />
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}

        {questionIndex >= 0 && (
          <form
            className="grid min-w-0 gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (canProceed && !isSubmitting) goToNextQuestion(currentStep as QuestionStep)
            }}
          >
            <DialogHeader>
              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                Pergunta {questionIndex + 1} de {questions.length}
              </p>
              <DialogTitle className="text-xl leading-snug">
                {currentStep === "name" && "Como podemos te chamar?"}
                {currentStep === "acquisition" && "Como você conheceu o Preço Justo AI?"}
                {currentStep === "experience" && "Qual frase descreve melhor você como investidor?"}
                {currentStep === "focus" && "Qual é o seu foco principal na bolsa?"}
              </DialogTitle>
              <DialogDescription>
                {currentStep === "name" && "Opcional. Usamos só para personalizar a saudação."}
                {currentStep === "acquisition" && "Isso nos ajuda a saber onde investir nosso esforço."}
                {currentStep === "experience" && "Adaptamos as explicações e a linguagem ao seu nível."}
                {currentStep === "focus" && "Destacamos os rankings e ferramentas mais úteis para você."}
              </DialogDescription>
            </DialogHeader>

            {currentStep === "name" && (
              <div className="grid gap-2">
                <Label htmlFor="onboarding-name" className="sr-only">
                  Seu nome
                </Label>
                <Input
                  id="onboarding-name"
                  placeholder="Seu nome"
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {currentStep === "acquisition" && (
              <div className="grid gap-3">
                <OptionList
                  name="acquisition"
                  legend="Como você conheceu o Preço Justo AI?"
                  options={ACQUISITION_OPTIONS}
                  value={acquisitionSource}
                  onChange={(value) => {
                    setAcquisitionSource(value)
                    if (value !== "other") setAcquisitionOtherDetail("")
                  }}
                />
                {acquisitionSource === "other" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="onboarding-acquisition-detail">Onde você nos encontrou?</Label>
                    <Input
                      id="onboarding-acquisition-detail"
                      value={acquisitionOtherDetail}
                      onChange={(e) => setAcquisitionOtherDetail(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep === "experience" && (
              <OptionList
                name="experience"
                legend="Qual frase descreve melhor você como investidor?"
                options={EXPERIENCE_OPTIONS}
                value={experienceLevel}
                onChange={setExperienceLevel}
              />
            )}

            {currentStep === "focus" && (
              <OptionList
                name="focus"
                legend="Qual é o seu foco principal na bolsa?"
                options={FOCUS_OPTIONS}
                value={investmentFocus}
                onChange={setInvestmentFocus}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => goToNextQuestion(currentStep as QuestionStep)}
              >
                Pular
              </Button>
              <Button type="submit" disabled={!canProceed || isSubmitting}>
                {isSubmitting ? "Salvando…" : isLastQuestion ? "Concluir" : "Continuar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FirstStepsList({ onNavigate }: { onNavigate: () => void }) {
  return (
    <ol className="divide-y divide-border rounded-lg border border-border">
      {FIRST_STEPS.map((step, index) => (
        <li key={step.href}>
          <Link
            href={step.href}
            onClick={onNavigate}
            className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="w-4 shrink-0 text-sm font-medium text-muted-foreground tabular-nums">{index + 1}</span>
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="block text-sm font-medium text-foreground">{step.title}</span>
              <span className="block text-xs text-muted-foreground">{step.description}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  )
}

/** Grupo de opções com rádio nativo (setas do teclado navegam entre as opções). */
function OptionList({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string
  legend: string
  options: Option[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const checked = value === option.value
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring",
              checked ? "border-brand bg-brand-subtle" : "border-border"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--brand)] outline-none"
            />
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium text-foreground">{option.label}</span>
              {option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
