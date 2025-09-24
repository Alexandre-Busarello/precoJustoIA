import { BacktestDataValidator, type BacktestDataValidation, type DataAvailability } from './backtest-data-validator';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/strategies/base-strategy';

// ===== INTERFACES BASE =====

export interface BacktestParams {
  assets: Array<{ ticker: string; allocation: number; averageDividendYield?: number }>;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
}

export interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  positiveMonths: number;
  negativeMonths: number;
  totalInvested: number;
  finalValue: number;
  monthlyReturns: Array<{
    date: string;
    return: number;
    portfolioValue: number;
    contribution: number;
  }>;
  assetPerformance: Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
  }>;
  portfolioEvolution: Array<{
    date: string;
    value: number;
    holdings: Record<string, number>;
    monthlyReturn: number;
  }>;
}

export interface PricePoint {
  date: Date;
  price: number;
  adjustedClose: number;
}

export interface PortfolioSnapshot {
  date: Date;
  value: number;
  holdings: Map<string, number>;
  monthlyReturn: number;
  contribution: number;
}

// ===== INTERFACES ESTENDIDAS =====

export interface MonthlyAssetTransaction {
  month: number;
  date: Date;
  ticker: string;
  transactionType: 'CONTRIBUTION' | 'REBALANCE_BUY' | 'REBALANCE_SELL' | 'CASH_RESERVE' | 'CASH_CREDIT' | 'CASH_DEBIT' | 'DIVIDEND_PAYMENT'; // Tipo da transação
  contribution: number; // Valor aportado neste ativo neste mês (pode ser negativo para vendas)
  price: number; // Preço de compra/venda
  sharesAdded: number; // Quantidade de ações compradas (sempre inteiro, pode ser negativo)
  totalShares: number; // Total de ações após esta transação
  totalInvested: number; // Total investido neste ativo até agora
  cashReserved?: number; // Valor que ficou em caixa por não conseguir comprar ação inteira
  dividendAmount?: number; // Valor de dividendos recebidos (apenas para DIVIDEND_PAYMENT)
}

export interface MonthlyPortfolioHistory {
  month: number;
  date: Date;
  totalContribution: number;
  portfolioValue: number;
  cashBalance: number; // Saldo em caixa no final do mês
  totalDividendsReceived: number; // Total de dividendos recebidos no mês
  transactions: MonthlyAssetTransaction[];
}

export interface AdaptiveBacktestResult extends BacktestResult {
  dataValidation: BacktestDataValidation;
  dataQualityIssues: string[];
  effectiveStartDate: Date;
  effectiveEndDate: Date;
  actualInvestment: number;
  plannedInvestment: number;
  missedContributions: number;
  missedAmount: number;
  totalDividendsReceived: number; // Total de dividendos recebidos durante todo o período
  monthlyHistory: MonthlyPortfolioHistory[]; // Novo campo para histórico detalhado
}

// ===== SERVIÇO ADAPTATIVO =====

export class AdaptiveBacktestService {
  
  /**
   * Salva uma configuração de backtest no banco de dados
   */
  async saveBacktestConfig(
    userId: string,
    params: BacktestParams,
    name?: string,
    description?: string
  ): Promise<string> {
    const config = await prisma.backtestConfig.create({
      data: {
        userId,
        name: name || `Backtest ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
        description: description || `Simulação criada em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        startDate: params.startDate,
        endDate: params.endDate,
        initialCapital: params.initialCapital,
        monthlyContribution: params.monthlyContribution,
        rebalanceFrequency: params.rebalanceFrequency,
        assets: {
          create: params.assets.map(asset => ({
            ticker: asset.ticker.toUpperCase(),
            targetAllocation: asset.allocation,
            averageDividendYield: asset.averageDividendYield || null
          }))
        }
      },
      include: { assets: true }
    });
    
    return config.id;
  }
  
  /**
   * Salva o resultado de um backtest no banco de dados
   */
  async saveBacktestResult(configId: string, result: BacktestResult | AdaptiveBacktestResult): Promise<void> {
    await prisma.backtestResult.upsert({
      where: { backtestId: configId },
      update: {
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        volatility: result.volatility,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        positiveMonths: result.positiveMonths,
        negativeMonths: result.negativeMonths,
        totalMonths: result.monthlyReturns.length,
        totalInvested: result.totalInvested,
        finalValue: result.finalValue,
        totalDividendsReceived: 'totalDividendsReceived' in result ? result.totalDividendsReceived : 0,
        monthlyReturns: result.monthlyReturns as any,
        assetPerformance: result.assetPerformance as any,
        portfolioEvolution: result.portfolioEvolution as any
      },
      create: {
        backtestId: configId,
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        volatility: result.volatility,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        positiveMonths: result.positiveMonths,
        negativeMonths: result.negativeMonths,
        totalMonths: result.monthlyReturns.length,
        totalInvested: result.totalInvested,
        finalValue: result.finalValue,
        totalDividendsReceived: 'totalDividendsReceived' in result ? result.totalDividendsReceived : 0,
        monthlyReturns: result.monthlyReturns as any,
        assetPerformance: result.assetPerformance as any,
        portfolioEvolution: result.portfolioEvolution as any
      }
    } as any);
    
    // Salvar transações mensais se disponíveis (apenas para AdaptiveBacktestResult)
    console.log('🔍 Debug - Verificando monthlyHistory:', {
      hasMonthlyHistory: 'monthlyHistory' in result,
      monthlyHistoryLength: 'monthlyHistory' in result ? result.monthlyHistory?.length : 'N/A',
      resultType: typeof result
    });
    
    if ('monthlyHistory' in result && result.monthlyHistory) {
      console.log('💾 Salvando histórico de transações mensais...');
      console.log('📊 Total de meses no histórico:', result.monthlyHistory.length);
      
      // Primeiro, remover transações existentes para este backtest
      await prisma.backtestTransaction.deleteMany({
        where: { backtestId: configId }
      });
      
      // Preparar dados das transações
      const transactionData = [];
      for (const monthData of result.monthlyHistory) {
        for (const transaction of monthData.transactions) {
          const progressiveCashBalance = (transaction as any).cashBalance;
          
          transactionData.push({
            backtestId: configId,
            month: transaction.month,
            date: transaction.date,
            ticker: transaction.ticker,
            transactionType: transaction.transactionType,
            contribution: transaction.contribution,
            price: transaction.price,
            sharesAdded: transaction.sharesAdded,
            totalShares: transaction.totalShares,
            totalInvested: transaction.totalInvested,
            cashReserved: transaction.cashReserved || null,
            totalContribution: monthData.totalContribution,
            portfolioValue: monthData.portfolioValue,
            cashBalance: progressiveCashBalance !== undefined ? progressiveCashBalance : monthData.cashBalance
          });
        }
      }
      
      // Salvar todas as transações em lote
      if (transactionData.length > 0) {
        await prisma.backtestTransaction.createMany({
          data: transactionData
        });
        console.log(`✅ ${transactionData.length} transações salvas com sucesso`);
      }
    }
  }
  
