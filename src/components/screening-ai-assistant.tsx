'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, X, Lightbulb, Wand2, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

interface ScreeningAIAssistantProps {
  onParametersGenerated: (parameters: any) => void
  availableSectors?: string[]
  availableIndustries?: string[]
  isLoggedIn?: boolean
  isPremium?: boolean
}

export function ScreeningAIAssistant({ 
  onParametersGenerated,
  availableSectors = [],
  availableIndustries = [],
  isLoggedIn = false,
  isPremium = false
}: ScreeningAIAssistantProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFirstTimePopup, setShowFirstTimePopup] = useState(false)

  // Verificar primeira visita
  useEffect(() => {
    const hasSeenPopup = localStorage.getItem('screening_ai_popup_seen')
    if (!hasSeenPopup) {
      setTimeout(() => {
        setShowFirstTimePopup(true)
      }, 1500) // Mostrar após 1.5s
    }
  }, [])

  const handleClosePopup = () => {
    setShowFirstTimePopup(false)
    localStorage.setItem('screening_ai_popup_seen', 'true')
  }

  const handleOpenAI = () => {
    setShowFirstTimePopup(false)
    setShowPrompt(true)
    localStorage.setItem('screening_ai_popup_seen', 'true')
    
    // Scroll para a área da IA
    setTimeout(() => {
      const aiElement = document.getElementById('ai-assistant')
      if (aiElement) {
        aiElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const suggestions = [
    "Empresas sólidas mais descontadas",
    "Bancos de qualidade negociados abaixo do P/VP",
    "Pagadoras de dividendos de qualidade com DY acima de 6%",
    "Small caps de qualidade com alto crescimento",
    "Blue chips subvalorizadas com baixo endividamento"
  ]

  const handleGenerate = async (selectedPrompt?: string) => {
    const finalPrompt = selectedPrompt || prompt
    
    if (!finalPrompt && !selectedPrompt) {
      setError('Digite uma instrução ou selecione uma sugestão')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/screening-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          availableSectors,
          availableIndustries
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Tratamento especial para erro 403 (não Premium)
        if (response.status === 403) {
          toast.error('Recurso Premium', {
            description: data.message || 'A configuração automática com IA é exclusiva para usuários Premium.'
          })
          setShowPrompt(false)
          return
        }
        throw new Error(data.error || 'Erro ao gerar parâmetros')
      }

      if (data.success && data.parameters) {
        onParametersGenerated(data.parameters)
        setShowPrompt(false)
        setPrompt('')
        
        // Exibir toast de sucesso
        toast.success('Parâmetros configurados com IA!', {
          description: data.message || 'Os filtros foram configurados automaticamente. Revise e ajuste se necessário.'
        })
      } else {
        throw new Error('Resposta inválida da IA')
      }

    } catch (err) {
      console.error('Erro ao gerar com IA:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      toast.error('Erro ao gerar parâmetros', {
        description: err instanceof Error ? err.message : 'Erro desconhecido'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Não exibir para usuários deslogados ou não-Premium
  if (!isLoggedIn || !isPremium) {
    return null;
  }

  return (
    <div id="ai-assistant" className="w-full">
      {/* Popup de primeira visita */}
      {showFirstTimePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <Card className="max-w-md w-full p-4 sm:p-6 relative bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/50 dark:to-blue-950/50 border-2 border-purple-200 dark:border-purple-800 shadow-2xl">
            <button
              onClick={handleClosePopup}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                Não sabe como configurar?
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Pergunte para nossa <strong>IA</strong>! 🤖
              </p>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Basta descrever o que você procura e nossa IA configura automaticamente os filtros para você!
              </p>

              <div className="space-y-2">
                <Button 
                  onClick={handleOpenAI}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Experimentar Agora
                </Button>

                <Button 
                  onClick={handleClosePopup}
                  variant="ghost"
                  className="w-full"
                  size="sm"
                >
                  Talvez depois
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Botão para abrir IA */}
      {!showPrompt && (
        <div className="mb-6">
          <Button
            onClick={() => setShowPrompt(true)}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg"
            size="lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Configurar com IA
            <Badge variant="secondary" className="ml-2">Novo</Badge>
          </Button>
        </div>
      )}

      {/* Interface de prompt da IA */}
      {showPrompt && (
        <Card className="mb-6 p-4 sm:p-6 border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 w-full overflow-hidden">
          <div className="flex items-center justify-between mb-4 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Assistente IA
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Powered by Gemini AI
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                setShowPrompt(false)
                setPrompt('')
                setError(null)
              }}
              variant="ghost"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Campo de input */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                O que você está procurando?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Bancos sendo negociados abaixo do P/VP"
                className="w-full p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-900 dark:border-gray-700"
                rows={3}
                disabled={isLoading}
              />
            </div>

            {/* Sugestões rápidas */}
            <div className="w-full overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Sugestões rápidas:
                </label>
              </div>
              <div className="flex flex-wrap gap-2 w-full">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    onClick={() => handleGenerate(suggestion)}
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className="text-xs hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/20 whitespace-normal text-left h-auto py-2 px-3 flex-shrink min-w-0"
                  >
                    <TrendingUp className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="break-words">{suggestion}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  ⚠️ {error}
                </p>
              </div>
            )}

            {/* Botão gerar */}
            <Button
              onClick={() => handleGenerate()}
              disabled={isLoading || !prompt}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gerando parâmetros...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Configurar Filtros com IA
                </>
              )}
            </Button>

            {/* Info */}
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              💡 A IA irá analisar sua instrução e configurar automaticamente todos os filtros necessários
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
