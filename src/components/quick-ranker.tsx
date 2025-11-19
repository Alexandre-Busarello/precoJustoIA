"use client"

import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react"
import { useSession } from "next-auth/react"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useTracking } from "@/hooks/use-tracking"
import { EventType } from "@/lib/tracking-types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { CompanyLogo } from "@/components/company-logo"
import { AddToBacktestButton } from "@/components/add-to-backtest-button"
import { BatchBacktestSelector } from "@/components/batch-backtest-selector"
import { 
  Loader2, 
  TrendingUp, 
  Building2, 
  Target, 
  Zap, 
  Lock, 
  ArrowRight, 
  BarChart3,
  DollarSign,
  PieChart,
  Crown,
  Clock,
  RefreshCw,
  Calculator,
  Brain,
  Sparkles,
  Search,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  Filter,
  ArrowUpDown,
  X
} from "lucide-react"
import Link from "next/link"

// Interfaces para tipagem
interface ScreeningFilter {
  enabled: boolean;
  min?: number;
  max?: number;
}

interface RankingParams {
  marginOfSafety?: number;
  minYield?: number;
  maxPE?: number;
  minROE?: number;
  limit?: number;
  // Parâmetros FCD
  growthRate?: number;
  discountRate?: number;
  yearsProjection?: number;
  minMarginOfSafety?: number;
  // Parâmetros Gordon
  dividendGrowthRate?: number;
  useSectoralAdjustment?: boolean;
  sectoralWaccAdjustment?: number;
  // Parâmetros Fundamentalista 3+1
  minROIC?: number;
  maxDebtToEbitda?: number;
  maxPayout?: number;
  minPayout?: number;
  companySize?: 'all' | 'small_caps' | 'mid_caps' | 'blue_chips';
  // Parâmetros AI
  riskTolerance?: string;
  timeHorizon?: string;
  focus?: string;
  // Parâmetro de Análise Técnica (comum a todas as estratégias)
  useTechnicalAnalysis?: boolean;
  // Parâmetros Screening
  plFilter?: ScreeningFilter;
  pvpFilter?: ScreeningFilter;
  evEbitdaFilter?: ScreeningFilter;
  psrFilter?: ScreeningFilter;
  roeFilter?: ScreeningFilter;
  roicFilter?: ScreeningFilter;
  roaFilter?: ScreeningFilter;
  margemLiquidaFilter?: ScreeningFilter;
  margemEbitdaFilter?: ScreeningFilter;
  cagrLucros5aFilter?: ScreeningFilter;
  cagrReceitas5aFilter?: ScreeningFilter;
  dyFilter?: ScreeningFilter;
  payoutFilter?: ScreeningFilter;
  dividaLiquidaPlFilter?: ScreeningFilter;
  liquidezCorrenteFilter?: ScreeningFilter;
  dividaLiquidaEbitdaFilter?: ScreeningFilter;
  marketCapFilter?: ScreeningFilter;
  // Parâmetros Barsi
  targetDividendYield?: number;
  maxPriceToPayMultiplier?: number;
  minConsecutiveDividends?: number;
  maxDebtToEquity?: number;
  focusOnBEST?: boolean;
}

interface RankingResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  logoUrl?: string | null;
  fairValue: number | null;
  upside: number | null;
  marginOfSafety: number | null;
  rational: string;
  key_metrics?: Record<string, number | null>;
  // Upsides específicos de cada estratégia (quando disponíveis)
  grahamUpside?: number | null;
  fcdUpside?: number | null;
  gordonUpside?: number | null;
}

interface RankingResponse {
  model: string;
  params: RankingParams;
  rational: string;
  results: RankingResult[];
  count: number;
}

const models = [
  { 
    id: "ai", 
    name: "🤖 Análise Preditiva com IA", 
    description: "Inteligência Artificial analisa TODAS as estratégias e cria ranking preditivo",
    icon: <Brain className="w-4 h-4" />,
    free: false,
    badge: "HOT",
    hot: true,
    disclaimer: "⚠️ Utiliza IA e pode gerar resultados ligeiramente diferentes em novas execuções"
  },
  { 
    id: "graham", 
    name: "Fórmula de Graham", 
    description: "Encontra ações baratas de empresas sólidas usando médias históricas e filtros de qualidade",
    icon: <Target className="w-4 h-4" />,
    free: true,
    badge: "Gratuito"
  },
  { 
    id: "screening", 
    name: "Screening de Ações", 
    description: "Filtros customizáveis por categoria: valuation, rentabilidade, crescimento, dividendos e endividamento",
    icon: <Search className="w-4 h-4" />,
    free: true,
    badge: "Novo"
  },
  { 
    id: "fundamentalist", 
    name: "Fundamentalista 3+1", 
    description: "Análise simplificada com 3 indicadores essenciais usando médias históricas + bônus dividendos",
    icon: <BarChart3 className="w-4 h-4" />,
    free: false,
    badge: "HOT",
    hot: true
  },
  { 
    id: "fcd", 
    name: "Fluxo de Caixa Descontado", 
    description: "Avaliação intrínseca por DCF com projeções sofisticadas de fluxo de caixa",
    icon: <Calculator className="w-4 h-4" />,
    free: false,
    badge: "HOT",
    hot: true
  },
  { 
    id: "lowPE", 
    name: "Value Investing", 
    description: "P/L baixo combinado com médias históricas de indicadores de qualidade comprovada",
    icon: <BarChart3 className="w-4 h-4" />,
    free: false,
    badge: "HOT",
    hot: true
  },
  { 
    id: "magicFormula", 
    name: "Fórmula Mágica", 
    description: "Combina médias históricas de qualidade operacional com preços atrativos (Greenblatt)",
    icon: <PieChart className="w-4 h-4" />,
    free: false,
    badge: "Premium"
  },
  { 
    id: "barsi", 
    name: "Método Barsi", 
    description: "Buy-and-hold de dividendos em setores perenes com preço teto baseado em dividend yield",
    icon: <DollarSign className="w-4 h-4" />,
    free: false,
    badge: "HOT",
    hot: true
  },
  { 
    id: "dividendYield", 
    name: "Dividend Yield Anti-Trap", 
    description: "Renda passiva sustentável usando médias históricas com filtros que evitam armadilhas",
    icon: <DollarSign className="w-4 h-4" />,
    free: false,
    badge: "Premium"
  },
  { 
    id: "gordon", 
    name: "Fórmula de Gordon", 
    description: "Método dos dividendos para empresas com distribuições consistentes",
    icon: <DollarSign className="w-4 h-4" />,
    free: false,
    badge: "Premium"
  },
]

interface QuickRankerProps {
  rankingId?: string | null;
  assetTypeFilter?: 'b3' | 'bdr' | 'both';
  onRankingGenerated?: () => void; // Callback quando um novo ranking é gerado
}

// Interface para o ref handle
export interface QuickRankerHandle {
  reset: () => void;
  scrollToTop: () => void;
}

