"use client"

import Image from 'next/image'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NotificationMarkdown } from '@/components/notification-markdown'

export interface ModalNotificationContent {
  campaignId: string
  title: string
  message: string
  link: string | null
  linkType: 'INTERNAL' | 'EXTERNAL'
  ctaText: string | null
  illustrationUrl: string | null
}

interface NotificationModalProps {
  notification: ModalNotificationContent
  open: boolean
  /** `dismissed`: fechou sem clicar na ação (Esc, "Fechar", clique fora). */
  onClose: (dismissed: boolean) => void
}

function isUnoptimizedImage(url: string) {
  return url.startsWith('/files/') || url.includes('precojusto.ai/files/')
}

/**
 * Comunicado da equipe em Dialog neutro. Todos os modelos de campanha (antigos GRADIENT, SOLID,
 * MINIMAL, ILLUSTRATED) usam o mesmo layout; a ilustração, quando existe, aparece no topo.
 */
export function NotificationModal({ notification, open, onClose }: NotificationModalProps) {
  const external = notification.linkType === 'EXTERNAL'

  const handleAction = () => {
    if (notification.link) {
      if (external) {
        window.open(notification.link, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = notification.link
      }
    }
    onClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose(true)}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg sm:p-0 [&>[data-slot=dialog-close]]:bg-popover">
        {notification.illustrationUrl && (
          <Image
            src={notification.illustrationUrl}
            alt=""
            width={640}
            height={256}
            className="h-40 w-full border-b border-border object-cover sm:h-56"
            unoptimized={isUnoptimizedImage(notification.illustrationUrl)}
          />
        )}
        <div className="grid gap-4 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg leading-snug">
              <NotificationMarkdown content={notification.title} inline />
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm leading-6 text-muted-foreground">
                <NotificationMarkdown content={notification.message} />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onClose(true)}>
              Fechar
            </Button>
            {notification.link && (
              <Button onClick={handleAction}>
                {notification.ctaText || (external ? 'Abrir link' : 'Ver detalhes')}
                {external ? (
                  <ExternalLink className="size-4" strokeWidth={1.75} />
                ) : (
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                )}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
