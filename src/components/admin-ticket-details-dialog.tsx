"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { 
  Send, 
  User, 
  UserCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Settings,
  Shield
} from 'lucide-react'

interface TicketMessage {
  id: string
  message: string
  createdAt: string
  isInternal: boolean
  user: {
    name: string
    email: string
    isAdmin: boolean
  }
}

interface AdminTicket {
  id: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'WAITING_ADMIN' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  category: 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'FEATURE_REQUEST' | 'BUG_REPORT' | 'ACCOUNT'
  createdAt: string
  updatedAt: string
  closedAt?: string
  user: {
    name: string
    email: string
    subscriptionTier: string
  }
  assignee?: {
    id: string
    name: string
    email: string
  }
  messages: TicketMessage[]
}

interface AdminUser {
  id: string
  name: string
  email: string
  _count: {
    assignedTickets: number
  }
}

interface AdminTicketDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: AdminTicket
  admins: AdminUser[]
  onTicketUpdated: () => void
}

const statusConfig = {
  OPEN: { label: 'Aberto', color: 'bg-blue-500', icon: AlertCircle },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-yellow-500', icon: Clock },
  WAITING_USER: { label: 'Aguardando Usuário', color: 'bg-orange-500', icon: MessageSquare },
  WAITING_ADMIN: { label: 'Aguardando Admin', color: 'bg-purple-500', icon: Clock },
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

export default function AdminTicketDetailsDialog({ 
  open, 
  onOpenChange, 
  ticket, 
  admins, 
  onTicketUpdated 
}: AdminTicketDetailsDialogProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [updatingTicket, setUpdatingTicket] = useState(false)
  
  // Estados para edição
  const [editingStatus, setEditingStatus] = useState(ticket.status)
  const [editingPriority, setEditingPriority] = useState(ticket.priority)
  const [editingAssignee, setEditingAssignee] = useState(ticket.assignee?.id || 'unassigned')
  
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
  }, [ticket?.id]) // Removido toast das dependências

  useEffect(() => {
    if (open && ticket) {
      fetchMessages()
      setEditingStatus(ticket.status)
      setEditingPriority(ticket.priority)
      setEditingAssignee(ticket.assignee?.id || 'unassigned')
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
          message: newMessage.trim(),
          isInternal
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao enviar mensagem')
      }

      setNewMessage('')
      setIsInternal(false)
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

  const handleUpdateTicket = async () => {
    setUpdatingTicket(true)

    try {
      const updateData: any = {}
      
      if (editingStatus !== ticket.status) {
        updateData.status = editingStatus
      }
      
      if (editingPriority !== ticket.priority) {
        updateData.priority = editingPriority
      }
      
      if (editingAssignee !== (ticket.assignee?.id || 'unassigned')) {
        updateData.assignedTo = editingAssignee === 'unassigned' ? null : editingAssignee
      }

      if (Object.keys(updateData).length === 0) {
        toast({
          title: 'Nenhuma alteração',
          description: 'Não há alterações para salvar.',
        })
        return
      }

      const response = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar ticket')
      }

      onTicketUpdated()

      toast({
        title: 'Ticket atualizado!',
        description: 'As alterações foram salvas com sucesso.',
      })

    } catch (error) {
      toast({
        title: 'Erro ao atualizar ticket',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setUpdatingTicket(false)
    }
  }

  const StatusIcon = statusConfig[ticket.status].icon
  const canReply = !['CLOSED'].includes(ticket.status)
  const hasChanges = editingStatus !== ticket.status || 
                    editingPriority !== ticket.priority || 
                    editingAssignee !== (ticket.assignee?.id || 'unassigned')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl">{ticket.title}</DialogTitle>
              <DialogDescription className="mt-2">
                Ticket #{ticket.id.slice(-8)} • {categoryConfig[ticket.category]} • 
                Por: {ticket.user.name || ticket.user.email} ({ticket.user.subscriptionTier})
              </DialogDescription>
            </div>
            <div className="flex flex-col gap-2 ml-4">
              <Badge 
                variant="secondary" 
                className={`${statusConfig[ticket.status].color} text-white`}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig[ticket.status].label}
              </Badge>
              <Badge 
                variant="outline"
                className={`${priorityConfig[ticket.priority].color} text-white border-0`}
              >
                {priorityConfig[ticket.priority].label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mt-4">
            <span>Criado em {new Date(ticket.createdAt).toLocaleString('pt-BR')}</span>
            {ticket.assignee && (
              <span>Atribuído a: {ticket.assignee.name}</span>
            )}
            {ticket.closedAt && (
              <span>Fechado em {new Date(ticket.closedAt).toLocaleString('pt-BR')}</span>
            )}
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="flex gap-6 flex-1 min-h-0">
          {/* Coluna principal - Mensagens */}
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold mb-4">Conversa</h3>
            
            <ScrollArea className="flex-1 pr-4">
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
                    <Card 
                      key={message.id} 
                      className={`${message.user.isAdmin ? 'bg-blue-50 border-blue-200' : ''} ${message.isInternal ? 'bg-yellow-50 border-yellow-200' : ''}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${
                            message.isInternal ? 'bg-yellow-600' :
                            message.user.isAdmin ? 'bg-blue-600' : 'bg-gray-600'
                          }`}>
                            {message.isInternal ? (
                              <Shield className="h-4 w-4 text-white" />
                            ) : message.user.isAdmin ? (
                              <UserCheck className="h-4 w-4 text-white" />
                            ) : (
                              <User className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-gray-900">
                                {message.user.isAdmin ? 'Admin' : message.user.name || 'Usuário'}
                              </span>
                              {message.user.isAdmin && (
                                <Badge variant="secondary" className="text-xs">
                                  Equipe
                                </Badge>
                              )}
                              {message.isInternal && (
                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                                  Interno
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(message.createdAt).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="text-gray-700 whitespace-pre-wrap">
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

            {/* Campo de resposta */}
            {canReply && (
              <div className="mt-4 space-y-3 border-t pt-4">
                <Textarea
                  placeholder="Digite sua resposta..."
                  value={newMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="internal" 
                        checked={isInternal}
                        onCheckedChange={(checked: boolean) => setIsInternal(checked)}
                      />
                      <Label htmlFor="internal" className="text-sm">
                        Mensagem interna (apenas admins)
                      </Label>
                    </div>
                    <span className="text-xs text-gray-500">
                      {newMessage.length}/2000 caracteres
                    </span>
                  </div>
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendingMessage ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Controles de Admin */}
          <div className="w-80 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5" />
                  <h3 className="font-semibold">Gerenciar Ticket</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editingStatus} onValueChange={(value: typeof editingStatus) => setEditingStatus(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={editingPriority} onValueChange={(value: typeof editingPriority) => setEditingPriority(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Atribuir a</Label>
                    <Select value={editingAssignee} onValueChange={setEditingAssignee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar admin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Não atribuído</SelectItem>
                        {admins.map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.name} ({admin._count.assignedTickets} tickets)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleUpdateTicket}
                    disabled={!hasChanges || updatingTicket}
                    className="w-full"
                  >
                    {updatingTicket ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Informações do usuário */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Informações do Usuário</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Nome:</span> {ticket.user.name || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {ticket.user.email}
                  </div>
                  <div>
                    <span className="font-medium">Plano:</span> 
                    <Badge variant="outline" className="ml-2">
                      {ticket.user.subscriptionTier}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
