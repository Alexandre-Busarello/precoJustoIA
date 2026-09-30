'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Escala dos títulos: prosa normal (relatório de IA, blog) e compacta (chat, cards, textos curtos).
 * H1 nunca passa de text-xl (20 px): o título da página é sempre maior que o da prosa.
 */
const HEADING = {
  regular: {
    h1: 'mt-8 mb-3 text-xl leading-snug',
    h2: 'mt-8 mb-3 text-lg leading-snug',
    h3: 'mt-6 mb-2 text-base leading-snug',
    h4: 'mt-5 mb-2 text-sm leading-snug',
  },
  compact: {
    h1: 'mt-4 mb-2 text-base leading-snug',
    h2: 'mt-4 mb-2 text-base leading-snug',
    h3: 'mt-3 mb-1.5 text-sm leading-snug',
    h4: 'mt-3 mb-1.5 text-sm leading-snug',
  },
} as const

/** Remove o nó da AST que o react-markdown repassa aos componentes (não é atributo de DOM). */
function domProps<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const rest = { ...props }
  delete rest.node
  return rest
}

const HEADING_BASE = 'scroll-mt-24 font-semibold tracking-tight text-foreground first:mt-0'

function buildComponents(scale: keyof typeof HEADING): Components {
  const heading = HEADING[scale]
  return {
    // "#" do markdown vira <h2> com cara de título: a página que hospeda o texto já tem o seu <h1>.
    h1: (props) => <h2 {...domProps(props)} className={cn(HEADING_BASE, heading.h1)} />,
    h2: (props) => <h2 {...domProps(props)} className={cn(HEADING_BASE, heading.h2)} />,
    h3: (props) => <h3 {...domProps(props)} className={cn(HEADING_BASE, heading.h3)} />,
    h4: (props) => <h4 {...domProps(props)} className={cn(HEADING_BASE, heading.h4)} />,
    h5: (props) => <h5 {...domProps(props)} className="mt-3 mb-1.5 text-sm font-medium text-muted-foreground first:mt-0" />,
    h6: (props) => <h6 {...domProps(props)} className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground first:mt-0" />,
    p: (props) => <p {...domProps(props)} className="my-3 first:mt-0 last:mb-0" />,
    ul: (props) => <ul {...domProps(props)} className="my-3 list-disc space-y-1.5 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0" />,
    ol: (props) => <ol {...domProps(props)} className="my-3 list-decimal space-y-1.5 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0" />,
    li: (props) => <li {...domProps(props)} className="pl-1 [&>p]:my-1" />,
    strong: (props) => <strong {...domProps(props)} className="font-semibold text-foreground" />,
    em: (props) => <em {...domProps(props)} className="italic" />,
    a: (props) => {
      const external = props.href?.startsWith('http')
      return (
        <a
          {...domProps(props)}
          className="font-medium text-brand underline decoration-brand/40 underline-offset-2 transition-colors hover:decoration-brand"
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
        />
      )
    },
    blockquote: (props) => <blockquote {...domProps(props)} className="my-4 border-l-2 border-border pl-4 text-muted-foreground first:mt-0 last:mb-0" />,
    code: (props) => (
      <code
        {...domProps(props)}
        className={cn('rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground', props.className)}
      />
    ),
    // Bloco de código: rola na horizontal; o `code` interno perde o fundo de código inline.
    pre: (props) => (
      <pre
        {...domProps(props)}
        className="my-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-6 text-foreground [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[length:inherit]"
      />
    ),
    // Tabela larga rola dentro do próprio contêiner, sem estourar a página no mobile.
    table: (props) => (
      <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
        <table {...domProps(props)} className="w-full border-collapse text-sm tabular-nums [&_tbody_tr:last-child_td]:border-0" />
      </div>
    ),
    thead: (props) => <thead {...domProps(props)} className="bg-surface" />,
    th: (props) => (
      <th
        {...domProps(props)}
        className="border-b border-border px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
      />
    ),
    td: (props) => <td {...domProps(props)} className="border-b border-border px-3 py-2 align-top text-foreground" />,
    hr: (props) => <hr {...domProps(props)} className="my-6 border-border" />,
    img: (props) => (
      <figure className="my-6">
        {/* Imagens do Markdown vêm de domínios arbitrários (blog, IA): next/image exigiria cada host no next.config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...domProps(props)} alt={props.alt ?? ''} className="mx-auto block h-auto max-w-full rounded-lg border border-border" />
        {props.alt && <figcaption className="mt-2 text-center text-xs text-muted-foreground">{props.alt}</figcaption>}
      </figure>
    ),
  }
}

const REGULAR_COMPONENTS = buildComponents('regular')
const COMPACT_COMPONENTS = buildComponents('compact')

/**
 * Markdown (IA, blog, chat, metodologia) com a tipografia do design system e cores por token (funciona no escuro).
 * Quem passa `prose-sm`, `text-xs` ou `text-sm` em `className` recebe a escala compacta.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const compact = /(^|\s)(prose-sm|text-xs|text-sm)(\s|$)/.test(className ?? '')

  return (
    <article
      className={cn(
        'prose prose-sm sm:prose-base dark:prose-invert max-w-none min-w-0 break-words text-foreground',
        compact ? 'text-sm leading-6' : 'text-base leading-7',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={compact ? COMPACT_COMPONENTS : REGULAR_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
