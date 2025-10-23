# Dividend Cache Implementation

## Overview
Implemented Redis caching for the `fetchAndSaveDividends` method to prevent redundant API calls to Yahoo Finance. The cache has a TTL of 4 hours and uses intelligent cache keys based on ticker and startDate parameters.

## Implementation Details

### Cache Key Strategy
- **Pattern**: `dividends:fetch:{ticker}:{startDate}`
- **Examples**:
  - `dividends:fetch:PETR4:all` (no startDate specified)
  - `dividends:fetch:VALE3:2024-01-01` (with specific startDate)

### TTL (Time To Live) Configuration
- **Success Results**: 4 hours (14400 seconds)
- **No Dividends Found**: 4 hours (14400 seconds)
- **Company Not Found**: 1 hour (3600 seconds)
- **API Errors**: 30 minutes (1800 seconds)

### Cache Behavior

#### Cache Hit
```
📦 [DIVIDENDS CACHE HIT] PETR4: Retornando resultado em cache
```
- Returns cached result immediately
- No API calls to Yahoo Finance
- No database writes

#### Cache Miss
```
📊 [DIVIDENDS] Buscando dividendos para PETR4...
✅ [DIVIDENDS] PETR4: 15 dividendos salvos
💾 [DIVIDENDS CACHE SET] PETR4: Resultado cacheado por 4 horas
```
- Fetches from Yahoo Finance API
- Saves to database
- Caches result for future requests

## New Utility Methods

### `clearDividendCache(ticker: string)`
Clears cache for a specific ticker:
```typescript
const deletedKeys = await DividendService.clearDividendCache('PETR4');
// Removes: dividends:fetch:PETR4:*
```

### `clearAllDividendCache()`
Clears all dividend cache entries:
```typescript
const deletedKeys = await DividendService.clearAllDividendCache();
// Removes: dividends:fetch:*
```

### `getDividendCacheInfo()`
Gets information about cached dividend data:
```typescript
const info = await DividendService.getDividendCacheInfo();
// Returns: { totalKeys: 5, keys: [...], redisConnected: true }
```

## Benefits

### Performance Improvements
- **Reduced API Calls**: Prevents repeated Yahoo Finance requests for same ticker
- **Faster Response**: Cached results return in ~1ms vs ~2000ms for API calls
- **Lower Latency**: Eliminates network round-trips for cached data

### System Reliability
- **Rate Limit Protection**: Reduces risk of hitting Yahoo Finance rate limits
- **Graceful Degradation**: Falls back to memory cache if Redis is unavailable
- **Error Resilience**: Caches error results to prevent repeated failed attempts

### Resource Optimization
- **Reduced Database Load**: Fewer unnecessary dividend fetches and saves
- **Network Efficiency**: Minimizes external API dependencies
- **Memory Management**: Automatic cache cleanup with TTL expiration

## Cache Invalidation Strategy

### Automatic Expiration
- Cache entries automatically expire after TTL
- Different TTL for different result types (success vs error)

### Manual Invalidation
- Use `clearDividendCache(ticker)` when dividend data is manually updated
- Use `clearAllDividendCache()` for system maintenance

### Smart Caching
- Error results have shorter TTL to allow retry sooner
- "Company not found" errors cached for 1 hour (may be temporary)
- API errors cached for 30 minutes (transient issues)

## Usage Examples

### Normal Usage (Automatic Caching)
```typescript
// First call - fetches from API and caches
const result1 = await DividendService.fetchAndSaveDividends('PETR4');

// Second call within 4 hours - returns from cache
const result2 = await DividendService.fetchAndSaveDividends('PETR4');
```

### Cache Management
```typescript
// Clear specific ticker cache
await DividendService.clearDividendCache('PETR4');

// Clear all dividend cache
await DividendService.clearAllDividendCache();

// Get cache information
const info = await DividendService.getDividendCacheInfo();
console.log(`${info.totalKeys} tickers cached`);
```

## Monitoring

### Cache Hit/Miss Logs
- Cache hits: `📦 [DIVIDENDS CACHE HIT]`
- Cache sets: `💾 [DIVIDENDS CACHE SET]`
- Cache clears: `🧹 [DIVIDENDS CACHE]`

### Redis Connection Status
```typescript
const info = await DividendService.getDividendCacheInfo();
console.log('Redis connected:', info.redisConnected);
```

## Integration with Existing System

The caching implementation is fully backward compatible:
- No changes required to existing code calling `fetchAndSaveDividends`
- Transparent caching - callers don't need to know about cache
- Fallback to memory cache if Redis is unavailable
- Same return type and behavior as before

This implementation significantly reduces the load on Yahoo Finance API while maintaining data freshness and system reliability.