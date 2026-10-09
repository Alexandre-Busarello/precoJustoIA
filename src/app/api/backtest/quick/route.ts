import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQueryWithParams, safeTransaction } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';
import { BacktestService, type BacktestParams } from '@/lib/backtest-service';
import { upsertBacktestConfig } from '@/lib/adaptive-backtest-service';
import { BacktestDataValidator } from '@/lib/backtest-data-validator';
import { PortfolioService } from '@/lib/portfolio-service';
import { PortfolioMetricsService } from '@/lib/portfolio-metrics-service';
import { checkAndRecordUsage, checkUsage } from '@/lib/usage-based-pricing-service';
import {
  cleanSourceLabel,
  droppedAssetsNote,
  fiiRejectionMessage,
  hasCustomSettings,
  isQuickSource,
  monthStartUtc,
  normalizeTickers,
  normalizeWeights,
  periodAdjustments,
  quickConfigName,
  quickPeriod,
  quickSourceLabel,
  resolveQuickSettings,
  type QuickBacktestSource,
} from '@/lib/backtest/quick-backtest';

export const maxDuration = 60;

/** Limite do plano gratuito (1 simulação rápida por mês), em usage-based-pricing-service. */
const FREE_FEATURE = 'backtest_run';
const MIN_MONTHS = 12;

interface QuickBacktestBody {
  tickers?: unknown;
  source?: unknown;
  sourceLabel?: unknown;
  weights?: unknown;
  overrides?: unknown;
  /** Carteira: os tickers e pesos vêm do servidor (pesos-alvo ou, sem eles, o peso atual das posições). */
  portfolioId?: unknown;
  /** `prepare` só grava a configuração (Personalizar antes); `run` (padrão) simula. */
  mode?: unknown;
}

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

function monthsBetweenUtc(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
}

/** Pesos da carteira: alocação-alvo; sem alvo definido, o peso atual de cada posição. */
async function portfolioComposition(portfolioId: string, userId: string) {
  const portfolio = await PortfolioService.getPortfolioConfig(portfolioId, userId);
  if (!portfolio) return null;
  const targets = portfolio.assets.filter((asset) => asset.targetAllocation > 0);
  if (targets.length > 0) {
    return { name: portfolio.name, tickers: targets.map((a) => a.ticker), weights: targets.map((a) => a.targetAllocation) };
  }
  const holdings = (await PortfolioMetricsService.getCurrentHoldings(portfolioId)).filter((h) => h.currentValue > 0);
  return { name: portfolio.name, tickers: holdings.map((h) => h.ticker), weights: holdings.map((h) => h.currentValue) };
}

/**
 * POST /api/backtest/quick — backtest de um clique. Padrões: últimos 5 anos completos, R$ 10.000 + R$ 1.000/mês,
 * rebalanceamento mensal e pesos iguais (ou os da carteira). Reaproveita uma configuração por usuário + origem +
 * ativos, ajusta o início ao histórico comum (sem bloquear) e devolve `{ configId, resultId, adjustments }`.
 * Premium: ilimitado e com ajustes. Grátis: 1 simulação por mês, só com os padrões, e o resultado vem na resposta.
 */
/** Usuários grátis com uma simulação em andamento nesta instância (bloqueia cliques paralelos no mesmo crédito). */
const freeRunsInFlight = new Set<string>();

