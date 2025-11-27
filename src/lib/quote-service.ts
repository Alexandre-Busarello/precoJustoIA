/**
 * QUOTE SERVICE
 * 
 * Centralized service for fetching stock prices
 * - Primary: Yahoo Finance API (real-time)
 * - Fallback: Local database (daily_quotes)
 */

import { prisma } from '@/lib/prisma';

// Yahoo Finance instance (lazy-loaded)
let yahooFinanceInstance: any = null;

async function getYahooFinance() {
  if (!yahooFinanceInstance) {
    // Dynamic import to avoid module issues
    const yahooModule = await import('yahoo-finance2');
    const YahooFinance = yahooModule.default;
    
    // Instantiate with new keyword and suppress notices
    yahooFinanceInstance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yahooFinanceInstance;
}

export interface StockPrice {
  ticker: string;
  price: number;
  source: 'yahoo' | 'database';
  timestamp: Date;
}

/**
 * Get latest prices for multiple tickers
 * Tries Yahoo Finance first, falls back to database
 */
export async function getLatestPrices(tickers: string[]): Promise<Map<string, StockPrice>> {
  const priceMap = new Map<string, StockPrice>();
  
  if (tickers.length === 0) {
    return priceMap;
  }

  console.log(`💰 [QUOTE SERVICE] Fetching prices for ${tickers.length} tickers`);

  // Process each ticker individually for better error handling
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const price = await getTickerPrice(ticker);
        if (price) {
          priceMap.set(ticker, price);
        }
      } catch (error) {
        console.error(`❌ [QUOTE SERVICE] Failed to get price for ${ticker}:`, error);
      }
    })
  );

  console.log(`✅ [QUOTE SERVICE] Retrieved ${priceMap.size}/${tickers.length} prices`);
  return priceMap;
}

/**
 * Get price for a single ticker
 * Yahoo Finance -> Database fallback
 * Auto-updates database when Yahoo Finance succeeds
 */
export async function getTickerPrice(ticker: string): Promise<StockPrice | null> {
  // 1. Try Yahoo Finance first
  try {
    const yahooSymbol = `${ticker}.SA`; // Brazilian stocks suffix
    
    // Get yahoo-finance2 instance
    const yahooFinance = await getYahooFinance();
    
    // Get quote using yahoo-finance2
    const quote = await yahooFinance.quote(yahooSymbol);

    if (quote?.regularMarketPrice) {
      const price = Number(quote.regularMarketPrice);
      console.log(`  ✅ ${ticker}: R$ ${price.toFixed(2)} (Yahoo Finance)`);
      
      // Auto-update database with latest price (fire and forget)
      updateDatabasePrice(ticker, price).catch(err => {
        console.error(`  ⚠️ ${ticker}: Failed to update database:`, err.message);
      });
      
      return {
        ticker,
        price,
        source: 'yahoo',
        timestamp: new Date()
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ⚠️ ${ticker}: Yahoo Finance unavailable (${errorMsg}), trying database...`);
  }

  // 2. Fallback to database
  try {
    const dbQuote = await prisma.dailyQuote.findFirst({
      where: {
        company: {
          ticker
        }
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        price: true,
        date: true
      }
    });

    if (dbQuote) {
      console.log(`  📊 ${ticker}: R$ ${Number(dbQuote.price).toFixed(2)} (Database - ${dbQuote.date.toISOString().split('T')[0]})`);
      return {
        ticker,
        price: Number(dbQuote.price),
        source: 'database',
        timestamp: dbQuote.date
      };
    }
  } catch (error) {
    console.error(`  ❌ ${ticker}: Database query failed:`, error);
  }

  console.warn(`  ⚠️ ${ticker}: No price found (Yahoo Finance + Database)`);
  return null;
}

/**
 * Validate if a ticker exists and can be found
 * Throws error if ticker is invalid
 */
export async function validateTicker(ticker: string): Promise<void> {
  console.log(`🔍 [TICKER VALIDATION] Validating ticker: ${ticker}`);
  
  try {
    const yahooSymbol = `${ticker}.SA`; // Brazilian stocks suffix
    
    // Get yahoo-finance2 instance
    const yahooFinance = await getYahooFinance();
    
    // Try to get quote from Yahoo Finance
    const quote = await yahooFinance.quote(yahooSymbol);

    if (quote?.regularMarketPrice) {
      console.log(`  ✅ [TICKER VALID] ${ticker}: Found on Yahoo Finance`);
      return; // Ticker is valid
    }
    
    // If no regularMarketPrice, check if we got any data at all
    if (quote && (quote.symbol || quote.shortName || quote.longName)) {
      console.log(`  ✅ [TICKER VALID] ${ticker}: Found on Yahoo Finance (no current price)`);
      return; // Ticker exists but might not have current price
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ⚠️ [TICKER VALIDATION] ${ticker}: Yahoo Finance error - ${errorMsg}`);
  }

  // Fallback: Check if ticker exists in our database
  try {
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { ticker: true }
    });

    if (company) {
      console.log(`  ✅ [TICKER VALID] ${ticker}: Found in database`);
      return; // Ticker exists in our database
    }
  } catch (error) {
    console.error(`  ❌ [TICKER VALIDATION] ${ticker}: Database query failed:`, error);
  }

  // If we reach here, ticker was not found anywhere
  console.error(`  ❌ [TICKER INVALID] ${ticker}: Not found in Yahoo Finance or database`);
  throw new Error(`Invalid ticker: ${ticker} not found`);
}

