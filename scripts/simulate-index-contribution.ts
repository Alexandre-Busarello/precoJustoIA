/**
 * Script de simulação para entender a divergência entre
 * o cálculo do índice e a soma das contribuições individuais
 */

// Dados mockados baseados no CSV fornecido
interface SnapshotAsset {
  price: number;
  weight: number;
  entryPrice: number;
  entryDate: string;
}

interface DailyPoint {
  date: string;
  points: number;
  dailyChange: number;
  compositionSnapshot: Record<string, SnapshotAsset>;
  dividendsByTicker: Record<string, number>;
}

// Dados históricos do índice (baseados no CSV)
// IMPORTANTE: No dia 01/12 (criação do índice), NÃO há snapshot da composição
// O primeiro snapshot só é criado no primeiro cálculo (02/12)
const historyPoints: DailyPoint[] = [
  {
    date: '2025-12-01',
    points: 100.0,
    dailyChange: 0.0,
    compositionSnapshot: {}, // SEM SNAPSHOT no dia de criação
    dividendsByTicker: {},
  },
  {
    date: '2025-12-02',
    points: 101.1819530839449,
    dailyChange: 1.181953083944958,
    compositionSnapshot: {
      BAZA3: { price: 74.98, weight: 0.1, entryPrice: 74.51, entryDate: '2025-12-01' },
      BBAS3: { price: 22.56, weight: 0.1, entryPrice: 22.26, entryDate: '2025-12-01' },
      BLAU3: { price: 13.03, weight: 0.1, entryPrice: 13.13, entryDate: '2025-12-01' },
      BNBR3: { price: 107.5, weight: 0.1, entryPrice: 106.0, entryDate: '2025-12-01' },
      EMAE4: { price: 36.82, weight: 0.1, entryPrice: 37.09, entryDate: '2025-12-01' },
      EUCA4: { price: 17.08, weight: 0.1, entryPrice: 17.39, entryDate: '2025-12-01' },
      PETR3: { price: 33.77, weight: 0.1, entryPrice: 33.59, entryDate: '2025-12-01' },
      RECV3: { price: 10.65, weight: 0.1, entryPrice: 10.5, entryDate: '2025-12-01' },
      VTRU3: { price: 14.3, weight: 0.1, entryPrice: 13.77, entryDate: '2025-12-01' },
      SAPR11: { price: 38.53, weight: 0.1, entryPrice: 36.5, entryDate: '2025-12-01' },
    },
    dividendsByTicker: { BBAS3: 0.071927 },
  },
  {
    date: '2025-12-03',
    points: 101.9629541631448,
    dailyChange: 0.7718778452041731,
    compositionSnapshot: {
      BAZA3: { price: 75.0, weight: 0.1, entryPrice: 74.51, entryDate: '2025-12-01' },
      BBAS3: { price: 22.38, weight: 0.1, entryPrice: 22.26, entryDate: '2025-12-01' },
      BLAU3: { price: 13.4, weight: 0.1, entryPrice: 13.13, entryDate: '2025-12-01' },
      BNBR3: { price: 108.5, weight: 0.1, entryPrice: 106.0, entryDate: '2025-12-01' },
      EMAE4: { price: 37.01, weight: 0.1, entryPrice: 37.09, entryDate: '2025-12-01' },
      EUCA4: { price: 17.45, weight: 0.1, entryPrice: 17.39, entryDate: '2025-12-01' },
      PETR3: { price: 34.19, weight: 0.1, entryPrice: 33.59, entryDate: '2025-12-01' },
      RECV3: { price: 10.68, weight: 0.1, entryPrice: 10.5, entryDate: '2025-12-01' },
      VTRU3: { price: 14.27, weight: 0.1, entryPrice: 13.77, entryDate: '2025-12-01' },
      SAPR11: { price: 38.73, weight: 0.1, entryPrice: 36.5, entryDate: '2025-12-01' },
    },
    dividendsByTicker: { BBAS3: 0.045833 },
  },
  {
    date: '2025-12-15',
    points: 101.79968956919,
    dailyChange: 0.8994238739134297,
    compositionSnapshot: {
      BAZA3: { price: 75.51, weight: 0.1, entryPrice: 74.91, entryDate: '2025-12-12' },
      BBAS3: { price: 22.01, weight: 0.1, entryPrice: 21.7, entryDate: '2025-12-12' },
      BNBR3: { price: 109.75, weight: 0.1, entryPrice: 108.93, entryDate: '2025-12-12' },
      EMAE4: { price: 37.7, weight: 0.1, entryPrice: 36.08, entryDate: '2025-12-12' },
      EUCA4: { price: 17.7, weight: 0.1, entryPrice: 17.65, entryDate: '2025-12-12' },
      EZTC3: { price: 15.31, weight: 0.1, entryPrice: 15.31, entryDate: '2025-12-12' },
      PETR3: { price: 33.22, weight: 0.1, entryPrice: 33.28, entryDate: '2025-12-12' },
      RECV3: { price: 10.76, weight: 0.1, entryPrice: 10.71, entryDate: '2025-12-12' },
      VTRU3: { price: 14.51, weight: 0.1, entryPrice: 14.31, entryDate: '2025-12-12' },
      SAPR11: { price: 37.0, weight: 0.1, entryPrice: 37.19, entryDate: '2025-12-12' },
    },
    dividendsByTicker: {},
  },
  {
    date: '2025-12-16',
    points: 100.2715575327708,
    dailyChange: -1.501116597590953,
    compositionSnapshot: {
      BAZA3: { price: 75.4, weight: 0.1, entryPrice: 75.51, entryDate: '2025-12-15' },
      BBAS3: { price: 21.71, weight: 0.1, entryPrice: 22.01, entryDate: '2025-12-15' },
      BNBR3: { price: 109.9, weight: 0.1, entryPrice: 109.75, entryDate: '2025-12-15' },
      COGN3: { price: 3.63, weight: 0.1, entryPrice: 3.82, entryDate: '2025-12-15' },
      EMAE4: { price: 38.94, weight: 0.1, entryPrice: 37.7, entryDate: '2025-12-15' },
      EUCA4: { price: 17.4, weight: 0.1, entryPrice: 17.7, entryDate: '2025-12-15' },
      PETR4: { price: 30.74, weight: 0.1, entryPrice: 31.7, entryDate: '2025-12-15' },
      RECV3: { price: 10.41, weight: 0.1, entryPrice: 10.76, entryDate: '2025-12-15' },
      VTRU3: { price: 14.07, weight: 0.1, entryPrice: 14.51, entryDate: '2025-12-15' },
      SAPR11: { price: 36.65, weight: 0.1, entryPrice: 37.0, entryDate: '2025-12-15' },
    },
    dividendsByTicker: {},
  },
  {
    date: '2025-12-23',
    points: 102.848207051029,
    dailyChange: 1.764084036700366,
    compositionSnapshot: {
      BAZA3: { price: 75.89, weight: 0.1, entryPrice: 75.51, entryDate: '2025-12-15' },
      BBAS3: { price: 21.75, weight: 0.1, entryPrice: 22.01, entryDate: '2025-12-15' },
      BNBR3: { price: 109.9, weight: 0.1, entryPrice: 109.75, entryDate: '2025-12-15' },
      COGN3: { price: 3.62, weight: 0.1, entryPrice: 3.82, entryDate: '2025-12-15' },
      EMAE4: { price: 40.87, weight: 0.1, entryPrice: 37.7, entryDate: '2025-12-15' },
      EUCA4: { price: 18.49, weight: 0.1, entryPrice: 17.7, entryDate: '2025-12-15' },
      PETR4: { price: 30.31, weight: 0.1, entryPrice: 31.7, entryDate: '2025-12-15' },
      RECV3: { price: 11.11, weight: 0.1, entryPrice: 10.76, entryDate: '2025-12-15' },
      VTRU3: { price: 13.6, weight: 0.1, entryPrice: 14.51, entryDate: '2025-12-15' },
      SAPR11: { price: 39.86, weight: 0.1, entryPrice: 37.0, entryDate: '2025-12-15' },
    },
    dividendsByTicker: { PETR4: 0.943208 },
  },
  {
    date: '2025-12-26',
    points: 103.7947809700791,
    dailyChange: 0.9203601561867326,
    compositionSnapshot: {
      BAZA3: { price: 76.88, weight: 0.1, entryPrice: 75.51, entryDate: '2025-12-15' },
      BBAS3: { price: 21.85, weight: 0.1, entryPrice: 22.01, entryDate: '2025-12-15' },
      BNBR3: { price: 109.9, weight: 0.1, entryPrice: 109.75, entryDate: '2025-12-15' },
      COGN3: { price: 3.21, weight: 0.1, entryPrice: 3.82, entryDate: '2025-12-15' },
      EMAE4: { price: 43.37, weight: 0.1, entryPrice: 37.7, entryDate: '2025-12-15' },
      EUCA4: { price: 18.28, weight: 0.1, entryPrice: 17.7, entryDate: '2025-12-15' },
      PETR4: { price: 30.41, weight: 0.1, entryPrice: 31.7, entryDate: '2025-12-15' },
      RECV3: { price: 11.12, weight: 0.1, entryPrice: 10.76, entryDate: '2025-12-15' },
      VTRU3: { price: 13.85, weight: 0.1, entryPrice: 14.51, entryDate: '2025-12-15' },
      SAPR11: { price: 39.53, weight: 0.1, entryPrice: 37.0, entryDate: '2025-12-15' },
    },
    dividendsByTicker: { COGN3: 0.114734 },
  },
  {
    date: '2025-12-29',
    points: 104.3469136277083,
    dailyChange: 0.5319464547917198,
    compositionSnapshot: {
      BAZA3: { price: 77.4, weight: 0.1, entryPrice: 75.51, entryDate: '2025-12-15' },
      BBAS3: { price: 21.72, weight: 0.1, entryPrice: 22.01, entryDate: '2025-12-15' },
      BNBR3: { price: 109.9, weight: 0.1, entryPrice: 109.75, entryDate: '2025-12-15' },
      COGN3: { price: 3.11, weight: 0.1, entryPrice: 3.82, entryDate: '2025-12-15' },
      EMAE4: { price: 44.7, weight: 0.1, entryPrice: 37.7, entryDate: '2025-12-15' },
      EUCA4: { price: 18.93, weight: 0.1, entryPrice: 17.7, entryDate: '2025-12-15' },
      PETR4: { price: 30.73, weight: 0.1, entryPrice: 31.7, entryDate: '2025-12-15' },
      RECV3: { price: 11.24, weight: 0.1, entryPrice: 10.76, entryDate: '2025-12-15' },
      VTRU3: { price: 13.77, weight: 0.1, entryPrice: 14.51, entryDate: '2025-12-15' },
      SAPR11: { price: 39.6, weight: 0.1, entryPrice: 37.0, entryDate: '2025-12-15' },
    },
    dividendsByTicker: {},
  },
];

