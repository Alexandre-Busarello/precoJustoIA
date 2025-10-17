// Test calling the default export as function
const YahooFinanceFactory = require('yahoo-finance2').default;

console.log('📦 Testing yahoo-finance2 as factory function:\n');
console.log('typeof YahooFinanceFactory:', typeof YahooFinanceFactory);

try {
  console.log('Calling YahooFinanceFactory()...');
  const yahooFinance = YahooFinanceFactory();
  
  console.log('typeof result:', typeof yahooFinance);
  console.log('Keys:', Object.keys(yahooFinance).slice(0, 20)); // First 20 keys
  console.log('Has quote method?', typeof yahooFinance.quote === 'function');
  
  if (typeof yahooFinance.quote === 'function') {
    console.log('\n✅ Found quote method! Testing...\n');
    
    yahooFinance.quote('PETR4.SA')
      .then(result => {
        console.log('Success!');
        console.log('Price:', result.regularMarketPrice);
      })
      .catch(err => {
        console.log('Error calling quote:', err.message);
      });
  }
} catch (error) {
  console.log('Error:', error.message);
}

