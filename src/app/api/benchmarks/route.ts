import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { format, parseISO } from 'date-fns';

// Interfaces
interface BenchmarkDataPoint {
  date: string;
  value: number;
}

/**
 * Busca dados do CDI via API do Banco Central
 */
async function fetchCdiData(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  try {
    const startStr = format(startDate, 'dd/MM/yyyy');
    const endStr = format(endDate, 'dd/MM/yyyy');
    
    // SGS 12 = CDI
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${startStr}&dataFinal=${endStr}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('❌ Erro ao buscar CDI:', response);
      return [];
    }
    
    const data = await response.json();

    console.log('🔍 Data do CDI:', data);
    
    // Transformar para formato padrão
    const transformedData: BenchmarkDataPoint[] = data.map((item: any) => {
      const [day, month, year] = item.data.split('/');
      const isoDate = `${year}-${month}-${day}`;
      
      return {
        date: isoDate,
        value: parseFloat(item.valor)
      };
    });
    
    console.log(`✅ CDI: ${transformedData.length} pontos de dados carregados`);
    return transformedData;
  } catch (error) {
    console.error('❌ Erro ao buscar dados do CDI:', error);
    return [];
  }
}

/**
 * Busca dados do IBOVESPA via BRAPI (com token PRO se disponível)
 */