export async function POST(request: NextRequest) {
  let lockedUserId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return fail(401, 'Entre na sua conta para simular.', { code: 'LOGIN_REQUIRED' });

    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return fail(401, 'Entre na sua conta para simular.', { code: 'LOGIN_REQUIRED' });

    let body: QuickBacktestBody;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'Requisição inválida.');
    }

    if (!isQuickSource(body.source)) return fail(400, 'Origem da simulação inválida.');
    const source: QuickBacktestSource = body.source;
    const mode = body.mode === 'prepare' ? 'prepare' : 'run';
    const isPremium = currentUser.isPremium;

    // Grátis: só a simulação rápida com os padrões, uma vez por mês
    if (!isPremium) {
      if (mode === 'prepare' || hasCustomSettings(body.overrides)) {
        return fail(403, 'Ajustar a configuração do backtest faz parte do Premium.', { code: 'PREMIUM_REQUIRED', upgradeUrl: '/planos' });
      }
      const usage = await checkUsage({ userId: currentUser.id, feature: FREE_FEATURE });
      if (!usage.allowed) {
        return fail(403, 'Você já usou o backtest grátis deste mês.', { code: 'FREE_LIMIT_REACHED', upgradeUrl: '/planos' });
      }
      if (freeRunsInFlight.has(currentUser.id)) {
        return fail(409, 'Já existe uma simulação em andamento. Aguarde o resultado.', { code: 'RUN_IN_PROGRESS' });
      }
      freeRunsInFlight.add(currentUser.id);
      lockedUserId = currentUser.id;
    }

    let rawTickers = body.tickers;
    let rawWeights = body.weights;
    let label = cleanSourceLabel(body.sourceLabel);
    if (source === 'carteira' && typeof body.portfolioId === 'string' && body.portfolioId) {
      const composition = await portfolioComposition(body.portfolioId, currentUser.id);
      if (!composition) return fail(404, 'Carteira não encontrada.');
      if (composition.tickers.length === 0) return fail(400, 'A carteira ainda não tem ativos para simular.');
      rawTickers = composition.tickers;
      rawWeights = composition.weights;
      label = cleanSourceLabel(composition.name);
    }

    const normalized = normalizeTickers(rawTickers);
    if (!normalized.ok) return fail(400, normalized.error);
    let tickers = normalized.tickers;
    let weights = Array.isArray(rawWeights) && rawWeights.length === tickers.length ? (rawWeights as unknown[]) : undefined;
    // normalizeTickers remove repetidos: pesos só valem quando a lista original já vinha sem repetição
    if (weights && Array.isArray(rawTickers) && rawTickers.length !== tickers.length) weights = undefined;

    const notes: string[] = [];

    // FIIs: a carteira simula sem eles; nas outras origens a simulação é recusada com uma mensagem legível
    const fiis = (
      await safeQueryWithParams(
        'quick-backtest-reject-fii',
        () => prisma.company.findMany({ where: { ticker: { in: tickers }, assetType: 'FII' }, select: { ticker: true } }),
        { tickers }
      )
    ).map((c) => c.ticker);
    if (fiis.length > 0) {
      if (source !== 'carteira' || fiis.length === tickers.length) return fail(400, fiiRejectionMessage(fiis), { code: 'FII' });
      const keep = tickers.map((t) => !fiis.includes(t));
      weights = weights?.filter((_, index) => keep[index]);
      tickers = tickers.filter((_, index) => keep[index]);
      notes.push(droppedAssetsNote(fiis, 'fii'));
    }

    const settings = resolveQuickSettings(isPremium ? body.overrides : undefined);
    const requested = quickPeriod(new Date(), settings.years);

    // Histórico disponível: ativos sem nenhuma cotação saem; o início vai para o primeiro mês comum
    const validator = new BacktestDataValidator();
    let assets = normalizeWeights(tickers, weights);
    let validation = await validator.validateBacktestData(assets, requested.startDate, requested.endDate);
    const withoutData = validation.assetsAvailability.filter((a) => a.totalMonths === 0).map((a) => a.ticker);
    if (withoutData.length === assets.length) {
      return fail(422, `Sem cotações para simular ${withoutData.join(', ')} no período.`, { code: 'NO_DATA' });
    }
    if (withoutData.length > 0) {
      const keep = tickers.map((t) => !withoutData.includes(t));
      weights = weights?.filter((_, index) => keep[index]);
      tickers = tickers.filter((_, index) => keep[index]);
      assets = normalizeWeights(tickers, weights);
      notes.push(droppedAssetsNote(withoutData, 'no-data'));
      validation = await validator.validateBacktestData(assets, requested.startDate, requested.endDate);
    }

    const startDate = monthStartUtc(validation.adjustedStartDate);
    const adjustedEnd = monthStartUtc(validation.adjustedEndDate);
    if (monthsBetweenUtc(startDate, adjustedEnd) + 1 < MIN_MONTHS) {
      return fail(422, 'O histórico em comum desses ativos tem menos de 12 meses, o mínimo para simular.', { code: 'SHORT_HISTORY' });
    }
    const adjustments = [
      ...notes,
      ...periodAdjustments({
        requestedStart: requested.startDate,
        requestedEnd: requested.endDate,
        adjustedStart: startDate,
        adjustedEnd,
        availability: validation.assetsAvailability,
      }),
    ];

    const sourceLabel = quickSourceLabel(source, tickers, label);
    const name = quickConfigName({ source, tickers, years: settings.years, sourceLabel: label });
    const params: BacktestParams = {
      assets,
      startDate,
      endDate: requested.endDate,
      initialCapital: settings.initialCapital,
      monthlyContribution: settings.monthlyContribution,
      rebalanceFrequency: settings.rebalanceFrequency,
    };

    const { id: configId } = await upsertBacktestConfig(currentUser.id, {
      name,
      description: [`Simulação rápida de ${sourceLabel}`, ...adjustments].join('. '),
      startDate: params.startDate,
      endDate: params.endDate,
      initialCapital: params.initialCapital,
      monthlyContribution: params.monthlyContribution,
      rebalanceFrequency: params.rebalanceFrequency,
      assets,
    });

    if (mode === 'prepare') return NextResponse.json({ configId, resultId: null, adjustments, sourceLabel });

    const backtestService = new BacktestService();
    const result = await backtestService.runBacktest(params);
    await safeTransaction('quick-backtest-save-result', () => backtestService.saveBacktestResult(configId, result), {
      affectedTables: ['backtest_results', 'backtest_transactions'],
    });
    const saved = await prisma.backtestResult.findFirst({
      where: { backtestId: configId },
      orderBy: { calculatedAt: 'desc' },
      select: { id: true },
    });

    if (!isPremium) {
      // Consome o backtest grátis do mês só depois de uma simulação concluída. Se outra requisição paralela já
      // consumiu o crédito, a checagem aqui falha e o resultado não é entregue (evita 2 simulações grátis).
      const recorded = await checkAndRecordUsage({ userId: currentUser.id, feature: FREE_FEATURE, resourceId: configId });
      if (!recorded.allowed) {
        return fail(403, 'Você já usou o backtest grátis deste mês.', { code: 'FREE_LIMIT_REACHED', upgradeUrl: '/planos' });
      }
      return NextResponse.json({
        configId,
        resultId: saved?.id ?? null,
        adjustments,
        sourceLabel,
        tier: 'FREE',
        result,
        config: {
          name,
          assets,
          startDate: params.startDate,
          endDate: params.endDate,
          initialCapital: params.initialCapital,
          monthlyContribution: params.monthlyContribution,
          rebalanceFrequency: params.rebalanceFrequency,
        },
      });
    }

    return NextResponse.json({ configId, resultId: saved?.id ?? null, adjustments, sourceLabel, tier: 'PREMIUM' });
  } catch (error) {
    console.error('Erro no backtest rápido:', error);
    return fail(500, 'Não foi possível simular agora. Tente de novo em instantes.');
  } finally {
    if (lockedUserId) freeRunsInFlight.delete(lockedUserId);
  }
}
