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
    dailyChange?: number | null;
    dividendsReceived?: number | null;
    dividendsByTicker?: Record<string, number> | null;
  }>;
  ibovData?: Array<{ date: string; value: number }>;
  cdiData?: Array<{ date: string; value: number }>;
  indexColor: string;
}

/**
 * Converte cor hexadecimal para HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remove o # se presente
  hex = hex.replace('#', '');
  
  // Converter para RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Calcula cores contrastantes para benchmarks baseadas na cor do índice
 * Garante que IBOV e CDI tenham cores bem diferentes da cor do índice
 */
function getContrastingBenchmarkColors(indexColor: string): { ibov: string; cdi: string } {
  const indexHsl = hexToHsl(indexColor);
  const indexHue = indexHsl.h;
  
  // Cores padrão para benchmarks
  const defaultIbov = '#2563eb'; // Azul
  const defaultCdi = '#10b981';  // Verde
  
  // Se a cor do índice for muito próxima das cores padrão, ajustar
  const ibovHsl = hexToHsl(defaultIbov);
  const cdiHsl = hexToHsl(defaultCdi);
  
  // Calcular diferença de matiz (hue) entre índice e benchmarks
  const hueDiffIbov = Math.abs(indexHue - ibovHsl.h);
  const hueDiffCdi = Math.abs(indexHue - cdiHsl.h);
  
  // Se a diferença for muito pequena (< 30 graus), ajustar para cores mais contrastantes
  let ibovColor = defaultIbov;
  let cdiColor = defaultCdi;
  
  // Verificar primeiro casos específicos de cores do índice
  
  // Se o índice é laranja/amarelo (como IPJ-CRESCIMENTO #f59e0b), garantir contraste forte
  if (indexHue >= 30 && indexHue <= 60) {
    // Índice é laranja/amarelo - usar azul para IBOV e verde escuro para CDI
    ibovColor = '#2563eb'; // Azul (contraste forte com laranja)
    cdiColor = '#059669';  // Verde escuro (contraste forte com laranja)
  }
  // Se o índice é vermelho (330-360 ou 0-10 graus)
  else if (indexHue >= 330 || indexHue <= 10) {
    ibovColor = '#2563eb'; // Azul
    cdiColor = '#10b981';  // Verde
  }
  // Se o índice é próximo do azul (IBOV padrão), usar cores alternativas
  else if (hueDiffIbov < 30 || hueDiffIbov > 330) {
    // Índice é azul/ciano - usar laranja para IBOV e verde escuro para CDI
    ibovColor = '#f59e0b'; // Laranja
    cdiColor = '#059669';  // Verde escuro
  }
  // Se o índice é próximo do verde (CDI padrão), usar cores alternativas
  else if (hueDiffCdi < 30 || hueDiffCdi > 330) {
    // Índice é verde - usar azul para IBOV e vermelho para CDI
    ibovColor = '#2563eb'; // Azul
    cdiColor = '#dc2626';  // Vermelho
  }
  // Caso padrão: usar cores padrão (já definidas acima)
  
  return { ibov: ibovColor, cdi: cdiColor };
}

