"use client"

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2, Calendar, Users, Mail, AlertCircle, Edit, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type NotificationSegmentType =
  | 'ALL_USERS'
  | 'ASSET_SUBSCRIBERS'
  | 'RECENT_RANKING_CREATORS'
  | 'RECENT_RADAR_USERS'
  | 'RECENT_BACKTEST_USERS'
  | 'RECENT_PORTFOLIO_CREATORS'
  | 'ACTIVE_PORTFOLIO_USERS'
  | 'PREMIUM_USERS'
  | 'FREE_USERS'
  | 'EARLY_ADOPTERS'
  | 'TRIAL_USERS'
  | 'RECENT_LOGINS'
  | 'NEW_USERS'
  | 'DASHBOARD_NEW_USERS'
  | 'FEATURE_USERS'
  | 'SUPPORT_TICKET_USERS'
  | 'EMAIL_LIST'

interface Campaign {
  id: string
  title: string
  message: string
  link: string | null
  linkType: string
  ctaText?: string | null
  segmentType: NotificationSegmentType
  segmentConfig: Record<string, any>
  showOnDashboard: boolean
  dashboardExpiresAt: Date | null
  isActive: boolean
  stats: {
    totalSent: number
    totalRead: number
    totalClicked: number
  } | null
  createdAt: Date
  notificationCount: number
}

