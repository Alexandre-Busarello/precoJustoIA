'use client'

/**
 * Painel único do Ben (montado pelo `BenChatFAB` no layout raiz e aberto por `openBenPanel`).
 * - Desktop (`lg`+): painel lateral (`aside`, não modal) à direita, abaixo do header; a página continua usável e o
 *   foco não fica preso. A partir de `xl` o conteúdo (`<main>`) encolhe para o lado e o painel não cobre a coluna principal;
 *   o header fica inteiro (os breakpoints dele seguem a largura da janela).
 * - Mobile: folha inferior modal com duas alturas (metade e tela cheia), alça arrastável e foco preso.
 * Esc fecha. O cabeçalho mostra o contexto da tela ("Vendo: PETR4 · Valuation"), que o usuário pode tirar.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { Copy, History, Loader2, Plus, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBenConversations, useShareBenConversation, useUnshareBenConversation } from '@/hooks/use-ben-chat'
import type { BenPageContext } from '@/lib/ben-context/types'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BenConversation } from './ben-conversation'
import { contextKey, contextKeyFromUrl, contextLabel } from './ben-chat-utils'
import {
  closeBenPanel,
  isBenPanelOpen,
  setBenConversation,
  setBenSheetSnap,
  takeBenReturnFocus,
  useBenPanel,
  type BenSheetSnap,
} from './panel-store'
import { useBenPageContext } from './use-ben-page-context'

/** Largura do painel no desktop (px); a partir de `xl` o `<main>` ganha o mesmo padding à direita. */
const PANEL_WIDTH = 400
const DESKTOP_QUERY = '(min-width: 1024px)'
const REFLOW_QUERY = '(min-width: 1280px)'
/** Arraste mínimo (px) na alça para trocar de altura ou fechar. */
const SNAP_DRAG = 56
const GENERIC_CONTEXT: BenPageContext = { kind: 'generic', path: '/' }
const RECENT_LIMIT = 8

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

/** A partir de `xl`, abre espaço para o painel: o conteúdo reflui para a esquerda em vez de ficar coberto. */
function useBodyReflow(active: boolean) {
  useEffect(() => {
    if (!active) return
    const reflow = window.matchMedia(REFLOW_QUERY)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const main = document.querySelector('main')
    if (!main) return
    const previousTransition = main.style.transition
    if (!reduced) main.style.transition = 'padding-right 200ms ease-out'
    const apply = () => {
      main.style.paddingRight = reflow.matches ? `${PANEL_WIDTH}px` : ''
    }
    apply()
    reflow.addEventListener('change', apply)
    return () => {
      reflow.removeEventListener('change', apply)
      main.style.paddingRight = ''
      // Mantém a transição até o conteúdo voltar ao lugar
      window.setTimeout(() => {
        main.style.transition = previousTransition
      }, 250)
    }
  }, [active])
}

