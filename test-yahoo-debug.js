// Debug script for yahoo-finance2
const yahooFinance = require('yahoo-finance2');

console.log('📦 yahoo-finance2 module structure:\n');
console.log('typeof yahooFinance:', typeof yahooFinance);
console.log('yahooFinance.default:', typeof yahooFinance.default);
console.log('\nKeys in yahooFinance:');
console.log(Object.keys(yahooFinance));

if (yahooFinance.default) {
  console.log('\nKeys in yahooFinance.default:');
  console.log(Object.keys(yahooFinance.default));
  console.log('\nType of yahooFinance.default.quote:', typeof yahooFinance.default.quote);
}

// Try different ways
console.log('\n🧪 Testing different access patterns:\n');

// Pattern 1: .default.quote
try {
  console.log('Pattern 1: yahooFinance.default.quote');
  console.log('Type:', typeof yahooFinance.default.quote);
} catch (e) {
  console.log('Error:', e.message);
}

// Pattern 2: direct .quote
try {
  console.log('\nPattern 2: yahooFinance.quote');
  console.log('Type:', typeof yahooFinance.quote);
} catch (e) {
  console.log('Error:', e.message);
}

