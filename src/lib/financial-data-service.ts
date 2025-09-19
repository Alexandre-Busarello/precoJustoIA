import { prisma } from '@/lib/prisma'

// Definir enum localmente já que o Prisma pode não ter gerado ainda
type ReportPeriod = 'YEARLY' | 'QUARTERLY'

// Tipos para os dados financeiros completos
export interface ComprehensiveFinancialData {
  company: {
    id: number
    ticker: string
    name: string
    sector: string | null
    industry: string | null
  }
  financialData: Record<string, unknown>[]
  balanceSheets: Record<string, unknown>[]
  incomeStatements: Record<string, unknown>[]
  cashflowStatements: Record<string, unknown>[]
  keyStatistics: Record<string, unknown>[]
  valueAddedStatements: Record<string, unknown>[]
}

// Função para serializar dados do Prisma (converter Decimals para números)
function serializePrismaData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }
  
  if (Array.isArray(data)) {
    return data.map(serializePrismaData)
  }
  
  if (typeof data === 'object') {
    // Se é um objeto Decimal do Prisma
    if (data && typeof data === 'object' && 'toNumber' in data && typeof (data as any).toNumber === 'function') {
      return (data as any).toNumber()
    }
    
    // Verificar se é um Decimal usando outras propriedades comuns
    if (data && typeof data === 'object' && 'toString' in data && 'valueOf' in data && 'constructor' in data) {
      const constructor = (data as any).constructor
      if (constructor && constructor.name === 'Decimal') {
        return Number((data as any).toString())
      }
    }
    
    // Se é um Date, converter para string ISO
    if (data instanceof Date) {
      return data.toISOString()
    }
    
    // Se é um objeto comum, serializar recursivamente
    const serialized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializePrismaData(value)
    }
    return serialized
  }
  
  return data
}

// Função para determinar se uma empresa é do setor financeiro
export function isFinancialSector(sector: string | null, industry: string | null, ticker?: string): boolean {
  if (!sector && !industry && !ticker) return false
  
  // Tickers específicos conhecidos de empresas financeiras/seguradoras
  const knownFinancialTickers = [
    'BBSE3', 'SULA11', 'PSSA3', 'BBAS3', 'ITUB4', 'SANB11', 
    'BPAC11', 'BRSR6', 'PINE4', 'WIZS3', 'ABCB4', 'BPAN4'
  ]
  
  if (ticker && knownFinancialTickers.includes(ticker.toUpperCase())) {
    console.log('🏦 Ticker financeiro conhecido detectado:', ticker)
    return true
  }
  
  const financialKeywords = [
    'financial', 'insurance', 'bank', 'seguros', 'financeiro', 
    'previdência', 'capitalização', 'crédito', 'investimento',
    'seguridade', 'participações', 'holdings', 'caixa', 'bancário',
    'vida e previdência', 'corretora', 'asset management'
  ]
  
  const sectorLower = sector?.toLowerCase() || ''
  const industryLower = industry?.toLowerCase() || ''
  
  const isFinancial = financialKeywords.some(keyword => 
    sectorLower.includes(keyword) || industryLower.includes(keyword)
  )
  
  console.log('🔍 Verificando setor financeiro:', {
    ticker,
    sector,
    industry,
    sectorLower,
    industryLower,
    isFinancial
  })
  
  return isFinancial
}

// Função para aplicar fallbacks para empresas financeiras
export function applyFinancialSectorFallbacks(data: Record<string, unknown>, isFinancial: boolean): Record<string, unknown> {
  if (!isFinancial) return data
  
  // Converter valores para números quando necessário
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return value
    if (typeof value === 'string') return parseFloat(value)
    if (value && typeof value === 'object' && 'toNumber' in value) {
      return (value as { toNumber: () => number }).toNumber()
    }
    return null
  }
  
  const netIncome = toNumber(data.netIncome)
  const operatingIncome = toNumber(data.operatingIncome)
  const totalRevenue = toNumber(data.totalRevenue)
  const receitaTotal = toNumber(data.receitaTotal)
  const margemLiquida = toNumber(data.margemLiquida)
  
  // Para empresas financeiras, usar indicadores equivalentes quando os tradicionais são NULL
  const result = {
    ...data,
    // Se receita total é NULL, usar resultado operacional como proxy
    receitaTotal: receitaTotal || operatingIncome || totalRevenue || null,
    
    // Se margem líquida é NULL, calcular usando lucro líquido / resultado operacional
    margemLiquida: margemLiquida || (
      netIncome && operatingIncome && operatingIncome > 0
        ? netIncome / operatingIncome
        : null
    ),
    
    // Se margem bruta é NULL, usar margem operacional se disponível
    margemBruta: data.margemBruta || data.operatingMargins || null,
    
    // Se EBITDA é NULL, usar resultado operacional
    ebitda: data.ebitda || operatingIncome || null,
    
    // Marcar que foram aplicados fallbacks
    _hasFinancialFallbacks: true
  }
  
  return result
}

