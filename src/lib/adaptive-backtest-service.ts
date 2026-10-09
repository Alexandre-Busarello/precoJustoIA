import { BacktestDataValidator, type BacktestDataValidation, type DataAvailability } from './backtest-data-validator';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/strategies/base-strategy';
import { dedupedDividendEvents, netAmount } from '@/lib/finance/dividends';
import {
  annualizedVolatility,
  cdiLevel,
  fetchBenchmarkData,
  priceLevel,
  returnBetween,
  sharpeRatio,
  simulatePeriods,
  toIsoDate,
  type BenchmarkDataPoint,
} from './benchmark-service';

// ===== INTERFACES BASE =====

export interface BacktestAssetInput {
  ticker: string;
  allocation: number;
  /**
   * @deprecated Ignorado pela simulação: os proventos vêm do histórico real (`DividendHistory`). Mantido apenas para
   * compatibilidade com quem ainda envia o campo.
   */
  averageDividendYield?: number | null;
}

export interface BacktestParams {
  assets: BacktestAssetInput[];
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
  /** Reinveste os proventos no mês seguinte (padrão) ou os mantém em caixa. */
  reinvestDividends?: boolean;
}

/** Premissas da simulação, exibidas junto do resultado. */
export interface BacktestAssumptions {
  /** Preços de fechamento ajustados só por eventos de capital (desdobramentos e grupamentos). */
  priceBasis: 'capital-adjusted-close';
  /** Proventos reais creditados pela data-com, reinvestidos no mês seguinte ou mantidos em caixa. */
  dividends: 'reinvested' | 'cash';
  /** JCP creditado líquido de IRRF (15% até 2025, 17,5% a partir de 2026). */
  jcpNetOfTax: boolean;
  /** Custo por operação (corretagem + emolumentos), fração do valor negociado. */
  tradingCostRate: number;
  /** Custos de operação somados no período, em reais. */
  totalTradingCosts: number;
  /** Taxa livre de risco do Sharpe: CDI do período (`null` no Sharpe quando o CDI não está disponível). */
  riskFree: 'cdi';
}

export interface BacktestResult {
  /** Retorno sobre o capital investido: (valor final − capital aportado) / capital aportado. */
  totalReturn: number;
  /** Retorno anualizado por cota (TWR), sem o efeito dos aportes. */
  annualizedReturn: number;
  volatility: number;
  /** Sharpe com o CDI do mesmo período. */
  sharpeRatio: number | null;
  maxDrawdown: number;
  positiveMonths: number;
  negativeMonths: number;
  totalInvested: number;
  finalValue: number;
  monthlyReturns: Array<{
    date: string;
    return: number;
    portfolioValue: number;
    contribution: number;
    /** Início do período de preços do mês (fechamento da compra), `YYYY-MM-DD`. Ausente em execuções antigas. */
    periodStart?: string;
    /** Fim do período de preços do mês (fechamento da avaliação), `YYYY-MM-DD`. Ausente em execuções antigas. */
    periodEnd?: string;
    /** Custos de operação do mês, em reais. Ausente em execuções antigas. */
    tradingCosts?: number;
    /** Proventos reais creditados no mês, em reais. Ausente em execuções antigas. */
    dividends?: number;
    /** Saldo com os mesmos aportes aplicados no CDI, no fim do período do mês. */
    cdiValue?: number;
    /** Saldo com os mesmos aportes aplicados no Ibovespa (índice de preço), no fim do período do mês. */
    ibovValue?: number;
  }>;
  assetPerformance: Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
    reinvestment: number;
    rebalanceAmount: number;
    averagePrice?: number;
    totalShares?: number;
    totalDividends?: number;
  }>;
  portfolioEvolution: Array<{
    date: string;
    value: number;
    holdings: Record<string, number>;
    monthlyReturn: number;
  }>;
  assumptions?: BacktestAssumptions;
}

export interface PricePoint {
  date: Date;
  /** Fechamento ajustado só por eventos de capital (base usada na simulação). */
  price: number;
  /** Fechamento ajustado por proventos e eventos de capital, como veio da fonte (só para referência). */
  adjustedClose: number;
}

export interface PortfolioSnapshot {
  date: Date;
  value: number;
  holdings: Map<string, number>;
  monthlyReturn: number;
  contribution: number;
  /**
   * Período coberto pelos preços do mês. As barras mensais vêm datadas no dia 1 com o fechamento do fim do mês:
   * a compra usa o fechamento do mês M e a avaliação o do mês seguinte. Usado para o CDI do Sharpe e o gráfico.
   */
  periodStart?: string;
  periodEnd?: string;
  /** Custos de operação do mês, em reais. */
  tradingCosts?: number;
  /** Proventos creditados na avaliação do mês, em reais. */
  dividends?: number;
}

/** Provento por ação já líquido (JCP sem IRRF) e na mesma base de ações da série de preços. */
export interface BacktestDividend {
  exDate: Date;
  amountPerShare: number;
}

// ===== INTERFACES ESTENDIDAS =====

export interface MonthlyAssetTransaction {
  month: number;
  date: Date;
  ticker: string;
  transactionType: 'CONTRIBUTION' | 'REBALANCE_BUY' | 'REBALANCE_SELL' | 'CASH_RESERVE' | 'CASH_CREDIT' | 'CASH_DEBIT' | 'DIVIDEND_PAYMENT' | 'DIVIDEND_REINVESTMENT' | 'PREVIOUS_CASH_USE'; // Tipo da transação
  contribution: number; // Valor aportado neste ativo neste mês (pode ser negativo para vendas)
  price: number; // Preço de compra/venda
  sharesAdded: number; // Quantidade de ações compradas (sempre inteiro, pode ser negativo)
  totalShares: number; // Total de ações após esta transação
  totalInvested: number; // Total investido neste ativo até agora
  cashReserved?: number; // Valor que ficou em caixa por não conseguir comprar ação inteira
  dividendAmount?: number; // Valor de dividendos recebidos (apenas para DIVIDEND_PAYMENT)
}

export interface MonthlyPortfolioHistory {
  month: number;
  date: Date;
  totalContribution: number;
  portfolioValue: number;
  cashBalance: number; // Saldo em caixa no final do mês
  totalDividendsReceived: number; // Total de dividendos recebidos no mês
  transactions: MonthlyAssetTransaction[];
  holdings: Array<{ ticker: string; shares: number; value: number; price: number }>; // Holdings no final do mês
}

export interface AdaptiveBacktestResult extends BacktestResult {
  dataValidation: BacktestDataValidation;
  dataQualityIssues: string[];
  effectiveStartDate: Date;
  effectiveEndDate: Date;
  actualInvestment: number;
  plannedInvestment: number;
  missedContributions: number;
  missedAmount: number;
  totalDividendsReceived: number; // Total de dividendos recebidos durante todo o período
  monthlyHistory: MonthlyPortfolioHistory[]; // Novo campo para histórico detalhado
  assumptions: BacktestAssumptions;
}

export interface SimulationResult {
  evolution: PortfolioSnapshot[];
  monthlyHistory: MonthlyPortfolioHistory[];
  totalDividendsReceived: number;
  totalTradingCosts: number;
}

// ===== PREMISSAS E FUNÇÕES PURAS =====

/** Corretagem + emolumentos por operação (compra ou venda): 0,03% do valor negociado. */
export const BACKTEST_TRADING_COST_RATE = 0.0003;

/**
 * Variação mínima do fator `adjustedClose / close` entre dois meses para tratá-la como evento de capital
 * (desdobramento ou grupamento). Proventos mexem no fator aos poucos; desdobramentos, de uma vez (2:1 = 100%).
 */
const CAPITAL_EVENT_STEP = 1.45;

export interface RawPriceRow {
  date: Date;
  close: number;
  adjustedClose: number;
}

/**
 * Proporção do evento de capital a partir do salto do fator: arredonda para a proporção inteira mais próxima
 * (2:1, 10:1, 1:10 …) quando o salto fica a até 10% dela, para não misturar o provento do mês no fator.
 */
function splitRatio(step: number): number {
  const whole = step >= 1 ? Math.round(step) : Math.round(1 / step);
  const ratio = step >= 1 ? whole : 1 / whole;
  return whole > 0 && Math.abs(step / ratio - 1) <= 0.1 ? ratio : step;
}

export interface CapitalAdjustedSeries {
  prices: PricePoint[];
  /** Fator que converte valores por ação da data para a base de ações mais recente. */
  factorAt: (date: Date) => number;
}

/**
 * Série de preços ajustada só por eventos de capital. O fechamento (`close`) da fonte normalmente já vem ajustado
 * por desdobramentos e grupamentos, mas não por proventos; o `adjustedClose` desconta os dois. Quando o fator entre
 * eles salta de um mês para o outro (desdobramento não refletido no `close`), o salto é aplicado aos preços
 * anteriores; as variações pequenas (proventos) são ignoradas, porque os proventos são creditados à parte.
 */
export function buildCapitalAdjustedSeries(rows: readonly RawPriceRow[]): CapitalAdjustedSeries {
  const sorted = rows
    .filter((row) => row.close > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const ratio = (row: RawPriceRow) => (row.adjustedClose > 0 ? row.adjustedClose / row.close : 1);

  // factors[i]: multiplicador da linha i para a base de ações mais recente
  const factors = new Array<number>(sorted.length).fill(1);
  for (let i = sorted.length - 2; i >= 0; i--) {
    const step = ratio(sorted[i + 1]) / ratio(sorted[i]);
    const isCapitalEvent = step >= CAPITAL_EVENT_STEP || step <= 1 / CAPITAL_EVENT_STEP;
    factors[i] = isCapitalEvent ? factors[i + 1] / splitRatio(step) : factors[i + 1];
  }

  const prices = sorted.map((row, i) => ({
    date: row.date,
    price: row.close * factors[i],
    adjustedClose: row.adjustedClose > 0 ? row.adjustedClose : row.close,
  }));

  const factorAt = (date: Date) => {
    // Fator do último mês iniciado até a data (a barra mensal cobre o mês inteiro)
    let factor = factors[0] ?? 1;
    for (let i = 0; i < sorted.length && sorted[i].date.getTime() <= date.getTime(); i++) factor = factors[i];
    return factor;
  };

  return { prices, factorAt };
}

/** Soma dos proventos por ação com data-com em `(after, until]` (comparação por dia, UTC). */
export function dividendsInWindow(events: readonly BacktestDividend[], after: Date, until: Date): number {
  const from = toIsoDate(after);
  const to = toIsoDate(until);
  let total = 0;
  for (const event of events) {
    const exDate = toIsoDate(event.exDate);
    if (exDate > from && exDate <= to) total += event.amountPerShare;
  }
  return total;
}

/** Último dia do mês (UTC, fim do dia). Uma barra mensal datada no dia 1 fecha no último pregão do mês. */
/**
 * Período de preços de um mês simulado (`YYYY-MM-DD`, fim exclusivo para o CDI). Sem as datas gravadas, usa o mês
 * seguinte ao da data do snapshot, que é o que as barras mensais (fechamento do fim do mês) representam.
 */
export function snapshotPeriod(snapshot: Pick<PortfolioSnapshot, 'date' | 'periodStart' | 'periodEnd'>): { start: string; end: string } {
  if (snapshot.periodStart && snapshot.periodEnd) return { start: snapshot.periodStart, end: snapshot.periodEnd };
  const d = snapshot.date;
  return {
    start: toIsoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))),
    end: toIsoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 1))),
  };
}

