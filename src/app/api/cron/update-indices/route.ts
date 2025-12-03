/**
 * Cron Job: Update Indices
 * 
 * Job 1: Mark-to-Market (19:00h) - Calcula pontos do índice
 * Job 2: Engine de Regras (19:30h) - Executa screening e rebalanceamento
 * 
 * IMPORTANTE: Tolerante a falhas e incremental
 * - Pode ser executado múltiplas vezes
 * - Continua de onde parou usando checkpoints
 * - Processa índices um por vez para evitar timeout
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateIndexPoints, fillMissingHistory } from '@/lib/index-engine';
import { runScreening, compareComposition, shouldRebalance, updateComposition } from '@/lib/index-screening-engine';

export const maxDuration = 60; // Limite da Vercel

// Checkpoint para rastrear progresso
interface Checkpoint {
  jobType: 'mark-to-market' | 'screening';
  indexId: string | null;
  lastProcessedIndexId: string | null;
  processedCount: number;
  totalCount: number;
  errors: string[];
}

const GLOBAL_CHECKPOINT_ID = '__GLOBAL__'; // ID especial para checkpoint global

/**
 * Salva checkpoint no banco
 */
async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  try {
    // Usar ID especial para checkpoint global (quando indexId é null)
    const checkpointIndexId = checkpoint.indexId || GLOBAL_CHECKPOINT_ID;
    
    await prisma.indexCronCheckpoint.upsert({
      where: {
        jobType_indexId: {
          jobType: checkpoint.jobType,
          indexId: checkpointIndexId
        }
      },
      create: {
        jobType: checkpoint.jobType,
        indexId: checkpoint.indexId, // null para global, string para específico
        lastProcessedIndexId: checkpoint.lastProcessedIndexId,
        processedCount: checkpoint.processedCount,
        totalCount: checkpoint.totalCount,
        errors: checkpoint.errors
      },
      update: {
        lastProcessedIndexId: checkpoint.lastProcessedIndexId,
        processedCount: checkpoint.processedCount,
        totalCount: checkpoint.totalCount,
        errors: checkpoint.errors
      }
    });
  } catch (error) {
    console.error(`⚠️ [CRON INDICES] Error saving checkpoint:`, error);
    // Não falhar o job por causa de checkpoint
  }
}

/**
 * Carrega checkpoint do banco
 */
async function loadCheckpoint(jobType: 'mark-to-market' | 'screening'): Promise<Checkpoint | null> {
  try {
    // Buscar checkpoint global usando o ID especial
    const checkpoint = await prisma.indexCronCheckpoint.findUnique({
      where: {
        jobType_indexId: {
          jobType,
          indexId: GLOBAL_CHECKPOINT_ID
        }
      }
    });

    if (!checkpoint) {
      return null;
    }

    return {
      jobType: checkpoint.jobType as 'mark-to-market' | 'screening',
      indexId: checkpoint.indexId, // Será null para checkpoint global
      lastProcessedIndexId: checkpoint.lastProcessedIndexId,
      processedCount: checkpoint.processedCount,
      totalCount: checkpoint.totalCount,
      errors: checkpoint.errors as string[]
    };
  } catch (error) {
    console.error(`⚠️ [CRON INDICES] Error loading checkpoint:`, error);
    return null;
  }
}

/**
 * Verifica autenticação do cron job
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  // Em desenvolvimento, permitir sem secret (CUIDADO!)
  if (process.env.NODE_ENV === 'development' && !expectedSecret) {
    return true;
  }

  if (!expectedSecret) {
    return false;
  }

  return (
    authHeader === `Bearer ${expectedSecret}` ||
    cronSecret === expectedSecret
  );
}

/**
 * Job 1: Mark-to-Market (Incremental e tolerante a falhas)
 * Processa índices um por vez até atingir timeout
 */
