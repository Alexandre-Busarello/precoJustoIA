import axios from 'axios';
import * as dotenv from 'dotenv';
import { backgroundPrisma, backgroundPrismaManager } from './prisma-background';
import { TickerProcessingManager } from './ticker-processing-manager';
import { ConcurrencyManager, executeWithRetry, executeWithTimeout } from './concurrency-manager';

// Carregar variáveis de ambiente
dotenv.config();

// Usar o cliente Prisma otimizado para background
const prisma = backgroundPrisma;

// Interface para resposta da API do Fundamentus
interface FundamentusResponse {
  ticker: string;
  extraction_date: string;
  price_information?: {
    price: { value: number };
    date: { value: string };
  };
  detailed_information: {
    stock_type: { value: string };
    traded_volume_per_day: { value: number };
    equity_value_per_share: { value: number }; // VPA
    earnings_per_share: { value: number }; // LPA
    variation_52_weeks: {
      lowest_value: { value: number };
      highest_value: { value: number };
    };
  };
  oscillations: {
    variation_day: { value: number };
    variation_month: { value: number };
    variation_30_days: { value: number };
    variation_12_months: { value: number };
    variation_2022: { value: number }; // 2025
    variation_2021: { value: number }; // 2024
    variation_2020: { value: number }; // 2023
    variation_2019: { value: number }; // 2022
    variation_2018: { value: number }; // 2021
    variation_2017: { value: number }; // 2020
  };
  valuation_indicators: {
    price_divided_by_profit_title: { value: number }; // P/L
    price_divided_by_asset_value: { value: number }; // P/VP
    price_divided_by_ebit: { value: number }; // P/EBIT
    price_divided_by_net_revenue: { value: number }; // PSR
    price_divided_by_total_assets: { value: number }; // Preço/Ativos
    price_divided_by_net_current_assets: { value: number }; // Preço/Ativ circ liq
    dividend_yield: { value: number }; // DY
    enterprise_value_by_ebitda: { value: number }; // EV/EBITDA
    enterprise_value_by_ebit: { value: number }; // EV/EBIT
    price_by_working_capital: { value: number }; // Preço/Capital de giro
  };
  profitability_indicators: {
    return_on_equity: { value: number }; // ROE
    return_on_invested_capital: { value: number }; // ROIC
    ebit_divided_by_total_assets: { value: number }; // EBIT/Ativo
    net_revenue_growth_last_5_years: { value: number }; // Crescimento receita 5a
    net_revenue_divided_by_total_assets: { value: number }; // Giro ativos
    gross_profit_divided_by_net_revenue: { value: number }; // Margem bruta
    ebit_divided_by_net_revenue: { value: number }; // Margem EBIT
    net_income_divided_by_net_revenue: { value: number }; // Margem líquida
  };
  indebtedness_indicators: {
    current_liquidity: { value: number }; // Liquidez corrente
    gross_debt_by_equity: { value: number }; // Dívida bruta/Patrim
    net_debt_by_equity: { value: number }; // Dívida líquida/Patrim
    net_debt_by_ebitda: { value: number }; // Dívida líquida/EBITDA
    equity_by_total_assets: { value: number }; // PL/Ativos
  };
  balance_sheet: {
    total_assets: { value: number }; // Ativo total
    current_assets: { value: number }; // Ativo circulante
    cash: { value: number }; // Disponibilidades
    gross_debt: { value: number }; // Dívida bruta
    net_debt: { value: number }; // Dívida líquida
    equity: { value: number }; // Patrimônio líquido
  };
  income_statement: {
    three_months: {
      revenue: { value: number };
      ebit: { value: number };
      net_income: { value: number };
    };
    twelve_months: {
      revenue: { value: number }; // Receita líquida 12m
      ebit: { value: number }; // EBIT 12m
      net_income: { value: number }; // Lucro líquido 12m
    };
  };
}

// Interface para dados financeiros do Fundamentus
interface FundamentusFinancialData {
  year: number;
  
  // === INDICADORES DE VALUATION ===
  pl?: number | null;
  pvp?: number | null;
  pEbit?: number | null;
  psr?: number | null;
  pAtivos?: number | null;
  pCapGiro?: number | null;
  dy?: number | null;
  evEbitda?: number | null;
  evEbit?: number | null;
  lpa?: number | null;
  vpa?: number | null;
  
  // === INDICADORES DE RENTABILIDADE ===
  roe?: number | null;
  roic?: number | null;
  margemBruta?: number | null;
  margemEbitda?: number | null;
  margemLiquida?: number | null;
  giroAtivos?: number | null;
  crescimentoReceitas?: number | null;
  
  // === INDICADORES DE CRESCIMENTO (CALCULADOS) ===
  cagrLucros5a?: number | null;
  cagrReceitas5a?: number | null;
  crescimentoLucros?: number | null;
  
  // === INDICADORES DE ENDIVIDAMENTO ===
  liquidezCorrente?: number | null;
  dividaLiquidaPl?: number | null;
  dividaLiquidaEbitda?: number | null;
  
  // === DADOS FINANCEIROS ===
  ebitda?: number | null;
  receitaTotal?: number | null;
  lucroLiquido?: number | null;
  ativoTotal?: number | null;
  ativoCirculante?: number | null;
  caixa?: number | null;
  totalDivida?: number | null;
  patrimonioLiquido?: number | null;
  
