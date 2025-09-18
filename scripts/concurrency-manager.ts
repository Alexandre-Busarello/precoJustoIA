/**
 * Gerenciador de concorrência para controlar processamento paralelo
 * sem sobrecarregar o banco de dados ou APIs externas
 */
export class ConcurrencyManager {
  private maxConcurrency: number;
  private running: Set<Promise<any>> = new Set();
  private queue: Array<() => Promise<any>> = [];

  constructor(maxConcurrency: number = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Executa uma função com controle de concorrência
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running.delete(taskPromise);
          this.processQueue();
        }
      };

      const taskPromise = task();
      this.running.add(taskPromise);

      if (this.running.size <= this.maxConcurrency) {
        // Executar imediatamente se há espaço
        return;
      } else {
        // Adicionar à fila se não há espaço
        this.queue.push(task);
      }
    });
  }

  /**
   * Processa a próxima tarefa da fila se há espaço
   */
  private processQueue() {
    if (this.queue.length > 0 && this.running.size < this.maxConcurrency) {
      const nextTask = this.queue.shift()!;
      const taskPromise = nextTask();
      this.running.add(taskPromise);
    }
  }

  /**
   * Executa múltiplas tarefas em paralelo com controle de concorrência
   */
  async executeAll<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const promises = tasks.map(task => this.execute(task));
    return Promise.all(promises);
  }

  /**
   * Executa tarefas em lotes com controle de concorrência
   */
  async executeBatch<T>(
    items: T[], 
    processor: (item: T) => Promise<any>,
    batchSize: number = this.maxConcurrency
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(item => this.execute(() => processor(item)));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Pequeno delay entre lotes para não sobrecarregar
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Aguarda todas as tarefas em execução terminarem
   */
  async waitForAll(): Promise<void> {
    while (this.running.size > 0 || this.queue.length > 0) {
      await Promise.all(Array.from(this.running));
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Obtém estatísticas atuais
   */
  getStats() {
    return {
      running: this.running.size,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency
    };
  }

  /**
   * Ajusta a concorrência máxima dinamicamente
   */
  setMaxConcurrency(newMax: number) {
    this.maxConcurrency = newMax;
    // Processar fila se aumentou a concorrência
    while (this.running.size < this.maxConcurrency && this.queue.length > 0) {
      this.processQueue();
    }
  }
}

/**
 * Utilitário para executar tarefas com retry automático
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Delay exponencial
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`⚠️  Tentativa ${attempt} falhou, tentando novamente em ${delay}ms...`);
    }
  }
  
  throw lastError!;
}

/**
 * Utilitário para executar com timeout
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout após ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}
