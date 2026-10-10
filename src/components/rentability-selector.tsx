'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, Info, Loader2, Lock, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useToast } from '@/hooks/use-toast'
import { formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'

export type StrategySource = 'FIXED_RATE' | 'PORTFOLIO' | 'RANKING' | 'MANUAL_TICKERS'

// Estratégias disponíveis (exceto IA e Screening, que não retornam um ranking específico)
const AVAILABLE_STRATEGIES = [
  { id: 'graham', name: 'Fórmula de Graham' },
  { id: 'fundamentalist', name: 'Fundamentalista 3+1' },
  { id: 'fcd', name: 'Fluxo de Caixa Descontado' },
  { id: 'lowPE', name: 'P/L baixo com qualidade' },
  { id: 'magicFormula', name: 'Fórmula Mágica' },
  { id: 'barsi', name: 'Método Barsi' },
  { id: 'dividendYield', name: 'Anti-armadilha de dividendos' },
  { id: 'gordon', name: 'Fórmula de Gordon' },
]

const PREMIUM_TABS: Array<{ value: Exclude<StrategySource, 'FIXED_RATE'>; label: string; title: string; description: string }> = [
  {
    value: 'PORTFOLIO',
    label: 'Carteira',
    title: 'Carteira (Premium)',
    description: 'Use sua carteira para calcular a rentabilidade a partir dos ativos que você já possui.',
  },
  {
    value: 'RANKING',
    label: 'Rankings',
    title: 'Rankings (Premium)',
    description: 'Escolha um modelo (Graham, Fórmula Mágica etc.) e use os ativos ranqueados para estimar a rentabilidade.',
  },
  {
    value: 'MANUAL_TICKERS',
    label: 'Tickers',
    title: 'Tickers (Premium)',
    description: 'Digite tickers (ex.: PETR4, VALE3) e estime a rentabilidade com dados de dividendos e crescimento.',
  },
]

/** Abas com alvo de toque de 44 px em telas de toque. */
const TAB_TRIGGER_CLASS = 'pointer-coarse:min-h-11'

const FLOOR_NOTE = 'Piso de simulação: 5% a.a. (hipótese, não garantia).'

interface RentabilitySelectorProps {
  value: StrategySource
  manualRate?: number
  portfolioId?: string
  rankingId?: string
  manualTickers?: string[]
  /** CDI líquido de IR (fração a.a.), alternativa sem risco para comparação. Ver `getCdiNetRate` em rentability-service. */
  cdiNetRate?: number | null
  onStrategyChange: (strategy: StrategySource) => void
  onManualRateChange: (rate: number) => void
  onPortfolioChange?: (portfolioId: string) => void
  onRankingChange?: (rankingId: string) => void
  onTickersChange?: (tickers: string[]) => void
  portfolios?: Array<{ id: string; name: string }>
  isLoadingPortfolios?: boolean
  errors?: Record<string, string>
}

function MethodNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <div className="space-y-1 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">Como a rentabilidade é calculada</p>
        {children}
      </div>
    </div>
  )
}

function PremiumLocked({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
      <Lock className="size-5" strokeWidth={1.75} aria-hidden />
      <p className="font-medium text-foreground">{message}</p>
      <p className="text-sm">Disponível no plano Premium</p>
      <Button asChild size="sm" className="mt-2">
        <Link href="/planos">Ver planos Premium</Link>
      </Button>
    </div>
  )
}

