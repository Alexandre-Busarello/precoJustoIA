'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SupportResistanceLevel {
  price: number
  strength: number
  type: 'support' | 'resistance' | 'psychological'
  touches: number
}

interface HistoricalPrice {
  date: string
  close: number
  high: number
  low: number
}

interface FibonacciLevels {
  fib236: number | null
  fib382: number | null
  fib500: number | null
  fib618: number | null
  fib786: number | null
}

interface IchimokuLevels {
  tenkanSen: number | null
  kijunSen: number | null
  senkouSpanA: number | null
  senkouSpanB: number | null
  chikouSpan: number | null
}

interface SupportResistanceChartProps {
  historicalData: HistoricalPrice[]
  supportLevels: SupportResistanceLevel[]
  resistanceLevels: SupportResistanceLevel[]
  fibonacciLevels?: FibonacciLevels | null
  ichimokuLevels?: IchimokuLevels | null
  currentPrice: number
  ticker: string
}

export default function SupportResistanceChart({
  historicalData,
  supportLevels,
  resistanceLevels,
  fibonacciLevels,
  ichimokuLevels,
  currentPrice,
  ticker
}: SupportResistanceChartProps) {
  // Preparar dados do gráfico (garantir apenas um ponto por mês)
  const chartData = useMemo(() => {
    // Agrupar novamente por mês para garantir que não há duplicatas
    const monthlyMap = new Map<string, { date: Date; close: number; high: number; low: number }>()
    
    for (const d of historicalData) {
      const date = new Date(d.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      // Se não existe ou se esta data é mais recente, substituir
      const existing = monthlyMap.get(monthKey)
      if (!existing || date.getTime() > existing.date.getTime()) {
        monthlyMap.set(monthKey, {
          date,
          close: Number(d.close),
          high: Number(d.high),
          low: Number(d.low)
        })
      }
    }
    
    // Converter para array, ordenar por data e formatar
    return Array.from(monthlyMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(item => ({
        date: item.date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        dateObj: item.date,
        close: item.close,
        high: item.high,
        low: item.low
      }))
  }, [historicalData])

  // Preparar linhas de referência para suporte e resistência (apenas o mais forte)
  const supportLines = useMemo(() => {
    const strongest = supportLevels
      .sort((a, b) => b.strength - a.strength)[0]
    return strongest ? [{
      price: strongest.price,
      strength: strongest.strength,
      color: '#10b981' // Verde
    }] : []
  }, [supportLevels])

  const resistanceLines = useMemo(() => {
    const strongest = resistanceLevels
      .sort((a, b) => b.strength - a.strength)[0]
    return strongest ? [{
      price: strongest.price,
      strength: strongest.strength,
      color: '#ef4444' // Vermelho
    }] : []
  }, [resistanceLevels])

  // Preparar níveis de Fibonacci (apenas o mais forte de cada tipo)
  const fibonacciLines = useMemo(() => {
    if (!fibonacciLevels) return []
    const levels: Array<{ price: number; label: string; type: 'support' | 'resistance' }> = []
    
    // Encontrar o nível de Fibonacci mais próximo abaixo do preço atual (suporte mais forte)
    const supportFibs = [
      { price: fibonacciLevels.fib786, label: 'Fib 78.6%' },
      { price: fibonacciLevels.fib618, label: 'Fib 61.8%' },
      { price: fibonacciLevels.fib500, label: 'Fib 50%' },
      { price: fibonacciLevels.fib382, label: 'Fib 38.2%' },
      { price: fibonacciLevels.fib236, label: 'Fib 23.6%' }
    ].filter(f => f.price && f.price < currentPrice)
    
    if (supportFibs.length > 0) {
      // Pegar o mais próximo do preço atual (mais forte como suporte)
      const strongestSupport = supportFibs.reduce((prev, curr) => 
        Math.abs(curr.price! - currentPrice) < Math.abs(prev.price! - currentPrice) ? curr : prev
      )
      levels.push({ price: strongestSupport.price!, label: strongestSupport.label, type: 'support' })
    }
    
    // Encontrar o nível de Fibonacci mais próximo acima do preço atual (resistência mais forte)
    const resistanceFibs = [
      { price: fibonacciLevels.fib236, label: 'Fib 23.6%' },
      { price: fibonacciLevels.fib382, label: 'Fib 38.2%' },
      { price: fibonacciLevels.fib500, label: 'Fib 50%' },
      { price: fibonacciLevels.fib618, label: 'Fib 61.8%' },
      { price: fibonacciLevels.fib786, label: 'Fib 78.6%' }
    ].filter(f => f.price && f.price > currentPrice)
    
    if (resistanceFibs.length > 0) {
      // Pegar o mais próximo do preço atual (mais forte como resistência)
      const strongestResistance = resistanceFibs.reduce((prev, curr) => 
        Math.abs(curr.price! - currentPrice) < Math.abs(prev.price! - currentPrice) ? curr : prev
      )
      levels.push({ price: strongestResistance.price!, label: strongestResistance.label, type: 'resistance' })
    }
    
    return levels
  }, [fibonacciLevels, currentPrice])

  // Preparar níveis de Ichimoku (apenas o mais forte de cada tipo)
  const ichimokuLines = useMemo(() => {
    if (!ichimokuLevels) return []
    const levels: Array<{ price: number; label: string; type: 'support' | 'resistance' }> = []
    
    // Coletar todos os níveis de Ichimoku
    const ichiLevels: Array<{ price: number; label: string; type: 'support' | 'resistance' }> = []
    
    // Kijun-sen é uma linha de suporte/resistência importante
    if (ichimokuLevels.kijunSen) {
      const type = ichimokuLevels.kijunSen < currentPrice ? 'support' : 'resistance'
      ichiLevels.push({ price: ichimokuLevels.kijunSen, label: 'Kijun-sen', type })
    }
    
    // Tenkan-sen também é importante
    if (ichimokuLevels.tenkanSen) {
      const type = ichimokuLevels.tenkanSen < currentPrice ? 'support' : 'resistance'
      ichiLevels.push({ price: ichimokuLevels.tenkanSen, label: 'Tenkan-sen', type })
    }
    
    // Senkou Span A e B formam a nuvem (cloud)
    if (ichimokuLevels.senkouSpanA && ichimokuLevels.senkouSpanB) {
      const cloudTop = Math.max(ichimokuLevels.senkouSpanA, ichimokuLevels.senkouSpanB)
      const cloudBottom = Math.min(ichimokuLevels.senkouSpanA, ichimokuLevels.senkouSpanB)
      
      if (cloudTop > currentPrice) {
        ichiLevels.push({ price: cloudTop, label: 'Cloud Top', type: 'resistance' })
      }
      if (cloudBottom < currentPrice) {
        ichiLevels.push({ price: cloudBottom, label: 'Cloud Bottom', type: 'support' })
      }
    }
    
    // Pegar apenas o suporte e resistência mais próximos do preço atual
    const supports = ichiLevels.filter(l => l.type === 'support')
    const resistances = ichiLevels.filter(l => l.type === 'resistance')
    
    if (supports.length > 0) {
      const strongestSupport = supports.reduce((prev, curr) => 
        Math.abs(curr.price - currentPrice) < Math.abs(prev.price - currentPrice) ? curr : prev
      )
      levels.push(strongestSupport)
    }
    
    if (resistances.length > 0) {
      const strongestResistance = resistances.reduce((prev, curr) => 
        Math.abs(curr.price - currentPrice) < Math.abs(prev.price - currentPrice) ? curr : prev
      )
      levels.push(strongestResistance)
    }
    
    return levels
  }, [ichimokuLevels, currentPrice])

  // Calcular min/max incluindo todos os níveis
  const allLevels = [
    ...supportLines.map(s => s.price),
    ...resistanceLines.map(r => r.price),
    ...fibonacciLines.map(f => f.price),
    ...ichimokuLines.map(i => i.price),
    currentPrice
  ]
  const minPrice = Math.min(...chartData.map(d => d.low), ...allLevels) * 0.95
  const maxPrice = Math.max(...chartData.map(d => d.high), ...allLevels) * 1.05

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráfico de Preços com Suporte e Resistência</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `R$ ${value.toFixed(2)}`}
            />
            <Tooltip
              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Preço']}
              labelFormatter={(label) => `Data: ${label}`}
            />
            <Legend />
            
            {/* Linha de preço de fechamento */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Preço de Fechamento"
            />
            
            {/* Linha de Suporte Automático (mais forte) */}
            {supportLines.length > 0 && (
              <ReferenceLine
                key={`support-0`}
                y={supportLines[0].price}
                stroke={supportLines[0].color}
                strokeWidth={3}
                strokeDasharray="5 5"
                label={{ 
                  value: `Suporte: R$ ${supportLines[0].price.toFixed(2)}`, 
                  position: 'right',
                  fill: supportLines[0].color
                }}
              />
            )}
            
            {/* Linha de Resistência Automática (mais forte) */}
            {resistanceLines.length > 0 && (
              <ReferenceLine
                key={`resistance-0`}
                y={resistanceLines[0].price}
                stroke={resistanceLines[0].color}
                strokeWidth={3}
                strokeDasharray="5 5"
                label={{ 
                  value: `Resistência: R$ ${resistanceLines[0].price.toFixed(2)}`, 
                  position: 'right',
                  fill: resistanceLines[0].color
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        
        {/* Legenda Simplificada */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {supportLines.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-green-600">Suporte Automático</h4>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-0.5" 
                  style={{ backgroundColor: supportLines[0].color }}
                />
                <span>R$ {supportLines[0].price.toFixed(2)} - Força: {supportLines[0].strength}/5</span>
              </div>
            </div>
          )}
          {resistanceLines.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-red-600">Resistência Automática</h4>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-0.5" 
                  style={{ backgroundColor: resistanceLines[0].color }}
                />
                <span>R$ {resistanceLines[0].price.toFixed(2)} - Força: {resistanceLines[0].strength}/5</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Nota sobre Fibonacci e Ichimoku */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-semibold mb-1">ℹ️ Níveis Adicionais</p>
          <p className="text-xs">
            Os níveis de Fibonacci e Ichimoku estão disponíveis nas seções dedicadas acima. 
            Eles foram removidos do gráfico para melhorar a legibilidade, mas continuam sendo 
            considerados na análise técnica completa.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

