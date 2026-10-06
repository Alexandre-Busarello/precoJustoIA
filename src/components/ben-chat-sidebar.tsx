'use client'

/**
 * Chat do Ben em painel lateral (Sheet). Tela cheia no mobile, 448 px no desktop.
 * Mensagens do usuário em balão neutro; respostas do Ben sem balão, em markdown.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Copy,
  Crosshair,
  DollarSign,
  FileText,
  GitCompare,
  Loader2,
  Plus,
  Radar,
  Send,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useBenConversations,
  useCreateBenConversation,
  useSendBenMessageStream,
  useBenMemory,
  useBenMessages,
  useShareBenConversation,
  useUnshareBenConversation
} from '@/hooks/use-ben-chat'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { processBenMessageLinks } from '@/lib/ben-link-processor'

interface BenChatSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialConversationId?: string
  forceNewConversation?: boolean // Flag para forçar criação de nova conversa
}

const ANALISE_FLASH_TEMPLATE = `Faça uma análise rápida de [TICKER] em formato de lista curta, só com os dados:
1. Preço atual vs. preço justo estimado (com o % de diferença)
2. Leitura da análise técnica (sobrecomprado, sobrevendido ou neutro)
3. Dividend yield projetado (12m)
4. Posição em relação ao preço justo: abaixo, dentro da faixa estimada ou acima
Sem textos longos e sem emojis.`

const RESUMO_EXECUTIVO_TEMPLATE = `Resumo executivo de [TICKER] em 5 tópicos: preço justo estimado, diferença para o preço atual, dividend yield, riscos principais e posição em relação ao preço justo. Seja direto.`

const RISCOS_OPORTUNIDADES_TEMPLATE = `Liste os 3 principais riscos e 3 principais oportunidades de [TICKER] de forma objetiva.`

const NIVEIS_TECNICOS_TEMPLATE = `Analise [TICKER] e indique os principais suportes, resistências e a faixa de preço justo estimada.`

const DIVIDENDOS_1MIN_TEMPLATE = `Resumo rápido dos dividendos de [TICKER]: yield projetado 12m, próximos pagamentos, sustentabilidade (1 parágrafo).`

interface QuickAction {
  label: string
  prompt: string
  icon: LucideIcon
  requiresTicker?: boolean
  promptTemplate?: string
}

function tickerAction(label: string, template: string, icon: LucideIcon, ticker?: string): QuickAction {
  return {
    label,
    prompt: ticker ? template.replace(/\[TICKER\]/g, ticker) : template,
    icon,
    requiresTicker: true,
    promptTemplate: template,
  }
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
    tickerAction('Análise rápida', ANALISE_FLASH_TEMPLATE, Zap, ticker),
    tickerAction('Resumo executivo', RESUMO_EXECUTIVO_TEMPLATE, FileText, ticker),
    tickerAction('Riscos e oportunidades', RISCOS_OPORTUNIDADES_TEMPLATE, AlertTriangle, ticker),
    tickerAction('Níveis técnicos', NIVEIS_TECNICOS_TEMPLATE, Crosshair, ticker),
    tickerAction('Dividendos em 1 min', DIVIDENDOS_1MIN_TEMPLATE, DollarSign, ticker),
  ]

  // Páginas com ticker: action, bdr, fii, etf, technical_analysis, dividend_radar
  const hasTickerContext = (pageContext?.pageType === 'action' || pageContext?.pageType === 'bdr' || 
    pageContext?.pageType === 'fii' || pageContext?.pageType === 'etf' || 
    pageContext?.pageType === 'technical_analysis' || pageContext?.pageType === 'dividend_radar') && tickerContext

  if (hasTickerContext && tickerContext) {
    actions.push(...tickerDependentActions(tickerContext))
    actions.push(
      { label: `Análise técnica ${tickerContext}`, prompt: `Faça uma análise técnica completa da ${displayName} (${tickerContext})`, icon: TrendingUp },
      { label: `Score ${tickerContext}`, prompt: `Qual é o score atual e os principais fundamentos da ${displayName} (${tickerContext})?`, icon: BarChart3 },
      { label: `Comparar ${tickerContext}`, prompt: `Compare a ${displayName} (${tickerContext}) com seus principais concorrentes do setor`, icon: GitCompare }
    )
  }

  // Radar (sem ticker)
  if (pageContext?.pageType === 'radar') {
    actions.push(
      { label: 'Meu radar', prompt: 'Mostre uma análise consolidada das ações que estou monitorando no meu radar', icon: Radar },
      { label: 'Destaques do radar', prompt: 'Quais ações do meu radar estão mais abaixo do preço justo estimado?', icon: Sparkles },
      { label: 'Status do radar', prompt: 'Como está o desempenho geral das ações do meu radar hoje?', icon: Activity }
    )
  }

  // Dashboard - pool de ações (IBOV, Sentimento + todas as tickerDependentActions)
  if (pageContext?.pageType === 'dashboard') {
    const dashboardPool: QuickAction[] = [
      { label: 'Projeção do IBOV', prompt: 'Qual é a projeção do IBOVESPA para esta semana e este mês?', icon: TrendingUp },
      { label: 'Sentimento do mercado', prompt: 'Como está o sentimento geral do mercado brasileiro hoje?', icon: BarChart3 },
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
      { label: 'Projeção do IBOV', prompt: 'Qual é a projeção atual do IBOVESPA para esta semana e este mês?', icon: TrendingUp },
      { label: 'Sentimento do mercado', prompt: 'Como está o sentimento geral do mercado brasileiro?', icon: BarChart3 },
      tickerAction('Análise rápida', ANALISE_FLASH_TEMPLATE, Zap),
      tickerAction('Resumo executivo', RESUMO_EXECUTIVO_TEMPLATE, FileText),
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

function buildShareUrl(shareToken: string) {
  return `${window.location.origin}/share/ben/${shareToken}`
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
  const { toast } = useToast()
  
  // Link público da conversa (painel de compartilhamento)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

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

  // Se forceNewConversation é true MAS ainda não foi tratado (hasHandledForceNew=false), limpar selectedConversationId.
  // Se já foi tratado (hasHandledForceNew=true), não limpar para evitar race condition após criar conversa.
  useEffect(() => {
    if (forceNewConversation && selectedConversationId && !hasHandledForceNew) {
      setSelectedConversationId(null)
    }
  }, [selectedConversationId, forceNewConversation, hasHandledForceNew])

  // Aplica initialConversationId só quando o sheet abre ou quando o valor muda. Depois disso a escolha
  // é do usuário (Select de conversas e botão '+'), sem voltar para a conversa inicial.
  const appliedInitialConversationRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      appliedInitialConversationRef.current = null
      return
    }
    if (!initialConversationId || forceNewConversation) return
    if (appliedInitialConversationRef.current === initialConversationId) return
    appliedInitialConversationRef.current = initialConversationId
    setSelectedConversationId(initialConversationId)
  }, [open, initialConversationId, forceNewConversation])

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

    // Com initialConversationId, a seleção inicial vem do efeito acima; aqui não há nada a criar ou escolher
    if (initialConversationId !== undefined && !forceNewConversation) return
    
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
    setShareOpen(false)
  }, [selectedConversationId])

  const isBusy = !selectedConversationId || sendMessage.isPending || isStreaming
  const isCreating = isCreatingConversation || createConversation.isPending

  /** Envia um texto para o Ben com streaming. `restoreOnError` devolve o texto ao campo se o envio falhar. */
  const sendPrompt = (text: string, { restoreOnError = false }: { restoreOnError?: boolean } = {}) => {
    if (!selectedConversationId) return

    setMessage('')
    setStreamingMessage('')
    setIsStreaming(true)
    const streamId = `streaming-${Date.now()}`
    streamingMessageIdRef.current = streamId

    // Só limpa se este ainda for o stream ativo (um envio novo não pode ser apagado pelo refetch do anterior)
    const resetStreaming = () => {
      if (streamingMessageIdRef.current !== streamId) return
      setIsStreaming(false)
      setStreamingMessage('')
      streamingMessageIdRef.current = null
    }

    sendMessage.mutate(
      {
        conversationId: selectedConversationId,
        message: text,
        pageContext,
        onChunk: (chunk) => {
          if (chunk.type === 'text' && chunk.data) {
            // Os chunks chegam como texto pronto do backend
            const newChunk = String(chunk.data)
            flushSync(() => {
              setStreamingMessage(prev => prev + newChunk)
            })
            requestAnimationFrame(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            })
          } else if (chunk.type === 'done') {
            // Mantém a resposta na tela até a versão salva chegar pelo refetch; só então remove a temporária
            setIsStreaming(false)
            setTimeout(() => {
              void Promise.resolve(refetchMessages()).finally(resetStreaming)
            }, 100)
          } else if (chunk.type === 'error') {
            resetStreaming()
            console.error('Erro no streaming:', chunk.data)
          }
        }
      },
      {
        onSuccess: (result) => {
          // Se o limite foi atingido, a resposta do Ben já está salva
          if (result?.limitReached) {
            refetchMessages()
          }
        },
        onError: (error: unknown) => {
          resetStreaming()
          if (restoreOnError) setMessage(text)
          toast({
            title: 'Não foi possível enviar',
            description: error instanceof Error && error.message ? error.message : 'Tente novamente em instantes.',
            variant: 'destructive'
          })
        }
      }
    )
  }

  const handleSendMessage = () => {
    const text = message.trim()
    if (!text || isBusy) return
    sendPrompt(text, { restoreOnError: true })
  }

  const handleQuickAction = (action: QuickAction) => {
    if (isBusy) return

    let promptToSend = action.prompt
    if (action.requiresTicker && action.promptTemplate) {
      const ticker = resolveTicker()
      if (!ticker) {
        tickerInputRef.current?.focus()
        tickerInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        toast({
          title: 'Informe um ticker',
          description: 'Digite o ticker no campo acima (ex.: PETR4, VALE3) para usar este atalho.',
          variant: 'destructive'
        })
        return
      }
      promptToSend = action.promptTemplate.replace(/\[TICKER\]/g, ticker)
    }

    sendPrompt(promptToSend)
  }

  const handleNewConversation = () => {
    const previousConversationId = selectedConversationId

    setStreamingMessage('')
    setIsStreaming(false)
    streamingMessageIdRef.current = null
    setMessage('')

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

  /** Gera o link público (só na primeira vez). O painel já está aberto e mostra o estado de carregamento. */
  const generateShareLink = async (conversationId: string) => {
    try {
      const result = await shareConversation.mutateAsync(conversationId)
      // Monta o link com a origem atual (o shareUrl do servidor pode usar outra origem)
      setShareUrl(buildShareUrl(result.shareToken))
    } catch (error) {
      console.error('Erro ao compartilhar:', error)
      setShareOpen(false)
      toast({ title: 'Não foi possível gerar o link', description: 'Tente novamente em instantes.', variant: 'destructive' })
    }
  }

  const handleShareOpenChange = (nextOpen: boolean) => {
    setShareOpen(nextOpen)
    if (!nextOpen || !selectedConversationId) return
    if (!selectedConversation?.shareToken && !shareConversation.isPending) {
      void generateShareLink(selectedConversationId)
    }
  }

  const handleUnshare = async () => {
    if (!selectedConversationId) return
    try {
      await unshareConversation.mutateAsync(selectedConversationId)
      setShareUrl(null)
      setShareOpen(false)
      toast({ title: 'Link desativado', description: 'A conversa não está mais pública.' })
    } catch (error) {
      console.error('Erro ao descompartilhar:', error)
      toast({ title: 'Não foi possível desativar o link', description: 'Tente novamente em instantes.', variant: 'destructive' })
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({ title: 'Link copiado' })
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'Selecione o link e copie manualmente.', variant: 'destructive' })
    }
  }

  // Atalhos baseados na memória, nas mensagens da conversa e no contexto da página
  const baseQuickActions = generateQuickActions(memoryData?.memories ?? [], messages || [], pageContext)

  // Dashboard: só 3 atalhos sorteados para não poluir a tela
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

  // Ticker para atalhos que precisam dele (campo > página > mensagens)
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
  const isShared = Boolean(selectedConversation?.shareToken)

  useEffect(() => {
    if (selectedConversation?.shareToken) {
      setShareUrl(buildShareUrl(selectedConversation.shareToken))
    } else {
      setShareUrl(null)
    }
  }, [selectedConversation?.shareToken])

  const hasMessages = Boolean(messages && messages.length > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-md"
        // Com o painel do link aberto, o Esc fecha só o painel (e não o chat inteiro)
        onEscapeKeyDown={(event) => {
          if (!shareOpen) return
          event.preventDefault()
          setShareOpen(false)
        }}
      >
        <SheetHeader className="flex-row items-center gap-3 border-b border-border px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
          <BenAvatar />
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold">Ben</SheetTitle>
            <SheetDescription className="truncate text-xs">Assistente de análise com IA</SheetDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {selectedConversationId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleShareOpenChange(!shareOpen)}
                disabled={unshareConversation.isPending}
                aria-expanded={shareOpen}
                aria-controls="ben-share-panel"
                aria-label={isShared ? 'Link público da conversa' : 'Compartilhar conversa'}
                className={cn((isShared || shareOpen) && 'text-brand')}
              >
                <Share2 className="size-4" strokeWidth={1.75} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewConversation}
              disabled={isCreating}
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              {isCreating ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Plus className="size-4" strokeWidth={1.75} />
              )}
            </Button>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="size-5" strokeWidth={1.75} />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {shareOpen && selectedConversationId && (
          <section id="ben-share-panel" aria-label="Link público" className="space-y-3 border-b border-border bg-surface px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-sm font-medium text-foreground">Link público</h2>
                <p className="text-xs text-muted-foreground">Qualquer pessoa com o link pode ler esta conversa.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShareOpen(false)} aria-label="Fechar link público" className="-mt-2 -mr-2 shrink-0">
                <X className="size-4" strokeWidth={1.75} />
              </Button>
            </div>
            {shareUrl ? (
              <>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly aria-label="Link da conversa" className="min-w-0 flex-1" onFocus={(e) => e.currentTarget.select()} />
                  <Button size="sm" onClick={handleCopyLink} className="h-11 md:h-9">
                    <Copy className="size-4" strokeWidth={1.75} />
                    Copiar
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnshare}
                  disabled={unshareConversation.isPending}
                  className="h-11 w-full text-muted-foreground md:h-9"
                >
                  Desativar link
                </Button>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Gerando link…
              </p>
            )}
          </section>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {conversations && conversations.length > 0 && (
            <div className="border-b border-border px-4 py-2">
              <Select
                value={selectedConversationId ?? undefined}
                onValueChange={(value) => {
                  setSelectedConversationId(value)
                  setMessage('')
                }}
              >
                <SelectTrigger aria-label="Conversa" className="w-full min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Selecione uma conversa" />
                </SelectTrigger>
                <SelectContent className="max-w-[min(26rem,calc(100vw-2rem))]">
                  {conversations.map(conv => (
                    <SelectItem key={conv.id} value={conv.id} className="min-w-0">
                      <span className="block min-w-0 truncate">
                        {conv.title || 'Conversa sem título'} · {conv.messageCount}{' '}
                        {conv.messageCount === 1 ? 'mensagem' : 'mensagens'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <label htmlFor="quick-action-ticker" className="shrink-0 text-xs font-medium text-muted-foreground">
                Atalhos para
              </label>
              <Input
                ref={tickerInputRef}
                id="quick-action-ticker"
                placeholder="Ex.: PETR4"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoComplete="off"
                className="w-40 placeholder:normal-case"
              />
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action)}
                    disabled={isBusy}
                    className="shrink-0 font-normal"
                  >
                    <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
                    {action.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="w-full min-w-0 space-y-5 px-4 py-4">
              {selectedConversationId && (
                <>
                  {!hasMessages && (
                    <AssistantMessage>
                      <p>
                        Olá, sou o Ben, assistente de análise fundamentalista. Pergunte sobre um ativo, um indicador
                        ou uma estratégia.
                      </p>
                    </AssistantMessage>
                  )}

                  {messages?.map((msg) =>
                    msg.role === 'USER' ? (
                      <div key={msg.id} className="flex flex-col items-end gap-1">
                        <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm leading-6 whitespace-pre-wrap break-words text-foreground">
                          {msg.content}
                        </div>
                        <MessageTime value={msg.createdAt} />
                      </div>
                    ) : (
                      <AssistantMessage key={msg.id} time={msg.createdAt}>
                        <MarkdownRenderer content={processBenMessageLinks(msg.content)} className="text-sm" />
                      </AssistantMessage>
                    )
                  )}

                  {streamingMessage && (
                    <AssistantMessage key={streamingMessageIdRef.current} status={isStreaming ? 'Escrevendo…' : undefined}>
                      {/* A key muda a cada ~50 caracteres: reprocessa o markdown sem refazer a cada chunk */}
                      <MarkdownRenderer
                        key={`streaming-${Math.floor(streamingMessage.length / 50)}`}
                        content={processBenMessageLinks(streamingMessage)}
                        className="text-sm"
                      />
                    </AssistantMessage>
                  )}
                </>
              )}

              {sendMessage.isPending && !streamingMessage && (
                <AssistantMessage status="Pensando…">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                </AssistantMessage>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3 sm:p-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
          >
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Pergunte ao Ben"
              aria-label="Mensagem para o Ben"
              disabled={isBusy}
              className="max-h-40 min-h-11 flex-1 resize-none"
              rows={2}
            />
            <Button
              type="submit"
              disabled={!message.trim() || isBusy}
              size="icon"
              aria-label="Enviar mensagem"
            >
              {sendMessage.isPending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Send className="size-4" strokeWidth={1.75} />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function BenAvatar() {
  return (
    <Image
      src="/ben.png"
      alt=""
      width={32}
      height={32}
      className="size-8 shrink-0 rounded-full border border-border object-cover"
    />
  )
}


function MessageTime({ value }: { value: Date | string }) {
  return (
    <time dateTime={new Date(value).toISOString()} className="text-xs text-muted-foreground tabular-nums">
      {formatDate(value, { style: 'datetime' })}
    </time>
  )
}

/** Resposta do Ben: sem balão, com avatar pequeno à esquerda. */
function AssistantMessage({ children, time, status }: { children: ReactNode; time?: Date | string; status?: string }) {
  return (
    <div className="flex items-start gap-3">
      <BenAvatar />
      <div className="min-w-0 flex-1 space-y-1 pt-1">
        <div className="text-sm leading-6 break-words text-foreground">{children}</div>
        {status ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">{status}</p>
        ) : (
          time && <MessageTime value={time} />
        )}
      </div>
    </div>
  )
}
