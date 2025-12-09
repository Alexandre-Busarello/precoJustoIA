import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { fetchYahooFinance, fetchYahooFinanceJson } from '@/lib/yahoo-finance-fetch';

/**
 * POST /api/admin/yahoo-debug
 * Endpoint para testar requisições ao Yahoo Finance
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se é admin
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { method, symbol, url, endpoint } = body;

    if (!method || (method !== 'direct' && method !== 'library')) {
      return NextResponse.json(
        { error: 'Método inválido. Use "direct" ou "library"' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    let result: any = null;
    let error: any = null;

    try {
      if (method === 'direct') {
        // Requisição direta via fetch com User-Agent
        if (!url) {
          return NextResponse.json(
            { error: 'URL é obrigatória para método "direct"' },
            { status: 400 }
          );
        }

        result = await fetchYahooFinanceJson(url);
      } else if (method === 'library') {
        // Requisição via biblioteca yahoo-finance2
        if (!symbol) {
          return NextResponse.json(
            { error: 'Symbol é obrigatório para método "library"' },
            { status: 400 }
          );
        }

        const yahooModule = await import('yahoo-finance2');
        const YahooFinance = yahooModule.default;
        const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

        // Determinar qual endpoint usar
        if (endpoint === 'quote') {
          result = await yahooFinance.quote(symbol);
        } else if (endpoint === 'quoteSummary') {
          const modules = body.modules || ['price'];
          result = await yahooFinance.quoteSummary(symbol, { modules });
        } else if (endpoint === 'chart') {
          const period1 = body.period1 ? new Date(body.period1) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const period2 = body.period2 ? new Date(body.period2) : new Date();
          const interval = body.interval || '1d';
          result = await yahooFinance.chart(symbol, {
            period1,
            period2,
            interval,
            return: 'array'
          });
        } else {
          return NextResponse.json(
            { error: `Endpoint inválido: ${endpoint}. Use "quote", "quoteSummary" ou "chart"` },
            { status: 400 }
          );
        }
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        method,
        symbol: symbol || url,
        endpoint: endpoint || 'direct',
        duration: `${duration}ms`,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      error = {
        message: err.message || String(err),
        stack: err.stack,
        name: err.name,
      };

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: false,
        method,
        symbol: symbol || url,
        endpoint: endpoint || 'direct',
        duration: `${duration}ms`,
        error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('Erro no endpoint de debug:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/yahoo-debug
 * Retorna informações sobre endpoints disponíveis
 */
export async function GET() {
  try {
    // Verificar se é admin
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return NextResponse.json({
      endpoints: {
        direct: {
          description: 'Requisição direta via fetch com User-Agent',
          required: ['url'],
          example: {
            method: 'direct',
            url: 'https://query1.finance.yahoo.com/v8/finance/quoteSummary/PETR4.SA?modules=price',
          },
        },
        library: {
          description: 'Requisição via biblioteca yahoo-finance2',
          required: ['symbol', 'endpoint'],
          endpoints: {
            quote: {
              description: 'Busca cotação atual',
              required: ['symbol'],
              example: {
                method: 'library',
                symbol: 'PETR4.SA',
                endpoint: 'quote',
              },
            },
            quoteSummary: {
              description: 'Busca dados detalhados',
              required: ['symbol'],
              optional: ['modules'],
              example: {
                method: 'library',
                symbol: 'PETR4.SA',
                endpoint: 'quoteSummary',
                modules: ['price', 'summaryDetail'],
              },
            },
            chart: {
              description: 'Busca dados históricos',
              required: ['symbol'],
              optional: ['period1', 'period2', 'interval'],
              example: {
                method: 'library',
                symbol: 'PETR4.SA',
                endpoint: 'chart',
                period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                period2: new Date().toISOString(),
                interval: '1d',
              },
            },
          },
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

