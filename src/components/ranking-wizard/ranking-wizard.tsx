'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuickRanker } from '@/components/quick-ranker'
import { RankingHistorySection } from '@/components/ranking-history-section'
import type { RankingUniverse } from '@/lib/ranking-models'
import { applyRankingSelection, parseRankingUrl, type RankingTab } from './ranking-url'

interface RankingWizardProps {
  isLoggedIn: boolean
  /** Sessão ainda carregando: a aba Histórico espera antes de pedir login. */
  sessionLoading?: boolean
}

/** Troca de aba com fade curto; some com `prefers-reduced-motion`. */
const TAB_TRANSITION = 'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none'

/**
 * Ferramenta de rankings: abre direto no ranking padrão (aba Ranking) e guarda os rankings gerados na aba Histórico.
 * O estado vive na URL: `?tab=historico`, `?id=<ranking salvo>`, `?assetType=` e `?model=` (links antigos continuam valendo).
 */
export function RankingWizard({ isLoggedIn, sessionLoading = false }: RankingWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [initial] = useState(() => parseRankingUrl(searchParams))
  const { tab, rankingId } = parseRankingUrl(searchParams)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  const replaceParams = useCallback(
    (update: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString())
      update(next)
      const query = next.toString()
      router.replace(query ? `/ranking?${query}` : '/ranking', { scroll: false })
    },
    [router, searchParams]
  )

  const changeTab = (value: string) => {
    const nextTab = value as RankingTab
    replaceParams((params) => {
      params.delete('s')
      if (nextTab === 'historico') params.set('tab', 'historico')
      else params.delete('tab')
    })
  }

  const changeSelection = useCallback(
    (modelKey: string, universe: RankingUniverse) => replaceParams((params) => applyRankingSelection(params, modelKey, universe)),
    [replaceParams]
  )
  const refreshHistory = useCallback(() => setHistoryRefresh((value) => value + 1), [])

  return (
    <Tabs value={tab} onValueChange={changeTab} className="gap-6">
      <TabsList variant="underline">
        <TabsTrigger value="ranking">Ranking</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="ranking" forceMount className={`data-[state=inactive]:hidden ${TAB_TRANSITION}`}>
        <QuickRanker
          isLoggedIn={isLoggedIn}
          initialUniverse={initial.universe}
          initialModelKey={initial.modelKey}
          rankingId={rankingId}
          onRankingGenerated={refreshHistory}
          onSelectionChange={changeSelection}
        />
      </TabsContent>

      <TabsContent value="historico" className={TAB_TRANSITION}>
        {isLoggedIn ? (
          <RankingHistorySection onLoadRanking={(id) => router.push(`/ranking?id=${id}`)} refreshTrigger={historyRefresh} />
        ) : sessionLoading ? null : (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">Entre para ver seu histórico</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Com a conta grátis, cada ranking que você gera fica salvo com os parâmetros usados.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/register">Criar conta grátis</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/login?callbackUrl=%2Franking%3Ftab%3Dhistorico">Entrar</Link>
              </Button>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
