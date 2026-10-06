/**
 * Página pública (somente leitura) de uma conversa do Ben compartilhada por link.
 */

import { cache } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'

interface PageProps {
  params: Promise<{ token: string }>
}

const getSharedConversation = cache((token: string) =>
  prisma.benConversation.findUnique({
    where: { shareToken: token },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const conversation = await getSharedConversation(token)
  return {
    title: conversation?.title ? `${conversation.title} · Conversa com o Ben` : 'Conversa com o Ben',
    description: 'Conversa compartilhada com o Ben, o assistente de análise do Preço Justo AI.',
    robots: { index: false, follow: false },
  }
}

export default async function SharedBenConversationPage({ params }: PageProps) {
  const { token } = await params
  const conversation = await getSharedConversation(token)

  if (!conversation) notFound()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="flex items-start gap-3 border-b border-border pb-6">
        <Image src="/ben.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-full border border-border object-cover" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Conversa compartilhada com o Ben</p>
          <h1 className="text-xl font-semibold tracking-tight text-balance break-words text-foreground sm:text-2xl">
            {conversation.title || 'Conversa com o Ben'}
          </h1>
        </div>
      </header>

      <ol className="space-y-8 py-8">
        {conversation.messages.map((msg) => (
          <li key={msg.id} className={msg.role === 'USER' ? 'flex flex-col items-end gap-1' : 'space-y-1'}>
            {msg.role === 'USER' ? (
              <div className="max-w-[85%] rounded-lg bg-muted px-4 py-3 text-sm leading-6 break-words whitespace-pre-wrap text-foreground sm:text-base sm:leading-7">
                {msg.content}
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Image src="/ben.png" alt="Ben" width={32} height={32} className="size-8 shrink-0 rounded-full border border-border object-cover" />
                <div className="min-w-0 flex-1 text-foreground">
                  <MarkdownRenderer content={msg.content} />
                </div>
              </div>
            )}
            <time
              dateTime={msg.createdAt.toISOString()}
              className={msg.role === 'USER' ? 'text-xs text-muted-foreground tabular-nums' : 'block pl-11 text-xs text-muted-foreground tabular-nums'}
            >
              {formatDate(msg.createdAt, { style: 'datetime' })}
            </time>
          </li>
        ))}
      </ol>

      <footer className="space-y-4 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          Visualização somente leitura. As respostas são estimativas geradas por IA a partir de dados públicos e não são
          recomendação de investimento.
        </p>
        <Button asChild variant="outline">
          <Link href="/register">Criar conta grátis</Link>
        </Button>
      </footer>
    </div>
  )
}
