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
    if ('toNumber' in data && typeof (data as any).toNumber === 'function') {
      return (data as any).toNumber()
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

// Cache simples para evitar consultas repetidas (válido por 5 minutos)
const dataCache = new Map<string, { data: ComprehensiveFinancialData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

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
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
        industry: true
      }
    })

    if (!company) return null

    const currentYear = new Date().getFullYear()
    const startYear = currentYear - yearsBack

    // Buscar dados em lotes menores para evitar esgotar o pool de conexões
    // Primeiro lote: dados essenciais
    const [financialData, balanceSheets, incomeStatements] = await Promise.all([
      // Dados financeiros tradicionais (FinancialData) - manter anuais para fallback
      prisma.financialData.findMany({
        where: {
          companyId: company.id,
          year: { gte: startYear }
        },
        orderBy: { year: 'desc' },
        take: 5 // Últimos 5 anos para fallback
      }),

      // Balanços patrimoniais - trimestrais
      prisma.balanceSheet.findMany({
        where: {
          companyId: company.id,
          period,
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 12 // Últimos 12 quarters (3 anos)
      }),

      // Demonstrações de resultado - trimestrais
      prisma.incomeStatement.findMany({
        where: {
          companyId: company.id,
          period,
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 12 // Últimos 12 quarters (3 anos)
      })
    ]);

    // Segundo lote: dados complementares
    const [cashflowStatements, keyStatistics, valueAddedStatements] = await Promise.all([
      // Demonstrações de fluxo de caixa - trimestrais
      prisma.cashflowStatement.findMany({
        where: {
          companyId: company.id,
          period,
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 12 // Últimos 12 quarters (3 anos)
      }),

      // Estatísticas-chave - trimestrais
      prisma.keyStatistics.findMany({
        where: {
          companyId: company.id,
          period,
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 12 // Últimos 12 quarters (3 anos)
      }),

      // Demonstrações de valor adicionado - trimestrais
      prisma.valueAddedStatement.findMany({
        where: {
          companyId: company.id,
          period,
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 12 // Últimos 12 quarters (3 anos)
      })
    ]);

    // Verificar se é empresa financeira
    const isFinancial = isFinancialSector(company.sector, company.industry)
    
    console.log('📊 Dados trimestrais encontrados para', ticker, ':', {
      financialDataCount: financialData.length,
      balanceSheetsCount: balanceSheets.length,
      incomeStatementsCount: incomeStatements.length,
      cashflowStatementsCount: cashflowStatements.length,
      keyStatisticsCount: keyStatistics.length,
      period: period,
      isFinancial
    })

    // Aplicar fallbacks nos dados de DRE primeiro
    const processedIncomeStatements = incomeStatements.map(data => 
      applyFinancialSectorFallbacks(data as Record<string, unknown>, isFinancial)
    )

    // Aplicar fallbacks nos dados financeiros, usando dados de DRE quando disponível
    const processedFinancialData = financialData.map((data, index) => {
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
      company,
      financialData: serializePrismaData(processedFinancialData) as Record<string, unknown>[],
      balanceSheets: serializePrismaData(balanceSheets) as Record<string, unknown>[],
      incomeStatements: serializePrismaData(processedIncomeStatements) as Record<string, unknown>[],
      cashflowStatements: serializePrismaData(cashflowStatements) as Record<string, unknown>[],
      keyStatistics: serializePrismaData(keyStatistics) as Record<string, unknown>[],
      valueAddedStatements: serializePrismaData(valueAddedStatements) as Record<string, unknown>[]
    }

    // Armazenar no cache
    dataCache.set(cacheKey, {
      data: serializedData,
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

    return serializedData

  } catch (error) {
    console.error(`Erro ao buscar dados financeiros para ${ticker}:`, error)
    return null
  }
}

// Buscar dados de múltiplas empresas para comparação
export async function getMultipleCompaniesData(
  tickers: string[],
  period: ReportPeriod = 'YEARLY',
  yearsBack: number = 5
): Promise<ComprehensiveFinancialData[]> {
  try {
    const results = await Promise.all(
      tickers.map(ticker => getComprehensiveFinancialData(ticker, period, yearsBack))
    )

    return results.filter((result): result is ComprehensiveFinancialData => result !== null)
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

    return {
      financialData: serializePrismaData(processedFinancialData) as Record<string, unknown>[],
      incomeStatements: [],
      balanceSheets: [],
      keyStatistics: [],
      isFinancialSector: isFinancial
    }

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
