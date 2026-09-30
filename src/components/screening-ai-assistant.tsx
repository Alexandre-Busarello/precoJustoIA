'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { ScreeningParams } from '@/lib/strategies/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ScreeningAIAssistantProps {
  onParametersGenerated: (parameters: ScreeningParams) => void
  availableSectors?: string[]
  availableIndustries?: string[]
  isLoggedIn?: boolean
  isPremium?: boolean
}

const SUGGESTIONS = [
  'Bancos com DY acima de 8%',
  'Empresas sólidas com P/L abaixo de 10',
  'Small caps com receita crescendo acima de 15% a.a.',
]

/**
 * Campo inline no topo do painel de filtros: o usuário descreve o que procura e a IA
 * preenche os filtros. Recurso Premium; para os demais, mostra o recurso bloqueado sem interromper.
 */
export function ScreeningAIAssistant({
  onParametersGenerated,
  availableSectors = [],
  availableIndustries = [],
  isLoggedIn = false,
  isPremium = false,
}: ScreeningAIAssistantProps) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isLoggedIn || !isPremium) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-sm font-medium text-foreground">Configurar com IA</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Descreva o que procura e a IA monta os filtros. Recurso Premium.{' '}
          <Link href={isLoggedIn ? '/planos' : '/register'} className="font-medium text-brand hover:underline">
            {isLoggedIn ? 'Ver planos' : 'Criar conta grátis'}
          </Link>
        </p>
      </div>
    )
  }

  const handleGenerate = async () => {
    const finalPrompt = prompt.trim()
    if (!finalPrompt) {
      setError('Descreva o que você procura para a IA configurar os filtros.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/screening-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, availableSectors, availableIndustries }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError(data.message || 'A configuração com IA é exclusiva do plano Premium.')
          return
        }
        throw new Error(data.error || 'Não foi possível gerar os filtros.')
      }

      if (!data.success || !data.parameters) throw new Error('A IA não retornou filtros válidos.')

      onParametersGenerated(data.parameters as ScreeningParams)
      setPrompt('')
      toast.success('Filtros configurados com IA', { description: 'Os resultados foram atualizados.' })
    } catch (err) {
      console.error('Erro ao gerar com IA:', err)
      setError(err instanceof Error ? err.message : 'Não foi possível gerar os filtros. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        handleGenerate()
      }}
    >
      <label htmlFor="screening-ai-prompt" className="text-sm font-medium text-foreground">
        Descreva o que procura
      </label>
      <Textarea
        id="screening-ai-prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleGenerate()
          }
        }}
        placeholder="Ex.: bancos com DY acima de 8%"
        rows={2}
        className="min-h-[64px] resize-none"
        disabled={isLoading}
        aria-describedby={error ? 'screening-ai-error' : undefined}
      />
      <div className="flex flex-wrap gap-1.5" aria-label="Sugestões">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setPrompt(suggestion)
              setError(null)
            }}
            disabled={isLoading}
            className="min-h-11 rounded-sm border border-border px-2 text-left text-xs md:min-h-8 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
      {error && (
        <p id="screening-ai-error" role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isLoading || !prompt.trim()}>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
        )}
        {isLoading ? 'Configurando…' : 'Configurar com IA'}
      </Button>
    </form>
  )
}
