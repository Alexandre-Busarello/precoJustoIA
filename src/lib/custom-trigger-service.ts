/**
 * CUSTOM TRIGGER SERVICE
 * 
 * Serviço para avaliar gatilhos customizados configurados pelos usuários
 */

import { prisma } from './prisma';

export interface TriggerConfig {
  // Filtros de screening básicos
  minPl?: number;
  maxPl?: number;
  minPvp?: number;
  maxPvp?: number;
  minScore?: number;
  maxScore?: number;
  // Alertas de preço
  priceReached?: number; // Preço atingiu X
  priceBelow?: number; // Preço abaixo de X
  priceAbove?: number; // Preço acima de X
  
  // Indicadores que oscilam com preço (ratios de preço)
  minForwardPE?: number;
  maxForwardPE?: number;
  minEarningsYield?: number;
  maxEarningsYield?: number;
  minDy?: number; // Dividend Yield
  maxDy?: number;
  minEvEbitda?: number;
  maxEvEbitda?: number;
  minEvEbit?: number;
  maxEvEbit?: number;
  minEvRevenue?: number;
  maxEvRevenue?: number;
  minPsr?: number; // P/S
  maxPsr?: number;
  minPAtivos?: number;
  maxPAtivos?: number;
  minPCapGiro?: number;
  maxPCapGiro?: number;
  minPEbit?: number;
  maxPEbit?: number;
  minLpa?: number; // LPA
  maxLpa?: number;
  minTrailingEps?: number;
  maxTrailingEps?: number;
  minVpa?: number; // VPA
  maxVpa?: number;
  minReceitaPorAcao?: number;
  maxReceitaPorAcao?: number;
  minCaixaPorAcao?: number;
  maxCaixaPorAcao?: number;
  
  // Indicadores de rentabilidade
  minRoe?: number;
  maxRoe?: number;
  minRoic?: number;
  maxRoic?: number;
  minRoa?: number;
  maxRoa?: number;
  
  // Indicadores de margem
  minMargemBruta?: number;
  maxMargemBruta?: number;
  minMargemEbitda?: number;
  maxMargemEbitda?: number;
  minMargemLiquida?: number;
  maxMargemLiquida?: number;
  
  // Indicadores de liquidez
  minLiquidezCorrente?: number;
  maxLiquidezCorrente?: number;
  minLiquidezRapida?: number;
  maxLiquidezRapida?: number;
  
  // Indicadores de endividamento
  minDividaLiquidaPl?: number;
  maxDividaLiquidaPl?: number;
  minDividaLiquidaEbitda?: number;
  maxDividaLiquidaEbitda?: number;
  minDebtToEquity?: number;
  maxDebtToEquity?: number;
  
  // Indicadores de eficiência
  minGiroAtivos?: number;
  maxGiroAtivos?: number;
  
  // Indicadores de crescimento
  minCagrLucros5a?: number;
  maxCagrLucros5a?: number;
  minCagrReceitas5a?: number;
  maxCagrReceitas5a?: number;
  minCrescimentoLucros?: number;
  maxCrescimentoLucros?: number;
  minCrescimentoReceitas?: number;
  maxCrescimentoReceitas?: number;
  
  // Indicadores de dividendos
  minPayout?: number;
  maxPayout?: number;
  minDividendYield12m?: number;
  maxDividendYield12m?: number;
  
  // Indicadores de performance
  minVariacao52Semanas?: number;
  maxVariacao52Semanas?: number;
  minRetornoAnoAtual?: number;
  maxRetornoAnoAtual?: number;
}

export interface TriggerEvaluation {
  monitorId: string;
  companyId: number;
  ticker: string;
  triggered: boolean;
  reasons: string[];
  companyData: Record<string, number | undefined>;
}

/**
 * Busca monitores ativos separados por prioridade (Premium primeiro)
 * Ordena por lastProcessedAt (mais antigos primeiro) para garantir loop de processamento
 */
