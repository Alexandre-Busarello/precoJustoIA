#!/usr/bin/env tsx

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Lista de tickers principais do BOVESPA
// Nota: PETR4, MGLU3, VALE3, ITUB4 são ações de teste gratuitas da Brapi (funcionam sem token)
const TICKERS = [
  // Ações de teste gratuitas (sempre funcionam)
  'PETR4', 'MGLU3', 'VALE3', 'ITUB4',
  
  // Bancos
  'BBDC4', 'BBAS3', 'SANB11', 'BPAC11',
  
  // Petróleo e Gas
  'PETR3', 'PRIO3', 'RRRP3',
  
  // Mineração
  'CSNA3', 'GGBR4', 'USIM5',
  
  // Varejo
  'LREN3', 'AMER3', 'VVAR3', 'PCAR3',
  
  // Telecomunicações
  'VIVT3', 'TIMS3',
  
  // Energia Elétrica
  'EGIE3', 'EQTL3', 'CMIG4', 'ENBR3', 'CPLE6',
  
  // Alimentação e Bebidas
  'ABEV3', 'JBSS3', 'BEEF3', 'MRFG3',
  
  // Papel e Celulose
  'SUZB3', 'KLBN11',
  
  // Siderurgia
  'GOAU4', 'GGBR4',
  
  // Tecnologia
  'WEGE3', 'TOTS3',
  
  // Construção
  'MRVE3', 'CYRE3', 'EZTC3',
  
  // Transporte
  'RAIL3', 'CCRO3',
  
  // Outros
  'RDOR3', 'HAPV3', 'RENT3', 'B3SA3', 'CSAN3'
];

interface BrapiQuoteResponse {
  results: Array<{
    symbol: string;
    shortName: string;
    longName: string;
    currency: string;
    regularMarketPrice: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketVolume: number;
    marketCap: number;
    regularMarketPreviousClose: number;
    regularMarketTime: string;
    logourl?: string;
    sector?: string;
    // Dados fundamentalistas básicos
    priceEarnings?: number;
    earningsPerShare?: number;
    // Módulos com dados aninhados
    summaryProfile?: {
      sector?: string;
      industry?: string;
      longBusinessSummary?: string;
      website?: string;
      address1?: string;
      city?: string;
      state?: string;
      country?: string;
      fullTimeEmployees?: number;
    };
    defaultKeyStatistics?: {
      priceToBook?: number;
      dividendYield?: number;
      bookValue?: number;
      enterpriseValue?: number;
      enterpriseToEbitda?: number;
      enterpriseToRevenue?: number;
      profitMargins?: number;
      forwardPE?: number;
      trailingEps?: number;
      sharesOutstanding?: number;
      totalAssets?: number;
      mostRecentQuarter?: string;
      earningsQuarterlyGrowth?: number;
      earningsAnnualGrowth?: number;
      grossMargin?: number;
      returnOnAssets?: number;
      returnOnEquity?: number;
      debtToEquity?: number;
      currentRatio?: number;
      quickRatio?: number;
      "52WeekChange"?: number;
      lastDividendValue?: number;
      lastDividendDate?: string;
      ytdReturn?: number;
    };
    financialData?: {
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
    };
    balanceSheetHistory?: Array<{
      symbol?: string;
      type?: string;
      endDate?: string;
      cash?: number;
      shortTermInvestments?: number;
      netReceivables?: number;
      inventory?: number;
      otherCurrentAssets?: number;
      totalCurrentAssets?: number;
      longTermInvestments?: number;
      propertyPlantEquipment?: number;
      otherAssets?: number;
      totalAssets?: number;
      accountsPayable?: number;
      shortLongTermDebt?: number;
      otherCurrentLiab?: number;
      longTermDebt?: number;
      otherLiab?: number;
      totalCurrentLiabilities?: number;
      totalLiab?: number;
      commonStock?: number;
      retainedEarnings?: number;
      treasuryStock?: number;
      otherStockholderEquity?: number;
      totalStockholderEquity?: number;
      netTangibleAssets?: number;
      goodWill?: number;
      intangibleAssets?: number;
      updatedAt?: string;
    }>;
    dividendsData?: {
      cashDividends?: Array<{
        rate?: number;
        paymentDate?: string;
        relatedTo?: string;
        label?: string;
      }>;
      stockDividends?: Array<{
        factor?: number;
        completeFactor?: string;
        approvedOn?: string;
        label?: string;
      }>;
    };
  }>;
}

