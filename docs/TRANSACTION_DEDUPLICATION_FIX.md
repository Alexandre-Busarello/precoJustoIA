# Fix: Transaction Deduplication in Portfolio Suggestions

## Problem
The portfolio transaction suggestion system was re-suggesting transactions that had already been confirmed or rejected by users, causing:

1. **CASH_CREDIT duplicates**: Monthly contribution suggestions appearing even after being confirmed/rejected
2. **DIVIDEND duplicates**: Same dividend payments being suggested multiple times for the same asset/month
3. **REBALANCING duplicates**: Buy/sell rebalancing transactions being re-suggested after user decision

## Root Cause
The deduplication logic in `getSuggestedTransactions()` only checked for `PENDING` transactions, ignoring `CONFIRMED` and `REJECTED` transactions. This meant that once a user made a decision on a suggestion, the system would suggest it again on the next recalculation.

## Solution Implemented

### 1. Enhanced Transaction Status Checking
**File**: `src/lib/portfolio-transaction-service.ts`

**Before**:
```typescript
// Only checked PENDING transactions
status: 'PENDING'
```

**After**:
```typescript
// Now checks PENDING, CONFIRMED, and REJECTED transactions
status: { in: ['PENDING', 'CONFIRMED', 'REJECTED'] }
```

### 2. Improved Dividend Deduplication
Added special logic for dividend transactions to prevent suggesting similar amounts:

```typescript
// Special handling for dividends - check for similar amounts
if (suggestion.type === 'DIVIDEND' && suggestion.ticker) {
  const dividendKey = `${suggestion.date.toISOString().split('T')[0]}_${suggestion.ticker}`;
  const existingDividend = existingDividendMap.get(dividendKey);
  
  if (existingDividend) {
    const amountDiff = Math.abs(existingDividend.amount - suggestion.amount);
    const tolerance = Math.max(0.01, suggestion.amount * 0.05); // 5% tolerance
    
    if (amountDiff <= tolerance) {
      // Skip similar dividend
      return false;
    }
  }
}
```

### 3. Smart Transaction Similarity Detection
Created `checkSimilarTransactionExists()` method that:
- For dividends: Checks for similar amounts within the same month (5% tolerance)
- For other transactions: Checks for exact date/type/ticker matches
- Considers all transaction statuses (PENDING/CONFIRMED/REJECTED)

### 4. Enhanced Logging
Improved console logging to show:
- Why transactions are being skipped
- Status of existing transactions
- Dividend amount comparisons
- Deduplication statistics

## Key Changes Made

### 1. `getSuggestedTransactions()` Method
- Changed `existingPending` to `existingTransactions` 
- Added `existingDividendMap` for dividend amount checking
- Enhanced filtering logic to consider all transaction statuses

### 2. `createPendingTransactions()` Method  
- Updated duplicate checking to use new `checkSimilarTransactionExists()` method
- Only returns PENDING transaction IDs (user can still act on them)
- Improved logging for different skip reasons

### 3. New Helper Method
- Added `checkSimilarTransactionExists()` for smart duplicate detection
- Handles dividend amount similarity with configurable tolerance
- Supports exact matching for other transaction types

## Testing
Created `test-transaction-deduplication.js` to verify:
- No duplicate suggestions are generated
- Dividend amount similarity detection works
- Existing transactions are properly considered
- Logging provides clear feedback

## Expected Behavior After Fix

### ✅ CASH_CREDIT (Monthly Contributions)
- If user **confirmed** a monthly contribution → Never suggest again for that month
- If user **rejected** a monthly contribution → Never suggest again for that month  
- Only suggest if no decision was made (PENDING) or if it's a new month

### ✅ DIVIDEND Transactions
- If user **confirmed** a dividend → Never suggest similar amount for same asset/month
- If user **rejected** a dividend → Never suggest similar amount for same asset/month
- Uses 5% tolerance to handle minor amount variations from data sources

### ✅ REBALANCING (Buy/Sell)
- If user **confirmed** rebalancing transactions → Never suggest same transactions again
- If user **rejected** rebalancing transactions → Never suggest same transactions again
- Only suggest new rebalancing if portfolio allocation has changed significantly

## Impact
- **Eliminates** duplicate transaction suggestions
- **Improves** user experience by respecting user decisions
- **Reduces** noise in transaction suggestions
- **Maintains** smart suggestion logic for new scenarios

## Files Modified
1. `src/lib/portfolio-transaction-service.ts` - Main logic improvements
2. `test-transaction-deduplication.js` - Testing script (new)
3. `docs/TRANSACTION_DEDUPLICATION_FIX.md` - This documentation (new)

## Backward Compatibility
✅ **Fully backward compatible** - no database schema changes required
✅ **Existing transactions** are unaffected
✅ **API responses** maintain same structure