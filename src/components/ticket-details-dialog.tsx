"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface TicketMessage {
  id: string
  message: string
  createdAt: string
  user: {
    name: string
    email: string
    isAdmin: boolean
  }
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'WAITING_ADMIN' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TicketCategory = 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'FEATURE_REQUEST' | 'BUG_REPORT' | 'ACCOUNT'

export interface SupportTicket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  createdAt: string
  updatedAt: string
  closedAt?: string
  assignee?: {
    name: string
    email: string
  }
  user: {
    name: string
    email: string
  }
  messages: TicketMessage[]
}

type BadgeVariant = 'neutral' | 'brand' | 'warning' | 'positive'

export const TICKET_STATUS: Record<TicketStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: 'Aberto', variant: 'neutral' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'brand' },
  WAITING_USER: { label: 'Aguardando você', variant: 'warning' },
  WAITING_ADMIN: { label: 'Aguardando suporte', variant: 'neutral' },
  RESOLVED: { label: 'Resolvido', variant: 'positive' },
  CLOSED: { label: 'Fechado', variant: 'neutral' },
}

export const TICKET_PRIORITY: Record<TicketPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const TICKET_CATEGORY: Record<TicketCategory, string> = {
  GENERAL: 'Dúvida geral',
  TECHNICAL: 'Problema técnico',
  BILLING: 'Cobrança',
  FEATURE_REQUEST: 'Sugestão',
  BUG_REPORT: 'Bug',
  ACCOUNT: 'Conta',
}

export const OPEN_TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN']

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const config = TICKET_STATUS[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export const ticketNumber = (id: string) => `#${id.slice(-8)}`

interface TicketDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: SupportTicket
  onTicketUpdated: () => void
}

const MAX_MESSAGE = 2000

export default function TicketDetailsDialog({ open, onOpenChange, ticket, onTicketUpdated }: TicketDetailsDialogProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)

  // Sem DialogTrigger o Radix não sabe para onde devolver o foco: guarda o elemento que abriu o diálogo
  const returnFocusRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnFocusRef.current = document.activeElement
    }
  }, [open])
  const handleCloseAutoFocus = (event: Event) => {
    const target = returnFocusRef.current
    if (target?.isConnected) {
      event.preventDefault()
      target.focus()
    }
  }
  const { toast } = useToast()

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(false)
      const response = await fetch(`/api/tickets/${ticket.id}/messages`)
      if (!response.ok) throw new Error('Erro ao carregar mensagens')
      setMessages(await response.json())
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [ticket.id])

  useEffect(() => {
    if (open) fetchMessages()
  }, [open, fetchMessages])

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text) return
    setSendingMessage(true)
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao enviar mensagem')
      }
      setNewMessage('')
      await fetchMessages()
      onTicketUpdated()
      toast({ title: 'Resposta enviada' })
    } catch (error) {
      toast({
        title: 'Não foi possível enviar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const canReply = !['CLOSED', 'RESOLVED'].includes(ticket.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:p-0"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DialogHeader className="border-b border-border p-5 pr-14 sm:p-6 sm:pr-14">
          <DialogTitle className="text-lg leading-snug">{ticket.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <TicketStatusBadge status={ticket.status} />
                <span className="tabular-nums">{ticketNumber(ticket.id)}</span>
              </div>
              <p className="tabular-nums">
                {TICKET_CATEGORY[ticket.category]} · Prioridade {TICKET_PRIORITY[ticket.priority].toLowerCase()} · Aberto em{' '}
                {formatDate(ticket.createdAt)}
                {ticket.closedAt && <> · Fechado em {formatDate(ticket.closedAt)}</>}
                {ticket.assignee?.name && <> · Atendido por {ticket.assignee.name}</>}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6" aria-live="polite">
          {loading && messages.length === 0 ? (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-4/5" />
            </div>
          ) : loadError ? (
            <div role="alert" className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Não foi possível carregar as mensagens.</p>
              <Button variant="outline" onClick={fetchMessages}>
                Tentar novamente
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
          ) : (
            <ol className="space-y-4">
              {messages.map((message) => {
                const fromTeam = message.user.isAdmin
                return (
                  <li
                    key={message.id}
                    className={cn('rounded-lg border p-4', fromTeam ? 'border-border bg-surface' : 'border-border bg-card')}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium text-foreground">{fromTeam ? 'Equipe de suporte' : message.user.name || 'Você'}</span>
                      <time dateTime={message.createdAt} className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(message.createdAt, { style: 'datetime' })}
                      </time>
                    </div>
                    <p className="text-sm leading-6 break-words whitespace-pre-wrap text-foreground">{message.message}</p>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="border-t border-border p-5 sm:p-6">
          {canReply ? (
            <form onSubmit={handleSendMessage} className="grid gap-2">
              <Label htmlFor="ticket-reply" className="sr-only">
                Sua resposta
              </Label>
              <Textarea
                id="ticket-reply"
                placeholder="Escreva sua resposta"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                maxLength={MAX_MESSAGE}
                className="resize-none"
                aria-describedby="ticket-reply-count"
              />
              <div className="flex items-center justify-between gap-3">
                <span id="ticket-reply-count" className="text-xs text-muted-foreground tabular-nums">
                  {newMessage.length}/{MAX_MESSAGE}
                </span>
                <Button type="submit" disabled={!newMessage.trim() || sendingMessage}>
                  {sendingMessage ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Send className="size-4" strokeWidth={1.75} />
                  )}
                  Enviar resposta
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Este chamado está {ticket.status === 'CLOSED' ? 'fechado' : 'resolvido'} e não aceita novas respostas.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
