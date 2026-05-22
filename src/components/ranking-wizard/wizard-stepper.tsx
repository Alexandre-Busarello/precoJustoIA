'use client'

import { Check, BarChart3, Clock, Settings, TrendingUp } from 'lucide-react'
import type { WizardFlow, WizardStepId } from './types'
import { cn } from '@/lib/utils'

interface StepDef {
  id: WizardStepId
  label: string
  icon: React.ReactNode
}

const NEW_FLOW_STEPS: StepDef[] = [
  { id: 'asset-type', label: 'Tipo de ativo', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'configure', label: 'Configurar modelo', icon: <Settings className="w-4 h-4" /> },
]

const HISTORY_FLOW_STEPS: StepDef[] = [
  { id: 'history', label: 'Histórico', icon: <Clock className="w-4 h-4" /> },
  { id: 'configure', label: 'Ver ranking', icon: <TrendingUp className="w-4 h-4" /> },
]

interface WizardStepperProps {
  flow: WizardFlow | null
  currentStep: WizardStepId
}

export function WizardStepper({ flow, currentStep }: WizardStepperProps) {
  if (!flow) return null

  const steps = flow === 'history' ? HISTORY_FLOW_STEPS : NEW_FLOW_STEPS
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="flex items-center justify-center gap-0 mb-6 px-4">
      {steps.map((step, idx) => {
        const isDone = idx < currentIndex
        const isActive = idx === currentIndex
        const isPending = idx > currentIndex

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 transition-all duration-300',
                  'w-8 h-8 sm:w-10 sm:h-10',
                  isDone && 'bg-blue-600 border-blue-600 text-white',
                  isActive && 'bg-white border-blue-600 text-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900',
                  isPending && 'bg-slate-100 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-600',
                )}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <span className="sm:hidden text-xs font-bold">{idx + 1}</span>
                )}
                <span className={cn('hidden sm:flex', isDone ? 'hidden' : '')}>
                  {!isDone && step.icon}
                </span>
              </div>
              {/* Label — hidden on mobile */}
              <span
                className={cn(
                  'hidden sm:block text-xs font-medium mt-1 text-center max-w-[80px] leading-tight',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-10 sm:w-16 mx-1 sm:mx-2 transition-all duration-500',
                  isDone ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
