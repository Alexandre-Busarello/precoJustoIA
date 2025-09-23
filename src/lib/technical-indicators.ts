/**
 * Classe para cálculo de indicadores técnicos
 * Implementa RSI (Relative Strength Index) e Oscilador Estocástico
 */

export interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RSIResult {
  date: Date;
  rsi: number;
  signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO';
}

export interface StochasticResult {
  date: Date;
  k: number;
  d: number;
  signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO';
}

export interface TechnicalAnalysisResult {
  rsi: RSIResult[];
  stochastic: StochasticResult[];
  currentRSI: RSIResult | null;
  currentStochastic: StochasticResult | null;
  overallSignal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO';
}

export class TechnicalIndicators {
  /**
   * Calcula o RSI (Relative Strength Index)
   * @param prices Array de dados de preços
   * @param period Período para cálculo (padrão: 14)
   * @returns Array com valores de RSI
   */
  static calculateRSI(prices: PriceData[], period: number = 14): RSIResult[] {
    if (prices.length < period + 1) {
      return [];
    }

    const results: RSIResult[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calcular ganhos e perdas
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i].close - prices[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calcular RSI para cada período
    for (let i = period - 1; i < gains.length; i++) {
      let avgGain: number;
      let avgLoss: number;

      if (i === period - 1) {
        // Primeira média simples
        avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
        avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
      } else {
        // Média móvel exponencial (Wilder's smoothing)
        const prevAvgGain = results[results.length - 1] ? this.getPreviousAvgGain(results, gains, i, period) : 0;
        const prevAvgLoss = results[results.length - 1] ? this.getPreviousAvgLoss(results, losses, i, period) : 0;
        
        avgGain = (prevAvgGain * (period - 1) + gains[i]) / period;
        avgLoss = (prevAvgLoss * (period - 1) + losses[i]) / period;
      }

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));

      let signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO';
      if (rsi >= 70) {
        signal = 'SOBRECOMPRA';
      } else if (rsi <= 30) {
        signal = 'SOBREVENDA';
      } else {
        signal = 'NEUTRO';
      }

      results.push({
        date: prices[i + 1].date,
        rsi: Number(rsi.toFixed(2)),
        signal
      });
    }

    return results;
  }

  /**
   * Calcula o Oscilador Estocástico
   * @param prices Array de dados de preços
   * @param kPeriod Período para %K (padrão: 14)
   * @param dPeriod Período para %D (padrão: 3)
   * @returns Array com valores do oscilador estocástico
   */
  static calculateStochastic(
    prices: PriceData[], 
    kPeriod: number = 14, 
    dPeriod: number = 3
  ): StochasticResult[] {
    if (prices.length < kPeriod + dPeriod - 1) {
      return [];
    }

    const results: StochasticResult[] = [];
    const kValues: number[] = [];

    // Calcular %K
    for (let i = kPeriod - 1; i < prices.length; i++) {
      const periodPrices = prices.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...periodPrices.map(p => p.high));
      const lowestLow = Math.min(...periodPrices.map(p => p.low));
      const currentClose = prices[i].close;

      const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.push(k);
    }

    // Calcular %D (média móvel de %K)
    for (let i = dPeriod - 1; i < kValues.length; i++) {
      const kSlice = kValues.slice(i - dPeriod + 1, i + 1);
      const d = kSlice.reduce((sum, val) => sum + val, 0) / dPeriod;
      const k = kValues[i];

      let signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO';
      if (k >= 80 && d >= 80) {
        signal = 'SOBRECOMPRA';
      } else if (k <= 20 && d <= 20) {
        signal = 'SOBREVENDA';
      } else {
        signal = 'NEUTRO';
      }

      results.push({
        date: prices[kPeriod - 1 + i].date,
        k: Number(k.toFixed(2)),
        d: Number(d.toFixed(2)),
        signal
      });
    }

    return results;
  }

  /**
   * Calcula análise técnica completa
   * @param prices Array de dados de preços
   * @returns Resultado completo da análise técnica
   */
  static calculateTechnicalAnalysis(prices: PriceData[]): TechnicalAnalysisResult {
    const rsi = this.calculateRSI(prices);
    const stochastic = this.calculateStochastic(prices);

    const currentRSI = rsi.length > 0 ? rsi[rsi.length - 1] : null;
    const currentStochastic = stochastic.length > 0 ? stochastic[stochastic.length - 1] : null;

    // Determinar sinal geral baseado nos dois indicadores
    let overallSignal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO' = 'NEUTRO';

    if (currentRSI && currentStochastic) {
      if (currentRSI.signal === 'SOBRECOMPRA' && currentStochastic.signal === 'SOBRECOMPRA') {
        overallSignal = 'SOBRECOMPRA';
      } else if (currentRSI.signal === 'SOBREVENDA' && currentStochastic.signal === 'SOBREVENDA') {
        overallSignal = 'SOBREVENDA';
      } else if (currentRSI.signal === 'SOBRECOMPRA' || currentStochastic.signal === 'SOBRECOMPRA') {
        overallSignal = 'SOBRECOMPRA';
      } else if (currentRSI.signal === 'SOBREVENDA' || currentStochastic.signal === 'SOBREVENDA') {
        overallSignal = 'SOBREVENDA';
      }
    }

    return {
      rsi,
      stochastic,
      currentRSI,
      currentStochastic,
      overallSignal
    };
  }

  /**
   * Função auxiliar para obter média anterior de ganhos
   */
  private static getPreviousAvgGain(results: RSIResult[], gains: number[], index: number, period: number): number {
    // Recalcular a média de ganhos do período anterior
    const startIndex = Math.max(0, index - period);
    const gainsSlice = gains.slice(startIndex, index);
    return gainsSlice.reduce((sum, gain) => sum + gain, 0) / gainsSlice.length;
  }

  /**
   * Função auxiliar para obter média anterior de perdas
   */
  private static getPreviousAvgLoss(results: RSIResult[], losses: number[], index: number, period: number): number {
    // Recalcular a média de perdas do período anterior
    const startIndex = Math.max(0, index - period);
    const lossesSlice = losses.slice(startIndex, index);
    return lossesSlice.reduce((sum, loss) => sum + loss, 0) / lossesSlice.length;
  }

  /**
   * Converte dados do banco para o formato esperado pelos indicadores
   */
  static convertHistoricalData(historicalData: any[]): PriceData[] {
    return historicalData.map(data => ({
      date: new Date(data.date),
      open: Number(data.open),
      high: Number(data.high),
      low: Number(data.low),
      close: Number(data.close),
      volume: Number(data.volume)
    })).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Formata sinal para exibição
   */
  static formatSignal(signal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO'): {
    text: string;
    color: string;
    bgColor: string;
  } {
    switch (signal) {
      case 'SOBRECOMPRA':
        return {
          text: 'Sobrecompra',
          color: 'text-red-700 dark:text-red-300',
          bgColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        };
      case 'SOBREVENDA':
        return {
          text: 'Sobrevenda',
          color: 'text-green-700 dark:text-green-300',
          bgColor: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
        };
      case 'NEUTRO':
        return {
          text: 'Neutro',
          color: 'text-gray-700 dark:text-gray-300',
          bgColor: 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'
        };
    }
  }
}
