/**
 * Classe para cálculo de indicadores técnicos
 * Implementa RSI, Stochastic, MACD, Médias Móveis, Bollinger Bands, Fibonacci e Ichimoku
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

export interface MACDResult {
  date: Date;
  macd: number;
  signal: number;
  histogram: number;
}

export interface MovingAverageResult {
  date: Date;
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
}

export interface BollingerBandsResult {
  date: Date;
  upper: number;
  middle: number;
  lower: number;
  width: number;
}

export interface FibonacciLevels {
  fib236: number;
  fib382: number;
  fib500: number;
  fib618: number;
  fib786: number;
}

export interface IchimokuResult {
  date: Date;
  tenkanSen: number;
  kijunSen: number;
  senkouSpanA: number;
  senkouSpanB: number;
  chikouSpan: number;
}

export interface TechnicalAnalysisResult {
  rsi: RSIResult[];
  stochastic: StochasticResult[];
  macd: MACDResult[];
  movingAverages: MovingAverageResult[];
  bollingerBands: BollingerBandsResult[];
  fibonacci: FibonacciLevels | null;
  ichimoku: IchimokuResult[];
  currentRSI: RSIResult | null;
  currentStochastic: StochasticResult | null;
  currentMACD: MACDResult | null;
  currentMovingAverages: MovingAverageResult | null;
  currentBollingerBands: BollingerBandsResult | null;
  currentIchimoku: IchimokuResult | null;
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
   * Calcula MACD (Moving Average Convergence Divergence)
   * @param prices Array de dados de preços
   * @param fastPeriod Período rápido (padrão: 12)
   * @param slowPeriod Período lento (padrão: 26)
   * @param signalPeriod Período do sinal (padrão: 9)
   * @returns Array com valores de MACD
   */
  static calculateMACD(
    prices: PriceData[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): MACDResult[] {
    if (prices.length < slowPeriod + signalPeriod) {
      return [];
    }

    // Calcular EMAs
    const emaFast = this.calculateEMA(prices.map(p => p.close), fastPeriod);
    const emaSlow = this.calculateEMA(prices.map(p => p.close), slowPeriod);

    // Calcular MACD line (diferença entre EMAs)
    const macdLine: number[] = [];
    const startIndex = slowPeriod - fastPeriod;
    for (let i = 0; i < emaFast.length; i++) {
      const fastIdx = i;
      const slowIdx = i + startIndex;
      if (slowIdx >= 0 && slowIdx < emaSlow.length) {
        macdLine.push(emaFast[fastIdx] - emaSlow[slowIdx]);
      }
    }

    // Calcular Signal line (EMA do MACD)
    const signalLine = this.calculateEMA(macdLine, signalPeriod);

    const results: MACDResult[] = [];
    const signalStartIdx = macdLine.length - signalLine.length;

    for (let i = 0; i < signalLine.length; i++) {
      const macdIdx = i + signalStartIdx;
      const histogram = macdLine[macdIdx] - signalLine[i];
      const priceIdx = slowPeriod - 1 + macdIdx;

      if (priceIdx < prices.length) {
        results.push({
          date: prices[priceIdx].date,
          macd: Number(macdLine[macdIdx].toFixed(4)),
          signal: Number(signalLine[i].toFixed(4)),
          histogram: Number(histogram.toFixed(4))
        });
      }
    }

    return results;
  }

  /**
   * Calcula Médias Móveis Simples (SMA)
   * @param prices Array de preços de fechamento
   * @param period Período da média
   * @returns Array com valores de SMA
   */
  static calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) {
      return [];
    }

    const results: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      results.push(sum / period);
    }

    return results;
  }

  /**
   * Calcula Média Móvel Exponencial (EMA)
   * @param prices Array de preços de fechamento
   * @param period Período da média
   * @returns Array com valores de EMA
   */
  static calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) {
      return [];
    }

    const results: number[] = [];
    const multiplier = 2 / (period + 1);

    // Primeira EMA é a SMA
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    results.push(firstSMA);

    // Calcular EMAs subsequentes
    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] - results[results.length - 1]) * multiplier + results[results.length - 1];
      results.push(ema);
    }

    return results;
  }

  /**
   * Calcula todas as Médias Móveis (SMA 20, 50, 200 e EMA 12, 26)
   * @param prices Array de dados de preços
   * @returns Array com valores de todas as médias móveis
   */
  static calculateMovingAverages(prices: PriceData[]): MovingAverageResult[] {
    if (prices.length === 0) {
      return [];
    }

    // Garantir que os preços estão ordenados por data (mais antigo primeiro)
    const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // IMPORTANTE: Usar apenas os últimos N meses válidos para cada média
    // Pegar apenas os últimos valores válidos (close > 0)
    let validPrices = sortedPrices.filter(p => p.close > 0 && !isNaN(p.close));
    
    // Remover duplicatas por MÊS/ANO (para dados mensais, agrupar por mês)
    // IMPORTANTE: Para dados mensais, pode haver múltiplos registros no mesmo mês
    // Devemos manter apenas o mais recente de cada mês
    const uniquePricesMap = new Map<string, PriceData>();
    validPrices.forEach(p => {
      // Agrupar por mês/ano (YYYY-MM) ao invés de data completa
      const year = p.date.getFullYear();
      const month = p.date.getMonth();
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}`; // YYYY-MM
      const existing = uniquePricesMap.get(dateKey);
      if (!existing || p.date.getTime() > existing.date.getTime()) {
        uniquePricesMap.set(dateKey, p);
      }
    });
    validPrices = Array.from(uniquePricesMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    if (validPrices.length === 0) {
      return [];
    }
    
    // Para cada média móvel, usar apenas os últimos N meses válidos
    const closes = validPrices.map(p => p.close);
    
    // Calcular médias móveis usando apenas os últimos N valores válidos
    // IMPORTANTE: slice(-N) pega os últimos N elementos do array
    // Como o array já está ordenado do mais antigo para o mais recente,
    // slice(-20) vai pegar os últimos 20 meses válidos
    
    // SMA 20: últimos 20 meses válidos
    const sma20Closes = closes.length >= 20 ? closes.slice(-20) : closes;
    // Se temos exatamente 20 elementos, calculateSMA retorna array com 1 elemento (a média dos 20)
    const sma20 = sma20Closes.length === 20 
      ? [sma20Closes.reduce((a, b) => a + b, 0) / 20] // Calcular média diretamente
      : sma20Closes.length > 20 
        ? this.calculateSMA(sma20Closes, 20) : [];
    
    // SMA 50: últimos 50 meses válidos
    const sma50Closes = closes.length >= 50 ? closes.slice(-50) : closes;
    const sma50 = sma50Closes.length === 50
      ? [sma50Closes.reduce((a, b) => a + b, 0) / 50]
      : sma50Closes.length > 50
        ? this.calculateSMA(sma50Closes, 50)
        : [];
    
    // SMA 200: últimos 200 meses válidos (ou todos se tiver menos)
    const sma200Closes = closes.length >= 200 ? closes.slice(-200) : closes;
    const sma200 = sma200Closes.length === 200
      ? [sma200Closes.reduce((a, b) => a + b, 0) / 200]
      : sma200Closes.length > 200
        ? this.calculateSMA(sma200Closes, 200)
        : [];
    
    // EMA 12: últimos 12 meses válidos
    const ema12Closes = closes.length >= 12 ? closes.slice(-12) : closes;
    const ema12 = ema12Closes.length >= 12 ? this.calculateEMA(ema12Closes, 12) : [];
    
    // EMA 26: últimos 26 meses válidos
    const ema26Closes = closes.length >= 26 ? closes.slice(-26) : closes;
    const ema26 = ema26Closes.length >= 26 ? this.calculateEMA(ema26Closes, 26) : [];

    // Pegar o último valor de cada média móvel
    const lastSMA20 = sma20.length > 0 ? sma20[sma20.length - 1] : null;
    const lastSMA50 = sma50.length > 0 ? sma50[sma50.length - 1] : null;
    const lastSMA200 = sma200.length > 0 ? sma200[sma200.length - 1] : null;
    const lastEMA12 = ema12.length > 0 ? ema12[ema12.length - 1] : null;
    const lastEMA26 = ema26.length > 0 ? ema26[ema26.length - 1] : null;

    // Retornar apenas o último resultado (mais recente)
    const lastPrice = validPrices[validPrices.length - 1];
    return [{
      date: lastPrice.date,
      sma20: lastSMA20 ? Number(lastSMA20.toFixed(4)) : 0,
      sma50: lastSMA50 ? Number(lastSMA50.toFixed(4)) : 0,
      sma200: lastSMA200 ? Number(lastSMA200.toFixed(4)) : 0,
      ema12: lastEMA12 ? Number(lastEMA12.toFixed(4)) : 0,
      ema26: lastEMA26 ? Number(lastEMA26.toFixed(4)) : 0
    }];
  }

  /**
   * Calcula Bollinger Bands
   * @param prices Array de dados de preços
   * @param period Período (padrão: 20)
   * @param stdDev Desvio padrão (padrão: 2)
   * @returns Array com valores de Bollinger Bands
   */
  static calculateBollingerBands(
    prices: PriceData[],
    period: number = 20,
    stdDev: number = 2
  ): BollingerBandsResult[] {
    if (prices.length < period) {
      return [];
    }

    // Garantir que os preços estão ordenados por data (mais antigo primeiro)
    const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Filtrar valores inválidos
    const validPrices = sortedPrices.filter(p => p.close > 0 && !isNaN(p.close));
    if (validPrices.length < period) {
      return [];
    }
    
    // IMPORTANTE: Usar apenas os últimos 'period' meses válidos
    const recentValidPrices = validPrices.slice(-period);
    const closes = recentValidPrices.map(p => p.close);
    
    const sma = this.calculateSMA(closes, period);
    
    if (sma.length === 0) {
      return [];
    }

    // Calcular apenas o último valor (mais recente)
    const lastSMA = sma[sma.length - 1];
    
    // Calcular desvio padrão usando os últimos 'period' preços
    const mean = lastSMA;
    const variance = closes.reduce((sum, price) => {
      return sum + Math.pow(price - mean, 2);
    }, 0) / closes.length;
    const standardDeviation = Math.sqrt(variance);

    const upper = mean + (standardDeviation * stdDev);
    const lower = mean - (standardDeviation * stdDev);
    const width = upper - lower;

    const lastPrice = recentValidPrices[recentValidPrices.length - 1];
    return [{
      date: lastPrice.date,
      upper: Number(upper.toFixed(4)),
      middle: Number(mean.toFixed(4)),
      lower: Number(lower.toFixed(4)),
      width: Number(width.toFixed(4))
    }];
  }

  /**
   * Calcula níveis de Fibonacci Retracement
   * @param prices Array de dados de preços
   * @param periodMonths Período em meses para calcular Fibonacci (padrão: 12 meses)
   * @returns Níveis de Fibonacci baseados no máximo e mínimo do período
   */
  static calculateFibonacci(prices: PriceData[], periodMonths: number = 12): FibonacciLevels | null {
    if (prices.length < 2) {
      return null;
    }

    // Garantir ordenação (mais antigo primeiro)
    const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Usar apenas os últimos N meses para cálculo mais relevante
    const recentPrices = sortedPrices.slice(-periodMonths);
    if (recentPrices.length < 2) {
      return null;
    }

    // Encontrar máximo e mínimo no período usando high e low reais
    const highs = recentPrices.map(p => p.high);
    const lows = recentPrices.map(p => p.low);
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const diff = high - low;

    if (diff <= 0 || isNaN(diff)) {
      return null;
    }

    // Níveis de Fibonacci padrão (retracement de alta para baixa)
    const fib236 = high - (diff * 0.236);
    const fib382 = high - (diff * 0.382);
    const fib500 = high - (diff * 0.5);
    const fib618 = high - (diff * 0.618);
    const fib786 = high - (diff * 0.786);

    return {
      fib236: Number(fib236.toFixed(4)),
      fib382: Number(fib382.toFixed(4)),
      fib500: Number(fib500.toFixed(4)),
      fib618: Number(fib618.toFixed(4)),
      fib786: Number(fib786.toFixed(4))
    };
  }

  /**
   * Calcula Ichimoku Cloud
   * @param prices Array de dados de preços
   * @returns Array com valores de Ichimoku
   */
  static calculateIchimoku(prices: PriceData[]): IchimokuResult[] {
    if (prices.length < 52) {
      return []; // Ichimoku precisa de pelo menos 52 períodos
    }

    // Garantir ordenação (mais antigo primeiro)
    const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
    const results: IchimokuResult[] = [];

    for (let i = 9; i < sortedPrices.length; i++) {
      // Tenkan-sen (Conversion Line): (Highest High + Lowest Low) / 2 dos últimos 9 períodos
      const tenkanPeriod = sortedPrices.slice(i - 8, i + 1);
      const tenkanHigh = Math.max(...tenkanPeriod.map(p => p.high));
      const tenkanLow = Math.min(...tenkanPeriod.map(p => p.low));
      const tenkanSen = (tenkanHigh + tenkanLow) / 2;

      // Kijun-sen (Base Line): (Highest High + Lowest Low) / 2 dos últimos 26 períodos
      let kijunSen = 0;
      if (i >= 25) {
        const kijunPeriod = sortedPrices.slice(i - 25, i + 1);
        const kijunHigh = Math.max(...kijunPeriod.map(p => p.high));
        const kijunLow = Math.min(...kijunPeriod.map(p => p.low));
        kijunSen = (kijunHigh + kijunLow) / 2;
      }

      // Senkou Span A (Leading Span A): (Tenkan-sen + Kijun-sen) / 2, projetado 26 períodos à frente
      const senkouSpanA = i >= 25 ? (tenkanSen + kijunSen) / 2 : 0;

      // Senkou Span B (Leading Span B): (Highest High + Lowest Low) / 2 dos últimos 52 períodos, projetado 26 períodos à frente
      let senkouSpanB = 0;
      if (i >= 51) {
        const senkouPeriod = sortedPrices.slice(i - 51, i + 1);
        const senkouHigh = Math.max(...senkouPeriod.map(p => p.high));
        const senkouLow = Math.min(...senkouPeriod.map(p => p.low));
        senkouSpanB = (senkouHigh + senkouLow) / 2;
      }

      // Chikou Span (Lagging Span): Preço de fechamento atual, projetado 26 períodos atrás
      const chikouSpan = sortedPrices[i].close;

      results.push({
        date: sortedPrices[i].date,
        tenkanSen: Number(tenkanSen.toFixed(4)),
        kijunSen: Number(kijunSen.toFixed(4)),
        senkouSpanA: Number(senkouSpanA.toFixed(4)),
        senkouSpanB: Number(senkouSpanB.toFixed(4)),
        chikouSpan: Number(chikouSpan.toFixed(4))
      });
    }

    // Retornar apenas o último valor (mais recente)
    return results.length > 0 ? [results[results.length - 1]] : [];
  }

  /**
   * Calcula análise técnica completa
   * @param prices Array de dados de preços
   * @param fibonacciPeriodMonths Período em meses para cálculo de Fibonacci (padrão: 12)
   * @returns Resultado completo da análise técnica
   */
  static calculateTechnicalAnalysis(prices: PriceData[], fibonacciPeriodMonths: number = 12): TechnicalAnalysisResult {
    const rsi = this.calculateRSI(prices);
    const stochastic = this.calculateStochastic(prices);
    const macd = this.calculateMACD(prices);
    const movingAverages = this.calculateMovingAverages(prices);
    const bollingerBands = this.calculateBollingerBands(prices);
    const fibonacci = this.calculateFibonacci(prices, fibonacciPeriodMonths);
    const ichimoku = this.calculateIchimoku(prices);

    const currentRSI = rsi.length > 0 ? rsi[rsi.length - 1] : null;
    const currentStochastic = stochastic.length > 0 ? stochastic[stochastic.length - 1] : null;
    const currentMACD = macd.length > 0 ? macd[macd.length - 1] : null;
    // Médias móveis já retornam apenas o último valor
    const currentMovingAverages = movingAverages.length > 0 ? movingAverages[movingAverages.length - 1] : null;
    // Bollinger Bands já retornam apenas o último valor
    const currentBollingerBands = bollingerBands.length > 0 ? bollingerBands[bollingerBands.length - 1] : null;
    const currentIchimoku = ichimoku.length > 0 ? ichimoku[ichimoku.length - 1] : null;

    // Determinar sinal geral baseado em múltiplos indicadores
    let overallSignal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO' = 'NEUTRO';

    if (currentRSI && currentStochastic) {
      let buySignals = 0;
      let sellSignals = 0;

      // RSI
      if (currentRSI.signal === 'SOBREVENDA') buySignals++;
      if (currentRSI.signal === 'SOBRECOMPRA') sellSignals++;

      // Stochastic
      if (currentStochastic.signal === 'SOBREVENDA') buySignals++;
      if (currentStochastic.signal === 'SOBRECOMPRA') sellSignals++;

      // MACD
      if (currentMACD) {
        if (currentMACD.histogram > 0 && currentMACD.macd > currentMACD.signal) buySignals++;
        if (currentMACD.histogram < 0 && currentMACD.macd < currentMACD.signal) sellSignals++;
      }

      // Bollinger Bands
      if (currentBollingerBands && prices.length > 0) {
        const currentPrice = prices[prices.length - 1].close;
        if (currentPrice < currentBollingerBands.lower) buySignals++;
        if (currentPrice > currentBollingerBands.upper) sellSignals++;
      }

      // Determinar sinal geral
      if (buySignals >= 2) {
        overallSignal = 'SOBREVENDA';
      } else if (sellSignals >= 2) {
        overallSignal = 'SOBRECOMPRA';
      }
    }

    return {
      rsi,
      stochastic,
      macd,
      movingAverages,
      bollingerBands,
      fibonacci,
      ichimoku,
      currentRSI,
      currentStochastic,
      currentMACD,
      currentMovingAverages,
      currentBollingerBands,
      currentIchimoku,
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
