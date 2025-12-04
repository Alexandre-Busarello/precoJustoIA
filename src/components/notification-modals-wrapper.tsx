"use client"

import { useEffect, useState } from 'react'
import { NotificationModal } from './notification-modal'
import { QuizModal } from './quiz-modal'
import { useNotificationModal } from '@/hooks/use-notification-modal'
import { useQuiz } from '@/hooks/use-quiz'

export function NotificationModalsWrapper() {
  const { notification: modalNotification } = useNotificationModal()
  const [quizCampaignId, setQuizCampaignId] = useState<string | undefined>()
  const [isManualOpen, setIsManualOpen] = useState(false) // Indica se foi aberto manualmente (sininho)
  const { quiz, markAsViewed } = useQuiz(quizCampaignId)

  useEffect(() => {
    // Se modalNotification for um quiz, definir campaignId para abrir quiz modal automaticamente
    // (apenas quando está na dashboard, não quando acessado pelo sininho)
    if (modalNotification && modalNotification.displayType === 'QUIZ' && modalNotification.campaignId) {
      setQuizCampaignId(modalNotification.campaignId)
      setIsManualOpen(false) // Abertura automática na dashboard
    } else {
      // Se não é quiz, limpar quizCampaignId
      setQuizCampaignId(undefined)
      setIsManualOpen(false)
    }
  }, [modalNotification])

  const handleQuizClose = () => {
    // Se foi abertura automática (não manual), marcar como visto ao fechar
    if (!isManualOpen && quizCampaignId && markAsViewed) {
      markAsViewed(quizCampaignId)
    }
    setQuizCampaignId(undefined)
    setIsManualOpen(false)
  }

  return (
    <>
      {/* Modal de notificação normal - apenas se não for quiz */}
      {modalNotification && modalNotification.displayType === 'MODAL' && (
        <NotificationModal />
      )}
      
      {/* Modal de quiz - aparece automaticamente quando há quiz pendente OU quando aberto manualmente */}
      {quiz && quizCampaignId && (
        <QuizModal
          campaignId={quizCampaignId}
          onClose={handleQuizClose}
        />
      )}
    </>
  )
}

