"use client"

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCheck, ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { AlertsTabs } from '@/components/alerts-tabs'
import { NotificationMarkdown } from '@/components/notification-markdown'
import { SimpleNotificationModal, type SimpleNotificationModalData } from '@/components/simple-notification-modal'
import { useNotificationModal } from '@/hooks/use-notification-modal'

interface Notification {
  id: string
  title: string
  message: string
  link: string | null
  linkType: 'INTERNAL' | 'EXTERNAL'
  type: string
  isRead: boolean
  readAt: Date | null
  createdAt: Date
  campaignId?: string | null
}

type Filter = 'all' | 'unread' | 'read'

const PAGE_SIZE = 20

const EMPTY_TEXT: Record<Filter, string> = {
  all: 'Nenhuma notificação por enquanto',
  unread: 'Nenhuma notificação não lida',
  read: 'Nenhuma notificação lida',
}

export function NotificationsPageClient() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  // "Carregar mais" amplia a janela (página 1 com limite maior) para manter as anteriores visíveis
  const [pages, setPages] = useState(1)
  const { openModalManually } = useNotificationModal()
  const [modalData, setModalData] = useState<SimpleNotificationModalData | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['notifications', filter, pages],
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === filter ? previous : undefined),
    queryFn: async () => {
      const res = await fetch(`/api/notifications?page=1&limit=${PAGE_SIZE * pages}&filter=${filter}`)
      if (!res.ok) throw new Error('Erro ao buscar notificações')
      return res.json()
    },
  })

  const notifications: Notification[] = data?.notifications || []
  const total: number = data?.total || 0
  const hasMore: boolean = data?.hasMore || false

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread-count')
      if (!res.ok) throw new Error('Erro ao buscar contador')
      return res.json()
    },
  })
  const unreadCount: number = unreadData?.count || 0

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao marcar como lida')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao marcar todas como lidas')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const openNotification = (notification: Notification) => {
    if (!notification.isRead) markAsRead.mutate(notification.id)

    if (notification.type === 'QUIZ' && notification.campaignId) {
      window.location.href = `/quiz/${notification.campaignId}`
      return
    }
    if (!notification.link) return
    if (notification.linkType === 'INTERNAL') {
      window.location.href = notification.link
    } else {
      window.open(notification.link, '_blank', 'noopener,noreferrer')
    }
  }

  const openFullMessage = async (notification: Notification) => {
    if (notification.type !== 'MODAL' || !notification.campaignId) return
    const modal = await openModalManually(notification.campaignId)
    if (modal) {
      setModalData({
        title: modal.title,
        message: modal.message,
        link: modal.link,
        linkType: modal.linkType,
        ctaText: modal.ctaText,
        illustrationUrl: modal.illustrationUrl,
      })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="Notificações"
        description={unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}` : 'Avisos da plataforma e dos seus alertas'}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
              <CheckCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Marcar todas como lidas
            </Button>
          ) : undefined
        }
      />
      <AlertsTabs />

      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as Filter)
          setPages(1)
        }}
      >
        <TabsList aria-label="Filtrar notificações">
          <TabsTrigger value="all">
            Todas
            {filter === 'all' && total > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground">{total}</span>}
          </TabsTrigger>
          <TabsTrigger value="unread">
            Não lidas
            {unreadCount > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground">{unreadCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="read">Lidas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">Não foi possível carregar as notificações.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Tentar novamente
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{EMPTY_TEXT[filter]}</p>
          <p className="mt-1 text-sm text-muted-foreground">Avisos dos seus monitoramentos e novidades da plataforma aparecem aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex items-start gap-2 py-3 pr-2 pl-4">
                <span
                  aria-hidden="true"
                  className={cn('mt-2 size-2 shrink-0 rounded-full', notification.isRead ? 'bg-transparent' : 'bg-brand')}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="block w-full rounded-sm text-left focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-sm text-foreground', notification.isRead ? 'font-normal' : 'font-semibold')}>
                        <NotificationMarkdown content={notification.title} inline />
                      </span>
                      {notification.type === 'QUIZ' && <Badge variant="neutral">Quiz</Badge>}
                      {!notification.isRead && <span className="sr-only">(não lida)</span>}
                    </span>
                    <span className="mt-1 line-clamp-3 block text-sm text-muted-foreground">
                      <NotificationMarkdown content={notification.message} />
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <time dateTime={new Date(notification.createdAt).toISOString()}>
                      {formatDate(notification.createdAt, { style: 'relative' })}
                    </time>
                    {notification.link && (
                      <span className="inline-flex items-center gap-1">
                        {notification.linkType === 'EXTERNAL' && <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden="true" />}
                        {notification.linkType === 'INTERNAL' ? 'Abre na plataforma' : 'Abre em nova aba'}
                      </span>
                    )}
                    {notification.type === 'MODAL' && notification.campaignId && (
                      <button
                        type="button"
                        onClick={() => openFullMessage(notification)}
                        className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline sm:min-h-0"
                      >
                        Ver mensagem completa
                      </button>
                    )}
                  </div>
                </div>
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 sm:size-9"
                    onClick={() => markAsRead.mutate(notification.id)}
                    disabled={markAsRead.isPending}
                    aria-label="Marcar como lida"
                    title="Marcar como lida"
                  >
                    <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setPages((p) => p + 1)} disabled={isFetching}>
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {modalData && <SimpleNotificationModal open onClose={() => setModalData(null)} {...modalData} />}
    </div>
  )
}
