'use client'

/**
 * FAB do Ben: botão flutuante que abre o chat. Montado uma vez no layout raiz.
 * Só aparece com sessão, fica acima da bottom nav no mobile e some em checkout, login, cadastro, oferta e admin.
 * O contexto da página (ticker etc.) é lido do pathname pelo próprio chat.
 */

import { useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BenChatSidebar } from './ben-chat-sidebar'
import { isAppChromeHidden } from '@/lib/navigation'

export function BenChatFAB() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  if (!session || isAppChromeHidden(pathname)) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir chat do Ben"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 size-12 touch-manipulation overflow-hidden rounded-full border border-border bg-background shadow-md transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none active:scale-95 lg:right-6 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <Image src="/ben.png" alt="" width={48} height={48} className="size-full object-cover" />
      </button>

      <BenChatSidebar open={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}
