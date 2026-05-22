/**
 * Cron Job: Monitoramento de Gatilhos Customizados
 * 
 * Avalia todos os gatilhos customizados ativos e cria entradas na fila
 * quando as condições são atendidas
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMonitorsByPriority, evaluateTrigger, createQueueEntry } from '@/lib/custom-trigger-service';

export const maxDuration = 300;

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

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}`);

    // 3. Buscar monitores separados por prioridade (Premium primeiro)
    const { premium, free } = await getMonitorsByPriority();
    console.log(`📦 Encontrados ${premium.length} monitores Premium e ${free.length} monitores Gratuitos`);

    let processedCount = 0;
    let queueEntriesCreated = 0;
    let alertsActivated = 0;
    let alertsDeactivated = 0;
    const errors: string[] = [];

    // Função auxiliar para processar um monitor
    const processMonitor = async (monitor: typeof premium[0]) => {
      try {
        // Avaliar gatilho
        const evaluation = await evaluateTrigger({
          id: monitor.id,
          companyId: monitor.companyId,
          triggerConfig: monitor.triggerConfig,
          company: monitor.company,
        });

        if (!evaluation) {
          // Gatilho não disparou - verificar se precisa desativar alerta
          if (monitor.isAlertActive) {
            await prisma.userAssetMonitor.update({
              where: { id: monitor.id },
              data: { 
                isAlertActive: false,
                lastProcessedAt: new Date(),
              },
            });
            alertsDeactivated++;
            console.log(`🔄 ${monitor.company.ticker}: Gatilho não disparado, desativando alerta`);
          } else {
            // Atualizar lastProcessedAt mesmo quando não há mudança de estado
            await prisma.userAssetMonitor.update({
              where: { id: monitor.id },
              data: { lastProcessedAt: new Date() },
            });
          }
          return;
        }

        // Gatilho disparou
        if (!evaluation.triggered) {
          // Se não disparou mas tinha alerta ativo, desativar
          if (monitor.isAlertActive) {
            await prisma.userAssetMonitor.update({
              where: { id: monitor.id },
              data: { 
                isAlertActive: false,
                lastProcessedAt: new Date(),
              },
            });
            alertsDeactivated++;
            console.log(`🔄 ${monitor.company.ticker}: Condições não atendidas, desativando alerta`);
          } else {
            // Atualizar lastProcessedAt mesmo quando não há mudança de estado
            await prisma.userAssetMonitor.update({
              where: { id: monitor.id },
              data: { lastProcessedAt: new Date() },
            });
          }
          return;
        }

        // Gatilho disparou - verificar se já está ativo
        if (monitor.isAlertActive) {
          // Atualizar lastProcessedAt mesmo quando já está ativo
          await prisma.userAssetMonitor.update({
            where: { id: monitor.id },
            data: { lastProcessedAt: new Date() },
          });
          console.log(`⏭️ ${evaluation.ticker}: Alerta já está ativo, evitando spam`);
          return;
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
          // Criar entrada na fila e marcar alerta como ativo
          await createQueueEntry(evaluation.monitorId, evaluation);
          queueEntriesCreated++;
          alertsActivated++;
          console.log(`✅ ${evaluation.ticker}: Gatilho customizado disparado - ${evaluation.reasons.join(', ')}`);
        } else {
          // Atualizar lastProcessedAt mesmo quando já existe entrada na fila
          await prisma.userAssetMonitor.update({
            where: { id: monitor.id },
            data: { lastProcessedAt: new Date() },
          });
          console.log(`⏭️ ${evaluation.ticker}: Já existe entrada na fila recente, pulando`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${monitor.company.ticker}: ${errorMsg}`);
        console.error(`❌ Erro ao processar gatilho ${monitor.id}:`, error);
        
        // Atualizar lastProcessedAt mesmo em caso de erro para não ficar travado
        try {
          await prisma.userAssetMonitor.update({
            where: { id: monitor.id },
            data: { lastProcessedAt: new Date() },
          });
        } catch (updateError) {
          console.error(`❌ Erro ao atualizar lastProcessedAt para monitor ${monitor.id}:`, updateError);
        }
      }
    };

    // Processar Premium primeiro
    console.log(`👑 Processando ${premium.length} monitores Premium...`);
    for (const monitor of premium.slice(0, BATCH_SIZE)) {
      await processMonitor(monitor);
      processedCount++;

      // Verificar timeout
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        console.log(`⏱️ Tempo limite atingido, interrompendo processamento`);
        break;
      }
    }

    // Processar Gratuitos depois (se ainda houver tempo)
    if (Date.now() - startTime < MAX_EXECUTION_TIME) {
      const remainingTime = MAX_EXECUTION_TIME - (Date.now() - startTime);
      const remainingBatch = Math.min(free.length, Math.floor(remainingTime / 1000)); // Estimativa conservadora
      
      console.log(`🆓 Processando ${Math.min(remainingBatch, free.length)} monitores Gratuitos...`);
      for (const monitor of free.slice(0, remainingBatch)) {
        await processMonitor(monitor);
        processedCount++;

        // Verificar timeout
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.log(`⏱️ Tempo limite atingido, interrompendo processamento`);
          break;
        }
      }
    } else {
      console.log(`⏱️ Tempo limite atingido após processar Premium, pulando Gratuitos`);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      premiumProcessed: premium.length,
      freeProcessed: free.length,
      processed: processedCount,
      queueEntriesCreated,
      alertsActivated,
      alertsDeactivated,
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

