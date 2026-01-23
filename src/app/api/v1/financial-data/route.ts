import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { validateThirdPartyApiKey } from '@/lib/third-party-api-auth';

// Função para serializar dados do Prisma (converter Decimals para números)
// Reutilizada de financial-data-service.ts
function serializePrismaData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(serializePrismaData);
  }
  
  if (typeof data === 'object') {
    // Se é um objeto Decimal do Prisma
    if (data && typeof data === 'object' && 'toNumber' in data && typeof (data as any).toNumber === 'function') {
      return (data as any).toNumber();
    }
    
    // Verificar se é um Decimal usando outras propriedades comuns
    if (data && typeof data === 'object' && 'toString' in data && 'valueOf' in data && 'constructor' in data) {
      const constructor = (data as any).constructor;
      if (constructor && constructor.name === 'Decimal') {
        return Number((data as any).toString());
      }
    }
    
    // Se é um Date, converter para string ISO
    if (data instanceof Date) {
      return data.toISOString();
    }
    
    // Se é um objeto comum, serializar recursivamente
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializePrismaData(value);
    }
    return serialized;
  }
  
  return data;
}

// Função helper para converter valores para número
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return null;
    }
  }
  return null;
}

// Função para calcular média histórica dos últimos 5 anos
function calculateHistoricalAverages(
  historicalData: Array<Record<string, unknown>>
): Record<string, number | null> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;
  
  // Filtrar dados dos últimos 5 anos (excluindo ano atual)
  const validHistoricalData = historicalData.filter((item: any) => {
    const year = item.year;
    return year && year >= startYear && year < currentYear;
  });

  if (validHistoricalData.length === 0) {
    return {};
  }

  // Indicadores para calcular média
  const indicators = [
    'dy',                    // Dividend Yield
    'dividendYield12m',      // Dividend Yield 12 meses
    'roe',                   // Retorno sobre Patrimônio
    'roic',                  // Retorno sobre Capital Investido
    'roa',                   // Retorno sobre Ativos
    'margemBruta',           // Margem Bruta
    'margemEbitda',          // Margem EBITDA
    'margemLiquida',         // Margem Líquida
    'payout',                // Payout Ratio
    'pl',                    // Preço/Lucro
    'pvp',                   // Preço/Valor Patrimonial
    'crescimentoLucros',     // Crescimento de Lucros
    'crescimentoReceitas',   // Crescimento de Receitas
    'liquidezCorrente',      // Liquidez Corrente
    'debtToEquity',          // Dívida/Patrimônio
    'evEbitda',              // EV/EBITDA
  ];

  const averages: Record<string, number | null> = {};

  for (const indicator of indicators) {
    const values = validHistoricalData
      .map(item => toNumber(item[indicator]))
      .filter(val => val !== null && !isNaN(val as number)) as number[];

    if (values.length > 0) {
      const sum = values.reduce((acc, val) => acc + val, 0);
      averages[indicator] = sum / values.length;
    } else {
      averages[indicator] = null;
    }
  }

  return averages;
}

