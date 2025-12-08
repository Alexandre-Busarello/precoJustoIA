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
import { checkPendingDividends, checkMarketWasOpen } from '@/lib/index-engine';
import { getTodayInBrazil } from '@/lib/market-status';

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
    // Usar getTodayInBrazil para garantir timezone correto
    const today = getTodayInBrazil();
    today.setHours(0, 0, 0, 0);
    
    const pendingDays: string[] = [];
    if (lastUpdateDate) {
      const lastDate = new Date(lastUpdateDate);
      lastDate.setHours(0, 0, 0, 0);
      
      // Calcular dias entre última atualização e hoje
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
        existingDates.map(h => {
          const d = new Date(h.date);
          d.setHours(0, 0, 0, 0);
          return d.toISOString().split('T')[0];
        })
      );
      
      // Verificar cada dia entre última atualização e hoje
      while (currentDate <= today) {
        // Normalizar data para comparação
        const checkDate = new Date(currentDate);
        checkDate.setHours(0, 0, 0, 0);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        // Verificar se já existe ponto histórico para este dia
        if (!existingDatesSet.has(dateStr)) {
          // Verificar se houve pregão neste dia (não apenas se é dia útil)
          const marketWasOpen = await checkMarketWasOpen(checkDate);
          if (marketWasOpen) {
            // Só adicionar como pendente se houve pregão e não há ponto histórico
            pendingDays.push(dateStr);
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }
    } else {
      // Se nunca foi atualizado, verificar todos os dias desde criação
      const createdAt = new Date(index.createdAt);
      createdAt.setHours(0, 0, 0, 0);
      
      let currentDate = new Date(createdAt);
      while (currentDate <= today) {
        // Verificar se houve pregão neste dia (não apenas se é dia útil)
        const marketWasOpen = await checkMarketWasOpen(currentDate);
        if (marketWasOpen) {
          pendingDays.push(currentDate.toISOString().split('T')[0]);
        }
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
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

