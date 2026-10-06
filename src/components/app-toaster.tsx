'use client'

import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

/** Toaster global (sonner) seguindo o tema resolvido. */
export function AppToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster position="top-right" theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
  )
}
