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
 * Série 4391: CDI acumulado no mês anualizado
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

    // API do Banco Central
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
    
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
    
    console.log('📊 Buscando IBOV via BRAPI:', brapiToken ? 'PRO' : 'FREE');
    console.log('🔗 URL BRAPI:', brapiUrl.replace(brapiToken || '', 'TOKEN_HIDDEN'));
    
    try {
      const response = await fetch(brapiUrl, {
        // BRAPI não precisa de Authorization header, apenas token no query string
        next: { revalidate: 3600 } // Cache de 1 hora
      });

      if (response.ok) {
        const data = await response.json();
        
        console.log('✅ BRAPI Response Status:', response.status);
        console.log('📦 BRAPI Data:', JSON.stringify(data, null, 2));
        
        // BRAPI retorna: { results: [{ historicalDataPrice: [...] }] }
        const historicalData = data.results?.[0]?.historicalDataPrice || [];
        
        if (historicalData.length === 0) {
          console.warn('⚠️ BRAPI retornou dados vazios');
        }
        
        // Filtrar dados pelo período desejado
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();
        
        const transformedData: BenchmarkDataPoint[] = historicalData
          .filter((item: any) => {
            const itemTime = item.date * 1000; // Converter de segundos para milissegundos
            return itemTime >= startTime && itemTime <= endTime;
          })
          .map((item: any) => {
            const date = new Date(item.date * 1000);
            const isoDate = date.toISOString().split('T')[0];
            
            return {
              date: isoDate,
              value: item.close
            };
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (transformedData.length > 0) {
          console.log(`✅ IBOV: ${transformedData.length} pontos de dados carregados via BRAPI`);
          return transformedData;
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

    // Fallback: Yahoo Finance
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${period1}&period2=${period2}&interval=1mo`;
    
    const response = await fetch(yahooUrl, {
      next: { revalidate: 3600 } // Cache de 1 hora
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar dados do IBOV: ${response.status}`);
    }

    const data = await response.json();
    
    // Yahoo Finance retorna estrutura complexa
    const timestamps = data.chart?.result?.[0]?.timestamp || [];
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    
    const transformedData: BenchmarkDataPoint[] = timestamps.map((timestamp: number, index: number) => {
      const date = new Date(timestamp * 1000);
      const isoDate = date.toISOString().split('T')[0];
      
      return {
        date: isoDate,
        value: closes[index] || 0
      };
    }).filter((item: BenchmarkDataPoint) => item.value > 0);

    return transformedData;
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

  console.log('🔍 ===== ALIGN BENCHMARK DATES =====');
  console.log('🔍 Total backtest dates:', backtestDates.length);
  console.log('🔍 Total benchmark data points:', benchmarkData.length);
  console.log('🔍 Últimas 3 datas do backtest:', backtestDates.slice(-3));
  console.log('🔍 Últimos 3 dados do benchmark:', benchmarkData.slice(-3));

  // Criar mapa de datas de benchmark para busca rápida
  const benchmarkMap = new Map(
    benchmarkData.map(item => [item.date, item.value])
  );

  // Para cada data do backtest, encontrar valor correspondente
  const alignedData: BenchmarkDataPoint[] = backtestDates.map((date, index) => {
    // Se temos o valor exato, usar ele
    if (benchmarkMap.has(date)) {
      if (index >= backtestDates.length - 3) {
        console.log(`🔍 Mês ${index}: Data ${date} - Match exato! Valor: ${benchmarkMap.get(date)}`);
      }
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
      if (index >= backtestDates.length - 3) {
        console.log(`🔍 Mês ${index}: Data ${date} - INTERPOLADO! Prev: ${prevValue}, Next: ${nextValue}, Resultado: ${interpolatedValue}`);
      }
      return { date, value: interpolatedValue };
    }

    // Se só temos um lado, usar ele
    if (prevValue !== null) {
      if (index >= backtestDates.length - 3) {
        console.log(`🔍 Mês ${index}: Data ${date} - Usando valor ANTERIOR: ${prevValue}`);
      }
      return { date, value: prevValue };
    }
    if (nextValue !== null) {
      if (index >= backtestDates.length - 3) {
        console.log(`🔍 Mês ${index}: Data ${date} - Usando valor POSTERIOR: ${nextValue}`);
      }
      return { date, value: nextValue };
    }

    // Último caso: usar o primeiro valor disponível
    if (index >= backtestDates.length - 3) {
      console.log(`🔍 Mês ${index}: Data ${date} - FALLBACK para primeiro valor: ${benchmarkData[0]?.value || 0}`);
    }
    return {
      date,
      value: benchmarkData[0]?.value || 0
    };
  });

  console.log('🔍 Total de dados alinhados:', alignedData.length);
  console.log('🔍 Últimos 3 dados alinhados:', alignedData.slice(-3));
  console.log('🔍 ===========================');

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
    console.log('📊 Buscando dados de benchmarks...');
    console.log('📅 Período:', startDate, 'até', endDate);

    const [cdiData, ibovData] = await Promise.all([
      fetchCDIData(startDate, endDate),
      fetchIBOVData(startDate, endDate)
    ]);

    console.log('✅ CDI:', cdiData.length, 'pontos de dados');
    console.log('✅ IBOV:', ibovData.length, 'pontos de dados');

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

