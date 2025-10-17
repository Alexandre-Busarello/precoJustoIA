// Test script for yahoo-finance2
const yahooFinance = require('yahoo-finance2').default;

async function testYahooFinance() {
  console.log('🧪 Testing yahoo-finance2...\n');
  
  const tickers = ['PETR4.SA', 'VALE3.SA', 'ITSA4.SA'];
  
  for (const ticker of tickers) {
    try {
      console.log(`Fetching ${ticker}...`);
      const quote = await yahooFinance.quote(ticker);
      
      if (quote && quote.regularMarketPrice) {
        console.log(`✅ ${ticker}: R$ ${quote.regularMarketPrice.toFixed(2)}`);
        console.log(`   Symbol: ${quote.symbol}`);
        console.log(`   Market: ${quote.market}`);
      } else {
        console.log(`❌ ${ticker}: No price found`);
      }
    } catch (error) {
      console.log(`❌ ${ticker}: Error - ${error.message}`);
    }
    console.log('');
  }
  
  console.log('✅ Test completed!');
}

testYahooFinance().catch(console.error);