async function runMarkToMarketJob(): Promise<{ 
  success: number; 
  failed: number; 
  processed: number;
  remaining: number;
  errors: string[];
  nextIndexId?: string;
}> {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 50 * 1000; // 50 segundos (deixar buffer de 10s)
  
  console.log('📊 [CRON INDICES] Starting Mark-to-Market job (incremental)...');

  // Buscar todos os índices ativos
  const allIndices = await prisma.indexDefinition.findMany({
    select: { id: true, ticker: true },
    orderBy: { createdAt: 'asc' }
  });

  if (allIndices.length === 0) {
    console.log('⚠️ [CRON INDICES] No active indices found');
    // Limpar checkpoint se não há índices
    await prisma.indexCronCheckpoint.deleteMany({
      where: {
        jobType: 'mark-to-market',
        indexId: GLOBAL_CHECKPOINT_ID
      }
    }).catch(() => {});
    return { success: 0, failed: 0, processed: 0, remaining: 0, errors: [] };
  }

  // Verificar se todos os índices já estão atualizados para hoje ANTES de processar
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let allUpToDate = true;
  for (const index of allIndices) {
    const lastPoint = await prisma.indexHistoryPoints.findFirst({
      where: { indexId: index.id },
      orderBy: { date: 'desc' }
    });
    
    if (!lastPoint) {
      allUpToDate = false;
      break;
    }
    
    const lastDate = new Date(lastPoint.date);
    lastDate.setHours(0, 0, 0, 0);
    
    if (lastDate < today) {
      allUpToDate = false;
      break;
    }
  }
  
  if (allUpToDate) {
    console.log('✅ [CRON INDICES] All indices are up to date for today. Nothing to process.');
    // Limpar checkpoint e encerrar imediatamente
    await prisma.indexCronCheckpoint.deleteMany({
      where: {
        jobType: 'mark-to-market',
        indexId: GLOBAL_CHECKPOINT_ID
      }
    }).catch(() => {});
    return { success: 0, failed: 0, processed: allIndices.length, remaining: 0, errors: [] };
  }

  // Carregar checkpoint (se existir)
  const checkpoint = await loadCheckpoint('mark-to-market');
  let startIndex = 0;
  
  if (checkpoint && checkpoint.lastProcessedIndexId) {
    const lastIndexIndex = allIndices.findIndex(idx => idx.id === checkpoint.lastProcessedIndexId);
    if (lastIndexIndex >= 0) {
      startIndex = lastIndexIndex + 1; // Continuar do próximo
      console.log(`📌 [CRON INDICES] Resuming from index ${startIndex}/${allIndices.length}`);
    }
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  let lastProcessedIndexId: string | null = null;

  // Processar índices um por vez até atingir timeout
  for (let i = startIndex; i < allIndices.length; i++) {
    // Verificar timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_EXECUTION_TIME) {
      console.log(`⏱️ [CRON INDICES] Timeout approaching (${elapsed}ms), stopping at index ${i}/${allIndices.length}`);
      break;
    }

    const index = allIndices[i];
    lastProcessedIndexId = index.id;

    try {
      console.log(`  📊 Processing ${index.ticker} (${i + 1}/${allIndices.length})...`);

      // Verificar se já está atualizado para hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingToday = await prisma.indexHistoryPoints.findFirst({
        where: {
          indexId: index.id,
          date: today
        }
      });
      
      if (existingToday) {
        console.log(`    ⏭️ ${index.ticker}: Already up to date for today, skipping`);
        successCount++;
        continue;
      }

      // 1. Preencher lacunas históricas primeiro (limitado para não demorar muito)
      const filledDays = await fillMissingHistory(index.id);
      if (filledDays > 0) {
        console.log(`    ✅ ${index.ticker}: Filled ${filledDays} missing days`);
      }

      // 2. Buscar dividendos do dia antes de calcular pontos
      // (a função updateIndexPoints já busca dividendos internamente se não fornecidos)
      
      // 3. Calcular pontos para hoje
      const success = await updateIndexPoints(index.id, today);
      
      if (success) {
        successCount++;
        console.log(`    ✅ ${index.ticker}: Points updated successfully`);
      } else {
        failedCount++;
        errors.push(`${index.ticker}: Failed to update points`);
        console.log(`    ⚠️ ${index.ticker}: Failed to update points`);
      }
    } catch (error) {
      failedCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${index.ticker}: ${errorMsg}`);
      console.error(`    ❌ ${index.ticker}: Error in mark-to-market:`, error);
      // Continuar processando outros índices mesmo se um falhar
    }
  }

    const duration = Date.now() - startTime;
    const processed = successCount + failedCount;
    const remaining = allIndices.length - (startIndex + processed);

    // Se não há mais nada para processar, limpar checkpoint
    if (remaining === 0 && processed === allIndices.length) {
      console.log('✅ [CRON INDICES] All indices processed. Clearing checkpoint.');
      try {
        await prisma.indexCronCheckpoint.deleteMany({
          where: {
            jobType: 'mark-to-market',
            indexId: GLOBAL_CHECKPOINT_ID
          }
        });
      } catch (error) {
        console.error('⚠️ [CRON INDICES] Error clearing checkpoint:', error);
      }
    } else {
      // Salvar checkpoint apenas se ainda há trabalho pendente
      await saveCheckpoint({
        jobType: 'mark-to-market',
        indexId: null,
        lastProcessedIndexId,
        processedCount: startIndex + processed,
        totalCount: allIndices.length,
        errors
      });
    }

    console.log(`✅ [CRON INDICES] Mark-to-Market completed: ${successCount} success, ${failedCount} failed, ${processed} processed, ${remaining} remaining (${duration}ms)`);

    return {
      success: successCount,
      failed: failedCount,
      processed: startIndex + processed,
      remaining,
      errors,
      nextIndexId: lastProcessedIndexId || undefined
    };
}

/**
 * Job 2: Engine de Regras (Screening e Rebalanceamento) - Incremental
 */
async function runScreeningJob(): Promise<{ 
  success: number; 
  failed: number; 
  rebalanced: number;
  processed: number;
  remaining: number;
  errors: string[];
  nextIndexId?: string;
}> {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 50 * 1000; // 50 segundos
  
  console.log('🔍 [CRON INDICES] Starting Screening job (incremental)...');

  const allIndices = await prisma.indexDefinition.findMany({
    include: {
      composition: true
    },
    orderBy: { createdAt: 'asc' }
  });

  if (allIndices.length === 0) {
    console.log('⚠️ [CRON INDICES] No active indices found');
    // Limpar checkpoint se não há índices
    await prisma.indexCronCheckpoint.deleteMany({
      where: {
        jobType: 'screening',
        indexId: GLOBAL_CHECKPOINT_ID
      }
    }).catch(() => {});
    return { success: 0, failed: 0, rebalanced: 0, processed: 0, remaining: 0, errors: [] };
  }
  
  // Verificar se já foi executado hoje (verificando último log de rebalanceamento)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let allScreenedToday = true;
  for (const index of allIndices) {
    const lastLog = await prisma.indexRebalanceLog.findFirst({
      where: { indexId: index.id },
      orderBy: { date: 'desc' }
    });
    
    if (lastLog) {
      const lastLogDate = new Date(lastLog.date);
      lastLogDate.setHours(0, 0, 0, 0);
      
      if (lastLogDate < today) {
        allScreenedToday = false;
        break;
      }
    } else {
      // Se nunca teve log, precisa executar pelo menos uma vez
      allScreenedToday = false;
      break;
    }
  }
  
  if (allScreenedToday) {
    console.log('✅ [CRON INDICES] All indices were screened today. Nothing to process.');
    // Limpar checkpoint e encerrar
    await prisma.indexCronCheckpoint.deleteMany({
      where: {
        jobType: 'screening',
        indexId: GLOBAL_CHECKPOINT_ID
      }
    }).catch(() => {});
    return { success: 0, failed: 0, rebalanced: 0, processed: allIndices.length, remaining: 0, errors: [] };
  }

  // Carregar checkpoint
  const checkpoint = await loadCheckpoint('screening');
  let startIndex = 0;
  
  if (checkpoint && checkpoint.lastProcessedIndexId) {
    const lastIndexIndex = allIndices.findIndex(idx => idx.id === checkpoint.lastProcessedIndexId);
    if (lastIndexIndex >= 0) {
      startIndex = lastIndexIndex + 1;
      console.log(`📌 [CRON INDICES] Resuming screening from index ${startIndex}/${allIndices.length}`);
    }
  }

  let successCount = 0;
  let failedCount = 0;
  let rebalancedCount = 0;
  const errors: string[] = [];
  let lastProcessedIndexId: string | null = null;

  // Processar índices um por vez
  for (let i = startIndex; i < allIndices.length; i++) {
    // Verificar timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_EXECUTION_TIME) {
      console.log(`⏱️ [CRON INDICES] Timeout approaching (${elapsed}ms), stopping screening at index ${i}/${allIndices.length}`);
      break;
    }

    const index = allIndices[i];
    lastProcessedIndexId = index.id;

    try {
      console.log(`  🔍 Processing ${index.ticker} (${i + 1}/${allIndices.length})...`);

      // Verificar se já foi processado hoje (verificando último log)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastLog = await prisma.indexRebalanceLog.findFirst({
        where: { indexId: index.id },
        orderBy: { date: 'desc' }
      });
      
      if (lastLog) {
        const lastLogDate = new Date(lastLog.date);
        lastLogDate.setHours(0, 0, 0, 0);
        
        if (lastLogDate >= today) {
          console.log(`    ⏭️ ${index.ticker}: Already screened today, skipping`);
          successCount++;
          continue;
        }
      }

      // 1. Executar screening
      const idealComposition = await runScreening(index);

      if (idealComposition.length === 0) {
        console.warn(`    ⚠️ ${index.ticker}: No companies found in screening`);
        successCount++; // Considerar sucesso mesmo sem resultados
        continue;
      }

      // 2. Aplicar validação de qualidade se checkQuality estiver ativado
      const config = index.config as any;
      let validatedComposition = idealComposition;
      
      if (config.rebalance?.checkQuality) {
        const { filterByQuality } = await import('@/lib/index-screening-engine');
        const qualityResult = await filterByQuality(idealComposition, config);
        validatedComposition = qualityResult.valid;
        
        if (validatedComposition.length === 0) {
          console.warn(`    ⚠️ ${index.ticker}: No companies passed quality check for rebalancing (${qualityResult.rejected.length} rejected)`);
          successCount++; // Considerar sucesso mesmo sem resultados
          continue;
        }
        
        if (qualityResult.rejected.length > 0) {
          console.log(`    ℹ️ ${index.ticker}: ${qualityResult.rejected.length} companies filtered out by quality check (${validatedComposition.length} remain)`);
        }
      }

      // 3. Comparar com composição atual
      const currentComposition = index.composition;
      const changes = compareComposition(currentComposition, validatedComposition);

      // 4. Verificar se deve rebalancear
      const threshold = config.rebalance?.threshold || 0.05;
      const shouldRebalanceIndex = shouldRebalance(currentComposition, validatedComposition, threshold);

      if (shouldRebalanceIndex && changes.length > 0) {
        // Gerar motivo detalhado do rebalanceamento antes de atualizar
        const { generateRebalanceReason } = await import('@/lib/index-screening-engine');
        const rebalanceReason = generateRebalanceReason(
          currentComposition,
          validatedComposition,
          threshold,
          config.rebalance?.checkQuality || false
        );
        
        console.log(`    📋 ${index.ticker}: Motivo do rebalanceamento: ${rebalanceReason}`);
        
        // 5. Atualizar composição (passar motivo do rebalanceamento)
        const updateSuccess = await updateComposition(index.id, validatedComposition, changes, rebalanceReason);
        
        if (updateSuccess) {
          rebalancedCount++;
          console.log(`    ✅ ${index.ticker}: Rebalanced (${changes.length} changes)`);
          console.log(`       - Histórico preservado: pontos históricos mantidos`);
          console.log(`       - Rentabilidade preservada: cálculo continua a partir do último ponto`);
        } else {
          failedCount++;
          errors.push(`${index.ticker}: Failed to update composition`);
          console.log(`    ⚠️ ${index.ticker}: Failed to update composition`);
        }
      } else {
        if (changes.length === 0) {
          console.log(`    ℹ️ ${index.ticker}: No rebalancing needed (composição mantida)`);
        } else {
          console.log(`    ℹ️ ${index.ticker}: No rebalancing needed (threshold não atingido: ${changes.length} mudanças potenciais)`);
        }
      }

      successCount++;
    } catch (error) {
      failedCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${index.ticker}: ${errorMsg}`);
      console.error(`    ❌ ${index.ticker}: Error in screening:`, error);
      // Continuar processando outros índices mesmo se um falhar
    }
  }

  const duration = Date.now() - startTime;
  const processed = successCount + failedCount;
  const remaining = allIndices.length - (startIndex + processed);

  // Se não há mais nada para processar, limpar checkpoint
  if (remaining === 0 && processed === allIndices.length) {
    console.log('✅ [CRON INDICES] All indices processed. Clearing checkpoint.');
    try {
      await prisma.indexCronCheckpoint.deleteMany({
        where: {
          jobType: 'screening',
          indexId: GLOBAL_CHECKPOINT_ID
        }
      });
    } catch (error) {
      console.error('⚠️ [CRON INDICES] Error clearing checkpoint:', error);
    }
  } else {
    // Salvar checkpoint apenas se ainda há trabalho pendente
    await saveCheckpoint({
      jobType: 'screening',
      indexId: null,
      lastProcessedIndexId,
      processedCount: startIndex + processed,
      totalCount: allIndices.length,
      errors
    });
  }

  console.log(`✅ [CRON INDICES] Screening completed: ${successCount} success, ${failedCount} failed, ${rebalancedCount} rebalanced, ${processed} processed, ${remaining} remaining (${duration}ms)`);

  return {
    success: successCount,
    failed: failedCount,
    rebalanced: rebalancedCount,
    processed: startIndex + processed,
    remaining,
    errors,
    nextIndexId: lastProcessedIndexId || undefined
  };
}

