'use client'

import { TrendingUp, Clock, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WizardFlow } from '../types'

interface StepDestinationProps {
  isLoggedIn: boolean
  onSelect: (flow: WizardFlow) => void
}

export function StepDestination({ isLoggedIn, onSelect }: StepDestinationProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          O que você quer fazer?
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
          Crie um novo ranking ou consulte análises anteriores
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card: Criar novo ranking */}
        <button
          onClick={() => onSelect('new')}
          className="group relative flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:shadow-xl transition-all duration-200 active:scale-[0.98] min-h-[172px] cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-200 dark:shadow-blue-900 group-hover:scale-110 transition-transform duration-200">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Criar novo ranking
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
            Escolha um modelo de análise e gere um ranking personalizado
          </p>
        </button>

        {/* Card: Ver histórico */}
        <button
          onClick={() => isLoggedIn ? onSelect('history') : undefined}
          disabled={!isLoggedIn}
          className={`group relative flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl border-2 transition-all duration-200 min-h-[172px] ${
            isLoggedIn
              ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 hover:shadow-lg active:scale-[0.98] cursor-pointer'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 opacity-70 cursor-not-allowed'
          }`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg transition-transform duration-200 ${
            isLoggedIn
              ? 'bg-gradient-to-br from-green-500 to-teal-600 shadow-green-200 dark:shadow-green-900 group-hover:scale-110'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}>
            {isLoggedIn ? (
              <Clock className="w-7 h-7 text-white" />
            ) : (
              <Lock className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Ver histórico
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
            {isLoggedIn
              ? 'Acesse e releia seus rankings anteriores'
              : 'Faça login para acessar seu histórico de rankings'}
          </p>
          {!isLoggedIn && (
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Lock className="w-3 h-3" />
              Requer login
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
