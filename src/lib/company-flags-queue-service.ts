/**
 * COMPANY FLAGS QUEUE SERVICE
 * 
 * Serviço para gerenciar fila de reavaliação de flags de empresas
 * com suporte a checkpointing para evitar timeouts
 */

import { prisma } from './prisma';
import { FlagReevaluationStep } from '@prisma/client';

export interface FlagQueueEntryParams {
  flagId: string;
  priority?: number;
}

export interface FlagCheckpointData {
  step: FlagReevaluationStep;
  data: Record<string, any>;
}

/**
 * Adiciona flag à fila de reavaliação
 */
export async function addFlagToQueue(params: FlagQueueEntryParams): Promise<string> {
  const queueEntry = await prisma.companyFlagsQueue.create({
    data: {
      flagId: params.flagId,
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
    flagId: string;
    status: string;
  }>
> {
  const entries = await prisma.companyFlagsQueue.findMany({
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
      flagId: true,
      status: true,
    },
  });

  return entries;
}

/**
 * Marca item da fila como PROCESSING
 */
export async function markProcessing(queueId: string): Promise<void> {
  await prisma.companyFlagsQueue.update({
    where: { id: queueId },
    data: {
      status: 'PROCESSING',
    },
  });
}

/**
 * Salva checkpoint de uma etapa de processamento
 */
export async function saveStepCheckpoint(
  queueId: string,
  step: FlagReevaluationStep,
  data: Record<string, any>
): Promise<void> {
  await prisma.companyFlagsQueueProcessing.upsert({
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
export async function getStepCheckpoint(
  queueId: string,
  step: FlagReevaluationStep
): Promise<FlagCheckpointData | null> {
  const checkpoint = await prisma.companyFlagsQueueProcessing.findUnique({
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
    step: checkpoint.step,
    data: checkpoint.stepData as Record<string, any>,
  };
}

/**
 * Busca todos os checkpoints de um item da fila
 */
export async function getAllCheckpoints(queueId: string): Promise<FlagCheckpointData[]> {
  const checkpoints = await prisma.companyFlagsQueueProcessing.findMany({
    where: { queueId },
    orderBy: { completedAt: 'asc' },
  });

  return checkpoints.map(cp => ({
    step: cp.step,
    data: cp.stepData as Record<string, any>,
  }));
}

/**
 * Verifica qual é a próxima etapa a ser processada
 */
export async function getNextStep(queueId: string): Promise<FlagReevaluationStep | null> {
  const checkpoints = await getAllCheckpoints(queueId);
  const steps: FlagReevaluationStep[] = ['RESEARCH', 'ANALYSIS', 'EVALUATION'];

  for (const step of steps) {
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
 * Finaliza processamento da fila
 */
export async function markCompleted(queueId: string): Promise<void> {
  await prisma.companyFlagsQueue.update({
    where: { id: queueId },
    data: {
      status: 'COMPLETED',
      processedAt: new Date(),
    },
  });
}

/**
 * Marca item da fila como FAILED
 */
export async function markFailed(
  queueId: string,
  errorMessage: string
): Promise<void> {
  await prisma.companyFlagsQueue.update({
    where: { id: queueId },
    data: {
      status: 'FAILED',
      errorMessage,
      processedAt: new Date(),
    },
  });
}