export interface BacktestBenchmarkSeries {
  cdiReturns: number[] | null;
  cdiValues: number[] | null;
  ibovValues: number[] | null;
}

/**
 * Benchmarks alinhados aos meses simulados (função pura, exportada para teste). Cada aporte (capital inicial no
 * primeiro mês + aporte mensal) entra no início do período do mês; o saldo é medido no fim do período.
 */
export function computeBenchmarkSeries(
  evolution: ReadonlyArray<Pick<PortfolioSnapshot, 'date' | 'periodStart' | 'periodEnd' | 'contribution'>>,
  initialCapital: number,
  cdiDaily: readonly BenchmarkDataPoint[],
  ibovDaily: readonly BenchmarkDataPoint[]
): BacktestBenchmarkSeries {
  const periods = evolution.map(snapshot => snapshotPeriod(snapshot));
  const flows = evolution.map((snapshot, index) => ({
    ...periods[index],
    amount: (index === 0 ? initialCapital : 0) + snapshot.contribution,
  }));

  let cdiReturns: number[] | null = null;
  let cdiValues: number[] | null = null;
  if (cdiDaily.length > 0) {
    const level = cdiLevel(cdiDaily);
    const returns = periods.map(p => returnBetween(level, p.start, p.end));
    cdiReturns = returns.every((value): value is number => value !== null) ? returns : null;
    cdiValues = simulatePeriods(level, flows);
  }
  const ibovValues = ibovDaily.length > 0 ? simulatePeriods(priceLevel(ibovDaily), flows) : null;
  return { cdiReturns, cdiValues, ibovValues };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

// ===== CONFIGURAÇÕES =====

export interface BacktestConfigInput {
  name: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: string;
  assets: Array<{ ticker: string; allocation: number }>;
}

const ALLOCATION_TOLERANCE = 0.00005; // targetAllocation é Decimal(5, 4)

function sameAssets(
  stored: Array<{ ticker: string; targetAllocation: unknown }>,
  wanted: Array<{ ticker: string; allocation: number }>
): boolean {
  if (stored.length !== wanted.length) return false;
  const byTicker = new Map(stored.map((asset) => [asset.ticker.toUpperCase(), Number(asset.targetAllocation)]));
  return wanted.every((asset) => {
    const allocation = byTicker.get(asset.ticker.toUpperCase());
    return allocation !== undefined && Math.abs(allocation - asset.allocation) <= ALLOCATION_TOLERANCE;
  });
}

/**
 * Grava a configuração do usuário reaproveitando uma existente com o mesmo nome e os mesmos ativos/pesos (atualiza
 * período, capital, aporte e frequência). Evita uma cópia nova a cada execução da mesma carteira.
 */
export async function upsertBacktestConfig(userId: string, input: BacktestConfigInput): Promise<{ id: string; reused: boolean }> {
  const { safeWrite } = await import('@/lib/prisma-wrapper');
  const name = input.name.trim();
  const fields = {
    description: input.description ?? null,
    startDate: input.startDate,
    endDate: input.endDate,
    initialCapital: input.initialCapital,
    monthlyContribution: input.monthlyContribution,
    rebalanceFrequency: input.rebalanceFrequency,
  };

  const candidates = await prisma.backtestConfig.findMany({
    where: { userId, name },
    include: { assets: { select: { ticker: true, targetAllocation: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const existing = candidates.find((config) => sameAssets(config.assets, input.assets));

  if (existing) {
    await safeWrite(
      'update-backtest-config-reuse',
      () => prisma.backtestConfig.update({ where: { id: existing.id }, data: fields }),
      ['backtest_configs']
    );
    return { id: existing.id, reused: true };
  }

  const created = await safeWrite(
    'save-backtest-config-adaptive',
    () =>
      prisma.backtestConfig.create({
        data: {
          userId,
          name,
          ...fields,
          assets: {
            create: input.assets.map((asset) => ({
              ticker: asset.ticker.toUpperCase(),
              targetAllocation: asset.allocation,
            })),
          },
        },
        select: { id: true },
      }),
    ['backtest_configs', 'backtest_assets']
  );
  return { id: created.id, reused: false };
}

// ===== SERVIÇO ADAPTATIVO =====

export class AdaptiveBacktestService {
  
  /**
   * Salva uma configuração de backtest no banco de dados (reaproveita uma igual do mesmo usuário)
   */
  async saveBacktestConfig(
    userId: string,
    params: BacktestParams,
    name?: string,
    description?: string
  ): Promise<string> {
    const now = new Date();
    const { id } = await upsertBacktestConfig(userId, {
      name: name || `Backtest ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`,
      description: description || `Simulação criada em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`,
      startDate: params.startDate,
      endDate: params.endDate,
      initialCapital: params.initialCapital,
      monthlyContribution: params.monthlyContribution,
      rebalanceFrequency: params.rebalanceFrequency,
      assets: params.assets.map(({ ticker, allocation }) => ({ ticker, allocation })),
    });
    return id;
  }
  
  /**
   * Salva o resultado de um backtest no banco de dados
   */
  async saveBacktestResult(configId: string, result: BacktestResult | AdaptiveBacktestResult): Promise<void> {
    const { safeWrite } = await import('@/lib/prisma-wrapper');
    // Criar novo resultado sempre (permitir múltiplos resultados por configuração)
    await safeWrite(
      'save-backtest-result-adaptive',
      () => prisma.backtestResult.create({
        data: {
          backtestId: configId,
          totalReturn: result.totalReturn,
          annualizedReturn: result.annualizedReturn,
          volatility: result.volatility,
          sharpeRatio: result.sharpeRatio,
          maxDrawdown: result.maxDrawdown,
          positiveMonths: result.positiveMonths,
          negativeMonths: result.negativeMonths,
          totalMonths: result.monthlyReturns.length,
          totalInvested: result.totalInvested,
          finalValue: result.finalValue,
          finalCashReserve: 'finalCashReserve' in result ? Number(result.finalCashReserve) : 0,
          totalDividendsReceived: 'totalDividendsReceived' in result ? Number(result.totalDividendsReceived) : 0,
          monthlyReturns: result.monthlyReturns as any,
          assetPerformance: result.assetPerformance as any,
          portfolioEvolution: result.portfolioEvolution as any
        }
      }),
      ['backtest_results', 'backtest_configs']
    );
    
    if ('monthlyHistory' in result && result.monthlyHistory) {
      console.log('💾 Salvando histórico de transações mensais...');
      console.log('📊 Total de meses no histórico:', result.monthlyHistory.length);
      
      // Primeiro, remover transações existentes para este backtest
      await safeWrite(
        'delete-backtest-transactions',
        () => prisma.backtestTransaction.deleteMany({
          where: { backtestId: configId }
        }),
        ['backtest_transactions']
      );
      
      // Preparar dados das transações
      const transactionData: any[] = [];
      for (const monthData of result.monthlyHistory) {
        for (const transaction of monthData.transactions) {
          const progressiveCashBalance = (transaction as any).cashBalance;
          
          transactionData.push({
            backtestId: configId,
            month: transaction.month,
            date: transaction.date,
            ticker: transaction.ticker,
            transactionType: transaction.transactionType,
            contribution: transaction.contribution,
            price: transaction.price,
            sharesAdded: transaction.sharesAdded,
            totalShares: transaction.totalShares,
            totalInvested: transaction.totalInvested,
            cashReserved: transaction.cashReserved || null,
            totalContribution: monthData.totalContribution,
            portfolioValue: monthData.portfolioValue,
            cashBalance: progressiveCashBalance !== undefined ? progressiveCashBalance : monthData.cashBalance
          });
        }
      }
      
      // Salvar todas as transações em lote
      if (transactionData.length > 0) {
        await safeWrite(
          'create-backtest-transactions',
          () => prisma.backtestTransaction.createMany({
            data: transactionData
          }),
          ['backtest_transactions']
        );
        console.log(`✅ ${transactionData.length} transações salvas com sucesso`);
      }
    }
  }
  
  /**
   * Executa backtesting com tratamento inteligente de dados faltantes
   */
  async runAdaptiveBacktest(params: BacktestParams): Promise<AdaptiveBacktestResult> {
    // 1. Validar dados disponíveis
    const validator = new BacktestDataValidator();
    const validation = await validator.validateBacktestData(
      params.assets,
      params.startDate,
      params.endDate
    );
    
    if (!validation.isValid) {
      throw new Error(`Dados insuficientes para realizar o backtesting: ${validation.globalWarnings.join(', ')}`);
    }
    
    // 2. Ajustar o período ao histórico disponível
    const adjustedParams = {
      ...params,
      startDate: validation.adjustedStartDate,
      endDate: validation.adjustedEndDate
    };
    
    // 3. Preços (ajustados só por eventos de capital) e proventos reais
    const tickers = params.assets.map(a => a.ticker);
    const { pricesData, dividendsData } = await this.getHistoricalData(tickers, adjustedParams.startDate, adjustedParams.endDate);
    
    // 4. Simulação
    const simulationResult = this.simulateAdaptivePortfolio(
      pricesData,
      adjustedParams,
      validation.assetsAvailability,
      dividendsData
    );
    
    // 5. Métricas, Sharpe com CDI e qualidade dos dados
    return this.calculateMetricsWithDataQuality(simulationResult, adjustedParams, validation, pricesData);
  }
  
  /** Margem após o fim do período: a avaliação do último mês usa a barra mensal seguinte. */
  private readonly END_MARGIN_DAYS = 45;

  /**
   * Busca os preços mensais (ajustados só por eventos de capital) e os proventos de `DividendHistory` do período.
   */
  private async getHistoricalData(
    tickers: string[],
    startDate: Date,
    endDate: Date
  ): Promise<{ pricesData: Map<string, PricePoint[]>; dividendsData: Map<string, BacktestDividend[]> }> {
    const endDateWithMargin = new Date(endDate);
    endDateWithMargin.setDate(endDateWithMargin.getDate() + this.END_MARGIN_DAYS);

    const [historicalData, dividendRows] = await Promise.all([
      prisma.historicalPrice.findMany({
        where: {
          company: { ticker: { in: tickers } },
          interval: '1mo',
          date: { gte: startDate, lte: endDateWithMargin }
        },
        select: { date: true, close: true, adjustedClose: true, company: { select: { ticker: true } } },
        orderBy: [{ company: { ticker: 'asc' } }, { date: 'asc' }]
      }),
      prisma.dividendHistory.findMany({
        where: {
          company: { ticker: { in: tickers } },
          exDate: { gte: startDate, lte: endDateWithMargin }
        },
        select: { exDate: true, paymentDate: true, amount: true, type: true, company: { select: { ticker: true } } },
        orderBy: { exDate: 'asc' }
      })
    ]);

    const pricesData = new Map<string, PricePoint[]>();
    const dividendsData = new Map<string, BacktestDividend[]>();

    for (const ticker of tickers) {
      const series = buildCapitalAdjustedSeries(
        historicalData
          .filter(d => d.company.ticker === ticker)
          .map(d => ({ date: d.date, close: toNumber(d.close) || 0, adjustedClose: toNumber(d.adjustedClose) || 0 }))
      );
      pricesData.set(ticker, series.prices);

      const events = dedupedDividendEvents(dividendRows.filter(row => row.company.ticker === ticker));
      dividendsData.set(
        ticker,
        events.map(event => ({ exDate: event.exDate, amountPerShare: netAmount(event) * series.factorAt(event.exDate) }))
      );
    }

    return { pricesData, dividendsData };
  }

  /**
   * Simula a carteira mês a mês.
   *
   * - Compras e vendas usam a barra mensal do mês (dia 1); a avaliação usa a barra seguinte (fim do mês).
   * - Proventos: cada ação mantida entre a compra e a avaliação recebe os proventos reais com data-com nesse
   *   intervalo (JCP líquido de IRRF). O valor entra no caixa na avaliação e, no mês seguinte, é reinvestido junto do
   *   aporte ou fica em caixa (`reinvestDividends: false`).
   * - Aportes de meses sem rebalanceamento compram os ativos abaixo do peso-alvo, sem vendas.
   * - Custos de 0,03% por operação são debitados do caixa.
   * - Retorno mensal por cota: valor final / (valor anterior + aporte do mês) − 1 (o aporte entra no início do mês).
   */
  simulateAdaptivePortfolio(
    pricesData: Map<string, PricePoint[]>,
    params: BacktestParams,
    assetsAvailability: DataAvailability[],
    dividendsData: Map<string, BacktestDividend[]> = new Map()
  ): SimulationResult {
    const reinvest = params.reinvestDividends !== false;
    const evolution: PortfolioSnapshot[] = [];
    const monthlyHistory: MonthlyPortfolioHistory[] = [];
    let currentHoldings = new Map<string, number>();
    let previousPortfolioValue = 0;
    let cashBalance = 0; // inclui os proventos mantidos em caixa
    let heldDividendCash = 0; // proventos mantidos em caixa (sem reinvestimento)
    let pendingDividends: MonthlyAssetTransaction[] = []; // creditados na avaliação, usados no mês seguinte
    let totalDividendsReceived = 0;
    let totalTradingCosts = 0;
    const today = new Date();

    const totalInvestedByAsset = new Map<string, number>();
    params.assets.forEach(asset => totalInvestedByAsset.set(asset.ticker, 0));

    const monthlyDates = this.generateMonthlyDatesAdaptive(params.startDate, params.endDate);
    const sum = (transactions: MonthlyAssetTransaction[]) => transactions.reduce((total, t) => total + t.contribution, 0);

    for (let i = 0; i < monthlyDates.length; i++) {
      const firstDayOfMonth = monthlyDates[i];
      const lastDayOfMonth = this.getLastDayOfMonth(firstDayOfMonth);
      const isFirstMonth = evolution.length === 0;
      const monthlyContribution = params.monthlyContribution;

      const availableAssets = this.getAvailableAssetsForDate(firstDayOfMonth, pricesData, assetsAvailability);
      if (availableAssets.length === 0) continue; // mês sem cotações: aporte perdido (contabilizado nas métricas)

      // 1. Proventos creditados na avaliação anterior
      const dividendTransactions = pendingDividends.map(t => ({ ...t, month: i }));
      const creditedDividends = sum(dividendTransactions);
      pendingDividends = [];
      const initialCashBalance = cashBalance;
      if (!reinvest) heldDividendCash += creditedDividends;
      const monthlyDividends = reinvest ? creditedDividends : 0;
      const investableCash = reinvest ? cashBalance : cashBalance + creditedDividends - heldDividendCash;

      // 2. Dinheiro novo: capital inicial (1º mês), aporte e proventos a reinvestir
      const initialCapital = isFirstMonth ? params.initialCapital : 0;
      const newMoney = initialCapital + monthlyContribution + monthlyDividends;

      // 3. Compras (e vendas, nos meses de rebalanceamento) com os preços do dia 1
      const allowSales = this.shouldRebalanceAdaptive(i, params.rebalanceFrequency);
      const rebalanceResult = this.rebalancePortfolioAdaptive(
        newMoney,
        this.adjustAllocationsForAvailableAssets(params.assets, availableAssets),
        pricesData,
        firstDayOfMonth,
        currentHoldings,
        totalInvestedByAsset,
        i,
        investableCash,
        monthlyContribution,
        monthlyDividends,
        initialCapital,
        allowSales
      );
      currentHoldings = rebalanceResult.newHoldings;
      cashBalance = rebalanceResult.finalCashBalance + heldDividendCash;
      totalTradingCosts += rebalanceResult.tradingCosts;

      // Saldo de caixa após cada transação (exibido no histórico)
      const allTransactions = [...dividendTransactions, ...rebalanceResult.transactions];
      let runningBalance = initialCashBalance;
      allTransactions.forEach((transaction, index) => {
        if (transaction.ticker === 'CASH' || transaction.transactionType === 'DIVIDEND_PAYMENT') {
          runningBalance += transaction.contribution; // créditos positivos, débitos negativos
        } else {
          runningBalance -= transaction.contribution;
        }
        if (index === allTransactions.length - 1) runningBalance = cashBalance; // inclui sobras e custos
        (transaction as MonthlyAssetTransaction & { cashBalance?: number }).cashBalance = runningBalance;
      });

      const holdingsArray: MonthlyPortfolioHistory['holdings'] = [];
      for (const [ticker, shares] of currentHoldings.entries()) {
        const purchasePrice = this.getPriceForDateAdaptive(pricesData.get(ticker) || [], firstDayOfMonth) || 0;
        holdingsArray.push({ ticker, shares, value: shares * purchasePrice, price: purchasePrice });
      }

      monthlyHistory.push({
        month: i,
        date: new Date(firstDayOfMonth),
        totalContribution: monthlyContribution,
        portfolioValue: newMoney,
        cashBalance,
        totalDividendsReceived: creditedDividends,
        transactions: allTransactions,
        holdings: holdingsArray
      });

      // 4. Avaliação no fim do mês e proventos do intervalo entre a compra e a avaliação
      let assetsValue = 0;
      let periodStartTime: number | null = null;
      let periodEndTime: number | null = null;
      for (const [ticker, shares] of currentHoldings.entries()) {
        if (shares <= 0) continue;
        const prices = pricesData.get(ticker) || [];
        const buyPoint = this.getPricePointForDateAdaptive(prices, firstDayOfMonth);
        const evalPoint = this.getPricePointForDateAdaptive(prices, lastDayOfMonth);
        const hasNewBar = !!buyPoint && !!evalPoint && evalPoint.date.getTime() > buyPoint.date.getTime();
        const price = hasNewBar ? evalPoint!.price : buyPoint?.price ?? 0;
        assetsValue += shares * price;

        if (buyPoint) {
          const start = endOfMonth(buyPoint.date).getTime();
          periodStartTime = periodStartTime === null ? start : Math.min(periodStartTime, start);
        }
        if (!hasNewBar) continue;
        const windowEnd = endOfMonth(evalPoint!.date);
        const end = Math.min(windowEnd.getTime(), today.getTime());
        periodEndTime = periodEndTime === null ? end : Math.max(periodEndTime, end);
        const perShare = dividendsInWindow(
          dividendsData.get(ticker) || [],
          endOfMonth(buyPoint!.date),
          windowEnd.getTime() < today.getTime() ? windowEnd : today
        );
        const amount = shares * perShare;
        if (amount >= 0.005) {
          pendingDividends.push({
            month: i,
            date: new Date(lastDayOfMonth),
            ticker,
            transactionType: 'DIVIDEND_PAYMENT',
            contribution: amount,
            price: perShare,
            sharesAdded: 0,
            totalShares: shares,
            totalInvested: 0,
            dividendAmount: amount
          });
        }
      }
      const monthDividends = sum(pendingDividends);
      totalDividendsReceived += monthDividends;
      const portfolioValueEndOfMonth = assetsValue + cashBalance + monthDividends;

      // 5. Retorno mensal por cota (aporte no início do mês)
      const base = isFirstMonth ? params.initialCapital + monthlyContribution : previousPortfolioValue + monthlyContribution;
      const monthlyReturn = base > 0 ? portfolioValueEndOfMonth / base - 1 : 0;

      // Período em datas de calendário: o CDI do dia d rende até d+1, então o período vai do dia seguinte ao
      // fechamento da compra ao dia seguinte ao fechamento da avaliação.
      const dayAfter = (time: number) => toIsoDate(new Date(time + 24 * 60 * 60 * 1000));
      const fallbackStart = endOfMonth(firstDayOfMonth).getTime();
      const periodStart = dayAfter(Math.min(periodStartTime ?? fallbackStart, today.getTime()));
      const periodEndCandidate = periodEndTime === null ? periodStart : dayAfter(periodEndTime);
      const periodEnd = periodEndCandidate > periodStart ? periodEndCandidate : periodStart;

      evolution.push({
        date: lastDayOfMonth,
        value: portfolioValueEndOfMonth,
        holdings: new Map(currentHoldings),
        monthlyReturn,
        contribution: monthlyContribution,
        periodStart,
        periodEnd,
        tradingCosts: rebalanceResult.tradingCosts,
        dividends: monthDividends
      });
      previousPortfolioValue = portfolioValueEndOfMonth;
    }

    // Proventos da última avaliação: entram no caixa final
    if (pendingDividends.length > 0 && monthlyHistory.length > 0) {
      const last = monthlyHistory[monthlyHistory.length - 1];
      for (const transaction of pendingDividends) {
        cashBalance += transaction.contribution;
        (transaction as MonthlyAssetTransaction & { cashBalance?: number }).cashBalance = cashBalance;
        last.transactions.push(transaction);
      }
      last.cashBalance = cashBalance;
      last.totalDividendsReceived += sum(pendingDividends);
    }

    return { evolution, monthlyHistory, totalDividendsReceived, totalTradingCosts };
  }
  
  
  /**
   * Verifica quais ativos têm dados disponíveis para uma data específica
   */
  private getAvailableAssetsForDate(
    date: Date,
    pricesData: Map<string, PricePoint[]>,
    assetsAvailability: DataAvailability[]
  ): string[] {
    const availableAssets: string[] = [];
    
    for (const asset of assetsAvailability) {
      if (asset.totalMonths === 0) continue; // Pular ativos sem dados
      
      const prices = pricesData.get(asset.ticker) || [];
      const hasPrice = prices.some(p => 
        Math.abs(p.date.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000 // 7 dias de tolerância
      );
      
      if (hasPrice) {
        availableAssets.push(asset.ticker);
      }
    }
    
    return availableAssets;
  }
  
  /**
   * Ajusta alocações quando nem todos os ativos estão disponíveis
   */
  private adjustAllocationsForAvailableAssets(
    originalAssets: Array<{ ticker: string; allocation: number }>,
    availableAssets: string[]
  ): Array<{ ticker: string; allocation: number }> {
    
    // Filtrar apenas ativos disponíveis
    const availableOriginalAssets = originalAssets.filter(
      asset => availableAssets.includes(asset.ticker)
    );
    
    if (availableOriginalAssets.length === 0) {
      return [];
    }
    
    // Calcular soma das alocações disponíveis
    const totalAvailableAllocation = availableOriginalAssets.reduce(
      (sum, asset) => sum + asset.allocation, 0
    );
    
    // Normalizar para somar 100%
    return availableOriginalAssets.map(asset => ({
      ticker: asset.ticker,
      allocation: asset.allocation / totalAvailableAllocation
    }));
  }
  
  /**
   * Rebalanceia carteira considerando apenas ativos disponíveis
   * @param newMoney - Dinheiro NOVO disponível (initial capital + monthly contribution + dividends)
   * @param allowSales - Em meses sem rebalanceamento, só compra com o caixa disponível (sem vendas)
   */
  private rebalancePortfolioAdaptive(
    newMoney: number,
    targetAssets: Array<{ ticker: string; allocation: number }>,
    pricesData: Map<string, PricePoint[]>,
    date: Date,
    previousHoldings: Map<string, number>,
    totalInvestedByAsset: Map<string, number>,
    monthIndex: number,
    cashBalance: number = 0,
    monthlyContribution: number = 1000,
    monthlyDividends: number = 0,
    initialCapital: number = 0,
    allowSales: boolean = true
  ): { newHoldings: Map<string, number>, transactions: MonthlyAssetTransaction[], finalCashBalance: number, tradingCosts: number } {
    const newHoldings = new Map<string, number>();
    const transactions: MonthlyAssetTransaction[] = [];
    const MIN_REBALANCE_VALUE = 100; // Valor mínimo para rebalancear
    let tradingCosts = 0;
    
    console.log(`🏦 GESTÃO CONTÁBIL DO MÊS:`);
    console.log(`   💰 Caixa anterior (sobras): R$ ${cashBalance.toFixed(2)}`);
    if (initialCapital > 0) {
      console.log(`   💰 Capital inicial: R$ ${initialCapital.toFixed(2)}`);
    }
    console.log(`   💰 Aporte mensal: R$ ${monthlyContribution.toFixed(2)}`);
    console.log(`   💎 Dividendos: R$ ${monthlyDividends.toFixed(2)}`);
    console.log(`   💰 Dinheiro novo: R$ ${newMoney.toFixed(2)}`)

    // CORREÇÃO: Calcular valor atual dos ativos existentes
    let currentAssetsValue = 0;
    for (const [ticker, shares] of previousHoldings.entries()) {
      const prices = pricesData.get(ticker) || [];
      const currentPrice = this.getPriceForDateAdaptive(prices, date);
      if (currentPrice && currentPrice > 0) {
        currentAssetsValue += shares * currentPrice;
      }
    }
    
    console.log(`   📊 Valor dos ativos atuais: R$ ${currentAssetsValue.toFixed(2)}`);
    
    // Caixa disponível = sobras anteriores + dinheiro novo
    let currentCash = cashBalance + newMoney;
    console.log(`   💰 Caixa total disponível: R$ ${currentCash.toFixed(2)}`);
    
    const newMoneyToInvest = initialCapital + monthlyContribution + monthlyDividends;

      console.log(`   🎯 DINHEIRO NOVO PARA INVESTIR: R$ ${newMoneyToInvest.toFixed(2)} (aportes + dividendos)`);
      console.log(`   💰 SOBRAS ANTERIORES: R$ ${cashBalance.toFixed(2)} (podem ficar no caixa)`);

      // DEBUG: Rastrear se todo o dinheiro novo está sendo investido
      if (monthIndex < 5) {
        console.log(`   🔍 DEBUG INVESTIMENTO: Deve investir R$ ${newMoneyToInvest.toFixed(2)} do total de R$ ${currentCash.toFixed(2)}`);
      }

    // Registrar crédito no caixa com saldo progressivo
    let progressiveCashBalance = cashBalance;
    
    if (initialCapital > 0) {
      // Primeiro mês: registrar capital inicial (se houver)
      progressiveCashBalance += initialCapital;
      transactions.push({
        month: monthIndex,
        date: new Date(date),
        ticker: 'CASH',
        transactionType: 'CASH_CREDIT',
        contribution: initialCapital, // Capital inicial
        price: 1,
        sharesAdded: 0,
        totalShares: 0,
        totalInvested: 0,
        cashReserved: initialCapital
      });
    }
    
    // Sempre registrar aporte mensal (inclusive no primeiro mês)
    if (monthlyContribution > 0) {
      progressiveCashBalance += monthlyContribution;
      transactions.push({
        month: monthIndex,
        date: new Date(date),
        ticker: 'CASH',
        transactionType: 'CASH_CREDIT',
        contribution: monthlyContribution, // Aporte mensal
        price: 1,
        sharesAdded: 0,
        totalShares: 0,
        totalInvested: 0,
        cashReserved: monthlyContribution
      });
    }

    // FASE 1: Calcular posições atuais e identificar vendas necessárias
    const currentPositions = new Map<string, { shares: number, value: number, price: number }>();
    let totalCurrentValue = 0; // Calcular valor real dos ativos atuais

    for (const asset of targetAssets) {
      const prices = pricesData.get(asset.ticker) || [];
      const currentPrice = this.getPriceForDateAdaptive(prices, date);
      const currentShares = Math.floor(previousHoldings.get(asset.ticker) || 0); // Garantir ações inteiras
      
      if (currentPrice && currentPrice > 0) {
        const currentValue = currentShares * currentPrice;
        currentPositions.set(asset.ticker, { shares: currentShares, value: currentValue, price: currentPrice });
        totalCurrentValue += currentValue; // Somar valor real dos ativos
      }
    }
    
    console.log(`📊 Valor atual dos ativos: R$ ${totalCurrentValue.toFixed(2)}`);

    // FASE 2: Calcular posições alvo e identificar vendas
    const targetPositions = new Map<string, { targetShares: number, targetValue: number, currentShares: number, price: number }>();
    
    // Valor total para alocação = valor dos ativos atuais + caixa disponível
    const totalValueForAllocation = currentAssetsValue + currentCash;
    console.log(`💰 Valor total para alocação (ativos: R$ ${currentAssetsValue.toFixed(2)} + caixa: R$ ${currentCash.toFixed(2)}): R$ ${totalValueForAllocation.toFixed(2)}`);
    
    for (const asset of targetAssets) {
      const prices = pricesData.get(asset.ticker) || [];
      const currentPrice = this.getPriceForDateAdaptive(prices, date);
      
      if (currentPrice && currentPrice > 0) {
        const position = currentPositions.get(asset.ticker);
        const currentShares = position ? position.shares : 0;
        
        const targetValue = totalValueForAllocation * asset.allocation;
        const targetShares = Math.floor(targetValue / currentPrice); // Ações inteiras apenas
        
        targetPositions.set(asset.ticker, {
          targetShares,
          targetValue,
          currentShares,
          price: currentPrice
        });
        
        if (monthIndex < 5) {
          console.log(`🎯 ${asset.ticker}: target ${targetShares} ações (R$ ${targetValue.toFixed(2)}) vs atual ${currentShares} ações`);
        }
      }
    }

    // FASE 3: Executar vendas de rebalanceamento (CRÉDITO no caixa)
    let totalSalesValue = 0;
    for (const [ticker, target] of targetPositions) {
      const sharesToSell = target.currentShares - target.targetShares;
      
      if (sharesToSell > 0 && allowSales) {
        const saleValue = sharesToSell * target.price;
        
        // Verificar se a venda atende o valor mínimo
        if (saleValue >= MIN_REBALANCE_VALUE) {
          // CRÉDITO: venda líquida do custo de operação
          const saleCost = saleValue * BACKTEST_TRADING_COST_RATE;
          tradingCosts += saleCost;
          currentCash += saleValue - saleCost;
          totalSalesValue += saleValue - saleCost;
          
          // Atualizar total investido (reduzir proporcionalmente)
          const currentTotalInvested = totalInvestedByAsset.get(ticker) || 0;
          const proportionSold = sharesToSell / target.currentShares;
          const investmentReduced = currentTotalInvested * proportionSold;
          totalInvestedByAsset.set(ticker, currentTotalInvested - investmentReduced);
          
          newHoldings.set(ticker, target.targetShares);
          
          transactions.push({
            month: monthIndex,
            date: new Date(date),
            ticker: ticker,
            transactionType: 'REBALANCE_SELL',
            contribution: -saleValue, // Negativo para venda
            price: target.price,
            sharesAdded: -sharesToSell, // Negativo para venda
            totalShares: target.targetShares,
            totalInvested: totalInvestedByAsset.get(ticker) || 0
          });
          
          console.log(`🔴 VENDA (CRÉDITO): ${ticker} - ${sharesToSell} ações por R$ ${target.price.toFixed(2)} = +R$ ${saleValue.toFixed(2)} → Caixa: R$ ${currentCash.toFixed(2)}`);
        } else {
          // Venda abaixo do mínimo - manter posição atual e acumular para futuro
          console.log(`⏳ VENDA ADIADA: ${ticker} - R$ ${saleValue.toFixed(2)} < R$ ${MIN_REBALANCE_VALUE} (mínimo)`);
          newHoldings.set(ticker, target.currentShares);
        }
      } else {
        // Manter posição atual se não há venda
        newHoldings.set(ticker, target.currentShares);
      }
    }

    // FASE 4: Comprar ativos com o caixa disponível (DÉBITO do caixa)
    console.log(`\n🛒 INICIANDO COMPRAS COM CAIXA DISPONÍVEL: R$ ${currentCash.toFixed(2)}`);
    
    // Determinar se houve rebalanceamento real (vendas) neste mês
    const hasRebalancingSales = totalSalesValue > 0;
    console.log(`🔄 Rebalanceamento com vendas: ${hasRebalancingSales ? 'SIM' : 'NÃO'} (vendas: R$ ${totalSalesValue.toFixed(2)})`);
    
      // CORREÇÃO: Rastrear separadamente o dinheiro por origem (4 fontes distintas)
      let remainingContributionCash = initialCapital + monthlyContribution; // Capital inicial + aporte mensal
    let remainingDividendCash = monthlyDividends; // Dividendos recebidos (separado!)
    let remainingRebalanceCash = totalSalesValue; // Dinheiro de vendas
    let remainingPreviousCash = cashBalance; // Sobras de meses anteriores
    
      console.log(`💰 Caixa separado por origem:`);
      console.log(`   🥇 PRIORIDADE 1 - Sobras anteriores: R$ ${remainingPreviousCash.toFixed(2)} (usar PRIMEIRO)`);
      console.log(`   🥈 PRIORIDADE 2 - Capital Próprio: R$ ${remainingContributionCash.toFixed(2)}`);
      console.log(`   🥉 PRIORIDADE 3 - Dividendos: R$ ${remainingDividendCash.toFixed(2)}`);
      console.log(`   4️⃣ PRIORIDADE 4 - Vendas: R$ ${remainingRebalanceCash.toFixed(2)}`);
      console.log(`   💰 Total disponível: R$ ${currentCash.toFixed(2)}`);
      
      // Verificar se a soma está correta
      const expectedTotal = remainingContributionCash + remainingDividendCash + remainingRebalanceCash + remainingPreviousCash;
      if (Math.abs(expectedTotal - currentCash) > 0.01) {
        console.log(`   ⚠️ ERRO: Soma não confere! ${expectedTotal.toFixed(2)} ≠ ${currentCash.toFixed(2)}`);
      }
      
      console.log(`   ℹ️ NOVA PRIORIDADE: Sobras antigas são usadas PRIMEIRO para evitar acúmulo de caixa parado`);
      
      // DEBUG: Rastrear sobras acumuladas
      let totalRoundingLeftovers = 0;
    
    // Comprar ativos na ordem de prioridade (maior diferença para o target)
    for (const [ticker, target] of targetPositions) {
      // CORREÇÃO: Usar previousHoldings como fonte da verdade para ações atuais
      const currentShares = newHoldings.get(ticker) ?? previousHoldings.get(ticker) ?? 0;
      const sharesToBuy = target.targetShares - currentShares;
      
      const priceWithCost = target.price * (1 + BACKTEST_TRADING_COST_RATE);
      if (sharesToBuy > 0 && currentCash >= priceWithCost) {
        // Calcular quantas ações consegue comprar com o caixa disponível (incluindo o custo de operação)
        const maxAffordableShares = Math.floor(currentCash / priceWithCost);
        const actualSharesToBuy = Math.min(sharesToBuy, maxAffordableShares);
        
        if (actualSharesToBuy > 0) {
          const newTotalShares = currentShares + actualSharesToBuy;
          
          newHoldings.set(ticker, newTotalShares);
          
          // LÓGICA CORRIGIDA: Separar por origem do dinheiro e tratar sobras
          const actualPurchaseValue = actualSharesToBuy * target.price; // Valor real que será gasto
          const plannedPurchaseValue = sharesToBuy * target.price; // Valor que queria gastar
          const leftoverFromRounding = plannedPurchaseValue - actualPurchaseValue; // Sobra por não conseguir comprar ações fracionárias
          
          // DÉBITO: valor efetivamente gasto mais o custo de operação
          const purchaseCost = actualPurchaseValue * BACKTEST_TRADING_COST_RATE;
          tradingCosts += purchaseCost;
          currentCash -= actualPurchaseValue + purchaseCost;
          
          // IMPORTANTE: As sobras de arredondamento permanecem no caixa (não são debitadas)
          if (leftoverFromRounding > 0.01) {
            totalRoundingLeftovers += leftoverFromRounding;
            console.log(`   💰 Sobra por arredondamento: R$ ${leftoverFromRounding.toFixed(2)} (acumulado: R$ ${totalRoundingLeftovers.toFixed(2)})`);
          }
          
          // Atualizar total investido
          const currentTotalInvested = totalInvestedByAsset.get(ticker) || 0;
          totalInvestedByAsset.set(ticker, currentTotalInvested + actualPurchaseValue);
          
          // LÓGICA CORRIGIDA: Separar por origem do dinheiro (4 fontes: capital próprio, dividendos, vendas, sobras anteriores)
          let contributionPart = 0;
          let dividendPart = 0;
          let rebalancePart = 0;
          let previousCashPart = 0;
          
          // CORREÇÃO: Nova prioridade - usar SOBRAS PRIMEIRO para não acumular caixa parado
          // Prioridade: sobras anteriores > capital próprio > dividendos > vendas
          const actualPurchaseValueForSplit = actualPurchaseValue; // Usar valor real, não planejado
          const plannedPreviousCashPart = Math.min(remainingPreviousCash, actualPurchaseValueForSplit);
          const remainingAfterPrevious = actualPurchaseValueForSplit - plannedPreviousCashPart;
          const plannedContributionPart = Math.min(remainingContributionCash, remainingAfterPrevious);
          const remainingAfterContribution = remainingAfterPrevious - plannedContributionPart;
          const plannedDividendPart = Math.min(remainingDividendCash, remainingAfterContribution);
          const remainingAfterDividend = remainingAfterContribution - plannedDividendPart;
          const plannedRebalancePart = Math.min(remainingRebalanceCash, remainingAfterDividend);
          
          // CORREÇÃO: Usar valores diretos sem proporções para evitar erros de arredondamento
          contributionPart = plannedContributionPart;
          dividendPart = plannedDividendPart;
          rebalancePart = plannedRebalancePart;
          previousCashPart = plannedPreviousCashPart;
          
          // Verificação de segurança: garantir que não gastamos mais do que temos
          const totalAllocated = contributionPart + dividendPart + rebalancePart + previousCashPart;
          if (Math.abs(totalAllocated - actualPurchaseValue) > 0.01) {
            console.log(`⚠️ AJUSTE DE ARREDONDAMENTO: ${ticker} - Diferença de R$ ${(totalAllocated - actualPurchaseValue).toFixed(2)}`);
            // Ajustar a maior parte para compensar diferenças de arredondamento
            if (contributionPart >= dividendPart && contributionPart >= rebalancePart && contributionPart >= previousCashPart) {
              contributionPart = actualPurchaseValue - dividendPart - rebalancePart - previousCashPart;
            } else if (dividendPart >= rebalancePart && dividendPart >= previousCashPart) {
              dividendPart = actualPurchaseValue - contributionPart - rebalancePart - previousCashPart;
            } else if (rebalancePart >= previousCashPart) {
              rebalancePart = actualPurchaseValue - contributionPart - dividendPart - previousCashPart;
            } else {
              previousCashPart = actualPurchaseValue - contributionPart - dividendPart - rebalancePart;
            }
          }
          
          // DÉBITO CORRETO: Debitar apenas o que foi efetivamente gasto de cada fonte
          remainingContributionCash -= contributionPart;
          remainingDividendCash -= dividendPart;
          remainingRebalanceCash -= rebalancePart;
          remainingPreviousCash -= previousCashPart;
          
          // DEBUG: Mostrar a diferença (na ordem de prioridade: previous > contribution > dividend > rebalance)
          const previousCashLeftover = plannedPreviousCashPart - previousCashPart;
          const contributionLeftover = plannedContributionPart - contributionPart;
          const dividendLeftover = plannedDividendPart - dividendPart;
          const rebalanceLeftover = plannedRebalancePart - rebalancePart;
          
          if (previousCashLeftover > 0.01) {
            console.log(`   🥇 Sobra de caixa anterior (P1): R$ ${previousCashLeftover.toFixed(2)}`);
          }
          if (contributionLeftover > 0.01) {
            console.log(`   🥈 Sobra de capital próprio (P2): R$ ${contributionLeftover.toFixed(2)}`);
          }
          if (dividendLeftover > 0.01) {
            console.log(`   🥉 Sobra de dividendos (P3): R$ ${dividendLeftover.toFixed(2)}`);
          }
          if (rebalanceLeftover > 0.01) {
            console.log(`   4️⃣ Sobra de vendas (P4): R$ ${rebalanceLeftover.toFixed(2)}`);
          }
          
          // CORREÇÃO: Criar transações com totalShares progressivo
          // NOVA ORDEM: previous cash > contribution > dividend > rebalance
          let runningTotalShares = currentShares;
          
          // 1. Usar caixa anterior PRIMEIRO (prioridade máxima)
          if (previousCashPart > 0) {
            const previousCashShares = Math.round((previousCashPart / actualPurchaseValue) * actualSharesToBuy);
            runningTotalShares += previousCashShares;
            
            transactions.push({
              month: monthIndex,
              date: new Date(date),
              ticker: ticker,
              transactionType: 'PREVIOUS_CASH_USE',
              contribution: previousCashPart,
              price: target.price,
              sharesAdded: previousCashShares,
              totalShares: runningTotalShares,
              totalInvested: totalInvestedByAsset.get(ticker) || 0,
              cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
            });
            
            console.log(`💰 USO CAIXA ANTERIOR (DÉBITO - PRIORIDADE 1): ${ticker} - ${previousCashShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${previousCashPart.toFixed(2)}`);
          }
          
          // 2. Usar capital próprio/aporte
          if (contributionPart > 0) {
            const previousCashShares = previousCashPart > 0 ? Math.round((previousCashPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const contributionShares = Math.round((contributionPart / actualPurchaseValue) * actualSharesToBuy);
            runningTotalShares += contributionShares;
            
            transactions.push({
              month: monthIndex,
              date: new Date(date),
              ticker: ticker,
              transactionType: 'CONTRIBUTION',
              contribution: contributionPart,
              price: target.price,
              sharesAdded: contributionShares,
              totalShares: runningTotalShares,
              totalInvested: totalInvestedByAsset.get(ticker) || 0,
              cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
            });
            
            console.log(`💰 APORTE (DÉBITO - PRIORIDADE 2): ${ticker} - ${contributionShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${contributionPart.toFixed(2)}`);
          }
          
          // 3. Usar dividendos
          if (dividendPart > 0) {
            const previousCashShares = previousCashPart > 0 ? Math.round((previousCashPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const contributionShares = contributionPart > 0 ? Math.round((contributionPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const dividendShares = Math.round((dividendPart / actualPurchaseValue) * actualSharesToBuy);
            runningTotalShares += dividendShares;
            
            transactions.push({
              month: monthIndex,
              date: new Date(date),
              ticker: ticker,
              transactionType: 'DIVIDEND_REINVESTMENT',
              contribution: dividendPart,
              price: target.price,
              sharesAdded: dividendShares,
              totalShares: runningTotalShares,
              totalInvested: totalInvestedByAsset.get(ticker) || 0,
              cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
            });
            
            console.log(`💎 DIVIDENDO REINVESTIDO (DÉBITO - PRIORIDADE 3): ${ticker} - ${dividendShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${dividendPart.toFixed(2)}`);
          }
          
          // 4. Usar vendas de rebalanceamento
          if (rebalancePart > 0) {
            const previousCashShares = previousCashPart > 0 ? Math.round((previousCashPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const contributionShares = contributionPart > 0 ? Math.round((contributionPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const dividendShares = dividendPart > 0 ? Math.round((dividendPart / actualPurchaseValue) * actualSharesToBuy) : 0;
            const rebalanceShares = actualSharesToBuy - previousCashShares - contributionShares - dividendShares;
            runningTotalShares += rebalanceShares;
            
            transactions.push({
              month: monthIndex,
              date: new Date(date),
              ticker: ticker,
              transactionType: 'REBALANCE_BUY',
              contribution: rebalancePart,
              price: target.price,
              sharesAdded: rebalanceShares,
              totalShares: runningTotalShares,
              totalInvested: totalInvestedByAsset.get(ticker) || 0,
              cashReserved: sharesToBuy > actualSharesToBuy ? (sharesToBuy - actualSharesToBuy) * target.price : undefined
            });
            
            console.log(`🔄 COMPRA (REBAL.) (DÉBITO - PRIORIDADE 4): ${ticker} - ${rebalanceShares} ações por R$ ${target.price.toFixed(2)} = -R$ ${rebalancePart.toFixed(2)}`);
          }
          
          console.log(`💰 → Caixa após compras: R$ ${currentCash.toFixed(2)} (gasto real: R$ ${actualPurchaseValue.toFixed(2)})`);
          
          // Se não conseguiu comprar todas as ações desejadas
          if (sharesToBuy > actualSharesToBuy) {
            const unspentValue = (sharesToBuy - actualSharesToBuy) * target.price;
            console.log(`💰 FALTOU CAIXA: R$ ${unspentValue.toFixed(2)} para comprar mais ${sharesToBuy - actualSharesToBuy} ações de ${ticker}`);
          }
        }
      }
    }

      // FASE 5: Saldo final e resumo contábil
      // CORREÇÃO CRÍTICA: As sobras de arredondamento JÁ ESTÃO no currentCash!
      // Porque só debitamos o valor efetivamente gasto, as sobras ficam automaticamente no caixa
      const totalLeftoverInPotsForCash = remainingContributionCash + remainingDividendCash + remainingRebalanceCash + remainingPreviousCash;
      
      // CORREÇÃO CRÍTICA: As sobras dos potes JÁ ESTÃO no currentCash
      // Não devemos somar novamente, isso causa dupla contagem
      const finalCashBalance = currentCash;
      
      console.log(`\n🏦 RESUMO CONTÁBIL DO MÊS:`);
      console.log(`   💰 Caixa após compras: R$ ${currentCash.toFixed(2)}`);
      console.log(`   💰 Sobras nos potes: R$ ${totalLeftoverInPotsForCash.toFixed(2)}`);
      console.log(`      💰 Capital Próprio: R$ ${remainingContributionCash.toFixed(2)}`);
      console.log(`      💎 Dividendos: R$ ${remainingDividendCash.toFixed(2)}`);
      console.log(`      🔄 Vendas: R$ ${remainingRebalanceCash.toFixed(2)}`);
      console.log(`      💰 Caixa anterior: R$ ${remainingPreviousCash.toFixed(2)}`);
      console.log(`   💰 Sobras de arredondamento: R$ ${totalRoundingLeftovers.toFixed(2)} (JÁ incluídas no caixa após compras)`);
      console.log(`   💰 Caixa final: R$ ${finalCashBalance.toFixed(2)} (sobras dos potes JÁ incluídas)`);
      console.log(`   💰 Caixa inicial: R$ ${cashBalance.toFixed(2)}`);
      if (initialCapital > 0) {
        console.log(`   💰 Capital inicial: +R$ ${initialCapital.toFixed(2)}`);
      }
      console.log(`   💰 Aporte mensal: +R$ ${monthlyContribution.toFixed(2)}`);
      console.log(`   💎 Dividendos: +R$ ${monthlyDividends.toFixed(2)}`);
      console.log(`   💰 Vendas: +R$ ${totalSalesValue.toFixed(2)}`);
      
      // Calcular total de créditos incluindo capital inicial no primeiro mês e dividendos
      const totalCredits = initialCapital + monthlyContribution + monthlyDividends + totalSalesValue;
      console.log(`   💰 Total de créditos: R$ ${totalCredits.toFixed(2)}`);
      
      const totalPurchases = (cashBalance + totalCredits) - currentCash;
      console.log(`   💰 Total de débitos (compras): -R$ ${totalPurchases.toFixed(2)}`);
      console.log(`   💰 Saldo final: R$ ${finalCashBalance.toFixed(2)}`);
      console.log(`   ✅ Verificação: R$ ${cashBalance.toFixed(2)} + R$ ${totalCredits.toFixed(2)} - R$ ${totalPurchases.toFixed(2)} = R$ ${finalCashBalance.toFixed(2)} (sobras já incluídas)`);
      
      // Validar se a separação de caixa foi correta (4 fontes separadas)
      const totalContributionSource = initialCapital + monthlyContribution;
      const totalDividendSource = monthlyDividends;
      const totalUsedFromContribution = totalContributionSource - remainingContributionCash;
      const totalUsedFromDividends = totalDividendSource - remainingDividendCash;
      const totalUsedFromRebalance = totalSalesValue - remainingRebalanceCash;
      const totalUsedFromPrevious = cashBalance - remainingPreviousCash;
      
      console.log(`\n🔍 VALIDAÇÃO DA SEPARAÇÃO (4 FONTES - NOVA PRIORIDADE):`);
      console.log(`   🥇 P1 - Caixa anterior: R$ ${totalUsedFromPrevious.toFixed(2)} usado de R$ ${cashBalance.toFixed(2)} → Sobrou: R$ ${remainingPreviousCash.toFixed(2)}`);
      console.log(`   🥈 P2 - Capital próprio: R$ ${totalUsedFromContribution.toFixed(2)} usado de R$ ${totalContributionSource.toFixed(2)} → Sobrou: R$ ${remainingContributionCash.toFixed(2)}`);
      console.log(`   🥉 P3 - Dividendos: R$ ${totalUsedFromDividends.toFixed(2)} usado de R$ ${totalDividendSource.toFixed(2)} → Sobrou: R$ ${remainingDividendCash.toFixed(2)}`);
      console.log(`   4️⃣ P4 - Vendas: R$ ${totalUsedFromRebalance.toFixed(2)} usado de R$ ${totalSalesValue.toFixed(2)} → Sobrou: R$ ${remainingRebalanceCash.toFixed(2)}`);
      console.log(`   💰 Total de sobras nos potes: R$ ${totalLeftoverInPotsForCash.toFixed(2)} (JÁ incluídas no caixa)`);
      console.log(`   💰 Sobras de arredondamento: R$ ${totalRoundingLeftovers.toFixed(2)} (automáticas no caixa)`);
      console.log(`   ✅ PRIORIDADE: Sobras antigas usadas PRIMEIRO para evitar acúmulo de caixa parado`);

      // Não registrar débito consolidado - cada compra individual já debita do caixa
    
    // Registrar transação de caixa final se houver saldo
    if (finalCashBalance > 0.01) {
      transactions.push({
        month: monthIndex,
        date: new Date(date),
        ticker: 'CASH',
        transactionType: 'CASH_RESERVE',
        contribution: 0,
        price: 1,
        sharesAdded: 0,
        totalShares: 0,
        totalInvested: 0,
        cashReserved: finalCashBalance
      });
      
      console.log(`💰 CAIXA FINAL: R$ ${finalCashBalance.toFixed(2)} mantido para próximo mês`);
    }

    return { newHoldings, transactions, finalCashBalance, tradingCosts };
  }
  
  /**
   * Calcula métricas (com Sharpe sobre o CDI do período) e as informações de qualidade dos dados
   */
  private async calculateMetricsWithDataQuality(
    simulation: SimulationResult,
    params: BacktestParams,
    validation: BacktestDataValidation,
    pricesData: Map<string, PricePoint[]>
  ): Promise<AdaptiveBacktestResult> {
    const { evolution, monthlyHistory, totalTradingCosts } = simulation;
    const benchmarks = await this.getBenchmarkSeries(evolution, params);
    const baseResult = this.calculateMetricsAdaptive(evolution, params, pricesData, monthlyHistory, benchmarks.cdiReturns);
    // Saldo equivalente no CDI e no Ibovespa, gravado junto de cada mês (também vale para execuções reabertas)
    baseResult.monthlyReturns = baseResult.monthlyReturns.map((month, index) => ({
      ...month,
      ...(benchmarks.cdiValues ? { cdiValue: roundCents(benchmarks.cdiValues[index]) } : {}),
      ...(benchmarks.ibovValues ? { ibovValue: roundCents(benchmarks.ibovValues[index]) } : {}),
    }));
    
    // Aportes perdidos por falta de cotações
    const plannedMonths = this.getMonthsDifferenceAdaptive(params.startDate, params.endDate);
    const actualMonths = evolution.length;
    const missedContributions = Math.max(0, plannedMonths - actualMonths);
    const plannedInvestment = plannedMonths * params.monthlyContribution;
    const actualInvestment = actualMonths * params.monthlyContribution;
    const missedAmount = missedContributions * params.monthlyContribution;
    
    const dataQualityIssues: string[] = [];
    if (missedContributions > 0) {
      dataQualityIssues.push(
        `${missedContributions} aportes mensais foram perdidos devido à falta de dados`
      );
    }
    validation.assetsAvailability.forEach(asset => {
      if (asset.dataQuality === 'poor') {
        dataQualityIssues.push(`${asset.ticker}: Qualidade de dados ruim`);
      } else if (asset.dataQuality === 'fair') {
        dataQualityIssues.push(`${asset.ticker}: Qualidade de dados regular`);
      }
      if (asset.missingMonths > 0) {
        dataQualityIssues.push(
          `${asset.ticker}: ${asset.missingMonths} meses com dados faltantes`
        );
      }
    });
    
    return {
      ...baseResult,
      dataValidation: validation,
      dataQualityIssues,
      effectiveStartDate: validation.adjustedStartDate,
      effectiveEndDate: validation.adjustedEndDate,
      actualInvestment,
      plannedInvestment,
      missedContributions,
      missedAmount,
      totalDividendsReceived: baseResult.totalDividendsReceived,
      monthlyHistory,
      assumptions: {
        priceBasis: 'capital-adjusted-close',
        dividends: params.reinvestDividends === false ? 'cash' : 'reinvested',
        jcpNetOfTax: true,
        tradingCostRate: BACKTEST_TRADING_COST_RATE,
        totalTradingCosts,
        riskFree: 'cdi'
      }
    };
  }

  /**
   * Benchmarks do período simulado (BCB SGS 12 e Yahoo `^BVSP`), alinhados ao período de preços de cada mês:
   * - `cdiReturns`: CDI de cada mês (capitalização diária), para o Sharpe; `null` sem CDI;
   * - `cdiValues` / `ibovValues`: saldo de quem aplicasse os mesmos aportes no CDI ou no Ibovespa, no fim de cada mês.
   */
  private async getBenchmarkSeries(evolution: PortfolioSnapshot[], params: BacktestParams): Promise<BacktestBenchmarkSeries> {
    const empty: BacktestBenchmarkSeries = { cdiReturns: null, cdiValues: null, ibovValues: null };
    if (evolution.length === 0) return empty;
    const periods = evolution.map(snapshot => snapshotPeriod(snapshot));
    try {
      const start = periods.reduce((min, p) => (p.start < min ? p.start : min), periods[0].start);
      const end = periods.reduce((max, p) => (p.end > max ? p.end : max), periods[0].end);
      const { cdi, ibov } = await fetchBenchmarkData(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`));
      return computeBenchmarkSeries(evolution, params.initialCapital, cdi, ibov);
    } catch (error) {
      console.error('Erro ao buscar os benchmarks do backtest:', error);
      return empty;
    }
  }
  
  /**
   * Gera datas mensais usando o PRIMEIRO DIA de cada mês (12h UTC)
   * Estas datas são usadas para aportes e compras de ações
   * A avaliação da carteira é feita no ÚLTIMO DIA do mês
   */
  private generateMonthlyDatesAdaptive(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1, 12, 0, 0, 0));
    const endTime = endDate.getTime();
    while (current.getTime() <= endTime) {
      dates.push(new Date(current));
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
    return dates;
  }
  
  /**
   * Retorna o último dia do mês para uma data
   */
  private getLastDayOfMonth(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      0, // Dia 0 do próximo mês = último dia do mês atual
      23, 59, 59, 999
    ));
  }
  
  /**
   * Calcula diferença em meses (método herdado)
   */
  private getMonthsDifferenceAdaptive(startDate: Date, endDate: Date): number {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
           (endDate.getMonth() - startDate.getMonth()) + 1;
  }
  
  /**
   * Barra de preço para uma data, comparando por dia (UTC).
   * Prioriza: data exata > próxima barra (até 45 dias) > barra anterior (até 45 dias) > última disponível.
   */
  private getPricePointForDateAdaptive(prices: PricePoint[], targetDate: Date): PricePoint | null {
    const validPrices = prices.filter(p => p.price > 0);
    if (validPrices.length === 0) return null;

    const dayOf = (date: Date) => Date.parse(`${toIsoDate(date)}T00:00:00.000Z`);
    const target = dayOf(targetDate);
    const maxDiffMs = 45 * 24 * 60 * 60 * 1000;

    let next: PricePoint | null = null;
    let previous: PricePoint | null = null;
    for (const point of validPrices) {
      const diff = dayOf(point.date) - target;
      if (diff === 0) return point;
      if (diff > 0 && diff <= maxDiffMs && (!next || point.date < next.date)) next = point;
      if (diff < 0 && -diff <= maxDiffMs && (!previous || point.date > previous.date)) previous = point;
    }
    if (next) return next;
    if (previous) return previous;
    return validPrices.reduce((latest, point) => (point.date > latest.date ? point : latest));
  }

  /** Preço (ajustado só por eventos de capital) para uma data. */
  private getPriceForDateAdaptive(prices: PricePoint[], targetDate: Date): number | null {
    return this.getPricePointForDateAdaptive(prices, targetDate)?.price ?? null;
  }
  
  /**
   * Determina se deve rebalancear baseado na frequência (versão adaptativa)
   */
  private shouldRebalanceAdaptive(monthIndex: number, frequency: string): boolean {
    switch (frequency) {
      case 'monthly':
        return true;
      case 'quarterly':
        return monthIndex % 3 === 0;
      case 'yearly':
        return monthIndex % 12 === 0;
      default:
        return true;
    }
  }
  
  /**
   * Calcula as métricas do resultado.
   *
   * - Capital investido: capital inicial + aportes efetivamente creditados.
   * - Retorno total: sobre o capital investido (inclui proventos e caixa no valor final).
   * - Retorno anualizado, volatilidade e queda máxima: pela cota (retornos mensais), sem o efeito dos aportes.
   * - Sharpe: (retorno anualizado − CDI anualizado do mesmo período) / volatilidade; `null` sem CDI.
   */
  public calculateMetricsAdaptive(
    evolution: PortfolioSnapshot[],
    params: BacktestParams,
    pricesData?: Map<string, PricePoint[]>,
    monthlyHistory?: MonthlyPortfolioHistory[],
    cdiReturns?: number[] | null
  ) {
    if (!evolution || evolution.length === 0) {
      throw new Error('Nenhum dado de evolução disponível');
    }

    const monthlyReturns = evolution.map(snapshot => snapshot.monthlyReturn);
    const finalValue = evolution[evolution.length - 1].value;

    let totalInvested = 0;
    let totalDividendsReceived = 0;
    if (monthlyHistory) {
      for (const monthData of monthlyHistory) {
        for (const transaction of monthData.transactions) {
          if (transaction.transactionType === 'CASH_CREDIT') totalInvested += transaction.contribution;
          if (transaction.transactionType === 'DIVIDEND_PAYMENT') totalDividendsReceived += transaction.contribution;
        }
      }
    } else {
      totalInvested = params.initialCapital + (evolution.length * params.monthlyContribution);
    }
    const finalCashReserve = monthlyHistory && monthlyHistory.length > 0
      ? monthlyHistory[monthlyHistory.length - 1].cashBalance
      : 0;

    // Retorno sobre o capital investido
    const totalReturn = totalInvested > 0 ? (finalValue - totalInvested) / totalInvested : 0;

    // Cota: retorno acumulado, anualizado e queda máxima
    const quotas: number[] = [];
    let quota = 1;
    for (const r of monthlyReturns) {
      quota *= 1 + r;
      quotas.push(quota);
    }
    const months = monthlyReturns.length;
    const annualizedReturn = months > 0 && quota > 0 ? Math.pow(quota, 12 / months) - 1 : 0;
    const volatility = annualizedVolatility(monthlyReturns) ?? 0;
    const sharpe = cdiReturns && cdiReturns.length === months ? sharpeRatio(monthlyReturns, cdiReturns) : null;
    const maxDrawdown = this.calculateMaxDrawdownAdaptive([1, ...quotas]);

    const positiveMonths = monthlyReturns.filter(r => r > 0).length;
    const negativeMonths = monthlyReturns.filter(r => r < 0).length;

    const finalDate = evolution[evolution.length - 1].date;
    const assetPerformance = (monthlyHistory && pricesData) ? 
      this.calculateAssetPerformanceFromTransactions(params, monthlyHistory, pricesData, finalDate) : [];

    const monthlyReturnsFormatted = evolution.map((snapshot) => ({
      date: snapshot.date.toISOString().split('T')[0],
      return: snapshot.monthlyReturn,
      portfolioValue: snapshot.value,
      contribution: snapshot.contribution,
      ...(snapshot.periodStart && snapshot.periodEnd ? { periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd } : {}),
      ...(snapshot.tradingCosts !== undefined ? { tradingCosts: snapshot.tradingCosts } : {}),
      ...(snapshot.dividends !== undefined ? { dividends: snapshot.dividends } : {})
    }));

    const portfolioEvolutionFormatted = evolution.map(snapshot => ({
      date: snapshot.date.toISOString().split('T')[0],
      value: snapshot.value,
      holdings: Object.fromEntries(snapshot.holdings),
      monthlyReturn: snapshot.monthlyReturn
    }));

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio: sharpe,
      maxDrawdown,
      positiveMonths,
      negativeMonths,
      totalInvested,
      finalValue,
      finalCashReserve,
      totalDividendsReceived,
      monthlyReturns: monthlyReturnsFormatted,
      assetPerformance,
      portfolioEvolution: portfolioEvolutionFormatted
    };
  }
  
  private calculateMaxDrawdownAdaptive(values: number[]): number {
    let maxDrawdown = 0;
    let peak = values[0];

    for (const value of values) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = peak > 0 ? (peak - value) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }
  
  /**
   * Calcula performance baseado EXCLUSIVAMENTE nas transações (fonte da verdade)
   */
  private calculateAssetPerformanceFromTransactions(
    params: BacktestParams,
    monthlyHistory: MonthlyPortfolioHistory[],
    pricesData: Map<string, PricePoint[]>,
    finalDate: Date
  ): Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
    reinvestment: number;
    rebalanceAmount: number;
    averagePrice?: number;
    totalShares: number;
    totalDividends: number;
  }> {
    // Agregar dados por ativo baseado EXCLUSIVAMENTE nas transações
    const assetData = new Map<string, {
      allocation: number;
      contribution: number;        // Soma de CONTRIBUTION (dinheiro do bolso)
      reinvestment: number;        // Soma de PREVIOUS_CASH_USE + DIVIDEND_REINVESTMENT (sobras de caixa utilizadas)
      rebalanceAmount: number;     // Soma de REBALANCE_BUY - REBALANCE_SELL (lucro realizado reinvestido)
      totalPurchases: number;      // Soma apenas das COMPRAS (para preço médio correto)
      totalShares: number;         // Soma de sharesAdded
      totalDividends: number;      // Soma de DIVIDEND_PAYMENT
      finalShares: number;         // Shares finais
      totalSharesPurchased: number; // Total de ações compradas (para preço médio)
    }>();
    
    // Inicializar com os ativos da configuração
    params.assets.forEach(asset => {
      assetData.set(asset.ticker, {
        allocation: asset.allocation,
        contribution: 0,
        reinvestment: 0,
        rebalanceAmount: 0,
        totalPurchases: 0,
        totalShares: 0,
        totalDividends: 0,
        finalShares: 0,
        totalSharesPurchased: 0
      });
    });
    
    // Processar TODAS as transações
    for (const monthData of monthlyHistory) {
      for (const transaction of monthData.transactions) {
        const ticker = transaction.ticker;
        
        // Pular transações de CASH
        if (ticker === 'CASH') continue;
        
        const data = assetData.get(ticker);
        if (!data) continue;
        
        switch (transaction.transactionType) {
          case 'CONTRIBUTION':
            data.contribution += transaction.contribution;
            data.totalPurchases += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            data.totalSharesPurchased += transaction.sharesAdded;
            break;
            
          case 'DIVIDEND_REINVESTMENT':
            // Dividendos reinvestidos contam como "reinvestimento"
            data.reinvestment += transaction.contribution;
            data.totalPurchases += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            data.totalSharesPurchased += transaction.sharesAdded;
            break;
            
          case 'REBALANCE_BUY':
            // Compras de rebalanceamento contam como "rebalanceAmount" (lucro realizado reinvestido)
            data.rebalanceAmount += transaction.contribution;
            data.totalPurchases += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            data.totalSharesPurchased += transaction.sharesAdded;
            break;
            
          case 'PREVIOUS_CASH_USE':
            // Uso de sobras de caixa acumuladas de meses anteriores
            data.reinvestment += transaction.contribution;
            data.totalPurchases += transaction.contribution;
            data.totalShares += transaction.sharesAdded;
            data.totalSharesPurchased += transaction.sharesAdded;
            break;
            
          case 'REBALANCE_SELL':
            // Vendas: registrar o valor líquido mas NÃO afetar o preço médio das ações restantes
            data.rebalanceAmount += transaction.contribution; // contribution já é negativo
            data.totalShares += transaction.sharesAdded; // sharesAdded já é negativo
            // NÃO subtrair de totalPurchases - o preço médio das ações restantes não muda
            break;
            
          case 'DIVIDEND_PAYMENT':
            data.totalDividends += transaction.contribution;
            break;
        }
        
        // Atualizar shares finais (sempre usar o valor mais recente)
        data.finalShares = transaction.totalShares;
      }
    }
    
    const results: Array<{
      ticker: string;
      allocation: number;
      finalValue: number;
      totalReturn: number;
      contribution: number;
      reinvestment: number;
      rebalanceAmount: number;
      averagePrice?: number;
      totalShares: number;
      totalDividends: number;
    }> = [];
    
    // Gerar resultados baseados nos dados agregados das transações
    assetData.forEach((data, ticker) => {
      // Calcular valor final baseado no preço atual
      let finalValue = 0;
      if (data.finalShares > 0) {
        const prices = pricesData.get(ticker) || [];
        const currentPrice = this.getPriceForDateAdaptive(prices, finalDate);
        if (currentPrice && currentPrice > 0) {
          finalValue = data.finalShares * currentPrice;
        }
      }
      
      // Calcular preço médio correto: Usar apenas o custo das COMPRAS ÷ Quantidade em Custódia
      // Isso evita distorção quando há vendas significativas por rebalanceamento
      const averagePrice = data.finalShares > 0 ? data.totalPurchases / data.totalSharesPurchased : undefined;
      
      // CORREÇÃO: Calcular custo efetivo considerando lucros realizados
      // 
      // PROBLEMA ANTERIOR: 
      // - Ativo que valorizou 50% e vendeu metade por rebalanceamento mostrava retorno baixo
      // - Ativo que recebeu aportes de rebalanceamento mostrava retorno inflado
      // 
      // SOLUÇÃO: Considerar o custo efetivo ajustado por vendas realizadas
      // 
      // EXEMPLO:
      // - Aportei R$ 1.000 em PETR4
      // - PETR4 valorizou para R$ 1.500 
      // - Vendi R$ 500 por rebalanceamento (1/3 da posição)
      // - Restaram R$ 1.000 em PETR4 (2/3 da posição original)
      // - Custo efetivo das ações restantes = R$ 1.000 * (2/3) = R$ 667
      // - Retorno correto = (R$ 1.000 - R$ 667) / R$ 667 = 50%
      // - Lucro realizado = R$ 500 - R$ 333 = R$ 167 (já "pago")
      
      // Custo base: aportes diretos + reinvestimentos (sobras e dividendos)
      const baseCost = data.contribution + data.reinvestment;
      
      // Custo efetivo ajustado: 
      // - Se vendeu mais do que comprou no rebalanceamento = custo reduzido (lucro realizado)
      // - Se comprou mais do que vendeu no rebalanceamento = custo aumentado
      const netRebalanceCost = data.rebalanceAmount; // Já considera vendas (negativo) e compras (positivo)
      const effectiveCost = baseCost + Math.max(0, netRebalanceCost); // Só adiciona se houve compra líquida
      
      // Para ativos que tiveram vendas líquidas (lucro realizado), ajustar o custo proporcionalmente
      let adjustedCost = effectiveCost;
      if (netRebalanceCost < 0) {
        // Houve venda líquida - reduzir o custo proporcionalmente às ações vendidas
        const totalSharesEverOwned = data.totalSharesPurchased; // Total de ações já possuídas
        const currentShares = data.finalShares; // Ações atuais
        const sharesRatio = totalSharesEverOwned > 0 ? currentShares / totalSharesEverOwned : 1;
        
        // Custo ajustado = custo proporcional às ações restantes + lucro realizado já "pago"
        adjustedCost = (baseCost * sharesRatio) + Math.abs(netRebalanceCost);
        
        console.log(`📈 ${ticker} - Ajuste por venda: ${totalSharesEverOwned.toFixed(2)} → ${currentShares.toFixed(2)} ações (${(sharesRatio * 100).toFixed(1)}%)`);
        console.log(`   💰 Custo base: R$ ${baseCost.toFixed(2)} → Custo ajustado: R$ ${adjustedCost.toFixed(2)}`);
        console.log(`   💎 Lucro realizado: R$ ${Math.abs(netRebalanceCost).toFixed(2)}`);
      }
      
      // Calcular retorno baseado no custo efetivo ajustado
      let totalReturn = 0;
      if (adjustedCost > 0) {
        totalReturn = (finalValue + Math.abs(Math.min(0, netRebalanceCost)) - adjustedCost) / adjustedCost;
        console.log(`📈 Retorno corrigido: (${finalValue.toFixed(2)} + ${Math.abs(Math.min(0, netRebalanceCost)).toFixed(2)} - ${adjustedCost.toFixed(2)}) / ${adjustedCost.toFixed(2)} = ${(totalReturn * 100).toFixed(2)}%`);
      } else {
        totalReturn = 0;
        console.log(`📈 Sem custo base para calcular retorno`);
      }
      
      console.log(`📊 ${ticker} (BASEADO EM TRANSAÇÕES):`);
      console.log(`   💰 Contribuição (dinheiro do bolso): R$ ${data.contribution.toFixed(2)}`);
      console.log(`   🔄 Sobras utilizadas + Div. reinvestidos: R$ ${data.reinvestment.toFixed(2)}`);
      console.log(`   ⚖️ Rebalanceamento líquido: R$ ${data.rebalanceAmount.toFixed(2)}`);
      console.log(`   🛒 Total gasto em compras: R$ ${data.totalPurchases.toFixed(2)}`);
      console.log(`   💰 Custo base: R$ ${baseCost.toFixed(2)}`);
      console.log(`   💰 Custo efetivo ajustado: R$ ${adjustedCost.toFixed(2)}`);
      console.log(`   📊 Ações compradas: ${data.totalSharesPurchased.toFixed(2)}`);
      console.log(`   📈 Shares finais: ${data.finalShares}`);
      console.log(`   💎 Dividendos: R$ ${data.totalDividends.toFixed(2)}`);
      console.log(`   💲 Preço médio: R$ ${averagePrice?.toFixed(2) || 'N/A'}`);
      console.log(`   🎯 Valor final: R$ ${finalValue.toFixed(2)}`);
      
      console.log(`   📈 Retorno final: ${(totalReturn * 100).toFixed(2)}% (baseado em custo efetivo ajustado)`);
      
      results.push({
        ticker,
        allocation: data.allocation,
        finalValue,
        totalReturn,
        contribution: data.contribution,
        reinvestment: data.reinvestment,
        rebalanceAmount: data.rebalanceAmount,
        averagePrice,
        totalShares: data.finalShares,
        totalDividends: data.totalDividends
      });
    });
    
    return results;
  }
}
