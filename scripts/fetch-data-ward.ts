import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
// Importar apenas o que precisamos do fetch-data.ts
// import { DataFetcher } from './fetch-data';

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

const prisma = new PrismaClient();

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
const WARD_JWT_TOKEN = process.env.WARD_JWT_TOKEN || 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjE1MDc5IiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvZW1haWxhZGRyZXNzIjoiYnVzYW1hckBnbWFpbC5jb20iLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJVc2VyIiwiaWF0IjoxNzU3NzAwNjE5LCJhdWQiOlsiaHR0cHM6Ly9kZXYud2FyZC5hcHAuYnIiLCJodHRwczovL3dhcmQuYXBwLmJyIiwiaHR0cHM6Ly90YXNrcy53YXJkLmFwcC5iciJdLCJleHAiOjE3NTg5OTY2MTksImlzcyI6Imh0dHBzOi8vd2FyZC5hcHAuYnIifQ.BBtBaqK5a2DL4G0QVd7H3rjFp-jxrjE1IVr8kfpIApW1uepBB_RVBkXPMVqFV6Aia2GGQyD_BDM0oJavhM-NgA';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN; // Opcional para plano gratuito

// Função para buscar dados completos da Brapi PRO
async function fetchBrapiProData(ticker: string): Promise<BrapiProResponse['results'][0] | null> {
  try {
    console.log(`🔍 Buscando dados completos da Brapi PRO para ${ticker}...`);
    
    if (!BRAPI_TOKEN) {
      console.log(`⚠️  BRAPI_TOKEN não configurado, pulando dados da Brapi PRO`);
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
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`❌ Empresa ${ticker} não encontrada na Brapi PRO`);
    } else if (error.response?.status === 429) {
      console.log(`⏳ Rate limit atingido na Brapi PRO para ${ticker}, aguardando...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else if (error.response?.status === 401) {
      console.log(`🔐 Token inválido ou expirado na Brapi PRO para ${ticker}`);
    } else {
      console.error(`❌ Erro ao buscar dados da Brapi PRO para ${ticker}:`, error.message);
    }
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
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`❌ Empresa ${ticker} não encontrada na Ward API`);
    } else if (error.response?.status === 401) {
      console.log(`🔐 Token JWT expirado ou inválido para ${ticker}`);
    } else {
      console.error(`❌ Erro ao buscar dados da Ward para ${ticker}:`, error.message);
    }
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

// Função para mesclar dados da Ward com dados da Brapi (complementar)
function mergeWardWithBrapiData(wardData: any, brapiData: any, year: number): FinancialDataComplete {
  // Priorizar dados da Ward, usar Brapi apenas para complementar campos faltantes
  // Seguir exatamente o schema do Prisma para garantir compatibilidade
  return {
    year: year,
    
    // === INDICADORES DE VALUATION ===
    pl: wardData.pl || brapiData.pl || null,
    forwardPE: brapiData.forwardPE || null, // Só na Brapi
    earningsYield: wardData.earningsYield || brapiData.earningsYield || null,
    pvp: wardData.pvp || brapiData.pvp || null,
    dy: wardData.dy || brapiData.dy || null,
    evEbitda: wardData.evEbitda || brapiData.evEbitda || null,
    evEbit: wardData.evEbit || brapiData.evEbit || null,
    evRevenue: brapiData.evRevenue || null, // Só na Brapi
    psr: brapiData.psr || null, // Só na Brapi
    pAtivos: brapiData.pAtivos || null, // Só na Brapi
    pCapGiro: brapiData.pCapGiro || null, // Só na Brapi
    pEbit: wardData.pEbit || brapiData.pEbit || null,
    lpa: wardData.lpa || brapiData.lpa || null,
    trailingEps: brapiData.trailingEps || null, // Só na Brapi
    vpa: wardData.vpa || brapiData.vpa || null,
    
    // === DADOS DE MERCADO E AÇÕES ===
    marketCap: brapiData.marketCap || wardData.marketCap || null, // Priorizar Ward
    enterpriseValue: brapiData.enterpriseValue || null, // Só na Brapi
    sharesOutstanding: wardData.sharesOutstanding || brapiData.sharesOutstanding || null, // Priorizar Ward
    totalAssets: brapiData.totalAssets || null, // Só na Brapi
    
    // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
    dividaLiquidaPl: brapiData.dividaLiquidaPl || null, // Só na Brapi
    dividaLiquidaEbitda: wardData.dividaLiquidaEbitda || brapiData.dividaLiquidaEbitda || null,
    liquidezCorrente: wardData.liquidezCorrente || brapiData.liquidezCorrente || null,
    liquidezRapida: brapiData.liquidezRapida || null, // Só na Brapi
    passivoAtivos: brapiData.passivoAtivos || null, // Só na Brapi
    debtToEquity: brapiData.debtToEquity || null, // Só na Brapi
    
    // === INDICADORES DE RENTABILIDADE ===
    roe: wardData.roe || brapiData.roe || null,
    roic: wardData.roic || brapiData.roic || null,
    roa: wardData.roa || brapiData.roa || null,
    margemBruta: brapiData.margemBruta || null, // Só na Brapi
    margemEbitda: wardData.margemEbitda || brapiData.margemEbitda || null,
    margemLiquida: wardData.margemLiquida || brapiData.margemLiquida || null,
    giroAtivos: brapiData.giroAtivos || null, // Só na Brapi
    
    // === INDICADORES DE CRESCIMENTO ===
    cagrLucros5a: wardData.cagrLucros5a || brapiData.cagrLucros5a || null,
    crescimentoLucros: brapiData.crescimentoLucros || null, // Só na Brapi
    crescimentoReceitas: wardData.crescimentoReceitas || brapiData.crescimentoReceitas || null,
    
    // === DADOS DE DIVIDENDOS ===
    dividendYield12m: wardData.dividendYield12m || brapiData.dividendYield12m || null,
    ultimoDividendo: brapiData.ultimoDividendo || null, // Só na Brapi
    dataUltimoDividendo: brapiData.dataUltimoDividendo || null, // Só na Brapi
    payout: wardData.payout || null, // Só na Ward
    
    // === PERFORMANCE E VARIAÇÕES ===
    variacao52Semanas: brapiData.variacao52Semanas || null, // Só na Brapi
    retornoAnoAtual: brapiData.retornoAnoAtual || null, // Só na Brapi
    
    // === DADOS FINANCEIROS OPERACIONAIS ===
    ebitda: wardData.ebitda || brapiData.ebitda || null,
    receitaTotal: wardData.receitaTotal || brapiData.receitaTotal || null,
    lucroLiquido: wardData.lucroLiquido || brapiData.lucroLiquido || null,
    fluxoCaixaOperacional: brapiData.fluxoCaixaOperacional || null, // Só na Brapi
    fluxoCaixaInvestimento: brapiData.fluxoCaixaInvestimento || null, // Só na Brapi
    fluxoCaixaFinanciamento: brapiData.fluxoCaixaFinanciamento || null, // Só na Brapi
    fluxoCaixaLivre: brapiData.fluxoCaixaLivre || null, // Só na Brapi
    totalCaixa: wardData.totalCaixa || brapiData.totalCaixa || null,
    totalDivida: wardData.totalDivida || brapiData.totalDivida || null,
    receitaPorAcao: brapiData.receitaPorAcao || null, // Só na Brapi
    caixaPorAcao: brapiData.caixaPorAcao || null, // Só na Brapi
    
    // === DADOS DO BALANÇO PATRIMONIAL ===
    ativoCirculante: brapiData.ativoCirculante || null, // Só na Brapi
    ativoTotal: brapiData.ativoTotal || null, // Só na Brapi
    passivoCirculante: brapiData.passivoCirculante || null, // Só na Brapi
    passivoTotal: brapiData.passivoTotal || null, // Só na Brapi
    patrimonioLiquido: brapiData.patrimonioLiquido || null, // Só na Brapi
    caixa: brapiData.caixa || null, // Só na Brapi
    estoques: brapiData.estoques || null, // Só na Brapi
    contasReceber: brapiData.contasReceber || null, // Só na Brapi
    imobilizado: brapiData.imobilizado || null, // Só na Brapi
    intangivel: brapiData.intangivel || null, // Só na Brapi
    dividaCirculante: brapiData.dividaCirculante || null, // Só na Brapi
    dividaLongoPrazo: brapiData.dividaLongoPrazo || null, // Só na Brapi
    
    // === DADOS DE DIVIDENDOS DETALHADOS ===
    dividendoMaisRecente: brapiData.dividendoMaisRecente || null, // Só na Brapi
    dataDividendoMaisRecente: brapiData.dataDividendoMaisRecente || null, // Só na Brapi
    historicoUltimosDividendos: brapiData.historicoUltimosDividendos || null, // Só na Brapi
    
    // === METADADOS ===
    dataSource: 'ward+brapi' // Indicar que é híbrido
  };
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

// Função para processar dados do balanço patrimonial
async function processBalanceSheets(companyId: number, ticker: string, data: BrapiProResponse['results'][0]): Promise<void> {
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

  // Processar balanços anuais
  if (data.balanceSheetHistory) {
    for (const balanceSheet of data.balanceSheetHistory) {
      await processBalanceSheet(balanceSheet, 'YEARLY');
    }
    console.log(`  📊 ${data.balanceSheetHistory.length} balanços anuais processados`);
  }

  // Processar balanços trimestrais
  if (data.balanceSheetHistoryQuarterly) {
    for (const balanceSheet of data.balanceSheetHistoryQuarterly) {
      await processBalanceSheet(balanceSheet, 'QUARTERLY');
    }
    console.log(`  📊 ${data.balanceSheetHistoryQuarterly.length} balanços trimestrais processados`);
  }
}

// Função para processar dados da DRE
async function processIncomeStatements(companyId: number, ticker: string, data: BrapiProResponse['results'][0]): Promise<void> {
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
        }
      });
    } catch (error: any) {
      console.error(`❌ Erro ao processar DRE ${period} de ${incomeStatement.endDate} para ${ticker}:`, error.message);
    }
  };

  // Processar DREs anuais
  if (data.incomeStatementHistory) {
    for (const incomeStatement of data.incomeStatementHistory) {
      await processIncomeStatement(incomeStatement, 'YEARLY');
    }
    console.log(`  📈 ${data.incomeStatementHistory.length} DREs anuais processadas`);
  }

  // Processar DREs trimestrais
  if (data.incomeStatementHistoryQuarterly) {
    for (const incomeStatement of data.incomeStatementHistoryQuarterly) {
      await processIncomeStatement(incomeStatement, 'QUARTERLY');
    }
    console.log(`  📈 ${data.incomeStatementHistoryQuarterly.length} DREs trimestrais processadas`);
  }
}

// Função para processar dados do fluxo de caixa
async function processCashflowStatements(companyId: number, ticker: string, data: BrapiProResponse['results'][0]): Promise<void> {
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
        }
      });
    } catch (error: any) {
      console.error(`❌ Erro ao processar DFC ${period} de ${cashflowStatement.endDate} para ${ticker}:`, error.message);
    }
  };

  // Processar DFCs anuais
  if (data.cashflowHistory) {
    for (const cashflowStatement of data.cashflowHistory) {
      await processCashflowStatement(cashflowStatement, 'YEARLY');
    }
    console.log(`  💰 ${data.cashflowHistory.length} DFCs anuais processadas`);
  }

  // Processar DFCs trimestrais
  if (data.cashflowHistoryQuarterly) {
    for (const cashflowStatement of data.cashflowHistoryQuarterly) {
      await processCashflowStatement(cashflowStatement, 'QUARTERLY');
    }
    console.log(`  💰 ${data.cashflowHistoryQuarterly.length} DFCs trimestrais processadas`);
  }
}

// Função para processar estatísticas-chave
async function processKeyStatistics(companyId: number, ticker: string, data: BrapiProResponse['results'][0]): Promise<void> {
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

  // Processar estatísticas anuais
  if (data.defaultKeyStatisticsHistory) {
    for (const keyStatistic of data.defaultKeyStatisticsHistory) {
      await processKeyStatistic(keyStatistic, 'YEARLY');
    }
    console.log(`  📋 ${data.defaultKeyStatisticsHistory.length} estatísticas anuais processadas`);
  }

  // Processar estatísticas trimestrais
  if (data.defaultKeyStatisticsHistoryQuarterly) {
    for (const keyStatistic of data.defaultKeyStatisticsHistoryQuarterly) {
      await processKeyStatistic(keyStatistic, 'QUARTERLY');
    }
    console.log(`  📋 ${data.defaultKeyStatisticsHistoryQuarterly.length} estatísticas trimestrais processadas`);
  }
}

// Função para processar DVA
async function processValueAddedStatements(companyId: number, ticker: string, data: BrapiProResponse['results'][0]): Promise<void> {
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

  // Processar DVAs anuais
  if (data.valueAddedHistory) {
    for (const valueAddedStatement of data.valueAddedHistory) {
      await processValueAddedStatement(valueAddedStatement, 'YEARLY');
    }
    console.log(`  💡 ${data.valueAddedHistory.length} DVAs anuais processadas`);
  }

  // Processar DVAs trimestrais
  if (data.valueAddedHistoryQuarterly) {
    for (const valueAddedStatement of data.valueAddedHistoryQuarterly) {
      await processValueAddedStatement(valueAddedStatement, 'QUARTERLY');
    }
    console.log(`  💡 ${data.valueAddedHistoryQuarterly.length} DVAs trimestrais processadas`);
  }
}

// Função para processar uma empresa
async function processCompany(ticker: string, enableBrapiComplement: boolean = true): Promise<void> {
  try {
    console.log(`\n🏢 Processando ${ticker}...`);
    
    // Primeiro, garantir que a empresa existe (criar se necessário)
    const company = await createOrUpdateCompany(ticker);

    if (!company) {
      console.log(`❌ Não foi possível criar/encontrar empresa ${ticker}. Pulando...`);
      return;
    }

    // Buscar dados completos da Brapi PRO
    const brapiProData = await fetchBrapiProData(ticker);
    if (brapiProData) {
      console.log(`🔄 Processando dados históricos completos da Brapi PRO para ${ticker}...`);
      
      // Processar todos os tipos de dados históricos em paralelo
      await Promise.all([
        processBalanceSheets(company.id, ticker, brapiProData),
        processIncomeStatements(company.id, ticker, brapiProData),
        processCashflowStatements(company.id, ticker, brapiProData),
        processKeyStatistics(company.id, ticker, brapiProData),
        processValueAddedStatements(company.id, ticker, brapiProData)
      ]);
      
      console.log(`✅ Dados históricos da Brapi PRO processados para ${ticker}`);
    }

    // Buscar dados da Ward (mantém compatibilidade com dados existentes)
    const wardData = await fetchWardData(ticker);
    if (!wardData || !wardData.historicalStocks) {
      console.log(`⚠️  Nenhum dado histórico encontrado na Ward para ${ticker}`);
      if (!brapiProData) {
        console.log(`❌ Nenhuma fonte de dados disponível para ${ticker}`);
        return;
      }
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

            // ROIC aproximado
            if (financial?.totalRevenue && financial?.operatingMargins && balance.totalAssets && balance.totalCurrentLiabilities) {
              const ebit = financial.totalRevenue * financial.operatingMargins;
              const investedCapital = balance.totalAssets - balance.totalCurrentLiabilities;
              if (investedCapital > 0) {
                roic = ebit / investedCapital;
              }
            }

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
            roic: roic,
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

    // Se não temos dados da Ward, mas temos da Brapi PRO, já processamos tudo acima
    if (!wardData || !wardData.historicalStocks) {
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
        
        // Se for o ano atual E temos dados da Brapi, mesclar
        let finalFinancialData;
        if (wardFinancialData.year === currentYear && brapiData) {
          finalFinancialData = mergeWardWithBrapiData(wardFinancialData, brapiData, wardFinancialData.year);
          complementedYears++;
          console.log(`  🔄 ${wardFinancialData.year}: Dados mesclados Ward + Brapi`);
        } else {
          finalFinancialData = wardFinancialData as FinancialDataComplete;
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

    // Processar anos em lotes paralelos (máximo 5 por vez para não sobrecarregar o banco)
    const BATCH_SIZE = 5;
    const batches = [];
    
    for (let i = 0; i < wardData.historicalStocks.length; i += BATCH_SIZE) {
      batches.push(wardData.historicalStocks.slice(i, i + BATCH_SIZE));
    }

    console.log(`📦 Processando ${wardData.historicalStocks.length} anos em ${batches.length} lotes de até ${BATCH_SIZE} anos cada`);

    for (const batch of batches) {
      const results = await Promise.all(batch.map(processYear));
      
      // Contar sucessos e falhas
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (failed > 0) {
        console.log(`⚠️  Lote processado: ${successful} sucessos, ${failed} falhas`);
      }
    }

    const summary = [`${processedYears} anos processados`];
    if (complementedYears > 0) {
      summary.push(`${complementedYears} complementados com Brapi`);
    }
    
    console.log(`✅ ${ticker}: ${summary.join(', ')}`);
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar empresa ${ticker}:`, error.message);
  }
}

