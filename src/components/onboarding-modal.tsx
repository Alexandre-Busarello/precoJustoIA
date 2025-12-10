"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Hand, TrendingUp, Target, Sparkles } from "lucide-react"

type OnboardingStep = "welcome" | "acquisition" | "experience" | "focus"

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  onlyQuestions?: string[] // Se fornecido, mostra apenas essas perguntas (ex: ['acquisition', 'experience'])
  savedData?: {
    acquisitionSource?: string | null
    experienceLevel?: string | null
    investmentFocus?: string | null
  } // Dados já salvos do onboarding para preservar ao voltar
}

const ACQUISITION_OPTIONS = [
  { value: "google", label: "Pesquisei no Google" },
  { value: "youtube", label: "Vi um vídeo no YouTube" },
  { value: "friend", label: "Indicação de um amigo ou colega" },
  { value: "instagram", label: "Instagram / Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "article", label: "Vi em um artigo ou notícia (Blog, Portal)" },
  { value: "other", label: "Outro" },
]

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Estou começando agora", description: "Iniciante" },
  { value: "intermediate", label: "Já invisto, mas não costumo analisar a fundo", description: "Intermediário" },
  { value: "advanced", label: "Já faço minhas próprias análises fundamentalistas", description: "Avançado" },
]

const FOCUS_OPTIONS = [
  { value: "dividends", label: "Renda Passiva", description: "Receber Dividendos" },
  { value: "growth", label: "Crescimento", description: "Valorização das Ações" },
  { value: "both", label: "Ambos", description: "Dividendos + Crescimento" },
  { value: "explore", label: "Apenas explorar e aprender", description: "" },
]

