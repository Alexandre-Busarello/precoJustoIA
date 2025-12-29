/**
 * Cron Job: Processar Reavaliação de Flags
 * 
 * Processa a fila de flags pendentes de reavaliação com checkpointing para evitar timeouts
 * Etapas: RESEARCH -> ANALYSIS -> EVALUATION
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getNextBatch,
  markProcessing,
  saveStepCheckpoint,
  getStepCheckpoint,
  getNextStep,
  markCompleted,
  markFailed,
} from '@/lib/company-flags-queue-service';
import {
  reevaluateFlag,
  researchCurrentConditions,
  analyzeFlagRelevance,
  evaluateFlagStatus,
} from '@/lib/company-flag-reevaluation-service';
import { FlagReevaluationStep } from '@prisma/client';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('🔄 Iniciando cron job de processamento de reavaliação de flags...');

  try {
    // 1. Validar CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Tentativa de acesso não autorizado ao cron job');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Configurações
    const BATCH_SIZE = parseInt(process.env.FLAG_REEVALUATION_BATCH_SIZE || '5');
    const MAX_EXECUTION_TIME = 50 * 1000; // 50 segundos em ms
    const STEP_TIMEOUT = 30 * 1000; // 30 segundos por etapa

    console.log(`📊 Configurações: BATCH_SIZE=${BATCH_SIZE}, MAX_EXECUTION_TIME=${MAX_EXECUTION_TIME}ms`);

    // 3. Buscar próximo lote da fila
    const queueEntries = await getNextBatch(BATCH_SIZE);

    console.log(`📦 Encontrados ${queueEntries.length} itens na fila para processar`);

    let processedCount = 0;
    let flagsReevaluated = 0;
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
          // Todas as etapas completadas, executar reavaliação final
          await processFinalReevaluation(entry);
          flagsReevaluated++;
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
          await markFailed(entry.id, errorMsg);
        } catch (failError) {
          console.error(`❌ Erro ao marcar ${entry.id} como FAILED:`, failError);
        }
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      processed: processedCount,
      reevaluated: flagsReevaluated,
      errors: errors.length > 0 ? errors : undefined,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Erro no cron job de processamento de flags:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Processa uma etapa específica de reavaliação
 */
async function processStep(
  entry: { id: string; flagId: string },
  step: FlagReevaluationStep
): Promise<void> {
  // Verificar se já existe checkpoint (retomar)
  const existingCheckpoint = await getStepCheckpoint(entry.id, step);
  
  if (existingCheckpoint) {
    console.log(`📋 ${entry.id}: Retomando etapa ${step} de checkpoint`);
    return;
  }

  // Buscar flag e empresa
  const flag = await prisma.companyFlag.findUnique({
    where: { id: entry.flagId },
    include: {
      company: {
        select: {
          id: true,
          ticker: true,
          name: true,
          sector: true,
          industry: true,
        },
      },
    },
  });

  if (!flag) {
    throw new Error(`Flag ${entry.flagId} não encontrada`);
  }

  let stepData: Record<string, any> = {};

  switch (step) {
    case 'RESEARCH': {
      // Pesquisar condições atuais
      console.log(`🔍 ${entry.id}: Pesquisando condições atuais de ${flag.company.ticker}`);
      const currentConditions = await researchCurrentConditions(
        flag.companyId,
        flag.flagType,
        flag.company.ticker
      );
      stepData = {
        currentConditions,
        researchedAt: new Date().toISOString(),
      };
      break;
    }

    case 'ANALYSIS': {
      // Buscar checkpoint de RESEARCH
      const researchCheckpoint = await getStepCheckpoint(entry.id, 'RESEARCH');
      if (!researchCheckpoint) {
        throw new Error('Checkpoint de RESEARCH não encontrado');
      }

      const researchCurrentConditions = researchCheckpoint.data.currentConditions;

      // Analisar relevância do flag
      console.log(`📊 ${entry.id}: Analisando relevância do flag para ${flag.company.ticker}`);
      const flagAnalysis = await analyzeFlagRelevance(
        flag.reason,
        flag.flagType,
        flag.company.ticker,
        flag.company.name,
        researchCurrentConditions
      );
      stepData = {
        analysis: flagAnalysis,
        analyzedAt: new Date().toISOString(),
      };
      break;
    }

    case 'EVALUATION': {
      // Buscar checkpoint de ANALYSIS
      const analysisCheckpoint = await getStepCheckpoint(entry.id, 'ANALYSIS');
      if (!analysisCheckpoint) {
        throw new Error('Checkpoint de ANALYSIS não encontrado');
      }

      const flagAnalysis = analysisCheckpoint.data.analysis;

      // Avaliar status final
      console.log(`✅ ${entry.id}: Avaliando status final do flag para ${flag.company.ticker}`);
      const evaluation = await evaluateFlagStatus(flagAnalysis, flag.reason);
      stepData = {
        evaluation,
        evaluatedAt: new Date().toISOString(),
      };
      break;
    }
  }

  // Salvar checkpoint
  await saveStepCheckpoint(entry.id, step, stepData);
}

/**
 * Executa reavaliação final e atualiza flag
 */
async function processFinalReevaluation(
  entry: { id: string; flagId: string }
): Promise<void> {
  // Buscar checkpoint de EVALUATION
  const evaluationCheckpoint = await getStepCheckpoint(entry.id, 'EVALUATION');
  if (!evaluationCheckpoint) {
    throw new Error('Checkpoint de EVALUATION não encontrado');
  }

  const evaluation = evaluationCheckpoint.data.evaluation as {
    shouldKeepActive: boolean;
    newReason?: string;
    analysisSummary?: string;
  };

  // Buscar flag
  const flag = await prisma.companyFlag.findUnique({
    where: { id: entry.flagId },
    include: {
      company: {
        select: {
          ticker: true,
        },
      },
    },
  });

  if (!flag) {
    throw new Error(`Flag ${entry.flagId} não encontrada`);
  }

  // Atualizar flag
  await prisma.companyFlag.update({
    where: { id: entry.flagId },
    data: {
      isActive: evaluation.shouldKeepActive,
      reason: evaluation.newReason || flag.reason,
      lastReevaluatedAt: new Date(),
      reevaluationCount: {
        increment: 1,
      },
    },
  });

  console.log(
    `✅ Flag ${entry.flagId} (${flag.company.ticker}) ${evaluation.shouldKeepActive ? 'mantido ativo' : 'desativado'}`
  );

  // Marcar fila como COMPLETED
  await markCompleted(entry.id);
}

/**
 * POST - Mesmo comportamento do GET (para compatibilidade com alguns serviços de cron)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

