import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
// Importar apenas o que precisamos do fetch-data.ts
// import { DataFetcher } from './fetch-data';

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
      city?: string;
      state?: string;
      country?: string;
      fullTimeEmployees?: number;
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

// Tokens das APIs
const WARD_JWT_TOKEN = process.env.WARD_JWT_TOKEN || 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjE1MDc5IiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvZW1haWxhZGRyZXNzIjoiYnVzYW1hckBnbWFpbC5jb20iLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJVc2VyIiwiaWF0IjoxNzU3NzAwNjE5LCJhdWQiOlsiaHR0cHM6Ly9kZXYud2FyZC5hcHAuYnIiLCJodHRwczovL3dhcmQuYXBwLmJyIiwiaHR0cHM6Ly90YXNrcy53YXJkLmFwcC5iciJdLCJleHAiOjE3NTg5OTY2MTksImlzcyI6Imh0dHBzOi8vd2FyZC5hcHAuYnIifQ.BBtBaqK5a2DL4G0QVd7H3rjFp-jxrjE1IVr8kfpIApW1uepBB_RVBkXPMVqFV6Aia2GGQyD_BDM0oJavhM-NgA';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN; // Opcional para plano gratuito

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
    
    company = await prisma.company.create({
      data: {
        ticker: ticker,
        name: brapiData.longName || brapiData.shortName || ticker,
        sector: profile?.sector || brapiData.sector || null,
        industry: profile?.industry || null,
        description: profile?.longBusinessSummary || null,
        website: profile?.website || null,
        address: profile?.address1 || null,
        city: profile?.city || null,
        state: profile?.state || null,
        country: profile?.country || null,
        fullTimeEmployees: profile?.fullTimeEmployees || null,
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

    // Buscar dados da Ward
    const wardData = await fetchWardData(ticker);
    if (!wardData || !wardData.historicalStocks) {
      console.log(`❌ Nenhum dado histórico encontrado para ${ticker}`);
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

    let processedYears = 0;
    let updatedYears = 0;
    let createdYears = 0;
    let complementedYears = 0;

    // Função para processar um ano específico
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
        
        for (const [batchIndex, batch] of wardBatches.entries()) {
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

export { main, processCompany, fetchWardData, fetchWardTickers, createOrUpdateCompany, fetchBrapiBasicData };
