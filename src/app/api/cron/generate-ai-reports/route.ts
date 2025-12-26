/**
 * Cron Job: Geração de Relatórios de IA
 * 
 * Processa a fila de relatórios pendentes com checkpointing para evitar timeouts
 * Etapas: RESEARCH -> ANALYSIS -> COMPILATION
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getNextBatch,
  markProcessing,
  saveCheckpoint,
  getCheckpoint,
  getNextStep,
  completeQueue,
  failQueue,
} from '@/lib/ai-report-queue-service';
import {
  generatePriceVariationReport,
  createFlagIfNeeded,
} from '@/lib/price-variation-report-service';
import { generateCustomTriggerReport } from '@/lib/custom-trigger-report-service';
import { EmailQueueService } from '@/lib/email-queue-service';
import { NotificationService } from '@/lib/notification-service';
import { AssetMonitoringService } from '@/lib/asset-monitoring-service';
import { shouldSendReportType } from '@/lib/report-preferences-service';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('🤖 Iniciando cron job de geração de relatórios de IA...');

  try {
    // 1. Validar CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizado ao cron job');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Configurações
    const BATCH_SIZE = parseInt(process.env.AI_REPORT_GENERATION_BATCH_SIZE || '5');
    const MAX_EXECUTION_TIME = 50 * 1000; // 50 segundos em ms
    const STEP_TIMEOUT = 30 * 1000; // 30 segundos por etapa

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, MAX_EXECUTION_TIME=${MAX_EXECUTION_TIME}ms`);

    // 3. Buscar próximo lote da fila
    const queueEntries = await getNextBatch(BATCH_SIZE);

    console.log(`📦 Encontrados ${queueEntries.length} itens na fila para processar`);

    let processedCount = 0;
    let reportsGenerated = 0;
    const errors: string[] = [];

    // Processar cada item da fila
    for (const entry of queueEntries) {
      try {
        // Verificar timeout geral
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.log(`⏱️ Tempo limite atingido, interrompendo processamento`);
          break;
        }

        // Marcar como PROCESSING se ainda estiver PENDING
        if (entry.status === 'PENDING') {
          await markProcessing(entry.id);
        }

        // Determinar próxima etapa
        const nextStep = await getNextStep(entry.id);

        if (!nextStep) {
          // Todas as etapas completadas, gerar relatório final
          await processFinalReport(entry);
          reportsGenerated++;
          processedCount++;
          continue;
        }

        console.log(`🔄 ${entry.id}: Processando etapa ${nextStep}`);

        // Processar etapa
        const stepStartTime = Date.now();
        await processStep(entry, nextStep);
        const stepDuration = Date.now() - stepStartTime;

        console.log(`✅ ${entry.id}: Etapa ${nextStep} completada em ${stepDuration}ms`);

        // Verificar timeout da etapa
        if (stepDuration > STEP_TIMEOUT) {
          console.log(`⚠️ ${entry.id}: Etapa ${nextStep} demorou ${stepDuration}ms, pode ter timeout`);
        }

        processedCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${entry.id}: ${errorMsg}`);
        console.error(`❌ Erro ao processar ${entry.id}:`, error);

        // Marcar como FAILED
        try {
          await failQueue(entry.id, errorMsg);
        } catch (failError) {
          console.error(`❌ Erro ao marcar ${entry.id} como FAILED:`, failError);
        }
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      processed: processedCount,
      reportsGenerated,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('❌ Erro no cron job de geração de relatórios:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * Processa uma etapa específica do relatório
 */
