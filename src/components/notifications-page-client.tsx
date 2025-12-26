"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck, ExternalLink, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  readAt: Date | null
  createdAt: Date
  campaignId?: string | null
}

export function NotificationsPageClient() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [page, setPage] = useState(1)
  const limit = 20
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

  // Buscar notificações
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', filter, page],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?page=${page}&limit=${limit}&filter=${filter}`)
      if (!res.ok) throw new Error('Erro ao buscar notificações')
      return res.json()
    },
  })

  const notifications = data?.notifications || []
  const total = data?.total || 0
  const hasMore = data?.hasMore || false

  // Buscar contador de não lidas
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread-count')
      if (!res.ok) throw new Error('Erro ao buscar contador')
      return res.json()
    },
  })

  const unreadCount = unreadData?.count || 0

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

  // Mutation para marcar todas como lidas
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Erro ao marcar todas como lidas')
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

    // Se for quiz, redirecionar para página do quiz
    if (notification.type === 'QUIZ' && notification.campaignId) {
      window.location.href = `/quiz/${notification.campaignId}`
      return
    }

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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Notificações</h1>
        <p className="text-muted-foreground">
          Acompanhe todas as suas notificações e atualizações
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Suas Notificações</CardTitle>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => {
            setFilter(v as 'all' | 'unread' | 'read')
            setPage(1)
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                Todas
                {filter === 'all' && total > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread">
                Não lidas
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="read">Lidas</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 p-4 border rounded-lg">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8 text-destructive">
                  Erro ao carregar notificações
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {filter === 'unread'
                      ? 'Nenhuma notificação não lida'
                      : filter === 'read'
                      ? 'Nenhuma notificação lida'
                      : 'Nenhuma notificação'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification: Notification) => (
                    <Card
                      key={notification.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        !notification.isRead ? 'border-l-4 border-l-blue-600 bg-blue-50/50 dark:bg-blue-950/20' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-start gap-2 mb-2">
                              <h3 className="font-semibold text-base">
                                <NotificationMarkdown content={notification.title} inline />
                              </h3>
                              {notification.type === 'MODAL' && (
                                <Badge variant="outline" className="text-xs">
                                  Modal
                                </Badge>
                              )}
                              {notification.type === 'QUIZ' && (
                                <Badge variant="outline" className="text-xs">
                                  Quiz
                                </Badge>
                              )}
                              {!notification.isRead && (
                                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2 line-clamp-3">
                              <NotificationMarkdown content={notification.message} />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span>{formatTime(notification.createdAt)}</span>
                              {notification.link && (
                                <span className="flex items-center gap-1">
                                  {notification.linkType === 'EXTERNAL' && (
                                    <ExternalLink className="h-3 w-3" />
                                  )}
                                  {notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link'}
                                </span>
                              )}
                              {notification.type === 'MODAL' && notification.campaignId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200 font-medium hover:scale-105"
                                  onClick={(e) => handleViewModalDetails(e, notification)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Ver modal completo
                                </Button>
                              )}
                            </div>
                          </div>
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsReadMutation.mutate(notification.id)
                              }}
                              disabled={markAsReadMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {hasMore && (
                    <div className="text-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setPage(page + 1)}
                      >
                        Carregar mais
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
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
    </div>
  )
}

