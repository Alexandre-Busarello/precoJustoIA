/**
 * Cron Job: Update Indices
 * 
 * Job 1: Mark-to-Market (19:00h) - Calcula pontos do índice
 * Job 2: Engine de Regras (Screening e Rebalanceamento) - Executa em dia útil com pregão, no máximo uma vez por mês
 * 
 * IMPORTANTE: Tolerante a falhas e incremental
 * - Pode ser executado múltiplas vezes
 * - Continua de onde parou usando checkpoints
 * - Processa índices um por vez para evitar timeout
 * 
 * REBALANCEAMENTO MENSAL:
 * - O screening/rebalanceamento pode rodar em qualquer dia útil com pregão
 * - No máximo uma execução por mês (verifica log REBALANCE SYSTEM no mês corrente, timezone Brasília)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateIndexPoints, fillMissingHistory, checkMarketWasOpen } from '@/lib/index-engine';
import { runScreening, compareComposition, shouldRebalance, updateComposition, ensureScreeningLogOncePerDay } from '@/lib/index-screening-engine';
import { cache } from '@/lib/cache-service';
import { getTodayInBrazil } from '@/lib/market-status';

export const maxDuration = 60; // Limite da Vercel

// Checkpoint para rastrear progresso
interface Checkpoint {
  jobType: 'mark-to-market' | 'screening';
  indexId: string | null;
  lastProcessedIndexId: string | null;
  processedCount: number;
  totalCount: number;
  errors: string[];
  createdAt?: Date; // Data de criação do checkpoint
  completedAt?: Date | null; // Data em que o checkpoint foi completado (só é definido quando processedCount === totalCount)
}

const GLOBAL_CHECKPOINT_ID = '__GLOBAL__'; // ID especial para checkpoint global

/**
 * Invalida cache de market-indices após processamento
 * Isso garante que dados atualizados sejam refletidos imediatamente
 */
async function invalidateMarketIndicesCache(): Promise<void> {
  try {
    const CACHE_KEY = 'market-indices';
    await cache.delete(CACHE_KEY);
    console.log('🔄 [CRON INDICES] Cache "market-indices" invalidado após processamento');
  } catch (error) {
    console.error('⚠️ [CRON INDICES] Erro ao invalidar cache:', error);
    // Não falhar o job por causa de erro no cache
  }
}

/**
 * Verifica se é dia útil (segunda a sexta)
 * Retorna true se for dia útil, false se for sábado ou domingo
 */
function isTradingDay(date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay();
  // 0 = Domingo, 6 = Sábado
  // 1-5 = Segunda a Sexta
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

/**
 * Verifica se o screening já foi executado neste mês (timezone de Brasília)
 * Verifica nos logs de rebalanceamento se há algum log deste mês
 */
async function wasScreeningExecutedThisMonth(date: Date = new Date()): Promise<boolean> {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    });
    
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    
    // Criar início e fim do mês atual em Brasília
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    // Verificar se há algum log de rebalanceamento neste mês
    const logThisMonth = await prisma.indexRebalanceLog.findFirst({
      where: {
        action: 'REBALANCE',
        ticker: 'SYSTEM',
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        date: true,
      },
    });
    
    return !!logThisMonth;
  } catch (error) {
    console.error('⚠️ [CRON INDICES] Erro ao verificar se screening foi executado este mês:', error);
    // Em caso de erro, retornar false para permitir execução (fail-safe)
    return false;
  }
}

/**
 * Salva checkpoint no banco
 */
async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  try {
    // Converter null para GLOBAL_CHECKPOINT_ID para garantir consistência no banco
    // Quando indexId é null na interface, salvamos '__GLOBAL__' no banco
    const dbIndexId = checkpoint.indexId || GLOBAL_CHECKPOINT_ID;
    
    // Determinar completedAt: só é definido quando o checkpoint está completo
    const isComplete = checkpoint.processedCount === checkpoint.totalCount && checkpoint.totalCount > 0;
    const completedAt = isComplete ? new Date() : null;
    
    await prisma.indexCronCheckpoint.upsert({
      where: {
        jobType_indexId: {
          jobType: checkpoint.jobType,
          indexId: dbIndexId
        }
      },
      create: {
        jobType: checkpoint.jobType,
        indexId: dbIndexId, // '__GLOBAL__' para global, string para específico
        lastProcessedIndexId: checkpoint.lastProcessedIndexId,
        processedCount: checkpoint.processedCount,
        totalCount: checkpoint.totalCount,
        errors: checkpoint.errors,
        completedAt: completedAt // Definir completedAt apenas se completo
      } as any, // Type assertion temporária até o banco ser atualizado
      update: {
        lastProcessedIndexId: checkpoint.lastProcessedIndexId,
        processedCount: checkpoint.processedCount,
        totalCount: checkpoint.totalCount,
        errors: checkpoint.errors,
        updatedAt: new Date(), // Garantir que updatedAt seja atualizado
        completedAt: completedAt // Atualizar completedAt: definir se completo, manter null se não
      } as any // Type assertion temporária até o banco ser atualizado
    });
  } catch (error) {
    console.error(`⚠️ [CRON INDICES] Error saving checkpoint:`, error);
    // Não falhar o job por causa de checkpoint
  }
}

/**
 * Carrega checkpoint do banco (global ou por índice)
 */
