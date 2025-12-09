/**
 * Serviço para buscar dados de benchmarks (CDI e IBOVESPA)
 * Utiliza APIs gratuitas brasileiras
 */

interface BenchmarkDataPoint {
  date: string;
  value: number;
}

interface BenchmarkData {
  cdi: BenchmarkDataPoint[];
  ibov: BenchmarkDataPoint[];
}

/**
 * Busca dados do CDI do Banco Central do Brasil
 * API SGS - Sistema Gerenciador de Séries Temporais
 * Série 12: CDI (taxa diária %)
 */
async function fetchCDIData(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  try {
    // Formatar datas para o formato dd/MM/yyyy
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const dataInicial = formatDate(startDate);
    const dataFinal = formatDate(endDate);

    // API do Banco Central - Série 12: CDI (taxa diária %)
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro ao buscar dados do CDI: ${response.status}`);
    }

    const data = await response.json();

    console.log('🔍 Data do CDI:', data);
    
    // Transformar dados para o formato padronizado
    // API retorna: [{ data: "dd/MM/yyyy", valor: "x.xx" }]
    const transformedData: BenchmarkDataPoint[] = data.map((item: any) => {
      // Converter data de dd/MM/yyyy para yyyy-MM-dd
      const [day, month, year] = item.data.split('/');
      const isoDate = `${year}-${month}-${day}`;
      
      return {
        date: isoDate,
        value: parseFloat(item.valor)
      };
    });

    return transformedData;
  } catch (error) {
    console.error('Erro ao buscar dados do CDI:', error);
    return [];
  }
}

/**
 * Busca dados do IBOVESPA via BRAPI
 * Alternativa gratuita para dados de bolsa brasileira
 * Usa BRAPI_TOKEN se disponível para acesso PRO
 */
async function fetchIBOVData(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  try {
    // Calcular diferença em anos para definir o range
    const diffYears = (endDate.getFullYear() - startDate.getFullYear());
    const range = diffYears >= 5 ? '10y' : diffYears >= 2 ? '5y' : diffYears >= 1 ? '2y' : '1y';

    // Token BRAPI (se disponível, usa plano PRO)
    const brapiToken = process.env.BRAPI_TOKEN;
    
    // Tentar BRAPI primeiro - Token deve ir no query string
    const brapiUrl = `https://brapi.dev/api/quote/%5EBVSP?range=${range}&interval=1mo${brapiToken ? `&token=${brapiToken}` : ''}`;
    
    try {
      const response = await fetch(brapiUrl, {
        // BRAPI não precisa de Authorization header, apenas token no query string
        next: { revalidate: 3600 } // Cache de 1 hora
      });

      if (response.ok) {
        const data = await response.json();
        
        // BRAPI retorna: { results: [{ historicalDataPrice: [...] }] }
        const historicalData = data.results?.[0]?.historicalDataPrice || [];
        
        if (historicalData.length === 0) {
          console.warn('⚠️ BRAPI retornou dados vazios');
        }
        
        // Filtrar dados pelo período desejado
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();
        const periodDiff = endTime - startTime;
        
        // Se o período for muito curto (menos de 7 dias), expandir para incluir dados próximos
        // Isso resolve o problema quando startDate e endDate são iguais ou muito próximos
        const expandedStartTime = periodDiff < 7 * 24 * 60 * 60 * 1000 
          ? startTime - (30 * 24 * 60 * 60 * 1000) // Expandir 30 dias antes
          : startTime;
        const expandedEndTime = periodDiff < 7 * 24 * 60 * 60 * 1000
          ? endTime + (30 * 24 * 60 * 60 * 1000) // Expandir 30 dias depois
          : endTime;
        
        let transformedData: BenchmarkDataPoint[] = historicalData
          .filter((item: any) => {
            const itemTime = item.date * 1000; // Converter de segundos para milissegundos
            return itemTime >= expandedStartTime && itemTime <= expandedEndTime;
          })
          .map((item: any) => {
            // Converter timestamp Unix para Date local
            const date = new Date(item.date * 1000);
            // Formatar data em timezone local (YYYY-MM-DD) para evitar problemas de timezone
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const localDate = `${year}-${month}-${day}`;
            
            return {
              date: localDate,
              value: item.close
            };
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Se ainda não temos dados após expandir, usar todos os dados disponíveis
        if (transformedData.length === 0 && historicalData.length > 0) {
          console.log('⚠️ Nenhum dado no período expandido, usando todos os dados disponíveis');
          transformedData = historicalData
            .map((item: any) => {
              // Converter timestamp Unix para Date local
              const date = new Date(item.date * 1000);
              // Formatar data em timezone local (YYYY-MM-DD) para evitar problemas de timezone
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const localDate = `${year}-${month}-${day}`;
              
              return {
                date: localDate,
                value: item.close
              };
            })
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }

        // Filtrar para manter apenas dados dentro do período original (se possível)
        // Mas manter pelo menos alguns dados se o período original não tiver correspondência
        if (transformedData.length > 0) {
          const filteredByOriginalPeriod = transformedData.filter(item => {
            const itemTime = new Date(item.date).getTime();
            return itemTime >= startTime && itemTime <= endTime;
          });
          
          // Se temos dados no período original, usar eles. Caso contrário, usar os expandidos
          let finalData = filteredByOriginalPeriod.length > 0 
            ? filteredByOriginalPeriod 
            : transformedData;
          
          // Buscar dados diários do Yahoo Finance para preencher todos os dias úteis
          try {
            // Buscar dados diários do período completo
            // Usar biblioteca yahoo-finance2 em vez de requisição direta
            const { loadYahooFinance } = await import('./yahoo-finance-loader');
            const yahooFinance = await loadYahooFinance();
            if (!yahooFinance) {
              throw new Error('This code can only run on the server');
            }
            
            const chartData = await yahooFinance.chart('^BVSP', {
              period1: startDate,
              period2: endDate,
              interval: '1d',
              return: 'array'
            });
            
            // Extrair dados do formato da biblioteca
            const quotes = Array.isArray(chartData) ? chartData : (chartData?.quotes || []);
            
            // Converter todos os dados do Yahoo Finance para o formato padronizado
            const yahooDataPoints: BenchmarkDataPoint[] = [];
            for (const quote of quotes) {
              if (!quote || !quote.date || !quote.close || quote.close <= 0) continue;
              
              const date = new Date(quote.date);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const localDate = `${year}-${month}-${day}`;
              
              yahooDataPoints.push({
                date: localDate,
                value: quote.close
              });
            }
            
            if (yahooDataPoints.length > 0) {
              // Combinar dados do BRAPI com Yahoo Finance
              // Yahoo Finance tem prioridade para datas que existem em ambos (dados mais recentes)
              const existingDates = new Set(finalData.map(d => d.date));
              const newData = yahooDataPoints.filter(d => !existingDates.has(d.date));
              
              // Para datas que existem em ambos, usar Yahoo Finance (mais atualizado)
              const yahooDates = new Set(yahooDataPoints.map(d => d.date));
              const updatedData = finalData.map(d => {
                if (yahooDates.has(d.date)) {
                  const yahooPoint = yahooDataPoints.find(y => y.date === d.date);
                  return yahooPoint || d;
                }
                return d;
              });
              
              finalData = [...updatedData, ...newData].sort((a, b) => 
                new Date(a.date).getTime() - new Date(b.date).getTime()
              );
            }
          } catch (yahooError) {
            console.warn('⚠️ Erro ao buscar dados diários do Yahoo Finance:', yahooError);
          }
          
          return finalData;
        } else {
          console.warn('⚠️ Nenhum dado IBOV após filtragem/transformação');
        }
      } else {
        console.error('❌ BRAPI Response Error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ BRAPI Error Body:', errorText);
      }
    } catch (brapiError) {
      console.error('❌ BRAPI falhou:', brapiError);
      console.log('🔄 Tentando Yahoo Finance como fallback...');
    }

    // Fallback: Yahoo Finance usando biblioteca yahoo-finance2
    try {
      const { loadYahooFinance } = await import('./yahoo-finance-loader');
      const yahooFinance = await loadYahooFinance();
      if (!yahooFinance) {
        throw new Error('This code can only run on the server');
      }
      
      const chartData = await yahooFinance.chart('^BVSP', {
        period1: startDate,
        period2: endDate,
        interval: '1mo',
        return: 'array'
      });
      
      // Extrair dados do formato da biblioteca
      const quotes = Array.isArray(chartData) ? chartData : (chartData?.quotes || []);
      
      const transformedData: BenchmarkDataPoint[] = quotes
        .filter((q: any) => q && q.date && q.close && q.close > 0)
        .map((quote: any) => {
          const date = new Date(quote.date);
          // Formatar data em timezone local (YYYY-MM-DD) para evitar problemas de timezone
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const localDate = `${year}-${month}-${day}`;
          
          return {
            date: localDate,
            value: quote.close
          };
        });

      return transformedData;
    } catch (error) {
      console.error('Erro ao buscar dados do IBOV:', error);
      return [];
    }
  } catch (error) {
    console.error('Erro ao buscar dados do IBOV:', error);
    return [];
  }
}

/**
 * Normaliza dados de benchmark para começar em um valor base (ex: 100)
 * Útil para comparar performance relativa
 */
function normalizeBenchmarkData(
  data: BenchmarkDataPoint[],
  baseValue: number = 100
): BenchmarkDataPoint[] {
  if (data.length === 0) return [];
  
  const firstValue = data[0].value;
  
  return data.map(point => ({
    date: point.date,
    value: (point.value / firstValue) * baseValue
  }));
}

/**
 * Calcula retorno acumulado de um benchmark
 */
function calculateBenchmarkReturn(data: BenchmarkDataPoint[]): number {
  if (data.length < 2) return 0;
  
  const firstValue = data[0].value;
  const lastValue = data[data.length - 1].value;
  
  return ((lastValue - firstValue) / firstValue);
}

/**
 * Alinha dados de benchmark com datas do backtest
 * Importante: Usa interpolação linear para datas faltantes
 */
function alignBenchmarkDates(
  benchmarkData: BenchmarkDataPoint[],
  backtestDates: string[]
): BenchmarkDataPoint[] {
  if (benchmarkData.length === 0 || backtestDates.length === 0) return [];
  // Criar mapa de datas de benchmark para busca rápida
  const benchmarkMap = new Map(
    benchmarkData.map(item => [item.date, item.value])
  );

  // Para cada data do backtest, encontrar valor correspondente
  const alignedData: BenchmarkDataPoint[] = backtestDates.map((date, index) => {
    // Se temos o valor exato, usar ele
    if (benchmarkMap.has(date)) {
      return {
        date,
        value: benchmarkMap.get(date)!
      };
    }

    // Caso contrário, interpolar entre valores próximos
    const dateTime = new Date(date).getTime();
    
    // Encontrar valor anterior mais próximo
    let prevValue = null;
    let prevTime = 0;
    for (const benchItem of benchmarkData) {
      const benchTime = new Date(benchItem.date).getTime();
      if (benchTime <= dateTime && benchTime > prevTime) {
        prevValue = benchItem.value;
        prevTime = benchTime;
      }
    }

    // Encontrar valor posterior mais próximo
    let nextValue = null;
    let nextTime = Infinity;
    for (const benchItem of benchmarkData) {
      const benchTime = new Date(benchItem.date).getTime();
      if (benchTime >= dateTime && benchTime < nextTime) {
        nextValue = benchItem.value;
        nextTime = benchTime;
      }
    }

    // Interpolar
    if (prevValue !== null && nextValue !== null && prevTime !== nextTime) {
      const ratio = (dateTime - prevTime) / (nextTime - prevTime);
      const interpolatedValue = prevValue + (nextValue - prevValue) * ratio;
      return { date, value: interpolatedValue };
    }

    // Se só temos um lado, usar ele
    if (prevValue !== null) {
      return { date, value: prevValue };
    }
    if (nextValue !== null) {
      return { date, value: nextValue };
    }

    // Último caso: usar o primeiro valor disponível
    return {
      date,
      value: benchmarkData[0]?.value || 0
    };
  });

  return alignedData;
}

/**
 * Função principal para buscar todos os benchmarks
 */
export async function fetchBenchmarkData(
  startDate: Date,
  endDate: Date
): Promise<BenchmarkData> {
  try {
    const [cdiData, ibovData] = await Promise.all([
      fetchCDIData(startDate, endDate),
      fetchIBOVData(startDate, endDate)
    ]);

    return {
      cdi: cdiData,
      ibov: ibovData
    };
  } catch (error) {
    console.error('❌ Erro ao buscar dados de benchmarks:', error);
    return {
      cdi: [],
      ibov: []
    };
  }
}

// Exportar funções utilitárias
export {
  normalizeBenchmarkData,
  calculateBenchmarkReturn,
  alignBenchmarkDates
};

export type { BenchmarkDataPoint, BenchmarkData };