export function BenPanel() {
  const { open, conversationId, conversationKey, snap } = useBenPanel()
  const { pathname, context: pageContext } = useBenPageContext()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [detachedPath, setDetachedPath] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const asideRef = useRef<HTMLElement>(null)

  // Tirar o contexto vale só para a tela em que o usuário o tirou
  const detached = detachedPath === pathname
  const pageKey = contextKey(pageContext)
  const pageLabel = contextLabel(pageContext)
  const context = detached ? GENERIC_CONTEXT : pageContext
  const contextUrl = detached ? '/' : pathname

  const { data: conversations } = useBenConversations()
  const conversation = conversations?.find((c) => c.id === conversationId) ?? null
  const mismatch =
    conversationId && conversationKey && pageLabel && !detached && conversationKey !== pageKey ? { pageLabel } : null

  useBodyReflow(open && isDesktop)

  // Desktop: foco no campo ao abrir (ou no painel, no estado de limite) e de volta a quem abriu ao fechar
  useEffect(() => {
    if (!open || !isDesktop) return
    ;(composerRef.current ?? asideRef.current)?.focus()
    return () => {
      if (isBenPanelOpen()) return
      const target = takeBenReturnFocus()
      window.requestAnimationFrame(() => target?.focus())
    }
  }, [open, isDesktop])

  // Desktop: quando o elemento com foco some (sugestão escolhida, chip removido, campo trocado pelo aviso de
  // limite), o foco volta ao campo, ou ao painel, em vez de cair no <body>. Na folha, o FocusScope do Radix já faz isso.
  useEffect(() => {
    const aside = asideRef.current
    if (!open || !isDesktop || !aside) return
    let last: HTMLElement | null = aside.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null
    const onFocusIn = (event: FocusEvent) => {
      last = event.target instanceof HTMLElement ? event.target : null
    }
    const observer = new MutationObserver(() => {
      if (!last || last.isConnected) return
      const active = document.activeElement
      if (active && active !== document.body) return
      last = null
      const composer = composerRef.current
      if (composer && !composer.disabled) composer.focus({ preventScroll: true })
      else aside.focus({ preventScroll: true })
    })
    aside.addEventListener('focusin', onFocusIn)
    observer.observe(aside, { childList: true, subtree: true })
    return () => {
      aside.removeEventListener('focusin', onFocusIn)
      observer.disconnect()
    }
  }, [open, isDesktop])

  // Desktop: com o foco perdido no <body> (o painel não é modal), o Esc ainda fecha o painel,
  // desde que nenhum outro diálogo ou menu esteja aberto (esses tratam o próprio Esc)
  useEffect(() => {
    if (!open || !isDesktop) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const active = document.activeElement
      if (active && active !== document.body && active !== document.documentElement) return
      if (document.querySelector('[role="dialog"]:not([data-ben-panel]), [role="alertdialog"], [role="menu"]')) return
      event.preventDefault()
      closeBenPanel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, isDesktop])

  useEffect(() => {
    setShareOpen(false)
  }, [conversationId])

  const close = useCallback(() => closeBenPanel(), [])
  // No mobile a folha cobre a página: ao seguir um link da resposta, ela fecha
  const handleNavigate = useCallback(() => {
    if (!isDesktop) closeBenPanel()
  }, [isDesktop])

  const startNew = () => setBenConversation(null, detached ? contextKey(GENERIC_CONTEXT) : pageKey)

  const handleConversationCreated = useCallback(
    (id: string) => setBenConversation(id, contextKey(context)),
    [context]
  )

  if (isDesktop) {
    if (!open) return null
    return (
      <aside
        ref={asideRef}
        data-ben-panel
        aria-labelledby="ben-panel-title"
        aria-describedby="ben-panel-description"
        tabIndex={-1}
        // Esc fecha (com o painel do link aberto, fecha só ele). O foco não fica preso: Tab segue para a página.
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          event.preventDefault()
          if (shareOpen) setShareOpen(false)
          else close()
        }}
        className="fixed top-16 right-0 bottom-0 z-40 flex flex-col border-l border-border bg-background text-foreground shadow-md outline-none animate-in duration-200 slide-in-from-right motion-reduce:animate-none"
        style={{ width: PANEL_WIDTH }}
      >
        {renderBody(false)}
      </aside>
    )
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          data-ben-panel
          // Rótulo e descrição: o Radix liga aria-labelledby/aria-describedby aos ids que ele gera para Title/Description
          // Foco no painel, sem abrir o teclado por cima da folha
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            const target = takeBenReturnFocus()
            if (!target) return
            event.preventDefault()
            target.focus()
          }}
          // Com o painel do link aberto, o Esc fecha só ele
          onEscapeKeyDown={(event) => {
            if (!shareOpen) return
            event.preventDefault()
            setShareOpen(false)
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl border-t border-border bg-background text-foreground shadow-md outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
        >
          <MobileSheet snap={snap} onClose={close}>
            {renderBody(true)}
          </MobileSheet>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )

  /** Conteúdo comum ao painel e à folha (função, não componente: o estado do chat não remonta a cada render). */
  function renderBody(mobile: boolean) {
    const Title = mobile ? DialogPrimitive.Title : 'h2'
    const Description = mobile ? DialogPrimitive.Description : 'p'
    // Na folha (Radix), sem id próprio: o Radix gera os ids e liga aria-labelledby/aria-describedby a eles.
    return (
      <>
        <header className="flex items-center gap-2 border-b border-border py-2 pr-2 pl-4">
          <Image src="/ben.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-full border border-border object-cover" />
          <div className="min-w-0 flex-1">
            <Title {...(mobile ? {} : { id: 'ben-panel-title' })} className="text-sm font-semibold text-foreground">
              Ben
            </Title>
            <p className="truncate text-xs text-muted-foreground">{conversation?.title || 'Nova conversa'}</p>
            <Description {...(mobile ? {} : { id: 'ben-panel-description' })} className="sr-only">
              Assistente de análise. Consulta os dados da plataforma; não é recomendação de investimento.
            </Description>
          </div>
          <div className="flex shrink-0 items-center">
            <HistoryMenu currentId={conversationId} onNavigate={handleNavigate} />
            <Button variant="ghost" size="icon" onClick={startNew} disabled={!conversationId} aria-label="Nova conversa" title="Nova conversa">
              <Plus className="size-4" strokeWidth={1.75} />
            </Button>
            {conversation && conversation.messageCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareOpen((v) => !v)}
                aria-expanded={shareOpen}
                aria-controls="ben-share-panel"
                aria-label={conversation.shareToken ? 'Link público da conversa' : 'Compartilhar conversa'}
                title="Compartilhar"
                className={cn((conversation.shareToken || shareOpen) && 'text-brand')}
              >
                <Share2 className="size-4" strokeWidth={1.75} />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={close} aria-label="Fechar o Ben" title="Fechar (Esc)">
              <X className="size-5" strokeWidth={1.75} />
            </Button>
          </div>
        </header>

        {pageLabel && (
          <div className="flex min-h-11 items-center gap-2 border-b border-border px-4 py-1.5">
            {detached ? (
              <>
                <span className="text-xs text-muted-foreground">Pergunta geral</span>
                <Button variant="link" size="sm" className="h-auto min-w-0 truncate px-0 text-xs" onClick={() => setDetachedPath(null)}>
                  Usar o contexto: {pageLabel}
                </Button>
              </>
            ) : (
              <span className="inline-flex h-8 max-w-full min-w-0 items-center rounded-full border border-border bg-surface pl-3 text-xs text-foreground">
                <span className="truncate">
                  <span className="text-muted-foreground">Vendo: </span>
                  {pageLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setDetachedPath(pathname)}
                  aria-label={`Remover o contexto ${pageLabel} e fazer uma pergunta geral`}
                  title="Perguntar sem o contexto da tela"
                  className="relative ml-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground before:absolute before:-inset-1.5 before:content-[''] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        )}

        {shareOpen && conversation && (
          <SharePanel conversationId={conversation.id} shareToken={conversation.shareToken} onClose={() => setShareOpen(false)} />
        )}

        <BenConversation
          conversationId={conversationId}
          context={context}
          contextUrl={contextUrl}
          mismatch={mismatch}
          onConversationCreated={handleConversationCreated}
          onNewConversationHere={startNew}
          onNavigate={handleNavigate}
          composerRef={composerRef}
          onComposerFocus={isDesktop ? undefined : () => setBenSheetSnap('full')}
        />
      </>
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Folha do mobile
// ─────────────────────────────────────────────────────────────────────────────

const SNAP_HEIGHT: Record<BenSheetSnap, string> = {
  // Em telas baixas (320x640), a metade não mostraria as sugestões e o aviso: a folha sobe até 30rem
  half: 'max(62dvh, min(30rem, calc(100dvh - 7rem)))',
  full: 'calc(100dvh - env(safe-area-inset-top) - 0.5rem)',
}

function MobileSheet({ snap, onClose, children }: { snap: BenSheetSnap; onClose: () => void; children: React.ReactNode }) {
  const [dragY, setDragY] = useState<number | null>(null)
  const drag = useRef<{ startY: number; moved: boolean } | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { startY: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    const dy = event.clientY - drag.current.startY
    if (Math.abs(dy) > 6) drag.current.moved = true
    if (drag.current.moved) setDragY(dy)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current
    if (!state) return
    const dy = event.clientY - state.startY
    setDragY(null)
    if (!state.moved) return // toque: o onClick alterna a altura
    if (dy < -SNAP_DRAG) setBenSheetSnap('full')
    else if (dy > SNAP_DRAG) {
      if (snap === 'full') setBenSheetSnap('half')
      else onClose()
    }
  }

  const height = dragY === null ? SNAP_HEIGHT[snap] : `max(8rem, calc(${SNAP_HEIGHT[snap]} - ${dragY}px))`

  return (
    <div
      className={cn('flex min-h-0 flex-col', dragY === null && 'transition-[height] duration-200 ease-out motion-reduce:transition-none')}
      style={{ height }}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
          setDragY(null)
        }}
        onClick={() => {
          if (drag.current?.moved) {
            drag.current = null
            return
          }
          drag.current = null
          setBenSheetSnap(snap === 'full' ? 'half' : 'full')
        }}
        aria-label={snap === 'full' ? 'Reduzir o Ben para meia tela' : 'Expandir o Ben para tela cheia'}
        className="relative flex h-6 w-full shrink-0 touch-none items-center justify-center rounded-t-xl before:absolute before:inset-x-0 before:-top-2 before:-bottom-3 before:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
      </button>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Histórico e compartilhamento
// ─────────────────────────────────────────────────────────────────────────────

function HistoryMenu({ currentId, onNavigate }: { currentId: string | null; onNavigate: () => void }) {
  const { data: conversations, isLoading } = useBenConversations()
  const recent = (conversations ?? []).filter((c) => c.messageCount > 0 || c.id === currentId).slice(0, RECENT_LIMIT)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Conversas anteriores" title="Conversas anteriores">
          <History className="size-4" strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Conversas recentes</DropdownMenuLabel>
        {isLoading ? (
          <DropdownMenuItem disabled>Carregando…</DropdownMenuItem>
        ) : recent.length === 0 ? (
          <DropdownMenuItem disabled>Nenhuma conversa ainda</DropdownMenuItem>
        ) : (
          recent.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => setBenConversation(c.id, contextKeyFromUrl(c.contextUrl))}
              className={cn('min-h-11 flex-col items-start gap-0.5 md:min-h-0', c.id === currentId && 'bg-accent')}
              aria-current={c.id === currentId ? 'true' : undefined}
            >
              <span className="w-full truncate text-sm text-foreground">{c.title || 'Sem título'}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatDate(c.updatedAt)}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 md:min-h-0">
          <Link href="/conversas-ben" onClick={onNavigate}>
            Ver todas as conversas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function buildShareUrl(shareToken: string) {
  return `${window.location.origin}/share/ben/${shareToken}`
}

function SharePanel({
  conversationId,
  shareToken,
  onClose,
}: {
  conversationId: string
  shareToken: string | null
  onClose: () => void
}) {
  const shareConversation = useShareBenConversation()
  const unshareConversation = useUnshareBenConversation()
  const [shareUrl, setShareUrl] = useState<string | null>(shareToken ? buildShareUrl(shareToken) : null)
  const { mutateAsync: share, isPending: sharing } = shareConversation
  const requested = useRef(false)

  // Gera o link na primeira abertura (o servidor reaproveita o token se já existir)
  useEffect(() => {
    if (shareToken || requested.current || sharing) return
    requested.current = true
    share(conversationId)
      .then((result) => setShareUrl(buildShareUrl(result.shareToken)))
      .catch(() => {
        toast.error('Não foi possível gerar o link', { description: 'Tente novamente em instantes.' })
        onClose()
      })
  }, [conversationId, shareToken, sharing, share, onClose])

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar', { description: 'Selecione o link e copie manualmente.' })
    }
  }

  const unshare = async () => {
    try {
      await unshareConversation.mutateAsync(conversationId)
      toast.success('Link desativado', { description: 'A conversa não está mais pública.' })
      onClose()
    } catch {
      toast.error('Não foi possível desativar o link', { description: 'Tente novamente em instantes.' })
    }
  }

  return (
    <section id="ben-share-panel" aria-label="Link público" className="space-y-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h2 className="text-sm font-medium text-foreground">Link público</h2>
          <p className="text-xs text-muted-foreground">Qualquer pessoa com o link pode ler esta conversa.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar link público" className="-mt-2 -mr-2 shrink-0">
          <X className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
      {shareUrl ? (
        <>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly aria-label="Link da conversa" className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
            <Button size="sm" onClick={copyLink} className="h-11 md:h-9">
              <Copy className="size-4" strokeWidth={1.75} />
              Copiar
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={unshare} disabled={unshareConversation.isPending} className="h-11 w-full text-muted-foreground md:h-9">
            Desativar link
          </Button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          Gerando link…
        </p>
      )}
    </section>
  )
}
