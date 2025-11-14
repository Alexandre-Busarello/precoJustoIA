/**
 * API endpoint para dados de mapa de calor
 * Retorna dados agregados de cliques por página e coordenadas
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
    const page = searchParams.get('page');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId'); // Filtro opcional por usuário

    // Datas padrão: últimos 30 dias
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Construir filtros
    const where: any = {
      eventType: 'CLICK',
      timestamp: {
        gte: start,
        lte: end,
      },
    };

    if (page) {
      where.page = page;
    }

    if (userId) {
      where.userId = userId;
    }

    // Buscar eventos de clique com metadados
    // @ts-ignore - Prisma Client será regenerado após migration
    const clickEvents = await prisma.userEvent.findMany({
      where,
      select: {
        id: true,
        element: true,
        page: true,
        metadata: true,
        timestamp: true,
        userId: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10000, // Limite para performance
    });

    // Agregar por elemento e coordenadas
    const elementCounts: Record<string, {
      count: number;
      visibleLabel?: string;
      selector: string;
    }> = {};
    const coordinateData: Array<{
      x: number;
      y: number;
      count: number;
      element: string;
      visibleLabel?: string;
    }> = [];

    clickEvents.forEach((event: any) => {
      const metadata = event.metadata as any;
      const element = event.element || 'unknown';
      const visibleLabel = metadata?.visibleLabel || null;

      // Contar cliques por elemento (agrupa por seletor)
      if (!elementCounts[element]) {
        elementCounts[element] = {
          count: 0,
          visibleLabel: visibleLabel || undefined,
          selector: element,
        };
      }
      elementCounts[element].count++;
      
      // Se não tinha label mas agora tem, atualiza
      if (!elementCounts[element].visibleLabel && visibleLabel) {
        elementCounts[element].visibleLabel = visibleLabel;
      }

      // Agregar coordenadas se disponíveis
      if (metadata?.x !== undefined && metadata?.y !== undefined) {
        // Agrupar coordenadas próximas (grid de 50x50px)
        const gridX = Math.floor(metadata.x / 50) * 50;
        const gridY = Math.floor(metadata.y / 50) * 50;

        const existing = coordinateData.find(
          d => d.x === gridX && d.y === gridY && d.element === element
        );

        if (existing) {
          existing.count++;
          // Atualiza label se não tinha
          if (!existing.visibleLabel && visibleLabel) {
            existing.visibleLabel = visibleLabel;
          }
        } else {
          coordinateData.push({
            x: gridX,
            y: gridY,
            count: 1,
            element,
            visibleLabel: visibleLabel || undefined,
          });
        }
      }
    });

    // Top elementos clicados
    const topElements = Object.entries(elementCounts)
      .map(([element, data]) => ({
        element: data.visibleLabel || element, // Prioriza label visível
        selector: element,
        visibleLabel: data.visibleLabel,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return NextResponse.json({
      page: page || 'all',
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalClicks: clickEvents.length,
      topElements,
      coordinateData: coordinateData.slice(0, 1000), // Limitar para performance
    });

  } catch (error) {
    console.error('Erro ao buscar dados de heatmap:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}

