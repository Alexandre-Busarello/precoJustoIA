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
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Títulos com hierarquia visual clara
          h1: ({ children, ...props }) => (
            <h1 
              className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8 mt-12 first:mt-0 pb-4 border-b-2 border-blue-100 dark:border-blue-900/30 leading-tight" 
              {...props}
            >
              {children}
            </h1>
          ),
          
          h2: ({ children, ...props }) => (
            <h2 
              className="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-6 mt-10 first:mt-0 pb-3 border-b border-gray-200 dark:border-gray-700 leading-tight" 
              {...props}
            >
              {children}
            </h2>
          ),
          
          h3: ({ children, ...props }) => (
            <h3 
              className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-8 first:mt-0 leading-tight" 
              {...props}
            >
              {children}
            </h3>
          ),
          
          h4: ({ children, ...props }) => (
            <h4 
              className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-3 mt-6 first:mt-0 leading-tight" 
              {...props}
            >
              {children}
            </h4>
          ),
          
          h5: ({ children, ...props }) => (
            <h5 
              className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2 mt-5 first:mt-0 leading-tight" 
              {...props}
            >
              {children}
            </h5>
          ),
          
          h6: ({ children, ...props }) => (
            <h6 
              className="text-base font-medium text-gray-600 dark:text-gray-400 mb-2 mt-4 first:mt-0 leading-tight" 
              {...props}
            >
              {children}
            </h6>
          ),

          // Parágrafos com espaçamento otimizado para leitura
          p: ({ children, ...props }) => (
            <p 
              className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 text-base sm:text-lg" 
              {...props}
            >
              {children}
            </p>
          ),

          // Listas com melhor espaçamento
          ul: ({ children, ...props }) => (
            <ul 
              className="list-disc pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300" 
              {...props}
            >
              {children}
            </ul>
          ),
          
          ol: ({ children, ...props }) => (
            <ol 
              className="list-decimal pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300" 
              {...props}
            >
              {children}
            </ol>
          ),
          
          li: ({ children, ...props }) => (
            <li 
              className="leading-relaxed text-base sm:text-lg mb-1" 
              {...props}
            >
              {children}
            </li>
          ),

          // Texto em destaque
          strong: ({ children, ...props }) => (
            <strong 
              className="font-semibold text-gray-900 dark:text-gray-100" 
              {...props}
            >
              {children}
            </strong>
          ),
          
          em: ({ children, ...props }) => (
            <em 
              className="italic text-gray-800 dark:text-gray-200" 
              {...props}
            >
              {children}
            </em>
          ),

          // Links com hover suave
          a: ({ children, href, ...props }) => (
            <a 
              href={href}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 decoration-blue-600/30 hover:decoration-blue-600 transition-colors duration-200" 
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </a>
          ),

          // Citações com estilo elegante
          blockquote: ({ children, ...props }) => (
            <blockquote 
              className="border-l-4 border-blue-500 pl-6 py-2 my-6 bg-blue-50 dark:bg-blue-950/20 rounded-r-lg italic text-gray-700 dark:text-gray-300" 
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Código inline e blocos
          code: ({ children, className, ...props }) => {
            const isInline = !className
            
            if (isInline) {
              return (
                <code 
                  className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-md text-sm font-mono border border-blue-200 dark:border-blue-800" 
                  {...props}
                >
                  {children}
                </code>
              )
            }
            
            // Para blocos de código
            return (
              <code 
                className="block text-sm font-mono leading-relaxed whitespace-pre-wrap" 
                {...props}
              >
                {children}
              </code>
            )
          },
          
          pre: ({ children, ...props }) => (
            <div className="my-8 relative">
              {/* Header do bloco de código */}
              <div className="bg-gray-200 dark:bg-gray-800 px-4 py-2 rounded-t-xl border-b border-gray-300 dark:border-gray-600">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 ml-2 font-mono">
                    Dados
                  </span>
                </div>
              </div>
              
              {/* Conteúdo do código */}
              <pre 
                className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-x border-b border-gray-200 dark:border-gray-700 rounded-b-xl p-6 overflow-x-auto shadow-sm" 
                {...props}
              >
                <div className="text-gray-700 dark:text-gray-300 font-mono text-sm leading-loose tracking-wide">
                  {children}
                </div>
              </pre>
            </div>
          ),

          // Tabelas responsivas
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto mb-6">
              <table 
                className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden" 
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          
          thead: ({ children, ...props }) => (
            <thead 
              className="bg-gray-50 dark:bg-gray-800" 
              {...props}
            >
              {children}
            </thead>
          ),
          
          th: ({ children, ...props }) => (
            <th 
              className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100" 
              {...props}
            >
              {children}
            </th>
          ),
          
          td: ({ children, ...props }) => (
            <td 
              className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-gray-700 dark:text-gray-300" 
              {...props}
            >
              {children}
            </td>
          ),

          // Linha horizontal
          hr: ({ ...props }) => (
            <hr 
              className="border-0 border-t border-gray-300 dark:border-gray-600 my-8" 
              {...props}
            />
          ),

          // Imagens responsivas
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={src}
              alt={alt}
              className="max-w-full h-auto rounded-lg shadow-md mb-6 mx-auto block" 
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}