'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { getRegisteredContext, resolvePageContext, subscribePageContext } from '@/lib/ben-context/store'
import type { BenPageContext } from '@/lib/ben-context/types'

/** Contexto da tela atual para o Ben: o da rota, completado pelo que a página registrou. */
export function useBenPageContext(): { pathname: string; context: BenPageContext } {
  const pathname = usePathname() ?? '/'
  const registered = useSyncExternalStore(
    subscribePageContext,
    () => getRegisteredContext(pathname),
    () => null
  )
  // `registered` muda de referência a cada novo registro: recalcula só então (passá-lo de novo não muda o resultado)
  const context = useMemo(() => resolvePageContext(pathname, registered), [pathname, registered])
  return { pathname, context }
}
