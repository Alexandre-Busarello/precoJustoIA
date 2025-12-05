import axios from 'axios';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { backgroundPrisma, backgroundPrismaManager } from './prisma-background';
import { TickerProcessingManager } from './ticker-processing-manager';
import { ConcurrencyManager, executeWithRetry, executeWithTimeout } from './concurrency-manager';
// Importar funções do Fundamentus para integração TTM
import { 
  fetchFundamentusData, 
  convertFundamentusToFinancialData,
  calculateAndUpdateAllGrowthMetrics,
  mergeFundamentusWithExistingData,
  processPriceOscillations,
  processQuarterlyFinancials
} from './fetch-data-fundamentus';

// Função para traduzir texto usando Gemini AI
async function translateToPortuguese(text: string, fieldType: 'description' | 'sector' | 'industry' = 'description'): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // Verificar se a API key do Gemini está configurada
  if (!process.env.GEMINI_API_KEY) {
    console.log(`⚠️  GEMINI_API_KEY não configurada, mantendo texto original`);
    return text;
  }

  try {
    const fieldNames = {
      description: 'descrição da empresa',
      sector: 'setor',
      industry: 'indústria'
    };
    
    console.log(`🌐 Traduzindo ${fieldNames[fieldType]} com Gemini AI...`);
    
    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    let prompt: string;
    
    if (fieldType === 'description') {
      prompt = `Traduza o seguinte texto do inglês para português brasileiro de forma natural e fluida, mantendo o contexto empresarial e técnico. Retorne APENAS a tradução, sem explicações adicionais:

"${text}"`;
    } else {
      prompt = `Traduza o seguinte ${fieldType === 'sector' ? 'setor empresarial' : 'ramo de indústria'} do inglês para português brasileiro. Use a terminologia padrão do mercado brasileiro. Retorne APENAS a tradução, sem explicações adicionais:

"${text}"`;
    }

    const model = 'gemini-2.5-flash-lite';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];

    // Fazer chamada para Gemini API (sem ferramentas de busca para tradução simples)
    const response = await ai.models.generateContentStream({
      model,
      contents,
    });

    // Coletar resposta completa
    let translatedText = '';
    for await (const chunk of response) {
      if (chunk.text) {
        translatedText += chunk.text;
      }
    }

    // Limpar a resposta (remover aspas extras, quebras de linha desnecessárias)
    translatedText = translatedText.trim().replace(/^["']|["']$/g, '');

    if (translatedText && translatedText.length > 0 && translatedText !== text) {
      console.log(`✅ ${fieldNames[fieldType].charAt(0).toUpperCase() + fieldNames[fieldType].slice(1)} traduzida com sucesso pelo Gemini`);
      return translatedText;
    }

    console.log(`⚠️  Tradução não disponível, mantendo texto original`);
    return text;

  } catch (error: any) {
    console.log(`⚠️  Erro na tradução com Gemini, mantendo texto original:`, error.message);
    return text;
  }
}

// Interface para resposta básica da Brapi (sem módulos pagos)
interface BrapiBasicResponse {
  results: Array<{
    symbol: string;
    shortName: string;
    longName: string;
    currency: string;
    regularMarketPrice: number;
    logourl?: string;
    sector?: string;
    summaryProfile?: {
      sector?: string;
      industry?: string;
      longBusinessSummary?: string;
      website?: string;
      address1?: string;
      address2?: string;
      address3?: string;
      city?: string;
      state?: string;
      country?: string;
      zip?: string;
      phone?: string;
      fax?: string;
      fullTimeEmployees?: number;
      industryKey?: string;
      industryDisp?: string;
      sectorKey?: string;
      sectorDisp?: string;
    };
  }>;
}

// Carregar variáveis de ambiente
dotenv.config();

// Usar o cliente Prisma otimizado para background
const prisma = backgroundPrisma;

// Interface para a lista de tickers da Ward API
interface WardTickerItem {
  rankScreening: number;
  ticker: string;
  nomeEmpresa: string;
  siteEmpresa: string | null;
  preco: number;
  ev: number;
  dy12Meses: number;
  valuationBazin: number;
  valuationGraham: number;
  valuationJoel: number;
  valuationPeterLynch: number;
  pl: number;
  margemLiquida: number;
  dividaLiquidaEbitda: number;
  roe: number;
  liquidezMediaDiaria: number;
  isFavorited: boolean;
  dataAtualizacao: string | null;
}

// Interface para os dados históricos da Ward API
interface WardHistoricalStock {
  ticker: string;
  ano: string;
  lpa: number;
  pl: number;
  vpa: number;
  pvp: number;
  roe: number;
  roa: number;
  roic: number;
  evEbit: number;
  evEbitda: number;
  liquidezMediaDiaria: number;
  margemEbitda: number;
  margemLiquida: number;
  dividaLiquidaEbitda: number;
  pEbit: number;
  pEbitda: number;
  preco: number;
  precoDiaAnterior: number;
  payout: number;
  liquidezCorrente: number;
  cagrLL5anos: number;
  cagrRL5anos: number;
  receitaLiquida: number;
  lucroLiquido: number;
  lucroBruto: number;
  ebitda: number;
  dy: number;
  dy5Anos: number;
  nroAcoes: number;
  ebit: number;
  dividaBruta: number;
  dividaLiquida: number;
  disponibilidades: number;
  iR_CSLL_Pagos: number;
}

interface WardApiResponse {
  historicalStocks: WardHistoricalStock[];
  stockPrecoTetoProjetivo: any;
  gdPrecoTetoProjetivo: any;
}

// Interfaces para dados da Brapi PRO
interface BrapiBalanceSheet {
  symbol?: string;
  type?: string;
  endDate?: string;
  cash?: number;
  shortTermInvestments?: number;
  totalCurrentAssets?: number;
  longTermInvestments?: number;
  otherAssets?: number;
  totalAssets?: number;
  totalCurrentLiabilities?: number;
  totalLiab?: number;
  commonStock?: number;
  treasuryStock?: number;
  totalStockholderEquity?: number;
  netTangibleAssets?: number;
  goodWill?: number;
  financialAssets?: number;
  centralBankCompulsoryDeposit?: number;
  financialAssetsMeasuredAtFairValueThroughProfitOrLoss?: number;
  longTermAssets?: number;
  creditsFromOperations?: number;
  complementaryPension?: number;
  deferredSellingExpenses?: number;
  nonCurrentAssets?: number;
  deferredTaxes?: number;
  financialLiabilitiesMeasuredAtFairValueThroughIncome?: number;
  financialLiabilitiesAtAmortizedCost?: number;
  provisions?: number;
  shareholdersEquity?: number;
  realizedShareCapital?: number;
  profitReserves?: number;
  accumulatedProfitsOrLosses?: number;
  equityValuationAdjustments?: number;
  currentLiabilities?: number;
  nonCurrentLiabilities?: number;
  thirdPartyDeposits?: number;
  otherDebits?: number;
  updatedAt?: string;
}

interface BrapiIncomeStatement {
  type?: string;
  endDate?: string;
  totalRevenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  researchDevelopment?: number;
  sellingGeneralAdministrative?: number;
  nonRecurring?: number;
  otherOperatingExpenses?: number;
  totalOperatingExpenses?: number;
  operatingIncome?: number;
  totalOtherIncomeExpenseNet?: number;
  ebit?: number;
  interestExpense?: number;
  incomeBeforeTax?: number;
  incomeTaxExpense?: number;
  minorityInterest?: number;
  netIncomeFromContinuingOps?: number;
  discontinuedOperations?: number;
  extraordinaryItems?: number;
  effectOfAccountingCharges?: number;
  otherItems?: number;
  netIncome?: number;
  netIncomeApplicableToCommonShares?: number;
  salesExpenses?: number;
  lossesDueToNonRecoverabilityOfAssets?: number;
  otherOperatingIncome?: number;
  equityIncomeResult?: number;
  financialResult?: number;
  financialIncome?: number;
  financialExpenses?: number;
  currentTaxes?: number;
  deferredTaxes?: number;
  incomeBeforeStatutoryParticipationsAndContributions?: number;
  basicEarningsPerCommonShare?: number;
  dilutedEarningsPerCommonShare?: number;
  basicEarningsPerPreferredShare?: number;
  dilutedEarningsPerPreferredShare?: number;
  profitSharingAndStatutoryContributions?: number;
  claimsAndOperationsCosts?: number;
  administrativeCosts?: number;
  otherOperatingIncomeAndExpenses?: number;
  earningsPerShare?: number;
  basicEarningsPerShare?: number;
  dilutedEarningsPerShare?: number;
  insuranceOperations?: number;
  reinsuranceOperations?: number;
  complementaryPensionOperations?: number;
  capitalizationOperations?: number;
  updatedAt?: string;
}

interface BrapiCashflowStatement {
  symbol?: string;
  type?: string;
  endDate?: string;
  operatingCashFlow?: number;
  incomeFromOperations?: number;
  netIncomeBeforeTaxes?: number;
  adjustmentsToProfitOrLoss?: number;
  changesInAssetsAndLiabilities?: number;
  otherOperatingActivities?: number;
  investmentCashFlow?: number;
  financingCashFlow?: number;
  increaseOrDecreaseInCash?: number;
  initialCashBalance?: number;
  finalCashBalance?: number;
  cashGeneratedInOperations?: number;
  updatedAt?: string;
}

interface BrapiKeyStatistics {
  type?: string;
  symbol?: string;
  enterpriseValue?: number;
  forwardPE?: number;
  profitMargins?: number;
  sharesOutstanding?: number;
  bookValue?: number;
  priceToBook?: number;
  mostRecentQuarter?: string;
  earningsQuarterlyGrowth?: number;
  earningsAnnualGrowth?: number;
  trailingEps?: number;
  enterpriseToRevenue?: number;
  enterpriseToEbitda?: number;
  "52WeekChange"?: number;
  ytdReturn?: number;
  lastDividendValue?: number;
  lastDividendDate?: string;
  dividendYield?: number;
  payoutRatio?: number; // Percentual do lucro distribuído como dividendos
  totalAssets?: number;
  updatedAt?: string;
}

interface BrapiFinancialData {
  symbol?: string;
  currentPrice?: number;
  ebitda?: number;
  quickRatio?: number;
  currentRatio?: number;
  debtToEquity?: number;
  revenuePerShare?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  earningsGrowth?: number;
  revenueGrowth?: number;
  grossMargins?: number;
  ebitdaMargins?: number;
  operatingMargins?: number;
  profitMargins?: number;
  totalCash?: number;
  totalCashPerShare?: number;
  totalDebt?: number;
  totalRevenue?: number;
  grossProfits?: number;
  operatingCashflow?: number;
  freeCashflow?: number;
  financialCurrency?: string;
  updatedAt?: string;
  type?: string;
}

interface BrapiValueAddedStatement {
  symbol?: string;
  type?: string;
  endDate?: string;
  revenue?: number;
  financialIntermediationRevenue?: number;
  updatedAt?: string;
}

interface BrapiProResponse {
  results: Array<{
    symbol: string;
    shortName: string;
    longName: string;
    currency: string;
    regularMarketPrice: number;
    logourl?: string;
    sector?: string;
    summaryProfile?: any;
    balanceSheetHistory?: BrapiBalanceSheet[];
    balanceSheetHistoryQuarterly?: BrapiBalanceSheet[];
    incomeStatementHistory?: BrapiIncomeStatement[];
    incomeStatementHistoryQuarterly?: BrapiIncomeStatement[];
    cashflowHistory?: BrapiCashflowStatement[];
    cashflowHistoryQuarterly?: BrapiCashflowStatement[];
    defaultKeyStatistics?: BrapiKeyStatistics;
    defaultKeyStatisticsHistory?: BrapiKeyStatistics[];
    defaultKeyStatisticsHistoryQuarterly?: BrapiKeyStatistics[];
    financialData?: BrapiFinancialData;
    financialDataHistory?: BrapiFinancialData[];
    financialDataHistoryQuarterly?: BrapiFinancialData[];
    valueAddedHistory?: BrapiValueAddedStatement[];
    valueAddedHistoryQuarterly?: BrapiValueAddedStatement[];
  }>;
}

// Tokens das APIs
const WARD_JWT_TOKEN = process.env.WARD_JWT_TOKEN || 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjE1MDc5IiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvZW1haWxhZGRyZXNzIjoiYnVzYW1hckBnbWFpbC5jb20iLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJVc2VyIiwiaWF0IjoxNzU5MjQ1NDM0LCJhdWQiOlsiaHR0cHM6Ly9kZXYud2FyZC5hcHAuYnIiLCJodHRwczovL3dhcmQuYXBwLmJyIiwiaHR0cHM6Ly90YXNrcy53YXJkLmFwcC5iciJdLCJleHAiOjE3NjA1NDE0MzQsImlzcyI6Imh0dHBzOi8vd2FyZC5hcHAuYnIifQ.2I65KoqcpyjQJtmVDizK2Q0EF4DhfUoUF_1WMME288hpLoDrr1dwGPkqRHINn125Wg2jQ_XX-vrXwOltvrz1gA';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN; // Opcional para plano gratuito

