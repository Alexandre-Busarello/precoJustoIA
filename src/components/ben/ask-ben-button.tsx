'use client'

/**
 * "Perguntar ao Ben": abre o chat numa conversa nova com a pergunta já enviada e o contexto da tela.
 * - Só aparece com sessão (o Ben exige login).
 * - Confere o limite do plano antes (grátis: 2 mensagens por dia); no limite, mostra o aviso em vez de abrir o chat.
 * - Registra o contexto da tela (sem o item clicado) para o chat do botão flutuante também usá-lo nesta rota.
 * O ticker do ativo, quando não vem no `context`, sai da URL.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2, MessageCircleQuestion } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BenChatSidebar } from '@/components/ben-chat-sidebar'
import { useAskBen, type BenLimitState } from '@/hooks/use-ben-chat'
import { registerPageContext, resolvePageContext } from '@/lib/ben-context/store'
import type { BenPageContext } from '@/lib/ben-context/types'
import { cn } from '@/lib/utils'

export interface AskBenButtonProps {
  /** Pergunta enviada ao Ben, já com os números da tela ("Por que o preço justo pelo FCD é R$ 45,10?"). */
  question: string
  /** Contexto da tela; completa o da rota. Use os builders de `@/lib/ben-context/builders`. */
  context?: Partial<BenPageContext>
  /** `button`: contorno com texto; `icon`: só o ícone (linhas de tabela e listas). */
  variant?: 'button' | 'icon'
  /** Texto do botão (e nome acessível do ícone). */
  label?: string
  /** Registra o contexto como o da página. Desligue quando o contexto descreve só um item (ex.: uma linha). */
  registerContext?: boolean
  className?: string
}

export function AskBenButton({
  question,
  context,
  variant = 'button',
  label = 'Perguntar ao Ben',
  registerContext = true,
  className,
}: AskBenButtonProps) {
  const { data: session } = useSession()
  const pathname = usePathname() ?? '/'
  const { ask, isAsking } = useAskBen()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [limit, setLimit] = useState<BenLimitState | null>(null)
  const [checking, setChecking] = useState(false)

  const contextKey = JSON.stringify(context ?? null)
  const resolvedContext = useMemo(
    () => resolvePageContext(pathname, context ?? null),
    // contextKey resume `context`: o objeto muda a cada render da superfície, o conteúdo não
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, contextKey]
  )

  const hasContext = context !== undefined
  useEffect(() => {
    if (registerContext && hasContext) registerPageContext(pathname, resolvedContext)
  }, [registerContext, hasContext, pathname, resolvedContext])

  if (!session) return null

  const busy = checking || isAsking

  const handleClick = async () => {
    if (busy) return
    setChecking(true)
    try {
      const outcome = await ask(question, resolvedContext, {
        onStarted: (id) => {
          setConversationId(id)
          setChatOpen(true)
        },
        onFailed: () => {
          toast.error('O Ben não conseguiu responder agora', { description: 'Tente de novo em instantes.' })
        },
      })
      if (outcome.status === 'limit') setLimit(outcome.limit)
    } catch {
      toast.error('Não foi possível abrir o chat do Ben', { description: 'Verifique a conexão e tente de novo.' })
    } finally {
      setChecking(false)
    }
  }

  const icon = busy ? (
    <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
  ) : (
    <MessageCircleQuestion className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
  )

  return (
    <>
      {variant === 'icon' ? (
        <Button
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleClick}
          aria-busy={busy}
          aria-label={`${label}: ${question}`}
          title={label}
          className={className}
        >
          {icon}
        </Button>
      ) : (
        <Button
          ref={buttonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          aria-busy={busy}
          title={question}
          className={cn('shrink-0', className)}
        >
          {icon}
          {label}
        </Button>
      )}

      {conversationId && (
        <BenChatSidebar
          open={chatOpen}
          onOpenChange={setChatOpen}
          initialConversationId={conversationId}
          returnFocusRef={buttonRef}
        />
      )}

      <Dialog open={limit !== null} onOpenChange={(open) => !open && setLimit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Você já usou as mensagens de hoje</DialogTitle>
            <DialogDescription>
              No plano gratuito, o Ben responde {limit && limit.limit > 0 ? limit.limit : 2} mensagens por dia. Volte amanhã ou
              assine o Premium para conversar sem limite.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
            <Button asChild>
              <Link href="/planos">Ver planos</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