// Cache otimizado para evitar consultas repetidas (válido por 15 minutos)
const dataCache = new Map<string, { data: ComprehensiveFinancialData; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

// Cache adicional para consultas de demonstrações financeiras (válido por 30 minutos)
const statementsCache = new Map<string, { data: any[]; timestamp: number }>();
const STATEMENTS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

// Cache para múltiplas empresas (válido por 20 minutos)
const multiCompaniesCache = new Map<string, { data: ComprehensiveFinancialData[]; timestamp: number }>();
const MULTI_COMPANIES_CACHE_DURATION = 20 * 60 * 1000; // 20 minutos

// Buscar dados financeiros completos de uma empresa
export async function getComprehensiveFinancialData(
  ticker: string,
  period: ReportPeriod = 'QUARTERLY',
  yearsBack: number = 3
): Promise<ComprehensiveFinancialData | null> {
  try {
    // Verificar cache primeiro
    const cacheKey = `${ticker}-${period}-${yearsBack}`;
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📋 Usando dados do cache para', ticker);
      return cached.data;
    }

    const currentYear = new Date().getFullYear()
    const startYear = currentYear - yearsBack
    const startDate = new Date(`${startYear}-01-01`)

    // Verificar cache de statements primeiro
    const statementsKey = `statements-${ticker}-${period}-${yearsBack}`;
    const cachedStatements = statementsCache.get(statementsKey);
    if (cachedStatements && Date.now() - cachedStatements.timestamp < STATEMENTS_CACHE_DURATION) {
      console.log('📋 Usando statements do cache para', ticker);
      // Reconstruir o objeto de dados a partir do cache (dados já serializados)
      const [company, financialData, balanceSheets, incomeStatements, cashflowStatements, keyStatistics, valueAddedStatements] = cachedStatements.data;
      
      // Os dados do cache já estão serializados, então não precisamos aplicar serializePrismaData novamente
      // Apenas aplicar fallbacks se necessário
      const isFinancial = isFinancialSector(company.sector, company.industry)
      const processedIncomeStatements = incomeStatements.map((data: any) => 
        applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
      )
      const processedFinancialData = financialData.map((data: any, index: number) => {
        let processedData = applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
        if (isFinancial && processedIncomeStatements[index]) {
          const incomeData = processedIncomeStatements[index]
          if (!processedData.receitaTotal && incomeData.totalRevenue) {
            processedData.receitaTotal = incomeData.totalRevenue
          }
          if (!processedData.margemLiquida && incomeData.netIncome && incomeData.totalRevenue) {
            processedData.margemLiquida = Number(incomeData.netIncome) / Number(incomeData.totalRevenue)
          }
        }
        return processedData
      })

      // Dados já estão serializados do cache, apenas retornar
      const serializedData = {
        company: {
          id: company.id,
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          industry: company.industry
        },
        financialData: processedFinancialData as Record<string, unknown>[],
        balanceSheets: balanceSheets as Record<string, unknown>[],
        incomeStatements: processedIncomeStatements as Record<string, unknown>[],
        cashflowStatements: cashflowStatements as Record<string, unknown>[],
        keyStatistics: keyStatistics as Record<string, unknown>[],
        valueAddedStatements: valueAddedStatements as Record<string, unknown>[]
      }

      return serializedData;
    }

    // OTIMIZAÇÃO: Uma única consulta com include para buscar empresa + todos os dados relacionados
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        // Incluir todos os dados relacionados de uma vez - elimina N+1
        financialData: {
          where: { year: { gte: startYear } },
          orderBy: { year: 'desc' },
          take: 5
        },
        balanceSheets: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        incomeStatements: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        cashflowStatements: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        keyStatistics: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        valueAddedStatements: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        }
      }
    })

    if (!company) return null

    // Extrair dados da consulta única
    const {
      financialData,
      balanceSheets,
      incomeStatements,
      cashflowStatements,
      keyStatistics,
      valueAddedStatements
    } = company

    // Verificar se é empresa financeira
    const isFinancial = isFinancialSector(company.sector, company.industry)
    
    console.log('📊 Dados encontrados para', ticker, '(1 query):', {
      financialDataCount: financialData.length,
      balanceSheetsCount: balanceSheets.length,
      incomeStatementsCount: incomeStatements.length,
      cashflowStatementsCount: cashflowStatements.length,
      keyStatisticsCount: keyStatistics.length,
      valueAddedCount: valueAddedStatements.length,
      period: period,
      isFinancial
    })

    // Aplicar fallbacks nos dados de DRE primeiro
    const processedIncomeStatements = incomeStatements.map((data: any) => 
      applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
    )

    // Aplicar fallbacks nos dados financeiros, usando dados de DRE quando disponível
    const processedFinancialData = financialData.map((data: any, index: number) => {
      let processedData = applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
      
      // Se é empresa financeira e ainda não tem receita/margem, tentar usar dados de DRE do mesmo período
      if (isFinancial && processedIncomeStatements[index]) {
        const incomeData = processedIncomeStatements[index]
        
        // Criar novo objeto com os fallbacks adicionais
        processedData = {
          ...processedData,
          receitaTotal: processedData.receitaTotal || incomeData.operatingIncome || null,
          margemLiquida: processedData.margemLiquida || (() => {
            if (incomeData.netIncome && incomeData.operatingIncome) {
              const netIncome = typeof incomeData.netIncome === 'number' ? incomeData.netIncome : 
                               (incomeData.netIncome && typeof incomeData.netIncome === 'object' && 'toNumber' in incomeData.netIncome) ? 
                               (incomeData.netIncome as { toNumber: () => number }).toNumber() : null
              const operatingIncome = typeof incomeData.operatingIncome === 'number' ? incomeData.operatingIncome : 
                                     (incomeData.operatingIncome && typeof incomeData.operatingIncome === 'object' && 'toNumber' in incomeData.operatingIncome) ? 
                                     (incomeData.operatingIncome as { toNumber: () => number }).toNumber() : null
              
              if (netIncome && operatingIncome && operatingIncome > 0) {
                return netIncome / operatingIncome
              }
            }
            return null
          })()
        }
      }
      
      return processedData
    })

    // Serializar todos os dados antes de retornar para evitar erros de Decimal no cliente
    const serializedData = {
      company: {
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        industry: company.industry
      },
      financialData: serializePrismaData(processedFinancialData) as Record<string, unknown>[],
      balanceSheets: serializePrismaData(balanceSheets) as Record<string, unknown>[],
      incomeStatements: serializePrismaData(processedIncomeStatements) as Record<string, unknown>[],
      cashflowStatements: serializePrismaData(cashflowStatements) as Record<string, unknown>[],
      keyStatistics: serializePrismaData(keyStatistics) as Record<string, unknown>[],
      valueAddedStatements: serializePrismaData(valueAddedStatements) as Record<string, unknown>[]
    }

    // Armazenar no cache principal
    dataCache.set(cacheKey, {
      data: serializedData,
      timestamp: Date.now()
    });

    // Armazenar no cache de statements (dados brutos serializados)
    statementsCache.set(statementsKey, {
      data: [
        company, // Company não precisa ser serializado pois não tem Decimals
        serializePrismaData(processedFinancialData),
        serializePrismaData(balanceSheets),
        serializePrismaData(processedIncomeStatements),
        serializePrismaData(cashflowStatements),
        serializePrismaData(keyStatistics),
        serializePrismaData(valueAddedStatements)
      ],
      timestamp: Date.now()
    });

    // Limpar cache antigo (manter apenas 10 entradas mais recentes)
    if (dataCache.size > 10) {
      const entries = Array.from(dataCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      dataCache.clear();
      entries.slice(0, 10).forEach(([key, value]) => {
        dataCache.set(key, value);
      });
    }

    // Limpar cache de statements antigo (manter apenas 15 entradas mais recentes)
    if (statementsCache.size > 15) {
      const entries = Array.from(statementsCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      statementsCache.clear();
      entries.slice(0, 15).forEach(([key, value]) => {
        statementsCache.set(key, value);
      });
    }

    return serializedData

  } catch (error) {
    console.error(`Erro ao buscar dados financeiros para ${ticker}:`, error)
    return null
  }
}

