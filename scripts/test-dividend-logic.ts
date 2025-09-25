#!/usr/bin/env tsx

/**
 * TESTE SIMPLES DA LÓGICA DE DIVIDENDOS
 * Validar se o cálculo de dividendos está correto
 */

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

function testDividendLogic() {
  console.log('🧪 TESTE DA LÓGICA DE DIVIDENDOS');
  console.log('=' .repeat(80));
  
  // Cenário de teste
  const shares = 1000; // 1000 ações
  const currentPrice = 30.00; // R$ 30,00 por ação
  const averageDY = 0.10; // 10% DY anual
  
  console.log('📊 CENÁRIO DE TESTE:');
  console.log(`   🏷️  Ações: ${shares}`);
  console.log(`   💰 Preço: R$ ${currentPrice.toFixed(2)}`);
  console.log(`   📈 DY Anual: ${(averageDY * 100).toFixed(2)}%`);
  console.log(`   💎 Dividendo anual esperado: R$ ${(shares * currentPrice * averageDY).toFixed(2)}`);
  console.log();
  
  // Calcular dividendos mês a mês
  let totalDividendsYear = 0;
  const monthlyResults = [];
  
  for (let month = 1; month <= 12; month++) {
    const seasonalityFactor = DIVIDEND_SEASONALITY[month as keyof typeof DIVIDEND_SEASONALITY] || 0;
    
    // Lógica do serviço
    const annualDividendPerShare = currentPrice * averageDY;
    const normalizedSeasonalityFactor = seasonalityFactor / TOTAL_SEASONALITY_SUM;
    const seasonalDividendPerShare = annualDividendPerShare * normalizedSeasonalityFactor;
    const totalDividendAmount = shares * seasonalDividendPerShare;
    
    totalDividendsYear += totalDividendAmount;
    
    monthlyResults.push({
      month,
      seasonalityFactor,
      normalizedSeasonalityFactor,
      seasonalDividendPerShare,
      totalDividendAmount
    });
    
    console.log(`📅 Mês ${month.toString().padStart(2, '0')}: Fator ${(seasonalityFactor * 100).toFixed(1)}% → Normalizado ${(normalizedSeasonalityFactor * 100).toFixed(1)}% → R$ ${totalDividendAmount.toFixed(2)}`);
  }
  
  console.log();
  console.log('📊 RESULTADO ANUAL:');
  console.log(`   💎 Total dividendos pagos: R$ ${totalDividendsYear.toFixed(2)}`);
  console.log(`   💎 Dividendo esperado: R$ ${(shares * currentPrice * averageDY).toFixed(2)}`);
  console.log(`   📈 DY efetivo: ${((totalDividendsYear / (shares * currentPrice)) * 100).toFixed(2)}%`);
  console.log(`   📈 DY esperado: ${(averageDY * 100).toFixed(2)}%`);
  console.log(`   ❓ Diferença: R$ ${(totalDividendsYear - (shares * currentPrice * averageDY)).toFixed(2)}`);
  
  // Verificar normalização
  console.log();
  console.log('🔍 VERIFICAÇÃO DA NORMALIZAÇÃO:');
  const sumFactors = Object.values(DIVIDEND_SEASONALITY).reduce((sum, factor) => sum + factor, 0);
  const sumNormalized = Object.values(DIVIDEND_SEASONALITY).reduce((sum, factor) => sum + (factor / TOTAL_SEASONALITY_SUM), 0);
  
  console.log(`   📊 Soma dos fatores originais: ${sumFactors.toFixed(3)}`);
  console.log(`   📊 TOTAL_SEASONALITY_SUM: ${TOTAL_SEASONALITY_SUM.toFixed(3)}`);
  console.log(`   📊 Soma dos fatores normalizados: ${sumNormalized.toFixed(3)}`);
  console.log(`   ✅ Normalização correta: ${Math.abs(sumNormalized - 1.0) < 0.001 ? 'SIM' : 'NÃO'}`);
}

testDividendLogic();
