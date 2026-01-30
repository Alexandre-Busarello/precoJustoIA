'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <article className={cn("prose prose-lg max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Títulos com fonte do sistema
          h1: ({ children, ...props }) => (
            <h1 
              className="scroll-mt-20 text-[2.5rem] md:text-[3rem] font-bold text-[#1a1a1a] dark:text-gray-100 mb-6 mt-10 first:mt-0 leading-tight" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </h1>
          ),
          
          h2: ({ children, ...props }) => (
            <h2 
              className="scroll-mt-20 text-[2rem] md:text-[2.25rem] font-bold text-[#1a1a1a] dark:text-gray-100 mb-4 mt-10 first:mt-0 leading-tight" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </h2>
          ),
          
          h3: ({ children, ...props }) => (
            <h3 
              className="scroll-mt-20 text-[1.5rem] md:text-[1.75rem] font-semibold text-[#1a1a1a] dark:text-gray-100 mb-3 mt-8 first:mt-0 leading-snug" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </h3>
          ),
          
          h4: ({ children, ...props }) => (
            <h4 
              className="scroll-mt-20 text-[1.25rem] md:text-[1.375rem] font-semibold text-[#242424] dark:text-gray-200 mb-3 mt-6 first:mt-0 leading-snug" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </h4>
          ),
          
          h5: ({ children, ...props }) => (
            <h5 
              className="scroll-mt-20 text-[1.125rem] font-semibold text-[#242424] dark:text-gray-200 mb-2 mt-5 first:mt-0 leading-snug" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </h5>
          ),
          
          h6: ({ children, ...props }) => (
            <h6 
              className="scroll-mt-20 text-[1rem] font-semibold text-[#3a3a3a] dark:text-gray-300 mb-2 mt-4 first:mt-0 leading-normal" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </h6>
          ),

          // Parágrafos com fonte do sistema
          p: ({ children, ...props }) => (
            <p 
              className="text-[#3a3a3a] dark:text-gray-300 leading-relaxed mb-4 text-[1rem] font-normal" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </p>
          ),

          // Listas compactas
          ul: ({ children, ...props }) => (
            <ul 
              className="space-y-2 mb-4 ml-0 list-none" 
              {...props}
            >
              {children}
            </ul>
          ),
          
          ol: ({ children, ...props }) => (
            <ol 
              className="space-y-2 mb-4 ml-6 list-decimal" 
              {...props}
            >
              {children}
            </ol>
          ),
          
          li: ({ children, ...props }) => (
            <li 
              className="leading-relaxed text-[1rem] text-[#3a3a3a] dark:text-gray-300 pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-[#666]" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </li>
          ),

          // Texto em destaque sutil
          strong: ({ children, ...props }) => (
            <strong 
              className="font-bold text-[#1a1a1a] dark:text-gray-50" 
              {...props}
            >
              {children}
            </strong>
          ),
          
          em: ({ children, ...props }) => (
            <em 
              className="italic text-[#242424] dark:text-gray-200" 
              {...props}
            >
              {children}
            </em>
          ),

          // Links minimalistas
          // Garantir que links dentro de parênteses sejam renderizados corretamente
          a: ({ children, href, ...props }) => (
            <a 
              href={href}
              className="text-[#1a1a1a] dark:text-gray-200 underline decoration-[#1a1a1a]/30 dark:decoration-gray-400/30 underline-offset-2 hover:decoration-[#1a1a1a] dark:hover:decoration-gray-200 transition-colors duration-150 inline" 
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </a>
          ),

          // Citações compactas
          blockquote: ({ children, ...props }) => (
            <blockquote 
              className="border-l-[3px] border-gray-300 dark:border-gray-600 bg-transparent pl-6 pr-0 py-1 my-6 italic text-[1rem] text-[#3a3a3a] dark:text-gray-300" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Código inline minimalista
          code: ({ children, className, ...props }) => {
            const isInline = !className
            
            if (isInline) {
              return (
                <code 
                  className="bg-[#f6f6f6] dark:bg-gray-800 text-[#1a1a1a] dark:text-gray-200 px-1.5 py-0.5 rounded text-[0.925em] font-mono" 
                  {...props}
                >
                  {children}
                </code>
              )
            }
            
            // Para blocos de código
            return (
              <code 
                className="block text-[14px] font-mono leading-[1.6] whitespace-pre-wrap" 
                {...props}
              >
                {children}
              </code>
            )
          },
          
          pre: ({ children, ...props }) => (
            <div className="my-6">
              {/* Header minimalista */}
              <div className="bg-[#f6f6f6] dark:bg-gray-800 px-4 py-2 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs text-[#666] dark:text-gray-400 font-mono">
                  Dados
                </span>
              </div>
              
              {/* Conteúdo do código */}
              <pre 
                className="bg-[#fafafa] dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg p-4 overflow-x-auto" 
                {...props}
              >
                <div className="text-[#1a1a1a] dark:text-gray-200 font-mono text-[14px] leading-normal">
                  {children}
                </div>
              </pre>
            </div>
          ),

          // Tabelas compactas
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-6 border border-gray-200 dark:border-gray-700 rounded-lg">
              <table 
                className="min-w-full border-collapse" 
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          
          thead: ({ children, ...props }) => (
            <thead 
              className="bg-[#fafafa] dark:bg-gray-800" 
              {...props}
            >
              {children}
            </thead>
          ),
          
          th: ({ children, ...props }) => (
            <th 
              className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold text-[0.875rem] text-[#1a1a1a] dark:text-gray-200" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </th>
          ),
          
          td: ({ children, ...props }) => (
            <td 
              className="border-b border-gray-100 dark:border-gray-800 px-4 py-2 text-[0.875rem] text-[#3a3a3a] dark:text-gray-300" 
              style={{ 
                fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
              }}
              {...props}
            >
              {children}
            </td>
          ),

          // Linha horizontal compacta
          hr: ({ ...props }) => (
            <hr 
              className="border-0 border-t border-gray-200 dark:border-gray-700 my-8" 
              {...props}
            />
          ),

          // Imagens compactas
          img: ({ src, alt, ...props }) => (
            <figure className="my-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-lg mx-auto block border border-gray-200 dark:border-gray-700" 
                {...props}
              />
              {alt && (
                <figcaption className="text-center text-[0.8125rem] text-[#666] dark:text-gray-400 mt-2">
                  {alt}
                </figcaption>
              )}
            </figure>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}