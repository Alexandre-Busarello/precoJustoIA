/**
 * Test script for dividend caching functionality
 * Run with: node test-dividend-cache.js
 */

const { DividendService } = require('./src/lib/dividend-service');

async function testDividendCache() {
  console.log('🧪 Testing dividend caching...\n');

  const ticker = 'PETR4';
  
  try {
    console.log('=== First Call (should fetch from API) ===');
    const start1 = Date.now();
    const result1 = await DividendService.fetchAndSaveDividends(ticker);
    const time1 = Date.now() - start1;
    
    console.log(`Result 1: ${result1.success ? 'Success' : 'Failed'}`);
    console.log(`Dividends: ${result1.dividendsCount}`);
    console.log(`Time: ${time1}ms\n`);

    console.log('=== Second Call (should use cache) ===');
    const start2 = Date.now();
    const result2 = await DividendService.fetchAndSaveDividends(ticker);
    const time2 = Date.now() - start2;
    
    console.log(`Result 2: ${result2.success ? 'Success' : 'Failed'}`);
    console.log(`Dividends: ${result2.dividendsCount}`);
    console.log(`Time: ${time2}ms\n`);

    console.log('=== Performance Comparison ===');
    console.log(`First call: ${time1}ms (API + DB)`);
    console.log(`Second call: ${time2}ms (Cache)`);
    console.log(`Speed improvement: ${Math.round((time1 / time2) * 100) / 100}x faster\n`);

    console.log('=== Cache Information ===');
    const cacheInfo = await DividendService.getDividendCacheInfo();
    console.log(`Total cached keys: ${cacheInfo.totalKeys}`);
    console.log(`Redis connected: ${cacheInfo.redisConnected}`);
    console.log(`Cached keys:`, cacheInfo.keys);

    console.log('\n✅ Dividend cache test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testDividendCache().catch(console.error);
}

module.exports = { testDividendCache };