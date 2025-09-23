#!/usr/bin/env node

const axios = require('axios');

async function testFundamentusAPI() {
  console.log('🧪 Testando API do Fundamentus...\n');
  
  const testTickers = ['WEGE3', 'PETR4', 'VALE3'];
  
  for (const ticker of testTickers) {
    try {
      console.log(`🔍 Testando ${ticker}...`);
      
      const response = await axios.get(`http://localhost:8000/stock/${ticker}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'analisador-acoes/1.0.0',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200 && response.data) {
        const data = response.data;
        console.log(`✅ ${ticker}: Dados obtidos`);
        console.log(`   📅 Data extração: ${data.extraction_date}`);
        console.log(`   💰 P/L: ${data.valuation_indicators?.price_divided_by_profit_title?.value || 'N/A'}`);
        console.log(`   📊 ROE: ${data.profitability_indicators?.return_on_equity?.value ? (data.profitability_indicators.return_on_equity.value * 100).toFixed(2) + '%' : 'N/A'}`);
        console.log(`   💵 DY: ${data.valuation_indicators?.dividend_yield?.value ? (data.valuation_indicators.dividend_yield.value * 100).toFixed(2) + '%' : 'N/A'}`);
        console.log('');
      } else {
        console.log(`⚠️  ${ticker}: Resposta inesperada (Status: ${response.status})`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${ticker}: API não está rodando (ECONNREFUSED)`);
        console.log('   💡 Certifique-se de que a API está rodando em http://localhost:8000');
        break;
      } else if (error.response?.status === 404) {
        console.log(`❌ ${ticker}: Ticker não encontrado (404)`);
      } else {
        console.log(`❌ ${ticker}: Erro - ${error.message}`);
      }
    }
    
    // Pequeno delay entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('🧪 Teste concluído!');
}

// Executar teste
testFundamentusAPI().catch(console.error);
