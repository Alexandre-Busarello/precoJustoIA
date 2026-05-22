'use client'

import { useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuickRanker, QuickRankerHandle } from '@/components/quick-ranker'
import { EtfRanker } from '@/components/etf-ranker'
import type { AssetType } from '../types'

interface StepConfigureProps {
  assetType: AssetType | null
  rankingId: string | null
  onBack: () => void
  onRankingGenerated: () => void
}

export function StepConfigure({
  assetType,
  rankingId,
  onBack,
  onRankingGenerated,
}: StepConfigureProps) {
  const quickRankerRef = useRef<QuickRankerHandle>(null)

  if (assetType === 'etf') {
    return <EtfRanker onBack={onBack} />
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-slate-600 dark:text-slate-400"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
      </div>

      <QuickRanker
        ref={quickRankerRef}
        rankingId={rankingId}
        assetTypeFilter={assetType ?? 'both'}
        onRankingGenerated={onRankingGenerated}
        onBack={onBack}
      />
    </div>
  )
}
