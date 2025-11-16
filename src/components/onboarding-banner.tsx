"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface OnboardingBannerProps {
  missingQuestions: string[]
  onComplete: () => void
  onDismiss: () => void
}

const QUESTION_LABELS: Record<string, string> = {
  acquisition: "Como você chegou até aqui?",
  experience: "Seu nível de experiência",
  focus: "Seu foco de investimento",
}

export function OnboardingBanner({ missingQuestions, onComplete, onDismiss }: OnboardingBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed || missingQuestions.length === 0) {
    return null
  }

  const questionCount = missingQuestions.length
  const questionLabels = missingQuestions.map(q => QUESTION_LABELS[q] || q).join(", ")

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss()
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <HelpCircle className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Quer nos ajudar a melhorar?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Notei que você pulou {questionCount === 1 ? "uma pergunta" : `${questionCount} perguntas`}. 
              Quer completar o onboarding? Isso nos ajuda a personalizar sua experiência.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onComplete}
            size="sm"
            className="flex-1 text-xs h-8"
          >
            Completar agora
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  )
}

