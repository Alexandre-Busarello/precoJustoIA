import { NextRequest, NextResponse } from 'next/server';
import { calculateAverageDividendYield, getLatestDividendYield } from '@/lib/dividend-yield-calculator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`📊 Calculando DY médio para ${ticker.toUpperCase()}`);

    // Tentar calcular dividend yield médio dos últimos 5 anos
    let averageDividendYield = await calculateAverageDividendYield(ticker);

    // Se não conseguir calcular a média, tentar buscar o mais recente
    if (!averageDividendYield) {
      console.log(`⚠️ Não foi possível calcular DY médio para ${ticker}, tentando DY mais recente...`);
      averageDividendYield = await getLatestDividendYield(ticker);
    }

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      averageDividendYield,
      hasData: averageDividendYield !== null,
      message: averageDividendYield 
        ? `DY médio calculado: ${(averageDividendYield * 100).toFixed(2)}%`
        : 'Nenhum dado de dividend yield encontrado'
    });

  } catch (error) {
    console.error('Erro ao calcular dividend yield médio:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
