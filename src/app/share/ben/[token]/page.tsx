/**
 * Página pública para visualizar conversas compartilhadas do Ben
 */

import { prisma } from '@/lib/prisma'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import Image from 'next/image'
import { MessageSquare } from 'lucide-react'
import { notFound } from 'next/navigation'

interface PageProps {
  params: {
    token: string
  }
}

export default async function SharedBenConversationPage({ params }: PageProps) {
  const { token } = params

  // Buscar conversa pelo token
  const conversation = await prisma.benConversation.findUnique({
    where: { shareToken: token },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!conversation) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-violet-500 p-0.5">
              <Image 
                src="/ben.png" 
                alt="Ben" 
                width={48} 
                height={48} 
                className="rounded-full w-full h-full object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold">Ben - Assistente IA</h1>
          </div>
          {conversation.title && (
            <p className="text-muted-foreground">{conversation.title}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Conversa compartilhada
          </p>
        </div>

        {/* Mensagens */}
        <div className="space-y-6">
          {conversation.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-4 ${
                msg.role === 'USER' ? 'flex-row-reverse' : ''
              }`}
            >
              {msg.role === 'ASSISTANT' && (
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-500 p-0.5">
                  <Image 
                    src="/ben.png" 
                    alt="Ben" 
                    width={40} 
                    height={40} 
                    className="rounded-full w-full h-full object-cover"
                  />
                </div>
              )}
              {msg.role === 'USER' && (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
              )}
              <div className={`flex-1 ${msg.role === 'USER' ? 'text-right' : ''}`}>
                <div
                  className={`rounded-lg p-4 ${
                    msg.role === 'ASSISTANT'
                      ? 'bg-muted'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 inline-block'
                  }`}
                >
                  {msg.role === 'ASSISTANT' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <MarkdownRenderer
                        content={msg.content}
                        className="prose-sm prose-headings:text-base prose-p:text-sm prose-strong:text-sm prose-ul:text-sm prose-ol:text-sm prose-li:text-sm"
                      />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(msg.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Esta é uma visualização somente leitura de uma conversa compartilhada.</p>
        </div>
      </div>
    </div>
  )
}

