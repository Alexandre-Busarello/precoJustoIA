"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Ticket } from 'lucide-react'
import CreateTicketDialog from '@/components/create-ticket-dialog'
import TicketDetailsDialog from '@/components/ticket-details-dialog'

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
  user: {
    name: string
    email: string
  }
  assignee?: {
    name: string
    email: string
  }
  messages: Array<{
    id: string
    message: string
    createdAt: string
    user: {
      name: string
      email: string
      isAdmin: boolean
    }
  }>
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

export default function SupportCenter() {
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tickets')
      
      if (!response.ok) {
        throw new Error('Erro ao carregar tickets')
      }

      const data = await response.json()
      setTickets(data.tickets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleTicketCreated = () => {
    setCreateDialogOpen(false)
    fetchTickets()
  }

  const handleTicketClick = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setDetailsDialogOpen(true)
  }

  const handleTicketUpdated = () => {
    fetchTickets()
  }

  const filterTickets = (status?: string) => {
    if (!status || status === 'all') return tickets
    
    if (status === 'open') {
      return tickets.filter(t => ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN'].includes(t.status))
    }
    
    if (status === 'closed') {
      return tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status))
    }
    
    return tickets.filter(t => t.status === status)
  }

  const filteredTickets = filterTickets(activeTab)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchTickets}>Tentar novamente</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de criar ticket */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Meus Tickets</h2>
          <p className="text-gray-600">Gerencie suas solicitações de suporte</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Ticket
        </Button>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Ticket className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Abertos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN'].includes(t.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Aguardando Você</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => t.status === 'WAITING_USER').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolvidos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets de Suporte</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os seus tickets de suporte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="open">Abertos</TabsTrigger>
              <TabsTrigger value="WAITING_USER">Aguardando</TabsTrigger>
              <TabsTrigger value="closed">Fechados</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-6">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum ticket encontrado</h3>
                  <p className="text-gray-600 mb-4">
                    {activeTab === 'all' 
                      ? 'Você ainda não criou nenhum ticket de suporte.'
                      : 'Não há tickets nesta categoria.'
                    }
                  </p>
                  {activeTab === 'all' && (
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      Criar primeiro ticket
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTickets.map((ticket) => {
                    const StatusIcon = statusConfig[ticket.status].icon
                    const lastMessage = ticket.messages[0]
                    
                    return (
                      <Card 
                        key={ticket.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleTicketClick(ticket)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-gray-900">{ticket.title}</h3>
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
                              
                              <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                                {ticket.description}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>#{ticket.id.slice(-8)}</span>
                                <span>{categoryConfig[ticket.category]}</span>
                                <span>Criado em {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                                {lastMessage && (
                                  <span>
                                    Última resposta: {lastMessage.user.isAdmin ? 'Suporte' : 'Você'}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-right text-xs text-gray-500">
                              {ticket.assignee && (
                                <p>Atribuído a: {ticket.assignee.name}</p>
                              )}
                              <p>{ticket.messages.length} mensagem{ticket.messages.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateTicketDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTicketCreated={handleTicketCreated}
      />
      
      {selectedTicket && (
        <TicketDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          ticket={selectedTicket}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </div>
  )
}
