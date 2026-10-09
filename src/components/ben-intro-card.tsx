'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { MessageCircle, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const BenChatSidebar = dynamic(() => import('@/components/ben-chat-sidebar').then((m) => m.BenChatSidebar), {
  ssr: false,
})

export const BEN_INTRO_DISMISSED_KEY = 'pja-ben-intro-dismissed'

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(BEN_INTRO_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Apresentação única do Ben no dashboard (substitui o popup proativo).
 * Some para sempre ao dispensar (localStorage `pja-ben-intro-dismissed`).
 */
export function BenIntroCard({ className }: { className?: string }) {
  // null = ainda não lido do localStorage (evita piscar o card para quem já dispensou)
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(BEN_INTRO_DISMISSED_KEY, '1')
    } catch {
      // Sem localStorage: o card some só nesta visita
    }
  }

  return (
    <>
      {dismissed === false && (
        <section
          aria-labelledby="ben-intro-title"
          data-ben-intro
          className={cn('flex items-start gap-3 rounded-lg border border-border bg-card py-3 pr-1 pl-4', className)}
        >
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-0.5 text-sm">
              <h2 id="ben-intro-title" className="font-medium text-foreground">
                Pergunte ao Ben sobre qualquer ativo
              </h2>
              <p className="text-muted-foreground">
                O assistente de IA explica indicadores, compara empresas e resume relatórios.
              </p>
            </div>
            <Button ref={openButtonRef} variant="outline" size="sm" className="w-fit shrink-0" onClick={() => setChatOpen(true)}>
              Abrir conversa
            </Button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dispensar apresentação do Ben"
            className="-my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </section>
      )}
      {chatOpen && <BenChatSidebar open={chatOpen} onOpenChange={setChatOpen} returnFocusRef={openButtonRef} />}
    </>
  )
}
