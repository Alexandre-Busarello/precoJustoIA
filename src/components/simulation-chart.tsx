'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MonthlyDataPoint {
  month: number
  debtBalance: number
  investedBalance: number
  netWorth: number
}

interface SimulationChartProps {
  sniperData: MonthlyDataPoint[]
  hybridData: MonthlyDataPoint[]
  sniperBreakEven?: number | null
  hybridBreakEven?: number | null
}

export function SimulationChart({
  sniperData,
  hybridData,
  sniperBreakEven,
  hybridBreakEven
}: SimulationChartProps) {
  // Estado para controlar visibilidade das linhas
  const [visibleLines, setVisibleLines] = useState({
    sniperDebt: true,
    sniperInvested: true,
    hybridDebt: true,
    hybridInvested: true,
    sniperBreakEven: true,
    hybridBreakEven: true
  })

  // Combinar dados para o gráfico
  // IMPORTANTE: Usar os meses reais dos dados, não preencher com zeros
  // Criar um mapa de meses para facilitar a combinação
  const monthMap = new Map<number, {
    sniperDebt?: number
    sniperInvested?: number
    sniperNetWorth?: number
    hybridDebt?: number
    hybridInvested?: number
    hybridNetWorth?: number
  }>()
  
  // Adicionar dados do Sniper
  sniperData.forEach(snapshot => {
    const existing = monthMap.get(snapshot.month) || {}
    monthMap.set(snapshot.month, {
      ...existing,
      sniperDebt: snapshot.debtBalance,
      sniperInvested: snapshot.investedBalance,
      sniperNetWorth: snapshot.netWorth
    })
  })
  
  // Adicionar dados do Híbrido
  hybridData.forEach(snapshot => {
    const existing = monthMap.get(snapshot.month) || {}
    monthMap.set(snapshot.month, {
      ...existing,
      hybridDebt: snapshot.debtBalance,
      hybridInvested: snapshot.investedBalance,
      hybridNetWorth: snapshot.netWorth
    })
  })
  
  // Converter para array ordenado por mês
  // IMPORTANTE: Usar undefined ao invés de null para valores ausentes (Recharts não renderiza null corretamente)
  // IMPORTANTE: Filtrar meses onde nenhuma estratégia tem dados para evitar pontos vazios
  const chartData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([month, data]) => ({
      month,
      sniperDebt: data.sniperDebt,
      sniperInvested: data.sniperInvested,
      sniperNetWorth: data.sniperNetWorth,
      hybridDebt: data.hybridDebt,
      hybridInvested: data.hybridInvested,
      hybridNetWorth: data.hybridNetWorth
    }))
    // Remover pontos onde ambas as estratégias não têm dados (evitar pontos vazios no final)
    .filter((d, index, array) => {
      // Manter todos os pontos até o último ponto válido de qualquer estratégia
      const hasSniperData = d.sniperDebt !== undefined || d.sniperInvested !== undefined
      const hasHybridData = d.hybridDebt !== undefined || d.hybridInvested !== undefined
      
      // Se este ponto não tem dados de nenhuma estratégia, verificar se há pontos válidos depois
      if (!hasSniperData && !hasHybridData) {
        const hasFutureData = array.slice(index + 1).some(future => 
          (future.sniperDebt !== undefined || future.sniperInvested !== undefined) ||
          (future.hybridDebt !== undefined || future.hybridInvested !== undefined)
        )
        // Se não há dados futuros válidos, remover este ponto (é um ponto vazio no final)
        return hasFutureData
      }
      
      return true
    })
  
  // DEBUG: Log dos últimos dados do gráfico
  if (chartData.length > 0) {
    const lastFew = chartData.slice(-5)
    console.log('\n=== DEBUG GRÁFICO - ÚLTIMOS 5 PONTOS ===')
    lastFew.forEach((d, i) => {
      console.log(`[${i + 1}] Mês ${d.month}:`)
      console.log(`  Híbrido Investido: ${d.hybridInvested ?? 'undefined'}`)
      console.log(`  Híbrido Dívida: ${d.hybridDebt ?? 'undefined'}`)
      console.log(`  Sniper Investido: ${d.sniperInvested ?? 'undefined'}`)
      console.log(`  Sniper Dívida: ${d.sniperDebt ?? 'undefined'}`)
    })
    console.log(`Total de pontos no gráfico: ${chartData.length}`)
    console.log(`=== FIM DEBUG GRÁFICO ===\n`)
  }

  // Encontrar o valor máximo para determinar se usa escala de mil
  // IMPORTANTE: Ignorar valores undefined (ausentes) ao invés de tratá-los como 0
  const allValues = chartData.flatMap(d => [
    d.sniperDebt,
    d.sniperInvested,
    d.hybridDebt,
    d.hybridInvested
  ]).filter((v): v is number => v != null && v !== undefined && isFinite(v) && v >= 0)
  
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0
  const useThousandScale = maxValue > 100000
  
  // Calcular domínio do Y-axis com margem de 5%
  const yAxisDomain: [number, number] = [
    Math.max(0, minValue * 0.95),
    maxValue * 1.05
  ]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Formatação do eixo Y: mostra em "mil" quando > 100.000
  const formatYAxis = (value: number) => {
    // Se usar escala de mil e valor >= 1000, converter
    if (useThousandScale && value >= 1000) {
      const thousands = value / 1000
      // Formatar como número inteiro quando possível, caso contrário com 1 decimal
      if (thousands % 1 === 0) {
        return `${thousands} mil`
      } else {
        // Arredondar para 1 decimal máximo
        return `${Math.round(thousands * 10) / 10} mil`
      }
    }
    // Para valores menores que 1000, mostrar normalmente
    return value.toString()
  }

  // Toggle de visibilidade de linha
  const toggleLine = (lineKey: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({
      ...prev,
      [lineKey]: !prev[lineKey]
    }))
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
          <p className="font-semibold mb-2">Mês {payload[0].payload.month}</p>
          {payload
            .filter((entry: any) => visibleLines[entry.dataKey as keyof typeof visibleLines] !== false)
            .map((entry: any, index: number) => {
              const label = entry.dataKey.includes('Debt')
                ? 'Saldo Devedor'
                : entry.dataKey.includes('Invested')
                ? 'Patrimônio Investido'
                : 'Patrimônio Líquido'
              
              const strategy = entry.dataKey.includes('sniper') ? 'Sniper' : 'Híbrido'
              
              return (
                <p key={index} style={{ color: entry.color }} className="text-sm">
                  {strategy} - {label}: {formatCurrency(entry.value)}
                </p>
              )
            })}
        </div>
      )
    }
    return null
  }

  // Componente de legenda customizado e clicável
  const CustomLegend = (props: any) => {
    const { payload } = props
    
    // Definir cores e estilos para cada linha
    const lineConfigs = [
      { key: 'sniperDebt', name: 'Sniper - Saldo Devedor', color: '#ef4444', dashed: false },
      { key: 'sniperInvested', name: 'Sniper - Patrimônio Investido', color: '#3b82f6', dashed: false },
      { key: 'hybridDebt', name: 'Híbrido - Saldo Devedor', color: '#f97316', dashed: true },
      { key: 'hybridInvested', name: 'Híbrido - Patrimônio Investido', color: '#10b981', dashed: true },
      ...(sniperBreakEven ? [{ key: 'sniperBreakEven', name: 'Break-even Sniper', color: '#9333ea', dashed: true }] : []),
      ...(hybridBreakEven ? [{ key: 'hybridBreakEven', name: 'Break-even Híbrido', color: '#4f46e5', dashed: true }] : [])
    ]
    
    return (
      <div className="flex flex-wrap gap-3 sm:gap-4 justify-center mt-4 mb-2 px-2">
        {lineConfigs.map((config, index) => {
          const isVisible = visibleLines[config.key as keyof typeof visibleLines] !== false
          return (
            <div
              key={config.key}
              onClick={() => toggleLine(config.key as keyof typeof visibleLines)}
              className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity select-none"
              style={{ opacity: isVisible ? 1 : 0.4 }}
            >
              <div
                className="w-4 h-0.5"
                style={{
                  backgroundColor: config.color,
                  borderStyle: config.dashed ? 'dashed' : 'solid',
                  borderWidth: config.dashed ? '1px' : '0',
                  borderColor: config.color
                }}
              />
              <span className="text-xs sm:text-sm whitespace-nowrap">{config.name}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação de Estratégias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[400px] sm:h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: useThousandScale ? 5 : 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              label={{ value: 'Mês', position: 'insideBottom', offset: -5 }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: useThousandScale ? 'Valor (mil R$)' : 'Valor (R$)', angle: -90, position: 'insideLeft', style: { fontSize: '11px' } }}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 10 }}
              width={useThousandScale ? 65 : 75}
              interval="preserveStartEnd"
              domain={yAxisDomain}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            
            {/* Linha de Break-even Sniper */}
            {sniperBreakEven && (
              <ReferenceLine
                x={sniperBreakEven}
                stroke="#9333ea"
                strokeWidth={2}
                strokeDasharray="5 5"
                strokeOpacity={visibleLines.sniperBreakEven ? 1 : 0}
                label={visibleLines.sniperBreakEven ? { value: 'Break-even Sniper', position: 'top', fontSize: 10 } : undefined}
              />
            )}
            
            {/* Linha de Break-even Híbrido */}
            {hybridBreakEven && (
              <ReferenceLine
                x={hybridBreakEven}
                stroke="#4f46e5"
                strokeWidth={2}
                strokeDasharray="5 5"
                strokeOpacity={visibleLines.hybridBreakEven ? 1 : 0}
                label={visibleLines.hybridBreakEven ? { value: 'Break-even Híbrido', position: 'top', fontSize: 10 } : undefined}
              />
            )}
            
            {/* Estratégia Sniper */}
            <Line
              type="monotone"
              dataKey="sniperDebt"
              stroke="#ef4444"
              strokeWidth={2}
              strokeOpacity={visibleLines.sniperDebt ? 1 : 0}
              name="Sniper - Saldo Devedor"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="sniperInvested"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeOpacity={visibleLines.sniperInvested ? 1 : 0}
              name="Sniper - Patrimônio Investido"
              dot={false}
            />
            
            {/* Estratégia Híbrida */}
            <Line
              type="monotone"
              dataKey="hybridDebt"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeOpacity={visibleLines.hybridDebt ? 1 : 0}
              name="Híbrido - Saldo Devedor"
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="hybridInvested"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeOpacity={visibleLines.hybridInvested ? 1 : 0}
              name="Híbrido - Patrimônio Investido"
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
        
        <div className="mt-4 text-sm">
          <p className="font-semibold mb-2 text-center">Clique nas legendas para mostrar/ocultar linhas</p>
          <div className="text-center text-muted-foreground text-xs">
            <p>Break-even: Ponto onde o Patrimônio Investido supera o Saldo Devedor</p>
            {sniperBreakEven && (
              <p className="mt-1">Sniper: Mês {sniperBreakEven}</p>
            )}
            {hybridBreakEven && (
              <p className="mt-1">Híbrido: Mês {hybridBreakEven}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

