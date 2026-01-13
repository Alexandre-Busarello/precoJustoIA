/**
 * QUOTE SERVICE
 * 
 * Centralized service for fetching stock prices
 * - Primary: Yahoo Finance API (real-time)
 * - Fallback: Local database (daily_quotes)
 */

import { prisma } from '@/lib/prisma';
import { getQuote, getChart, getQuoteWithoutCache, getChartWithoutCache } from './yahooFinance2-service';

export interface StockPrice {
  ticker: string;
  price: number;
  source: 'yahoo' | 'database';
  timestamp: Date;
}

/**
 * Get latest prices for multiple tickers
 * Tries Yahoo Finance first, falls back to database
 * 
 * @param tickers Array of ticker symbols
 * @param skipCache If true, bypasses Yahoo Finance cache (for realtime-return)
 */
export async function getLatestPrices(tickers: string[], skipCache: boolean = false): Promise<Map<string, StockPrice>> {
  const priceMap = new Map<string, StockPrice>();
  
  if (tickers.length === 0) {
    return priceMap;
  }

  // Process each ticker individually for better error handling
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const price = await getTickerPrice(ticker, skipCache);
        if (price) {
          priceMap.set(ticker, price);
        }
      } catch (error) {
        console.error(`❌ [QUOTE SERVICE] Failed to get price for ${ticker}:`, error);
      }
    })
  );

  console.log(`✅ [QUOTE SERVICE] Retrieved ${priceMap.size}/${tickers.length} prices${skipCache ? ' (sem cache)' : ''}`);
  return priceMap;
}

/**
 * Get price for a single ticker
 * Yahoo Finance -> Database fallback
 * Auto-updates database when Yahoo Finance succeeds
 * 
 * @param ticker Ticker symbol
 * @param skipCache If true, bypasses Yahoo Finance cache (for realtime-return)
 */
export async function getTickerPrice(ticker: string, skipCache: boolean = false): Promise<StockPrice | null> {
  // 1. Try Yahoo Finance first
  try {
    const yahooSymbol = `${ticker}.SA`; // Brazilian stocks suffix
    
    // Get quote using yahooFinance2-service (with or without cache based on skipCache)
    const quote: any = skipCache 
      ? await getQuoteWithoutCache(yahooSymbol)
      : await getQuote(yahooSymbol);

    if (quote?.regularMarketPrice) {
      const price = Number(quote.regularMarketPrice);

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
    
    // Try to get quote from Yahoo Finance using yahooFinance2-service
    const quote: any = await getQuote(yahooSymbol);

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
 * Busca preço histórico do Yahoo Finance para uma data específica
 * Prioriza Yahoo Finance, usa banco apenas como fallback
 * 
 * @param ticker Ticker symbol
 * @param targetDate Data alvo para buscar o preço
 * @param skipCache Se true, bypassa o cache do Yahoo Finance (para after market cron)
 */
export async function getYahooHistoricalPrice(
  ticker: string,
  targetDate: Date,
  skipCache: boolean = false
): Promise<number | null> {
  try {
    const yahooSymbol = `${ticker}.SA`;
    
    // Buscar dados do dia específico (usar intervalo diário para precisão)
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 5); // Buscar alguns dias antes para garantir que encontre
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 1); // Até o dia seguinte

    // Usar skipCache quando fornecido (para after market cron que precisa de preços atualizados)
    const result = skipCache
      ? await getChartWithoutCache(yahooSymbol, {
          period1: startDate,
          period2: endDate,
          interval: '1d',
          return: 'array'
        })
      : await getChart(yahooSymbol, {
          period1: startDate,
          period2: endDate,
          interval: '1d', // Dados diários para precisão
          return: 'array'
        });

    // O resultado pode vir como array direto ou como objeto com quotes
    const quotes = Array.isArray(result) ? result : (result?.quotes || []);
    
    if (!quotes || quotes.length === 0) {
      return null;
    }

    // Normalizar data alvo para meia-noite (sem hora) para comparação precisa
    const targetDateNormalized = new Date(targetDate);
    targetDateNormalized.setHours(0, 0, 0, 0);
    const targetDateStr = targetDateNormalized.toISOString().split('T')[0];
    
    // Primeiro, tentar encontrar preço EXATO da data alvo
    let exactMatch: any = null;
    const availableDates: string[] = [];
    for (const quote of quotes) {
      const quoteDate = new Date(quote.date);
      quoteDate.setHours(0, 0, 0, 0);
      const quoteDateStr = quoteDate.toISOString().split('T')[0];
      availableDates.push(quoteDateStr);
      
      // Comparar apenas a data (sem hora)
      if (quoteDateStr === targetDateStr) {
        exactMatch = quote;
        break;
      }
    }
    
    // Log para debug: mostrar datas disponíveis vs data alvo
    if (!exactMatch && availableDates.length > 0) {
      console.log(`🔍 [YAHOO] Target date: ${targetDateStr}, Available dates: ${availableDates.slice(-5).join(', ')} (showing last 5)`);
    }
    
    // Se encontrou match exato, usar ele
    if (exactMatch && exactMatch.close && exactMatch.close > 0) {
      const price = Number(exactMatch.close);
      console.log(`📊 [YAHOO] Found EXACT historical price for ${ticker} on ${targetDateStr}: ${price.toFixed(2)}`);
      return price;
    }
    
    // Se não encontrou match exato, buscar o mais próximo ANTES da data (não depois)
    let closestQuote: any = null;
    let closestDiff = Infinity;
    
    for (const quote of quotes) {
      const quoteDate = new Date(quote.date);
      quoteDate.setHours(0, 0, 0, 0);
      
      // Apenas considerar datas <= targetDate (não datas futuras)
      if (quoteDate <= targetDateNormalized) {
        const diff = Math.abs(quoteDate.getTime() - targetDateNormalized.getTime());
        if (diff < closestDiff) {
          closestQuote = quote;
          closestDiff = diff;
        }
      }
    }
    
    // Se encontrou um preço próximo, usar ele
    if (closestQuote && closestQuote.close && closestQuote.close > 0) {
      const price = Number(closestQuote.close);
      const closestDateStr = new Date(closestQuote.date).toISOString().split('T')[0];
      console.log(`📊 [YAHOO] Found closest historical price for ${ticker} on ${targetDateStr}: ${price.toFixed(2)} (from ${closestDateStr})`);
      return price;
    }

    return null;
  } catch (error) {
    console.warn(`⚠️ [QUOTE SERVICE] Error fetching Yahoo historical price for ${ticker}:`, error);
    return null;
  }
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

  } catch (error) {
    // Log but don't throw - database update is best-effort
    console.error(`  ❌ ${ticker}: Database update failed:`, error instanceof Error ? error.message : error);
  }
}


