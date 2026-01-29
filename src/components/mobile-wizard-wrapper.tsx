'use client'

import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MobileWizardProps {
  steps: string[]
  currentStep: number
  onStepChange: (step: number) => void
  children: React.ReactNode
  onNext?: () => void
  onBack?: () => void
  canGoNext?: boolean
  canGoBack?: boolean
  nextLabel?: string
  backLabel?: string
  className?: string
}

export function MobileWizardWrapper({
  steps,
  currentStep,
  onStepChange,
  children,
  onNext,
  onBack,
  canGoNext = true,
  canGoBack = true,
  nextLabel = 'Próximo',
  backLabel = 'Voltar',
  className
}: MobileWizardProps) {
  const handleNext = () => {
    if (canGoNext && currentStep < steps.length - 1) {
      if (onNext) {
        onNext()
      } else {
        onStepChange(currentStep + 1)
      }
    }
  }

  const handleBack = () => {
    if (canGoBack && currentStep > 0) {
      if (onBack) {
        onBack()
      } else {
        onStepChange(currentStep - 1)
      }
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Indicador de Progresso */}
      <div className="flex items-center justify-center gap-2 mb-6 px-4 pt-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                index < currentStep && "bg-green-500 text-white",
                index === currentStep && "bg-blue-500 text-white",
                index > currentStep && "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              )}
            >
              {index < currentStep ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 h-1 transition-colors",
                  index < currentStep ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo da Etapa */}
      <div className="flex-1 overflow-y-auto px-4">
        {children}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between gap-4 p-4 border-t bg-background">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || !canGoBack}
          className="flex-1"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>
        <Button
          onClick={handleNext}
          disabled={currentStep === steps.length - 1 || !canGoNext}
          className="flex-1"
        >
          {nextLabel}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

