'use client'

/**
 * Ben Chat Sidebar - Componente principal do chat do Ben
 */

import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  useBenConversations, 
  useCreateBenConversation, 
  useSendBenMessageStream,
  useBenMemory,
  useBenMessages,
  useShareBenConversation,
  useUnshareBenConversation
} from '@/hooks/use-ben-chat'
import { useQueryClient } from '@tanstack/react-query'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useToast } from '@/hooks/use-toast'
import { usePathname } from 'next/navigation'
import { 
  MessageSquare, 
  Send, 
  X, 
  Loader2,
  TrendingUp,
  BookOpen,
  Target,
  Plus,
  Share2,
  DollarSign,
  Radar,
  Sparkles,
  Activity,
  BarChart3,
  GitCompare,
  Zap,
  FileText,
  AlertTriangle,
  Crosshair
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { processBenMessageLinks } from '@/lib/ben-link-processor'

interface BenChatSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialConversationId?: string
  forceNewConversation?: boolean // Flag para forçar criação de nova conversa
}

const ANALISE_FLASH_TEMPLATE = `Faça uma análise "Flash" de [TICKER] em formato de Tweet/Lista.
Quero apenas os dados crus e diretos:
1. 💰 Preço Atual vs. Preço Justo (Mostre o % de Upside)
2. 📉 Status da Análise Técnica (Ex: Sobrecompra/Venda ou Neutro)
3. 💸 Dividend Yield Projetado (12m)
4. 🎯 Veredito Final: [COMPRA / AGUARDAR / VENDA]
Sem textos longos. Use emojis e seja direto.`

const RESUMO_EXECUTIVO_TEMPLATE = `Resumo executivo de [TICKER] em 5 bullet points: preço justo, upside, dividend yield, riscos principais, veredito. Seja direto.`

const RISCOS_OPORTUNIDADES_TEMPLATE = `Liste os 3 principais riscos e 3 principais oportunidades de [TICKER] de forma objetiva.`

const SETUP_COMPRA_TEMPLATE = `Analise [TICKER] e indique: melhor ponto de entrada, alvos de preço e stop loss sugerido.`

const DIVIDENDOS_1MIN_TEMPLATE = `Resumo rápido dos dividendos de [TICKER]: yield projetado 12m, próximos pagamentos, sustentabilidade (1 parágrafo).`

interface QuickAction {
  label: string
  prompt: string
  icon: any
  requiresTicker?: boolean
  promptTemplate?: string
}

/**
 * Gera Quick Actions baseadas na memória, mensagens da conversa e contexto da página
 */