  // === DIVIDENDOS ===
  dividendYield12m?: number | null;
  
  // === METADADOS ===
  dataSource: string;
}

// Função para buscar dados de uma empresa na API do Fundamentus
async function fetchFundamentusData(ticker: string): Promise<FundamentusResponse | null> {
  return executeWithRetry(async () => {
    console.log(`🔍 Buscando dados do Fundamentus para ${ticker}...`);
    
    const response = await axios.get(
      `https://py-fundamentus-six.vercel.app/stock/${ticker}`,
      {
        headers: {
          'User-Agent': 'analisador-acoes/1.0.0',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.status === 200 && response.data) {
      console.log(`✅ Dados do Fundamentus obtidos para ${ticker}`);
      return response.data;
    } else {
      console.log(`⚠️  Resposta inesperada do Fundamentus para ${ticker}: Status ${response.status}`);
      return null;
    }
  }, 3, 2000); // 3 tentativas, 2s de delay inicial
}

// Função para converter dados do Fundamentus para o formato do banco
function convertFundamentusToFinancialData(fundamentusData: FundamentusResponse): FundamentusFinancialData {
  const currentYear = new Date().getFullYear();
  const val = fundamentusData.valuation_indicators;
  const prof = fundamentusData.profitability_indicators;
  const debt = fundamentusData.indebtedness_indicators;
  const balance = fundamentusData.balance_sheet;
  const income = fundamentusData.income_statement.twelve_months;
  const detailed = fundamentusData.detailed_information;
  
  // Não calcular EBITDA - usar apenas dados fornecidos diretamente pelo Fundamentus

  return {
    year: currentYear,
    
    // === INDICADORES DE VALUATION ===
    pl: val.price_divided_by_profit_title?.value || null,
    pvp: val.price_divided_by_asset_value?.value || null,
    pEbit: val.price_divided_by_ebit?.value || null,
    psr: val.price_divided_by_net_revenue?.value || null,
    pAtivos: val.price_divided_by_total_assets?.value || null,
    pCapGiro: val.price_by_working_capital?.value || null,
    dy: val.dividend_yield?.value || null,
    evEbitda: val.enterprise_value_by_ebitda?.value || null,
    evEbit: val.enterprise_value_by_ebit?.value || null,
    lpa: detailed.earnings_per_share?.value || null,
    vpa: detailed.equity_value_per_share?.value || null,
    
    // === INDICADORES DE RENTABILIDADE ===
    roe: prof.return_on_equity?.value || null,
    roic: prof.return_on_invested_capital?.value || null,
    margemBruta: prof.gross_profit_divided_by_net_revenue?.value || null,
    margemEbitda: prof.ebit_divided_by_net_revenue?.value || null, // Margem EBIT (não EBITDA)
    margemLiquida: prof.net_income_divided_by_net_revenue?.value || null,
    giroAtivos: prof.net_revenue_divided_by_total_assets?.value || null,
    crescimentoReceitas: prof.net_revenue_growth_last_5_years?.value || null, // Do Fundamentus (mantido como referência)
    
    // === INDICADORES DE ENDIVIDAMENTO ===
    liquidezCorrente: debt.current_liquidity?.value || null,
    dividaLiquidaPl: debt.net_debt_by_equity?.value || null,
    dividaLiquidaEbitda: debt.net_debt_by_ebitda?.value || null,
    
    // === DADOS FINANCEIROS ===
    ebitda: null, // Não fornecido diretamente pelo Fundamentus
    receitaTotal: income.revenue?.value || null,
    lucroLiquido: income.net_income?.value || null,
    ativoTotal: balance.total_assets?.value || null,
    ativoCirculante: balance.current_assets?.value || null,
    caixa: balance.cash?.value || null,
    totalDivida: balance.gross_debt?.value || null,
    patrimonioLiquido: balance.equity?.value || null,
    
    // === DIVIDENDOS ===
    dividendYield12m: val.dividend_yield?.value || null,
    
    // === METADADOS ===
    dataSource: 'fundamentus'
  };
}

// Função para processar dados trimestrais
async function processQuarterlyFinancials(
  companyId: number, 
  ticker: string, 
  fundamentusData: FundamentusResponse
): Promise<void> {
  try {
    const extractionDate = new Date(fundamentusData.extraction_date);
    const threeMonths = fundamentusData.income_statement.three_months;
    const twelveMonths = fundamentusData.income_statement.twelve_months;
    
    console.log(`📊 Processando dados trimestrais para ${ticker}...`);
    
    await prisma.quarterlyFinancials.upsert({
      where: {
        companyId_extractionDate: {
          companyId,
          extractionDate
        }
      },
      update: {
        // Dados dos últimos 3 meses
        quarterlyRevenue: threeMonths.revenue?.value || null,
        quarterlyEbit: threeMonths.ebit?.value || null,
        quarterlyNetIncome: threeMonths.net_income?.value || null,
        
        // Dados dos últimos 12 meses (para comparação)
        twelveMonthsRevenue: twelveMonths.revenue?.value || null,
        twelveMonthsEbit: twelveMonths.ebit?.value || null,
        twelveMonthsNetIncome: twelveMonths.net_income?.value || null
      },
      create: {
        companyId,
        extractionDate,
        
        // Dados dos últimos 3 meses
        quarterlyRevenue: threeMonths.revenue?.value || null,
        quarterlyEbit: threeMonths.ebit?.value || null,
        quarterlyNetIncome: threeMonths.net_income?.value || null,
        
        // Dados dos últimos 12 meses (para comparação)
        twelveMonthsRevenue: twelveMonths.revenue?.value || null,
        twelveMonthsEbit: twelveMonths.ebit?.value || null,
        twelveMonthsNetIncome: twelveMonths.net_income?.value || null
      }
    });
    
    console.log(`✅ Dados trimestrais processados para ${ticker}`);
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar dados trimestrais para ${ticker}:`, error.message);
  }
}

// Função para processar oscilações de preço
async function processPriceOscillations(
  companyId: number, 
  ticker: string, 
  fundamentusData: FundamentusResponse
): Promise<void> {
  try {
    const extractionDate = new Date(fundamentusData.extraction_date);
    const osc = fundamentusData.oscillations;
    const detailed = fundamentusData.detailed_information;
    
    console.log(`📊 Processando oscilações de preço para ${ticker}...`);
    
    await prisma.priceOscillations.upsert({
      where: {
        companyId_extractionDate: {
          companyId,
          extractionDate
        }
      },
      update: {
        variationDay: osc.variation_day?.value || null,
        variationMonth: osc.variation_month?.value || null,
        variation30Days: osc.variation_30_days?.value || null,
        variation12Months: osc.variation_12_months?.value || null,
        variation2025: osc.variation_2022?.value || null, // Mapeamento correto
        variation2024: osc.variation_2021?.value || null,
        variation2023: osc.variation_2020?.value || null,
        variation2022: osc.variation_2019?.value || null,
        variation2021: osc.variation_2018?.value || null,
        variation2020: osc.variation_2017?.value || null,
        min52Weeks: detailed.variation_52_weeks?.lowest_value?.value || null,
        max52Weeks: detailed.variation_52_weeks?.highest_value?.value || null,
        tradedVolumePerDay: detailed.traded_volume_per_day?.value || null
      },
      create: {
        companyId,
        extractionDate,
        variationDay: osc.variation_day?.value || null,
        variationMonth: osc.variation_month?.value || null,
        variation30Days: osc.variation_30_days?.value || null,
        variation12Months: osc.variation_12_months?.value || null,
        variation2025: osc.variation_2022?.value || null,
        variation2024: osc.variation_2021?.value || null,
        variation2023: osc.variation_2020?.value || null,
        variation2022: osc.variation_2019?.value || null,
        variation2021: osc.variation_2018?.value || null,
        variation2020: osc.variation_2017?.value || null,
        min52Weeks: detailed.variation_52_weeks?.lowest_value?.value || null,
        max52Weeks: detailed.variation_52_weeks?.highest_value?.value || null,
        tradedVolumePerDay: detailed.traded_volume_per_day?.value || null
      }
    });
    
    console.log(`✅ Oscilações de preço processadas para ${ticker}`);
    
  } catch (error: any) {
    console.error(`❌ Erro ao processar oscilações para ${ticker}:`, error.message);
  }
}

// Função para calcular todas as métricas de crescimento para todos os anos da empresa
async function calculateAndUpdateAllGrowthMetrics(companyId: number): Promise<void> {
  try {
    console.log(`📊 Recalculando métricas de crescimento para todos os anos...`);
    
    // Buscar todos os dados financeiros da empresa ordenados por ano
    const allFinancialData = await prisma.financialData.findMany({
      where: { companyId },
      select: {
        id: true,
        year: true,
        lucroLiquido: true,
        receitaTotal: true
      },
      orderBy: { year: 'asc' }
    });
    
    if (allFinancialData.length < 2) {
      console.log(`⚠️  Dados insuficientes para cálculo (${allFinancialData.length} anos)`);
      return;
    }
    
    console.log(`📈 Processando ${allFinancialData.length} anos de dados financeiros`);
    
    // Processar cada ano para calcular suas métricas
    for (let i = 0; i < allFinancialData.length; i++) {
      const currentYearData = allFinancialData[i];
      const currentYear = currentYearData.year;
      
      // Buscar dados completos do registro para preservar valores do Yahoo quando cálculo resultar em zero
      const fullYearData = await prisma.financialData.findUnique({
        where: { id: currentYearData.id },
        select: {
          crescimentoLucros: true,
          crescimentoReceitas: true
        }
      });
      
      // Calcular métricas para este ano específico
      const metrics = await calculateGrowthMetricsForYear(allFinancialData, i);
      
      // Se o cálculo resultar em zero ou null, usar valores do Yahoo se disponíveis
      const finalCrescimentoLucros = (metrics.crescimentoLucros === null || metrics.crescimentoLucros === 0) 
        ? (fullYearData?.crescimentoLucros || metrics.crescimentoLucros)
        : metrics.crescimentoLucros;
      
      const finalCrescimentoReceitas = (metrics.crescimentoReceitas === null || metrics.crescimentoReceitas === 0)
        ? (fullYearData?.crescimentoReceitas || metrics.crescimentoReceitas)
        : metrics.crescimentoReceitas;
      
      // Atualizar o registro no banco
      await prisma.financialData.update({
        where: { id: currentYearData.id },
        data: {
          cagrLucros5a: metrics.cagrLucros5a,
          cagrReceitas5a: metrics.cagrReceitas5a,
          crescimentoLucros: finalCrescimentoLucros,
          crescimentoReceitas: finalCrescimentoReceitas
        }
      });
      
      // Log das métricas calculadas (usar valores finais que podem incluir dados do Yahoo)
      const metricsLog = [];
      if (metrics.cagrLucros5a !== null) metricsLog.push(`CAGR-L(5a): ${(metrics.cagrLucros5a * 100).toFixed(1)}%`);
      if (metrics.cagrReceitas5a !== null) metricsLog.push(`CAGR-R(5a): ${(metrics.cagrReceitas5a * 100).toFixed(1)}%`);
      if (finalCrescimentoLucros !== null) {
        const source = (metrics.crescimentoLucros === null || metrics.crescimentoLucros === 0) && fullYearData?.crescimentoLucros ? ' (Yahoo)' : '';
        metricsLog.push(`Cresc Lucros: ${(finalCrescimentoLucros * 100).toFixed(1)}%${source}`);
      }
      if (finalCrescimentoReceitas !== null) {
        const source = (metrics.crescimentoReceitas === null || metrics.crescimentoReceitas === 0) && fullYearData?.crescimentoReceitas ? ' (Yahoo)' : '';
        metricsLog.push(`Cresc Receitas: ${(finalCrescimentoReceitas * 100).toFixed(1)}%${source}`);
      }
      
      if (metricsLog.length > 0) {
        console.log(`  📊 ${currentYear}: ${metricsLog.join(', ')}`);
      }
    }
    
    console.log(`✅ Métricas de crescimento recalculadas para todos os anos`);
    
  } catch (error: any) {
    console.error(`❌ Erro ao calcular métricas de crescimento:`, error.message);
  }
}

// Função auxiliar para calcular métricas de crescimento para um ano específico
// CORREÇÃO: Agora calcula CAGR real de 5 anos (período fixo) ao invés de filtrar apenas anos positivos
async function calculateGrowthMetricsForYear(
  allData: Array<{ id: number; year: number; lucroLiquido: any; receitaTotal: any }>,
  currentIndex: number
): Promise<{
  cagrLucros5a: number | null;
  cagrReceitas5a: number | null;
  crescimentoLucros: number | null;
  crescimentoReceitas: number | null;
}> {
  const currentYear = allData[currentIndex];
  const currentYearNum = currentYear.year;
  
  // Buscar dados dos últimos 5 anos (incluindo o ano atual)
  // IMPORTANTE: Período fixo de 5 anos, não filtrado por valores positivos
  const fiveYearsAgo = currentYearNum - 5; // 5 anos = ano atual + 4 anos anteriores
  const relevantData = allData.filter(data => 
    data.year >= fiveYearsAgo && data.year <= currentYearNum
  );
  
  let cagrLucros5a = null;
  let cagrReceitas5a = null;
  let crescimentoLucros = null;
  let crescimentoReceitas = null;
  
  // === CALCULAR CAGR DE LUCROS (5 ANOS) ===
  // Buscar exatamente o primeiro e último ano do período de 5 anos
  const firstYearData = relevantData.find(data => data.year === fiveYearsAgo);
  const lastYearData = relevantData.find(data => data.year === currentYearNum);
  
  if (firstYearData && lastYearData && 
      firstYearData.lucroLiquido && lastYearData.lucroLiquido &&
      Number(firstYearData.lucroLiquido) !== 0 && Number(lastYearData.lucroLiquido) !== 0) {
    
    const initialValue = Number(firstYearData.lucroLiquido);
    const finalValue = Number(lastYearData.lucroLiquido);
    const years = currentYearNum - fiveYearsAgo; // Será 5 períodos (ex: 2020→2025 = 5 anos)
    
    // Calcular CAGR baseado no cenário
    if (initialValue > 0 && finalValue > 0) {
      // Cenário 1: Lucro → Lucro (CAGR tradicional)
      cagrLucros5a = Math.pow(finalValue / initialValue, 1 / years) - 1;
      
    } else if (initialValue < 0 && finalValue < 0) {
      // Cenário 2: Prejuízo → Prejuízo (melhoria na redução de prejuízo)
      cagrLucros5a = -(Math.pow(Math.abs(finalValue) / Math.abs(initialValue), 1 / years) - 1);
      
    } else if (initialValue < 0 && finalValue > 0) {
      // Cenário 3: Prejuízo → Lucro (recuperação/turnaround)
      // Usar uma métrica alternativa: taxa de recuperação anualizada
      // Fórmula: ((Lucro Final + |Prejuízo Inicial|) / |Prejuízo Inicial|)^(1/anos) - 1
      const recoveryBase = Math.abs(initialValue);
      const totalImprovement = finalValue + recoveryBase;
      cagrLucros5a = Math.pow(totalImprovement / recoveryBase, 1 / years) - 1;
      
    } else if (initialValue > 0 && finalValue < 0) {
      // Cenário 4: Lucro → Prejuízo (deterioração)
      // Usar taxa de deterioração (valor negativo para indicar declínio)
      const deteriorationBase = initialValue;
      const totalDeterioration = deteriorationBase + Math.abs(finalValue);
      cagrLucros5a = -(Math.pow(totalDeterioration / deteriorationBase, 1 / years) - 1);
    }
  }
  
  // === CALCULAR CAGR DE RECEITAS (5 ANOS) ===
  // Buscar exatamente o primeiro e último ano do período de 5 anos
  const firstYearRevenue = relevantData.find(data => data.year === fiveYearsAgo);
  const lastYearRevenue = relevantData.find(data => data.year === currentYearNum);
  
  if (firstYearRevenue && lastYearRevenue && 
      firstYearRevenue.receitaTotal && lastYearRevenue.receitaTotal &&
      Number(firstYearRevenue.receitaTotal) !== 0 && Number(lastYearRevenue.receitaTotal) !== 0) {
    
    const initialValue = Number(firstYearRevenue.receitaTotal);
    const finalValue = Number(lastYearRevenue.receitaTotal);
    const years = currentYearNum - fiveYearsAgo; // Será 5 períodos (ex: 2020→2025 = 5 anos)
    
    // Calcular CAGR de receitas (casos especiais são raros, mas possíveis)
    if (initialValue > 0 && finalValue > 0) {
      // Cenário normal: Receita positiva → Receita positiva
      cagrReceitas5a = Math.pow(finalValue / initialValue, 1 / years) - 1;
      
    } else if (initialValue < 0 && finalValue < 0) {
      // Cenário raro: Receita negativa → Receita negativa (melhoria)
      cagrReceitas5a = -(Math.pow(Math.abs(finalValue) / Math.abs(initialValue), 1 / years) - 1);
      
    } else if (initialValue < 0 && finalValue > 0) {
      // Cenário de recuperação: Receita negativa → Receita positiva
      const recoveryBase = Math.abs(initialValue);
      const totalImprovement = finalValue + recoveryBase;
      cagrReceitas5a = Math.pow(totalImprovement / recoveryBase, 1 / years) - 1;
      
    } else if (initialValue > 0 && finalValue < 0) {
      // Cenário de deterioração: Receita positiva → Receita negativa
      const deteriorationBase = initialValue;
      const totalDeterioration = deteriorationBase + Math.abs(finalValue);
      cagrReceitas5a = -(Math.pow(totalDeterioration / deteriorationBase, 1 / years) - 1);
    }
  }
  
  // === CALCULAR CRESCIMENTO ANUAL (ANO ANTERIOR → ANO ATUAL) ===
  if (currentIndex > 0) {
    const previousYear = allData[currentIndex - 1];
    
    // Crescimento de Lucros
    if (currentYear.lucroLiquido && previousYear.lucroLiquido) {
      const currentProfit = Number(currentYear.lucroLiquido);
      const previousProfit = Number(previousYear.lucroLiquido);
      
      if (previousProfit !== 0) {
        crescimentoLucros = (currentProfit - previousProfit) / Math.abs(previousProfit);
      }
    }
    
    // Crescimento de Receitas
    if (currentYear.receitaTotal && previousYear.receitaTotal) {
      const currentRevenue = Number(currentYear.receitaTotal);
      const previousRevenue = Number(previousYear.receitaTotal);
      
      if (previousRevenue !== 0) {
        crescimentoReceitas = (currentRevenue - previousRevenue) / Math.abs(previousRevenue);
      }
    }
  }
  
  return {
    cagrLucros5a,
    cagrReceitas5a,
    crescimentoLucros,
    crescimentoReceitas
  };
}

// Função para mesclar dados do Fundamentus com dados existentes
function mergeFundamentusWithExistingData(
  fundamentusData: FundamentusFinancialData, 
  existingData: any
): any {
  // Priorizar dados do Fundamentus, mas preservar campos únicos de outras fontes
  const merged = { ...existingData };
  
  // Atualizar fonte de dados
  const sources = existingData?.dataSource ? existingData.dataSource.split('+') : [];
  if (!sources.includes('fundamentus')) {
    sources.unshift('fundamentus'); // Fundamentus tem prioridade
  }
  merged.dataSource = sources.join('+');
  
  // === INDICADORES DE VALUATION (prioridade Fundamentus) ===
  if (fundamentusData.pl !== null) merged.pl = fundamentusData.pl;
  if (fundamentusData.pvp !== null) merged.pvp = fundamentusData.pvp;
  if (fundamentusData.pEbit !== null) merged.pEbit = fundamentusData.pEbit;
  if (fundamentusData.psr !== null) merged.psr = fundamentusData.psr;
  if (fundamentusData.pAtivos !== null) merged.pAtivos = fundamentusData.pAtivos;
  if (fundamentusData.pCapGiro !== null) merged.pCapGiro = fundamentusData.pCapGiro;
  if (fundamentusData.dy !== null) merged.dy = fundamentusData.dy;
  if (fundamentusData.evEbitda !== null) merged.evEbitda = fundamentusData.evEbitda;
  if (fundamentusData.evEbit !== null) merged.evEbit = fundamentusData.evEbit;
  if (fundamentusData.lpa !== null) merged.lpa = fundamentusData.lpa;
  if (fundamentusData.vpa !== null) merged.vpa = fundamentusData.vpa;
  
  // === INDICADORES DE RENTABILIDADE (prioridade Fundamentus) ===
  if (fundamentusData.roe !== null) merged.roe = fundamentusData.roe;
  if (fundamentusData.roic !== null) merged.roic = fundamentusData.roic;
  if (fundamentusData.margemBruta !== null) merged.margemBruta = fundamentusData.margemBruta;
  if (fundamentusData.margemEbitda !== null) merged.margemEbitda = fundamentusData.margemEbitda;
  if (fundamentusData.margemLiquida !== null) merged.margemLiquida = fundamentusData.margemLiquida;
  if (fundamentusData.giroAtivos !== null) merged.giroAtivos = fundamentusData.giroAtivos;
  if (fundamentusData.crescimentoReceitas !== null) merged.crescimentoReceitas = fundamentusData.crescimentoReceitas;
  
  // === INDICADORES DE CRESCIMENTO CALCULADOS (prioridade máxima) ===
  if (fundamentusData.cagrLucros5a !== null) merged.cagrLucros5a = fundamentusData.cagrLucros5a;
  if (fundamentusData.cagrReceitas5a !== null) merged.cagrReceitas5a = fundamentusData.cagrReceitas5a;
  if (fundamentusData.crescimentoLucros !== null) merged.crescimentoLucros = fundamentusData.crescimentoLucros;
  
  // === INDICADORES DE ENDIVIDAMENTO (prioridade Fundamentus) ===
  if (fundamentusData.liquidezCorrente !== null) merged.liquidezCorrente = fundamentusData.liquidezCorrente;
  if (fundamentusData.dividaLiquidaPl !== null) merged.dividaLiquidaPl = fundamentusData.dividaLiquidaPl;
  if (fundamentusData.dividaLiquidaEbitda !== null) merged.dividaLiquidaEbitda = fundamentusData.dividaLiquidaEbitda;
  
  // === DADOS FINANCEIROS (prioridade Fundamentus para dados operacionais) ===
  if (fundamentusData.ebitda !== null) merged.ebitda = fundamentusData.ebitda;
  if (fundamentusData.receitaTotal !== null) merged.receitaTotal = fundamentusData.receitaTotal;
  if (fundamentusData.lucroLiquido !== null) merged.lucroLiquido = fundamentusData.lucroLiquido;
  if (fundamentusData.ativoTotal !== null) merged.ativoTotal = fundamentusData.ativoTotal;
  if (fundamentusData.ativoCirculante !== null) merged.ativoCirculante = fundamentusData.ativoCirculante;
  if (fundamentusData.caixa !== null) merged.caixa = fundamentusData.caixa;
  if (fundamentusData.totalDivida !== null) merged.totalDivida = fundamentusData.totalDivida;
  if (fundamentusData.patrimonioLiquido !== null) merged.patrimonioLiquido = fundamentusData.patrimonioLiquido;
  
  // === DIVIDENDOS (prioridade Fundamentus) ===
  if (fundamentusData.dividendYield12m !== null) merged.dividendYield12m = fundamentusData.dividendYield12m;
  
  return merged;
}

// Função para processar uma empresa
async function processCompany(ticker: string): Promise<void> {
  try {
    console.log(`\n🏢 Processando ${ticker} com dados do Fundamentus...`);
    
    // Buscar dados do Fundamentus
    const fundamentusData = await fetchFundamentusData(ticker);
    if (!fundamentusData) {
      console.log(`❌ Não foi possível obter dados do Fundamentus para ${ticker}`);
      return;
    }
    
    // Verificar se a empresa existe no banco
    let company = await prisma.company.findUnique({
      where: { ticker }
    });
    
    if (!company) {
      console.log(`⚠️  Empresa ${ticker} não encontrada no banco. Criando entrada básica...`);
      
      // Criar empresa básica (sem dados detalhados do perfil)
      company = await prisma.company.create({
        data: {
          ticker: ticker,
          name: ticker, // Nome temporário
          sector: null,
          industry: null,
          description: null
        }
      });
      
      console.log(`✅ Empresa ${ticker} criada no banco`);
    }
    
    // Processar oscilações de preço
    await processPriceOscillations(company.id, ticker, fundamentusData);
    
    // Processar dados trimestrais
    await processQuarterlyFinancials(company.id, ticker, fundamentusData);
    
    // Converter dados do Fundamentus
    const fundamentusFinancialData = convertFundamentusToFinancialData(fundamentusData);

    // Recalcular todas as métricas de crescimento para todos os anos da empresa
    await calculateAndUpdateAllGrowthMetrics(company.id);
    
    // Buscar dados financeiros existentes para o ano atual
    const currentYear = new Date().getFullYear();
    const existingFinancialData = await prisma.financialData.findUnique({
      where: {
        companyId_year: {
          companyId: company.id,
          year: currentYear
        }
      }
    });
    
    // Mesclar com dados existentes se houver
    let finalFinancialData;
    if (existingFinancialData) {
      finalFinancialData = mergeFundamentusWithExistingData(
        fundamentusFinancialData, 
        existingFinancialData
      );
      console.log(`🔄 ${ticker}: Dados mesclados Fundamentus + ${existingFinancialData.dataSource || 'outros'}`);
    } else {
      finalFinancialData = fundamentusFinancialData;
      console.log(`🆕 ${ticker}: Novos dados do Fundamentus`);
    }
    
    // Upsert dos dados financeiros
    await prisma.financialData.upsert({
      where: {
        companyId_year: {
          companyId: company.id,
          year: currentYear
        }
      },
      update: {
        // === INDICADORES DE VALUATION ===
        pl: finalFinancialData.pl,
        pvp: finalFinancialData.pvp,
        pEbit: finalFinancialData.pEbit,
        psr: finalFinancialData.psr,
        pAtivos: finalFinancialData.pAtivos,
        pCapGiro: finalFinancialData.pCapGiro,
        dy: finalFinancialData.dy,
        evEbitda: finalFinancialData.evEbitda,
        evEbit: finalFinancialData.evEbit,
        lpa: finalFinancialData.lpa,
        vpa: finalFinancialData.vpa,
        
        // === INDICADORES DE RENTABILIDADE ===
        roe: finalFinancialData.roe,
        roic: finalFinancialData.roic,
        margemBruta: finalFinancialData.margemBruta,
        margemEbitda: finalFinancialData.margemEbitda,
        margemLiquida: finalFinancialData.margemLiquida,
        giroAtivos: finalFinancialData.giroAtivos,
        crescimentoReceitas: finalFinancialData.crescimentoReceitas,
        
        // === INDICADORES DE CRESCIMENTO CALCULADOS ===
        cagrLucros5a: finalFinancialData.cagrLucros5a,
        cagrReceitas5a: finalFinancialData.cagrReceitas5a,
        crescimentoLucros: finalFinancialData.crescimentoLucros,
        
        // === INDICADORES DE ENDIVIDAMENTO ===
        liquidezCorrente: finalFinancialData.liquidezCorrente,
        dividaLiquidaPl: finalFinancialData.dividaLiquidaPl,
        dividaLiquidaEbitda: finalFinancialData.dividaLiquidaEbitda,
        
        // === DADOS FINANCEIROS ===
        ebitda: finalFinancialData.ebitda,
        receitaTotal: finalFinancialData.receitaTotal,
        lucroLiquido: finalFinancialData.lucroLiquido,
        ativoTotal: finalFinancialData.ativoTotal,
        ativoCirculante: finalFinancialData.ativoCirculante,
        caixa: finalFinancialData.caixa,
        totalDivida: finalFinancialData.totalDivida,
        patrimonioLiquido: finalFinancialData.patrimonioLiquido,
        
        // === DIVIDENDOS ===
        dividendYield12m: finalFinancialData.dividendYield12m,
        
        // === METADADOS ===
        dataSource: finalFinancialData.dataSource
      },
      create: {
        companyId: company.id,
        year: currentYear,
        
        // === INDICADORES DE VALUATION ===
        pl: finalFinancialData.pl,
        pvp: finalFinancialData.pvp,
        pEbit: finalFinancialData.pEbit,
        psr: finalFinancialData.psr,
        pAtivos: finalFinancialData.pAtivos,
        pCapGiro: finalFinancialData.pCapGiro,
        dy: finalFinancialData.dy,
        evEbitda: finalFinancialData.evEbitda,
        evEbit: finalFinancialData.evEbit,
        lpa: finalFinancialData.lpa,
        vpa: finalFinancialData.vpa,
        
        // === INDICADORES DE RENTABILIDADE ===
        roe: finalFinancialData.roe,
        roic: finalFinancialData.roic,
        margemBruta: finalFinancialData.margemBruta,
        margemEbitda: finalFinancialData.margemEbitda,
        margemLiquida: finalFinancialData.margemLiquida,
        giroAtivos: finalFinancialData.giroAtivos,
        crescimentoReceitas: finalFinancialData.crescimentoReceitas,
        
        // === INDICADORES DE CRESCIMENTO CALCULADOS ===
        cagrLucros5a: finalFinancialData.cagrLucros5a,
        cagrReceitas5a: finalFinancialData.cagrReceitas5a,
        crescimentoLucros: finalFinancialData.crescimentoLucros,
        
        // === INDICADORES DE ENDIVIDAMENTO ===
        liquidezCorrente: finalFinancialData.liquidezCorrente,
        dividaLiquidaPl: finalFinancialData.dividaLiquidaPl,
        dividaLiquidaEbitda: finalFinancialData.dividaLiquidaEbitda,
        
        // === DADOS FINANCEIROS ===
        ebitda: finalFinancialData.ebitda,
        receitaTotal: finalFinancialData.receitaTotal,
        lucroLiquido: finalFinancialData.lucroLiquido,
        ativoTotal: finalFinancialData.ativoTotal,
        ativoCirculante: finalFinancialData.ativoCirculante,
        caixa: finalFinancialData.caixa,
        totalDivida: finalFinancialData.totalDivida,
        patrimonioLiquido: finalFinancialData.patrimonioLiquido,
        
        // === DIVIDENDOS ===
        dividendYield12m: finalFinancialData.dividendYield12m,
        
        // === METADADOS ===
        dataSource: finalFinancialData.dataSource
      }
    });
    
    // Log dos principais indicadores
    const indicators = [];
    if (finalFinancialData.pl) indicators.push(`P/L=${finalFinancialData.pl}`);
    if (finalFinancialData.roe) indicators.push(`ROE=${(finalFinancialData.roe * 100).toFixed(2)}%`);
    if (finalFinancialData.dy) indicators.push(`DY=${(finalFinancialData.dy * 100).toFixed(2)}%`);
    if (finalFinancialData.psr) indicators.push(`PSR=${finalFinancialData.psr}`);
    if (finalFinancialData.cagrLucros5a) indicators.push(`CAGR-L=${(finalFinancialData.cagrLucros5a * 100).toFixed(1)}%`);
    if (finalFinancialData.cagrReceitas5a) indicators.push(`CAGR-R=${(finalFinancialData.cagrReceitas5a * 100).toFixed(1)}%`);
    if (finalFinancialData.crescimentoLucros) indicators.push(`Cresc-L=${(finalFinancialData.crescimentoLucros * 100).toFixed(1)}%`);
    if (finalFinancialData.crescimentoReceitas) indicators.push(`Cresc-R=${(finalFinancialData.crescimentoReceitas * 100).toFixed(1)}%`);
    
    console.log(`✅ ${ticker}: ${indicators.join(', ')}`);
    
  } catch (error: any) {
    console.error(`❌ 2 Erro ao processar empresa ${ticker}:`, error.message);
  }
}

// Função para processar tickers específicos
async function processSpecificTickers(tickers: string[]): Promise<void> {
  console.log(`📦 Processando ${tickers.length} tickers especificados`);
  
  // Processar em lotes de 3 empresas paralelas (API local, pode ser mais agressivo)
  const batchSize = 3;
  const concurrencyManager = new ConcurrencyManager(batchSize);
  
  console.log(`🔄 Processando ${tickers.length} tickers em lotes de ${batchSize} paralelos\n`);
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchStartTime = Date.now();
    
    console.log(`📦 Lote ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`);
    
    // Processar lote em paralelo
    const batchPromises = batch.map((ticker, batchIndex) => 
      concurrencyManager.execute(async () => {
        const tickerStartTime = Date.now();
        
        try {
          console.log(`🏢 [${i + batchIndex + 1}/${tickers.length}] Processando ${ticker}...`);
          
          // Processar empresa com timeout
          await executeWithTimeout(
            () => processCompany(ticker),
            60000 // 1 minuto timeout por ticker (API local é mais rápida)
          );
          
          const tickerTime = Date.now() - tickerStartTime;
          console.log(`✅ ${ticker} processado em ${Math.round(tickerTime / 1000)}s`);
          
          return { success: true, ticker, time: tickerTime };
          
        } catch (error: any) {
          console.error(`❌ Erro ao processar ticker ${ticker}:`, error.message);
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
    
    // Pequeno delay entre lotes
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// Função para descobrir tickers disponíveis no banco
async function getAvailableTickers(): Promise<string[]> {
  try {
    console.log('🔍 Buscando tickers disponíveis no banco...');
    
    const companies = await prisma.company.findMany({
      select: { ticker: true },
      orderBy: { ticker: 'asc' }
    });
    
    const tickers = companies.map(c => c.ticker);
    console.log(`📋 Encontrados ${tickers.length} tickers no banco`);
    
    return tickers;
    
  } catch (error: any) {
    console.error('❌ Erro ao buscar tickers:', error.message);
    return [];
  }
}

// Função principal
async function main() {
  const startTime = Date.now();
  console.log(`🚀 Iniciando fetch de dados do Fundamentus... [${new Date().toLocaleString('pt-BR')}]\n`);
  
  try {
    // Verificar argumentos
    const args = process.argv.slice(2);
    const tickers = args.map(t => t.toUpperCase()).filter(t => t.length > 0);
    
    if (tickers.length > 0) {
      console.log(`📋 Processando tickers especificados: ${tickers.join(', ')}`);
      await processSpecificTickers(tickers);
    } else {
      console.log('📋 Nenhum ticker especificado, buscando todos os disponíveis...');
      const availableTickers = await getAvailableTickers();
      
      if (availableTickers.length > 0) {
        // Processar apenas uma amostra para teste (primeiros 10)
        const sampleTickers = availableTickers; //.slice(0, 10);
        console.log(`📋 Processando amostra de ${sampleTickers.length} tickers: ${sampleTickers.join(', ')}`);
        await processSpecificTickers(sampleTickers);
      } else {
        console.log('⚠️  Nenhum ticker encontrado no banco');
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    console.log('\n✅ Execução concluída!');
    console.log(`⏱️  Tempo de processamento: ${minutes}m ${seconds}s`);
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

export { 
  main, 
  processCompany, 
  fetchFundamentusData, 
  convertFundamentusToFinancialData,
  calculateAndUpdateAllGrowthMetrics,
  calculateGrowthMetricsForYear,
  mergeFundamentusWithExistingData,
  processPriceOscillations,
  processQuarterlyFinancials,
  processSpecificTickers,
  getAvailableTickers
};
