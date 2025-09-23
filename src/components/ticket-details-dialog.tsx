"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { Send, User, UserCheck, Clock, AlertCircle, CheckCircle, XCircle, MessageSquare } from 'lucide-react'

interface TicketMessage {
  id: string
  message: string
  createdAt: string
  user: {
    name: string
    email: string
    isAdmin: boolean
  }
}

interface SupportTicket {
  id: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'WAITING_ADMIN' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  category: 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'FEATURE_REQUEST' | 'BUG_REPORT' | 'ACCOUNT'
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

interface TicketDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: SupportTicket
  onTicketUpdated: () => void
}

const statusConfig = {
  OPEN: { label: 'Aberto', color: 'bg-blue-500', icon: AlertCircle },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-yellow-500', icon: Clock },
  WAITING_USER: { label: 'Aguardando Você', color: 'bg-orange-500', icon: MessageSquare },
  WAITING_ADMIN: { label: 'Aguardando Suporte', color: 'bg-purple-500', icon: Clock },
  RESOLVED: { label: 'Resolvido', color: 'bg-green-500', icon: CheckCircle },
  CLOSED: { label: 'Fechado', color: 'bg-gray-500', icon: XCircle }
}

const priorityConfig = {
  LOW: { label: 'Baixa', color: 'bg-gray-500' },
  MEDIUM: { label: 'Média', color: 'bg-blue-500' },
  HIGH: { label: 'Alta', color: 'bg-orange-500' },
  URGENT: { label: 'Urgente', color: 'bg-red-500' }
}

const categoryConfig = {
  GENERAL: 'Geral',
  TECHNICAL: 'Técnico',
  BILLING: 'Faturamento',
  FEATURE_REQUEST: 'Solicitação de Recurso',
  BUG_REPORT: 'Relatório de Bug',
  ACCOUNT: 'Conta'
}

export default function TicketDetailsDialog({ open, onOpenChange, ticket, onTicketUpdated }: TicketDetailsDialogProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const { toast } = useToast()

  const fetchMessages = useCallback(async () => {
    if (!ticket?.id) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/tickets/${ticket.id}/messages`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar mensagens')
      }

      const data = await response.json()
      setMessages(data)
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
      toast({
        title: 'Erro ao carregar mensagens',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [ticket?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && ticket) {
      fetchMessages()
    }
  }, [open, ticket, fetchMessages])

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    setSendingMessage(true)

    try {
      const response = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: newMessage.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao enviar mensagem')
      }

      setNewMessage('')
      await fetchMessages()
      onTicketUpdated()

      toast({
        title: 'Mensagem enviada!',
        description: 'Sua mensagem foi enviada com sucesso.',
      })

    } catch (error) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const StatusIcon = statusConfig[ticket.status].icon
  const canReply = !['CLOSED', 'RESOLVED'].includes(ticket.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] h-[90vh] sm:h-auto flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-xl pr-2 line-clamp-2">{ticket.title}</DialogTitle>
              <DialogDescription className="mt-1 sm:mt-2 text-sm">
                Ticket #{ticket.id.slice(-8)} • {categoryConfig[ticket.category]}
              </DialogDescription>
            </div>
            <div className="flex flex-row sm:flex-col gap-2 sm:ml-4 flex-shrink-0">
              <Badge 
                variant="secondary" 
                className={`${statusConfig[ticket.status].color} text-white text-xs`}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig[ticket.status].label}
              </Badge>
              <Badge 
                variant="outline"
                className={`${priorityConfig[ticket.priority].color} text-white border-0 text-xs`}
              >
                {priorityConfig[ticket.priority].label}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mt-3 sm:mt-4">
            <span>Criado: {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
            {ticket.assignee && (
              <span className="hidden sm:inline">Atribuído a: {ticket.assignee.name}</span>
            )}
            {ticket.closedAt && (
              <span>Fechado: {new Date(ticket.closedAt).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        {/* Mensagens */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[300px] sm:h-[400px] pr-2 sm:pr-4">
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                messages.map((message) => (
                  <Card key={message.id} className={message.user.isAdmin ? 'bg-blue-50 border-blue-200' : ''}>
                    <CardContent className="pt-3 sm:pt-4 pb-3 sm:pb-4">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${message.user.isAdmin ? 'bg-blue-600' : 'bg-gray-600'}`}>
                          {message.user.isAdmin ? (
                            <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                          ) : (
                            <User className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 text-sm sm:text-base">
                                {message.user.isAdmin ? 'Suporte' : message.user.name || 'Você'}
                              </span>
                              {message.user.isAdmin && (
                                <Badge variant="secondary" className="text-xs">
                                  Equipe
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleDateString('pt-BR')} {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base break-words">
                            {message.message}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Campo de resposta */}
        {canReply && (
          <>
            <Separator className="my-3 sm:my-4" />
            <div className="flex-shrink-0 space-y-3">
              <Textarea
                placeholder="Digite sua resposta..."
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                rows={2}
                maxLength={2000}
                className="text-sm sm:text-base resize-none"
              />
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-xs text-gray-500">
                  {newMessage.length}/2000 caracteres
                </span>
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  className="flex items-center gap-2 w-full sm:w-auto"
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                  {sendingMessage ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          </>
        )}

        {!canReply && (
          <div className="flex-shrink-0 bg-gray-50 p-3 sm:p-4 rounded-lg text-center">
            <p className="text-gray-600 text-sm sm:text-base">
              Este ticket está {ticket.status === 'CLOSED' ? 'fechado' : 'resolvido'} e não aceita mais respostas.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
