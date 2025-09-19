import axios from 'axios';
import * as dotenv from 'dotenv';
import { backgroundPrisma, backgroundPrismaManager } from './prisma-background';
import { ConcurrencyManager, executeWithRetry, executeWithTimeout } from './concurrency-manager';

// Carregar variáveis de ambiente
dotenv.config();

// Usar o cliente Prisma otimizado para background
const prisma = backgroundPrisma;

// Token da Brapi
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;

// Interface para dados financeiros da Brapi
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
  updatedAt?: string;
}

interface BrapiIncomeStatement {
  type?: string;
  endDate?: string;
  totalRevenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  ebit?: number;
  netIncome?: number;
  basicEarningsPerShare?: number;
  dilutedEarningsPerShare?: number;
  updatedAt?: string;
}

interface BrapiCashflowStatement {
  symbol?: string;
  type?: string;
  endDate?: string;
  operatingCashFlow?: number;
  investmentCashFlow?: number;
  financingCashFlow?: number;
  increaseOrDecreaseInCash?: number;
  initialCashBalance?: number;
  finalCashBalance?: number;
  updatedAt?: string;
}

interface BrapiProResponse {
  results: Array<{
    symbol: string;
    shortName: string;
    longName: string;
    currency: string;
    regularMarketPrice: number;
    marketCap?: number;
    priceEarnings?: number;
    earningsPerShare?: number;
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
    dividendsData?: {
      cashDividends?: Array<{
        rate?: number;
        paymentDate?: string;
        label?: string;
        relatedTo?: string;
      }>;
    };
  }>;
}

// Função para buscar dados completos da Brapi PRO
async function fetchBrapiProData(ticker: string): Promise<BrapiProResponse['results'][0] | null> {
  return executeWithRetry(async () => {
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
          modules: 'balanceSheetHistory,balanceSheetHistoryQuarterly,defaultKeyStatistics,defaultKeyStatisticsHistory,defaultKeyStatisticsHistoryQuarterly,incomeStatementHistory,incomeStatementHistoryQuarterly,financialData,financialDataHistory,financialDataHistoryQuarterly,cashflowHistory,cashflowHistoryQuarterly,summaryProfile',
          fundamental: 'true',
          dividends: 'true'
        },
        timeout: 30000
      }
    );

    if (response.status === 200 && response.data.results && response.data.results.length > 0) {
      const data = response.data.results[0];
      console.log(`✅ Dados completos da Brapi PRO obtidos para ${ticker}`);
      return data;
    } else {
      console.log(`⚠️  Nenhum dado encontrado na Brapi PRO para ${ticker}`);
      return null;
    }
  }, 2, 2000); // 2 tentativas, 2s de delay inicial
}

// Função para extrair ano de uma data
function extractYearFromDate(dateString: string): number {
  return new Date(dateString).getFullYear();
}