// Função para verificar quais dados históricos já existem no banco
async function checkExistingHistoricalData(companyId: number): Promise<{
  hasBalanceSheets: { yearly: boolean; quarterly: boolean };
  hasIncomeStatements: { yearly: boolean; quarterly: boolean };
  hasCashflowStatements: { yearly: boolean; quarterly: boolean };
  hasKeyStatistics: { yearly: boolean; quarterly: boolean };
  hasValueAddedStatements: { yearly: boolean; quarterly: boolean };
  latestYearlyDate: Date | null;
  latestQuarterlyDate: Date | null;
  hasHistoricalData: boolean;
}> {
  try {
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = new Date(`${currentYear - 2}-01-01`);
    const oneYearAgo = new Date(`${currentYear - 1}-01-01`);

    // Verificar dados anuais (qualquer dado dos últimos 3 anos para considerar que tem histórico)
    const yearlyChecks = await Promise.all([
      prisma.balanceSheet.findFirst({
        where: { companyId, period: 'YEARLY', endDate: { gte: twoYearsAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.incomeStatement.findFirst({
        where: { companyId, period: 'YEARLY', endDate: { gte: twoYearsAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.cashflowStatement.findFirst({
        where: { companyId, period: 'YEARLY', endDate: { gte: twoYearsAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.keyStatistics.findFirst({
        where: { companyId, period: 'YEARLY', endDate: { gte: twoYearsAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.valueAddedStatement.findFirst({
        where: { companyId, period: 'YEARLY', endDate: { gte: twoYearsAgo } },
        orderBy: { endDate: 'desc' }
      })
    ]);

    // Verificar dados trimestrais (qualquer dado do último ano para considerar que tem histórico)
    const quarterlyChecks = await Promise.all([
      prisma.balanceSheet.findFirst({
        where: { companyId, period: 'QUARTERLY', endDate: { gte: oneYearAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.incomeStatement.findFirst({
        where: { companyId, period: 'QUARTERLY', endDate: { gte: oneYearAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.cashflowStatement.findFirst({
        where: { companyId, period: 'QUARTERLY', endDate: { gte: oneYearAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.keyStatistics.findFirst({
        where: { companyId, period: 'QUARTERLY', endDate: { gte: oneYearAgo } },
        orderBy: { endDate: 'desc' }
      }),
      prisma.valueAddedStatement.findFirst({
        where: { companyId, period: 'QUARTERLY', endDate: { gte: oneYearAgo } },
        orderBy: { endDate: 'desc' }
      })
    ]);

    // Encontrar as datas mais recentes
    const latestYearlyDate = yearlyChecks
      .filter(check => check?.endDate)
      .map(check => check!.endDate)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    const latestQuarterlyDate = quarterlyChecks
      .filter(check => check?.endDate)
      .map(check => check!.endDate)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    // Verificar se tem dados históricos suficientes (pelo menos 2 tipos de dados)
    const yearlyDataTypes = yearlyChecks.filter(check => !!check).length;
    const quarterlyDataTypes = quarterlyChecks.filter(check => !!check).length;
    const hasHistoricalData = yearlyDataTypes >= 2 || quarterlyDataTypes >= 2;

    const result = {
      hasBalanceSheets: {
        yearly: !!yearlyChecks[0],
        quarterly: !!quarterlyChecks[0]
      },
      hasIncomeStatements: {
        yearly: !!yearlyChecks[1],
        quarterly: !!quarterlyChecks[1]
      },
      hasCashflowStatements: {
        yearly: !!yearlyChecks[2],
        quarterly: !!quarterlyChecks[2]
      },
      hasKeyStatistics: {
        yearly: !!yearlyChecks[3],
        quarterly: !!quarterlyChecks[3]
      },
      hasValueAddedStatements: {
        yearly: !!yearlyChecks[4],
        quarterly: !!quarterlyChecks[4]
      },
      latestYearlyDate,
      latestQuarterlyDate,
      hasHistoricalData
    };

    console.log(`📊 Dados existentes: ${yearlyDataTypes} tipos anuais, ${quarterlyDataTypes} tipos trimestrais, histórico: ${hasHistoricalData ? '✅' : '❌'}`);
    
    return result;
  } catch (error: any) {
    console.error(`❌ Erro ao verificar dados existentes:`, error.message);
    // Em caso de erro, assumir que não há dados (modo seguro)
    return {
      hasBalanceSheets: { yearly: false, quarterly: false },
      hasIncomeStatements: { yearly: false, quarterly: false },
      hasCashflowStatements: { yearly: false, quarterly: false },
      hasKeyStatistics: { yearly: false, quarterly: false },
      hasValueAddedStatements: { yearly: false, quarterly: false },
      latestYearlyDate: null,
      latestQuarterlyDate: null,
      hasHistoricalData: false
    };
  }
}

// Função para buscar dados completos da Brapi PRO (otimizada)
async function fetchBrapiProData(ticker: string, forceFullUpdate: boolean = false): Promise<BrapiProResponse['results'][0] | null> {
  return executeWithRetry(async () => {
    console.log(`🔍 Buscando dados completos da Brapi PRO para ${ticker}...`);
    
    if (!BRAPI_TOKEN) {
      console.log(`⚠️  BRAPI_TOKEN não configurado, pulando dados da Brapi PRO`);
      return null;
    }

    // Verificar se a empresa existe e se já tem dados históricos
    const company = await prisma.company.findUnique({
      where: { ticker }
    });

    if (!company) {
      console.log(`⚠️  Empresa ${ticker} não encontrada no banco, fazendo fetch completo`);
      forceFullUpdate = true;
    }

    let existingData = null;
    if (company && !forceFullUpdate) {
      existingData = await checkExistingHistoricalData(company.id);
      
      // Se já tem dados históricos suficientes, buscar apenas módulos TTM
      if (existingData.hasHistoricalData) {
        console.log(`📊 ${ticker} já possui dados históricos suficientes, buscando apenas TTM`);
        return await fetchBrapiTTMData(ticker);
      }
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${BRAPI_TOKEN}`,
      'User-Agent': 'analisador-acoes/1.0.0'
    };
    
    const response = await axios.get<BrapiProResponse>(
      `https://brapi.dev/api/quote/${ticker}`,
      {
        headers,
        params: {
          modules: 'balanceSheetHistory,balanceSheetHistoryQuarterly,defaultKeyStatistics,defaultKeyStatisticsHistory,defaultKeyStatisticsHistoryQuarterly,incomeStatementHistory,incomeStatementHistoryQuarterly,financialData,financialDataHistory,financialDataHistoryQuarterly,valueAddedHistory,valueAddedHistoryQuarterly,cashflowHistory,cashflowHistoryQuarterly,summaryProfile'
        },
        timeout: 30000
      }
    );

    if (response.status === 200 && response.data.results && response.data.results.length > 0) {
      const data = response.data.results[0];
      console.log(`✅ Dados completos da Brapi PRO obtidos para ${ticker}:`);
      console.log(`  📊 Balanços: ${data.balanceSheetHistory?.length || 0} anuais, ${data.balanceSheetHistoryQuarterly?.length || 0} trimestrais`);
      console.log(`  📈 DREs: ${data.incomeStatementHistory?.length || 0} anuais, ${data.incomeStatementHistoryQuarterly?.length || 0} trimestrais`);
      console.log(`  💰 DFCs: ${data.cashflowHistory?.length || 0} anuais, ${data.cashflowHistoryQuarterly?.length || 0} trimestrais`);
      console.log(`  📋 Estatísticas: ${data.defaultKeyStatisticsHistory?.length || 0} anuais, ${data.defaultKeyStatisticsHistoryQuarterly?.length || 0} trimestrais`);
      console.log(`  💡 DVAs: ${data.valueAddedHistory?.length || 0} anuais, ${data.valueAddedHistoryQuarterly?.length || 0} trimestrais`);
      return data;
    } else {
      console.log(`⚠️  Nenhum dado encontrado na Brapi PRO para ${ticker}`);
      return null;
    }
  }, 2, 2000); // 2 tentativas, 2s de delay inicial
}

// Função para buscar apenas dados TTM (defaultKeyStatistics e financialData)
async function fetchBrapiTTMData(ticker: string): Promise<BrapiProResponse['results'][0] | null> {
  try {
    console.log(`🔍 Buscando dados TTM da Brapi PRO para ${ticker}...`);
    
    if (!BRAPI_TOKEN) {
      console.log(`⚠️  BRAPI_TOKEN não configurado, pulando dados TTM da Brapi PRO`);
      return null;
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${BRAPI_TOKEN}`,
      'User-Agent': 'analisador-acoes/1.0.0'
    };
    
    const response = await axios.get<BrapiProResponse>(
      `https://brapi.dev/api/quote/${ticker}`,
      {
        headers,
        params: {
          modules: 'defaultKeyStatistics,financialData,summaryProfile'
        },
        timeout: 15000
      }
    );

    if (response.status === 200 && response.data.results && response.data.results.length > 0) {
      const data = response.data.results[0];
      console.log(`✅ Dados TTM da Brapi PRO obtidos para ${ticker}`);
      return data;
    } else {
      console.log(`⚠️  Nenhum dado TTM encontrado na Brapi PRO para ${ticker}`);
      return null;
    }
  } catch (error: any) {
    console.error(`❌ Erro ao buscar dados TTM da Brapi PRO para ${ticker}:`, error.message);
    return null;
  }
}

// Função para buscar dados básicos da empresa na Brapi API (gratuito)
async function fetchBrapiBasicData(ticker: string): Promise<BrapiBasicResponse['results'][0] | null> {
  try {
    console.log(`🔍 Buscando dados básicos da Brapi para ${ticker}...`);
    
    const headers: Record<string, string> = {
      'User-Agent': 'analisador-acoes/1.0.0'
    };
    
    if (BRAPI_TOKEN) {
      headers['Authorization'] = `Bearer ${BRAPI_TOKEN}`;
    }
    
    const response = await axios.get<BrapiBasicResponse>(
      `https://brapi.dev/api/quote/${ticker}`,
      {
        headers,
        params: {
          range: '1d',
          interval: '1d',
          fundamental: 'false', // Não usar módulos pagos
          modules: 'summaryProfile' // Apenas perfil básico (gratuito)
        },
        timeout: 15000
      }
    );

    if (response.status === 200 && response.data.results && response.data.results.length > 0) {
      console.log(`✅ Dados básicos obtidos da Brapi para ${ticker}`);
      return response.data.results[0];
    } else {
      console.log(`⚠️  Nenhum dado encontrado na Brapi para ${ticker}`);
      return null;
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`❌ Empresa ${ticker} não encontrada na Brapi`);
    } else if (error.response?.status === 429) {
      console.log(`⏳ Rate limit atingido na Brapi para ${ticker}, aguardando...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.error(`❌ Erro ao buscar dados da Brapi para ${ticker}:`, error.message);
    }
    return null;
  }
}

// Função para buscar lista de tickers disponíveis na Ward API
async function fetchWardTickers(): Promise<WardTickerItem[]> {
  try {
    console.log('🔍 Buscando lista de tickers da Ward API...');
    
    const response = await axios.get(
      'https://api.ward.app.br/api/tools/screening/GetForSearchInput',
      {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          'origin': 'https://www.ward.app.br',
          'referer': 'https://www.ward.app.br/',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'Cookie': `jwtToken=${WARD_JWT_TOKEN}`
        },
        timeout: 30000
      }
    );

    if (response.status === 200 && Array.isArray(response.data)) {
      console.log(`✅ Lista de tickers obtida: ${response.data.length} empresas encontradas`);
      return response.data;
    } else {
      console.log(`⚠️  Resposta inesperada da Ward API: Status ${response.status}`);
      return [];
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('🔐 Token JWT expirado ou inválido');
    } else {
      console.error('❌ Erro ao buscar lista de tickers da Ward:', error.message);
    }
    return [];
  }
}

// Função para buscar dados de uma empresa na Ward API
async function fetchWardData(ticker: string): Promise<WardApiResponse | null> {
  try {
    return await executeWithRetry(async () => {
      console.log(`🔍 Buscando dados da Ward para ${ticker}...`);
      
      const response = await axios.get(
        `https://api.ward.app.br/api/tools/screening/GetStockForAnalise?ticker=${ticker}`,
        {
          headers: {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://www.ward.app.br',
            'referer': 'https://www.ward.app.br/',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Cookie': `jwtToken=${WARD_JWT_TOKEN}`
          },
          timeout: 30000
        }
      );

      if (response.status === 200 && response.data) {
        console.log(`✅ Dados da Ward obtidos para ${ticker}: ${response.data.historicalStocks?.length || 0} anos`);
        return response.data;
      } else {
        console.log(`⚠️  Resposta inesperada da Ward para ${ticker}: Status ${response.status}`);
        return null;
      }
    }, 3, 1500); // 3 tentativas, 1.5s de delay inicial
  } catch (error: any) {
    // Não lançar erro, apenas logar e retornar null para não interromper processamento
    console.log(`⚠️  Erro ao buscar dados da Ward para ${ticker} após todas as tentativas: ${error.message}`);
    return null;
  }
}

// Interface para dados financeiros completos
interface FinancialDataComplete {
  year: number;
  // Todos os campos do schema Prisma
  pl?: number | null;
  forwardPE?: number | null;
  earningsYield?: number | null;
  pvp?: number | null;
  dy?: number | null;
  evEbitda?: number | null;
  evEbit?: number | null;
  evRevenue?: number | null;
  psr?: number | null;
  pAtivos?: number | null;
  pCapGiro?: number | null;
  pEbit?: number | null;
  lpa?: number | null;
  trailingEps?: number | null;
  vpa?: number | null;
  marketCap?: number | null;
  enterpriseValue?: number | null;
  sharesOutstanding?: number | null;
  totalAssets?: number | null;
  dividaLiquidaPl?: number | null;
  dividaLiquidaEbitda?: number | null;
  liquidezCorrente?: number | null;
  liquidezRapida?: number | null;
  passivoAtivos?: number | null;
  debtToEquity?: number | null;
  roe?: number | null;
  roic?: number | null;
  roa?: number | null;
  margemBruta?: number | null;
  margemEbitda?: number | null;
  margemLiquida?: number | null;
  giroAtivos?: number | null;
  cagrLucros5a?: number | null;
  cagrReceitas5a?: number | null;
  crescimentoLucros?: number | null;
  crescimentoReceitas?: number | null;
  dividendYield12m?: number | null;
  ultimoDividendo?: number | null;
  dataUltimoDividendo?: Date | null;
  payout?: number | null;
  variacao52Semanas?: number | null;
  retornoAnoAtual?: number | null;
  ebitda?: number | null;
  receitaTotal?: number | null;
  lucroLiquido?: number | null;
  fluxoCaixaOperacional?: number | null;
  fluxoCaixaInvestimento?: number | null;
  fluxoCaixaFinanciamento?: number | null;
  fluxoCaixaLivre?: number | null;
  totalCaixa?: number | null;
  totalDivida?: number | null;
  receitaPorAcao?: number | null;
  caixaPorAcao?: number | null;
  ativoCirculante?: number | null;
  ativoTotal?: number | null;
  passivoCirculante?: number | null;
  passivoTotal?: number | null;
  patrimonioLiquido?: number | null;
  caixa?: number | null;
  estoques?: number | null;
  contasReceber?: number | null;
  imobilizado?: number | null;
  intangivel?: number | null;
  dividaCirculante?: number | null;
  dividaLongoPrazo?: number | null;
  dividendoMaisRecente?: number | null;
  dataDividendoMaisRecente?: Date | null;
  historicoUltimosDividendos?: string | null;
  dataSource?: string;
}

// Função para mesclar dados com prioridade: Fundamentus > Ward > Brapi
function mergeFinancialDataWithPriority(
  fundamentusData: any | null, 
  wardData: any | null, 
  brapiData: any | null, 
  year: number
): FinancialDataComplete {
  // Prioridade: Fundamentus > Ward > Brapi
  // Seguir exatamente o schema do Prisma para garantir compatibilidade
  
  // Determinar fonte de dados para metadados
  const sources = [];
  if (fundamentusData) sources.push('fundamentus');
  if (wardData) sources.push('ward');
  if (brapiData) sources.push('brapi');
  const dataSource = sources.join('+');
  
  return {
    year: year,
    
    // === INDICADORES DE VALUATION ===
    pl: fundamentusData?.pl || wardData?.pl || brapiData?.pl || null,
    forwardPE: brapiData?.forwardPE || null, // Só na Brapi
    earningsYield: fundamentusData?.earningsYield || wardData?.earningsYield || brapiData?.earningsYield || null,
    pvp: fundamentusData?.pvp || wardData?.pvp || brapiData?.pvp || null,
    dy: fundamentusData?.dy || wardData?.dy || brapiData?.dy || null,
    evEbitda: fundamentusData?.evEbitda || wardData?.evEbitda || brapiData?.evEbitda || null,
    evEbit: fundamentusData?.evEbit || wardData?.evEbit || brapiData?.evEbit || null,
    evRevenue: brapiData?.evRevenue || null, // Só na Brapi
    psr: fundamentusData?.psr || brapiData?.psr || null,
    pAtivos: fundamentusData?.pAtivos || brapiData?.pAtivos || null,
    pCapGiro: fundamentusData?.pCapGiro || brapiData?.pCapGiro || null,
    pEbit: fundamentusData?.pEbit || wardData?.pEbit || brapiData?.pEbit || null,
    lpa: fundamentusData?.lpa || wardData?.lpa || brapiData?.lpa || null,
    trailingEps: brapiData?.trailingEps || null, // Só na Brapi
    vpa: fundamentusData?.vpa || wardData?.vpa || brapiData?.vpa || null,
    
    // === DADOS DE MERCADO E AÇÕES ===
    marketCap: wardData?.marketCap || brapiData?.marketCap || null, // Ward tem cálculo mais preciso
    enterpriseValue: brapiData?.enterpriseValue || null, // Só na Brapi
    sharesOutstanding: wardData?.sharesOutstanding || brapiData?.sharesOutstanding || null,
    totalAssets: fundamentusData?.ativoTotal || brapiData?.totalAssets || null,
    
    // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
    dividaLiquidaPl: fundamentusData?.dividaLiquidaPl || brapiData?.dividaLiquidaPl || null,
    dividaLiquidaEbitda: fundamentusData?.dividaLiquidaEbitda || wardData?.dividaLiquidaEbitda || brapiData?.dividaLiquidaEbitda || null,
    liquidezCorrente: fundamentusData?.liquidezCorrente || wardData?.liquidezCorrente || brapiData?.liquidezCorrente || null,
    liquidezRapida: brapiData?.liquidezRapida || null, // Só na Brapi
    passivoAtivos: brapiData?.passivoAtivos || null, // Só na Brapi
    debtToEquity: brapiData?.debtToEquity || null, // Só na Brapi
    
    // === INDICADORES DE RENTABILIDADE ===
    roe: fundamentusData?.roe || wardData?.roe || brapiData?.roe || null,
    roic: fundamentusData?.roic || wardData?.roic || brapiData?.roic || null,
    roa: wardData?.roa || brapiData?.roa || null,
    margemBruta: fundamentusData?.margemBruta || brapiData?.margemBruta || null,
    margemEbitda: fundamentusData?.margemEbitda || wardData?.margemEbitda || brapiData?.margemEbitda || null,
    margemLiquida: fundamentusData?.margemLiquida || wardData?.margemLiquida || brapiData?.margemLiquida || null,
    giroAtivos: fundamentusData?.giroAtivos || brapiData?.giroAtivos || null,
    
    // === INDICADORES DE CRESCIMENTO (PRIORIDADE MÁXIMA FUNDAMENTUS - CALCULADOS) ===
    cagrLucros5a: fundamentusData?.cagrLucros5a || wardData?.cagrLucros5a || brapiData?.cagrLucros5a || null,
    cagrReceitas5a: fundamentusData?.cagrReceitas5a || null, // Só no Fundamentus (calculado)
    crescimentoLucros: fundamentusData?.crescimentoLucros || brapiData?.crescimentoLucros || null,
    crescimentoReceitas: fundamentusData?.crescimentoReceitas || wardData?.crescimentoReceitas || brapiData?.crescimentoReceitas || null,
    
    // === DADOS DE DIVIDENDOS ===
    dividendYield12m: fundamentusData?.dividendYield12m || wardData?.dividendYield12m || brapiData?.dividendYield12m || null,
    ultimoDividendo: brapiData?.ultimoDividendo || null, // Só na Brapi
    dataUltimoDividendo: brapiData?.dataUltimoDividendo || null, // Só na Brapi
    payout: wardData?.payout || brapiData?.payout || null, // Ward > Brapi
    
    // === PERFORMANCE E VARIAÇÕES ===
    variacao52Semanas: brapiData?.variacao52Semanas || null, // Só na Brapi
    retornoAnoAtual: brapiData?.retornoAnoAtual || null, // Só na Brapi
    
    // === DADOS FINANCEIROS OPERACIONAIS ===
    ebitda: fundamentusData?.ebitda || wardData?.ebitda || brapiData?.ebitda || null,
    receitaTotal: fundamentusData?.receitaTotal || wardData?.receitaTotal || brapiData?.receitaTotal || null,
    lucroLiquido: fundamentusData?.lucroLiquido || wardData?.lucroLiquido || brapiData?.lucroLiquido || null,
    fluxoCaixaOperacional: brapiData?.fluxoCaixaOperacional || null, // Só na Brapi
    fluxoCaixaInvestimento: brapiData?.fluxoCaixaInvestimento || null, // Só na Brapi
    fluxoCaixaFinanciamento: brapiData?.fluxoCaixaFinanciamento || null, // Só na Brapi
    fluxoCaixaLivre: brapiData?.fluxoCaixaLivre || null, // Só na Brapi
    totalCaixa: fundamentusData?.caixa || wardData?.totalCaixa || brapiData?.totalCaixa || null,
    totalDivida: fundamentusData?.totalDivida || wardData?.totalDivida || brapiData?.totalDivida || null,
    receitaPorAcao: brapiData?.receitaPorAcao || null, // Só na Brapi
    caixaPorAcao: brapiData?.caixaPorAcao || null, // Só na Brapi
    
    // === DADOS DO BALANÇO PATRIMONIAL ===
    ativoCirculante: fundamentusData?.ativoCirculante || brapiData?.ativoCirculante || null,
    ativoTotal: fundamentusData?.ativoTotal || brapiData?.ativoTotal || null,
    passivoCirculante: brapiData?.passivoCirculante || null, // Só na Brapi
    passivoTotal: brapiData?.passivoTotal || null, // Só na Brapi
    patrimonioLiquido: fundamentusData?.patrimonioLiquido || brapiData?.patrimonioLiquido || null,
    caixa: fundamentusData?.caixa || brapiData?.caixa || null,
    estoques: brapiData?.estoques || null, // Só na Brapi
    contasReceber: brapiData?.contasReceber || null, // Só na Brapi
    imobilizado: brapiData?.imobilizado || null, // Só na Brapi
    intangivel: brapiData?.intangivel || null, // Só na Brapi
    dividaCirculante: brapiData?.dividaCirculante || null, // Só na Brapi
    dividaLongoPrazo: brapiData?.dividaLongoPrazo || null, // Só na Brapi
    
    // === DADOS DE DIVIDENDOS DETALHADOS ===
    dividendoMaisRecente: brapiData?.dividendoMaisRecente || null, // Só na Brapi
    dataDividendoMaisRecente: brapiData?.dataDividendoMaisRecente || null, // Só na Brapi
    historicoUltimosDividendos: brapiData?.historicoUltimosDividendos || null, // Só na Brapi
    
    // === METADADOS ===
    dataSource: dataSource
  };
}

// Função para mesclar dados da Ward com dados da Brapi (complementar) - MANTIDA PARA COMPATIBILIDADE
function mergeWardWithBrapiData(wardData: any, brapiData: any, year: number): FinancialDataComplete {
  return mergeFinancialDataWithPriority(null, wardData, brapiData, year);
}

// Função helper para calcular payout quando não disponível
// Retorna payout em decimal (ex: 0.75 = 75%)
function calculatePayout(params: {
  payoutFromAPI?: number | null;
  dividendYield?: number | null; // Em decimal (ex: 0.05 = 5%)
  marketCap?: number | null;
  lpa?: number | null;
  sharesOutstanding?: number | null;
  lucroLiquido?: number | null;
  year?: number; // Para logs
}): number | null {
  const { payoutFromAPI, dividendYield, marketCap, lpa, sharesOutstanding, lucroLiquido, year } = params;
  
  // Se temos payout da API, normalizar para decimal
  let payout = payoutFromAPI || null;
  if (payout && payout > 1) {
    // Se veio em porcentagem (ex: 75), converter para decimal (0.75)
    payout = payout / 100;
  }
  
  if (payout) {
    return payout;
  }
  
  // Tentar calcular usando dividendYield × marketCap e lpa × sharesOutstanding
  if (dividendYield && marketCap && lpa && sharesOutstanding && lpa > 0 && sharesOutstanding > 0) {
    const dividendosTotais = dividendYield * marketCap;
    const lucroLiquidoTotal = lpa * sharesOutstanding;
    
    if (lucroLiquidoTotal > 0) {
      payout = dividendosTotais / lucroLiquidoTotal;
      const yearLabel = year ? `${year} ` : '';
      console.log(`  📊 Payout ${yearLabel}calculado: (${dividendosTotais.toFixed(0)} / ${lucroLiquidoTotal.toFixed(0)}) = ${(payout * 100).toFixed(2)}%`);
      return payout;
    }
  }
  
  // Opção 2: Usar dividendYield × marketCap e lucro líquido direto
  if (dividendYield && marketCap && lucroLiquido && lucroLiquido > 0) {
    const dividendosTotais = dividendYield * marketCap;
    payout = dividendosTotais / lucroLiquido;
    const yearLabel = year ? `${year} ` : '';
    console.log(`  📊 Payout ${yearLabel}calculado (aproximado): (${dividendosTotais.toFixed(0)} / ${lucroLiquido.toFixed(0)}) = ${(payout * 100).toFixed(2)}%`);
    return payout;
  }
  
  return null;
}

// Função helper para calcular ROIC quando não disponível
// Retorna ROIC em decimal (ex: 0.20 = 20%)
// Fórmula: ROIC = EBIT / Invested Capital
// Onde Invested Capital = Total Assets - Current Liabilities (ou Patrimônio Líquido + Dívida Total)
function calculateROIC(params: {
  roicFromAPI?: number | null;
  ebit?: number | null; // EBIT direto
  receitaTotal?: number | null;
  operatingMargins?: number | null; // Margem operacional (em decimal)
  totalAssets?: number | null;
  currentLiabilities?: number | null;
  patrimonioLiquido?: number | null;
  totalDivida?: number | null;
  year?: number; // Para logs
}): number | null {
  const { roicFromAPI, ebit, receitaTotal, operatingMargins, totalAssets, currentLiabilities, patrimonioLiquido, totalDivida, year } = params;
  
  // Se temos ROIC da API, normalizar para decimal
  let roic = roicFromAPI || null;
  if (roic && roic > 1) {
    // Se veio em porcentagem (ex: 20), converter para decimal (0.20)
    roic = roic / 100;
  }
  
  if (roic) {
    return roic;
  }
  
  // Calcular EBIT se não fornecido diretamente
  let calculatedEBIT = ebit || null;
  if (!calculatedEBIT && receitaTotal && operatingMargins) {
    calculatedEBIT = receitaTotal * operatingMargins;
  }
  
  if (!calculatedEBIT || calculatedEBIT <= 0) {
    return null;
  }
  
  // Calcular Invested Capital
  let investedCapital = null;
  
  // Método 1: Total Assets - Current Liabilities (mais comum)
  if (totalAssets && currentLiabilities !== null && currentLiabilities !== undefined) {
    investedCapital = totalAssets - currentLiabilities;
  }
  // Método 2: Patrimônio Líquido + Dívida Total
  else if (patrimonioLiquido && totalDivida !== null && totalDivida !== undefined) {
    investedCapital = patrimonioLiquido + totalDivida;
  }
  // Método 3: Apenas Total Assets (fallback menos preciso)
  else if (totalAssets) {
    investedCapital = totalAssets;
  }
  
  if (investedCapital && investedCapital > 0) {
    roic = calculatedEBIT / investedCapital;
    const yearLabel = year ? `${year} ` : '';
    console.log(`  📊 ROIC ${yearLabel}calculado: (${calculatedEBIT.toFixed(0)} / ${investedCapital.toFixed(0)}) = ${(roic * 100).toFixed(2)}%`);
    return roic;
  }
  
  return null;
}

// Função para converter dados da Ward para o formato do banco
async function convertWardDataToFinancialData(wardStock: WardHistoricalStock, companyId: number) {
  // Converter valores -9999 para null (indicam dados não disponíveis)
  const convertValue = (value: number): number | null => {
    return value === -9999 ? null : value;
  };

  // Calcular earnings yield se possível
  let earningsYield = null;
  if (wardStock.pl && wardStock.pl > 0) {
    earningsYield = 1 / wardStock.pl;
  } else if (wardStock.lpa && wardStock.preco && wardStock.preco > 0) {
    earningsYield = wardStock.lpa / wardStock.preco;
  }

  // Calcular marketCap usando nroAcoes da Ward e preço
  let marketCap = null;
  const nroAcoes = convertValue(wardStock.nroAcoes);
  
  if (nroAcoes && nroAcoes > 0) {
    // Priorizar o preço do próprio ano (histórico)
    if (wardStock.preco && wardStock.preco > 0) {
      marketCap = nroAcoes * wardStock.preco;
      // console.log(`📊 MarketCap calculado para ${wardStock.ano}: ${(nroAcoes / 1000000).toFixed(0)}M ações × R$ ${wardStock.preco.toFixed(2)} = R$ ${(marketCap / 1000000000).toFixed(1)}B`);
    } else {
      // Se não tem preço histórico, tentar buscar cotação atual (fallback)
      try {
        const currentQuote = await prisma.dailyQuote.findFirst({
          where: { companyId },
          orderBy: { date: 'desc' },
          select: { price: true }
        });
        
        if (currentQuote && currentQuote.price) {
          marketCap = nroAcoes * Number(currentQuote.price);
          // console.log(`📊 MarketCap calculado para ${wardStock.ano} (cotação atual): ${(nroAcoes / 1000000).toFixed(0)}M ações × R$ ${Number(currentQuote.price).toFixed(2)} = R$ ${(marketCap / 1000000000).toFixed(1)}B`);
        }
      } catch (error) {
        // Se falhar, usar null
        marketCap = null;
      }
    }
  }
  // Se nroAcoes não é válido, marketCap permanece null (comum para anos históricos na Ward)

  return {
    year: parseInt(wardStock.ano),
    
    // === INDICADORES DE VALUATION ===
    pl: convertValue(wardStock.pl),
    earningsYield: earningsYield,
    pvp: convertValue(wardStock.pvp),
    dy: convertValue(wardStock.dy) ? convertValue(wardStock.dy)! / 100 : null,
    evEbitda: convertValue(wardStock.evEbitda),
    evEbit: convertValue(wardStock.evEbit),
    pEbit: convertValue(wardStock.pEbit),
    lpa: convertValue(wardStock.lpa),
    vpa: convertValue(wardStock.vpa),
    
    // === INDICADORES DE ENDIVIDAMENTO ===
    dividaLiquidaEbitda: convertValue(wardStock.dividaLiquidaEbitda),
    liquidezCorrente: convertValue(wardStock.liquidezCorrente),
    
    // === INDICADORES DE RENTABILIDADE ===
    roe: convertValue(wardStock.roe) ? convertValue(wardStock.roe)! / 100 : null, // Converter % para decimal
    roic: convertValue(wardStock.roic) ? convertValue(wardStock.roic)! / 100 : null,
    roa: convertValue(wardStock.roa) ? convertValue(wardStock.roa)! / 100 : null,
    margemBruta: null, // Não disponível na Ward
    margemEbitda: convertValue(wardStock.margemEbitda) ? convertValue(wardStock.margemEbitda)! / 100 : null,
    margemLiquida: convertValue(wardStock.margemLiquida) ? convertValue(wardStock.margemLiquida)! / 100 : null,
    
    // === INDICADORES DE CRESCIMENTO ===
    cagrLucros5a: convertValue(wardStock.cagrLL5anos) ? convertValue(wardStock.cagrLL5anos)! / 100 : null,
    crescimentoReceitas: convertValue(wardStock.cagrRL5anos) ? convertValue(wardStock.cagrRL5anos)! / 100 : null,
    
    // === DIVIDENDOS ===
    dividendYield12m: convertValue(wardStock.dy) ? convertValue(wardStock.dy)! / 100 : null,
    payout: convertValue(wardStock.payout) ? convertValue(wardStock.payout)! / 100 : null,
    
    // === DADOS DE MERCADO E AÇÕES ===
    marketCap: marketCap,
    sharesOutstanding: nroAcoes,
    
    // === DADOS FINANCEIROS ===
    ebitda: convertValue(wardStock.ebitda),
    receitaTotal: convertValue(wardStock.receitaLiquida),
    lucroLiquido: convertValue(wardStock.lucroLiquido),
    totalDivida: convertValue(wardStock.dividaBruta),
    totalCaixa: convertValue(wardStock.disponibilidades),
    
    // === METADADOS ===
    dataSource: 'ward'
  };
}

// Função para criar/atualizar empresa usando dados básicos da Brapi
async function createOrUpdateCompany(ticker: string): Promise<{ id: number; ticker: string; name: string } | null> {
  try {
    // Primeiro, verificar se a empresa já existe
    let company = await prisma.company.findUnique({
      where: { ticker }
    });

    if (company) {
      console.log(`✅ Empresa ${ticker} já existe no banco`);
      return company;
    }

    // Se não existe, buscar dados básicos da Brapi
    const brapiData = await fetchBrapiBasicData(ticker);
    
    if (!brapiData) {
      console.log(`❌ Não foi possível obter dados básicos para ${ticker}`);
      return null;
    }

    // Criar empresa com dados básicos da Brapi
    const profile = brapiData.summaryProfile;
    
    // Traduzir campos de texto se disponíveis
    let translatedDescription = null;
    let translatedSector = null;
    let translatedIndustry = null;
    
    if (profile?.longBusinessSummary) {
      translatedDescription = await translateToPortuguese(profile.longBusinessSummary, 'description');
    }
    
    if (profile?.sector || brapiData.sector) {
      const sectorToTranslate = profile?.sector || brapiData.sector;
      translatedSector = await translateToPortuguese(sectorToTranslate!, 'sector');
    }
    
    if (profile?.industry) {
      translatedIndustry = await translateToPortuguese(profile.industry, 'industry');
    }
    
    company = await prisma.company.create({
      data: {
        ticker: ticker,
        name: brapiData.longName || brapiData.shortName || ticker,
        sector: translatedSector,
        industry: translatedIndustry,
        description: translatedDescription,
        website: profile?.website || null,
        
        // Dados de localização detalhados
        address: profile?.address1 || null,
        address2: profile?.address2 || null,
        address3: profile?.address3 || null,
        city: profile?.city || null,
        state: profile?.state || null,
        country: profile?.country || null,
        zip: profile?.zip || null,
        
        // Dados de contato
        phone: profile?.phone || null,
        fax: profile?.fax || null,
        
        // Dados corporativos detalhados
        fullTimeEmployees: profile?.fullTimeEmployees || null,
        industryKey: profile?.industryKey || null,
        industryDisp: profile?.industryDisp || null,
        sectorKey: profile?.sectorKey || null,
        sectorDisp: profile?.sectorDisp || null,
        
        logoUrl: brapiData.logourl || null
      }
    });

    console.log(`✅ Empresa criada: ${company.ticker} - ${company.name}`);
    if (company.sector) {
      console.log(`🏭 Setor: ${company.sector}`);
    }

    // Criar cotação atual se disponível
    if (brapiData.regularMarketPrice) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.dailyQuote.upsert({
        where: {
          companyId_date: {
            companyId: company.id,
            date: today
          }
        },
        update: {
          price: brapiData.regularMarketPrice
        },
        create: {
          companyId: company.id,
          date: today,
          price: brapiData.regularMarketPrice
        }
      });

      console.log(`💰 Cotação criada: ${ticker} - R$ ${brapiData.regularMarketPrice}`);
    }

    return company;

  } catch (error: any) {
    console.error(`❌ Erro ao criar empresa ${ticker}:`, error.message);
    return null;
  }
}

// Função para verificar quais dados específicos já existem no banco
async function getExistingDataDates(
  companyId: number, 
  period: 'YEARLY' | 'QUARTERLY'
): Promise<{
  balanceSheetDates: Set<string>;
  incomeStatementDates: Set<string>;
  cashflowStatementDates: Set<string>;
  keyStatisticsDates: Set<string>;
  valueAddedStatementDates: Set<string>;
}> {
  try {
    const [balanceSheets, incomeStatements, cashflowStatements, keyStatistics, valueAddedStatements] = await Promise.all([
      prisma.balanceSheet.findMany({
        where: { companyId, period },
        select: { endDate: true }
      }),
      prisma.incomeStatement.findMany({
        where: { companyId, period },
        select: { endDate: true }
      }),
      prisma.cashflowStatement.findMany({
        where: { companyId, period },
        select: { endDate: true }
      }),
      prisma.keyStatistics.findMany({
        where: { companyId, period },
        select: { endDate: true }
      }),
      prisma.valueAddedStatement.findMany({
        where: { companyId, period },
        select: { endDate: true }
      })
    ]);

    return {
      balanceSheetDates: new Set(balanceSheets.map(item => item.endDate.toISOString().split('T')[0])),
      incomeStatementDates: new Set(incomeStatements.map(item => item.endDate.toISOString().split('T')[0])),
      cashflowStatementDates: new Set(cashflowStatements.map(item => item.endDate.toISOString().split('T')[0])),
      keyStatisticsDates: new Set(keyStatistics.map(item => item.endDate.toISOString().split('T')[0])),
      valueAddedStatementDates: new Set(valueAddedStatements.map(item => item.endDate.toISOString().split('T')[0]))
    };
  } catch (error: any) {
    console.error(`❌ Erro ao verificar dados existentes específicos:`, error.message);
    return {
      balanceSheetDates: new Set(),
      incomeStatementDates: new Set(),
      cashflowStatementDates: new Set(),
      keyStatisticsDates: new Set(),
      valueAddedStatementDates: new Set()
    };
  }
}

// Função para filtrar dados que ainda não existem no banco
function filterMissingData<T extends { endDate?: string; updatedAt?: string }>(
  dataArray: T[] | undefined | null,
  existingDates: Set<string>,
  period: 'YEARLY' | 'QUARTERLY'
): T[] {
  // Verificação mais robusta para garantir que dataArray é um array válido
  if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
    console.log(`  ⚠️  Dados não disponíveis ou não é um array válido para período ${period}`);
    return [];
  }
  
  // Se não há dados existentes, processar todos os dados históricos
  const hasExistingData = existingDates.size > 0;
  
  return dataArray.filter(item => {
    const dateToCheck = item.endDate || item.updatedAt;
    if (!dateToCheck) return false;
    
    const itemDate = new Date(dateToCheck);
    const dateKey = itemDate.toISOString().split('T')[0];
    
    // Se já existe no banco, pular
    if (existingDates.has(dateKey)) return false;
    
    // Se não há dados existentes, processar todos os dados históricos
    if (!hasExistingData) return true;
    
    // Se já há dados existentes, filtrar apenas dados recentes (últimos 2 anos para anuais, 1 ano para trimestrais)
    const cutoffDate = new Date();
    if (period === 'YEARLY') {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
    } else {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    }
    
    return itemDate >= cutoffDate;
  });
}

// Função auxiliar para processar dados com paralelismo controlado
async function processDataConcurrently<T>(
  dataArray: T[],
  processFn: (item: T) => Promise<void>,
  maxConcurrency: number = 3,
  batchSize: number = 10
): Promise<void> {
  if (dataArray.length === 0) return;
  
  console.log(`📦 Processando ${dataArray.length} itens com paralelismo (max ${maxConcurrency})`);
  
  const concurrencyManager = new ConcurrencyManager(maxConcurrency);
  let successful = 0;
  let failed = 0;
  
  // Processar em lotes para controlar melhor o progresso
  for (let i = 0; i < dataArray.length; i += batchSize) {
    const batch = dataArray.slice(i, i + batchSize);
    const batchStartTime = Date.now();
    
    console.log(`  📦 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataArray.length / batchSize)} (${batch.length} itens)`);
    
    const results = await concurrencyManager.executeBatch(
      batch,
      async (item) => {
        try {
          await executeWithTimeout(() => processFn(item), 30000); // 30s timeout por item
          return { success: true };
        } catch (error: any) {
          console.error(`    ❌ Erro no item: ${error.message}`);
          return { success: false, error: error.message };
        }
      },
      maxConcurrency
    );
    
    // Contar sucessos e falhas do lote
    const batchSuccessful = results.filter(r => r.success).length;
    const batchFailed = results.filter(r => !r.success).length;
    successful += batchSuccessful;
    failed += batchFailed;
    
    const batchTime = Date.now() - batchStartTime;
    console.log(`  ✅ Lote concluído em ${Math.round(batchTime / 1000)}s: ${batchSuccessful} sucessos, ${batchFailed} falhas`);
    
    // Log de progresso geral
    if (i + batchSize >= dataArray.length || (i + batchSize) % (batchSize * 2) === 0) {
      const processed = Math.min(i + batchSize, dataArray.length);
      console.log(`  📊 Progresso geral: ${processed}/${dataArray.length} itens processados (${successful} sucessos, ${failed} falhas)`);
    }
  }
  
  console.log(`  🎉 Processamento concluído: ${successful} sucessos, ${failed} falhas`);
}

// Manter função sequencial para casos específicos
async function processDataSequentially<T>(
  dataArray: T[],
  processFn: (item: T) => Promise<void>,
  delayBetweenItems: number = 100
): Promise<void> {
  return processDataConcurrently(dataArray, processFn, 1, dataArray.length);
}

// Função para processar dados do balanço patrimonial (otimizada)
async function processBalanceSheets(
  companyId: number, 
  ticker: string, 
  data: BrapiProResponse['results'][0]
): Promise<void> {
  const processBalanceSheet = async (balanceSheet: BrapiBalanceSheet, period: 'YEARLY' | 'QUARTERLY') => {
    if (!balanceSheet.endDate) return;
    
    try {
      const endDate = new Date(balanceSheet.endDate);
      
      await prisma.balanceSheet.upsert({
          where: {
            companyId_endDate_period: {
              companyId,
              endDate,
              period
            }
          },
          update: {
            cash: balanceSheet.cash || null,
            shortTermInvestments: balanceSheet.shortTermInvestments || null,
            totalCurrentAssets: balanceSheet.totalCurrentAssets || null,
            longTermInvestments: balanceSheet.longTermInvestments || null,
            otherAssets: balanceSheet.otherAssets || null,
            totalAssets: balanceSheet.totalAssets || null,
            totalCurrentLiabilities: balanceSheet.totalCurrentLiabilities || null,
            totalLiab: balanceSheet.totalLiab || null,
            commonStock: balanceSheet.commonStock || null,
            treasuryStock: balanceSheet.treasuryStock || null,
            totalStockholderEquity: balanceSheet.totalStockholderEquity || null,
            netTangibleAssets: balanceSheet.netTangibleAssets || null,
            goodWill: balanceSheet.goodWill || null,
            financialAssets: balanceSheet.financialAssets || null,
            centralBankCompulsoryDeposit: balanceSheet.centralBankCompulsoryDeposit || null,
            financialAssetsMeasuredAtFairValueThroughProfitOrLoss: balanceSheet.financialAssetsMeasuredAtFairValueThroughProfitOrLoss || null,
            longTermAssets: balanceSheet.longTermAssets || null,
            creditsFromOperations: balanceSheet.creditsFromOperations || null,
            complementaryPension: balanceSheet.complementaryPension || null,
            deferredSellingExpenses: balanceSheet.deferredSellingExpenses || null,
            nonCurrentAssets: balanceSheet.nonCurrentAssets || null,
            deferredTaxes: balanceSheet.deferredTaxes || null,
            financialLiabilitiesMeasuredAtFairValueThroughIncome: balanceSheet.financialLiabilitiesMeasuredAtFairValueThroughIncome || null,
            financialLiabilitiesAtAmortizedCost: balanceSheet.financialLiabilitiesAtAmortizedCost || null,
            provisions: balanceSheet.provisions || null,
            shareholdersEquity: balanceSheet.shareholdersEquity || null,
            realizedShareCapital: balanceSheet.realizedShareCapital || null,
            profitReserves: balanceSheet.profitReserves || null,
            accumulatedProfitsOrLosses: balanceSheet.accumulatedProfitsOrLosses || null,
            equityValuationAdjustments: balanceSheet.equityValuationAdjustments || null,
            currentLiabilities: balanceSheet.currentLiabilities || null,
            nonCurrentLiabilities: balanceSheet.nonCurrentLiabilities || null,
            thirdPartyDeposits: balanceSheet.thirdPartyDeposits || null,
            otherDebits: balanceSheet.otherDebits || null
          },
          create: {
            companyId,
            period,
            endDate,
            cash: balanceSheet.cash || null,
            shortTermInvestments: balanceSheet.shortTermInvestments || null,
            totalCurrentAssets: balanceSheet.totalCurrentAssets || null,
            longTermInvestments: balanceSheet.longTermInvestments || null,
            otherAssets: balanceSheet.otherAssets || null,
            totalAssets: balanceSheet.totalAssets || null,
            totalCurrentLiabilities: balanceSheet.totalCurrentLiabilities || null,
            totalLiab: balanceSheet.totalLiab || null,
            commonStock: balanceSheet.commonStock || null,
            treasuryStock: balanceSheet.treasuryStock || null,
            totalStockholderEquity: balanceSheet.totalStockholderEquity || null,
            netTangibleAssets: balanceSheet.netTangibleAssets || null,
            goodWill: balanceSheet.goodWill || null,
            financialAssets: balanceSheet.financialAssets || null,
            centralBankCompulsoryDeposit: balanceSheet.centralBankCompulsoryDeposit || null,
            financialAssetsMeasuredAtFairValueThroughProfitOrLoss: balanceSheet.financialAssetsMeasuredAtFairValueThroughProfitOrLoss || null,
            longTermAssets: balanceSheet.longTermAssets || null,
            creditsFromOperations: balanceSheet.creditsFromOperations || null,
            complementaryPension: balanceSheet.complementaryPension || null,
            deferredSellingExpenses: balanceSheet.deferredSellingExpenses || null,
            nonCurrentAssets: balanceSheet.nonCurrentAssets || null,
            deferredTaxes: balanceSheet.deferredTaxes || null,
            financialLiabilitiesMeasuredAtFairValueThroughIncome: balanceSheet.financialLiabilitiesMeasuredAtFairValueThroughIncome || null,
            financialLiabilitiesAtAmortizedCost: balanceSheet.financialLiabilitiesAtAmortizedCost || null,
            provisions: balanceSheet.provisions || null,
            shareholdersEquity: balanceSheet.shareholdersEquity || null,
            realizedShareCapital: balanceSheet.realizedShareCapital || null,
            profitReserves: balanceSheet.profitReserves || null,
            accumulatedProfitsOrLosses: balanceSheet.accumulatedProfitsOrLosses || null,
            equityValuationAdjustments: balanceSheet.equityValuationAdjustments || null,
            currentLiabilities: balanceSheet.currentLiabilities || null,
            nonCurrentLiabilities: balanceSheet.nonCurrentLiabilities || null,
            thirdPartyDeposits: balanceSheet.thirdPartyDeposits || null,
            otherDebits: balanceSheet.otherDebits || null
          }
        });
    } catch (error: any) {
      console.error(`❌ Erro ao processar balanço ${period} de ${balanceSheet.endDate} para ${ticker}:`, error.message);
    }
  };

  // Verificar dados existentes específicos
  const [yearlyExisting, quarterlyExisting] = await Promise.all([
    getExistingDataDates(companyId, 'YEARLY'),
    getExistingDataDates(companyId, 'QUARTERLY')
  ]);

  // Filtrar e processar balanços anuais (apenas os que não existem)
  const yearlyBalanceSheets = filterMissingData(
    data.balanceSheetHistory, 
    yearlyExisting.balanceSheetDates, 
    'YEARLY'
  );
    
  if (yearlyBalanceSheets.length > 0) {
    console.log(`  📊 Processando ${yearlyBalanceSheets.length} balanços anuais faltantes (de ${data.balanceSheetHistory?.length || 0} totais)`);
    await processDataConcurrently(
      yearlyBalanceSheets,
      (balanceSheet) => processBalanceSheet(balanceSheet, 'YEARLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todos os balanços anuais já existem no banco`);
  }

  // Filtrar e processar balanços trimestrais (apenas os que não existem)
  const quarterlyBalanceSheets = filterMissingData(
    data.balanceSheetHistoryQuarterly, 
    quarterlyExisting.balanceSheetDates, 
    'QUARTERLY'
  );
    
  if (quarterlyBalanceSheets.length > 0) {
    console.log(`  📊 Processando ${quarterlyBalanceSheets.length} balanços trimestrais faltantes (de ${data.balanceSheetHistoryQuarterly?.length || 0} totais)`);
    await processDataConcurrently(
      quarterlyBalanceSheets,
      (balanceSheet) => processBalanceSheet(balanceSheet, 'QUARTERLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todos os balanços trimestrais já existem no banco`);
  }
}

// Função para processar dados da DRE (otimizada)
async function processIncomeStatements(
  companyId: number, 
  ticker: string, 
  data: BrapiProResponse['results'][0], 
): Promise<void> {
  const processIncomeStatement = async (incomeStatement: BrapiIncomeStatement, period: 'YEARLY' | 'QUARTERLY') => {
    if (!incomeStatement.endDate) return;
    
    try {
      const endDate = new Date(incomeStatement.endDate);
      
      await prisma.incomeStatement.upsert({
          where: {
            companyId_endDate_period: {
              companyId,
              endDate,
              period
            }
          },
          update: {
          totalRevenue: incomeStatement.totalRevenue || null,
          costOfRevenue: incomeStatement.costOfRevenue || null,
          grossProfit: incomeStatement.grossProfit || null,
          researchDevelopment: incomeStatement.researchDevelopment || null,
          sellingGeneralAdministrative: incomeStatement.sellingGeneralAdministrative || null,
          nonRecurring: incomeStatement.nonRecurring || null,
          otherOperatingExpenses: incomeStatement.otherOperatingExpenses || null,
          totalOperatingExpenses: incomeStatement.totalOperatingExpenses || null,
          operatingIncome: incomeStatement.operatingIncome || null,
          totalOtherIncomeExpenseNet: incomeStatement.totalOtherIncomeExpenseNet || null,
          ebit: incomeStatement.ebit || null,
          interestExpense: incomeStatement.interestExpense || null,
          incomeBeforeTax: incomeStatement.incomeBeforeTax || null,
          incomeTaxExpense: incomeStatement.incomeTaxExpense || null,
          minorityInterest: incomeStatement.minorityInterest || null,
          netIncomeFromContinuingOps: incomeStatement.netIncomeFromContinuingOps || null,
          discontinuedOperations: incomeStatement.discontinuedOperations || null,
          extraordinaryItems: incomeStatement.extraordinaryItems || null,
          effectOfAccountingCharges: incomeStatement.effectOfAccountingCharges || null,
          otherItems: incomeStatement.otherItems || null,
          netIncome: incomeStatement.netIncome || null,
          netIncomeApplicableToCommonShares: incomeStatement.netIncomeApplicableToCommonShares || null,
          salesExpenses: incomeStatement.salesExpenses || null,
          lossesDueToNonRecoverabilityOfAssets: incomeStatement.lossesDueToNonRecoverabilityOfAssets || null,
          otherOperatingIncome: incomeStatement.otherOperatingIncome || null,
          equityIncomeResult: incomeStatement.equityIncomeResult || null,
          financialResult: incomeStatement.financialResult || null,
          financialIncome: incomeStatement.financialIncome || null,
          financialExpenses: incomeStatement.financialExpenses || null,
          currentTaxes: incomeStatement.currentTaxes || null,
          deferredTaxes: incomeStatement.deferredTaxes || null,
          incomeBeforeStatutoryParticipationsAndContributions: incomeStatement.incomeBeforeStatutoryParticipationsAndContributions || null,
          basicEarningsPerCommonShare: incomeStatement.basicEarningsPerCommonShare || null,
          dilutedEarningsPerCommonShare: incomeStatement.dilutedEarningsPerCommonShare || null,
          basicEarningsPerPreferredShare: incomeStatement.basicEarningsPerPreferredShare || null,
          dilutedEarningsPerPreferredShare: incomeStatement.dilutedEarningsPerPreferredShare || null,
          profitSharingAndStatutoryContributions: incomeStatement.profitSharingAndStatutoryContributions || null,
          claimsAndOperationsCosts: incomeStatement.claimsAndOperationsCosts || null,
          administrativeCosts: incomeStatement.administrativeCosts || null,
          otherOperatingIncomeAndExpenses: incomeStatement.otherOperatingIncomeAndExpenses || null,
          earningsPerShare: incomeStatement.earningsPerShare || null,
          basicEarningsPerShare: incomeStatement.basicEarningsPerShare || null,
          dilutedEarningsPerShare: incomeStatement.dilutedEarningsPerShare || null,
          insuranceOperations: incomeStatement.insuranceOperations || null,
          reinsuranceOperations: incomeStatement.reinsuranceOperations || null,
          complementaryPensionOperations: incomeStatement.complementaryPensionOperations || null,
          capitalizationOperations: incomeStatement.capitalizationOperations || null
        },
        create: {
          companyId,
          period,
          endDate,
          totalRevenue: incomeStatement.totalRevenue || null,
          costOfRevenue: incomeStatement.costOfRevenue || null,
          grossProfit: incomeStatement.grossProfit || null,
          researchDevelopment: incomeStatement.researchDevelopment || null,
          sellingGeneralAdministrative: incomeStatement.sellingGeneralAdministrative || null,
          nonRecurring: incomeStatement.nonRecurring || null,
          otherOperatingExpenses: incomeStatement.otherOperatingExpenses || null,
          totalOperatingExpenses: incomeStatement.totalOperatingExpenses || null,
          operatingIncome: incomeStatement.operatingIncome || null,
          totalOtherIncomeExpenseNet: incomeStatement.totalOtherIncomeExpenseNet || null,
          ebit: incomeStatement.ebit || null,
          interestExpense: incomeStatement.interestExpense || null,
          incomeBeforeTax: incomeStatement.incomeBeforeTax || null,
          incomeTaxExpense: incomeStatement.incomeTaxExpense || null,
          minorityInterest: incomeStatement.minorityInterest || null,
          netIncomeFromContinuingOps: incomeStatement.netIncomeFromContinuingOps || null,
          discontinuedOperations: incomeStatement.discontinuedOperations || null,
          extraordinaryItems: incomeStatement.extraordinaryItems || null,
          effectOfAccountingCharges: incomeStatement.effectOfAccountingCharges || null,
          otherItems: incomeStatement.otherItems || null,
          netIncome: incomeStatement.netIncome || null,
          netIncomeApplicableToCommonShares: incomeStatement.netIncomeApplicableToCommonShares || null,
          salesExpenses: incomeStatement.salesExpenses || null,
          lossesDueToNonRecoverabilityOfAssets: incomeStatement.lossesDueToNonRecoverabilityOfAssets || null,
          otherOperatingIncome: incomeStatement.otherOperatingIncome || null,
          equityIncomeResult: incomeStatement.equityIncomeResult || null,
          financialResult: incomeStatement.financialResult || null,
          financialIncome: incomeStatement.financialIncome || null,
          financialExpenses: incomeStatement.financialExpenses || null,
          currentTaxes: incomeStatement.currentTaxes || null,
          deferredTaxes: incomeStatement.deferredTaxes || null,
          incomeBeforeStatutoryParticipationsAndContributions: incomeStatement.incomeBeforeStatutoryParticipationsAndContributions || null,
          basicEarningsPerCommonShare: incomeStatement.basicEarningsPerCommonShare || null,
          dilutedEarningsPerCommonShare: incomeStatement.dilutedEarningsPerCommonShare || null,
          basicEarningsPerPreferredShare: incomeStatement.basicEarningsPerPreferredShare || null,
          dilutedEarningsPerPreferredShare: incomeStatement.dilutedEarningsPerPreferredShare || null,
          profitSharingAndStatutoryContributions: incomeStatement.profitSharingAndStatutoryContributions || null,
          claimsAndOperationsCosts: incomeStatement.claimsAndOperationsCosts || null,
          administrativeCosts: incomeStatement.administrativeCosts || null,
          otherOperatingIncomeAndExpenses: incomeStatement.otherOperatingIncomeAndExpenses || null,
          earningsPerShare: incomeStatement.earningsPerShare || null,
          basicEarningsPerShare: incomeStatement.basicEarningsPerShare || null,
          dilutedEarningsPerShare: incomeStatement.dilutedEarningsPerShare || null,
          insuranceOperations: incomeStatement.insuranceOperations || null,
          reinsuranceOperations: incomeStatement.reinsuranceOperations || null,
          complementaryPensionOperations: incomeStatement.complementaryPensionOperations || null,
          capitalizationOperations: incomeStatement.capitalizationOperations || null
        }});
    } catch (error: any) {
      console.error(`❌ Erro ao processar DRE ${period} de ${incomeStatement.endDate} para ${ticker}:`, error.message);
    }
  };

  // Verificar dados existentes específicos
  const [yearlyExisting, quarterlyExisting] = await Promise.all([
    getExistingDataDates(companyId, 'YEARLY'),
    getExistingDataDates(companyId, 'QUARTERLY')
  ]);

  // Filtrar e processar DREs anuais (apenas as que não existem)
  const yearlyIncomeStatements = filterMissingData(
    data.incomeStatementHistory, 
    yearlyExisting.incomeStatementDates, 
    'YEARLY'
  );
    
  if (yearlyIncomeStatements.length > 0) {
    console.log(`  📈 Processando ${yearlyIncomeStatements.length} DREs anuais faltantes (de ${data.incomeStatementHistory?.length || 0} totais)`);
    await processDataConcurrently(
      yearlyIncomeStatements,
      (incomeStatement) => processIncomeStatement(incomeStatement, 'YEARLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as DREs anuais já existem no banco`);
  }

  // Filtrar e processar DREs trimestrais (apenas as que não existem)
  const quarterlyIncomeStatements = filterMissingData(
    data.incomeStatementHistoryQuarterly, 
    quarterlyExisting.incomeStatementDates, 
    'QUARTERLY'
  );
    
  if (quarterlyIncomeStatements.length > 0) {
    console.log(`  📈 Processando ${quarterlyIncomeStatements.length} DREs trimestrais faltantes (de ${data.incomeStatementHistoryQuarterly?.length || 0} totais)`);
    await processDataConcurrently(
      quarterlyIncomeStatements,
      (incomeStatement) => processIncomeStatement(incomeStatement, 'QUARTERLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as DREs trimestrais já existem no banco`);
  }
}

// Função para processar dados do fluxo de caixa (otimizada)
async function processCashflowStatements(
  companyId: number, 
  ticker: string, 
  data: BrapiProResponse['results'][0], 
): Promise<void> {
  const processCashflowStatement = async (cashflowStatement: BrapiCashflowStatement, period: 'YEARLY' | 'QUARTERLY') => {
    if (!cashflowStatement.endDate) return;
    
    try {
      const endDate = new Date(cashflowStatement.endDate);
      
      await prisma.cashflowStatement.upsert({
          where: {
            companyId_endDate_period: {
              companyId,
              endDate,
              period
            }
          },
          update: {
          operatingCashFlow: cashflowStatement.operatingCashFlow || null,
          incomeFromOperations: cashflowStatement.incomeFromOperations || null,
          netIncomeBeforeTaxes: cashflowStatement.netIncomeBeforeTaxes || null,
          adjustmentsToProfitOrLoss: cashflowStatement.adjustmentsToProfitOrLoss || null,
          changesInAssetsAndLiabilities: cashflowStatement.changesInAssetsAndLiabilities || null,
          otherOperatingActivities: cashflowStatement.otherOperatingActivities || null,
          investmentCashFlow: cashflowStatement.investmentCashFlow || null,
          financingCashFlow: cashflowStatement.financingCashFlow || null,
          increaseOrDecreaseInCash: cashflowStatement.increaseOrDecreaseInCash || null,
          initialCashBalance: cashflowStatement.initialCashBalance || null,
          finalCashBalance: cashflowStatement.finalCashBalance || null,
          cashGeneratedInOperations: cashflowStatement.cashGeneratedInOperations || null
        },
        create: {
          companyId,
          period,
          endDate,
          operatingCashFlow: cashflowStatement.operatingCashFlow || null,
          incomeFromOperations: cashflowStatement.incomeFromOperations || null,
          netIncomeBeforeTaxes: cashflowStatement.netIncomeBeforeTaxes || null,
          adjustmentsToProfitOrLoss: cashflowStatement.adjustmentsToProfitOrLoss || null,
          changesInAssetsAndLiabilities: cashflowStatement.changesInAssetsAndLiabilities || null,
          otherOperatingActivities: cashflowStatement.otherOperatingActivities || null,
          investmentCashFlow: cashflowStatement.investmentCashFlow || null,
          financingCashFlow: cashflowStatement.financingCashFlow || null,
          increaseOrDecreaseInCash: cashflowStatement.increaseOrDecreaseInCash || null,
          initialCashBalance: cashflowStatement.initialCashBalance || null,
          finalCashBalance: cashflowStatement.finalCashBalance || null,
          cashGeneratedInOperations: cashflowStatement.cashGeneratedInOperations || null
        }});
    } catch (error: any) {
      console.error(`❌ Erro ao processar DFC ${period} de ${cashflowStatement.endDate} para ${ticker}:`, error.message);
    }
  };

  // Verificar dados existentes específicos
  const [yearlyExisting, quarterlyExisting] = await Promise.all([
    getExistingDataDates(companyId, 'YEARLY'),
    getExistingDataDates(companyId, 'QUARTERLY')
  ]);

  // Filtrar e processar DFCs anuais (apenas os que não existem)
  const yearlyCashflowStatements = filterMissingData(
    data.cashflowHistory, 
    yearlyExisting.cashflowStatementDates, 
    'YEARLY'
  );
    
  if (yearlyCashflowStatements.length > 0) {
    console.log(`  💰 Processando ${yearlyCashflowStatements.length} DFCs anuais faltantes (de ${data.cashflowHistory?.length || 0} totais)`);
    await processDataConcurrently(
      yearlyCashflowStatements,
      (cashflowStatement) => processCashflowStatement(cashflowStatement, 'YEARLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as DFCs anuais já existem no banco`);
  }

  // Filtrar e processar DFCs trimestrais (apenas os que não existem)
  const quarterlyCashflowStatements = filterMissingData(
    data.cashflowHistoryQuarterly, 
    quarterlyExisting.cashflowStatementDates, 
    'QUARTERLY'
  );
    
  if (quarterlyCashflowStatements.length > 0) {
    console.log(`  💰 Processando ${quarterlyCashflowStatements.length} DFCs trimestrais faltantes (de ${data.cashflowHistoryQuarterly?.length || 0} totais)`);
    await processDataConcurrently(
      quarterlyCashflowStatements,
      (cashflowStatement) => processCashflowStatement(cashflowStatement, 'QUARTERLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as DFCs trimestrais já existem no banco`);
  }
}

// Função para processar estatística TTM específica (busca e atualiza o registro mais recente do ano)
async function processKeyStatisticTTM(
  companyId: number,
  ticker: string,
  keyStatistic: BrapiKeyStatistics,
  currentYear: number
): Promise<void> {
  try {
    // Buscar o registro mais recente do ano atual para período YEARLY
    const startOfYear = new Date(`${currentYear}-01-01`);
    const endOfYear = new Date(`${currentYear}-12-31`);
    
    const existingRecord = await prisma.keyStatistics.findFirst({
      where: {
        companyId,
        period: 'YEARLY',
        endDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      orderBy: {
        endDate: 'desc'
      }
    });
    
    const updateData = {
      enterpriseValue: keyStatistic.enterpriseValue || null,
      forwardPE: keyStatistic.forwardPE || null,
      profitMargins: keyStatistic.profitMargins || null,
      sharesOutstanding: keyStatistic.sharesOutstanding || null,
      bookValue: keyStatistic.bookValue || null,
      priceToBook: keyStatistic.priceToBook || null,
      mostRecentQuarter: keyStatistic.mostRecentQuarter ? new Date(keyStatistic.mostRecentQuarter) : null,
      earningsQuarterlyGrowth: keyStatistic.earningsQuarterlyGrowth || null,
      earningsAnnualGrowth: keyStatistic.earningsAnnualGrowth || null,
      trailingEps: keyStatistic.trailingEps || null,
      enterpriseToRevenue: keyStatistic.enterpriseToRevenue || null,
      enterpriseToEbitda: keyStatistic.enterpriseToEbitda || null,
      fiftyTwoWeekChange: keyStatistic["52WeekChange"] || null,
      ytdReturn: keyStatistic.ytdReturn || null,
      lastDividendValue: keyStatistic.lastDividendValue || null,
      lastDividendDate: keyStatistic.lastDividendDate ? new Date(keyStatistic.lastDividendDate) : null,
      dividendYield: keyStatistic.dividendYield || null,
      totalAssets: keyStatistic.totalAssets || null
    };
    
    if (existingRecord) {
      // Atualizar o registro existente mais recente do ano
      await prisma.keyStatistics.update({
        where: { id: existingRecord.id },
        data: updateData
      });
      console.log(`    🔄 Estatística TTM atualizada (endDate: ${existingRecord.endDate.toISOString().split('T')[0]})`);
    } else {
      // Se não existe nenhum registro do ano atual, criar um novo com data de final do ano
      const endDate = new Date(`${currentYear}-12-31`);
      await prisma.keyStatistics.create({
        data: {
          companyId,
          period: 'YEARLY',
          endDate,
          ...updateData
        }
      });
      console.log(`    ✨ Nova estatística TTM criada (endDate: ${endDate.toISOString().split('T')[0]})`);
    }
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar estatística TTM para ${ticker}:`, error.message);
  }
}

// Função para processar estatísticas-chave (otimizada)
async function processKeyStatistics(
  companyId: number, 
  ticker: string, 
  data: BrapiProResponse['results'][0]
): Promise<void> {
  const processKeyStatistic = async (keyStatistic: BrapiKeyStatistics, period: 'YEARLY' | 'QUARTERLY') => {
    if (!keyStatistic.updatedAt) return;
    
    try {
      const endDate = new Date(keyStatistic.updatedAt);
      
      await prisma.keyStatistics.upsert({
        where: {
          companyId_endDate_period: {
            companyId,
            endDate,
            period
          }
        },
        update: {
          enterpriseValue: keyStatistic.enterpriseValue || null,
          forwardPE: keyStatistic.forwardPE || null,
          profitMargins: keyStatistic.profitMargins || null,
          sharesOutstanding: keyStatistic.sharesOutstanding || null,
          bookValue: keyStatistic.bookValue || null,
          priceToBook: keyStatistic.priceToBook || null,
          mostRecentQuarter: keyStatistic.mostRecentQuarter ? new Date(keyStatistic.mostRecentQuarter) : null,
          earningsQuarterlyGrowth: keyStatistic.earningsQuarterlyGrowth || null,
          earningsAnnualGrowth: keyStatistic.earningsAnnualGrowth || null,
          trailingEps: keyStatistic.trailingEps || null,
          enterpriseToRevenue: keyStatistic.enterpriseToRevenue || null,
          enterpriseToEbitda: keyStatistic.enterpriseToEbitda || null,
          fiftyTwoWeekChange: keyStatistic["52WeekChange"] || null,
          ytdReturn: keyStatistic.ytdReturn || null,
          lastDividendValue: keyStatistic.lastDividendValue || null,
          lastDividendDate: keyStatistic.lastDividendDate ? new Date(keyStatistic.lastDividendDate) : null,
          dividendYield: keyStatistic.dividendYield || null,
          totalAssets: keyStatistic.totalAssets || null
        },
        create: {
          companyId,
          period,
          endDate,
          enterpriseValue: keyStatistic.enterpriseValue || null,
          forwardPE: keyStatistic.forwardPE || null,
          profitMargins: keyStatistic.profitMargins || null,
          sharesOutstanding: keyStatistic.sharesOutstanding || null,
          bookValue: keyStatistic.bookValue || null,
          priceToBook: keyStatistic.priceToBook || null,
          mostRecentQuarter: keyStatistic.mostRecentQuarter ? new Date(keyStatistic.mostRecentQuarter) : null,
          earningsQuarterlyGrowth: keyStatistic.earningsQuarterlyGrowth || null,
          earningsAnnualGrowth: keyStatistic.earningsAnnualGrowth || null,
          trailingEps: keyStatistic.trailingEps || null,
          enterpriseToRevenue: keyStatistic.enterpriseToRevenue || null,
          enterpriseToEbitda: keyStatistic.enterpriseToEbitda || null,
          fiftyTwoWeekChange: keyStatistic["52WeekChange"] || null,
          ytdReturn: keyStatistic.ytdReturn || null,
          lastDividendValue: keyStatistic.lastDividendValue || null,
          lastDividendDate: keyStatistic.lastDividendDate ? new Date(keyStatistic.lastDividendDate) : null,
          dividendYield: keyStatistic.dividendYield || null,
          totalAssets: keyStatistic.totalAssets || null
        }
      });
    } catch (error: any) {
      console.error(`❌ Erro ao processar estatística ${period} de ${keyStatistic.updatedAt} para ${ticker}:`, error.message);
    }
  };

  // Processar estatística TTM atual (sempre atualizar)
  if (data.defaultKeyStatistics) {
    const currentYear = new Date().getFullYear();
    
    // Para dados TTM, buscar o registro mais recente do ano atual e atualizar
    // ao invés de criar um novo registro com data atual
    await processKeyStatisticTTM(companyId, ticker, data.defaultKeyStatistics, currentYear);
    console.log(`  📋 Estatística TTM processada para ${currentYear}`);
  }

  // Verificar dados existentes específicos
  const [yearlyExisting, quarterlyExisting] = await Promise.all([
    getExistingDataDates(companyId, 'YEARLY'),
    getExistingDataDates(companyId, 'QUARTERLY')
  ]);

  // Filtrar e processar estatísticas anuais históricas (apenas as que não existem)
  const yearlyKeyStatistics = filterMissingData(
    data.defaultKeyStatisticsHistory, 
    yearlyExisting.keyStatisticsDates, 
    'YEARLY'
  );
    
  if (yearlyKeyStatistics.length > 0) {
    console.log(`  📋 Processando ${yearlyKeyStatistics.length} estatísticas anuais faltantes (de ${data.defaultKeyStatisticsHistory?.length || 0} totais)`);
    await processDataConcurrently(
      yearlyKeyStatistics,
      (keyStatistic) => processKeyStatistic(keyStatistic, 'YEARLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as estatísticas anuais já existem no banco`);
  }

  // Filtrar e processar estatísticas trimestrais (apenas as que não existem)
  const quarterlyKeyStatistics = filterMissingData(
    data.defaultKeyStatisticsHistoryQuarterly, 
    quarterlyExisting.keyStatisticsDates, 
    'QUARTERLY'
  );
    
  if (quarterlyKeyStatistics.length > 0) {
    console.log(`  📋 Processando ${quarterlyKeyStatistics.length} estatísticas trimestrais faltantes (de ${data.defaultKeyStatisticsHistoryQuarterly?.length || 0} totais)`);
    await processDataConcurrently(
      quarterlyKeyStatistics,
      (keyStatistic) => processKeyStatistic(keyStatistic, 'QUARTERLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as estatísticas trimestrais já existem no banco`);
  }
}

// Função para processar DVA (otimizada)
async function processValueAddedStatements(
  companyId: number, 
  ticker: string, 
  data: BrapiProResponse['results'][0]
): Promise<void> {
  const processValueAddedStatement = async (valueAddedStatement: BrapiValueAddedStatement, period: 'YEARLY' | 'QUARTERLY') => {
    if (!valueAddedStatement.endDate) return;
    
    try {
      const endDate = new Date(valueAddedStatement.endDate);
      
      await prisma.valueAddedStatement.upsert({
        where: {
          companyId_endDate_period: {
            companyId,
            endDate,
            period
          }
        },
        update: {
          revenue: valueAddedStatement.revenue || null,
          financialIntermediationRevenue: valueAddedStatement.financialIntermediationRevenue || null
        },
        create: {
          companyId,
          period,
          endDate,
          revenue: valueAddedStatement.revenue || null,
          financialIntermediationRevenue: valueAddedStatement.financialIntermediationRevenue || null
        }
      });
    } catch (error: any) {
      console.error(`❌ Erro ao processar DVA ${period} de ${valueAddedStatement.endDate} para ${ticker}:`, error.message);
    }
  };

  // Verificar dados existentes específicos
  const [yearlyExisting, quarterlyExisting] = await Promise.all([
    getExistingDataDates(companyId, 'YEARLY'),
    getExistingDataDates(companyId, 'QUARTERLY')
  ]);

  // Filtrar e processar DVAs anuais (apenas as que não existem)
  const yearlyValueAddedStatements = filterMissingData(
    data.valueAddedHistory, 
    yearlyExisting.valueAddedStatementDates, 
    'YEARLY'
  );
    
  if (yearlyValueAddedStatements.length > 0) {
    console.log(`  💡 Processando ${yearlyValueAddedStatements.length} DVAs anuais faltantes (de ${data.valueAddedHistory?.length || 0} totais)`);
    await processDataConcurrently(
      yearlyValueAddedStatements,
      (valueAddedStatement) => processValueAddedStatement(valueAddedStatement, 'YEARLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as DVAs anuais já existem no banco`);
  }

  // Filtrar e processar DVAs trimestrais (apenas as que não existem)
  const quarterlyValueAddedStatements = filterMissingData(
    data.valueAddedHistoryQuarterly, 
    quarterlyExisting.valueAddedStatementDates, 
    'QUARTERLY'
  );
    
  if (quarterlyValueAddedStatements.length > 0) {
    console.log(`  💡 Processando ${quarterlyValueAddedStatements.length} DVAs trimestrais faltantes (de ${data.valueAddedHistoryQuarterly?.length || 0} totais)`);
    await processDataConcurrently(
      quarterlyValueAddedStatements,
      (valueAddedStatement) => processValueAddedStatement(valueAddedStatement, 'QUARTERLY'),
      3, // max 3 concurrent
      5   // lotes de 5
    );
  } else {
    console.log(`  ✅ Todas as DVAs trimestrais já existem no banco`);
  }
}

// Função para atualizar dados históricos de preço recentes usando Yahoo Finance
async function updateRecentHistoricalPrices(companyId: number, ticker: string): Promise<void> {
  try {
    console.log(`  📈 Atualizando dados históricos recentes para ${ticker} usando Yahoo Finance...`);

    // Usar função centralizada do HistoricalDataService que usa Yahoo Finance como fonte primária
    // Buscar apenas os últimos 3 meses para atualização incremental
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    startDate.setDate(1); // Primeiro dia do mês

    // Importar HistoricalDataService dinamicamente
    const { HistoricalDataService } = await import('../src/lib/historical-data-service');
    
    const result = await HistoricalDataService.fetchAndSaveHistoricalPricesFromYahoo(
      companyId,
      ticker,
      startDate,
      endDate,
      '1mo'
    );

    if (result.recordsSaved > 0) {
      console.log(`  ✅ Dados históricos atualizados: ${result.recordsSaved} registros salvos (${result.recordsProcessed} recebidos, ${result.recordsDeduplicated} após deduplicação)`);
    } else {
      console.log(`  ℹ️  Nenhum dado novo para atualizar`);
    }

  } catch (error: any) {
    console.error(`  ❌ Erro ao atualizar dados históricos para ${ticker}:`, error.message);
    // Não falhar o processamento TTM por causa dos dados históricos
  }
}

// Função para processar dados TTM do financialData
async function processFinancialDataTTM(companyId: number, ticker: string, financialData: BrapiFinancialData): Promise<void> {
  try {
    const currentYear = new Date().getFullYear();
    
    console.log(`🔄 Processando dados TTM do financialData para ${ticker} (${currentYear})...`);
    
    // Buscar dados financeiros existentes para o ano atual
    const existingFinancialData = await prisma.financialData.findUnique({
      where: {
        companyId_year: {
          companyId,
          year: currentYear
        }
      }
    });
    
    // Preparar dados TTM para atualização
    const ttmDataRaw = {
      // === INDICADORES DE VALUATION ===
      forwardPE: financialData.currentPrice && financialData.earningsGrowth ? 
        financialData.currentPrice / (financialData.earningsGrowth * financialData.currentPrice) : null,
      
      // === DADOS DE MERCADO ===
      enterpriseValue: financialData.ebitda ? 
        (existingFinancialData?.marketCap ? Number(existingFinancialData.marketCap) + (financialData.totalDebt || 0) - (financialData.totalCash || 0) : null) : null,
      
      // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
      liquidezCorrente: financialData.currentRatio || null,
      liquidezRapida: financialData.quickRatio || null,
      debtToEquity: financialData.debtToEquity || null,
      
      // === INDICADORES DE RENTABILIDADE ===
      roe: financialData.returnOnEquity || null,
      roa: financialData.returnOnAssets || null,
      margemBruta: financialData.grossMargins || null,
      margemEbitda: financialData.ebitdaMargins || null,
      margemLiquida: financialData.profitMargins || null,
      
      // === INDICADORES DE CRESCIMENTO ===
      crescimentoLucros: financialData.earningsGrowth || null,
      crescimentoReceitas: financialData.revenueGrowth || null,
      
      // === DADOS FINANCEIROS OPERACIONAIS ===
      ebitda: financialData.ebitda || null,
      receitaTotal: financialData.totalRevenue || null,
      lucroLiquido: financialData.grossProfits || null,
      fluxoCaixaOperacional: financialData.operatingCashflow || null,
      fluxoCaixaLivre: financialData.freeCashflow || null,
      totalCaixa: financialData.totalCash || null,
      totalDivida: financialData.totalDebt || null,
      receitaPorAcao: financialData.revenuePerShare || null,
      caixaPorAcao: financialData.totalCashPerShare || null,
      
      // === METADADOS ===
      dataSource: existingFinancialData?.dataSource === 'ward+brapi' ? 'ward+brapi' : 'brapi'
    };
    
    // Filtrar campos: preservar valores existentes quando novo valor é NULL
    const ttmData: any = {};
    if (existingFinancialData) {
      // Para cada campo, só atualizar se o novo valor não for NULL
      // Se for NULL e já existe valor no banco, manter o valor do banco
      Object.keys(ttmDataRaw).forEach(key => {
        const newValue = (ttmDataRaw as any)[key];
        
        // Se novo valor não é NULL, usar novo valor
        // Se novo valor é NULL, manter valor existente (não atualizar campo)
        if (newValue !== null && newValue !== undefined) {
          ttmData[key] = newValue;
        }
        // Caso contrário, não adicionar ao objeto de update para preservar valor existente
      });
    } else {
      // Se não existe registro, usar todos os valores (mesmo NULL)
      Object.assign(ttmData, ttmDataRaw);
    }
    
    // Atualizar apenas os campos TTM, preservando dados históricos da Ward
    if (existingFinancialData) {
      // Só atualizar se houver campos para atualizar
      if (Object.keys(ttmData).length > 0) {
        await prisma.financialData.update({
          where: {
            companyId_year: {
              companyId,
              year: currentYear
            }
          },
          data: ttmData
        });
        console.log(`✅ Dados TTM atualizados para ${ticker} (${currentYear})`);
      } else {
        console.log(`⏭️  Nenhum campo TTM novo para atualizar para ${ticker} (${currentYear})`);
      }
    } else {
      // Se não existe dados para o ano atual, criar novo registro apenas com TTM
      await prisma.financialData.create({
        data: {
          companyId,
          year: currentYear,
          ...ttmData
        }
      });
      console.log(`✅ Dados TTM criados para ${ticker} (${currentYear})`);
    }
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar dados TTM para ${ticker}:`, error.message);
  }
}

// Função para processar uma empresa
async function processCompany(ticker: string, enableBrapiComplement: boolean = true, forceFullUpdate: boolean = false): Promise<void> {
  try {
    console.log(`\n🏢 Processando ${ticker}...`);
    
    // Primeiro, garantir que a empresa existe (criar se necessário)
    const company = await createOrUpdateCompany(ticker);

    if (!company) {
      console.log(`❌ Não foi possível criar/encontrar empresa ${ticker}. Pulando...`);
      return;
    }

    // Verificar dados existentes para otimização
    const existingData = await checkExistingHistoricalData(company.id);
    
    // Buscar dados completos da Brapi PRO (otimizado)
    let brapiProData = await fetchBrapiProData(ticker, forceFullUpdate);
    if (brapiProData) {
      console.log(`🔄 Processando dados históricos da Brapi PRO para ${ticker}...`);
      
      // Processar todos os tipos de dados históricos em paralelo
      console.log(`🔄 Processando dados históricos em paralelo para ${ticker}...`);
      
      await Promise.all([
        processBalanceSheets(company.id, ticker, brapiProData),
        processIncomeStatements(company.id, ticker, brapiProData),
        processCashflowStatements(company.id, ticker, brapiProData),
        processKeyStatistics(company.id, ticker, brapiProData),
        processValueAddedStatements(company.id, ticker, brapiProData),
      ]);
      
      console.log(`✅ Todos os tipos de dados históricos processados para ${ticker}`);
      
      // Processar dados TTM do financialData (sempre atualizar)
      if (brapiProData.financialData) {
        await processFinancialDataTTM(company.id, ticker, brapiProData.financialData);
      }
      
      console.log(`✅ Dados históricos da Brapi PRO processados para ${ticker}`);
    }

    // Buscar dados da Ward (mantém compatibilidade com dados existentes)
    // Não interromper processamento se Ward falhar
    let wardData = null;
    try {
      wardData = await fetchWardData(ticker);
      if (!wardData || !wardData.historicalStocks) {
        console.log(`⚠️  Nenhum dado histórico encontrado na Ward para ${ticker}`);
      }
    } catch (error: any) {
      // Erro já tratado dentro de fetchWardData, apenas logar e continuar
      console.log(`⚠️  Continuando processamento sem dados da Ward para ${ticker}`);
    }
    
    // Verificar se temos pelo menos uma fonte de dados
    if (!wardData && !brapiProData) {
      console.log(`❌ Nenhuma fonte de dados disponível para ${ticker}`);
      return;
    }

    // Buscar dados da Brapi para complementar (apenas ano atual)
    let brapiData = null;
    if (enableBrapiComplement) {
      try {
        console.log(`🔄 Buscando dados complementares da Brapi para ${ticker}...`);
        
        // Buscar dados da Brapi diretamente
        const brapiResponse = await axios.get(
          `https://brapi.dev/api/quote/${ticker}`,
          {
            headers: {
              'User-Agent': 'analisador-acoes/1.0.0',
              ...(BRAPI_TOKEN ? { 'Authorization': `Bearer ${BRAPI_TOKEN}` } : {})
            },
            params: {
              range: '1d',
              interval: '1d',
              fundamental: 'true',
              dividends: 'true',
              modules: 'summaryProfile,defaultKeyStatistics,financialData,balanceSheetHistory,cashflowHistory'
            },
            timeout: 15000
          }
        );
        
        if (brapiResponse.data.results && brapiResponse.data.results.length > 0) {
          // Simular o processamento para extrair os dados
          const quoteData = brapiResponse.data.results[0];
          
          // Extrair dados básicos que precisamos para complementar
          const stats = quoteData.defaultKeyStatistics;
          const financial = quoteData.financialData;
          const balance = quoteData.balanceSheetHistory?.[0];
          
          // Extrair dados completos da Brapi seguindo a mesma lógica do fetch-data.ts
          const cashflow = quoteData.cashflowHistory?.[0];
          const dividends = quoteData.dividendsData;
          
          // === CÁLCULOS COM DADOS DO BALANÇO ===
          let psr = null;
          let pAtivos = null;
          let passivoAtivos = null;
          let giroAtivos = null;
          let dividaLiquidaPl = null;
          let dividaLiquidaEbitda = null;
          let pCapGiro = null;
          let roic = null;
          let pEbit = null;

          if (balance) {
            // Calcular PSR: Market Cap / Total Revenue
            if (financial?.totalRevenue && quoteData.marketCap) {
              psr = quoteData.marketCap / financial.totalRevenue;
            }

            // P/Ativos = Market Cap / Total Assets
            if (quoteData.marketCap && balance.totalAssets) {
              pAtivos = quoteData.marketCap / balance.totalAssets;
            }

            // Passivo/Ativos
            if (balance?.totalCurrentLiabilities && balance?.nonCurrentLiabilities && balance?.totalAssets) {
              const totalRealLiab = balance.totalCurrentLiabilities + balance.nonCurrentLiabilities;
              if (totalRealLiab > 0 && balance.totalAssets > 0) {
                passivoAtivos = totalRealLiab / balance.totalAssets;
              }
            } else if (balance?.totalLiab && balance?.totalStockholderEquity && balance?.totalAssets) {
              const totalRealLiab = balance.totalLiab - balance.totalStockholderEquity;
              if (totalRealLiab > 0 && balance.totalAssets > 0) {
                passivoAtivos = totalRealLiab / balance.totalAssets;
              }
            }

            // Giro Ativos = Receita Total / Total Assets
            if (financial?.totalRevenue && balance?.totalAssets) {
              giroAtivos = financial.totalRevenue / balance.totalAssets;
            }

            // Dívida Líquida/PL
            const totalDebt = (balance.shortLongTermDebt || 0) + (balance.longTermDebt || 0);
            const cash = balance.cash || financial?.totalCash || 0;
            if (totalDebt > 0 && balance.totalStockholderEquity) {
              dividaLiquidaPl = (totalDebt - cash) / balance.totalStockholderEquity;
            }

            // Dívida Líquida/EBITDA
            if (totalDebt > 0 && financial?.ebitda) {
              dividaLiquidaEbitda = (totalDebt - cash) / financial.ebitda;
            }

            // P/Capital de Giro
            if (quoteData.marketCap && balance.totalCurrentAssets && balance.totalCurrentLiabilities) {
              const workingCapital = balance.totalCurrentAssets - balance.totalCurrentLiabilities;
              if (workingCapital > 0) {
                pCapGiro = quoteData.marketCap / workingCapital;
              }
            }

            // ROIC será calculado pela função helper se necessário

            // P/EBIT
            if (quoteData.marketCap && financial?.totalRevenue && financial?.operatingMargins) {
              const ebit = financial.totalRevenue * financial.operatingMargins;
              if (ebit > 0) {
                pEbit = quoteData.marketCap / ebit;
              }
            }
          }

          // === DADOS DE DIVIDENDOS ===
          let ultimosDividendos: Array<{ valor?: number; data?: string; tipo?: string; periodo?: string; }> = [];
          let dividendoMaisRecente = null;
          let dataDividendoMaisRecente = null;
          
          if (dividends?.cashDividends && dividends.cashDividends.length > 0) {
            ultimosDividendos = dividends.cashDividends.slice(0, 5).map((div: any) => ({
              valor: div.rate,
              data: div.paymentDate,
              tipo: div.label,
              periodo: div.relatedTo
            }));
            
            dividendoMaisRecente = dividends.cashDividends[0]?.rate;
            dataDividendoMaisRecente = dividends.cashDividends[0]?.paymentDate;
          }

          // === CALCULAR EARNINGS YIELD ===
          let earningsYield = null;
          if (quoteData.priceEarnings && quoteData.priceEarnings > 0) {
            earningsYield = 1 / quoteData.priceEarnings;
          } else if (quoteData.earningsPerShare && quoteData.regularMarketPrice && quoteData.regularMarketPrice > 0) {
            earningsYield = quoteData.earningsPerShare / quoteData.regularMarketPrice;
          }

          // === CALCULAR PAYOUT SE NÃO DISPONÍVEL ===
          const calculatedPayout = calculatePayout({
            payoutFromAPI: stats?.payoutRatio,
            dividendYield: stats?.dividendYield ? stats.dividendYield / 100 : null,
            marketCap: quoteData.marketCap,
            lpa: quoteData.earningsPerShare || stats?.trailingEps,
            sharesOutstanding: stats?.sharesOutstanding,
            lucroLiquido: financial?.grossProfits
          });

          brapiData = {
            // === INDICADORES DE VALUATION ===
            pl: quoteData.priceEarnings || null,
            forwardPE: stats?.forwardPE || null,
            earningsYield: earningsYield,
            pvp: stats?.priceToBook || null,
            dy: stats?.dividendYield ? stats.dividendYield / 100 : null,
            evEbitda: stats?.enterpriseToEbitda || null,
            evEbit: stats?.enterpriseToRevenue || null,
            evRevenue: stats?.enterpriseToRevenue || null,
            psr: psr,
            pAtivos: pAtivos,
            pCapGiro: pCapGiro,
            pEbit: pEbit,
            lpa: quoteData.earningsPerShare || stats?.trailingEps || null,
            trailingEps: stats?.trailingEps || null,
            vpa: stats?.bookValue || null,
            
            // === DADOS DE MERCADO E AÇÕES ===
            marketCap: quoteData.marketCap || null,
            enterpriseValue: stats?.enterpriseValue || null,
            sharesOutstanding: stats?.sharesOutstanding || null,
            totalAssets: stats?.totalAssets || null,
            
            // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
            dividaLiquidaPl: dividaLiquidaPl,
            dividaLiquidaEbitda: dividaLiquidaEbitda,
            liquidezCorrente: financial?.currentRatio || stats?.currentRatio || null,
            liquidezRapida: financial?.quickRatio || stats?.quickRatio || null,
            passivoAtivos: passivoAtivos,
            debtToEquity: financial?.debtToEquity || stats?.debtToEquity || null,
            
            // === INDICADORES DE RENTABILIDADE ===
            roe: financial?.returnOnEquity || (stats?.returnOnEquity ? stats.returnOnEquity / 100 : null),
            roic: calculateROIC({
              roicFromAPI: roic,
              receitaTotal: financial?.totalRevenue,
              operatingMargins: financial?.operatingMargins,
              totalAssets: balance?.totalAssets,
              currentLiabilities: balance?.totalCurrentLiabilities,
              patrimonioLiquido: balance?.totalStockholderEquity,
              totalDivida: (balance?.shortLongTermDebt || 0) + (balance?.longTermDebt || 0) || financial?.totalDebt
            }),
            roa: financial?.returnOnAssets || (stats?.returnOnAssets ? stats.returnOnAssets / 100 : null),
            margemBruta: financial?.grossMargins || (stats?.grossMargin ? stats.grossMargin / 100 : null),
            margemEbitda: financial?.ebitdaMargins || null,
            margemLiquida: financial?.profitMargins || stats?.profitMargins || null,
            giroAtivos: giroAtivos,
            
            // === INDICADORES DE CRESCIMENTO ===
            cagrLucros5a: stats?.earningsAnnualGrowth || null,
            crescimentoLucros: financial?.earningsGrowth || null,
            crescimentoReceitas: financial?.revenueGrowth || null,
            
            // === DADOS DE DIVIDENDOS ===
            dividendYield12m: stats?.dividendYield ? stats.dividendYield / 100 : null,
            payout: calculatedPayout, // Payout da API ou calculado
            ultimoDividendo: stats?.lastDividendValue || null,
            dataUltimoDividendo: stats?.lastDividendDate ? new Date(stats.lastDividendDate) : null,
            
            // === PERFORMANCE E VARIAÇÕES ===
            variacao52Semanas: stats?.["52WeekChange"] || null,
            retornoAnoAtual: stats?.ytdReturn || null,
            
            // === DADOS FINANCEIROS OPERACIONAIS ===
            ebitda: financial?.ebitda || null,
            receitaTotal: financial?.totalRevenue || null,
            lucroLiquido: financial?.grossProfits || null,
            fluxoCaixaOperacional: cashflow?.operatingCashFlow || financial?.operatingCashflow || null,
            fluxoCaixaInvestimento: cashflow?.investmentCashFlow || null,
            fluxoCaixaFinanciamento: cashflow?.financingCashFlow || null,
            fluxoCaixaLivre: financial?.freeCashflow || null,
            totalCaixa: financial?.totalCash || null,
            totalDivida: financial?.totalDebt || null,
            receitaPorAcao: financial?.revenuePerShare || null,
            caixaPorAcao: financial?.totalCashPerShare || null,
            
            // === DADOS DO BALANÇO PATRIMONIAL ===
            ativoCirculante: balance?.totalCurrentAssets || null,
            ativoTotal: balance?.totalAssets || null,
            passivoCirculante: balance?.totalCurrentLiabilities || null,
            passivoTotal: balance?.totalLiab || null,
            patrimonioLiquido: balance?.totalStockholderEquity || null,
            caixa: balance?.cash || null,
            estoques: balance?.inventory || null,
            contasReceber: balance?.netReceivables || null,
            imobilizado: balance?.propertyPlantEquipment || null,
            intangivel: balance?.intangibleAssets || null,
            dividaCirculante: balance?.shortLongTermDebt || null,
            dividaLongoPrazo: balance?.longTermDebt || null,
            
            // === DADOS DE DIVIDENDOS DETALHADOS ===
            dividendoMaisRecente: dividendoMaisRecente,
            dataDividendoMaisRecente: dataDividendoMaisRecente ? new Date(dataDividendoMaisRecente) : null,
            historicoUltimosDividendos: JSON.stringify(ultimosDividendos)
          };
          
          console.log(`✅ Dados da Brapi obtidos para complementar ${ticker}`);
        }
      } catch (error: any) {
        console.log(`⚠️  Erro ao buscar dados da Brapi para ${ticker}:`, error.message);
        brapiData = null;
      }
    }

    // Se não temos dados da Ward, usar dados complementares da Brapi para atualizar o ano atual
    if (!wardData || !wardData.historicalStocks) {
      if (brapiData) {
        // Usar dados complementares da Brapi para atualizar o ano atual
        const currentYear = new Date().getFullYear();
        console.log(`🔄 Usando dados complementares da Brapi para atualizar ${ticker} (${currentYear})...`);
        
        // Buscar dados existentes para o ano atual
        const existingFinancialData = await prisma.financialData.findUnique({
          where: {
            companyId_year: {
              companyId: company.id,
              year: currentYear
            }
          }
        });
        
        // Mesclar dados com prioridade (só Brapi neste caso)
        let finalFinancialData = mergeFinancialDataWithPriority(
          null, // Fundamentus
          null, // Ward
          brapiData, // Brapi complementar
          currentYear
        );
        
        // Calcular ROIC se não disponível
        if (!finalFinancialData.roic || finalFinancialData.roic === null) {
          const balanceSheetData = await prisma.balanceSheet.findFirst({
            where: { companyId: company.id },
            orderBy: { endDate: 'desc' },
            select: {
              totalAssets: true,
              totalCurrentLiabilities: true,
              totalStockholderEquity: true
            }
          });
          
          const calculatedROIC = calculateROIC({
            roicFromAPI: finalFinancialData.roic,
            ebit: finalFinancialData.ebitda ? Number(finalFinancialData.ebitda) : null,
            receitaTotal: finalFinancialData.receitaTotal ? Number(finalFinancialData.receitaTotal) : null,
            operatingMargins: finalFinancialData.margemEbitda,
            totalAssets: balanceSheetData?.totalAssets ? Number(balanceSheetData.totalAssets) : (finalFinancialData.totalAssets ? Number(finalFinancialData.totalAssets) : null),
            currentLiabilities: balanceSheetData?.totalCurrentLiabilities ? Number(balanceSheetData.totalCurrentLiabilities) : null,
            patrimonioLiquido: balanceSheetData?.totalStockholderEquity ? Number(balanceSheetData.totalStockholderEquity) : (finalFinancialData.patrimonioLiquido ? Number(finalFinancialData.patrimonioLiquido) : null),
            totalDivida: finalFinancialData.totalDivida ? Number(finalFinancialData.totalDivida) : null,
            year: currentYear
          });
          
          if (calculatedROIC) {
            finalFinancialData.roic = calculatedROIC;
          }
        }
        
        // Preservar valores existentes quando novo valor é NULL
        let updateData: any = {};
        if (existingFinancialData) {
          // Para cada campo, só atualizar se o novo valor não for NULL
          Object.keys(finalFinancialData).forEach(key => {
            const newValue = (finalFinancialData as any)[key];
            
            // Se novo valor não é NULL, usar novo valor
            if (newValue !== null && newValue !== undefined) {
              updateData[key] = newValue;
            }
            // Se novo valor é NULL, manter valor existente (não atualizar campo)
          });
        } else {
          // Se não existe registro, usar todos os valores (mesmo NULL)
          updateData = finalFinancialData;
        }
        
        // Upsert dos dados financeiros
        if (Object.keys(updateData).length > 0 || !existingFinancialData) {
          // Remover 'year' de finalFinancialData pois já está sendo especificado explicitamente
          const { year, ...finalDataWithoutYear } = finalFinancialData;
          
          await prisma.financialData.upsert({
            where: {
              companyId_year: {
                companyId: company.id,
                year: currentYear
              }
            },
            update: updateData,
            create: {
              companyId: company.id,
              year: currentYear,
              ...finalDataWithoutYear
            }
          });
          
          console.log(`✅ Dados complementares da Brapi atualizados para ${ticker} (${currentYear})`);
        } else {
          console.log(`⏭️  Nenhum campo novo para atualizar com dados complementares da Brapi para ${ticker}`);
        }
      }
      
      console.log(`✅ ${ticker}: Processamento concluído apenas com dados da Brapi PRO`);
      return;
    }

    let processedYears = 0;
    let updatedYears = 0;
    let createdYears = 0;
    let complementedYears = 0;

    // Função para processar um ano específico (dados da Ward)
    const processYear = async (wardStock: WardHistoricalStock) => {
      try {
        const wardFinancialData = await convertWardDataToFinancialData(wardStock, company.id);
        const currentYear = new Date().getFullYear();
        
        // Se for o ano atual, buscar dados do Fundamentus e mesclar com prioridade
        let finalFinancialData;
        if (wardFinancialData.year === currentYear) {
          // Buscar dados do Fundamentus para o ano atual
          let fundamentusCurrentYearData = null;
          try {
            const fundamentusData = await fetchFundamentusData(ticker);
            if (fundamentusData) {
              fundamentusCurrentYearData = convertFundamentusToFinancialData(fundamentusData);
              console.log(`  📊 Dados do Fundamentus obtidos para ${ticker} (${currentYear})`);
            }
          } catch (error: any) {
            console.log(`  ⚠️  Erro ao buscar dados do Fundamentus para ${ticker}:`, error.message);
          }
          
          // Mesclar com prioridade: Fundamentus > Ward > Brapi
          if (fundamentusCurrentYearData || brapiData) {
            finalFinancialData = mergeFinancialDataWithPriority(
              fundamentusCurrentYearData,
              wardFinancialData,
              brapiData,
              wardFinancialData.year
            );
            complementedYears++;
            const sources = [];
            if (fundamentusCurrentYearData) sources.push('Fundamentus');
            if (wardFinancialData) sources.push('Ward');
            if (brapiData) sources.push('Brapi');
            console.log(`  🔄 ${wardFinancialData.year}: Dados mesclados ${sources.join(' + ')}`);
          } else {
            finalFinancialData = wardFinancialData as FinancialDataComplete;
          }
        } else {
          finalFinancialData = wardFinancialData as FinancialDataComplete;
        }
        
        // === CALCULAR PAYOUT E ROIC SE NÃO DISPONÍVEIS (para anos históricos também) ===
        if (!finalFinancialData.payout || finalFinancialData.payout === null) {
          const calculatedPayout = calculatePayout({
            payoutFromAPI: finalFinancialData.payout,
            dividendYield: finalFinancialData.dividendYield12m,
            marketCap: finalFinancialData.marketCap ? Number(finalFinancialData.marketCap) : null,
            lpa: finalFinancialData.lpa,
            sharesOutstanding: finalFinancialData.sharesOutstanding ? Number(finalFinancialData.sharesOutstanding) : null,
            lucroLiquido: finalFinancialData.lucroLiquido ? Number(finalFinancialData.lucroLiquido) : null,
            year: finalFinancialData.year
          });
          
          if (calculatedPayout) {
            finalFinancialData.payout = calculatedPayout;
          }
        }
        
        // Calcular ROIC se não disponível
        if (!finalFinancialData.roic || finalFinancialData.roic === null) {
          // Buscar dados do balanço do ano específico se disponível
          const balanceSheetData = await prisma.balanceSheet.findFirst({
            where: { 
              companyId: company.id,
              endDate: {
                gte: new Date(finalFinancialData.year, 0, 1),
                lt: new Date(finalFinancialData.year + 1, 0, 1)
              }
            },
            orderBy: { endDate: 'desc' },
            select: {
              totalAssets: true,
              totalCurrentLiabilities: true,
              totalStockholderEquity: true
            }
          });
          
          const calculatedROIC = calculateROIC({
            roicFromAPI: finalFinancialData.roic,
            ebit: finalFinancialData.ebitda ? Number(finalFinancialData.ebitda) : null, // Usar EBITDA como aproximação de EBIT
            receitaTotal: finalFinancialData.receitaTotal ? Number(finalFinancialData.receitaTotal) : null,
            operatingMargins: finalFinancialData.margemEbitda, // Usar margem EBITDA como aproximação
            totalAssets: balanceSheetData?.totalAssets ? Number(balanceSheetData.totalAssets) : (finalFinancialData.ativoTotal ? Number(finalFinancialData.ativoTotal) : (finalFinancialData.totalAssets ? Number(finalFinancialData.totalAssets) : null)),
            currentLiabilities: balanceSheetData?.totalCurrentLiabilities ? Number(balanceSheetData.totalCurrentLiabilities) : (finalFinancialData.passivoCirculante ? Number(finalFinancialData.passivoCirculante) : null),
            patrimonioLiquido: balanceSheetData?.totalStockholderEquity ? Number(balanceSheetData.totalStockholderEquity) : (finalFinancialData.patrimonioLiquido ? Number(finalFinancialData.patrimonioLiquido) : null),
            totalDivida: finalFinancialData.totalDivida ? Number(finalFinancialData.totalDivida) : null,
            year: finalFinancialData.year
          });
          
          if (calculatedROIC) {
            finalFinancialData.roic = calculatedROIC;
          }
        }
        
        // Upsert dos dados financeiros (uma linha por empresa/ano)
        const result = await prisma.financialData.upsert({
          where: {
            companyId_year: {
              companyId: company.id,
              year: finalFinancialData.year
            }
          },
          update: {
            // === INDICADORES DE VALUATION ===
            pl: finalFinancialData.pl,
            forwardPE: finalFinancialData.forwardPE,
            earningsYield: finalFinancialData.earningsYield,
            pvp: finalFinancialData.pvp,
            dy: finalFinancialData.dy,
            evEbitda: finalFinancialData.evEbitda,
            evEbit: finalFinancialData.evEbit,
            evRevenue: finalFinancialData.evRevenue,
            psr: finalFinancialData.psr,
            pAtivos: finalFinancialData.pAtivos,
            pCapGiro: finalFinancialData.pCapGiro,
            pEbit: finalFinancialData.pEbit,
            lpa: finalFinancialData.lpa,
            trailingEps: finalFinancialData.trailingEps,
            vpa: finalFinancialData.vpa,
            
            // === DADOS DE MERCADO ===
            marketCap: finalFinancialData.marketCap,
            enterpriseValue: finalFinancialData.enterpriseValue,
            sharesOutstanding: finalFinancialData.sharesOutstanding,
            totalAssets: finalFinancialData.totalAssets,
            
            // === INDICADORES DE ENDIVIDAMENTO ===
            dividaLiquidaEbitda: finalFinancialData.dividaLiquidaEbitda,
            dividaLiquidaPl: finalFinancialData.dividaLiquidaPl,
            liquidezCorrente: finalFinancialData.liquidezCorrente,
            liquidezRapida: finalFinancialData.liquidezRapida,
            passivoAtivos: finalFinancialData.passivoAtivos,
            debtToEquity: finalFinancialData.debtToEquity,
            
            // === INDICADORES DE RENTABILIDADE ===
            roe: finalFinancialData.roe,
            roic: finalFinancialData.roic,
            roa: finalFinancialData.roa,
            margemBruta: finalFinancialData.margemBruta,
            margemEbitda: finalFinancialData.margemEbitda,
            margemLiquida: finalFinancialData.margemLiquida,
            giroAtivos: finalFinancialData.giroAtivos,
            
            // === INDICADORES DE CRESCIMENTO ===
            cagrLucros5a: finalFinancialData.cagrLucros5a,
            crescimentoLucros: finalFinancialData.crescimentoLucros,
            crescimentoReceitas: finalFinancialData.crescimentoReceitas,
            
            // === DIVIDENDOS ===
            dividendYield12m: finalFinancialData.dividendYield12m,
            payout: finalFinancialData.payout,
            ultimoDividendo: finalFinancialData.ultimoDividendo,
            dataUltimoDividendo: finalFinancialData.dataUltimoDividendo,
            
            // === PERFORMANCE ===
            variacao52Semanas: finalFinancialData.variacao52Semanas,
            retornoAnoAtual: finalFinancialData.retornoAnoAtual,
            
            // === DADOS FINANCEIROS ===
            ebitda: finalFinancialData.ebitda,
            receitaTotal: finalFinancialData.receitaTotal,
            lucroLiquido: finalFinancialData.lucroLiquido,
            fluxoCaixaOperacional: finalFinancialData.fluxoCaixaOperacional,
            fluxoCaixaInvestimento: finalFinancialData.fluxoCaixaInvestimento,
            fluxoCaixaFinanciamento: finalFinancialData.fluxoCaixaFinanciamento,
            fluxoCaixaLivre: finalFinancialData.fluxoCaixaLivre,
            totalCaixa: finalFinancialData.totalCaixa,
            totalDivida: finalFinancialData.totalDivida,
            receitaPorAcao: finalFinancialData.receitaPorAcao,
            caixaPorAcao: finalFinancialData.caixaPorAcao,
            
            // === DADOS DO BALANÇO PATRIMONIAL ===
            ativoCirculante: finalFinancialData.ativoCirculante,
            ativoTotal: finalFinancialData.ativoTotal,
            passivoCirculante: finalFinancialData.passivoCirculante,
            passivoTotal: finalFinancialData.passivoTotal,
            patrimonioLiquido: finalFinancialData.patrimonioLiquido,
            caixa: finalFinancialData.caixa,
            estoques: finalFinancialData.estoques,
            contasReceber: finalFinancialData.contasReceber,
            imobilizado: finalFinancialData.imobilizado,
            intangivel: finalFinancialData.intangivel,
            dividaCirculante: finalFinancialData.dividaCirculante,
            dividaLongoPrazo: finalFinancialData.dividaLongoPrazo,
            
            // === DADOS DE DIVIDENDOS DETALHADOS ===
            dividendoMaisRecente: finalFinancialData.dividendoMaisRecente,
            dataDividendoMaisRecente: finalFinancialData.dataDividendoMaisRecente,
            historicoUltimosDividendos: finalFinancialData.historicoUltimosDividendos,
            
            // === METADADOS ===
            dataSource: finalFinancialData.dataSource
          },
          create: {
            companyId: company.id,
            year: finalFinancialData.year,
            
            // === INDICADORES DE VALUATION ===
            pl: finalFinancialData.pl,
            forwardPE: finalFinancialData.forwardPE,
            earningsYield: finalFinancialData.earningsYield,
            pvp: finalFinancialData.pvp,
            dy: finalFinancialData.dy,
            evEbitda: finalFinancialData.evEbitda,
            evEbit: finalFinancialData.evEbit,
            evRevenue: finalFinancialData.evRevenue,
            psr: finalFinancialData.psr,
            pAtivos: finalFinancialData.pAtivos,
            pCapGiro: finalFinancialData.pCapGiro,
            pEbit: finalFinancialData.pEbit,
            lpa: finalFinancialData.lpa,
            trailingEps: finalFinancialData.trailingEps,
            vpa: finalFinancialData.vpa,
            
            // === DADOS DE MERCADO ===
            marketCap: finalFinancialData.marketCap,
            enterpriseValue: finalFinancialData.enterpriseValue,
            sharesOutstanding: finalFinancialData.sharesOutstanding,
            totalAssets: finalFinancialData.totalAssets,
            
            // === INDICADORES DE ENDIVIDAMENTO ===
            dividaLiquidaEbitda: finalFinancialData.dividaLiquidaEbitda,
            dividaLiquidaPl: finalFinancialData.dividaLiquidaPl,
            liquidezCorrente: finalFinancialData.liquidezCorrente,
            liquidezRapida: finalFinancialData.liquidezRapida,
            passivoAtivos: finalFinancialData.passivoAtivos,
            debtToEquity: finalFinancialData.debtToEquity,
            
            // === INDICADORES DE RENTABILIDADE ===
            roe: finalFinancialData.roe,
            roic: finalFinancialData.roic,
            roa: finalFinancialData.roa,
            margemBruta: finalFinancialData.margemBruta,
            margemEbitda: finalFinancialData.margemEbitda,
            margemLiquida: finalFinancialData.margemLiquida,
            giroAtivos: finalFinancialData.giroAtivos,
            
            // === INDICADORES DE CRESCIMENTO ===
            cagrLucros5a: finalFinancialData.cagrLucros5a,
            crescimentoLucros: finalFinancialData.crescimentoLucros,
            crescimentoReceitas: finalFinancialData.crescimentoReceitas,
            
            // === DIVIDENDOS ===
            dividendYield12m: finalFinancialData.dividendYield12m,
            payout: finalFinancialData.payout,
            ultimoDividendo: finalFinancialData.ultimoDividendo,
            dataUltimoDividendo: finalFinancialData.dataUltimoDividendo,
            
            // === PERFORMANCE ===
            variacao52Semanas: finalFinancialData.variacao52Semanas,
            retornoAnoAtual: finalFinancialData.retornoAnoAtual,
            
            // === DADOS FINANCEIROS ===
            ebitda: finalFinancialData.ebitda,
            receitaTotal: finalFinancialData.receitaTotal,
            lucroLiquido: finalFinancialData.lucroLiquido,
            fluxoCaixaOperacional: finalFinancialData.fluxoCaixaOperacional,
            fluxoCaixaInvestimento: finalFinancialData.fluxoCaixaInvestimento,
            fluxoCaixaFinanciamento: finalFinancialData.fluxoCaixaFinanciamento,
            fluxoCaixaLivre: finalFinancialData.fluxoCaixaLivre,
            totalCaixa: finalFinancialData.totalCaixa,
            totalDivida: finalFinancialData.totalDivida,
            receitaPorAcao: finalFinancialData.receitaPorAcao,
            caixaPorAcao: finalFinancialData.caixaPorAcao,
            
            // === DADOS DO BALANÇO PATRIMONIAL ===
            ativoCirculante: finalFinancialData.ativoCirculante,
            ativoTotal: finalFinancialData.ativoTotal,
            passivoCirculante: finalFinancialData.passivoCirculante,
            passivoTotal: finalFinancialData.passivoTotal,
            patrimonioLiquido: finalFinancialData.patrimonioLiquido,
            caixa: finalFinancialData.caixa,
            estoques: finalFinancialData.estoques,
            contasReceber: finalFinancialData.contasReceber,
            imobilizado: finalFinancialData.imobilizado,
            intangivel: finalFinancialData.intangivel,
            dividaCirculante: finalFinancialData.dividaCirculante,
            dividaLongoPrazo: finalFinancialData.dividaLongoPrazo,
            
            // === DADOS DE DIVIDENDOS DETALHADOS ===
            dividendoMaisRecente: finalFinancialData.dividendoMaisRecente,
            dataDividendoMaisRecente: finalFinancialData.dataDividendoMaisRecente,
            historicoUltimosDividendos: finalFinancialData.historicoUltimosDividendos,
            
            // === METADADOS ===
            dataSource: finalFinancialData.dataSource
          }
        });

        // Verificar se foi criado ou atualizado (simplificado para performance)
        processedYears++;
        
        // Log detalhado dos indicadores
        const indicators = [];
        if (finalFinancialData.pl) indicators.push(`P/L=${finalFinancialData.pl}`);
        if (finalFinancialData.roe) indicators.push(`ROE=${(finalFinancialData.roe * 100).toFixed(2)}%`);
        if (finalFinancialData.earningsYield) indicators.push(`EY=${(finalFinancialData.earningsYield * 100).toFixed(2)}%`);
        if (finalFinancialData.psr) indicators.push(`PSR=${finalFinancialData.psr}`);
        if (finalFinancialData.marketCap) {
          indicators.push(`MC=${(finalFinancialData.marketCap / 1000000000).toFixed(1)}B`);
          if (finalFinancialData.sharesOutstanding) {
            indicators.push(`${(finalFinancialData.sharesOutstanding / 1000000).toFixed(0)}M ações`);
          }
        }
        
        console.log(`  📊 ${finalFinancialData.year}: ${indicators.join(', ')}`);
        
        return { success: true, year: finalFinancialData.year };
      } catch (error: any) {
        console.error(`❌ Erro ao processar ano ${wardStock.ano} para ${ticker}:`, error.message);
        return { success: false, year: wardStock.ano, error: error.message };
      }
    };

    // Processar anos em lotes paralelos (5 por vez)
    const PARALLEL_YEARS_BATCH_SIZE = 5;
    console.log(`📦 Processando ${wardData.historicalStocks.length} anos em lotes paralelos de ${PARALLEL_YEARS_BATCH_SIZE}`);

    const results = [];
    for (let i = 0; i < wardData.historicalStocks.length; i += PARALLEL_YEARS_BATCH_SIZE) {
      const batch = wardData.historicalStocks.slice(i, i + PARALLEL_YEARS_BATCH_SIZE);
      
      // Processar lote em paralelo
      const batchPromises = batch.map(async (wardStock) => {
        try {
          return await processYear(wardStock);
        } catch (error: any) {
          console.error(`❌ Erro ao processar ano ${wardStock.ano}:`, error.message);
          return { success: false, year: wardStock.ano, error: error.message };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Processar resultados do batch
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ success: false, year: 'unknown', error: result.reason });
        }
      }
      
      // Log de progresso a cada batch ou no final
      const processedCount = i + batch.length;
      if (processedCount % 5 === 0 || processedCount >= wardData.historicalStocks.length) {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(`  📊 Progresso: ${processedCount}/${wardData.historicalStocks.length} anos processados (${successful} sucessos, ${failed} falhas)`);
      }
    }

    // Verificar se há anos faltantes que não estão na Ward mas podem ser obtidos da Brapi PRO
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1; // 2024 se currentYear é 2025
    const processedYearsSet = new Set(wardData.historicalStocks.map(s => parseInt(s.ano)));
    const missingYears: number[] = [];
    
    // Verificar se 2024 e 2025 não estão na Ward
    if (!processedYearsSet.has(previousYear) && brapiProData) {
      missingYears.push(previousYear);
    }
    if (!processedYearsSet.has(currentYear) && brapiProData) {
      missingYears.push(currentYear);
    }
    
    // Se precisamos processar 2024 mas não temos dados históricos completos, buscar novamente
    // Isso acontece quando fetchBrapiProData retornou apenas TTM porque já existem dados históricos
    const needs2024Data = missingYears.includes(previousYear);
    if (needs2024Data) {
      // Verificar se temos dados históricos completos (balanceSheetHistory indica dados completos)
      const hasFullHistory = brapiProData && brapiProData.balanceSheetHistory && brapiProData.balanceSheetHistory.length > 0;
      
      if (!hasFullHistory) {
        console.log(`🔄 Buscando dados históricos completos da Brapi PRO para processar ${previousYear}...`);
        brapiProData = await fetchBrapiProData(ticker, true); // forceFullUpdate = true para garantir dados históricos
      } else if (brapiProData) {
        // Verificar se temos dados específicos de 2024
        const has2024Data = brapiProData.balanceSheetHistory?.some(b => 
          b.endDate && new Date(b.endDate).getFullYear() === previousYear
        ) || false;
        
        if (!has2024Data) {
          console.log(`🔄 Dados históricos completos não contêm ${previousYear}, buscando novamente...`);
          brapiProData = await fetchBrapiProData(ticker, true);
        }
      }
    }
    
    // Processar anos faltantes usando dados da Brapi PRO
    if (missingYears.length > 0 && brapiProData) {
      console.log(`📅 Processando ${missingYears.length} ano(s) faltante(s) da Brapi PRO: ${missingYears.join(', ')}`);
      
      for (const year of missingYears) {
        try {
          // Buscar dados do ano específico da Brapi PRO
          const yearBalance = brapiProData.balanceSheetHistory?.find(b => 
            b.endDate && new Date(b.endDate).getFullYear() === year
          );
          const yearIncome = brapiProData.incomeStatementHistory?.find(i => 
            i.endDate && new Date(i.endDate).getFullYear() === year
          );
          const yearCashflow = brapiProData.cashflowHistory?.find(c => 
            c.endDate && new Date(c.endDate).getFullYear() === year
          );
          const yearKeyStats = brapiProData.defaultKeyStatisticsHistory?.find(k => 
            k.updatedAt && new Date(k.updatedAt).getFullYear() === year
          );
          const yearFinancialData = brapiProData.financialDataHistory?.find(f => 
            f.updatedAt && new Date(f.updatedAt).getFullYear() === year
          );
          
          // Se for o ano atual, usar dados TTM também
          const isCurrentYear = year === currentYear;
          const balance = yearBalance || (isCurrentYear ? brapiProData.balanceSheetHistory?.[0] : null);
          const income = yearIncome || (isCurrentYear ? brapiProData.incomeStatementHistory?.[0] : null);
          const cashflow = yearCashflow || (isCurrentYear ? brapiProData.cashflowHistory?.[0] : null);
          const keyStats = yearKeyStats || (isCurrentYear ? brapiProData.defaultKeyStatistics : null);
          const financial = yearFinancialData || (isCurrentYear ? brapiProData.financialData : null);
          
          // Se temos pelo menos alguns dados, criar registro
          if (balance || income || financial || keyStats) {
            // Preparar dados financeiros da Brapi para este ano
            const brapiYearData = await prepareBrapiYearData(
              company.id,
              brapiProData,
              balance,
              income,
              cashflow,
              keyStats,
              financial,
              year
            );
            
            if (brapiYearData) {
              // Buscar dados existentes para este ano
              const existingFinancialData = await prisma.financialData.findUnique({
                where: {
                  companyId_year: {
                    companyId: company.id,
                    year: year
                  }
                }
              });
              
              // Mesclar com dados da Brapi complementar se disponível
              let finalFinancialData = mergeFinancialDataWithPriority(
                null, // Fundamentus
                null, // Ward (não temos)
                brapiYearData, // Brapi
                year
              );
              
              // Calcular payout e ROIC se não disponíveis
              if (!finalFinancialData.payout || finalFinancialData.payout === null) {
                const calculatedPayout = calculatePayout({
                  payoutFromAPI: finalFinancialData.payout,
                  dividendYield: finalFinancialData.dividendYield12m,
                  marketCap: finalFinancialData.marketCap ? Number(finalFinancialData.marketCap) : null,
                  lpa: finalFinancialData.lpa,
                  sharesOutstanding: finalFinancialData.sharesOutstanding ? Number(finalFinancialData.sharesOutstanding) : null,
                  lucroLiquido: finalFinancialData.lucroLiquido ? Number(finalFinancialData.lucroLiquido) : null,
                  year: year
                });
                
                if (calculatedPayout) {
                  finalFinancialData.payout = calculatedPayout;
                }
              }
              
              if (!finalFinancialData.roic || finalFinancialData.roic === null) {
                const balanceSheetData = await prisma.balanceSheet.findFirst({
                  where: { 
                    companyId: company.id,
                    endDate: {
                      gte: new Date(year, 0, 1),
                      lt: new Date(year + 1, 0, 1)
                    }
                  },
                  orderBy: { endDate: 'desc' },
                  select: {
                    totalAssets: true,
                    totalCurrentLiabilities: true,
                    totalStockholderEquity: true
                  }
                });
                
                const calculatedROIC = calculateROIC({
                  roicFromAPI: finalFinancialData.roic,
                  ebit: finalFinancialData.ebitda ? Number(finalFinancialData.ebitda) : null,
                  receitaTotal: finalFinancialData.receitaTotal ? Number(finalFinancialData.receitaTotal) : null,
                  operatingMargins: finalFinancialData.margemEbitda,
                  totalAssets: balanceSheetData?.totalAssets ? Number(balanceSheetData.totalAssets) : (finalFinancialData.ativoTotal ? Number(finalFinancialData.ativoTotal) : (finalFinancialData.totalAssets ? Number(finalFinancialData.totalAssets) : null)),
                  currentLiabilities: balanceSheetData?.totalCurrentLiabilities ? Number(balanceSheetData.totalCurrentLiabilities) : (finalFinancialData.passivoCirculante ? Number(finalFinancialData.passivoCirculante) : null),
                  patrimonioLiquido: balanceSheetData?.totalStockholderEquity ? Number(balanceSheetData.totalStockholderEquity) : (finalFinancialData.patrimonioLiquido ? Number(finalFinancialData.patrimonioLiquido) : null),
                  totalDivida: finalFinancialData.totalDivida ? Number(finalFinancialData.totalDivida) : null,
                  year: year
                });
                
                if (calculatedROIC) {
                  finalFinancialData.roic = calculatedROIC;
                }
              }
              
              // Preservar valores existentes quando novo valor é NULL
              let updateData: any = {};
              if (existingFinancialData) {
                Object.keys(finalFinancialData).forEach(key => {
                  const newValue = (finalFinancialData as any)[key];
                  if (newValue !== null && newValue !== undefined) {
                    updateData[key] = newValue;
                  }
                });
              } else {
                updateData = finalFinancialData;
              }
              
              // Upsert dos dados financeiros
              if (Object.keys(updateData).length > 0 || !existingFinancialData) {
                const { year: _, ...finalDataWithoutYear } = finalFinancialData;
                
                await prisma.financialData.upsert({
                  where: {
                    companyId_year: {
                      companyId: company.id,
                      year: year
                    }
                  },
                  update: updateData,
                  create: {
                    companyId: company.id,
                    year: year,
                    ...finalDataWithoutYear
                  }
                });
                
                console.log(`  ✅ ${year}: Dados criados/atualizados da Brapi PRO`);
                processedYears++;
                if (!existingFinancialData) {
                  createdYears++;
                } else {
                  updatedYears++;
                }
              }
            }
          }
        } catch (error: any) {
          console.error(`  ❌ Erro ao processar ano ${year} da Brapi PRO:`, error.message);
        }
      }
    }
    
    const summary = [`${processedYears} anos processados`];
    if (complementedYears > 0) {
      summary.push(`${complementedYears} complementados com Brapi`);
    }
    if (missingYears.length > 0) {
      summary.push(`${missingYears.length} ano(s) adicionado(s) da Brapi PRO`);
    }
    
    console.log(`✅ ${ticker}: ${summary.join(', ')}`);
    
  } catch (error: any) {
    console.error(`❌ 1 Erro ao processar empresa ${ticker}:`, error.message);
  }
}

// Função helper para preparar dados de um ano específico da Brapi PRO
async function prepareBrapiYearData(
  companyId: number,
  brapiProData: BrapiProResponse['results'][0],
  balance: BrapiBalanceSheet | null | undefined,
  income: BrapiIncomeStatement | null | undefined,
  cashflow: BrapiCashflowStatement | null | undefined,
  keyStats: BrapiKeyStatistics | null | undefined,
  financial: BrapiFinancialData | null | undefined,
  year: number
): Promise<any | null> {
  if (!balance && !income && !financial && !keyStats) {
    return null;
  }
  
  // Calcular indicadores derivados
  let psr = null;
  let pAtivos = null;
  let passivoAtivos = null;
  let giroAtivos = null;
  let dividaLiquidaPl = null;
  let dividaLiquidaEbitda = null;
  let pCapGiro = null;
  let pEbit = null;
  
  // Buscar marketCap do banco de dados se disponível
  const existingData = await prisma.financialData.findFirst({
    where: { companyId: companyId },
    orderBy: { year: 'desc' },
    select: { marketCap: true }
  });
  const marketCap = existingData?.marketCap ? Number(existingData.marketCap) : (keyStats?.sharesOutstanding && brapiProData.regularMarketPrice ? keyStats.sharesOutstanding * brapiProData.regularMarketPrice : null);
  
  if (balance) {
    // Calcular PSR: Market Cap / Total Revenue
    if (financial?.totalRevenue && marketCap) {
      psr = marketCap / financial.totalRevenue;
    }
    
    // P/Ativos = Market Cap / Total Assets
    if (marketCap && balance.totalAssets) {
      pAtivos = marketCap / balance.totalAssets;
    }
    
    // Passivo/Ativos
    if (balance?.totalCurrentLiabilities && balance?.nonCurrentLiabilities && balance?.totalAssets) {
      const totalRealLiab = balance.totalCurrentLiabilities + balance.nonCurrentLiabilities;
      if (totalRealLiab > 0 && balance.totalAssets > 0) {
        passivoAtivos = totalRealLiab / balance.totalAssets;
      }
    }
    
    // Giro Ativos = Receita Total / Total Assets
    if (financial?.totalRevenue && balance?.totalAssets) {
      giroAtivos = financial.totalRevenue / balance.totalAssets;
    }
    
    // Dívida Líquida/PL - usar totalLiab como aproximação da dívida
    const totalDebt = balance.totalLiab || financial?.totalDebt || 0;
    const cash = balance.cash || financial?.totalCash || 0;
    if (totalDebt > 0 && balance.totalStockholderEquity) {
      dividaLiquidaPl = (totalDebt - cash) / balance.totalStockholderEquity;
    }
    
    // Dívida Líquida/EBITDA
    if (totalDebt > 0 && financial?.ebitda) {
      dividaLiquidaEbitda = (totalDebt - cash) / financial.ebitda;
    }
    
    // P/Capital de Giro
    if (marketCap && balance.totalCurrentAssets && balance.totalCurrentLiabilities) {
      const workingCapital = balance.totalCurrentAssets - balance.totalCurrentLiabilities;
      if (workingCapital > 0) {
        pCapGiro = marketCap / workingCapital;
      }
    }
    
    // P/EBIT
    if (marketCap && financial?.totalRevenue && financial?.operatingMargins) {
      const ebit = financial.totalRevenue * financial.operatingMargins;
      if (ebit > 0) {
        pEbit = marketCap / ebit;
      }
    }
  }
  
  // Calcular earnings yield e P/L usando trailingEps
  let earningsYield = null;
  let pl = null;
  if (keyStats?.trailingEps && brapiProData.regularMarketPrice && keyStats.trailingEps > 0) {
    pl = brapiProData.regularMarketPrice / keyStats.trailingEps;
    earningsYield = 1 / pl;
  }
  
  return {
    // === INDICADORES DE VALUATION ===
    pl: pl,
    forwardPE: keyStats?.forwardPE || null,
    earningsYield: earningsYield,
    pvp: keyStats?.priceToBook || null,
    dy: keyStats?.dividendYield ? keyStats.dividendYield / 100 : null,
    evEbitda: keyStats?.enterpriseToEbitda || null,
    evEbit: keyStats?.enterpriseToRevenue || null,
    evRevenue: keyStats?.enterpriseToRevenue || null,
    psr: psr,
    pAtivos: pAtivos,
    pCapGiro: pCapGiro,
    pEbit: pEbit,
    lpa: keyStats?.trailingEps || income?.earningsPerShare || null,
    trailingEps: keyStats?.trailingEps || null,
    vpa: keyStats?.bookValue || null,
    
    // === DADOS DE MERCADO E AÇÕES ===
    marketCap: marketCap,
    enterpriseValue: keyStats?.enterpriseValue || null,
    sharesOutstanding: keyStats?.sharesOutstanding || null,
    totalAssets: balance?.totalAssets || null,
    
    // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
    dividaLiquidaPl: dividaLiquidaPl,
    dividaLiquidaEbitda: dividaLiquidaEbitda,
    liquidezCorrente: financial?.currentRatio || null,
    liquidezRapida: financial?.quickRatio || null,
    passivoAtivos: passivoAtivos,
    debtToEquity: financial?.debtToEquity || null,
    
    // === INDICADORES DE RENTABILIDADE ===
    roe: financial?.returnOnEquity || null,
    roic: calculateROIC({
      roicFromAPI: null,
      receitaTotal: financial?.totalRevenue,
      operatingMargins: financial?.operatingMargins,
      totalAssets: balance?.totalAssets,
      currentLiabilities: balance?.totalCurrentLiabilities,
      patrimonioLiquido: balance?.totalStockholderEquity,
      totalDivida: balance?.totalLiab || financial?.totalDebt || null,
      year: year
    }),
    roa: financial?.returnOnAssets || null,
    margemBruta: financial?.grossMargins || null,
    margemEbitda: financial?.ebitdaMargins || null,
    margemLiquida: financial?.profitMargins || keyStats?.profitMargins || null,
    giroAtivos: giroAtivos,
    
    // === INDICADORES DE CRESCIMENTO ===
    cagrLucros5a: keyStats?.earningsAnnualGrowth || null,
    crescimentoLucros: financial?.earningsGrowth || null,
    crescimentoReceitas: financial?.revenueGrowth || null,
    
    // === DADOS DE DIVIDENDOS ===
    dividendYield12m: keyStats?.dividendYield ? keyStats.dividendYield / 100 : null,
    payout: calculatePayout({
      payoutFromAPI: keyStats?.payoutRatio,
      dividendYield: keyStats?.dividendYield ? keyStats.dividendYield / 100 : null,
      marketCap: marketCap,
      lpa: keyStats?.trailingEps || income?.earningsPerShare,
      sharesOutstanding: keyStats?.sharesOutstanding,
      lucroLiquido: income?.netIncome || financial?.grossProfits,
      year: year
    }),
    ultimoDividendo: keyStats?.lastDividendValue || null,
    dataUltimoDividendo: keyStats?.lastDividendDate ? new Date(keyStats.lastDividendDate) : null,
    
    // === PERFORMANCE E VARIAÇÕES ===
    variacao52Semanas: keyStats?.["52WeekChange"] || null,
    retornoAnoAtual: keyStats?.ytdReturn || null,
    
    // === DADOS FINANCEIROS OPERACIONAIS ===
    ebitda: financial?.ebitda || income?.ebit || null,
    receitaTotal: financial?.totalRevenue || income?.totalRevenue || null,
    lucroLiquido: income?.netIncome || financial?.grossProfits || null,
    fluxoCaixaOperacional: cashflow?.operatingCashFlow || financial?.operatingCashflow || null,
    fluxoCaixaInvestimento: cashflow?.investmentCashFlow || null,
    fluxoCaixaFinanciamento: cashflow?.financingCashFlow || null,
    fluxoCaixaLivre: financial?.freeCashflow || null,
    totalCaixa: financial?.totalCash || balance?.cash || null,
    totalDivida: financial?.totalDebt || balance?.totalLiab || null,
    receitaPorAcao: financial?.revenuePerShare || null,
    caixaPorAcao: financial?.totalCashPerShare || null,
    
    // === DADOS DO BALANÇO PATRIMONIAL ===
    ativoCirculante: balance?.totalCurrentAssets || null,
    ativoTotal: balance?.totalAssets || null,
    passivoCirculante: balance?.totalCurrentLiabilities || null,
    passivoTotal: balance?.totalLiab || null,
    patrimonioLiquido: balance?.totalStockholderEquity || null,
    caixa: balance?.cash || null,
    estoques: null, // Não disponível na interface
    contasReceber: null, // Não disponível na interface
    imobilizado: null, // Não disponível na interface
    intangivel: balance?.netTangibleAssets || null,
    dividaCirculante: balance?.currentLiabilities || null,
    dividaLongoPrazo: balance?.nonCurrentLiabilities || null,
    
    // === METADADOS ===
    dataSource: 'brapi'
  };
}

// Função principal com gerenciamento de estado baseado em tickers individuais
async function main() {
  const startTime = Date.now();
  console.log(`🚀 Iniciando fetch de dados da Ward API... [${new Date().toLocaleString('pt-BR')}]\n`);
  
  const tickerManager = new TickerProcessingManager('ward_data_fetch');
  
  try {
    // Verificar argumentos: tickers e opções
    const args = process.argv.slice(2);
    const noBrapiIndex = args.indexOf('--no-brapi');
    const forceFullIndex = args.indexOf('--force-full');
    const resetIndex = args.indexOf('--reset');
    const discoverIndex = args.indexOf('--discover');
    const enableBrapiComplement = true; //noBrapiIndex === -1;
    const forceFullUpdate = forceFullIndex !== -1;
    const resetState = resetIndex !== -1;
    const discoverTickers = discoverIndex !== -1;
    
    // Remover opções dos tickers
    const tickers = args.filter((arg, index) => 
      index !== noBrapiIndex && 
      index !== forceFullIndex && 
      index !== resetIndex &&
      index !== discoverIndex &&
      arg !== '--no-brapi' && 
      arg !== '--force-full' &&
      arg !== '--reset' &&
      arg !== '--discover'
    ).map(t => t.toUpperCase());
    
    console.log(`🔧 Complemento Brapi: ${enableBrapiComplement ? '✅ Ativado' : '❌ Desativado'}`);
    console.log(`🔄 Atualização completa: ${forceFullUpdate ? '✅ Forçada' : '❌ Inteligente'}`);
    console.log(`🔄 Reset de estado: ${resetState ? '✅ Sim' : '❌ Não'}`);
    console.log(`🔍 Descobrir tickers: ${discoverTickers ? '✅ Sim' : '❌ Não'}`);
    
    // Reset do estado se solicitado
    if (resetState) {
      await tickerManager.resetAllTickers();
      console.log('🔄 Estado de todos os tickers resetado.\n');
    }
    
    // Descobrir novos tickers se solicitado
    if (discoverTickers || tickers.length === 0 && !resetState) {
      await discoverAndInitializeTickers(tickerManager);
    }
    
    // Mostrar estado atual
    const summary = await tickerManager.getProcessingSummary();
    console.log('📊 Estado atual do processamento:');
    console.log(`   ${tickerManager.getFormattedSummary(summary)}\n`);
    
    // Determinar estratégia de processamento
    if (tickers.length > 0) {
      console.log(`📋 Processando tickers especificados: ${tickers.join(', ')}`);
      await processSpecificTickersNew(tickers, enableBrapiComplement, forceFullUpdate, tickerManager);
    } else {
      console.log('⚡ Processando tickers pendentes automaticamente');
      await processWithTickerManagement(enableBrapiComplement, forceFullUpdate, tickerManager);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    console.log('\n✅ Execução concluída!');
    console.log(`⏱️  Tempo de processamento: ${minutes}m ${seconds}s`);
    console.log(`📅 Finalizado em: ${new Date().toLocaleString('pt-BR')}`);
    
    // Mostrar estado final
    const finalSummary = await tickerManager.getProcessingSummary();
    console.log('\n📊 Estado final:');
    console.log(`   ${tickerManager.getFormattedSummary(finalSummary)}`);
    
  } catch (error: any) {
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    console.error('❌ Erro geral:', error.message);
    console.log(`⏱️  Tempo até erro: ${minutes}m ${seconds}s`);
  } finally {
    // Desconectar o cliente Prisma de background
    await backgroundPrismaManager.disconnect();
  }
}





// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

// Função para ler tickers do CSV da B3
function readTickersFromCSV(): string[] {
  try {
    const csvPath = path.join(__dirname, 'acoes-listadas-b3.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  Arquivo CSV não encontrado em: ${csvPath}`);
      return [];
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
      console.log('⚠️  CSV vazio ou sem dados');
      return [];
    }
    
    // Pular o header (primeira linha)
    const tickers: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parsear CSV com aspas: "Ticker","Nome",...
      // Extrair o primeiro campo (Ticker) removendo aspas
      // Regex mais robusta: captura o primeiro campo entre aspas
      const match = line.match(/^"([^"]+)"/);
      if (match && match[1]) {
        const ticker = match[1].trim().toUpperCase();
        // Validar formato básico de ticker (ex: ABC3, ABC4, ABC11)
        if (ticker && ticker.length >= 3 && /^[A-Z0-9]+$/.test(ticker)) {
          tickers.push(ticker);
        }
      }
    }
    
    const uniqueTickers = [...new Set(tickers)];
    console.log(`📄 CSV lido: ${uniqueTickers.length} tickers únicos encontrados (de ${tickers.length} totais)`);
    return uniqueTickers;
    
  } catch (error: any) {
    console.error(`❌ Erro ao ler CSV:`, error.message);
    return [];
  }
}

// Função para descobrir e inicializar tickers da Ward API e CSV da B3
async function discoverAndInitializeTickers(tickerManager: TickerProcessingManager): Promise<void> {
  console.log('🔍 Descobrindo tickers disponíveis...');
  
  const allTickers = new Set<string>();
  
  // 1. Buscar tickers da Ward API
  try {
    console.log('📡 Buscando tickers da Ward API...');
    const wardTickers = await fetchWardTickers();
    
    if (wardTickers.length > 0) {
      wardTickers.forEach(item => {
        allTickers.add(item.ticker.toUpperCase());
      });
      console.log(`✅ ${wardTickers.length} tickers encontrados na Ward API`);
    } else {
      console.log('⚠️  Nenhum ticker encontrado na Ward API');
    }
  } catch (error: any) {
    console.error(`⚠️  Erro ao buscar tickers da Ward API:`, error.message);
  }
  
  // 2. Ler tickers do CSV da B3
  try {
    console.log('📄 Lendo tickers do CSV da B3...');
    const csvTickers = readTickersFromCSV();
    
    if (csvTickers.length > 0) {
      csvTickers.forEach(ticker => {
        allTickers.add(ticker.toUpperCase());
      });
      console.log(`✅ ${csvTickers.length} tickers adicionados do CSV`);
    } else {
      console.log('⚠️  Nenhum ticker encontrado no CSV');
    }
  } catch (error: any) {
    console.error(`⚠️  Erro ao ler CSV:`, error.message);
  }
  
  // 3. Combinar e inicializar todos os tickers únicos
  const uniqueTickers = Array.from(allTickers);
  
  if (uniqueTickers.length === 0) {
    console.log('❌ Nenhum ticker encontrado em nenhuma fonte');
    return;
  }
  
  console.log(`📋 Total de ${uniqueTickers.length} tickers únicos encontrados`);
  console.log(`📋 Inicializando ${uniqueTickers.length} tickers no sistema...`);
  
  // Inicializar todos os tickers com prioridade normal
  await tickerManager.initializeTickers(uniqueTickers, 0);
  
  console.log(`✅ ${uniqueTickers.length} tickers inicializados no sistema`);
}

// Função para processar tickers específicos (nova versão com paralelismo)
async function processSpecificTickersNew(
  tickers: string[], 
  enableBrapiComplement: boolean, 
  forceFullUpdate: boolean,
  tickerManager: TickerProcessingManager
): Promise<void> {
  console.log(`📦 Processando ${tickers.length} tickers especificados`);
  
  // Inicializar tickers específicos com prioridade alta
  await tickerManager.initializeTickers(tickers, 1);
  
  // Buscar informações dos tickers
  const tickerInfos = await tickerManager.getSpecificTickers(tickers);
  
  // Processar em lotes de 5 empresas paralelas
  const batchSize = 5;
  const concurrencyManager = new ConcurrencyManager(batchSize);
  
  console.log(`🔄 Processando ${tickerInfos.length} tickers em lotes de ${batchSize} paralelos\n`);
  
  for (let i = 0; i < tickerInfos.length; i += batchSize) {
    const batch = tickerInfos.slice(i, i + batchSize);
    const batchStartTime = Date.now();
    
    console.log(`📦 Lote ${Math.floor(i / batchSize) + 1}: ${batch.map(t => t.ticker).join(', ')}`);
    
    // Processar lote em paralelo
    const batchPromises = batch.map((tickerInfo, batchIndex) => 
      concurrencyManager.execute(async () => {
        const ticker = tickerInfo.ticker;
        const tickerStartTime = Date.now();
        
        try {
          console.log(`🏢 [${i + batchIndex + 1}/${tickerInfos.length}] Processando ${ticker}...`);
          
          // Marcar como em processamento
          await tickerManager.markProcessing(ticker);
          
          // Processar empresa com timeout
          await executeWithTimeout(
            () => processCompanyWithTracking(ticker, enableBrapiComplement, forceFullUpdate, tickerManager),
            120000 // 2 minutos timeout por ticker
          );
          
          const tickerTime = Date.now() - tickerStartTime;
          console.log(`✅ ${ticker} processado em ${Math.round(tickerTime / 1000)}s`);
          
          return { success: true, ticker, time: tickerTime };
          
        } catch (error: any) {
          console.error(`❌ Erro ao processar ticker ${ticker}:`, error.message);
          await tickerManager.markError(ticker, error.message);
          return { success: false, ticker, error: error.message };
        }
      })
    );
    
    // Aguardar lote completo
    try {
      const results = await Promise.all(batchPromises);
      const successful = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      
      const batchTime = Date.now() - batchStartTime;
      console.log(`📦 Lote processado em ${Math.round(batchTime / 1000)}s: ${successful} sucessos, ${failed} falhas\n`);
      
    } catch (error: any) {
      console.error(`❌ Erro no lote:`, error.message);
    }
    
    // Pequeno delay entre lotes para não sobrecarregar
    if (i + batchSize < tickerInfos.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Função para processar apenas dados TTM de uma empresa (com prioridade Fundamentus > Ward > Brapi)
async function processCompanyTTMOnly(
  ticker: string,
  tickerManager: TickerProcessingManager
): Promise<void> {
  try {
    console.log(`📊 Processando apenas TTM para ${ticker}...`);
    
    // Garantir que a empresa existe
    const company = await createOrUpdateCompany(ticker);

    if (!company) {
      console.log(`❌ Não foi possível criar/encontrar empresa ${ticker}. Pulando...`);
      await tickerManager.updateProgress(ticker, { 
        status: 'SKIPPED',
        error: 'Empresa não encontrada/criada'
      });
      return;
    }

    const currentYear = new Date().getFullYear();
    let fundamentusFinancialData = null;
    let wardCurrentYearData = null;
    let brapiTTMData = null;

    // 1. BUSCAR DADOS DO FUNDAMENTUS (PRIORIDADE MÁXIMA)
    console.log(`🔄 Buscando dados TTM do Fundamentus para ${ticker}...`);
    try {
      const fundamentusData = await fetchFundamentusData(ticker);
      if (fundamentusData) {
        console.log(`✅ Dados do Fundamentus obtidos para ${ticker}`);
        
        // Processar oscilações de preço e dados trimestrais
        await processPriceOscillations(company.id, ticker, fundamentusData);
        await processQuarterlyFinancials(company.id, ticker, fundamentusData);
        
        // Converter dados do Fundamentus
        fundamentusFinancialData = convertFundamentusToFinancialData(fundamentusData);
        
        // Recalcular métricas de crescimento para todos os anos
        await calculateAndUpdateAllGrowthMetrics(company.id);
        
        console.log(`  📊 Dados do Fundamentus processados para ${ticker}`);
      } else {
        console.log(`  ⚠️  Dados do Fundamentus não disponíveis para ${ticker}`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Erro ao buscar dados do Fundamentus para ${ticker}:`, error.message);
    }

    // 2. BUSCAR DADOS DA WARD (SEGUNDA PRIORIDADE)
    console.log(`🔄 Buscando dados TTM da Ward para ${ticker}...`);
    try {
      const wardData = await fetchWardData(ticker);
      if (wardData && wardData.historicalStocks) {
        // Buscar dados do ano atual na Ward
        const currentYearStock = wardData.historicalStocks.find(stock => 
          parseInt(stock.ano) === currentYear
        );
        
        if (currentYearStock) {
          wardCurrentYearData = await convertWardDataToFinancialData(currentYearStock, company.id);
          console.log(`  ✅ Dados da Ward obtidos para ${ticker} (${currentYear})`);
        } else {
          console.log(`  ⚠️  Dados da Ward não disponíveis para o ano atual (${currentYear})`);
        }
      } else {
        console.log(`  ⚠️  Dados da Ward não disponíveis para ${ticker}`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Erro ao buscar dados da Ward para ${ticker}:`, error.message);
    }

    // 3. BUSCAR DADOS DA BRAPI PRO (TERCEIRA PRIORIDADE)
    console.log(`🔄 Buscando dados TTM da Brapi PRO para ${ticker}...`);
    brapiTTMData = await fetchBrapiTTMData(ticker);
    
    if (brapiTTMData) {
      console.log(`  ✅ Dados TTM da Brapi PRO obtidos para ${ticker}`);
      
      // 3.1. ATUALIZAR COTAÇÃO ATUAL (regularMarketPrice)
      if (brapiTTMData.regularMarketPrice) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.dailyQuote.upsert({
          where: {
            companyId_date: {
              companyId: company.id,
              date: today
            }
          },
          update: {
            price: brapiTTMData.regularMarketPrice
          },
          create: {
            companyId: company.id,
            date: today,
            price: brapiTTMData.regularMarketPrice
          }
        });

        console.log(`  💰 Cotação TTM atualizada: ${ticker} - R$ ${brapiTTMData.regularMarketPrice}`);
      }
      
      // 3.2. ATUALIZAR DADOS HISTÓRICOS DE PREÇO (últimos 2 meses)
      await updateRecentHistoricalPrices(company.id, ticker);
      
      // 3.3. Processar estatística TTM atual (sempre atualizar)
      if (brapiTTMData.defaultKeyStatistics) {
        const currentYear = new Date().getFullYear();
        await processKeyStatisticTTM(company.id, ticker, brapiTTMData.defaultKeyStatistics, currentYear);
        console.log(`  📋 Estatística TTM processada`);
      }
      
      // 3.4. Processar dados TTM do financialData
      if (brapiTTMData.financialData) {
        await processFinancialDataTTM(company.id, ticker, brapiTTMData.financialData);
      }
    } else {
      console.log(`  ⚠️  Dados TTM da Brapi PRO não disponíveis para ${ticker}`);
    }

    // 4. MESCLAR DADOS COM PRIORIDADE: FUNDAMENTUS > WARD > BRAPI
    if (fundamentusFinancialData || wardCurrentYearData || brapiTTMData) {
      console.log(`🔄 Mesclando dados TTM com prioridade para ${ticker}...`);
      
      // Buscar dados existentes para o ano atual
      const existingFinancialData = await prisma.financialData.findUnique({
        where: {
          companyId_year: {
            companyId: company.id,
            year: currentYear
          }
        }
      });
      
      // Preparar dados da Brapi no formato correto
      let brapiFormattedData = null;
      if (brapiTTMData?.financialData || brapiTTMData?.defaultKeyStatistics) {
        // === CALCULAR PAYOUT SE NÃO DISPONÍVEL ===
        const stats = brapiTTMData.defaultKeyStatistics;
        const financial = brapiTTMData.financialData;
        
        // Buscar marketCap do banco de dados se disponível
        const existingData = await prisma.financialData.findFirst({
          where: { companyId: company.id },
          orderBy: { year: 'desc' },
          select: { marketCap: true }
        });
        
        const calculatedPayoutTTM = calculatePayout({
          payoutFromAPI: stats?.payoutRatio,
          dividendYield: stats?.dividendYield ? stats.dividendYield / 100 : null,
          marketCap: existingData?.marketCap ? Number(existingData.marketCap) : null,
          lpa: stats?.trailingEps,
          sharesOutstanding: stats?.sharesOutstanding,
          lucroLiquido: financial?.grossProfits,
          year: currentYear
        });
        
        // Buscar dados do balanço para calcular ROIC
        const balanceSheetData = await prisma.balanceSheet.findFirst({
          where: { companyId: company.id },
          orderBy: { endDate: 'desc' },
          select: {
            totalAssets: true,
            totalCurrentLiabilities: true,
            totalStockholderEquity: true
          }
        });
        
        brapiFormattedData = {
          // Mapear campos da Brapi para o formato esperado
          forwardPE: brapiTTMData.financialData?.currentPrice && brapiTTMData.financialData?.earningsGrowth ? 
            brapiTTMData.financialData.currentPrice / (brapiTTMData.financialData.earningsGrowth * brapiTTMData.financialData.currentPrice) : null,
          liquidezCorrente: brapiTTMData.financialData?.currentRatio,
          liquidezRapida: brapiTTMData.financialData?.quickRatio,
          debtToEquity: brapiTTMData.financialData?.debtToEquity,
          roe: brapiTTMData.financialData?.returnOnEquity,
          roic: calculateROIC({
            roicFromAPI: null, // Não temos ROIC direto da API TTM
            ebit: brapiTTMData.financialData?.ebitda, // Usar EBITDA como aproximação
            receitaTotal: brapiTTMData.financialData?.totalRevenue,
            operatingMargins: brapiTTMData.financialData?.operatingMargins || brapiTTMData.financialData?.ebitdaMargins,
            totalAssets: balanceSheetData?.totalAssets ? Number(balanceSheetData.totalAssets) : null,
            currentLiabilities: balanceSheetData?.totalCurrentLiabilities ? Number(balanceSheetData.totalCurrentLiabilities) : null,
            patrimonioLiquido: balanceSheetData?.totalStockholderEquity ? Number(balanceSheetData.totalStockholderEquity) : null,
            totalDivida: brapiTTMData.financialData?.totalDebt,
            year: currentYear
          }),
          roa: brapiTTMData.financialData?.returnOnAssets,
          margemBruta: brapiTTMData.financialData?.grossMargins,
          margemEbitda: brapiTTMData.financialData?.ebitdaMargins,
          margemLiquida: brapiTTMData.financialData?.profitMargins,
          crescimentoLucros: brapiTTMData.financialData?.earningsGrowth,
          crescimentoReceitas: brapiTTMData.financialData?.revenueGrowth,
          ebitda: brapiTTMData.financialData?.ebitda,
          receitaTotal: brapiTTMData.financialData?.totalRevenue,
          lucroLiquido: brapiTTMData.financialData?.grossProfits,
          fluxoCaixaOperacional: brapiTTMData.financialData?.operatingCashflow,
          fluxoCaixaLivre: brapiTTMData.financialData?.freeCashflow,
          totalCaixa: brapiTTMData.financialData?.totalCash,
          totalDivida: brapiTTMData.financialData?.totalDebt,
          receitaPorAcao: brapiTTMData.financialData?.revenuePerShare,
          caixaPorAcao: brapiTTMData.financialData?.totalCashPerShare,
          // Payout do defaultKeyStatistics ou calculado
          payout: calculatedPayoutTTM
        };
      }
      
      // Mesclar dados com prioridade
      let finalFinancialData;
      if (existingFinancialData) {
        // Se já existe, usar função de mesclagem do Fundamentus se temos dados do Fundamentus
        if (fundamentusFinancialData) {
          finalFinancialData = mergeFundamentusWithExistingData(fundamentusFinancialData, existingFinancialData);
          console.log(`  🔄 Dados mesclados: Fundamentus + existentes`);
        } else {
          // Senão, usar nova função de prioridade
          finalFinancialData = mergeFinancialDataWithPriority(
            fundamentusFinancialData,
            wardCurrentYearData,
            brapiFormattedData,
            currentYear
          );
          console.log(`  🔄 Dados mesclados: Ward + Brapi + existentes`);
        }
      } else {
        // Criar novo registro
        finalFinancialData = mergeFinancialDataWithPriority(
          fundamentusFinancialData,
          wardCurrentYearData,
          brapiFormattedData,
          currentYear
        );
        console.log(`  🆕 Novos dados TTM criados`);
      }
      
      // Calcular ROIC se não disponível após mesclagem
      if (!finalFinancialData.roic || finalFinancialData.roic === null) {
        const balanceSheetDataForROIC = await prisma.balanceSheet.findFirst({
          where: { 
            companyId: company.id,
            endDate: {
              gte: new Date(currentYear, 0, 1),
              lt: new Date(currentYear + 1, 0, 1)
            }
          },
          orderBy: { endDate: 'desc' },
          select: {
            totalAssets: true,
            totalCurrentLiabilities: true,
            totalStockholderEquity: true
          }
        });
        
        const calculatedROIC = calculateROIC({
          roicFromAPI: finalFinancialData.roic,
          ebit: finalFinancialData.ebitda ? Number(finalFinancialData.ebitda) : null,
          receitaTotal: finalFinancialData.receitaTotal ? Number(finalFinancialData.receitaTotal) : null,
          operatingMargins: finalFinancialData.margemEbitda,
          totalAssets: balanceSheetDataForROIC?.totalAssets ? Number(balanceSheetDataForROIC.totalAssets) : (finalFinancialData.ativoTotal ? Number(finalFinancialData.ativoTotal) : (finalFinancialData.totalAssets ? Number(finalFinancialData.totalAssets) : null)),
          currentLiabilities: balanceSheetDataForROIC?.totalCurrentLiabilities ? Number(balanceSheetDataForROIC.totalCurrentLiabilities) : (finalFinancialData.passivoCirculante ? Number(finalFinancialData.passivoCirculante) : null),
          patrimonioLiquido: balanceSheetDataForROIC?.totalStockholderEquity ? Number(balanceSheetDataForROIC.totalStockholderEquity) : (finalFinancialData.patrimonioLiquido ? Number(finalFinancialData.patrimonioLiquido) : null),
          totalDivida: finalFinancialData.totalDivida ? Number(finalFinancialData.totalDivida) : null,
          year: currentYear
        });
        
        if (calculatedROIC) {
          finalFinancialData.roic = calculatedROIC;
        }
      }
      
      // Preservar valores existentes quando novo valor é NULL
      let updateData: any = {};
      if (existingFinancialData) {
        // Para cada campo, só atualizar se o novo valor não for NULL
        // Se for NULL e já existe valor no banco, manter o valor do banco
        Object.keys(finalFinancialData).forEach(key => {
          const newValue = (finalFinancialData as any)[key];
          
          // Se novo valor não é NULL, usar novo valor
          if (newValue !== null && newValue !== undefined) {
            updateData[key] = newValue;
          }
          // Se novo valor é NULL, manter valor existente (não atualizar campo)
        });
      } else {
        // Se não existe registro, usar todos os valores (mesmo NULL)
        updateData = finalFinancialData;
      }
      
      // Upsert dos dados financeiros
      await prisma.financialData.upsert({
        where: {
          companyId_year: {
            companyId: company.id,
            year: currentYear
          }
        },
        update: updateData,
        create: {
          companyId: company.id,
          year: currentYear,
          ...finalFinancialData
        }
      });
      
      // Log dos principais indicadores atualizados
      const indicators = [];
      if (finalFinancialData.pl) indicators.push(`P/L=${finalFinancialData.pl}`);
      if (finalFinancialData.roe) indicators.push(`ROE=${(finalFinancialData.roe * 100).toFixed(2)}%`);
      if (finalFinancialData.dy) indicators.push(`DY=${(finalFinancialData.dy * 100).toFixed(2)}%`);
      if (finalFinancialData.cagrLucros5a) indicators.push(`CAGR-L=${(finalFinancialData.cagrLucros5a * 100).toFixed(1)}%`);
      if (finalFinancialData.cagrReceitas5a) indicators.push(`CAGR-R=${(finalFinancialData.cagrReceitas5a * 100).toFixed(1)}%`);
      
      console.log(`  📊 TTM atualizado: ${indicators.join(', ')}`);
      console.log(`✅ Dados TTM processados para ${ticker} (fonte: ${finalFinancialData.dataSource})`);
      
      // Atualizar progresso
      await tickerManager.updateProgress(ticker, {
        hasBasicData: true,
        hasTTMData: true,
        hasBrapiProData: !!brapiTTMData,
        hasHistoricalData: true // Manter como true se já tinha
      });
    } else {
      console.log(`⚠️  Nenhuma fonte de dados TTM disponível para ${ticker}`);
      await tickerManager.updateProgress(ticker, { 
        error: 'Nenhuma fonte de dados TTM disponível'
      });
    }
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar TTM para ${ticker}:`, error.message);
    throw error;
  }
}

// Função para processar empresa com rastreamento de progresso
async function processCompanyWithTracking(
  ticker: string, 
  enableBrapiComplement: boolean, 
  forceFullUpdate: boolean, 
  tickerManager: TickerProcessingManager
): Promise<void> {
  try {
    console.log(`🏢 Processando ${ticker}...`);
    
    // Primeiro, garantir que a empresa existe (criar se necessário)
    const company = await createOrUpdateCompany(ticker);

    if (!company) {
      console.log(`❌ Não foi possível criar/encontrar empresa ${ticker}. Pulando...`);
      await tickerManager.updateProgress(ticker, { 
        status: 'SKIPPED',
        error: 'Empresa não encontrada/criada'
      });
      return;
    }

    // Marcar que tem dados básicos
    await tickerManager.updateProgress(ticker, { hasBasicData: true });

    // Usar a função original de processamento
    await processCompany(ticker, enableBrapiComplement, forceFullUpdate);

    // Atualizar progresso final como completo
    await tickerManager.updateProgress(ticker, {
      hasBasicData: true,
      hasHistoricalData: true,
      hasTTMData: true,
      hasBrapiProData: true,
      status: 'COMPLETED'
    });
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar empresa ${ticker}:`, error.message);
    throw error;
  }
}

// Função para processar com gerenciamento de tickers
async function processWithTickerManagement(
  enableBrapiComplement: boolean, 
  forceFullUpdate: boolean,
  tickerManager: TickerProcessingManager
): Promise<void> {
  
  const maxProcessingTime = 55 * 1000; // 55 segundos em ms (buffer de 10s do limite de 60s da Vercel)
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  
  // Aumentar paralelismo para processar mais empresas
  const MAX_CONCURRENT = 10; // Aumentado de 5 para 10 empresas simultâneas
  const ESTIMATED_TIME_PER_TICKER = 6 * 1000; // Reduzido de 10s para 6s (com mais paralelismo, cada um é mais rápido)
  const MAX_BATCH_SIZE = 12; // Aumentado de 5 para 12 tickers por batch
  
  console.log(`⏱️  Tempo máximo de processamento: 55 segundos`);
  console.log(`🚀 Paralelismo: ${MAX_CONCURRENT} empresas simultâneas\n`);
  
  while (true) {
    // Verificar se ainda temos tempo
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime >= maxProcessingTime) {
      console.log(`⏰ Tempo limite atingido (${Math.round(elapsedTime / 1000)}s). Parando...`);
      break;
    }
    
    // Buscar próximos tickers para processar
    const remainingTime = maxProcessingTime - elapsedTime;
    // Com mais paralelismo, podemos processar mais tickers no mesmo tempo
    const maxBatchSize = Math.floor(remainingTime / ESTIMATED_TIME_PER_TICKER);
    const batchSize = Math.min(Math.max(1, maxBatchSize), MAX_BATCH_SIZE); // Entre 1 e MAX_BATCH_SIZE tickers
    
    console.log(`⏱️  Tempo restante: ${Math.round(remainingTime / 1000)}s, lote: ${batchSize} tickers`);
    
    const tickers = await tickerManager.getTickersToProcess(batchSize, {
      excludeErrors: true,
      maxErrorCount: 2
    });
    
    if (tickers.length === 0) {
      console.log('🎉 Não há mais tickers para processar');
      break;
    }
    
    console.log(`📦 Processando lote de ${tickers.length} tickers:`);
    tickers.forEach((t, i) => {
      const needs = [];
      if (t.needsHistoricalData) needs.push('histórico');
      if (t.needsTTMUpdate) needs.push('TTM');
      if (t.needsBrapiProData) needs.push('Brapi Pro');
      console.log(`   ${i + 1}. ${t.ticker} (${needs.join(', ') || 'atualização'})`);
    });
    console.log('');
    
    // Processar lote em paralelo (MAX_CONCURRENT empresas simultâneas)
    const concurrencyManager = new ConcurrencyManager(MAX_CONCURRENT);
    const batchStartTime = Date.now();
    
    const tickerPromises = tickers.map((tickerInfo, index) => 
      concurrencyManager.execute(async () => {
        const tickerStartTime = Date.now();
        
        try {
          console.log(`🏢 [${processedCount + index + 1}] Processando ${tickerInfo.ticker}...`);
          
          // Marcar como em processamento
          await tickerManager.markProcessing(tickerInfo.ticker);
          
          // Determinar tipo de processamento baseado nas necessidades
          const shouldProcessHistorical = tickerInfo.needsHistoricalData || forceFullUpdate;
          const needsTTMOnly = !tickerInfo.needsHistoricalData && tickerInfo.needsTTMUpdate && !forceFullUpdate;
          
          // Se precisa apenas de TTM, usar processamento otimizado
          if (needsTTMOnly) {
            console.log(`📊 ${tickerInfo.ticker} precisa apenas de atualização TTM`);
            await executeWithTimeout(
              () => processCompanyTTMOnly(tickerInfo.ticker, tickerManager),
              6000 // 6 segundos timeout para TTM apenas (otimizado com mais paralelismo)
            );
          } else {
            // Processar completo com timeout
            await executeWithTimeout(
              () => processCompanyWithTracking(tickerInfo.ticker, enableBrapiComplement, shouldProcessHistorical, tickerManager),
              7000 // 7 segundos timeout por ticker (otimizado com mais paralelismo)
            );
          }
          
          const tickerTime = Date.now() - tickerStartTime;
          console.log(`✅ ${tickerInfo.ticker} processado em ${Math.round(tickerTime / 1000)}s`);
          
          return { success: true, ticker: tickerInfo.ticker, time: tickerTime };
          
        } catch (error: any) {
          console.error(`❌ Erro ao processar ${tickerInfo.ticker}:`, error.message);
          await tickerManager.markError(tickerInfo.ticker, error.message);
          return { success: false, ticker: tickerInfo.ticker, error: error.message };
        }
      })
    );
    
    // Aguardar todas os tickers do lote com timeout geral
    // Com mais paralelismo, podemos ter batches maiores, mas ainda precisamos de buffer
    const batchTimeout = Math.min(maxProcessingTime - (Date.now() - startTime) - 3000, 20000); // Máximo 20s por batch (aumentado)
    
    try {
      const results = await executeWithTimeout(
        () => Promise.all(tickerPromises),
        batchTimeout
      );
      
      // Contar resultados
      const successful = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      
      processedCount += successful;
      errorCount += failed;
      
      const batchTime = Date.now() - batchStartTime;
      console.log(`📦 Lote processado em ${Math.round(batchTime / 1000)}s: ${successful} sucessos, ${failed} falhas`);
      
    } catch (timeoutError) {
      console.log(`⏰ Timeout do lote - algumas empresas podem não ter terminado`);
      
      // Contar quantos conseguimos processar
      const completedResults = await Promise.allSettled(tickerPromises);
      const successful = completedResults.filter((r: any) => r.status === 'fulfilled' && r.value.success).length;
      const failed = completedResults.length - successful;
      
      processedCount += successful;
      errorCount += failed;
    }
    
    console.log(`📊 Progresso: ${processedCount} sucessos, ${errorCount} erros\n`);
  }
  
  console.log(`\n📊 Resumo da execução:`);
  console.log(`   ✅ Tickers processados: ${processedCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  console.log(`   ⏱️  Tempo total: ${Math.round((Date.now() - startTime) / 1000)}s`);
}

export { 
  main, 
  processCompany, 
  fetchWardData, 
  fetchWardTickers, 
  createOrUpdateCompany, 
  fetchBrapiBasicData,
  fetchBrapiProData,
  fetchBrapiTTMData,
  processBalanceSheets,
  processIncomeStatements,
  processCashflowStatements,
  processKeyStatistics,
  processKeyStatisticTTM,
  processValueAddedStatements,
  processFinancialDataTTM,
  updateRecentHistoricalPrices,
  checkExistingHistoricalData,
  getExistingDataDates,
  filterMissingData,
  processDataSequentially,
  discoverAndInitializeTickers,
  processSpecificTickersNew,
  processCompanyTTMOnly,
  processCompanyWithTracking,
  processWithTickerManagement,
  mergeFinancialDataWithPriority,
  mergeWardWithBrapiData
};