export function IndexComparisonChart({
  indexHistory,
  ibovData = [],
  cdiData = [],
  indexColor
}: IndexComparisonChartProps) {
  const [benchmark, setBenchmark] = useState<'ibov' | 'cdi'>('ibov');
  
  // Calcular cores contrastantes para benchmarks
  const benchmarkColors = useMemo(() => 
    getContrastingBenchmarkColors(indexColor),
    [indexColor]
  );

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
          
          console.log(`📊 [IBOV] Total pontos: ${sortedIBOV.length}, Após startDate: ${ibovAfterStart.length}, StartDate: ${startDate}, Primeiro IBOV: ${sortedIBOV[0]?.date}, Último IBOV: ${sortedIBOV[sortedIBOV.length - 1]?.date}, benchmarkStartPoint: ${benchmarkStartPoint?.date}`);
          
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
            
            console.log(`📊 [IBOV] benchmarkStartValue: ${benchmarkStartValue}, isExactMatch: ${isExactMatch}, benchmarkStartDate: ${benchmarkStartPoint.date}`);
            
            // Filtrar para incluir apenas pontos >= startDate
            // Se o benchmarkStartPoint está antes do startDate, ainda precisamos usá-lo para normalização
            // mas não incluí-lo no gráfico (já que o índice começa depois)
            const ibovToNormalize = sortedIBOV.filter(b => {
              const bDate = new Date(b.date);
              bDate.setHours(0, 0, 0, 0);
              return bDate.getTime() >= startDateObj.getTime();
            });
            
            console.log(`📊 [IBOV] ibovToNormalize: ${ibovToNormalize.length} pontos, datas: ${ibovToNormalize.map(b => b.date).join(', ')}`);
            
            // Normalizar usando o valor do benchmarkStartPoint como base
            normalizedBenchmark = ibovToNormalize.map(point => ({
              date: point.date,
              value: (point.value / benchmarkStartValue) * 100
            }));
            
            console.log(`📊 [IBOV] normalizedBenchmark após normalização: ${normalizedBenchmark.length} pontos`);
            normalizedBenchmark.forEach(b => {
              console.log(`  - ${b.date}: ${b.value.toFixed(2)} pts`);
            });
            
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
              
              console.log(`📊 [IBOV] Adicionado ponto virtual em ${startDate} com 100 pts`);
            } else {
              // Se está na data exata, garantir que o primeiro ponto normalizado seja 100
              if (normalizedBenchmark.length > 0 && normalizedBenchmark[0].date === startDate) {
                normalizedBenchmark[0].value = 100;
                console.log(`📊 [IBOV] Primeiro ponto (${startDate}) ajustado para 100 pts`);
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
    console.log(`📊 [CHART] Combinando dados: ${normalizedBenchmark.length} pontos do benchmark, ${indexPoints.length} pontos do índice`);
    console.log(`📊 [CHART] Datas do índice: ${indexPoints.map(p => p.date).join(', ')}`);
    console.log(`📊 [CHART] Datas do benchmark: ${normalizedBenchmark.map(b => b.date).join(', ')}`);
    
    // Primeiro, alinhar pontos do benchmark com datas exatas do índice
    // IMPORTANTE: Apenas processar pontos do benchmark que estão dentro do período do índice
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    
    normalizedBenchmark.forEach(benchmarkPoint => {
      const benchmarkDateObj = new Date(benchmarkPoint.date);
      benchmarkDateObj.setHours(0, 0, 0, 0);
      
      // Ignorar pontos do benchmark que estão além da última data do índice
      if (benchmarkDateObj.getTime() > endDateObj.getTime()) {
        console.log(`📊 [CHART] ⏭️ Benchmark ${benchmarkPoint.date}: ${benchmarkPoint.value.toFixed(2)} pts ignorado (além da última data do índice: ${endDate})`);
        return;
      }
      
      const existing = dataMap.get(benchmarkPoint.date);
      if (existing) {
        // Data exata existe no índice
        existing.benchmark = benchmarkPoint.value;
        console.log(`📊 [CHART] ✅ Benchmark ${benchmarkPoint.date}: ${benchmarkPoint.value.toFixed(2)} pts (data exata encontrada no índice)`);
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
          console.log(`📊 [CHART] ✅ Benchmark ${benchmarkPoint.date}: ${benchmarkPoint.value.toFixed(2)} pts adicionado ao gráfico`);
        } else {
          console.log(`📊 [CHART] ❌ Benchmark ${benchmarkPoint.date}: não foi possível encontrar ponto correspondente do índice`);
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
            console.log(`📊 [CHART] ✅ Índice ${indexPoint.date}: Benchmark preenchido com último valor disponível (${lastBenchmarkDate}): ${benchmarkNum.toFixed(2)} pts`);
          }
        } else {
          console.log(`📊 [CHART] ⚠️ Índice ${indexPoint.date}: Nenhum valor de benchmark disponível anterior ou igual`);
        }
      }
    });
    
    console.log(`📊 [CHART] Dados finais combinados: ${Array.from(dataMap.values()).length} pontos`);
    Array.from(dataMap.values()).forEach(d => {
      console.log(`  - ${d.date}: Índice=${d.index?.toFixed(2) || 'N/A'}, Benchmark=${d.benchmark?.toFixed(2) || 'N/A'}`);
    });

    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [indexHistory, ibovData, cdiData, benchmark]);

  const formatDate = (date: string) => {
    // Converter string de data (YYYY-MM-DD) para Date local (evitar problemas de timezone)
    // Criar data em timezone local ao invés de UTC
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return format(localDate, 'dd/MM/yyyy', { locale: ptBR });
  };

  const formatTooltipValue = (value: number) => {
    return `${value.toFixed(2)} pontos`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const dailyChange = data?.dailyChange;
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
        {dailyChange !== null && dailyChange !== undefined && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className={`text-xs font-semibold ${dailyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              Variação do Dia: {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%
            </p>
          </div>
        )}
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
                    // Converter string de data (YYYY-MM-DD) para Date local
                    const [year, month, day] = value.split('-').map(Number);
                    const localDate = new Date(year, month - 1, day);
                    return `${localDate.getDate()}/${localDate.getMonth() + 1}`;
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
                  stroke={benchmark === 'ibov' ? benchmarkColors.ibov : benchmarkColors.cdi}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  connectNulls={true}
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