export async function GET(request: NextRequest) {
  try {
    // Validar API key
    const authResult = validateThirdPartyApiKey(request);
    if (!authResult.isValid) {
      return authResult.error!;
    }

    // Buscar parâmetro tickers da query string
    const { searchParams } = new URL(request.url);
    const tickersParam = searchParams.get('tickers');

    if (!tickersParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parâmetro "tickers" é obrigatório. Use ?tickers=PETR4,VALE3,ITUB4',
          code: 'MISSING_TICKERS_PARAM'
        },
        { status: 400 }
      );
    }

    // Processar lista de tickers
    const tickers = tickersParam
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    if (tickers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhum ticker válido fornecido',
          code: 'INVALID_TICKERS'
        },
        { status: 400 }
      );
    }

    // Limitar a 50 tickers por requisição
    if (tickers.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'Máximo de 50 tickers por requisição',
          code: 'TOO_MANY_TICKERS'
        },
        { status: 400 }
      );
    }

    // Validar formato dos tickers
    const invalidTickers = tickers.filter(t => t.length < 2 || t.length > 10);
    if (invalidTickers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Tickers inválidos: ${invalidTickers.join(', ')}`,
          code: 'INVALID_TICKER_FORMAT'
        },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;

    // Buscar empresas e dados financeiros TTM + histórico dos últimos 5 anos em batch
    const companies = await safeQueryWithParams(
      'third-party-api-multiple-financial-data',
      () => prisma.company.findMany({
        where: {
          ticker: { in: tickers }
        },
        select: {
          id: true,
          ticker: true,
          name: true,
          sector: true,
          industry: true,
          financialData: {
            where: { 
              year: { 
                gte: startYear,
                lte: currentYear
              }
            },
            orderBy: { year: 'desc' }
          }
        }
      }),
      { tickers, startYear, currentYear }
    ) as Array<{
      id: number;
      ticker: string;
      name: string;
      sector: string | null;
      industry: string | null;
      financialData: any[];
    }>;

    // Buscar dividendos para todas as empresas em batch
    const companyIds = companies.map(c => c.id);
    const allDividends = companyIds.length > 0 ? await safeQueryWithParams(
      'third-party-api-multiple-dividend-history',
      () => prisma.dividendHistory.findMany({
        where: {
          companyId: { in: companyIds }
        },
        orderBy: {
          exDate: 'desc'
        },
        select: {
          companyId: true,
          amount: true,
          exDate: true
        }
      }),
      { companyIds }
    ) as Array<{ companyId: number; amount: any; exDate: Date }> : [];

    // Agrupar dividendos por companyId
    const dividendsByCompany = new Map<number, Array<{ amount: any; exDate: Date }>>();
    for (const div of allDividends) {
      if (!dividendsByCompany.has(div.companyId)) {
        dividendsByCompany.set(div.companyId, []);
      }
      const companyDividends = dividendsByCompany.get(div.companyId)!;
      if (companyDividends.length < 10) { // Limitar a 10 dividendos por empresa
        companyDividends.push({ amount: div.amount, exDate: div.exDate });
      }
    }

    // Identificar tickers encontrados e não encontrados
    const foundTickers = new Set(companies.map(c => c.ticker));
    const notFoundTickers = tickers.filter(t => !foundTickers.has(t));

    // Processar dados de cada empresa
    const results = companies
      .filter(company => {
        // Verificar se há dados TTM (ano atual)
        return company.financialData.some((fd: any) => fd.year === currentYear);
      })
      .map(company => {
        // Buscar dados TTM (ano atual)
        const financialDataTTM = company.financialData.find((fd: any) => fd.year === currentYear);
        
        if (!financialDataTTM) {
          return null;
        }
        
        // Serializar dados financeiros TTM
        const serializedFinancialData = serializePrismaData(financialDataTTM) as Record<string, unknown>;
        
        // Remover campos internos
        const { id, companyId, ...financialData } = serializedFinancialData;

        // Substituir historicoUltimosDividendos com dados reais da tabela DividendHistory
        const companyDividends = dividendsByCompany.get(company.id) || [];
        if (companyDividends.length > 0) {
          const dividendAmounts = companyDividends.map(div => {
            const amount = toNumber(div.amount);
            return amount !== null ? amount.toFixed(6) : null;
          }).filter(amt => amt !== null);
          
          if (dividendAmounts.length > 0) {
            financialData.historicoUltimosDividendos = dividendAmounts.join(',');
          }
        }

        // Serializar dados históricos para cálculo de médias
        const serializedHistoricalData = company.financialData
          .map(fd => serializePrismaData(fd))
          .filter((fd: any) => fd.year !== currentYear) as Array<Record<string, unknown>>;

        // Calcular médias históricas dos últimos 5 anos
        const historicalAverages = calculateHistoricalAverages(serializedHistoricalData);

        return {
          ticker: company.ticker,
          company: {
            name: company.name,
            sector: company.sector,
            industry: company.industry
          },
          financialData,
          historicalAverages: Object.keys(historicalAverages).length > 0 ? historicalAverages : null,
          year: currentYear,
          updatedAt: financialDataTTM.updatedAt ? new Date(financialDataTTM.updatedAt).toISOString() : null
        };
      })
      .filter((result): result is NonNullable<typeof result> => result !== null);

    // Identificar tickers sem dados TTM disponíveis
    const companiesWithoutTTM = companies
      .filter(company => company.financialData.length === 0)
      .map(company => company.ticker);

    // Combinar tickers não encontrados e sem dados TTM
    const allNotFound = [...notFoundTickers, ...companiesWithoutTTM];

    // Preparar resposta
    const response = {
      success: true,
      data: results,
      ...(allNotFound.length > 0 && { notFound: allNotFound })
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Erro ao buscar dados financeiros TTM (múltiplos):', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

