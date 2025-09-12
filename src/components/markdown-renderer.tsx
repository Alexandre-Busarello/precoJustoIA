"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-foreground mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-foreground mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-foreground mb-2">{children}</h3>
          ),
          // Customize paragraph styles
          p: ({ children }) => (
            <p className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0">{children}</p>
          ),
          // Customize list styles
          ul: ({ children }) => (
            <ul className="text-sm text-muted-foreground space-y-1 mb-3">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm text-muted-foreground space-y-1 mb-3">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          // Customize strong/bold styles
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          // Customize em/italic styles
          em: ({ children }) => (
            <em className="italic text-foreground">{children}</em>
          ),
          // Customize code styles
          code: ({ children }) => (
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
              {children}
            </code>
          ),
          // Customize blockquote styles
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 my-3 text-sm text-muted-foreground italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
