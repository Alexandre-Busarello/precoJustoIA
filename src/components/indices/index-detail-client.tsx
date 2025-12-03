'use client'

import { IndexAssetPerformance } from '@/components/indices/index-asset-performance'

interface IndexDetailClientProps {
  ticker: string
}

export function IndexDetailClient({ ticker }: IndexDetailClientProps) {
  return <IndexAssetPerformance ticker={ticker} />
}

