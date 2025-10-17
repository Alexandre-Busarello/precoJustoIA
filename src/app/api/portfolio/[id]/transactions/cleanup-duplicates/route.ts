/**
 * Cleanup Duplicate PENDING Transactions API
 * POST /api/portfolio/[id]/transactions/cleanup-duplicates
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verify ownership
    const portfolio = await PortfolioService.getPortfolioConfig(resolvedParams.id, currentUser.id);
    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio não encontrado' }, { status: 404 });
    }

    // Find all PENDING transactions
    const pendingTransactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId: resolvedParams.id,
        status: 'PENDING',
        isAutoSuggested: true
      },
      orderBy: {
        createdAt: 'asc' // Keep the oldest one
      }
    });

    // Group by (date, type, ticker) to find duplicates
    const seen = new Map<string, string>(); // key -> transactionId (first occurrence)
    const duplicateIds: string[] = [];

    for (const tx of pendingTransactions) {
      const key = `${tx.date.toISOString().split('T')[0]}_${tx.type}_${tx.ticker || 'null'}`;
      
      if (seen.has(key)) {
        // This is a duplicate
        duplicateIds.push(tx.id);
      } else {
        // First occurrence, keep it
        seen.set(key, tx.id);
      }
    }

    // Delete duplicates
    if (duplicateIds.length > 0) {
      await prisma.portfolioTransaction.deleteMany({
        where: {
          id: {
            in: duplicateIds
          }
        }
      });
      
      console.log(`🧹 Cleaned up ${duplicateIds.length} duplicate PENDING transactions for portfolio ${resolvedParams.id}`);
    }

    return NextResponse.json({
      success: true,
      deletedCount: duplicateIds.length,
      remainingCount: seen.size,
      message: `${duplicateIds.length} transações duplicadas removidas`
    });

  } catch (error) {
    console.error('Erro ao limpar duplicatas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao limpar duplicatas' },
      { status: 500 }
    );
  }
}

