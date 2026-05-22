'use client'

import { ChevronLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RankingHistorySection } from '@/components/ranking-history-section'

interface StepHistoryProps {
  onLoadRanking: (id: string) => void
  onBack: () => void
  onCreateNew: () => void
  refreshTrigger?: number
}

export function StepHistory({ onLoadRanking, onBack, onCreateNew, refreshTrigger }: StepHistoryProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
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
            Histórico de Rankings
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
            Clique em um ranking para visualizá-lo
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateNew}
          className="gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo ranking</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      <RankingHistorySection
        onLoadRanking={onLoadRanking}
        refreshTrigger={refreshTrigger}
      />
    </div>
  )
}
