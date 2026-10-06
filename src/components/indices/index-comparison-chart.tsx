/**
 * Gráfico comparativo: índice (chart-1) contra IBOVESPA ou CDI (cinza tracejado), ambos em base 100.
 */

'use client';

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatBRL, formatDate, formatDeltaPct, formatNumber } from '@/lib/format';

interface IndexComparisonChartProps {
  indexHistory: Array<{ 
    date: string; 
    points: number;
    dailyChange?: number | null;
    dividendsReceived?: number | null;
    dividendsByTicker?: Record<string, number> | null;
  }>;
  ibovData?: Array<{ date: string; value: number }>;
  cdiData?: Array<{ date: string; value: number }>;
}

export function IndexComparisonChart({
  indexHistory,
  ibovData = [],
  cdiData = [],
}: IndexComparisonChartProps) {
  const [benchmark, setBenchmark] = useState<'ibov' | 'cdi'>('ibov');
  

  // Normalizar benchmarks para base 100 na mesma data inicial do índice
  // O índice já está em pontos (base 100), então mantemos os pontos reais
  const chartData = useMemo(() => {
    if (indexHistory.length === 0) return [];

    const startDate = indexHistory[0].date;
    const endDate = indexHistory[indexHistory.length - 1].date;

    // Manter pontos reais do índice (não normalizar) e incluir dividendos e variação diária
    const indexPoints = indexHistory.map(point => ({
      date: point.date,
      index: point.points,
      dailyChange: point.dailyChange || null,
      dividendsReceived: point.dividendsReceived || null,
      dividendsByTicker: point.dividendsByTicker || null
    }));

    // Processar benchmark selecionado
    const benchmarkData = benchmark === 'ibov' ? ibovData : cdiData;
    let normalizedBenchmark: Array<{ date: string; value: number }> = [];

    if (benchmarkData.length > 0) {
      if (benchmark === 'cdi') {
        // CDI vem como taxa diária do Banco Central (ex: 0.055131 = 0.055131% ao dia)
        // Precisamos converter para índice acumulado começando em 100
        // Não filtrar por startDate - usar todos os dados disponíveis e alinhar depois
        const sortedCDI = [...benchmarkData].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        if (sortedCDI.length > 0) {
          // Criar mapa de datas do índice para alinhamento
          const sortedDates = Array.from(indexPoints.map(p => p.date)).sort();
          
          // Calcular índice acumulado do CDI
          // CDI do Banco Central já vem como taxa diária (%)
          let accumulatedValue = 100; // Começa em 100 pontos
          const cdiPoints: Array<{ date: string; value: number }> = [];
          
          // Criar mapa de CDI por data para busca rápida
          const cdiMap = new Map<string, number>();
          sortedCDI.forEach(point => {
            cdiMap.set(point.date, point.value);
          });
          
          // Usar a primeira taxa CDI disponível como base
          const baseCDIRate = sortedCDI[0]?.value || 0.05; // Fallback para 0.05% se não houver dados
          
          sortedDates.forEach((date, index) => {
            if (index === 0) {
              cdiPoints.push({ date, value: 100 });
              return;
            }
            
            // Encontrar taxa CDI mais próxima (anterior ou igual) a esta data
            let cdiRate = cdiMap.get(date);
            
            // Se não temos taxa exata para esta data, buscar a mais próxima anterior
            if (cdiRate === undefined) {
              for (let i = sortedCDI.length - 1; i >= 0; i--) {
                if (sortedCDI[i].date <= date) {
                  cdiRate = sortedCDI[i].value;
                  break;
                }
              }
            }
            
            // Se ainda não encontrou, usar a última taxa disponível ou a base
            if (cdiRate === undefined) {
              cdiRate = sortedCDI[sortedCDI.length - 1]?.value || baseCDIRate;
            }
            
            if (cdiRate !== undefined && cdiRate !== null && !isNaN(cdiRate)) {
              // Calcular dias entre esta data e a anterior
              const prevDate = sortedDates[index - 1];
              const daysDiff = Math.max(1, Math.floor(
                (new Date(date).getTime() - new Date(prevDate).getTime()) / (1000 * 60 * 60 * 24)
              ));
              
              // Taxa diária já está em % (ex: 0.055131 = 0.055131%)
              // Converter para decimal e acumular
              const dailyRateDecimal = cdiRate / 100;
              
              // Acumular: valor = valor_anterior * (1 + taxa_diária)^dias
              accumulatedValue = accumulatedValue * Math.pow(1 + dailyRateDecimal, daysDiff);
            }
            
            cdiPoints.push({ date, value: accumulatedValue });
          });
          
          normalizedBenchmark = cdiPoints;
        }
      } else {
        // IBOV já vem como índice de preços, apenas normalizar para base 100
        // Filtrar dados do IBOV para incluir apenas dados >= startDate (mas manter alguns anteriores para normalização)
        const sortedIBOV = [...benchmarkData].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        if (sortedIBOV.length > 0) {
          // Converter startDate para Date para comparação correta
          const startDateObj = new Date(startDate);
          startDateObj.setHours(0, 0, 0, 0);
          
          // Filtrar IBOV para incluir apenas dados >= startDate (mas manter o último ponto anterior para normalização)
          const ibovAfterStart = sortedIBOV.filter(b => {
            const bDate = new Date(b.date);
            bDate.setHours(0, 0, 0, 0);
            return bDate.getTime() >= startDateObj.getTime();
          });
          
          // Encontrar valor inicial do IBOV na mesma data (ou mais próxima anterior)
          // Buscar o primeiro ponto do IBOV que seja <= startDate (comparando datas, não strings)
          const benchmarkStartPoint = sortedIBOV.find(b => {
            const bDate = new Date(b.date);
            bDate.setHours(0, 0, 0, 0);
            return bDate.getTime() <= startDateObj.getTime();
          });
          
          
          // Se não encontrou ponto anterior ou igual, o IBOV começa depois do índice
          if (!benchmarkStartPoint) {
            // IBOV começa depois do índice - não temos dados na data inicial
            // Estratégia: normalizar a partir do primeiro ponto disponível
            // e criar um ponto na data inicial que seja uma estimativa baseada na variação
            const firstPoint = sortedIBOV[0];
            const firstPointValue = firstPoint.value;
            
            // Se temos pelo menos 2 pontos, calcular variação para estimar valor na data inicial
            let estimatedStartValue = firstPointValue;
            if (sortedIBOV.length >= 2) {
              const secondPoint = sortedIBOV[1];
              // Calcular variação diária média entre os primeiros pontos
              const daysDiff = Math.max(1, Math.floor(
                (new Date(secondPoint.date).getTime() - new Date(firstPoint.date).getTime()) / (1000 * 60 * 60 * 24)
              ));
              const dailyVariation = ((secondPoint.value - firstPoint.value) / firstPoint.value) / daysDiff;
              
              // Calcular quantos dias antes do primeiro ponto está a data inicial
              const daysBeforeStart = Math.max(1, Math.floor(
                (new Date(firstPoint.date).getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
              ));
              
              // Estimar valor na data inicial assumindo a mesma variação diária
              estimatedStartValue = firstPointValue * Math.pow(1 - dailyVariation, daysBeforeStart);
            }
            
            // Normalizar todos os pontos usando o valor estimado como referência
            // Usar apenas pontos >= startDate para evitar mostrar dados antes do índice
            normalizedBenchmark = ibovAfterStart.length > 0 
              ? ibovAfterStart.map(point => ({
                  date: point.date,
                  value: (point.value / estimatedStartValue) * 100
                }))
              : sortedIBOV.map(point => ({
                  date: point.date,
                  value: (point.value / estimatedStartValue) * 100
                }));
            
            // Criar ponto na data inicial do índice com valor 100
            normalizedBenchmark.unshift({
              date: startDate,
              value: 100
            });
            
            // Reordenar por data após inserir
            normalizedBenchmark.sort((a, b) => 
              new Date(a.date).getTime() - new Date(b.date).getTime()
            );
          } else {
            // IBOV tem dados na data inicial ou antes - normalizar normalmente
            const benchmarkStartValue = benchmarkStartPoint.value;
            
            // Verificar se o benchmarkStartPoint está exatamente na startDate
            const benchmarkStartDate = new Date(benchmarkStartPoint.date);
            benchmarkStartDate.setHours(0, 0, 0, 0);
            const isExactMatch = benchmarkStartDate.getTime() === startDateObj.getTime();
            
            
            // Filtrar para incluir apenas pontos >= startDate
            // Se o benchmarkStartPoint está antes do startDate, ainda precisamos usá-lo para normalização
            // mas não incluí-lo no gráfico (já que o índice começa depois)
            const ibovToNormalize = sortedIBOV.filter(b => {
              const bDate = new Date(b.date);
              bDate.setHours(0, 0, 0, 0);
              return bDate.getTime() >= startDateObj.getTime();
            });
            
            
            // Normalizar usando o valor do benchmarkStartPoint como base
            normalizedBenchmark = ibovToNormalize.map(point => ({
              date: point.date,
              value: (point.value / benchmarkStartValue) * 100
            }));
            
            
            // Se o benchmarkStartPoint não está na data exata, criar um ponto na startDate com valor 100
            if (!isExactMatch) {
              normalizedBenchmark.unshift({
                date: startDate,
                value: 100
              });
              
              // Reordenar por data após inserir
              normalizedBenchmark.sort((a, b) => 
                new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              
            } else {
              // Se está na data exata, garantir que o primeiro ponto normalizado seja 100
              if (normalizedBenchmark.length > 0 && normalizedBenchmark[0].date === startDate) {
                normalizedBenchmark[0].value = 100;
              }
            }
          }
        }
      }
    }

    // Combinar dados por data
    const dataMap = new Map<string, { 
      date: string; 
      index: number; 
      dailyChange: number | null;
      benchmark: number | null;
      dividendsReceived: number | null;
      dividendsByTicker: Record<string, number> | null;
    }>();

    indexPoints.forEach(point => {
      dataMap.set(point.date, {
        date: point.date,
        index: point.index,
        dailyChange: point.dailyChange,
        benchmark: null,
        dividendsReceived: point.dividendsReceived,
        dividendsByTicker: point.dividendsByTicker
      });
    });

    // Alinhar benchmark com dados do índice
    // Para cada ponto do benchmark, encontrar o ponto do índice mais próximo
    
    // Primeiro, alinhar pontos do benchmark com datas exatas do índice
    // IMPORTANTE: Apenas processar pontos do benchmark que estão dentro do período do índice
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    
    normalizedBenchmark.forEach(benchmarkPoint => {
      const benchmarkDateObj = new Date(benchmarkPoint.date);
      benchmarkDateObj.setHours(0, 0, 0, 0);
      
      // Ignorar pontos do benchmark que estão além da última data do índice
      if (benchmarkDateObj.getTime() > endDateObj.getTime()) {
        return;
      }
      
      const existing = dataMap.get(benchmarkPoint.date);
      if (existing) {
        // Data exata existe no índice
        existing.benchmark = benchmarkPoint.value;
      } else {
        // Data não existe no índice mas está dentro do período - encontrar o ponto do índice mais próximo (anterior ou igual)
        let closestIndexPoint = null;
        let closestDateDiff = Infinity;
        
        indexPoints.forEach(indexPoint => {
          const dateDiff = new Date(indexPoint.date).getTime() - benchmarkDateObj.getTime();
          // Procurar o ponto do índice mais próximo que seja <= data do benchmark
          if (dateDiff >= 0 && dateDiff < closestDateDiff) {
            closestDateDiff = dateDiff;
            closestIndexPoint = indexPoint;
          }
        });
        
        // Se não encontrou ponto anterior, usar o primeiro disponível
        if (!closestIndexPoint && indexPoints.length > 0) {
          closestIndexPoint = indexPoints[0];
        }
        
        if (closestIndexPoint) {
          dataMap.set(benchmarkPoint.date, {
            date: benchmarkPoint.date,
            index: closestIndexPoint.index,
            dailyChange: closestIndexPoint.dailyChange,
            benchmark: benchmarkPoint.value,
            dividendsReceived: closestIndexPoint.dividendsReceived,
            dividendsByTicker: closestIndexPoint.dividendsByTicker
          });
        }
      }
    });

    // Segundo, preencher datas do índice que não têm ponto correspondente no benchmark
    // Usar o último valor do benchmark disponível (anterior ou igual à data do índice)
    indexPoints.forEach(indexPoint => {
      const existing = dataMap.get(indexPoint.date);
      if (existing && existing.benchmark === null) {
        // Esta data do índice não tem benchmark correspondente
        // Buscar o último valor do benchmark disponível (anterior ou igual)
        let lastBenchmarkValue: number | null = null;
        let lastBenchmarkDate: string | null = null;
        
        normalizedBenchmark.forEach((benchmarkPoint: { date: string; value: number }) => {
          const benchmarkDate = new Date(benchmarkPoint.date).getTime();
          const indexDate = new Date(indexPoint.date).getTime();
          
          // Se o benchmark é anterior ou igual à data do índice
          if (benchmarkDate <= indexDate) {
            if (!lastBenchmarkDate || benchmarkDate > new Date(lastBenchmarkDate).getTime()) {
              lastBenchmarkValue = benchmarkPoint.value;
              lastBenchmarkDate = benchmarkPoint.date;
            }
          }
        });
        
        if (lastBenchmarkValue !== null && lastBenchmarkDate !== null) {
          const benchmarkNum = Number(lastBenchmarkValue);
          if (!isNaN(benchmarkNum)) {
            existing.benchmark = benchmarkNum;
          }
        }
      }
    });
    

    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [indexHistory, ibovData, cdiData, benchmark]);

  const benchmarkLabel = benchmark === 'ibov' ? 'IBOVESPA' : 'CDI';

  return (
    <section aria-labelledby="index-comparison-title" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="index-comparison-title" className="text-lg font-semibold tracking-tight text-foreground">
          Performance comparada
        </h2>
        <div role="group" aria-label="Benchmark" className="inline-flex rounded-lg bg-muted p-[3px]">
          {(['ibov', 'cdi'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={benchmark === key}
              onClick={() => setBenchmark(key)}
              className="min-h-11 rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-border focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-8"
            >
              {key === 'ibov' ? 'IBOVESPA' : 'CDI'}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="mt-4 flex h-64 items-center justify-center rounded-lg bg-surface text-sm text-muted-foreground">
          Ainda não há histórico suficiente para comparar.
        </div>
      ) : (
        <figure className="mt-4 space-y-2">
          <div className="h-72 sm:h-96">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickFormatter={(value: string) => formatShortDay(value)}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={['auto', 'auto']}
                  tickFormatter={(value: number) => formatNumber(value, { digits: 0 })}
                />
                <Tooltip cursor={{ stroke: 'var(--border)' }} content={<ComparisonTooltip benchmarkLabel={benchmarkLabel} />} />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="var(--chart-2)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                  name={benchmarkLabel}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="index"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                  name="Índice"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <LegendItem label="Índice" color="var(--chart-1)" />
            <LegendItem label={`${benchmarkLabel} (base 100 na mesma data)`} color="var(--chart-2)" dashed />
          </figcaption>
        </figure>
      )}
    </section>
  );
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' } as const;

/** `YYYY-MM-DD` → Date ao meio-dia UTC (evita trocar o dia por fuso). */
function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatShortDay(value: string): string {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

function LegendItem({ label, color, dashed = false }: { label: string; color: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="8" aria-hidden="true">
        <line x1="0" x2="16" y1="4" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </span>
  );
}

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: {
    dailyChange?: number | null;
    dividendsReceived?: number | null;
    dividendsByTicker?: Record<string, number> | null;
  };
}

function ComparisonTooltip({
  active,
  payload,
  label,
  benchmarkLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  benchmarkLabel: string;
}) {
  if (!active || !payload || payload.length === 0 || !label) return null;

  const data = payload[0].payload;
  const dailyChange = data?.dailyChange;
  const dividendsReceived = data?.dividendsReceived;
  const dividendsByTicker = data?.dividendsByTicker;
  const byTicker = dividendsByTicker ? Object.entries(dividendsByTicker) : [];
  const rows = (['index', 'benchmark'] as const)
    .map((key) => payload.find((entry) => entry.dataKey === key))
    .filter((entry): entry is TooltipPayloadEntry => entry !== undefined && typeof entry.value === 'number');

  return (
    <div className="max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">{formatDate(parseDay(label))}</p>
      {rows.map((entry) => (
        <p key={entry.dataKey} className="flex justify-between gap-4">
          <span>{entry.dataKey === 'index' ? 'Índice' : benchmarkLabel}</span>
          <span className="font-medium tabular-nums">{formatNumber(entry.value, { digits: 2 })} pts</span>
        </p>
      ))}
      {typeof dailyChange === 'number' && (
        <p className="mt-1 flex justify-between gap-4 border-t border-border pt-1">
          <span className="text-muted-foreground">Variação do dia</span>
          <span className={`font-medium tabular-nums ${dailyChange > 0 ? 'text-positive' : dailyChange < 0 ? 'text-negative' : ''}`}>
            {formatDeltaPct(dailyChange / 100, { digits: 2 })}
          </span>
        </p>
      )}
      {typeof dividendsReceived === 'number' && dividendsReceived > 0 && (
        <div className="mt-1 border-t border-border pt-1">
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Dividendos</span>
            <span className="font-medium tabular-nums">{formatNumber(dividendsReceived, { digits: 2 })} pts</span>
          </p>
          {byTicker.slice(0, 3).map(([ticker, amount]) => (
            <p key={ticker} className="flex justify-between gap-4 text-muted-foreground">
              <span>{ticker}</span>
              <span className="tabular-nums">{formatBRL(Number(amount))}</span>
            </p>
          ))}
          {byTicker.length > 3 && <p className="text-muted-foreground">e mais {byTicker.length - 3}</p>}
        </div>
      )}
    </div>
  );
}
