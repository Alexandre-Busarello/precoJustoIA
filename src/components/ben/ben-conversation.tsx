'use client'

/**
 * Corpo do painel do Ben: tela inicial por contexto, mensagens, andamento da resposta (consultando dados,
 * escrevendo, parar, tentar de novo), sugestões de continuação, limite do plano e o campo de mensagem.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, Loader2, RotateCcw, Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  dismissBenRun,
  isBenRunActive,
  stopBenRun,
  useBenLimit,
  useBenMessages,
  useBenRun,
  useBenSend,
  type BenMessage,
  type BenRun,
} from '@/hooks/use-ben-chat'
import type { BenPageContext } from '@/lib/ben-context/types'
import type { BenSuggestion } from '@/lib/ben-context/questions'
import { formatDate } from '@/lib/format'
import { BenMarkdown } from './ben-markdown'
import {
  contextHint,
  followUpSuggestions,
  limitLabel,
  startSuggestions,
  summarizeLongAnswer,
  toolStatusLabel,
} from './ben-chat-utils'

export interface BenConversationProps {
  conversationId: string | null
  /** Contexto enviado com as perguntas (o genérico quando o usuário tirou o da tela). */
  context: BenPageContext
  contextUrl: string
  /** A conversa começou em outra tela: oferece uma conversa nova sobre esta (`pageLabel`). */
  mismatch: { pageLabel: string } | null
  onConversationCreated: (conversationId: string) => void
  onNewConversationHere: () => void
  /** Um link da resposta levou a outra página (no mobile, a folha fecha). */
  onNavigate: () => void
  composerRef: RefObject<HTMLTextAreaElement | null>
  onComposerFocus?: () => void
}

/** Distância do fim (px) abaixo da qual a lista acompanha a resposta que chega. */
const STICK_THRESHOLD = 96

function plainText(markdown: string): string {
  return markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()
}

