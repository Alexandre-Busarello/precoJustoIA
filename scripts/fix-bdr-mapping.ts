#!/usr/bin/env tsx

/**
 * Script para corrigir o mapeamento completo dos dados BDR
 * Mapeia TODOS os dados disponíveis do Yahoo Finance para as tabelas corretas
 */

import { BDRDataService } from '../src/lib/bdr-data-service';
import { prisma } from '../src/lib/prisma';

async function fixBDRMapping() {
  console.log('🔧 CORREÇÃO COMPLETA DO MAPEAMENTO BDR\n');

  const ticker = 'AMZO34.SA';
  const cleanTicker = BDRDataService.cleanTickerForDB(ticker);

  try {
    console.log(`📡 Buscando dados completos do Yahoo Finance para ${ticker}...`);
    
    // 1. Buscar dados completos do Yahoo Finance
    const yahooData = await BDRDataService.fetchBDRData(ticker, true); // Modo completo
    
    if (!yahooData || !yahooData.fundamentalsTimeSeries) {
      console.log('❌ Dados do FundamentalsTimeSeries não disponíveis');
      return;
    }

    // 2. Obter company ID
    const company = await prisma.company.findUnique({
      where: { ticker: cleanTicker.toUpperCase() }
    });

    if (!company) {
      console.log('❌ Empresa não encontrada no banco');
      return;
    }

    console.log(`✅ Empresa encontrada: ${company.name} (ID: ${company.id})`);

    // 3. Processar dados do FundamentalsTimeSeries manualmente
    console.log('\n📊 PROCESSANDO DADOS DO FUNDAMENTALSTIMESERIES:');
    
    const fundamentals = yahooData.fundamentalsTimeSeries;
    
    // Processar dados de Balance Sheet
    await processBalanceSheetData(company.id, ticker, fundamentals);
    
    // Processar dados de Cashflow Statement  
    await processCashflowData(company.id, ticker, fundamentals);
    
    // Processar dados de Income Statement (se disponível)
    await processIncomeStatementData(company.id, ticker, fundamentals);
    
    // Processar Key Statistics
    await processKeyStatisticsData(company.id, ticker, yahooData);

    console.log('\n✅ MAPEAMENTO COMPLETO FINALIZADO!');

  } catch (error: any) {
    console.error('❌ Erro durante correção:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Processa dados de Balance Sheet com mapeamento completo
 */
async function processBalanceSheetData(companyId: number, ticker: string, fundamentals: any) {
  console.log('\n🏦 PROCESSANDO BALANCE SHEETS:');
  
  // Procurar dados em todas as configurações
  const configs = ['annual_all', 'annual_balance-sheet', 'annual_all_validation_error', 'annual_balance-sheet_validation_error'];
  
  for (const configKey of configs) {
    let configData = fundamentals[configKey];
    
    // Se for erro de validação, extrair dados
    if (configData && configData.data && Array.isArray(configData.data)) {
      configData = configData.data;
    }
    
    if (Array.isArray(configData)) {
      console.log(`  📊 ${configKey}: ${configData.length} registros`);
      
      for (const dataPoint of configData) {
        if (dataPoint.date && hasBalanceSheetData(dataPoint)) {
          const year = new Date(dataPoint.date * 1000).getFullYear();
          
          if (year >= 2020 && year <= 2025) {
            console.log(`    📅 Processando ano ${year}:`);
            
            // Log dos dados disponíveis
            const availableFields = Object.keys(dataPoint).filter(key => 
              dataPoint[key] !== null && dataPoint[key] !== undefined && key !== 'date' && key !== 'TYPE' && key !== 'periodType'
            );
            console.log(`      Campos disponíveis: ${availableFields.length}`);
            console.log(`      Principais: totalAssets=${dataPoint.totalAssets}, stockholdersEquity=${dataPoint.stockholdersEquity}`);
            
            // Mapear TODOS os campos disponíveis para o schema
            const balanceData: any = {};
            
            // === ATIVOS ===
            if (dataPoint.totalAssets) balanceData.totalAssets = Number(dataPoint.totalAssets);
            if (dataPoint.currentAssets) balanceData.totalCurrentAssets = Number(dataPoint.currentAssets);
            if (dataPoint.cashAndCashEquivalents) balanceData.cash = Number(dataPoint.cashAndCashEquivalents);
            if (dataPoint.otherShortTermInvestments) balanceData.shortTermInvestments = Number(dataPoint.otherShortTermInvestments);
            if (dataPoint.totalNonCurrentAssets) balanceData.nonCurrentAssets = Number(dataPoint.totalNonCurrentAssets);
            if (dataPoint.totalNonCurrentAssets) balanceData.longTermAssets = Number(dataPoint.totalNonCurrentAssets);
            if (dataPoint.otherNonCurrentAssets) balanceData.otherAssets = Number(dataPoint.otherNonCurrentAssets);
            
            // === PASSIVOS ===
            if (dataPoint.currentLiabilities) balanceData.totalCurrentLiabilities = Number(dataPoint.currentLiabilities);
            if (dataPoint.currentLiabilities) balanceData.currentLiabilities = Number(dataPoint.currentLiabilities);
            if (dataPoint.totalLiabilitiesNetMinorityInterest) balanceData.totalLiab = Number(dataPoint.totalLiabilitiesNetMinorityInterest);
            if (dataPoint.totalNonCurrentLiabilitiesNetMinorityInterest) balanceData.nonCurrentLiabilities = Number(dataPoint.totalNonCurrentLiabilitiesNetMinorityInterest);
            
            // === PATRIMÔNIO LÍQUIDO ===
            if (dataPoint.stockholdersEquity) balanceData.totalStockholderEquity = Number(dataPoint.stockholdersEquity);
            if (dataPoint.stockholdersEquity) balanceData.shareholdersEquity = Number(dataPoint.stockholdersEquity);
            if (dataPoint.commonStock) balanceData.commonStock = Number(dataPoint.commonStock);
            if (dataPoint.treasuryStock) balanceData.treasuryStock = Number(dataPoint.treasuryStock);
            if (dataPoint.retainedEarnings) balanceData.accumulatedProfitsOrLosses = Number(dataPoint.retainedEarnings);
            if (dataPoint.additionalPaidInCapital) balanceData.profitReserves = Number(dataPoint.additionalPaidInCapital);
            if (dataPoint.shareIssued) balanceData.realizedShareCapital = Number(dataPoint.shareIssued);
            if (dataPoint.gainsLossesNotAffectingRetainedEarnings) balanceData.equityValuationAdjustments = Number(dataPoint.gainsLossesNotAffectingRetainedEarnings);
            
            // === OUTROS CAMPOS ===
            if (dataPoint.goodwill) balanceData.goodWill = Number(dataPoint.goodwill);
            if (dataPoint.netTangibleAssets) balanceData.netTangibleAssets = Number(dataPoint.netTangibleAssets);
            
            const endDate = new Date(dataPoint.date * 1000);
            
            try {
              await prisma.balanceSheet.upsert({
                where: {
                  companyId_endDate_period: {
                    companyId,
                    endDate,
                    period: 'YEARLY'
                  }
                },
                update: balanceData,
                create: {
                  companyId,
                  period: 'YEARLY',
                  endDate,
                  ...balanceData
                }
              });
              
              const fieldsCount = Object.keys(balanceData).length;
              console.log(`      ✅ Balance Sheet ${year} salvo com ${fieldsCount} campos`);
              
            } catch (error: any) {
              console.error(`      ❌ Erro ao salvar Balance Sheet ${year}:`, error.message);
            }
          }
        }
      }
    }
  }
}

/**
 * Processa dados de Cashflow Statement com mapeamento completo
 */
async function processCashflowData(companyId: number, ticker: string, fundamentals: any) {
  console.log('\n💰 PROCESSANDO CASHFLOW STATEMENTS:');
  
  // Procurar dados em todas as configurações
  const configs = ['annual_cash-flow', 'annual_all', 'annual_cash-flow_validation_error', 'annual_all_validation_error'];
  
  for (const configKey of configs) {
    let configData = fundamentals[configKey];
    
    // Se for erro de validação, extrair dados
    if (configData && configData.data && Array.isArray(configData.data)) {
      configData = configData.data;
    }
    
    if (Array.isArray(configData)) {
      console.log(`  💸 ${configKey}: ${configData.length} registros`);
      
      for (const dataPoint of configData) {
        if (dataPoint.date && hasCashflowData(dataPoint)) {
          const year = new Date(dataPoint.date * 1000).getFullYear();
          
          if (year >= 2020 && year <= 2025) {
            console.log(`    📅 Processando ano ${year}:`);
            
            // Mapear TODOS os campos disponíveis para o schema
            const cashflowData: any = {};
            
            // === FLUXO DE CAIXA OPERACIONAL ===
            if (dataPoint.operatingCashFlow) cashflowData.operatingCashFlow = Number(dataPoint.operatingCashFlow);
            if (dataPoint.totalCashFromOperatingActivities) cashflowData.operatingCashFlow = Number(dataPoint.totalCashFromOperatingActivities);
            
            // === FLUXO DE CAIXA DE INVESTIMENTO ===
            if (dataPoint.investingCashFlow) cashflowData.investmentCashFlow = Number(dataPoint.investingCashFlow);
            if (dataPoint.totalCashflowsFromInvestingActivities) cashflowData.investmentCashFlow = Number(dataPoint.totalCashflowsFromInvestingActivities);
            
            // === FLUXO DE CAIXA DE FINANCIAMENTO ===
            if (dataPoint.financingCashFlow) cashflowData.financingCashFlow = Number(dataPoint.financingCashFlow);
            if (dataPoint.totalCashFromFinancingActivities) cashflowData.financingCashFlow = Number(dataPoint.totalCashFromFinancingActivities);
            
            // === VARIAÇÃO DO CAIXA ===
            if (dataPoint.changeInCash) cashflowData.increaseOrDecreaseInCash = Number(dataPoint.changeInCash);
            if (dataPoint.beginningCashPosition) cashflowData.initialCashBalance = Number(dataPoint.beginningCashPosition);
            if (dataPoint.endCashPosition) cashflowData.finalCashBalance = Number(dataPoint.endCashPosition);
            
            const endDate = new Date(dataPoint.date * 1000);
            
            try {
              await prisma.cashflowStatement.upsert({
                where: {
                  companyId_endDate_period: {
                    companyId,
                    endDate,
                    period: 'YEARLY'
                  }
                },
                update: cashflowData,
                create: {
                  companyId,
                  period: 'YEARLY',
                  endDate,
                  ...cashflowData
                }
              });
              
              const fieldsCount = Object.keys(cashflowData).length;
              console.log(`      ✅ Cashflow Statement ${year} salvo com ${fieldsCount} campos`);
              console.log(`      📊 Dados: operatingCF=${cashflowData.operatingCashFlow}, investmentCF=${cashflowData.investmentCashFlow}`);
              
            } catch (error: any) {
              console.error(`      ❌ Erro ao salvar Cashflow Statement ${year}:`, error.message);
            }
          }
        }
      }
    }
  }
}

/**
 * Processa dados de Income Statement com mapeamento completo
 */
async function processIncomeStatementData(companyId: number, ticker: string, fundamentals: any) {
  console.log('\n📈 PROCESSANDO INCOME STATEMENTS:');
  
  // Procurar dados em todas as configurações
  const configs = ['annual_financials', 'annual_all', 'annual_financials_validation_error', 'annual_all_validation_error'];
  
  for (const configKey of configs) {
    let configData = fundamentals[configKey];
    
    // Se for erro de validação, extrair dados
    if (configData && configData.data && Array.isArray(configData.data)) {
      configData = configData.data;
    }
    
    if (Array.isArray(configData)) {
      console.log(`  📊 ${configKey}: ${configData.length} registros`);
      
      for (const dataPoint of configData) {
        if (dataPoint.date && hasIncomeStatementData(dataPoint)) {
          const year = new Date(dataPoint.date * 1000).getFullYear();
          
          if (year >= 2020 && year <= 2025) {
            console.log(`    📅 Processando ano ${year}:`);
            
            // Mapear TODOS os campos disponíveis para o schema
            const incomeData: any = {};
            
            // === RECEITAS E CUSTOS ===
            if (dataPoint.totalRevenue) incomeData.totalRevenue = Number(dataPoint.totalRevenue);
            if (dataPoint.costOfRevenue) incomeData.costOfRevenue = Number(dataPoint.costOfRevenue);
            if (dataPoint.grossProfit) incomeData.grossProfit = Number(dataPoint.grossProfit);
            
            // === DESPESAS OPERACIONAIS ===
            if (dataPoint.researchAndDevelopment) incomeData.researchDevelopment = Number(dataPoint.researchAndDevelopment);
            if (dataPoint.sellingGeneralAndAdministrative) incomeData.sellingGeneralAdministrative = Number(dataPoint.sellingGeneralAndAdministrative);
            if (dataPoint.totalOperatingExpenses) incomeData.totalOperatingExpenses = Number(dataPoint.totalOperatingExpenses);
            
            // === RESULTADO OPERACIONAL ===
            if (dataPoint.operatingIncome) incomeData.operatingIncome = Number(dataPoint.operatingIncome);
            if (dataPoint.ebit) incomeData.ebit = Number(dataPoint.ebit);
            
            // === RESULTADO FINANCEIRO ===
            if (dataPoint.interestExpense) incomeData.interestExpense = Number(dataPoint.interestExpense);
            if (dataPoint.incomeBeforeTax) incomeData.incomeBeforeTax = Number(dataPoint.incomeBeforeTax);
            if (dataPoint.incomeTaxExpense) incomeData.incomeTaxExpense = Number(dataPoint.incomeTaxExpense);
            
            // === RESULTADO LÍQUIDO ===
            if (dataPoint.netIncome) incomeData.netIncome = Number(dataPoint.netIncome);
            if (dataPoint.netIncomeApplicableToCommonShares) incomeData.netIncomeApplicableToCommonShares = Number(dataPoint.netIncomeApplicableToCommonShares);
            
            // === LUCRO POR AÇÃO ===
            if (dataPoint.basicEPS) incomeData.basicEarningsPerShare = Number(dataPoint.basicEPS);
            if (dataPoint.dilutedEPS) incomeData.dilutedEarningsPerShare = Number(dataPoint.dilutedEPS);
            
            const endDate = new Date(dataPoint.date * 1000);
            
            try {
              await prisma.incomeStatement.upsert({
                where: {
                  companyId_endDate_period: {
                    companyId,
                    endDate,
                    period: 'YEARLY'
                  }
                },
                update: incomeData,
                create: {
                  companyId,
                  period: 'YEARLY',
                  endDate,
                  ...incomeData
                }
              });
              
              const fieldsCount = Object.keys(incomeData).length;
              console.log(`      ✅ Income Statement ${year} salvo com ${fieldsCount} campos`);
              
            } catch (error: any) {
              console.error(`      ❌ Erro ao salvar Income Statement ${year}:`, error.message);
            }
          }
        }
      }
    }
  }
}

/**
 * Processa dados de Key Statistics
 */
async function processKeyStatisticsData(companyId: number, ticker: string, yahooData: any) {
  console.log('\n📊 PROCESSANDO KEY STATISTICS:');
  
  const keyStats = yahooData.defaultKeyStatistics;
  const quote = yahooData.quote;
  
  if (keyStats || quote) {
    const currentYear = new Date().getFullYear();
    const endDate = new Date(`${currentYear}-12-31`);
    
    const keyStatsData: any = {};
    
    // Mapear dados de Key Statistics
    if (keyStats?.enterpriseValue) keyStatsData.enterpriseValue = Number(keyStats.enterpriseValue);
    if (keyStats?.forwardPE) keyStatsData.forwardPE = Number(keyStats.forwardPE);
    if (keyStats?.profitMargins) keyStatsData.profitMargins = Number(keyStats.profitMargins);
    if (keyStats?.sharesOutstanding) keyStatsData.sharesOutstanding = Number(keyStats.sharesOutstanding);
    if (keyStats?.bookValue) keyStatsData.bookValue = Number(keyStats.bookValue);
    if (keyStats?.priceToBook) keyStatsData.priceToBook = Number(keyStats.priceToBook);
    
    // Mapear dados do Quote
    if (quote?.sharesOutstanding) keyStatsData.sharesOutstanding = Number(quote.sharesOutstanding);
    if (quote?.bookValue) keyStatsData.bookValue = Number(quote.bookValue);
    if (quote?.priceToBook) keyStatsData.priceToBook = Number(quote.priceToBook);
    
    if (Object.keys(keyStatsData).length > 0) {
      try {
        await prisma.keyStatistics.upsert({
          where: {
            companyId_endDate_period: {
              companyId,
              endDate,
              period: 'YEARLY'
            }
          },
          update: keyStatsData,
          create: {
            companyId,
            period: 'YEARLY',
            endDate,
            ...keyStatsData
          }
        });
        
        const fieldsCount = Object.keys(keyStatsData).length;
        console.log(`  ✅ Key Statistics ${currentYear} salvo com ${fieldsCount} campos`);
        
      } catch (error: any) {
        console.error(`  ❌ Erro ao salvar Key Statistics:`, error.message);
      }
    }
  }
}

// Funções auxiliares
function hasBalanceSheetData(dataPoint: any): boolean {
  return !!(dataPoint.totalAssets || dataPoint.stockholdersEquity || 
           dataPoint.currentAssets || dataPoint.currentLiabilities ||
           dataPoint.cashAndCashEquivalents);
}

function hasCashflowData(dataPoint: any): boolean {
  return !!(dataPoint.operatingCashFlow || dataPoint.totalCashFromOperatingActivities ||
           dataPoint.investingCashFlow || dataPoint.totalCashflowsFromInvestingActivities ||
           dataPoint.financingCashFlow || dataPoint.totalCashFromFinancingActivities);
}

function hasIncomeStatementData(dataPoint: any): boolean {
  return !!(dataPoint.totalRevenue || dataPoint.netIncome || 
           dataPoint.operatingIncome || dataPoint.grossProfit);
}

// Executar correção
fixBDRMapping().catch(console.error);