/**
 * Simula o cálculo do índice (como calculateDailyReturn faz)
 */
function simulateIndexCalculation(): number {
  let totalReturn = 0;
  
  console.log('\n=== SIMULAÇÃO DO CÁLCULO DO ÍNDICE ===\n');
  
  for (let i = 1; i < historyPoints.length; i++) {
    const currentPoint = historyPoints[i];
    const previousPoint = historyPoints[i - 1];
    
    console.log(`\n📅 Data: ${currentPoint.date}`);
    console.log(`   Pontos anteriores: ${previousPoint.points.toFixed(4)}`);
    
    let dailyReturn = 0;
    const contributions: Array<{ ticker: string; contribution: number }> = [];
    
    // Calcular contribuição de cada ativo presente no snapshot atual
    for (const [ticker, assetData] of Object.entries(currentPoint.compositionSnapshot)) {
      // Buscar preço anterior do snapshot anterior
      // IMPORTANTE: Se não há snapshot anterior (primeiro cálculo), usar entryPrice
      let previousAssetData = null;
      let previousWeight = assetData.weight; // Fallback: usar peso atual
      
      if (previousPoint && Object.keys(previousPoint.compositionSnapshot).length > 0) {
        // Há snapshot anterior: buscar dados do ativo
        previousAssetData = previousPoint.compositionSnapshot[ticker];
        if (previousAssetData) {
          previousWeight = previousAssetData.weight;
        }
      }
      
      if (!previousAssetData) {
        // Ativo não estava presente no snapshot anterior OU não há snapshot anterior (primeiro cálculo)
        // Quando um ativo entra OU é o primeiro cálculo, o índice usa o peso atual e entryPrice como preço anterior
        const entryDate = new Date(assetData.entryDate);
        const currentDate = new Date(currentPoint.date);
        const daysSinceEntry = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceEntry <= 1) {
          // Primeira entrada ou primeiro cálculo: usar entryPrice como preço anterior
          const dividend = currentPoint.dividendsByTicker[ticker] || 0;
          const adjustedPriceToday = assetData.price + dividend;
          const assetDailyReturn = (adjustedPriceToday / assetData.entryPrice) - 1;
          const weightedContribution = assetData.weight * assetDailyReturn;
          
          dailyReturn += weightedContribution;
          contributions.push({ ticker, contribution: weightedContribution * 100 });
          
          console.log(`   ${ticker}: ${previousPoint ? 'ENTRADA' : 'PRIMEIRO CÁLCULO'} - Preço: ${assetData.price.toFixed(2)} → ${adjustedPriceToday.toFixed(2)} (div: ${dividend.toFixed(4)}), EntryPrice: ${assetData.entryPrice.toFixed(2)}, Return: ${(assetDailyReturn * 100).toFixed(4)}%, Weight: ${(assetData.weight * 100).toFixed(1)}%, Contrib: ${(weightedContribution * 100).toFixed(4)}%`);
        }
        continue;
      }
      
      // Ativo estava presente no snapshot anterior
      const dividend = currentPoint.dividendsByTicker[ticker] || 0;
      const adjustedPriceToday = assetData.price + dividend;
      const assetDailyReturn = (adjustedPriceToday / previousAssetData.price) - 1;
      
      // IMPORTANTE: Usar peso do snapshot anterior (w_{i,t-1})
      const weight = previousAssetData.weight;
      const weightedContribution = weight * assetDailyReturn;
      
      dailyReturn += weightedContribution;
      contributions.push({ ticker, contribution: weightedContribution * 100 });
      
      console.log(`   ${ticker}: Preço: ${previousAssetData.price.toFixed(2)} → ${adjustedPriceToday.toFixed(2)} (div: ${dividend.toFixed(4)}), Return: ${(assetDailyReturn * 100).toFixed(4)}%, Weight: ${(weight * 100).toFixed(1)}%, Contrib: ${(weightedContribution * 100).toFixed(4)}%`);
    }
    
    console.log(`   Retorno diário calculado: ${(dailyReturn * 100).toFixed(4)}%`);
    console.log(`   Retorno diário esperado: ${currentPoint.dailyChange.toFixed(4)}%`);
    console.log(`   Diferença: ${((dailyReturn * 100) - currentPoint.dailyChange).toFixed(4)}%`);
    
    totalReturn += dailyReturn;
  }
  
  const finalReturn = totalReturn * 100;
  console.log(`\n✅ Retorno total acumulado do índice: ${finalReturn.toFixed(4)}%`);
  console.log(`   Pontos finais: ${historyPoints[historyPoints.length - 1].points.toFixed(4)}`);
  console.log(`   Retorno esperado: ${((historyPoints[historyPoints.length - 1].points - 100) / 100 * 100).toFixed(4)}%`);
  
  return finalReturn;
}

