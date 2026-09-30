"use client"

import Image from 'next/image'
import { ArrowRight, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NotificationMarkdown } from '@/components/notification-markdown'

export interface SimpleNotificationModalData {
  title: string
  message: string
  link?: string | null
  linkType?: 'INTERNAL' | 'EXTERNAL'
  ctaText?: string | null
  illustrationUrl?: string | null
}

interface SimpleNotificationModalProps extends SimpleNotificationModalData {
  open: boolean
  onClose: () => void
  /** Aceito por compatibilidade com campanhas antigas; o visual é sempre o mesmo (neutro, por tokens). */
  modalTemplate?: 'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED' | null
}

/** Mensagem completa de uma notificação, aberta só por ação do usuário (sino ou página de notificações). */
export function SimpleNotificationModal({
  open,
  onClose,
  title,
  message,
  link,
  linkType = 'INTERNAL',
  ctaText,
  illustrationUrl,
}: SimpleNotificationModalProps) {
  const handleAction = () => {
    if (link) {
      if (linkType === 'INTERNAL') {
        window.location.href = link
      } else {
        window.open(link, '_blank', 'noopener,noreferrer')
      }
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-lg">
        {illustrationUrl && (
          <div className="-mx-5 -mt-5 overflow-hidden border-b border-border sm:-mx-6 sm:-mt-6">
            <Image
              src={illustrationUrl}
              alt=""
              width={640}
              height={256}
              className="h-40 w-full object-cover sm:h-56"
              unoptimized={illustrationUrl.startsWith('/files/') || illustrationUrl.includes('precojusto.ai/files/')}
            />
          </div>
        )}
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-lg font-semibold text-foreground">
            <NotificationMarkdown content={title} inline />
          </DialogTitle>
          <DialogDescription asChild>
            <div className="max-h-[50dvh] overflow-y-auto text-sm leading-6 text-muted-foreground">
              <NotificationMarkdown content={message} />
            </div>
          </DialogDescription>
        </DialogHeader>
        {link && (
          <DialogFooter>
            <Button onClick={handleAction} className="w-full sm:w-auto">
              {ctaText || (linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
              {linkType === 'EXTERNAL' ? (
                <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
