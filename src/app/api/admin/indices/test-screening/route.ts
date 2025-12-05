/**
 * API: Test Screening
 * POST /api/admin/indices/test-screening
 * 
 * Executa screening de teste com uma configuração sem criar o índice
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { runScreening } from '@/lib/index-screening-engine';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Config é obrigatório' },
        { status: 400 }
      );
    }

    // Criar um objeto temporário simulando um índice para executar o screening
    const tempIndexDefinition = {
      id: 'temp-test',
      config: config
    };

    // Executar screening
    const selectedCompanies = await runScreening(tempIndexDefinition);

    // Extrair informações relevantes
    const result = {
      count: selectedCompanies.length,
      tickers: selectedCompanies.map(c => c.ticker),
      companies: selectedCompanies.map(c => {
        const companyData: any = {
          ticker: c.ticker,
          name: c.name,
          sector: c.sector,
          currentPrice: c.currentPrice,
          upside: c.upside,
          fairValueModel: c.fairValueModel,
          overallScore: c.overallScore,
          dividendYield: c.dividendYield,
          marketCap: c.marketCap
        };
        
        // Sempre incluir debug se score for null (mesmo que seja undefined, para debug)
        if (c.overallScore === null) {
          companyData.debug = c.debug || {
            scoreCalculationFailed: true,
            error: 'debug não foi criado durante o cálculo',
            hasFinancialData: undefined,
            hasPriceData: undefined
          };
        }
        
        return companyData;
      })
    };

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error testing screening:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao executar screening'
      },
      { status: 500 }
    );
  }
}

