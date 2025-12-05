/**
 * API: Recreate Historical Prices for All Companies
 * POST /api/admin/historical-prices/recreate-all
 * 
 * Recria preços históricos de todas as empresas desde 2000 usando Yahoo Finance
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { HistoricalDataService } from '@/lib/historical-data-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log(`🔄 [ADMIN HISTORICAL PRICES] Iniciando recriação de preços históricos para TODAS as empresas...`);

    // 1. Buscar todas as empresas
    const companies = await prisma.company.findMany({
      select: { id: true, ticker: true, name: true },
      orderBy: { ticker: 'asc' }
    });

    if (companies.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma empresa encontrada no banco de dados' },
        { status: 404 }
      );
    }

    console.log(`  → ${companies.length} empresas encontradas`);

    // 2. Definir período: desde 2000 até hoje
    const startDate = new Date('2000-01-01');
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const results = {
      total: companies.length,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{
        ticker: string;
        status: 'success' | 'failed' | 'skipped';
        message: string;
        recordsProcessed?: number;
        recordsDeduplicated?: number;
        recordsSaved?: number;
      }>
    };

    // 3. Função auxiliar para processar uma empresa
    const processCompany = async (company: typeof companies[0], index: number, total: number) => {
      try {
        console.log(`  [${index + 1}/${total}] Processando ${company.ticker}...`);

        // Buscar dados históricos mensais do Yahoo Finance
        const historicalData = await HistoricalDataService.fetchHistoricalFromYahoo(
          company.ticker,
          startDate,
          endDate,
          '1mo'
        );

        // Buscar também dados diários do mês atual
        const today = new Date();
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const dailyDataCurrentMonth = await HistoricalDataService.fetchHistoricalFromYahoo(
          company.ticker,
          currentMonthStart,
          endDate,
          '1d' // Dados diários para o mês atual
        );

        const allData = [...historicalData, ...dailyDataCurrentMonth];

        if (allData.length === 0) {
          return {
            ticker: company.ticker,
            status: 'skipped' as const,
            message: 'Nenhum dado encontrado no Yahoo Finance',
            recordsProcessed: 0,
            recordsDeduplicated: 0,
            recordsSaved: 0
          };
        }

        // Processar: manter último registro de cada mês fechado e todos do mês atual
        const processedData = HistoricalDataService.processMonthlyData(allData);

        // Remover dados históricos existentes
        await prisma.historicalPrice.deleteMany({
          where: {
            companyId: company.id,
            interval: '1mo'
          }
        });

        // Salvar novos dados históricos
        await HistoricalDataService.saveHistoricalData(
          company.id,
          processedData,
          '1mo', // Intervalo principal é mensal, mas mês atual terá dados diários
          company.ticker
        );

        console.log(`    ✅ ${company.ticker}: ${processedData.length} registros salvos (${historicalData.length} mensais + ${dailyDataCurrentMonth.length} diários do mês atual)`);

        return {
          ticker: company.ticker,
          status: 'success' as const,
          message: 'Preços históricos recriados com sucesso',
          recordsProcessed: allData.length,
          recordsDeduplicated: processedData.length,
          recordsSaved: processedData.length
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`    ❌ ${company.ticker}: ${errorMessage}`);
        return {
          ticker: company.ticker,
          status: 'failed' as const,
          message: errorMessage
        };
      }
    };

    // 4. Processar empresas em lotes de 5 em paralelo
    const BATCH_SIZE = 5;
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(companies.length / BATCH_SIZE);

      console.log(`\n📦 Processando lote ${batchNumber}/${totalBatches} (${batch.length} empresas): ${batch.map(c => c.ticker).join(', ')}`);

      // Processar lote em paralelo
      const batchResults = await Promise.allSettled(
        batch.map((company, batchIndex) => processCompany(company, i + batchIndex, companies.length))
      );

      // Processar resultados do lote
      for (const result of batchResults) {
        results.processed++;
        
        if (result.status === 'fulfilled') {
          const detail = result.value;
          results.details.push(detail);

          if (detail.status === 'success') {
            results.success++;
          } else if (detail.status === 'skipped') {
            results.skipped++;
          } else {
            results.failed++;
          }
        } else {
          results.failed++;
          results.details.push({
            ticker: 'unknown',
            status: 'failed',
            message: result.reason?.message || 'Erro desconhecido'
          });
        }
      }

      // Pequeno delay entre lotes para não sobrecarregar o Yahoo Finance
      if (i + BATCH_SIZE < companies.length) {
        console.log(`  ⏳ Aguardando 1 segundo antes do próximo lote...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo entre lotes
      }
    }

    console.log(`✅ [ADMIN HISTORICAL PRICES] Processamento concluído:`);
    console.log(`   Total: ${results.total}`);
    console.log(`   Sucesso: ${results.success}`);
    console.log(`   Falhas: ${results.failed}`);
    console.log(`   Ignoradas: ${results.skipped}`);

    return NextResponse.json({
      success: true,
      message: `Processamento concluído: ${results.success} sucesso, ${results.failed} falhas, ${results.skipped} ignoradas`,
      results
    });

  } catch (error) {
    console.error(`❌ [ADMIN HISTORICAL PRICES] Error recreating all historical prices:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao recriar preços históricos'
      },
      { status: 500 }
    );
  }
}