export function AdminNotificationsPageClient() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [page, setPage] = useState(1)

  // Form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [linkType, setLinkType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
  const [ctaText, setCtaText] = useState('')
  const [segmentType, setSegmentType] = useState<NotificationSegmentType>('ALL_USERS')
  const [segmentConfig, setSegmentConfig] = useState<Record<string, any>>({})
  const [showOnDashboard, setShowOnDashboard] = useState(false)
  const [dashboardExpiresAt, setDashboardExpiresAt] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [segmentUserCount, setSegmentUserCount] = useState<number | null>(null)
  const [isCountingUsers, setIsCountingUsers] = useState(false)
  const [emailList, setEmailList] = useState('')
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null)
  const [extendForNewUsers, setExtendForNewUsers] = useState(false)
  const [displayType, setDisplayType] = useState<'BANNER' | 'MODAL' | 'QUIZ'>('BANNER')
  const [bannerTemplate, setBannerTemplate] = useState<'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED'>('GRADIENT')
  const [modalTemplate, setModalTemplate] = useState<'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED'>('GRADIENT')
  const [illustrationUrl, setIllustrationUrl] = useState('')
  const [bannerColors, setBannerColors] = useState<{
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    buttonColor?: string
    buttonTextColor?: string
  }>({})
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    id: string
    type: 'MULTIPLE_CHOICE' | 'TEXT' | 'SCALE'
    question: string
    options?: string[]
    required: boolean
    min?: number
    max?: number
  }>>([])

  // Buscar campanhas
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'campaigns', page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/notifications/campaigns?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Erro ao buscar campanhas')
      return res.json()
    },
  })

  const campaigns: Campaign[] = data?.campaigns || []
  const total = data?.total || 0

  // Determinar se a query deve ser habilitada baseado no segmento e suas configurações
  const shouldCountUsers = (): boolean => {
    if (!segmentType) return false
    
    // Segmentos que precisam de configuração adicional
    if (segmentType === 'ASSET_SUBSCRIBERS' || segmentType === 'RECENT_RADAR_USERS') {
      return !!segmentConfig.assetTicker
    }
    
    if (segmentType === 'FEATURE_USERS') {
      return !!segmentConfig.featureName
    }
    
    if (segmentType === 'EMAIL_LIST') {
      return emailList.trim().length > 0
    }
    
    // Todos os outros segmentos podem ser contados imediatamente
    return true
  }

  // Contar usuários do segmento quando segmentType ou segmentConfig mudarem
  const countUsersQuery = useQuery({
    queryKey: ['admin', 'segment-count', segmentType, segmentConfig, emailList],
    queryFn: async () => {
      setIsCountingUsers(true)
      try {
        // Preparar config para EMAIL_LIST
        let configToSend = { ...segmentConfig }
        if (segmentType === 'EMAIL_LIST') {
          const emails = emailList.split('\n')
            .map(e => e.trim())
            .filter(e => e.length > 0 && e.includes('@'))
          configToSend = { emails }
        }

        const res = await fetch('/api/admin/notifications/segment-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segmentType,
            segmentConfig: configToSend
          })
        })
        if (!res.ok) throw new Error('Erro ao contar usuários')
        const data = await res.json()
        return data.count as number
      } finally {
        setIsCountingUsers(false)
      }
    },
    enabled: shouldCountUsers(),
    staleTime: 30000, // Cache por 30 segundos
  })

  useEffect(() => {
    if (countUsersQuery.data !== undefined) {
      setSegmentUserCount(countUsersQuery.data)
    } else {
      setSegmentUserCount(null)
    }
  }, [countUsersQuery.data])

  // Contar novos usuários quando estiver editando uma campanha
  const { data: newUsersCountData, isLoading: isLoadingNewUsers } = useQuery({
    queryKey: ['admin', 'new-users-count', editingCampaign?.id],
    queryFn: async () => {
      if (!editingCampaign) return null
      const res = await fetch(`/api/admin/notifications/campaign/${editingCampaign.id}/new-users-count`)
      if (!res.ok) throw new Error('Erro ao contar novos usuários')
      return res.json()
    },
    enabled: !!editingCampaign,
    staleTime: 30000, // Cache por 30 segundos
  })

  const newUsersCount = newUsersCountData?.count ?? 0

  // Mutation para criar campanha
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const res = await fetch('/api/admin/notifications/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao criar campanha')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: 'Sucesso',
        description: `Campanha criada! ${data.notificationsCreated} notificações enviadas.`,
      })
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setShowCreateDialog(false)
      resetForm()
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Mutation para estender campanha para novos usuários
  const extendCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, sendEmail }: { campaignId: string; sendEmail: boolean }) => {
      const res = await fetch(`/api/admin/notifications/campaign/${campaignId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao estender campanha')
      }
      return res.json()
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Mutation para atualizar campanha
  const updateCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, campaignData }: { campaignId: string; campaignData: any }) => {
      const res = await fetch(`/api/admin/notifications/campaign/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao atualizar campanha')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Campanha atualizada! As notificações relacionadas também foram atualizadas.',
      })
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'new-users-count'] })
      setShowCreateDialog(false)
      setEditingCampaign(null)
      resetForm()
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Mutation para deletar campanha
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/admin/notifications/campaign/${campaignId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao remover campanha')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: 'Sucesso',
        description: data.message || 'Campanha removida com sucesso',
      })
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setDeletingCampaign(null)
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const resetForm = () => {
    setTitle('')
    setMessage('')
    setLink('')
    setLinkType('INTERNAL')
    setCtaText('')
    setSegmentType('ALL_USERS')
    setSegmentConfig({})
    setShowOnDashboard(false)
    setDashboardExpiresAt('')
    setSendEmail(false)
    setIsActive(true)
    setEditingCampaign(null)
    setEmailList('')
    setExtendForNewUsers(false)
    setDisplayType('MODAL') // Padrão quando não está destacando na dashboard
    setBannerTemplate('GRADIENT')
    setModalTemplate('GRADIENT')
    setIllustrationUrl('')
    setBannerColors({})
    setQuizQuestions([])
  }

  const handleCreateCampaign = () => {
    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Erro',
        description: 'Título e mensagem são obrigatórios',
        variant: 'destructive',
      })
      return
    }

    const config: Record<string, any> = { ...segmentConfig }
    
    // Adicionar configurações específicas por segmento
    if (segmentType === 'ASSET_SUBSCRIBERS' || segmentType === 'RECENT_RADAR_USERS') {
      if (!config.assetTicker) {
        toast({
          title: 'Erro',
          description: 'Ticker do ativo é obrigatório para este segmento',
          variant: 'destructive',
        })
        return
      }
    }

    if (segmentType.startsWith('RECENT_') || segmentType === 'NEW_USERS' || segmentType === 'RECENT_LOGINS') {
      config.daysAgo = config.daysAgo || 30
    }

    if (segmentType === 'FEATURE_USERS') {
      if (!config.featureName) {
        toast({
          title: 'Erro',
          description: 'Nome da feature é obrigatório para este segmento',
          variant: 'destructive',
        })
        return
      }
    }

    if (segmentType === 'EMAIL_LIST') {
      const emails = emailList.split('\n')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'))
      if (emails.length === 0) {
        toast({
          title: 'Erro',
          description: 'Pelo menos um email válido é obrigatório para este segmento',
          variant: 'destructive',
        })
        return
      }
      config.emails = emails
    }

    // Se showOnDashboard estiver marcado, displayType é sempre BANNER
    const finalDisplayType = showOnDashboard ? 'BANNER' : displayType
    
    // Validar quizConfig se displayType é QUIZ (e não está destacando na dashboard)
    if (finalDisplayType === 'QUIZ') {
      if (quizQuestions.length === 0 || quizQuestions.length > 5) {
        toast({
          title: 'Erro',
          description: 'Quiz deve ter entre 1 e 5 perguntas',
          variant: 'destructive',
        })
        return
      }
      // Validar cada pergunta
      for (const q of quizQuestions) {
        if (!q.question.trim()) {
          toast({
            title: 'Erro',
            description: 'Todas as perguntas devem ter texto',
            variant: 'destructive',
          })
          return
        }
        if (q.type === 'MULTIPLE_CHOICE' && (!q.options || q.options.length === 0)) {
          toast({
            title: 'Erro',
            description: 'Perguntas de múltipla escolha devem ter opções',
            variant: 'destructive',
          })
          return
        }
        if (q.type === 'SCALE' && (q.min === undefined || q.max === undefined)) {
          toast({
            title: 'Erro',
            description: 'Perguntas de escala devem ter min e max definidos',
            variant: 'destructive',
          })
          return
        }
      }
    }

    // Validar illustrationUrl se template é ILLUSTRATED
    if ((bannerTemplate === 'ILLUSTRATED' || modalTemplate === 'ILLUSTRATED') && !illustrationUrl.trim()) {
      toast({
        title: 'Erro',
        description: 'Template ILLUSTRATED requer URL da imagem',
        variant: 'destructive',
      })
      return
    }

    const campaignData: any = {
      title,
      message,
      link: link.trim() || undefined,
      linkType,
      ctaText: ctaText.trim() || undefined,
      segmentType,
      segmentConfig: config,
      showOnDashboard,
      dashboardExpiresAt: dashboardExpiresAt ? new Date(dashboardExpiresAt).toISOString() : undefined,
      sendEmail,
      isActive,
      displayType: finalDisplayType,
      bannerTemplate: showOnDashboard ? bannerTemplate : undefined,
      modalTemplate: !showOnDashboard ? modalTemplate : undefined,
      quizConfig: finalDisplayType === 'QUIZ' ? { questions: quizQuestions } : undefined,
      illustrationUrl: illustrationUrl.trim() || undefined,
      bannerColors: (() => {
        if (!showOnDashboard) return undefined
        
        // Valores padrão por template
        const defaultColors: Record<string, string> = {}
        
        // Definir valores padrão baseado no template
        if (bannerTemplate === 'GRADIENT' || bannerTemplate === 'MINIMAL' || bannerTemplate === 'ILLUSTRATED') {
          defaultColors.primaryColor = '#6366f1'
        }
        if (bannerTemplate === 'GRADIENT' || bannerTemplate === 'ILLUSTRATED') {
          defaultColors.secondaryColor = '#9333ea'
        }
        if (bannerTemplate === 'SOLID') {
          defaultColors.backgroundColor = '#1e293b'
        }
        // Cor do texto e botão são sempre visíveis
        defaultColors.textColor = '#1e293b'
        defaultColors.buttonColor = '#4f46e5'
        defaultColors.buttonTextColor = '#ffffff'
        
        // Construir objeto final mesclando valores padrão com valores customizados
        const finalColors: typeof bannerColors = {}
        
        // Para cada cor relevante do template, usar valor customizado ou padrão
        Object.entries(defaultColors).forEach(([key, defaultValue]) => {
          const customValue = bannerColors[key as keyof typeof bannerColors]
          // Se há valor customizado e não está vazio, usar ele
          if (customValue && typeof customValue === 'string' && customValue.trim() !== '') {
            finalColors[key as keyof typeof bannerColors] = customValue.trim()
          } else {
            // Caso contrário, usar valor padrão
            finalColors[key as keyof typeof bannerColors] = defaultValue
          }
        })
        
        // Retornar objeto com cores (sempre terá valores devido aos padrões)
        return finalColors
      })(),
    }

    createCampaignMutation.mutate(campaignData)
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Campanhas de Notificações</h1>
          <p className="text-muted-foreground">
            Crie e gerencie campanhas de notificações para usuários
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? 'Editar Campanha' : 'Criar Nova Campanha'}</DialogTitle>
              <DialogDescription>
                {editingCampaign 
                  ? 'Edite a campanha de notificações. As notificações existentes serão atualizadas.'
                  : 'Configure uma nova campanha de notificações para usuários'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Nova funcionalidade disponível"
                />
              </div>
              <div>
                <Label htmlFor="message">Mensagem *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva a notificação..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="link">Link (opcional)</Label>
                  <Input
                    id="link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="/acao/PETR4 ou https://..."
                  />
                </div>
                <div>
                  <Label htmlFor="linkType">Tipo de Link</Label>
                  <Select value={linkType} onValueChange={(v: any) => setLinkType(v)}>
                    <SelectTrigger id="linkType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERNAL">Interno</SelectItem>
                      <SelectItem value="EXTERNAL">Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="ctaText">
                  Texto do Botão CTA <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="ctaText"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Ex: Saiba mais, Ver detalhes, Acessar agora, Explorar..."
                  maxLength={50}
                  className="font-medium"
                  disabled={!link}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {link 
                    ? 'Texto que aparecerá no botão de ação. Se não preenchido, será usado "Ver detalhes" (interno) ou "Abrir link" (externo).'
                    : 'Preencha um link acima para habilitar o campo de texto do botão CTA.'
                  }
                </p>
              </div>
              <div>
                <Label htmlFor="segmentType">Segmento *</Label>
                <Select 
                  value={segmentType} 
                  onValueChange={(v: any) => {
                    setSegmentType(v)
                    setSegmentConfig({})
                    setEmailList('')
                  }}
                >
                  <SelectTrigger id="segmentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_USERS">Todos os usuários</SelectItem>
                    <SelectItem value="ASSET_SUBSCRIBERS">Usuários que seguem ativo X</SelectItem>
                    <SelectItem value="RECENT_RANKING_CREATORS">Criaram ranking recentemente</SelectItem>
                    <SelectItem value="RECENT_RADAR_USERS">Adicionaram ativo ao radar recentemente</SelectItem>
                    <SelectItem value="RECENT_BACKTEST_USERS">Fizeram backtest recentemente</SelectItem>
                    <SelectItem value="RECENT_PORTFOLIO_CREATORS">Criaram carteira recentemente</SelectItem>
                    <SelectItem value="ACTIVE_PORTFOLIO_USERS">Usando carteira (transações recentes)</SelectItem>
                    <SelectItem value="PREMIUM_USERS">Usuários Pagantes (Premium)</SelectItem>
                    <SelectItem value="FREE_USERS">Usuários Gratuitos</SelectItem>
                    <SelectItem value="EARLY_ADOPTERS">Early Adopters</SelectItem>
                    <SelectItem value="TRIAL_USERS">Usuários em trial</SelectItem>
                    <SelectItem value="RECENT_LOGINS">Login recente</SelectItem>
                    <SelectItem value="NEW_USERS">Usuários novos</SelectItem>
                    <SelectItem value="DASHBOARD_NEW_USERS">Usuários novos (entrada na dashboard)</SelectItem>
                    <SelectItem value="FEATURE_USERS">Usaram feature X recentemente</SelectItem>
                    <SelectItem value="SUPPORT_TICKET_USERS">Abrir ticket recentemente</SelectItem>
                    <SelectItem value="EMAIL_LIST">Lista de emails</SelectItem>
                  </SelectContent>
                </Select>
                {/* Mostrar contagem de usuários */}
                {segmentType && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    {isCountingUsers ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Calculando...</span>
                      </>
                    ) : segmentUserCount !== null ? (
                      <>
                        <Users className="w-4 h-4 text-primary" />
                        <span className="font-medium text-primary">
                          {segmentUserCount} usuário{segmentUserCount !== 1 ? 's' : ''} será{segmentUserCount === 1 ? '' : 'ão'} afetado{segmentUserCount !== 1 ? 's' : ''}
                        </span>
                      </>
                    ) : countUsersQuery.isError ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-destructive text-xs">
                          Erro ao calcular. Verifique as configurações do segmento.
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Destacar na Dashboard */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="showOnDashboard"
                  checked={showOnDashboard}
                  onCheckedChange={(checked) => {
                    setShowOnDashboard(checked)
                    // Se marcar, automaticamente define como BANNER
                    if (checked) {
                      setDisplayType('BANNER')
                    } else {
                      // Se desmarcar, volta para MODAL como padrão
                      setDisplayType('MODAL')
                    }
                  }}
                />
                <Label htmlFor="showOnDashboard">Destacar na Dashboard</Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                {showOnDashboard 
                  ? 'A notificação será exibida como banner na dashboard dos usuários'
                  : 'A notificação será exibida como modal ou quiz (uma vez por usuário)'
                }
              </p>

              {/* Status Ativo/Inativo */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive" className="font-medium">
                  Campanha Ativa
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Campanhas inativas não serão processadas automaticamente para novos usuários
              </p>

              {/* Tipo de Exibição (apenas se não estiver destacando na dashboard) */}
              {!showOnDashboard && (
                <div>
                  <Label htmlFor="displayType">Tipo de Exibição *</Label>
                  <Select value={displayType} onValueChange={(v: any) => setDisplayType(v)}>
                    <SelectTrigger id="displayType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MODAL">Modal (uma vez por usuário)</SelectItem>
                      <SelectItem value="QUIZ">Quiz Interativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Template de Banner (apenas se destacar na dashboard) */}
              {showOnDashboard && (
                <>
                  <div>
                    <Label htmlFor="bannerTemplate">Template do Banner</Label>
                    <Select value={bannerTemplate} onValueChange={(v: any) => setBannerTemplate(v)}>
                      <SelectTrigger id="bannerTemplate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GRADIENT">Gradiente</SelectItem>
                        <SelectItem value="SOLID">Sólido</SelectItem>
                        <SelectItem value="MINIMAL">Minimalista</SelectItem>
                        <SelectItem value="ILLUSTRATED">Com Ilustração</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Cores Customizadas do Banner - Mostrar apenas cores relevantes para cada template */}
                  <div className="space-y-3 border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                    <Label className="text-sm font-semibold">Cores Customizadas (opcional)</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      {bannerTemplate === 'GRADIENT' && 'Para Gradiente: use Cor Primária e Secundária para criar o gradiente. Cor do Texto e Cor do Botão para personalização.'}
                      {bannerTemplate === 'SOLID' && 'Para Sólido: use Cor de Fundo para o background, Cor do Texto para textos e Cor do Botão para o botão CTA.'}
                      {bannerTemplate === 'MINIMAL' && 'Para Minimalista: Cor Primária para bordas e elementos de destaque. Cor do Texto para textos. Cor do Botão para o botão CTA.'}
                      {bannerTemplate === 'ILLUSTRATED' && 'Para Ilustrado: use Cor Primária e Secundária para gradientes. Cor do Texto para textos. Cor do Botão para o botão CTA.'}
                      {!bannerTemplate && 'Personalize as cores do banner. Deixe em branco para usar as cores padrão do template.'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Cor Primária - Mostrar para GRADIENT, MINIMAL, ILLUSTRATED */}
                      {(bannerTemplate === 'GRADIENT' || bannerTemplate === 'MINIMAL' || bannerTemplate === 'ILLUSTRATED') && (
                        <div>
                          <Label htmlFor="primaryColor" className="text-xs">Cor Primária</Label>
                          <div className="flex gap-2">
                            <Input
                              id="primaryColor"
                              type="color"
                              value={bannerColors.primaryColor || '#6366f1'}
                              onChange={(e) => setBannerColors({ ...bannerColors, primaryColor: e.target.value })}
                              className="h-9 w-16 p-1 cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={bannerColors.primaryColor || ''}
                              onChange={(e) => setBannerColors({ ...bannerColors, primaryColor: e.target.value })}
                              placeholder="#6366f1"
                              className="flex-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Cor Secundária - Mostrar para GRADIENT e ILLUSTRATED */}
                      {(bannerTemplate === 'GRADIENT' || bannerTemplate === 'ILLUSTRATED') && (
                        <div>
                          <Label htmlFor="secondaryColor" className="text-xs">Cor Secundária</Label>
                          <div className="flex gap-2">
                            <Input
                              id="secondaryColor"
                              type="color"
                              value={bannerColors.secondaryColor || '#9333ea'}
                              onChange={(e) => setBannerColors({ ...bannerColors, secondaryColor: e.target.value })}
                              className="h-9 w-16 p-1 cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={bannerColors.secondaryColor || ''}
                              onChange={(e) => setBannerColors({ ...bannerColors, secondaryColor: e.target.value })}
                              placeholder="#9333ea"
                              className="flex-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Cor de Fundo - Mostrar apenas para SOLID */}
                      {bannerTemplate === 'SOLID' && (
                        <div>
                          <Label htmlFor="backgroundColor" className="text-xs">Cor de Fundo</Label>
                          <div className="flex gap-2">
                            <Input
                              id="backgroundColor"
                              type="color"
                              value={bannerColors.backgroundColor || ''}
                              onChange={(e) => setBannerColors({ ...bannerColors, backgroundColor: e.target.value })}
                              className="h-9 w-16 p-1 cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={bannerColors.backgroundColor || ''}
                              onChange={(e) => setBannerColors({ ...bannerColors, backgroundColor: e.target.value })}
                              placeholder="Ex: #1e293b"
                              className="flex-1 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Cor do Texto - Mostrar para todos os templates */}
                      <div>
                        <Label htmlFor="textColor" className="text-xs">Cor do Texto</Label>
                        <div className="flex gap-2">
                          <Input
                            id="textColor"
                            type="color"
                            value={bannerColors.textColor || ''}
                            onChange={(e) => setBannerColors({ ...bannerColors, textColor: e.target.value })}
                            className="h-9 w-16 p-1 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={bannerColors.textColor || ''}
                            onChange={(e) => setBannerColors({ ...bannerColors, textColor: e.target.value })}
                            placeholder="#1e293b"
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                      
                      {/* Cor do Botão - Mostrar para todos os templates */}
                      <div>
                        <Label htmlFor="buttonColor" className="text-xs">Cor do Botão</Label>
                        <div className="flex gap-2">
                          <Input
                            id="buttonColor"
                            type="color"
                            value={bannerColors.buttonColor || '#4f46e5'}
                            onChange={(e) => setBannerColors({ ...bannerColors, buttonColor: e.target.value })}
                            className="h-9 w-16 p-1 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={bannerColors.buttonColor || ''}
                            onChange={(e) => setBannerColors({ ...bannerColors, buttonColor: e.target.value })}
                            placeholder="#4f46e5"
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                      
                      {/* Cor do Texto do Botão - Mostrar para todos os templates */}
                      <div>
                        <Label htmlFor="buttonTextColor" className="text-xs">Cor do Texto do Botão</Label>
                        <div className="flex gap-2">
                          <Input
                            id="buttonTextColor"
                            type="color"
                            value={bannerColors.buttonTextColor || '#ffffff'}
                            onChange={(e) => setBannerColors({ ...bannerColors, buttonTextColor: e.target.value })}
                            className="h-9 w-16 p-1 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={bannerColors.buttonTextColor || ''}
                            onChange={(e) => setBannerColors({ ...bannerColors, buttonTextColor: e.target.value })}
                            placeholder="#ffffff"
                            className="flex-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Template de Modal (apenas se não estiver destacando na dashboard) */}
              {!showOnDashboard && (
                <div>
                  <Label htmlFor="modalTemplate">Template do Modal</Label>
                  <Select value={modalTemplate} onValueChange={(v: any) => setModalTemplate(v)}>
                    <SelectTrigger id="modalTemplate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GRADIENT">Gradiente</SelectItem>
                      <SelectItem value="SOLID">Sólido</SelectItem>
                      <SelectItem value="MINIMAL">Minimalista</SelectItem>
                      <SelectItem value="ILLUSTRATED">Com Ilustração</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* URL da Ilustração */}
              {(bannerTemplate === 'ILLUSTRATED' || modalTemplate === 'ILLUSTRATED') && (
                <div>
                  <Label htmlFor="illustrationUrl">URL da Imagem *</Label>
                  <Input
                    id="illustrationUrl"
                    value={illustrationUrl}
                    onChange={(e) => setIllustrationUrl(e.target.value)}
                    placeholder="https://exemplo.com/imagem.png"
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL completa da imagem para o template ilustrado
                  </p>
                </div>
              )}

              {/* Configuração do Quiz */}
              {!showOnDashboard && displayType === 'QUIZ' && (
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Label>Perguntas do Quiz (máximo 5)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (quizQuestions.length < 5) {
                          setQuizQuestions([
                            ...quizQuestions,
                            {
                              id: Date.now().toString(),
                              type: 'MULTIPLE_CHOICE',
                              question: '',
                              options: [''],
                              required: true
                            }
                          ])
                        }
                      }}
                      disabled={quizQuestions.length >= 5}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Pergunta
                    </Button>
                  </div>
                  {quizQuestions.map((q, idx) => (
                    <div key={q.id} className="border rounded p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Pergunta {idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <Label>Texto da Pergunta *</Label>
                        <Input
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...quizQuestions]
                            updated[idx].question = e.target.value
                            setQuizQuestions(updated)
                          }}
                          placeholder="Digite a pergunta..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Tipo</Label>
                          <Select
                            value={q.type}
                            onValueChange={(v: any) => {
                              const updated = [...quizQuestions]
                              updated[idx].type = v
                              if (v === 'MULTIPLE_CHOICE') {
                                updated[idx].options = ['']
                              } else {
                                delete updated[idx].options
                              }
                              if (v === 'SCALE') {
                                updated[idx].min = 0
                                updated[idx].max = 10
                              } else {
                                delete updated[idx].min
                                delete updated[idx].max
                              }
                              setQuizQuestions(updated)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MULTIPLE_CHOICE">Múltipla Escolha</SelectItem>
                              <SelectItem value="TEXT">Texto Livre</SelectItem>
                              <SelectItem value="SCALE">Escala</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={q.required}
                            onCheckedChange={(checked) => {
                              const updated = [...quizQuestions]
                              updated[idx].required = checked
                              setQuizQuestions(updated)
                            }}
                          />
                          <Label>Obrigatória</Label>
                        </div>
                      </div>
                      {q.type === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-2">
                          <Label>Opções *</Label>
                          {(q.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="flex gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...quizQuestions]
                                  if (!updated[idx].options) updated[idx].options = ['']
                                  updated[idx].options![optIdx] = e.target.value
                                  setQuizQuestions(updated)
                                }}
                                placeholder={`Opção ${optIdx + 1}`}
                              />
                              {(q.options || []).length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...quizQuestions]
                                    updated[idx].options = (updated[idx].options || []).filter((_, i) => i !== optIdx)
                                    setQuizQuestions(updated)
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...quizQuestions]
                              if (!updated[idx].options) updated[idx].options = ['']
                              updated[idx].options!.push('')
                              setQuizQuestions(updated)
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1 h-4" />
                            Adicionar Opção
                          </Button>
                        </div>
                      )}
                      {q.type === 'SCALE' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Mínimo</Label>
                            <Input
                              type="number"
                              value={q.min || 0}
                              onChange={(e) => {
                                const updated = [...quizQuestions]
                                updated[idx].min = parseInt(e.target.value) || 0
                                setQuizQuestions(updated)
                              }}
                            />
                          </div>
                          <div>
                            <Label>Máximo</Label>
                            <Input
                              type="number"
                              value={q.max || 10}
                              onChange={(e) => {
                                const updated = [...quizQuestions]
                                updated[idx].max = parseInt(e.target.value) || 10
                                setQuizQuestions(updated)
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {quizQuestions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Adicione pelo menos uma pergunta ao quiz
                    </p>
                  )}
                </div>
              )}

              {/* Data de expiração (apenas se destacar na dashboard) */}
              {showOnDashboard && (
                <div>
                  <Label htmlFor="dashboardExpiresAt">Expira em (opcional)</Label>
                  <Input
                    id="dashboardExpiresAt"
                    type="datetime-local"
                    value={dashboardExpiresAt}
                    onChange={(e) => setDashboardExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Data e hora em que o banner será removido automaticamente da dashboard
                  </p>
                </div>
              )}

              {/* Configurações específicas do segmento */}
              {(segmentType === 'ASSET_SUBSCRIBERS' || segmentType === 'RECENT_RADAR_USERS') && (
                <div>
                  <Label htmlFor="assetTicker">Ticker do Ativo *</Label>
                  <Input
                    id="assetTicker"
                    value={segmentConfig.assetTicker || ''}
                    onChange={(e) => setSegmentConfig({ ...segmentConfig, assetTicker: e.target.value.toUpperCase() })}
                    placeholder="PETR4"
                  />
                </div>
              )}

              {(segmentType.startsWith('RECENT_') || segmentType === 'NEW_USERS' || segmentType === 'RECENT_LOGINS') && (
                <div>
                  <Label htmlFor="daysAgo">Últimos X dias</Label>
                  <Input
                    id="daysAgo"
                    type="number"
                    value={segmentConfig.daysAgo || 30}
                    onChange={(e) => setSegmentConfig({ ...segmentConfig, daysAgo: parseInt(e.target.value) || 30 })}
                    placeholder="30"
                  />
                </div>
              )}

              {segmentType === 'FEATURE_USERS' && (
                <div>
                  <Label htmlFor="featureName">Nome da Feature *</Label>
                  <Input
                    id="featureName"
                    value={segmentConfig.featureName || ''}
                    onChange={(e) => setSegmentConfig({ ...segmentConfig, featureName: e.target.value })}
                    placeholder="ranking"
                  />
                </div>
              )}

              {segmentType === 'EMAIL_LIST' && (
                <div>
                  <Label htmlFor="emailList">Lista de Emails *</Label>
                  <Textarea
                    id="emailList"
                    value={emailList}
                    onChange={(e) => setEmailList(e.target.value)}
                    placeholder="usuario1@exemplo.com&#10;usuario2@exemplo.com&#10;usuario3@exemplo.com"
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Insira um email por linha. Apenas usuários cadastrados com esses emails receberão a notificação.
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="sendEmail"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                />
                <Label htmlFor="sendEmail">Enviar também por email</Label>
              </div>

              {/* Opção para recriar notificações para novos usuários (apenas ao editar) */}
              {editingCampaign && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="extendForNewUsers"
                      checked={extendForNewUsers}
                      onCheckedChange={setExtendForNewUsers}
                    />
                    <Label htmlFor="extendForNewUsers" className="font-medium">
                      Recriar notificações para novos usuários
                    </Label>
                  </div>
                  {extendForNewUsers && (
                    <div className="ml-8 text-sm text-muted-foreground">
                      {isLoadingNewUsers ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Calculando novos usuários...</span>
                        </div>
                      ) : newUsersCount > 0 ? (
                        <div className="flex items-center gap-2 text-primary">
                          <Users className="w-4 h-4" />
                          <span className="font-medium">
                            {newUsersCount} novo{newUsersCount !== 1 ? 's' : ''} usuário{newUsersCount !== 1 ? 's' : ''} receberá{newUsersCount === 1 ? '' : 'ão'} notificação{newUsersCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : (
                        <span>Não há novos usuários no segmento desde a criação da campanha.</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false)
                setEditingCampaign(null)
                resetForm()
              }}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (editingCampaign) {
                    // Se checkbox marcado, estender campanha primeiro
                    if (extendForNewUsers) {
                      try {
                        const extendResult = await extendCampaignMutation.mutateAsync({
                          campaignId: editingCampaign.id,
                          sendEmail
                        })
                        
                        toast({
                          title: 'Sucesso',
                          description: `${extendResult.newNotificationsCreated} nova${extendResult.newNotificationsCreated !== 1 ? 's' : ''} notificação${extendResult.newNotificationsCreated !== 1 ? 'ões' : ''} criada${extendResult.newNotificationsCreated !== 1 ? 's' : ''} para novos usuários.`,
                        })
                      } catch (error) {
                        // Erro já foi tratado no onError da mutation
                        return
                      }
                    }

                    // Atualizar campanha
                    const campaignData: any = {
                      title,
                      message,
                      link: link.trim() || undefined,
                      linkType,
                      ctaText: ctaText.trim() || undefined,
                      showOnDashboard,
                      dashboardExpiresAt: dashboardExpiresAt ? new Date(dashboardExpiresAt).toISOString() : undefined,
                    }
                    updateCampaignMutation.mutate({ campaignId: editingCampaign.id, campaignData })
                  } else {
                    handleCreateCampaign()
                  }
                }}
                disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending || extendCampaignMutation.isPending}
              >
                {(createCampaignMutation.isPending || updateCampaignMutation.isPending || extendCampaignMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {extendCampaignMutation.isPending 
                      ? 'Criando notificações para novos usuários...' 
                      : editingCampaign 
                        ? 'Atualizando...' 
                        : 'Criando...'}
                  </>
                ) : (
                  <>
                    {editingCampaign ? (
                      <>
                        <Edit className="w-4 h-4 mr-2" />
                        Atualizar Campanha
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Campanha
                      </>
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas Criadas</CardTitle>
          <CardDescription>
            Total: {total} campanha{total !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando campanhas...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{campaign.title}</h3>
                          {campaign.isActive ? (
                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                              Ativa
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">
                              Inativa
                            </span>
                          )}
                          {campaign.showOnDashboard && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                              Dashboard
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {campaign.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {campaign.notificationCount} notificações
                          </span>
                          {campaign.stats && (
                            <>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {campaign.stats.totalRead || 0} lidas
                              </span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatTime(campaign.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCampaign(campaign)
                            setTitle(campaign.title)
                            setMessage(campaign.message)
                            setLink(campaign.link || '')
                            setLinkType(campaign.linkType as 'INTERNAL' | 'EXTERNAL')
                            setCtaText(campaign.ctaText || '')
                            setSegmentType(campaign.segmentType)
                            setSegmentConfig(campaign.segmentConfig || {})
                            setShowOnDashboard(campaign.showOnDashboard)
                            setDashboardExpiresAt(
                              campaign.dashboardExpiresAt 
                                ? new Date(campaign.dashboardExpiresAt).toISOString().slice(0, 16)
                                : ''
                            )
                            setIsActive(campaign.isActive ?? true)
                            setShowCreateDialog(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingCampaign(campaign)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deletingCampaign} onOpenChange={(open) => !open && setDeletingCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha &quot;{deletingCampaign?.title}&quot; e todas as {deletingCampaign?.notificationCount || 0} notificação(ões) relacionadas serão permanentemente removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingCampaign) {
                  deleteCampaignMutation.mutate(deletingCampaign.id)
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteCampaignMutation.isPending}
            >
              {deleteCampaignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

