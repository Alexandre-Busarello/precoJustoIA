'use client'

/**
 * Markdown das respostas do Ben: tipografia compacta do chat, links internos com navegação do Next (o painel
 * continua aberto no desktop) e tabelas no estilo da DataTable (borda, cabeçalho em `bg-surface`, primeira coluna
 * fixa e rolagem horizontal dentro da própria tabela).
 */

import { memo } from 'react'
import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'
import { processBenMessageLinks } from '@/lib/ben-link-processor'

/** Remove o nó da AST que o react-markdown repassa aos componentes (não é atributo de DOM). */
function domProps<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const rest = { ...props }
  delete rest.node
  return rest
}

const LINK_CLASS = 'font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand'
const STICKY_CELL = 'first:sticky first:left-0 first:z-10'

function buildComponents(onNavigate?: () => void): Components {
  return {
    h1: (props) => <h3 {...domProps(props)} className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0" />,
    h2: (props) => <h3 {...domProps(props)} className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0" />,
    h3: (props) => <h4 {...domProps(props)} className="mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0" />,
    h4: (props) => <h5 {...domProps(props)} className="mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0" />,
    h5: (props) => <h6 {...domProps(props)} className="mt-3 mb-1.5 text-sm font-medium text-muted-foreground first:mt-0" />,
    h6: (props) => <h6 {...domProps(props)} className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground first:mt-0" />,
    p: (props) => <p {...domProps(props)} className="my-2.5 first:mt-0 last:mb-0" />,
    ul: (props) => <ul {...domProps(props)} className="my-2.5 list-disc space-y-1 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0" />,
    ol: (props) => <ol {...domProps(props)} className="my-2.5 list-decimal space-y-1 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0" />,
    li: (props) => <li {...domProps(props)} className="pl-0.5 [&>p]:my-1" />,
    strong: (props) => <strong {...domProps(props)} className="font-semibold text-foreground" />,
    em: (props) => <em {...domProps(props)} className="italic" />,
    a: ({ href = '', children }) => {
      if (href.startsWith('/') && !href.startsWith('//')) {
        return (
          <Link href={href} className={LINK_CLASS} onClick={onNavigate}>
            {children}
          </Link>
        )
      }
      const external = /^https?:/i.test(href)
      return (
        <a
          href={href}
          className={LINK_CLASS}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      )
    },
    blockquote: (props) => <blockquote {...domProps(props)} className="my-3 border-l-2 border-border pl-3 text-muted-foreground first:mt-0 last:mb-0" />,
    code: (props) => (
      <code {...domProps(props)} className={cn('rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground', props.className)} />
    ),
    pre: (props) => (
      <pre
        {...domProps(props)}
        className="my-3 overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-5 text-foreground [&_code]:bg-transparent [&_code]:p-0"
      />
    ),
    table: (props) => (
      <div className="my-3 w-full overflow-x-auto rounded-lg border border-border bg-card first:mt-0 last:mb-0">
        <table {...domProps(props)} className="w-full border-collapse text-sm tabular-nums" />
      </div>
    ),
    thead: (props) => <thead {...domProps(props)} className="bg-surface" />,
    tr: (props) => <tr {...domProps(props)} className="border-b border-border last:border-0" />,
    th: ({ style, children }) => (
      <th
        scope="col"
        style={style}
        className={cn('bg-surface px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground', STICKY_CELL)}
      >
        {children}
      </th>
    ),
    td: ({ style, children }) => (
      <td style={style} className={cn('min-w-24 bg-card px-3 py-2 align-top text-foreground first:min-w-0 first:font-medium first:whitespace-nowrap', STICKY_CELL)}>
        {children}
      </td>
    ),
    hr: () => <hr className="my-4 border-border" />,
    // Imagens de domínios arbitrários não entram no chat (só o texto alternativo).
    img: ({ alt }) => (alt ? <span className="text-muted-foreground">{alt}</span> : null),
  }
}

const DEFAULT_COMPONENTS = buildComponents()

function BenMarkdownBase({ content, onNavigate, className }: { content: string; onNavigate?: () => void; className?: string }) {
  return (
    <div className={cn('min-w-0 text-sm leading-6 break-words text-foreground', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={onNavigate ? buildComponents(onNavigate) : DEFAULT_COMPONENTS}>
        {processBenMessageLinks(content)}
      </ReactMarkdown>
    </div>
  )
}

/** Memoizado: durante o streaming só a resposta em curso re-renderiza. */
export const BenMarkdown = memo(BenMarkdownBase)
