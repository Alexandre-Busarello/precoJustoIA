/**
 * API endpoint para detalhes de eventos de um usuário específico
 * Retorna timeline completa de eventos do usuário
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Verificar autenticação e permissões admin
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { userId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '1000');

    // Datas opcionais
    const where: any = {
      userId,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Buscar eventos do usuário
    const [events, userInfo] = await Promise.all([
      // @ts-ignore - Prisma Client será regenerado após migration
      prisma.userEvent.findMany({
        where,
        select: {
          id: true,
          eventType: true,
          page: true,
          element: true,
          metadata: true,
          timestamp: true,
          sessionId: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
        },
      }),
    ]);

    if (!userInfo) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Agregar estatísticas
    const eventTypeCounts: Record<string, number> = {};
    const pageCounts: Record<string, number> = {};
    const sessions = new Set<string>();
    let totalTimeOnPage = 0;
    const firstEvent = events[events.length - 1];
    const lastEvent = events[0];

    events.forEach((event: any) => {
      // Contar tipos de eventos
      eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
      
      // Contar páginas visitadas
      pageCounts[event.page] = (pageCounts[event.page] || 0) + 1;
      
      // Sessões únicas
      sessions.add(event.sessionId);
      
      // Tempo na página
      if (event.eventType === 'TIME_ON_PAGE') {
        const metadata = event.metadata as any;
        if (metadata?.seconds) {
          totalTimeOnPage += metadata.seconds;
        }
      }
    });

    // Páginas mais visitadas
    const topPages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Features utilizadas
    const featuresUsed = events
      .filter((e: any) => e.eventType === 'FEATURE_USED')
      .map((e: any) => {
        const metadata = e.metadata as any;
        return metadata?.feature || 'unknown';
      });

    const uniqueFeatures = [...new Set(featuresUsed)];

    return NextResponse.json({
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        subscriptionTier: userInfo.subscriptionTier,
      },
      summary: {
        totalEvents: events.length,
        uniqueSessions: sessions.size,
        totalTimeOnPage: Math.round(totalTimeOnPage / 60), // Em minutos
        firstEvent: firstEvent?.timestamp,
        lastEvent: lastEvent?.timestamp,
        eventTypeCounts,
        topPages,
        featuresUsed: uniqueFeatures,
      },
      events: events.map((event: any) => ({
        id: event.id,
        eventType: event.eventType,
        page: event.page,
        element: event.element,
        metadata: event.metadata,
        timestamp: event.timestamp,
        sessionId: event.sessionId,
      })),
    });

  } catch (error) {
    console.error('Erro ao buscar eventos do usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}

