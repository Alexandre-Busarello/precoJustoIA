// Test using 'new' keyword
const YahooFinance = require('yahoo-finance2').default;

console.log('📦 Testing yahoo-finance2 with "new" keyword:\n');

try {
  const yahooFinance = new YahooFinance();
  
  console.log('✅ Instance created successfully!');
  console.log('typeof yahooFinance:', typeof yahooFinance);
  console.log('Has quote method?', typeof yahooFinance.quote === 'function');
  
  if (typeof yahooFinance.quote === 'function') {
    console.log('\n🧪 Testing quote method...\n');
    
    yahooFinance.quote('PETR4.SA')
      .then(result => {
        console.log('✅ Success!');
        console.log('Price:', result.regularMarketPrice);
        console.log('Symbol:', result.symbol);
      })
      .catch(err => {
        console.log('❌ Error calling quote:', err.message);
      });
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}

