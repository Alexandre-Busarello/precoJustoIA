/**
 * API: Recalcular um dia específico do índice
 * POST /api/admin/indices/[id]/recalculate-day
 * 
 * Recalcula apenas o after market de um dia específico e garante que as contribuições batam com o dailyChange
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { updateIndexPoints } from '@/lib/index-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id: identifier } = await params;
    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Data não fornecida' },
        { status: 400 }
      );
    }

    // Buscar índice - aceita tanto ID (UUID) quanto ticker
    // Primeiro tenta como ID, depois como ticker
    let index = await prisma.indexDefinition.findUnique({
      where: { id: identifier },
      select: { id: true, ticker: true }
    });

    // Se não encontrou como ID, tenta como ticker
    if (!index) {
      index = await prisma.indexDefinition.findUnique({
        where: { ticker: identifier.toUpperCase() },
        select: { id: true, ticker: true }
      });
    }

    if (!index) {
      return NextResponse.json(
        { success: false, error: 'Índice não encontrado' },
        { status: 404 }
      );
    }

    // Validar formato da data e parsear corretamente (evitar problemas de timezone)
    let targetDate: Date;
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Parsear como data local (não UTC) para evitar problemas de timezone
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Data inválida' },
          { status: 400 }
        );
      }
      // Normalizar data (sem hora)
      targetDate.setHours(0, 0, 0, 0);
    }

    console.log(`🔄 [ADMIN RECALCULATE DAY] Recalculating day ${targetDate.toISOString().split('T')[0]} for index ${index.ticker}`);

    // Recalcular apenas o after market deste dia específico
    // skipCache=true para garantir preços atualizados do Yahoo Finance
    const success = await updateIndexPoints(index.id, targetDate, true, true);

    if (success) {
      // Buscar o ponto atualizado para verificar se as contribuições batem
      const updatedPoint = await prisma.indexHistoryPoints.findFirst({
        where: {
          indexId: index.id,
          date: targetDate
        },
        select: {
          dailyChange: true,
          dailyContributionsByTicker: true
        }
      });

      if (updatedPoint) {
        const contributions = updatedPoint.dailyContributionsByTicker as Record<string, number> | null;
        const contributionsSum = contributions 
          ? Object.values(contributions).reduce((sum, val) => sum + val, 0)
          : 0;
        
        const difference = Math.abs((updatedPoint.dailyChange || 0) - contributionsSum);
        
        return NextResponse.json({
          success: true,
          message: `Dia ${targetDate.toISOString().split('T')[0]} recalculado com sucesso`,
          dailyChange: updatedPoint.dailyChange,
          contributionsSum: contributionsSum,
          difference: difference,
          isValid: difference < 0.01
        });
      }

      return NextResponse.json({
        success: true,
        message: `Dia ${targetDate.toISOString().split('T')[0]} recalculado com sucesso`
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao recalcular o dia'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [ADMIN RECALCULATE DAY] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: errorMsg
      },
      { status: 500 }
    );
  }
}


