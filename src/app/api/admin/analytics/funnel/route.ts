/**
 * API endpoint para dados de funis de conversão
 * Retorna métricas de conversão para funis pré-definidos
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação e permissões admin
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const funnelType = searchParams.get('type') || 'registration_to_ranking';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId'); // Filtro opcional por usuário

    // Datas padrão: últimos 30 dias
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const where: any = {
      timestamp: {
        gte: start,
        lte: end,
      },
      userId: userId ? userId : { not: null }, // Se userId fornecido, filtra por ele; senão apenas usuários logados
    };

    let funnel: {
      name: string;
      steps: Array<{
        name: string;
        eventType: string;
        page?: string;
        count: number;
        percentage: number;
      }>;
      totalUsers: number;
      conversionRate: number;
    };

    switch (funnelType) {
      case 'registration_to_ranking': {
        // Funnel: Primeiro Evento → Primeiro Ranking
        // Buscar usuários que tiveram primeiro evento no período e depois criaram ranking
        // @ts-ignore - Prisma Client será regenerado após migration
        const [firstEvents, rankingEvents] = await Promise.all([
          // Primeiro evento de cada usuário no período (aproximação de cadastro)
          prisma.userEvent.findMany({
            where: {
              ...where,
            },
            select: {
              userId: true,
              timestamp: true,
            },
            orderBy: {
              timestamp: 'asc',
            },
          }),
          // Usuários que criaram ranking no período
          // @ts-ignore - Prisma Client será regenerado após migration
          prisma.userEvent.findMany({
            where: {
              ...where,
              eventType: 'RANKING_CREATED',
            },
            select: {
              userId: true,
            },
            distinct: ['userId'],
          }),
        ]);

        // Encontrar primeiro evento de cada usuário
        const firstEventByUser = new Map<string, Date>();
        firstEvents.forEach((event: any) => {
          if (event.userId && !firstEventByUser.has(event.userId)) {
            firstEventByUser.set(event.userId, event.timestamp);
          }
        });

        // Filtrar usuários que tiveram primeiro evento no período
        const newUsers = Array.from(firstEventByUser.entries())
          .filter(([_, timestamp]) => timestamp >= start && timestamp <= end)
          .map(([userId]) => userId);

        const rankingUserIds = new Set(rankingEvents.map((e: any) => e.userId).filter(Boolean) as string[]);
        
        // Usuários novos que criaram ranking
        const newUsersWhoRanked = newUsers.filter(id => rankingUserIds.has(id));

        funnel = {
          name: 'Primeiro Acesso → Primeiro Ranking',
          steps: [
            {
              name: 'Primeiro Acesso',
              eventType: 'PAGE_VIEW',
              count: newUsers.length,
              percentage: 100,
            },
            {
              name: 'Primeiro Ranking',
              eventType: 'RANKING_CREATED',
              count: newUsersWhoRanked.length,
              percentage: newUsers.length > 0 
                ? (newUsersWhoRanked.length / newUsers.length) * 100 
                : 0,
            },
          ],
          totalUsers: newUsers.length,
          conversionRate: newUsers.length > 0 
            ? (newUsersWhoRanked.length / newUsers.length) * 100 
            : 0,
        };
        break;
      }

      case 'ranking_to_asset': {
        // Funnel: Ranking → Visualização de Ativo
        const [rankingEvents, assetViews] = await Promise.all([
          // @ts-ignore - Prisma Client será regenerado após migration
          prisma.userEvent.findMany({
            where: {
              ...where,
              eventType: 'RANKING_CREATED',
            },
            select: {
              userId: true,
              timestamp: true,
            },
          }),
          // @ts-ignore - Prisma Client será regenerado após migration
          prisma.userEvent.findMany({
            where: {
              ...where,
              eventType: 'ASSET_VIEWED',
            },
            select: {
              userId: true,
              timestamp: true,
            },
          }),
        ]);

        const rankingUserIds = new Set(rankingEvents.map(e => e.userId).filter(Boolean) as string[]);
        const assetViewUserIds = new Set(assetViews.map(e => e.userId).filter(Boolean) as string[]);
        
        // Usuários que criaram ranking E visualizaram ativo
        const rankingToAsset = Array.from(rankingUserIds).filter(id => assetViewUserIds.has(id));

        funnel = {
          name: 'Ranking → Visualização de Ativo',
          steps: [
            {
              name: 'Criou Ranking',
              eventType: 'RANKING_CREATED',
              count: rankingUserIds.size,
              percentage: 100,
            },
            {
              name: 'Visualizou Ativo',
              eventType: 'ASSET_VIEWED',
              count: rankingToAsset.length,
              percentage: rankingUserIds.size > 0 
                ? (rankingToAsset.length / rankingUserIds.size) * 100 
                : 0,
            },
          ],
          totalUsers: rankingUserIds.size,
          conversionRate: rankingUserIds.size > 0 
            ? (rankingToAsset.length / rankingUserIds.size) * 100 
            : 0,
        };
        break;
      }

      case 'asset_to_comparison': {
        // Funnel: Ativo → Comparação
        const [assetViews, comparisons] = await Promise.all([
          // @ts-ignore - Prisma Client será regenerado após migration
          prisma.userEvent.findMany({
            where: {
              ...where,
              eventType: 'ASSET_VIEWED',
            },
            select: {
              userId: true,
            },
            distinct: ['userId'],
          }),
          // @ts-ignore - Prisma Client será regenerado após migration
          prisma.userEvent.findMany({
            where: {
              ...where,
              eventType: 'COMPARISON_STARTED',
            },
            select: {
              userId: true,
            },
            distinct: ['userId'],
          }),
        ]);

        const assetViewUserIds = new Set(assetViews.map(e => e.userId).filter(Boolean) as string[]);
        const comparisonUserIds = new Set(comparisons.map(e => e.userId).filter(Boolean) as string[]);
        
        const assetToComparison = Array.from(assetViewUserIds).filter(id => comparisonUserIds.has(id));

        funnel = {
          name: 'Ativo → Comparação',
          steps: [
            {
              name: 'Visualizou Ativo',
              eventType: 'ASSET_VIEWED',
              count: assetViewUserIds.size,
              percentage: 100,
            },
            {
              name: 'Iniciou Comparação',
              eventType: 'COMPARISON_STARTED',
              count: assetToComparison.length,
              percentage: assetViewUserIds.size > 0 
                ? (assetToComparison.length / assetViewUserIds.size) * 100 
                : 0,
            },
          ],
          totalUsers: assetViewUserIds.size,
          conversionRate: assetViewUserIds.size > 0 
            ? (assetToComparison.length / assetViewUserIds.size) * 100 
            : 0,
        };
        break;
      }

      case 'comparison_to_backtest': {
        // Funnel: Comparação → Backtest
        const [comparisons, backtests] = await Promise.all([
          // @ts-ignore - Prisma Client será regenerado após migration
          prisma.userEvent.findMany({
            where: {
              ...where,
              eventType: 'COMPARISON_STARTED',
            },
            select: {
              userId: true,
            },
            distinct: ['userId'],
          }),
          // @ts-ignore - Prisma Client será regenerado após migration
          prisma.userEvent.findMany({
            where: {
              ...where,
              eventType: 'BACKTEST_RUN',
            },
            select: {
              userId: true,
            },
            distinct: ['userId'],
          }),
        ]);

        const comparisonUserIds = new Set(comparisons.map(e => e.userId).filter(Boolean) as string[]);
        const backtestUserIds = new Set(backtests.map(e => e.userId).filter(Boolean) as string[]);
        
        const comparisonToBacktest = Array.from(comparisonUserIds).filter(id => backtestUserIds.has(id));

        funnel = {
          name: 'Comparação → Backtest',
          steps: [
            {
              name: 'Iniciou Comparação',
              eventType: 'COMPARISON_STARTED',
              count: comparisonUserIds.size,
              percentage: 100,
            },
            {
              name: 'Executou Backtest',
              eventType: 'BACKTEST_RUN',
              count: comparisonToBacktest.length,
              percentage: comparisonUserIds.size > 0 
                ? (comparisonToBacktest.length / comparisonUserIds.size) * 100 
                : 0,
            },
          ],
          totalUsers: comparisonUserIds.size,
          conversionRate: comparisonUserIds.size > 0 
            ? (comparisonToBacktest.length / comparisonUserIds.size) * 100 
            : 0,
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Tipo de funil inválido' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      funnel,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });

  } catch (error) {
    console.error('Erro ao buscar dados de funil:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}

