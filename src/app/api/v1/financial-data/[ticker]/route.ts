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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    // Validar API key
    const authResult = validateThirdPartyApiKey(request);
    if (!authResult.isValid) {
      return authResult.error!;
    }

    const { ticker } = await params;
    const tickerUpper = ticker.toUpperCase();

    // Validar formato do ticker (básico)
    if (!tickerUpper || tickerUpper.length < 2 || tickerUpper.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ticker inválido ou formato incorreto',
          code: 'INVALID_TICKER'
        },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;

    // Buscar empresa e dados financeiros TTM (ano atual) + histórico dos últimos 5 anos
    const company = await safeQueryWithParams(
      'third-party-api-financial-data',
      () => prisma.company.findUnique({
        where: { ticker: tickerUpper },
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
      { ticker: tickerUpper, startYear, currentYear }
    ) as {
      id: number;
      ticker: string;
      name: string;
      sector: string | null;
      industry: string | null;
      financialData: any[];
    } | null;

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ticker não encontrado',
          code: 'TICKER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Verificar se há dados financeiros TTM (ano atual)
    const financialDataTTM = company.financialData.find((fd: any) => fd.year === currentYear);
    
    if (!financialDataTTM) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados financeiros TTM não disponíveis para este ticker',
          code: 'TTM_DATA_NOT_AVAILABLE'
        },
        { status: 404 }
      );
    }

    // Serializar dados financeiros TTM (converter Decimals para números)
    const serializedFinancialData = serializePrismaData(financialDataTTM) as Record<string, unknown>;

    // Remover campos internos que não devem ser expostos
    const { id, companyId, ...financialData } = serializedFinancialData;

    // Serializar dados históricos para cálculo de médias
    const serializedHistoricalData = company.financialData
      .map(fd => serializePrismaData(fd))
      .filter((fd: any) => fd.year !== currentYear) as Array<Record<string, unknown>>;

    // Calcular médias históricas dos últimos 5 anos
    const historicalAverages = calculateHistoricalAverages(serializedHistoricalData);

    // Preparar resposta
    const response = {
      success: true,
      data: {
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
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Erro ao buscar dados financeiros TTM:', error);
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

