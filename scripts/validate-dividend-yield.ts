#!/usr/bin/env tsx

/**
 * Script de Validação Rigorosa dos Dividend Yields
 * 
 * Valida se os dividendos calculados estão corretos conforme os DY estabelecidos:
 * - PETR4: 10% DY
 * - ITSA4: 6,45% DY
 */

// Sazonalidade dos dividendos (copiada do código real)
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

// Dados dos dividendos do backtest real (APÓS CORREÇÃO DA SAZONALIDADE)
const dividendData = [
  { month: 4, monthName: 'abril', petr4: 91.61, itsa4: 64.49, total: 156.10 },
  { month: 5, monthName: 'maio', petr4: 38.06, itsa4: 23.49, total: 61.55 },
  { month: 6, monthName: 'junho', petr4: 58.43, itsa4: 36.16, total: 94.59 },
  { month: 7, monthName: 'julho', petr4: 95.90, itsa4: 51.96, total: 147.86 },
  { month: 8, monthName: 'agosto', petr4: 97.71, itsa4: 53.16, total: 150.88 },
  { month: 9, monthName: 'setembro', petr4: 187.12, itsa4: 131.48, total: 318.60 },
  { month: 11, monthName: 'novembro', petr4: 214.54, itsa4: 153.12, total: 367.66 },
  { month: 13, monthName: 'janeiro', petr4: 86.18, itsa4: 54.53, total: 140.71 },
  { month: 16, monthName: 'abril', petr4: 193.26, itsa4: 134.10, total: 327.36 },
  { month: 17, monthName: 'maio', petr4: 85.81, itsa4: 58.59, total: 144.40 },
  { month: 18, monthName: 'junho', petr4: 152.19, itsa4: 80.04, total: 232.23 },
  { month: 19, monthName: 'julho', petr4: 243.71, itsa4: 152.65, total: 396.36 },
  { month: 20, monthName: 'agosto', petr4: 234.08, itsa4: 139.02, total: 373.11 },
  { month: 21, monthName: 'setembro', petr4: 478.14, itsa4: 285.48, total: 763.63 },
  { month: 23, monthName: 'novembro', petr4: 468.89, itsa4: 291.82, total: 760.71 },
  { month: 25, monthName: 'janeiro', petr4: 228.36, itsa4: 145.44, total: 373.80 },
  { month: 28, monthName: 'abril', petr4: 496.86, itsa4: 361.09, total: 857.95 },
  { month: 29, monthName: 'maio', petr4: 246.33, itsa4: 129.79, total: 376.12 },
  { month: 30, monthName: 'junho', petr4: 289.37, itsa4: 200.19, total: 489.56 },
  { month: 31, monthName: 'julho', petr4: 471.84, itsa4: 300.12, total: 771.97 },
  { month: 32, monthName: 'agosto', petr4: 406.94, itsa4: 272.20, total: 679.14 },
  { month: 33, monthName: 'setembro', petr4: 895.81, itsa4: 591.88, total: 1487.70 },
  { month: 35, monthName: 'novembro', petr4: 835.10, itsa4: 521.11, total: 1356.21 },
  { month: 37, monthName: 'janeiro', petr4: 311.85, itsa4: 205.68, total: 517.53 },
  { month: 40, monthName: 'abril', petr4: 754.70, itsa4: 539.18, total: 1293.88 },
  { month: 41, monthName: 'maio', petr4: 264.97, itsa4: 241.10, total: 506.08 },
  { month: 42, monthName: 'junho', petr4: 457.67, itsa4: 289.23, total: 746.90 },
  { month: 43, monthName: 'julho', petr4: 704.18, itsa4: 442.57, total: 1146.75 },
  { month: 44, monthName: 'agosto', petr4: 637.42, itsa4: 365.46, total: 1002.89 },
  { month: 45, monthName: 'setembro', petr4: 1173.77, itsa4: 861.65, total: 2035.43 }
];