// Função para calcular indicadores derivados
function calculateDerivedIndicators(
  brapiData: BrapiProResponse['results'][0],
  balance?: BrapiBalanceSheet,
  income?: BrapiIncomeStatement,
  cashflow?: BrapiCashflowStatement,
  keyStats?: BrapiKeyStatistics,
  financialData?: BrapiFinancialData
) {
  const indicators: any = {};

  // === CÁLCULOS COM DADOS DO BALANÇO ===
  if (balance) {
    // P/Ativos = Market Cap / Total Assets
    if (brapiData.marketCap && balance.totalAssets) {
      indicators.pAtivos = brapiData.marketCap / balance.totalAssets;
    }

    // Passivo/Ativos
    if (balance.totalCurrentLiabilities && balance.totalLiab && balance.totalAssets) {
      const totalRealLiab = balance.totalLiab - (balance.totalStockholderEquity || 0);
      if (totalRealLiab > 0 && balance.totalAssets > 0) {
        indicators.passivoAtivos = totalRealLiab / balance.totalAssets;
      }
    }

    // Giro Ativos = Receita Total / Total Assets
    if (income?.totalRevenue && balance.totalAssets) {
      indicators.giroAtivos = income.totalRevenue / balance.totalAssets;
    }

    // Dívida Líquida/PL
    const totalDebt = (balance.totalLiab || 0) - (balance.totalStockholderEquity || 0);
    const cash = balance.cash || financialData?.totalCash || 0;
    if (totalDebt > 0 && balance.totalStockholderEquity) {
      indicators.dividaLiquidaPl = (totalDebt - cash) / balance.totalStockholderEquity;
    }

    // P/Capital de Giro
    if (brapiData.marketCap && balance.totalCurrentAssets && balance.totalCurrentLiabilities) {
      const workingCapital = balance.totalCurrentAssets - balance.totalCurrentLiabilities;
      if (workingCapital > 0) {
        indicators.pCapGiro = brapiData.marketCap / workingCapital;
      }
    }

    // ROIC aproximado
    if (income?.totalRevenue && financialData?.operatingMargins && balance.totalAssets && balance.totalCurrentLiabilities) {
      const ebit = income.totalRevenue * financialData.operatingMargins;
      const investedCapital = balance.totalAssets - balance.totalCurrentLiabilities;
      if (investedCapital > 0) {
        indicators.roic = ebit / investedCapital;
      }
    }

    // P/EBIT
    if (brapiData.marketCap && income?.ebit && income.ebit > 0) {
      indicators.pEbit = brapiData.marketCap / income.ebit;
    }
  }

  // PSR: Market Cap / Total Revenue
  if (brapiData.marketCap && income?.totalRevenue) {
    indicators.psr = brapiData.marketCap / income.totalRevenue;
  }

  // EV/Revenue
  if (keyStats?.enterpriseValue && income?.totalRevenue) {
    indicators.evRevenue = keyStats.enterpriseValue / income.totalRevenue;
  }

  // Earnings Yield
  if (brapiData.priceEarnings && brapiData.priceEarnings > 0) {
    indicators.earningsYield = 1 / brapiData.priceEarnings;
  } else if (brapiData.earningsPerShare && brapiData.regularMarketPrice && brapiData.regularMarketPrice > 0) {
    indicators.earningsYield = brapiData.earningsPerShare / brapiData.regularMarketPrice;
  }

  return indicators;
}

