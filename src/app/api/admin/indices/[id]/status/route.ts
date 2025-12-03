/**
 * API: Get Index Status
 * GET /api/admin/indices/[id]/status
 * 
 * Retorna status detalhado de um índice, incluindo:
 * - Última atualização
 * - Dias pendentes
 * - Status do cron job
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/user-service';
import { checkPendingDividends } from '@/lib/index-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação e admin
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id: indexId } = await params;

    // Buscar índice
    const index = await prisma.indexDefinition.findUnique({
      where: { id: indexId },
      include: {
        history: {
          orderBy: { date: 'desc' },
          take: 1
        },
        composition: {
          include: {
            // Incluir dados da empresa para verificar última atualização
          }
        }
      }
    });

    if (!index) {
      return NextResponse.json(
        { error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    // Buscar último ponto histórico
    const lastHistoryPoint = index.history[0] || null;
    const lastUpdateDate = lastHistoryPoint?.date || null;

    // Calcular dias pendentes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pendingDays: string[] = [];
    if (lastUpdateDate) {
      const lastDate = new Date(lastUpdateDate);
      lastDate.setHours(0, 0, 0, 0);
      
      // Calcular dias úteis entre última atualização e hoje
      let currentDate = new Date(lastDate);
      currentDate.setDate(currentDate.getDate() + 1); // Começar do dia seguinte
      
      // Buscar todos os pontos históricos de uma vez para otimizar
      const existingDates = await prisma.indexHistoryPoints.findMany({
        where: {
          indexId: index.id,
          date: {
            gte: currentDate,
            lte: today
          }
        },
        select: {
          date: true
        }
      });
      
      const existingDatesSet = new Set(
        existingDates.map(h => h.date.toISOString().split('T')[0])
      );
      
      while (currentDate <= today) {
        // Verificar se é dia útil (segunda a sexta)
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const dateStr = currentDate.toISOString().split('T')[0];
          if (!existingDatesSet.has(dateStr)) {
            pendingDays.push(dateStr);
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Se nunca foi atualizado, todos os dias desde criação são pendentes
      const createdAt = new Date(index.createdAt);
      createdAt.setHours(0, 0, 0, 0);
      
      let currentDate = new Date(createdAt);
      while (currentDate <= today) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          pendingDays.push(currentDate.toISOString().split('T')[0]);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Buscar checkpoint do cron job
    const checkpoint = await prisma.indexCronCheckpoint.findFirst({
      where: {
        jobType: { in: ['mark-to-market', 'screening'] },
        OR: [
          { indexId: index.id },
          { indexId: null } // Checkpoint global
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calcular total de dividendos recebidos desde o início
    const totalDividends = await prisma.indexHistoryPoints.aggregate({
      where: { indexId: index.id },
      _sum: {
        dividendsReceived: true
      }
    });

    // Verificar dividendos pendentes
    const { checkPendingDividends } = await import('@/lib/index-engine');
    const pendingDividendsInfo = await checkPendingDividends(index.id);

    // Status geral
    const isUpToDate = pendingDays.length === 0;
    const daysSinceLastUpdate = lastUpdateDate 
      ? Math.floor((today.getTime() - new Date(lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return NextResponse.json({
      success: true,
      index: {
        id: index.id,
        ticker: index.ticker,
        name: index.name
      },
      status: {
        isUpToDate,
        lastUpdateDate: lastUpdateDate ? new Date(lastUpdateDate).toISOString() : null,
        daysSinceLastUpdate,
        pendingDaysCount: pendingDays.length,
        pendingDays: pendingDays.slice(0, 30), // Limitar a 30 dias para não sobrecarregar
        hasMorePendingDays: pendingDays.length > 30,
        compositionCount: index.composition.length,
        totalHistoryPoints: await prisma.indexHistoryPoints.count({
          where: { indexId: index.id }
        }),
        totalDividendsReceived: totalDividends._sum.dividendsReceived 
          ? Number(totalDividends._sum.dividendsReceived) 
          : 0,
        pendingDividends: {
          hasPending: pendingDividendsInfo.hasPending,
          count: pendingDividendsInfo.pendingDividends.length,
          dividends: pendingDividendsInfo.pendingDividends.map(d => ({
            ticker: d.ticker,
            exDate: d.exDate.toISOString(),
            amount: d.amount
          }))
        }
      },
      cron: checkpoint ? {
        jobType: checkpoint.jobType,
        lastRunAt: checkpoint.updatedAt.toISOString(),
        processedCount: checkpoint.processedCount,
        totalCount: checkpoint.totalCount,
        hasErrors: (checkpoint.errors as string[]).length > 0,
        errors: checkpoint.errors as string[]
      } : null
    });
  } catch (error) {
    console.error('❌ [ADMIN INDICES] Error getting status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar status'
      },
      { status: 500 }
    );
  }
}

