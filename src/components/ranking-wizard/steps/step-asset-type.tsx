'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ASSET_TYPE_OPTIONS } from '../types'
import type { AssetType } from '../types'

interface StepAssetTypeProps {
  onSelect: (assetType: AssetType) => void
  onBack: () => void
}

export function StepAssetType({ onSelect, onBack }: StepAssetTypeProps) {
  const [selected, setSelected] = useState<AssetType | null>(null)

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-slate-600 dark:text-slate-400"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Qual tipo de ativo?
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
            Selecione a classe de ativo para o ranking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {ASSET_TYPE_OPTIONS.map((option) => {
          const isSelected = selected === option.id
          return (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={cn(
                'relative flex flex-col items-center text-center p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 active:scale-[0.97] min-h-[120px] sm:min-h-[140px]',
                isSelected
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/40 shadow-lg shadow-blue-100 dark:shadow-blue-900/30'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md',
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'text-3xl sm:text-4xl mb-2 sm:mb-3 transition-transform duration-200',
                  isSelected && 'scale-110',
                )}
              >
                {option.emoji}
              </div>
              <p
                className={cn(
                  'text-sm font-bold mb-0.5',
                  isSelected
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-slate-900 dark:text-white',
                )}
              >
                {option.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight hidden sm:block">
                {option.description}
              </p>
            </button>
          )
        })}
      </div>

      <Button
        onClick={() => selected && onSelect(selected)}
        disabled={!selected}
        size="lg"
        className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed h-12 text-base font-semibold"
      >
        Continuar
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  )
}