async function loadCheckpoint(jobType: 'mark-to-market' | 'screening', indexId?: string | null): Promise<Checkpoint | null> {
  try {
    // Converter null para GLOBAL_CHECKPOINT_ID para buscar no banco
    const targetIndexId = indexId || GLOBAL_CHECKPOINT_ID;
    
    // Primeiro tentar buscar com GLOBAL_CHECKPOINT_ID
    let checkpoint = await prisma.indexCronCheckpoint.findUnique({
      where: {
        jobType_indexId: {
          jobType,
          indexId: targetIndexId
        }
      }
    });

    // Se não encontrou e estamos buscando checkpoint global, tentar com null (checkpoints antigos)
    if (!checkpoint && !indexId) {
      checkpoint = await prisma.indexCronCheckpoint.findFirst({
        where: {
          jobType,
          indexId: null
        },
        orderBy: {
          updatedAt: 'desc' // Pegar o mais recente se houver múltiplos
        }
      });
    }

    if (!checkpoint) {
      return null;
    }

    // Converter '__GLOBAL__' de volta para null na interface
    const interfaceIndexId = checkpoint.indexId === GLOBAL_CHECKPOINT_ID || checkpoint.indexId === null ? null : checkpoint.indexId;

    return {
      jobType: checkpoint.jobType as 'mark-to-market' | 'screening',
      indexId: interfaceIndexId, // null para global, string para específico
      lastProcessedIndexId: checkpoint.lastProcessedIndexId,
      processedCount: checkpoint.processedCount,
      totalCount: checkpoint.totalCount,
      errors: checkpoint.errors as string[],
      createdAt: checkpoint.createdAt, // Incluir data de criação
      completedAt: (checkpoint as any).completedAt || null // Data de conclusão (type assertion temporária)
    };
  } catch (error) {
    console.error(`⚠️ [CRON INDICES] Error loading checkpoint:`, error);
    return null;
  }
}

/**
 * Carrega checkpoint específico de um índice
 */
async function loadIndexCheckpoint(jobType: 'mark-to-market' | 'screening', indexId: string): Promise<Checkpoint | null> {
  return loadCheckpoint(jobType, indexId);
}

/**
 * Remove checkpoint de um índice específico (quando concluído)
 */
async function clearIndexCheckpoint(jobType: 'mark-to-market' | 'screening', indexId: string): Promise<void> {
  try {
    await prisma.indexCronCheckpoint.delete({
      where: {
        jobType_indexId: {
          jobType,
          indexId
        }
      }
    });
  } catch (error) {
    // Ignorar erro se checkpoint não existe
    console.log(`ℹ️ [CRON INDICES] Checkpoint for index ${indexId} already cleared or doesn't exist`);
  }
}

/**
 * Limpa checkpoints duplicados/antigos com indexId null
 * Migra checkpoints antigos para usar GLOBAL_CHECKPOINT_ID
 */
