"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface OnboardingBannerProps {
  missingQuestions: string[]
  onComplete: () => void
  onDismiss: () => void
}

/**
 * Aviso inline (no fluxo da página, acima do cabeçalho) quando o usuário pulou perguntas do perfil.
 * Não flutua nem cobre conteúdo; "Dispensar" é lembrado pelo provider.
 */
export function OnboardingBanner({ missingQuestions, onComplete, onDismiss }: OnboardingBannerProps) {
  const count = missingQuestions.length
  if (count === 0) return null

  return (
    <div role="status" data-notice="onboarding" className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 py-1.5 pr-1 pl-4 text-sm sm:gap-4">
        <p className="min-w-0 flex-1 text-muted-foreground">
          <span className="font-medium text-foreground">
            {count === 1 ? "Falta 1 pergunta" : `Faltam ${count} perguntas`} do seu perfil.
          </span>{" "}
          <span className="hidden sm:inline">Com elas ajustamos as explicações e os rankings sugeridos.</span>
        </p>
        <Button variant="outline" size="sm" onClick={onComplete} className="shrink-0">
          Responder
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar aviso"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
