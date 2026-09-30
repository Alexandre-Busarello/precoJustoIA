"use client"

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'

import { NotificationMarkdown } from '@/components/notification-markdown'
import type { PageNoticeSource } from '@/components/page-notice'

interface DashboardNotification {
  id: string
  title: string
  message: string
  link: string | null
  linkType: 'INTERNAL' | 'EXTERNAL'
  ctaText?: string | null
}

const DISMISS_PREFIX = 'pja-notice-dismissed:'

function readDismissed(id: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + id) === '1'
  } catch {
    return false
  }
}

/**
 * Campanha em destaque do dashboard, exibida como aviso inline neutro no PageNotice
 * (as cores e templates configurados no admin são ignorados de propósito).
 */
export function useCampaignNotice({ enabled }: { enabled: boolean }): PageNoticeSource {
  const { data, isLoading } = useQuery<{ notification: DashboardNotification | null }>({
    queryKey: ['notifications', 'dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/dashboard')
      if (!res.ok) return { notification: null }
      return res.json()
    },
    enabled,
  })
  const notification = data?.notification ?? null
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  useEffect(() => {
    if (notification && readDismissed(notification.id)) setDismissedId(notification.id)
  }, [notification])

  if (!enabled || isLoading) return { pending: true, notice: null }
  if (!notification || dismissedId === notification.id) return { pending: false, notice: null }

  const dismiss = () => {
    setDismissedId(notification.id)
    try {
      window.localStorage.setItem(DISMISS_PREFIX + notification.id, '1')
    } catch {
      // Sem localStorage: o aviso some só nesta visita
    }
  }

  return {
    pending: false,
    notice: {
      id: 'campaign',
      icon: Megaphone,
      title: <NotificationMarkdown content={notification.title} inline />,
      description: <NotificationMarkdown content={notification.message} className="line-clamp-3" />,
      action: notification.link
        ? {
            label: notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link'),
            href: notification.link,
            external: notification.linkType === 'EXTERNAL',
          }
        : undefined,
      onDismiss: dismiss,
    },
  }
}
