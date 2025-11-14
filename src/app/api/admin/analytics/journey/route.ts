/**
 * API endpoint para análise de jornada do usuário
 * Retorna fluxos de navegação e caminhos mais comuns
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const minSessions = parseInt(searchParams.get('minSessions') || '5');

    // Datas padrão: últimos 30 dias
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const where: any = {
      eventType: 'PAGE_VIEW',
      timestamp: {
        gte: start,
        lte: end,
      },
    };

    if (userId) {
      where.userId = userId;
    }

    // Buscar todas as visualizações de página ordenadas por sessão e timestamp
    // @ts-ignore - Prisma Client será regenerado após migration
    const pageViews = await prisma.userEvent.findMany({
      where,
      select: {
        sessionId: true,
        page: true,
        timestamp: true,
        userId: true,
        referrer: true,
      },
      orderBy: [
        { sessionId: 'asc' },
        { timestamp: 'asc' },
      ],
    });

    // Agrupar por sessão
    const sessions: Record<string, Array<{
      page: string;
      timestamp: Date;
      referrer: string | null;
    }>> = {};

    pageViews.forEach(event => {
      if (!sessions[event.sessionId]) {
        sessions[event.sessionId] = [];
      }
      sessions[event.sessionId].push({
        page: event.page,
        timestamp: event.timestamp,
        referrer: event.referrer,
      });
    });

    // Construir caminhos (sequências de páginas)
    const paths: Record<string, number> = {};
    const transitions: Record<string, number> = {};
    const entryPages: Record<string, number> = {};
    const exitPages: Record<string, number> = {};
    const pageDurations: Record<string, number[]> = {};

    Object.values(sessions).forEach(session => {
      if (session.length === 0) return;

      // Página de entrada
      const entryPage = session[0].page;
      entryPages[entryPage] = (entryPages[entryPage] || 0) + 1;

      // Página de saída
      const exitPage = session[session.length - 1].page;
      exitPages[exitPage] = (exitPages[exitPage] || 0) + 1;

      // Construir caminho completo
      const path = session.map(p => p.page).join(' → ');
      paths[path] = (paths[path] || 0) + 1;

      // Transições entre páginas
      for (let i = 0; i < session.length - 1; i++) {
        const from = session[i].page;
        const to = session[i + 1].page;
        const transition = `${from} → ${to}`;
        transitions[transition] = (transitions[transition] || 0) + 1;

        // Calcular tempo entre páginas
        const duration = session[i + 1].timestamp.getTime() - session[i].timestamp.getTime();
        if (!pageDurations[from]) {
          pageDurations[from] = [];
        }
        pageDurations[from].push(duration);
      }
    });

    // Top caminhos
    const topPaths = Object.entries(paths)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Top transições
    const topTransitions = Object.entries(transitions)
      .map(([transition, count]) => ({ transition, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    // Top páginas de entrada e saída
    const topEntryPages = Object.entries(entryPages)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topExitPages = Object.entries(exitPages)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calcular tempo médio por página
    const avgPageDurations: Record<string, number> = {};
    Object.entries(pageDurations).forEach(([page, durations]) => {
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      avgPageDurations[page] = Math.round(avg / 1000); // Converter para segundos
    });

    // Filtrar caminhos com pelo menos minSessions ocorrências
    const commonPaths = topPaths.filter(p => p.count >= minSessions);

    return NextResponse.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalSessions: Object.keys(sessions).length,
      topPaths: commonPaths,
      topTransitions,
      topEntryPages,
      topExitPages,
      avgPageDurations,
    });

  } catch (error) {
    console.error('Erro ao buscar dados de jornada:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}

