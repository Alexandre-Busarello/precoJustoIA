/**
 * API: Recreate Historical Prices from Yahoo Finance
 * POST /api/admin/historical-prices/[ticker]
 * 
 * Recria todos os preços históricos de uma empresa desde 2010 usando Yahoo Finance como fonte primária
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { HistoricalDataService } from '@/lib/historical-data-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { ticker } = await params;
    const normalizedTicker = ticker.toUpperCase();

    console.log(`🔄 [ADMIN HISTORICAL PRICES] Recriando preços históricos para ${normalizedTicker} desde 2000...`);

    // 1. Buscar empresa no banco
    const company = await prisma.company.findUnique({
      where: { ticker: normalizedTicker },
      select: { id: true, ticker: true, name: true }
    });

    if (!company) {
      return NextResponse.json(
        { error: `Empresa ${normalizedTicker} não encontrada no banco de dados` },
        { status: 404 }
      );
    }

    // 2. Definir período: desde 2000 até hoje
    // Nota: Yahoo Finance pode não ter dados para todas as empresas desde 2000,
    // mas tentaremos buscar o máximo disponível
    const startDate = new Date('2000-01-01');
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    console.log(`  → Período: ${startDate.toISOString().split('T')[0]} até ${endDate.toISOString().split('T')[0]}`);

    // 3. Buscar dados históricos do Yahoo Finance (intervalo mensal)
    // IMPORTANTE: Como funciona a data no intervalo mensal (1mo):
    // 
    // O Yahoo Finance retorna dados mensais onde cada registro representa o FECHAMENTO de um mês.
    // A data geralmente é o ÚLTIMO DIA ÚTIL daquele mês, mas pode ser o primeiro dia útil do mês seguinte
    // se o último dia do mês foi fim de semana.
    //
    // ATENÇÃO: O Yahoo Finance pode retornar múltiplos registros no mesmo mês, especialmente:
    // - No mês atual (dados parciais)
    // - Quando há atualizações durante o mês
    //
    // Por isso, agrupamos por mês/ano e mantemos apenas o registro mais recente de cada mês.
    //
    // REGRA: A data representa o FECHAMENTO do mês. Os valores OHLC são referentes ao período mensal.
    // Para meses completos, a data geralmente é o último dia útil do mês.
    // Para o mês atual (incompleto), pode haver dados parciais.
    console.log(`  → Buscando dados do Yahoo Finance...`);
    const historicalData = await HistoricalDataService.fetchHistoricalFromYahoo(
      normalizedTicker,
      startDate,
      endDate,
      '1mo' // Intervalo mensal - dados representam o fechamento de cada mês
    );

    if (historicalData.length === 0) {
      return NextResponse.json(
        { 
          error: `Nenhum dado histórico encontrado no Yahoo Finance para ${normalizedTicker}`,
          success: false
        },
        { status: 404 }
      );
    }

    console.log(`  → ${historicalData.length} registros encontrados no Yahoo Finance (mensais)`);

    // 3.5. Buscar também dados diários do mês atual para ter atualizações frequentes
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    console.log(`  → Buscando dados diários do mês atual (${currentMonthStart.toISOString().split('T')[0]} até hoje)...`);
    const dailyDataCurrentMonth = await HistoricalDataService.fetchHistoricalFromYahoo(
      normalizedTicker,
      currentMonthStart,
      endDate,
      '1d' // Dados diários para o mês atual
    );

    // Combinar dados mensais (históricos) com dados diários (mês atual)
    const allData = [...historicalData, ...dailyDataCurrentMonth];
    console.log(`  → Total: ${allData.length} registros (${historicalData.length} mensais + ${dailyDataCurrentMonth.length} diários do mês atual)`);

    // Processar: manter último registro de cada mês fechado e todos do mês atual
    const processedData = HistoricalDataService.processMonthlyData(allData);
    
    if (processedData.length < allData.length) {
      console.log(`  → ${processedData.length} registros após processamento (${allData.length - processedData.length} removidos - mantém fechamento de meses fechados e todos do mês atual)`);
    }

    // 4. Remover dados históricos existentes (opcional - podemos fazer upsert também)
    const existingCount = await prisma.historicalPrice.count({
      where: {
        companyId: company.id,
        interval: '1mo'
      }
    });

    if (existingCount > 0) {
      console.log(`  → Removendo ${existingCount} registros existentes...`);
      await prisma.historicalPrice.deleteMany({
        where: {
          companyId: company.id,
          interval: '1mo'
        }
      });
    }

    // 5. Salvar novos dados históricos (já processados)
    console.log(`  → Salvando ${processedData.length} novos registros...`);
    await HistoricalDataService.saveHistoricalData(
      company.id,
      processedData,
      '1mo', // Intervalo principal é mensal, mas mês atual terá dados diários
      normalizedTicker
    );

    // 6. Buscar estatísticas finais
    const finalCount = await prisma.historicalPrice.count({
      where: {
        companyId: company.id,
        interval: '1mo'
      }
    });

    const firstDate = processedData.length > 0 
      ? processedData[0].date 
      : null;
    const lastDate = processedData.length > 0 
      ? processedData[processedData.length - 1].date 
      : null;

    console.log(`✅ [ADMIN HISTORICAL PRICES] Preços históricos recriados com sucesso para ${normalizedTicker}`);

    return NextResponse.json({
      success: true,
      message: `Preços históricos recriados com sucesso para ${normalizedTicker}`,
      details: {
        ticker: normalizedTicker,
        companyName: company.name,
        recordsProcessed: allData.length,
        recordsDeduplicated: processedData.length,
        recordsSaved: finalCount,
        firstDate: firstDate ? firstDate.toISOString().split('T')[0] : null,
        lastDate: lastDate ? lastDate.toISOString().split('T')[0] : null,
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    console.error(`❌ [ADMIN HISTORICAL PRICES] Error recreating historical prices:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao recriar preços históricos'
      },
      { status: 500 }
    );
  }
}