// Função principal
async function main() {
  try {
    console.log('🚀 Iniciando fetch de dados da Ward API...\n');
    
    // Verificar argumentos: tickers e opção --no-brapi
    const args = process.argv.slice(2);
    const noBrapiIndex = args.indexOf('--no-brapi');
    const enableBrapiComplement = noBrapiIndex === -1;
    
    // Remover --no-brapi dos tickers se presente
    const tickers = noBrapiIndex !== -1 ? args.filter((_, index) => index !== noBrapiIndex) : args;
    
    console.log(`🔧 Complemento Brapi: ${enableBrapiComplement ? '✅ Ativado' : '❌ Desativado'}`);
    if (enableBrapiComplement) {
      console.log('   📊 Dados do ano atual serão complementados com indicadores da Brapi API');
    }
    
    if (tickers.length === 0) {
      console.log('📋 Nenhum ticker especificado. Buscando todos os tickers da Ward API...');
      
      // Buscar todos os tickers disponíveis na Ward API
      const wardTickers = await fetchWardTickers();
      
      if (wardTickers.length === 0) {
        console.log('❌ Nenhum ticker encontrado na Ward API. Tentando buscar do banco...');
        
        // Fallback: buscar empresas do banco
        const companies = await prisma.company.findMany({
          select: { ticker: true },
          orderBy: { ticker: 'asc' }
        });
        
        console.log(`📊 Encontradas ${companies.length} empresas no banco como fallback`);
        
        // Processar empresas em lotes paralelos
        const COMPANY_BATCH_SIZE = 3;
        const companyBatches = [];
        
        for (let i = 0; i < companies.length; i += COMPANY_BATCH_SIZE) {
          companyBatches.push(companies.slice(i, i + COMPANY_BATCH_SIZE));
        }
        
        console.log(`📦 Processando ${companies.length} empresas em ${companyBatches.length} lotes de até ${COMPANY_BATCH_SIZE} empresas cada`);
        
        for (const batch of companyBatches) {
          await Promise.all(batch.map(company => processCompany(company.ticker, enableBrapiComplement)));
          
          // Delay entre lotes para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.log(`📊 Processando ${wardTickers.length} tickers da Ward API`);
        
        // Processar tickers da Ward em lotes paralelos
        const WARD_BATCH_SIZE = 3;
        const wardBatches = [];
        
        for (let i = 0; i < wardTickers.length; i += WARD_BATCH_SIZE) {
          wardBatches.push(wardTickers.slice(i, i + WARD_BATCH_SIZE));
        }
        
        console.log(`📦 Processando ${wardTickers.length} tickers em ${wardBatches.length} lotes de até ${WARD_BATCH_SIZE} empresas cada`);
        
        let processed = 0;
        let errors = 0;
        
        for (let batchIndex = 0; batchIndex < wardBatches.length; batchIndex++) {
          const batch = wardBatches[batchIndex];
          try {
            const results = await Promise.allSettled(
              batch.map(wardTicker => processCompany(wardTicker.ticker, enableBrapiComplement))
            );
            
            // Contar sucessos e falhas
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            processed += successful;
            errors += failed;
            
            // Log de progresso
            console.log(`📈 Lote ${batchIndex + 1}/${wardBatches.length}: ${successful} sucessos, ${failed} falhas`);
            
            // Delay entre lotes para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (error: any) {
            console.error(`❌ Erro no lote ${batchIndex + 1}:`, error.message);
            errors += batch.length;
          }
        }
        
        console.log(`\n📊 Resumo final:`);
        console.log(`  ✅ Processadas: ${processed}/${wardTickers.length}`);
        console.log(`  ❌ Erros: ${errors}`);
      }
    } else {
      console.log(`📋 Processando tickers especificados: ${tickers.join(', ')}`);
      
      // Para poucos tickers, processar em paralelo sem lotes
      if (tickers.length <= 5) {
        await Promise.all(tickers.map(ticker => processCompany(ticker.toUpperCase(), enableBrapiComplement)));
      } else {
        // Para muitos tickers, usar lotes
        const SPECIFIED_BATCH_SIZE = 3;
        const specifiedBatches = [];
        
        for (let i = 0; i < tickers.length; i += SPECIFIED_BATCH_SIZE) {
          specifiedBatches.push(tickers.slice(i, i + SPECIFIED_BATCH_SIZE));
        }
        
        console.log(`📦 Processando ${tickers.length} tickers em ${specifiedBatches.length} lotes de até ${SPECIFIED_BATCH_SIZE} empresas cada`);
        
        for (const batch of specifiedBatches) {
          await Promise.all(batch.map(ticker => processCompany(ticker.toUpperCase(), enableBrapiComplement)));
          
          // Delay entre lotes
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('\n✅ Fetch de dados da Ward concluído!');
    
  } catch (error: any) {
    console.error('❌ Erro geral:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { 
  main, 
  processCompany, 
  fetchWardData, 
  fetchWardTickers, 
  createOrUpdateCompany, 
  fetchBrapiBasicData,
  fetchBrapiProData,
  processBalanceSheets,
  processIncomeStatements,
  processCashflowStatements,
  processKeyStatistics,
  processValueAddedStatements
};