/**
 * Get prices with retry logic
 */
export async function getLatestPricesWithRetry(
  tickers: string[],
  maxRetries: number = 2
): Promise<Map<string, StockPrice>> {
  let attempt = 0;
  let prices = new Map<string, StockPrice>();

  while (attempt < maxRetries) {
    prices = await getLatestPrices(tickers);
    
    // If we got all prices, return immediately
    if (prices.size === tickers.length) {
      return prices;
    }

    // Find missing tickers
    const missingTickers = tickers.filter(t => !prices.has(t));
    
    if (missingTickers.length === 0 || attempt === maxRetries - 1) {
      break;
    }

    attempt++;
    console.log(`🔄 [QUOTE SERVICE] Retry ${attempt}/${maxRetries} for ${missingTickers.length} missing tickers`);
    
    // Wait a bit before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return prices;
}

/**
 * Convert price map to simple number map (for backward compatibility)
 */
export function pricesToNumberMap(priceMap: Map<string, StockPrice>): Map<string, number> {
  const numberMap = new Map<string, number>();
  priceMap.forEach((price, ticker) => {
    numberMap.set(ticker, price.price);
  });
  return numberMap;
}

/**
 * Ensure price is updated for today if missing
 * Checks if today's price exists, if not, fetches and updates it
 * Returns true if update was needed and completed, false otherwise
 */
export async function ensureTodayPrice(ticker: string): Promise<boolean> {
  try {
    // 1. Find the company by ticker
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true, ticker: true }
    });

    if (!company) {
      console.log(`  📝 ${ticker}: Company not found in database, skipping price update`);
      return false;
    }

    // 2. Get today's date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3. Check if today's quote already exists
    const todayQuote = await prisma.dailyQuote.findUnique({
      where: {
        companyId_date: {
          companyId: company.id,
          date: today
        }
      },
      select: {
        id: true
      }
    });

    // 4. If today's quote exists, no need to update
    if (todayQuote) {
      console.log(`  ✅ ${ticker}: Price for today already exists, skipping update`);
      return false;
    }

    // 5. If no quote for today, fetch and update
    // getTickerPrice will automatically update the database when it successfully fetches from Yahoo Finance
    console.log(`  🔄 ${ticker}: No price for today, fetching from Yahoo Finance...`);
    const priceData = await getTickerPrice(ticker);
    
    if (priceData && priceData.source === 'yahoo') {
      console.log(`  ✅ ${ticker}: Price updated successfully for today`);
      return true;
    } else {
      console.log(`  ⚠️ ${ticker}: Price update attempted but may not have succeeded`);
      return false;
    }
  } catch (error) {
    // Log but don't throw - price update is best-effort
    console.error(`  ❌ ${ticker}: Error ensuring today's price:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Ensure price is updated for today if missing (background version)
 * Non-blocking version that doesn't wait for completion
 */
export async function ensureTodayPriceBackground(ticker: string): Promise<void> {
  ensureTodayPrice(ticker).catch(error => {
    console.error(`  ❌ ${ticker}: Background price update failed:`, error);
  });
}

/**
 * Update database with latest price from Yahoo Finance
 * Creates or updates the daily_quote for today
 */
async function updateDatabasePrice(ticker: string, price: number): Promise<void> {
  try {
    // 1. Find the company by ticker
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true, ticker: true }
    });

    if (!company) {
      console.log(`  📝 ${ticker}: Company not found in database, skipping update`);
      return;
    }

    // 2. Get today's date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3. Upsert the daily quote (update if exists, create if not)
    await prisma.dailyQuote.upsert({
      where: {
        companyId_date: {
          companyId: company.id,
          date: today
        }
      },
      update: {
        price: price
      },
      create: {
        companyId: company.id,
        date: today,
        price: price
      }
    });

    console.log(`  💾 ${ticker}: Database updated with R$ ${price.toFixed(2)}`);
  } catch (error) {
    // Log but don't throw - database update is best-effort
    console.error(`  ❌ ${ticker}: Database update failed:`, error instanceof Error ? error.message : error);
  }
}

