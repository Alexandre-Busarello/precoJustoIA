/**
 * AI REPORT QUEUE SERVICE
 * 
 * Serviço para gerenciar fila de processamento de relatórios de IA
 * com suporte a checkpointing para evitar timeouts
 */

import { prisma } from './prisma';
import { AIReportType } from '@prisma/client';

export interface QueueEntryParams {
  companyId: number;
  reportType: AIReportType;
  triggerReason: Record<string, any>;
  priority?: number;
}

export interface CheckpointData {
  step: 'RESEARCH' | 'ANALYSIS' | 'COMPILATION';
  data: Record<string, any>;
}

/**
 * Adiciona relatório à fila de processamento
 */
export async function addToQueue(params: QueueEntryParams): Promise<string> {
  const queueEntry = await prisma.aIReportsQueue.create({
    data: {
      companyId: params.companyId,
      reportType: params.reportType,
      triggerReason: params.triggerReason,
      status: 'PENDING',
      priority: params.priority || 0,
    },
  });

  return queueEntry.id;
}

/**
 * Busca próximo lote de itens pendentes da fila
 */
export async function getNextBatch(limit: number = 5): Promise<
  Array<{
    id: string;
    companyId: number;
    reportType: AIReportType;
    triggerReason: any;
    status: string;
  }>
> {
  const entries = await prisma.aIReportsQueue.findMany({
    where: {
      status: {
        in: ['PENDING', 'PROCESSING'],
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
    take: limit,
    select: {
      id: true,
      companyId: true,
      reportType: true,
      triggerReason: true,
      status: true,
    },
  });

  return entries;
}

/**
 * Marca item da fila como PROCESSING
 */
export async function markProcessing(queueId: string): Promise<void> {
  await prisma.aIReportsQueue.update({
    where: { id: queueId },
    data: {
      status: 'PROCESSING',
    },
  });
}

/**
 * Salva checkpoint de uma etapa de processamento
 */
export async function saveCheckpoint(
  queueId: string,
  step: 'RESEARCH' | 'ANALYSIS' | 'COMPILATION',
  data: Record<string, any>
): Promise<void> {
  await prisma.aIReportsQueueProcessing.upsert({
    where: {
      queueId_step: {
        queueId,
        step,
      },
    },
    create: {
      queueId,
      step,
      stepData: data,
    },
    update: {
      stepData: data,
      completedAt: new Date(),
    },
  });
}

/**
 * Busca checkpoint de uma etapa específica
 */
export async function getCheckpoint(
  queueId: string,
  step: 'RESEARCH' | 'ANALYSIS' | 'COMPILATION'
): Promise<CheckpointData | null> {
  const checkpoint = await prisma.aIReportsQueueProcessing.findUnique({
    where: {
      queueId_step: {
        queueId,
        step,
      },
    },
  });

  if (!checkpoint) {
    return null;
  }

  return {
    step: checkpoint.step as 'RESEARCH' | 'ANALYSIS' | 'COMPILATION',
    data: checkpoint.stepData as Record<string, any>,
  };
}

/**
 * Busca todos os checkpoints de um item da fila
 */
export async function getAllCheckpoints(queueId: string): Promise<CheckpointData[]> {
  const checkpoints = await prisma.aIReportsQueueProcessing.findMany({
    where: { queueId },
    orderBy: { completedAt: 'asc' },
  });

  return checkpoints.map(cp => ({
    step: cp.step as 'RESEARCH' | 'ANALYSIS' | 'COMPILATION',
    data: cp.stepData as Record<string, any>,
  }));
}

/**
 * Verifica qual é a próxima etapa a ser processada
 */
export async function getNextStep(queueId: string): Promise<'RESEARCH' | 'ANALYSIS' | 'COMPILATION' | null> {
  const checkpoints = await getAllCheckpoints(queueId);
  const steps: Array<'RESEARCH' | 'ANALYSIS' | 'COMPILATION'> = ['RESEARCH', 'ANALYSIS', 'COMPILATION'];

  // Buscar tipo de relatório para determinar se precisa de RESEARCH
  const queueEntry = await prisma.aIReportsQueue.findUnique({
    where: { id: queueId },
    select: { reportType: true },
  });

  if (!queueEntry) {
    return null;
  }

  // PRICE_VARIATION precisa de RESEARCH, CUSTOM_TRIGGER não
  const needsResearch = queueEntry.reportType === 'PRICE_VARIATION';

  for (const step of steps) {
    // Se não precisa de RESEARCH e estamos na etapa RESEARCH, pular
    if (!needsResearch && step === 'RESEARCH') {
      continue;
    }

    // Verificar se esta etapa já foi completada
    const completed = checkpoints.some(cp => cp.step === step);
    if (!completed) {
      return step;
    }
  }

  // Todas as etapas foram completadas
  return null;
}

/**
 * Finaliza processamento da fila e cria o relatório
 */
export async function completeQueue(
  queueId: string,
  reportId: string
): Promise<void> {
  await prisma.aIReportsQueue.update({
    where: { id: queueId },
    data: {
      status: 'COMPLETED',
      reportId,
      processedAt: new Date(),
    },
  });
}

/**
 * Marca item da fila como FAILED
 */
export async function failQueue(
  queueId: string,
  errorMessage: string
): Promise<void> {
  await prisma.aIReportsQueue.update({
    where: { id: queueId },
    data: {
      status: 'FAILED',
      errorMessage,
      processedAt: new Date(),
    },
  });
}

