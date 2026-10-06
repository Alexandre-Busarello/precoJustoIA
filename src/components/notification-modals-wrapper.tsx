"use client"

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NotificationModal } from './notification-modal'
import { QuizModal } from './quiz-modal'
import { useOnboardingStatus } from './onboarding-provider'
import { useNotificationModal } from '@/hooks/use-notification-modal'
import { useQuiz } from '@/hooks/use-quiz'
import { claimModalSlot, releaseModalSlot } from '@/lib/interruptions'

const SLOT_ID = 'notification'

/**
 * Comunicados (MODAL) e pesquisas (QUIZ) pendentes no dashboard.
 * Respeita a política de interrupções: espera o onboarding (que tem prioridade), só abre se o slot
 * da página estiver livre e nunca abre um segundo modal na mesma visualização.
 * Comunicados abertos pelo sino (`manuallyOpened`) são pedido do usuário e não passam pelo slot.
 */
export function NotificationModalsWrapper() {
  const { notification, markAsViewed } = useNotificationModal()
  const onboarding = useOnboardingStatus()
  const queryClient = useQueryClient()
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)

  const manuallyOpened = Boolean(notification && (notification as { manuallyOpened?: boolean }).manuallyOpened)
  const quizCampaignId =
    notification?.displayType === 'QUIZ' && notification.campaignId === activeCampaignId ? activeCampaignId : undefined
  const { quiz, markAsViewed: markQuizAsViewed } = useQuiz(quizCampaignId)

  useEffect(() => {
    if (!notification) {
      setActiveCampaignId(null)
      return
    }
    if (activeCampaignId === notification.campaignId) return
    if (manuallyOpened) {
      setActiveCampaignId(notification.campaignId)
      return
    }
    // Onboarding primeiro: não abrir enquanto ele estiver pendente ou aberto
    if (onboarding.pending || onboarding.shouldShowOnboarding) return
    if (claimModalSlot(SLOT_ID)) setActiveCampaignId(notification.campaignId)
  }, [notification, manuallyOpened, activeCampaignId, onboarding.pending, onboarding.shouldShowOnboarding])

  const finish = () => {
    setActiveCampaignId(null)
    if (!manuallyOpened) releaseModalSlot(SLOT_ID)
  }

  const handleNotificationClose = (dismissed: boolean) => {
    if (!notification) return
    if (manuallyOpened) {
      queryClient.setQueryData(['notifications', 'modal'], { notification: null })
    } else {
      markAsViewed(notification.campaignId, dismissed)
    }
    finish()
  }

  const handleQuizClose = () => {
    if (!manuallyOpened && quizCampaignId) markQuizAsViewed?.(quizCampaignId)
    finish()
  }

  if (!notification || activeCampaignId !== notification.campaignId) return null

  if (notification.displayType === 'MODAL') {
    return <NotificationModal key={notification.campaignId} notification={notification} open onClose={handleNotificationClose} />
  }

  if (notification.displayType === 'QUIZ' && quiz && quizCampaignId) {
    return <QuizModal key={quizCampaignId} campaignId={quizCampaignId} onClose={handleQuizClose} />
  }

  return null
}