async function processStep(
  entry: { id: string; companyId: number; reportType: string; triggerReason: any },
  step: 'RESEARCH' | 'ANALYSIS' | 'COMPILATION'
): Promise<void> {
  // Verificar se já existe checkpoint para esta etapa
  const existingCheckpoint = await getCheckpoint(entry.id, step);

  if (existingCheckpoint) {
    console.log(`⏭️ ${entry.id}: Etapa ${step} já foi processada, usando checkpoint`);
    return;
  }

  // Buscar dados da empresa
  const company = await prisma.company.findUnique({
    where: { id: entry.companyId },
    select: {
      id: true,
      ticker: true,
      name: true,
    },
  });

  if (!company) {
    throw new Error(`Empresa ${entry.companyId} não encontrada`);
  }

  let stepData: Record<string, any> = {};

  switch (step) {
    case 'RESEARCH':
      // Apenas PRICE_VARIATION precisa de pesquisa
      if (entry.reportType === 'PRICE_VARIATION') {
        const { researchPriceDropReason } = await import('@/lib/price-variation-report-service');
        const research = await researchPriceDropReason(
          company.ticker,
          company.name,
          {
            days: entry.triggerReason.days,
            variation: entry.triggerReason.variation,
            currentPrice: entry.triggerReason.currentPrice,
            previousPrice: entry.triggerReason.previousPrice,
          }
        );
        stepData = { research };
      }
      break;

    case 'ANALYSIS':
      if (entry.reportType === 'PRICE_VARIATION') {
        // Buscar checkpoint de RESEARCH
        const researchCheckpoint = await getCheckpoint(entry.id, 'RESEARCH');
        if (!researchCheckpoint) {
          throw new Error('Checkpoint de RESEARCH não encontrado');
        }

        const { analyzeFundamentalImpact } = await import('@/lib/price-variation-report-service');
        const analysis = await analyzeFundamentalImpact(
          company.ticker,
          company.name,
          {
            days: entry.triggerReason.days,
            variation: entry.triggerReason.variation,
            currentPrice: entry.triggerReason.currentPrice,
            previousPrice: entry.triggerReason.previousPrice,
          },
          researchCheckpoint.data.research,
          entry.companyId // Passar companyId para verificar dividendos
        );
        stepData = { analysis };
      } else if (entry.reportType === 'CUSTOM_TRIGGER') {
        // Para CUSTOM_TRIGGER, ANALYSIS é apenas preparação dos dados
        stepData = { prepared: true };
      }
      break;

    case 'COMPILATION':
      if (entry.reportType === 'PRICE_VARIATION') {
        // Buscar checkpoints anteriores
        const researchCheckpoint = await getCheckpoint(entry.id, 'RESEARCH');
        const analysisCheckpoint = await getCheckpoint(entry.id, 'ANALYSIS');

        if (!researchCheckpoint || !analysisCheckpoint) {
          throw new Error('Checkpoints anteriores não encontrados');
        }

        const report = await generatePriceVariationReport({
          ticker: company.ticker,
          companyName: company.name,
          variation: {
            days: entry.triggerReason.days,
            variation: entry.triggerReason.variation,
            currentPrice: entry.triggerReason.currentPrice,
            previousPrice: entry.triggerReason.previousPrice,
          },
          researchData: researchCheckpoint.data.research,
        }, entry.companyId); // Passar companyId para verificar dividendos

        stepData = {
          report,
          isFundamentalLoss: analysisCheckpoint.data.analysis.isFundamentalLoss,
          conclusion: analysisCheckpoint.data.analysis.conclusion,
        };
      } else if (entry.reportType === 'CUSTOM_TRIGGER') {
        const report = await generateCustomTriggerReport({
          ticker: company.ticker,
          companyName: company.name,
          triggerConfig: entry.triggerReason.triggerConfig || entry.triggerReason,
          companyData: entry.triggerReason.companyData || {},
          reasons: entry.triggerReason.reasons || [],
        });

        stepData = { report };
      }
      break;
  }

  // Salvar checkpoint
  await saveCheckpoint(entry.id, step, stepData);
}

/**
 * Gera relatório final e cria notificações/emails
 */
