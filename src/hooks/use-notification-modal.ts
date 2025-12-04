"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ModalNotification {
  id: string
  campaignId: string
  title: string
  message: string
  link: string | null
  linkType: 'INTERNAL' | 'EXTERNAL'
  ctaText: string | null
  modalTemplate: 'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED' | null
  illustrationUrl: string | null
  displayType: 'MODAL' | 'QUIZ'
}

export function useNotificationModal() {
  const queryClient = useQueryClient()

  // Buscar modal pendente
  const { data, isLoading } = useQuery<{ notification: ModalNotification | null }>({
    queryKey: ['notifications', 'modal'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/modal')
      if (!res.ok) return { notification: null }
      return res.json()
    },
    refetchOnWindowFocus: true,
    staleTime: 30000 // 30 segundos
  })

  // Mutation para marcar como vista
  const markAsViewedMutation = useMutation({
    mutationFn: async ({ campaignId, dismissed }: { campaignId: string; dismissed?: boolean }) => {
      const res = await fetch(`/api/notifications/modal/${campaignId}/viewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed })
      })
      if (!res.ok) throw new Error('Erro ao marcar modal como vista')
      return res.json()
    },
    onSuccess: () => {
      // Invalidar query para não mostrar mais o modal
      queryClient.invalidateQueries({ queryKey: ['notifications', 'modal'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  return {
    notification: data?.notification || null,
    isLoading,
    markAsViewed: (campaignId: string, dismissed?: boolean) => {
      markAsViewedMutation.mutate({ campaignId, dismissed })
    },
    isMarkingAsViewed: markAsViewedMutation.isPending
  }
}

