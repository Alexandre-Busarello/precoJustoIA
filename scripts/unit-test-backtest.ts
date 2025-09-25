#!/usr/bin/env tsx

/**
 * TESTE UNITÁRIO COMPLETO DO BACKTEST
 * Validação mês a mês dos dividendos, DY e consistência matemática
 */

import { AdaptiveBacktestService, type BacktestParams } from '../src/lib/adaptive-backtest-service';

// Sazonalidade dos dividendos (mesma do serviço)
const DIVIDEND_SEASONALITY = {
  1: 0.04,  // Janeiro - 4%
  2: 0.02,  // Fevereiro - 2%
  3: 0.15,  // Março - 15%
  4: 0.06,  // Abril - 6%
  5: 0.08,  // Maio - 8%
  6: 0.12,  // Junho - 12%
  7: 0.10,  // Julho - 10%
  8: 0.20,  // Agosto - 20%
  9: 0.03,  // Setembro - 3%
  10: 0.18, // Outubro - 18%
  11: 0.02, // Novembro - 2%
  12: 0.07  // Dezembro - 7%
};

const TOTAL_SEASONALITY_SUM = 1.07; // Soma dos fatores

interface MonthlyValidation {
  month: number;
  date: string;
  petr4: {
    shares: number;
    price: number;
    expectedDividendPerShare: number;
    actualDividendPerShare: number;
    totalDividends: number;
    seasonalityFactor: number;
    normalizedFactor: number;
    error: number;
  };
  itsa4: {
    shares: number;
    price: number;
    expectedDividendPerShare: number;
    actualDividendPerShare: number;
    totalDividends: number;
    seasonalityFactor: number;
    normalizedFactor: number;
    error: number;
  };
  totalDividends: number;
  cashFlow: {
    initialCash: number;
    contribution: number;
    dividends: number;
    totalAvailable: number;
    invested: number;
    finalCash: number;
    isValid: boolean;
  };
}

