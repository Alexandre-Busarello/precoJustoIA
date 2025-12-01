'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Lock, Loader2, Info, Target, Calculator, PieChart, BarChart3, DollarSign } from 'lucide-react'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useToast } from '@/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Link from 'next/link'

export type StrategySource = 'FIXED_RATE' | 'PORTFOLIO' | 'RANKING' | 'MANUAL_TICKERS'

// Estratégias disponíveis (exceto IA e Screening - que não retorna ranking específico)
const AVAILABLE_STRATEGIES = [
  { id: 'graham', name: 'Fórmula de Graham', icon: Target },
  { id: 'fundamentalist', name: 'Fundamentalista 3+1', icon: BarChart3 },
  { id: 'fcd', name: 'Fluxo de Caixa Descontado', icon: Calculator },
  { id: 'lowPE', name: 'Value Investing', icon: BarChart3 },
  { id: 'magicFormula', name: 'Fórmula Mágica', icon: PieChart },
  { id: 'barsi', name: 'Método Barsi', icon: DollarSign },
  { id: 'dividendYield', name: 'Dividend Yield Anti-Trap', icon: DollarSign },
  { id: 'gordon', name: 'Fórmula de Gordon', icon: DollarSign },
]

interface RentabilitySelectorProps {
  value: StrategySource
  manualRate?: number
  portfolioId?: string
  rankingId?: string
  manualTickers?: string[]
  onStrategyChange: (strategy: StrategySource) => void
  onManualRateChange: (rate: number) => void
  onPortfolioChange?: (portfolioId: string) => void
  onRankingChange?: (rankingId: string) => void
  onTickersChange?: (tickers: string[]) => void
  portfolios?: Array<{ id: string; name: string }>
  isLoadingPortfolios?: boolean
  errors?: Record<string, string>
}

