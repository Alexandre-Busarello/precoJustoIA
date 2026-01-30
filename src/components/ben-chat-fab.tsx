'use client'

/**
 * Ben Chat FAB - Floating Action Button para abrir o chat do Ben
 * Com popup proativo para engajamento
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { BenChatSidebar } from './ben-chat-sidebar'
import { BenProactivePopup, useBenProactivePopup } from './ben-proactive-popup'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

export function BenChatFAB() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const { showPopup, popupData, handleClose, handleStartConversation } = useBenProactivePopup()

  // Não mostrar se usuário não estiver logado
  if (!session) {
    return null
  }

  const handleFabClick = () => {
    handleClose() // Fechar popup se estiver aberto
    setIsOpen(true)
  }

  const handleStartFromPopup = () => {
    handleStartConversation()
    setIsOpen(true)
  }

  return (
    <>
      {/* Popup Proativo */}
      {showPopup && popupData.message && (
        <BenProactivePopup
          show={showPopup}
          onClose={handleClose}
          onStartConversation={handleStartFromPopup}
          messageType={popupData.messageType}
          message={popupData.message}
        />
      )}

      {/* FAB Button */}
      <Button
        onClick={handleFabClick}
        className={cn(
          'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50',
          'w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg',
          'p-0 overflow-hidden',
          'bg-gradient-to-br from-blue-600 to-violet-600',
          'hover:from-blue-700 hover:to-violet-700',
          'active:scale-95', // Feedback visual em mobile
          'flex items-center justify-center',
          'transition-all duration-300',
          'hover:scale-110',
          'touch-manipulation', // Melhorar toque em mobile
          'min-w-[56px] min-h-[56px]' // Garantir tamanho mínimo para toque
        )}
        aria-label="Abrir chat do Ben"
      >
        <Image 
          src="/ben.png" 
          alt="Ben" 
          width={64} 
          height={64} 
          className="w-full h-full object-cover rounded-full"
        />
      </Button>

      <BenChatSidebar open={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}

