'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface PLBolsaChartData {
  date: string
  pl: number
  averagePl: number
  companyCount: number
  dateFormatted?: string // Adicionado para compatibilidade
}

interface PLBolsaChartProps {
  data: PLBolsaChartData[]
  statistics?: {
    currentPL: number
    averagePL: number
    minPL: number
    maxPL: number
    lastUpdate: string
  }
  loading?: boolean
}

export function PLBolsaChart({ data, statistics, loading }: PLBolsaChartProps) {
  // Formatar dados para o gráfico
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      dateFormatted: format(new Date(item.date), 'MM/yyyy', { locale: ptBR }),
    }))
  }, [data])

  // Calcular domínio do eixo Y dinamicamente
  const yAxisDomain = useMemo((): [number, number] => {
    if (!data || data.length === 0) {
      return [0, 20] // Valor padrão quando não há dados
    }

    // Encontrar valores mínimo e máximo dos dados
    const plValues = data.map((item) => item.pl).filter((v) => v != null && isFinite(v))
    
    if (plValues.length === 0) {
      return [0, 20] // Valor padrão quando não há valores válidos
    }

    const minPL = Math.min(...plValues)
    const maxPL = Math.max(...plValues)

    // Se o mínimo for >= 4, começar em 4, senão começar em 0
    const yMin = minPL >= 4 ? 4 : 0
    const yMax = maxPL * 1.05 // Adicionar 5% de margem no topo

    return [yMin, yMax]
  }, [data])

  // Formatar valor do P/L
  const formatPL = (value: number) => {
    return `${value.toFixed(2)}x`
  }

  // Formatar data no tooltip
  const formatTooltipDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico P/L Bovespa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-muted-foreground">Carregando dados...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico P/L Bovespa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-muted-foreground">
              Nenhum dado disponível para o período selecionado
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Histórico P/L Bovespa</CardTitle>
          {statistics && (
            <div className="text-right text-sm text-muted-foreground">
              <div>Última atualização: {format(new Date(statistics.lastUpdate), 'dd/MM/yyyy', { locale: ptBR })}</div>
              <div className="font-semibold text-foreground">
                P/L atual: {formatPL(statistics.currentPL)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="dateFormatted"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={formatPL}
                domain={yAxisDomain}
                label={{
                  value: 'P/L',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'pl') {
                    return [formatPL(value), 'P/L']
                  }
                  if (name === 'averagePl') {
                    return [formatPL(value), 'Média']
                  }
                  return [value, name]
                }}
                labelFormatter={(label: string) => {
                  const item = chartData.find((d) => d.dateFormatted === label)
                  if (item) {
                    return formatTooltipDate(item.date)
                  }
                  return label
                }}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <ReferenceLine
                y={statistics?.averagePL}
                stroke="#666"
                strokeDasharray="5 5"
                label={{
                  value: `Média: ${statistics ? formatPL(statistics.averagePL) : ''}`,
                  position: 'right',
                  style: { fill: '#666', fontSize: 12 },
                }}
              />
              <Area
                type="monotone"
                dataKey="pl"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#colorPL)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {statistics && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">P/L Atual</div>
              <div className="font-semibold text-lg">{formatPL(statistics.currentPL)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Média Histórica</div>
              <div className="font-semibold text-lg">{formatPL(statistics.averagePL)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Mínimo</div>
              <div className="font-semibold text-lg">{formatPL(statistics.minPL)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Máximo</div>
              <div className="font-semibold text-lg">{formatPL(statistics.maxPL)}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