// Função para processar dados de um ano específico
async function processYearData(
  companyId: number,
  ticker: string,
  year: number,
  brapiData: BrapiProResponse['results'][0]
): Promise<void> {
  try {
    console.log(`  📊 Processando dados de ${year} para ${ticker}...`);

    // Buscar dados históricos do ano específico
    const yearBalance = brapiData.balanceSheetHistory?.find(b => 
      b.endDate && extractYearFromDate(b.endDate) === year
    );
    const yearIncome = brapiData.incomeStatementHistory?.find(i => 
      i.endDate && extractYearFromDate(i.endDate) === year
    );
    const yearCashflow = brapiData.cashflowHistory?.find(c => 
      c.endDate && extractYearFromDate(c.endDate) === year
    );
    const yearKeyStats = brapiData.defaultKeyStatisticsHistory?.find(k => 
      k.updatedAt && extractYearFromDate(k.updatedAt) === year
    );
    const yearFinancialData = brapiData.financialDataHistory?.find(f => 
      f.updatedAt && extractYearFromDate(f.updatedAt) === year
    );

    // Se for o ano atual, usar dados TTM também
    const currentYear = new Date().getFullYear();
    const isCurrentYear = year === currentYear;
    
    const balance = yearBalance || (isCurrentYear ? brapiData.balanceSheetHistory?.[0] : null);
    const income = yearIncome || (isCurrentYear ? brapiData.incomeStatementHistory?.[0] : null);
    const cashflow = yearCashflow || (isCurrentYear ? brapiData.cashflowHistory?.[0] : null);
    const keyStats = yearKeyStats || (isCurrentYear ? brapiData.defaultKeyStatistics : null);
    const financialData = yearFinancialData || (isCurrentYear ? brapiData.financialData : null);

    // Calcular indicadores derivados
    const derivedIndicators = calculateDerivedIndicators(
      brapiData, 
      balance || undefined, 
      income || undefined, 
      cashflow || undefined, 
      keyStats || undefined, 
      financialData || undefined
    );

    // Preparar dados de dividendos
    let dividendoMaisRecente = null;
    let dataDividendoMaisRecente = null;
    let historicoUltimosDividendos = null;

    if (isCurrentYear && brapiData.dividendsData?.cashDividends) {
      const dividends = brapiData.dividendsData.cashDividends;
      if (dividends.length > 0) {
        dividendoMaisRecente = dividends[0]?.rate;
        dataDividendoMaisRecente = dividends[0]?.paymentDate ? new Date(dividends[0].paymentDate) : null;
        
        const ultimosDividendos = dividends.slice(0, 5).map(div => ({
          valor: div.rate,
          data: div.paymentDate,
          tipo: div.label,
          periodo: div.relatedTo
        }));
        historicoUltimosDividendos = JSON.stringify(ultimosDividendos);
      }
    }

    // Verificar se já existe registro para este ano
    const existingData = await prisma.financialData.findUnique({
      where: {
        companyId_year: {
          companyId,
          year
        }
      }
    });

    // Preparar dados para upsert (apenas campos não-null da Brapi)
    const updateData: any = {};

    // === INDICADORES DE VALUATION ===
    if (brapiData.priceEarnings !== undefined) updateData.pl = brapiData.priceEarnings;
    if (keyStats?.forwardPE !== undefined) updateData.forwardPE = keyStats.forwardPE;
    if (derivedIndicators.earningsYield !== undefined) updateData.earningsYield = derivedIndicators.earningsYield;
    if (keyStats?.priceToBook !== undefined) updateData.pvp = keyStats.priceToBook;
    if (keyStats?.dividendYield !== undefined) updateData.dy = keyStats.dividendYield / 100;
    if (keyStats?.enterpriseToEbitda !== undefined) updateData.evEbitda = keyStats.enterpriseToEbitda;
    if (income?.ebit && brapiData.marketCap) updateData.evEbit = brapiData.marketCap / income.ebit;
    if (derivedIndicators.evRevenue !== undefined) updateData.evRevenue = derivedIndicators.evRevenue;
    if (derivedIndicators.psr !== undefined) updateData.psr = derivedIndicators.psr;
    if (derivedIndicators.pAtivos !== undefined) updateData.pAtivos = derivedIndicators.pAtivos;
    if (derivedIndicators.pCapGiro !== undefined) updateData.pCapGiro = derivedIndicators.pCapGiro;
    if (derivedIndicators.pEbit !== undefined) updateData.pEbit = derivedIndicators.pEbit;
    if (brapiData.earningsPerShare !== undefined) updateData.lpa = brapiData.earningsPerShare;
    if (keyStats?.trailingEps !== undefined) updateData.trailingEps = keyStats.trailingEps;
    if (keyStats?.bookValue !== undefined) updateData.vpa = keyStats.bookValue;

    // === DADOS DE MERCADO E AÇÕES ===
    if (brapiData.marketCap !== undefined) updateData.marketCap = brapiData.marketCap;
    if (keyStats?.enterpriseValue !== undefined) updateData.enterpriseValue = keyStats.enterpriseValue;
    if (keyStats?.sharesOutstanding !== undefined) updateData.sharesOutstanding = keyStats.sharesOutstanding;
    if (keyStats?.totalAssets !== undefined) updateData.totalAssets = keyStats.totalAssets;

    // === INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ ===
    if (derivedIndicators.dividaLiquidaPl !== undefined) updateData.dividaLiquidaPl = derivedIndicators.dividaLiquidaPl;
    if (financialData?.currentRatio !== undefined) updateData.liquidezCorrente = financialData.currentRatio;
    if (financialData?.quickRatio !== undefined) updateData.liquidezRapida = financialData.quickRatio;
    if (derivedIndicators.passivoAtivos !== undefined) updateData.passivoAtivos = derivedIndicators.passivoAtivos;
    if (financialData?.debtToEquity !== undefined) updateData.debtToEquity = financialData.debtToEquity;

    // === INDICADORES DE RENTABILIDADE ===
    if (financialData?.returnOnEquity !== undefined) updateData.roe = financialData.returnOnEquity;
    if (derivedIndicators.roic !== undefined) updateData.roic = derivedIndicators.roic;
    if (financialData?.returnOnAssets !== undefined) updateData.roa = financialData.returnOnAssets;
    if (financialData?.grossMargins !== undefined) updateData.margemBruta = financialData.grossMargins;
    if (financialData?.ebitdaMargins !== undefined) updateData.margemEbitda = financialData.ebitdaMargins;
    if (financialData?.profitMargins !== undefined) updateData.margemLiquida = financialData.profitMargins;
    if (derivedIndicators.giroAtivos !== undefined) updateData.giroAtivos = derivedIndicators.giroAtivos;

    // === INDICADORES DE CRESCIMENTO ===
    if (keyStats?.earningsAnnualGrowth !== undefined) updateData.cagrLucros5a = keyStats.earningsAnnualGrowth;
    if (financialData?.earningsGrowth !== undefined) updateData.crescimentoLucros = financialData.earningsGrowth;
    if (financialData?.revenueGrowth !== undefined) updateData.crescimentoReceitas = financialData.revenueGrowth;

    // === DADOS DE DIVIDENDOS ===
    if (keyStats?.dividendYield !== undefined) updateData.dividendYield12m = keyStats.dividendYield / 100;
    if (keyStats?.lastDividendValue !== undefined) updateData.ultimoDividendo = keyStats.lastDividendValue;
    if (keyStats?.lastDividendDate !== undefined) updateData.dataUltimoDividendo = new Date(keyStats.lastDividendDate);

    // === PERFORMANCE E VARIAÇÕES ===
    if (keyStats?.["52WeekChange"] !== undefined) updateData.variacao52Semanas = keyStats["52WeekChange"];
    if (keyStats?.ytdReturn !== undefined) updateData.retornoAnoAtual = keyStats.ytdReturn;

    // === DADOS FINANCEIROS OPERACIONAIS ===
    if (financialData?.ebitda !== undefined) updateData.ebitda = financialData.ebitda;
    if (financialData?.totalRevenue !== undefined) updateData.receitaTotal = financialData.totalRevenue;
    if (income?.netIncome !== undefined) updateData.lucroLiquido = income.netIncome;
    if (financialData?.operatingCashflow !== undefined) updateData.fluxoCaixaOperacional = financialData.operatingCashflow;
    if (cashflow?.investmentCashFlow !== undefined) updateData.fluxoCaixaInvestimento = cashflow.investmentCashFlow;
    if (cashflow?.financingCashFlow !== undefined) updateData.fluxoCaixaFinanciamento = cashflow.financingCashFlow;
    if (financialData?.freeCashflow !== undefined) updateData.fluxoCaixaLivre = financialData.freeCashflow;
    if (financialData?.totalCash !== undefined) updateData.totalCaixa = financialData.totalCash;
    if (financialData?.totalDebt !== undefined) updateData.totalDivida = financialData.totalDebt;
    if (financialData?.revenuePerShare !== undefined) updateData.receitaPorAcao = financialData.revenuePerShare;
    if (financialData?.totalCashPerShare !== undefined) updateData.caixaPorAcao = financialData.totalCashPerShare;

    // === DADOS DO BALANÇO PATRIMONIAL ===
    if (balance?.totalCurrentAssets !== undefined) updateData.ativoCirculante = balance.totalCurrentAssets;
    if (balance?.totalAssets !== undefined) updateData.ativoTotal = balance.totalAssets;
    if (balance?.totalCurrentLiabilities !== undefined) updateData.passivoCirculante = balance.totalCurrentLiabilities;
    if (balance?.totalLiab !== undefined) updateData.passivoTotal = balance.totalLiab;
    if (balance?.totalStockholderEquity !== undefined) updateData.patrimonioLiquido = balance.totalStockholderEquity;
    if (balance?.cash !== undefined) updateData.caixa = balance.cash;

    // === DADOS DE DIVIDENDOS DETALHADOS (apenas ano atual) ===
    if (isCurrentYear) {
      if (dividendoMaisRecente !== null) updateData.dividendoMaisRecente = dividendoMaisRecente;
      if (dataDividendoMaisRecente !== null) updateData.dataDividendoMaisRecente = dataDividendoMaisRecente;
      if (historicoUltimosDividendos !== null) updateData.historicoUltimosDividendos = historicoUltimosDividendos;
    }

    // === METADADOS ===
    if (existingData?.dataSource === 'ward' || existingData?.dataSource === 'ward+brapi') {
      updateData.dataSource = 'ward+brapi';
    } else {
      updateData.dataSource = 'brapi';
    }

    // Se existe registro, fazer update apenas dos campos NULL ou forçar atualização de campos específicos
    if (existingData) {
      const fieldsToUpdate: any = {};
      
      // Para cada campo, só atualizar se for NULL no banco ou se for um campo que sempre deve ser atualizado
      const alwaysUpdateFields = ['dataSource', 'forwardPE', 'trailingEps', 'variacao52Semanas', 'retornoAnoAtual'];
      
      Object.keys(updateData).forEach(field => {
        const existingValue = (existingData as any)[field];
        if (existingValue === null || existingValue === undefined || alwaysUpdateFields.includes(field)) {
          fieldsToUpdate[field] = updateData[field];
        }
      });

      if (Object.keys(fieldsToUpdate).length > 0) {
        await prisma.financialData.update({
          where: {
            companyId_year: {
              companyId,
              year
            }
          },
          data: fieldsToUpdate
        });
        
        console.log(`    ✅ ${year}: ${Object.keys(fieldsToUpdate).length} campos atualizados`);
      } else {
        console.log(`    ⏭️  ${year}: Nenhum campo NULL para atualizar`);
      }
    } else {
      // Criar novo registro
      await prisma.financialData.create({
        data: {
          companyId,
          year,
          ...updateData
        }
      });
      
      console.log(`    ✅ ${year}: Novo registro criado com ${Object.keys(updateData).length} campos`);
    }

  } catch (error: any) {
    console.error(`    ❌ Erro ao processar ano ${year} para ${ticker}:`, error.message);
  }
}