export class DataFetcher {
  private readonly baseURL = 'https://brapi.dev/api';
  private readonly token?: string;
  private readonly batchSize: number;
  private readonly isPaidPlan: boolean;

  constructor(batchSize: number = 1) {
    this.token = process.env.BRAPI_TOKEN;
    this.batchSize = batchSize;
    this.isPaidPlan = batchSize > 1;
    
    console.log(`🔧 Configuração: ${this.isPaidPlan ? 'Plano Pago' : 'Plano Gratuito'} (${batchSize} ação${batchSize > 1 ? 'ões' : ''} por requisição)`);
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'User-Agent': 'analisador-acoes/1.0.0'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async fetchQuotes(tickers: string[]): Promise<BrapiQuoteResponse> {
    const tickersList = tickers.join(',');
    
    try {
      console.log(`🔍 Buscando cotações e fundamentos para: ${tickersList}`);
      
      // Parâmetros base para ambos os planos
      const params: any = {
        range: '1d',
        interval: '1d',
        fundamental: 'true',
        dividends: 'true'  // ✅ ESSENCIAL para dados de dividendos detalhados!
      };

      // Módulos com dados financeiros completos + balanço patrimonial + dividendos
      params.modules = 'summaryProfile,defaultKeyStatistics,financialData,balanceSheetHistory';

      const response = await axios.get<BrapiQuoteResponse>(
        `${this.baseURL}/quote/${tickersList}`,
        {
          headers: this.getHeaders(),
          params
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar cotações:', error);
      throw error;
    }
  }

  private extractFinancialData(quoteData: BrapiQuoteResponse['results'][0]) {
    // Função helper para extrair dados dos módulos
    const stats = quoteData.defaultKeyStatistics;
    const profile = quoteData.summaryProfile;
    const financial = quoteData.financialData;
    const balance = quoteData.balanceSheetHistory?.[0]; // Dados mais recentes do balanço
    const dividends = quoteData.dividendsData;

    // Calcular PSR: Priorizar financialData, fallback para cálculo
    let psr = null;
    if (financial?.totalRevenue && quoteData.marketCap) {
      psr = quoteData.marketCap / financial.totalRevenue;
    } else if (stats?.enterpriseValue && stats?.enterpriseToRevenue && stats.enterpriseToRevenue > 0) {
      const estimatedRevenue = stats.enterpriseValue / stats.enterpriseToRevenue;
      if (estimatedRevenue > 0 && quoteData.marketCap) {
        psr = quoteData.marketCap / estimatedRevenue;
      }
    }

    // === CÁLCULOS COM DADOS DO BALANÇO ===
    let pAtivos = null;
    let passivoAtivos = null;
    let giroAtivos = null;
    let dividaLiquidaPl = null;
    let dividaLiquidaEbitda = null;
    let pCapGiro = null;
    let roic = null;
    let pEbit = null;

    if (balance) {
      // P/Ativos = Market Cap / Total Assets
      if (quoteData.marketCap && balance.totalAssets) {
        pAtivos = quoteData.marketCap / balance.totalAssets;
      }

      // Passivo/Ativos = Total Passivo / Total Assets
      if (balance.totalLiab && balance.totalAssets) {
        passivoAtivos = balance.totalLiab / balance.totalAssets;
      }

      // Giro Ativos = Receita Total / Total Assets
      if (financial?.totalRevenue && balance.totalAssets) {
        giroAtivos = financial.totalRevenue / balance.totalAssets;
      }

      // Dívida Líquida/PL = (Total Debt - Cash) / Shareholders Equity
      const totalDebt = (balance.shortLongTermDebt || 0) + (balance.longTermDebt || 0);
      const cash = balance.cash || financial?.totalCash || 0;
      if (totalDebt > 0 && balance.totalStockholderEquity) {
        dividaLiquidaPl = (totalDebt - cash) / balance.totalStockholderEquity;
      }

      // Dívida Líquida/EBITDA = (Total Debt - Cash) / EBITDA
      if (totalDebt > 0 && financial?.ebitda) {
        dividaLiquidaEbitda = (totalDebt - cash) / financial.ebitda;
      }

      // P/Capital de Giro = Market Cap / (Ativos Circulantes - Passivos Circulantes)
      // NOTA: Só calcula se Working Capital > 0 (muitas empresas têm WC negativo)
      if (quoteData.marketCap && balance.totalCurrentAssets && balance.totalCurrentLiabilities) {
        const workingCapital = balance.totalCurrentAssets - balance.totalCurrentLiabilities;
        if (workingCapital > 0) {
          pCapGiro = quoteData.marketCap / workingCapital;
        }
        // Se WC <= 0, pCapGiro permanece null (é normal para muitas empresas)
      }

      // ROIC aproximado = EBIT / (Total Assets - Current Liabilities)
      // EBIT = Revenue * Operating Margin
      if (financial?.totalRevenue && financial?.operatingMargins && balance.totalAssets && balance.totalCurrentLiabilities) {
        const ebit = financial.totalRevenue * financial.operatingMargins;
        const investedCapital = balance.totalAssets - balance.totalCurrentLiabilities;
        if (investedCapital > 0) {
          roic = ebit / investedCapital;
        }
      }

      // P/EBIT = Market Cap / EBIT
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
      // Pegar os 5 dividendos mais recentes
      ultimosDividendos = dividends.cashDividends.slice(0, 5).map(div => ({
        valor: div.rate,
        data: div.paymentDate,
        tipo: div.label,
        periodo: div.relatedTo
      }));
      
      dividendoMaisRecente = dividends.cashDividends[0]?.rate;
      dataDividendoMaisRecente = dividends.cashDividends[0]?.paymentDate;
    }

    return {
      // === INDICADORES DE VALUATION ===
      pl: quoteData.priceEarnings || null,
      pvp: stats?.priceToBook || null,
      dy: stats?.dividendYield ? stats.dividendYield / 100 : null, // Converter % para decimal
      evEbitda: stats?.enterpriseToEbitda || null,
      evEbit: stats?.enterpriseToRevenue || null,
      psr: psr,
      pAtivos: pAtivos,            // ✅ CALCULADO
      pCapGiro: pCapGiro,          // ✅ CALCULADO
      pEbit: pEbit,                // ✅ CALCULADO
      lpa: stats?.trailingEps || quoteData.earningsPerShare || null,
      vpa: stats?.bookValue || null,

      // === INDICADORES DE ENDIVIDAMENTO ===
      dividaLiquidaPl: dividaLiquidaPl,         // ✅ CALCULADO
      dividaLiquidaEbitda: dividaLiquidaEbitda, // ✅ CALCULADO
      liquidezCorrente: financial?.currentRatio || stats?.currentRatio || null,
      passivoAtivos: passivoAtivos,             // ✅ CALCULADO
      
      // === INDICADORES DE RENTABILIDADE ===
      roe: financial?.returnOnEquity || (stats?.returnOnEquity ? stats.returnOnEquity / 100 : null),
      roic: roic,                   // ✅ CALCULADO
      roa: financial?.returnOnAssets || (stats?.returnOnAssets ? stats.returnOnAssets / 100 : null),
      margemBruta: financial?.grossMargins || (stats?.grossMargin ? stats.grossMargin / 100 : null),
      margemEbitda: financial?.ebitdaMargins || null,
      margemLiquida: financial?.profitMargins || stats?.profitMargins || null,
      giroAtivos: giroAtivos,       // ✅ CALCULADO
      
      // === INDICADORES DE CRESCIMENTO ===
      // cagrReceitas5a - REMOVIDO: não disponível na API (precisa dados históricos 5 anos)
      cagrLucros5a: stats?.earningsAnnualGrowth || null,

      // === DADOS ADICIONAIS DE VALUATION ===
      forwardPE: stats?.forwardPE || null,
      trailingEps: stats?.trailingEps || null,
      evRevenue: stats?.enterpriseToRevenue || null,
      
      // === DADOS DE MERCADO ===
      marketCap: quoteData.marketCap || null,
      enterpriseValue: stats?.enterpriseValue || null,
      sharesOutstanding: stats?.sharesOutstanding || null,
      totalAssets: stats?.totalAssets || null,
      
      // === ENDIVIDAMENTO EXPANDIDO ===
      liquidezRapida: financial?.quickRatio || stats?.quickRatio || null,
      debtToEquity: financial?.debtToEquity || stats?.debtToEquity || null,
      
      // === CRESCIMENTO DETALHADO ===
      // crescimentoTrimestral: REMOVIDO - API retorna null para earningsQuarterlyGrowth
      crescimentoLucros: financial?.earningsGrowth || null,
      crescimentoReceitas: financial?.revenueGrowth || null,
      
      // === DIVIDENDOS COMPLETOS ===
      dividendYield12m: stats?.dividendYield ? stats.dividendYield / 100 : null,
      ultimoDividendo: stats?.lastDividendValue || null,
      dataUltimoDividendo: stats?.lastDividendDate ? new Date(stats.lastDividendDate) : null,
      
      // === PERFORMANCE ===
      variacao52Semanas: stats?.["52WeekChange"] || null,
      retornoAnoAtual: stats?.ytdReturn || null,
      
      // === DADOS FINANCEIROS ADICIONAIS ===
      ebitda: financial?.ebitda || null,
      receitaTotal: financial?.totalRevenue || null,
      lucroLiquido: financial?.grossProfits || null,
      fluxoCaixaOperacional: financial?.operatingCashflow || null,
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
      historicoUltimosDividendos: JSON.stringify(ultimosDividendos),
      
      // === DADOS DA EMPRESA ===
      setor: profile?.sector || quoteData.sector || null,
      industria: profile?.industry || null,
      website: profile?.website || null,
      funcionarios: profile?.fullTimeEmployees || null,
      endereco: profile?.address1 || null,
      cidade: profile?.city || null,
      estado: profile?.state || null,
      pais: profile?.country || null,
      logoUrl: quoteData.logourl || null
    };
  }

  async processCompany(quoteData: BrapiQuoteResponse['results'][0]) {
    const { symbol: ticker, shortName, longName } = quoteData;
    
    // Extrair dados dos módulos
    const financialData = this.extractFinancialData(quoteData);

    // 1. Inserir ou atualizar empresa com TODOS os dados
    const company = await prisma.company.upsert({
      where: { ticker },
      update: {
        name: longName || shortName || ticker,
        sector: financialData.setor,
        industry: financialData.industria,
        description: longName || null,
        website: financialData.website,
        address: financialData.endereco,
        city: financialData.cidade,
        state: financialData.estado,
        country: financialData.pais,
        fullTimeEmployees: financialData.funcionarios,
        logoUrl: financialData.logoUrl
      },
      create: {
        ticker,
        name: longName || shortName || ticker,
        sector: financialData.setor,
        industry: financialData.industria,
        description: longName || null,
        website: financialData.website,
        address: financialData.endereco,
        city: financialData.cidade,
        state: financialData.estado,
        country: financialData.pais,
        fullTimeEmployees: financialData.funcionarios,
        logoUrl: financialData.logoUrl
      }
    });

    console.log(`✅ Empresa processada: ${company.ticker} - ${company.name}`);
    if (financialData.setor) {
      console.log(`🏭 Setor: ${financialData.setor}`);
    }

    // 2. Inserir cotação do dia
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
        price: quoteData.regularMarketPrice
      },
      create: {
        companyId: company.id,
        date: today,
        price: quoteData.regularMarketPrice
      }
    });

    console.log(`💰 Cotação atualizada: ${ticker} - R$ ${quoteData.regularMarketPrice}`);

    // 3. Inserir dados fundamentalistas extraídos dos módulos
    const hasFundamentalData = 
      financialData.pl || 
      financialData.pvp || 
      financialData.dy ||
      financialData.lpa ||
      financialData.vpa;

    if (hasFundamentalData) {
      await prisma.financialData.upsert({
        where: {
          companyId_reportDate: {
            companyId: company.id,
            reportDate: today
          }
        },
        update: {
          // === VALUATION EXPANDIDO ===
          pl: financialData.pl,
          forwardPE: financialData.forwardPE,
          pvp: financialData.pvp,
          dy: financialData.dy,
          evEbitda: financialData.evEbitda,
          evEbit: financialData.evEbit,
          evRevenue: financialData.evRevenue,
          psr: financialData.psr,
          pAtivos: financialData.pAtivos,          // ✅ ADICIONADO
          pCapGiro: financialData.pCapGiro,        // ✅ ADICIONADO
          pEbit: financialData.pEbit,              // ✅ ADICIONADO
          lpa: financialData.lpa,
          trailingEps: financialData.trailingEps,
          vpa: financialData.vpa,
          
          // === DADOS DE MERCADO ===
          marketCap: financialData.marketCap,
          enterpriseValue: financialData.enterpriseValue,
          sharesOutstanding: financialData.sharesOutstanding,
          totalAssets: financialData.totalAssets,
          
          // === ENDIVIDAMENTO E LIQUIDEZ ===
          dividaLiquidaPl: financialData.dividaLiquidaPl,        // ✅ ADICIONADO
          dividaLiquidaEbitda: financialData.dividaLiquidaEbitda, // ✅ ADICIONADO
          liquidezCorrente: financialData.liquidezCorrente,
          liquidezRapida: financialData.liquidezRapida,
          passivoAtivos: financialData.passivoAtivos,
          debtToEquity: financialData.debtToEquity,
          
          // === RENTABILIDADE ===
          roe: financialData.roe,
          roic: financialData.roic,
          roa: financialData.roa,
          margemBruta: financialData.margemBruta,
          margemEbitda: financialData.margemEbitda,
          margemLiquida: financialData.margemLiquida,
          giroAtivos: financialData.giroAtivos,
          
          // === CRESCIMENTO ===
          // cagrReceitas5a: REMOVIDO do schema
          // crescimentoTrimestral: REMOVIDO do schema
          cagrLucros5a: financialData.cagrLucros5a,
          crescimentoLucros: financialData.crescimentoLucros,
          crescimentoReceitas: financialData.crescimentoReceitas,
          
          // === DIVIDENDOS ===
          dividendYield12m: financialData.dividendYield12m,
          ultimoDividendo: financialData.ultimoDividendo,
          dataUltimoDividendo: financialData.dataUltimoDividendo,
          
          // === PERFORMANCE ===
          variacao52Semanas: financialData.variacao52Semanas,
          retornoAnoAtual: financialData.retornoAnoAtual,
          
          // === DADOS FINANCEIROS OPERACIONAIS ===
          ebitda: financialData.ebitda,
          receitaTotal: financialData.receitaTotal,
          lucroLiquido: financialData.lucroLiquido,
          fluxoCaixaOperacional: financialData.fluxoCaixaOperacional,
          fluxoCaixaLivre: financialData.fluxoCaixaLivre,
          totalCaixa: financialData.totalCaixa,
          totalDivida: financialData.totalDivida,
          receitaPorAcao: financialData.receitaPorAcao,
          caixaPorAcao: financialData.caixaPorAcao,
          
          // === DADOS DO BALANÇO PATRIMONIAL ===
          ativoCirculante: financialData.ativoCirculante,
          ativoTotal: financialData.ativoTotal,
          passivoCirculante: financialData.passivoCirculante,
          passivoTotal: financialData.passivoTotal,
          patrimonioLiquido: financialData.patrimonioLiquido,
          caixa: financialData.caixa,
          estoques: financialData.estoques,
          contasReceber: financialData.contasReceber,
          imobilizado: financialData.imobilizado,
          intangivel: financialData.intangivel,
          dividaCirculante: financialData.dividaCirculante,
          dividaLongoPrazo: financialData.dividaLongoPrazo,
          
          // === DADOS DE DIVIDENDOS DETALHADOS ===
          dividendoMaisRecente: financialData.dividendoMaisRecente,
          dataDividendoMaisRecente: financialData.dataDividendoMaisRecente,
          historicoUltimosDividendos: financialData.historicoUltimosDividendos
        },
        create: {
          companyId: company.id,
          reportDate: today,
          
          // === VALUATION EXPANDIDO ===
          pl: financialData.pl,
          forwardPE: financialData.forwardPE,
          pvp: financialData.pvp,
          dy: financialData.dy,
          evEbitda: financialData.evEbitda,
          evEbit: financialData.evEbit,
          evRevenue: financialData.evRevenue,
          psr: financialData.psr,
          lpa: financialData.lpa,
          trailingEps: financialData.trailingEps,
          vpa: financialData.vpa,
          
          // === DADOS DE MERCADO ===
          marketCap: financialData.marketCap,
          enterpriseValue: financialData.enterpriseValue,
          sharesOutstanding: financialData.sharesOutstanding,
          totalAssets: financialData.totalAssets,
          
          // === ENDIVIDAMENTO E LIQUIDEZ ===
          dividaLiquidaPl: financialData.dividaLiquidaPl,        // ✅ ADICIONADO
          dividaLiquidaEbitda: financialData.dividaLiquidaEbitda, // ✅ ADICIONADO
          liquidezCorrente: financialData.liquidezCorrente,
          liquidezRapida: financialData.liquidezRapida,
          passivoAtivos: financialData.passivoAtivos,
          debtToEquity: financialData.debtToEquity,
          
          // === RENTABILIDADE ===
          roe: financialData.roe,
          roic: financialData.roic,
          roa: financialData.roa,
          margemBruta: financialData.margemBruta,
          margemEbitda: financialData.margemEbitda,
          margemLiquida: financialData.margemLiquida,
          giroAtivos: financialData.giroAtivos,
          
          // === CRESCIMENTO ===
          // cagrReceitas5a: REMOVIDO do schema
          // crescimentoTrimestral: REMOVIDO do schema
          cagrLucros5a: financialData.cagrLucros5a,
          crescimentoLucros: financialData.crescimentoLucros,
          crescimentoReceitas: financialData.crescimentoReceitas,
          
          // === DIVIDENDOS ===
          dividendYield12m: financialData.dividendYield12m,
          ultimoDividendo: financialData.ultimoDividendo,
          dataUltimoDividendo: financialData.dataUltimoDividendo,
          
          // === PERFORMANCE ===
          variacao52Semanas: financialData.variacao52Semanas,
          retornoAnoAtual: financialData.retornoAnoAtual,
          
          // === DADOS FINANCEIROS OPERACIONAIS ===
          ebitda: financialData.ebitda,
          receitaTotal: financialData.receitaTotal,
          lucroLiquido: financialData.lucroLiquido,
          fluxoCaixaOperacional: financialData.fluxoCaixaOperacional,
          fluxoCaixaLivre: financialData.fluxoCaixaLivre,
          totalCaixa: financialData.totalCaixa,
          totalDivida: financialData.totalDivida,
          receitaPorAcao: financialData.receitaPorAcao,
          caixaPorAcao: financialData.caixaPorAcao,
          
          // === DADOS DO BALANÇO PATRIMONIAL ===
          ativoCirculante: financialData.ativoCirculante,
          ativoTotal: financialData.ativoTotal,
          passivoCirculante: financialData.passivoCirculante,
          passivoTotal: financialData.passivoTotal,
          patrimonioLiquido: financialData.patrimonioLiquido,
          caixa: financialData.caixa,
          estoques: financialData.estoques,
          contasReceber: financialData.contasReceber,
          imobilizado: financialData.imobilizado,
          intangivel: financialData.intangivel,
          dividaCirculante: financialData.dividaCirculante,
          dividaLongoPrazo: financialData.dividaLongoPrazo,
          
          // === DADOS DE DIVIDENDOS DETALHADOS ===
          dividendoMaisRecente: financialData.dividendoMaisRecente,
          dataDividendoMaisRecente: financialData.dataDividendoMaisRecente,
          historicoUltimosDividendos: financialData.historicoUltimosDividendos
        }
      });

      // Log detalhado dos indicadores encontrados
      const indicators = [];
      if (financialData.pl) indicators.push(`P/L: ${Number(financialData.pl).toFixed(2)}`);
      if (financialData.pvp) indicators.push(`P/VP: ${Number(financialData.pvp).toFixed(2)}`);
      if (financialData.dy) indicators.push(`DY: ${(Number(financialData.dy) * 100).toFixed(2)}%`);
      if (financialData.psr) indicators.push(`PSR: ${Number(financialData.psr).toFixed(2)}`);
      if (financialData.roe) indicators.push(`ROE: ${(Number(financialData.roe) * 100).toFixed(1)}%`);
      if (financialData.roa) indicators.push(`ROA: ${(Number(financialData.roa) * 100).toFixed(1)}%`);
      if (financialData.margemBruta) indicators.push(`MB: ${(Number(financialData.margemBruta) * 100).toFixed(1)}%`);
      if (financialData.liquidezCorrente) indicators.push(`LC: ${Number(financialData.liquidezCorrente).toFixed(2)}`);
      
      // Contar indicadores disponíveis vs total do schema expandido
      const financialFields = Object.keys(financialData).filter(key => 
        !['setor', 'industria', 'website', 'funcionarios', 'endereco', 'cidade', 'estado', 'pais', 'logoUrl'].includes(key)
      );
      const availableCount = financialFields.filter(key => financialData[key as keyof typeof financialData] !== null && financialData[key as keyof typeof financialData] !== undefined).length;
      const totalFields = 65; // Total de campos no schema (66 - 1 crescimentoTrimestral removido)
      
      // Logs detalhados por categoria
      console.log(`📈 Fundamentos atualizados: ${ticker} (${indicators.slice(0, 4).join(', ')})`);
      console.log(`   📊 Disponíveis: ${availableCount}/${totalFields} indicadores`);
      
      // Log adicional dos novos campos importantes
      const additionalData = [];
      if (financialData.marketCap) additionalData.push(`MC: R$ ${(Number(financialData.marketCap) / 1000000000).toFixed(1)}B`);
      if (financialData.receitaTotal) additionalData.push(`Receita: R$ ${(Number(financialData.receitaTotal) / 1000000000).toFixed(1)}B`);
      if (financialData.ebitda) additionalData.push(`EBITDA: R$ ${(Number(financialData.ebitda) / 1000000000).toFixed(1)}B`);
      if (additionalData.length > 0) {
        console.log(`   📋 Dados extras: ${additionalData.join(', ')}`);
      }

      // Log específico para dados que agora funcionam
      const criticalData = [];
      if (financialData.roe) criticalData.push(`ROE: ${(Number(financialData.roe) * 100).toFixed(1)}%`);
      if (financialData.roa) criticalData.push(`ROA: ${(Number(financialData.roa) * 100).toFixed(1)}%`);
      if (financialData.liquidezCorrente) criticalData.push(`LC: ${Number(financialData.liquidezCorrente).toFixed(2)}`);
      if (financialData.margemEbitda) criticalData.push(`ME: ${(Number(financialData.margemEbitda) * 100).toFixed(1)}%`);
      if (criticalData.length > 0) {
        console.log(`   🎯 Dados críticos: ${criticalData.join(', ')}`);
      }

      // Log dos campos que eram nulos e agora estão preenchidos
      const novosIndicadores = [];
      if (financialData.pAtivos) novosIndicadores.push(`P/Ativos: ${Number(financialData.pAtivos).toFixed(2)}`);
      if (financialData.passivoAtivos) novosIndicadores.push(`Pass/At: ${(Number(financialData.passivoAtivos) * 100).toFixed(1)}%`);
      if (financialData.giroAtivos) novosIndicadores.push(`GA: ${Number(financialData.giroAtivos).toFixed(2)}`);
      if (financialData.roic) novosIndicadores.push(`ROIC: ${(Number(financialData.roic) * 100).toFixed(1)}%`);
      if (financialData.dividaLiquidaPl) novosIndicadores.push(`DL/PL: ${Number(financialData.dividaLiquidaPl).toFixed(2)}`);
      if (novosIndicadores.length > 0) {
        console.log(`   🎉 Antes NULL, agora OK: ${novosIndicadores.join(', ')}`);
      }

      // Log dos dados do balanço patrimonial
      const dadosBalanco = [];
      if (financialData.ativoTotal) dadosBalanco.push(`At.Total: R$ ${(Number(financialData.ativoTotal) / 1000000000).toFixed(1)}B`);
      if (financialData.patrimonioLiquido) dadosBalanco.push(`PL: R$ ${(Number(financialData.patrimonioLiquido) / 1000000000).toFixed(1)}B`);
      if (financialData.dividendoMaisRecente) dadosBalanco.push(`Últ.Div: R$ ${Number(financialData.dividendoMaisRecente).toFixed(2)}`);
      if (dadosBalanco.length > 0) {
        console.log(`   📊 Balanço: ${dadosBalanco.join(', ')}`);
      }
    } else {
      console.log(`⚠️  Sem dados fundamentalistas para: ${ticker}`);
    }
  }