/**
 * Simula o cálculo de contribuição individual (como calculateAssetPerformance faz)
 */
function simulateIndividualContribution(ticker: string): number {
  console.log(`\n=== SIMULAÇÃO DE CONTRIBUIÇÃO INDIVIDUAL: ${ticker} ===\n`);
  
  // Filtrar pontos onde o ativo estava presente (excluindo dia 01/12 que não tem snapshot)
  const relevantPoints = historyPoints.filter(point => 
    point.compositionSnapshot[ticker] !== undefined && Object.keys(point.compositionSnapshot).length > 0
  );
  
  if (relevantPoints.length === 0) {
    console.log(`   ❌ Ativo ${ticker} nunca esteve no índice`);
    return 0;
  }
  
  const firstPoint = relevantPoints[0];
  const entryData = firstPoint.compositionSnapshot[ticker];
  
  console.log(`   Primeira aparição: ${firstPoint.date}`);
  console.log(`   EntryPrice: ${entryData.entryPrice.toFixed(2)}`);
  console.log(`   EntryDate: ${entryData.entryDate}`);
  
  let totalContribution = 0;
  
  for (let i = 0; i < relevantPoints.length; i++) {
    const point = relevantPoints[i];
    const assetData = point.compositionSnapshot[ticker];
    
    console.log(`\n   📅 Data: ${point.date}`);
    console.log(`      Preço atual: ${assetData.price.toFixed(2)}, Peso: ${(assetData.weight * 100).toFixed(1)}%`);
    
    // Buscar snapshot anterior do índice completo
    const currentDate = new Date(point.date);
    currentDate.setHours(0, 0, 0, 0);
    
    let previousPoint = null;
    for (let j = historyPoints.length - 1; j >= 0; j--) {
      const histPoint = historyPoints[j];
      const histDate = new Date(histPoint.date);
      histDate.setHours(0, 0, 0, 0);
      
      if (histDate.getTime() < currentDate.getTime()) {
        previousPoint = histPoint;
        break;
      }
    }
    
    let previousAssetData = null;
    let previousWeight = 0;
    
    if (previousPoint) {
      const previousSnapshot = previousPoint.compositionSnapshot;
      
      if (previousSnapshot[ticker]) {
        // Ativo estava presente no snapshot anterior
        previousAssetData = previousSnapshot[ticker];
        previousWeight = previousAssetData.weight;
        console.log(`      ✅ Encontrado no snapshot anterior (${previousPoint.date})`);
        console.log(`         Preço anterior: ${previousAssetData.price.toFixed(2)}, Peso anterior: ${(previousWeight * 100).toFixed(1)}%`);
      } else {
        // Ativo não estava presente no snapshot anterior
        console.log(`      ⚠️  NÃO encontrado no snapshot anterior (${previousPoint.date})`);
        
        // Verificar se é primeira entrada
        const entryDateCheck = new Date(entryData.entryDate);
        entryDateCheck.setHours(0, 0, 0, 0);
        const daysSinceEntry = Math.floor((currentDate.getTime() - entryDateCheck.getTime()) / (1000 * 60 * 60 * 24));
        
        // Buscar do último snapshot onde o ativo estava presente
        let hasPreviousRelevantPoint = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevRelevantPoint = relevantPoints[j];
          const prevRelevantSnapshot = prevRelevantPoint.compositionSnapshot;
          const prevRelevantData = prevRelevantSnapshot[ticker];
          if (prevRelevantData && prevRelevantData.price > 0) {
            previousAssetData = prevRelevantData;
            hasPreviousRelevantPoint = true;
            break;
          }
        }
        
        if (hasPreviousRelevantPoint) {
          // Gap: ativo saiu e voltou
          if (daysSinceEntry <= 1) {
            previousWeight = assetData.weight;
            console.log(`         Gap detectado, mas reentrada recente. Usando peso atual: ${(previousWeight * 100).toFixed(1)}%`);
          } else {
            previousWeight = 0;
            console.log(`         Gap detectado. Usando peso 0`);
          }
        } else if (daysSinceEntry <= 1) {
          // Primeira entrada
          previousWeight = assetData.weight;
          console.log(`         Primeira entrada (${daysSinceEntry} dias). Usando peso atual: ${(previousWeight * 100).toFixed(1)}%`);
        } else {
          previousWeight = 0;
          console.log(`         Caso não esperado. Usando peso 0`);
        }
      }
    } else {
      // Não há snapshot anterior (primeiro dia do índice)
      previousWeight = assetData.weight;
      console.log(`      ⚠️  Não há snapshot anterior (primeiro dia do índice)`);
    }
    
    // Se não encontrou preço anterior, usar entryPrice
    if (!previousAssetData || !previousAssetData.price || previousAssetData.price <= 0) {
      const entryDateCheck = new Date(entryData.entryDate);
      entryDateCheck.setHours(0, 0, 0, 0);
      const daysSinceEntry = Math.floor((currentDate.getTime() - entryDateCheck.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceEntry <= 1) {
        previousAssetData = {
          price: entryData.entryPrice,
          weight: assetData.weight,
          entryPrice: entryData.entryPrice,
          entryDate: entryData.entryDate,
        };
        if (previousWeight === 0) {
          previousWeight = assetData.weight;
        }
        console.log(`      📌 Usando entryPrice como preço anterior: ${entryData.entryPrice.toFixed(2)}`);
      }
    }
    
    // Calcular contribuição
    if (previousAssetData && previousAssetData.price > 0 && assetData.price > 0) {
      const dividend = point.dividendsByTicker[ticker] || 0;
      const adjustedPriceToday = assetData.price + dividend;
      const assetDailyReturn = (adjustedPriceToday / previousAssetData.price) - 1;
      const dailyContribution = previousWeight * assetDailyReturn * 100;
      
      totalContribution += dailyContribution;
      
      console.log(`      💰 Dividendo: ${dividend.toFixed(4)}`);
      console.log(`      📊 Preço ajustado: ${adjustedPriceToday.toFixed(2)}`);
      console.log(`      📈 Retorno diário: ${(assetDailyReturn * 100).toFixed(4)}%`);
      console.log(`      ⚖️  Peso usado: ${(previousWeight * 100).toFixed(1)}%`);
      console.log(`      ➕ Contribuição: ${dailyContribution.toFixed(4)}%`);
    } else {
      console.log(`      ❌ Não foi possível calcular contribuição (preço anterior inválido)`);
    }
  }
  
  console.log(`\n   ✅ Contribuição total de ${ticker}: ${totalContribution.toFixed(4)}%`);
  
  return totalContribution;
}

