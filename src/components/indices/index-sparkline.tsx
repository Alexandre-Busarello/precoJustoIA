/**
 * Sparkline Component
 * Mini gráfico de tendência para cards de índice
 */

'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface IndexSparklineProps {
  data: Array<{ date: string; points: number }>;
  color?: string;
  height?: number;
}

export function IndexSparkline({ data, color = '#10b981', height = 40 }: IndexSparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[40px] flex items-center justify-center text-gray-400 text-xs">
        Sem dados
      </div>
    );
  }

  // Normalizar dados para começar em 0 (variação relativa)
  const normalizedData = data.map((point, index) => {
    const firstPoint = data[0].points;
    const variation = ((point.points - firstPoint) / firstPoint) * 100;
    return {
      date: point.date,
      value: variation
    };
  });

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalizedData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

