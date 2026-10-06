"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Eye } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { NotificationMarkdown } from '@/components/notification-markdown'
import { useNotificationModal } from '@/hooks/use-notification-modal'
import { SimpleNotificationModal } from '@/components/simple-notification-modal'

interface Notification {
  id: string
  title: string
  message: string
  link: string | null
  linkType: 'INTERNAL' | 'EXTERNAL'
  type: string
  isRead: boolean
  createdAt: Date
  campaignId?: string | null
}

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const { openModalManually } = useNotificationModal()
  const [manualModalData, setManualModalData] = useState<{
    title: string
    message: string
    link: string | null
    linkType: 'INTERNAL' | 'EXTERNAL'
    ctaText: string | null
    modalTemplate: 'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED' | null
    illustrationUrl: string | null
  } | null>(null)

  // Buscar contador de não lidas
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread-count')
      if (!res.ok) throw new Error('Erro ao buscar contador')
      return res.json()
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  })

  const unreadCount = unreadData?.count || 0

  // Buscar últimas notificações quando dropdown abrir
  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?page=1&limit=5&filter=all')
      if (!res.ok) throw new Error('Erro ao buscar notificações')
      return res.json()
    },
    enabled: isOpen, // Só buscar quando dropdown estiver aberto
  })

  const notifications = notificationsData?.notifications || []

  // Mutation para marcar como lida
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Erro ao marcar como lida')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id)
    }

    // Fechar dropdown
    setIsOpen(false)

    // Se for quiz, redirecionar para página do quiz
    if (notification.type === 'QUIZ' && notification.campaignId) {
      window.location.href = `/quiz/${notification.campaignId}`
      return
    }

    // Navegar para o link se houver
    if (notification.link) {
      if (notification.linkType === 'INTERNAL') {
        window.location.href = notification.link
      } else {
        window.open(notification.link, '_blank', 'noopener,noreferrer')
      }
    }
  }

  const handleViewModalDetails = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation()
    if (notification.type === 'MODAL' && notification.campaignId) {
      const modalData = await openModalManually(notification.campaignId)
      if (modalData) {
        setManualModalData({
          title: modalData.title,
          message: modalData.message,
          link: modalData.link,
          linkType: modalData.linkType,
          ctaText: modalData.ctaText,
          modalTemplate: modalData.modalTemplate,
          illustrationUrl: modalData.illustrationUrl
        })
      }
      setIsOpen(false)
    }
  }

  const formatTime = (date: Date) => {
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: ptBR,
      })
    } catch {
      return 'há pouco tempo'
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${className || ''}`}
          aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
        >
          <Bell className="size-5 text-muted-foreground" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span
              data-num
              className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium leading-none text-primary-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-96">
        <div className="p-2">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {unreadCount > 0 && (
              <Badge variant="neutral">
                {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-1">
            Avisos gerais da plataforma (diferente dos alertas de ações)
          </p>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[min(400px,60vh)]">
          {isLoadingNotifications ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 size-6 text-muted-foreground" strokeWidth={1.75} />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className="mb-1 flex cursor-pointer flex-col items-start rounded-md p-3 hover:bg-accent"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between w-full mb-1">
                    <h4 className={`flex-1 text-sm ${notification.isRead ? 'font-medium text-muted-foreground' : 'font-semibold text-foreground'}`}>
                      <NotificationMarkdown content={notification.title} inline />
                      {notification.type === 'QUIZ' && (
                        <Badge variant="neutral" className="ml-2">
                          Quiz
                        </Badge>
                      )}
                      {notification.type === 'MODAL' && (
                        <Badge variant="neutral" className="ml-2">
                          Aviso
                        </Badge>
                      )}
                    </h4>
                    {!notification.isRead && (
                      <span className="mt-1.5 ml-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Não lida" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mb-1">
                    <NotificationMarkdown content={notification.message} />
                  </div>
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(notification.createdAt)}
                    </span>
                    {notification.type === 'MODAL' && notification.campaignId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs md:h-7"
                        onClick={(e) => handleViewModalDetails(e, notification)}
                      >
                        <Eye className="size-3.5" strokeWidth={1.75} />
                        Ver detalhes
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/notificacoes"
            className="w-full cursor-pointer justify-center text-center text-brand"
            onClick={() => setIsOpen(false)}
          >
            Ver todas as notificações
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
      
      {/* Modal manual quando aberto via botão */}
      {manualModalData && (
        <SimpleNotificationModal
          open={!!manualModalData}
          onClose={() => setManualModalData(null)}
          title={manualModalData.title}
          message={manualModalData.message}
          link={manualModalData.link}
          linkType={manualModalData.linkType}
          ctaText={manualModalData.ctaText}
          modalTemplate={manualModalData.modalTemplate}
          illustrationUrl={manualModalData.illustrationUrl}
        />
      )}
    </DropdownMenu>
  )
}