async function processFinalReport(
  entry: { id: string; companyId: number; reportType: string; triggerReason: any }
): Promise<void> {
  // Buscar checkpoint de COMPILATION
  const compilationCheckpoint = await getCheckpoint(entry.id, 'COMPILATION');
  if (!compilationCheckpoint) {
    throw new Error('Checkpoint de COMPILATION não encontrado');
  }

  const reportContent = compilationCheckpoint.data.report;
  if (!reportContent) {
    throw new Error('Conteúdo do relatório não encontrado no checkpoint');
  }

  // Buscar dados da empresa
  const company = await prisma.company.findUnique({
    where: { id: entry.companyId },
    select: {
      id: true,
      ticker: true,
      name: true,
      logoUrl: true,
    },
  });

  if (!company) {
    throw new Error(`Empresa ${entry.companyId} não encontrada`);
  }

  // Para CUSTOM_TRIGGER, buscar userId do UserAssetMonitor
  let userId: string | null = null;
  if (entry.reportType === 'CUSTOM_TRIGGER' && entry.triggerReason?.monitorId) {
    try {
      const monitor = await prisma.userAssetMonitor.findUnique({
        where: { id: entry.triggerReason.monitorId },
        select: { userId: true },
      });
      if (monitor) {
        userId = monitor.userId;
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar userId do monitor ${entry.triggerReason.monitorId}:`, error);
    }
  }

  // Criar relatório no banco
  const report = await prisma.aIReport.create({
    data: {
      companyId: entry.companyId,
      content: reportContent,
      type: entry.reportType as any,
      status: 'COMPLETED',
      isActive: true,
      userId: userId || undefined,
      metadata: {
        triggerReason: entry.triggerReason,
        generatedAt: new Date().toISOString(),
      } as any,
    },
  });

  // Criar flag se necessário (apenas para PRICE_VARIATION com perda de fundamento)
  let flagCreated = false;
  if (
    entry.reportType === 'PRICE_VARIATION' &&
    compilationCheckpoint.data.isFundamentalLoss
  ) {
    await createFlagIfNeeded(
      entry.companyId,
      report.id,
      compilationCheckpoint.data.conclusion || 'Perda de fundamento detectada'
    );
    flagCreated = true;
  }

  // Buscar flags ativos para a empresa (para verificar se devemos usar email de conversão)
  const activeFlags = await prisma.companyFlag.findMany({
    where: {
      companyId: entry.companyId,
      isActive: true,
    },
    take: 1,
  });
  const hasActiveFlag = activeFlags.length > 0;

  // IMPORTANTE: Para PRICE_VARIATION, emails só são enviados para usuários que monitoram o ativo
  // Buscar subscribers da tabela user_asset_subscriptions
  const subscribers = await AssetMonitoringService.getSubscribersForCompany(entry.companyId);

  // Para PRICE_VARIATION, verificar se há subscribers antes de continuar
  if (entry.reportType === 'PRICE_VARIATION' && subscribers.length === 0) {
    console.log(`⚠️ ${entry.id}: Nenhum subscriber encontrado para ${company.ticker}, pulando envio de emails`);
    await completeQueue(entry.id, report.id);
    return;
  }

  console.log(`📧 ${entry.id}: Encontrados ${subscribers.length} subscriber(s) para ${company.ticker}`);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai';
  const reportUrl = `/acao/${company.ticker.toLowerCase()}/relatorios/${report.id}`;
  const reportSummary = reportContent
    .replace(/[#*`]/g, '')
    .substring(0, 500)
    .trim() + '...';

  // Separar usuários logados e anônimos
  // IMPORTANTE: 
  // - Usuários logados (com userId): usar email da tabela user (já vem em subscriber.email)
  // - Usuários anônimos (sem userId): usar email da tabela subscription (já vem em subscriber.email)
  const loggedInSubscribers = subscribers.filter(sub => sub.userId !== null);
  const anonymousSubscribers = subscribers.filter(sub => sub.userId === null);

  // Criar notificações E enviar emails para usuários logados que monitoram o ativo
  // Email usado: da tabela user (via subscriber.email que já vem do AssetMonitoringService)
  let notificationsCreated = 0;
  let emailsQueued = 0;
  
  for (const subscriber of loggedInSubscribers) {
    try {
      // Verificar preferências do usuário para este tipo de relatório
      const reportType = entry.reportType as 'PRICE_VARIATION' | 'CUSTOM_TRIGGER';
      const shouldSend = await shouldSendReportType(subscriber.userId!, reportType);
      
      if (!shouldSend) {
        console.log(`⏭️ ${subscriber.email}: Preferências desabilitadas para ${reportType}, pulando envio`);
        continue;
      }

      // Criar notificação in-app
      await NotificationService.createNotification({
        userId: subscriber.userId!,
        title: entry.reportType === 'PRICE_VARIATION' 
          ? `Variação de Preço: ${company.ticker}`
          : `Gatilho Customizado: ${company.ticker}`,
        message: reportSummary,
        link: reportUrl,
        linkType: 'INTERNAL',
        type: entry.reportType === 'PRICE_VARIATION' ? 'ASSET_CHANGE' : 'AI_REPORT',
        metadata: {
          ticker: company.ticker,
          companyName: company.name,
          reportId: report.id,
          reportType: entry.reportType,
        },
      });
      notificationsCreated++;

      // Verificar se há flag ativo e usuário não é premium - usar email de conversão
      const shouldUseConversionEmail = hasActiveFlag && !subscriber.isPremium;
      
      // Enviar email usando o email da tabela user
      // IMPORTANTE: Passar isPremium para diferenciar premium vs não-premium
      // Se houver flag ativo e usuário não for premium, usar email de conversão (sem detalhes)
      await EmailQueueService.queueEmail({
        email: subscriber.email, // Email da tabela user
        emailType: entry.reportType === 'PRICE_VARIATION' ? 'PRICE_VARIATION_REPORT' : 'CUSTOM_TRIGGER_REPORT',
        emailData: {
          ticker: company.ticker,
          companyName: company.name,
          companyLogoUrl: company.logoUrl || null,
          reportUrl: `${baseUrl}${reportUrl}`,
          reportSummary: shouldUseConversionEmail ? '' : reportSummary, // Não incluir resumo se for conversão
          isPremium: subscriber.isPremium && !shouldUseConversionEmail, // Forçar não-premium se usar conversão
          hasFlag: hasActiveFlag, // Indicar que há flag ativo
        },
        recipientName: subscriber.name || 'Investidor',
      });
      emailsQueued++;
    } catch (error) {
      console.error(`❌ Erro ao processar subscriber logado ${subscriber.email}:`, error);
    }
  }

  // Adicionar emails à fila para subscriptions anônimas que monitoram o ativo
  // Email usado: da tabela subscription (via subscriber.email que já vem do AssetMonitoringService)
  // IMPORTANTE: Anônimos sempre são não-premium, então receberão email de conversão
  for (const subscriber of anonymousSubscribers) {
    try {
      await EmailQueueService.queueEmail({
        email: subscriber.email, // Email da tabela subscription
        emailType: entry.reportType === 'PRICE_VARIATION' ? 'PRICE_VARIATION_REPORT' : 'CUSTOM_TRIGGER_REPORT',
        emailData: {
          ticker: company.ticker,
          companyName: company.name,
          companyLogoUrl: company.logoUrl || null,
          reportUrl: `${baseUrl}${reportUrl}`,
          reportSummary,
          isPremium: false, // Anônimos sempre são não-premium
          hasFlag: hasActiveFlag, // Indicar que há flag ativo (para usar email de conversão)
        },
        recipientName: subscriber.name || 'Investidor',
      });
      emailsQueued++;
    } catch (error) {
      console.error(`❌ Erro ao adicionar email à fila para ${subscriber.email}:`, error);
    }
  }

  console.log(`📬 ${entry.id}: ${notificationsCreated} notificação(ões) criada(s), ${emailsQueued} email(s) adicionado(s) à fila`);

  // Para CUSTOM_TRIGGER, confirmar que isAlertActive = true após envio de emails
  if (entry.reportType === 'CUSTOM_TRIGGER' && entry.triggerReason?.monitorId) {
    try {
      await prisma.userAssetMonitor.update({
        where: { id: entry.triggerReason.monitorId },
        data: { isAlertActive: true },
      });
      console.log(`✅ ${entry.id}: Confirmado isAlertActive = true para monitor ${entry.triggerReason.monitorId}`);
    } catch (error) {
      console.warn(`⚠️ Erro ao confirmar isAlertActive para monitor ${entry.triggerReason.monitorId}:`, error);
    }
  }

  // Finalizar fila
  await completeQueue(entry.id, report.id);

  console.log(`✅ ${entry.id}: Relatório ${report.id} gerado. Notificações: ${notificationsCreated}, Emails: ${emailsQueued}`);
}