export function OnboardingModal({ isOpen, onClose, onComplete, onlyQuestions, savedData }: OnboardingModalProps) {
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome")
  const [acquisitionSource, setAcquisitionSource] = useState<string>("")
  const [acquisitionOtherDetail, setAcquisitionOtherDetail] = useState<string>("")
  const [experienceLevel, setExperienceLevel] = useState<string>("")
  const [investmentFocus, setInvestmentFocus] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Registrar que a modal apareceu (marcar lastOnboardingSeenAt) quando modal abre pela primeira vez
  const [hasMarkedAsSeen, setHasMarkedAsSeen] = useState(false)
  
  useEffect(() => {
    // Quando modal abre pela primeira vez, marcar como visto
    if (isOpen && !hasMarkedAsSeen && session?.user?.email) {
      // Chamar endpoint para marcar como visto (sem salvar dados ainda)
      fetch("/api/user/onboarding/mark-seen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then(() => {
          setHasMarkedAsSeen(true)
          console.log('[Onboarding] Modal marcada como vista')
        })
        .catch((error) => {
          console.error("Erro ao marcar onboarding como visto:", error)
        })
    }
  }, [isOpen, hasMarkedAsSeen, session?.user?.email])

  // Carregar dados salvos quando o modal abre
  useEffect(() => {
    if (isOpen) {
      // Se onlyQuestions for fornecido, pular welcome e ir direto para a primeira pergunta
      if (onlyQuestions && onlyQuestions.length > 0) {
        // Determinar o primeiro passo baseado nas perguntas faltantes
        if (onlyQuestions.includes('acquisition')) {
          setCurrentStep("acquisition")
        } else if (onlyQuestions.includes('experience')) {
          setCurrentStep("experience")
        } else if (onlyQuestions.includes('focus')) {
          setCurrentStep("focus")
        } else {
          setCurrentStep("welcome")
        }
      } else {
        setCurrentStep("welcome")
      }
      
      // Carregar dados salvos se existirem (quando voltando para complementar)
      if (savedData) {
        if (savedData.acquisitionSource) {
          // Se for "other: detalhe", separar
          if (savedData.acquisitionSource.startsWith('other: ')) {
            setAcquisitionSource("other")
            setAcquisitionOtherDetail(savedData.acquisitionSource.replace('other: ', ''))
          } else {
            setAcquisitionSource(savedData.acquisitionSource)
          }
        }
        if (savedData.experienceLevel) {
          setExperienceLevel(savedData.experienceLevel)
        }
        if (savedData.investmentFocus) {
          setInvestmentFocus(savedData.investmentFocus)
        }
      } else {
        // Se não há dados salvos, resetar tudo (onboarding novo)
        setAcquisitionSource("")
        setAcquisitionOtherDetail("")
        setExperienceLevel("")
        setInvestmentFocus("")
      }
    } else {
      // Quando modal fecha, resetar flag para permitir marcar novamente se reabrir
      setHasMarkedAsSeen(false)
    }
  }, [isOpen, onlyQuestions, savedData])

  // Resetar detalhe quando mudar de seleção
  useEffect(() => {
    if (acquisitionSource !== "other") {
      setAcquisitionOtherDetail("")
    }
  }, [acquisitionSource])

  const handleSkip = async () => {
    if (currentStep === "welcome") {
      await saveOnboardingData(null, null, null)
      onClose()
      return
    }

    // Avançar para o próximo passo ou fechar
    if (currentStep === "acquisition") {
      const next = getNextStep("acquisition")
      if (next) {
        setCurrentStep(next)
      } else {
        // Não há mais perguntas, salvar e fechar
        await saveOnboardingData(acquisitionSource || null, experienceLevel || null, investmentFocus || null)
        onClose()
      }
    } else if (currentStep === "experience") {
      const next = getNextStep("experience")
      if (next) {
        setCurrentStep(next)
      } else {
        // Não há mais perguntas, salvar e fechar
        await saveOnboardingData(acquisitionSource || null, experienceLevel || null, investmentFocus || null)
        onClose()
      }
    } else if (currentStep === "focus") {
      // Preparar acquisition com detalhe se for "other"
      let finalAcquisition = acquisitionSource || null
      if (acquisitionSource === "other" && acquisitionOtherDetail.trim()) {
        finalAcquisition = `other: ${acquisitionOtherDetail.trim()}`
      }
      await saveOnboardingData(finalAcquisition, experienceLevel || null, investmentFocus || null)
      onClose()
    }
  }

  // Função auxiliar para determinar o próximo passo válido
  const getNextStep = (current: OnboardingStep): OnboardingStep | null => {
    if (onlyQuestions && onlyQuestions.length > 0) {
      // Se estamos mostrando apenas perguntas específicas, pular as que não estão na lista
      const steps = ["acquisition", "experience", "focus"] as OnboardingStep[]
      const currentIndex = steps.indexOf(current)
      
      for (let i = currentIndex + 1; i < steps.length; i++) {
        const step = steps[i]
        if (step === "acquisition" && onlyQuestions.includes("acquisition")) return step
        if (step === "experience" && onlyQuestions.includes("experience")) return step
        if (step === "focus" && onlyQuestions.includes("focus")) return step
      }
      return null // Não há mais perguntas
    }
    
    // Comportamento normal
    if (current === "welcome") return "acquisition"
    if (current === "acquisition") return "experience"
    if (current === "experience") return "focus"
    return null
  }

  const handleNext = async () => {
    if (currentStep === "welcome") {
      const next = getNextStep("welcome")
      if (next) {
        setCurrentStep(next)
      }
      return
    }

    if (currentStep === "acquisition") {
      if (!acquisitionSource) return
      const next = getNextStep("acquisition")
      if (next) {
        setCurrentStep(next)
      } else {
        // Última pergunta, salvar e fechar
        await saveOnboardingData(acquisitionSource || null, experienceLevel || null, investmentFocus || null)
        onComplete()
        onClose()
      }
      return
    }

    if (currentStep === "experience") {
      if (!experienceLevel) return
      const next = getNextStep("experience")
      if (next) {
        setCurrentStep(next)
      } else {
        // Última pergunta, salvar e fechar
        await saveOnboardingData(acquisitionSource || null, experienceLevel || null, investmentFocus || null)
        onComplete()
        onClose()
      }
      return
    }

    if (currentStep === "focus") {
      if (!investmentFocus) return
      await saveOnboardingData(acquisitionSource || null, experienceLevel || null, investmentFocus)
      onComplete()
      onClose()
    }
  }

  const saveOnboardingData = async (
    acquisition: string | null,
    experience: string | null,
    focus: string | null
  ) => {
    if (!session?.user?.email) return

    setIsSubmitting(true)
    try {
      // Preparar dados preservando valores já salvos
      // Se não há valor novo mas há valor salvo, usar o valor salvo para preservar
      // Se não há valor novo nem salvo, enviar null (pular pergunta)
      // Se há valor novo, usar o valor novo
      
      let finalAcquisition: string | null = acquisition || null
      if (acquisition === "other" && acquisitionOtherDetail.trim()) {
        finalAcquisition = `other: ${acquisitionOtherDetail.trim()}`
      } else if (!acquisition && savedData?.acquisitionSource) {
        // Preservar valor salvo se não há valor novo
        finalAcquisition = savedData.acquisitionSource
      }

      let finalExperience: string | null = experience || null
      if (!experience && savedData?.experienceLevel) {
        // Preservar valor salvo se não há valor novo
        finalExperience = savedData.experienceLevel
      }

      let finalFocus: string | null = focus || null
      if (!focus && savedData?.investmentFocus) {
        // Preservar valor salvo se não há valor novo
        finalFocus = savedData.investmentFocus
      }

      // Sempre enviar todos os valores para garantir que valores salvos sejam preservados
      const payload = {
        acquisitionSource: finalAcquisition,
        experienceLevel: finalExperience,
        investmentFocus: finalFocus,
      }

      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error("Erro ao salvar dados do onboarding")
        return
      }

      // Limpar cache do localStorage após salvar com sucesso
      if (session?.user?.email) {
        const cacheKey = `onboarding-status-cache-${session.user.email}`
        localStorage.removeItem(cacheKey)
        console.log('[Onboarding] Cache limpo após salvar dados')
      }
    } catch (error) {
      console.error("Erro ao salvar dados do onboarding:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStepNumber = () => {
    switch (currentStep) {
      case "acquisition":
        return "1 de 3"
      case "experience":
        return "2 de 3"
      case "focus":
        return "3 de 3"
      default:
        return ""
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case "acquisition":
        // Se selecionou "other", precisa preencher o detalhe
        if (acquisitionSource === "other") {
          return !!acquisitionOtherDetail.trim()
        }
        return !!acquisitionSource
      case "experience":
        return !!experienceLevel
      case "focus":
        return !!investmentFocus
      default:
        return true
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-lg max-h-[90vh] overflow-y-auto" 
        showCloseButton={false}
      >
        {/* Welcome Step */}
        {currentStep === "welcome" && (
          <div className="space-y-6 py-4">
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Hand className="w-8 h-8 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold">
                👋 Boas-vindas ao Preço Justo AI!
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                Vamos personalizar sua experiência. São 3 perguntas rápidas para te ajudar a encontrar as melhores oportunidades da bolsa.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleNext}
                className="flex-1"
                size="lg"
              >
                Vamos lá!
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
                size="lg"
                disabled={isSubmitting}
              >
                Pular por enquanto
              </Button>
            </div>
          </div>
        )}

        {/* Acquisition Step */}
        {currentStep === "acquisition" && (
          <div className="space-y-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Pergunta {getStepNumber()}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                Como você chegou até aqui?
                <br />
                <span className="text-sm text-muted-foreground">
                  Isso nos ajuda muito a saber onde focar nossos esforços.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {ACQUISITION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAcquisitionSource(option.value)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border-2 transition-all",
                    "hover:border-primary hover:bg-accent",
                    acquisitionSource === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        acquisitionSource === option.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}
                    >
                      {acquisitionSource === option.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Campo de detalhe quando "Outro" é selecionado */}
            {acquisitionSource === "other" && (
              <div className="pt-2">
                <Input
                  type="text"
                  placeholder="Por favor, nos conte como você chegou até aqui..."
                  value={acquisitionOtherDetail}
                  onChange={(e) => setAcquisitionOtherDetail(e.target.value)}
                  className="w-full"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este campo é obrigatório quando você seleciona &quot;Outro&quot;
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleNext}
                className="flex-1"
                size="lg"
                disabled={!canProceed() || isSubmitting}
              >
                Próximo
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
                size="lg"
                disabled={isSubmitting}
              >
                Pular esta pergunta
              </Button>
            </div>
          </div>
        )}

        {/* Experience Step */}
        {currentStep === "experience" && (
          <div className="space-y-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Pergunta {getStepNumber()}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                Qual frase te descreve melhor como investidor?
                <br />
                <span className="text-sm text-muted-foreground">
                  Vamos adaptar as dicas e a linguagem para você.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {EXPERIENCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setExperienceLevel(option.value)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border-2 transition-all",
                    "hover:border-primary hover:bg-accent",
                    experienceLevel === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                        experienceLevel === option.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}
                    >
                      {experienceLevel === option.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          ({option.description})
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleNext}
                className="flex-1"
                size="lg"
                disabled={!canProceed() || isSubmitting}
              >
                Próximo
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
                size="lg"
                disabled={isSubmitting}
              >
                Pular esta pergunta
              </Button>
            </div>
          </div>
        )}

        {/* Focus Step */}
        {currentStep === "focus" && (
          <div className="space-y-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Pergunta {getStepNumber()}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                Qual é o seu foco principal na bolsa?
                <br />
                <span className="text-sm text-muted-foreground">
                  Vamos te mostrar os rankings e ferramentas certos.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {FOCUS_OPTIONS.map((option) => {
                const Icon = option.value === "dividends" ? Target : 
                            option.value === "growth" ? TrendingUp :
                            option.value === "both" ? Sparkles : Hand
                
                return (
                  <button
                    key={option.value}
                    onClick={() => setInvestmentFocus(option.value)}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border-2 transition-all",
                      "hover:border-primary hover:bg-accent",
                      investmentFocus === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                          investmentFocus === option.value
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        )}
                      >
                        {investmentFocus === option.value && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {option.label}
                        </div>
                        {option.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            ({option.description})
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleNext}
                className="flex-1"
                size="lg"
                disabled={!canProceed() || isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Concluir e Explorar!"}
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
                size="lg"
                disabled={isSubmitting}
              >
                Pular esta pergunta
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

