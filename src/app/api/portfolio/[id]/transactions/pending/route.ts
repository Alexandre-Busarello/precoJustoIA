/**
 * Pending Transactions API Route
 * 
 * DELETE /api/portfolio/[id]/transactions/pending - Delete all pending transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { PortfolioService } from '@/lib/portfolio-service';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * DELETE /api/portfolio/[id]/transactions/pending
 * Delete all pending transactions for a portfolio
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verify portfolio ownership
    const portfolio = await PortfolioService.getPortfolioConfig(resolvedParams.id, currentUser.id);
    
    if (!portfolio) {
      return NextResponse.json(
        { error: 'Carteira não encontrada' },
        { status: 404 }
      );
    }

    // Delete all pending transactions
    const deletedCount = await prisma.portfolioTransaction.deleteMany({
      where: {
        portfolioId: resolvedParams.id,
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount.count,
      message: `${deletedCount.count} transações pendentes removidas`
    });

  } catch (error) {
    console.error('Erro ao deletar transações pendentes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao deletar transações pendentes' },
      { status: 500 }
    );
  }
}