/**
 * Endpoint principal do cron job
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verificar autenticação
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Identificar qual job executar
    const { searchParams } = new URL(request.url);
    const job = searchParams.get('job') || 'mark-to-market';

    let result: any;

    switch (job) {
      case 'mark-to-market':
        result = await runMarkToMarketJob();
        break;
      case 'screening':
        result = await runScreeningJob();
        break;
      case 'both':
        // Executar ambos os jobs sequencialmente
        const markToMarketResult = await runMarkToMarketJob();
        const screeningResult = await runScreeningJob();
        result = {
          markToMarket: markToMarketResult,
          screening: screeningResult
        };
        break;
      default:
        return NextResponse.json(
          { error: `Job desconhecido: ${job}. Use 'mark-to-market', 'screening' ou 'both'` },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;
    const hasMore = 'remaining' in result && result.remaining > 0;

    // Se não há mais nada para processar, limpar checkpoint
    if (!hasMore && result.processed === result.totalCount) {
      console.log('✅ [CRON INDICES] All indices processed. Clearing checkpoint.');
      try {
        await prisma.indexCronCheckpoint.deleteMany({
          where: {
            jobType: job === 'both' ? undefined : job,
            indexId: GLOBAL_CHECKPOINT_ID
          }
        });
      } catch (error) {
        console.error('⚠️ [CRON INDICES] Error clearing checkpoint:', error);
      }
    }

    return NextResponse.json({
      success: true,
      job,
      result,
      duration,
      hasMore,
      timestamp: new Date().toISOString(),
      message: hasMore 
        ? `Processado parcialmente. Execute novamente para continuar. ${result.remaining} índices restantes.`
        : 'Processamento concluído para todos os índices.'
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ [CRON INDICES] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
