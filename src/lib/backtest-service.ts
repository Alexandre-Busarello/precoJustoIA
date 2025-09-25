import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/strategies/base-strategy';

// Re-exportar tipos do adaptive-backtest-service para compatibilidade
export type { BacktestParams, BacktestResult, PricePoint, PortfolioSnapshot } from './adaptive-backtest-service';

/**
 * Serviço base de backtesting
 * Esta classe fornece funcionalidades básicas de backtesting
 * Para funcionalidades avançadas com tratamento de dados faltantes, use AdaptiveBacktestService
 */
export class BacktestService {
  protected adaptiveService: import('./adaptive-backtest-service').AdaptiveBacktestService | null = null;
  
  /**
   * Obtém instância do serviço adaptativo
   */
  protected async getAdaptiveService(): Promise<import('./adaptive-backtest-service').AdaptiveBacktestService> {
    if (!this.adaptiveService) {
      const { AdaptiveBacktestService } = await import('./adaptive-backtest-service');
      this.adaptiveService = new AdaptiveBacktestService();
    }
    return this.adaptiveService;
  }
  
  /**
   * Salva uma configuração de backtest no banco de dados
   */
  async saveBacktestConfig(
    userId: string,
    params: import('./adaptive-backtest-service').BacktestParams,
    name?: string,
    description?: string
  ): Promise<string> {
    const adaptiveService = await this.getAdaptiveService();
    return adaptiveService.saveBacktestConfig(userId, params, name, description);
  }
  
  /**
   * Salva o resultado de um backtest no banco de dados
   */
  async saveBacktestResult(configId: string, result: import('./adaptive-backtest-service').BacktestResult | import('./adaptive-backtest-service').AdaptiveBacktestResult): Promise<void> {
    const adaptiveService = await this.getAdaptiveService();
    return adaptiveService.saveBacktestResult(configId, result);
  }
  
  /**
   * Executa simulação básica de backtesting
   * Para funcionalidades avançadas, use AdaptiveBacktestService.runAdaptiveBacktest()
   */
  async runBacktest(params: import('./adaptive-backtest-service').BacktestParams): Promise<import('./adaptive-backtest-service').BacktestResult> {
    // Esta implementação básica redireciona para o serviço adaptativo
    const adaptiveService = await this.getAdaptiveService();
    
    // Executar backtesting adaptativo completo
    const adaptiveResult = await adaptiveService.runAdaptiveBacktest(params);
    
    // Obter preços históricos para calcular métricas
    const tickers = params.assets.map(asset => asset.ticker);
    const pricesData = await this.getHistoricalPrices(tickers, params.startDate, params.endDate);
    
    // O AdaptiveBacktestResult já contém todas as métricas necessárias, incluindo finalCashReserve
    // Não precisamos recalcular as métricas
    return adaptiveResult;
  }
  
  /**
   * Obtém preços históricos mensais
   * @deprecated Use AdaptiveBacktestService para melhor tratamento de dados
   */
  protected async getHistoricalPrices(
    tickers: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, import('./adaptive-backtest-service').PricePoint[]>> {
    const historicalData = await prisma.historicalPrice.findMany({
      where: {
        company: { ticker: { in: tickers } },
        interval: '1mo',
        date: { gte: startDate, lte: endDate }
      },
      include: { company: { select: { ticker: true } } },
      orderBy: [{ company: { ticker: 'asc' } }, { date: 'asc' }]
    });

    // Agrupar por ticker
    const pricesMap = new Map<string, import('./adaptive-backtest-service').PricePoint[]>();
    
    for (const ticker of tickers) {
      const tickerPrices = historicalData
        .filter(d => d.company.ticker === ticker)
        .map(d => ({
          date: d.date,
          price: toNumber(d.close) || 0,
          adjustedClose: toNumber(d.adjustedClose) || toNumber(d.close) || 0
        }))
        .filter(p => p.price > 0);

      pricesMap.set(ticker, tickerPrices);
    }

    return pricesMap;
  }
  
  /**
   * Gera datas mensais para um período
   */
  protected generateMonthlyDates(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);
    
    // Ajustar para o primeiro dia do mês
    current.setDate(1);
    
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    
    return dates;
  }
  
  /**
   * Calcula diferença em meses entre duas datas
   */
  protected getMonthsDifference(startDate: Date, endDate: Date): number {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
           (endDate.getMonth() - startDate.getMonth()) + 1;
  }
  
  /**
   * Obtém preço para data específica
   */
  protected getPriceForDate(prices: import('./adaptive-backtest-service').PricePoint[], targetDate: Date): number | null {
    if (prices.length === 0) return null;

    // Buscar preço exato
    const exactMatch = prices.find(p => 
      p.date.getTime() === targetDate.getTime()
    );
    if (exactMatch) {
      return exactMatch.adjustedClose;
    }

    // Buscar preço mais próximo (até 45 dias de diferença)
    const maxDiffMs = 45 * 24 * 60 * 60 * 1000;
    let closestPrice: import('./adaptive-backtest-service').PricePoint | null = null;
    let minDiff = Infinity;

    for (const price of prices) {
      const diff = Math.abs(price.date.getTime() - targetDate.getTime());
      if (diff < minDiff && diff <= maxDiffMs) {
        minDiff = diff;
        closestPrice = price;
      }
    }

    return closestPrice ? closestPrice.adjustedClose : null;
  }
  
  /**
   * Calcula drawdown máximo
   */
  protected calculateMaxDrawdown(values: number[]): number {
    let maxDrawdown = 0;
    let peak = values[0];

    for (const value of values) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }
}
