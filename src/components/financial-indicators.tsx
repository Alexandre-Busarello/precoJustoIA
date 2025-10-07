'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isFinancialSector } from '@/lib/financial-data-service'
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Percent,
  DollarSign,
  Target,
  BarChart3,
  Activity,
  PieChart,
  LineChart,
  Info
} from 'lucide-react'

// Tipo para valores do Prisma que podem ser Decimal
type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

// Base de dados com informações dos indicadores
const indicatorInfo: Record<string, {
  name: string;
  description: string;
  goodRange: string;
  interpretation: string;
  unit: string;
}> = {
  'P/L': {
    name: 'P/L (Preço/Lucro)',
    description: 'Indica quantos anos seriam necessários para recuperar o investimento com base no lucro atual da empresa.',
    goodRange: 'Entre 8 e 15 (ideal < 12)',
    interpretation: 'Valores baixos podem indicar empresa subvalorizada. Valores muito altos podem indicar supervalorização.',
    unit: 'x'
  },
  'P/VP': {
    name: 'P/VP (Preço/Valor Patrimonial)',
    description: 'Compara o preço da ação com o valor patrimonial por ação da empresa.',
    goodRange: 'Entre 0,8 e 2,0 (ideal < 1,5)',
    interpretation: 'Valores abaixo de 1 podem indicar empresa subvalorizada. Acima de 3 pode ser supervalorização.',
    unit: 'x'
  },
  'Dividend Yield': {
    name: 'Dividend Yield',
    description: 'Percentual de dividendos pagos em relação ao preço atual da ação.',
    goodRange: 'Acima de 4% (ideal > 6%)',
    interpretation: 'Indica o retorno em dividendos. Valores muito altos podem indicar empresa em dificuldades.',
    unit: '%'
  },
  'ROE': {
    name: 'ROE (Return on Equity)',
    description: 'Mede a capacidade da empresa de gerar lucro com o capital dos acionistas.',
    goodRange: 'Acima de 15% (ideal > 20%)',
    interpretation: 'Indica eficiência na geração de lucro. Valores consistentemente altos são desejáveis.',
    unit: '%'
  },
  'ROIC': {
    name: 'ROIC (Return on Invested Capital)',
    description: 'Mede o retorno sobre o capital total investido na empresa.',
    goodRange: 'Acima de 12% (ideal > 15%)',
    interpretation: 'Indica eficiência no uso do capital. Deve ser superior ao custo de capital.',
    unit: '%'
  },
  'ROA': {
    name: 'ROA (Return on Assets)',
    description: 'Mede a eficiência da empresa em gerar lucro com seus ativos.',
    goodRange: 'Acima de 8% (ideal > 12%)',
    interpretation: 'Indica quão bem a empresa utiliza seus ativos para gerar lucro.',
    unit: '%'
  },
  'Margem Líquida': {
    name: 'Margem Líquida',
    description: 'Percentual do lucro líquido em relação à receita total.',
    goodRange: 'Acima de 10% (ideal > 15%)',
    interpretation: 'Indica eficiência operacional. Margens altas sugerem boa gestão de custos.',
    unit: '%'
  },
  'Margem EBITDA': {
    name: 'Margem EBITDA',
    description: 'Percentual do EBITDA em relação à receita, mostra geração de caixa operacional.',
    goodRange: 'Acima de 15% (ideal > 25%)',
    interpretation: 'Indica capacidade de geração de caixa antes de juros, impostos e depreciação.',
    unit: '%'
  },
  'Dívida Líq./PL': {
    name: 'Dívida Líquida/Patrimônio Líquido',
    description: 'Relaciona o endividamento líquido com o patrimônio dos acionistas.',
    goodRange: 'Abaixo de 0,5 (ideal < 0,3)',
    interpretation: 'Indica alavancagem. Valores altos podem representar risco financeiro.',
    unit: 'x'
  },
  'Liquidez Corrente': {
    name: 'Liquidez Corrente',
    description: 'Capacidade de pagamento das obrigações de curto prazo.',
    goodRange: 'Entre 1,2 e 2,0 (ideal > 1,5)',
    interpretation: 'Valores abaixo de 1 indicam dificuldade de pagamento. Muito alto pode indicar ineficiência.',
    unit: 'x'
  },
  'Dív. Líq./EBITDA': {
    name: 'Dívida Líquida/EBITDA',
    description: 'Indica quantos anos seriam necessários para quitar a dívida líquida com a geração de caixa atual.',
    goodRange: 'Abaixo de 3,0 (ideal < 2,0)',
    interpretation: 'Valores altos indicam maior risco financeiro. Acima de 4 pode ser preocupante.',
    unit: 'x'
  },
  'EV/EBITDA': {
    name: 'EV/EBITDA',
    description: 'Relaciona o valor da empresa (Enterprise Value) com sua geração de caixa operacional (EBITDA).',
    goodRange: 'Entre 6 e 12 (ideal < 10)',
    interpretation: 'Múltiplo usado para comparar empresas. Valores baixos podem indicar oportunidade de investimento.',
    unit: 'x'
  },
  'LPA': {
    name: 'LPA (Lucro por Ação)',
    description: 'Representa o lucro líquido da empresa dividido pelo número total de ações em circulação.',
    goodRange: 'Crescimento consistente (ideal > R$ 1,00)',
    interpretation: 'Valores crescentes indicam melhoria na rentabilidade. Compare com anos anteriores.',
    unit: 'R$'
  },
  'VPA': {
    name: 'VPA (Valor Patrimonial por Ação)',
    description: 'Representa o patrimônio líquido da empresa dividido pelo número de ações em circulação.',
    goodRange: 'Crescimento consistente (ideal > R$ 10,00)',
    interpretation: 'Indica o valor contábil de cada ação. Crescimento constante é positivo.',
    unit: 'R$'
  },
  'Receita Total': {
    name: 'Receita Total',
    description: 'Valor total das vendas e serviços prestados pela empresa em um período.',
    goodRange: 'Crescimento consistente (ideal > 10% a.a.)',
    interpretation: 'Crescimento sustentado indica expansão dos negócios e competitividade no mercado.',
    unit: 'R$'
  },
  'Passivo/Ativos': {
    name: 'Passivo/Ativos',
    description: 'Percentual dos ativos da empresa que são financiados por dívidas e obrigações.',
    goodRange: 'Abaixo de 60% (ideal < 50%)',
    interpretation: 'Valores altos indicam maior dependência de financiamento externo e risco financeiro.',
    unit: '%'
  },
  'CAGR Lucros 5a': {
    name: 'CAGR Lucros 5 Anos',
    description: 'Taxa de crescimento anual composta dos lucros nos últimos 5 anos.',
    goodRange: 'Acima de 10% (ideal > 15%)',
    interpretation: 'Indica crescimento consistente dos lucros. Valores positivos mostram expansão sustentável.',
    unit: '%'
  },
  'CAGR Receitas 5a': {
    name: 'CAGR Receitas 5 Anos',
    description: 'Taxa de crescimento anual composta das receitas nos últimos 5 anos.',
    goodRange: 'Acima de 8% (ideal > 12%)',
    interpretation: 'Mostra expansão do negócio. Crescimento consistente indica competitividade no mercado.',
    unit: '%'
  },
  'Crescimento Lucros': {
    name: 'Crescimento de Lucros',
    description: 'Variação percentual dos lucros em relação ao ano anterior.',
    goodRange: 'Acima de 5% (ideal > 10%)',
    interpretation: 'Crescimento positivo indica melhoria na rentabilidade. Valores negativos podem ser temporários.',
    unit: '%'
  },
  'Crescimento Receitas': {
    name: 'Crescimento de Receitas',
    description: 'Variação percentual das receitas em relação ao ano anterior.',
    goodRange: 'Acima de 5% (ideal > 10%)',
    interpretation: 'Indica expansão dos negócios. Crescimento sustentado é sinal de competitividade.',
    unit: '%'
  }
};

