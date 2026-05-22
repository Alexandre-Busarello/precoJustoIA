'use client'

import { useMemo, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { WizardState, WizardStepId, AssetType, WizardFlow } from './types'

const VALID_ASSET_TYPES: AssetType[] = ['b3', 'bdr', 'both', 'fii', 'etf']

const STEP_ORDER: Record<WizardStepId, number> = {
  destination: 0,
  history: 1,
  'asset-type': 1,
  configure: 2,
}

function deriveState(searchParams: ReturnType<typeof useSearchParams>): Omit<WizardState, 'direction'> {
  const s = searchParams.get('s')
  const assetTypeParam = searchParams.get('assetType') as AssetType | null
  const id = searchParams.get('id')
  const validAssetType = assetTypeParam && VALID_ASSET_TYPES.includes(assetTypeParam) ? assetTypeParam : null

  if (id) {
    return { step: 'configure', flow: 'history', assetType: validAssetType, rankingId: id }
  }
  if (validAssetType) {
    return { step: 'configure', flow: 'new', assetType: validAssetType, rankingId: null }
  }
  if (s === 'historico') {
    return { step: 'history', flow: 'history', assetType: null, rankingId: null }
  }
  if (s === 'tipo-ativo') {
    return { step: 'asset-type', flow: 'new', assetType: null, rankingId: null }
  }
  return { step: 'destination', flow: null, assetType: null, rankingId: null }
}

export function useWizardState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const prevStepRef = useRef<WizardStepId | null>(null)

  const baseState = useMemo(() => deriveState(searchParams), [searchParams])

  const direction: 'forward' | 'backward' = useMemo(() => {
    const prev = prevStepRef.current
    if (!prev) return 'forward'
    return STEP_ORDER[baseState.step] >= STEP_ORDER[prev] ? 'forward' : 'backward'
  }, [baseState.step])

  useEffect(() => {
    prevStepRef.current = baseState.step
  }, [baseState.step])

  const state: WizardState = { ...baseState, direction }

  const navigate = {
    selectFlow: (flow: WizardFlow) => {
      router.push(flow === 'history' ? '/ranking?s=historico' : '/ranking?s=tipo-ativo')
    },
    selectAssetType: (assetType: AssetType) => {
      router.push(`/ranking?assetType=${assetType}`)
    },
    loadRanking: (id: string) => {
      const at = baseState.assetType
      router.push(at ? `/ranking?assetType=${at}&id=${id}` : `/ranking?id=${id}`)
    },
    back: () => router.back(),
    goToDestination: () => router.push('/ranking'),
  }

  return { state, navigate }
}