/**
 * Função principal
 */
function main() {
  console.log('🚀 INICIANDO SIMULAÇÃO DE CÁLCULO DO ÍNDICE E CONTRIBUIÇÕES\n');
  console.log('='.repeat(80));
  
  // Calcular retorno total do índice
  const indexReturn = simulateIndexCalculation();
  
  console.log('\n' + '='.repeat(80));
  
  // Calcular contribuições individuais
  const tickers = new Set<string>();
  historyPoints.forEach(point => {
    Object.keys(point.compositionSnapshot).forEach(ticker => tickers.add(ticker));
  });
  
  const individualContributions: Record<string, number> = {};
  let totalIndividualContributions = 0;
  
  console.log('\n=== CALCULANDO CONTRIBUIÇÕES INDIVIDUAIS ===\n');
  
  for (const ticker of Array.from(tickers).sort()) {
    const contribution = simulateIndividualContribution(ticker);
    individualContributions[ticker] = contribution;
    totalIndividualContributions += contribution;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMO FINAL\n');
  console.log(`Retorno total do índice: ${indexReturn.toFixed(4)}%`);
  console.log(`Soma das contribuições individuais: ${totalIndividualContributions.toFixed(4)}%`);
  console.log(`Diferença: ${(indexReturn - totalIndividualContributions).toFixed(4)}%`);
  console.log(`\nContribuições por ativo:`);
  
  for (const [ticker, contribution] of Object.entries(individualContributions).sort((a, b) => 
    Math.abs(b[1]) - Math.abs(a[1])
  )) {
    console.log(`  ${ticker}: ${contribution.toFixed(4)}%`);
  }
  
  console.log('\n' + '='.repeat(80));
}

// Executar simulação
main();

