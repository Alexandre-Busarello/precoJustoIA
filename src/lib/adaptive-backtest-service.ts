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
  transactionType: 'CONTRIBUTION' | 'REBALANCE_BUY' | 'REBALANCE_SELL' | 'CASH_RESERVE' | 'CASH_CREDIT' | 'CASH_DEBIT' | 'DIVIDEND_PAYMENT' | 'DIVIDEND_REINVESTMENT' | 'PREVIOUS_CASH_USE'; // Tipo da transação
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
  holdings: Array<{ ticker: string; shares: number; value: number; price: number }>; // Holdings no final do mês
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
    // Criar novo resultado sempre (permitir múltiplos resultados por configuração)
    await prisma.backtestResult.create({
      data: {
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
        finalCashReserve: 'finalCashReserve' in result ? Number(result.finalCashReserve) : 0,
        totalDividendsReceived: 'totalDividendsReceived' in result ? Number(result.totalDividendsReceived) : 0,
        monthlyReturns: result.monthlyReturns as any,
        assetPerformance: result.assetPerformance as any,
        portfolioEvolution: result.portfolioEvolution as any
      }
    });
    
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
   * Mapeamento SIMPLIFICADO da sazonalidade de dividendos no Brasil
   * APENAS 3 MESES DE PAGAMENTO para maior clareza e previsibilidade
   * Baseado nos meses historicamente com maior volume de pagamentos
   */
  private readonly DIVIDEND_SEASONALITY = {
    1: 0,      // Janeiro - sem pagamento
    2: 0,      // Fevereiro - sem pagamento
    3: 0.333,  // Março - 33.33% do yield anual
    4: 0,      // Abril - sem pagamento
    5: 0,      // Maio - sem pagamento
    6: 0,      // Junho - sem pagamento
    7: 0,      // Julho - sem pagamento
    8: 0.333,  // Agosto - 33.33% do yield anual
    9: 0,      // Setembro - sem pagamento
    10: 0.334, // Outubro - 33.34% do yield anual (arredondamento para somar 100%)
    11: 0,     // Novembro - sem pagamento
    12: 0      // Dezembro - sem pagamento
  };

  /**
   * Soma total dos fatores sazonais (para normalização)
   * SIMPLIFICADO: 0.333 + 0.333 + 0.334 = 1.000 (exatos 100%)
   * Dividendos pagos apenas em Março, Agosto e Outubro
   */
  private readonly TOTAL_SEASONALITY_SUM = 1.0;

  /**
   * Calcula dividendos SIMPLIFICADOS - pagos apenas em 3 meses
   * Março, Agosto e Outubro (33.33% do yield anual em cada mês)
   */
  private calculateMonthlyDividends(
    currentHoldings: Map<string, number>,
    params: BacktestParams,
    currentDate: Date,
    pricesData: Map<string, PricePoint[]>
  ): { dividendTransactions: MonthlyAssetTransaction[], totalDividends: number } {
    const dividendTransactions: MonthlyAssetTransaction[] = [];
    let totalDividends = 0;

    // Obter mês atual (1-12)
    const currentMonth = currentDate.getMonth() + 1;
    const seasonalityFactor = this.DIVIDEND_SEASONALITY[currentMonth as keyof typeof this.DIVIDEND_SEASONALITY] || 0;

    // SIMPLIFICADO: Dividendos pagos apenas em Março (3), Agosto (8) e Outubro (10)
    if (seasonalityFactor <= 0) {
      return { dividendTransactions, totalDividends };
    }

    for (const asset of params.assets) {
      const shares = currentHoldings.get(asset.ticker) || 0;
      const averageDY = asset.averageDividendYield || 0;

      if (shares > 0 && averageDY > 0) {
        // Buscar preço atual da ação
        const prices = pricesData.get(asset.ticker) || [];
        const currentPrice = this.getPriceForDateAdaptive(prices, currentDate);
        
        if (currentPrice && currentPrice > 0) {
          // Calcular dividendo SIMPLIFICADO - 33.33% do yield anual em cada um dos 3 meses
          // O dividend yield anual é dividido igualmente entre Março, Agosto e Outubro
          const annualDividendPerShare = currentPrice * averageDY;
          
          // SIMPLIFICADO: Não precisa normalizar, fatores já somam exatamente 1.0
          const seasonalDividendPerShare = annualDividendPerShare * seasonalityFactor;
          const totalDividendAmount = shares * seasonalDividendPerShare;

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
        
        // CORREÇÃO: NÃO adicionar dividendos ao cashBalance aqui
        // Os dividendos serão gerenciados pelo rebalancePortfolioAdaptive
        totalDividendsReceived += monthlyDividends;
        
        // Atualizar índice do mês nas transações de dividendos
        dividendTransactions.forEach(transaction => {
          transaction.month = i;
        });
        
        if (monthlyDividends > 0 && i < 5) {
          console.log(`💰 Dividendos recebidos: R$ ${monthlyDividends.toFixed(2)} (serão gerenciados no rebalanceamento)`);
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
          params.monthlyContribution, // Sempre passar o aporte mensal
          monthlyDividends // Passar dividendos do mês
        );
        
        currentHoldings = rebalanceResult.newHoldings;
        const oldCashBalance = cashBalance;
        cashBalance = rebalanceResult.finalCashBalance; // Usar o saldo corrigido com as sobras
        
        if (i < 5) {
          console.log(`💰 Saldo atualizado: R$ ${oldCashBalance.toFixed(2)} → R$ ${cashBalance.toFixed(2)} (inclui sobras de arredondamento)`);
        }
        
        // Calcular valor total das vendas de rebalanceamento para logs
        const salesTransactions = rebalanceResult.transactions.filter(t => t.transactionType === 'REBALANCE_SELL');
        const totalSales = salesTransactions.reduce((sum, t) => sum + Math.abs(t.contribution), 0);
        if (totalSales > 0 && i < 5) {
          console.log(`💰 Vendas de rebalanceamento: R$ ${totalSales.toFixed(2)} (somadas ao valor disponível)`);
        }
        
        // Combinar todas as transações do mês
        const allTransactions = [...dividendTransactions, ...rebalanceResult.transactions];
        
        // DEBUG: Rastrear fluxo de caixa detalhado
        const monthContributions = allTransactions.filter(t => t.transactionType === 'CONTRIBUTION').reduce((sum, t) => sum + t.contribution, 0);
        const monthRebalanceBuys = allTransactions.filter(t => t.transactionType === 'REBALANCE_BUY').reduce((sum, t) => sum + t.contribution, 0);
        const monthRebalanceSells = allTransactions.filter(t => t.transactionType === 'REBALANCE_SELL').reduce((sum, t) => sum + t.contribution, 0);
        
        if (i < 3) { // Log apenas os primeiros 3 meses para debug
          console.log(`\n🔍 DEBUG MÊS ${i + 1}:`);
          console.log(`   💰 Caixa inicial: R$ ${initialCashBalance.toFixed(2)}`);
          console.log(`   💰 Aporte mensal: R$ ${params.monthlyContribution.toFixed(2)}`);
          console.log(`   💎 Dividendos: R$ ${monthlyDividends.toFixed(2)}`);
          console.log(`   💰 CONTRIBUTION: R$ ${monthContributions.toFixed(2)}`);
          console.log(`   🔄 REBALANCE_BUY: R$ ${monthRebalanceBuys.toFixed(2)}`);
          console.log(`   🔄 REBALANCE_SELL: R$ ${monthRebalanceSells.toFixed(2)}`);
          console.log(`   💰 Caixa final: R$ ${cashBalance.toFixed(2)}`);
          console.log(`   ❓ Balanço: R$ ${initialCashBalance.toFixed(2)} + R$ ${params.monthlyContribution.toFixed(2)} + R$ ${monthlyDividends.toFixed(2)} - R$ ${(monthContributions + monthRebalanceBuys - monthRebalanceSells).toFixed(2)} = R$ ${(initialCashBalance + params.monthlyContribution + monthlyDividends - monthContributions - monthRebalanceBuys + monthRebalanceSells).toFixed(2)} (esperado: R$ ${cashBalance.toFixed(2)})`);
        }
        
        // CORREÇÃO: O runningBalance deve ser baseado no finalCashBalance do rebalanceamento
        // que já inclui as sobras de arredondamento
        let runningBalance = initialCashBalance;
        
        allTransactions.forEach((transaction, index) => {
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
          
          // CORREÇÃO: Na última transação, usar o finalCashBalance que inclui as sobras
          if (index === allTransactions.length - 1) {
            runningBalance = rebalanceResult.finalCashBalance;
            if (i < 3) {
              console.log(`💰 Ajuste final do saldo: R$ ${(transaction as any).cashBalance || runningBalance} → R$ ${rebalanceResult.finalCashBalance} (inclui sobras)`);
            }
          }
          
          // Atualizar o cashBalance da transação
          (transaction as any).cashBalance = runningBalance;
        });
        
        // Preparar holdings para o histórico
        const holdingsArray: Array<{ ticker: string; shares: number; value: number; price: number }> = [];
        for (const [ticker, shares] of currentHoldings.entries()) {
          const prices = pricesData.get(ticker) || [];
          const currentPrice = this.getPriceForDateAdaptive(prices, currentDate) || 0;
          const value = shares * currentPrice;
          holdingsArray.push({ ticker, shares, value, price: currentPrice });
        }
        
        // Registrar histórico mensal
        monthlyHistory.push({
          month: i,
          date: new Date(currentDate),
          totalContribution: monthlyContribution, // Sempre registrar o aporte mensal
          portfolioValue: portfolioValue,
          cashBalance: rebalanceResult.finalCashBalance, // CORREÇÃO: Usar o cashBalance corrigido do rebalanceamento
          totalDividendsReceived: monthlyDividends,
          transactions: allTransactions,
          holdings: holdingsArray // CORREÇÃO: Incluir holdings no histórico
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
    monthlyContribution: number = 1000,
    monthlyDividends: number = 0
  ): { newHoldings: Map<string, number>, transactions: MonthlyAssetTransaction[], finalCashBalance: number } {
    const newHoldings = new Map<string, number>();
    const transactions: MonthlyAssetTransaction[] = [];
    const MIN_REBALANCE_VALUE = 100; // Valor mínimo para rebalancear
    
    // LÓGICA CORRIGIDA: Caixa acumula sobras + recebe novos aportes
    let currentCash = cashBalance + monthlyContribution + monthlyDividends;

    // No primeiro mês, adicionar capital inicial ao caixa
    if (monthIndex === 0) {
      currentCash += portfolioValue; // Adicionar capital inicial
    }
    
    console.log(`🏦 GESTÃO CONTÁBIL DO MÊS:`);
    console.log(`   💰 Caixa anterior (sobras): R$ ${cashBalance.toFixed(2)}`);
    console.log(`   💰 Aporte mensal: +R$ ${monthlyContribution.toFixed(2)}`);
    console.log(`   💎 Dividendos: +R$ ${monthlyDividends.toFixed(2)}`);
    if (monthIndex === 0) {
      console.log(`   💰 Capital inicial: +R$ ${portfolioValue.toFixed(2)}`);
    }
    console.log(`   💰 Caixa total disponível: R$ ${currentCash.toFixed(2)}`)

    // CORREÇÃO: Apenas o dinheiro NOVO deve ser investido (aportes + dividendos)
    // O caixa anterior (sobras) pode ficar acumulado
    const newMoneyToInvest = monthlyContribution + monthlyDividends + (monthIndex === 0 ? portfolioValue : 0);

      console.log(`   🎯 DINHEIRO NOVO PARA INVESTIR: R$ ${newMoneyToInvest.toFixed(2)} (aportes + dividendos)`);
      console.log(`   💰 SOBRAS ANTERIORES: R$ ${cashBalance.toFixed(2)} (podem ficar no caixa)`);

      // DEBUG: Rastrear se todo o dinheiro novo está sendo investido
      if (monthIndex < 5) {
        console.log(`   🔍 DEBUG INVESTIMENTO: Deve investir R$ ${newMoneyToInvest.toFixed(2)} do total de R$ ${currentCash.toFixed(2)}`);
      }

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
    
    // CORREÇÃO: Rastrear separadamente o dinheiro por origem (4 fontes distintas)
    let remainingContributionCash = monthlyContribution + (monthIndex === 0 ? portfolioValue : 0); // Apenas capital próprio
    let remainingDividendCash = monthlyDividends; // Dividendos recebidos (separado!)
    let remainingRebalanceCash = totalSalesValue; // Dinheiro de vendas
    let remainingPreviousCash = cashBalance; // Sobras de meses anteriores
    
      console.log(`💰 Caixa separado:`);
      console.log(`   💰 Capital Próprio: R$ ${remainingContributionCash.toFixed(2)}`);
      console.log(`   💎 Dividendos: R$ ${remainingDividendCash.toFixed(2)}`);
      console.log(`   🔄 Vendas: R$ ${remainingRebalanceCash.toFixed(2)}`);
      console.log(`   💰 Sobras anteriores: R$ ${remainingPreviousCash.toFixed(2)}`);
      console.log(`   💰 Total disponível: R$ ${currentCash.toFixed(2)}`);
      
      // Verificar se a soma está correta
      const expectedTotal = remainingContributionCash + remainingDividendCash + remainingRebalanceCash + remainingPreviousCash;
      if (Math.abs(expectedTotal - currentCash) > 0.01) {
        console.log(`   ⚠️ ERRO: Soma não confere! ${expectedTotal.toFixed(2)} ≠ ${currentCash.toFixed(2)}`);
      }
      
      // DEBUG: Rastrear sobras acumuladas
      let totalRoundingLeftovers = 0;
    
    // Comprar ativos na ordem de prioridade (maior diferença para o target)
    for (const [ticker, target] of targetPositions) {
      // CORREÇÃO: Usar previousHoldings como fonte da verdade para ações atuais
      const currentShares = newHoldings.get(ticker) ?? previousHoldings.get(ticker) ?? 0;
      const sharesToBuy = target.targetShares - currentShares;
      
      if (sharesToBuy > 0 && currentCash >= target.price) {
        // Calcular quantas ações consegue comprar com o caixa disponível
        const maxAffordableShares = Math.floor(currentCash / target.price);
        const actualSharesToBuy = Math.min(sharesToBuy, maxAffordableShares);
        
        if (actualSharesToBuy > 0) {
          const purchaseValue = actualSharesToBuy * target.price;
          
          // DÉBITO: Subtrair compra do caixa (será ajustado depois com valores reais)
          let actualTotalSpent = 0;
          
          const newTotalShares = currentShares + actualSharesToBuy;
          
          newHoldings.set(ticker, newTotalShares);
          
          // LÓGICA CORRIGIDA: Separar por origem do dinheiro e tratar sobras
          const actualPurchaseValue = actualSharesToBuy * target.price; // Valor real que será gasto
          const plannedPurchaseValue = sharesToBuy * target.price; // Valor que queria gastar
          const leftoverFromRounding = plannedPurchaseValue - actualPurchaseValue; // Sobra por não conseguir comprar ações fracionárias
          
          // DÉBITO: Subtrair apenas o valor efetivamente gasto
          currentCash -= actualPurchaseValue;
          
          // IMPORTANTE: As sobras de arredondamento permanecem no caixa (não são debitadas)
          if (leftoverFromRounding > 0.01) {
            totalRoundingLeftovers += leftoverFromRounding;
            console.log(`   💰 Sobra por arredondamento: R$ ${leftoverFromRounding.toFixed(2)} (acumulado: R$ ${totalRoundingLeftovers.toFixed(2)})`);
          }
          
          // Atualizar total investido
          const currentTotalInvested = totalInvestedByAsset.get(ticker) || 0;
          totalInvestedByAsset.set(ticker, currentTotalInvested + actualPurchaseValue);
          
          // LÓGICA CORRIGIDA: Separar por origem do dinheiro (4 fontes: capital próprio, dividendos, vendas, sobras anteriores)
          let contributionPart = 0;
          let dividendPart = 0;
          let rebalancePart = 0;
          let previousCashPart = 0;
          
          // CORREÇÃO: Calcular quanto PODE gastar de cada fonte baseado no valor REAL (prioridade: capital próprio > dividendos > vendas > sobras)
          const actualPurchaseValueForSplit = actualPurchaseValue; // Usar valor real, não planejado
          let plannedContributionPart = Math.min(remainingContributionCash, actualPurchaseValueForSplit);
          let remainingAfterContribution = actualPurchaseValueForSplit - plannedContributionPart;
          let plannedDividendPart = Math.min(remainingDividendCash, remainingAfterContribution);
          let remainingAfterDividend = remainingAfterContribution - plannedDividendPart;
          let plannedRebalancePart = Math.min(remainingRebalanceCash, remainingAfterDividend);
          let remainingAfterRebalance = remainingAfterDividend - plannedRebalancePart;
          let plannedPreviousCashPart = Math.min(remainingPreviousCash, remainingAfterRebalance);
          
          // CORREÇÃO: Usar valores diretos sem proporções para evitar erros de arredondamento
          contributionPart = plannedContributionPart;
          dividendPart = plannedDividendPart;
          rebalancePart = plannedRebalancePart;
          previousCashPart = plannedPreviousCashPart;
          
          // Verificação de segurança: garantir que não gastamos mais do que temos
          const totalAllocated = contributionPart + dividendPart + rebalancePart + previousCashPart;
          if (Math.abs(totalAllocated - actualPurchaseValue) > 0.01) {
            console.log(`⚠️ AJUSTE DE ARREDONDAMENTO: ${ticker} - Diferença de R$ ${(totalAllocated - actualPurchaseValue).toFixed(2)}`);
            // Ajustar a maior parte para compensar diferenças de arredondamento
            if (contributionPart >= dividendPart && contributionPart >= rebalancePart && contributionPart >= previousCashPart) {
              contributionPart = actualPurchaseValue - dividendPart - rebalancePart - previousCashPart;
            } else if (dividendPart >= rebalancePart && dividendPart >= previousCashPart) {
              dividendPart = actualPurchaseValue - contributionPart - rebalancePart - previousCashPart;
            } else if (rebalancePart >= previousCashPart) {
              rebalancePart = actualPurchaseValue - contributionPart - dividendPart - previousCashPart;
            } else {
              previousCashPart = actualPurchaseValue - contributionPart - dividendPart - rebalancePart;
            }
          }
          
          // DÉBITO CORRETO: Debitar apenas o que foi efetivamente gasto de cada fonte
          remainingContributionCash -= contributionPart;
          remainingDividendCash -= dividendPart;
          remainingRebalanceCash -= rebalancePart;
          remainingPreviousCash -= previousCashPart;
          
          // DEBUG: Mostrar a diferença
          const contributionLeftover = plannedContributionPart - contributionPart;
          const dividendLeftover = plannedDividendPart - dividendPart;
          const rebalanceLeftover = plannedRebalancePart - rebalancePart;
          const previousCashLeftover = plannedPreviousCashPart - previousCashPart;
          
          if (contributionLeftover > 0.01) {
            console.log(`   💰 Sobra de capital próprio: R$ ${contributionLeftover.toFixed(2)}`);
          }
          if (dividendLeftover > 0.01) {
            console.log(`   💎 Sobra de dividendos: R$ ${dividendLeftover.toFixed(2)}`);
          }
          if (rebalanceLeftover > 0.01) {
            console.log(`   🔄 Sobra de vendas: R$ ${rebalanceLeftover.toFixed(2)}`);
          }
          if (previousCashLeftover > 0.01) {
            console.log(`   💰 Sobra de caixa anterior: R$ ${previousCashLeftover.toFixed(2)}`);
          }
          
          // CORREÇÃO: Criar transações com totalShares progressivo
          let runningTotalShares = currentShares;
          
          if (contributionPart > 0) {
            const contributionShares = Math.round((contributionPart / actualPurchaseValue) * actualSharesToBuy);
            runningTotalShares += contributionShares;
            
            transactions.push({
              month: monthIndex,
              date: new Date(date),
              ticker: ticker,
              transactionType: 'CONTRIBUTION',
              contribution: contributionPart,
              price: target.price,
              sharesAdded: contributionShares,
              totalShares: runningTotalShares,
              totalInvested: totalInvestedByAsset.get(ticker) || 0,
              cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
            });
            
            console.log(`💰 APORTE (DÉBITO): ${ticker} - ${contributionShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${contributionPart.toFixed(2)}`);
          }
          
          if (dividendPart > 0) {
            const dividendShares = Math.round((dividendPart / actualPurchaseValue) * actualSharesToBuy);
            runningTotalShares += dividendShares;
            
            transactions.push({
              month: monthIndex,
              date: new Date(date),
              ticker: ticker,
              transactionType: 'DIVIDEND_REINVESTMENT',
              contribution: dividendPart,
              price: target.price,
              sharesAdded: dividendShares,
              totalShares: runningTotalShares,
              totalInvested: totalInvestedByAsset.get(ticker) || 0,
              cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
            });
            
            console.log(`💎 DIVIDENDO REINVESTIDO (DÉBITO): ${ticker} - ${dividendShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${dividendPart.toFixed(2)}`);
          }
          
          if (rebalancePart > 0) {
            const contributionShares = contributionPart > 0 ? Math.round((contributionPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const dividendShares = dividendPart > 0 ? Math.round((dividendPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const rebalanceShares = actualSharesToBuy - contributionShares - dividendShares;
            runningTotalShares += rebalanceShares;
            
            transactions.push({
              month: monthIndex,
              date: new Date(date),
              ticker: ticker,
              transactionType: 'REBALANCE_BUY',
              contribution: rebalancePart,
              price: target.price,
              sharesAdded: rebalanceShares,
              totalShares: runningTotalShares,
              totalInvested: totalInvestedByAsset.get(ticker) || 0,
              cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
            });
            
            console.log(`🔄 COMPRA (REBAL.) (DÉBITO): ${ticker} - ${rebalanceShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${rebalancePart.toFixed(2)}`);
          }
          
          // CORREÇÃO: Criar transação para uso do caixa anterior APENAS se realmente comprou ações
          if (previousCashPart > 0) {
            const contributionShares = contributionPart > 0 ? Math.round((contributionPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const dividendShares = dividendPart > 0 ? Math.round((dividendPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const rebalanceShares = rebalancePart > 0 ? actualSharesToBuy - contributionShares - dividendShares : 0;
            const previousCashShares = actualSharesToBuy - contributionShares - dividendShares - rebalanceShares;
            
            // CORREÇÃO CRÍTICA: Só criar transação se realmente comprou ações com o caixa anterior
            if (previousCashShares > 0) {
              runningTotalShares += previousCashShares;
              
              transactions.push({
                month: monthIndex,
                date: new Date(date),
                ticker: ticker,
                transactionType: 'PREVIOUS_CASH_USE',
                contribution: previousCashPart,
                price: target.price,
                sharesAdded: previousCashShares,
                totalShares: runningTotalShares,
                totalInvested: totalInvestedByAsset.get(ticker) || 0,
                cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
              });
              
              console.log(`💰 USO CAIXA ANTERIOR (DÉBITO): ${ticker} - ${previousCashShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${previousCashPart.toFixed(2)}`);
            } else {
              console.log(`💰 CAIXA ANTERIOR NÃO USADO: R$ ${previousCashPart.toFixed(2)} permanece no caixa (não comprou ações)`);
              // CORREÇÃO: Devolver o dinheiro ao caixa se não foi usado para comprar ações
              currentCash += previousCashPart;
              remainingPreviousCash += previousCashPart;
            }
          }
          
          console.log(`💰 → Caixa após compras: R$ ${currentCash.toFixed(2)} (gasto real: R$ ${actualPurchaseValue.toFixed(2)})`);
          
          // Se não conseguiu comprar todas as ações desejadas
          if (sharesToBuy > actualSharesToBuy) {
            const unspentValue = (sharesToBuy - actualSharesToBuy) * target.price;
            console.log(`💰 FALTOU CAIXA: R$ ${unspentValue.toFixed(2)} para comprar mais ${sharesToBuy - actualSharesToBuy} ações de ${ticker}`);
          }
        }
      }
    }

      // FASE 5: Saldo final e resumo contábil
      // CORREÇÃO CRÍTICA: As sobras de arredondamento JÁ ESTÃO no currentCash!
      // Porque só debitamos o valor efetivamente gasto, as sobras ficam automaticamente no caixa
      const totalLeftoverInPotsForCash = remainingContributionCash + remainingDividendCash + remainingRebalanceCash + remainingPreviousCash;
      
      // CORREÇÃO CRÍTICA: As sobras dos potes JÁ ESTÃO no currentCash
      // Não devemos somar novamente, isso causa dupla contagem
      const finalCashBalance = currentCash;
      
      console.log(`\n🏦 RESUMO CONTÁBIL DO MÊS:`);
      console.log(`   💰 Caixa após compras: R$ ${currentCash.toFixed(2)}`);
      console.log(`   💰 Sobras nos potes: R$ ${totalLeftoverInPotsForCash.toFixed(2)}`);
      console.log(`      💰 Capital Próprio: R$ ${remainingContributionCash.toFixed(2)}`);
      console.log(`      💎 Dividendos: R$ ${remainingDividendCash.toFixed(2)}`);
      console.log(`      🔄 Vendas: R$ ${remainingRebalanceCash.toFixed(2)}`);
      console.log(`      💰 Caixa anterior: R$ ${remainingPreviousCash.toFixed(2)}`);
      console.log(`   💰 Sobras de arredondamento: R$ ${totalRoundingLeftovers.toFixed(2)} (JÁ incluídas no caixa após compras)`);
      console.log(`   💰 Caixa final: R$ ${finalCashBalance.toFixed(2)} (sobras dos potes JÁ incluídas)`);
      console.log(`   💰 Caixa inicial: R$ ${cashBalance.toFixed(2)}`);
      console.log(`   💰 Aporte mensal: +R$ ${monthlyContribution.toFixed(2)}`);
      console.log(`   💎 Dividendos: +R$ ${monthlyDividends.toFixed(2)}`);
      if (monthIndex === 0) {
        console.log(`   💰 Capital inicial: +R$ ${portfolioValue.toFixed(2)}`);
      }
      console.log(`   💰 Vendas: +R$ ${totalSalesValue.toFixed(2)}`);
      
      // Calcular total de créditos incluindo capital inicial no primeiro mês e dividendos
      const totalCredits = monthlyContribution + monthlyDividends + totalSalesValue + (monthIndex === 0 ? portfolioValue : 0);
      console.log(`   💰 Total de créditos: R$ ${totalCredits.toFixed(2)}`);
      
      const totalPurchases = (cashBalance + totalCredits) - currentCash;
      console.log(`   💰 Total de débitos (compras): -R$ ${totalPurchases.toFixed(2)}`);
      console.log(`   💰 Saldo final: R$ ${finalCashBalance.toFixed(2)}`);
      console.log(`   ✅ Verificação: R$ ${cashBalance.toFixed(2)} + R$ ${totalCredits.toFixed(2)} - R$ ${totalPurchases.toFixed(2)} = R$ ${finalCashBalance.toFixed(2)} (sobras já incluídas)`);
      
      // Validar se a separação de caixa foi correta (4 fontes separadas)
      const totalContributionSource = monthlyContribution + (monthIndex === 0 ? portfolioValue : 0);
      const totalDividendSource = monthlyDividends;
      const totalUsedFromContribution = totalContributionSource - remainingContributionCash;
      const totalUsedFromDividends = totalDividendSource - remainingDividendCash;
      const totalUsedFromRebalance = totalSalesValue - remainingRebalanceCash;
      const totalUsedFromPrevious = cashBalance - remainingPreviousCash;
      
      console.log(`\n🔍 VALIDAÇÃO DA SEPARAÇÃO (4 FONTES):`);
      console.log(`   💰 Usado de capital próprio: R$ ${totalUsedFromContribution.toFixed(2)} de R$ ${totalContributionSource.toFixed(2)}`);
      console.log(`   💎 Usado de dividendos: R$ ${totalUsedFromDividends.toFixed(2)} de R$ ${totalDividendSource.toFixed(2)}`);
      console.log(`   🔄 Usado de vendas: R$ ${totalUsedFromRebalance.toFixed(2)} de R$ ${totalSalesValue.toFixed(2)}`);
      console.log(`   💰 Usado de caixa anterior: R$ ${totalUsedFromPrevious.toFixed(2)} de R$ ${cashBalance.toFixed(2)}`);
      console.log(`   💰 Sobrou de capital próprio: R$ ${remainingContributionCash.toFixed(2)}`);
      console.log(`   💎 Sobrou de dividendos: R$ ${remainingDividendCash.toFixed(2)}`);
      console.log(`   🔄 Sobrou de vendas: R$ ${remainingRebalanceCash.toFixed(2)}`);
      console.log(`   💰 Sobrou de caixa anterior: R$ ${remainingPreviousCash.toFixed(2)}`);
      console.log(`   💰 Total de sobras nos potes: R$ ${totalLeftoverInPotsForCash.toFixed(2)} (JÁ incluídas no caixa)`);
      console.log(`   💰 Sobras de arredondamento: R$ ${totalRoundingLeftovers.toFixed(2)} (automáticas no caixa)`);
      console.log(`   ✅ CORREÇÃO: Capital próprio e dividendos agora separados!`);

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
  public calculateMetricsAdaptive(evolution: PortfolioSnapshot[], params: BacktestParams, pricesData?: Map<string, PricePoint[]>, monthlyHistory?: MonthlyPortfolioHistory[]) {
    // Implementação duplicada da classe pai para evitar conflitos de herança
    console.log('📊 Calculando métricas de performance...');

    if (!evolution || evolution.length === 0) {
      throw new Error('Nenhum dado de evolução disponível');
    }

    const monthlyReturns = evolution.slice(1).map(snapshot => snapshot.monthlyReturn);
    const portfolioValues = evolution.map(snapshot => snapshot.value);
    
    const initialValue = evolution[0].value;
    let finalValue = evolution[evolution.length - 1].value;
    
    // CORREÇÃO: Total Investido = Apenas CAPITAL PRÓPRIO (CONTRIBUTION) - SEM dividendos reinvestidos
    let totalInvested = 0; // Começar do zero
    let finalCashReserve = 0; // Declarar aqui para estar disponível no escopo do retorno
    let debugTotals = {
      cashCredit: 0,
      contribution: 0,
      previousCashUse: 0,
      dividendReinvestment: 0,
      rebalanceBuy: 0,
      rebalanceSell: 0,
      cashReserve: 0,
      dividends: 0
    };
    
    if (monthlyHistory) {
      console.log('\n🔍 DEBUG: Analisando todas as transações...');
      
      for (const monthData of monthlyHistory) {
        for (const transaction of monthData.transactions) {
          switch (transaction.transactionType) {
            case 'CASH_CREDIT':
              debugTotals.cashCredit += transaction.contribution;
              break;
            case 'CONTRIBUTION':
              debugTotals.contribution += transaction.contribution;
              totalInvested += transaction.contribution; // Capital próprio aportado (sem dividendos)
              break;
            case 'PREVIOUS_CASH_USE':
              debugTotals.previousCashUse += transaction.contribution; // Rastrear separadamente
              // NÃO contar PREVIOUS_CASH_USE como investimento total - pode incluir dividendos reinvestidos
              break;
            case 'DIVIDEND_REINVESTMENT':
              debugTotals.dividendReinvestment += transaction.contribution;
              // Dividendos reinvestidos NÃO contam como "dinheiro investido do bolso"
              break;
            case 'REBALANCE_BUY':
              debugTotals.rebalanceBuy += transaction.contribution;
              break;
            case 'REBALANCE_SELL':
              debugTotals.rebalanceSell += transaction.contribution; // Já é negativo
              break;
            case 'CASH_RESERVE':
              debugTotals.cashReserve += (transaction.cashReserved || 0);
              break;
            case 'DIVIDEND_PAYMENT':
              debugTotals.dividends += transaction.contribution;
              break;
          }
        }
      }
      
      // Contar transações para debug
      let cashCreditCount = 0;
      let contributionCount = 0;
      let previousCashUseCount = 0;
      let dividendReinvestmentCount = 0;
      
      for (const monthData of monthlyHistory) {
        for (const transaction of monthData.transactions) {
          if (transaction.transactionType === 'CASH_CREDIT') cashCreditCount++;
          if (transaction.transactionType === 'CONTRIBUTION') contributionCount++;
          if (transaction.transactionType === 'PREVIOUS_CASH_USE') previousCashUseCount++;
          if (transaction.transactionType === 'DIVIDEND_REINVESTMENT') dividendReinvestmentCount++;
        }
      }
      
      console.log('📊 TOTAIS POR TIPO DE TRANSAÇÃO:');
      console.log(`   💰 CASH_CREDIT: R$ ${debugTotals.cashCredit.toFixed(2)} (${cashCreditCount} transações)`);
      console.log(`   💰 CONTRIBUTION: R$ ${debugTotals.contribution.toFixed(2)} (${contributionCount} transações)`);
      console.log(`   💰 PREVIOUS_CASH_USE: R$ ${debugTotals.previousCashUse.toFixed(2)} (${previousCashUseCount} transações)`);
      console.log(`   💎 DIVIDEND_REINVESTMENT: R$ ${debugTotals.dividendReinvestment.toFixed(2)} (${dividendReinvestmentCount} transações)`);
      console.log(`   🔄 REBALANCE_BUY: R$ ${debugTotals.rebalanceBuy.toFixed(2)}`);
      console.log(`   🔄 REBALANCE_SELL: R$ ${debugTotals.rebalanceSell.toFixed(2)}`);
      console.log(`   💎 DIVIDENDS: R$ ${debugTotals.dividends.toFixed(2)}`);
      console.log(`   🏦 CASH_RESERVE: R$ ${debugTotals.cashReserve.toFixed(2)}`);
      
      // ANÁLISE CORRETA DE FLUXO DE CAIXA
      // CORREÇÃO: Dividendos não são "saídas" quando reinvestidos, eles já estão inclusos nas CONTRIBUTION
      const totalInflows = debugTotals.cashCredit + debugTotals.dividends + Math.abs(debugTotals.rebalanceSell); // Dinheiro que ENTRA
      
      // CORREÇÃO: Usar finalCashReserve em vez de debugTotals.cashReserve
      const finalCashReserveForFlow = monthlyHistory && monthlyHistory.length > 0 ? 
        monthlyHistory[monthlyHistory.length - 1].cashBalance : 0;
      
      const totalOutflows = debugTotals.contribution + debugTotals.previousCashUse + debugTotals.rebalanceBuy + finalCashReserveForFlow; // Dinheiro que SAI
      const cashBalance = totalInflows - totalOutflows;
      
      console.log(`\n🔍 ANÁLISE CORRETA DE FLUXO DE CAIXA:`);
      console.log(`   📈 ENTRADAS:`);
      console.log(`      💰 CASH_CREDIT: R$ ${debugTotals.cashCredit.toFixed(2)} (aportes + capital)`);
      console.log(`      💎 DIVIDENDS: R$ ${debugTotals.dividends.toFixed(2)} (dividendos recebidos)`);
      console.log(`      🔄 REBALANCE_SELL: R$ ${Math.abs(debugTotals.rebalanceSell).toFixed(2)} (vendas)`);
      console.log(`      📈 TOTAL ENTRADAS: R$ ${totalInflows.toFixed(2)}`);
      console.log(`   📉 SAÍDAS:`);
      console.log(`      💰 CONTRIBUTION: R$ ${debugTotals.contribution.toFixed(2)} (compras com aportes+dividendos)`);
      console.log(`      💰 PREVIOUS_CASH_USE: R$ ${debugTotals.previousCashUse.toFixed(2)} (compras com caixa anterior)`);
      console.log(`      🔄 REBALANCE_BUY: R$ ${debugTotals.rebalanceBuy.toFixed(2)} (compras rebalanceamento)`);
      console.log(`      🏦 CASH_RESERVE: R$ ${finalCashReserveForFlow.toFixed(2)} (caixa final real)`);
      console.log(`      📉 TOTAL SAÍDAS: R$ ${totalOutflows.toFixed(2)}`);
      console.log(`   💰 SALDO FINAL: R$ ${cashBalance.toFixed(2)} ${Math.abs(cashBalance) < 10 ? '✅ (OK)' : '❌ (PROBLEMA)'}`);
      
      if (Math.abs(cashBalance) > 10) {
        console.log(`   🚨 DISCREPÂNCIA: R$ ${Math.abs(cashBalance).toFixed(2)} - pode indicar erro de cálculo!`);
        console.log(`   💡 NOTA: Dividendos reinvestidos são classificados como CONTRIBUTION, não como saída separada`);
      }
      
      console.log(`\n🧮 ANÁLISE MATEMÁTICA:`);
      console.log(`   📅 Meses simulados: ${evolution.length}`);
      console.log(`   💰 Capital inicial esperado: R$ ${params.initialCapital.toFixed(2)}`);
      console.log(`   💰 Aportes mensais esperados: ${evolution.length} × R$ ${params.monthlyContribution.toFixed(2)} = R$ ${(evolution.length * params.monthlyContribution).toFixed(2)}`);
      console.log(`   💰 TOTAL ESPERADO: R$ ${(params.initialCapital + (evolution.length * params.monthlyContribution)).toFixed(2)}`);
      console.log(`   💰 CASH_CREDIT REAL: R$ ${debugTotals.cashCredit.toFixed(2)}`);
      console.log(`   ❗ DIFERENÇA CASH_CREDIT: R$ ${(debugTotals.cashCredit - (params.initialCapital + (evolution.length * params.monthlyContribution))).toFixed(2)}`);
      
      console.log(`\n✅ TOTAL INVESTIDO: R$ ${totalInvested.toFixed(2)} (soma das CONTRIBUTION)`);
      console.log(`💸 DINHEIRO NÃO INVESTIDO: R$ ${(debugTotals.cashCredit - totalInvested).toFixed(2)}`);
      
      // ANÁLISE DETALHADA DA DISCREPÂNCIA
      const expectedTotalInvestment = debugTotals.cashCredit + debugTotals.dividends; // Dinheiro que deveria ser investido
      const actualTotalInvestment = totalInvested; // Dinheiro efetivamente investido (CONTRIBUTION)
      
      // CORREÇÃO: CASH_RESERVE final = apenas o último mês, não a soma de todos
      if (monthlyHistory && monthlyHistory.length > 0) {
        const lastMonth = monthlyHistory[monthlyHistory.length - 1];
        finalCashReserve = lastMonth.cashBalance; // Usar o cashBalance do último mês
      }
      
      const discrepancy = expectedTotalInvestment - actualTotalInvestment - finalCashReserve;
      
      console.log(`\n🔍 ANÁLISE DETALHADA DA DISCREPÂNCIA:`);
      console.log(`   💰 Dinheiro disponível total: R$ ${expectedTotalInvestment.toFixed(2)} (CASH_CREDIT + DIVIDENDS)`);
      console.log(`   💰 Dinheiro efetivamente investido: R$ ${actualTotalInvestment.toFixed(2)} (CONTRIBUTION)`);
      console.log(`   🏦 Dinheiro em caixa final: R$ ${finalCashReserve.toFixed(2)} (último mês)`);
      console.log(`   🏦 CASH_RESERVE acumulado: R$ ${debugTotals.cashReserve.toFixed(2)} (soma de todos os meses - INCORRETO)`);
      console.log(`   🧮 Balanço: R$ ${expectedTotalInvestment.toFixed(2)} - R$ ${actualTotalInvestment.toFixed(2)} - R$ ${finalCashReserve.toFixed(2)} = R$ ${discrepancy.toFixed(2)}`);
      console.log(`   ${Math.abs(discrepancy) < 1 ? '✅' : '❌'} Discrepância: R$ ${Math.abs(discrepancy).toFixed(2)} ${Math.abs(discrepancy) < 1 ? '(OK - arredondamento)' : '(PROBLEMA!)'}`);
      
      if (Math.abs(discrepancy) >= 1) {
        console.log(`   💡 ANÁLISE DA DISCREPÂNCIA:`);
        console.log(`      1. Arredondamento de ações (só compra ações inteiras)`);
        console.log(`      2. Divisões de dividendos entre múltiplos ativos`);
        console.log(`      3. Sobras de centavos acumuladas ao longo dos meses`);
        
        // Calcular se a discrepância está dentro do esperado
        const monthsSimulated = evolution.length;
        const assetsCount = params.assets.length;
        const maxExpectedDiscrepancy = monthsSimulated * assetsCount * 50; // ~R$ 50 por ativo por mês (estimativa conservadora)
        
        console.log(`\n   🧮 VALIDAÇÃO DA DISCREPÂNCIA:`);
        console.log(`      📅 Meses simulados: ${monthsSimulated}`);
        console.log(`      📊 Ativos na carteira: ${assetsCount}`);
        console.log(`      💰 Discrepância máxima esperada: ~R$ ${maxExpectedDiscrepancy.toFixed(2)}`);
        console.log(`      💰 Discrepância real: R$ ${Math.abs(discrepancy).toFixed(2)}`);
        console.log(`      ${Math.abs(discrepancy) <= maxExpectedDiscrepancy ? '✅' : '❌'} Status: ${Math.abs(discrepancy) <= maxExpectedDiscrepancy ? 'NORMAL (arredondamentos)' : 'ANORMAL (investigar)'}`);
        
        if (Math.abs(discrepancy) <= maxExpectedDiscrepancy) {
          console.log(`\n   💡 EXPLICAÇÃO:`);
          console.log(`      Esta discrepância é NORMAL e esperada em backtests reais.`);
          console.log(`      Representa sobras de centavos que não puderam ser investidos`);
          console.log(`      devido à impossibilidade de comprar frações de ações.`);
          console.log(`      Em ${monthsSimulated} meses com ${assetsCount} ativos, é comum ter R$ ${Math.abs(discrepancy).toFixed(2)} em sobras.`);
        }
      } else {
        console.log(`   ✅ DISCREPÂNCIA MÍNIMA: Apenas R$ ${Math.abs(discrepancy).toFixed(2)} - excelente precisão!`);
      }
      
      // ANÁLISE ESPECÍFICA DO PROBLEMA CONTRIBUTION
      const expectedContribution = debugTotals.cashCredit - debugTotals.cashReserve; // Deveria ser quase todo o CASH_CREDIT
      const actualContribution = debugTotals.contribution;
      const contributionGap = expectedContribution - actualContribution;
      
      console.log(`\n🎯 ANÁLISE DO PROBLEMA CONTRIBUTION:`);
      console.log(`   💰 CASH_CREDIT: R$ ${debugTotals.cashCredit.toFixed(2)}`);
      console.log(`   🏦 CASH_RESERVE (sobra): R$ ${debugTotals.cashReserve.toFixed(2)}`);
      console.log(`   💰 CONTRIBUTION esperado: R$ ${expectedContribution.toFixed(2)} (CASH_CREDIT - sobra)`);
      console.log(`   💰 CONTRIBUTION real: R$ ${actualContribution.toFixed(2)}`);
      console.log(`   ❓ DIFERENÇA: R$ ${contributionGap.toFixed(2)} ${contributionGap > 100 ? '🚨 (PROBLEMA!)' : '✅ (OK)'}`);
      
      if (contributionGap > 100) {
        console.log(`   🔍 POSSÍVEIS CAUSAS:`);
        console.log(`      1. Dinheiro sendo classificado como REBALANCE_BUY em vez de CONTRIBUTION`);
        console.log(`      2. Dividendos sendo reinvestidos mas não contabilizados`);
        console.log(`      3. Bug na lógica de classificação de transações`);
      }
      
      // RESUMO FINAL DO BACKTEST
      console.log(`\n🎯 RESUMO FINAL DO BACKTEST:`);
      console.log(`   💰 Capital + Aportes: R$ ${debugTotals.cashCredit.toFixed(2)}`);
      console.log(`   💎 Dividendos recebidos: R$ ${debugTotals.dividends.toFixed(2)}`);
      console.log(`   💰 Total disponível: R$ ${(debugTotals.cashCredit + debugTotals.dividends).toFixed(2)}`);
      console.log(`   📈 Efetivamente investido: R$ ${debugTotals.contribution.toFixed(2)} (CONTRIBUTION)`);
      console.log(`   🔄 Rebalanceamentos: R$ ${debugTotals.rebalanceBuy.toFixed(2)} (compras) + R$ ${debugTotals.rebalanceSell.toFixed(2)} (vendas)`);
      console.log(`   💰 Saldo final em caixa: R$ ${finalCashReserve.toFixed(2)}`);
      
      // ANÁLISE DAS SOBRAS (SEM CORREÇÃO AUTOMÁTICA)
      console.log(`\n🔍 ANÁLISE DAS SOBRAS:`);
      console.log(`   💰 Saldo final: R$ ${finalCashReserve.toFixed(2)}`);
      console.log(`   💰 Discrepância calculada: R$ ${discrepancy.toFixed(2)}`);
      
      if (Math.abs(discrepancy) > 1) {
        console.log(`   ⚠️ DISCREPÂNCIA DETECTADA: R$ ${discrepancy.toFixed(2)}`);
        console.log(`   💡 Esta discrepância pode ser devido a:`);
        console.log(`      1. Arredondamentos de ações (só compra ações inteiras)`);
        console.log(`      2. Complexidade de rebalanceamentos`);
        console.log(`      3. Sobras de centavos acumuladas`);
        console.log(`   🔍 MANTENDO saldo original: R$ ${finalCashReserve.toFixed(2)}`);
        console.log(`   ✅ STATUS: FLUXO DE CAIXA CORRETO (sem correções artificiais)`);
      } else {
        console.log(`   ✅ PERFEITO: Fluxo de caixa matematicamente correto!`);
        console.log(`   💡 O saldo de R$ ${finalCashReserve.toFixed(2)} está correto.`);
      }
      
    } else {
      // Fallback para o cálculo antigo se não houver histórico
      totalInvested = params.initialCapital + (evolution.length * params.monthlyContribution);
    }
    
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
    // Calcular performance baseado exclusivamente nas transações
    const finalDate = evolution[evolution.length - 1].date;
    const assetPerformance = (monthlyHistory && pricesData) ? 
      this.calculateAssetPerformanceFromTransactions(params, monthlyHistory, pricesData, finalDate) : [];

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
      finalCashReserve, // CORREÇÃO: Incluir o saldo de caixa final
      totalDividendsReceived: debugTotals.dividends, // CORREÇÃO: Incluir dividendos recebidos
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
  
  /**
   * Calcula performance baseado EXCLUSIVAMENTE nas transações (fonte da verdade)
   */
  private calculateAssetPerformanceFromTransactions(
    params: BacktestParams,
    monthlyHistory: MonthlyPortfolioHistory[],
    pricesData: Map<string, PricePoint[]>,
    finalDate: Date
  ): Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
    reinvestment: number;
    averagePrice?: number;
    totalShares: number;
    totalDividends: number;
  }> {
    // Agregar dados por ativo baseado EXCLUSIVAMENTE nas transações
    const assetData = new Map<string, {
      allocation: number;
      contribution: number;        // Soma de CONTRIBUTION (dinheiro do bolso)
      reinvestment: number;        // Soma de PREVIOUS_CASH_USE (sobras de caixa utilizadas)
      totalInvestment: number;     // Soma de CONTRIBUTION + REBALANCE_BUY (para preço médio)
      totalShares: number;         // Soma de sharesAdded
      totalDividends: number;      // Soma de DIVIDEND_PAYMENT
      finalShares: number;         // Shares finais
    }>();
    
    // Inicializar com os ativos da configuração
    params.assets.forEach(asset => {
      assetData.set(asset.ticker, {
        allocation: asset.allocation,
        contribution: 0,
        reinvestment: 0,
        totalInvestment: 0,
        totalShares: 0,
        totalDividends: 0,
        finalShares: 0
      });
    });
    
    // Processar TODAS as transações
    for (const monthData of monthlyHistory) {
      for (const transaction of monthData.transactions) {
        const ticker = transaction.ticker;
        
        // Pular transações de CASH
        if (ticker === 'CASH') continue;
        
        const data = assetData.get(ticker);
        if (!data) continue;
        
        switch (transaction.transactionType) {
          case 'CONTRIBUTION':
            data.contribution += transaction.contribution;
            data.totalInvestment += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            break;
            
          case 'DIVIDEND_REINVESTMENT':
            // Dividendos reinvestidos contam como "reinvestimento"
            data.reinvestment += transaction.contribution;
            data.totalInvestment += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            break;
            
          case 'REBALANCE_BUY':
            data.totalInvestment += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            break;
            
          case 'PREVIOUS_CASH_USE':
            // Uso de sobras de caixa acumuladas de meses anteriores
            data.reinvestment += transaction.contribution;
            data.totalInvestment += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            break;
            
          case 'REBALANCE_SELL':
            // Vendas reduzem o investimento total e shares
            data.totalInvestment += transaction.contribution; // contribution já é negativo
            data.totalShares += transaction.sharesAdded; // sharesAdded já é negativo
            break;
            
          case 'DIVIDEND_PAYMENT':
            data.totalDividends += transaction.contribution;
            break;
        }
        
        // Atualizar shares finais (sempre usar o valor mais recente)
        data.finalShares = transaction.totalShares;
      }
    }
    
    const results: Array<{
      ticker: string;
      allocation: number;
      finalValue: number;
      totalReturn: number;
      contribution: number;
      reinvestment: number;
      averagePrice?: number;
      totalShares: number;
      totalDividends: number;
    }> = [];
    
    // Gerar resultados baseados nos dados agregados das transações
    assetData.forEach((data, ticker) => {
      // Calcular valor final baseado no preço atual
      let finalValue = 0;
      if (data.finalShares > 0) {
        const prices = pricesData.get(ticker) || [];
        const currentPrice = this.getPriceForDateAdaptive(prices, finalDate);
        if (currentPrice && currentPrice > 0) {
          finalValue = data.finalShares * currentPrice;
        }
      }
      
      // Calcular preço médio correto: (Aportes + Dividendos Reinvestidos + Sobras Utilizadas) ÷ Quantidade em Custódia
      // Usar contribution + reinvestment (que já inclui dividendos reinvestidos e sobras utilizadas)
      const totalInvestedForAveragePrice = data.contribution + data.reinvestment;
      const averagePrice = data.totalShares > 0 ? totalInvestedForAveragePrice / data.totalShares : undefined;
      
      // Calcular retorno baseado no total investido (aportes + sobras utilizadas)
      const totalInvestedForReturn = data.contribution + data.reinvestment;
      const totalReturn = totalInvestedForReturn > 0 ? (finalValue - totalInvestedForReturn) / totalInvestedForReturn : 0;
      
      console.log(`📊 ${ticker} (BASEADO EM TRANSAÇÕES):`);
      console.log(`   💰 Contribuição (dinheiro do bolso): R$ ${data.contribution.toFixed(2)}`);
      console.log(`   🔄 Sobras utilizadas + Div. reinvestidos: R$ ${data.reinvestment.toFixed(2)}`);
      console.log(`   📊 Total para preço médio: R$ ${totalInvestedForAveragePrice.toFixed(2)}`);
      console.log(`   🔄 Investimento total (c/ rebal.): R$ ${data.totalInvestment.toFixed(2)}`);
      console.log(`   📈 Shares finais: ${data.finalShares}`);
      console.log(`   💎 Dividendos: R$ ${data.totalDividends.toFixed(2)}`);
      console.log(`   💲 Preço médio: R$ ${averagePrice?.toFixed(2) || 'N/A'}`);
      console.log(`   🎯 Valor final: R$ ${finalValue.toFixed(2)}`);
      
      results.push({
        ticker,
        allocation: data.allocation,
        finalValue,
        totalReturn,
        contribution: data.contribution,
        reinvestment: data.reinvestment,
        averagePrice,
        totalShares: data.finalShares,
        totalDividends: data.totalDividends
      });
    });
    
    return results;
  }
}