export function RentabilitySelector({
  value,
  manualRate = 0.10,
  portfolioId,
  manualTickers = [],
  onStrategyChange,
  onManualRateChange,
  onPortfolioChange,
  onTickersChange,
  portfolios = [],
  isLoadingPortfolios = false,
  errors = {}
}: RentabilitySelectorProps) {
  const { isPremium } = usePremiumStatus()
  const { toast } = useToast()
  const [tickerInput, setTickerInput] = useState('')
  const [selectedStrategy, setSelectedStrategy] = useState<string>('')
  const [isExecutingStrategy, setIsExecutingStrategy] = useState(false)

  const handleTickerAdd = () => {
    const tickers = tickerInput.toUpperCase().trim().split(/[,\s]+/).filter(Boolean)
    if (tickers.length === 0) {
      toast({
        title: 'Erro',
        description: 'Digite pelo menos um ticker',
        variant: 'destructive'
      })
      return
    }
    
    const newTickers = [...new Set([...manualTickers, ...tickers])]
    onTickersChange?.(newTickers)
    setTickerInput('')
  }

  const handleTickerRemove = (ticker: string) => {
    onTickersChange?.(manualTickers.filter(t => t !== ticker))
  }

  const handleStrategyExecution = async (strategyId: string) => {
    if (!strategyId) return

    setIsExecutingStrategy(true)
    setSelectedStrategy(strategyId)

    try {
      // Executar estratégia via API
      const response = await fetch('/api/rank-builder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: strategyId,
          params: {
            limit: 20, // Pegar top 20 resultados
            companySize: 'all',
            useTechnicalAnalysis: false
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Extrair tickers dos resultados
      const tickers = (data.results || []).map((r: any) => r.ticker).filter(Boolean)
      
      if (tickers.length === 0) {
        toast({
          title: 'Aviso',
          description: 'A estratégia não retornou nenhum ticker válido.',
          variant: 'default'
        })
        return
      }

      // Atualizar tickers e mudar para modo MANUAL_TICKERS
      onTickersChange?.(tickers)
      onStrategyChange('MANUAL_TICKERS')

      toast({
        title: 'Estratégia executada',
        description: `${tickers.length} tickers encontrados e adicionados.`,
        variant: 'default'
      })
    } catch (err) {
      console.error('Erro ao executar estratégia:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível executar a estratégia. Tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setIsExecutingStrategy(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs value={value} onValueChange={(v) => onStrategyChange(v as StrategySource)}>
          <TooltipProvider>
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
              <TabsTrigger value="FIXED_RATE">Taxa Manual</TabsTrigger>
              {!isPremium ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <TabsTrigger 
                        value="PORTFOLIO" 
                        disabled={true}
                        className="w-full"
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        Carteira
                      </TabsTrigger>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Carteira - Premium</p>
                    <p className="text-sm mb-2">
                      Use sua carteira real para calcular rentabilidade automática baseada nos ativos que você já possui.
                    </p>
                    <Link href="/planos" className="text-primary hover:underline text-sm font-medium">
                      Ver planos Premium →
                    </Link>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <TabsTrigger value="PORTFOLIO">Carteira</TabsTrigger>
              )}
              {!isPremium ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <TabsTrigger 
                        value="RANKING"
                        disabled={true}
                        className="w-full"
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        Rankings
                      </TabsTrigger>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Rankings - Premium</p>
                    <p className="text-sm mb-2">
                      Selecione estratégias (Graham, Magic Formula, etc.) para calcular rentabilidade esperada dos melhores ativos da B3.
                    </p>
                    <Link href="/planos" className="text-primary hover:underline text-sm font-medium">
                      Ver planos Premium →
                    </Link>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <TabsTrigger value="RANKING">Rankings</TabsTrigger>
              )}
              {!isPremium ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <TabsTrigger 
                        value="MANUAL_TICKERS"
                        disabled={true}
                        className="w-full"
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        Tickers
                      </TabsTrigger>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Tickers Manuais - Premium</p>
                    <p className="text-sm mb-2">
                      Digite tickers específicos (ex: PETR4, VALE3) e calcule rentabilidade automática baseada em dados reais de dividendos e crescimento.
                    </p>
                    <Link href="/planos" className="text-primary hover:underline text-sm font-medium">
                      Ver planos Premium →
                    </Link>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <TabsTrigger value="MANUAL_TICKERS">Tickers</TabsTrigger>
              )}
            </TabsList>
          </TooltipProvider>

          <TabsContent value="FIXED_RATE" className="mt-4">
            <div className="space-y-2">
              <Label htmlFor="manualRate">Taxa de Rentabilidade Anual (%)</Label>
              <Input
                id="manualRate"
                type="number"
                step="0.1"
                value={(manualRate * 100) || ''}
                onChange={(e) => onManualRateChange((parseFloat(e.target.value) || 0) / 100)}
                placeholder="Ex: 12.5"
                className={errors.manualRate ? 'border-red-500' : ''}
              />
              {errors.manualRate && (
                <p className="text-sm text-red-500">{errors.manualRate}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Digite a taxa de rentabilidade anual esperada para seus investimentos
              </p>
            </div>
          </TabsContent>

          <TabsContent value="PORTFOLIO" className="mt-4">
            {!isPremium ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium mb-1">Use sua carteira para calcular rentabilidade automática</p>
                <p className="text-sm mb-4">Disponível apenas para Premium</p>
                <Link href="/planos">
                  <Button variant="default" size="sm">
                    Ver Planos Premium
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione sua Carteira</Label>
                  {isLoadingPortfolios ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando carteiras...
                    </div>
                  ) : portfolios.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Nenhuma carteira encontrada. Crie uma carteira primeiro.
                      </p>
                      <Link href="/carteira">
                        <Button variant="outline" size="sm">
                          Criar Carteira
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Select
                      value={portfolioId || ''}
                      onValueChange={(value) => onPortfolioChange?.(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma carteira" />
                      </SelectTrigger>
                      <SelectContent>
                        {portfolios.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Disclaimer */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                        Como a rentabilidade é calculada:
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                        O sistema usa o <strong>retorno anualizado</strong> das métricas da carteira quando disponível. 
                        Caso contrário, calcula uma <strong>média ponderada</strong> baseada em <strong>Dividend Yield + CAGR</strong> 
                        de cada ativo, limitado a 15% ao ano. A ponderação considera a alocação de cada ativo na carteira.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="RANKING" className="mt-4">
            {!isPremium ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium mb-1">Use rankings de estratégias para calcular rentabilidade</p>
                <p className="text-sm mb-4">Disponível apenas para Premium</p>
                <Link href="/planos">
                  <Button variant="default" size="sm">
                    Ver Planos Premium
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione uma Estratégia</Label>
                  <Select
                    value={selectedStrategy}
                    onValueChange={handleStrategyExecution}
                    disabled={isExecutingStrategy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma estratégia para executar" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_STRATEGIES.map((strategy) => {
                        const Icon = strategy.icon
                        return (
                          <SelectItem key={strategy.id} value={strategy.id}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              <span>{strategy.name}</span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    A estratégia será executada automaticamente e os tickers dos resultados serão usados para calcular a rentabilidade.
                  </p>
                </div>

                {isExecutingStrategy && (
                  <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Executando estratégia...
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Isso pode levar alguns segundos
                      </p>
                    </div>
                  </div>
                )}

                {manualTickers.length > 0 && selectedStrategy && (
                  <div className="space-y-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      ✓ Estratégia executada com sucesso
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {manualTickers.length} tickers encontrados: {manualTickers.slice(0, 5).join(', ')}
                      {manualTickers.length > 5 && ` e mais ${manualTickers.length - 5}...`}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Os tickers foram adicionados automaticamente. A simulação usará esses valores para calcular a rentabilidade.
                    </p>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                        Como a rentabilidade é calculada:
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                        O sistema executa a estratégia selecionada e extrai os tickers dos resultados. 
                        Em seguida, calcula a <strong>média</strong> de <strong>Dividend Yield + CAGR</strong> 
                        dos top 10-20 ativos encontrados, limitado a 20% ao ano. A rentabilidade reflete o potencial 
                        de retorno esperado dos ativos ranqueados pela estratégia.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="MANUAL_TICKERS" className="mt-4">
            {!isPremium ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium mb-1">Digite tickers para calcular rentabilidade automática</p>
                <p className="text-sm mb-4">Disponível apenas para Premium</p>
                <Link href="/planos">
                  <Button variant="default" size="sm">
                    Ver Planos Premium
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Adicionar Tickers</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value)}
                      placeholder="Ex: PETR4, VALE3, ITUB4"
                      onKeyPress={(e) => e.key === 'Enter' && handleTickerAdd()}
                    />
                    <Button onClick={handleTickerAdd}>Adicionar</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Digite os tickers separados por vírgula ou espaço
                  </p>
                </div>

                {manualTickers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Tickers Selecionados</Label>
                    <div className="flex flex-wrap gap-2">
                      {manualTickers.map((ticker) => (
                        <div
                          key={ticker}
                          className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md"
                        >
                          <span>{ticker}</span>
                          <button
                            onClick={() => handleTickerRemove(ticker)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                        Como a rentabilidade é calculada:
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                        O sistema calcula a <strong>média</strong> de <strong>Dividend Yield + CAGR</strong> 
                        de todos os tickers informados, limitado a 20% ao ano. A fórmula considera o Dividend Yield 
                        dos últimos 12 meses e o CAGR de crescimento dos lucros (5 anos ou disponível). 
                        Rentabilidade mínima garantida: 5% ao ano.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

