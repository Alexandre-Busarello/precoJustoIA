import { backgroundPrisma } from './prisma-background';
import { TickerStatus } from '@prisma/client';

export interface TickerProcessingInfo {
  ticker: string;
  status: TickerStatus;
  hasBasicData: boolean;
  hasHistoricalData: boolean;
  hasTTMData: boolean;
  hasBrapiProData: boolean;
  lastProcessedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  errorCount: number;
  priority: number;
  needsProcessing: boolean;
  needsHistoricalData: boolean;
  needsTTMUpdate: boolean;
  needsBrapiProData: boolean;
}

export interface ProcessingSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  partial: number;
  error: number;
  skipped: number;
  needsHistorical: number;
  needsTTM: number;
  needsBrapiPro: number;
}

export class TickerProcessingManager {
  private processType: string;

  constructor(processType: string = 'ward_data_fetch') {
    this.processType = processType;
  }

  /**
   * Inicializa ou atualiza o status de um ticker
   */
  async initializeTicker(ticker: string, priority: number = 0): Promise<void> {
    try {
      await backgroundPrisma.tickerProcessingStatus.upsert({
        where: { ticker },
        update: {
          processType: this.processType,
          priority,
          updatedAt: new Date()
        },
        create: {
          ticker,
          processType: this.processType,
          status: 'PENDING',
          priority,
          hasBasicData: false,
          hasHistoricalData: false,
          hasTTMData: false,
          hasBrapiProData: false,
          errorCount: 0
        }
      });
    } catch (error: any) {
      console.error(`❌ Erro ao inicializar ticker ${ticker}:`, error.message);
      throw error;
    }
  }

  /**
   * Inicializa múltiplos tickers de uma vez (otimizado para lotes)
   */
  async initializeTickers(tickers: string[], priority: number = 0): Promise<void> {
    // Para lotes muito grandes, processar em chunks
    if (tickers.length > 100) {
      return this.initializeTickersInChunks(tickers, priority);
    }
    
    return this.initializeTickersBatch(tickers, priority);
  }

  /**
   * Inicializa tickers em chunks para lotes muito grandes
   */
  private async initializeTickersInChunks(tickers: string[], priority: number = 0): Promise<void> {
    const chunkSize = 100;
    const totalChunks = Math.ceil(tickers.length / chunkSize);
    
    console.log(`📋 Inicializando ${tickers.length} tickers em ${totalChunks} chunks de ${chunkSize}...`);
    
    for (let i = 0; i < tickers.length; i += chunkSize) {
      const chunk = tickers.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      
      console.log(`  📦 Chunk ${chunkNumber}/${totalChunks}: ${chunk.length} tickers`);
      await this.initializeTickersBatch(chunk, priority);
    }
  }