// OTIMIZAÇÃO: Buscar dados de múltiplas empresas em uma única consulta (elimina N+1)
export async function getMultipleCompaniesData(
  tickers: string[],
  period: ReportPeriod = 'YEARLY',
  yearsBack: number = 5
): Promise<ComprehensiveFinancialData[]> {
  try {
    // Verificar cache primeiro
    const cacheKey = `multi-${tickers.sort().join(',')}-${period}-${yearsBack}`;
    const cached = multiCompaniesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MULTI_COMPANIES_CACHE_DURATION) {
      console.log('📋 Usando dados do cache para múltiplas empresas:', tickers.join(', '));
      return cached.data;
    }

    const currentYear = new Date().getFullYear()
    const startYear = currentYear - yearsBack
    const startDate = new Date(`${startYear}-01-01`)

    // UMA ÚNICA CONSULTA para todas as empresas - elimina N+1 completamente
    const companies = await prisma.company.findMany({
      where: { 
        ticker: { in: tickers.map(t => t.toUpperCase()) }
      },
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        // Incluir todos os dados relacionados de uma vez para TODAS as empresas
        financialData: {
          where: { year: { gte: startYear } },
          orderBy: { year: 'desc' },
          take: 5
        },
        balanceSheets: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        incomeStatements: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        cashflowStatements: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        keyStatistics: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        },
        valueAddedStatements: {
          where: {
            period,
            endDate: { gte: startDate }
          },
          orderBy: { endDate: 'desc' },
          take: 12
        }
      }
    })

    console.log(`📊 Dados de ${companies.length} empresas carregados em 1 query (vs ${tickers.length} queries antes)`)

    // Processar dados de cada empresa
    const result = companies.map(company => {
      const {
        financialData,
        balanceSheets,
        incomeStatements,
        cashflowStatements,
        keyStatistics,
        valueAddedStatements
      } = company

      const isFinancial = isFinancialSector(company.sector, company.industry)

      // Aplicar fallbacks nos dados
      const processedIncomeStatements = incomeStatements.map((data: any) => 
        applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
      )

      const processedFinancialData = financialData.map((data: any, index: number) => {
        let processedData = applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
        
        if (isFinancial && processedIncomeStatements[index]) {
          const incomeData = processedIncomeStatements[index]
          if (!processedData.receitaTotal && incomeData.totalRevenue) {
            processedData.receitaTotal = incomeData.totalRevenue
          }
          if (!processedData.margemLiquida && incomeData.netIncome && incomeData.totalRevenue) {
            processedData.margemLiquida = Number(incomeData.netIncome) / Number(incomeData.totalRevenue)
          }
        }
        
        return processedData
      })

      return {
        company: {
          id: company.id,
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          industry: company.industry
        },
        financialData: serializePrismaData(processedFinancialData) as Record<string, unknown>[],
        balanceSheets: serializePrismaData(balanceSheets) as Record<string, unknown>[],
        incomeStatements: serializePrismaData(processedIncomeStatements) as Record<string, unknown>[],
        cashflowStatements: serializePrismaData(cashflowStatements) as Record<string, unknown>[],
        keyStatistics: serializePrismaData(keyStatistics) as Record<string, unknown>[],
        valueAddedStatements: serializePrismaData(valueAddedStatements) as Record<string, unknown>[]
      }
    })

    // Armazenar no cache
    multiCompaniesCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Limpar cache antigo (manter apenas 5 entradas mais recentes)
    if (multiCompaniesCache.size > 5) {
      const entries = Array.from(multiCompaniesCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      multiCompaniesCache.clear();
      entries.slice(0, 5).forEach(([key, value]) => {
        multiCompaniesCache.set(key, value);
      });
    }

    return result

  } catch (error) {
    console.error('Erro ao buscar dados de múltiplas empresas:', error)
    return []
  }
}

