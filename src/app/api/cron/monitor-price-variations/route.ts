/**
 * Cron Job: Monitoramento de Variações de Preço
 * 
 * Itera sobre empresas para detectar quedas de preço significativas
 * e criar entradas na fila de relatórios de IA
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPriceVariations } from '@/lib/price-variation-service';
import { addToQueue } from '@/lib/ai-report-queue-service';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('📊 Iniciando cron job de monitoramento de variações de preço...');

  try {
    // 1. Validar CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizada ao cron job');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Configurações
    const BATCH_SIZE = parseInt(process.env.PRICE_MONITORING_BATCH_SIZE || '50');
    const MAX_EXECUTION_TIME = 50 * 1000; // 50 segundos em ms

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}`);

    // 3. Buscar próximo lote de empresas para processar
    // Priorizar empresas com priceVariationLastCheckedAt mais antigo ou NULL
    const companies = await prisma.company.findMany({
      where: {
        assetType: 'STOCK', // Apenas ações (não ETFs, FIIs, etc)
      },
      orderBy: [
        { priceVariationLastCheckedAt: { sort: 'asc', nulls: 'first' } },
      ],
      take: BATCH_SIZE,
      select: {
        id: true,
        ticker: true,
        name: true,
        priceVariationLastCheckedAt: true,
      },
    });

    console.log(`📦 Processando lote de ${companies.length} empresas`);

    let processedCount = 0;
    let queueEntriesCreated = 0;
    const errors: string[] = [];

    // Processar empresas sequencialmente para evitar sobrecarga
    for (const company of companies) {
      try {
        // Verificar se já passou tempo suficiente desde última verificação
        // (evitar verificar mesma empresa múltiplas vezes no mesmo dia)
        if (company.priceVariationLastCheckedAt) {
          const hoursSinceCheck = (Date.now() - company.priceVariationLastCheckedAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceCheck < 6) {
            // Verificou nas últimas 6 horas, pular
            continue;
          }
        }

        // Verificar variações de preço
        const variationCheck = await checkPriceVariations(company.id, company.ticker);

        if (variationCheck.triggered && variationCheck.triggerReason) {
          const windowDays = variationCheck.triggerReason.days;
          
          // Verificar se já existe relatório recente baseado na janela temporal
          let shouldCreateReport = false;
          let checkDate: Date;

          if (windowDays === 1) {
            // Janela de 1 dia: verificar se já existe relatório criado no mesmo dia
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            checkDate = today;
            
            const existingReport = await prisma.aIReport.findFirst({
              where: {
                companyId: company.id,
                type: 'PRICE_VARIATION',
                windowDays: 1,
                status: 'COMPLETED',
                createdAt: {
                  gte: checkDate,
                },
              },
            });

            shouldCreateReport = !existingReport;
          } else if (windowDays === 5) {
            // Janela de 5 dias: verificar se já existe relatório criado nos últimos 5 dias
            checkDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
            
            const existingReport = await prisma.aIReport.findFirst({
              where: {
                companyId: company.id,
                type: 'PRICE_VARIATION',
                windowDays: 5,
                status: 'COMPLETED',
                createdAt: {
                  gte: checkDate,
                },
              },
            });

            shouldCreateReport = !existingReport;
          } else if (windowDays === 30) {
            // Janela de 30 dias: verificar se já existe relatório criado nos últimos 30 dias
            checkDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            const existingReport = await prisma.aIReport.findFirst({
              where: {
                companyId: company.id,
                type: 'PRICE_VARIATION',
                windowDays: 30,
                status: 'COMPLETED',
                createdAt: {
                  gte: checkDate,
                },
              },
            });

            shouldCreateReport = !existingReport;
          } else if (windowDays === 365) {
            // Janela de 365 dias: verificar se já existe relatório criado nos últimos 3 meses (trimestre)
            checkDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            
            const existingReport = await prisma.aIReport.findFirst({
              where: {
                companyId: company.id,
                type: 'PRICE_VARIATION',
                windowDays: 365,
                status: 'COMPLETED',
                createdAt: {
                  gte: checkDate,
                },
              },
            });

            shouldCreateReport = !existingReport;
          } else {
            // Janela desconhecida: criar relatório (fallback)
            shouldCreateReport = true;
          }

          // Também verificar se já existe entrada na fila pendente para evitar duplicatas
          if (shouldCreateReport) {
            const existingQueue = await prisma.aIReportsQueue.findFirst({
              where: {
                companyId: company.id,
                reportType: 'PRICE_VARIATION',
                status: {
                  in: ['PENDING', 'PROCESSING'],
                },
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
                },
              },
            });

            if (!existingQueue) {
              // Criar entrada na fila
              await addToQueue({
                companyId: company.id,
                reportType: 'PRICE_VARIATION',
                triggerReason: {
                  variation: variationCheck.triggerReason.variation,
                  days: variationCheck.triggerReason.days,
                  threshold: variationCheck.triggerReason.threshold,
                  currentPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.currentPrice,
                  previousPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.previousPrice,
                },
                priority: variationCheck.triggerReason.days === 1 ? 2 : variationCheck.triggerReason.days === 30 ? 1 : 0, // Quedas de 1 dia têm prioridade alta
              });

              queueEntriesCreated++;
              console.log(`✅ ${company.ticker}: Variação de ${variationCheck.triggerReason.variation.toFixed(2)}% detectada (${variationCheck.triggerReason.days} dias)`);
            } else {
              console.log(`⏭️ ${company.ticker}: Já existe entrada na fila recente, pulando`);
            }
          } else {
            console.log(`⏭️ ${company.ticker}: Já existe relatório recente para janela de ${windowDays} dias, pulando`);
          }
        }

        // Atualizar priceVariationLastCheckedAt
        await prisma.company.update({
          where: { id: company.id },
          data: { priceVariationLastCheckedAt: new Date() },
        });

        processedCount++;

        // Verificar timeout
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.log(`⏱️ Tempo limite atingido, interrompendo processamento`);
          break;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${company.ticker}: ${errorMsg}`);
        console.error(`❌ Erro ao processar ${company.ticker}:`, error);

        // Atualizar priceVariationLastCheckedAt mesmo em caso de erro para não ficar travado
        try {
          await prisma.company.update({
            where: { id: company.id },
            data: { priceVariationLastCheckedAt: new Date() },
          });
        } catch (updateError) {
          console.error(`❌ Erro ao atualizar priceVariationLastCheckedAt para ${company.ticker}:`, updateError);
        }
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      processed: processedCount,
      queueEntriesCreated,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('❌ Erro no cron job de monitoramento de variações de preço:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