// Função para obter informações do indicador
function getIndicatorDetails(title: string) {
  return indicatorInfo[title] || {
    name: title,
    description: 'Indicador financeiro importante para análise.',
    goodRange: 'Varia conforme setor',
    interpretation: 'Consulte um analista para interpretação específica.',
    unit: ''
  };
}

// Função para converter Decimal para number
function toNumber(value: PrismaDecimal | Date | string | null): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }
  return parseFloat(String(value))
}


// Funções de formatação
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatPercent(value: PrismaDecimal | Date | string | null): string {
  const numValue = toNumber(value)
  if (numValue === null || numValue === undefined) return 'N/A'
  return `${(numValue * 100).toFixed(2)}%`
}

function formatLargeNumber(value: number | null): string {
  if (value === null || value === undefined) return 'N/A'
  
  if (value >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(2)}K`
  }
  return formatCurrency(value)
}

// Função helper para determinar tipo de indicador
function getIndicatorType(value: number | null, positiveThreshold?: number, negativeThreshold?: number): 'positive' | 'negative' | 'neutral' | 'default' {
  if (value === null) return 'default'
  
  if (positiveThreshold !== undefined && value >= positiveThreshold) return 'positive'
  if (negativeThreshold !== undefined && value <= negativeThreshold) return 'positive'
  if (positiveThreshold !== undefined && value < positiveThreshold) return 'negative'
  if (negativeThreshold !== undefined && value > negativeThreshold) return 'negative'
  
  return 'neutral'
}

// Componente de modal para informações do indicador
function IndicatorInfoModal({ 
  isOpen, 
  onClose, 
  indicatorTitle 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  indicatorTitle: string 
}) {
  const info = getIndicatorDetails(indicatorTitle);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            {info.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">O que é?</h4>
            <p className="text-sm">{info.description}</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Faixa Ideal</h4>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {info.goodRange}
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Interpretação</h4>
            <p className="text-sm text-muted-foreground">{info.interpretation}</p>
          </div>
          
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Dica:</strong> Compare sempre com empresas do mesmo setor e considere o contexto econômico atual.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente para indicador com ícone
function IndicatorCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  type = 'default',
  onChartClick,
  onInfoClick
}: {
  title: string
  value: string | number
   
  icon: any
  description?: string
  type?: 'positive' | 'negative' | 'neutral' | 'default'
  onChartClick?: (title: string) => void
  onInfoClick?: (title: string) => void
}) {
  const getColorClass = () => {
    switch (type) {
      case 'positive': return 'text-green-600 dark:text-green-400'
      case 'negative': return 'text-red-600 dark:text-red-400'
      case 'neutral': return 'text-blue-600 dark:text-blue-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${getColorClass()}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  {title}
                </p>
                {onInfoClick && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onInfoClick(title)}
                    className="p-1 h-5 w-5 hover:bg-blue-100 dark:hover:bg-blue-900/20 flex-shrink-0"
                    title={`Informações sobre ${title}`}
                  >
                    <Info className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  </Button>
                )}
              </div>
              <p className="text-xl font-bold">
                {value}
              </p>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          {onChartClick && (
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChartClick(title)}
                className="p-2 h-8 w-8 flex-shrink-0"
                title={`Ver gráfico de evolução do ${title}`}
              >
                <LineChart className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de gráfico com dados reais
function IndicatorChart({ indicator, ticker, isOpen, onClose }: {
  indicator: string
  ticker: string
  isOpen: boolean
  onClose: () => void
}) {
   
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Buscar dados históricos quando o componente montar
  React.useEffect(() => {
    if (!isOpen) return

    async function fetchHistoricalData() {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/financial-history/${ticker}?indicator=${indicator}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao carregar dados')
        }
        
        const data = await response.json()
        setChartData(data)
      } catch (err) {
        console.error('Erro ao buscar dados históricos:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoading(false)
      }
    }

    fetchHistoricalData()
  }, [indicator, ticker, isOpen])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Carregando dados históricos...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <LineChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2 text-red-600">Erro ao carregar dados</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )
    }

    if (!chartData || !chartData.data || chartData.data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <LineChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Dados não disponíveis</p>
            <p className="text-sm">
              Não há dados históricos suficientes para o indicador <strong>{chartData?.indicatorInfo?.name || indicator}</strong>
            </p>
          </div>
        </div>
      )
    }

    // Renderizar gráfico com dados
    const data = chartData.data
     
    const maxValue = Math.max(...data.map((d: any) => d.value))
     
    const minValue = Math.min(...data.map((d: any) => d.value))
    const range = maxValue - minValue || 1
    
    // Calcular média
    const avgValue = data.reduce((sum: number, d: any) => sum + d.value, 0) / data.length
    const avgY = 100 - ((avgValue - minValue) / range) * 100

    return (
      <div className="space-y-3 md:space-y-4">
        <div className="mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2">{chartData.indicatorInfo.name}</h3>
          <p className="text-xs md:text-sm text-muted-foreground mb-1">{chartData.indicatorInfo.description}</p>
          <p className="text-xs text-muted-foreground">
            {data.length} anos de dados • {data[0]?.year} - {data[data.length - 1]?.year}
          </p>
        </div>
        
        {/* Gráfico melhorado */}
        <div className="bg-white dark:bg-gray-900 border rounded-lg p-3 md:p-6">
          <div className="relative">
            {/* Container do gráfico */}
            <div className="h-64 md:h-80 flex">
              {/* Eixo Y - valores */}
              <div className="w-12 md:w-20 flex flex-col justify-between text-[10px] md:text-xs text-muted-foreground pr-2 md:pr-3">
                <div className="text-right">{maxValue.toFixed(2)}</div>
                <div className="text-right">{(maxValue * 0.75 + minValue * 0.25).toFixed(2)}</div>
                <div className="text-right">{(maxValue * 0.5 + minValue * 0.5).toFixed(2)}</div>
                <div className="text-right">{(maxValue * 0.25 + minValue * 0.75).toFixed(2)}</div>
                <div className="text-right">{minValue.toFixed(2)}</div>
              </div>
              
              {/* Área do gráfico */}
              <div className="flex-1 relative border-l border-b border-gray-200 dark:border-gray-700">
                {/* Linhas de grade */}
                <div className="absolute inset-0">
                  {/* Linhas horizontais */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                    <div
                      key={`h-${ratio}`}
                      className="absolute w-full border-t border-gray-100 dark:border-gray-800"
                      style={{ top: `${ratio * 100}%` }}
                    />
                  ))}
                  {/* Linhas verticais */}
                  {data.map((d: any, i: number) => {  
                    const x = (i / (data.length - 1)) * 100
                    return (
                      <div
                        key={`v-${i}`}
                        className="absolute h-full border-l border-gray-100 dark:border-gray-800"
                        style={{ left: `${x}%` }}
                      />
                    )
                  })}
                </div>
                
                {/* SVG do gráfico */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Área sombreada */}
                  <polygon
                    fill="url(#areaGradient)"
                    points={`0,100 ${data.map((d: any, i: number) => {  
                      const x = (i / (data.length - 1)) * 100
                      const y = 100 - ((d.value - minValue) / range) * 100
                      return `${x},${y}`
                    }).join(' ')} 100,100`}
                  />
                  
                  {/* Linha conectando todos os pontos */}
                  <polyline
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={data.map((d: any, i: number) => {  
                      const x = (i / (data.length - 1)) * 100
                      const y = 100 - ((d.value - minValue) / range) * 100
                      return `${x},${y}`
                    }).join(' ')}
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                  />
                  
                  {/* Pontos do gráfico */}
                  {data.map((d: any, i: number) => {  
                    const x = (i / (data.length - 1)) * 100
                    const y = 100 - ((d.value - minValue) / range) * 100
                    return (
                      <g key={i}>
                        {/* Círculo de fundo */}
                        <circle
                          cx={x}
                          cy={y}
                          r="3"
                          fill="white"
                          stroke="hsl(var(--primary))"
                          strokeWidth="2"
                          className="hover:r-4 transition-all cursor-pointer drop-shadow-sm"
                        />
                        {/* Círculo interno */}
                        <circle
                          cx={x}
                          cy={y}
                          r="1.5"
                          fill="hsl(var(--primary))"
                          className="cursor-pointer"
                        />
                        {/* Tooltip no hover */}
                        <title>{`${d.year}: ${d.value.toFixed(2)} ${chartData.indicatorInfo.unit}`}</title>
                      </g>
                    )
                  })}
                  
                  {/* Linha da média (pontilhada) - desenhada por último para ficar visível */}
                  <line
                    x1="0"
                    y1={avgY}
                    x2="100"
                    y2={avgY}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                    vectorEffect="non-scaling-stroke"
                  />
                  
                  {/* Label da média */}
                  <g>
                    <rect
                      x="75"
                      y={avgY - 2.5}
                      width="23"
                      height="5"
                      fill="white"
                      stroke="#f59e0b"
                      strokeWidth="0.2"
                      rx="0.5"
                    />
                    <text
                      x="86.5"
                      y={avgY + 1.2}
                      fontSize="3.5"
                      fill="#f59e0b"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      Média
                    </text>
                  </g>
                </svg>
              </div>
            </div>
            
            {/* Eixo X - anos */}
            <div className="mt-2 md:mt-3 ml-12 md:ml-20">
              <div className="relative h-5 md:h-6">
                {data.map((d: any, i: number) => {  
                  const x = (i / (data.length - 1)) * 100
                  return (
                    <div
                      key={i}
                      className="absolute text-[10px] md:text-xs text-muted-foreground font-medium"
                      style={{ 
                        left: `${x}%`,
                        transform: 'translateX(-50%)',
                        top: '0px'
                      }}
                    >
                      {d.year}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        
        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pt-3 md:pt-4 border-t">
          <div className="text-center">
            <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Atual</p>
            <p className="text-sm md:text-base font-medium">
              {data[data.length - 1]?.value?.toFixed(2)} {chartData.indicatorInfo.unit}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Média</p>
            <p className="text-sm md:text-base font-medium text-amber-600 dark:text-amber-400">
              {avgValue.toFixed(2)} {chartData.indicatorInfo.unit}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Máximo</p>
            <p className="text-sm md:text-base font-medium text-green-600 dark:text-green-400">
              {maxValue.toFixed(2)} {chartData.indicatorInfo.unit}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Mínimo</p>
            <p className="text-sm md:text-base font-medium text-red-600 dark:text-red-400">
              {minValue.toFixed(2)} {chartData.indicatorInfo.unit}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">Evolução do {indicator} - {ticker}</DialogTitle>
        </DialogHeader>
        <div className="p-3 md:p-6">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface FinancialIndicatorsProps {
  ticker: string
   
  latestFinancials: any
   
  comprehensiveData?: any
}

export default function FinancialIndicators({ ticker, latestFinancials, comprehensiveData }: FinancialIndicatorsProps) {
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null)
  const [selectedInfoIndicator, setSelectedInfoIndicator] = useState<string | null>(null)

  // Extrair dados de fallback dos dados completos
  // Para financial-indicators, queremos dados ANUAIS, não trimestrais
  // Buscar o último dado anual nos incomeStatements e keyStatistics
  const latestAnnualIncome = comprehensiveData?.incomeStatements?.find((income: Record<string, unknown>) => {
    // Buscar dados anuais (normalmente dezembro ou final do ano fiscal)
    const endDate = new Date(income.endDate as string)
    const month = endDate.getMonth() + 1 // getMonth() retorna 0-11
    // Considerar como anual se for dezembro (12) ou se for o único dado do ano
    return month === 12 || income.period === 'YEARLY'
  }) || comprehensiveData?.incomeStatements?.[0] // fallback para o mais recente se não encontrar anual
  
  const latestAnnualStats = comprehensiveData?.keyStatistics?.find((stats: Record<string, unknown>) => {
    const endDate = new Date(stats.endDate as string)
    const month = endDate.getMonth() + 1
    return month === 12 || stats.period === 'YEARLY'
  }) || comprehensiveData?.keyStatistics?.[0]
  
  // Função para calcular margem líquida com fallback (usando dados anuais)
  const getMargemLiquidaWithFallback = () => {
    const margemLiquida = toNumber(latestFinancials?.margemLiquida)
    if (margemLiquida !== null) return margemLiquida
    
    // Verificar se é empresa de seguros/financeira
    const isInsuranceOrFinancial = isFinancialSector(null, null, ticker)
    
    // Para empresas de seguros/financeiras, não calcular margem líquida com fallback
    // pois a estrutura contábil é muito diferente
    if (isInsuranceOrFinancial) {
      console.log('🏦 Empresa financeira/seguradora detectada - não aplicando fallback de margem líquida')
      return null
    }
    
    // Fallback apenas para empresas tradicionais: calcular margem líquida usando dados ANUAIS netIncome / totalRevenue
    if (latestAnnualIncome?.netIncome && latestAnnualIncome?.totalRevenue) {
      console.log('latestAnnualIncome.netIncome', latestAnnualIncome.netIncome);
      console.log('latestAnnualIncome.totalRevenue', latestAnnualIncome.totalRevenue);
      const netIncome = toNumber(latestAnnualIncome.netIncome)
      const totalRevenue = toNumber(latestAnnualIncome.totalRevenue)
      if (netIncome && totalRevenue && totalRevenue > 0) {
        return netIncome / totalRevenue
      }
    }
    
    // Fallback secundário: usar operatingIncome apenas se totalRevenue não disponível
    if (latestAnnualIncome?.netIncome && latestAnnualIncome?.operatingIncome) {
      const netIncome = toNumber(latestAnnualIncome.netIncome)
      const operatingIncome = toNumber(latestAnnualIncome.operatingIncome)
      if (netIncome && operatingIncome && operatingIncome > 0) {
        console.log('⚠️ Usando operatingIncome como fallback para margem líquida')
        return netIncome / operatingIncome
      }
    }
    
    return null
  }
  
  // Função para obter receita total com fallback (usando dados anuais)
  const getReceitaTotalWithFallback = () => {
    const receitaTotal = toNumber(latestFinancials?.receitaTotal)
    if (receitaTotal !== null) return receitaTotal
    
    // Verificar se é empresa de seguros/financeira
    const isInsuranceOrFinancial = isFinancialSector(null, null, ticker)
    
    // Para empresas de seguros/financeiras, não usar fallbacks tradicionais
    // pois receita pode ser negativa ou ter estrutura contábil específica
    if (isInsuranceOrFinancial) {
      console.log('🏦 Empresa financeira/seguradora detectada - não aplicando fallback de receita total')
      
      // Para seguradoras, tentar usar totalRevenue se disponível, mas não operatingIncome
      const totalRevenue = toNumber(latestAnnualIncome?.totalRevenue)
      if (totalRevenue !== null) {
        console.log('📊 Usando totalRevenue para seguradora:', totalRevenue)
        return totalRevenue
      }
      
      return null
    }
    
    // Fallback para empresas tradicionais: usar dados ANUAIS - totalRevenue primeiro
    const totalRevenue = toNumber(latestAnnualIncome?.totalRevenue)
    if (totalRevenue !== null) {
      console.log('📊 Usando totalRevenue como fallback:', totalRevenue)
      return totalRevenue
    }
    
    // Fallback secundário: operatingIncome apenas para empresas não-financeiras
    const operatingIncome = toNumber(latestAnnualIncome?.operatingIncome)
    if (operatingIncome !== null) {
      console.log('⚠️ Usando operatingIncome como fallback para receita total')
      return operatingIncome
    }
    
    return null
  }

  // Mapeamento de títulos dos cards para indicadores da API
  const titleToIndicatorMap: Record<string, string> = {
    'P/L': 'pl',
    'P/VP': 'pvp',
    'Dividend Yield': 'dy',
    'EV/EBITDA': 'ev_ebitda',
    'EV/EBIT': 'ev_ebit',
    'P/S': 'psr',
    'P/Ativos': 'p_ativos',
    'P/Cap. Giro': 'p_cap_giro',
    'P/EBIT': 'p_ebit',
    'LPA': 'lpa',
    'VPA': 'vpa',
    'ROE': 'roe',
    'ROIC': 'roic',
    'ROA': 'roa',
    'Margem Bruta': 'margem_bruta',
    'Margem EBITDA': 'margem_ebitda',
    'Margem Líquida': 'margem_liquida',
    'Giro Ativos': 'giro_ativos',
    'Dívida Líq./PL': 'divida_liquida_pl',
    'Dív. Líq./EBITDA': 'divida_liquida_ebitda',
    'Liquidez Corrente': 'liquidez_corrente',
    'Liquidez Rápida': 'liquidez_rapida',
    'Passivo/Ativos': 'passivo_ativos',
    'Dívida/Patrimônio': 'debt_to_equity',
    'Valor de Mercado': 'market_cap',
    'Enterprise Value': 'enterprise_value',
    'Ações Outstanding': 'shares_outstanding',
    'Var. 52 Semanas': 'variacao_52_semanas',
    'Retorno YTD': 'retorno_ano_atual',
    'CAGR Lucros 5a': 'cagr_lucros_5a',
    'CAGR Receitas 5a': 'cagr_receitas_5a',
    'Crescimento Lucros': 'crescimento_lucros',
    'Crescimento Receitas': 'crescimento_receitas',
    'DY 12 Meses': 'dividend_yield_12m',
    'Último Dividendo': 'ultimo_dividendo',
    'Payout': 'payout'
  }

  const handleChartClick = (title: string) => {
    const indicator = titleToIndicatorMap[title]
    console.log('indicator', indicator)
    if (indicator) {
      setSelectedIndicator(indicator)
    }
  }

  const handleCloseChart = () => {
    setSelectedIndicator(null)
  }

  const handleInfoClick = (title: string) => {
    setSelectedInfoIndicator(title)
  }

  const handleCloseInfo = () => {
    setSelectedInfoIndicator(null)
  }

  return (
    <>
      <div className="space-y-8">
        {/* Valuation */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Indicadores de Valuation</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              title="P/L"
              value={(() => {
                const pl = toNumber(latestFinancials.pl) ?? toNumber(latestAnnualStats?.forwardPE)
                return pl?.toFixed(2) || 'N/A'
              })()}
              icon={BarChart3}
              description="Preço/Lucro por Ação"
              type={getIndicatorType(toNumber(latestFinancials.pl) ?? toNumber(latestAnnualStats?.forwardPE), undefined, 15)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="P/VP"
              value={(() => {
                const pvp = toNumber(latestFinancials.pvp) ?? toNumber(latestAnnualStats?.priceToBook)
                return pvp?.toFixed(2) || 'N/A'
              })()}
              icon={PieChart}
              description="Preço/Valor Patrimonial"
              type={getIndicatorType(toNumber(latestFinancials.pvp) ?? toNumber(latestAnnualStats?.priceToBook), undefined, 1.5)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Dividend Yield"
              value={formatPercent(toNumber(latestFinancials.dy) ?? toNumber(latestAnnualStats?.dividendYield / 100))}
              icon={DollarSign}
              description="Rendimento de Dividendos"
              type={getIndicatorType(toNumber(latestFinancials.dy) ?? toNumber(latestAnnualStats?.dividendYield / 100), 0.06)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="EV/EBITDA"
              value={toNumber(latestFinancials.evEbitda)?.toFixed(2) || 'N/A'}
              icon={Activity}
              description="Enterprise Value/EBITDA"
              type={getIndicatorType(toNumber(latestFinancials.evEbitda), undefined, 10)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
          </div>
        </div>

        {/* Rentabilidade */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <Percent className="w-5 h-5" />
            <span>Indicadores de Rentabilidade</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              title="ROE"
              value={formatPercent(latestFinancials.roe)}
              icon={TrendingUp}
              description="Return on Equity"
              type={getIndicatorType(toNumber(latestFinancials.roe), 0.10)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="ROA"
              value={formatPercent(latestFinancials.roa)}
              icon={BarChart3}
              description="Return on Assets"
              type={getIndicatorType(toNumber(latestFinancials.roa), 0.05)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="ROIC"
              value={formatPercent(latestFinancials.roic)}
              icon={Target}
              description="Return on Invested Capital"
              type={getIndicatorType(toNumber(latestFinancials.roic), 0.10)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Margem Líquida"
              value={formatPercent(getMargemLiquidaWithFallback())}
              icon={PieChart}
              description="Margem de Lucro Líquido"
              type={getIndicatorType(getMargemLiquidaWithFallback(), 0.10)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
          </div>
        </div>

        {/* Endividamento e Liquidez */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <Building2 className="w-5 h-5" />
            <span>Endividamento e Liquidez</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              title="Liquidez Corrente"
              value={toNumber(latestFinancials.liquidezCorrente)?.toFixed(2) || 'N/A'}
              icon={Activity}
              description="Ativos/Passivos Circulantes"
              type={getIndicatorType(toNumber(latestFinancials.liquidezCorrente), 1.2)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Dívida Líq./PL"
              value={toNumber(latestFinancials.dividaLiquidaPl)?.toFixed(2) || 'N/A'}
              icon={TrendingDown}
              description="Dívida Líquida/Patrimônio"
              type={getIndicatorType(toNumber(latestFinancials.dividaLiquidaPl), undefined, 0.5)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Dív. Líq./EBITDA"
              value={toNumber(latestFinancials.dividaLiquidaEbitda)?.toFixed(2) || 'N/A'}
              icon={BarChart3}
              description="Dívida Líquida/EBITDA"
              type={getIndicatorType(toNumber(latestFinancials.dividaLiquidaEbitda), undefined, 3)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Passivo/Ativos"
              value={formatPercent(latestFinancials.passivoAtivos)}
              icon={PieChart}
              description="Alavancagem da Empresa"
              type={getIndicatorType(toNumber(latestFinancials.passivoAtivos), undefined, 0.6)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
          </div>
        </div>

        {/* Indicadores de Crescimento */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Indicadores de Crescimento</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              title="CAGR Lucros 5a"
              value={formatPercent(latestFinancials.cagrLucros5a)}
              icon={TrendingUp}
              description="Taxa Composta de Crescimento (5 anos)"
              type={getIndicatorType(toNumber(latestFinancials.cagrLucros5a), 0.10)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="CAGR Receitas 5a"
              value={formatPercent(latestFinancials.cagrReceitas5a)}
              icon={BarChart3}
              description="Taxa Composta de Crescimento (5 anos)"
              type={getIndicatorType(toNumber(latestFinancials.cagrReceitas5a), 0.08)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Crescimento Lucros"
              value={formatPercent(latestFinancials.crescimentoLucros)}
              icon={Activity}
              description="Variação Anual de Lucros"
              type={getIndicatorType(toNumber(latestFinancials.crescimentoLucros), 0.05)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Crescimento Receitas"
              value={formatPercent(latestFinancials.crescimentoReceitas)}
              icon={LineChart}
              description="Variação Anual de Receitas"
              type={getIndicatorType(toNumber(latestFinancials.crescimentoReceitas), 0.05)}
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
          </div>
        </div>

        {/* Dados de Mercado */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Dados de Mercado</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              title="Market Cap"
              value={formatLargeNumber(toNumber(latestFinancials.marketCap))}
              icon={Building2}
              description="Valor de Mercado"
              onChartClick={handleChartClick}
            />
            
            <IndicatorCard
              title="LPA"
              value={formatCurrency(toNumber(latestFinancials.lpa) ?? toNumber(latestAnnualStats?.trailingEps))}
              icon={DollarSign}
              description="Lucro por Ação"
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="VPA"
              value={formatCurrency(toNumber(latestFinancials.vpa) ?? toNumber(latestAnnualStats?.bookValue))}
              icon={BarChart3}
              description="Valor Patrimonial por Ação"
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
            
            <IndicatorCard
              title="Receita Total"
              value={formatLargeNumber(getReceitaTotalWithFallback())}
              icon={TrendingUp}
              description="Receita Anual"
              onChartClick={handleChartClick}
              onInfoClick={handleInfoClick}
            />
          </div>
        </div>
      </div>

      {/* Modal do gráfico */}
      {selectedIndicator && (
        <IndicatorChart
          indicator={selectedIndicator}
          ticker={ticker}
          isOpen={!!selectedIndicator}
          onClose={handleCloseChart}
        />
      )}

      {/* Modal de informações do indicador */}
      {selectedInfoIndicator && (
        <IndicatorInfoModal
          isOpen={!!selectedInfoIndicator}
          onClose={handleCloseInfo}
          indicatorTitle={selectedInfoIndicator}
        />
      )}
    </>
  )
}
