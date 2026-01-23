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

    // Buscar empresas e dados financeiros TTM em batch
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
            where: { year: currentYear },
            take: 1
          }
        }
      }),
      { tickers, year: currentYear }
    ) as Array<{
      id: number;
      ticker: string;
      name: string;
      sector: string | null;
      industry: string | null;
      financialData: any[];
    }>;

    // Identificar tickers encontrados e não encontrados
    const foundTickers = new Set(companies.map(c => c.ticker));
    const notFoundTickers = tickers.filter(t => !foundTickers.has(t));

    // Processar dados de cada empresa
    const results = companies
      .filter(company => company.financialData.length > 0) // Apenas empresas com dados TTM
      .map(company => {
        const financialDataTTM = company.financialData[0];
        
        // Serializar dados financeiros
        const serializedFinancialData = serializePrismaData(financialDataTTM) as Record<string, unknown>;
        
        // Remover campos internos
        const { id, companyId, ...financialData } = serializedFinancialData;

        return {
          ticker: company.ticker,
          company: {
            name: company.name,
            sector: company.sector,
            industry: company.industry
          },
          financialData,
          year: currentYear,
          updatedAt: financialDataTTM.updatedAt ? new Date(financialDataTTM.updatedAt).toISOString() : null
        };
      });

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

