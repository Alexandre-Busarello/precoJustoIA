# Fix: Rebalancing Logic - Sell and Buy Same Asset

## Problem Identified

The rebalancing algorithm is suggesting to SELL and BUY the same asset (ITSA4) in the same rebalancing operation:

1. **SELL_REBALANCE ITSA4**: 96 shares (allocation 9.2% > target 6.3%)
2. **BUY_REBALANCE ITSA4**: 14 shares (allocation 9.2% → target 6.3%)

This creates contradictory suggestions and confuses users.

## Root Cause

In `generateRebalanceTransactions()`, the logic:

1. **Step 1**: Identifies overallocated assets and sells them
2. **Step 2**: Distributes available cash according to target allocation
3. **Issue**: Step 2 doesn't consider that Step 1 already sold shares of the same asset

The algorithm treats selling and buying as separate phases without tracking the net effect.

## Current Problematic Logic

```typescript
// Phase 1: Sell overallocated assets
for (const asset of overallocatedAssets) {
  // Sells ITSA4 because 9.2% > 6.3%
  suggestions.push({
    type: "SELL_REBALANCE",
    ticker: "ITSA4",
    // ...
  });
}

// Phase 2: Buy with available cash
for (const asset of assets) {
  // Buys ITSA4 again because distributing cash by target allocation
  const targetAmount = initialCash * targetAlloc; // 6.3%
  suggestions.push({
    type: "BUY_REBALANCE", 
    ticker: "ITSA4",
    // ...
  });
}
```

## Solution Strategy

### Option 1: Net Position Calculation (Recommended)
Calculate the net position needed for each asset and generate only one transaction per asset.

### Option 2: Track Intermediate Holdings
Update holdings map during the rebalancing process to reflect sells before calculating buys.

### Option 3: Consolidate Transactions
Generate separate sell/buy transactions but consolidate same-asset transactions into net positions.

## Implementation Plan

1. **Calculate target quantities** for each asset based on target allocation
2. **Calculate current quantities** from holdings
3. **Calculate net difference** (target - current)
4. **Generate single transaction** per asset:
   - If net > 0: BUY_REBALANCE
   - If net < 0: SELL_REBALANCE
   - If net ≈ 0: No transaction

## Expected Result

Instead of:
- SELL_REBALANCE ITSA4: 96 shares
- BUY_REBALANCE ITSA4: 14 shares

Generate:
- SELL_REBALANCE ITSA4: 82 shares (96 - 14 = net reduction)

## Files to Modify

- `src/lib/portfolio-transaction-service.ts`
  - Function: `generateRebalanceTransactions()`
  - Add net position calculation logic
  - Consolidate same-asset transactions

## Testing Scenarios

1. **Overallocated asset**: Should only suggest SELL
2. **Underallocated asset**: Should only suggest BUY  
3. **Balanced asset**: Should suggest no transaction
4. **Mixed portfolio**: Multiple assets with different rebalancing needs

## Priority

**HIGH** - This creates user confusion and makes the rebalancing suggestions appear broken.