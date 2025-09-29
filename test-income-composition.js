// Teste da nova red flag para composição do resultado
import { analyzeFinancialStatements } from './src/lib/strategies/overall-score.js';

// Dados de teste - empresa com resultado operacional baixo mas lucro líquido alto
const testData = {
  incomeStatements: [
    {
      endDate: '2023-12-31',
      totalRevenue: 1000000,
      operatingIncome: -50000, // Prejuízo operacional
      netIncome: 200000, // Lucro líquido positivo
      interestIncome: 180000, // Receita financeira alta
      interestExpense: 20000,
      otherIncomeExpenseNet: 90000 // Outras receitas
    },
    {
      endDate: '2022-12-31',
      totalRevenue: 950000,
      operatingIncome: 10000, // Resultado operacional baixo
      netIncome: 150000,
      interestIncome: 120000, // Receita financeira representa 80% do lucro
      interestExpense: 15000,
      otherIncomeExpenseNet: 35000
    },
    {
      endDate: '2021-12-31',
      totalRevenue: 900000,
      operatingIncome: 100000, // Resultado operacional normal
      netIncome: 120000,
      interestIncome: 10000,
      interestExpense: 5000,
      otherIncomeExpenseNet: 15000
    }
  ],
  balanceSheets: [
    {
      endDate: '2023-12-31',
      totalAssets: 5000000,
      totalStockholderEquity: 2000000,
      totalCurrentAssets: 1500000,
      totalCurrentLiabilities: 800000,
      cash: 500000,
      totalLiab: 3000000
    },
    {
      endDate: '2022-12-31',
      totalAssets: 4800000,
      totalStockholderEquity: 1900000,
      totalCurrentAssets: 1400000,
      totalCurrentLiabilities: 750000,
      cash: 450000,
      totalLiab: 2900000
    },
    {
      endDate: '2021-12-31',
      totalAssets: 4600000,
      totalStockholderEquity: 1800000,
      totalCurrentAssets: 1300000,
      totalCurrentLiabilities: 700000,
      cash: 400000,
      totalLiab: 2800000
    }
  ],
  cashflowStatements: [
    {
      endDate: '2023-12-31',
      operatingCashFlow: 150000,
      capitalExpenditures: 50000
    },
    {
      endDate: '2022-12-31',
      operatingCashFlow: 140000,
      capitalExpenditures: 45000
    },
    {
      endDate: '2021-12-31',
      operatingCashFlow: 130000,
      capitalExpenditures: 40000
    }
  ],
  company: {
    ticker: 'TEST4',
    name: 'Empresa Teste',
    sector: 'Technology', // Não financeira
    marketCap: 1000000000
  }
};

console.log('🧪 Testando red flag para composição do resultado...');
console.log('📊 Dados de teste:');
console.log('- 2023: Prejuízo operacional (-50k), Lucro líquido (200k), Receita financeira (160k)');
console.log('- 2022: Resultado operacional baixo (10k), Lucro líquido (150k), Receita financeira (105k)');
console.log('- 2021: Resultado operacional normal (100k), Lucro líquido (120k), Receita financeira (5k)');

try {
  const result = analyzeFinancialStatements(testData);
  
  console.log('\n✅ Resultado da análise:');
  console.log(`Score: ${result.score}`);
  console.log(`Risk Level: ${result.riskLevel}`);
  console.log(`Company Strength: ${result.companyStrength}`);
  
  console.log('\n🚩 Red Flags:');
  result.redFlags.forEach((flag, index) => {
    console.log(`${index + 1}. ${flag}`);
  });
  
  console.log('\n✨ Positive Signals:');
  result.positiveSignals.forEach((signal, index) => {
    console.log(`${index + 1}. ${signal}`);
  });
  
  // Verificar se a red flag específica foi detectada
  const hasIncomeCompositionFlag = result.redFlags.some(flag => 
    flag.includes('Dependência excessiva de resultados não operacionais')
  );
  
  if (hasIncomeCompositionFlag) {
    console.log('\n🎯 ✅ RED FLAG DETECTADA CORRETAMENTE!');
    console.log('A função identificou a dependência excessiva de resultados não operacionais.');
  } else {
    console.log('\n❌ RED FLAG NÃO DETECTADA');
    console.log('A função não identificou o problema na composição do resultado.');
  }
  
} catch (error) {
  console.error('❌ Erro ao executar o teste:', error);
}