async function fetchIbovData(startDate: Date, endDate: Date): Promise<BenchmarkDataPoint[]> {
  try {
    const diffYears = (endDate.getFullYear() - startDate.getFullYear());
    const range = diffYears >= 5 ? '10y' : diffYears >= 2 ? '5y' : diffYears >= 1 ? '2y' : '1y';

    // Token BRAPI do servidor
    const brapiToken = process.env.BRAPI_TOKEN;
    
    console.log('📊 Buscando IBOV via BRAPI:', brapiToken ? 'PRO ✅' : 'FREE');
    
    // Construir URL com token se disponível
    const brapiUrl = `https://brapi.dev/api/quote/%5EBVSP?range=${range}&interval=1mo${brapiToken ? `&token=${brapiToken}` : ''}`;
    
    try {
      const response = await fetch(brapiUrl, {
        next: { revalidate: 3600 } // Cache de 1 hora
      });

      if (response.ok) {
        const data = await response.json();
        
        console.log('✅ BRAPI Response Status:', response.status);
        
        const historicalData = data.results?.[0]?.historicalDataPrice || [];
        
        if (historicalData.length === 0) {
          console.warn('⚠️ BRAPI retornou dados vazios');
        }
        
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();
        const periodDiff = endTime - startTime;
        
        // Se o período for muito curto (menos de 7 dias), expandir para incluir dados próximos
        const expandedStartTime = periodDiff < 7 * 24 * 60 * 60 * 1000 
          ? startTime - (30 * 24 * 60 * 60 * 1000)
          : startTime;
        const expandedEndTime = periodDiff < 7 * 24 * 60 * 60 * 1000
          ? endTime + (30 * 24 * 60 * 60 * 1000)
          : endTime;
        
        let transformedData: BenchmarkDataPoint[] = historicalData
          .filter((item: any) => {
            const itemTime = item.date * 1000;
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
              const date = new Date(item.date * 1000);
              const isoDate = date.toISOString().split('T')[0];
              
              return {
                date: isoDate,
                value: item.close
              };
            })
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }

        // Filtrar para manter apenas dados dentro do período original (se possível)
        if (transformedData.length > 0) {
          const filteredByOriginalPeriod = transformedData.filter(item => {
            const itemTime = new Date(item.date).getTime();
            return itemTime >= startTime && itemTime <= endTime;
          });
          
          let finalData = filteredByOriginalPeriod.length > 0 
            ? filteredByOriginalPeriod 
            : transformedData;
          
          // Verificar se temos dados do dia atual (endDate) - usar formato local
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(endDate.getDate()).padStart(2, '0');
          const endDateStr = `${endYear}-${endMonth}-${endDay}`;
          const hasTodayData = finalData.some(item => item.date === endDateStr);
          
          // Se não temos dados do dia atual, buscar do Yahoo Finance
          if (!hasTodayData) {
            console.log('📊 BRAPI não tem dados do dia atual, buscando do Yahoo Finance...');
            try {
              const todayPeriod1 = Math.floor((endDate.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000); // 7 dias atrás
              const todayPeriod2 = Math.floor(endDate.getTime() / 1000);
              const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${todayPeriod1}&period2=${todayPeriod2}&interval=1d`;
              
              const yahooResponse = await fetch(yahooUrl, {
                next: { revalidate: 300 } // Cache de 5 minutos para dados do dia atual
              });
              
              if (yahooResponse.ok) {
                const yahooData = await yahooResponse.json();
                const timestamps = yahooData.chart?.result?.[0]?.timestamp || [];
                const closes = yahooData.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
                
                // Buscar apenas dados do dia atual ou mais recente
                const todayData: BenchmarkDataPoint[] = [];
                for (let i = timestamps.length - 1; i >= 0; i--) {
                  const date = new Date(timestamps[i] * 1000);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const localDate = `${year}-${month}-${day}`;
                  
                  if (closes[i] && closes[i] > 0) {
                    todayData.push({
                      date: localDate,
                      value: closes[i]
                    });
                    
                    // Se encontramos o dia atual, parar
                    if (localDate === endDateStr) {
                      break;
                    }
                  }
                }
                
                if (todayData.length > 0) {
                  // Combinar dados do BRAPI com Yahoo Finance, removendo duplicatas
                  const existingDates = new Set(finalData.map(d => d.date));
                  const newData = todayData.filter(d => !existingDates.has(d.date));
                  finalData = [...finalData, ...newData].sort((a, b) => 
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                  );
                  console.log(`✅ Adicionados ${newData.length} pontos do Yahoo Finance (dia atual)`);
                }
              }
            } catch (yahooError) {
              console.warn('⚠️ Erro ao buscar dados do dia atual do Yahoo Finance:', yahooError);
            }
          }
          
          console.log(`✅ IBOV: ${finalData.length} pontos de dados carregados via BRAPI${hasTodayData ? '' : ' + Yahoo Finance'}`);
          return finalData;
        } else {
          console.warn('⚠️ Nenhum dado IBOV após filtragem');
        }
      } else {
        console.error('❌ BRAPI Response Error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ BRAPI Error Body:', errorText);
      }
    } catch (brapiError) {
      console.error('❌ BRAPI falhou:', brapiError);
    }

    // Fallback: Yahoo Finance via servidor
    console.log('🔄 Tentando Yahoo Finance como fallback...');
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${period1}&period2=${period2}&interval=1mo`;

    const yahooResponse = await fetch(yahooUrl);
    
    if (yahooResponse.ok) {
      const yahooData = await yahooResponse.json();
      const timestamps = yahooData.chart?.result?.[0]?.timestamp || [];
      const closes = yahooData.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];

      const transformedData: BenchmarkDataPoint[] = timestamps
        .map((timestamp: number, index: number) => {
          const date = new Date(timestamp * 1000);
          const isoDate = date.toISOString().split('T')[0];
          
          return {
            date: isoDate,
            value: closes[index]
          };
        })
        .filter((item: BenchmarkDataPoint) => item.value !== null);

      console.log(`✅ IBOV: ${transformedData.length} pontos de dados carregados via Yahoo Finance`);
      return transformedData;
    }

    console.error('❌ Todos os métodos de busca do IBOV falharam');
    return [];
  } catch (error) {
    console.error('❌ Erro ao buscar dados do IBOV:', error);
    return [];
  }
}

/**
 * GET /api/benchmarks
 * Busca dados de benchmarks (CDI e IBOV) para um período específico
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'startDate e endDate são obrigatórios' },
        { status: 400 }
      );
    }

    const startDate = parseISO(startDateStr);
    const endDate = parseISO(endDateStr);

    console.log('📊 [API Benchmarks] Buscando dados:', startDateStr, '-', endDateStr);

    // Buscar dados em paralelo
    const [cdiData, ibovData] = await Promise.all([
      fetchCdiData(startDate, endDate),
      fetchIbovData(startDate, endDate)
    ]);

    return NextResponse.json({
      cdi: cdiData,
      ibov: ibovData,
      period: {
        start: startDateStr,
        end: endDateStr
      }
    });
  } catch (error) {
    console.error('❌ [API Benchmarks] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar benchmarks' },
      { status: 500 }
    );
  }
}