export function RentabilitySelector({
  value,
  manualRate = 0.10,
  portfolioId,
  manualTickers = [],
  cdiNetRate,
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
  const hasCdiNet = typeof cdiNetRate === 'number' && Number.isFinite(cdiNetRate) && cdiNetRate > 0

  const handleTickerAdd = () => {
    const tickers = tickerInput.toUpperCase().trim().split(/[,\s]+/).filter(Boolean)
    if (tickers.length === 0) {
      toast({
        title: 'Nenhum ticker informado',
        description: 'Digite pelo menos um ticker.',
        variant: 'destructive'
      })
      return
    }

    onTickersChange?.([...new Set([...manualTickers, ...tickers])])
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
      const response = await fetch('/api/rank-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: strategyId,
          params: {
            limit: 20,
            companySize: 'all',
            useTechnicalAnalysis: false
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const tickers = (data.results || []).map((r: { ticker?: string }) => r.ticker).filter(Boolean) as string[]

      if (tickers.length === 0) {
        toast({
          title: 'Nenhum ticker encontrado',
          description: 'O modelo não retornou tickers válidos.',
        })
        return
      }

      // Os tickers do ranking passam a alimentar o modo de tickers manuais.
      onTickersChange?.(tickers)
      onStrategyChange('MANUAL_TICKERS')

      toast({
        title: 'Modelo executado',
        description: `${tickers.length} tickers encontrados e adicionados.`,
      })
    } catch (err) {
      console.error('Erro ao executar estratégia:', err)
      toast({
        title: 'Não foi possível executar o modelo',
        description: 'Tente novamente em instantes.',
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
              <TabsTrigger value="FIXED_RATE" className={TAB_TRIGGER_CLASS}>
                Taxa manual
              </TabsTrigger>
              {PREMIUM_TABS.map((tab) =>
                isPremium ? (
                  <TabsTrigger key={tab.value} value={tab.value} className={TAB_TRIGGER_CLASS}>
                    {tab.label}
                  </TabsTrigger>
                ) : (
                  <Tooltip key={tab.value}>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <TabsTrigger value={tab.value} disabled className={cn(TAB_TRIGGER_CLASS, 'w-full')}>
                          <Lock className="size-4" strokeWidth={1.75} aria-hidden />
                          {tab.label}
                        </TabsTrigger>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="mb-1 font-medium">{tab.title}</p>
                      <p className="mb-2 text-sm">{tab.description}</p>
                      <Link href="/planos" className="text-sm font-medium underline underline-offset-4">
                        Ver planos Premium
                      </Link>
                    </TooltipContent>
                  </Tooltip>
                )
              )}
            </TabsList>
          </TooltipProvider>

          <TabsContent value="FIXED_RATE" className="mt-4">
            <div className="space-y-2">
              <Label htmlFor="manualRate">Taxa de rentabilidade anual (%)</Label>
              <Input
                id="manualRate"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={(manualRate * 100) || ''}
                onChange={(e) => onManualRateChange((parseFloat(e.target.value) || 0) / 100)}
                placeholder="Ex.: 12,5"
                aria-invalid={errors.manualRate ? true : undefined}
              />
              {errors.manualRate && (
                <p className="text-sm text-negative">{errors.manualRate}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Digite a taxa de rentabilidade anual esperada para seus investimentos.
              </p>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">
                  Alternativa sem risco para comparar: <span className="font-medium text-foreground">CDI líquido</span>{' '}
                  (CDI com IR de 15%, aplicações acima de 2 anos)
                  {hasCdiNet && (
                    <>
                      {' '}de <span className="tabular-nums text-foreground">{formatPct(cdiNetRate)}</span> a.a.
                    </>
                  )}
                  .
                </p>
                {hasCdiNet && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0 md:min-h-8"
                    onClick={() => onManualRateChange(Math.round(cdiNetRate * 10000) / 10000)}
                  >
                    Usar CDI líquido
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="PORTFOLIO" className="mt-4">
            {!isPremium ? (
              <PremiumLocked message="Use sua carteira para calcular a rentabilidade automaticamente" />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione sua carteira</Label>
                  {isLoadingPortfolios ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />
                      Carregando carteiras...
                    </div>
                  ) : portfolios.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Nenhuma carteira encontrada. Crie uma carteira primeiro.
                      </p>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/carteira">Criar carteira</Link>
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={portfolioId || ''}
                      onValueChange={(selected) => onPortfolioChange?.(selected)}
                    >
                      <SelectTrigger className="w-full">
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

                <MethodNote>
                  <p>
                    Usa o retorno anualizado das métricas da carteira quando disponível. Caso contrário, calcula uma
                    média ponderada de dividend yield + CAGR de lucros de cada ativo, limitada a 15% a.a. e ponderada
                    pela alocação de cada ativo.
                  </p>
                  <p>{FLOOR_NOTE}</p>
                </MethodNote>
              </div>
            )}
          </TabsContent>

          <TabsContent value="RANKING" className="mt-4">
            {!isPremium ? (
              <PremiumLocked message="Use rankings de modelos para calcular a rentabilidade" />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione um modelo</Label>
                  <Select
                    value={selectedStrategy}
                    onValueChange={handleStrategyExecution}
                    disabled={isExecutingStrategy}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escolha um modelo para executar" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_STRATEGIES.map((strategy) => (
                        <SelectItem key={strategy.id} value={strategy.id}>
                          {strategy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    O modelo é executado automaticamente e os tickers do resultado são usados para calcular a rentabilidade.
                  </p>
                </div>

                {isExecutingStrategy && (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-foreground">Executando o modelo...</p>
                      <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos.</p>
                    </div>
                  </div>
                )}

                {manualTickers.length > 0 && selectedStrategy && (
                  <div className="space-y-1 rounded-lg border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Check className="size-4 text-positive" strokeWidth={1.75} aria-hidden />
                      Modelo executado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {manualTickers.length} tickers encontrados: {manualTickers.slice(0, 5).join(', ')}
                      {manualTickers.length > 5 && ` e mais ${manualTickers.length - 5}`}.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Os tickers foram adicionados e serão usados na simulação.
                    </p>
                  </div>
                )}

                <MethodNote>
                  <p>
                    Executa o modelo escolhido, extrai os tickers do resultado e calcula a média de dividend yield +
                    CAGR de lucros dos 10 primeiros ativos, limitada a 20% a.a. É uma hipótese de retorno, não uma
                    promessa.
                  </p>
                  <p>{FLOOR_NOTE}</p>
                </MethodNote>
              </div>
            )}
          </TabsContent>

          <TabsContent value="MANUAL_TICKERS" className="mt-4">
            {!isPremium ? (
              <PremiumLocked message="Digite tickers para calcular a rentabilidade automaticamente" />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rentability-tickers">Adicionar tickers</Label>
                  <div className="flex gap-2">
                    <Input
                      id="rentability-tickers"
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value)}
                      placeholder="Ex.: PETR4, VALE3, ITUB4"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleTickerAdd()
                        }
                      }}
                    />
                    <Button type="button" onClick={handleTickerAdd}>Adicionar</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Separe os tickers por vírgula ou espaço.
                  </p>
                </div>

                {manualTickers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Tickers selecionados</Label>
                    <div className="flex flex-wrap gap-2">
                      {manualTickers.map((ticker) => (
                        <div
                          key={ticker}
                          className="flex items-center gap-1 rounded-md bg-secondary py-1 pl-2 text-sm"
                        >
                          <span>{ticker}</span>
                          <button
                            type="button"
                            onClick={() => handleTickerRemove(ticker)}
                            aria-label={`Remover ${ticker}`}
                            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:size-7"
                          >
                            <X className="size-4" strokeWidth={1.75} aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <MethodNote>
                  <p>
                    Calcula a média de dividend yield (12 meses) + CAGR de lucros (5 anos ou o disponível) dos
                    tickers informados, limitada a 20% a.a.
                  </p>
                  <p>{FLOOR_NOTE}</p>
                </MethodNote>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