function generateQuickActions(
  memories: any[], 
  messages: any[] = [],
  pageContext?: { pageType: string; ticker?: string; companyName?: string }
): QuickAction[] {
  const actions: QuickAction[] = []
  const tickerContext = pageContext?.ticker
  const displayName = tickerContext ? (pageContext.companyName || tickerContext) : ''

  // AÇÕES QUE PRECISAM DE TICKER - Prompts inteligentes (prioridade alta)
  const tickerDependentActions = (ticker?: string): QuickAction[] => [
    { label: 'Análise Flash', prompt: (ticker ? ANALISE_FLASH_TEMPLATE.replace(/\[TICKER\]/g, ticker) : ANALISE_FLASH_TEMPLATE), icon: Zap, requiresTicker: true, promptTemplate: ANALISE_FLASH_TEMPLATE },
    { label: 'Resumo Executivo', prompt: (ticker ? RESUMO_EXECUTIVO_TEMPLATE.replace(/\[TICKER\]/g, ticker) : RESUMO_EXECUTIVO_TEMPLATE), icon: FileText, requiresTicker: true, promptTemplate: RESUMO_EXECUTIVO_TEMPLATE },
    { label: 'Riscos e Oportunidades', prompt: (ticker ? RISCOS_OPORTUNIDADES_TEMPLATE.replace(/\[TICKER\]/g, ticker) : RISCOS_OPORTUNIDADES_TEMPLATE), icon: AlertTriangle, requiresTicker: true, promptTemplate: RISCOS_OPORTUNIDADES_TEMPLATE },
    { label: 'Setup de Compra', prompt: (ticker ? SETUP_COMPRA_TEMPLATE.replace(/\[TICKER\]/g, ticker) : SETUP_COMPRA_TEMPLATE), icon: Crosshair, requiresTicker: true, promptTemplate: SETUP_COMPRA_TEMPLATE },
    { label: 'Dividendos em 1 min', prompt: (ticker ? DIVIDENDOS_1MIN_TEMPLATE.replace(/\[TICKER\]/g, ticker) : DIVIDENDOS_1MIN_TEMPLATE), icon: DollarSign, requiresTicker: true, promptTemplate: DIVIDENDOS_1MIN_TEMPLATE },
  ]

  // Páginas com ticker: action, bdr, fii, etf, technical_analysis, dividend_radar
  const hasTickerContext = (pageContext?.pageType === 'action' || pageContext?.pageType === 'bdr' || 
    pageContext?.pageType === 'fii' || pageContext?.pageType === 'etf' || 
    pageContext?.pageType === 'technical_analysis' || pageContext?.pageType === 'dividend_radar') && tickerContext

  if (hasTickerContext && tickerContext) {
    actions.push(...tickerDependentActions(tickerContext))
    actions.push(
      { label: `Análise Técnica ${tickerContext}`, prompt: `Faça uma análise técnica completa da ${displayName} (${tickerContext})`, icon: TrendingUp },
      { label: `Score ${tickerContext}`, prompt: `Qual é o score atual e os principais fundamentos da ${displayName} (${tickerContext})?`, icon: BarChart3 },
      { label: `Comparar ${tickerContext}`, prompt: `Compare a ${displayName} (${tickerContext}) com seus principais concorrentes do setor`, icon: GitCompare }
    )
  }

  // Radar (sem ticker)
  if (pageContext?.pageType === 'radar') {
    actions.push(
      { label: 'Meu Radar', prompt: 'Mostre uma análise consolidada das ações que estou monitorando no meu radar', icon: Radar },
      { label: 'Oportunidades no Radar', prompt: 'Quais são as melhores oportunidades de investimento entre as ações do meu radar?', icon: Sparkles },
      { label: 'Status do Radar', prompt: 'Como está o desempenho geral das ações do meu radar hoje?', icon: Activity }
    )
  }

  // Dashboard - pool de ações (IBOV, Sentimento + todas as tickerDependentActions)
  if (pageContext?.pageType === 'dashboard') {
    const dashboardPool: QuickAction[] = [
      { label: 'Projeção IBOV', prompt: 'Qual é a projeção do IBOVESPA para esta semana e este mês?', icon: TrendingUp },
      { label: 'Sentimento de Mercado', prompt: 'Como está o sentimento geral do mercado brasileiro hoje?', icon: BarChart3 },
      ...tickerDependentActions()
    ]
    actions.push(...dashboardPool)
  }

  // Extrair tickers mencionados nas últimas mensagens
  const mentionedTickers = new Set<string>()
  messages.slice(-10).forEach(msg => {
    if (msg.role === 'USER') {
      const tickerMatches = msg.content.match(/\b([A-Z]{4}\d{1,2})\b/g)
      if (tickerMatches) tickerMatches.forEach((t: string) => mentionedTickers.add(t))
    }
  })

  // Tickers mencionados (se não for página com ticker)
  if (!hasTickerContext) {
    Array.from(mentionedTickers).slice(0, 2).forEach((ticker: string) => {
      if (!pageContext?.ticker || ticker !== pageContext.ticker) {
        actions.push({ label: `Análise ${ticker}`, prompt: `Faça uma análise detalhada da ${ticker}`, icon: TrendingUp })
      }
    })
  }

  // Empresas favoritas da memória
  memories.filter(m => m.category === 'COMPANY_INTEREST' && m.importance > 70).forEach(mem => {
    const ticker = mem.metadata?.ticker
    if (ticker && !mentionedTickers.has(ticker) && ticker !== pageContext?.ticker) {
      actions.push({ label: `Score da ${ticker}`, prompt: `Qual é o score atual da ${ticker}?`, icon: TrendingUp })
    }
  })

  // Setores estudados
  memories.filter(m => m.category === 'LEARNING' && m.metadata?.sector).slice(0, 2).forEach(mem => {
    const sector = mem.metadata?.sector
    if (sector) actions.push({ label: `Resumo sobre ${sector}`, prompt: `Resuma meu último estudo sobre o setor ${sector}`, icon: BookOpen })
  })

  // Objetivos
  const goal = memories.find(m => m.category === 'INVESTMENT_GOAL' && m.importance > 60)
  if (goal) actions.push({ label: `Estratégia de ${goal.key}`, prompt: `Relembre minha estratégia de ${goal.content}`, icon: Target })

  // Ações padrão quando poucas ações
  if (actions.length < 2 && (!pageContext || !['action', 'bdr', 'fii', 'etf', 'radar'].includes(pageContext.pageType))) {
    return [
      { label: 'Projeção IBOV', prompt: 'Qual é a projeção atual do IBOVESPA para esta semana e este mês?', icon: TrendingUp },
      { label: 'Sentimento de Mercado', prompt: 'Como está o sentimento geral do mercado brasileiro?', icon: BarChart3 },
      { label: 'Análise Flash', prompt: ANALISE_FLASH_TEMPLATE, icon: Zap, requiresTicker: true, promptTemplate: ANALISE_FLASH_TEMPLATE },
      { label: 'Resumo Executivo', prompt: RESUMO_EXECUTIVO_TEMPLATE, icon: FileText, requiresTicker: true, promptTemplate: RESUMO_EXECUTIVO_TEMPLATE },
      ...actions
    ]
  }

  return actions.slice(0, 8)
}