  async run() {
    console.log('🚀 Iniciando processo de atualização de dados...');
    console.log(`📋 Total de tickers: ${TICKERS.length}`);

    try {
      // Usar batchSize configurado (1 para gratuito, 10+ para pago)
      const totalBatches = Math.ceil(TICKERS.length / this.batchSize);
      
      for (let i = 0; i < TICKERS.length; i += this.batchSize) {
        const batch = TICKERS.slice(i, i + this.batchSize);
        const batchNumber = Math.floor(i / this.batchSize) + 1;
        
        console.log(`\n📦 Processando lote ${batchNumber} de ${totalBatches} (${batch.length} ação${batch.length > 1 ? 'ões' : ''})`);
        
        try {
          const quotesData = await this.fetchQuotes(batch);
          
          if (quotesData.results && quotesData.results.length > 0) {
            for (const quoteData of quotesData.results) {
              await this.processCompany(quoteData);
            }
          }
        } catch (error: any) {
          console.error(`❌ Erro no lote ${batchNumber}:`, error.response?.data?.message || error.message);
          
          // Se for erro de limite do plano gratuito, parar execução
          if (error.response?.data?.message?.includes('plano permite até')) {
            console.error('💡 Dica: Use "npm run fetch:data:free" para plano gratuito ou faça upgrade em brapi.dev/dashboard');
            process.exit(1);
          }
          
          continue; // Continua com o próximo lote para outros erros
        }

        // Delay entre lotes - maior para plano gratuito
        const delayMs = this.isPaidPlan ? 1000 : 2000;
        await this.delay(delayMs);
      }

      console.log('\n✅ Processo de atualização finalizado com sucesso!');
      
      // Estatísticas finais
      const companiesCount = await prisma.company.count();
      const quotesCount = await prisma.dailyQuote.count();
      const fundamentalsCount = await prisma.financialData.count();
      
      console.log(`\n📊 Estatísticas:`);
      console.log(`   - Empresas: ${companiesCount}`);
      console.log(`   - Cotações: ${quotesCount}`);
      console.log(`   - Fundamentos: ${fundamentalsCount}`);
      
    } catch (error) {
      console.error('❌ Erro fatal no processo:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Executar o script
// Argumentos: node script.js [batchSize]
// Exemplo: tsx fetch-data.ts 1 (gratuito) ou tsx fetch-data.ts 10 (pago)

const args = process.argv.slice(2);
const batchSize = args[0] ? parseInt(args[0]) : 1; // Default: plano gratuito

if (isNaN(batchSize) || batchSize < 1) {
  console.error('❌ Tamanho do lote inválido. Use: npm run fetch:data:free (gratuito) ou npm run fetch:data:paid (pago)');
  process.exit(1);
}

const fetcher = new DataFetcher(batchSize);
fetcher.run();

