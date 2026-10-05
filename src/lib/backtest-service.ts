import type { AdaptiveBacktestResult, AdaptiveBacktestService, BacktestParams, BacktestResult } from './adaptive-backtest-service';

// Re-exportar tipos do adaptive-backtest-service para compatibilidade
export type { BacktestParams, BacktestResult, PricePoint, PortfolioSnapshot } from './adaptive-backtest-service';

/**
 * Fachada do backtesting usada pelas rotas. Toda a simulação (preços ajustados só por eventos de capital, proventos
 * reais de `DividendHistory`, custos de operação e Sharpe com CDI) fica em AdaptiveBacktestService.
 */
export class BacktestService {
  protected adaptiveService: AdaptiveBacktestService | null = null;

  /**
   * Obtém instância do serviço adaptativo
   */
  protected async getAdaptiveService(): Promise<AdaptiveBacktestService> {
    if (!this.adaptiveService) {
      const { AdaptiveBacktestService } = await import('./adaptive-backtest-service');
      this.adaptiveService = new AdaptiveBacktestService();
    }
    return this.adaptiveService;
  }

  /**
   * Salva uma configuração de backtest no banco de dados (reaproveita uma igual do mesmo usuário)
   */
  async saveBacktestConfig(
    userId: string,
    params: BacktestParams,
    name?: string,
    description?: string
  ): Promise<string> {
    const adaptiveService = await this.getAdaptiveService();
    return adaptiveService.saveBacktestConfig(userId, params, name, description);
  }

  /**
   * Salva o resultado de um backtest no banco de dados
   */
  async saveBacktestResult(configId: string, result: BacktestResult | AdaptiveBacktestResult): Promise<void> {
    const adaptiveService = await this.getAdaptiveService();
    return adaptiveService.saveBacktestResult(configId, result);
  }

  /**
   * Executa o backtesting (simulação adaptativa completa)
   */
  async runBacktest(params: BacktestParams): Promise<AdaptiveBacktestResult> {
    const adaptiveService = await this.getAdaptiveService();
    return adaptiveService.runAdaptiveBacktest(params);
  }
}