/**
 * Extrai contexto básico da página baseado no pathname (client-side)
 */
function extractBasicPageContext(pathname: string): { pageType: string; ticker?: string } {
  // Análise técnica de ação
  if (pathname.match(/^\/acao\/([^/]+)\/analise-tecnica/)) {
    const tickerMatch = pathname.match(/^\/acao\/([^/]+)\/analise-tecnica/)
    return {
      pageType: 'technical_analysis',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  // Análise técnica de BDR
  if (pathname.match(/^\/bdr\/([^/]+)\/analise-tecnica/)) {
    const tickerMatch = pathname.match(/^\/bdr\/([^/]+)\/analise-tecnica/)
    return {
      pageType: 'technical_analysis',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  // Radar de dividendos por ticker
  if (pathname.startsWith('/radar-dividendos/')) {
    const tickerMatch = pathname.match(/^\/radar-dividendos\/([^/]+)/)
    return {
      pageType: 'dividend_radar',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  }
  if (pathname.startsWith('/acao/')) {
    const tickerMatch = pathname.match(/^\/acao\/([^/]+)/)
    return {
      pageType: 'action',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  } else if (pathname.startsWith('/bdr/')) {
    const tickerMatch = pathname.match(/^\/bdr\/([^/]+)/)
    return {
      pageType: 'bdr',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  } else if (pathname.startsWith('/fii/')) {
    const tickerMatch = pathname.match(/^\/fii\/([^/]+)/)
    return {
      pageType: 'fii',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  } else if (pathname.startsWith('/etf/')) {
    const tickerMatch = pathname.match(/^\/etf\/([^/]+)/)
    return {
      pageType: 'etf',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  } else if (pathname.startsWith('/indices/')) {
    const tickerMatch = pathname.match(/^\/indices\/([^/]+)/)
    return {
      pageType: 'index',
      ticker: tickerMatch ? tickerMatch[1].toUpperCase() : undefined
    }
  } else if (pathname === '/radar' || pathname.startsWith('/radar')) {
    return { pageType: 'radar' }
  } else if (pathname === '/dashboard' || pathname === '/') {
    return { pageType: 'dashboard' }
  }
  return { pageType: 'other' }
}

export function BenChatSidebar({ open, onOpenChange, initialConversationId, forceNewConversation = false }: BenChatSidebarProps) {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId || null)
  const [hasHandledForceNew, setHasHandledForceNew] = useState(false)
  const [message, setMessage] = useState('')
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamingMessageIdRef = useRef<string | null>(null) // ID da mensagem sendo streamada

  const { data: conversations, isLoading: conversationsLoading } = useBenConversations()
  const createConversation = useCreateBenConversation()
  const sendMessage = useSendBenMessageStream()
  const shareConversation = useShareBenConversation()
  const unshareConversation = useUnshareBenConversation()
  const { data: memoryData } = useBenMemory(pathname)
  const { data: messages, refetch: refetchMessages } = useBenMessages(selectedConversationId)
  const { isPremium } = usePremiumStatus()
  const { toast } = useToast()
  
  // Estado para modal de compartilhamento
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  // Input de ticker para ações que precisam (inline na seção de quick actions)
  const [tickerInput, setTickerInput] = useState('')
  const tickerInputRef = useRef<HTMLInputElement>(null)

  // Extrair contexto básico da página
  const pageContext = extractBasicPageContext(pathname)

  // Sincronizar tickerInput quando pageContext.ticker mudar
  useEffect(() => {
    if (pageContext?.ticker) {
      setTickerInput(pageContext.ticker)
    }
  }, [pageContext?.ticker])

  // Atualizar conversa selecionada quando initialConversationId mudar
  useEffect(() => {
    // Se forceNewConversation é true MAS ainda não foi tratado (hasHandledForceNew=false), limpar selectedConversationId
    // Se já foi tratado (hasHandledForceNew=true), não limpar para evitar race condition após criar conversa
    if (forceNewConversation && selectedConversationId && !hasHandledForceNew) {
      setSelectedConversationId(null)
      return
    }
    
    if (initialConversationId && initialConversationId !== selectedConversationId && !forceNewConversation) {
      setSelectedConversationId(initialConversationId)
    }
  }, [initialConversationId, selectedConversationId, forceNewConversation, hasHandledForceNew])

  // Resetar flag quando forceNewConversation mudar para false
  useEffect(() => {
    if (!forceNewConversation) {
      setHasHandledForceNew(false)
    }
  }, [forceNewConversation])

  // Criar ou selecionar conversa ao abrir (apenas uma vez)
  useEffect(() => {
    // Não fazer nada se ainda está carregando
    if (conversationsLoading) return
    
    // Não fazer nada se o sidebar não está aberto
    if (!open) return

    // Se há initialConversationId e não é para forçar nova, usar o initialConversationId
    if (initialConversationId !== undefined && !forceNewConversation) {
      if (initialConversationId !== selectedConversationId) {
        setSelectedConversationId(initialConversationId)
      }
      return
    }
    
    // Não fazer nada se já está criando
    if (isCreatingConversation) return

    // Se forceNewConversation é true e ainda não foi tratado, criar nova conversa imediatamente
    // IMPORTANTE: Não verificar selectedConversationId aqui, pois pode estar definido de uma conversa anterior
    if (forceNewConversation && !hasHandledForceNew) {
      console.log('[Ben] Criando nova conversa (forceNewConversation=true)')
      setHasHandledForceNew(true)
      setIsCreatingConversation(true)
      // Limpar selectedConversationId antes de criar
      setSelectedConversationId(null)
      createConversation.mutate(undefined, {
        onSuccess: (conversation) => {
          console.log('[Ben] Nova conversa criada:', conversation.id)
          setSelectedConversationId(conversation.id)
          setIsCreatingConversation(false)
        },
        onError: (error) => {
          console.error('[Ben] Erro ao criar conversa:', error)
          setIsCreatingConversation(false)
          setHasHandledForceNew(false) // Permitir tentar novamente em caso de erro
        }
      })
      return
    }

    // Se não há conversa selecionada e não há conversas, criar uma nova
    if (!selectedConversationId && conversations && conversations.length === 0 && !forceNewConversation) {
      setIsCreatingConversation(true)
      createConversation.mutate(undefined, {
        onSuccess: (conversation) => {
          setSelectedConversationId(conversation.id)
          setIsCreatingConversation(false)
        },
        onError: () => {
          setIsCreatingConversation(false)
        }
      })
      return
    }

    // Se não há conversa selecionada mas há conversas existentes, selecionar a mais recente
    // Isso acontece quando o sidebar abre via FAB sem initialConversationId
    if (!selectedConversationId && conversations && conversations.length > 0 && !forceNewConversation && initialConversationId === undefined) {
      const mostRecentConversation = conversations[0] // Já ordenado por updatedAt desc
      setSelectedConversationId(mostRecentConversation.id)
    }
  }, [open, conversations, conversationsLoading, selectedConversationId, isCreatingConversation, initialConversationId, forceNewConversation, hasHandledForceNew, createConversation])

  // Scroll para baixo quando novas mensagens chegarem ou durante streaming
  useEffect(() => {
    if (messages && messages.length > 0 || streamingMessage) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [messages, sendMessage.isSuccess, streamingMessage])

  // Limpar estado de streaming quando selectedConversationId muda
  useEffect(() => {
    // Limpar estado de streaming ao mudar de conversa
    setStreamingMessage('')
    setIsStreaming(false)
    streamingMessageIdRef.current = null
    setMessage('')
  }, [selectedConversationId])

  // Limpar mensagem temporária quando a mensagem final aparecer na lista
  useEffect(() => {
    if (!streamingMessage || !messages || !streamingMessageIdRef.current || isStreaming) return

    // Verificar se a mensagem final já está na lista
    // Comparar pelo conteúdo (últimas 150 caracteres para melhor matching)
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'ASSISTANT') {
      // Normalizar ambos os textos para comparação (remover espaços extras, quebras de linha)
      const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
      const streamingNormalized = normalizeText(streamingMessage)
      const messageNormalized = normalizeText(lastMessage.content)
      
      // Verificar se pelo menos 80% do conteúdo da mensagem temporária está na mensagem final
      const matchThreshold = Math.max(streamingNormalized.length * 0.8, 50)
      const matchingLength = Math.min(streamingNormalized.length, messageNormalized.length)
      
      if (matchingLength >= matchThreshold && messageNormalized.includes(streamingNormalized.slice(0, matchingLength))) {
        // Aguardar um pouco para garantir renderização completa
        setTimeout(() => {
          setStreamingMessage('')
          setIsStreaming(false)
          streamingMessageIdRef.current = null
        }, 300)
      }
    }
  }, [messages, streamingMessage, isStreaming])

  const handleSendMessage = () => {
    if (!message.trim() || !selectedConversationId || sendMessage.isPending || isStreaming) return

    const messageToSend = message.trim()
    // Limpar input imediatamente
    setMessage('')
    setStreamingMessage('')
    setIsStreaming(true)
    streamingMessageIdRef.current = `streaming-${Date.now()}`

    sendMessage.mutate(
      { 
        conversationId: selectedConversationId, 
        message: messageToSend,
        pageContext,
        onChunk: (chunk) => {
          if (chunk.type === 'text' && chunk.data) {
            // NOVA ABORDAGEM: chunks são strings simples controladas pelo backend
            // Não precisamos mais de lógica complexa de espaçamento
            const newChunk = String(chunk.data)
            flushSync(() => {
              setStreamingMessage(prev => prev + newChunk)
            })
            // Scroll após renderização
            requestAnimationFrame(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            })
          } else if (chunk.type === 'done') {
            // Quando terminar, limpar mensagem de streaming imediatamente
            // A mensagem final será exibida do banco após o refetch
            setStreamingMessage('')
            setIsStreaming(false)
            streamingMessageIdRef.current = null
            // Fazer refetch para carregar a mensagem final do banco
            setTimeout(() => {
              refetchMessages()
            }, 100)
          } else if (chunk.type === 'error') {
            setIsStreaming(false)
            setStreamingMessage('')
            streamingMessageIdRef.current = null
            console.error('Erro no streaming:', chunk.data)
          }
        }
      },
      {
        onSuccess: (result) => {
          setMessage('')
          // Se limite foi atingido, refetch mensagens para mostrar a resposta do Ben
          if (result?.limitReached) {
            refetchMessages()
          }
        },
        onError: (error: any) => {
          setIsStreaming(false)
          setStreamingMessage('')
          streamingMessageIdRef.current = null
          
          // Se houver erro, restaurar a mensagem
          setMessage(messageToSend)
          toast({
            title: 'Erro',
            description: error?.message || 'Erro ao enviar mensagem. Tente novamente.',
            variant: 'destructive'
          })
        }
      }
    )
  }

  const handleQuickAction = (action: QuickAction) => {
    if (!selectedConversationId || sendMessage.isPending || isStreaming) return

    let promptToSend = action.prompt
    if (action.requiresTicker && action.promptTemplate) {
      const ticker = resolveTicker()
      if (!ticker) {
        tickerInputRef.current?.focus()
        tickerInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        toast({
          title: 'Ticker necessário',
          description: 'Informe o ticker acima (ex: PETR4, VALE3) para usar esta ação.',
          variant: 'destructive'
        })
        return
      }
      promptToSend = action.promptTemplate.replace(/\[TICKER\]/g, ticker)
    }
    
    // Limpar input antes de enviar
    setMessage('')
    setStreamingMessage('')
    setIsStreaming(true)
    streamingMessageIdRef.current = `streaming-${Date.now()}`
    
    // Enviar automaticamente com streaming
    sendMessage.mutate(
      { 
        conversationId: selectedConversationId, 
        message: promptToSend,
        pageContext,
        onChunk: (chunk) => {
          if (chunk.type === 'text' && chunk.data) {
            // NOVA ABORDAGEM: chunks são strings simples controladas pelo backend
            // Não precisamos mais de lógica complexa de espaçamento
            const newChunk = String(chunk.data)
            flushSync(() => {
              setStreamingMessage(prev => prev + newChunk)
            })
            requestAnimationFrame(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            })
          } else if (chunk.type === 'done') {
            setIsStreaming(false)
            refetchMessages()
          } else if (chunk.type === 'error') {
            setIsStreaming(false)
            setStreamingMessage('')
            streamingMessageIdRef.current = null
          }
        }
      },
      {
        onSuccess: () => {
          setMessage('')
        }
      }
    )
  }

  const handleNewConversation = () => {
    // Limpar todo o estado relacionado a mensagens e streaming
    const previousConversationId = selectedConversationId
    
    // Limpar estado de streaming
    setStreamingMessage('')
    setIsStreaming(false)
    streamingMessageIdRef.current = null
    
    // Limpar mensagem do input
    setMessage('')
    
    // Invalidar cache de mensagens da conversa anterior se houver
    if (previousConversationId) {
      queryClient.invalidateQueries({ queryKey: ['ben-messages', previousConversationId] })
    }
    
    setIsCreatingConversation(true)
    createConversation.mutate(undefined, {
      onSuccess: (conversation) => {
        setSelectedConversationId(conversation.id)
        setIsCreatingConversation(false)
      },
      onError: () => {
        setIsCreatingConversation(false)
      }
    })
  }

  const handleShare = async () => {
    if (!selectedConversationId) return
    
    try {
      const result = await shareConversation.mutateAsync(selectedConversationId)
      setShareUrl(result.shareUrl)
      setShowShareModal(true)
    } catch (error) {
      console.error('Erro ao compartilhar:', error)
    }
  }

  const handleUnshare = async () => {
    if (!selectedConversationId) return
    
    try {
      await unshareConversation.mutateAsync(selectedConversationId)
      setShareUrl(null)
      setShowShareModal(false)
    } catch (error) {
      console.error('Erro ao descompartilhar:', error)
    }
  }

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      // TODO: Mostrar toast de sucesso
    }
  }

  // Gerar Quick Actions baseadas na memória, mensagens da conversa e contexto da página
  const baseQuickActions = memoryData?.memories && memoryData.memories.length > 0
    ? generateQuickActions(memoryData.memories, messages || [], pageContext)
    : generateQuickActions([], messages || [], pageContext)

  // Dashboard: mostrar apenas 3 ações aleatórias para não poluir a tela
  const dashboardActionsRef = useRef<QuickAction[] | null>(null)
  const quickActions = (() => {
    if (pageContext?.pageType === 'dashboard' && baseQuickActions.length > 3) {
      if (dashboardActionsRef.current === null) {
        const shuffled = [...baseQuickActions].sort(() => Math.random() - 0.5)
        dashboardActionsRef.current = shuffled.slice(0, 3)
      }
      return dashboardActionsRef.current
    }
    dashboardActionsRef.current = null
    return baseQuickActions
  })()

  // Resolver ticker para ações que precisam (input > pageContext > mensagens)
  const resolveTicker = (): string | null => {
    const fromInput = tickerInput?.trim().toUpperCase()
    if (fromInput) return fromInput
    if (pageContext?.ticker) return pageContext.ticker
    const mentioned = (messages || []).filter(m => m.role === 'USER').flatMap(m => 
      (m.content?.match(/\b([A-Z]{4}\d{1,2})\b/g) || [])
    )
    return mentioned[mentioned.length - 1] || null
  }

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId)
  
  // Atualizar shareUrl quando selectedConversation mudar
  useEffect(() => {
    if (selectedConversation?.shareToken) {
      const url = `${window.location.origin}/share/ben/${selectedConversation.shareToken}`
      setShareUrl(url)
    } else {
      setShareUrl(null)
    }
  }, [selectedConversation?.shareToken])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-violet-500 p-0.5 flex-shrink-0">
                <Image 
                  src="/ben.png" 
                  alt="Ben" 
                  width={32} 
                  height={32} 
                  className="rounded-full w-full h-full object-cover"
                />
              </div>
              <span className="truncate text-base sm:text-lg">Ben - Assistente IA</span>
            </SheetTitle>
            <div className="flex items-center gap-1 relative">
              {selectedConversationId && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={selectedConversation?.shareToken ? handleUnshare : handleShare}
                    disabled={shareConversation.isPending || unshareConversation.isPending}
                    className={cn(
                      "flex-shrink-0",
                      selectedConversation?.shareToken && "text-violet-600 dark:text-violet-400"
                    )}
                    title={selectedConversation?.shareToken ? "Descompartilhar conversa" : "Compartilhar conversa"}
                  >
                    <Share2 className={cn("w-4 h-4", selectedConversation?.shareToken && "fill-current")} />
                  </Button>
                  {showShareModal && shareUrl && (
                    <div className="absolute top-12 right-0 z-50 bg-background border rounded-lg shadow-lg p-4 min-w-[300px]">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">Link compartilhado</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowShareModal(false)}
                          className="h-6 w-6"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={shareUrl}
                          readOnly
                          className="flex-1 text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={handleCopyLink}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewConversation}
                disabled={isCreatingConversation || createConversation.isPending}
                className="flex-shrink-0"
                title="Nova conversa"
              >
                {isCreatingConversation || createConversation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Lista de conversas */}
          {conversations && conversations.length > 0 && (
            <div className="border-b px-4 py-2">
              <div className="flex gap-2">
                <select
                  value={selectedConversationId || ''}
                  onChange={(e) => {
                    setSelectedConversationId(e.target.value)
                    setMessage('') // Limpar input ao trocar de conversa
                  }}
                  className="flex-1 px-3 py-2 rounded-md border bg-background text-sm min-w-0"
                >
                  {conversations.map(conv => (
                    <option key={conv.id} value={conv.id}>
                      {conv.title} ({conv.messageCount} mensagens)
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNewConversation}
                  disabled={isCreatingConversation || createConversation.isPending}
                  className="flex-shrink-0"
                  title="Nova conversa"
                >
                  {isCreatingConversation || createConversation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Quick Actions - sempre mostrar */}
          <div className="px-4 py-2 border-b bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Ações Rápidas</p>
            {/* Input de ticker inline - para ações que precisam (Análise Flash, Resumo Executivo, etc) */}
            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="quick-action-ticker" className="text-xs text-muted-foreground whitespace-nowrap">
                Ticker:
              </label>
              <Input
                ref={tickerInputRef}
                id="quick-action-ticker"
                placeholder="Ex: PETR4, VALE3"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                className="h-7 text-xs max-w-[120px]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, idx) => {
                const Icon = action.icon
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action)}
                    className="text-xs"
                    disabled={!selectedConversationId || sendMessage.isPending || isStreaming}
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {action.label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Área de mensagens */}
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-4 min-w-0 w-full">
              {/* Mostrar mensagem inicial e mensagens apenas se há conversa selecionada */}
              {selectedConversationId && (
                <>
                  {/* Mensagem de boas-vindas (apenas se não houver mensagens) */}
                  {(!messages || messages.length === 0) && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-500 p-0.5">
                        <Image 
                          src="/ben.png" 
                          alt="Ben" 
                          width={32} 
                          height={32} 
                          className="rounded-full w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-sm">
                            Olá! Sou o Ben, seu assistente de análise fundamentalista. 
                            Como posso ajudá-lo hoje?
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mensagens da conversa */}
                  {messages && messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex items-start gap-3',
                        msg.role === 'USER' && 'flex-row-reverse'
                      )}
                    >
                      {msg.role === 'ASSISTANT' && (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-500 p-0.5">
                          <Image 
                            src="/ben.png" 
                            alt="Ben" 
                            width={32} 
                            height={32} 
                            className="rounded-full w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {msg.role === 'USER' && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                      )}
                      <div className={cn(
                        'flex-1 min-w-0',
                        msg.role === 'USER' && 'text-right'
                      )}>
                        <div className={cn(
                          'rounded-lg p-3',
                          msg.role === 'ASSISTANT' 
                            ? 'bg-muted' 
                            : 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                        )}>
                          {msg.role === 'ASSISTANT' ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <MarkdownRenderer 
                                content={processBenMessageLinks(msg.content)} 
                                className="prose-sm prose-headings:text-base prose-p:text-sm prose-strong:text-sm prose-ul:text-sm prose-ol:text-sm prose-li:text-sm"
                              />
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Mensagem sendo streamada */}
                  {streamingMessage && (
                    <div className="flex items-start gap-3" key={streamingMessageIdRef.current}>
                      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-500 p-0.5">
                        <Image 
                          src="/ben.png" 
                          alt="Ben" 
                          width={32} 
                          height={32} 
                          className="rounded-full w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            {/* Renderizar markdown com key estável baseada no hash do conteúdo */}
                            {/* Isso garante que o markdown seja re-processado quando necessário, mas não a cada chunk */}
                            <MarkdownRenderer 
                              key={`streaming-${streamingMessage.length > 0 ? Math.floor(streamingMessage.length / 50) : 0}`}
                              content={processBenMessageLinks(streamingMessage)} 
                              className="prose-sm prose-headings:text-base prose-p:text-sm prose-strong:text-sm prose-ul:text-sm prose-ol:text-sm prose-li:text-sm"
                            />
                          </div>
                          {isStreaming && (
                            <span className="inline-block w-2 h-2 bg-current rounded-full ml-1 animate-pulse" />
                          )}
                        </div>
                        {isStreaming && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Digitando...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {sendMessage.isPending && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-violet-500 p-0.5">
                    <Image 
                      src="/ben.png" 
                      alt="Ben" 
                      width={32} 
                      height={32} 
                      className="rounded-full w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input de mensagem */}
          <div className="border-t p-4">
            <div className="flex gap-2 items-end">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Digite sua mensagem..."
                disabled={!selectedConversationId || sendMessage.isPending || isStreaming}
                className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm sm:min-h-[80px] sm:max-h-[160px]"
                rows={2}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || !selectedConversationId || sendMessage.isPending || isStreaming}
                size="icon"
                className="flex-shrink-0 h-[60px] sm:h-[80px]"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