// Função para processar uma empresa
async function processCompany(ticker: string, companyId: number): Promise<void> {
  try {
    console.log(`\n🏢 Processando ${ticker} (ID: ${companyId})...`);
    
    // Buscar dados da Brapi PRO
    const brapiData = await fetchBrapiProData(ticker);
    if (!brapiData) {
      console.log(`❌ Não foi possível obter dados da Brapi PRO para ${ticker}`);
      return;
    }

    // Identificar todos os anos disponíveis desde 2010
    const availableYears = new Set<number>();
    
    // Anos dos balanços
    brapiData.balanceSheetHistory?.forEach(b => {
      if (b.endDate) {
        const year = extractYearFromDate(b.endDate);
        if (year >= 2010) availableYears.add(year);
      }
    });
    
    // Anos das DREs
    brapiData.incomeStatementHistory?.forEach(i => {
      if (i.endDate) {
        const year = extractYearFromDate(i.endDate);
        if (year >= 2010) availableYears.add(year);
      }
    });
    
    // Anos das estatísticas
    brapiData.defaultKeyStatisticsHistory?.forEach(k => {
      if (k.updatedAt) {
        const year = extractYearFromDate(k.updatedAt);
        if (year >= 2010) availableYears.add(year);
      }
    });
    
    // Anos dos dados financeiros
    brapiData.financialDataHistory?.forEach(f => {
      if (f.updatedAt) {
        const year = extractYearFromDate(f.updatedAt);
        if (year >= 2010) availableYears.add(year);
      }
    });

    // Sempre incluir o ano atual para dados TTM
    const currentYear = new Date().getFullYear();
    availableYears.add(currentYear);

    const sortedYears = Array.from(availableYears).sort((a, b) => b - a); // Mais recente primeiro
    
    console.log(`  📅 Anos encontrados: ${sortedYears.join(', ')} (${sortedYears.length} anos)`);

    // Processar cada ano sequencialmente
    for (const year of sortedYears) {
      await processYearData(companyId, ticker, year, brapiData);
      
      // Pequeno delay entre anos
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ ${ticker}: ${sortedYears.length} anos processados`);
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar empresa ${ticker}:`, error.message);
  }
}