  /**
   * Executa backtesting com tratamento inteligente de dados faltantes
   */
  async runAdaptiveBacktest(params: BacktestParams): Promise<AdaptiveBacktestResult> {
    console.log('🔄 Iniciando backtesting adaptativo...');
    
    // 1. Validar dados disponíveis
    const validator = new BacktestDataValidator();
    const validation = await validator.validateBacktestData(
      params.assets,
      params.startDate,
      params.endDate
    );
    
    if (!validation.isValid) {
      throw new Error(`Dados insuficientes para realizar o backtesting: ${validation.globalWarnings.join(', ')}`);
    }
    
    // 2. Ajustar parâmetros baseado na validação
    const adjustedParams = {
      ...params,
      startDate: validation.adjustedStartDate,
      endDate: validation.adjustedEndDate
    };
    
    console.log('📊 Período ajustado:', {
      original: `${params.startDate.toISOString().split('T')[0]} - ${params.endDate.toISOString().split('T')[0]}`,
      adjusted: `${adjustedParams.startDate.toISOString().split('T')[0]} - ${adjustedParams.endDate.toISOString().split('T')[0]}`
    });
    
    // 3. Obter preços históricos com fallbacks
    const pricesData = await this.getHistoricalPricesWithFallbacks(
      params.assets.map(a => a.ticker),
      adjustedParams.startDate,
      adjustedParams.endDate
    );
    
    // 4. Executar simulação adaptativa
    const simulationResult = await this.simulateAdaptivePortfolio(
      pricesData,
      adjustedParams,
      validation.assetsAvailability
    );
    
    // 5. Calcular métricas e incluir informações de qualidade dos dados
    const result = await this.calculateMetricsWithDataQuality(
      simulationResult.evolution,
      adjustedParams,
      validation,
      pricesData,
      simulationResult.monthlyHistory,
      simulationResult.totalDividendsReceived
    );
    
    console.log('✅ Backtesting adaptativo concluído');
    
    return result;
  }
  
