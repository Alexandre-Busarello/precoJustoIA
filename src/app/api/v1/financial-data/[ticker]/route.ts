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

    // Buscar empresa e dados financeiros TTM (ano atual)
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
            where: { year: currentYear },
            take: 1
          }
        }
      }),
      { ticker: tickerUpper, year: currentYear }
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

    // Verificar se há dados financeiros TTM
    const financialDataTTM = company.financialData[0];
    
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

    // Serializar dados financeiros (converter Decimals para números)
    const serializedFinancialData = serializePrismaData(financialDataTTM) as Record<string, unknown>;

    // Remover campos internos que não devem ser expostos
    const { id, companyId, ...financialData } = serializedFinancialData;

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