export async function getMonitorsByPriority(): Promise<{
  premium: Array<{
    id: string;
    companyId: number;
    triggerConfig: TriggerConfig;
    company: { ticker: string };
    isAlertActive: boolean;
    lastProcessedAt: Date | null;
  }>;
  free: Array<{
    id: string;
    companyId: number;
    triggerConfig: TriggerConfig;
    company: { ticker: string };
    isAlertActive: boolean;
    lastProcessedAt: Date | null;
  }>;
}> {
  const { isUserPremium } = await import('./user-service');

  const monitors = await prisma.userAssetMonitor.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { lastProcessedAt: { sort: 'asc', nulls: 'first' } }, // Processar os mais antigos primeiro
    ],
    select: {
      id: true,
      companyId: true,
      triggerConfig: true,
      isAlertActive: true,
      lastProcessedAt: true,
      company: {
        select: {
          id: true,
          ticker: true,
        },
      },
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  const premium: typeof monitors = [];
  const free: typeof monitors = [];

  // Separar por status Premium
  for (const monitor of monitors) {
    const userIsPremium = await isUserPremium(monitor.user.id);
    if (userIsPremium) {
      premium.push(monitor);
    } else {
      free.push(monitor);
    }
  }

  return {
    premium: premium.map(m => ({
      id: m.id,
      companyId: m.companyId,
      triggerConfig: m.triggerConfig as TriggerConfig,
      company: m.company,
      isAlertActive: m.isAlertActive ?? false,
      lastProcessedAt: m.lastProcessedAt,
    })),
    free: free.map(m => ({
      id: m.id,
      companyId: m.companyId,
      triggerConfig: m.triggerConfig as TriggerConfig,
      company: m.company,
      isAlertActive: m.isAlertActive ?? false,
      lastProcessedAt: m.lastProcessedAt,
    })),
  };
}

/**
 * Busca todos os monitoramentos ativos e avalia se devem ser disparados
 * @deprecated Use getMonitorsByPriority() para processamento prioritário
 */
export async function checkCustomTriggers(): Promise<TriggerEvaluation[]> {
  const monitors = await prisma.userAssetMonitor.findMany({
    where: {
      isActive: true,
    },
    include: {
      company: {
        select: {
          id: true,
          ticker: true,
        },
      },
    },
  });

  const evaluations: TriggerEvaluation[] = [];

  for (const monitor of monitors) {
    try {
      const evaluation = await evaluateTrigger({
        id: monitor.id,
        companyId: monitor.companyId,
        triggerConfig: monitor.triggerConfig as TriggerConfig,
        company: monitor.company,
      });
      if (evaluation) {
        evaluations.push(evaluation);
      }
    } catch (error) {
      console.error(`Erro ao avaliar gatilho ${monitor.id}:`, error);
      // Continuar com outros monitoramentos mesmo se um falhar
    }
  }

  return evaluations;
}

/**
 * Avalia se um gatilho customizado foi disparado
 */
