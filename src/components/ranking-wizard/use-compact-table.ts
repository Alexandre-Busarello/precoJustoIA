'use client'

import { useSyncExternalStore } from 'react'

/** Abaixo de `sm` (640 px) as tabelas do ranking juntam o nome ao ticker para os valores caberem sem rolar. */
const QUERY = '(max-width: 639.98px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** `true` em telas estreitas. No servidor devolve `false` (layout de desktop) e corrige na hidratação. */
export function useCompactTable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