async function cleanupOldCheckpoints(jobType: 'mark-to-market' | 'screening'): Promise<void> {
  try {
    // Buscar checkpoints antigos com null
    const oldCheckpoints = await prisma.indexCronCheckpoint.findMany({
      where: {
        jobType,
        indexId: null
      }
    });

    if (oldCheckpoints.length === 0) {
      return;
    }

    console.log(`🧹 [CRON INDICES] Found ${oldCheckpoints.length} old checkpoints with null indexId for ${jobType}, cleaning up...`);

    // Buscar checkpoint global atual (se existir)
    const globalCheckpoint = await prisma.indexCronCheckpoint.findUnique({
      where: {
        jobType_indexId: {
          jobType,
          indexId: GLOBAL_CHECKPOINT_ID
        }
      }
    });

    // Se não há checkpoint global, migrar o mais recente dos antigos
    if (!globalCheckpoint && oldCheckpoints.length > 0) {
      // Ordenar por updatedAt (mais recente primeiro)
      const sorted = oldCheckpoints.sort((a, b) => 
        b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      const mostRecent = sorted[0];

      // Criar checkpoint global com dados do mais recente
      await prisma.indexCronCheckpoint.create({
        data: {
          jobType: mostRecent.jobType,
          indexId: GLOBAL_CHECKPOINT_ID,
          lastProcessedIndexId: mostRecent.lastProcessedIndexId,
          processedCount: mostRecent.processedCount,
          totalCount: mostRecent.totalCount,
          errors: mostRecent.errors as any // Cast necessário para compatibilidade com JsonValue
        }
      });

      console.log(`✅ [CRON INDICES] Migrated most recent checkpoint to global checkpoint for ${jobType}`);
    }

    // Deletar todos os checkpoints antigos com null
    await prisma.indexCronCheckpoint.deleteMany({
      where: {
        jobType,
        indexId: null
      }
    });

    console.log(`✅ [CRON INDICES] Cleaned up ${oldCheckpoints.length} old checkpoints for ${jobType}`);
  } catch (error) {
    console.error(`⚠️ [CRON INDICES] Error cleaning up old checkpoints:`, error);
    // Não falhar o job por causa de limpeza
  }
}

/**
 * Preenche lacunas históricas com checkpoint por índice
 * Permite retomar de onde parou se interrompido
 */
async function fillMissingHistoryWithCheckpoint(
  indexId: string,
  indexTicker: string,
  today: Date
): Promise<number> {
  try {
    // Carregar checkpoint do índice
    const indexCheckpoint = await loadIndexCheckpoint('mark-to-market', indexId);
    
    // Buscar último ponto histórico
    const lastPoint = await prisma.indexHistoryPoints.findFirst({
      where: { indexId },
      orderBy: { date: 'desc' }
    });

    if (!lastPoint) {
      console.warn(`⚠️ [CRON INDICES] No history found for index ${indexTicker}, cannot fill gaps`);
      return 0;
    }

    const lastDate = new Date(lastPoint.date);
    lastDate.setHours(0, 0, 0, 0);

    // Se último ponto é hoje ou futuro, não há lacunas
    if (lastDate >= today) {
      // Limpar checkpoint se não há mais nada para processar
      if (indexCheckpoint) {
        await clearIndexCheckpoint('mark-to-market', indexId);
      }
      return 0;
    }

    // Determinar data inicial: usar checkpoint se existir, senão usar último ponto
    let startDate = new Date(lastDate);
    if (indexCheckpoint && indexCheckpoint.lastProcessedIndexId) {
      // lastProcessedIndexId pode conter uma data (ISO string) ou um ID de índice
      // Tentar interpretar como data primeiro
      const checkpointDate = new Date(indexCheckpoint.lastProcessedIndexId);
      if (!isNaN(checkpointDate.getTime())) {
        startDate = checkpointDate;
        startDate.setDate(startDate.getDate() + 1); // Começar do dia seguinte ao último processado
        console.log(`📌 [CRON INDICES] Resuming fillMissingHistory for ${indexTicker} from ${startDate.toISOString().split('T')[0]}`);
      }
    } else {
      startDate.setDate(startDate.getDate() + 1); // Começar do dia seguinte
    }

    // Gerar lista de dias úteis faltantes
    const missingDates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= today) {
      // Verificar se é dia útil (segunda a sexta)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Verificar se mercado funcionou neste dia
        // CRÍTICO: Não usar cache para verificação de pregão no cron do after market
        const marketWasOpen = await checkMarketWasOpen(currentDate, true);
        if (marketWasOpen) {
          missingDates.push(new Date(currentDate));
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (missingDates.length === 0) {
      // Limpar checkpoint se não há mais nada para processar
      if (indexCheckpoint) {
        await clearIndexCheckpoint('mark-to-market', indexId);
      }
      return 0;
    }

    console.log(`📊 [CRON INDICES] Found ${missingDates.length} missing days for ${indexTicker}`);

    // Processar dias um por vez, atualizando checkpoint após cada dia
    let filledCount = 0;
    for (const date of missingDates) {
      try {
        // CRÍTICO: Não usar cache para atualização de pontos no cron do after market
        const success = await updateIndexPoints(indexId, date, false, true);
        if (success) {
          filledCount++;
          // Atualizar checkpoint com a data processada
          await saveCheckpoint({
            jobType: 'mark-to-market',
            indexId: indexId, // Checkpoint específico do índice
            lastProcessedIndexId: date.toISOString(), // Armazenar data como string
            processedCount: filledCount,
            totalCount: missingDates.length,
            errors: []
          });
        }
      } catch (error) {
        console.error(`❌ [CRON INDICES] Error processing date ${date.toISOString().split('T')[0]} for ${indexTicker}:`, error);
        // Continuar processando outros dias mesmo se um falhar
      }
    }

    // Se todos os dias foram processados, limpar checkpoint do índice
    if (filledCount === missingDates.length) {
      await clearIndexCheckpoint('mark-to-market', indexId);
      console.log(`✅ [CRON INDICES] Completed fillMissingHistory for ${indexTicker}: ${filledCount} days filled`);
    } else {
      console.log(`⚠️ [CRON INDICES] Partial fillMissingHistory for ${indexTicker}: ${filledCount}/${missingDates.length} days filled`);
    }

    return filledCount;
  } catch (error) {
    console.error(`❌ [CRON INDICES] Error filling missing history for index ${indexId}:`, error);
    return 0;
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

  // Limpar checkpoints antigos com null antes de começar
  await cleanupOldCheckpoints('mark-to-market');

  // Buscar todos os índices ativos
  const allIndices = await prisma.indexDefinition.findMany({
    select: { id: true, ticker: true },
    orderBy: { createdAt: 'asc' }
  });

  if (allIndices.length === 0) {
    console.log('⚠️ [CRON INDICES] No active indices found');
    return { success: 0, failed: 0, processed: 0, remaining: 0, errors: [] };
  }

  // Usar timezone de Brasília para garantir data correta
  const today = getTodayInBrazil();
  
  // Verificar se houve pregão hoje (sábado, domingo ou feriado)
  // CRÍTICO: Não usar cache para verificação de pregão no cron do after market
  const marketWasOpen = await checkMarketWasOpen(today, true);
  if (!marketWasOpen) {
    // Usar formatter para pegar o dia da semana no timezone de Brasília
    const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
    });
    const dayName = weekdayFormatter.format(today);
    console.log(`⏸️ [CRON INDICES] Mark-to-Market job skipped: hoje é ${dayName}, mercado não funcionou`);
    return { success: 0, failed: 0, processed: 0, remaining: 0, errors: [] };
  }

  // Carregar checkpoint (se existir)
  let checkpoint = await loadCheckpoint('mark-to-market');
  
  // Verificar se o checkpoint foi completado HOJE usando completedAt
  // completedAt só é definido quando processedCount === totalCount
  const completedAtDate = checkpoint?.completedAt ? new Date(checkpoint.completedAt) : null;
  const wasCompletedToday = completedAtDate ? (
    completedAtDate.getFullYear() === today.getFullYear() &&
    completedAtDate.getMonth() === today.getMonth() &&
    completedAtDate.getDate() === today.getDate()
  ) : false;
  
  // Se checkpoint existe e foi concluído HOJE, confiar nele e não processar novamente
  if (checkpoint && checkpoint.processedCount === checkpoint.totalCount && checkpoint.totalCount === allIndices.length && wasCompletedToday) {
    console.log('✅ [CRON INDICES] Checkpoint completo e completado hoje. Não precisa processar novamente.');
    return { success: 0, failed: 0, processed: allIndices.length, remaining: 0, errors: [] };
  } else if (checkpoint && checkpoint.processedCount === checkpoint.totalCount && !wasCompletedToday) {
    // Checkpoint completo mas completado em outro dia - resetar para processar hoje
    console.log(`🔄 [CRON INDICES] Checkpoint completo mas completado em outro dia (${completedAtDate?.toISOString().split('T')[0] || 'sem data de conclusão'}). Resetting checkpoint para processar hoje.`);
    await saveCheckpoint({
      jobType: 'mark-to-market',
      indexId: null,
      lastProcessedIndexId: null,
      processedCount: 0,
      totalCount: allIndices.length,
      errors: []
    });
    // Recarregar checkpoint após reset para usar o novo
    const resetCheckpoint = await loadCheckpoint('mark-to-market');
    // Substituir checkpoint antigo pelo resetado
    checkpoint = resetCheckpoint;
  }
  
  let startIndex = 0;
  
  // Usar checkpoint para continuar de onde parou (só se não foi resetado ou se é válido)
  if (checkpoint && checkpoint.lastProcessedIndexId) {
    const lastIndexIndex = allIndices.findIndex(idx => idx.id === checkpoint.lastProcessedIndexId);
    if (lastIndexIndex >= 0) {
      startIndex = lastIndexIndex + 1; // Continuar do próximo
      console.log(`📌 [CRON INDICES] Resuming from index ${startIndex}/${allIndices.length} (checkpoint: ${checkpoint.processedCount}/${checkpoint.totalCount})`);
    } else {
      // Se o índice do checkpoint não existe mais, resetar
      console.log('🔄 [CRON INDICES] Checkpoint index not found. Resetting checkpoint.');
      startIndex = 0;
    }
  } else {
    console.log(`📌 [CRON INDICES] Starting from index 0/${allIndices.length} (no checkpoint or checkpoint reset)`);
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  let lastProcessedIndexId: string | null = checkpoint?.lastProcessedIndexId || null;

  // Verificar se há índices com checkpoints pendentes (processamento parcial)
  const pendingIndexCheckpoints = await prisma.indexCronCheckpoint.findMany({
    where: {
      jobType: 'mark-to-market',
      indexId: { not: GLOBAL_CHECKPOINT_ID } // Checkpoints específicos de índices
    }
  });

  // Se há checkpoints pendentes, processar esses índices primeiro
  if (pendingIndexCheckpoints.length > 0) {
    console.log(`📌 [CRON INDICES] Found ${pendingIndexCheckpoints.length} indices with pending checkpoints, processing them first`);
    for (const pendingCheckpoint of pendingIndexCheckpoints) {
      if (pendingCheckpoint.indexId) {
        const pendingIndex = allIndices.find(idx => idx.id === pendingCheckpoint.indexId);
        if (pendingIndex) {
          const indexIndex = allIndices.findIndex(idx => idx.id === pendingIndex.id);
          // Reordenar para processar índices pendentes primeiro
          if (indexIndex > startIndex) {
            // Mover para frente na lista de processamento
            allIndices.splice(indexIndex, 1);
            allIndices.splice(startIndex, 0, pendingIndex);
          }
        }
      }
    }
  }

  // Processar índices um por vez até atingir timeout
  for (let i = startIndex; i < allIndices.length; i++) {
    // Verificar timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_EXECUTION_TIME) {
      console.log(`⏱️ [CRON INDICES] Timeout approaching (${elapsed}ms), stopping at index ${i}/${allIndices.length}`);
      // Salvar checkpoint global antes de sair por timeout
      // O checkpoint do índice já foi salvo durante o processamento
      await saveCheckpoint({
        jobType: 'mark-to-market',
        indexId: null,
        lastProcessedIndexId,
        processedCount: startIndex + successCount + failedCount,
        totalCount: allIndices.length,
        errors
      });
      break;
    }

    const index = allIndices[i];
    lastProcessedIndexId = index.id;

    try {
      console.log(`  📊 Processing ${index.ticker} (${i + 1}/${allIndices.length})...`);

      // Verificar checkpoint específico do índice
      const indexCheckpoint = await loadIndexCheckpoint('mark-to-market', index.id);
      
      // Se há checkpoint do índice e indica conclusão, verificar se ainda precisa processar
      if (indexCheckpoint && indexCheckpoint.processedCount === indexCheckpoint.totalCount) {
        // Verificar se já está atualizado para hoje
        const existingToday = await prisma.indexHistoryPoints.findFirst({
          where: {
            indexId: index.id,
            date: today
          }
        });
        
        if (existingToday) {
          console.log(`    ⏭️ ${index.ticker}: Already up to date for today (checkpoint indicates completion), skipping`);
          successCount++;
          // Limpar checkpoint do índice se concluído
          await clearIndexCheckpoint('mark-to-market', index.id);
          // Atualizar checkpoint global
          await saveCheckpoint({
            jobType: 'mark-to-market',
            indexId: null,
            lastProcessedIndexId,
            processedCount: startIndex + successCount + failedCount,
            totalCount: allIndices.length,
            errors
          });
          continue;
        } else {
          // Resetar checkpoint do índice se precisa processar novamente
          console.log(`    🔄 ${index.ticker}: Checkpoint exists but needs reprocessing, resetting`);
          await clearIndexCheckpoint('mark-to-market', index.id);
        }
      }

      // Verificar se já está atualizado para hoje
      const existingToday = await prisma.indexHistoryPoints.findFirst({
        where: {
          indexId: index.id,
          date: today
        }
      });
      
      if (existingToday) {
        console.log(`    ⏭️ ${index.ticker}: Already up to date for today, skipping`);
        successCount++;
        // Limpar checkpoint do índice se existir
        await clearIndexCheckpoint('mark-to-market', index.id);
        // Atualizar checkpoint global
        await saveCheckpoint({
          jobType: 'mark-to-market',
          indexId: null,
          lastProcessedIndexId,
          processedCount: startIndex + successCount + failedCount,
          totalCount: allIndices.length,
          errors
        });
        continue;
      }

      // Criar checkpoint do índice antes de começar processamento
      await saveCheckpoint({
        jobType: 'mark-to-market',
        indexId: index.id,
        lastProcessedIndexId: null,
        processedCount: 0,
        totalCount: 0, // Será atualizado durante fillMissingHistory
        errors: []
      });

      // 1. Preencher lacunas históricas primeiro (com checkpoint por índice)
      const filledDays = await fillMissingHistoryWithCheckpoint(index.id, index.ticker, today);
      if (filledDays > 0) {
        console.log(`    ✅ ${index.ticker}: Filled ${filledDays} missing days`);
      }

      // 2. Calcular pontos para hoje
      // CRÍTICO: Usar skipCache=true para garantir preços mais atualizados do Yahoo Finance
      // O cron de after market não pode usar cache (nem do ibovespa nem dos ativos)
      const success = await updateIndexPoints(index.id, today, false, true);
      
      if (success) {
        successCount++;
        console.log(`    ✅ ${index.ticker}: Points updated successfully`);
        // Limpar checkpoint do índice quando concluído com sucesso
        await clearIndexCheckpoint('mark-to-market', index.id);
      } else {
        failedCount++;
        errors.push(`${index.ticker}: Failed to update points`);
        console.log(`    ⚠️ ${index.ticker}: Failed to update points`);
        // Manter checkpoint do índice em caso de falha para retentar depois
      }
      
      // Atualizar checkpoint global após cada índice processado
      await saveCheckpoint({
        jobType: 'mark-to-market',
        indexId: null,
        lastProcessedIndexId,
        processedCount: startIndex + successCount + failedCount,
        totalCount: allIndices.length,
        errors
      });
    } catch (error) {
      failedCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${index.ticker}: ${errorMsg}`);
      console.error(`    ❌ ${index.ticker}: Error in mark-to-market:`, error);
      // Manter checkpoint do índice em caso de erro para retentar depois
      // (não limpar, para permitir retomar de onde parou)
      // Atualizar checkpoint global
      await saveCheckpoint({
        jobType: 'mark-to-market',
        indexId: null,
        lastProcessedIndexId,
        processedCount: startIndex + successCount + failedCount,
        totalCount: allIndices.length,
        errors
      });
      // Continuar processando outros índices mesmo se um falhar
    }
  }

  const duration = Date.now() - startTime;
  const processed = successCount + failedCount;
  const remaining = allIndices.length - (startIndex + processed);

  // Sempre salvar checkpoint final (nunca deletar)
  if (remaining === 0) {
    console.log('✅ [CRON INDICES] All indices processed. Checkpoint marked as complete.');
    // Marcar checkpoint como concluído (processedCount === totalCount)
    await saveCheckpoint({
      jobType: 'mark-to-market',
      indexId: null,
      lastProcessedIndexId,
      processedCount: allIndices.length,
      totalCount: allIndices.length,
      errors
    });
  } else {
    // Salvar checkpoint parcial
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

  // Invalidar cache quando todos os índices foram processados
  if (remaining === 0 && successCount > 0) {
    await invalidateMarketIndicesCache();
  }

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
  
  // Verificar se é dia útil (segunda a sexta)
  // Usar timezone de Brasília para garantir data correta
  const today = getTodayInBrazil();
  
  if (!isTradingDay(today)) {
    // Formatar nome do dia usando timezone de Brasília
    const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
    });
    const dayName = weekdayFormatter.format(today);
    console.log(`⏸️ [CRON INDICES] Screening job skipped: não é dia útil (${dayName})`);
    return { success: 0, failed: 0, rebalanced: 0, processed: 0, remaining: 0, errors: [] };
  }
  
  // Verificar se houve pregão hoje (pode ser feriado mesmo sendo dia útil)
  // CRÍTICO: Não usar cache para verificação de pregão no cron do after market
  const marketWasOpen = await checkMarketWasOpen(today, true);
  if (!marketWasOpen) {
    console.log(`⏸️ [CRON INDICES] Screening job skipped: mercado não funcionou hoje (feriado ou sem pregão)`);
    return { success: 0, failed: 0, rebalanced: 0, processed: 0, remaining: 0, errors: [] };
  }
  
  // No máximo um rebalanceamento por mês (independente do dia do mês)
  const alreadyExecuted = await wasScreeningExecutedThisMonth(today);
  if (alreadyExecuted) {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const dateStr = formatter.format(today);
    console.log(`⏸️ [CRON INDICES] Screening job skipped: já foi executado neste mês (hoje: ${dateStr})`);
    return { success: 0, failed: 0, rebalanced: 0, processed: 0, remaining: 0, errors: [] };
  }
  
  console.log('🔍 [CRON INDICES] Starting Screening job (incremental)...');

  // Limpar checkpoints antigos com null antes de começar
  await cleanupOldCheckpoints('screening');

  const allIndices = await prisma.indexDefinition.findMany({
    include: {
      composition: true
    },
    orderBy: { createdAt: 'asc' }
  });

  if (allIndices.length === 0) {
    console.log('⚠️ [CRON INDICES] No active indices found');
    return { success: 0, failed: 0, rebalanced: 0, processed: 0, remaining: 0, errors: [] };
  }
  
  // Carregar checkpoint primeiro
  let checkpoint = await loadCheckpoint('screening');
  
  // Verificar se já foi executado hoje (verificando último log de rebalanceamento)
  // Usar timezone de Brasília para garantir data correta
  const todayCheck = getTodayInBrazil();
  
  // Verificar se o checkpoint foi completado HOJE usando completedAt
  // completedAt só é definido quando processedCount === totalCount
  const completedAtDate = checkpoint?.completedAt ? new Date(checkpoint.completedAt) : null;
  const wasCompletedToday = completedAtDate ? (
    completedAtDate.getFullYear() === todayCheck.getFullYear() &&
    completedAtDate.getMonth() === todayCheck.getMonth() &&
    completedAtDate.getDate() === todayCheck.getDate()
  ) : false;
  
  // Se checkpoint existe e foi concluído HOJE, confiar nele e não processar novamente
  if (checkpoint && checkpoint.processedCount === checkpoint.totalCount && checkpoint.totalCount === allIndices.length && wasCompletedToday) {
    console.log('✅ [CRON INDICES] Checkpoint completo e completado hoje. Não precisa processar novamente.');
    return { success: 0, failed: 0, rebalanced: 0, processed: allIndices.length, remaining: 0, errors: [] };
  } else if (checkpoint && checkpoint.processedCount === checkpoint.totalCount && !wasCompletedToday) {
    // Checkpoint completo mas completado em outro dia - resetar para processar hoje
    console.log(`🔄 [CRON INDICES] Checkpoint completo mas completado em outro dia (${completedAtDate?.toISOString().split('T')[0] || 'sem data de conclusão'}). Resetting checkpoint para processar hoje.`);
    await saveCheckpoint({
      jobType: 'screening',
      indexId: null,
      lastProcessedIndexId: null,
      processedCount: 0,
      totalCount: allIndices.length,
      errors: []
    });
    // Recarregar checkpoint após reset para usar o novo
    const resetCheckpoint = await loadCheckpoint('screening');
    checkpoint = resetCheckpoint;
  }
  
  let startIndex = 0;
  
  // Usar checkpoint para continuar de onde parou (só se não foi resetado ou se é válido)
  if (checkpoint && checkpoint.lastProcessedIndexId) {
    const lastIndexIndex = allIndices.findIndex(idx => idx.id === checkpoint.lastProcessedIndexId);
    if (lastIndexIndex >= 0) {
      startIndex = lastIndexIndex + 1;
      console.log(`📌 [CRON INDICES] Resuming screening from index ${startIndex}/${allIndices.length} (checkpoint: ${checkpoint.processedCount}/${checkpoint.totalCount})`);
    } else {
      // Se o índice do checkpoint não existe mais, resetar
      console.log('🔄 [CRON INDICES] Checkpoint index not found. Resetting checkpoint.');
      startIndex = 0;
    }
  } else {
    console.log(`📌 [CRON INDICES] Starting screening from index 0/${allIndices.length} (no checkpoint or checkpoint reset)`);
  }

  // Verificar se há índices com checkpoints pendentes (processamento parcial)
  const pendingIndexCheckpoints = await prisma.indexCronCheckpoint.findMany({
    where: {
      jobType: 'screening',
      indexId: { not: GLOBAL_CHECKPOINT_ID } // Checkpoints específicos de índices
    }
  });

  // Se há checkpoints pendentes, processar esses índices primeiro
  if (pendingIndexCheckpoints.length > 0) {
    console.log(`📌 [CRON INDICES] Found ${pendingIndexCheckpoints.length} indices with pending screening checkpoints, processing them first`);
    for (const pendingCheckpoint of pendingIndexCheckpoints) {
      if (pendingCheckpoint.indexId) {
        const pendingIndex = allIndices.find(idx => idx.id === pendingCheckpoint.indexId);
        if (pendingIndex) {
          const indexIndex = allIndices.findIndex(idx => idx.id === pendingIndex.id);
          // Reordenar para processar índices pendentes primeiro
          if (indexIndex > startIndex) {
            // Mover para frente na lista de processamento
            allIndices.splice(indexIndex, 1);
            allIndices.splice(startIndex, 0, pendingIndex);
          }
        }
      }
    }
  }

  let successCount = 0;
  let failedCount = 0;
  let rebalancedCount = 0;
  const errors: string[] = [];
  let lastProcessedIndexId: string | null = checkpoint?.lastProcessedIndexId || null;

  // Processar índices um por vez
  for (let i = startIndex; i < allIndices.length; i++) {
    // Verificar timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_EXECUTION_TIME) {
      console.log(`⏱️ [CRON INDICES] Timeout approaching (${elapsed}ms), stopping screening at index ${i}/${allIndices.length}`);
      // Salvar checkpoint global antes de sair por timeout
      // O checkpoint do índice já foi salvo durante o processamento
      await saveCheckpoint({
        jobType: 'screening',
        indexId: null,
        lastProcessedIndexId,
        processedCount: startIndex + successCount + failedCount,
        totalCount: allIndices.length,
        errors
      });
      break;
    }

    const index = allIndices[i];
    lastProcessedIndexId = index.id;

    try {
      console.log(`  🔍 Processing ${index.ticker} (${i + 1}/${allIndices.length})...`);

      // Verificar checkpoint específico do índice
      const indexCheckpoint = await loadIndexCheckpoint('screening', index.id);
      
      // Se há checkpoint do índice e indica conclusão, verificar se ainda precisa processar
      if (indexCheckpoint && indexCheckpoint.processedCount === indexCheckpoint.totalCount) {
        // Verificar se já foi processado hoje (verificando último log)
        const todayIndex = getTodayInBrazil();
        const lastLog = await prisma.indexRebalanceLog.findFirst({
          where: { indexId: index.id },
          orderBy: { date: 'desc' }
        });
        
        if (lastLog) {
          const lastLogDate = new Date(lastLog.date);
          lastLogDate.setHours(0, 0, 0, 0);
          
          if (lastLogDate >= todayIndex) {
            console.log(`    ⏭️ ${index.ticker}: Already screened today (checkpoint indicates completion), skipping`);
            successCount++;
            // Limpar checkpoint do índice se concluído
            await clearIndexCheckpoint('screening', index.id);
            // Atualizar checkpoint global
            await saveCheckpoint({
              jobType: 'screening',
              indexId: null,
              lastProcessedIndexId,
              processedCount: startIndex + successCount + failedCount,
              totalCount: allIndices.length,
              errors
            });
            continue;
          }
        }
        // Resetar checkpoint do índice se precisa processar novamente
        console.log(`    🔄 ${index.ticker}: Checkpoint exists but needs reprocessing, resetting`);
        await clearIndexCheckpoint('screening', index.id);
      }

      // Verificar se já foi processado hoje (verificando último log)
      // Usar getTodayInBrazil para garantir timezone correto
      const todayIndex = getTodayInBrazil();
      
      const lastLog = await prisma.indexRebalanceLog.findFirst({
        where: { indexId: index.id },
        orderBy: { date: 'desc' }
      });
      
      if (lastLog) {
        const lastLogDate = new Date(lastLog.date);
        lastLogDate.setHours(0, 0, 0, 0);
        
        if (lastLogDate >= todayIndex) {
          console.log(`    ⏭️ ${index.ticker}: Already screened today, skipping`);
          successCount++;
          // Limpar checkpoint do índice se existir
          await clearIndexCheckpoint('screening', index.id);
          // Atualizar checkpoint global
          await saveCheckpoint({
            jobType: 'screening',
            indexId: null,
            lastProcessedIndexId,
            processedCount: startIndex + successCount + failedCount,
            totalCount: allIndices.length,
            errors
          });
          continue;
        }
      }

      // Criar checkpoint do índice antes de começar processamento
      await saveCheckpoint({
        jobType: 'screening',
        indexId: index.id,
        lastProcessedIndexId: null,
        processedCount: 0,
        totalCount: 1, // Screening é atômico, então totalCount = 1
        errors: []
      });

      // 1. Executar screening
      const idealComposition = await runScreening(index);

      if (idealComposition.length === 0) {
        console.warn(`    ⚠️ ${index.ticker}: No companies found in screening`);
        
        // Garantir que o log seja criado mesmo quando screening retorna vazio (apenas uma vez por dia)
        await ensureScreeningLogOncePerDay(
          index.id,
          todayIndex,
          'Rotina de rebalanceamento executada: nenhuma empresa encontrada no screening'
        );
        
        successCount++; // Considerar sucesso mesmo sem resultados
        // Limpar checkpoint do índice quando concluído
        await clearIndexCheckpoint('screening', index.id);
        // Atualizar checkpoint global
        await saveCheckpoint({
          jobType: 'screening',
          indexId: null,
          lastProcessedIndexId,
          processedCount: startIndex + successCount + failedCount,
          totalCount: allIndices.length,
          errors
        });
        continue;
      }

      // Obter informações detalhadas do screening (armazenadas em lastScreeningDetails)
      const { getLastScreeningDetails } = await import('@/lib/index-screening-engine');
      const screeningDetails = getLastScreeningDetails();

      // 2. Aplicar validação de qualidade se checkQuality estiver ativado
      const config = index.config as any;
      let validatedComposition = idealComposition;
      let qualityRejected: Array<{ candidate: any; reason: string }> = [];
      
      if (config.rebalance?.checkQuality) {
        const { filterByQuality } = await import('@/lib/index-screening-engine');
        const qualityResult = await filterByQuality(idealComposition, config);
        validatedComposition = qualityResult.valid;
        qualityRejected = qualityResult.rejected;
        
        if (validatedComposition.length === 0) {
          console.warn(`    ⚠️ ${index.ticker}: No companies passed quality check for rebalancing (${qualityResult.rejected.length} rejected)`);
          
          // Garantir que o log seja criado mesmo quando nenhuma empresa passa no quality check (apenas uma vez por dia)
          await ensureScreeningLogOncePerDay(
            index.id,
            todayIndex,
            'Rotina de rebalanceamento executada: nenhuma empresa passou na validação de qualidade'
          );
          
          successCount++; // Considerar sucesso mesmo sem resultados
          // Limpar checkpoint do índice quando concluído
          await clearIndexCheckpoint('screening', index.id);
          // Atualizar checkpoint global
          await saveCheckpoint({
            jobType: 'screening',
            indexId: null,
            lastProcessedIndexId,
            processedCount: startIndex + successCount + failedCount,
            totalCount: allIndices.length,
            errors
          });
          continue;
        }
        
        if (qualityResult.rejected.length > 0) {
          console.log(`    ℹ️ ${index.ticker}: ${qualityResult.rejected.length} companies filtered out by quality check (${validatedComposition.length} remain)`);
        }
      }

      // 3. Comparar com composição atual (passar informações detalhadas do screening)
      const currentComposition = index.composition;
      const changes = compareComposition(
        currentComposition, 
        validatedComposition,
        config,
        qualityRejected,
        undefined, // screeningRejected - pode ser adicionado no futuro se necessário
        screeningDetails?.candidatesBeforeSelection,
        screeningDetails?.removedByDiversification
      );

      // 4. Verificar se deve rebalancear
      const threshold = config.rebalance?.threshold || 0.05;
      const upsideType = config.rebalance?.upsideType || 'best';
      const shouldRebalanceIndex = shouldRebalance(currentComposition, validatedComposition, threshold, upsideType);

      if (shouldRebalanceIndex && changes.length > 0) {
        // Gerar motivo detalhado do rebalanceamento antes de atualizar
        const { generateRebalanceReason } = await import('@/lib/index-screening-engine');
        const rebalanceReason = generateRebalanceReason(
          currentComposition,
          validatedComposition,
          threshold,
          config.rebalance?.checkQuality || false,
          upsideType,
          config,
          qualityRejected
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
        
        // Garantir que o log seja criado mesmo quando não há mudanças (apenas uma vez por dia)
        const logCreated = await ensureScreeningLogOncePerDay(
          index.id,
          todayIndex,
          'Rotina de rebalanceamento executada: nenhuma mudança necessária na composição após screening'
        );
        
        if (logCreated) {
          console.log(`    📝 ${index.ticker}: Log de screening criado (nenhuma mudança necessária)`);
        }
      }

      successCount++;
      
      // Limpar checkpoint do índice quando concluído com sucesso
      await clearIndexCheckpoint('screening', index.id);
      
      // Atualizar checkpoint global após cada índice processado
      await saveCheckpoint({
        jobType: 'screening',
        indexId: null,
        lastProcessedIndexId,
        processedCount: startIndex + successCount + failedCount,
        totalCount: allIndices.length,
        errors
      });
    } catch (error) {
      failedCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${index.ticker}: ${errorMsg}`);
      console.error(`    ❌ ${index.ticker}: Error in screening:`, error);
      // Manter checkpoint do índice em caso de erro para retentar depois
      // (não limpar, para permitir retomar de onde parou)
      // Atualizar checkpoint global
      await saveCheckpoint({
        jobType: 'screening',
        indexId: null,
        lastProcessedIndexId,
        processedCount: startIndex + successCount + failedCount,
        totalCount: allIndices.length,
        errors
      });
      // Continuar processando outros índices mesmo se um falhar
    }
  }

  const duration = Date.now() - startTime;
  const processed = successCount + failedCount;
  const remaining = allIndices.length - (startIndex + processed);

  // Sempre salvar checkpoint final (nunca deletar)
  if (remaining === 0) {
    console.log('✅ [CRON INDICES] All indices processed. Checkpoint marked as complete.');
    // Marcar checkpoint como concluído (processedCount === totalCount)
    await saveCheckpoint({
      jobType: 'screening',
      indexId: null,
      lastProcessedIndexId,
      processedCount: allIndices.length,
      totalCount: allIndices.length,
      errors
    });
  } else {
    // Salvar checkpoint parcial
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

  // Invalidar cache quando todos os índices foram processados ou quando há rebalanceamento
  if ((remaining === 0 && successCount > 0) || rebalancedCount > 0) {
    await invalidateMarketIndicesCache();
  }

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

    // Invalidar cache quando todos os índices foram processados completamente
    // Isso garante que dados atualizados sejam refletidos imediatamente
    if (!hasMore && result.processed === result.totalCount) {
      await invalidateMarketIndicesCache();
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
