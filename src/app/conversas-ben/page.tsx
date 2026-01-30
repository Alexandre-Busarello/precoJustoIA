'use client'

/**
 * Página de Gerenciamento de Conversas com Ben
 */

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  useBenConversations,
  useSearchBenConversations,
  useUpdateBenConversationTitle,
  useDeleteBenConversation,
} from '@/hooks/use-ben-chat'
import {
  MessageSquare,
  Search,
  Edit2,
  Trash2,
  ArrowLeft,
  Plus,
  Loader2,
  Calendar,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { BenChatSidebar } from '@/components/ben-chat-sidebar'
import { cn } from '@/lib/utils'

export default function ConversasBenPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'title'>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [forceNewConversation, setForceNewConversation] = useState(false)

  // Usar busca se houver query, senão usar lista normal
  const { data: searchResults, isLoading: isSearching } = useSearchBenConversations(
    searchQuery,
    sortBy,
    sortOrder
  )
  const { data: allConversations, isLoading: isLoadingAll } = useBenConversations()

  const conversations = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return searchResults || []
    }
    // Aplicar ordenação localmente se não estiver buscando
    if (!allConversations) return []
    
    const sorted = [...allConversations].sort((a, b) => {
      let aValue: any
      let bValue: any
      
      if (sortBy === 'title') {
        aValue = a.title || ''
        bValue = b.title || ''
      } else if (sortBy === 'createdAt') {
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
      } else {
        aValue = new Date(a.updatedAt).getTime()
        bValue = new Date(b.updatedAt).getTime()
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
    
    return sorted
  }, [searchQuery, searchResults, allConversations, sortBy, sortOrder])

  const updateTitle = useUpdateBenConversationTitle()
  const deleteConversation = useDeleteBenConversation()

  const isLoading = searchQuery.trim().length > 0 ? isSearching : isLoadingAll

  const handleEditClick = (conversation: any) => {
    setEditingId(conversation.id)
    setEditTitle(conversation.title || '')
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return

    try {
      await updateTitle.mutateAsync({
        conversationId: editingId,
        title: editTitle.trim()
      })
      setEditingId(null)
      setEditTitle('')
      toast({
        title: 'Título atualizado',
        description: 'O título da conversa foi atualizado com sucesso.'
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o título.',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteClick = (conversationId: string) => {
    setDeletingId(conversationId)
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return

    try {
      await deleteConversation.mutateAsync(deletingId)
      setDeletingId(null)
      toast({
        title: 'Conversa deletada',
        description: 'A conversa foi deletada com sucesso.'
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível deletar a conversa.',
        variant: 'destructive'
      })
    }
  }

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversationId(conversationId)
    setIsChatOpen(true)
  }

  const handleNewConversation = () => {
    setSelectedConversationId(null) // Limpar conversa selecionada
    setForceNewConversation(true) // Forçar criação de nova conversa
    setIsChatOpen(true) // Abrir chat
  }
  
  // Resetar flag quando chat fechar
  const handleChatClose = (open: boolean) => {
    setIsChatOpen(open)
    if (!open) {
      setForceNewConversation(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/login')
    return null
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <MessageSquare className="w-8 h-8" />
                Minhas Conversas com Ben
              </h1>
              <p className="text-muted-foreground mt-2">
                Gerencie suas conversas, edite títulos e encontre conversas antigas
              </p>
            </div>
            <Button onClick={handleNewConversation}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conversa
            </Button>
          </div>
        </div>

        {/* Busca e Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar conversas por título ou conteúdo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updatedAt">Mais Recente</SelectItem>
                    <SelectItem value="createdAt">Data de Criação</SelectItem>
                    <SelectItem value="title">Título</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Desc</SelectItem>
                    <SelectItem value="asc">Asc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Conversas */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery
                  ? 'Tente buscar com outros termos'
                  : 'Comece uma nova conversa com o Ben para ver suas conversas aqui'}
              </p>
              {!searchQuery && (
                <Button onClick={handleNewConversation}>
                  <Plus className="w-4 h-4 mr-2" />
                  Iniciar Conversa
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {conversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={cn(
                  'hover:shadow-lg transition-shadow cursor-pointer',
                  'touch-manipulation', // Melhorar toque em mobile
                  editingId === conversation.id && 'ring-2 ring-primary'
                )}
                onClick={() => editingId !== conversation.id && handleConversationClick(conversation.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {editingId === conversation.id ? (
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit()
                          } else if (e.key === 'Escape') {
                            setEditingId(null)
                            setEditTitle('')
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1"
                        autoFocus
                      />
                    ) : (
                      <h3 className="font-semibold text-lg flex-1 line-clamp-2">
                        {conversation.title || 'Sem título'}
                      </h3>
                    )}
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {editingId === conversation.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleSaveEdit}
                            disabled={updateTitle.isPending}
                          >
                            {updateTitle.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Salvar'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null)
                              setEditTitle('')
                            }}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(conversation)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(conversation.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {conversation.lastMessage && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {conversation.lastMessage}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      <span>{conversation.messageCount} mensagens</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(conversation.updatedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {conversation.shareToken && (
                    <Badge variant="secondary" className="mt-2">
                      Compartilhada
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de Confirmação de Deleção */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as mensagens desta conversa serão permanentemente deletadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConversation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deletando...
                </>
              ) : (
                'Deletar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chat Sidebar */}
      <BenChatSidebar
        open={isChatOpen}
        onOpenChange={handleChatClose}
        initialConversationId={selectedConversationId || undefined}
        forceNewConversation={forceNewConversation}
      />
    </>
  )
}

