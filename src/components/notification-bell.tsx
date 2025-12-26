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
          size="sm"
          className={`relative ${className || ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
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
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={`flex flex-col items-start p-3 mb-1 cursor-pointer rounded-md hover:bg-accent ${
                    !notification.isRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between w-full mb-1">
                    <h4 className="font-semibold text-sm flex-1">
                      <NotificationMarkdown content={notification.title} inline />
                      {notification.type === 'QUIZ' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Quiz
                        </Badge>
                      )}
                      {notification.type === 'MODAL' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Modal
                        </Badge>
                      )}
                    </h4>
                    {!notification.isRead && (
                      <div className="h-2 w-2 bg-blue-600 rounded-full ml-2 flex-shrink-0 mt-1" />
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
                        className="h-6 px-2 text-xs cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200 font-medium"
                        onClick={(e) => handleViewModalDetails(e, notification)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
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
            className="w-full text-center justify-center"
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

