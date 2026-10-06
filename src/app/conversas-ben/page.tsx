'use client'

/**
 * Conversas com o Ben: lista pesquisável, abrir no chat, renomear e excluir.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
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
import { useToast } from '@/hooks/use-toast'
import { BenChatSidebar } from '@/components/ben-chat-sidebar'
import { formatDate, formatNumber } from '@/lib/format'

type Conversation = NonNullable<ReturnType<typeof useBenConversations>['data']>[number]

const SEARCH_DEBOUNCE_MS = 300

/** Prévia em texto simples da última mensagem (sem marcações de markdown). */
function plainPreview(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function ConversasBenPage() {
  const { status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [renaming, setRenaming] = useState<Conversation | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [forceNewConversation, setForceNewConversation] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=/conversas-ben')
  }, [status, router])

  const searching = searchQuery.length > 0
  const { data: searchResults, isLoading: isSearching } = useSearchBenConversations(searchQuery)
  const { data: allConversations, isLoading: isLoadingAll } = useBenConversations()
  const conversations = (searching ? searchResults : allConversations) ?? []
  const isLoading = status === 'loading' || (searching ? isSearching : isLoadingAll)

  const updateTitle = useUpdateBenConversationTitle()
  const deleteConversation = useDeleteBenConversation()

  const openConversation = (conversationId: string) => {
    setForceNewConversation(false)
    setSelectedConversationId(conversationId)
    setIsChatOpen(true)
  }

  const handleNewConversation = () => {
    setSelectedConversationId(null)
    setForceNewConversation(true)
    setIsChatOpen(true)
  }

  const handleChatOpenChange = (open: boolean) => {
    setIsChatOpen(open)
    if (!open) setForceNewConversation(false)
  }

  const startRename = (conversation: Conversation) => {
    setRenaming(conversation)
    setRenameTitle(conversation.title || '')
  }

  const handleRename = async (e: FormEvent) => {
    e.preventDefault()
    const title = renameTitle.trim()
    if (!renaming || !title) return
    try {
      await updateTitle.mutateAsync({ conversationId: renaming.id, title })
      setRenaming(null)
      toast({ title: 'Título atualizado' })
    } catch {
      toast({ title: 'Não foi possível renomear', description: 'Tente novamente em instantes.', variant: 'destructive' })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return
    try {
      await deleteConversation.mutateAsync(deletingId)
      setDeletingId(null)
      toast({ title: 'Conversa excluída' })
    } catch {
      toast({ title: 'Não foi possível excluir', description: 'Tente novamente em instantes.', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<Conversation>[] = [
    {
      key: 'title',
      header: 'Conversa',
      sortable: true,
      sortValue: (c) => c.title || '',
      className: 'max-w-[11rem] py-2.5 min-[400px]:max-w-[13rem] sm:max-w-md',
      cell: (c) => (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium text-foreground">{c.title || 'Sem título'}</p>
          {(c.shareToken || c.lastMessage) && (
            <div className="flex min-w-0 items-center gap-2">
              {c.shareToken && <Badge variant="neutral">Compartilhada</Badge>}
              {c.lastMessage && <p className="truncate text-xs text-muted-foreground">{plainPreview(c.lastMessage)}</p>}
            </div>
          )}
          {/* No mobile, data e total de mensagens ficam aqui (as colunas somem abaixo de md) */}
          <p className="truncate text-xs text-muted-foreground tabular-nums md:hidden">
            {formatDate(c.updatedAt)} · {formatNumber(c.messageCount, { digits: 0 })}{' '}
            {c.messageCount === 1 ? 'mensagem' : 'mensagens'}
          </p>
        </div>
      ),
    },
    {
      key: 'messageCount',
      header: 'Mensagens',
      align: 'right',
      sortable: true,
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      cell: (c) => formatNumber(c.messageCount, { digits: 0 }),
    },
    {
      key: 'updatedAt',
      header: 'Atualizada',
      align: 'right',
      sortable: true,
      sortValue: (c) => new Date(c.updatedAt).getTime(),
      className: 'hidden whitespace-nowrap md:table-cell',
      headerClassName: 'hidden md:table-cell',
      cell: (c) => formatDate(c.updatedAt),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      className: 'w-24',
      cell: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" aria-label={`Renomear ${c.title || 'conversa'}`} onClick={() => startRename(c)}>
            <Pencil className="size-4 text-muted-foreground" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Excluir ${c.title || 'conversa'}`} onClick={() => setDeletingId(c.id)}>
            <Trash2 className="size-4 text-muted-foreground" strokeWidth={1.75} />
          </Button>
        </div>
      ),
    },
  ]

  if (status === 'unauthenticated') return null

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <PageHeader
          breadcrumb={[{ label: 'Minha conta', href: '/perfil' }, { label: 'Conversas com o Ben' }]}
          title="Conversas com o Ben"
          description="Retome, renomeie ou exclua suas conversas com o assistente."
          actions={
            <Button onClick={handleNewConversation}>
              <Plus className="size-4" strokeWidth={1.75} />
              Nova conversa
            </Button>
          }
        />

        <div className="relative max-w-md">
          <Label htmlFor="busca-conversas" className="sr-only">
            Buscar conversas
          </Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Input
            id="busca-conversas"
            type="search"
            placeholder="Buscar por título ou conteúdo"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <DataTable
          caption="Conversas com o Ben"
          columns={columns}
          rows={conversations}
          getRowId={(c) => c.id}
          loading={isLoading}
          stickyFirstColumn
          defaultSort={{ key: 'updatedAt', direction: 'desc' }}
          onRowClick={(c) => openConversation(c.id)}
          empty={
            searching
              ? { title: 'Nenhuma conversa encontrada', description: 'Tente outros termos.' }
              : {
                  title: 'Nenhuma conversa ainda',
                  description: 'As conversas com o Ben aparecem aqui.',
                  action: (
                    <Button variant="outline" onClick={handleNewConversation}>
                      Iniciar conversa
                    </Button>
                  ),
                }
          }
        />
      </div>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <form onSubmit={handleRename} className="grid min-w-0 gap-4">
            <DialogHeader>
              <DialogTitle>Renomear conversa</DialogTitle>
              <DialogDescription>O novo título aparece na lista e no chat.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="titulo-conversa">Título</Label>
              <Input id="titulo-conversa" value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} autoFocus required />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!renameTitle.trim() || updateTitle.isPending}>
                {updateTitle.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens desta conversa serão apagadas. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deleteConversation.isPending}
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
            >
              {deleteConversation.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BenChatSidebar
        open={isChatOpen}
        onOpenChange={handleChatOpenChange}
        initialConversationId={selectedConversationId ?? undefined}
        forceNewConversation={forceNewConversation}
      />
    </>
  )
}