// Preços históricos aproximados (baseados no backtest)
const priceHistory = {
  PETR4: [
    { month: 1, price: 11.79 },
    { month: 4, price: 12.19 },
    { month: 8, price: 16.26 },
    { month: 12, price: 14.30 },
    { month: 16, price: 19.42 },
    { month: 20, price: 25.20 },
    { month: 24, price: 28.15 },
    { month: 28, price: 31.05 },
    { month: 32, price: 34.91 },
    { month: 36, price: 33.28 },
    { month: 40, price: 34.42 },
    { month: 44, price: 29.33 },
    { month: 46, price: 31.37 }
  ],
  ITSA4: [
    { month: 1, price: 6.27 },
    { month: 4, price: 6.70 },
    { month: 8, price: 6.18 },
    { month: 12, price: 5.25 },
    { month: 16, price: 8.37 },
    { month: 20, price: 6.80 },
    { month: 24, price: 8.67 },
    { month: 28, price: 7.99 },
    { month: 32, price: 9.15 },
    { month: 36, price: 10.42 },
    { month: 40, price: 10.78 },
    { month: 44, price: 10.66 },
    { month: 46, price: 11.28 }
  ]
};

// Holdings aproximados por mês (baseados no backtest)
const holdingsHistory = {
  PETR4: [
    { month: 4, shares: 466 },
    { month: 8, shares: 527 },
    { month: 12, shares: 527 },
    { month: 16, shares: 527 },
    { month: 20, shares: 527 },
    { month: 24, shares: 681 },
    { month: 28, shares: 681 },
    { month: 32, shares: 681 },
    { month: 36, shares: 1077 },
    { month: 40, shares: 1077 },
    { month: 44, shares: 2364 },
    { month: 46, shares: 2364 }
  ],
  ITSA4: [
    { month: 4, shares: 877 },
    { month: 8, shares: 959 },
    { month: 12, shares: 959 },
    { month: 16, shares: 959 },
    { month: 20, shares: 2299 },
    { month: 24, shares: 2299 },
    { month: 28, shares: 2299 },
    { month: 32, shares: 2299 },
    { month: 36, shares: 1448 },
    { month: 40, shares: 1448 },
    { month: 44, shares: 6579 },
    { month: 46, shares: 6579 }
  ]
};

function getPrice(ticker: string, month: number): number {
  const history = priceHistory[ticker as keyof typeof priceHistory];
  
  // Encontrar o preço mais próximo
  let closestPrice = history[0];
  for (const pricePoint of history) {
    if (Math.abs(pricePoint.month - month) < Math.abs(closestPrice.month - month)) {
      closestPrice = pricePoint;
    }
  }
  
  return closestPrice.price;
}

function getShares(ticker: string, month: number): number {
  const history = holdingsHistory[ticker as keyof typeof holdingsHistory];
  
  // Encontrar o número de ações mais próximo
  let closestHolding = history[0];
  for (const holding of history) {
    if (holding.month <= month) {
      closestHolding = holding;
    }
  }
  
  return closestHolding.shares;
}

