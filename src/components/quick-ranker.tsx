"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { MarkdownRenderer } from "@/components/markdown-renderer"
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
  RefreshCw
} from "lucide-react"
import Link from "next/link"

// Interfaces para tipagem
interface RankingParams {
  marginOfSafety?: number;
  minYield?: number;
  maxPE?: number;
  minROE?: number;
  limit?: number;
}

interface RankingResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
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
    id: "graham", 
    name: "Fórmula de Graham", 
    description: "Encontra ações baratas de empresas sólidas com filtros de qualidade",
    icon: <Target className="w-4 h-4" />,
    free: true,
    badge: "Gratuito"
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
    id: "lowPE", 
    name: "Value Investing", 
    description: "P/L baixo combinado com indicadores de qualidade comprovada",
    icon: <BarChart3 className="w-4 h-4" />,
    free: false,
    badge: "Premium"
  },
  { 
    id: "magicFormula", 
    name: "Fórmula Mágica", 
    description: "Combina qualidade operacional com preços atrativos (Greenblatt)",
    icon: <PieChart className="w-4 h-4" />,
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
  
  const isLoggedIn = !!session
  const isPremium = session?.user?.subscriptionTier === 'PREMIUM'
  
  // Filtrar modelos baseado no status do usuário
  const availableModels = models.filter(model => {
    if (!isLoggedIn) {
      return model.free // Usuários não logados só veem modelos gratuitos
    }
    if (!isPremium) {
      return model.free // Usuários gratuitos só veem modelos gratuitos
    }
    return true // Usuários premium veem todos
  })

  // Reset params quando trocar de modelo
  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    setResults(null)
    setError(null)
    
    // Definir parâmetros padrão para cada modelo
    switch (model) {
      case "graham":
        setParams({ marginOfSafety: 0.20 }) // 20%
        break
      case "dividendYield":
        setParams({ minYield: 0.04 }) // 4%
        break
      case "lowPE":
        setParams({ maxPE: 12, minROE: 0.12 }) // P/L <= 12, ROE >= 12%
        break
      case "magicFormula":
        setParams({ limit: 10 })
        break
      default:
        setParams({})
    }
  }

  const handleGenerateRanking = async () => {
    if (!selectedModel) return

    setLoading(true)
    setError(null)
    setIsViewingCached(false) // Resetar estado de cache ao gerar novo ranking
    setCachedInfo(null)

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
    } catch (err) {
      console.error("Erro ao gerar ranking:", err)
      setError("Erro ao gerar ranking. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  // Função para sair do modo de visualização cached e permitir nova geração
  const handleRegenerateMode = () => {
    setIsViewingCached(false)
    setCachedInfo(null)
    setResults(null)
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
• P/L entre 5-25 (evita preços artificiais ou empresas caras demais)
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
        <div className="space-y-6">
          {/* Results Header */}
          <Card className="border-0 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {isViewingCached ? "Ranking Salvo" : "Ranking Concluído"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {results.count} empresas encontradas que atendem aos critérios
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {results.results.length} resultados
                </Badge>
              </div>

              {/* Strategy Explanation */}
              <div className="bg-white/60 dark:bg-background/60 backdrop-blur-sm rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-blue-600" />
                  <h4 className="font-semibold text-sm">Estratégia Aplicada</h4>
                </div>
                <MarkdownRenderer content={results.rational} />
              </div>
            </CardContent>
          </Card>

          {/* Results List */}
          {results.results.length > 0 ? (
            <div className="grid gap-4">
              {results.results.map((result, index) => (
                <Link 
                  key={result.ticker} 
                  href={`/${result.ticker}`}
                  className="block group"
                >
                  <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02] bg-gradient-to-r from-white to-gray-50 dark:from-background dark:to-background/80">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold mb-1">
                              {result.ticker}
                            </h3>
                            <p className="text-muted-foreground mb-2 font-medium">
                              {result.name}
                            </p>
                            {result.sector && (
                              <Badge variant="outline" className="text-xs">
                                {result.sector}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold">
                              {formatCurrency(result.currentPrice)}
                            </span>
                          </div>
                          {result.upside !== null && (
                            <div className="flex items-center justify-end gap-1">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                +{formatPercentage(result.upside)} potencial
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Key Metrics */}
                      {result.key_metrics && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/10 dark:to-violet-950/10 rounded-lg">
                          {Object.entries(result.key_metrics)
                            .filter(([, value]) => value !== null && value !== undefined)
                            .slice(0, 4)
                            .map(([key, value]) => (
                              <div key={key} className="text-center">
                                <p className="text-xs text-muted-foreground capitalize mb-1">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </p>
                                <p className="font-semibold text-sm">
                                  {typeof value === 'number' && key.toLowerCase().includes('percentual') 
                                    ? formatPercentage(value)
                                    : typeof value === 'number' && (key.toLowerCase().includes('price') || key.toLowerCase().includes('valor'))
                                    ? formatCurrency(value)
                                    : value?.toString() || 'N/A'}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                      
                      {/* Individual Rational */}
                      <div className="border-t pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-3 h-3 text-blue-600" />
                          <h5 className="font-semibold text-xs text-blue-600">Análise Individual</h5>
                        </div>
                        <MarkdownRenderer content={result.rational} className="text-xs" />
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
        <CardContent className="p-8">
          <div className="space-y-8">
            {/* Model Selection */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Escolha sua estratégia</Label>
              
              {/* Available Models Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelChange(model.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                      selectedModel === model.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        : "border-border hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-background/50"
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
                            className={`text-xs ${model.free ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"}`}
                          >
                            {model.badge}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {model.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Locked Models for Non-Premium Users */}
              {!isPremium && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
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
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Crown className="w-5 h-5 text-violet-600" />
                        <div>
                          <h4 className="font-semibold text-sm">Desbloqueie todos os modelos</h4>
                          <p className="text-xs text-muted-foreground">
                            Acesse Dividend Yield, Value Investing e Fórmula Mágica
                          </p>
                        </div>
                      </div>
                      <Button size="sm" className="bg-gradient-to-r from-violet-600 to-pink-600" asChild>
                        <Link href={isLoggedIn ? "/upgrade" : "/register"} className="flex items-center gap-1">
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
              <div className="space-y-6 p-6 bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/10 dark:to-violet-950/10 rounded-xl border">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-lg">Configure os parâmetros</h4>
                </div>
                
                {selectedModel === "graham" && (
                  <div className="space-y-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  )
}
