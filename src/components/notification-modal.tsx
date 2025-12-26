"use client"

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, ArrowRight, ExternalLink } from 'lucide-react'
import { useNotificationModal } from '@/hooks/use-notification-modal'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { NotificationMarkdown } from '@/components/notification-markdown'

export function NotificationModal() {
  const { notification, markAsViewed, isMarkingAsViewed } = useNotificationModal()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Quando modal aparece, já marca como visto (mesmo que feche sem interagir)
    if (notification) {
      // Não marcar imediatamente, apenas quando fechar
    }
  }, [notification])

  if (!notification) return null

  // Verificar se foi aberto manualmente (não marcar como visto ao fechar)
  const isManuallyOpened = (notification as any).manuallyOpened === true

  const handleClose = (dismissed: boolean = true) => {
    // Se foi aberto manualmente, apenas remover do cache sem marcar como visto
    if (isManuallyOpened) {
      // Limpar o cache para fechar o modal
      queryClient.setQueryData(['notifications', 'modal'], { notification: null })
    } else {
      // Se foi aberto automaticamente, marcar como visto
      markAsViewed(notification.campaignId, dismissed)
    }
  }

  const handleAction = () => {
    if (notification.link) {
      if (notification.linkType === 'INTERNAL') {
        window.location.href = notification.link
      } else {
        window.open(notification.link, '_blank', 'noopener,noreferrer')
      }
    }
    markAsViewed(notification.campaignId, false)
  }

  const template = notification.modalTemplate || 'GRADIENT'

  // Template GRADIENT
  const gradientContent = (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 rounded-lg p-4 sm:p-6 border-2 border-indigo-200 dark:border-indigo-800">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100 mb-2">
              <NotificationMarkdown content={notification.title} inline />
            </h3>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <NotificationMarkdown content={notification.message} />
            </div>
          </div>
        </div>
        {notification.link && (
          <Button
            onClick={handleAction}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium"
          >
            {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
            {notification.linkType === 'EXTERNAL' ? (
              <ExternalLink className="w-4 h-4 ml-2" />
            ) : (
              <ArrowRight className="w-4 h-4 ml-2" />
            )}
          </Button>
        )}
      </div>
    </div>
  )

  // Template SOLID
  const solidContent = (
    <div className="bg-slate-900 dark:bg-slate-800 rounded-lg p-4 sm:p-6 border-2 border-slate-700 dark:border-slate-600">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700 dark:bg-slate-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg sm:text-xl text-white mb-2">
              <NotificationMarkdown content={notification.title} inline />
            </h3>
            <div className="text-sm text-slate-300 leading-relaxed">
              <NotificationMarkdown content={notification.message} />
            </div>
          </div>
        </div>
        {notification.link && (
          <Button
            onClick={handleAction}
            className="bg-white text-slate-900 hover:bg-slate-100 font-medium"
          >
            {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
            {notification.linkType === 'EXTERNAL' ? (
              <ExternalLink className="w-4 h-4 ml-2" />
            ) : (
              <ArrowRight className="w-4 h-4 ml-2" />
            )}
          </Button>
        )}
      </div>
    </div>
  )

  // Template MINIMAL
  const minimalContent = (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-4 sm:p-6 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-slate-100 mb-2">
            <NotificationMarkdown content={notification.title} inline />
          </h3>
          <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <NotificationMarkdown content={notification.message} />
          </div>
        </div>
        {notification.link && (
          <Button
            onClick={handleAction}
            variant="outline"
            className="w-full"
          >
            {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
            {notification.linkType === 'EXTERNAL' ? (
              <ExternalLink className="w-4 h-4 ml-2" />
            ) : (
              <ArrowRight className="w-4 h-4 ml-2" />
            )}
          </Button>
        )}
      </div>
    </div>
  )

  // Template ILLUSTRATED
  const illustratedContent = (
    <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
      {notification.illustrationUrl && (
        <div className="relative w-full h-48 sm:h-64 overflow-hidden">
          <Image
            src={notification.illustrationUrl}
            alt={notification.title}
            width={600}
            height={256}
            className="object-cover w-full h-full"
            priority
            unoptimized={notification.illustrationUrl.startsWith('/files/') || notification.illustrationUrl.includes('precojusto.ai/files/')}
          />
          {/* Overlay sutil no topo para melhor contraste do texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
        </div>
      )}
      <div className="p-4 sm:p-6 space-y-4">
        <div className="space-y-2">
          <h3 className="font-bold text-xl sm:text-2xl text-slate-900 dark:text-slate-100 leading-tight">
            <NotificationMarkdown content={notification.title} inline />
          </h3>
          <div className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            <NotificationMarkdown content={notification.message} />
          </div>
        </div>
        {notification.link && (
          <Button
            onClick={handleAction}
            size="lg"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
            {notification.linkType === 'EXTERNAL' ? (
              <ExternalLink className="w-5 h-5 ml-2" />
            ) : (
              <ArrowRight className="w-5 h-5 ml-2" />
            )}
          </Button>
        )}
      </div>
    </div>
  )

  const getTemplateContent = () => {
    switch (template) {
      case 'SOLID':
        return solidContent
      case 'MINIMAL':
        return minimalContent
      case 'ILLUSTRATED':
        return illustratedContent
      case 'GRADIENT':
      default:
        return gradientContent
    }
  }

  return (
    <Dialog open={!!notification} onOpenChange={(open) => !open && handleClose(true)}>
      <DialogContent className={cn(
        "max-w-[calc(100vw-2rem)] sm:max-w-xl md:max-w-2xl",
        template === 'ILLUSTRATED' && "sm:max-w-2xl md:max-w-3xl",
        "max-h-[calc(100vh-2rem)]",
        "p-0 sm:p-6",
        "overflow-hidden flex flex-col"
      )} showCloseButton={false}>
        <DialogHeader className="px-4 pt-4 sm:px-0 sm:pt-0">
          <DialogTitle className="sr-only">{notification.title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-4 pb-4 sm:px-0 sm:pb-0">
          {getTemplateContent()}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleClose(true)}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-background/80 backdrop-blur-sm"
          disabled={isMarkingAsViewed}
        >
          <X className="w-4 h-4" />
        </Button>
      </DialogContent>
    </Dialog>
  )
}