const QuickRankerComponent = forwardRef<QuickRankerHandle, QuickRankerProps>(
  ({ rankingId, assetTypeFilter = 'both', onRankingGenerated }, ref) => {
  const { data: session } = useSession()
  const { trackEvent } = useTracking()
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [params, setParams] = useState<RankingParams>({})
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<'generating' | 'loading'>('generating')
  const [results, setResults] = useState<RankingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isViewingCached, setIsViewingCached] = useState(false) // Estado para resultados em cache
  const [cachedInfo, setCachedInfo] = useState<{resultCount: number, createdAt: string} | null>(null)
  const [showAIModal, setShowAIModal] = useState(false) // Modal de processamento IA
  const [aiProcessingStep, setAiProcessingStep] = useState(0) // Etapa atual do processamento
  const [isResultsExpanded, setIsResultsExpanded] = useState(false) // Estado do collapsible dos resultados
  const [showBatchBacktestModal, setShowBatchBacktestModal] = useState(false) // Modal de backtest em lote
  
  // Estados para filtros e ordenação
  const [sortBy, setSortBy] = useState<string>("default") // default, upside, roe, margem_liquida, etc
  const [filterROE, setFilterROE] = useState<number | null>(null) // Filtro mínimo de ROE
  const [filterMargemLiquida, setFilterMargemLiquida] = useState<number | null>(null) // Filtro mínimo de Margem Líquida
  const [filterROIC, setFilterROIC] = useState<number | null>(null) // Filtro mínimo de ROIC
  const [filterDY, setFilterDY] = useState<number | null>(null) // Filtro mínimo de DY
  const [showFilters, setShowFilters] = useState(false) // Mostrar/ocultar painel de filtros
  
  const resultsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Expor métodos para o componente pai via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      // Limpar todos os estados
      setResults(null);
      setSelectedModel("");
      setParams({});
      setError(null);
      setIsViewingCached(false);
      setCachedInfo(null);
      setIsResultsExpanded(false);
      setSortBy("default");
      setFilterROE(null);
      setFilterMargemLiquida(null);
      setFilterROIC(null);
      setFilterDY(null);
      setShowFilters(false);
    },
    scrollToTop: () => {
      formRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }));

  // Resetar estado quando rankingId é removido (novo ranking)
  useEffect(() => {
    if (!rankingId && results) {
      // Limpar tudo para permitir nova configuração
      setResults(null)
      setSelectedModel("")
      setParams({})
      setError(null)
      setIsViewingCached(false)
      setCachedInfo(null)
      setIsResultsExpanded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingId]) // CORREÇÃO: Removido 'results' das dependências para evitar loop de reset

  // Atualizar parâmetros padrão quando assetTypeFilter mudar
  useEffect(() => {
    if (selectedModel && !isViewingCached) {
      // Reaplicar parâmetros padrão com os novos valores para BDRs
      handleModelChange(selectedModel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTypeFilter]) // Atualizar quando o filtro de tipo de ativo mudar

  // Carregar ranking específico por ID ou verificar sessionStorage
  useEffect(() => {
    const loadRankingData = async () => {
      // Prioridade 1: Carregar ranking específico por ID
      if (rankingId) {
        try {
          // Limpar resultados anteriores e mostrar loading
          setResults(null)
          setIsViewingCached(false)
          setCachedInfo(null)
          setLoadingType('loading') // Abrindo ranking salvo
          setLoading(true)
          const response = await fetch(`/api/ranking/${rankingId}`)
          if (response.ok) {
            const data = await response.json()
            const ranking = data.ranking
            
            setSelectedModel(ranking.model)
            setParams(ranking.params)
            
            // Se há resultados cached, mostrar eles
            if (ranking.results && ranking.results.length > 0) {
              const cachedResponse: RankingResponse = {
                model: ranking.model,
                params: ranking.params,
                rational: generateRational(ranking.model, ranking.params),
                results: ranking.results,
                count: ranking.resultCount
              }
              
              setResults(cachedResponse)
              setIsViewingCached(true)
              setCachedInfo({ 
                resultCount: ranking.resultCount, 
                createdAt: ranking.createdAt 
              })
              setIsResultsExpanded(true) // Expandir automaticamente
            }
            setLoading(false)
            return
          } else {
            console.error('Erro ao carregar ranking:', response.status)
            setLoading(false)
          }
        } catch (error) {
          console.error('Erro ao carregar ranking por ID:', error)
          setLoading(false)
        }
      }

      // Prioridade 2: Verificar sessionStorage (comportamento anterior)
      const prefillData = sessionStorage.getItem('prefillRanking')
      if (prefillData) {
        try {
          const { model, params: prefillParams, cachedResults, resultCount, createdAt } = JSON.parse(prefillData)
          setSelectedModel(model)
          setParams(prefillParams)
          
          // Se há resultados cached, mostrar eles com prioridade
          if (cachedResults && cachedResults.length > 0) {
            // Construir o objeto RankingResponse a partir dos dados cached
            const cachedResponse: RankingResponse = {
              model,
              params: prefillParams,
              rational: generateRational(model, prefillParams), // Gerar rational correto
              results: cachedResults,
              count: resultCount
            }
            
            setResults(cachedResponse)
            setIsViewingCached(true)
            setCachedInfo({ resultCount, createdAt })
          }
          
          // Limpar sessionStorage após usar
          sessionStorage.removeItem('prefillRanking')
        } catch (error) {
          console.error('Erro ao carregar dados de prefill:', error)
          sessionStorage.removeItem('prefillRanking')
        }
      }
    }

    loadRankingData()
  }, [rankingId])

  // Scroll automático para os resultados quando forem carregados
  useEffect(() => {
    if (results && results.results.length > 0 && headerRef.current) {
      // Pequeno delay para garantir que o DOM foi atualizado
      setTimeout(() => {
        headerRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 100)
    }
  }, [results])
  
  const isLoggedIn = !!session
  const { isPremium } = usePremiumStatus() // ÚNICA FONTE DA VERDADE
  
  // Filtrar e ordenar modelos baseado no status do usuário
  const availableModels = models.filter(model => {
    if (!isLoggedIn) {
      return model.free // Usuários não logados só veem modelos gratuitos
    }
    if (!isPremium) {
      return model.free // Usuários gratuitos só veem modelos gratuitos
    }
    return true // Usuários premium veem todos
  }).sort((a, b) => {
    if (isPremium) {
      // Para usuários Premium: IA primeiro, depois HOT, depois Graham, depois resto
      if (a.id === 'ai') return -1
      if (b.id === 'ai') return 1
      
      // Se não é IA, priorizar HOT
      if (a.hot && !b.hot) return -1
      if (!a.hot && b.hot) return 1
      
      // Se ambos são HOT ou ambos não são HOT, manter ordem original
      return 0
    } else {
      // Para usuários gratuitos: Graham primeiro (único disponível)
      if (a.id === 'graham') return -1
      if (b.id === 'graham') return 1
      return 0
    }
  })

  // Reset params quando trocar de modelo
  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    setResults(null)
    setError(null)
    setIsResultsExpanded(false)
    
    // Ajustar parâmetros padrão baseado no tipo de ativo
    const isBDR = assetTypeFilter === 'bdr'
    
    // Definir parâmetros padrão para cada modelo
    switch (model) {
      case "graham":
        setParams({ 
          marginOfSafety: isBDR ? 0.15 : 0.20,     // 15% para BDRs (múltiplos mais altos), 20% para Brasil
          companySize: 'all',       // Todas as empresas
          useTechnicalAnalysis: true // Análise técnica ativada por padrão
        })
        break
      case "dividendYield":
        setParams({ 
          minYield: isBDR ? 0.025 : 0.04,           // 2.5% para BDRs (mercado americano tem DY menor), 4% para Brasil
          companySize: 'all',       // Todas as empresas
          useTechnicalAnalysis: true // Análise técnica ativada por padrão
        })
        break
      case "lowPE":
        setParams({ 
          maxPE: isBDR ? 25 : 12,                   // P/L <= 25 para BDRs (mercado aceita múltiplos mais altos), <= 12 para Brasil
          minROE: isBDR ? 0.12 : 0.12,             // ROE >= 12% (mesmo para ambos)
          companySize: 'all',       // Todas as empresas
          useTechnicalAnalysis: true // Análise técnica ativada por padrão
        })
        break
      case "magicFormula":
        setParams({ 
          limit: 10,                // 10 resultados
          companySize: 'all',       // Todas as empresas
          useTechnicalAnalysis: true // Análise técnica ativada por padrão
        })
        break
      case "fcd":
        setParams({ 
          growthRate: isBDR ? 0.03 : 0.025,        // 3% crescimento para BDRs (mercado mais dinâmico), 2.5% para Brasil
          discountRate: isBDR ? 0.12 : 0.10,       // 12% WACC para BDRs (risco diferente), 10% para Brasil
          yearsProjection: 5,       // 5 anos de projeção
          minMarginOfSafety: isBDR ? 0.10 : 0.15,  // 10% margem para BDRs (múltiplos mais altos), 15% para Brasil
          limit: 10,                // 10 resultados
          companySize: 'all',       // Todas as empresas
          useTechnicalAnalysis: true // Análise técnica ativada por padrão
        })
        break
      case "gordon":
        setParams({ 
          discountRate: isBDR ? 0.12 : 0.11,       // 12% taxa de desconto para BDRs, 11% para Brasil
          dividendGrowthRate: isBDR ? 0.05 : 0.04, // 5% crescimento para BDRs (empresas mais maduras), 4% para Brasil
          useSectoralAdjustment: true, // Ativar ajuste setorial
          sectoralWaccAdjustment: 0,   // Sem ajuste manual adicional
          limit: 10,                // 10 resultados
          companySize: 'all',       // Todas as empresas
          useTechnicalAnalysis: true // Análise técnica ativada por padrão
        })
        break
        case "barsi":
          setParams({
            targetDividendYield: isBDR ? 0.03 : 0.05,      // 3% para BDRs (mercado americano), 5% para Brasil
            maxPriceToPayMultiplier: 1.0,   // Preço teto exato
            minConsecutiveDividends: isBDR ? 3 : 3,     // 3 anos consecutivos (mesmo)
            maxDebtToEquity: isBDR ? 1.5 : 1.0,           // 150% para BDRs (mais tolerável), 100% para Brasil
            minROE: isBDR ? 0.12 : 0.10,                   // 12% ROE mínimo para BDRs, 10% para Brasil
            focusOnBEST: true,              // Focar nos setores B.E.S.T.
            companySize: 'all',             // Todas as empresas
            limit: 10,                      // 10 resultados
            useTechnicalAnalysis: true      // Análise técnica ativada por padrão
          })
          break
        case "fundamentalist":
          setParams({
            minROE: isBDR ? 0.15 : 0.15,             // 15% ROE mínimo (mesmo)
            minROIC: isBDR ? 0.15 : 0.15,            // 15% ROIC mínimo (mesmo)
            maxDebtToEbitda: isBDR ? 4.0 : 3.0,     // 4x máximo para BDRs (mais tolerável), 3x para Brasil
            minPayout: isBDR ? 0.30 : 0.40,          // 30% payout mínimo para BDRs, 40% para Brasil
            maxPayout: isBDR ? 0.90 : 0.80,          // 90% payout máximo para BDRs, 80% para Brasil
            companySize: 'all',       // Todas as empresas
            limit: 10,                // 10 resultados
            useTechnicalAnalysis: true // Análise técnica ativada por padrão
          })
          break
      case "screening":
        setParams({ 
          limit: 20,                    // 20 resultados
          companySize: 'all',           // Todas as empresas
          useTechnicalAnalysis: true    // Análise técnica ativada por padrão
          // Filtros são opcionais e ativados pelo usuário
        })
        break
      case "ai":
        setParams({ 
          riskTolerance: "Moderado",           // Tolerância ao risco
          timeHorizon: "Longo Prazo",          // Horizonte de investimento
          focus: "Crescimento e Valor",        // Foco da análise
          limit: 10,                           // 10 resultados
          companySize: 'all',                  // Todas as empresas
          useTechnicalAnalysis: true           // Análise técnica ativada por padrão
        })
        break
      default:
        setParams({})
    }
  }

  // Etapas do processamento da IA
  const aiProcessingSteps = useMemo(() => [
    { 
      id: 0, 
      title: "Iniciando análise", 
      description: "Preparando sistema de IA...", 
      icon: <Brain className="w-5 h-5" />,
      duration: 5000 
    },
    { 
      id: 1, 
      title: "Seleção inteligente com IA", 
      description: `IA analisando centenas de empresas e selecionando as ${(params.limit || 10) + 10} melhores baseado no seu perfil...`, 
      icon: <Brain className="w-5 h-5" />,
      duration: 10000 
    },
    { 
      id: 2, 
      title: "Executando estratégias tradicionais", 
      description: "Analisando Graham, Dividend Yield, Low P/E, Fórmula Mágica, FCD e Gordon nas empresas selecionadas...", 
      icon: <Calculator className="w-5 h-5" />,
      duration: 5000 
    },
    { 
      id: 3, 
      title: "Análise batch com IA", 
      description: "IA processando todas as empresas simultaneamente com dados da internet...", 
      icon: <Sparkles className="w-5 h-5" />,
      duration: 20000 
    },
    { 
      id: 4, 
      title: "Pesquisando dados na internet", 
      description: "Buscando notícias recentes e informações atualizadas para cada empresa...", 
      icon: <Search className="w-5 h-5" />,
      duration: 20000 
    },
    { 
      id: 5, 
      title: "Finalizando ranking", 
      description: "Consolidando resultados e preparando relatório...", 
      icon: <CheckCircle className="w-5 h-5" />,
      duration: 5000 
    }
  ], [params.limit])

  // Simular progresso das etapas da IA
  useEffect(() => {
    if (!showAIModal) return

    const currentStep = aiProcessingSteps[aiProcessingStep]
    if (!currentStep) return

    const timer = setTimeout(() => {
      if (aiProcessingStep < aiProcessingSteps.length - 1) {
        setAiProcessingStep(prev => prev + 1)
      }
    }, currentStep.duration)

    return () => clearTimeout(timer)
  }, [aiProcessingStep, showAIModal, aiProcessingSteps])

  const handleGenerateRanking = async () => {
    if (!selectedModel) return

    setLoadingType('generating') // Gerando novo ranking
    setLoading(true)
    setError(null)
    setIsViewingCached(false) // Resetar estado de cache ao gerar novo ranking
    setCachedInfo(null)

    // Se for modelo AI, mostrar modal de processamento
    if (selectedModel === 'ai') {
      setShowAIModal(true)
      setAiProcessingStep(0)
    }

    try {
      const response = await fetch("/api/rank-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          params: {
            ...params,
            includeBDRs: assetTypeFilter === 'both' || assetTypeFilter === 'bdr',
            assetTypeFilter
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: RankingResponse = await response.json()
      setResults(data)
      setIsResultsExpanded(true) // Expandir automaticamente quando novos resultados são gerados
      
      // Track evento de criação de ranking
      trackEvent(EventType.RANKING_CREATED, undefined, {
        model: selectedModel,
        resultCount: data.results?.length || data.count || 0,
        params: params,
      })
      
      // Notificar que um novo ranking foi gerado (para atualizar o histórico)
      if (onRankingGenerated) {
        onRankingGenerated()
      }
    } catch (err) {
      console.error("Erro ao gerar ranking:", err)
      setError("Erro ao gerar ranking. Tente novamente.")
    } finally {
      setLoading(false)
      setShowAIModal(false)
      setAiProcessingStep(0)
    }
  }

  // Função para sair do modo de visualização cached e permitir nova geração
  const handleRegenerateMode = () => {
    setIsViewingCached(false)
    setCachedInfo(null)
    setResults(null)
    setIsResultsExpanded(false)
  }

  // Callback quando configuração de backtest em lote é selecionada
  const handleBatchBacktestConfigSelected = () => {
    setShowBatchBacktestModal(false);
    // Usuário permanece na página atual
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatPercentage = (value: number | null) => {
    if (value === null) return "N/A"
    return `${(value).toFixed(1)}%`
  }

  // Função para formatar valores das métricas
  const formatMetricValue = (key: string, value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    
    // Identificar métricas que são percentuais (geralmente em decimal)
    const percentualMetrics = [
      'roe', 'roa', 'roic', 'margemLiquida', 'margemEbitda', 
      'crescimentoReceitas', 'crescimentoLucros', 'dy', 'impliedWACC', 
      'impliedGrowth', 'sustainabilityScore', 'qualityScore', 'valueScore',
      'fcdQualityScore', 'terminalValueContribution'
    ];
    
    // Identificar métricas monetárias
    const monetaryMetrics = [
      'lpa', 'vpa', 'fairValue', 'currentPrice', 'precoJusto',
      'fcffBase', 'enterpriseValue', 'presentValueCashflows', 
      'presentValueTerminal', 'marketCapBi'
    ];
    
    // Formatação específica baseada no tipo de métrica
    if (percentualMetrics.includes(key)) {
      // Se o valor está entre 0 e 1, assumir que é decimal e converter para %
      if (value >= 0 && value <= 1) {
        return `${(value * 100).toFixed(1)}%`;
      }
      // Caso contrário, assumir que já está em %
      return `${value.toFixed(1)}%`;
    }
    
    if (monetaryMetrics.includes(key)) {
      return formatCurrency(value);
    }
    
    // Para outros valores, formatar como número
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  // Função para traduzir nomes de métricas
  const translateMetricName = (key: string) => {
    const translations: Record<string, string> = {
      'fairValue': 'Preço Justo',
      'roe': 'ROE',
      'roa': 'ROA', 
      'roic': 'ROIC',
      'pl': 'P/L',
      'pvp': 'P/VP',
      'dy': 'Dividend Yield',
      'lpa': 'LPA',
      'vpa': 'VPA',
      'margemLiquida': 'Margem Líquida',
      'margemEbitda': 'Margem EBITDA',
      'crescimentoReceitas': 'Crescimento Receitas',
      'crescimentoLucros': 'Crescimento Lucros',
      'liquidezCorrente': 'Liquidez Corrente',
      'dividaLiquidaPl': 'Dívida Líquida/PL',
      'qualityScore': 'Score Qualidade',
      'sustainabilityScore': 'Score Sustentabilidade',
      'valueScore': 'Score Value',
      'fcdQualityScore': 'Score FCD',
      'fcffBase': 'FCFF Base (R$ Mi)',
      'enterpriseValue': 'Enterprise Value (R$ Bi)',
      'presentValueCashflows': 'VP Fluxos (R$ Bi)',
      'presentValueTerminal': 'VP Terminal (R$ Bi)',
      'terminalValueContribution': 'Contribuição Valor Terminal',
      'impliedWACC': 'WACC Aplicado',
      'impliedGrowth': 'Crescimento Aplicado',
      'projectionYears': 'Anos Projeção',
      'marketCapBi': 'Market Cap (R$ Bi)',
      'combinedRank': 'Ranking Combinado',
      'roicRank': 'Ranking ROIC',
      'eyRank': 'Ranking Earnings Yield',
      'earningsYield': 'Earnings Yield'
    };
    
    return translations[key] || key.replace(/([A-Z])/g, ' $1').trim();
  }

  // Processar resultados com filtros e ordenação
  const filteredAndSortedResults = useMemo(() => {
    if (!results?.results) {
      return [];
    }
    
    let processed = [...results.results];
    
    // Aplicar filtros
    // IMPORTANTE: Os valores vêm em decimal (0.09 = 9%), então dividimos o filtro por 100
    if (filterROE !== null) {
      processed = processed.filter(r => {
        const roe = r.key_metrics?.roe;
        return roe !== null && roe !== undefined && roe >= (filterROE / 100);
      });
    }
    
    if (filterMargemLiquida !== null) {
      processed = processed.filter(r => {
        const margem = r.key_metrics?.margemLiquida;
        return margem !== null && margem !== undefined && margem >= (filterMargemLiquida / 100);
      });
    }
    
    if (filterROIC !== null) {
      processed = processed.filter(r => {
        const roic = r.key_metrics?.roic;
        return roic !== null && roic !== undefined && roic >= (filterROIC / 100);
      });
    }
    
    if (filterDY !== null) {
      processed = processed.filter(r => {
        const dy = r.key_metrics?.dy;
        return dy !== null && dy !== undefined && dy >= (filterDY / 100);
      });
    }
    
    // Aplicar ordenação
    if (sortBy !== "default") {
      processed.sort((a, b) => {
        let aVal: number | null = null;
        let bVal: number | null = null;
        
        switch (sortBy) {
          case "upside":
            // Upside já vem em % (ex: 25.5 = 25.5%)
            // Calculado como: ((fairValue - currentPrice) / currentPrice) * 100
            // Funciona para todas as estratégias (Graham, FCD, Gordon, etc)
            aVal = a.upside;
            bVal = b.upside;
            break;
          case "upside_graham":
            // Ordenar especificamente por upside de Graham
            aVal = a.grahamUpside ?? a.key_metrics?.grahamUpside ?? null;
            bVal = b.grahamUpside ?? b.key_metrics?.grahamUpside ?? null;
            break;
          case "upside_fcd":
            // Ordenar especificamente por upside de FCD
            aVal = a.fcdUpside ?? a.key_metrics?.fcdUpside ?? null;
            bVal = b.fcdUpside ?? b.key_metrics?.fcdUpside ?? null;
            break;
          case "upside_gordon":
            // Ordenar especificamente por upside de Gordon
            aVal = a.gordonUpside ?? a.key_metrics?.gordonUpside ?? null;
            bVal = b.gordonUpside ?? b.key_metrics?.gordonUpside ?? null;
            break;
          case "roe":
            // ROE vem em decimal (0.09 = 9%), mas não precisa converter aqui
            // A comparação funciona igual em decimal
            aVal = a.key_metrics?.roe ?? null;
            bVal = b.key_metrics?.roe ?? null;
            break;
          case "roic":
            // ROIC vem em decimal (0.12 = 12%)
            aVal = a.key_metrics?.roic ?? null;
            bVal = b.key_metrics?.roic ?? null;
            break;
          case "margem_liquida":
            // Margem Líquida vem em decimal (0.15 = 15%)
            aVal = a.key_metrics?.margemLiquida ?? null;
            bVal = b.key_metrics?.margemLiquida ?? null;
            break;
          case "dy":
            // DY vem em decimal (0.06 = 6%)
            aVal = a.key_metrics?.dy ?? null;
            bVal = b.key_metrics?.dy ?? null;
            break;
          case "price_asc":
            aVal = a.currentPrice;
            bVal = b.currentPrice;
            // Ordem crescente
            if (aVal === null || bVal === null) return 0;
            return aVal - bVal;
          case "price_desc":
            aVal = a.currentPrice;
            bVal = b.currentPrice;
            break;
        }
        
        // Valores nulos vão para o final
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        
        // Ordem decrescente (maior primeiro) exceto para price_asc
        return bVal - aVal;
      });
    }
    
    return processed;
  }, [results, sortBy, filterROE, filterMargemLiquida, filterROIC, filterDY]);
  
  // Resetar filtros quando trocar de ranking
  useEffect(() => {
    if (results) {
      setSortBy("default");
      setFilterROE(null);
      setFilterMargemLiquida(null);
      setFilterROIC(null);
      setFilterDY(null);
      setShowFilters(false);
    }
  }, [results]);

  // Componente helper para controle de análise técnica
  const TechnicalAnalysisControl = () => (
    <div className="space-y-3 border border-blue-200 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          📊 Priorização por Análise Técnica
        </Label>
        <Badge variant={params.useTechnicalAnalysis !== false ? "default" : "outline"} className="text-xs">
          {params.useTechnicalAnalysis !== false ? "Ativada" : "Desativada"}
        </Badge>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={`technicalAnalysis-${selectedModel}`}
          checked={params.useTechnicalAnalysis !== false}
          onChange={(e) => setParams({ ...params, useTechnicalAnalysis: e.target.checked })}
          className="rounded border-gray-300 w-4 h-4"
        />
        <label htmlFor={`technicalAnalysis-${selectedModel}`} className="text-sm text-muted-foreground cursor-pointer">
          Priorizar ativos em sobrevenda (RSI e Estocástico)
        </label>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Quando ativado, ativos em sobrevenda aparecem primeiro no ranking para melhor timing de entrada
      </p>
    </div>
  );

  // Função para gerar rational baseado no modelo e parâmetros (similar ao backend)
  const generateRational = (model: string, params: RankingParams): string => {
    switch (model) {
      case 'graham':
        return `**MODELO GRAHAM APRIMORADO**

**Filosofia**: Baseado na fórmula clássica de Benjamin Graham para encontrar ações baratas de empresas sólidas.

**Estratégia**: Preço Justo = √(22.5 × LPA × VPA), buscando margem de segurança de ${((params.marginOfSafety || 0) * 100).toFixed(0)}%.

**Filtros de Qualidade Aplicados**:
• ROE ≥ 10% (rentabilidade consistente)
• Liquidez Corrente ≥ 1.0 (capacidade de honrar compromissos)
• Margem Líquida > 0% (empresa lucrativa)
• Crescimento Lucros ≥ -15% (não em declínio severo)
• Dívida Líquida/PL ≤ 150% (endividamento controlado)

**Ordenação**: Por Score de Qualidade (combina solidez financeira + margem de segurança)${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (ativos em sobrevenda primeiro)' : ''}.

**Objetivo**: Encontrar empresas subvalorizadas MAS financeiramente saudáveis, evitando "value traps"${params.useTechnicalAnalysis ? '. Com análise técnica ativa, priorizamos ativos em sobrevenda para melhor timing de entrada' : ''}.`;

      case 'dividendYield':
        return `**MODELO ANTI-DIVIDEND TRAP**

**Filosofia**: Focado em renda passiva sustentável, evitando empresas que pagam dividendos altos mas estão em declínio.

**Estratégia**: Dividend Yield ≥ ${((params.minYield || 0) * 100).toFixed(1)}% + rigorosos filtros de sustentabilidade.

**Problema Resolvido**: Elimina "dividend traps" - empresas com DY artificial por queda no preço ou dividendos insustentáveis.

**Filtros Anti-Trap**:
• ROE ≥ 10% (rentabilidade forte e consistente)
• Liquidez Corrente ≥ 1.2 (capacidade real de pagar dividendos)
• P/L entre 4-25 (evita preços artificiais ou empresas caras demais)
• Margem Líquida ≥ 5% (lucratividade real e saudável)
• Dívida Líquida/PL ≤ 100% (não comprometida por dívidas)
• Market Cap ≥ R$ 1B (tamanho e liquidez adequados)

**Ordenação**: Por Score de Sustentabilidade (combina DY + saúde financeira)${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (ativos em sobrevenda primeiro)' : ''}.

**Objetivo**: Renda passiva de qualidade, não armadilhas disfarçadas${params.useTechnicalAnalysis ? '. Com análise técnica ativa, priorizamos ativos em sobrevenda para melhor timing de entrada' : ''}.`;

      case 'lowPE':
        return `**MODELO VALUE INVESTING**

**Filosofia**: Baseado no value investing clássico - empresas baratas (baixo P/L) MAS de qualidade comprovada.

**Estratégia**: P/L ≤ ${params.maxPE || 12} + ROE ≥ ${((params.minROE || 0) * 100).toFixed(0)}% + filtros rigorosos de qualidade.

**Filtros de Qualidade Aplicados**:
• ROE ≥ ${((params.minROE || 0) * 100).toFixed(0)}% (rentabilidade alta e consistente)
• P/L entre 5-${params.maxPE || 12} (preço realmente atrativo)
• Liquidez Corrente ≥ 1.0 (capacidade operacional)
• Margem Líquida ≥ 3% (eficiência comprovada)
• Dívida Líquida/PL ≤ 100% (estrutura financeira saudável)
• Market Cap ≥ R$ 500M (tamanho adequado)

**Ordenação**: Por Score de Valor (combina baixo P/L + alta qualidade).

**Objetivo**: Combinar preços atrativos com qualidade operacional comprovada.`;

      case 'magicFormula':
        return `**FÓRMULA MÁGICA DE GREENBLATT**

**Filosofia**: Estratégia quantitativa de Joel Greenblatt que combina alta qualidade operacional com preços de barganha.

**Estratégia**: Ranquear empresas por Earnings Yield (E/EV) + ROIC, selecionando as top ${params.limit || 10}.

**Métricas-Chave**:
• **Earnings Yield**: Lucro por Valor da Empresa (quanto "barata" está)
• **ROIC**: Return on Invested Capital (quão bem usa o capital)

**Filtros de Qualidade**:
• ROE ≥ 12% (alta rentabilidade)
• ROIC ≥ 10% (uso eficiente do capital)
• Margem EBIT ≥ 5% (eficiência operacional)
• Liquidez Corrente ≥ 1.0 (capacidade de pagamento)
• Market Cap ≥ R$ 1B (liquidez adequada)

**Ordenação**: Por ranking combinado (Earnings Yield + ROIC rankings).

**Objetivo**: Encontrar empresas que geram muito valor e estão baratas no mercado.`;

      case 'fcd':
        const growthRate = ((params.growthRate || 0.025) * 100).toFixed(1);
        const discountRate = ((params.discountRate || 0.10) * 100).toFixed(1);
        const years = params.yearsProjection || 5;
        const marginSafety = ((params.minMarginOfSafety || 0.20) * 100).toFixed(0);
        
        return `**MODELO FLUXO DE CAIXA DESCONTADO (FCD) - PREMIUM**

**Filosofia**: Avaliação intrínseca baseada na capacidade de geração de caixa da empresa, projetando fluxos futuros e descontando-os a valor presente.

**Metodologia Aplicada**:
• **Fluxo de Caixa Livre da Firma (FCFF)**: EBITDA - Capex Estimado - Variação Capital de Giro
• **Projeção**: ${years} anos com crescimento de ${growthRate}% ao ano
• **Taxa de Desconto**: ${discountRate}% (WACC simplificado considerando risco Brasil)
• **Valor Terminal**: Crescimento perpétuo de ${growthRate}% pós-período explícito
• **Margem de Segurança**: Mínima de ${marginSafety}%

**Filtros de Qualidade Premium**:
• EBITDA > 0 e consistente (geração de caixa operacional)
• Fluxo de Caixa Operacional > 0 (capacidade real de geração)
• ROE ≥ 12% (rentabilidade superior sobre patrimônio)
• Margem EBITDA ≥ 15% (eficiência operacional elevada)
• Crescimento Receitas ≥ -10% (não em declínio operacional severo)
• Liquidez Corrente ≥ 1.2 (situação financeira sólida)
• Market Cap ≥ R$ 2B (empresas consolidadas e líquidas)

**Diferencial Premium**:
• Cálculo sofisticado de valor intrínseco baseado em DCF
• Considera valor temporal do dinheiro e risco específico
• Projeta cenários futuros realistas de geração de caixa
• Identifica empresas subvalorizadas com base em fundamentos sólidos

**Resultado**: Preço justo calculado por metodologia robusta utilizada por analistas profissionais.`;

      case 'gordon':
        const discountRateGordon = ((params.discountRate || 0.11) * 100).toFixed(1);
        const dividendGrowthRateGordon = ((params.dividendGrowthRate || 0.04) * 100).toFixed(1);
        const sectoralAdjustment = params.useSectoralAdjustment !== false;
        const manualAdjustment = params.sectoralWaccAdjustment || 0;
        
        return `**FÓRMULA DE GORDON CALIBRADA (MÉTODO DOS DIVIDENDOS) - PREMIUM**

**Filosofia**: Avaliação baseada na capacidade de distribuição de dividendos da empresa, utilizando a fórmula clássica de Gordon para calcular o preço justo.

**Metodologia Aplicada**:
• **Fórmula**: Preço Justo = Dividendo Próximos 12m / (Taxa Desconto - Taxa Crescimento)
• **Taxa de Desconto Base**: ${discountRateGordon}% (retorno esperado pelo investidor)
• **Taxa de Crescimento Base**: ${dividendGrowthRateGordon}% (crescimento esperado dos dividendos)
• **Calibração Setorial**: ${sectoralAdjustment ? 'Ativada' : 'Desativada'} (ajuste automático por setor)
${manualAdjustment !== 0 ? `• **Ajuste Manual**: ${manualAdjustment > 0 ? '+' : ''}${(manualAdjustment * 100).toFixed(1)}% adicional no WACC` : ''}
• **Margem de Segurança**: Mínima de 15% (upside mínimo exigido)

**Filtros de Qualidade Premium**:
• Dividend Yield ≥ 4% (rentabilidade atrativa em dividendos)
• DY 12m ≥ 3% (consistência na distribuição)
• Payout ≤ 80% (sustentabilidade dos pagamentos)
• ROE ≥ 12% (alta rentabilidade sobre patrimônio)
• Crescimento Lucros ≥ -20% (não em declínio severo)
• Liquidez Corrente ≥ 1.2 (capacidade de honrar compromissos)
• Dívida Líquida/PL ≤ 100% (endividamento controlado)

**Calibração Setorial Premium**:
${sectoralAdjustment ? `
• **Utilities/Energia**: WACC reduzido (-1% a -2%) - setores estáveis
• **Bancos/Seguros**: WACC padrão, crescimento baseado em ROE
• **Industriais**: WACC moderado (+1% a +1.5%) - risco médio
• **Tecnologia**: WACC elevado (+3%) - alta volatilidade
• **Análise de Pares**: Validação automática vs. múltiplos do setor
` : `
• Utilizando parâmetros fixos sem ajuste setorial
`}

**Diferencial Premium**:
• Foco específico em empresas pagadoras de dividendos
• Parâmetros calibrados por setor baseado em dados de mercado
• Avalia sustentabilidade e crescimento das distribuições
• Identifica oportunidades para renda passiva consistente
• Combina yield atrativo com qualidade financeira

**Ideal Para**: Investidores focados em renda passiva com crescimento sustentável dos dividendos.

**Resultado**: Empresas com dividendos atrativos e sustentáveis, ordenadas por potencial de valorização + qualidade dos pagamentos.`;

      case 'barsi':
        const targetDY = ((params.targetDividendYield || 0.06) * 100).toFixed(1);
        const multiplier = params.maxPriceToPayMultiplier || 1.0;
        const minYears = params.minConsecutiveDividends || 5;
        const maxDebt = ((params.maxDebtToEquity || 1.0) * 100).toFixed(0);
        const minROEBarsi = ((params.minROE || 0.10) * 100).toFixed(0);
        const focusBEST = params.focusOnBEST !== false;
        
        return `# MÉTODO BARSI - BUY AND HOLD DE DIVIDENDOS

**Filosofia**: Baseado na estratégia de Luiz Barsi para construção de patrimônio através de dividendos em setores "perenes".

**Estratégia**: Comprar empresas de setores essenciais quando o preço estiver abaixo do "preço teto" calculado pela meta de Dividend Yield.

## Os 5 Passos do Método Barsi

### 1. Setores Perenes (B.E.S.T.)
${focusBEST ? '✅ ATIVO' : '⚠️ OPCIONAL'} - Foco em setores essenciais:
- **B**ancos
- **E**nergia Elétrica  
- **S**aneamento e **S**eguros
- **T**elecomunicações
- **Gás** (adicional)

### 2. Qualidade da Empresa
- ROE ≥ ${minROEBarsi}% (lucro consistente)
- Dívida/PL ≤ ${maxDebt}% (baixo endividamento)
- Margem Líquida positiva (empresa lucrativa)
- Histórico de ${minYears} anos pagando dividendos

### 3. Preço Teto (Conceito Central)
**Fórmula**: Preço Teto = Dividendo por Ação ÷ DY Meta (${targetDY}%)
- Multiplicador: ${multiplier}x
- **Só compra se Preço Atual ≤ Preço Teto**

### 4. Disciplina de Aporte
- Aporte mensal constante
- Aproveitar crises para comprar mais barato
- Foco em empresas abaixo do preço teto

### 5. Reinvestimento 100%
- Todos os dividendos reinvestidos em mais ações
- Efeito "bola de neve" dos juros compostos
- **Nunca vender** (exceto se perder fundamentos)

**Score Barsi**:
- 40% Desconto do Preço Teto (oportunidade de compra)
- 35% Qualidade dos Dividendos (DY + consistência histórica)  
- 25% Saúde Financeira (ROE, liquidez, margem)

**Ordenação**: Por Score Barsi (melhor oportunidade de compra + qualidade)${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica (timing de entrada)' : ''}.

**Objetivo**: Independência financeira através de renda passiva crescente e sustentável${params.useTechnicalAnalysis ? '. Com análise técnica ativa, otimizamos o timing de entrada nos ativos selecionados' : ''}.`;

      case 'fundamentalist':
        const minROEFund = ((params.minROE || 0.15) * 100).toFixed(0);
        const minROICFund = ((params.minROIC || 0.15) * 100).toFixed(0);
        const maxDebtFund = (params.maxDebtToEbitda || 3.0).toFixed(1);
        const minPayoutFund = ((params.minPayout || 0.40) * 100).toFixed(0);
        const maxPayoutFund = ((params.maxPayout || 0.80) * 100).toFixed(0);
        
        return `**ESTRATÉGIA FUNDAMENTALISTA 3+1 - PREMIUM**

**Filosofia**: Análise fundamentalista simplificada usando apenas 3 indicadores essenciais para tomar decisões de investimento rápidas e precisas.

**Metodologia Adaptativa**:
• **Empresas SEM dívida relevante**: ROE + P/L vs Crescimento + Endividamento
• **Empresas COM dívida relevante**: ROIC + EV/EBITDA + Endividamento  
• **Bancos/Seguradoras**: ROE + P/L (endividamento não aplicável)
• **Bônus Dividendos**: Payout + Dividend Yield para renda passiva

**Parâmetros Aplicados**:
• **ROE Mínimo**: ${minROEFund}% (empresas sem dívida)
• **ROIC Mínimo**: ${minROICFund}% (empresas com dívida)
• **Dívida Líquida/EBITDA**: Máximo ${maxDebtFund}x
• **Payout Ideal**: ${minPayoutFund}% - ${maxPayoutFund}% (análise de dividendos)

**Passo 1 - Qualidade da Empresa**:
• Avalia se a empresa gera bom retorno sobre capital
• ROE ≥ ${minROEFund}% para empresas sem dívida relevante
• ROIC ≥ ${minROICFund}% para empresas com dívida relevante
• Apenas ROE para bancos e seguradoras

**Passo 2 - Atratividade do Preço**:
• P/L vs Crescimento dos Lucros (empresas sem dívida)
• EV/EBITDA (empresas com dívida)
• P/L absoluto (bancos e seguradoras)

**Passo 3 - Nível de Endividamento**:
• Dívida Líquida/EBITDA ≤ ${maxDebtFund}x (empresas normais)
• Não aplicável para bancos/seguradoras

**Passo 4 (Bônus) - Análise de Dividendos**:
• Payout entre ${minPayoutFund}%-${maxPayoutFund}% + DY ≥ 4%
• Identifica boas pagadoras de dividendos
• Foco em sustentabilidade das distribuições

**Diferencial Premium**:
• Metodologia que se adapta automaticamente ao perfil da empresa
• Análise específica para bancos/seguradoras
• Simplifica decisões usando apenas indicadores essenciais
• Combina análise de valor, qualidade e renda passiva
• Baseado em metodologia consagrada de análise fundamentalista

**Ideal Para**: Investidores que buscam análise rápida e fundamentada, sem complexidade excessiva.

**Resultado**: Empresas de qualidade com preços atrativos e endividamento controlado, ranqueadas por score fundamentalista.`;

      case 'ai':
        const riskTolerance = params.riskTolerance || 'Moderado';
        const timeHorizon = params.timeHorizon || 'Longo Prazo';
        const focus = params.focus || 'Crescimento e Valor';
        
        return `# ANÁLISE PREDITIVA COM INTELIGÊNCIA ARTIFICIAL - PREMIUM

**Filosofia**: Utiliza Inteligência Artificial (Gemini) para analisar e sintetizar os resultados de todas as estratégias tradicionais, criando uma avaliação preditiva abrangente.

## Metodologia Aplicada

- **Seleção Inteligente com IA**: Primeira chamada LLM seleciona empresas baseada no perfil do investidor
- **Análise Multiestrategica**: Executa Graham, Dividend Yield, Low P/E, Fórmula Mágica, FCD e Gordon
- **Pesquisa em Tempo Real**: IA busca notícias e dados atualizados na internet
- **Processamento Batch**: Segunda chamada LLM analisa todas as empresas simultaneamente
- **Síntese Inteligente**: IA analisa consistência e convergência entre estratégias
- **Avaliação Preditiva**: Considera contexto macroeconômico e tendências setoriais

## Parâmetros de Análise

- **Tolerância ao Risco**: ${riskTolerance}
- **Horizonte**: ${timeHorizon}
- **Foco**: ${focus}

## Diferencial Premium

- Seleção inteligente baseada no perfil específico do investidor
- Análise de 6 estratégias simultaneamente para cada empresa selecionada
- Inteligência Artificial com acesso a dados da internet em tempo real
- Processamento batch otimizado (mais rápido e eficiente)
- Pesquisa automática de notícias e fatos relevantes recentes
- Síntese preditiva considerando contexto atual do mercado
- Avaliação de riscos e oportunidades específicas por empresa
- Nível de confiança da análise baseado em múltiplas fontes
- Consideração de fatores macroeconômicos e setoriais atualizados

> **IMPORTANTE**: Esta análise utiliza Inteligência Artificial e pode gerar resultados ligeiramente diferentes em novas execuções devido à natureza adaptativa do modelo.

**Ideal Para**: Investidores que buscam uma análise abrangente e preditiva baseada em múltiplas metodologias.

**Resultado**: Ranking preditivo personalizado com base no seu perfil de risco e objetivos de investimento.`;

      case 'screening':
        // Contar filtros ativos e listar quais estão aplicados
        const activeFilters: string[] = [];
        
        // Valuation
        if (params.plFilter?.enabled) {
          const min = params.plFilter.min !== undefined ? params.plFilter.min.toFixed(1) : 'sem mínimo';
          const max = params.plFilter.max !== undefined ? params.plFilter.max.toFixed(1) : 'sem máximo';
          activeFilters.push(`• **P/L**: ${min} - ${max}`);
        }
        if (params.pvpFilter?.enabled) {
          const min = params.pvpFilter.min !== undefined ? params.pvpFilter.min.toFixed(1) : 'sem mínimo';
          const max = params.pvpFilter.max !== undefined ? params.pvpFilter.max.toFixed(1) : 'sem máximo';
          activeFilters.push(`• **P/VP**: ${min} - ${max}`);
        }
        if (params.evEbitdaFilter?.enabled) {
          const min = params.evEbitdaFilter.min !== undefined ? params.evEbitdaFilter.min.toFixed(1) : 'sem mínimo';
          const max = params.evEbitdaFilter.max !== undefined ? params.evEbitdaFilter.max.toFixed(1) : 'sem máximo';
          activeFilters.push(`• **EV/EBITDA**: ${min} - ${max}`);
        }
        if (params.psrFilter?.enabled) {
          const min = params.psrFilter.min !== undefined ? params.psrFilter.min.toFixed(1) : 'sem mínimo';
          const max = params.psrFilter.max !== undefined ? params.psrFilter.max.toFixed(1) : 'sem máximo';
          activeFilters.push(`• **PSR**: ${min} - ${max}`);
        }
        
        // Rentabilidade
        if (params.roeFilter?.enabled) {
          const min = params.roeFilter.min !== undefined ? (params.roeFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.roeFilter.max !== undefined ? (params.roeFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **ROE**: ${min} - ${max}`);
        }
        if (params.roicFilter?.enabled) {
          const min = params.roicFilter.min !== undefined ? (params.roicFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.roicFilter.max !== undefined ? (params.roicFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **ROIC**: ${min} - ${max}`);
        }
        if (params.roaFilter?.enabled) {
          const min = params.roaFilter.min !== undefined ? (params.roaFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.roaFilter.max !== undefined ? (params.roaFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **ROA**: ${min} - ${max}`);
        }
        if (params.margemLiquidaFilter?.enabled) {
          const min = params.margemLiquidaFilter.min !== undefined ? (params.margemLiquidaFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.margemLiquidaFilter.max !== undefined ? (params.margemLiquidaFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **Margem Líquida**: ${min} - ${max}`);
        }
        if (params.margemEbitdaFilter?.enabled) {
          const min = params.margemEbitdaFilter.min !== undefined ? (params.margemEbitdaFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.margemEbitdaFilter.max !== undefined ? (params.margemEbitdaFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **Margem EBITDA**: ${min} - ${max}`);
        }
        
        // Crescimento
        if (params.cagrLucros5aFilter?.enabled) {
          const min = params.cagrLucros5aFilter.min !== undefined ? (params.cagrLucros5aFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.cagrLucros5aFilter.max !== undefined ? (params.cagrLucros5aFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **CAGR Lucros 5a**: ${min} - ${max}`);
        }
        if (params.cagrReceitas5aFilter?.enabled) {
          const min = params.cagrReceitas5aFilter.min !== undefined ? (params.cagrReceitas5aFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.cagrReceitas5aFilter.max !== undefined ? (params.cagrReceitas5aFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **CAGR Receitas 5a**: ${min} - ${max}`);
        }
        
        // Dividendos
        if (params.dyFilter?.enabled) {
          const min = params.dyFilter.min !== undefined ? (params.dyFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.dyFilter.max !== undefined ? (params.dyFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **Dividend Yield**: ${min} - ${max}`);
        }
        if (params.payoutFilter?.enabled) {
          const min = params.payoutFilter.min !== undefined ? (params.payoutFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.payoutFilter.max !== undefined ? (params.payoutFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **Payout**: ${min} - ${max}`);
        }
        
        // Endividamento
        if (params.dividaLiquidaPlFilter?.enabled) {
          const min = params.dividaLiquidaPlFilter.min !== undefined ? (params.dividaLiquidaPlFilter.min * 100).toFixed(1) + '%' : 'sem mínimo';
          const max = params.dividaLiquidaPlFilter.max !== undefined ? (params.dividaLiquidaPlFilter.max * 100).toFixed(1) + '%' : 'sem máximo';
          activeFilters.push(`• **Dívida Líq./PL**: ${min} - ${max}`);
        }
        if (params.liquidezCorrenteFilter?.enabled) {
          const min = params.liquidezCorrenteFilter.min !== undefined ? params.liquidezCorrenteFilter.min.toFixed(1) : 'sem mínimo';
          const max = params.liquidezCorrenteFilter.max !== undefined ? params.liquidezCorrenteFilter.max.toFixed(1) : 'sem máximo';
          activeFilters.push(`• **Liquidez Corrente**: ${min} - ${max}`);
        }
        if (params.dividaLiquidaEbitdaFilter?.enabled) {
          const min = params.dividaLiquidaEbitdaFilter.min !== undefined ? params.dividaLiquidaEbitdaFilter.min.toFixed(1) + 'x' : 'sem mínimo';
          const max = params.dividaLiquidaEbitdaFilter.max !== undefined ? params.dividaLiquidaEbitdaFilter.max.toFixed(1) + 'x' : 'sem máximo';
          activeFilters.push(`• **Dívida Líq./EBITDA**: ${min} - ${max}`);
        }
        
        // Market Cap
        if (params.marketCapFilter?.enabled) {
          const min = params.marketCapFilter.min !== undefined ? 'R$ ' + (params.marketCapFilter.min / 1_000_000_000).toFixed(1) + 'B' : 'sem mínimo';
          const max = params.marketCapFilter.max !== undefined ? 'R$ ' + (params.marketCapFilter.max / 1_000_000_000).toFixed(1) + 'B' : 'sem máximo';
          activeFilters.push(`• **Market Cap**: ${min} - ${max}`);
        }
        
        const companySizeLabel = params.companySize === 'small_caps' ? 'Small Caps (< R$ 2bi)' : 
                                 params.companySize === 'mid_caps' ? 'Mid Caps (R$ 2-10bi)' : 
                                 params.companySize === 'blue_chips' ? 'Blue Chips (> R$ 10bi)' : 
                                 'Todas as empresas';
        
        return `**SCREENING DE AÇÕES CUSTOMIZÁVEL**

**Filosofia**: Ferramenta de filtros customizáveis que permite encontrar empresas específicas baseado em critérios totalmente configuráveis.

**Parâmetros Gerais**:
• **Tamanho**: ${companySizeLabel}
• **Limite de Resultados**: ${params.limit || 20} empresas
• **Análise Técnica**: ${params.useTechnicalAnalysis !== false ? 'Ativada (prioriza sobrevenda)' : 'Desativada'}

**Filtros Aplicados** (${activeFilters.length} ativos):
${activeFilters.length > 0 ? activeFilters.join('\n') : '• Nenhum filtro ativo - todas as empresas elegíveis serão exibidas'}

**Lógica de Filtros**:
• Apenas empresas que atendem **TODOS** os filtros ativos são exibidas
• Filtros desativados não são considerados na análise
• Valores "sem mínimo" ou "sem máximo" significam range aberto

**Ordenação**:
• Por Market Cap (empresas maiores primeiro)${params.useTechnicalAnalysis !== false ? '\n• Priorização por Análise Técnica (ativos em sobrevenda primeiro)' : ''}

**Objetivo**: Encontrar empresas que atendem exatamente aos seus critérios personalizados, com total flexibilidade de configuração.`;

      default:
        return `📊 **ESTRATÉGIA PERSONALIZADA**

Análise baseada nos critérios selecionados com foco em encontrar oportunidades de investimento de qualidade.`;
    }
  }

  return (
    <>
      {/* Loading Overlay Fullscreen */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 w-full max-w-sm sm:max-w-md shadow-2xl">
            <div className="text-center space-y-4 sm:space-y-6">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <BarChart3 className="absolute inset-0 m-auto w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {loadingType === 'generating' ? 'Analisando empresas...' : 'Carregando dados...'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 px-2">
                  {loadingType === 'generating' 
                    ? 'Processando dados fundamentalistas da B3' 
                    : 'Recuperando ranking salvo'}
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    
    <div ref={formRef} className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-violet-100 dark:from-blue-900/30 dark:to-violet-900/30 rounded-full px-4 py-2">
          <Zap className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">Ranking inteligente</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold">
          Encontre as melhores{" "}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            oportunidades
          </span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Use modelos de valuation consagrados com <strong>médias históricas de 7 anos</strong> e filtros anti-armadilha para descobrir ações subvalorizadas
        </p>
      </div>
      

      {/* Results - prioridade quando cached */}
      {results && (
        <div className="space-y-6">
          <Collapsible open={isResultsExpanded} onOpenChange={setIsResultsExpanded}>
            {/* Results Header - Collapsible Trigger */}
            <CollapsibleTrigger asChild>
              <Card className="border-0 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 cursor-pointer hover:shadow-md transition-all duration-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg sm:text-xl font-bold">
                          {isViewingCached ? "Ranking Salvo" : "Ranking Concluído"}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {results.count} empresas encontradas que atendem aos critérios
                        </p>
                        {!isResultsExpanded && (
                          <div className="flex items-center gap-2 mt-2">
                            <Target className="w-3 h-3 text-blue-600" />
                            <span className="text-xs text-blue-600 font-medium">
                              Clique para ver detalhes da estratégia
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                        {results.results.length} resultados
                      </Badge>
                      {isResultsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleTrigger>

            {/* Collapsible Content - Apenas Estratégia */}
            <CollapsibleContent>
              <Card className="border-0 bg-white/60 dark:bg-background/60 backdrop-blur-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-blue-600" />
                    <h4 className="font-semibold text-sm">Estratégia Aplicada</h4>
                  </div>
                  <MarkdownRenderer content={results.rational} />
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* CTA Backtest do Ranking - Destaque */}
          {results.results.length > 0 && (
            <Card ref={headerRef} className="border-0 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20 shadow-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center shrink-0">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        🎯 Backtest do Ranking Completo
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                        Simule como este ranking teria performado no passado! Teste múltiplas empresas simultaneamente 
                        e compare com índices de mercado.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs bg-white/50 dark:bg-slate-800/50">
                          📊 Múltiplas empresas
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-white/50 dark:bg-slate-800/50">
                          📈 Comparação com índices
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-white/50 dark:bg-slate-800/50">
                          💰 Performance histórica
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowBatchBacktestModal(true)}
                    size="lg"
                    className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 shadow-lg w-full sm:w-auto"
                  >
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Criar Backtest
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtros e Ordenação */}
          {results.results.length > 0 && (
            <Card className="border-0 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  {/* Header com toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-lg">Filtros e Ordenação</h3>
                      {(filterROE !== null || filterMargemLiquida !== null || filterROIC !== null || filterDY !== null || sortBy !== "default") && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {[filterROE, filterMargemLiquida, filterROIC, filterDY].filter(f => f !== null).length + (sortBy !== "default" ? 1 : 0)} ativos
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      {showFilters ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-1" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-1" />
                          Mostrar
                        </>
                      )}
                    </Button>
                  </div>

                  {showFilters && (
                    <div className="space-y-4 pt-2">
                      {/* Ordenação */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <ArrowUpDown className="w-4 h-4 text-blue-600" />
                          Ordenar por
                        </Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Padrão (Ranking Original)</SelectItem>
                            <SelectItem value="upside">Maior Upside</SelectItem>
                            <SelectItem value="upside_graham">Maior Upside Graham</SelectItem>
                            <SelectItem value="upside_fcd">Maior Upside FCD</SelectItem>
                            <SelectItem value="upside_gordon">Maior Upside Gordon</SelectItem>
                            <SelectItem value="roe">Maior ROE</SelectItem>
                            <SelectItem value="roic">Maior ROIC</SelectItem>
                            <SelectItem value="margem_liquida">Maior Margem Líquida</SelectItem>
                            <SelectItem value="dy">Maior Dividend Yield</SelectItem>
                            <SelectItem value="price_desc">Maior Preço</SelectItem>
                            <SelectItem value="price_asc">Menor Preço</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filtros */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                        {/* Filtro ROE */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">ROE Mínimo (%)</Label>
                            {filterROE !== null && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterROE(null)}
                                className="h-6 px-2 text-xs"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[filterROE ?? 0]}
                              onValueChange={(v) => setFilterROE(v[0] === 0 ? null : v[0])}
                              min={0}
                              max={50}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm font-medium min-w-[3rem] text-right">
                              {filterROE ?? 0}%
                            </span>
                          </div>
                        </div>

                        {/* Filtro ROIC */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">ROIC Mínimo (%)</Label>
                            {filterROIC !== null && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterROIC(null)}
                                className="h-6 px-2 text-xs"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[filterROIC ?? 0]}
                              onValueChange={(v) => setFilterROIC(v[0] === 0 ? null : v[0])}
                              min={0}
                              max={50}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm font-medium min-w-[3rem] text-right">
                              {filterROIC ?? 0}%
                            </span>
                          </div>
                        </div>

                        {/* Filtro Margem Líquida */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Margem Líquida Mín. (%)</Label>
                            {filterMargemLiquida !== null && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterMargemLiquida(null)}
                                className="h-6 px-2 text-xs"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[filterMargemLiquida ?? 0]}
                              onValueChange={(v) => setFilterMargemLiquida(v[0] === 0 ? null : v[0])}
                              min={0}
                              max={50}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm font-medium min-w-[3rem] text-right">
                              {filterMargemLiquida ?? 0}%
                            </span>
                          </div>
                        </div>

                        {/* Filtro DY */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Dividend Yield Mín. (%)</Label>
                            {filterDY !== null && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterDY(null)}
                                className="h-6 px-2 text-xs"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[filterDY ?? 0]}
                              onValueChange={(v) => setFilterDY(v[0] === 0 ? null : v[0])}
                              min={0}
                              max={20}
                              step={0.5}
                              className="flex-1"
                            />
                            <span className="text-sm font-medium min-w-[3rem] text-right">
                              {filterDY ?? 0}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botão Limpar Filtros */}
                      {(filterROE !== null || filterMargemLiquida !== null || filterROIC !== null || filterDY !== null || sortBy !== "default") && (
                        <div className="flex justify-end pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSortBy("default");
                              setFilterROE(null);
                              setFilterMargemLiquida(null);
                              setFilterROIC(null);
                              setFilterDY(null);
                            }}
                            className="gap-2"
                          >
                            <X className="w-4 h-4" />
                            Limpar Filtros
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contador de resultados filtrados */}
                  <div className="flex items-center justify-between pt-2 border-t text-sm text-muted-foreground">
                    <span>
                      Exibindo {filteredAndSortedResults.length} de {results.results.length} empresas
                    </span>
                    {filteredAndSortedResults.length < results.results.length && (
                      <Badge variant="outline" className="text-xs">
                        {results.results.length - filteredAndSortedResults.length} filtradas
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredAndSortedResults.length > 0 ? (
            <div ref={resultsRef} className="grid gap-3 sm:gap-4">
              {filteredAndSortedResults.map((result, index) => (
                <Card 
                  key={result.ticker} 
                  className="border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50 dark:from-background dark:to-background/80"
                >
                  <CardContent className="p-3 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <CompanyLogo 
                              logoUrl={result.logoUrl}
                              companyName={result.name}
                              ticker={result.ticker}
                              size={40}
                            />
                            {/* Badge com número do ranking */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-white dark:border-background">
                              {index + 1}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg sm:text-xl font-bold mb-1 truncate">
                              {result.ticker}
                            </h3>
                            <p className="text-muted-foreground mb-2 font-medium text-sm sm:text-base overflow-hidden" 
                               style={{
                                 display: '-webkit-box',
                                 WebkitLineClamp: 2,
                                 WebkitBoxOrient: 'vertical'
                               }}>
                              {result.name}
                            </p>
                            {result.sector && (
                              <Badge variant="outline" className="text-xs">
                                {result.sector}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right sm:text-right shrink-0">
                          {/* Preço Atual */}
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <span className="text-xl sm:text-2xl font-bold">
                              {formatCurrency(result.currentPrice)}
                            </span>
                          </div>
                          
                          {/* Upside da estratégia principal */}
                          {typeof result.upside === 'number' ? (
                            <div className="flex items-center justify-end gap-1 mb-2">
                              <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 ${result.upside >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                              <span className={`text-xs sm:text-sm font-semibold ${result.upside >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {result.upside >= 0 ? '+' : ''}{formatPercentage(result.upside)} upside
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1 mb-2">
                              <span className="text-xs text-muted-foreground">
                                Upside não calculado
                              </span>
                            </div>
                          )}
                          
                          {/* Upsides adicionais (outras estratégias) */}
                          {(() => {
                            const grahamUp = result.grahamUpside ?? result.key_metrics?.grahamUpside;
                            const fcdUp = result.fcdUpside ?? result.key_metrics?.fcdUpside;
                            const gordonUp = result.gordonUpside ?? result.key_metrics?.gordonUpside;
                            const hasAdditionalUpsides = typeof grahamUp === 'number' || typeof fcdUp === 'number' || typeof gordonUp === 'number';
                            
                            if (!hasAdditionalUpsides) return null;
                            
                            return (
                              <div className="flex flex-col items-end gap-0.5 pt-1 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-medium mb-0.5">
                                  Outras visões:
                                </span>
                                {typeof grahamUp === 'number' && (
                                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                                    Graham: <span className={`font-medium ${grahamUp >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                      {grahamUp >= 0 ? '+' : ''}{formatPercentage(grahamUp)}
                                    </span>
                                  </span>
                                )}
                                {typeof fcdUp === 'number' && (
                                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                                    FCD: <span className={`font-medium ${fcdUp >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                      {fcdUp >= 0 ? '+' : ''}{formatPercentage(fcdUp)}
                                    </span>
                                  </span>
                                )}
                                {typeof gordonUp === 'number' && (
                                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                                    Gordon: <span className={`font-medium ${gordonUp >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                      {gordonUp >= 0 ? '+' : ''}{formatPercentage(gordonUp)}
                                    </span>
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {/* Key Metrics */}
                      {result.key_metrics && (
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/10 dark:to-violet-950/10 rounded-lg">
                          {Object.entries(result.key_metrics)
                            .filter(([, value]) => value !== null && value !== undefined)
                            .slice(0, 4)
                            .map(([key, value]) => (
                              <div key={key} className="text-center">
                                <p className="text-xs text-muted-foreground mb-1 truncate">
                                  {translateMetricName(key)}
                                </p>
                                <p className="font-semibold text-xs sm:text-sm">
                                  {formatMetricValue(key, value as number)}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                      
                      {/* Individual Rational */}
                      <div className="border-t pt-3 sm:pt-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-3 h-3 text-blue-600" />
                          <h5 className="font-semibold text-xs text-blue-600">Análise Individual</h5>
                        </div>
                        <MarkdownRenderer content={result.rational} className="text-xs leading-relaxed" />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t">
                        <Button asChild variant="default" size="sm" className="flex-1">
                          <Link href={`/acao/${result.ticker}`} prefetch={false}>
                            <Building2 className="w-4 h-4 mr-2" />
                            Ver Análise
                          </Link>
                        </Button>
                        
                        <AddToBacktestButton
                          asset={{
                            ticker: result.ticker,
                            companyName: result.name,
                            sector: result.sector || undefined,
                            currentPrice: result.currentPrice
                          }}
                          variant="outline"
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          ) : results && results.results.length > 0 ? (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Filter className="w-8 h-8 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhuma empresa passou pelos filtros</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ajuste os filtros acima para ver mais resultados. Você tem {results.results.length} empresa(s) no ranking original.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSortBy("default");
                    setFilterROE(null);
                    setFilterMargemLiquida(null);
                    setFilterROIC(null);
                    setFilterDY(null);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar Todos os Filtros
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma empresa encontrada</h3>
                <p className="text-sm text-muted-foreground">
                  Tente ajustar os parâmetros da estratégia para encontrar mais oportunidades
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold">Erro na análise</h4>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cached Results Banner - prioridade no topo */}
      {isViewingCached && cachedInfo && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Ranking Salvo</h4>
                  <p className="text-xs text-muted-foreground">
                    Gerado em {new Date(cachedInfo.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })} • {cachedInfo.resultCount} empresas
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Botão especial para Screening - abre página com parâmetros */}
                {selectedModel === "screening" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      // Salvar parâmetros no sessionStorage para pre-preencher a página de screening
                      sessionStorage.setItem('screeningParams', JSON.stringify(params));
                      // Redirecionar para página de screening
                      window.location.href = '/screening-acoes';
                    }}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Editar Filtros
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateMode}
                  className="text-xs bg-white/70 hover:bg-white"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Gerar Novo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
       {/* Controls Card - só mostrar quando não estiver visualizando cache */}
      {!isViewingCached && (
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50 dark:from-background dark:to-background/80">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="space-y-8">
            {/* Model Selection */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Escolha sua estratégia</Label>
              
              {/* Available Models Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelChange(model.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                      selectedModel === model.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg"
                        : "border-border hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-background/50 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedModel === model.id 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600"
                      }`}>
                        {model.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{model.name}</span>
                          <Badge 
                            variant={model.free ? "secondary" : "default"}
                            className={`text-xs flex items-center gap-1 ${
                              model.free 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                : model.hot
                                ? "bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 dark:from-orange-900/50 dark:to-red-900/50 dark:text-orange-300 border border-orange-200 dark:border-orange-700"
                                : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                            }`}
                          >
                            {model.hot && <Flame className="w-3 h-3" />}
                            {model.badge}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {model.description}
                        </p>
                        {model.disclaimer && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                            {model.disclaimer}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Locked Models for Non-Premium Users */}
              {!isPremium && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 opacity-60">
                  {models.filter(model => !model.free).map((model) => (
                    <div
                      key={model.id}
                      className="relative p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="absolute top-3 right-3">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500">
                          {model.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-600 dark:text-gray-400">
                              {model.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {model.badge}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 leading-tight">
                            {model.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upgrade CTA */}
              {!isPremium && models.some(model => !model.free) && (
                <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600 shrink-0 mt-0.5 sm:mt-0" />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-xs sm:text-sm">Desbloqueie todos os modelos</h4>
                          <p className="text-xs text-muted-foreground">
                            Acesse Análise Preditiva com IA, Fundamentalista 3+1, Fluxo de Caixa Descontado, Value Investing, Fórmula Mágica, Dividend Yield Anti-Trap e Fórmula de Gordon
                          </p>
                        </div>
                      </div>
                      <Button size="sm" className="bg-gradient-to-r from-violet-600 to-pink-600 shrink-0 w-full sm:w-auto" asChild>
                        <Link href={isLoggedIn ? "/checkout" : "/register"} className="flex items-center justify-center gap-1">
                          <span>{isLoggedIn ? "Upgrade" : "Registrar"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Parameters Section - só mostrar quando não estiver visualizando cache */}
            {selectedModel && !isViewingCached && (
              <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/10 dark:to-violet-950/10 rounded-xl border">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-lg">Configure os parâmetros</h4>
                </div>
                
                {/* Nota sobre médias históricas */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                        📊 Análise com Médias Históricas
                      </p>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Todas as estratégias utilizam <strong>médias históricas de até 7 anos</strong> dos indicadores financeiros, 
                        proporcionando análises mais estáveis e confiáveis. Se não houver dados suficientes, 
                        usa-se o máximo de anos disponíveis.
                      </p>
                    </div>
                  </div>
                </div>
                
                {selectedModel === "graham" && (
                  <div className="space-y-4">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Margem de Segurança Mínima</Label>
                        <Badge variant="outline" className="font-mono">
                          {formatPercentage((params.marginOfSafety || 0) * 100)}
                        </Badge>
                      </div>
                      <Slider
                        value={[params.marginOfSafety ? params.marginOfSafety * 100 : 20]}
                        onValueChange={(value) => setParams({ ...params, marginOfSafety: value[0] / 100 })}
                        max={50}
                        min={5}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Conservador (5%)</span>
                        <span>Agressivo (50%)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Margem mínima entre o preço justo calculado e o preço atual da ação
                      </p>
                    </div>
                  </div>
                )}

                {selectedModel === "dividendYield" && (
                  <div className="space-y-4">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Dividend Yield Mínimo</Label>
                        <Badge variant="outline" className="font-mono">
                          {formatPercentage((params.minYield || 0) * 100)}
                        </Badge>
                      </div>
                      <Slider
                        value={[params.minYield ? params.minYield * 100 : 4]}
                        onValueChange={(value) => setParams({ ...params, minYield: value[0] / 100 })}
                        max={12}
                        min={2}
                        step={0.5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Baixo (2%)</span>
                        <span>Alto (12%)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Rendimento mínimo esperado em dividendos com filtros anti-armadilha
                      </p>
                    </div>
                  </div>
                )}

                {selectedModel === "lowPE" && (
                  <div className="space-y-4">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">P/L Máximo</Label>
                          <Badge variant="outline" className="font-mono">
                            {params.maxPE || 12}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.maxPE || 12]}
                          onValueChange={(value) => setParams({ ...params, maxPE: value[0] })}
                          max={20}
                          min={5}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>5</span>
                          <span>20</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">ROE Mínimo</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.minROE || 0) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.minROE ? params.minROE * 100 : 12]}
                          onValueChange={(value) => setParams({ ...params, minROE: value[0] / 100 })}
                          max={25}
                          min={5}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>5%</span>
                          <span>25%</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Combine múltiplos baixos com qualidade comprovada através do ROE
                    </p>
                  </div>
                )}

                {selectedModel === "magicFormula" && (
                  <div className="space-y-4">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Número de Resultados</Label>
                        <Badge variant="outline" className="font-mono">
                          {params.limit || 10} empresas
                        </Badge>
                      </div>
                      <Slider
                        value={[params.limit || 10]}
                        onValueChange={(value) => setParams({ ...params, limit: value[0] })}
                        max={20}
                        min={5}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Top 5</span>
                        <span>Top 20</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Estratégia de Joel Greenblatt: combina earnings yield alto com ROIC elevado
                      </p>
                    </div>
                  </div>
                )}

                {selectedModel === "fcd" && (
                  <div className="space-y-6">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    {/* Primeira linha - Taxa de Crescimento e Taxa de Desconto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Taxa de Crescimento Perpétuo</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.growthRate || 0.025) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.growthRate ? params.growthRate * 100 : 2.5]}
                          onValueChange={(value) => setParams({ ...params, growthRate: value[0] / 100 })}
                          max={5}
                          min={1}
                          step={0.1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1.0%</span>
                          <span>5.0%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Taxa de crescimento esperada para sempre após período de projeção
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Taxa de Desconto (WACC)</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.discountRate || 0.10) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.discountRate ? params.discountRate * 100 : 10]}
                          onValueChange={(value) => setParams({ ...params, discountRate: value[0] / 100 })}
                          max={18}
                          min={6}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>6.0%</span>
                          <span>18.0%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Custo médio ponderado de capital para descontar fluxos futuros
                        </p>
                      </div>
                    </div>

                    {/* Segunda linha - Anos de Projeção e Margem de Segurança */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Anos de Projeção</Label>
                          <Badge variant="outline" className="font-mono">
                            {params.yearsProjection || 5} anos
                          </Badge>
                        </div>
                        <Slider
                          value={[params.yearsProjection || 5]}
                          onValueChange={(value) => setParams({ ...params, yearsProjection: value[0] })}
                          max={10}
                          min={3}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>3 anos</span>
                          <span>10 anos</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Período de projeção explícita dos fluxos de caixa
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Margem de Segurança Mínima</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.minMarginOfSafety || 0.20) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.minMarginOfSafety ? params.minMarginOfSafety * 100 : 20]}
                          onValueChange={(value) => setParams({ ...params, minMarginOfSafety: value[0] / 100 })}
                          max={50}
                          min={5}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>5%</span>
                          <span>50%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Desconto mínimo exigido entre preço justo calculado e preço atual
                        </p>
                      </div>
                    </div>

                    {/* Terceira linha - Número de Resultados */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Número de Resultados</Label>
                        <Badge variant="outline" className="font-mono">
                          {params.limit || 10} empresas
                        </Badge>
                      </div>
                      <Slider
                        value={[params.limit || 10]}
                        onValueChange={(value) => setParams({ ...params, limit: value[0] })}
                        max={20}
                        min={5}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Top 5</span>
                        <span>Top 20</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Método sofisticado de DCF: projeta fluxos de caixa e calcula valor intrínseco
                      </p>
                    </div>
                  </div>
                )}

                {selectedModel === "gordon" && (
                  <div className="space-y-6">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    {/* Primeira linha - Taxa de Desconto e Taxa de Crescimento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Taxa de Desconto</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.discountRate || 0.12) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.discountRate ? params.discountRate * 100 : 12]}
                          onValueChange={(value) => setParams({ ...params, discountRate: value[0] / 100 })}
                          max={20}
                          min={8}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>8.0%</span>
                          <span>20.0%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Retorno esperado pelo investidor (taxa de desconto)
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Taxa de Crescimento dos Dividendos</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.dividendGrowthRate || 0.05) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.dividendGrowthRate ? params.dividendGrowthRate * 100 : 5]}
                          onValueChange={(value) => setParams({ ...params, dividendGrowthRate: value[0] / 100 })}
                          max={10}
                          min={0}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.0%</span>
                          <span>10.0%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Crescimento esperado dos dividendos ao longo do tempo
                        </p>
                      </div>
                    </div>

                    {/* Segunda linha - Controles de Ajuste Setorial */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Ajuste Setorial Automático</Label>
                          <Badge variant={params.useSectoralAdjustment !== false ? "default" : "outline"} className="text-xs">
                            {params.useSectoralAdjustment !== false ? "Ativado" : "Desativado"}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="sectoralAdjustment"
                            checked={params.useSectoralAdjustment !== false}
                            onChange={(e) => setParams({ ...params, useSectoralAdjustment: e.target.checked })}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor="sectoralAdjustment" className="text-sm text-muted-foreground">
                            Calibrar WACC e crescimento por setor
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ajusta automaticamente os parâmetros baseado no setor da empresa (Utilities: WACC menor, Tech: WACC maior)
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Ajuste Manual WACC</Label>
                          <Badge variant="outline" className="font-mono">
                            {params.sectoralWaccAdjustment ? 
                              `${params.sectoralWaccAdjustment > 0 ? '+' : ''}${formatPercentage(params.sectoralWaccAdjustment * 100)}` : 
                              '0.0%'
                            }
                          </Badge>
                        </div>
                        <Slider
                          value={[params.sectoralWaccAdjustment ? params.sectoralWaccAdjustment * 100 : 0]}
                          onValueChange={(value) => setParams({ ...params, sectoralWaccAdjustment: value[0] / 100 })}
                          max={5}
                          min={-2}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>-2.0%</span>
                          <span>+5.0%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ajuste adicional manual sobre o WACC setorial (positivo = mais conservador)
                        </p>
                      </div>
                    </div>

                    {/* Terceira linha - Número de Resultados */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Número de Resultados</Label>
                        <Badge variant="outline" className="font-mono">
                          {params.limit || 10} empresas
                        </Badge>
                      </div>
                      <Slider
                        value={[params.limit || 10]}
                        onValueChange={(value) => setParams({ ...params, limit: value[0] })}
                        max={20}
                        min={5}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Top 5</span>
                        <span>Top 20</span>
                      </div>
                        <p className="text-xs text-muted-foreground">
                          Fórmula de Gordon calibrada: avalia empresas com parâmetros ajustados por setor baseado em dados de mercado
                        </p>
                    </div>
                  </div>
                )}

                {/* Configuração Fundamentalista 3+1 */}
        {selectedModel === "fundamentalist" && (
          <div className="space-y-6">
            {/* Filtro de Tamanho */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
              <Select 
                value={params.companySize || 'all'} 
                onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tamanho das empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                  <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                  <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                  <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Filtre empresas por valor de mercado para focar em segmentos específicos
              </p>
            </div>

            {/* Análise Técnica */}
            <TechnicalAnalysisControl />

            {/* Primeira linha - ROE e ROIC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">ROE Mínimo (empresas sem dívida)</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.minROE || 0.15) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.minROE ? params.minROE * 100 : 15]}
                          onValueChange={(value) => setParams({ ...params, minROE: value[0] / 100 })}
                          max={25}
                          min={5}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>5%</span>
                          <span>25%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Retorno sobre patrimônio líquido mínimo para empresas sem dívida relevante
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">ROIC Mínimo (empresas com dívida)</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.minROIC || 0.15) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.minROIC ? params.minROIC * 100 : 15]}
                          onValueChange={(value) => setParams({ ...params, minROIC: value[0] / 100 })}
                          max={25}
                          min={5}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>5%</span>
                          <span>25%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Retorno sobre capital investido mínimo para empresas com dívida relevante
                        </p>
                      </div>
                    </div>

                    {/* Segunda linha - Endividamento e Payout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Dívida Líquida/EBITDA Máximo</Label>
                          <Badge variant="outline" className="font-mono">
                            {(params.maxDebtToEbitda || 3.0).toFixed(1)}x
                          </Badge>
                        </div>
                        <Slider
                          value={[params.maxDebtToEbitda ? params.maxDebtToEbitda * 10 : 30]}
                          onValueChange={(value) => setParams({ ...params, maxDebtToEbitda: value[0] / 10 })}
                          max={50}
                          min={10}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1.0x</span>
                          <span>5.0x</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Nível máximo de endividamento aceitável (anos para pagar dívida com EBITDA)
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Payout Mínimo (Dividendos)</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.minPayout || 0.40) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.minPayout ? params.minPayout * 100 : 40]}
                          onValueChange={(value) => setParams({ ...params, minPayout: value[0] / 100 })}
                          max={80}
                          min={20}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>20%</span>
                          <span>80%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Percentual mínimo do lucro distribuído como dividendos (análise bônus)
                        </p>
                      </div>
                    </div>

                    {/* Terceira linha - Número de Resultados */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Número de Resultados</Label>
                        <Badge variant="outline" className="font-mono">
                          {params.limit || 10} empresas
                        </Badge>
                      </div>
                      <Slider
                        value={[params.limit || 10]}
                        onValueChange={(value) => setParams({ ...params, limit: value[0] })}
                        max={20}
                        min={5}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Top 5</span>
                        <span>Top 20</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Estratégia 3+1: análise simplificada com indicadores essenciais adaptados ao perfil da empresa
                      </p>
                    </div>

                    {/* Explicação da Metodologia */}
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100">
                            📊 Metodologia Fundamentalista 3+1
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Esta estratégia <strong>adapta automaticamente</strong> a análise baseada no perfil da empresa:
                          </p>
                          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            <p>• <strong>Sem dívida</strong>: ROE + P/L vs Crescimento + Endividamento</p>
                            <p>• <strong>Com dívida</strong>: ROIC + EV/EBITDA + Endividamento</p>
                            <p>• <strong>Bancos/Seguradoras</strong>: ROE + P/L (endividamento não aplicável)</p>
                            <p>• <strong>Bônus</strong>: Análise de dividendos (Payout + DY)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Configuração AI */}
                {selectedModel === "ai" && (
                  <div className="space-y-6">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    {/* Primeira linha - Tolerância ao Risco e Horizonte */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Tolerância ao Risco</Label>
                        <select 
                          value={params.riskTolerance || "Moderado"}
                          onChange={(e) => setParams({ ...params, riskTolerance: e.target.value })}
                          className="w-full p-2 border rounded-md bg-background"
                        >
                          <option value="Conservador">Conservador</option>
                          <option value="Moderado">Moderado</option>
                          <option value="Agressivo">Agressivo</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Define o nível de risco aceitável para os investimentos
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Horizonte de Investimento</Label>
                        <select 
                          value={params.timeHorizon || "Longo Prazo"}
                          onChange={(e) => setParams({ ...params, timeHorizon: e.target.value })}
                          className="w-full p-2 border rounded-md bg-background"
                        >
                          <option value="Curto Prazo">Curto Prazo (1-2 anos)</option>
                          <option value="Médio Prazo">Médio Prazo (3-5 anos)</option>
                          <option value="Longo Prazo">Longo Prazo (5+ anos)</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          Período esperado para manter o investimento
                        </p>
                      </div>
                    </div>

                    {/* Segunda linha - Foco da Análise */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Foco da Análise</Label>
                      <select 
                        value={params.focus || "Crescimento e Valor"}
                        onChange={(e) => setParams({ ...params, focus: e.target.value })}
                        className="w-full p-2 border rounded-md bg-background"
                      >
                        <option value="Valor">Valor (Value Investing)</option>
                        <option value="Crescimento">Crescimento (Growth)</option>
                        <option value="Dividendos">Dividendos (Income)</option>
                        <option value="Crescimento e Valor">Crescimento e Valor (GARP)</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Estratégia de investimento preferida para a análise
                      </p>
                    </div>

                    {/* Terceira linha - Número de Resultados */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Número de Resultados</Label>
                        <Badge variant="outline" className="font-mono">
                          {params.limit || 10} empresas
                        </Badge>
                      </div>
                      <Slider
                        value={[params.limit || 10]}
                        onValueChange={(value) => setParams({ ...params, limit: value[0] })}
                        max={20}
                        min={5}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Top 5</span>
                        <span>Top 20</span>
                      </div>
                    </div>

                    {/* Disclaimer da IA */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100">
                            🤖 Análise com Inteligência Artificial
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Esta estratégia utiliza IA (Gemini) para analisar <strong>TODAS as 6 estratégias disponíveis</strong> 
                             e criar uma síntese preditiva inteligente. Os resultados podem variar ligeiramente entre execuções 
                            devido à natureza adaptativa do modelo de IA.
                          </p>
                          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            <p>• Analisa: Graham, Dividend Yield, Low P/E, Fórmula Mágica, FCD e Gordon</p>
                            <p>• Considera: Consistência entre estratégias, contexto macroeconômico</p>
                            <p>• Gera: Score preditivo, análise de riscos e oportunidades</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Configuração Barsi */}
                {selectedModel === "barsi" && (
                  <div className="space-y-6">
                    {/* Filtro de Tamanho */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filtro por Tamanho de Empresa</Label>
                      <Select 
                        value={params.companySize || 'all'} 
                        onValueChange={(value) => setParams({ ...params, companySize: value as 'all' | 'small_caps' | 'mid_caps' | 'blue_chips' })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o tamanho das empresas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏢 Todas as Empresas</SelectItem>
                          <SelectItem value="small_caps">🔹 Small Caps (&lt; R$ 2 bi)</SelectItem>
                          <SelectItem value="mid_caps">🔸 Empresas Médias (R$ 2-10 bi)</SelectItem>
                          <SelectItem value="blue_chips">🔷 Large Caps (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

                    {/* Análise Técnica */}
                    <TechnicalAnalysisControl />

                    {/* Primeira linha - Meta de DY e Multiplicador */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Meta de Dividend Yield</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.targetDividendYield || 0.06) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.targetDividendYield ? params.targetDividendYield * 100 : 6]}
                          onValueChange={(value) => setParams({ ...params, targetDividendYield: value[0] / 100 })}
                          max={12}
                          min={3}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>3%</span>
                          <span>12%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Meta de dividend yield para calcular o preço teto (conceito central do Barsi)
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Multiplicador do Preço Teto</Label>
                          <Badge variant="outline" className="font-mono">
                            {(params.maxPriceToPayMultiplier || 1.0).toFixed(1)}x
                          </Badge>
                        </div>
                        <Slider
                          value={[params.maxPriceToPayMultiplier ? params.maxPriceToPayMultiplier * 10 : 10]}
                          onValueChange={(value) => setParams({ ...params, maxPriceToPayMultiplier: value[0] / 10 })}
                          max={15}
                          min={8}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.8x</span>
                          <span>1.5x</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ajuste fino do preço teto (1.0x = exato, &lt;1.0x = mais conservador)
                        </p>
                      </div>
                    </div>

                    {/* Segunda linha - Critérios de Qualidade */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Anos Consecutivos Dividendos</Label>
                          <Badge variant="outline" className="font-mono">
                            {params.minConsecutiveDividends || 5} anos
                          </Badge>
                        </div>
                        <Slider
                          value={[params.minConsecutiveDividends || 5]}
                          onValueChange={(value) => setParams({ ...params, minConsecutiveDividends: value[0] })}
                          max={10}
                          min={3}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>3 anos</span>
                          <span>10 anos</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Histórico mínimo de pagamento consistente de dividendos
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Dívida/PL Máxima</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.maxDebtToEquity || 1.0) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.maxDebtToEquity ? params.maxDebtToEquity * 100 : 100]}
                          onValueChange={(value) => setParams({ ...params, maxDebtToEquity: value[0] / 100 })}
                          max={200}
                          min={50}
                          step={10}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>50%</span>
                          <span>200%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Nível máximo de endividamento aceitável (baixo endividamento é essencial)
                        </p>
                      </div>
                    </div>

                    {/* Terceira linha - ROE e Setores B.E.S.T. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">ROE Mínimo</Label>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage((params.minROE || 0.10) * 100)}
                          </Badge>
                        </div>
                        <Slider
                          value={[params.minROE ? params.minROE * 100 : 10]}
                          onValueChange={(value) => setParams({ ...params, minROE: value[0] / 100 })}
                          max={20}
                          min={5}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>5%</span>
                          <span>20%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Rentabilidade mínima sobre patrimônio líquido (lucro consistente)
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Focar Setores B.E.S.T.</Label>
                          <Badge variant={params.focusOnBEST !== false ? "default" : "outline"} className="text-xs">
                            {params.focusOnBEST !== false ? "Ativado" : "Desativado"}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="focusOnBEST"
                            checked={params.focusOnBEST !== false}
                            onChange={(e) => setParams({ ...params, focusOnBEST: e.target.checked })}
                            className="rounded border-gray-300 w-4 h-4"
                          />
                          <label htmlFor="focusOnBEST" className="text-sm text-muted-foreground cursor-pointer">
                            Apenas setores &quot;perenes&quot; (Bancos, Energia, Saneamento, Seguros, Telecom)
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Setores essenciais que as pessoas sempre precisarão (filosofia Barsi)
                        </p>
                      </div>
                    </div>

                    {/* Explicação da Metodologia */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-start space-x-3">
                        <DollarSign className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <h4 className="font-medium text-green-900 dark:text-green-100">
                            💰 Os 5 Passos do Método Barsi
                          </h4>
                          <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                            <p><strong>1. Setores Perenes:</strong> B.E.S.T. (Bancos, Energia, Saneamento, Seguros, Telecom)</p>
                            <p><strong>2. Qualidade:</strong> ROE alto, baixo endividamento, dividendos consistentes</p>
                            <p><strong>3. Preço Teto:</strong> Dividendo ÷ DY Meta = Preço máximo a pagar</p>
                            <p><strong>4. Disciplina:</strong> Aporte mensal, aproveitar crises</p>
                            <p><strong>5. Reinvestimento:</strong> 100% dos dividendos em mais ações (bola de neve)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Configuração Screening */}
                {selectedModel === "screening" && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <Search className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1 text-sm">
                            🎯 Screening Customizável
                          </h4>
                          <p className="text-xs text-blue-800 dark:text-blue-200">
                            Configure filtros personalizados por categoria. Apenas empresas que atendem <strong>TODOS</strong> os 
                            critérios selecionados serão exibidas. Deixe filtros desativados para não aplicar restrições.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Importar e usar o ScreeningConfigurator */}
                    <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700">
                      <Search className="w-12 h-12 mx-auto mb-3 text-blue-600" />
                      <h4 className="font-semibold text-lg mb-2">Screening Avançado Disponível!</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Para uma experiência completa de screening com todos os filtros organizados por categoria, 
                        acesse nossa página dedicada.
                      </p>
                      <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                        <Link href="/screening-acoes" className="flex items-center gap-2">
                          <Search className="w-5 h-5" />
                          Ir para Screening Completo
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                      <p className="text-xs text-muted-foreground mt-3">
                        💡 Dica: A página de screening oferece interface otimizada com 17 filtros customizáveis
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Generate Button - só mostrar quando não estiver visualizando cache E não for screening */}
            {!isViewingCached && selectedModel !== "screening" && (
              <div className="flex justify-center">
                <Button 
                  onClick={handleGenerateRanking} 
                  disabled={!selectedModel || loading}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 px-8 py-3 text-base font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analisando empresas...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Gerar Ranking Inteligente
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Modal de Processamento IA */}
      <Dialog open={showAIModal} onOpenChange={() => {}}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Brain className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Análise Preditiva com IA
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
            {/* Aviso de Tempo */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-3 sm:p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1 text-sm">
                    ⏱️ Processamento Avançado
                  </h4>
                  <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                    A análise preditiva com IA pode demorar <strong>alguns minutos</strong> para ser concluída. 
                    Estamos executando múltiplas estratégias e buscando dados atualizados na internet.
                  </p>
                </div>
              </div>
            </div>

            {/* Progresso das Etapas */}
            <div className="space-y-2 sm:space-y-4">
              {aiProcessingSteps.map((step, index) => {
                const isActive = index === aiProcessingStep
                const isCompleted = index < aiProcessingStep

                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg transition-all duration-500 ${
                      isActive 
                        ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-700"
                        : isCompleted
                        ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white animate-pulse"
                        : isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                    }`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : 
                        <div className="w-4 h-4 sm:w-5 sm:h-5">{step.icon}</div>
                      }
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium text-xs sm:text-sm mb-1 ${
                        isActive 
                          ? "text-blue-900 dark:text-blue-100"
                          : isCompleted
                          ? "text-green-900 dark:text-green-100"
                          : "text-gray-600 dark:text-gray-400"
                      }`}>
                        {step.title}
                        {isActive && (
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 inline ml-2 animate-spin" />
                        )}
                      </h4>
                      <p className={`text-xs leading-tight ${
                        isActive 
                          ? "text-blue-700 dark:text-blue-200"
                          : isCompleted
                          ? "text-green-700 dark:text-green-200"
                          : "text-gray-500 dark:text-gray-500"
                      }`}>
                        {step.description}
                      </p>
                    </div>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {isCompleted && (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                      )}
                      {isActive && (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Progresso Geral */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso Geral</span>
                <span className="font-medium">
                  {Math.round((aiProcessingStep / (aiProcessingSteps.length - 1)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${(aiProcessingStep / (aiProcessingSteps.length - 1)) * 100}%` 
                  }}
                />
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <p>🧠 <strong>IA Gemini</strong> com 2 chamadas otimizadas</p>
                <p>📊 <strong>7 estratégias</strong> nas {(params.limit || 10) + 10} empresas</p>
                <p>🌐 <strong>Dados em tempo real</strong> da internet</p>
                <p>⚡ <strong>Processamento batch</strong> otimizado</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Backtest em Lote */}
      {results && (
        <BatchBacktestSelector
          isOpen={showBatchBacktestModal}
          onClose={() => setShowBatchBacktestModal(false)}
          rankingResults={results.results}
          onConfigSelected={handleBatchBacktestConfigSelected}
        />
      )}
    </div>
    </>
  )
});

QuickRankerComponent.displayName = 'QuickRanker';

export const QuickRanker = QuickRankerComponent;
