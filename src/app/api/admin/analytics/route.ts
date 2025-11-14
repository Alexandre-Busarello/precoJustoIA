/**
 * API endpoint para estatísticas gerais de analytics
 * Retorna métricas agregadas de uso da aplicação
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId'); // Filtro opcional por usuário

    // Datas padrão: últimos 30 dias
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Construir filtro base
    const baseWhere: any = {
      timestamp: {
        gte: start,
        lte: end,
      },
    };

    // Adicionar filtro de usuário se fornecido
    if (userId) {
      baseWhere.userId = userId;
    }

    // Métricas gerais
    const [
      totalEvents,
      uniqueUsers,
      uniqueSessions,
      pageViews,
      topPages,
      topEvents,
      topAssets,
      dailyActiveUsers,
      monthlyActiveUsers,
    ] = await Promise.all([
      // Total de eventos no período
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.count({
        where: baseWhere,
      }),

      // Usuários únicos (ignora filtro de userId se aplicado)
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.groupBy({
        by: ['userId'],
        where: {
          ...baseWhere,
          userId: userId ? userId : { not: null },
        },
      }).then(results => results.length),

      // Sessões únicas
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.groupBy({
        by: ['sessionId'],
        where: baseWhere,
      }).then(results => results.length),

      // Total de page views
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.count({
        where: {
          ...baseWhere,
          eventType: 'PAGE_VIEW',
        },
      }),

      // Top 10 páginas mais visitadas
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.groupBy({
        by: ['page'],
        where: {
          ...baseWhere,
          eventType: 'PAGE_VIEW',
        },
        _count: {
          page: true,
        },
        orderBy: {
          _count: {
            page: 'desc',
          },
        },
        take: 10,
      }).then(results => 
        results.map(r => ({
          page: r.page,
          count: r._count.page,
        }))
      ),

      // Top 10 tipos de eventos
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.groupBy({
        by: ['eventType'],
        where: baseWhere,
        _count: {
          eventType: true,
        },
        orderBy: {
          _count: {
            eventType: 'desc',
          },
        },
        take: 10,
      }).then(results =>
        results.map(r => ({
          eventType: r.eventType,
          count: r._count.eventType,
        }))
      ),

      // Top 10 ativos mais visualizados
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.findMany({
        where: {
          ...baseWhere,
          eventType: 'ASSET_VIEWED',
          metadata: {
            path: ['ticker'],
            not: null,
          },
        },
        select: {
          metadata: true,
        },
      }).then(events => {
        const tickerCounts: Record<string, number> = {};
        events.forEach((event: any) => {
          const ticker = (event.metadata as any)?.ticker;
          if (ticker) {
            tickerCounts[ticker] = (tickerCounts[ticker] || 0) + 1;
          }
        });
        return Object.entries(tickerCounts)
          .map(([ticker, count]) => ({ ticker, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      }),

      // DAU (Daily Active Users) - últimos 7 dias (ignora filtro de userId)
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.groupBy({
        by: ['userId'],
        where: {
          timestamp: {
            gte: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000),
            lte: end,
          },
          userId: userId ? userId : { not: null },
        },
      }).then(results => results.length),

      // MAU (Monthly Active Users) - últimos 30 dias (ignora filtro de userId)
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.groupBy({
        by: ['userId'],
        where: {
          timestamp: {
            gte: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000),
            lte: end,
          },
          userId: userId ? userId : { not: null },
        },
      }).then(results => results.length),
    ]);

    return NextResponse.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      metrics: {
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        pageViews,
        dailyActiveUsers: dailyActiveUsers,
        monthlyActiveUsers: monthlyActiveUsers,
      },
      topPages,
      topEvents,
      topAssets,
    });

  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}

