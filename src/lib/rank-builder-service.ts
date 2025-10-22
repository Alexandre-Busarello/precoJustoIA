import { prisma, safeQueryWithParams } from '@/lib/prisma-wrapper';
import { StrategyFactory, ScreeningParams, CompanyData, toNumber, RankBuilderResult } from '@/lib/strategies';
import { TechnicalIndicators, type PriceData } from '@/lib/technical-indicators';

/**
 * Busca dados de todas as empresas (reutiliza lógica do rank-builder)
 */
export async function getCompaniesData(): Promise<CompanyData[]> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 4; // Últimos 5 anos para demonstrações
  
  const companies = await safeQueryWithParams('all-companies-data', () =>
    prisma.company.findMany({
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 8, // Dados atuais + até 7 anos históricos
        },
        dailyQuotes: {
          orderBy: { date: 'desc' },
          take: 1, // Cotação mais recente
        },
        historicalPrices: {
          where: {
            interval: '1mo',
            date: {
              gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) // Últimos 2 anos
            }
          },
          orderBy: { date: 'asc' },
          select: {
            date: true,
            open: true,
            high: true,
            low: true,
            close: true,
            volume: true
          }
        },
        // Incluir demonstrações financeiras para cálculo do Overall Score
        incomeStatements: {
          where: {
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        },
        balanceSheets: {
          where: {
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        },
        cashflowStatements: {
          where: {
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        },
        // Incluir snapshot para filtrar por overall_score
        snapshot: {
          select: {
            overallScore: true,
            updatedAt: true
          }
        }
      },
      where: {
        financialData: {
          some: {
            // Filtros básicos para ter dados mínimos necessários
            lpa: { not: null },
            vpa: { not: null },
          }
        },
        dailyQuotes: {
          some: {}
        }
      }
    }),
    {
      type: 'all-companies',
      startYear,
      currentYear
    }
  );

  // Debug: verificar quantas empresas têm dados históricos
  const companiesWithHistoricalData = companies.filter(c => c.historicalPrices && c.historicalPrices.length >= 20);
  console.log(`📈 Empresas com dados históricos suficientes: ${companiesWithHistoricalData.length}/${companies.length}`);

  // Converter para o formato CompanyData e calcular indicadores técnicos
  return companies.map(company => {
    let technicalAnalysis = undefined;

    // Calcular indicadores técnicos se houver dados históricos suficientes
    if (company.historicalPrices && company.historicalPrices.length >= 20) {
      // Filtrar dados válidos (sem valores zero)
      const validHistoricalData = company.historicalPrices.filter(data =>
        Number(data.high) > 0 &&
        Number(data.low) > 0 &&
        Number(data.close) > 0 &&
        Number(data.open) > 0
      );

      if (validHistoricalData.length >= 20) {
        const priceData: PriceData[] = validHistoricalData.map(data => ({
          date: data.date,
          open: Number(data.open),
          high: Number(data.high),
          low: Number(data.low),
          close: Number(data.close),
          volume: Number(data.volume)
        }));

        try {
          const technicalResult = TechnicalIndicators.calculateTechnicalAnalysis(priceData);
          
          // Verificar se os dados técnicos são válidos
          if (technicalResult.currentRSI && technicalResult.currentStochastic) {
            technicalAnalysis = {
              rsi: technicalResult.currentRSI.rsi,
              stochasticK: technicalResult.currentStochastic.k,
              stochasticD: technicalResult.currentStochastic.d,
              overallSignal: technicalResult.overallSignal
            };
          }
        } catch (error) {
          console.warn(`Erro ao calcular indicadores técnicos para ${company.ticker}:`, error);
        }
      }
    }

    // Preparar dados históricos financeiros (excluindo o primeiro que é o atual)
    const historicalFinancials = company.financialData.slice(1).map(data => ({
      year: data.year,
      roe: data.roe,
      roic: data.roic,
      pl: data.pl,
      pvp: data.pvp,
      dy: data.dy,
      margemLiquida: data.margemLiquida,
      margemEbitda: data.margemEbitda,
      margemBruta: data.margemBruta,
      liquidezCorrente: data.liquidezCorrente,
      liquidezRapida: data.liquidezRapida,
      dividaLiquidaPl: data.dividaLiquidaPl,
      dividaLiquidaEbitda: data.dividaLiquidaEbitda,
      lpa: data.lpa,
      vpa: data.vpa,
      marketCap: data.marketCap,
      earningsYield: data.earningsYield,
      evEbitda: data.evEbitda,
      roa: data.roa,
      passivoAtivos: data.passivoAtivos
    }));

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      currentPrice: toNumber(company.dailyQuotes[0]?.price) || 0,
      logoUrl: company.logoUrl,
      financials: company.financialData[0] || {},
      historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined,
      technicalAnalysis,
      // Incluir demonstrações financeiras para cálculo do Overall Score
      incomeStatements: company.incomeStatements?.length > 0 ? company.incomeStatements : undefined,
      balanceSheets: company.balanceSheets?.length > 0 ? company.balanceSheets : undefined,
      cashflowStatements: company.cashflowStatements?.length > 0 ? company.cashflowStatements : undefined,
      // Overall Score do snapshot mais recente
      overallScore: company.snapshot ? toNumber(company.snapshot.overallScore) : null
    };
  });
}

/**
 * Executa screening usando os parâmetros fornecidos
 */
export async function executeScreening(parameters: ScreeningParams): Promise<RankBuilderResult[]> {
  try {
    // Buscar dados de todas as empresas
    const companies = await getCompaniesData();
    
    // Debug: verificar quantas empresas têm dados técnicos
    const companiesWithTechnical = companies.filter(c => c.technicalAnalysis);
    console.log(`📊 Empresas carregadas: ${companies.length}, com dados técnicos: ${companiesWithTechnical.length}`);
    
    // Executar screening
    const results = StrategyFactory.runScreeningRanking(companies, {
      ...parameters,
      limit: 20 // Limitar a 20 resultados para não sobrecarregar a IA
    });

    return results;
  } catch (error) {
    console.error('Erro ao executar screening:', error);
    return [];
  }
}