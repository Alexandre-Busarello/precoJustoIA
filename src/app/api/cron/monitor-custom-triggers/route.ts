/**
 * Cron Job: Monitoramento de Gatilhos Customizados
 * 
 * Avalia todos os gatilhos customizados ativos e cria entradas na fila
 * quando as condições são atendidas
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkCustomTriggers, createQueueEntry } from '@/lib/custom-trigger-service';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('🔔 Iniciando cron job de monitoramento de gatilhos customizados...');

  try {
    // 1. Validar CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizada ao cron job');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Configurações
    const BATCH_SIZE = parseInt(process.env.CUSTOM_TRIGGER_BATCH_SIZE || '30');
    const MAX_EXECUTION_TIME = 50 * 1000; // 50 segundos em ms
    const MIN_HOURS_BETWEEN_TRIGGERS = 24; // Evitar disparos muito frequentes

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, MIN_HOURS_BETWEEN_TRIGGERS=${MIN_HOURS_BETWEEN_TRIGGERS}`);

    // 3. Buscar gatilhos customizados ativos
    const evaluations = await checkCustomTriggers();

    console.log(`📦 Encontrados ${evaluations.length} gatilhos que podem ter sido disparados`);

    let processedCount = 0;
    let queueEntriesCreated = 0;
    const errors: string[] = [];

    // Processar avaliações
    for (const evaluation of evaluations.slice(0, BATCH_SIZE)) {
      try {
        if (!evaluation.triggered) {
          continue;
        }

        // Buscar monitoramento para verificar lastTriggeredAt
        const monitor = await prisma.userAssetMonitor.findUnique({
          where: { id: evaluation.monitorId },
          select: { lastTriggeredAt: true },
        });

        // Verificar se já foi disparado recentemente
        if (monitor?.lastTriggeredAt) {
          const hoursSinceTrigger = (Date.now() - monitor.lastTriggeredAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceTrigger < MIN_HOURS_BETWEEN_TRIGGERS) {
            console.log(`⏭️ ${evaluation.ticker}: Gatilho disparado há ${hoursSinceTrigger.toFixed(1)}h, aguardando ${MIN_HOURS_BETWEEN_TRIGGERS}h`);
            continue;
          }
        }

        // Verificar se já existe entrada na fila recente
        const existingQueue = await prisma.aIReportsQueue.findFirst({
          where: {
            companyId: evaluation.companyId,
            reportType: 'CUSTOM_TRIGGER',
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
          await createQueueEntry(evaluation.monitorId, evaluation);
          queueEntriesCreated++;
          console.log(`✅ ${evaluation.ticker}: Gatilho customizado disparado - ${evaluation.reasons.join(', ')}`);
        } else {
          console.log(`⏭️ ${evaluation.ticker}: Já existe entrada na fila recente, pulando`);
        }

        processedCount++;

        // Verificar timeout
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.log(`⏱️ Tempo limite atingido, interrompendo processamento`);
          break;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${evaluation.ticker}: ${errorMsg}`);
        console.error(`❌ Erro ao processar gatilho ${evaluation.monitorId}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      evaluated: evaluations.length,
      processed: processedCount,
      queueEntriesCreated,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('❌ Erro no cron job de monitoramento de gatilhos customizados:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