// Função principal
async function main() {
  const startTime = Date.now();
  console.log(`🚀 Iniciando atualização da tabela financial_data com dados da Brapi... [${new Date().toLocaleString('pt-BR')}]\n`);
  
  try {
    // Verificar se o token da Brapi está configurado
    if (!BRAPI_TOKEN) {
      console.error('❌ BRAPI_TOKEN não configurado no arquivo .env');
      process.exit(1);
    }

    // Verificar argumentos: tickers específicos ou todas as empresas
    const args = process.argv.slice(2);
    const specificTickers = args.filter(arg => !arg.startsWith('--')).map(t => t.toUpperCase());
    
    let companies;
    
    if (specificTickers.length > 0) {
      console.log(`📋 Processando tickers específicos: ${specificTickers.join(', ')}`);
      companies = await prisma.company.findMany({
        where: {
          ticker: {
            in: specificTickers
          }
        },
        select: {
          id: true,
          ticker: true,
          name: true
        },
        orderBy: {
          ticker: 'asc'
        }
      });
      
      if (companies.length === 0) {
        console.log('❌ Nenhuma empresa encontrada com os tickers especificados');
        return;
      }
      
      console.log(`📊 Encontradas ${companies.length} empresas para processar\n`);
    } else {
      console.log('📋 Buscando todas as empresas do banco...');
      companies = await prisma.company.findMany({
        select: {
          id: true,
          ticker: true,
          name: true
        },
        orderBy: {
          ticker: 'asc'
        }
      });
      
      console.log(`📊 Encontradas ${companies.length} empresas para processar\n`);
    }

    // Processar empresas em lotes de 3 paralelas
    const batchSize = 3;
    const concurrencyManager = new ConcurrencyManager(batchSize);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      const batchStartTime = Date.now();
      
      console.log(`📦 Lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(companies.length / batchSize)}: ${batch.map(c => c.ticker).join(', ')}`);
      
      // Processar lote em paralelo
      const batchPromises = batch.map((company, batchIndex) => 
        concurrencyManager.execute(async () => {
          const companyStartTime = Date.now();
          
          try {
            console.log(`🏢 [${i + batchIndex + 1}/${companies.length}] Processando ${company.ticker}...`);
            
            // Processar empresa com timeout
            await executeWithTimeout(
              () => processCompany(company.ticker, company.id),
              180000 // 3 minutos timeout por empresa
            );
            
            const companyTime = Date.now() - companyStartTime;
            console.log(`✅ ${company.ticker} processado em ${Math.round(companyTime / 1000)}s`);
            
            return { success: true, ticker: company.ticker, time: companyTime };
            
          } catch (error: any) {
            console.error(`❌ Erro ao processar ${company.ticker}:`, error.message);
            return { success: false, ticker: company.ticker, error: error.message };
          }
        })
      );
      
      // Aguardar lote completo
      try {
        const results = await Promise.all(batchPromises);
        const successful = results.filter((r: any) => r.success).length;
        const failed = results.filter((r: any) => !r.success).length;
        
        processedCount += successful;
        errorCount += failed;
        
        const batchTime = Date.now() - batchStartTime;
        console.log(`📦 Lote processado em ${Math.round(batchTime / 1000)}s: ${successful} sucessos, ${failed} falhas\n`);
        
      } catch (error: any) {
        console.error(`❌ Erro no lote:`, error.message);
        errorCount += batch.length;
      }
      
      // Pequeno delay entre lotes para não sobrecarregar a API
      if (i + batchSize < companies.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    console.log('\n✅ Execução concluída!');
    console.log(`📊 Resumo:`);
    console.log(`   ✅ Empresas processadas: ${processedCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log(`⏱️  Tempo total: ${minutes}m ${seconds}s`);
    console.log(`📅 Finalizado em: ${new Date().toLocaleString('pt-BR')}`);
    
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

export { main, processCompany, fetchBrapiProData };