  /**
   * Inicializa um lote de tickers (implementação otimizada)
   */
  private async initializeTickersBatch(tickers: string[], priority: number = 0): Promise<void> {
    if (tickers.length === 0) return;
    
    const startTime = Date.now();
    console.log(`📋 Inicializando ${tickers.length} tickers em lote...`);
    
    try {
      // Primeiro, buscar tickers que já existem para evitar conflitos
      const existingTickers = await backgroundPrisma.tickerProcessingStatus.findMany({
        where: {
          ticker: { in: tickers },
          processType: this.processType
        },
        select: { ticker: true }
      });
      
      const existingTickerSet = new Set(existingTickers.map(t => t.ticker));
      const newTickers = tickers.filter(ticker => !existingTickerSet.has(ticker));
      const updateTickers = tickers.filter(ticker => existingTickerSet.has(ticker));
      
      console.log(`  📊 ${existingTickers.length} já existem, ${newTickers.length} novos, ${updateTickers.length} para atualizar`);
      
      // Operações em paralelo para máxima performance
      const operations = [];
      
      // 1. Criar novos tickers em lote (se houver)
      if (newTickers.length > 0) {
        const createOperation = backgroundPrisma.tickerProcessingStatus.createMany({
          data: newTickers.map(ticker => ({
            ticker,
            processType: this.processType,
            status: 'PENDING' as any,
            priority,
            hasBasicData: false,
            hasHistoricalData: false,
            hasTTMData: false,
            hasBrapiProData: false,
            errorCount: 0
          })),
          skipDuplicates: true // Segurança extra
        });
        operations.push(createOperation);
      }
      
      // 2. Atualizar tickers existentes em lote (se houver)
      if (updateTickers.length > 0) {
        const updateOperation = backgroundPrisma.tickerProcessingStatus.updateMany({
          where: {
            ticker: { in: updateTickers },
            processType: this.processType
          },
          data: {
            priority,
            updatedAt: new Date()
          }
        });
        operations.push(updateOperation);
      }
      
      // Executar todas as operações em paralelo
      if (operations.length > 0) {
        await Promise.all(operations);
      }
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000 * 100) / 100;
      console.log(`✅ ${tickers.length} tickers inicializados em ${duration}s (${newTickers.length} criados, ${updateTickers.length} atualizados)`);
      
    } catch (error: any) {
      console.error(`❌ Erro ao inicializar tickers em lote:`, error.message);
      
      // Fallback: tentar inicialização individual para tickers que falharam
      console.log(`🔄 Tentando inicialização individual como fallback...`);
      let successCount = 0;
      let errorCount = 0;
      
      for (const ticker of tickers) {
        try {
          await this.initializeTicker(ticker, priority);
          successCount++;
        } catch (individualError) {
          console.error(`❌ Falha individual para ${ticker}:`, individualError);
          errorCount++;
        }
      }
      
      console.log(`📊 Fallback concluído: ${successCount} sucessos, ${errorCount} falhas`);
    }
  }

  /**
   * Marca um ticker como em processamento
   */
  async markProcessing(ticker: string): Promise<void> {
    await backgroundPrisma.tickerProcessingStatus.update({
      where: { ticker },
      data: {
        status: 'PROCESSING',
        lastProcessedAt: new Date(),
        lastError: null
      }
    });
  }

  /**
   * Atualiza o progresso de processamento de um ticker
   */
  async updateProgress(
    ticker: string, 
    updates: {
      hasBasicData?: boolean;
      hasHistoricalData?: boolean;
      hasTTMData?: boolean;
      hasBrapiProData?: boolean;
      status?: TickerStatus;
      error?: string;
    }
  ): Promise<void> {
    try {
      const updateData: any = {
        lastProcessedAt: new Date(),
        updatedAt: new Date()
      };

      // Atualizar flags de dados
      if (updates.hasBasicData !== undefined) updateData.hasBasicData = updates.hasBasicData;
      if (updates.hasHistoricalData !== undefined) updateData.hasHistoricalData = updates.hasHistoricalData;
      if (updates.hasTTMData !== undefined) updateData.hasTTMData = updates.hasTTMData;
      if (updates.hasBrapiProData !== undefined) updateData.hasBrapiProData = updates.hasBrapiProData;

      // Determinar status automaticamente se não especificado
      if (updates.status) {
        updateData.status = updates.status;
      } else if (updates.error) {
        updateData.status = 'ERROR';
        updateData.lastError = updates.error;
        updateData.errorCount = { increment: 1 };
      } else {
        // Determinar status baseado nos dados disponíveis
        const current = await backgroundPrisma.tickerProcessingStatus.findUnique({
          where: { ticker }
        });
        
        if (current) {
          const hasBasic = updates.hasBasicData ?? current.hasBasicData;
          const hasHistorical = updates.hasHistoricalData ?? current.hasHistoricalData;
          const hasTTM = updates.hasTTMData ?? current.hasTTMData;
          const hasBrapiPro = updates.hasBrapiProData ?? current.hasBrapiProData;
          
          if (hasBasic && hasHistorical && hasTTM) {
            updateData.status = 'COMPLETED';
            updateData.lastSuccessAt = new Date();
          } else if (hasBasic || hasHistorical || hasTTM || hasBrapiPro) {
            updateData.status = 'PARTIAL';
            updateData.lastSuccessAt = new Date();
          }
        }
      }

      await backgroundPrisma.tickerProcessingStatus.update({
        where: { ticker },
        data: updateData
      });

    } catch (error: any) {
      console.error(`❌ Erro ao atualizar progresso do ticker ${ticker}:`, error.message);
      throw error;
    }
  }

  /**
   * Marca um ticker como completado
   */
  async markCompleted(ticker: string): Promise<void> {
    await this.updateProgress(ticker, {
      status: 'COMPLETED',
      hasBasicData: true,
      hasHistoricalData: true,
      hasTTMData: true
    });
  }

  /**
   * Marca um ticker com erro
   */
  async markError(ticker: string, error: string): Promise<void> {
    await this.updateProgress(ticker, {
      status: 'ERROR',
      error
    });
  }

  /**
   * Reseta tickers travados em PROCESSING há mais de X minutos
   * Isso resolve o problema de tickers que ficam travados após timeout ou crash
   */
  async resetStuckProcessingTickers(timeoutMinutes: number = 10): Promise<number> {
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);
    
    const result = await backgroundPrisma.tickerProcessingStatus.updateMany({
      where: {
        processType: this.processType,
        status: 'PROCESSING',
        lastProcessedAt: {
          lt: timeoutDate
        }
      },
      data: {
        status: 'PENDING',
        lastError: 'Reset automático: ticker travado em PROCESSING há mais de ' + timeoutMinutes + ' minutos'
      }
    });
    
    if (result.count > 0) {
      console.log(`🔄 Resetados ${result.count} tickers travados em PROCESSING`);
    }
    
    return result.count;
  }

  /**
   * Reseta tickers com ERROR que podem ser reprocessados após um tempo
   */
  async resetStaleErrorTickers(retryAfterMinutes: number = 30, maxErrorCount: number = 5): Promise<number> {
    const retryDate = new Date();
    retryDate.setMinutes(retryDate.getMinutes() - retryAfterMinutes);
    
    const result = await backgroundPrisma.tickerProcessingStatus.updateMany({
      where: {
        processType: this.processType,
        status: 'ERROR',
        errorCount: {
          lte: maxErrorCount
        },
        lastProcessedAt: {
          lt: retryDate
        }
      },
      data: {
        status: 'PENDING',
        lastError: null // Limpar erro para permitir nova tentativa
      }
    });
    
    if (result.count > 0) {
      console.log(`🔄 Resetados ${result.count} tickers com ERROR para retry`);
    }
    
    return result.count;
  }

  /**
   * Busca tickers que precisam ser processados
   */
  async getTickersToProcess(
    limit: number = 10,
    options: {
      priorityOnly?: boolean;
      historicalOnly?: boolean;
      ttmOnly?: boolean;
      excludeErrors?: boolean;
      maxErrorCount?: number;
      resetStuckTickers?: boolean; // Novo: resetar tickers travados automaticamente
    } = {}
  ): Promise<TickerProcessingInfo[]> {
    // Resetar tickers travados antes de buscar (se habilitado)
    if (options.resetStuckTickers !== false) {
      await this.resetStuckProcessingTickers(10); // Resetar PROCESSING travados há mais de 10 minutos
      await this.resetStaleErrorTickers(30, options.maxErrorCount ?? 5); // Resetar ERROR antigos para retry
    }
    
    // Buscar tickers que precisam de processamento
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    // Data limite para considerar PROCESSING como travado (10 minutos)
    const stuckProcessingDate = new Date();
    stuckProcessingDate.setMinutes(stuckProcessingDate.getMinutes() - 10);
    
    const where: any = {
      processType: this.processType,
      status: { not: 'SKIPPED' }
    };

    // Filtros opcionais
    if (options.excludeErrors) {
      where.status = {
        in: ['PENDING', 'PARTIAL', 'COMPLETED'],
        not: 'ERROR'
      };
    } else {
      where.status = {
        in: ['PENDING', 'PARTIAL', 'COMPLETED', 'ERROR']
      };
    }

    if (options.maxErrorCount !== undefined) {
      where.errorCount = {
        lte: options.maxErrorCount
      };
    }

    if (options.priorityOnly) {
      where.priority = {
        gt: 0
      };
    }

    // Construir condições OR para diferentes tipos de necessidades
    const orConditions: any[] = [];
    
    // Sempre incluir PENDING e PARTIAL
    orConditions.push(
      { status: 'PENDING' },
      { status: 'PARTIAL' }
    );
    
    // Incluir PROCESSING travados (há mais de 10 minutos)
    // Isso resolve o problema de tickers que ficam travados após timeout ou crash
    orConditions.push({
      status: 'PROCESSING',
      lastProcessedAt: {
        lt: stuckProcessingDate
      }
    });
    
    // Incluir ERROR se não excluído
    if (!options.excludeErrors) {
      orConditions.push({ status: 'ERROR' });
    }

    if (options.historicalOnly) {
      orConditions.push({
        status: 'COMPLETED',
        hasHistoricalData: false
      });
    } else if (options.ttmOnly) {
      orConditions.push(
        {
          status: 'COMPLETED',
          hasTTMData: false
        },
        {
          status: 'COMPLETED',
          hasTTMData: true,
          lastProcessedAt: { lt: oneDayAgo }
        }
      );
    } else {
      // Modo padrão: incluir tickers COMPLETED que precisam de alguma atualização
      orConditions.push(
        // Sem dados históricos
        {
          status: 'COMPLETED',
          hasHistoricalData: false
        },
        // Sem dados TTM ou TTM antigo
        {
          status: 'COMPLETED',
          hasTTMData: false
        },
        {
          status: 'COMPLETED',
          hasTTMData: true,
          lastProcessedAt: { lt: oneDayAgo }
        },
        // Sem dados Brapi Pro
        {
          status: 'COMPLETED',
          hasBrapiProData: false
        }
      );
    }

    where.OR = orConditions;

    const tickers = await backgroundPrisma.tickerProcessingStatus.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { errorCount: 'asc' },
        { lastProcessedAt: 'asc' }
      ],
      take: limit
    });

    return tickers.map(ticker => this.mapToTickerInfo(ticker));
  }

  /**
   * Busca tickers específicos
   */
  async getSpecificTickers(tickers: string[]): Promise<TickerProcessingInfo[]> {
    const results = await backgroundPrisma.tickerProcessingStatus.findMany({
      where: {
        ticker: {
          in: tickers
        },
        processType: this.processType
      }
    });

    // Para tickers que não existem no banco, criar registros temporários
    const existingTickers = results.map(r => r.ticker);
    const missingTickers = tickers.filter(t => !existingTickers.includes(t));
    
    const allResults = [...results];
    
    // Adicionar tickers faltantes como PENDING
    for (const ticker of missingTickers) {
      allResults.push({
        id: 0,
        ticker,
        processType: this.processType,
        status: 'PENDING' as TickerStatus,
        hasBasicData: false,
        hasHistoricalData: false,
        hasTTMData: false,
        hasBrapiProData: false,
        lastProcessedAt: null,
        lastSuccessAt: null,
        lastError: null,
        errorCount: 0,
        priority: 1, // Prioridade alta para tickers específicos
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return allResults.map(ticker => this.mapToTickerInfo(ticker));
  }

  /**
   * Obtém resumo do processamento
   */
  async getProcessingSummary(): Promise<ProcessingSummary> {
    const stats = await backgroundPrisma.tickerProcessingStatus.groupBy({
      by: ['status'],
      where: {
        processType: this.processType
      },
      _count: true
    });

    const counts = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      PARTIAL: 0,
      ERROR: 0,
      SKIPPED: 0
    };

    stats.forEach(stat => {
      counts[stat.status] = stat._count;
    });

    // Contar necessidades específicas
    const needsHistorical = await backgroundPrisma.tickerProcessingStatus.count({
      where: {
        processType: this.processType,
        hasHistoricalData: false,
        status: { not: 'SKIPPED' }
      }
    });

    // Contar tickers que precisam de TTM (sem dados OU com dados antigos > 1 dia)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const needsTTM = await backgroundPrisma.tickerProcessingStatus.count({
      where: {
        processType: this.processType,
        status: { not: 'SKIPPED' },
        OR: [
          { hasTTMData: false }, // Sem dados TTM
          { 
            hasTTMData: true,
            lastProcessedAt: { lt: oneDayAgo } // Com dados mas antigos
          }
        ]
      }
    });

    const needsBrapiPro = await backgroundPrisma.tickerProcessingStatus.count({
      where: {
        processType: this.processType,
        hasBrapiProData: false,
        status: { not: 'SKIPPED' }
      }
    });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return {
      total,
      pending: counts.PENDING,
      processing: counts.PROCESSING,
      completed: counts.COMPLETED,
      partial: counts.PARTIAL,
      error: counts.ERROR,
      skipped: counts.SKIPPED,
      needsHistorical,
      needsTTM,
      needsBrapiPro
    };
  }

  /**
   * Reseta o status de um ticker específico
   */
  async resetTicker(ticker: string): Promise<void> {
    await backgroundPrisma.tickerProcessingStatus.update({
      where: { ticker },
      data: {
        status: 'PENDING',
        hasBasicData: false,
        hasHistoricalData: false,
        hasTTMData: false,
        hasBrapiProData: false,
        lastProcessedAt: null,
        lastSuccessAt: null,
        lastError: null,
        errorCount: 0
      }
    });
    console.log(`🔄 Ticker ${ticker} resetado para PENDING`);
  }

  /**
   * Reseta múltiplos tickers específicos
   */
  async resetTickers(tickers: string[]): Promise<void> {
    await backgroundPrisma.tickerProcessingStatus.updateMany({
      where: {
        ticker: { in: tickers },
        processType: this.processType
      },
      data: {
        status: 'PENDING',
        hasBasicData: false,
        hasHistoricalData: false,
        hasTTMData: false,
        hasBrapiProData: false,
        lastProcessedAt: null,
        lastSuccessAt: null,
        lastError: null,
        errorCount: 0
      }
    });
    console.log(`🔄 ${tickers.length} tickers resetados para PENDING: ${tickers.join(', ')}`);
  }

  /**
   * Reseta o status de todos os tickers
   */
  async resetAllTickers(): Promise<void> {
    await backgroundPrisma.tickerProcessingStatus.updateMany({
      where: {
        processType: this.processType
      },
      data: {
        status: 'PENDING',
        hasBasicData: false,
        hasHistoricalData: false,
        hasTTMData: false,
        hasBrapiProData: false,
        lastProcessedAt: null,
        lastSuccessAt: null,
        lastError: null,
        errorCount: 0
      }
    });
  }

  /**
   * Remove tickers específicos
   */
  async removeTickers(tickers: string[]): Promise<void> {
    await backgroundPrisma.tickerProcessingStatus.deleteMany({
      where: {
        ticker: {
          in: tickers
        },
        processType: this.processType
      }
    });
  }

  /**
   * Obtém estatísticas formatadas
   */
  getFormattedSummary(summary: ProcessingSummary): string {
    const completionRate = summary.total > 0 ? ((summary.completed / summary.total) * 100).toFixed(1) : '0.0';
    
    return [
      `📊 Total: ${summary.total} tickers`,
      `✅ Completos: ${summary.completed} (${completionRate}%)`,
      `🔄 Parciais: ${summary.partial}`,
      `⏳ Pendentes: ${summary.pending}`,
      `🔄 Processando: ${summary.processing}`,
      `❌ Erros: ${summary.error}`,
      `⏭️ Pulados: ${summary.skipped}`,
      `📈 Precisam histórico: ${summary.needsHistorical}`,
      `📊 Precisam TTM: ${summary.needsTTM}`,
      `🔗 Precisam Brapi Pro: ${summary.needsBrapiPro}`
    ].join('\n   ');
  }

  /**
   * Mapeia registro do banco para TickerProcessingInfo
   */
  private mapToTickerInfo(ticker: any): TickerProcessingInfo {
    const now = new Date();
    const daysSinceLastProcess = ticker.lastProcessedAt 
      ? Math.floor((now.getTime() - ticker.lastProcessedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    return {
      ticker: ticker.ticker,
      status: ticker.status,
      hasBasicData: ticker.hasBasicData,
      hasHistoricalData: ticker.hasHistoricalData,
      hasTTMData: ticker.hasTTMData,
      hasBrapiProData: ticker.hasBrapiProData,
      lastProcessedAt: ticker.lastProcessedAt,
      lastSuccessAt: ticker.lastSuccessAt,
      lastError: ticker.lastError,
      errorCount: ticker.errorCount,
      priority: ticker.priority,
      needsProcessing: ticker.status === 'PENDING' || ticker.status === 'PARTIAL' || (ticker.status === 'ERROR' && ticker.errorCount < 3),
      needsHistoricalData: !ticker.hasHistoricalData,
      needsTTMUpdate: !ticker.hasTTMData || daysSinceLastProcess >= 1, // TTM deve ser atualizado diariamente
      needsBrapiProData: !ticker.hasBrapiProData
    };
  }
}
