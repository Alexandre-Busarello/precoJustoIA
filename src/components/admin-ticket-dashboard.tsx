"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Users, 
  TrendingUp,
  Filter,
  Search,
  UserCheck,
  User
} from 'lucide-react'
import AdminTicketDetailsDialog from '@/components/admin-ticket-details-dialog'

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
  isUrgentByTime?: boolean
  hoursSinceLastAdminResponse?: number
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
  messages: Array<{
    id: string
    message: string
    createdAt: string
    isInternal: boolean
    user: {
      name: string
      email: string
      isAdmin: boolean
    }
  }>
  _count: {
    messages: number
  }
}

interface AdminUser {
  id: string
  name: string
  email: string
  _count: {
    assignedTickets: number
  }
}

interface TicketStats {
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  unassigned: number
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

export default function AdminTicketDashboard() {
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<TicketStats>({ byStatus: {}, byPriority: {}, unassigned: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros
  const [activeTab, setActiveTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Dialog
  const [selectedTicket, setSelectedTicket] = useState<AdminTicket | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const [ticketsResponse, adminsResponse] = await Promise.all([
        fetch('/api/admin/tickets'),
        fetch('/api/admin/users')
      ])

      if (!ticketsResponse.ok || !adminsResponse.ok) {
        throw new Error('Erro ao carregar dados')
      }

      const ticketsData = await ticketsResponse.json()
      const adminsData = await adminsResponse.json()

      setTickets(ticketsData.tickets)
      setStats(ticketsData.stats)
      setAdmins(adminsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleTicketClick = (ticket: AdminTicket) => {
    setSelectedTicket(ticket)
    setDetailsDialogOpen(true)
  }

  const handleTicketUpdated = () => {
    fetchData()
  }

  const filterTickets = () => {
    let filtered = tickets

    // Filtro por tab
    if (activeTab === 'open') {
      filtered = filtered.filter(t => ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN'].includes(t.status))
    } else if (activeTab === 'unassigned') {
      filtered = filtered.filter(t => !t.assignee && ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN'].includes(t.status))
    } else if (activeTab === 'urgent') {
      filtered = filtered.filter(t => t.priority === 'URGENT' && ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN'].includes(t.status))
    }

    // Filtros específicos
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter)
    }
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter)
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter)
    }
    if (assigneeFilter === 'unassigned') {
      filtered = filtered.filter(t => !t.assignee)
    } else if (assigneeFilter !== 'all') {
      filtered = filtered.filter(t => t.assignee?.id === assigneeFilter)
    }

    // Busca por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.user.name?.toLowerCase().includes(term) ||
        t.user.email.toLowerCase().includes(term)
      )
    }

    return filtered
  }

  const filteredTickets = filterTickets()

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
            <Button onClick={fetchData}>Tentar novamente</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Abertos</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {(stats.byStatus.OPEN || 0) + (stats.byStatus.IN_PROGRESS || 0) + 
                   (stats.byStatus.WAITING_USER || 0) + (stats.byStatus.WAITING_ADMIN || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Não Atrib.</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.unassigned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Urgentes</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.byPriority.URGENT || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              <div className="ml-2 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Resolvidos</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {(stats.byStatus.RESOLVED || 0) + (stats.byStatus.CLOSED || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Título, descrição, usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(categoryConfig).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Atribuído a</label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unassigned">Não atribuídos</SelectItem>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name} ({admin._count.assignedTickets})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ações</label>
              <Button 
                variant="outline" 
                onClick={() => {
                  setStatusFilter('all')
                  setPriorityFilter('all')
                  setCategoryFilter('all')
                  setAssigneeFilter('all')
                  setSearchTerm('')
                }}
                className="w-full"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets de Suporte</CardTitle>
          <CardDescription>
            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} encontrado{filteredTickets.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm">Todos</TabsTrigger>
              <TabsTrigger value="open" className="text-xs sm:text-sm">Abertos</TabsTrigger>
              <TabsTrigger value="unassigned" className="text-xs sm:text-sm">Não Atrib.</TabsTrigger>
              <TabsTrigger value="urgent" className="text-xs sm:text-sm">Urgentes</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-6">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum ticket encontrado</h3>
                  <p className="text-gray-600">
                    Não há tickets que correspondam aos filtros selecionados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTickets.map((ticket) => {
                    const StatusIcon = statusConfig[ticket.status].icon
                    const lastMessage = ticket.messages[0]
                    
                    return (
                      <Card 
                        key={ticket.id} 
                        className={`cursor-pointer hover:shadow-md transition-shadow ${
                          ticket.isUrgentByTime ? 'border-2 border-red-500 bg-red-50' : ''
                        }`}
                        onClick={() => handleTicketClick(ticket)}
                      >
                        <CardContent className="pt-4 sm:pt-6">
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate pr-2">{ticket.title}</h3>
                                {ticket.isUrgentByTime && (
                                  <Badge className="bg-red-600 hover:bg-red-700 text-white animate-pulse text-xs mt-2">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">URGENTE - {Math.floor(ticket.hoursSinceLastAdminResponse || 0)}h sem resposta</span>
                                    <span className="sm:hidden">URGENTE - {Math.floor(ticket.hoursSinceLastAdminResponse || 0)}h</span>
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
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
                                <Badge variant="outline" className="text-xs">
                                  {ticket.user.subscriptionTier}
                                </Badge>
                              </div>
                            </div>
                            
                            <p className="text-gray-600 text-sm line-clamp-2">
                              {ticket.description}
                            </p>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
                                <span>#{ticket.id.slice(-8)}</span>
                                <span className="hidden sm:inline">{categoryConfig[ticket.category]}</span>
                                <span className="sm:hidden">{categoryConfig[ticket.category].split(' ')[0]}</span>
                                <span className="hidden sm:inline">Por: {ticket.user.name || ticket.user.email}</span>
                                <span className="sm:hidden">Por: {(ticket.user.name || ticket.user.email).split(' ')[0]}</span>
                                <span className="hidden sm:inline">Criado: {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                                <span className="sm:hidden">{new Date(ticket.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                {lastMessage && (
                                  <span className="flex items-center gap-1">
                                    {lastMessage.user.isAdmin ? <UserCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                    <span className="hidden sm:inline">Última: {lastMessage.user.isAdmin ? 'Admin' : 'Usuário'}</span>
                                    <span className="sm:hidden">{lastMessage.user.isAdmin ? 'Admin' : 'User'}</span>
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-gray-500">
                                {ticket.assignee ? (
                                  <span className="font-medium text-blue-600">
                                    <span className="hidden sm:inline">Atribuído: {ticket.assignee.name}</span>
                                    <span className="sm:hidden">Atrib: {ticket.assignee.name.split(' ')[0]}</span>
                                  </span>
                                ) : (
                                  <span className="text-orange-600">
                                    <span className="hidden sm:inline">Não atribuído</span>
                                    <span className="sm:hidden">Não atrib.</span>
                                  </span>
                                )}
                                <span>{ticket._count.messages} msg{ticket._count.messages !== 1 ? 's' : ''}</span>
                              </div>
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

      {/* Dialog de detalhes */}
      {selectedTicket && (
        <AdminTicketDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          ticket={selectedTicket}
          admins={admins}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </div>
  )
}