async function runUnitTest() {
  console.log('🧪 INICIANDO TESTE UNITÁRIO COMPLETO DO BACKTEST');
  console.log('=' .repeat(80));
  
  // Parâmetros exatos da interface
  const params: BacktestParams = {
    assets: [
      { 
        ticker: 'PETR4', 
        allocation: 0.5, // 50%
        averageDividendYield: 0.10 // 10% DY
      },
      { 
        ticker: 'ITSA4', 
        allocation: 0.5, // 50%
        averageDividendYield: 0.0645 // 6,45% DY
      }
    ],
    startDate: new Date('2022-01-01T03:00:00.000Z'),
    endDate: new Date('2025-09-25T00:24:25.712Z'),
    initialCapital: 10000,
    monthlyContribution: 1000,
    rebalanceFrequency: 'monthly'
  };

  console.log('📊 Executando backtest...');
  const service = new AdaptiveBacktestService();
  const result = await service.runAdaptiveBacktest(params);

  console.log('✅ Backtest concluído. Iniciando validação mês a mês...\n');

  const validations: MonthlyValidation[] = [];
  let totalErrors = 0;
  let maxError = 0;
  let monthsWithDividends = 0;
  let totalExpectedDividends = 0;
  let totalActualDividends = 0;

  // Validar cada mês
  for (let i = 0; i < result.monthlyHistory.length; i++) {
    const monthData = result.monthlyHistory[i];
    const date = new Date(monthData.date);
    const month = date.getMonth() + 1; // 1-12
    
    // Buscar transações de dividendos do mês
    const dividendTransactions = monthData.transactions.filter(t => t.transactionType === 'DIVIDEND_PAYMENT');
    
    // Buscar holdings do mês anterior (ou inicial) para calcular dividendos
    let petr4Shares = 0;
    let itsa4Shares = 0;
    let petr4Price = 0;
    let itsa4Price = 0;
    
    // Buscar shares do mês anterior (antes das compras/vendas do mês atual)
    // Para dividendos, usamos as ações que possuíamos no FINAL do mês anterior
    if (i > 0) {
      const prevMonth = result.monthlyHistory[i - 1];
      if (prevMonth.holdings && Array.isArray(prevMonth.holdings)) {
        const petr4Holding = prevMonth.holdings.find(h => h.ticker === 'PETR4');
        const itsa4Holding = prevMonth.holdings.find(h => h.ticker === 'ITSA4');
        petr4Shares = petr4Holding?.shares || 0;
        itsa4Shares = itsa4Holding?.shares || 0;
      }
    } else {
      // No primeiro mês, não há ações anteriores, então não há dividendos
      petr4Shares = 0;
      itsa4Shares = 0;
    }
    
    // Obter preços das transações do mês atual
    for (const transaction of monthData.transactions) {
      if (transaction.ticker === 'PETR4' && transaction.price > 0) {
        petr4Price = transaction.price;
      } else if (transaction.ticker === 'ITSA4' && transaction.price > 0) {
        itsa4Price = transaction.price;
      }
    }
    
    // Se não encontrou preços nas transações, buscar nas holdings atuais
    if (monthData.holdings && Array.isArray(monthData.holdings)) {
      const petr4Holding = monthData.holdings.find(h => h.ticker === 'PETR4');
      const itsa4Holding = monthData.holdings.find(h => h.ticker === 'ITSA4');
      
      if (petr4Price === 0 && petr4Holding) petr4Price = petr4Holding.currentPrice || 0;
      if (itsa4Price === 0 && itsa4Holding) itsa4Price = itsa4Holding.currentPrice || 0;
    }
    
    // Calcular dividendos esperados
    const seasonalityFactor = DIVIDEND_SEASONALITY[month as keyof typeof DIVIDEND_SEASONALITY] || 0;
    const normalizedFactor = seasonalityFactor / TOTAL_SEASONALITY_SUM;
    
    // PETR4 - 10% DY
    const petr4AnnualDividendPerShare = petr4Price * 0.10;
    const petr4ExpectedDividendPerShare = petr4AnnualDividendPerShare * normalizedFactor;
    const petr4ExpectedTotalDividends = petr4ExpectedDividendPerShare * petr4Shares;
    
    // ITSA4 - 6,45% DY
    const itsa4AnnualDividendPerShare = itsa4Price * 0.0645;
    const itsa4ExpectedDividendPerShare = itsa4AnnualDividendPerShare * normalizedFactor;
    const itsa4ExpectedTotalDividends = itsa4ExpectedDividendPerShare * itsa4Shares;
    
    // Dividendos reais do mês
    let petr4ActualDividends = 0;
    let itsa4ActualDividends = 0;
    
    for (const transaction of dividendTransactions) {
      if (transaction.ticker === 'PETR4') {
        petr4ActualDividends += transaction.contribution;
      } else if (transaction.ticker === 'ITSA4') {
        itsa4ActualDividends += transaction.contribution;
      }
    }
    
    const petr4ActualDividendPerShare = petr4Shares > 0 ? petr4ActualDividends / petr4Shares : 0;
    const itsa4ActualDividendPerShare = itsa4Shares > 0 ? itsa4ActualDividends / itsa4Shares : 0;
    
    // Calcular erros
    const petr4Error = Math.abs(petr4ExpectedTotalDividends - petr4ActualDividends);
    const itsa4Error = Math.abs(itsa4ExpectedTotalDividends - itsa4ActualDividends);
    const totalError = petr4Error + itsa4Error;
    
    // Validação de fluxo de caixa - calcular baseado nas transações CASH_CREDIT e vendas
    let totalCashCredits = 0;
    let totalSales = 0;
    for (const transaction of monthData.transactions) {
      if (transaction.transactionType === 'CASH_CREDIT') {
        totalCashCredits += Math.abs(transaction.contribution);
      } else if (transaction.transactionType === 'REBALANCE_SELL') {
        totalSales += Math.abs(transaction.contribution);
      }
    }
    
    const initialCash = i === 0 ? 0 : result.monthlyHistory[i - 1].cashBalance; // No primeiro mês, tudo vem das transações CASH_CREDIT
    const monthDividends = petr4ActualDividends + itsa4ActualDividends;
    const totalAvailable = initialCash + totalCashCredits + monthDividends + totalSales;
    
    // Calcular total gasto no mês (apenas compras, vendas já estão no totalAvailable)
    let totalSpent = 0;
    for (const transaction of monthData.transactions) {
      if (transaction.transactionType === 'CONTRIBUTION' || transaction.transactionType === 'REBALANCE_BUY') {
        totalSpent += Math.abs(transaction.contribution);
      }
      // Não subtraímos vendas aqui pois elas já estão incluídas no totalAvailable
    }
    
    const finalCash = monthData.cashBalance;
    const discrepancy = totalAvailable - totalSpent - finalCash;
    const cashFlowValid = Math.abs(discrepancy) <= 1; // Tolerância de R$ 1 - vamos debugar corretamente
    
    const validation: MonthlyValidation = {
      month,
      date: date.toISOString().split('T')[0],
      petr4: {
        shares: petr4Shares,
        price: petr4Price,
        expectedDividendPerShare: petr4ExpectedDividendPerShare,
        actualDividendPerShare: petr4ActualDividendPerShare,
        totalDividends: petr4ActualDividends,
        seasonalityFactor,
        normalizedFactor,
        error: petr4Error
      },
      itsa4: {
        shares: itsa4Shares,
        price: itsa4Price,
        expectedDividendPerShare: itsa4ExpectedDividendPerShare,
        actualDividendPerShare: itsa4ActualDividendPerShare,
        totalDividends: itsa4ActualDividends,
        seasonalityFactor,
        normalizedFactor,
        error: itsa4Error
      },
      totalDividends: monthDividends,
      cashFlow: {
        initialCash,
        contribution: totalCashCredits,
        dividends: monthDividends,
        totalAvailable,
        invested: totalSpent,
        finalCash,
        isValid: cashFlowValid
      }
    };
    
    validations.push(validation);
    
    // Acumular estatísticas
    if (monthDividends > 0) {
      monthsWithDividends++;
    }
    
    totalErrors += totalError;
    maxError = Math.max(maxError, totalError);
    totalExpectedDividends += petr4ExpectedTotalDividends + itsa4ExpectedTotalDividends;
    totalActualDividends += monthDividends;
  }

  // Relatório detalhado
  console.log('📊 RELATÓRIO DE VALIDAÇÃO MÊS A MÊS');
  console.log('=' .repeat(80));
  
  let criticalErrors = 0;
  let warningErrors = 0;
  let cashFlowErrors = 0;
  
  for (const validation of validations) {
    const totalError = validation.petr4.error + validation.itsa4.error;
    const errorPercentage = validation.totalDividends > 0 ? (totalError / validation.totalDividends) * 100 : 0;
    
    let status = '✅';
    if (!validation.cashFlow.isValid) {
      status = '❌';
      cashFlowErrors++;
    } else if (errorPercentage > 10) {
      status = '🔴';
      criticalErrors++;
    } else if (errorPercentage > 5) {
      status = '🟡';
      warningErrors++;
    }
    
    console.log(`${status} ${validation.date} (Mês ${validation.month.toString().padStart(2, '0')})`);
    
    if (validation.totalDividends > 0) {
      console.log(`   💎 Dividendos: R$ ${validation.totalDividends.toFixed(2)} | Erro: R$ ${totalError.toFixed(2)} (${errorPercentage.toFixed(1)}%)`);
      console.log(`   📊 PETR4: ${validation.petr4.shares} ações × R$ ${validation.petr4.price.toFixed(2)} | DY: ${(validation.petr4.actualDividendPerShare / validation.petr4.price * 12 * 100).toFixed(2)}% anual`);
      console.log(`   📊 ITSA4: ${validation.itsa4.shares} ações × R$ ${validation.itsa4.price.toFixed(2)} | DY: ${(validation.itsa4.actualDividendPerShare / validation.itsa4.price * 12 * 100).toFixed(2)}% anual`);
    } else {
      console.log(`   💎 Sem dividendos (fator sazonal: ${(validation.petr4.normalizedFactor * 100).toFixed(1)}%)`);
    }
    
    if (!validation.cashFlow.isValid) {
      const discrepancy = validation.cashFlow.totalAvailable - validation.cashFlow.invested - validation.cashFlow.finalCash;
      console.log(`   ❌ ERRO FLUXO DE CAIXA: Disponível R$ ${validation.cashFlow.totalAvailable.toFixed(2)} ≠ Usado R$ ${(validation.cashFlow.invested + validation.cashFlow.finalCash).toFixed(2)} | Discrepância: R$ ${discrepancy.toFixed(2)}`);
    }
    
    console.log('');
  }

  // Resumo final
  console.log('📈 RESUMO DA VALIDAÇÃO');
  console.log('=' .repeat(80));
  console.log(`📅 Total de meses analisados: ${validations.length}`);
  console.log(`💎 Meses com dividendos: ${monthsWithDividends}`);
  console.log(`💰 Dividendos esperados: R$ ${totalExpectedDividends.toFixed(2)}`);
  console.log(`💰 Dividendos reais: R$ ${totalActualDividends.toFixed(2)}`);
  console.log(`❓ Diferença total: R$ ${Math.abs(totalExpectedDividends - totalActualDividends).toFixed(2)}`);
  console.log(`📊 Erro médio por mês: R$ ${(totalErrors / validations.length).toFixed(2)}`);
  console.log(`📊 Erro máximo: R$ ${maxError.toFixed(2)}`);
  console.log('');
  
  console.log('🚨 ERROS ENCONTRADOS:');
  console.log(`   ❌ Erros críticos (>10%): ${criticalErrors}`);
  console.log(`   🟡 Avisos (5-10%): ${warningErrors}`);
  console.log(`   💰 Erros de fluxo de caixa: ${cashFlowErrors}`);
  console.log('');
  
  // Validação do DY anual
  console.log('📊 VALIDAÇÃO DO DIVIDEND YIELD ANUAL');
  console.log('=' .repeat(80));
  
  const petr4TotalDividends = validations.reduce((sum, v) => sum + v.petr4.totalDividends, 0);
  const itsa4TotalDividends = validations.reduce((sum, v) => sum + v.itsa4.totalDividends, 0);
  
  // Calcular DY efetivo baseado no valor médio das posições (método correto)
  // DY = Dividendos Anuais / Valor Médio da Posição
  
  let petr4TotalValue = 0;
  let itsa4TotalValue = 0;
  let monthsWithHoldings = 0;
  
  for (const monthData of result.monthlyHistory) {
    if (monthData.holdings && monthData.holdings.length > 0) {
      monthsWithHoldings++;
      
      const petr4Holding = monthData.holdings.find(h => h.ticker === 'PETR4');
      const itsa4Holding = monthData.holdings.find(h => h.ticker === 'ITSA4');
      
      if (petr4Holding) {
        petr4TotalValue += petr4Holding.value;
      }
      if (itsa4Holding) {
        itsa4TotalValue += itsa4Holding.value;
      }
    }
  }
  
  const petr4AvgValue = monthsWithHoldings > 0 ? petr4TotalValue / monthsWithHoldings : 0;
  const itsa4AvgValue = monthsWithHoldings > 0 ? itsa4TotalValue / monthsWithHoldings : 0;
  
  // Calcular DY anualizado (dividendos de 45 meses / valor médio)
  const periodInYears = 45 / 12; // 3.75 anos
  const petr4EffectiveDY = petr4AvgValue > 0 ? (petr4TotalDividends / periodInYears) / petr4AvgValue : 0;
  const itsa4EffectiveDY = itsa4AvgValue > 0 ? (itsa4TotalDividends / periodInYears) / itsa4AvgValue : 0;
  
  console.log(`📊 PETR4:`);
  console.log(`   🎯 DY esperado: 10.00%`);
  console.log(`   📈 DY efetivo: ${(petr4EffectiveDY * 100).toFixed(2)}%`);
  console.log(`   💰 Valor médio da posição: R$ ${petr4AvgValue.toFixed(2)}`);
  console.log(`   💎 Total dividendos: R$ ${petr4TotalDividends.toFixed(2)}`);
  console.log(`   📅 Período: ${periodInYears.toFixed(2)} anos`);
  console.log('');
  
  console.log(`📊 ITSA4:`);
  console.log(`   🎯 DY esperado: 6.45%`);
  console.log(`   📈 DY efetivo: ${(itsa4EffectiveDY * 100).toFixed(2)}%`);
  console.log(`   💰 Valor médio da posição: R$ ${itsa4AvgValue.toFixed(2)}`);
  console.log(`   💎 Total dividendos: R$ ${itsa4TotalDividends.toFixed(2)}`);
  console.log(`   📅 Período: ${periodInYears.toFixed(2)} anos`);
  console.log('');
  
  // Resultado final
  const overallSuccess = criticalErrors === 0 && cashFlowErrors === 0;
  const dyAccuracy = Math.abs(petr4EffectiveDY - 0.10) < 0.01 && Math.abs(itsa4EffectiveDY - 0.0645) < 0.01;
  
  console.log('🎯 RESULTADO FINAL DO TESTE UNITÁRIO');
  console.log('=' .repeat(80));
  
  if (overallSuccess && dyAccuracy) {
    console.log('✅ TESTE APROVADO: Backtest está matematicamente correto!');
    console.log('✅ Dividendos respeitam o DY estabelecido');
    console.log('✅ Fluxo de caixa está consistente');
    console.log('✅ Sazonalidade aplicada corretamente');
  } else {
    console.log('❌ TESTE REPROVADO: Problemas encontrados!');
    if (!overallSuccess) {
      console.log('❌ Erros críticos ou de fluxo de caixa detectados');
    }
    if (!dyAccuracy) {
      console.log('❌ Dividend Yield não está sendo respeitado');
    }
  }
  
  console.log('');
  console.log('🧪 Teste unitário concluído!');
}

// Executar teste
runUnitTest().catch(console.error);