// Buscar dados históricos para gráficos
export async function getHistoricalDataForCharts(
  ticker: string,
  period: ReportPeriod = 'YEARLY',
  yearsBack: number = 10
) {
  try {
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true, sector: true, industry: true }
    })

    if (!company) return null

    const currentYear = new Date().getFullYear()
    const startYear = currentYear - yearsBack

    // Buscar dados para gráficos - temporariamente simplificado
    const [financialData] = await Promise.all([
      prisma.financialData.findMany({
        where: {
          companyId: company.id,
          year: { gte: startYear }
        },
        select: {
          year: true,
          receitaTotal: true,
          lucroLiquido: true,
          margemLiquida: true,
          margemEbitda: true,
          roe: true,
          roa: true,
          roic: true,
          pl: true,
          pvp: true,
          dy: true,
          marketCap: true
        },
        orderBy: { year: 'asc' }
      })
    ])

    // Aplicar fallbacks se for empresa financeira
    const isFinancial = isFinancialSector(company.sector, company.industry)
    
    const processedFinancialData = financialData.map(data => 
      applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
    )

    const result = {
      financialData: serializePrismaData(processedFinancialData) as Record<string, unknown>[],
      incomeStatements: [],
      balanceSheets: [],
      keyStatistics: [],
      isFinancialSector: isFinancial
    }

    // Garantir que tudo está serializado
    return serializePrismaData(result) as typeof result

  } catch (error) {
    console.error(`Erro ao buscar dados históricos para ${ticker}:`, error)
    return null
  }
}

// Função para calcular métricas derivadas
export function calculateDerivedMetrics(data: Record<string, unknown>) {
  const metrics: Record<string, unknown> = {}

  // Simplificado para evitar erros de tipo - implementação futura
  // TODO: Implementar cálculos de métricas derivadas com tipos seguros
  
  return metrics
}
