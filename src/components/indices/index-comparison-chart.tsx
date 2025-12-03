/**
 * Gráfico Comparativo
 * Compara performance do índice com IBOVESPA e CDI
 */

'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IndexComparisonChartProps {
  indexHistory: Array<{ 
    date: string; 
    points: number;
    dividendsReceived?: number | null;
    dividendsByTicker?: Record<string, number> | null;
  }>;
  ibovData?: Array<{ date: string; value: number }>;
  cdiData?: Array<{ date: string; value: number }>;
  indexColor: string;
}

export function IndexComparisonChart({
  indexHistory,
  ibovData = [],
  cdiData = [],
  indexColor
}: IndexComparisonChartProps) {
  const [benchmark, setBenchmark] = useState<'ibov' | 'cdi'>('ibov');

  // Normalizar benchmarks para base 100 na mesma data inicial do índice
  // O índice já está em pontos (base 100), então mantemos os pontos reais
  const chartData = useMemo(() => {
    if (indexHistory.length === 0) return [];

    const startDate = indexHistory[0].date;
    const indexStartValue = indexHistory[0].points; // Base 100

    // Manter pontos reais do índice (não normalizar) e incluir dividendos
    const indexPoints = indexHistory.map(point => ({
      date: point.date,
      index: point.points,
      dividendsReceived: point.dividendsReceived || null,
      dividendsByTicker: point.dividendsByTicker || null
    }));

    // Normalizar benchmark selecionado para base 100 na mesma data inicial
    const benchmarkData = benchmark === 'ibov' ? ibovData : cdiData;
    let normalizedBenchmark: Array<{ date: string; value: number }> = [];

    if (benchmarkData.length > 0) {
      // Encontrar valor inicial do benchmark na mesma data (ou mais próxima)
      const benchmarkStartPoint = benchmarkData.find(b => b.date >= startDate) || benchmarkData[0];
      const benchmarkStartValue = benchmarkStartPoint?.value || 100;

      // Normalizar benchmark para base 100
      normalizedBenchmark = benchmarkData
        .filter(b => b.date >= startDate)
        .map(point => ({
          date: point.date,
          value: (point.value / benchmarkStartValue) * indexStartValue // Normalizar para mesma base do índice
        }));
    }

    // Combinar dados por data
    const dataMap = new Map<string, { 
      date: string; 
      index: number; 
      benchmark: number | null;
      dividendsReceived: number | null;
      dividendsByTicker: Record<string, number> | null;
    }>();

    indexPoints.forEach(point => {
      dataMap.set(point.date, {
        date: point.date,
        index: point.index,
        benchmark: null,
        dividendsReceived: point.dividendsReceived,
        dividendsByTicker: point.dividendsByTicker
      });
    });

    normalizedBenchmark.forEach(point => {
      const existing = dataMap.get(point.date);
      if (existing) {
        existing.benchmark = point.value;
      } else {
        const lastPoint = indexPoints[indexPoints.length - 1];
        dataMap.set(point.date, {
          date: point.date,
          index: lastPoint?.index || indexStartValue,
          benchmark: point.value,
          dividendsReceived: lastPoint?.dividendsReceived || null,
          dividendsByTicker: lastPoint?.dividendsByTicker || null
        });
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [indexHistory, ibovData, cdiData, benchmark]);

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  const formatTooltipValue = (value: number) => {
    return `${value.toFixed(2)} pontos`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const dividendsReceived = data?.dividendsReceived;
    const dividendsByTicker = data?.dividendsByTicker;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <p className="font-semibold mb-2">{formatDate(label)}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {formatTooltipValue(entry.value)}
          </p>
        ))}
        {dividendsReceived && dividendsReceived > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
              Dividendos: {(dividendsReceived / 100 * 100).toFixed(2)} pts
            </p>
            {dividendsByTicker && Object.keys(dividendsByTicker).length > 0 && (
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {Object.entries(dividendsByTicker).slice(0, 3).map(([ticker, amount]) => (
                  <p key={ticker}>
                    {ticker}: R$ {Number(amount).toFixed(2)}
                  </p>
                ))}
                {Object.keys(dividendsByTicker).length > 3 && (
                  <p className="text-gray-500">+{Object.keys(dividendsByTicker).length - 3} mais</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Performance Comparativa</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={benchmark === 'ibov' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBenchmark('ibov')}
            >
              IBOVESPA
            </Button>
            <Button
              variant={benchmark === 'cdi' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBenchmark('cdi')}
            >
              CDI
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            Dados insuficientes para comparação
          </div>
        ) : (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value.toFixed(0)} pts`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="index"
                  stroke={indexColor}
                  strokeWidth={2}
                  dot={false}
                  name="Índice IPJ"
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name={benchmark === 'ibov' ? 'IBOVESPA' : 'CDI'}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