  /**
   * Obtém preços históricos com tratamento de fallbacks
   */
  private async getHistoricalPricesWithFallbacks(
    tickers: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, PricePoint[]>> {
    console.log('📈 Obtendo preços históricos com fallbacks...');
    
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
    const pricesMap = new Map<string, PricePoint[]>();
    
    for (const ticker of tickers) {
      let tickerPrices = historicalData
        .filter(d => d.company.ticker === ticker)
        .map(d => ({
          date: d.date,
          price: toNumber(d.close) || 0,
          adjustedClose: toNumber(d.adjustedClose) || toNumber(d.close) || 0
        }))
        .filter(p => p.price > 0); // Filtrar preços inválidos

      tickerPrices = this.fillMissingPrices(tickerPrices, startDate, endDate);
      
      pricesMap.set(ticker, tickerPrices);
      
      console.log(`📊 ${ticker}: ${tickerPrices.length} pontos processados`);
      
      if (tickerPrices.length > 0) {
        console.log(`🔍 ${ticker} - Primeiro preço:`, {
          date: tickerPrices[0].date.toISOString().split('T')[0],
          price: tickerPrices[0].adjustedClose
        });
        console.log(`🔍 ${ticker} - Último preço:`, {
          date: tickerPrices[tickerPrices.length - 1].date.toISOString().split('T')[0],
          price: tickerPrices[tickerPrices.length - 1].adjustedClose
        });
        
        // Mostrar alguns preços do meio para debug
        if (tickerPrices.length > 5) {
          const midIndex = Math.floor(tickerPrices.length / 2);
          console.log(`🔍 ${ticker} - Preço do meio (${midIndex}):`, {
            date: tickerPrices[midIndex].date.toISOString().split('T')[0],
            price: tickerPrices[midIndex].adjustedClose
          });
        }
      } else {
        console.log(`❌ ${ticker}: Nenhum dado de preço válido encontrado`);
      }
    }

    return pricesMap;
  }
  
  /**
   * Preenche dados faltantes usando diferentes estratégias
   */
  private fillMissingPrices(
    prices: PricePoint[], 
    startDate: Date, 
    endDate: Date
  ): PricePoint[] {
    if (prices.length === 0) return prices;
    
    console.log(`🔧 fillMissingPrices: Processando ${prices.length} preços originais`);
    
    // Gerar todas as datas mensais esperadas
    const expectedDates = this.generateMonthlyDatesAdaptive(startDate, endDate);
    const filledPrices: PricePoint[] = [];
    let exactMatches = 0;
    let forwardFills = 0;
    
    for (const expectedDate of expectedDates) {
      // Procurar preço próximo (até 7 dias de diferença para dados mensais)
      const maxDiffMs = 7 * 24 * 60 * 60 * 1000; // 7 dias
      const exactMatch = prices.find(p => 
        Math.abs(p.date.getTime() - expectedDate.getTime()) <= maxDiffMs
      );
      
      if (exactMatch) {
        filledPrices.push(exactMatch);
        exactMatches++;
      } else {
        // Usar forward fill (último preço disponível)
        const lastPrice = filledPrices[filledPrices.length - 1];
        if (lastPrice) {
          filledPrices.push({
            date: expectedDate,
            price: lastPrice.price,
            adjustedClose: lastPrice.adjustedClose
          });
          forwardFills++;
        } else {
          // Se é o primeiro ponto, procurar o próximo disponível
          const nextPrice = prices.find(p => p.date > expectedDate);
          if (nextPrice) {
            filledPrices.push({
              date: expectedDate,
              price: nextPrice.price,
              adjustedClose: nextPrice.adjustedClose
            });
            forwardFills++;
          }
        }
      }
    }
    
    console.log(`📊 fillMissingPrices: ${exactMatches} matches exatos, ${forwardFills} forward fills, ${filledPrices.length} total`);
    
    // Se muitos forward fills, isso pode ser o problema!
    if (forwardFills > exactMatches) {
      console.log(`⚠️ PROBLEMA: Muitos forward fills (${forwardFills}) vs matches reais (${exactMatches}) - isso causará retornos 0%`);
    }
    
    return filledPrices;
  }
  
  /**
   * Calcula dividendos mensais baseado no dividend yield médio
   */
  private calculateMonthlyDividends(
    currentHoldings: Map<string, number>,
    params: BacktestParams,
    currentDate: Date,
    pricesData: Map<string, PricePoint[]>
  ): { dividendTransactions: MonthlyAssetTransaction[], totalDividends: number } {
    const dividendTransactions: MonthlyAssetTransaction[] = [];
    let totalDividends = 0;

    for (const asset of params.assets) {
      const shares = currentHoldings.get(asset.ticker) || 0;
      const averageDY = asset.averageDividendYield || 0;

      if (shares > 0 && averageDY > 0) {
        // Buscar preço atual da ação
        const prices = pricesData.get(asset.ticker) || [];
        const currentPrice = this.getPriceForDateAdaptive(prices, currentDate);
        
        if (currentPrice && currentPrice > 0) {
          // Calcular dividendo mensal (DY anual / 12)
          const monthlyDividendRate = averageDY / 12;
          const monthlyDividendPerShare = currentPrice * monthlyDividendRate;
          const totalDividendAmount = shares * monthlyDividendPerShare;

          if (totalDividendAmount > 0.01) { // Mínimo de R$ 0,01 para registrar
            dividendTransactions.push({
              month: 0, // Será atualizado pelo caller
              date: new Date(currentDate),
              ticker: asset.ticker,
              transactionType: 'DIVIDEND_PAYMENT',
              contribution: totalDividendAmount, // Positivo para crédito
              price: currentPrice,
              sharesAdded: 0, // Dividendos não alteram quantidade de ações
              totalShares: shares,
              totalInvested: 0, // Não aplicável para dividendos
              dividendAmount: totalDividendAmount
            });

            totalDividends += totalDividendAmount;
          }
        }
      }
    }

    return { dividendTransactions, totalDividends };
  }

  /**
   * Simula evolução da carteira com tratamento de dados faltantes
   */
  private async simulateAdaptivePortfolio(
    pricesData: Map<string, PricePoint[]>,
    params: BacktestParams,
    assetsAvailability: DataAvailability[]
  ): Promise<{ evolution: PortfolioSnapshot[], monthlyHistory: MonthlyPortfolioHistory[], totalDividendsReceived: number }> {
    console.log('🔄 Simulando carteira adaptativa...');

    const evolution: PortfolioSnapshot[] = [];
    const monthlyHistory: MonthlyPortfolioHistory[] = [];
    let currentHoldings = new Map<string, number>();
    let portfolioValue = params.initialCapital; // Começar com capital inicial
    let previousPortfolioValue = 0;
    let missedContributions = 0;
    let cashBalance = 0; // Saldo em caixa inicial = 0 (capital inicial será usado no primeiro rebalanceamento)
    let totalDividendsReceived = 0; // Total de dividendos recebidos durante todo o período
    
    // Rastrear investimento total por ativo
    const totalInvestedByAsset = new Map<string, number>();
    params.assets.forEach(asset => totalInvestedByAsset.set(asset.ticker, 0));

    // Gerar datas mensais no período
    const monthlyDates = this.generateMonthlyDatesAdaptive(params.startDate, params.endDate);
    
    for (let i = 0; i < monthlyDates.length; i++) {
      const currentDate = monthlyDates[i];
      const isFirstMonth = i === 0;
      
      // Verificar quais ativos têm dados disponíveis nesta data
      const availableAssets = this.getAvailableAssetsForDate(
        currentDate, 
        pricesData, 
        assetsAvailability
      );
      
      let monthlyContribution = params.monthlyContribution;
      
      if (availableAssets.length === 0) {
        // Se nenhum ativo tem dados, pular este mês
        console.log(`⚠️ Pulando ${currentDate.toISOString().split('T')[0]} - nenhum ativo disponível`);
        missedContributions++;
        continue;
      }
      
      if (i < 5) { // Log detalhado apenas nos primeiros 5 meses
        console.log(`\n📅 === MÊS ${i} (${currentDate.toISOString().split('T')[0]}) ===`);
        console.log(`💰 Portfolio inicial: R$ ${portfolioValue.toFixed(2)}`);
      }
      
      // 1. Aplicar retornos dos ativos (se não for o primeiro mês)
      if (!isFirstMonth && currentHoldings.size > 0) {
        const previousDate = monthlyDates[i - 1];
        
        if (i < 5) console.log(`📈 Aplicando retornos dos ativos (${currentHoldings.size} posições)`);
        portfolioValue = this.applyAssetReturnsAdaptive(
          portfolioValue,
          currentHoldings,
          pricesData,
          previousDate,
          currentDate,
          availableAssets
        );
        if (i < 5) console.log(`💰 Portfolio após retornos: R$ ${portfolioValue.toFixed(2)}`);
      }

      // Salvar saldo inicial do mês (antes de qualquer transação)
      const initialCashBalance = cashBalance;

      // 1.5. Calcular e aplicar dividendos (se não for o primeiro mês)
      let monthlyDividends = 0;
      let dividendTransactions: MonthlyAssetTransaction[] = [];
      
      if (!isFirstMonth && currentHoldings.size > 0) {
        const dividendResult = this.calculateMonthlyDividends(currentHoldings, params, currentDate, pricesData);
        dividendTransactions = dividendResult.dividendTransactions;
        monthlyDividends = dividendResult.totalDividends;
        
        // Adicionar dividendos ao caixa
        cashBalance += monthlyDividends;
        totalDividendsReceived += monthlyDividends;
        
        // Atualizar índice do mês nas transações de dividendos
        dividendTransactions.forEach(transaction => {
          transaction.month = i;
        });
        
        if (monthlyDividends > 0 && i < 5) {
          console.log(`💰 Dividendos recebidos: R$ ${monthlyDividends.toFixed(2)} → Caixa: R$ ${cashBalance.toFixed(2)}`);
        }
      }
      
      // 2. Adicionar aporte mensal (exceto no primeiro mês, onde o capital inicial já inclui o primeiro aporte)
      if (!isFirstMonth) {
      portfolioValue += monthlyContribution;
        if (i < 5) {
          console.log(`💰 Portfolio após aporte (+R$ ${monthlyContribution}): R$ ${portfolioValue.toFixed(2)}`);
        }
      } else {
        if (i < 5) {
          console.log(`💰 Portfolio inicial (capital inicial): R$ ${portfolioValue.toFixed(2)}`);
        }
      }

      // 3. Rebalancear carteira com ativos disponíveis
      const shouldRebalance = this.shouldRebalanceAdaptive(i, params.rebalanceFrequency);
      if (i < 5) console.log(`🔄 Deve rebalancear: ${shouldRebalance}`);
      
      if (shouldRebalance) {
        if (i < 5) console.log(`🔄 Rebalanceando carteira...`);
        const adjustedAssets = this.adjustAllocationsForAvailableAssets(
          params.assets,
          availableAssets
        );
        
        const rebalanceResult = this.rebalancePortfolioAdaptive(
          portfolioValue,
          adjustedAssets,
          pricesData,
          currentDate,
          currentHoldings,
          totalInvestedByAsset,
          i,
          cashBalance,
          params.monthlyContribution // Sempre passar o aporte mensal
        );
        
        currentHoldings = rebalanceResult.newHoldings;
        cashBalance = rebalanceResult.finalCashBalance;
        
        // Calcular valor total das vendas de rebalanceamento para logs
        const salesTransactions = rebalanceResult.transactions.filter(t => t.transactionType === 'REBALANCE_SELL');
        const totalSales = salesTransactions.reduce((sum, t) => sum + Math.abs(t.contribution), 0);
        if (totalSales > 0 && i < 5) {
          console.log(`💰 Vendas de rebalanceamento: R$ ${totalSales.toFixed(2)} (somadas ao valor disponível)`);
        }
        
        // Combinar todas as transações do mês
        const allTransactions = [...dividendTransactions, ...rebalanceResult.transactions];
        
        // Calcular saldo progressivo para TODAS as transações do mês
        // Começar com o saldo inicial do mês (antes de qualquer transação)
        let runningBalance = initialCashBalance;
        
        allTransactions.forEach((transaction) => {
          if (transaction.ticker === 'CASH') {
            if (transaction.transactionType === 'CASH_CREDIT') {
              runningBalance += transaction.contribution;
            } else if (transaction.transactionType === 'CASH_DEBIT') {
              runningBalance += transaction.contribution; // contribution já é negativo para débito
            }
          } else if (transaction.transactionType === 'DIVIDEND_PAYMENT') {
            // Dividendos são créditos no caixa
            runningBalance += transaction.contribution;
          } else {
            // Transações de ativos (débito do caixa para compras)
            runningBalance -= transaction.contribution;
          }
          
          // Atualizar o cashBalance da transação
          (transaction as any).cashBalance = runningBalance;
        });
        
        // Registrar histórico mensal
        monthlyHistory.push({
          month: i,
          date: new Date(currentDate),
          totalContribution: monthlyContribution, // Sempre registrar o aporte mensal
          portfolioValue: portfolioValue,
          cashBalance: cashBalance,
          totalDividendsReceived: monthlyDividends,
          transactions: allTransactions
        });
        
        if (i < 5) console.log(`✅ Rebalanceamento concluído:`, {
          portfolioValue: portfolioValue.toFixed(2),
          holdings: Array.from(currentHoldings.entries()).map(([ticker, shares]) => 
            `${ticker}: ${shares.toFixed(6)} ações`
          )
        });
      }

      // 4. Calcular retorno mensal
      const monthlyReturn = isFirstMonth ? 0 : 
        previousPortfolioValue > 0 ? (portfolioValue - previousPortfolioValue - monthlyContribution) / previousPortfolioValue : 0;
      
      if (i < 5) console.log(`📊 Retorno mensal: ${(monthlyReturn * 100).toFixed(2)}%`);

      // 5. Registrar snapshot
      evolution.push({
        date: currentDate,
        value: portfolioValue,
        holdings: new Map(currentHoldings),
        monthlyReturn,
        contribution: monthlyContribution
      });

      previousPortfolioValue = portfolioValue;
    }

    console.log(`📊 Simulação adaptativa concluída: ${evolution.length} meses, ${missedContributions} aportes perdidos`);
    console.log(`💰 Total de dividendos recebidos: R$ ${totalDividendsReceived.toFixed(2)}`);
    
    // Debug: verificar se há valores válidos
    if (evolution.length > 0) {
      const firstValue = evolution[0].value;
      const lastValue = evolution[evolution.length - 1].value;
      console.log('🔍 Debug evolução:', {
        firstValue,
        lastValue,
        totalMonths: evolution.length,
        totalDividendsReceived,
        firstHoldings: Array.from(evolution[0].holdings.entries()),
        lastHoldings: Array.from(evolution[evolution.length - 1].holdings.entries())
      });
    }
    
    return { evolution, monthlyHistory, totalDividendsReceived };
  }
  
  
  /**
   * Verifica quais ativos têm dados disponíveis para uma data específica
   */
  private getAvailableAssetsForDate(
    date: Date,
    pricesData: Map<string, PricePoint[]>,
    assetsAvailability: DataAvailability[]
  ): string[] {
    const availableAssets: string[] = [];
    
    for (const asset of assetsAvailability) {
      if (asset.totalMonths === 0) continue; // Pular ativos sem dados
      
      const prices = pricesData.get(asset.ticker) || [];
      const hasPrice = prices.some(p => 
        Math.abs(p.date.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000 // 7 dias de tolerância
      );
      
      if (hasPrice) {
        availableAssets.push(asset.ticker);
      }
    }
    
    return availableAssets;
  }
  
  /**
   * Aplica retornos considerando apenas ativos disponíveis
   */
  private applyAssetReturnsAdaptive(
    portfolioValue: number,
    holdings: Map<string, number>,
    pricesData: Map<string, PricePoint[]>,
    previousDate: Date,
    currentDate: Date,
    availableAssets: string[]
  ): number {
    let newPortfolioValue = 0;
    const assetReturns: string[] = [];

    for (const [ticker, shares] of holdings) {
      if (!availableAssets.includes(ticker)) {
        // Se ativo não está disponível, manter valor anterior
        const prices = pricesData.get(ticker) || [];
        const lastKnownPrice = this.getPriceForDateAdaptive(prices, previousDate) || 0;
        const fallbackValue = shares * lastKnownPrice;
        newPortfolioValue += fallbackValue;
        assetReturns.push(`${ticker}: 0.0% (indisponível)`);
        continue;
      }
      
      const prices = pricesData.get(ticker) || [];
      const previousPrice = this.getPriceForDateAdaptive(prices, previousDate);
      const currentPrice = this.getPriceForDateAdaptive(prices, currentDate);
      
      if (previousPrice && currentPrice) {
        const currentValue = shares * currentPrice;
        newPortfolioValue += currentValue;
        
        const return_ = ((currentPrice - previousPrice) / previousPrice) * 100;
        assetReturns.push(`${ticker}: ${return_.toFixed(1)}%`);
      } else {
        // Fallback para último preço conhecido
        const fallbackPrice = previousPrice || currentPrice || 0;
        const fallbackValue = shares * fallbackPrice;
        newPortfolioValue += fallbackValue;
        assetReturns.push(`${ticker}: 0.0% (sem preço)`);
      }
    }

    // Log apenas nos primeiros meses (será chamado dentro do loop principal)
    if (assetReturns.length > 0) {
      console.log(`📈 Retornos: [${assetReturns.join(', ')}] → R$ ${portfolioValue.toFixed(2)} → R$ ${newPortfolioValue.toFixed(2)}`);
    }
    return newPortfolioValue;
  }
  
  /**
   * Ajusta alocações quando nem todos os ativos estão disponíveis
   */
  private adjustAllocationsForAvailableAssets(
    originalAssets: Array<{ ticker: string; allocation: number }>,
    availableAssets: string[]
  ): Array<{ ticker: string; allocation: number }> {
    
    // Filtrar apenas ativos disponíveis
    const availableOriginalAssets = originalAssets.filter(
      asset => availableAssets.includes(asset.ticker)
    );
    
    if (availableOriginalAssets.length === 0) {
      return [];
    }
    
    // Calcular soma das alocações disponíveis
    const totalAvailableAllocation = availableOriginalAssets.reduce(
      (sum, asset) => sum + asset.allocation, 0
    );
    
    // Normalizar para somar 100%
    return availableOriginalAssets.map(asset => ({
      ticker: asset.ticker,
      allocation: asset.allocation / totalAvailableAllocation
    }));
  }
  
  /**
   * Rebalanceia carteira considerando apenas ativos disponíveis
   */
  private rebalancePortfolioAdaptive(
    portfolioValue: number,
    targetAssets: Array<{ ticker: string; allocation: number }>,
    pricesData: Map<string, PricePoint[]>,
    date: Date,
    previousHoldings: Map<string, number>,
    totalInvestedByAsset: Map<string, number>,
    monthIndex: number,
    cashBalance: number = 0,
    monthlyContribution: number = 1000
  ): { newHoldings: Map<string, number>, transactions: MonthlyAssetTransaction[], finalCashBalance: number } {
    const newHoldings = new Map<string, number>();
    const transactions: MonthlyAssetTransaction[] = [];
    const MIN_REBALANCE_VALUE = 100; // Valor mínimo para rebalancear
    
    // NOVA LÓGICA CONTÁBIL: Iniciar com caixa anterior + aporte mensal da configuração
    let currentCash = cashBalance + monthlyContribution;
    
    // No primeiro mês, adicionar capital inicial ao caixa
    if (monthIndex === 0) {
      currentCash += portfolioValue; // Adicionar capital inicial
    }
    
    console.log(`🏦 GESTÃO CONTÁBIL DO MÊS:`);
    console.log(`   💰 Caixa anterior: R$ ${cashBalance.toFixed(2)}`);
    console.log(`   💰 Aporte mensal: +R$ ${monthlyContribution.toFixed(2)}`);
    if (monthIndex === 0) {
      console.log(`   💰 Capital inicial: +R$ ${portfolioValue.toFixed(2)}`);
    }
    console.log(`   💰 Caixa total disponível: R$ ${currentCash.toFixed(2)}`);

    // Registrar crédito no caixa com saldo progressivo
    let progressiveCashBalance = cashBalance;
    
    if (monthIndex === 0) {
      // Primeiro mês: registrar capital inicial
      progressiveCashBalance += portfolioValue;
      transactions.push({
        month: monthIndex,
        date: new Date(date),
        ticker: 'CASH',
        transactionType: 'CASH_CREDIT',
        contribution: portfolioValue, // Capital inicial
        price: 1,
        sharesAdded: 0,
        totalShares: 0,
        totalInvested: 0,
        cashReserved: portfolioValue
      });
      
      // Aporte mensal
      if (monthlyContribution > 0) {
        progressiveCashBalance += monthlyContribution;
        transactions.push({
          month: monthIndex,
          date: new Date(date),
          ticker: 'CASH',
          transactionType: 'CASH_CREDIT',
          contribution: monthlyContribution, // Aporte mensal
          price: 1,
          sharesAdded: 0,
          totalShares: 0,
          totalInvested: 0,
          cashReserved: monthlyContribution
        });
      }
    } else if (monthlyContribution > 0) {
      // Demais meses: apenas aporte mensal
      progressiveCashBalance += monthlyContribution;
      transactions.push({
        month: monthIndex,
        date: new Date(date),
        ticker: 'CASH',
        transactionType: 'CASH_CREDIT',
        contribution: monthlyContribution, // Positivo para crédito
        price: 1,
        sharesAdded: 0,
        totalShares: 0,
        totalInvested: 0,
        cashReserved: monthlyContribution
      });
    }

    // FASE 1: Calcular posições atuais e identificar vendas necessárias
    const currentPositions = new Map<string, { shares: number, value: number, price: number }>();
    let totalCurrentValue = 0; // Calcular valor real dos ativos atuais

    for (const asset of targetAssets) {
      const prices = pricesData.get(asset.ticker) || [];
      const currentPrice = this.getPriceForDateAdaptive(prices, date);
      const currentShares = Math.floor(previousHoldings.get(asset.ticker) || 0); // Garantir ações inteiras
      
      if (currentPrice && currentPrice > 0) {
        const currentValue = currentShares * currentPrice;
        currentPositions.set(asset.ticker, { shares: currentShares, value: currentValue, price: currentPrice });
        totalCurrentValue += currentValue; // Somar valor real dos ativos
      }
    }
    
    console.log(`📊 Valor atual dos ativos: R$ ${totalCurrentValue.toFixed(2)}`);

    // FASE 2: Calcular posições alvo e identificar vendas
    const targetPositions = new Map<string, { targetShares: number, targetValue: number, currentShares: number, price: number }>();
    
    // Valor total para alocação = valor da carteira + caixa disponível (que já inclui aporte mensal)
    const totalValueForAllocation = totalCurrentValue + currentCash;
    console.log(`💰 Valor total para alocação (carteira + caixa disponível): R$ ${totalValueForAllocation.toFixed(2)}`);
    
    for (const asset of targetAssets) {
      const prices = pricesData.get(asset.ticker) || [];
      const currentPrice = this.getPriceForDateAdaptive(prices, date);
      
      if (currentPrice && currentPrice > 0) {
        const position = currentPositions.get(asset.ticker);
        const currentShares = position ? position.shares : 0;
        
        const targetValue = totalValueForAllocation * asset.allocation;
        const targetShares = Math.floor(targetValue / currentPrice); // Ações inteiras apenas
        
        targetPositions.set(asset.ticker, {
          targetShares,
          targetValue,
          currentShares,
          price: currentPrice
        });
        
        if (monthIndex < 5) {
          console.log(`🎯 ${asset.ticker}: target ${targetShares} ações (R$ ${targetValue.toFixed(2)}) vs atual ${currentShares} ações`);
        }
      }
    }

    // FASE 3: Executar vendas de rebalanceamento (CRÉDITO no caixa)
    let totalSalesValue = 0;
    for (const [ticker, target] of targetPositions) {
      const sharesToSell = target.currentShares - target.targetShares;
      
      if (sharesToSell > 0) {
        const saleValue = sharesToSell * target.price;
        
        // Verificar se a venda atende o valor mínimo
        if (saleValue >= MIN_REBALANCE_VALUE) {
          // CRÉDITO: Adicionar venda ao caixa
          currentCash += saleValue;
          totalSalesValue += saleValue;
          
          // Atualizar total investido (reduzir proporcionalmente)
          const currentTotalInvested = totalInvestedByAsset.get(ticker) || 0;
          const proportionSold = sharesToSell / target.currentShares;
          const investmentReduced = currentTotalInvested * proportionSold;
          totalInvestedByAsset.set(ticker, currentTotalInvested - investmentReduced);
          
          newHoldings.set(ticker, target.targetShares);
          
          transactions.push({
            month: monthIndex,
            date: new Date(date),
            ticker: ticker,
            transactionType: 'REBALANCE_SELL',
            contribution: -saleValue, // Negativo para venda
            price: target.price,
            sharesAdded: -sharesToSell, // Negativo para venda
            totalShares: target.targetShares,
            totalInvested: totalInvestedByAsset.get(ticker) || 0
          });
          
          console.log(`🔴 VENDA (CRÉDITO): ${ticker} - ${sharesToSell} ações por R$ ${target.price.toFixed(2)} = +R$ ${saleValue.toFixed(2)} → Caixa: R$ ${currentCash.toFixed(2)}`);
        } else {
          // Venda abaixo do mínimo - manter posição atual e acumular para futuro
          console.log(`⏳ VENDA ADIADA: ${ticker} - R$ ${saleValue.toFixed(2)} < R$ ${MIN_REBALANCE_VALUE} (mínimo)`);
          newHoldings.set(ticker, target.currentShares);
        }
      } else {
        // Manter posição atual se não há venda
        newHoldings.set(ticker, target.currentShares);
      }
    }

    // FASE 4: Comprar ativos com o caixa disponível (DÉBITO do caixa)
    console.log(`\n🛒 INICIANDO COMPRAS COM CAIXA DISPONÍVEL: R$ ${currentCash.toFixed(2)}`);
    
    // Determinar se houve rebalanceamento real (vendas) neste mês
    const hasRebalancingSales = totalSalesValue > 0;
    console.log(`🔄 Rebalanceamento com vendas: ${hasRebalancingSales ? 'SIM' : 'NÃO'} (vendas: R$ ${totalSalesValue.toFixed(2)})`);
    
    // Comprar ativos na ordem de prioridade (maior diferença para o target)
    for (const [ticker, target] of targetPositions) {
      const currentShares = newHoldings.get(ticker) || target.currentShares;
      const sharesToBuy = target.targetShares - currentShares;
      
      if (sharesToBuy > 0 && currentCash >= target.price) {
        // Calcular quantas ações consegue comprar com o caixa disponível
        const maxAffordableShares = Math.floor(currentCash / target.price);
        const actualSharesToBuy = Math.min(sharesToBuy, maxAffordableShares);
        
        if (actualSharesToBuy > 0) {
          const purchaseValue = actualSharesToBuy * target.price;
          
          // DÉBITO: Subtrair compra do caixa
          currentCash -= purchaseValue;
          
          const newTotalShares = currentShares + actualSharesToBuy;
          
          // Atualizar total investido
          const currentTotalInvested = totalInvestedByAsset.get(ticker) || 0;
          totalInvestedByAsset.set(ticker, currentTotalInvested + purchaseValue);
          
          newHoldings.set(ticker, newTotalShares);
          
          // Classificar transação: se há vendas = rebalanceamento, senão = aporte
          const transactionType = hasRebalancingSales ? 'REBALANCE_BUY' : 'CONTRIBUTION';
          
          transactions.push({
            month: monthIndex,
            date: new Date(date),
            ticker: ticker,
            transactionType: transactionType,
            contribution: purchaseValue,
            price: target.price,
            sharesAdded: actualSharesToBuy,
            totalShares: newTotalShares,
            totalInvested: totalInvestedByAsset.get(ticker) || 0,
            cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
          });
          
          const typeIcon = transactionType === 'CONTRIBUTION' ? '💰' : '🔄';
          console.log(`${typeIcon} ${transactionType === 'CONTRIBUTION' ? 'APORTE' : 'COMPRA (REBAL.)'} (DÉBITO): ${ticker} - ${actualSharesToBuy} ações por R$ ${target.price.toFixed(2)} = -R$ ${purchaseValue.toFixed(2)} → Caixa: R$ ${currentCash.toFixed(2)}`);
          
          // Se não conseguiu comprar todas as ações desejadas
          if (sharesToBuy > actualSharesToBuy) {
            const unspentValue = (sharesToBuy - actualSharesToBuy) * target.price;
            console.log(`💰 FALTOU CAIXA: R$ ${unspentValue.toFixed(2)} para comprar mais ${sharesToBuy - actualSharesToBuy} ações de ${ticker}`);
          }
        }
      }
    }

      // FASE 5: Saldo final e resumo contábil
      const finalCashBalance = currentCash;
      
      console.log(`\n🏦 RESUMO CONTÁBIL DO MÊS:`);
      console.log(`   💰 Caixa inicial: R$ ${cashBalance.toFixed(2)}`);
      console.log(`   💰 Aporte mensal: +R$ ${monthlyContribution.toFixed(2)}`);
      if (monthIndex === 0) {
        console.log(`   💰 Capital inicial: +R$ ${portfolioValue.toFixed(2)}`);
      }
      console.log(`   💰 Vendas: +R$ ${totalSalesValue.toFixed(2)}`);
      
      // Calcular total de créditos incluindo capital inicial no primeiro mês
      const totalCredits = monthlyContribution + totalSalesValue + (monthIndex === 0 ? portfolioValue : 0);
      console.log(`   💰 Total de créditos: R$ ${totalCredits.toFixed(2)}`);
      
      const totalPurchases = (cashBalance + totalCredits) - currentCash;
      console.log(`   💰 Total de débitos (compras): -R$ ${totalPurchases.toFixed(2)}`);
      console.log(`   💰 Saldo final: R$ ${finalCashBalance.toFixed(2)}`);
      console.log(`   ✅ Verificação: R$ ${cashBalance.toFixed(2)} + R$ ${totalCredits.toFixed(2)} - R$ ${totalPurchases.toFixed(2)} = R$ ${finalCashBalance.toFixed(2)}`);

      // Não registrar débito consolidado - cada compra individual já debita do caixa
    
    // Registrar transação de caixa final se houver saldo
    if (finalCashBalance > 0.01) {
      transactions.push({
        month: monthIndex,
        date: new Date(date),
        ticker: 'CASH',
        transactionType: 'CASH_RESERVE',
        contribution: 0,
        price: 1,
        sharesAdded: 0,
        totalShares: 0,
        totalInvested: 0,
        cashReserved: finalCashBalance
      });
      
      console.log(`💰 CAIXA FINAL: R$ ${finalCashBalance.toFixed(2)} mantido para próximo mês`);
    }

    return { newHoldings, transactions, finalCashBalance };
  }
  
  /**
   * Calcula métricas incluindo informações de qualidade dos dados
   */
  private async calculateMetricsWithDataQuality(
    evolution: PortfolioSnapshot[],
    params: BacktestParams,
    validation: BacktestDataValidation,
    pricesData: Map<string, PricePoint[]>,
    monthlyHistory: MonthlyPortfolioHistory[],
    totalDividendsReceived: number = 0
  ): Promise<AdaptiveBacktestResult> {
    
    // Calcular métricas básicas
    const baseResult = this.calculateMetricsAdaptive(evolution, params, pricesData, monthlyHistory);
    
    // Calcular informações adicionais
    const plannedMonths = this.getMonthsDifferenceAdaptive(params.startDate, params.endDate);
    const actualMonths = evolution.length;
    const missedContributions = plannedMonths - actualMonths;
    const plannedInvestment = plannedMonths * params.monthlyContribution;
    const actualInvestment = actualMonths * params.monthlyContribution;
    const missedAmount = missedContributions * params.monthlyContribution;
    
    // Compilar issues de qualidade
    const dataQualityIssues: string[] = [];
    
    if (missedContributions > 0) {
      dataQualityIssues.push(
        `${missedContributions} aportes mensais foram perdidos devido à falta de dados`
      );
    }
    
    validation.assetsAvailability.forEach(asset => {
      if (asset.dataQuality === 'poor') {
        dataQualityIssues.push(`${asset.ticker}: Qualidade de dados ruim`);
      } else if (asset.dataQuality === 'fair') {
        dataQualityIssues.push(`${asset.ticker}: Qualidade de dados regular`);
      }
      
      if (asset.missingMonths > 0) {
        dataQualityIssues.push(
          `${asset.ticker}: ${asset.missingMonths} meses com dados faltantes`
        );
      }
    });
    
    return {
      ...baseResult,
      dataValidation: validation,
      dataQualityIssues,
      effectiveStartDate: validation.adjustedStartDate,
      effectiveEndDate: validation.adjustedEndDate,
      actualInvestment,
      plannedInvestment,
      missedContributions,
      missedAmount,
      totalDividendsReceived,
      monthlyHistory
    };
  }
  
  /**
   * Gera datas mensais (método herdado, mas redefinido para clareza)
   */
  private generateMonthlyDatesAdaptive(startDate: Date, endDate: Date): Date[] {
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
   * Calcula diferença em meses (método herdado)
   */
  private getMonthsDifferenceAdaptive(startDate: Date, endDate: Date): number {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
           (endDate.getMonth() - startDate.getMonth()) + 1;
  }
  
  /**
   * Obtém preço para data específica (método herdado)
   */
  private getPriceForDateAdaptive(prices: PricePoint[], targetDate: Date): number | null {
    if (prices.length === 0) {
      console.log(`⚠️ getPriceForDateAdaptive: Nenhum preço disponível para ${targetDate.toISOString().split('T')[0]}`);
      return null;
    }

    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    // Buscar preço exato
    const exactMatch = prices.find(p => 
      p.date.getTime() === targetDate.getTime()
    );
    if (exactMatch) {
      return exactMatch.adjustedClose;
    }

    // Buscar preço mais próximo (até 45 dias de diferença)
    const maxDiffMs = 45 * 24 * 60 * 60 * 1000;
    let closestPrice: PricePoint | null = null;
    let minDiff = Infinity;

    for (const price of prices) {
      const diff = Math.abs(price.date.getTime() - targetDate.getTime());
      if (diff < minDiff && diff <= maxDiffMs) {
        minDiff = diff;
        closestPrice = price;
      }
    }

    if (closestPrice) {
      return closestPrice.adjustedClose;
    }

    // Se não encontrou preço próximo, usar o último preço disponível
    const sortedPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
    const lastPrice = sortedPrices[sortedPrices.length - 1];
    
    console.log(`⚠️ getPriceForDateAdaptive: Usando último preço disponível para ${targetDateStr}`);
    console.log(`📊 Último preço: ${lastPrice.date.toISOString().split('T')[0]} = ${lastPrice.adjustedClose}`);
    
    return lastPrice.adjustedClose;
  }
  
  /**
   * Determina se deve rebalancear baseado na frequência (versão adaptativa)
   */
  private shouldRebalanceAdaptive(monthIndex: number, frequency: string): boolean {
    switch (frequency) {
      case 'monthly':
        return true;
      case 'quarterly':
        return monthIndex % 3 === 0;
      case 'yearly':
        return monthIndex % 12 === 0;
      default:
        return true;
    }
  }
  
  /**
   * Calcula métricas básicas (método herdado da classe pai)
   */
  private calculateMetricsAdaptive(evolution: PortfolioSnapshot[], params: BacktestParams, pricesData?: Map<string, PricePoint[]>, monthlyHistory?: MonthlyPortfolioHistory[]) {
    // Implementação duplicada da classe pai para evitar conflitos de herança
    console.log('📊 Calculando métricas de performance...');

    if (evolution.length === 0) {
      throw new Error('Nenhum dado de evolução disponível');
    }

    const monthlyReturns = evolution.slice(1).map(snapshot => snapshot.monthlyReturn);
    const portfolioValues = evolution.map(snapshot => snapshot.value);
    
    const initialValue = evolution[0].value;
    const finalValue = evolution[evolution.length - 1].value;
    // Total investido = capital inicial + primeiro aporte + aportes dos demais meses
    const totalInvested = params.initialCapital + (evolution.length * params.monthlyContribution);
    
    // Retorno total
    const totalReturn = totalInvested > 0 ? (finalValue - totalInvested) / totalInvested : 0;
    
    // Retorno anualizado
    const months = evolution.length;
    const ratio = totalInvested > 0 ? finalValue / totalInvested : 1;
    const annualizedReturn = months > 0 ? Math.pow(ratio, 12 / months) - 1 : 0;
    
    // Volatilidade (desvio padrão dos retornos mensais, anualizada)
    const avgReturn = monthlyReturns.length > 0 ? 
      monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length : 0;
    const variance = monthlyReturns.length > 0 ? 
      monthlyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / monthlyReturns.length : 0;
    const volatility = variance >= 0 ? Math.sqrt(variance) * Math.sqrt(12) : 0; // Anualizada
    
    // Sharpe Ratio (assumindo taxa livre de risco de 10% ao ano)
    const riskFreeRate = 0.10;
    const excessReturn = annualizedReturn - riskFreeRate;
    const sharpeRatio = volatility > 0 && !isNaN(excessReturn) && isFinite(excessReturn) ? 
      excessReturn / volatility : null;
    
    // Drawdown máximo
    const maxDrawdown = this.calculateMaxDrawdownAdaptive(portfolioValues);
    
    // Consistência
    const positiveMonths = monthlyReturns.filter(r => r > 0).length;
    const negativeMonths = monthlyReturns.filter(r => r < 0).length;

    // Performance por ativo
    const assetPerformance = this.calculateAssetPerformanceAdaptive(evolution, params, pricesData, monthlyHistory);

    // Formatação dos retornos mensais
    const monthlyReturnsFormatted = evolution.slice(1).map((snapshot, index) => ({
      date: snapshot.date.toISOString().split('T')[0],
      return: snapshot.monthlyReturn,
      portfolioValue: snapshot.value,
      contribution: snapshot.contribution
    }));

    // Formatação da evolução da carteira
    const portfolioEvolutionFormatted = evolution.map(snapshot => ({
      date: snapshot.date.toISOString().split('T')[0],
      value: snapshot.value,
      holdings: Object.fromEntries(snapshot.holdings),
      monthlyReturn: snapshot.monthlyReturn
    }));

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      positiveMonths,
      negativeMonths,
      totalInvested,
      finalValue,
      monthlyReturns: monthlyReturnsFormatted,
      assetPerformance,
      portfolioEvolution: portfolioEvolutionFormatted
    };
  }
  
  private calculateMaxDrawdownAdaptive(values: number[]): number {
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
  
  private calculateAssetPerformanceAdaptive(
    evolution: PortfolioSnapshot[],
    params: BacktestParams,
    pricesData?: Map<string, PricePoint[]>,
    monthlyHistory?: MonthlyPortfolioHistory[]
  ): Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
  }> {
    const finalSnapshot = evolution[evolution.length - 1];
    const finalDate = finalSnapshot.date;
    
    // SOLUÇÃO: Usar for loop tradicional ao invés de map() para evitar closure bugs
    const results: Array<{
      ticker: string;
      allocation: number;
      finalValue: number;
      totalReturn: number;
      contribution: number;
    }> = [];
    
    for (let i = 0; i < params.assets.length; i++) {
      const asset = params.assets[i];
      const ticker = asset.ticker;
      const allocation = asset.allocation;
      
      // Obter quantidade de ações final
      const finalShares = finalSnapshot.holdings.get(ticker) || 0;
      
      // NOVA ABORDAGEM: Usar histórico mensal para calcular valor final correto
      let assetFinalValue = 0;
      let totalInvestedFromHistory = 0;
      
      // Somar todas as contribuições do histórico mensal para este ativo
      if (monthlyHistory) {
        for (const monthData of monthlyHistory) {
          for (const transaction of monthData.transactions) {
            if (transaction.ticker === ticker) {
              totalInvestedFromHistory += transaction.contribution;
            }
          }
        }
      }
      
      console.log(`📊 ${ticker}: Total investido (histórico) = R$ ${totalInvestedFromHistory.toFixed(2)}`);
      
      if (pricesData && finalShares > 0) {
        const assetPrices = pricesData.get(ticker) || [];
        console.log(`🔍 ${ticker}: Buscando preço para ${finalDate.toISOString().split('T')[0]}, ${assetPrices.length} preços disponíveis`);
        
        const finalPrice = this.getPriceForDateAdaptive(assetPrices, finalDate);
        console.log(`💰 ${ticker}: Preço encontrado = ${finalPrice}, Shares = ${finalShares}`);
        
        if (finalPrice && finalPrice > 0) {
          // Cálculo isolado em variável local
          const calculatedValue = finalShares * finalPrice;
          console.log(`🧮 ${ticker}: Cálculo = ${finalShares} × ${finalPrice} = ${calculatedValue}`);
          
          assetFinalValue = calculatedValue;
          console.log(`✅ ${ticker}: Valor final = ${assetFinalValue}`);
          console.log(`📈 ${ticker}: Retorno = (${assetFinalValue.toFixed(2)} - ${totalInvestedFromHistory.toFixed(2)}) / ${totalInvestedFromHistory.toFixed(2)} = ${((assetFinalValue - totalInvestedFromHistory) / totalInvestedFromHistory * 100).toFixed(2)}%`);
        } else {
          console.log(`❌ ${ticker}: Preço não encontrado, usando fallback`);
        }
      }
      
      // Fallback se não conseguiu calcular
      if (assetFinalValue === 0) {
        console.log(`🚨 ${ticker}: Entrando no fallback`);
      const totalShares = Array.from(finalSnapshot.holdings.values()).reduce((sum, shares) => sum + shares, 0);
        const fallbackValue = totalShares > 0 ? (finalShares / totalShares) * finalSnapshot.value : 0;
        console.log(`📊 ${ticker}: Fallback = ${fallbackValue}`);
        assetFinalValue = fallbackValue;
      }
      
      // Calcular contribuição total e retorno usando histórico real
      const totalContributed = totalInvestedFromHistory > 0 ? totalInvestedFromHistory : 
        (params.initialCapital * allocation) + (evolution.length * params.monthlyContribution * allocation);
      const totalReturn = totalContributed > 0 ? (assetFinalValue - totalContributed) / totalContributed : 0;
      
      // Adicionar resultado ao array
      results.push({
        ticker: ticker,
        allocation: allocation,
        finalValue: isFinite(assetFinalValue) ? assetFinalValue : 0,
        totalReturn: isFinite(totalReturn) ? totalReturn : 0,
        contribution: totalContributed
    });
      
      console.log(`🎯 ${ticker}: RESULTADO FINAL = ${assetFinalValue}`);
    }
    
    return results;
  }
}