function validateDividendYields() {
  console.log('🔍 VALIDAÇÃO RIGOROSA DOS DIVIDEND YIELDS');
  console.log('=' .repeat(80));
  console.log('📊 Parâmetros estabelecidos:');
  console.log('   PETR4: 10.00% DY anual');
  console.log('   ITSA4: 6.45% DY anual');
  console.log('=' .repeat(80));
  
  let totalErrors = 0;
  let totalValidations = 0;
  
  // Validar cada mês com dividendos
  for (const dividend of dividendData) {
    console.log(`\n📅 === VALIDAÇÃO MÊS ${dividend.month} (${dividend.monthName.toUpperCase()}) ===`);
    
    const calendarMonth = ((dividend.month - 1) % 12) + 1;
    const seasonalityFactor = DIVIDEND_SEASONALITY[calendarMonth as keyof typeof DIVIDEND_SEASONALITY];
    
    console.log(`   🗓️ Mês calendário: ${calendarMonth} (${dividend.monthName})`);
    console.log(`   📊 Fator sazonalidade: ${(seasonalityFactor * 100).toFixed(1)}%`);
    
    // Validar PETR4
    const petr4Price = getPrice('PETR4', dividend.month);
    const petr4Shares = getShares('PETR4', dividend.month);
    const petr4AnnualDividendPerShare = petr4Price * 0.10; // 10% DY
    // CORREÇÃO: Aplicar normalização como no código real
    const TOTAL_SEASONALITY_SUM = 1.07;
    const normalizedSeasonalityFactor = seasonalityFactor / TOTAL_SEASONALITY_SUM;
    const petr4SeasonalDividendPerShare = petr4AnnualDividendPerShare * normalizedSeasonalityFactor;
    const petr4ExpectedDividend = petr4Shares * petr4SeasonalDividendPerShare;
    const petr4Error = Math.abs(petr4ExpectedDividend - dividend.petr4);
    const petr4ErrorPercent = (petr4Error / petr4ExpectedDividend) * 100;
    
    console.log(`\n   📊 PETR4:`);
    console.log(`      💰 Preço: R$ ${petr4Price.toFixed(2)}`);
    console.log(`      📈 Ações: ${petr4Shares.toLocaleString()}`);
    console.log(`      💎 DY anual por ação: R$ ${petr4AnnualDividendPerShare.toFixed(4)}`);
    console.log(`      💎 DY sazonal por ação: R$ ${petr4SeasonalDividendPerShare.toFixed(4)}`);
    console.log(`      💎 Dividendo esperado: R$ ${petr4ExpectedDividend.toFixed(2)}`);
    console.log(`      💎 Dividendo real: R$ ${dividend.petr4.toFixed(2)}`);
    console.log(`      ❓ Erro: R$ ${petr4Error.toFixed(2)} (${petr4ErrorPercent.toFixed(2)}%)`);
    
    if (petr4ErrorPercent > 5) {
      console.log(`      ❌ ERRO SIGNIFICATIVO: ${petr4ErrorPercent.toFixed(2)}% > 5%`);
      totalErrors++;
    } else {
      console.log(`      ✅ OK: Erro dentro da tolerância (${petr4ErrorPercent.toFixed(2)}% ≤ 5%)`);
    }
    
    // Validar ITSA4
    const itsa4Price = getPrice('ITSA4', dividend.month);
    const itsa4Shares = getShares('ITSA4', dividend.month);
    const itsa4AnnualDividendPerShare = itsa4Price * 0.0645; // 6,45% DY
    // CORREÇÃO: Aplicar normalização como no código real
    const itsa4SeasonalDividendPerShare = itsa4AnnualDividendPerShare * normalizedSeasonalityFactor;
    const itsa4ExpectedDividend = itsa4Shares * itsa4SeasonalDividendPerShare;
    const itsa4Error = Math.abs(itsa4ExpectedDividend - dividend.itsa4);
    const itsa4ErrorPercent = (itsa4Error / itsa4ExpectedDividend) * 100;
    
    console.log(`\n   📊 ITSA4:`);
    console.log(`      💰 Preço: R$ ${itsa4Price.toFixed(2)}`);
    console.log(`      📈 Ações: ${itsa4Shares.toLocaleString()}`);
    console.log(`      💎 DY anual por ação: R$ ${itsa4AnnualDividendPerShare.toFixed(4)}`);
    console.log(`      💎 DY sazonal por ação: R$ ${itsa4SeasonalDividendPerShare.toFixed(4)}`);
    console.log(`      💎 Dividendo esperado: R$ ${itsa4ExpectedDividend.toFixed(2)}`);
    console.log(`      💎 Dividendo real: R$ ${dividend.itsa4.toFixed(2)}`);
    console.log(`      ❓ Erro: R$ ${itsa4Error.toFixed(2)} (${itsa4ErrorPercent.toFixed(2)}%)`);
    
    if (itsa4ErrorPercent > 5) {
      console.log(`      ❌ ERRO SIGNIFICATIVO: ${itsa4ErrorPercent.toFixed(2)}% > 5%`);
      totalErrors++;
    } else {
      console.log(`      ✅ OK: Erro dentro da tolerância (${itsa4ErrorPercent.toFixed(2)}% ≤ 5%)`);
    }
    
    // Validar total do mês
    const totalExpected = petr4ExpectedDividend + itsa4ExpectedDividend;
    const totalError = Math.abs(totalExpected - dividend.total);
    const totalErrorPercent = (totalError / totalExpected) * 100;
    
    console.log(`\n   📊 TOTAL DO MÊS:`);
    console.log(`      💎 Esperado: R$ ${totalExpected.toFixed(2)}`);
    console.log(`      💎 Real: R$ ${dividend.total.toFixed(2)}`);
    console.log(`      ❓ Erro: R$ ${totalError.toFixed(2)} (${totalErrorPercent.toFixed(2)}%)`);
    
    if (totalErrorPercent > 5) {
      console.log(`      ❌ ERRO TOTAL SIGNIFICATIVO: ${totalErrorPercent.toFixed(2)}% > 5%`);
      totalErrors++;
    } else {
      console.log(`      ✅ TOTAL OK: Erro dentro da tolerância (${totalErrorPercent.toFixed(2)}% ≤ 5%)`);
    }
    
    totalValidations += 3; // PETR4 + ITSA4 + Total
  }
  
  // Resumo final
  console.log('\n' + '=' .repeat(80));
  console.log('📊 RESUMO FINAL DA VALIDAÇÃO');
  console.log('=' .repeat(80));
  
  const successRate = ((totalValidations - totalErrors) / totalValidations) * 100;
  
  console.log(`📊 Total de validações: ${totalValidations}`);
  console.log(`❌ Erros encontrados: ${totalErrors}`);
  console.log(`✅ Validações corretas: ${totalValidations - totalErrors}`);
  console.log(`📈 Taxa de sucesso: ${successRate.toFixed(1)}%`);
  
  if (totalErrors === 0) {
    console.log(`\n🎉 PERFEITO: Todos os dividendos estão corretos conforme os DY estabelecidos!`);
  } else if (successRate >= 95) {
    console.log(`\n✅ EXCELENTE: ${successRate.toFixed(1)}% dos cálculos estão corretos (≥95%)`);
  } else if (successRate >= 90) {
    console.log(`\n⚠️ BOM: ${successRate.toFixed(1)}% dos cálculos estão corretos (≥90%)`);
  } else {
    console.log(`\n❌ PROBLEMA: Apenas ${successRate.toFixed(1)}% dos cálculos estão corretos (<90%)`);
  }
  
  // Análise da sazonalidade
  console.log('\n📊 ANÁLISE DA SAZONALIDADE:');
  const monthlyTotals = new Map<number, number>();
  
  for (const dividend of dividendData) {
    const calendarMonth = ((dividend.month - 1) % 12) + 1;
    const currentTotal = monthlyTotals.get(calendarMonth) || 0;
    monthlyTotals.set(calendarMonth, currentTotal + dividend.total);
  }
  
  const sortedMonths = Array.from(monthlyTotals.entries()).sort((a, b) => b[1] - a[1]);
  
  console.log('   🏆 Meses com maiores dividendos:');
  sortedMonths.slice(0, 5).forEach(([month, total], index) => {
    const monthNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const expectedFactor = DIVIDEND_SEASONALITY[month as keyof typeof DIVIDEND_SEASONALITY];
    console.log(`      ${index + 1}º ${monthNames[month]}: R$ ${total.toFixed(2)} (fator: ${(expectedFactor * 100).toFixed(1)}%)`);
  });
  
  console.log('\n=' .repeat(80));
  console.log('✅ VALIDAÇÃO COMPLETA FINALIZADA');
  console.log('=' .repeat(80));
}

// Executar validação
validateDividendYields();