export function BenConversation({
  conversationId,
  context,
  contextUrl,
  mismatch,
  onConversationCreated,
  onNewConversationHere,
  onNavigate,
  composerRef,
  onComposerFocus,
}: BenConversationProps) {
  const queryClient = useQueryClient()
  const { data: messages, isLoading: messagesLoading } = useBenMessages(conversationId)
  const run = useBenRun(conversationId)
  const { data: limit } = useBenLimit()
  const { send, isCreating } = useBenSend()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  const saved = useMemo(() => messages ?? [], [messages])
  // A resposta em curso some quando a versão salva chega
  const runVisible = run !== null && !(run.phase === 'saving' && saved.length > run.baseCount)
  const active = isBenRunActive(run)
  const busy = active || sending || isCreating
  const isFree = limit !== undefined && limit.limit > 0
  const limitReached = limit !== undefined && !limit.allowed
  const hasContent = saved.length > 0 || runVisible

  // Acompanha o fim da lista enquanto o usuário não rolou para cima (a tela inicial fica no topo)
  useEffect(() => {
    const el = scrollRef.current
    if (el && hasContent && stickRef.current) el.scrollTop = el.scrollHeight
  }, [hasContent, saved.length, run?.answer, run?.phase, run?.tools.length])

  useEffect(() => {
    stickRef.current = true
  }, [conversationId])

  const sendText = useCallback(
    async (text: string, { restore = false }: { restore?: boolean } = {}) => {
      const question = text.trim()
      if (!question || busy) return
      setSending(true)
      stickRef.current = true
      if (restore) setDraft('')
      try {
        const outcome = await send({ conversationId, question, context, contextUrl, onConversation: onConversationCreated })
        if (outcome.status === 'limit') {
          if (restore) setDraft(question)
          queryClient.setQueryData(['ben-limit'], outcome.limit)
        }
      } catch {
        if (restore) setDraft(question)
        toast.error('Não foi possível iniciar a conversa', { description: 'Verifique a conexão e tente de novo.' })
      } finally {
        setSending(false)
      }
    },
    [busy, send, conversationId, context, contextUrl, onConversationCreated, queryClient]
  )

  const retry = (failed: BenRun) => {
    if (!conversationId) return
    void sendText(failed.request.question)
  }

  const lastAssistantIndex = saved.map((m) => m.role).lastIndexOf('ASSISTANT')
  const followUps =
    !runVisible && lastAssistantIndex === saved.length - 1 && lastAssistantIndex >= 0
      ? followUpSuggestions(
          context,
          saved.filter((m) => m.role === 'USER').map((m) => m.content),
          saved[lastAssistantIndex].content
        )
      : []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="w-full min-w-0 space-y-5 px-4 py-4">
          {mismatch && hasContent && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">Esta conversa começou em outra tela.</p>
              <Button variant="outline" size="sm" className="w-fit shrink-0" onClick={onNewConversationHere}>
                Nova conversa sobre {mismatch.pageLabel}
              </Button>
            </div>
          )}

          {conversationId && messagesLoading && !runVisible ? (
            <MessagesSkeleton />
          ) : !hasContent ? (
            <StartScreen
              context={context}
              disabled={busy || limitReached}
              onPick={(item) => void sendText(item.prompt)}
            />
          ) : (
            <>
              {saved.map((message, index) =>
                message.role === 'USER' ? (
                  <UserMessage key={message.id} content={message.content} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    collapsible={index !== lastAssistantIndex || runVisible}
                    onNavigate={onNavigate}
                  />
                )
              )}
              {runVisible && run && (
                <>
                  <UserMessage content={run.question} />
                  <RunAnswer run={run} onNavigate={onNavigate} onRetry={() => retry(run)} onDismiss={() => conversationId && dismissBenRun(conversationId)} />
                </>
              )}
              {followUps.length > 0 && !limitReached && (
                <SuggestionList title="Continuar" items={followUps} disabled={busy} onPick={(item) => void sendText(item.prompt)} />
              )}
            </>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {runAnnouncement(run, runVisible)}
      </p>

      {limitReached && limit ? (
        <LimitState limit={limit.limit} onNavigate={onNavigate} />
      ) : (
        <form
          className="space-y-2 border-t border-border px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (active && conversationId) stopBenRun(conversationId)
            else void sendText(draft, { restore: true })
          }}
        >
          {isFree && (
            <p id="ben-limit-line" className="text-xs text-muted-foreground tabular-nums">
              {limitLabel(limit.limit, limit.remaining)}
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={onComposerFocus}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  if (!active) void sendText(draft, { restore: true })
                }
              }}
              placeholder="Pergunte ao Ben"
              aria-label="Mensagem para o Ben"
              aria-describedby={isFree ? 'ben-limit-line' : undefined}
              rows={1}
              className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none"
            />
            {active ? (
              <Button type="submit" variant="outline" size="icon" aria-label="Parar resposta" title="Parar resposta">
                <Square className="size-4" strokeWidth={1.75} />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!draft.trim() || busy} aria-label="Enviar mensagem" title="Enviar">
                {sending || isCreating ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Send className="size-4" strokeWidth={1.75} />
                )}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

function runAnnouncement(run: BenRun | null, visible: boolean): string {
  if (!run || !visible) return ''
  switch (run.phase) {
    case 'consulting':
      return 'O Ben está consultando os dados.'
    case 'writing':
      return 'O Ben está escrevendo a resposta.'
    case 'saving':
      return 'Resposta do Ben pronta.'
    case 'stopped':
      return 'Resposta interrompida.'
    case 'error':
      return run.error ?? 'O Ben não conseguiu responder.'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tela inicial
// ─────────────────────────────────────────────────────────────────────────────

function StartScreen({ context, disabled, onPick }: { context: BenPageContext; disabled: boolean; onPick: (item: BenSuggestion) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <BenAvatar />
        <p className="pt-1 text-sm leading-6 text-foreground">{contextHint(context)}</p>
      </div>
      <SuggestionList items={startSuggestions(context)} disabled={disabled} onPick={onPick} />
      <p className="text-xs text-muted-foreground">
        O Ben consulta os dados da plataforma; não é recomendação de investimento.
      </p>
    </div>
  )
}

function SuggestionList({
  title,
  items,
  disabled,
  onPick,
}: {
  title?: string
  items: BenSuggestion[]
  disabled: boolean
  onPick: (item: BenSuggestion) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-medium text-muted-foreground">{title}</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.prompt}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(item)}
              className="flex min-h-11 w-full items-center rounded-md border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:min-h-10"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensagens
// ─────────────────────────────────────────────────────────────────────────────

function BenAvatar() {
  return (
    <Image src="/ben.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-full border border-border object-cover" />
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm leading-6 whitespace-pre-wrap break-words text-foreground">
        {content}
      </p>
    </div>
  )
}

function AssistantShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <BenAvatar />
      <div className="min-w-0 flex-1 space-y-1.5 pt-1">
        {children}
        {footer}
      </div>
    </div>
  )
}

function AssistantMessage({
  message,
  collapsible,
  onNavigate,
}: {
  message: BenMessage
  collapsible: boolean
  onNavigate: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const summary = collapsible ? summarizeLongAnswer(message.content) : null
  const collapsed = summary !== null && !expanded

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(message.content))
      setCopied(true)
    } catch {
      toast.error('Não foi possível copiar', { description: 'Selecione o texto e copie manualmente.' })
    }
  }

  return (
    <AssistantShell
      footer={
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
          <time dateTime={new Date(message.createdAt).toISOString()} className="mr-1 tabular-nums">
            {formatDate(message.createdAt, { style: 'datetime' })}
          </time>
          {summary !== null && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Ver menos' : 'Ver mais'}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={copy} aria-label={copied ? 'Resposta copiada' : 'Copiar resposta'}>
            {copied ? <Check className="size-4" strokeWidth={1.75} /> : <Copy className="size-4" strokeWidth={1.75} />}
            {copied ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
      }
    >
      <BenMarkdown content={collapsed ? summary : message.content} onNavigate={onNavigate} />
    </AssistantShell>
  )
}

function RunAnswer({
  run,
  onNavigate,
  onRetry,
  onDismiss,
}: {
  run: BenRun
  onNavigate: () => void
  onRetry: () => void
  onDismiss: () => void
}) {
  const toolLabels = Array.from(new Set(run.tools.map((tool) => toolStatusLabel(tool.name, tool.args))))

  if (run.phase === 'error') {
    return (
      <AssistantShell>
        <div role="alert" className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
          <p className="text-foreground">{run.error}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="size-4 text-muted-foreground" strokeWidth={1.75} />
              Tentar de novo
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onDismiss}>
              Descartar
            </Button>
          </div>
        </div>
      </AssistantShell>
    )
  }

  return (
    <AssistantShell
      footer={
        run.phase === 'stopped' ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Resposta interrompida.</span>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onRetry}>
              <RotateCcw className="size-4" strokeWidth={1.75} />
              Tentar de novo
            </Button>
          </div>
        ) : run.phase === 'writing' ? (
          <p className="text-xs text-muted-foreground">Escrevendo…</p>
        ) : null
      }
    >
      {run.phase === 'stopped' && !run.answer ? null : run.phase === 'consulting' ? (
        <div className="space-y-1.5 text-sm" aria-busy="true">
          <p className="flex items-center gap-2 text-foreground">
            <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            Consultando dados…
          </p>
          {toolLabels.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {toolLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div aria-busy={run.phase === 'writing'}>
          <BenMarkdown content={run.answer} onNavigate={onNavigate} />
        </div>
      )}
    </AssistantShell>
  )
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="ml-auto h-9 w-2/3" />
      <div className="flex gap-3">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Limite do plano
// ─────────────────────────────────────────────────────────────────────────────

function LimitState({ limit, onNavigate }: { limit: number; onNavigate: () => void }) {
  return (
    <div role="status" className="space-y-3 border-t border-border bg-surface px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">Você usou as mensagens de hoje</p>
        <p className="text-muted-foreground">
          No plano gratuito, o Ben responde {limit} {limit === 1 ? 'mensagem' : 'mensagens'} por dia. Volte amanhã ou assine o
          Premium para conversar sem limite.
        </p>
      </div>
      <Button asChild size="sm" className="w-full sm:w-fit">
        <Link href="/planos" onClick={onNavigate}>
          Ver planos
        </Link>
      </Button>
    </div>
  )
}