export async function evaluateTrigger(
  monitor: {
    id: string;
    companyId: number;
    triggerConfig: TriggerConfig;
    company: { ticker: string };
  }
): Promise<TriggerEvaluation | null> {
  const { triggerConfig, company } = monitor;
  const ticker = company.ticker;

  // Buscar dados financeiros mais recentes (todos os campos necessários)
  const financialData = await prisma.financialData.findFirst({
    where: {
      companyId: monitor.companyId,
    },
    orderBy: {
      year: 'desc',
    },
    select: {
      pl: true,
      pvp: true,
      forwardPE: true,
      earningsYield: true,
      dy: true,
      evEbitda: true,
      evEbit: true,
      evRevenue: true,
      psr: true,
      pAtivos: true,
      pCapGiro: true,
      pEbit: true,
      lpa: true,
      trailingEps: true,
      vpa: true,
      receitaPorAcao: true,
      caixaPorAcao: true,
      roe: true,
      roic: true,
      roa: true,
      margemBruta: true,
      margemEbitda: true,
      margemLiquida: true,
      liquidezCorrente: true,
      liquidezRapida: true,
      dividaLiquidaPl: true,
      dividaLiquidaEbitda: true,
      debtToEquity: true,
      giroAtivos: true,
      cagrLucros5a: true,
      cagrReceitas5a: true,
      crescimentoLucros: true,
      crescimentoReceitas: true,
      payout: true,
      dividendYield12m: true,
      variacao52Semanas: true,
      retornoAnoAtual: true,
    },
  });

  // Buscar score mais recente
  const snapshot = await prisma.assetSnapshot.findFirst({
    where: {
      companyId: monitor.companyId,
      isLatest: true,
    },
    select: {
      overallScore: true,
    },
  });

  // Buscar preço atual
  const { getTickerPrice } = await import('./quote-service');
  const priceData = await getTickerPrice(ticker);

  // Converter dados financeiros para números
  const toNumber = (value: any): number | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'object' && 'toNumber' in value) {
      return (value as any).toNumber();
    }
    return Number(value);
  };

  const companyData: Record<string, number | undefined> = {
    pl: toNumber(financialData?.pl),
    pvp: toNumber(financialData?.pvp),
    forwardPE: toNumber(financialData?.forwardPE),
    earningsYield: toNumber(financialData?.earningsYield),
    dy: toNumber(financialData?.dy),
    evEbitda: toNumber(financialData?.evEbitda),
    evEbit: toNumber(financialData?.evEbit),
    evRevenue: toNumber(financialData?.evRevenue),
    psr: toNumber(financialData?.psr),
    pAtivos: toNumber(financialData?.pAtivos),
    pCapGiro: toNumber(financialData?.pCapGiro),
    pEbit: toNumber(financialData?.pEbit),
    lpa: toNumber(financialData?.lpa),
    trailingEps: toNumber(financialData?.trailingEps),
    vpa: toNumber(financialData?.vpa),
    receitaPorAcao: toNumber(financialData?.receitaPorAcao),
    caixaPorAcao: toNumber(financialData?.caixaPorAcao),
    roe: toNumber(financialData?.roe),
    roic: toNumber(financialData?.roic),
    roa: toNumber(financialData?.roa),
    margemBruta: toNumber(financialData?.margemBruta),
    margemEbitda: toNumber(financialData?.margemEbitda),
    margemLiquida: toNumber(financialData?.margemLiquida),
    liquidezCorrente: toNumber(financialData?.liquidezCorrente),
    liquidezRapida: toNumber(financialData?.liquidezRapida),
    dividaLiquidaPl: toNumber(financialData?.dividaLiquidaPl),
    dividaLiquidaEbitda: toNumber(financialData?.dividaLiquidaEbitda),
    debtToEquity: toNumber(financialData?.debtToEquity),
    giroAtivos: toNumber(financialData?.giroAtivos),
    cagrLucros5a: toNumber(financialData?.cagrLucros5a),
    cagrReceitas5a: toNumber(financialData?.cagrReceitas5a),
    crescimentoLucros: toNumber(financialData?.crescimentoLucros),
    crescimentoReceitas: toNumber(financialData?.crescimentoReceitas),
    payout: toNumber(financialData?.payout),
    dividendYield12m: toNumber(financialData?.dividendYield12m),
    variacao52Semanas: toNumber(financialData?.variacao52Semanas),
    retornoAnoAtual: toNumber(financialData?.retornoAnoAtual),
    score: snapshot?.overallScore ? Number(snapshot.overallScore) : undefined,
    currentPrice: priceData?.price,
  };

  const reasons: string[] = [];
  let triggered = false;

  // Função auxiliar para avaliar indicadores min/max
  const evaluateIndicator = (
    configMin: number | undefined,
    configMax: number | undefined,
    value: number | undefined,
    indicatorName: string,
    formatValue: (v: number) => string = (v) => v.toFixed(2)
  ) => {
    if (configMin !== undefined && value !== undefined && value >= configMin) {
      triggered = true;
      reasons.push(`${indicatorName} (${formatValue(value)}) atingiu mínimo configurado (${formatValue(configMin)})`);
    }
    if (configMax !== undefined && value !== undefined && value <= configMax) {
      triggered = true;
      reasons.push(`${indicatorName} (${formatValue(value)}) atingiu máximo configurado (${formatValue(configMax)})`);
    }
  };

  // Avaliar filtros básicos
  evaluateIndicator(triggerConfig.minPl, triggerConfig.maxPl, companyData.pl, 'P/L');
  evaluateIndicator(triggerConfig.minPvp, triggerConfig.maxPvp, companyData.pvp, 'P/VP');
  evaluateIndicator(triggerConfig.minScore, triggerConfig.maxScore, companyData.score, 'Score', (v) => v.toFixed(1));

  // Avaliar indicadores que oscilam com preço
  evaluateIndicator(triggerConfig.minForwardPE, triggerConfig.maxForwardPE, companyData.forwardPE, 'Forward P/E');
  evaluateIndicator(triggerConfig.minEarningsYield, triggerConfig.maxEarningsYield, companyData.earningsYield, 'Earnings Yield', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minDy, triggerConfig.maxDy, companyData.dy, 'Dividend Yield', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minEvEbitda, triggerConfig.maxEvEbitda, companyData.evEbitda, 'EV/EBITDA');
  evaluateIndicator(triggerConfig.minEvEbit, triggerConfig.maxEvEbit, companyData.evEbit, 'EV/EBIT');
  evaluateIndicator(triggerConfig.minEvRevenue, triggerConfig.maxEvRevenue, companyData.evRevenue, 'EV/Revenue');
  evaluateIndicator(triggerConfig.minPsr, triggerConfig.maxPsr, companyData.psr, 'P/S');
  evaluateIndicator(triggerConfig.minPAtivos, triggerConfig.maxPAtivos, companyData.pAtivos, 'P/Ativos');
  evaluateIndicator(triggerConfig.minPCapGiro, triggerConfig.maxPCapGiro, companyData.pCapGiro, 'P/Cap. Giro');
  evaluateIndicator(triggerConfig.minPEbit, triggerConfig.maxPEbit, companyData.pEbit, 'P/EBIT');
  evaluateIndicator(triggerConfig.minLpa, triggerConfig.maxLpa, companyData.lpa, 'LPA');
  evaluateIndicator(triggerConfig.minTrailingEps, triggerConfig.maxTrailingEps, companyData.trailingEps, 'Trailing EPS');
  evaluateIndicator(triggerConfig.minVpa, triggerConfig.maxVpa, companyData.vpa, 'VPA');
  evaluateIndicator(triggerConfig.minReceitaPorAcao, triggerConfig.maxReceitaPorAcao, companyData.receitaPorAcao, 'Receita por Ação');
  evaluateIndicator(triggerConfig.minCaixaPorAcao, triggerConfig.maxCaixaPorAcao, companyData.caixaPorAcao, 'Caixa por Ação');

  // Avaliar indicadores de rentabilidade
  evaluateIndicator(triggerConfig.minRoe, triggerConfig.maxRoe, companyData.roe, 'ROE', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minRoic, triggerConfig.maxRoic, companyData.roic, 'ROIC', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minRoa, triggerConfig.maxRoa, companyData.roa, 'ROA', (v) => (v * 100).toFixed(2) + '%');

  // Avaliar indicadores de margem
  evaluateIndicator(triggerConfig.minMargemBruta, triggerConfig.maxMargemBruta, companyData.margemBruta, 'Margem Bruta', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minMargemEbitda, triggerConfig.maxMargemEbitda, companyData.margemEbitda, 'Margem EBITDA', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minMargemLiquida, triggerConfig.maxMargemLiquida, companyData.margemLiquida, 'Margem Líquida', (v) => (v * 100).toFixed(2) + '%');

  // Avaliar indicadores de liquidez
  evaluateIndicator(triggerConfig.minLiquidezCorrente, triggerConfig.maxLiquidezCorrente, companyData.liquidezCorrente, 'Liquidez Corrente');
  evaluateIndicator(triggerConfig.minLiquidezRapida, triggerConfig.maxLiquidezRapida, companyData.liquidezRapida, 'Liquidez Rápida');

  // Avaliar indicadores de endividamento
  evaluateIndicator(triggerConfig.minDividaLiquidaPl, triggerConfig.maxDividaLiquidaPl, companyData.dividaLiquidaPl, 'Dívida Líquida/PL');
  evaluateIndicator(triggerConfig.minDividaLiquidaEbitda, triggerConfig.maxDividaLiquidaEbitda, companyData.dividaLiquidaEbitda, 'Dívida Líquida/EBITDA');
  evaluateIndicator(triggerConfig.minDebtToEquity, triggerConfig.maxDebtToEquity, companyData.debtToEquity, 'Debt to Equity');

  // Avaliar indicadores de eficiência
  evaluateIndicator(triggerConfig.minGiroAtivos, triggerConfig.maxGiroAtivos, companyData.giroAtivos, 'Giro de Ativos');

  // Avaliar indicadores de crescimento
  evaluateIndicator(triggerConfig.minCagrLucros5a, triggerConfig.maxCagrLucros5a, companyData.cagrLucros5a, 'CAGR Lucros 5a', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minCagrReceitas5a, triggerConfig.maxCagrReceitas5a, companyData.cagrReceitas5a, 'CAGR Receitas 5a', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minCrescimentoLucros, triggerConfig.maxCrescimentoLucros, companyData.crescimentoLucros, 'Crescimento Lucros', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minCrescimentoReceitas, triggerConfig.maxCrescimentoReceitas, companyData.crescimentoReceitas, 'Crescimento Receitas', (v) => (v * 100).toFixed(2) + '%');

  // Avaliar indicadores de dividendos
  evaluateIndicator(triggerConfig.minPayout, triggerConfig.maxPayout, companyData.payout, 'Payout', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minDividendYield12m, triggerConfig.maxDividendYield12m, companyData.dividendYield12m, 'Dividend Yield 12m', (v) => (v * 100).toFixed(2) + '%');

  // Avaliar indicadores de performance
  evaluateIndicator(triggerConfig.minVariacao52Semanas, triggerConfig.maxVariacao52Semanas, companyData.variacao52Semanas, 'Variação 52 Semanas', (v) => (v * 100).toFixed(2) + '%');
  evaluateIndicator(triggerConfig.minRetornoAnoAtual, triggerConfig.maxRetornoAnoAtual, companyData.retornoAnoAtual, 'Retorno Ano Atual', (v) => (v * 100).toFixed(2) + '%');

  // Avaliar alertas de preço
  if (triggerConfig.priceReached !== undefined && companyData.currentPrice !== undefined) {
    // Considerar "atingiu" se estiver dentro de 1% do valor configurado
    const tolerance = triggerConfig.priceReached * 0.01;
    if (
      Math.abs(companyData.currentPrice - triggerConfig.priceReached) <= tolerance
    ) {
      triggered = true;
      reasons.push(`Preço (R$ ${companyData.currentPrice.toFixed(2)}) atingiu valor configurado (R$ ${triggerConfig.priceReached.toFixed(2)})`);
    }
  }

  if (triggerConfig.priceBelow !== undefined && companyData.currentPrice !== undefined) {
    if (companyData.currentPrice <= triggerConfig.priceBelow) {
      triggered = true;
      reasons.push(`Preço (R$ ${companyData.currentPrice.toFixed(2)}) está abaixo do valor configurado (R$ ${triggerConfig.priceBelow.toFixed(2)})`);
    }
  }

  if (triggerConfig.priceAbove !== undefined && companyData.currentPrice !== undefined) {
    if (companyData.currentPrice >= triggerConfig.priceAbove) {
      triggered = true;
      reasons.push(`Preço (R$ ${companyData.currentPrice.toFixed(2)}) está acima do valor configurado (R$ ${triggerConfig.priceAbove.toFixed(2)})`);
    }
  }

  if (!triggered) {
    return null;
  }

  return {
    monitorId: monitor.id,
    companyId: monitor.companyId,
    ticker,
    triggered,
    reasons,
    companyData,
  };
}

/**
 * Cria entrada na fila de relatórios para um gatilho customizado disparado
 */
export async function createQueueEntry(
  monitorId: string,
  evaluation: TriggerEvaluation
): Promise<string> {
  const queueEntry = await prisma.aIReportsQueue.create({
    data: {
      companyId: evaluation.companyId,
      reportType: 'CUSTOM_TRIGGER',
      triggerReason: {
        monitorId,
        reasons: evaluation.reasons,
        companyData: evaluation.companyData,
      },
      status: 'PENDING',
      priority: 0,
    },
  });

  // Atualizar lastTriggeredAt e marcar isAlertActive = true do monitoramento
  await prisma.userAssetMonitor.update({
    where: { id: monitorId },
    data: {
      lastTriggeredAt: new Date(),
      isAlertActive: true,
    },
  });

  return queueEntry.id;
}

