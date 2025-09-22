"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSession } from "next-auth/react"
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
  Flame
} from "lucide-react"
import Link from "next/link"

// Interfaces para tipagem
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
    description: "Encontra ações baratas de empresas sólidas com filtros de qualidade",
    icon: <Target className="w-4 h-4" />,
    free: true,
    badge: "Gratuito"
  },
  { 
    id: "fundamentalist", 
    name: "Fundamentalista 3+1", 
    description: "Análise simplificada com 3 indicadores essenciais + bônus dividendos",
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
    description: "P/L baixo combinado com indicadores de qualidade comprovada",
    icon: <BarChart3 className="w-4 h-4" />,
    free: false,
    badge: "HOT",
    hot: true
  },
  { 
    id: "magicFormula", 
    name: "Fórmula Mágica", 
    description: "Combina qualidade operacional com preços atrativos (Greenblatt)",
    icon: <PieChart className="w-4 h-4" />,
    free: false,
    badge: "Premium"
  },
  { 
    id: "dividendYield", 
    name: "Dividend Yield Anti-Trap", 
    description: "Renda passiva sustentável com filtros que evitam armadilhas",
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

export function QuickRanker() {
  const { data: session } = useSession()
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [params, setParams] = useState<RankingParams>({})
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<RankingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isViewingCached, setIsViewingCached] = useState(false) // Estado para resultados em cache
  const [cachedInfo, setCachedInfo] = useState<{resultCount: number, createdAt: string} | null>(null)
  const [showAIModal, setShowAIModal] = useState(false) // Modal de processamento IA
  const [aiProcessingStep, setAiProcessingStep] = useState(0) // Etapa atual do processamento
  const [isResultsExpanded, setIsResultsExpanded] = useState(false) // Estado do collapsible dos resultados
  const resultsRef = useRef<HTMLDivElement>(null)

  // Verificar se há parâmetros E resultados para mostrar do histórico
  useEffect(() => {
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
  }, [])

  // Scroll automático para os resultados quando forem carregados
  useEffect(() => {
    if (results && results.results.length > 0 && !isViewingCached && resultsRef.current) {
      // Pequeno delay para garantir que o DOM foi atualizado
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 100)
    }
  }, [results, isViewingCached])
  
  const isLoggedIn = !!session
  const isPremium = session?.user?.subscriptionTier === 'PREMIUM'
  
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
    
    // Definir parâmetros padrão para cada modelo
    switch (model) {
      case "graham":
        setParams({ 
          marginOfSafety: 0.20,     // 20%
          companySize: 'all'        // Todas as empresas
        })
        break
      case "dividendYield":
        setParams({ 
          minYield: 0.04,           // 4%
          companySize: 'all'        // Todas as empresas
        })
        break
      case "lowPE":
        setParams({ 
          maxPE: 12, 
          minROE: 0.12,             // P/L <= 12, ROE >= 12%
          companySize: 'all'        // Todas as empresas
        })
        break
      case "magicFormula":
        setParams({ 
          limit: 10,                // 10 resultados
          companySize: 'all'        // Todas as empresas
        })
        break
      case "fcd":
        setParams({ 
          growthRate: 0.025,        // 2.5% crescimento perpétuo
          discountRate: 0.10,       // 10% WACC
          yearsProjection: 5,       // 5 anos de projeção
          minMarginOfSafety: 0.15,  // 15% margem de segurança
          limit: 10,                // 10 resultados
          companySize: 'all'        // Todas as empresas
        })
        break
      case "gordon":
        setParams({ 
          discountRate: 0.11,       // 11% taxa de desconto base
          dividendGrowthRate: 0.04, // 4% crescimento base dos dividendos
          useSectoralAdjustment: true, // Ativar ajuste setorial
          sectoralWaccAdjustment: 0,   // Sem ajuste manual adicional
          limit: 10,                // 10 resultados
          companySize: 'all'        // Todas as empresas
        })
        break
        case "fundamentalist":
          setParams({
            minROE: 0.15,             // 15% ROE mínimo
            minROIC: 0.15,            // 15% ROIC mínimo
            maxDebtToEbitda: 3.0,     // 3x máximo dívida/EBITDA
            minPayout: 0.40,          // 40% payout mínimo
            maxPayout: 0.80,          // 80% payout máximo
            companySize: 'all',       // Todas as empresas
            limit: 10                 // 10 resultados
          })
          break
      case "ai":
        setParams({ 
          riskTolerance: "Moderado",           // Tolerância ao risco
          timeHorizon: "Longo Prazo",          // Horizonte de investimento
          focus: "Crescimento e Valor",        // Foco da análise
          limit: 10,                           // 10 resultados
          companySize: 'all'                   // Todas as empresas
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
          params,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: RankingResponse = await response.json()
      setResults(data)
      setIsResultsExpanded(true) // Expandir automaticamente quando novos resultados são gerados
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

**Ordenação**: Por Score de Qualidade (combina solidez financeira + margem de segurança).

**Objetivo**: Encontrar empresas subvalorizadas MAS financeiramente saudáveis, evitando "value traps".`;

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

**Ordenação**: Por Score de Sustentabilidade (combina DY + saúde financeira).

**Objetivo**: Renda passiva de qualidade, não armadilhas disfarçadas.`;

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

      default:
        return `📊 **ESTRATÉGIA PERSONALIZADA**

Análise baseada nos critérios selecionados com foco em encontrar oportunidades de investimento de qualidade.`;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
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
          Use modelos de valuation consagrados com filtros anti-armadilha para descobrir ações subvalorizadas
        </p>
      </div>
      

      {/* Results - prioridade quando cached */}
      {results && (
        <div ref={resultsRef} className="space-y-6">
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

          {/* Results List - Sempre Visível */}

          {/* Results List */}
          {results.results.length > 0 ? (
            <div className="grid gap-3 sm:gap-4">
              {results.results.map((result, index) => (
                <Link 
                  key={result.ticker} 
                  href={`/acao/${result.ticker}`}
                  className="block group"
                >
                  <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02] bg-gradient-to-r from-white to-gray-50 dark:from-background dark:to-background/80">
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
                          <div className="flex items-center justify-end gap-2 mb-2">
                            <span className="text-xl sm:text-2xl font-bold">
                              {formatCurrency(result.currentPrice)}
                            </span>
                          </div>
                          {result.upside !== null && (
                            <div className="flex items-center justify-end gap-1">
                              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                              <span className="text-xs sm:text-sm font-medium text-green-600">
                                +{formatPercentage(result.upside)} potencial
                              </span>
                            </div>
                          )}
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
                      <div className="border-t pt-3 sm:pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-3 h-3 text-blue-600" />
                          <h5 className="font-semibold text-xs text-blue-600">Análise Individual</h5>
                        </div>
                        <MarkdownRenderer content={result.rational} className="text-xs leading-relaxed" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
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
                          <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

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
                          <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

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
                          <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

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
                          <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

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
                          <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

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
                          <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

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
                  <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Filtre empresas por valor de mercado para focar em segmentos específicos
              </p>
            </div>

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
                          <SelectItem value="blue_chips">🔷 Blue Chips (&gt; R$ 10 bi)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Filtre empresas por valor de mercado para focar em segmentos específicos
                      </p>
                    </div>

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
              </div>
            )}

            {/* Generate Button - só mostrar quando não estiver visualizando cache */}
            {!isViewingCached && (
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
    </div>
  )
}
