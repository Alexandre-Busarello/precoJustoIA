"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-gray dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Hierarquia clara de títulos com tamanhos distintos
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mb-6 mt-8 first:mt-0 border-b border-border pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-foreground mb-4 mt-6 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mb-3 mt-5 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mb-2 mt-4 first:mt-0">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold text-foreground mb-2 mt-3 first:mt-0">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold text-foreground mb-2 mt-3 first:mt-0 uppercase tracking-wide">
              {children}
            </h6>
          ),
          
          // Parágrafos com melhor espaçamento
          p: ({ children }) => (
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 last:mb-0">
              {children}
            </p>
          ),
          
          // Listas com melhor formatação e indentação
          ul: ({ children }) => (
            <ul className="text-sm text-muted-foreground space-y-2 mb-4 pl-4 list-disc marker:text-muted-foreground/60">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm text-muted-foreground space-y-2 mb-4 pl-4 list-decimal marker:text-muted-foreground/60">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-1">
              {children}
            </li>
          ),
          
          // Texto em negrito e itálico
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground">
              {children}
            </em>
          ),
          
          // Código inline e blocos de código
          code: ({ children, className }) => {
            // Se tem className, é um bloco de código
            if (className) {
              return (
                <code className={`block bg-muted/50 p-4 rounded-lg text-xs font-mono text-foreground overflow-x-auto border ${className}`}>
                  {children}
                </code>
              )
            }
            // Código inline
            return (
              <code className="bg-muted/70 px-2 py-1 rounded text-xs font-mono text-foreground border">
                {children}
              </code>
            )
          },
          
          // Blocos de código pré-formatados
          pre: ({ children }) => (
            <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto border mb-4 mt-2">
              {children}
            </pre>
          ),
          
          // Blockquotes melhorados
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 pl-6 pr-4 py-3 my-4 text-sm text-muted-foreground italic rounded-r-lg">
              {children}
            </blockquote>
          ),
          
          // Tabelas com melhor formatação
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody>
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-border hover:bg-muted/30 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="text-left p-3 text-xs font-semibold text-foreground border-r border-border last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-3 text-xs text-muted-foreground border-r border-border last:border-r-0">
              {children}
            </td>
          ),
          
          // Separadores horizontais
          hr: () => (
            <hr className="my-6 border-t border-border" />
          ),
          
          // Links
          a: ({ children, href }) => (
            <a 
              href={href} 
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-600/30 hover:decoration-blue-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
